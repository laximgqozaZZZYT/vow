# Design Document: Level System Rebalancing

## Overview

本設計ドキュメントは、ユーザーレベル（Expertise Level）と習慣レベル（THLI-24）の両システムにおけるレベルインフレーション問題を解決するための技術設計を定義します。

### システム目標

1. **適切な進行曲線**: Lv.100到達に6-9ヶ月、Lv.199到達に24ヶ月以上の継続的な努力を要求
2. **均等な分布**: 習慣レベルが1-200の範囲に適切に分布
3. **スムーズな移行**: 既存ユーザーのレベルを新スケールに移行（最大50%の圧縮）
4. **段階的ロールアウト**: フィーチャーフラグによる安全なデプロイ
5. **ロールバック対応**: 問題発生時の迅速な復旧

### 主要変更点

| 項目 | 現在 | 新規 |
|------|------|------|
| レベル計算式 | `10 * log2(xp/100 + 1)` | `5 * log2(xp/1000 + 1)` |
| 最大レベル | 199 | 9999 |
| ティア境界 | beginner(0-49), intermediate(50-99), advanced(100-149), expert(150-199) | beginner(0-49), intermediate(50-99), advanced(100-499), expert(500-9999) |
| 基本XP | `habit_level * 10` | `habit_level * 2` |
| ストリークボーナス | `min(streak * 2, 50)` | `min(streak, 30)` |
| デフォルト習慣レベル | 50 | 25 |
| THLI-24スコアセット | 7段階 | 13段階 |
| 減衰率 | 1pt/週 | 0.5pt/週 |
| 減衰猶予期間 | 14日 | 21日 |

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Settings Page - Profile Section                           │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │   │
│  │  │ Widget.      │  │ Section.     │  │ Modal.       │   │   │
│  │  │ LevelBadge   │  │ LevelProgress│  │ Migration    │   │   │
│  │  │ (Updated)    │  │ (New)        │  │ Details      │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Section.     │  │ Chart.       │  │ Modal.       │          │
│  │ LevelSimulator│ │ Progression  │  │ Recalibration│          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │ HTTP/REST
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (Lambda + TypeScript)                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    API Routes Layer                       │   │
│  │  /api/users/:id/level (updated)                          │   │
│  │  /api/level-config (new)                                 │   │
│  │  /api/level-simulator (new)                              │   │
│  │  /api/users/:id/migration-status (new)                   │   │
│  │  /api/users/:id/recalibrate-habits (new)                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   Service Layer                           │   │
│  │  ┌────────────────┐  ┌────────────────┐                 │   │
│  │  │ Level          │  │ Migration      │                 │   │
│  │  │ Rebalancing    │  │ Service        │                 │   │
│  │  │ Service        │  │                │                 │   │
│  │  └────────────────┘  └────────────────┘                 │   │
│  │  ┌────────────────┐  ┌────────────────┐                 │   │
│  │  │ Experience     │  │ THLI           │                 │   │
│  │  │ Calculator     │  │ Recalibration  │                 │   │
│  │  │ (Updated)      │  │ Service        │                 │   │
│  │  └────────────────┘  └────────────────┘                 │   │
│  │  ┌────────────────┐  ┌────────────────┐                 │   │
│  │  │ Level Config   │  │ Level Decay    │                 │   │
│  │  │ Service        │  │ Service (v2)   │                 │   │
│  │  └────────────────┘  └────────────────┘                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  Repository Layer                         │   │
│  │  LevelConfigRepository, MigrationRepository,             │   │
│  │  UserLevelBackupRepository                               │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    Database (Supabase PostgreSQL)                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ level_config │  │ user_levels  │  │ user_levels  │          │
│  │ (new)        │  │ _backup (new)│  │ (updated)    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  ┌──────────────┐  ┌──────────────┐                            │
│  │ feature_flags│  │ migration_log│                            │
│  │ (new)        │  │ (new)        │                            │
│  └──────────────┘  └──────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow: Level Migration

```
Migration Job Triggered
        │
        ▼
Check feature flag "migration_in_progress"
        │
        ├─── Already in progress? → Exit
        │
        ▼
Set "migration_in_progress" = true
        │
        ▼
Create backup of user_levels, user_expertise
        │
        ▼
For each user (batched, 100 users/batch):
        │
        ├─── Get current levels
        │
        ├─── Apply compression: new_level = floor(old_level * 0.5)
        │
        ├─── Cap decrease at 50%
        │
        ├─── Update user_levels with new values
        │
        ├─── Create level_history record (reason: "system_rebalancing")
        │
        ├─── Award Pioneer Badge if old_level >= 100
        │
        ▼
Generate migration report
        │
        ▼
Set "migration_in_progress" = false
        │
        ▼
Set "level_rebalancing_enabled" = true
```

### Data Flow: XP Calculation (New Formula)

```
User completes habit
        │
        ▼
Get level_config for current formula version
        │
        ▼
Calculate base XP:
  base_xp = floor(habit_level * 2)
  (habit_level defaults to 25 if NULL)
        │
        ▼
Calculate streak bonus:
  streak_bonus = min(streak_days, 30)
        │
        ▼
Calculate completion multiplier:
  multiplier = getMultiplier(completion_rate)
        │
        ▼
Calculate total XP:
  total_xp = floor((base_xp + streak_bonus) * multiplier)
        │
        ▼
Cap daily XP per habit at 100
        │
        ▼
Award XP and update expertise level:
  expertise_level = min(199, floor(5 * log2(total_xp / 1000 + 1)))
        │
        ▼
Log calculation with formula_version
```

## Components and Interfaces

### 1. Level Rebalancing Service

**Purpose**: 新しいレベル計算式の実装と設定管理

**Location**: `backend/src/services/levelRebalancingService.ts`

**Interface**:

```typescript
interface LevelRebalancingService {
  /**
   * 新しい計算式で経験値からレベルを計算
   */
  calculateExpertiseLevel(experiencePoints: number): number;

  /**
   * 新しい計算式で基本XPを計算
   */
  calculateBaseXP(habitLevel: number | null, streakDays: number): number;

  /**
   * 完了率に応じたXP乗数を取得
   */
  getXPMultiplier(completionRate: number): XPMultiplierResult;

  /**
   * レベル進行をシミュレート
   */
  simulateProgression(params: SimulationParams): SimulationResult;

  /**
   * 現在の設定を取得
   */
  getLevelConfig(): Promise<LevelConfig>;
}

interface LevelConfig {
  formulaVersion: string;
  expertiseLevelFormula: {
    multiplier: number; // 5 (was 10)
    divisor: number; // 1000 (was 100)
  };
  baseXPFormula: {
    habitLevelMultiplier: number; // 2 (was 10)
    defaultHabitLevel: number; // 25 (was 50)
  };
  streakBonus: {
    maxBonus: number; // 30 (was 50)
    multiplier: number; // 1 (was 2)
  };
  xpMultipliers: XPMultiplierTiers;
  decaySettings: DecaySettings;
  tierBoundaries: TierBoundaries;
  effectiveFrom: Date;
}

interface XPMultiplierTiers {
  tier0_49: number; // 0.2
  tier50_79: number; // 0.5
  tier80_99: number; // 0.8
  tier100_120: number; // 1.0
  tier121_150: number; // 0.85
  tier151_plus: number; // 0.6
}

interface DecaySettings {
  gracePeriodDays: number; // 21
  decayPerWeek: number; // 0.5
  maxDecayPercent: number; // 0.15
  recoveryBonusMultiplier: number; // 1.5
  recoveryBonusDays: number; // 7
}

interface TierBoundaries {
  beginner: { min: 0; max: 49 };
  intermediate: { min: 50; max: 99 };
  advanced: { min: 100; max: 499 };
  expert: { min: 500; max: 9999 };
}

interface SimulationParams {
  currentXP: number;
  dailyHabits: number;
  averageHabitLevel: number;
  streakDays: number;
  completionRate: number;
}

interface SimulationResult {
  currentLevel: number;
  projections: {
    oneWeek: number;
    oneMonth: number;
    threeMonths: number;
    sixMonths: number;
    oneYear: number;
    twoYears: number;
  };
  tierMilestones: {
    intermediate: { xpRequired: number; estimatedDays: number };
    advanced: { xpRequired: number; estimatedDays: number };
    expert: { xpRequired: number; estimatedDays: number };
    max: { xpRequired: number; estimatedDays: number };
  };
}
```

**Key Algorithms**:

```typescript
// 新しいレベル計算式
function calculateExpertiseLevel(experiencePoints: number): number {
  if (experiencePoints <= 0) return 0;
  
  // 新しい計算式: min(9999, floor(5 * log2(xp / 1000 + 1)))
  const rawLevel = Math.floor(5 * Math.log2(experiencePoints / 1000 + 1));
  return Math.min(9999, Math.max(0, rawLevel));
}

// 新しい基本XP計算
function calculateBaseXP(
  habitLevel: number | null,
  streakDays: number
): number {
  const level = habitLevel ?? 25; // デフォルト25（旧50）
  const baseXP = Math.floor(level * 2); // 旧: level * 10
  const streakBonus = Math.min(streakDays, 30); // 旧: min(streak * 2, 50)
  return baseXP + streakBonus;
}

// 新しいXP乗数
function getXPMultiplier(completionRate: number): XPMultiplierResult {
  if (completionRate < 50) {
    return { multiplier: 0.2, tier: 'minimal', reason: 'completion_under_50' };
  } else if (completionRate < 80) {
    return { multiplier: 0.5, tier: 'partial', reason: 'completion_50_79' };
  } else if (completionRate < 100) {
    return { multiplier: 0.8, tier: 'near_complete', reason: 'completion_80_99' };
  } else if (completionRate <= 120) {
    return { multiplier: 1.0, tier: 'optimal', reason: 'completion_100_120' };
  } else if (completionRate <= 150) {
    return { multiplier: 0.85, tier: 'over_achieve', reason: 'completion_121_150' };
  } else {
    return { multiplier: 0.6, tier: 'burnout_risk', reason: 'completion_over_150' };
  }
}

// レベル進行シミュレーション
function simulateProgression(params: SimulationParams): SimulationResult {
  const dailyXP = calculateDailyXP(params);
  const currentLevel = calculateExpertiseLevel(params.currentXP);
  
  return {
    currentLevel,
    projections: {
      oneWeek: calculateExpertiseLevel(params.currentXP + dailyXP * 7),
      oneMonth: calculateExpertiseLevel(params.currentXP + dailyXP * 30),
      threeMonths: calculateExpertiseLevel(params.currentXP + dailyXP * 90),
      sixMonths: calculateExpertiseLevel(params.currentXP + dailyXP * 180),
      oneYear: calculateExpertiseLevel(params.currentXP + dailyXP * 365),
      twoYears: calculateExpertiseLevel(params.currentXP + dailyXP * 730),
    },
    tierMilestones: calculateTierMilestones(params.currentXP, dailyXP),
  };
}
```

### 2. Migration Service

**Purpose**: 既存ユーザーのレベル移行を管理

**Location**: `backend/src/services/migrationService.ts`

**Interface**:

```typescript
interface MigrationService {
  /**
   * 移行ジョブを開始
   */
  startMigration(): Promise<MigrationJob>;

  /**
   * 単一ユーザーを移行
   */
  migrateUser(userId: string): Promise<MigrationResult>;

  /**
   * 移行をロールバック
   */
  rollbackMigration(userId?: string): Promise<RollbackResult>;

  /**
   * 移行ステータスを取得
   */
  getMigrationStatus(userId: string): Promise<MigrationStatus>;

  /**
   * 移行レポートを生成
   */
  generateMigrationReport(): Promise<MigrationReport>;
}

interface MigrationJob {
  jobId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  totalUsers: number;
  processedUsers: number;
  startedAt: Date;
  completedAt?: Date;
  errors: MigrationError[];
}

interface MigrationResult {
  userId: string;
  oldLevel: number;
  newLevel: number;
  compressionApplied: number; // 0.5
  pioneerBadgeAwarded: boolean;
  expertiseLevels: {
    domainCode: string;
    oldLevel: number;
    newLevel: number;
  }[];
  migratedAt: Date;
}

interface MigrationStatus {
  userId: string;
  isMigrated: boolean;
  migrationDate?: Date;
  oldLevel?: number;
  newLevel?: number;
  pioneerBadgeAwarded: boolean;
  canRollback: boolean;
}

interface MigrationReport {
  totalUsers: number;
  migratedUsers: number;
  averageLevelChange: number;
  maxLevelChange: number;
  pioneerBadgesAwarded: number;
  levelDistribution: {
    beginner: number;
    intermediate: number;
    advanced: number;
    expert: number;
  };
  errors: MigrationError[];
  generatedAt: Date;
}

interface MigrationError {
  userId: string;
  error: string;
  timestamp: Date;
}
```

**Migration Algorithm**:

```typescript
async function migrateUser(userId: string): Promise<MigrationResult> {
  // 1. バックアップを作成
  const currentLevels = await getUserLevels(userId);
  await createBackup(userId, currentLevels);
  
  // 2. 圧縮関数を適用
  const compressionRate = 0.5;
  const newOverallLevel = Math.floor(currentLevels.overallLevel * compressionRate);
  
  // 3. 最大50%の減少に制限
  const minLevel = Math.floor(currentLevels.overallLevel * 0.5);
  const finalLevel = Math.max(newOverallLevel, minLevel);
  
  // 4. 専門性レベルも同様に圧縮
  const newExpertiseLevels = currentLevels.expertiseLevels.map(exp => ({
    ...exp,
    newLevel: Math.floor(exp.level * compressionRate),
  }));
  
  // 5. データベースを更新
  await updateUserLevels(userId, finalLevel, newExpertiseLevels);
  
  // 6. 履歴を記録
  await createLevelHistory(userId, {
    oldLevel: currentLevels.overallLevel,
    newLevel: finalLevel,
    reason: 'system_rebalancing',
  });
  
  // 7. Pioneer Badgeを授与（旧Lv.100以上）
  const pioneerBadgeAwarded = currentLevels.overallLevel >= 100;
  if (pioneerBadgeAwarded) {
    await awardPioneerBadge(userId);
  }
  
  return {
    userId,
    oldLevel: currentLevels.overallLevel,
    newLevel: finalLevel,
    compressionApplied: compressionRate,
    pioneerBadgeAwarded,
    expertiseLevels: newExpertiseLevels,
    migratedAt: new Date(),
  };
}
```

### 3. THLI Recalibration Service

**Purpose**: THLI-24スコアリング基準の更新と習慣の再評価

**Location**: `backend/src/services/thliRecalibrationService.ts`

**Interface**:

```typescript
interface THLIRecalibrationService {
  /**
   * 習慣を新しい基準で再評価
   */
  recalibrateHabit(habitId: string): Promise<RecalibrationResult>;

  /**
   * バッチ再評価を実行
   */
  batchRecalibrate(userId: string, habitIds: string[]): Promise<BatchRecalibrationResult>;

  /**
   * 新しいスコアセットを取得
   */
  getExpandedScoreSet(): number[];

  /**
   * 再評価が必要な習慣を取得
   */
  getHabitsNeedingRecalibration(userId: string): Promise<Habit[]>;
}

interface RecalibrationResult {
  habitId: string;
  oldLevel: number | null;
  newLevel: number;
  oldAssessmentData: object | null;
  newAssessmentData: object;
  recalibratedAt: Date;
}

interface BatchRecalibrationResult {
  totalHabits: number;
  recalibratedHabits: number;
  failedHabits: number;
  results: RecalibrationResult[];
  errors: { habitId: string; error: string }[];
}
```

**Expanded Score Set**:

```typescript
// 旧スコアセット（7段階）
const OLD_SCORE_SET = [0.0, 1.4, 2.8, 4.1, 5.5, 6.9, 8.3];

// 新スコアセット（13段階）
const NEW_SCORE_SET = [
  0.0,  // 最小
  0.7,  // 非常に低い
  1.4,  // 低い
  2.1,  // やや低い
  2.8,  // 中低
  3.5,  // 中
  4.1,  // 中高
  4.8,  // やや高い
  5.5,  // 高い
  6.2,  // かなり高い
  6.9,  // 非常に高い
  7.6,  // 極めて高い
  8.3,  // 最大
];

// レベル正規化
function normalizeToLevel(variableSum: number): number {
  const maxPossibleSum = 24 * 8.3; // 199.2
  return Math.floor((variableSum / maxPossibleSum) * 199);
}
```

### 4. Level Config Service

**Purpose**: レベル設定の管理とフィーチャーフラグ制御

**Location**: `backend/src/services/levelConfigService.ts`

**Interface**:

```typescript
interface LevelConfigService {
  /**
   * 現在有効な設定を取得
   */
  getCurrentConfig(): Promise<LevelConfig>;

  /**
   * 設定を更新
   */
  updateConfig(config: Partial<LevelConfig>): Promise<LevelConfig>;

  /**
   * フィーチャーフラグを取得
   */
  getFeatureFlag(flagName: string): Promise<boolean>;

  /**
   * フィーチャーフラグを設定
   */
  setFeatureFlag(flagName: string, value: boolean): Promise<void>;

  /**
   * 設定履歴を取得
   */
  getConfigHistory(): Promise<LevelConfigHistory[]>;
}

interface LevelConfigHistory {
  id: string;
  configKey: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  changedAt: Date;
}
```



## Data Models

### Database Schema

#### 1. level_config Table (New)

```sql
CREATE TABLE IF NOT EXISTS level_config (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  config_key TEXT NOT NULL UNIQUE,
  config_value JSONB NOT NULL,
  version TEXT NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_to TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_level_config_key ON level_config(config_key);
CREATE INDEX IF NOT EXISTS idx_level_config_effective ON level_config(effective_from, effective_to);

COMMENT ON TABLE level_config IS 'レベル計算式とパラメータの設定';
COMMENT ON COLUMN level_config.config_key IS '設定キー: expertise_formula, xp_formula, xp_multipliers, decay_settings, tier_boundaries';
COMMENT ON COLUMN level_config.version IS '設定バージョン（例: v2.0）';
```

**Initial Config Data**:

```sql
-- 新しいレベル計算式
INSERT INTO level_config (config_key, config_value, version) VALUES
('expertise_formula', '{"multiplier": 5, "divisor": 1000}', 'v2.0'),
('xp_formula', '{"habitLevelMultiplier": 2, "defaultHabitLevel": 25, "streakMaxBonus": 30, "streakMultiplier": 1, "dailyCapPerHabit": 100}', 'v2.0'),
('xp_multipliers', '{"tier0_49": 0.2, "tier50_79": 0.5, "tier80_99": 0.8, "tier100_120": 1.0, "tier121_150": 0.85, "tier151_plus": 0.6}', 'v2.0'),
('decay_settings', '{"gracePeriodDays": 21, "decayPerWeek": 0.5, "maxDecayPercent": 0.15, "recoveryBonusMultiplier": 1.5, "recoveryBonusDays": 7}', 'v2.0'),
('tier_boundaries', '{"beginner": {"min": 0, "max": 49}, "intermediate": {"min": 50, "max": 99}, "advanced": {"min": 100, "max": 499}, "expert": {"min": 500, "max": 9999}}', 'v2.0');
```

#### 2. feature_flags Table (New)

```sql
CREATE TABLE IF NOT EXISTS feature_flags (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  flag_name TEXT NOT NULL UNIQUE,
  flag_value BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  rollout_percentage INTEGER DEFAULT 100 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON feature_flags(flag_name);

COMMENT ON TABLE feature_flags IS 'フィーチャーフラグ管理';

-- 初期フラグ
INSERT INTO feature_flags (flag_name, flag_value, description) VALUES
('level_rebalancing_enabled', false, 'リバランスされたレベル計算式を有効化'),
('migration_in_progress', false, '移行ジョブが実行中'),
('new_xp_formula_enabled', false, '新しいXP計算式を有効化'),
('thli_recalibration_enabled', false, 'THLI-24再評価機能を有効化');
```

#### 3. user_levels_backup Table (New)

```sql
CREATE TABLE IF NOT EXISTS user_levels_backup (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  old_overall_level INTEGER NOT NULL,
  old_overall_tier TEXT NOT NULL,
  old_habit_continuity_power INTEGER NOT NULL,
  old_resilience_score INTEGER NOT NULL,
  old_total_experience_points BIGINT NOT NULL,
  old_expertise_levels JSONB NOT NULL, -- Array of {domain_code, level, xp}
  backup_reason TEXT NOT NULL DEFAULT 'system_rebalancing',
  backup_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  restored_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_levels_backup_user ON user_levels_backup(user_id);
CREATE INDEX IF NOT EXISTS idx_user_levels_backup_timestamp ON user_levels_backup(backup_timestamp DESC);

COMMENT ON TABLE user_levels_backup IS '移行前のユーザーレベルバックアップ';
```

#### 4. migration_log Table (New)

```sql
CREATE TABLE IF NOT EXISTS migration_log (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  migration_type TEXT NOT NULL CHECK (migration_type IN ('level_rebalancing', 'thli_recalibration', 'rollback')),
  old_level INTEGER,
  new_level INTEGER,
  compression_rate DECIMAL(3,2),
  pioneer_badge_awarded BOOLEAN DEFAULT false,
  details JSONB,
  migrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_migration_log_user ON migration_log(user_id);
CREATE INDEX IF NOT EXISTS idx_migration_log_type ON migration_log(migration_type);
CREATE INDEX IF NOT EXISTS idx_migration_log_migrated ON migration_log(migrated_at DESC);

COMMENT ON TABLE migration_log IS '移行ログ';
```

#### 5. user_levels Table (Extended)

```sql
-- 既存テーブルに新しいカラムを追加
ALTER TABLE user_levels ADD COLUMN IF NOT EXISTS formula_version TEXT DEFAULT 'v1.0';
ALTER TABLE user_levels ADD COLUMN IF NOT EXISTS is_migrated BOOLEAN DEFAULT false;
ALTER TABLE user_levels ADD COLUMN IF NOT EXISTS migration_date TIMESTAMPTZ;
ALTER TABLE user_levels ADD COLUMN IF NOT EXISTS pioneer_badge_awarded BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_user_levels_migrated ON user_levels(is_migrated);

COMMENT ON COLUMN user_levels.formula_version IS '使用中の計算式バージョン';
COMMENT ON COLUMN user_levels.is_migrated IS 'リバランス移行済みフラグ';
COMMENT ON COLUMN user_levels.migration_date IS '移行日時';
COMMENT ON COLUMN user_levels.pioneer_badge_awarded IS 'Pioneer Badge授与済みフラグ';
```

#### 6. habits Table (Extended)

```sql
-- 既存テーブルに再評価フラグを追加
ALTER TABLE habits ADD COLUMN IF NOT EXISTS needs_recalibration BOOLEAN DEFAULT false;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS recalibrated_at TIMESTAMPTZ;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS old_level_assessment_data JSONB;

CREATE INDEX IF NOT EXISTS idx_habits_recalibration ON habits(needs_recalibration) WHERE needs_recalibration = true;

COMMENT ON COLUMN habits.needs_recalibration IS 'THLI-24再評価が必要フラグ';
COMMENT ON COLUMN habits.recalibrated_at IS '再評価日時';
COMMENT ON COLUMN habits.old_level_assessment_data IS '再評価前の評価データ（比較用）';
```

### TypeScript Types

```typescript
// Level Config Types
interface LevelConfig {
  id: string;
  configKey: string;
  configValue: object;
  version: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface FeatureFlag {
  id: string;
  flagName: string;
  flagValue: boolean;
  description: string | null;
  rolloutPercentage: number;
  createdAt: Date;
  updatedAt: Date;
}

interface UserLevelsBackup {
  id: string;
  userId: string;
  oldOverallLevel: number;
  oldOverallTier: LevelTier;
  oldHabitContinuityPower: number;
  oldResilienceScore: number;
  oldTotalExperiencePoints: number;
  oldExpertiseLevels: ExpertiseLevelBackup[];
  backupReason: string;
  backupTimestamp: Date;
  restoredAt: Date | null;
  createdAt: Date;
}

interface ExpertiseLevelBackup {
  domainCode: string;
  domainName: string;
  level: number;
  experiencePoints: number;
}

interface MigrationLog {
  id: string;
  userId: string;
  migrationType: 'level_rebalancing' | 'thli_recalibration' | 'rollback';
  oldLevel: number | null;
  newLevel: number | null;
  compressionRate: number | null;
  pioneerBadgeAwarded: boolean;
  details: object | null;
  migratedAt: Date;
  createdAt: Date;
}

// Extended User Level
interface UserLevelExtended extends UserLevel {
  formulaVersion: string;
  isMigrated: boolean;
  migrationDate: Date | null;
  pioneerBadgeAwarded: boolean;
}

// Extended Habit
interface HabitExtended extends Habit {
  needsRecalibration: boolean;
  recalibratedAt: Date | null;
  oldLevelAssessmentData: object | null;
}
```

### XP Calculation Comparison

| シナリオ | 旧計算 | 新計算 | 差分 |
|---------|--------|--------|------|
| Lv.50習慣、ストリーク0日 | 500 XP | 100 XP | -80% |
| Lv.50習慣、ストリーク30日 | 560 XP | 130 XP | -77% |
| Lv.25習慣（デフォルト）、ストリーク0日 | 500 XP | 50 XP | -90% |
| Lv.100習慣、ストリーク30日 | 1050 XP | 230 XP | -78% |

### Level Progression Comparison

| 目標レベル | 旧システム（必要XP） | 新システム（必要XP） | 旧システム（推定日数） | 新システム（推定日数） |
|-----------|---------------------|---------------------|----------------------|----------------------|
| Lv.50 | ~3,200 XP | ~32,000 XP | ~6日 | ~90日（3ヶ月） |
| Lv.100 | ~102,400 XP | ~1,024,000 XP | ~180日 | ~270日（9ヶ月） |
| Lv.500 | N/A | ~33,554,432,000 XP | N/A | ~540日（18ヶ月） |
| Lv.9999 | N/A | 非常に大きな値 | N/A | ~730日（2年+） |

*推定日数は1日あたり平均500XP（旧）/ 100XP（新）獲得を想定



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Level Calculation Correctness

*For any* experience_points value >= 0, the calculated expertise_level must equal `min(9999, floor(5 * log2(experience_points / 1000 + 1)))`, and the corresponding tier must be correctly determined as: beginner (0-49), intermediate (50-99), advanced (100-499), expert (500-9999).

**Validates: Requirements 1.1, 1.6**

### Property 2: XP Calculation Correctness

*For any* habit completion with habit_level (or NULL defaulting to 25) and streak_days >= 0, the total XP must equal `min(100, floor(habit_level * 2) + min(streak_days, 30))`, where the daily cap of 100 XP per habit is enforced.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

### Property 3: XP Multiplier Correctness

*For any* completion_rate value, the XP multiplier must be correctly determined as:
- 0-49%: 0.2x
- 50-79%: 0.5x
- 80-99%: 0.8x
- 100-120%: 1.0x
- 121-150%: 0.85x
- 151%+: 0.6x

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

### Property 4: THLI-24 Score Normalization

*For any* set of 24 THLI-24 variable scores, each score must be from the discrete set {0.0, 0.7, 1.4, 2.1, 2.8, 3.5, 4.1, 4.8, 5.5, 6.2, 6.9, 7.6, 8.3}, and the final level must equal `floor((sum_of_variables / (24 * 8.3)) * 199)`.

**Validates: Requirements 4.1, 4.2**

### Property 5: Level Compression Correctness

*For any* user level migration, the new_level must equal `floor(old_level * 0.5)`, and the new_level must never be less than 50% of the old_level (i.e., `new_level >= floor(old_level * 0.5)`).

**Validates: Requirements 5.2, 5.3**

### Property 6: Level Decay Correctness

*For any* user with days_since_last_activity, level decay must only apply when days_since_last_activity > 21 (grace period), the decay amount must equal `0.5 * weeks_inactive` (where weeks_inactive = floor((days_since_last_activity - 21) / 7)), and the total decay must be capped at 15% of the original expertise_level.

**Validates: Requirements 9.1, 9.2, 9.3**

### Property 7: Recovery Bonus Application

*For any* user who resumes activity after experiencing level decay, the XP multiplier for the first 7 days must be 1.5x the normal multiplier.

**Validates: Requirements 9.4**

### Property 8: Level Simulation Projections

*For any* simulation with valid parameters (currentXP, dailyHabits, averageHabitLevel, streakDays, completionRate), the projected levels at each time point (1 week, 1 month, 3 months, 6 months, 1 year, 2 years) must be calculated using the new formula with accumulated XP = currentXP + (dailyXP * days).

**Validates: Requirements 7.2**

## Error Handling

### Migration Errors

1. **Database Connection Failure**
   - Retry up to 3 times with exponential backoff (2s, 4s, 8s)
   - Log error and mark migration as failed
   - Do not proceed with partial migration

2. **Individual User Migration Failure**
   - Log error with user_id and error details
   - Continue with next user in batch
   - Include in migration report errors array

3. **Backup Creation Failure**
   - Abort migration immediately
   - Log critical error
   - Alert administrators

### XP Calculation Errors

1. **Invalid Habit Level**
   - If habit_level < 0 or > 199, use default (25)
   - Log warning for data quality monitoring

2. **Missing Configuration**
   - Fall back to hardcoded defaults
   - Log error and alert administrators

3. **Overflow Prevention**
   - Cap experience_points at Number.MAX_SAFE_INTEGER
   - Log warning if approaching limit

### Rollback Procedures

1. **Automatic Rollback Triggers**
   - Migration error rate > 5%
   - Average level change > 60%
   - Database constraint violations

2. **Manual Rollback Process**
   - Set feature flag "level_rebalancing_enabled" = false
   - Restore from user_levels_backup table
   - Create rollback records in migration_log
   - Notify affected users

## Testing Strategy

### Unit Tests

Unit tests should focus on specific examples and edge cases:

1. **Level Calculation Edge Cases**
   - XP = 0 → Level = 0
   - XP = 1000 → Level = 5
   - XP = 1,000,000 → Level = 49
   - XP = MAX_SAFE_INTEGER → Level = 9999

2. **XP Calculation Edge Cases**
   - habit_level = NULL → default 25
   - streak_days = 0 → no bonus
   - streak_days = 100 → capped at 30
   - Daily cap enforcement at 100 XP

3. **Multiplier Boundary Cases**
   - completion_rate = 49.9% → 0.2x
   - completion_rate = 50% → 0.5x
   - completion_rate = 100% → 1.0x
   - completion_rate = 120% → 1.0x
   - completion_rate = 121% → 0.85x

4. **Migration Edge Cases**
   - old_level = 0 → new_level = 0
   - old_level = 199 → new_level = 99
   - Pioneer badge at exactly level 100

### Property-Based Tests

Property-based tests should use a library like `fast-check` for TypeScript with minimum 100 iterations per test.

1. **Property 1: Level Calculation**
   - Tag: **Feature: level-system-rebalancing, Property 1: Level Calculation Correctness**
   - Generate random XP values [0, MAX_SAFE_INTEGER]
   - Verify formula and tier calculation
   - Level must be in range [0, 9999]

2. **Property 2: XP Calculation**
   - Tag: **Feature: level-system-rebalancing, Property 2: XP Calculation Correctness**
   - Generate random habit_level [null, 0-199], streak_days [0-1000]
   - Verify total XP formula and daily cap

3. **Property 3: XP Multiplier**
   - Tag: **Feature: level-system-rebalancing, Property 3: XP Multiplier Correctness**
   - Generate random completion_rate [0-500]
   - Verify correct multiplier tier

4. **Property 4: THLI-24 Normalization**
   - Tag: **Feature: level-system-rebalancing, Property 4: THLI-24 Score Normalization**
   - Generate 24 random scores from discrete set
   - Verify normalization formula

5. **Property 5: Level Compression**
   - Tag: **Feature: level-system-rebalancing, Property 5: Level Compression Correctness**
   - Generate random old_level [0-199]
   - Verify compression and 50% floor

6. **Property 6: Level Decay**
   - Tag: **Feature: level-system-rebalancing, Property 6: Level Decay Correctness**
   - Generate random days_inactive [0-365], original_level [0-199]
   - Verify grace period, decay rate, and cap

7. **Property 7: Recovery Bonus**
   - Tag: **Feature: level-system-rebalancing, Property 7: Recovery Bonus Application**
   - Generate random base_multiplier, days_since_recovery [0-30]
   - Verify 1.5x bonus for first 7 days

8. **Property 8: Simulation Projections**
   - Tag: **Feature: level-system-rebalancing, Property 8: Level Simulation Projections**
   - Generate random simulation parameters
   - Verify monotonic level increase over time

### Integration Tests

1. **Migration Flow**
   - Create test users with various levels
   - Run migration
   - Verify backup created, levels compressed, history recorded

2. **XP Award Flow**
   - Complete habit with new formula
   - Verify XP calculated correctly
   - Verify level updated correctly

3. **Feature Flag Toggle**
   - Toggle rebalancing flag
   - Verify correct formula used based on flag

### Test Configuration

```typescript
// fast-check configuration
const fcConfig = {
  numRuns: 100,
  seed: Date.now(),
  verbose: true,
};

// Example property test
import * as fc from 'fast-check';

describe('Level Calculation', () => {
  it('Property 1: Level Calculation Correctness', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
        (xp) => {
          const level = calculateExpertiseLevel(xp);
          const expectedLevel = Math.min(9999, Math.floor(5 * Math.log2(xp / 1000 + 1)));
          const tier = calculateTier(level);
          
          return (
            level === expectedLevel &&
            level >= 0 &&
            level <= 9999 &&
            isValidTier(level, tier)
          );
        }
      ),
      fcConfig
    );
  });
});
```

