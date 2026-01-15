import { supabase } from './supabaseClient';
import { debug } from './debug';

export interface GuestDataMigrationResult {
  success: boolean;
  migratedGoals: number;
  migratedHabits: number;
  migratedActivities: number;
  errors: string[];
}

export class GuestDataMigration {
  /**
   * ゲストユーザーのLocalStorageデータをSupabaseに移行
   */
  static async migrateGuestDataToSupabase(userId: string): Promise<GuestDataMigrationResult> {
    const result: GuestDataMigrationResult = {
      success: false,
      migratedGoals: 0,
      migratedHabits: 0,
      migratedActivities: 0,
      errors: []
    };

    if (!supabase) {
      result.errors.push('Supabase not configured');
      return result;
    }

    debug.log('[Migration] Starting guest data migration for user:', userId);
    
    // Supabaseセッション確認
    const { data: { session } } = await supabase.auth.getSession();
    debug.log('[Migration] Supabase session check:', { 
      hasSession: !!session?.session, 
      userId: session?.session?.user?.id,
      targetUserId: userId 
    });

    try {
      // 1. Goals移行（IDマッピングを取得）
      debug.log('[Migration] Step 1: Migrating goals...');
      const goalIdMapping = await this.migrateGoals(userId, result);
      debug.log('[Migration] Goals migration completed. Mapping:', goalIdMapping);
      
      // 2. Habits移行（goalId参照を更新）
      debug.log('[Migration] Step 2: Migrating habits...');
      await this.migrateHabits(userId, goalIdMapping, result);
      debug.log('[Migration] Habits migration completed');
      
      // 3. Activities移行
      debug.log('[Migration] Step 3: Migrating activities...');
      await this.migrateActivities(userId, result);
      debug.log('[Migration] Activities migration completed');

      // 4. 移行成功時のクリーンアップ（エラーがない場合のみ）
      if (result.errors.length === 0) {
        debug.log('[Migration] All migrations successful, clearing guest data');
        this.clearGuestData();
        result.success = true;
        debug.log('[Migration] Migration completed successfully:', result);
      } else {
        debug.warn('[Migration] Migration completed with errors, guest data preserved:', result);
        // 部分的な失敗の場合、ゲストデータは保持する
      }

    } catch (error) {
      console.error('[Migration] Migration failed:', error);
      result.errors.push(`Migration failed: ${(error as any)?.message || error}`);
    }

    return result;
  }

  /**
   * ゲストGoalsをSupabaseに移行し、IDマッピングを返す
   */
  private static async migrateGoals(userId: string, result: GuestDataMigrationResult): Promise<Map<string, string>> {
    const guestGoals = JSON.parse(localStorage.getItem('guest-goals') || '[]');
    const goalIdMapping = new Map<string, string>(); // ゲストID → Supabase ID
    
    if (guestGoals.length === 0) {
      debug.log('[Migration] No guest goals to migrate');
      return goalIdMapping;
    }

    debug.log('[Migration] Migrating', guestGoals.length, 'goals');

    for (const goal of guestGoals) {
      try {
        // 重複チェック: 同じ名前のゴールが既に存在するかチェック
        const { data: existingGoals, error: checkError } = await supabase!
          .from('goals')
          .select('id, name')
          .eq('owner_type', 'user')
          .eq('owner_id', userId)
          .eq('name', goal.name)
          .limit(1);

        if (checkError) {
          console.error('[Migration] Goal duplicate check error:', checkError);
          result.errors.push(`Goal "${goal.name}" duplicate check failed: ${checkError.message}`);
          continue;
        }

        if (existingGoals && existingGoals.length > 0) {
          debug.log('[Migration] Goal already exists, skipping:', goal.name);
          // 既存のゴールIDをマッピングに追加
          goalIdMapping.set(goal.id, existingGoals[0].id);
          continue;
        }

        const now = new Date().toISOString();
        const { data, error } = await supabase!
          .from('goals')
          .insert({
            name: goal.name,
            details: goal.details,
            due_date: goal.dueDate,
            parent_id: goal.parentId,
            owner_type: 'user',
            owner_id: userId,
            is_completed: goal.isCompleted || false,
            created_at: goal.createdAt || now,
            updated_at: now
          })
          .select()
          .single();

        if (error) {
          console.error('[Migration] Goal migration error:', error);
          result.errors.push(`Goal "${goal.name}": ${error.message}`);
        } else {
          result.migratedGoals++;
          goalIdMapping.set(goal.id, data.id); // ゲストID → Supabase IDのマッピング
          debug.log('[Migration] Goal migrated:', goal.name, goal.id, '→', data.id);
          
          // 挿入されたデータを確認
          debug.log('[Migration] Inserted goal data:', data);
        }
      } catch (error) {
        console.error('[Migration] Goal migration exception:', error);
        result.errors.push(`Goal "${goal.name}": ${(error as any)?.message || error}`);
      }
    }

    return goalIdMapping;
  }

  /**
   * ゲストHabitsをSupabaseに移行（goalId参照を更新）
   */
  private static async migrateHabits(userId: string, goalIdMapping: Map<string, string>, result: GuestDataMigrationResult) {
    const guestHabits = JSON.parse(localStorage.getItem('guest-habits') || '[]');
    
    if (guestHabits.length === 0) {
      debug.log('[Migration] No guest habits to migrate');
      return;
    }

    debug.log('[Migration] Migrating', guestHabits.length, 'habits');

    // デフォルトゴールを取得または作成
    const defaultGoalId = await this.getOrCreateDefaultGoal(userId);

    for (const habit of guestHabits) {
      try {
        // 重複チェック: 同じ名前のハビットが既に存在するかチェック
        const { data: existingHabits, error: checkError } = await supabase!
          .from('habits')
          .select('id, name')
          .eq('owner_type', 'user')
          .eq('owner_id', userId)
          .eq('name', habit.name)
          .limit(1);

        if (checkError) {
          console.error('[Migration] Habit duplicate check error:', checkError);
          result.errors.push(`Habit "${habit.name}" duplicate check failed: ${checkError.message}`);
          continue;
        }

        if (existingHabits && existingHabits.length > 0) {
          debug.log('[Migration] Habit already exists, skipping:', habit.name);
          continue;
        }

        // goalId参照を更新: ゲストgoalIdがマッピングにある場合は使用、なければデフォルト
        let targetGoalId = defaultGoalId;
        if (habit.goalId && goalIdMapping.has(habit.goalId)) {
          targetGoalId = goalIdMapping.get(habit.goalId)!;
          debug.log('[Migration] Updated habit goalId:', habit.goalId, '→', targetGoalId);
        } else if (habit.goalId) {
          debug.log('[Migration] Guest goalId not found in mapping, using default:', habit.goalId);
        }

        const now = new Date().toISOString();
        const { data, error } = await supabase!
          .from('habits')
          .insert({
            goal_id: targetGoalId, // 更新されたgoalIdを使用
            name: habit.name,
            type: habit.type,
            active: habit.active !== false,
            count: habit.count || 0,
            must: habit.must,
            duration: habit.duration,
            reminders: habit.reminders,
            due_date: habit.dueDate,
            time: habit.time,
            end_time: habit.endTime,
            repeat: habit.repeat,
            timings: habit.timings,
            all_day: habit.allDay,
            notes: habit.notes,
            workload_unit: habit.workloadUnit,
            workload_total: habit.workloadTotal,
            workload_per_count: habit.workloadPerCount || 1,
            completed: habit.completed || false,
            owner_type: 'user',
            owner_id: userId,
            created_at: habit.createdAt || now,
            updated_at: now
          })
          .select()
          .single();

        if (error) {
          console.error('[Migration] Habit migration error:', error);
          result.errors.push(`Habit "${habit.name}": ${error.message}`);
        } else {
          result.migratedHabits++;
          debug.log('[Migration] Habit migrated:', habit.name, '→', data.id, 'goalId:', targetGoalId);
        }
      } catch (error) {
        console.error('[Migration] Habit migration exception:', error);
        result.errors.push(`Habit "${habit.name}": ${(error as any)?.message || error}`);
      }
    }
  }

  /**
   * ゲストActivitiesをSupabaseに移行
   */
  private static async migrateActivities(userId: string, result: GuestDataMigrationResult) {
    const guestActivities = JSON.parse(localStorage.getItem('guest-activities') || '[]');
    
    if (guestActivities.length === 0) {
      debug.log('[Migration] No guest activities to migrate');
      return;
    }

    debug.log('[Migration] Migrating', guestActivities.length, 'activities');

    for (const activity of guestActivities) {
      try {
        // 重複チェック: 同じタイムスタンプとhabitNameのアクティビティが既に存在するかチェック
        const { data: existingActivities, error: checkError } = await supabase!
          .from('activities')
          .select('id')
          .eq('owner_type', 'user')
          .eq('owner_id', userId)
          .eq('habit_name', activity.habitName)
          .eq('timestamp', activity.timestamp)
          .limit(1);

        if (checkError) {
          console.error('[Migration] Activity duplicate check error:', checkError);
          result.errors.push(`Activity "${activity.habitName}" duplicate check failed: ${checkError.message}`);
          continue;
        }

        if (existingActivities && existingActivities.length > 0) {
          debug.log('[Migration] Activity already exists, skipping:', activity.habitName, activity.timestamp);
          continue;
        }

        const { data, error } = await supabase!
          .from('activities')
          .insert({
            kind: activity.kind,
            habit_id: null, // ゲストActivityのhabitIdは無効なので、nullに設定
            habit_name: activity.habitName,
            timestamp: activity.timestamp,
            amount: activity.amount,
            prev_count: activity.prevCount,
            new_count: activity.newCount,
            duration_seconds: activity.durationSeconds,
            owner_type: 'user',
            owner_id: userId
          })
          .select()
          .single();

        if (error) {
          console.error('[Migration] Activity migration error:', error);
          result.errors.push(`Activity "${activity.habitName}": ${error.message}`);
        } else {
          result.migratedActivities++;
          debug.log('[Migration] Activity migrated:', activity.habitName, activity.timestamp, '→', data.id);
        }
      } catch (error) {
        console.error('[Migration] Activity migration exception:', error);
        result.errors.push(`Activity "${activity.habitName}": ${(error as any)?.message || error}`);
      }
    }
  }

  /**
   * デフォルトゴールを取得または作成
   */
  private static async getOrCreateDefaultGoal(userId: string): Promise<string> {
    // 既存のデフォルトゴールを検索
    const { data: existingGoals, error: searchError } = await supabase!
      .from('goals')
      .select('*')
      .eq('owner_type', 'user')
      .eq('owner_id', userId)
      .eq('name', 'My Goals')
      .limit(1);

    if (searchError) {
      console.error('[Migration] Default goal search error:', searchError);
      throw searchError;
    }

    if (existingGoals && existingGoals.length > 0) {
      debug.log('[Migration] Using existing default goal:', existingGoals[0].id);
      return existingGoals[0].id;
    }

    // デフォルトゴールを作成
    debug.log('[Migration] Creating new default goal');
    const now = new Date().toISOString();
    const { data: newGoal, error: createError } = await supabase!
      .from('goals')
      .insert({
        name: 'My Goals',
        details: 'Default goal for organizing habits (migrated from guest data)',
        owner_type: 'user',
        owner_id: userId,
        is_completed: false,
        created_at: now,
        updated_at: now
      })
      .select()
      .single();

    if (createError) {
      console.error('[Migration] Default goal creation error:', createError);
      throw createError;
    }

    debug.log('[Migration] Created new default goal:', newGoal.id);
    return newGoal.id;
  }

  /**
   * ゲストデータをLocalStorageから削除
   */
  private static clearGuestData() {
    debug.log('[Migration] Clearing guest data from localStorage');
    localStorage.removeItem('guest-goals');
    localStorage.removeItem('guest-habits');
    localStorage.removeItem('guest-activities');
  }

  /**
   * ゲストデータが存在するかチェック
   */
  static hasGuestData(): boolean {
    const guestGoals = JSON.parse(localStorage.getItem('guest-goals') || '[]');
    const guestHabits = JSON.parse(localStorage.getItem('guest-habits') || '[]');
    const guestActivities = JSON.parse(localStorage.getItem('guest-activities') || '[]');
    
    return guestGoals.length > 0 || guestHabits.length > 0 || guestActivities.length > 0;
  }
}