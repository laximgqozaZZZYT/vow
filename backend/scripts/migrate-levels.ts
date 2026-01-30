/**
 * Level Migration Script
 * 
 * レベルシステムリバランスのための移行バッチスクリプト
 * 
 * Usage:
 *   npx ts-node scripts/migrate-levels.ts [--dry-run] [--batch-size=100] [--user-id=<uuid>]
 * 
 * Options:
 *   --dry-run      実際の更新を行わずにシミュレーション
 *   --batch-size   バッチサイズ（デフォルト: 100）
 *   --user-id      特定ユーザーのみ移行
 *   --rollback     移行をロールバック
 * 
 * Requirements (level-system-rebalancing):
 * - 5.1: バッチサイズ100ユーザー
 * - 12.4: 1秒間隔
 * - 12.3: エラーハンドリング
 */

import { createClient } from '@supabase/supabase-js';

// =============================================================================
// Configuration
// =============================================================================

const SUPABASE_URL = process.env['SUPABASE_URL'] ?? '';
const SUPABASE_SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';

const DEFAULT_BATCH_SIZE = 100;
const BATCH_DELAY_MS = 1000;
const COMPRESSION_RATE = 0.5;
const PIONEER_BADGE_THRESHOLD = 100;

// =============================================================================
// Types
// =============================================================================

interface MigrationOptions {
  dryRun: boolean;
  batchSize: number;
  userId?: string;
  rollback: boolean;
}

interface MigrationResult {
  totalUsers: number;
  migratedUsers: number;
  skippedUsers: number;
  pioneerBadgesAwarded: number;
  errors: { userId: string; error: string }[];
  startTime: Date;
  endTime?: Date;
}

interface UserLevel {
  user_id: string;
  overall_level: number;
  overall_tier: string;
  total_experience_points: number;
  is_migrated: boolean;
  formula_version: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

function parseArgs(): MigrationOptions {
  const args = process.argv.slice(2);
  const options: MigrationOptions = {
    dryRun: false,
    batchSize: DEFAULT_BATCH_SIZE,
    rollback: false,
  };

  for (const arg of args) {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--rollback') {
      options.rollback = true;
    } else if (arg.startsWith('--batch-size=')) {
      options.batchSize = parseInt(arg.split('=')[1] ?? String(DEFAULT_BATCH_SIZE), 10);
    } else if (arg.startsWith('--user-id=')) {
      options.userId = arg.split('=')[1];
    }
  }

  return options;
}

function calculateNewLevel(oldLevel: number): number {
  return Math.floor(oldLevel * COMPRESSION_RATE);
}

function calculateNewTier(level: number): string {
  if (level < 50) return 'beginner';
  if (level < 100) return 'intermediate';
  if (level < 500) return 'advanced';
  return 'expert';
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// Migration Functions
// =============================================================================

async function migrateUser(
  supabase: ReturnType<typeof createClient>,
  user: UserLevel,
  dryRun: boolean
): Promise<{ success: boolean; pioneerBadge: boolean; error?: string }> {
  const oldLevel = user.overall_level;
  const newLevel = calculateNewLevel(oldLevel);
  const newTier = calculateNewTier(newLevel);
  const pioneerBadge = oldLevel >= PIONEER_BADGE_THRESHOLD;

  console.log(`  User ${user.user_id}: Lv.${oldLevel} → Lv.${newLevel} (${newTier})${pioneerBadge ? ' [Pioneer Badge]' : ''}`);

  if (dryRun) {
    return { success: true, pioneerBadge };
  }

  try {
    // バックアップを作成
    const { error: backupError } = await supabase
      .from('user_levels_backup')
      .insert({
        user_id: user.user_id,
        old_overall_level: user.overall_level,
        old_overall_tier: user.overall_tier,
        old_habit_continuity_power: 0,
        old_resilience_score: 50,
        old_total_experience_points: user.total_experience_points,
        old_expertise_levels: [],
        backup_reason: 'system_rebalancing',
      });

    if (backupError) {
      console.error(`  Backup error: ${backupError.message}`);
      // バックアップエラーは警告として続行
    }

    // ユーザーレベルを更新
    const { error: updateError } = await supabase
      .from('user_levels')
      .update({
        overall_level: newLevel,
        overall_tier: newTier,
        formula_version: 'v2.0',
        is_migrated: true,
        migration_date: new Date().toISOString(),
        pioneer_badge_awarded: pioneerBadge,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.user_id);

    if (updateError) {
      return { success: false, pioneerBadge: false, error: updateError.message };
    }

    // 移行ログを記録
    await supabase
      .from('migration_log')
      .insert({
        user_id: user.user_id,
        migration_type: 'level_rebalancing',
        old_level: oldLevel,
        new_level: newLevel,
        compression_rate: COMPRESSION_RATE,
        pioneer_badge_awarded: pioneerBadge,
        details: { oldTier: user.overall_tier, newTier },
      });

    return { success: true, pioneerBadge };
  } catch (error) {
    return { success: false, pioneerBadge: false, error: String(error) };
  }
}

async function rollbackUser(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  dryRun: boolean
): Promise<{ success: boolean; error?: string }> {
  console.log(`  Rolling back user ${userId}...`);

  if (dryRun) {
    return { success: true };
  }

  try {
    // バックアップを取得
    const { data: backup, error: fetchError } = await supabase
      .from('user_levels_backup')
      .select('*')
      .eq('user_id', userId)
      .order('backup_timestamp', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !backup) {
      return { success: false, error: 'Backup not found' };
    }

    // ユーザーレベルを復元
    const { error: updateError } = await supabase
      .from('user_levels')
      .update({
        overall_level: backup.old_overall_level,
        overall_tier: backup.old_overall_tier,
        formula_version: 'v1.0',
        is_migrated: false,
        migration_date: null,
        pioneer_badge_awarded: false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // バックアップを復元済みとしてマーク
    await supabase
      .from('user_levels_backup')
      .update({ restored_at: new Date().toISOString() })
      .eq('id', backup.id);

    // ロールバックログを記録
    await supabase
      .from('migration_log')
      .insert({
        user_id: userId,
        migration_type: 'rollback',
        old_level: backup.old_overall_level,
        new_level: backup.old_overall_level,
        details: { reason: 'manual_rollback' },
      });

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const options = parseArgs();

  console.log('='.repeat(60));
  console.log('Level System Migration Script');
  console.log('='.repeat(60));
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : options.rollback ? 'ROLLBACK' : 'MIGRATION'}`);
  console.log(`Batch Size: ${options.batchSize}`);
  if (options.userId) {
    console.log(`Target User: ${options.userId}`);
  }
  console.log('='.repeat(60));

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const result: MigrationResult = {
    totalUsers: 0,
    migratedUsers: 0,
    skippedUsers: 0,
    pioneerBadgesAwarded: 0,
    errors: [],
    startTime: new Date(),
  };

  try {
    // ユーザーを取得
    let query = supabase
      .from('user_levels')
      .select('user_id, overall_level, overall_tier, total_experience_points, is_migrated, formula_version');

    if (options.userId) {
      query = query.eq('user_id', options.userId);
    } else if (options.rollback) {
      query = query.eq('is_migrated', true);
    } else {
      query = query.eq('is_migrated', false);
    }

    const { data: users, error: fetchError } = await query;

    if (fetchError) {
      console.error(`Error fetching users: ${fetchError.message}`);
      process.exit(1);
    }

    if (!users || users.length === 0) {
      console.log('No users to process.');
      process.exit(0);
    }

    result.totalUsers = users.length;
    console.log(`Found ${users.length} users to process.`);
    console.log('');

    // バッチ処理
    for (let i = 0; i < users.length; i += options.batchSize) {
      const batch = users.slice(i, i + options.batchSize);
      const batchNum = Math.floor(i / options.batchSize) + 1;
      const totalBatches = Math.ceil(users.length / options.batchSize);

      console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} users)...`);

      for (const user of batch) {
        if (options.rollback) {
          const rollbackResult = await rollbackUser(supabase, user.user_id, options.dryRun);
          if (rollbackResult.success) {
            result.migratedUsers++;
          } else {
            result.errors.push({ userId: user.user_id, error: rollbackResult.error ?? 'Unknown error' });
          }
        } else {
          const migrateResult = await migrateUser(supabase, user as UserLevel, options.dryRun);
          if (migrateResult.success) {
            result.migratedUsers++;
            if (migrateResult.pioneerBadge) {
              result.pioneerBadgesAwarded++;
            }
          } else {
            result.errors.push({ userId: user.user_id, error: migrateResult.error ?? 'Unknown error' });
          }
        }
      }

      // バッチ間の遅延
      if (i + options.batchSize < users.length) {
        console.log(`  Waiting ${BATCH_DELAY_MS}ms before next batch...`);
        await delay(BATCH_DELAY_MS);
      }
    }

    result.endTime = new Date();

    // 結果を表示
    console.log('');
    console.log('='.repeat(60));
    console.log('Migration Complete');
    console.log('='.repeat(60));
    console.log(`Total Users: ${result.totalUsers}`);
    console.log(`Processed: ${result.migratedUsers}`);
    console.log(`Errors: ${result.errors.length}`);
    if (!options.rollback) {
      console.log(`Pioneer Badges Awarded: ${result.pioneerBadgesAwarded}`);
    }
    console.log(`Duration: ${(result.endTime.getTime() - result.startTime.getTime()) / 1000}s`);

    if (result.errors.length > 0) {
      console.log('');
      console.log('Errors:');
      for (const error of result.errors) {
        console.log(`  - ${error.userId}: ${error.error}`);
      }
    }

    if (options.dryRun) {
      console.log('');
      console.log('NOTE: This was a dry run. No changes were made.');
    }

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
