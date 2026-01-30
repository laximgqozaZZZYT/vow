# Design Document: User Level System

## Overview

本設計ドキュメントは、ユーザーの成長と専門性を自動的に測定・追跡する「ユーザーレベルシステム」の技術設計を定義します。

### システム目標

1. **ユーザー成長の可視化**: 習慣/タスクの完了履歴に基づいて、ユーザー自身の成長を数値化
2. **専門性の追跡**: 厚生労働省編職業分類（JSCO）に基づく100以上のドメインで専門性レベルを追跡
3. **レベルダウン防止**: 継続しているユーザーのレベルが下がらない仕組み（最大20%の緩やかな減衰のみ）
4. **自動計算**: 習慣完了時に経験値を自動付与し、定期ジョブでレベルを再計算
5. **THLI-24との連携**: 習慣の難易度レベルを経験値計算の乗数として使用

### 主要機能

- **総合ユーザーレベル** (0-199): 専門性、習慣継続力、レジリエンスの加重平均
- **習慣継続力** (0-100): ストリーク、完了率、アクティブ習慣比率から計算
- **レジリエンス** (0-100): 回復率、バウンスバック回数、ストリーク回復率から計算
- **専門性レベル** (0-199 per domain): 経験値ベースの対数スケール
- **AIドメインマッピング**: 習慣/タスクを職業分類に自動タグ付け

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Settings Page - Profile Section                           │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │   │
│  │  │ Section.     │  │ Widget.      │  │ Chart.       │   │   │
│  │  │ UserLevel    │  │ LevelBadge   │  │ ExpertiseRadar│  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Modal.       │  │ Modal.       │  │ Section.     │          │
│  │ ExpertiseList│  │ DomainDetails│  │ LevelHistory │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │ HTTP/REST
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (Lambda + TypeScript)                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    API Routes Layer                       │   │
│  │  /api/users/:id/level                                    │   │
│  │  /api/users/:id/expertise                                │   │
│  │  /api/users/:id/level-history                            │   │
│  │  /api/domains, /api/domains/search                       │   │
│  │  /api/habits/:id/suggest-domains                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   Service Layer                           │   │
│  │  ┌────────────────┐  ┌────────────────┐                 │   │
│  │  │ User Level     │  │ Domain Mapping │                 │   │
│  │  │ Service        │  │ Service        │                 │   │
│  │  └────────────────┘  └────────────────┘                 │   │
│  │  ┌────────────────┐  ┌────────────────┐                 │   │
│  │  │ Experience     │  │ Level Decay    │                 │   │
│  │  │ Calculator     │  │ Service        │                 │   │
│  │  └────────────────┘  └────────────────┘                 │   │
│  │  ┌────────────────┐                                     │   │
│  │  │ Scheduled Job  │                                     │   │
│  │  │ Service        │                                     │   │
│  │  └────────────────┘                                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  Repository Layer                         │   │
│  │  UserLevelRepository, UserExpertiseRepository,           │   │
│  │  OccupationDomainRepository, LevelHistoryRepository      │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    External Services                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ OpenAI API   │  │ Supabase     │  │ EventBridge  │          │
│  │ (Domain Map) │  │ PostgreSQL   │  │ (Cron Jobs)  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow: Experience Point Award

```
User completes habit
        │
        ▼
Activity created (kind = "complete")
        │
        ▼
Experience Calculator triggered
        │
        ├─── Get habit's THLI-24 level (or default 50)
        │
        ├─── Calculate completion_quality_multiplier
        │    (1.0 normal, 1.2 exceeded, 0.8 partial)
        │
        ├─── Calculate frequency_bonus
        │    (1.0 first, 0.5 subsequent same day)
        │
        ▼
experience_points = level * quality * frequency
        │
        ▼
Get habit's domain_codes[]
        │
        ├─── No domains? → Award to "General" (000)
        │
        ├─── Multiple domains? → Distribute proportionally
        │
        ▼
Update user_expertise for each domain
        │
        ├─── Add experience_points
        │
        ├─── Recalculate expertise_level = min(199, floor(log2(xp + 1) * 20))
        │
        ▼
Check for level changes
        │
        ├─── expertise_level changed? → Create history record
        │
        ├─── Display toast notification
        │
        ▼
Check for overall_level change (if significant)
        │
        └─── Display celebration modal if level up
```


## Components and Interfaces

### 1. User Level Service

**Purpose**: ユーザーレベルの計算と管理を行うコアサービス

**Location**: `backend/src/services/userLevelService.ts`

**Interface**:

```typescript
interface UserLevelService {
  /**
   * ユーザーの総合レベル情報を取得
   */
  getUserLevel(userId: string): Promise<UserLevel>;

  /**
   * 習慣継続力を計算
   */
  calculateHabitContinuityPower(userId: string): Promise<number>;

  /**
   * レジリエンススコアを計算
   */
  calculateResilienceScore(userId: string): Promise<number>;

  /**
   * 総合レベルを計算
   */
  calculateOverallLevel(userId: string): Promise<number>;

  /**
   * ユーザーレベルを再計算して保存
   */
  recalculateUserLevel(userId: string): Promise<UserLevel>;

  /**
   * 新規ユーザーの初期レベルを作成
   */
  initializeUserLevel(userId: string): Promise<UserLevel>;
}

interface UserLevel {
  id: string;
  userId: string;
  overallLevel: number; // 0-199
  overallTier: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  habitContinuityPower: number; // 0-100
  resilienceScore: number; // 0-100
  totalExperiencePoints: number;
  lastCalculatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface ContinuityMetrics {
  weightedStreakScore: number; // 0-100
  completionRate30d: number; // 0-100
  activeHabitRatio: number; // 0-100
}

interface ResilienceMetrics {
  recoveryRate: number; // 0-100
  bounceBackCount: number; // normalized 0-100
  streakRecoveryRatio: number; // 0-100
}
```

**Key Algorithms**:

```typescript
// 習慣継続力の計算
function calculateHabitContinuityPower(metrics: ContinuityMetrics): number {
  return (
    metrics.weightedStreakScore * 0.4 +
    metrics.completionRate30d * 0.3 +
    metrics.activeHabitRatio * 0.3
  );
}

// レジリエンススコアの計算
function calculateResilienceScore(metrics: ResilienceMetrics): number {
  return (
    metrics.recoveryRate * 0.5 +
    metrics.bounceBackCount * 0.3 +
    metrics.streakRecoveryRatio * 0.2
  );
}

// 総合レベルの計算
function calculateOverallLevel(
  topExpertiseAvg: number,
  habitContinuityPower: number,
  resilienceScore: number
): number {
  const raw = (
    topExpertiseAvg * 0.5 +
    habitContinuityPower * 0.25 +
    resilienceScore * 0.25
  );
  return Math.min(199, Math.max(0, Math.floor(raw)));
}

// レベルティアの判定
function calculateTier(level: number): string {
  if (level < 50) return 'beginner';
  if (level < 100) return 'intermediate';
  if (level < 150) return 'advanced';
  return 'expert';
}
```

### 2. Experience Calculator Service

**Purpose**: 習慣完了時の経験値計算と付与

**Location**: `backend/src/services/experienceCalculatorService.ts`

**Interface**:

```typescript
interface ExperienceCalculatorService {
  /**
   * 習慣完了時の経験値を計算
   */
  calculateExperiencePoints(
    habitId: string,
    completionData: CompletionData
  ): Promise<ExperienceAward>;

  /**
   * 経験値を付与してドメインレベルを更新
   */
  awardExperiencePoints(
    userId: string,
    award: ExperienceAward
  ): Promise<ExperienceResult>;

  /**
   * 専門性レベルを経験値から計算
   */
  calculateExpertiseLevel(experiencePoints: number): number;
}

interface CompletionData {
  habitLevel: number | null; // THLI-24 level, null = use default 50
  completionQuality: 'normal' | 'exceeded' | 'partial';
  isFirstCompletionToday: boolean;
}

interface ExperienceAward {
  basePoints: number;
  qualityMultiplier: number;
  frequencyBonus: number;
  totalPoints: number;
  domainDistribution: DomainPoints[];
}

interface DomainPoints {
  domainCode: string;
  domainName: string;
  points: number;
  proportion: number; // 0.0 - 1.0
}

interface ExperienceResult {
  totalPointsAwarded: number;
  domainUpdates: DomainUpdate[];
  levelChanges: LevelChange[];
}

interface DomainUpdate {
  domainCode: string;
  oldExpertiseLevel: number;
  newExpertiseLevel: number;
  oldExperiencePoints: number;
  newExperiencePoints: number;
}

interface LevelChange {
  type: 'expertise' | 'overall';
  domainCode?: string;
  oldLevel: number;
  newLevel: number;
}
```

**Key Algorithms**:

```typescript
// 経験値計算
function calculateExperiencePoints(data: CompletionData): number {
  const habitLevel = data.habitLevel ?? 50; // Default level if not assessed
  
  const qualityMultiplier = {
    'normal': 1.0,
    'exceeded': 1.2,
    'partial': 0.8
  }[data.completionQuality];
  
  const frequencyBonus = data.isFirstCompletionToday ? 1.0 : 0.5;
  
  return Math.floor(habitLevel * qualityMultiplier * frequencyBonus);
}

// 専門性レベル計算（対数スケール）
function calculateExpertiseLevel(experiencePoints: number): number {
  return Math.min(199, Math.floor(Math.log2(experiencePoints + 1) * 20));
}

// ドメイン分配
function distributeTodomains(
  totalPoints: number,
  domainCodes: string[]
): DomainPoints[] {
  if (domainCodes.length === 0) {
    return [{ domainCode: '000', domainName: 'General', points: totalPoints, proportion: 1.0 }];
  }
  
  const proportion = 1.0 / domainCodes.length;
  const pointsPerDomain = Math.floor(totalPoints * proportion);
  
  return domainCodes.map(code => ({
    domainCode: code,
    domainName: getDomainName(code),
    points: pointsPerDomain,
    proportion
  }));
}
```

### 3. Domain Mapping Service

**Purpose**: 習慣/タスクを職業分類ドメインにマッピング

**Location**: `backend/src/services/domainMappingService.ts`

**Interface**:

```typescript
interface DomainMappingService {
  /**
   * AIを使用して習慣に適したドメインを提案
   */
  suggestDomains(
    habitName: string,
    habitNotes: string | null
  ): Promise<DomainSuggestion[]>;

  /**
   * キーワードでドメインを検索
   */
  searchDomains(query: string): Promise<OccupationDomain[]>;

  /**
   * 全ドメインを取得（ページネーション付き）
   */
  getAllDomains(options: PaginationOptions): Promise<PaginatedDomains>;

  /**
   * ドメイン詳細を取得
   */
  getDomainByCode(code: string): Promise<OccupationDomain | null>;
}

interface DomainSuggestion {
  domainCode: string;
  domainName: string;
  majorCategory: string;
  confidence: number; // 0.0 - 1.0
  reason: string;
}

interface OccupationDomain {
  id: string;
  majorCode: string; // 大分類コード (A-K)
  majorName: string; // 大分類名
  middleCode: string; // 中分類コード
  middleName: string; // 中分類名
  minorCode: string; // 小分類コード
  minorName: string; // 小分類名
  keywords: string[]; // マッチング用キーワード
  createdAt: Date;
}

interface PaginatedDomains {
  domains: OccupationDomain[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
```

**AI Prompt for Domain Suggestion**:

```typescript
const DOMAIN_SUGGESTION_PROMPT = `
あなたは習慣/タスクを厚生労働省編職業分類（JSCO）のドメインにマッピングする専門家です。

以下の習慣について、最も関連性の高い職業分類ドメインを最大3つ提案してください。

習慣名: {{HABIT_NAME}}
詳細: {{HABIT_NOTES}}

回答形式（JSON）:
{
  "suggestions": [
    {
      "domainCode": "B-11-111",
      "domainName": "システムエンジニア",
      "confidence": 0.85,
      "reason": "プログラミングに関連する習慣のため"
    }
  ]
}

注意:
- 関連性が低い場合は提案数を減らしてください
- confidence は 0.5 以上のもののみ提案してください
- 一般的すぎる習慣（例：「水を飲む」）は "000" (General) を提案してください
`;
```

### 4. Level Decay Service

**Purpose**: 長期間活動がないユーザーのレベル減衰を管理

**Location**: `backend/src/services/levelDecayService.ts`

**Interface**:

```typescript
interface LevelDecayService {
  /**
   * ユーザーの全ドメインに対してレベル減衰を適用
   */
  applyDecay(userId: string): Promise<DecayResult>;

  /**
   * 特定ドメインの減衰を計算（適用はしない）
   */
  calculateDecay(
    expertise: UserExpertise,
    daysSinceLastActivity: number
  ): DecayCalculation;

  /**
   * 全ユーザーに対してバッチで減衰を適用
   */
  applyDecayBatch(): Promise<BatchDecayResult>;
}

interface DecayCalculation {
  shouldDecay: boolean;
  currentLevel: number;
  decayedLevel: number;
  decayAmount: number;
  reason: string;
}

interface DecayResult {
  userId: string;
  domainsDecayed: number;
  totalDecayPoints: number;
  decayDetails: DecayDetail[];
}

interface DecayDetail {
  domainCode: string;
  oldLevel: number;
  newLevel: number;
  daysSinceActivity: number;
}

interface BatchDecayResult {
  usersProcessed: number;
  usersDecayed: number;
  totalDomainsDecayed: number;
  errors: string[];
}
```

**Decay Algorithm**:

```typescript
function calculateDecay(
  expertise: UserExpertise,
  daysSinceLastActivity: number
): DecayCalculation {
  const GRACE_PERIOD_DAYS = 14;
  const DECAY_PER_WEEK = 1;
  const MAX_DECAY_PERCENT = 0.20; // 20%
  
  if (daysSinceLastActivity <= GRACE_PERIOD_DAYS) {
    return {
      shouldDecay: false,
      currentLevel: expertise.expertiseLevel,
      decayedLevel: expertise.expertiseLevel,
      decayAmount: 0,
      reason: 'Within grace period'
    };
  }
  
  const weeksInactive = Math.floor((daysSinceLastActivity - GRACE_PERIOD_DAYS) / 7);
  const rawDecay = weeksInactive * DECAY_PER_WEEK;
  const maxDecay = Math.floor(expertise.expertiseLevel * MAX_DECAY_PERCENT);
  const actualDecay = Math.min(rawDecay, maxDecay);
  
  return {
    shouldDecay: actualDecay > 0,
    currentLevel: expertise.expertiseLevel,
    decayedLevel: expertise.expertiseLevel - actualDecay,
    decayAmount: actualDecay,
    reason: `${weeksInactive} weeks inactive, decay capped at ${MAX_DECAY_PERCENT * 100}%`
  };
}
```


## Data Models

### Database Schema

#### 1. user_levels Table

```sql
CREATE TABLE IF NOT EXISTS user_levels (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  overall_level INTEGER NOT NULL DEFAULT 0 CHECK (overall_level >= 0 AND overall_level <= 199),
  overall_tier TEXT NOT NULL DEFAULT 'beginner' CHECK (overall_tier IN ('beginner', 'intermediate', 'advanced', 'expert')),
  habit_continuity_power INTEGER NOT NULL DEFAULT 0 CHECK (habit_continuity_power >= 0 AND habit_continuity_power <= 100),
  resilience_score INTEGER NOT NULL DEFAULT 50 CHECK (resilience_score >= 0 AND resilience_score <= 100),
  total_experience_points BIGINT NOT NULL DEFAULT 0,
  last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_levels_user ON user_levels(user_id);
CREATE INDEX IF NOT EXISTS idx_user_levels_overall ON user_levels(overall_level DESC);

COMMENT ON TABLE user_levels IS 'ユーザーの総合レベルと共通スキル指標を保存';
COMMENT ON COLUMN user_levels.overall_level IS '総合ユーザーレベル (0-199)';
COMMENT ON COLUMN user_levels.overall_tier IS 'レベルティア: beginner (0-49), intermediate (50-99), advanced (100-149), expert (150-199)';
COMMENT ON COLUMN user_levels.habit_continuity_power IS '習慣継続力 (0-100)';
COMMENT ON COLUMN user_levels.resilience_score IS 'レジリエンススコア (0-100)';
```

#### 2. user_expertise Table

```sql
CREATE TABLE IF NOT EXISTS user_expertise (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain_code TEXT NOT NULL,
  domain_name TEXT NOT NULL,
  expertise_level INTEGER NOT NULL DEFAULT 0 CHECK (expertise_level >= 0 AND expertise_level <= 199),
  expertise_tier TEXT NOT NULL DEFAULT 'beginner' CHECK (expertise_tier IN ('beginner', 'intermediate', 'advanced', 'expert')),
  experience_points BIGINT NOT NULL DEFAULT 0,
  habit_count INTEGER NOT NULL DEFAULT 0,
  task_count INTEGER NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, domain_code)
);

CREATE INDEX IF NOT EXISTS idx_user_expertise_user ON user_expertise(user_id);
CREATE INDEX IF NOT EXISTS idx_user_expertise_domain ON user_expertise(domain_code);
CREATE INDEX IF NOT EXISTS idx_user_expertise_level ON user_expertise(expertise_level DESC);
CREATE INDEX IF NOT EXISTS idx_user_expertise_activity ON user_expertise(last_activity_at DESC);

COMMENT ON TABLE user_expertise IS 'ユーザーの各ドメインにおける専門性レベル';
COMMENT ON COLUMN user_expertise.domain_code IS 'JSCO小分類コード (例: B-11-111)';
COMMENT ON COLUMN user_expertise.expertise_level IS '専門性レベル (0-199)';
COMMENT ON COLUMN user_expertise.experience_points IS '累積経験値';
```

#### 3. user_level_history Table

```sql
CREATE TABLE IF NOT EXISTS user_level_history (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL CHECK (change_type IN ('overall', 'expertise', 'continuity', 'resilience')),
  domain_code TEXT, -- NULL for overall/continuity/resilience changes
  old_level INTEGER,
  new_level INTEGER NOT NULL,
  change_reason TEXT NOT NULL,
  metrics_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_level_history_user ON user_level_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_level_history_created ON user_level_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_level_history_type ON user_level_history(change_type);
CREATE INDEX IF NOT EXISTS idx_user_level_history_domain ON user_level_history(domain_code) WHERE domain_code IS NOT NULL;

COMMENT ON TABLE user_level_history IS 'ユーザーレベル変更の履歴';
COMMENT ON COLUMN user_level_history.change_reason IS '変更理由: expertise_gain, level_decay, continuity_change, resilience_change, level_recalculation';
```

#### 4. occupation_domains Table

```sql
CREATE TABLE IF NOT EXISTS occupation_domains (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  major_code TEXT NOT NULL, -- 大分類コード (A-K)
  major_name TEXT NOT NULL, -- 大分類名
  middle_code TEXT NOT NULL, -- 中分類コード
  middle_name TEXT NOT NULL, -- 中分類名
  minor_code TEXT NOT NULL UNIQUE, -- 小分類コード (ユニーク)
  minor_name TEXT NOT NULL, -- 小分類名
  keywords TEXT[] NOT NULL DEFAULT '{}', -- マッチング用キーワード
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_occupation_domains_major ON occupation_domains(major_code);
CREATE INDEX IF NOT EXISTS idx_occupation_domains_minor ON occupation_domains(minor_code);
CREATE INDEX IF NOT EXISTS idx_occupation_domains_keywords ON occupation_domains USING GIN(keywords);

COMMENT ON TABLE occupation_domains IS '厚生労働省編職業分類（JSCO）マスターデータ';
COMMENT ON COLUMN occupation_domains.major_code IS '大分類コード (A: 管理的職業, B: 専門的・技術的職業, etc.)';
```

#### 5. experience_log Table

```sql
CREATE TABLE IF NOT EXISTS experience_log (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id TEXT REFERENCES habits(id) ON DELETE SET NULL,
  activity_id TEXT REFERENCES activities(id) ON DELETE SET NULL,
  domain_code TEXT NOT NULL,
  points_awarded INTEGER NOT NULL,
  habit_level INTEGER, -- THLI-24 level at time of award
  quality_multiplier DECIMAL(3,2) NOT NULL,
  frequency_bonus DECIMAL(3,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_experience_log_user ON experience_log(user_id);
CREATE INDEX IF NOT EXISTS idx_experience_log_domain ON experience_log(domain_code);
CREATE INDEX IF NOT EXISTS idx_experience_log_created ON experience_log(created_at DESC);

COMMENT ON TABLE experience_log IS '経験値付与の監査ログ';
```

#### 6. Habits Table Extension

```sql
-- 既存のhabitsテーブルにdomain_codesカラムを追加
ALTER TABLE habits ADD COLUMN IF NOT EXISTS domain_codes TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_habits_domains ON habits USING GIN(domain_codes);

COMMENT ON COLUMN habits.domain_codes IS '関連する職業分類ドメインコードの配列';
```

#### 7. Goals Table Extension

```sql
-- 既存のgoalsテーブルにdomain_codesカラムを追加
ALTER TABLE goals ADD COLUMN IF NOT EXISTS domain_codes TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_goals_domains ON goals USING GIN(domain_codes);

COMMENT ON COLUMN goals.domain_codes IS '関連する職業分類ドメインコードの配列';
```

### TypeScript Types

```typescript
// User Level Types
interface UserLevel {
  id: string;
  userId: string;
  overallLevel: number;
  overallTier: LevelTier;
  habitContinuityPower: number;
  resilienceScore: number;
  totalExperiencePoints: number;
  lastCalculatedAt: string;
  createdAt: string;
  updatedAt: string;
}

interface UserExpertise {
  id: string;
  userId: string;
  domainCode: string;
  domainName: string;
  expertiseLevel: number;
  expertiseTier: LevelTier;
  experiencePoints: number;
  habitCount: number;
  taskCount: number;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UserLevelHistory {
  id: string;
  userId: string;
  changeType: 'overall' | 'expertise' | 'continuity' | 'resilience';
  domainCode: string | null;
  oldLevel: number | null;
  newLevel: number;
  changeReason: string;
  metricsSnapshot: MetricsSnapshot | null;
  createdAt: string;
}

interface MetricsSnapshot {
  overallLevel?: number;
  habitContinuityPower?: number;
  resilienceScore?: number;
  topExpertiseAvg?: number;
  domainLevels?: Record<string, number>;
}

interface OccupationDomain {
  id: string;
  majorCode: string;
  majorName: string;
  middleCode: string;
  middleName: string;
  minorCode: string;
  minorName: string;
  keywords: string[];
  createdAt: string;
}

type LevelTier = 'beginner' | 'intermediate' | 'advanced' | 'expert';
```

### JSCO Domain Seed Data (Sample)

```typescript
const JSCO_DOMAINS_SAMPLE: Partial<OccupationDomain>[] = [
  // A - 管理的職業
  { majorCode: 'A', majorName: '管理的職業', middleCode: 'A-01', middleName: '管理的公務員', minorCode: 'A-01-011', minorName: '議会議員', keywords: ['政治', '議員', '公務員', 'politics'] },
  { majorCode: 'A', majorName: '管理的職業', middleCode: 'A-02', middleName: '法人・団体役員', minorCode: 'A-02-021', minorName: '会社役員', keywords: ['経営', '役員', 'CEO', 'executive', 'management'] },
  
  // B - 専門的・技術的職業
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-11', middleName: '情報処理・通信技術者', minorCode: 'B-11-111', minorName: 'システムエンジニア', keywords: ['プログラミング', 'SE', 'システム開発', 'software', 'engineering', 'coding'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-11', middleName: '情報処理・通信技術者', minorCode: 'B-11-112', minorName: 'プログラマー', keywords: ['プログラミング', 'コーディング', 'programming', 'developer', 'coding'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-12', middleName: '研究者', minorCode: 'B-12-121', minorName: '自然科学系研究者', keywords: ['研究', '科学', 'research', 'science', '実験'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-13', middleName: '医師、歯科医師、獣医師、薬剤師', minorCode: 'B-13-131', minorName: '医師', keywords: ['医療', '医師', 'doctor', 'medicine', '診療'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-14', middleName: '保健師、助産師、看護師', minorCode: 'B-14-141', minorName: '看護師', keywords: ['看護', 'nurse', '医療', 'healthcare'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-15', middleName: '教員', minorCode: 'B-15-151', minorName: '大学教授', keywords: ['教育', '大学', 'professor', 'teaching', '講義'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-16', middleName: '法務従事者', minorCode: 'B-16-161', minorName: '弁護士', keywords: ['法律', '弁護士', 'lawyer', 'legal', '訴訟'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-17', middleName: '経営・金融・保険専門職業従事者', minorCode: 'B-17-171', minorName: '公認会計士', keywords: ['会計', '監査', 'accountant', 'audit', '財務'] },
  
  // C - 事務的職業
  { majorCode: 'C', majorName: '事務的職業', middleCode: 'C-21', middleName: '一般事務従事者', minorCode: 'C-21-211', minorName: '一般事務員', keywords: ['事務', 'office', 'administration', '書類', 'デスクワーク'] },
  
  // D - 販売の職業
  { majorCode: 'D', majorName: '販売の職業', middleCode: 'D-31', middleName: '商品販売従事者', minorCode: 'D-31-311', minorName: '小売店販売員', keywords: ['販売', '接客', 'sales', 'retail', '店舗'] },
  
  // E - サービスの職業
  { majorCode: 'E', majorName: 'サービスの職業', middleCode: 'E-41', middleName: '介護サービス職業従事者', minorCode: 'E-41-411', minorName: '介護職員', keywords: ['介護', 'care', '福祉', 'welfare', '高齢者'] },
  { majorCode: 'E', majorName: 'サービスの職業', middleCode: 'E-42', middleName: '飲食物調理従事者', minorCode: 'E-42-421', minorName: '調理師', keywords: ['料理', '調理', 'cooking', 'chef', '食事'] },
  
  // F - 保安の職業
  { majorCode: 'F', majorName: '保安の職業', middleCode: 'F-51', middleName: '自衛官', minorCode: 'F-51-511', minorName: '自衛官', keywords: ['自衛隊', '防衛', 'military', 'defense'] },
  
  // G - 農林漁業の職業
  { majorCode: 'G', majorName: '農林漁業の職業', middleCode: 'G-61', middleName: '農業従事者', minorCode: 'G-61-611', minorName: '農耕作業者', keywords: ['農業', '農作物', 'farming', 'agriculture', '栽培'] },
  
  // H - 生産工程の職業
  { majorCode: 'H', majorName: '生産工程の職業', middleCode: 'H-71', middleName: '製造・加工処理従事者', minorCode: 'H-71-711', minorName: '金属加工作業者', keywords: ['製造', '加工', 'manufacturing', '工場', 'production'] },
  
  // I - 輸送・機械運転の職業
  { majorCode: 'I', majorName: '輸送・機械運転の職業', middleCode: 'I-81', middleName: '鉄道運転従事者', minorCode: 'I-81-811', minorName: '電車運転士', keywords: ['運転', '鉄道', 'train', 'driver', '運輸'] },
  
  // J - 建設・採掘の職業
  { majorCode: 'J', majorName: '建設・採掘の職業', middleCode: 'J-91', middleName: '建設躯体工事従事者', minorCode: 'J-91-911', minorName: '型枠大工', keywords: ['建設', '建築', 'construction', '工事', '大工'] },
  
  // K - 運搬・清掃・包装等の職業
  { majorCode: 'K', majorName: '運搬・清掃・包装等の職業', middleCode: 'K-99', middleName: '運搬従事者', minorCode: 'K-99-991', minorName: '倉庫作業者', keywords: ['運搬', '倉庫', 'warehouse', 'logistics', '物流'] },
  
  // 000 - General (システム用)
  { majorCode: '0', majorName: '一般', middleCode: '0-00', middleName: '一般', minorCode: '000', minorName: '一般（未分類）', keywords: ['general', '一般', 'その他'] },
];
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Level Tier Calculation Correctness

*For any* overall_level or expertise_level value between 0 and 199, the corresponding tier must be correctly calculated as:
- beginner: 0-49
- intermediate: 50-99
- advanced: 100-149
- expert: 150-199

**Validates: Requirements 1.5**

### Property 2: Domain Keywords Non-Empty

*For any* occupation domain in the occupation_domains table (except the "General" domain with code "000"), the keywords array must contain at least one keyword for matching purposes.

**Validates: Requirements 2.3**

### Property 3: Domain Search Returns Matching Results

*For any* search query to the domain search endpoint, all returned domains must have at least one keyword that contains the search query (case-insensitive partial match) or the domain name must contain the query.

**Validates: Requirements 2.5**

### Property 4: Maximum Domain Suggestions

*For any* habit or goal submitted for domain suggestion, the AI service must return at most 3 domain suggestions, each with a confidence score >= 0.5.

**Validates: Requirements 3.1**

### Property 5: Default Domain Assignment

*For any* habit or goal with an empty domain_codes array, when experience points are awarded, they must be assigned to the "General" domain (code: "000").

**Validates: Requirements 3.5, 13.6**

### Property 6: Proportional Experience Distribution

*For any* habit with N mapped domains (N > 0), when experience points are awarded, each domain must receive approximately 1/N of the total points (allowing for integer rounding).

**Validates: Requirements 3.6, 6.4**

### Property 7: Habit Continuity Power Formula

*For any* user with active habits, the habit_continuity_power must equal:
`(weighted_streak_score * 0.4) + (completion_rate_30d * 0.3) + (active_habit_ratio * 0.3)`
where each component is calculated according to its respective formula and normalized to 0-100.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

### Property 8: Resilience Score Formula

*For any* user with habit activity history, the resilience_score must equal:
`(recovery_rate * 0.5) + (bounce_back_count * 0.3) + (streak_recovery_ratio * 0.2)`
where each component is calculated according to its respective formula and normalized to 0-100.

**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

### Property 9: Experience Points Calculation

*For any* habit completion, the experience points must equal:
`habit_level * completion_quality_multiplier * frequency_bonus`
where:
- habit_level defaults to 50 if NULL
- completion_quality_multiplier is 1.0 (normal), 1.2 (exceeded), or 0.8 (partial)
- frequency_bonus is 1.0 (first completion today) or 0.5 (subsequent)

**Validates: Requirements 6.1, 6.2, 6.3, 16.2**

### Property 10: Expertise Level Formula (Logarithmic Scale)

*For any* domain with accumulated experience_points, the expertise_level must equal:
`min(199, floor(log2(experience_points + 1) * 20))`

**Validates: Requirements 6.5**

### Property 11: Overall Level Formula

*For any* user with calculated metrics, the overall_level must equal:
`(top_expertise_avg * 0.5) + (habit_continuity_power * 0.25) + (resilience_score * 0.25)`
where top_expertise_avg is the average of the user's top 5 expertise levels (or all if fewer than 5).

**Validates: Requirements 7.1, 7.2, 7.3**

### Property 12: Level Value Clamping

*For any* calculated level value (overall_level or expertise_level), the stored value must be clamped to the range [0, 199].

**Validates: Requirements 7.6**

### Property 13: Level Decay Rules

*For any* user expertise domain with no activity for more than 14 days:
1. Decay begins after the 14-day grace period
2. Decay rate is 1 point per week of inactivity
3. Maximum decay is 20% of the original expertise_level
4. Decay stops immediately when activity resumes

**Validates: Requirements 8.1, 8.2, 8.3, 8.4**

### Property 14: No Decay on Shared Metrics

*For any* user, the habit_continuity_power and resilience_score values must never be subject to decay; they are recalculated fresh daily based on current activity data.

**Validates: Requirements 8.5**

### Property 15: Level History Recording

*For any* level change (overall_level, expertise_level, habit_continuity_power > 5 points, or resilience_score), a corresponding record must be created in user_level_history with the correct change_type, old_level, new_level, and change_reason.

**Validates: Requirements 4.6, 6.7, 7.5, 8.6**

### Property 16: Experience Log Completeness

*For any* experience point award, a corresponding record must be created in experience_log with user_id, habit_id, domain_code, points_awarded, and calculation parameters.

**Validates: Requirements 13.5**

### Property 17: Expertise Record Creation Timing

*For any* user, user_expertise records must only be created when the user completes their first habit that has a domain mapping. No expertise records should exist for users who have never completed a domain-mapped habit.

**Validates: Requirements 15.3**

### Property 18: Expertise Level Monotonicity

*For any* user expertise domain, the expertise_level must never decrease due to habit completion or habit level changes. The only mechanism that can decrease expertise_level is the level decay process (which is capped at 20%).

**Validates: Requirements 16.3**

## Error Handling

### API Error Responses

```typescript
interface ErrorResponse {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}

// Error codes
const ERROR_CODES = {
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  DOMAIN_NOT_FOUND: 'DOMAIN_NOT_FOUND',
  INVALID_DOMAIN_CODE: 'INVALID_DOMAIN_CODE',
  CALCULATION_ERROR: 'CALCULATION_ERROR',
  AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  UNAUTHORIZED: 'UNAUTHORIZED',
};
```

### Error Handling Strategies

1. **AI Domain Suggestion Failures**
   - Retry up to 3 times with exponential backoff
   - On final failure, return empty suggestions with error message
   - Log failure for monitoring

2. **Level Calculation Errors**
   - Validate all input values before calculation
   - Use default values for missing data (e.g., habit_level = 50)
   - Log calculation errors but don't fail the request

3. **Database Transaction Failures**
   - Use transactions for multi-table updates (XP award + expertise update + history)
   - Rollback on any failure
   - Return appropriate error to client

4. **Scheduled Job Failures**
   - Process users in batches with individual error handling
   - Continue processing other users if one fails
   - Log all failures and alert on high failure rate

## Testing Strategy

### Dual Testing Approach

This system requires both unit tests and property-based tests for comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all valid inputs

### Property-Based Testing Configuration

- **Library**: fast-check (TypeScript)
- **Minimum iterations**: 100 per property test
- **Tag format**: `Feature: user-level-system, Property {number}: {property_text}`

### Test Categories

#### 1. Formula Verification Tests (Property-Based)

```typescript
// Property 7: Habit Continuity Power Formula
describe('Feature: user-level-system, Property 7: Habit Continuity Power Formula', () => {
  it('should calculate continuity power correctly for any valid metrics', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }), // weightedStreakScore
        fc.integer({ min: 0, max: 100 }), // completionRate30d
        fc.integer({ min: 0, max: 100 }), // activeHabitRatio
        (streak, rate, ratio) => {
          const expected = streak * 0.4 + rate * 0.3 + ratio * 0.3;
          const result = calculateHabitContinuityPower({ streak, rate, ratio });
          return Math.abs(result - expected) < 0.01;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Property 10: Expertise Level Formula
describe('Feature: user-level-system, Property 10: Expertise Level Formula', () => {
  it('should calculate expertise level correctly for any XP value', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000000 }), // experiencePoints
        (xp) => {
          const expected = Math.min(199, Math.floor(Math.log2(xp + 1) * 20));
          const result = calculateExpertiseLevel(xp);
          return result === expected;
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

#### 2. Constraint Verification Tests (Property-Based)

```typescript
// Property 1: Level Tier Calculation
describe('Feature: user-level-system, Property 1: Level Tier Calculation', () => {
  it('should assign correct tier for any level value', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 199 }),
        (level) => {
          const tier = calculateTier(level);
          if (level < 50) return tier === 'beginner';
          if (level < 100) return tier === 'intermediate';
          if (level < 150) return tier === 'advanced';
          return tier === 'expert';
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Property 12: Level Value Clamping
describe('Feature: user-level-system, Property 12: Level Value Clamping', () => {
  it('should clamp any calculated level to 0-199', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: 300 }),
        (rawLevel) => {
          const clamped = clampLevel(rawLevel);
          return clamped >= 0 && clamped <= 199;
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

#### 3. Distribution Tests (Property-Based)

```typescript
// Property 6: Proportional Experience Distribution
describe('Feature: user-level-system, Property 6: Proportional XP Distribution', () => {
  it('should distribute XP proportionally across domains', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }), // totalPoints
        fc.array(fc.string(), { minLength: 1, maxLength: 5 }), // domainCodes
        (points, domains) => {
          const distribution = distributeToDomains(points, domains);
          const totalDistributed = distribution.reduce((sum, d) => sum + d.points, 0);
          // Allow for rounding differences
          return Math.abs(totalDistributed - points) <= domains.length;
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

#### 4. Monotonicity Tests (Property-Based)

```typescript
// Property 18: Expertise Level Monotonicity
describe('Feature: user-level-system, Property 18: Expertise Monotonicity', () => {
  it('should never decrease expertise from habit completion', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 199 }), // currentExpertise
        fc.integer({ min: 1, max: 100 }), // xpAwarded
        (current, xp) => {
          const newLevel = applyExperiencePoints(current, xp);
          return newLevel >= current;
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

#### 5. Unit Tests for Edge Cases

```typescript
// Edge case: User with no habits
describe('User Level Calculation - Edge Cases', () => {
  it('should return 0 for user with no habits', async () => {
    const result = await calculateHabitContinuityPower('user-with-no-habits');
    expect(result).toBe(0);
  });

  it('should return 100 resilience for user with no breaks', async () => {
    const result = await calculateResilienceScore('user-with-perfect-streak');
    expect(result).toBe(100);
  });

  it('should use default level 50 for unassessed habits', () => {
    const xp = calculateExperiencePoints({
      habitLevel: null,
      completionQuality: 'normal',
      isFirstCompletionToday: true
    });
    expect(xp).toBe(50); // 50 * 1.0 * 1.0
  });
});
```

#### 6. Integration Tests

```typescript
describe('Experience Award Flow', () => {
  it('should award XP and update expertise on habit completion', async () => {
    // Create habit with domain mapping
    const habit = await createHabit({
      name: 'Learn TypeScript',
      domainCodes: ['B-11-111'] // Software Engineer
    });

    // Complete habit
    await completeHabit(habit.id, { quality: 'normal' });

    // Verify expertise updated
    const expertise = await getUserExpertise(userId, 'B-11-111');
    expect(expertise.experiencePoints).toBeGreaterThan(0);
    expect(expertise.expertiseLevel).toBeGreaterThan(0);

    // Verify history recorded
    const history = await getUserLevelHistory(userId);
    expect(history).toContainEqual(
      expect.objectContaining({
        changeType: 'expertise',
        domainCode: 'B-11-111'
      })
    );

    // Verify experience log created
    const log = await getExperienceLog(userId);
    expect(log).toContainEqual(
      expect.objectContaining({
        habitId: habit.id,
        domainCode: 'B-11-111'
      })
    );
  });
});
```


## UI Components

### Profile Page User Level Section

ユーザーレベルは Settings ページの Profile セクションに表示されます。

**Location**: `frontend/app/settings/page.tsx` (Profile section)

**Component Structure**:

```tsx
// Profile Section with User Level
{activeSection === 'profile' && (
  <div className="space-y-6">
    {/* User Level Card */}
    <Section.UserLevel />
    
    {/* Existing Profile Settings */}
    <div>
      <h2 className="text-xl font-semibold mb-4">Profile Settings</h2>
      {/* ... */}
    </div>
    
    {/* Subscription (if enabled) */}
    {ENABLE_SUBSCRIPTION && (
      <div>{/* ... */}</div>
    )}
  </div>
)}
```

### Section.UserLevel Component

**Location**: `frontend/app/settings/components/Section.UserLevel.tsx`

```tsx
interface UserLevelSectionProps {
  userId?: string;
}

export function SectionUserLevel({ userId }: UserLevelSectionProps) {
  const { userLevel, expertise, loading, error } = useUserLevel(userId);
  
  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState error={error} />;
  
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">ユーザーレベル</h2>
      
      {/* Overall Level Card */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Widget.LevelBadge 
              level={userLevel.overallLevel} 
              tier={userLevel.overallTier}
              size="large"
            />
            <div>
              <h3 className="text-lg font-semibold">総合レベル</h3>
              <p className="text-sm text-muted-foreground">
                Lv.{userLevel.overallLevel} ({tierLabels[userLevel.overallTier]})
              </p>
            </div>
          </div>
          <button 
            onClick={() => setShowHistory(true)}
            className="text-sm text-primary hover:underline"
          >
            履歴を見る
          </button>
        </div>
        
        {/* Skill Gauges */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Widget.SkillGauge 
            label="習慣継続力"
            value={userLevel.habitContinuityPower}
            maxValue={100}
            color="primary"
          />
          <Widget.SkillGauge 
            label="レジリエンス"
            value={userLevel.resilienceScore}
            maxValue={100}
            color="success"
          />
        </div>
      </div>
      
      {/* Top Expertise Domains */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">専門性ドメイン</h3>
          <button 
            onClick={() => setShowExpertiseList(true)}
            className="text-sm text-primary hover:underline"
          >
            すべて見る ({expertise.length})
          </button>
        </div>
        
        {expertise.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>まだ専門性がありません</p>
            <p className="text-sm mt-1">習慣を完了すると専門性が上がります</p>
          </div>
        ) : (
          <>
            {/* Radar Chart for Top 5 */}
            <Chart.ExpertiseRadar domains={expertise.slice(0, 5)} />
            
            {/* Top 5 List */}
            <div className="mt-4 space-y-2">
              {expertise.slice(0, 5).map((exp) => (
                <div 
                  key={exp.domainCode}
                  className="flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer"
                  onClick={() => openDomainDetails(exp.domainCode)}
                >
                  <div className="flex items-center gap-2">
                    <Widget.LevelBadge 
                      level={exp.expertiseLevel} 
                      tier={exp.expertiseTier}
                      size="small"
                    />
                    <span className="text-sm">{exp.domainName}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {exp.experiencePoints.toLocaleString()} XP
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      
      {/* Modals */}
      {showHistory && (
        <Modal.LevelHistory 
          userId={userId} 
          onClose={() => setShowHistory(false)} 
        />
      )}
      {showExpertiseList && (
        <Modal.ExpertiseList 
          expertise={expertise} 
          onClose={() => setShowExpertiseList(false)}
          onSelectDomain={openDomainDetails}
        />
      )}
      {selectedDomain && (
        <Modal.DomainDetails 
          domainCode={selectedDomain}
          onClose={() => setSelectedDomain(null)}
        />
      )}
    </div>
  );
}
```

### Widget.LevelBadge Component

**Location**: `frontend/components/Widget.LevelBadge.tsx`

```tsx
interface LevelBadgeProps {
  level: number;
  tier: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  size?: 'small' | 'medium' | 'large';
  showDelta?: number; // +5 or -3
}

const tierColors = {
  beginner: 'bg-success text-success-foreground',
  intermediate: 'bg-primary text-primary-foreground',
  advanced: 'bg-warning text-warning-foreground',
  expert: 'bg-destructive text-destructive-foreground',
};

const tierLabels = {
  beginner: '初級',
  intermediate: '中級',
  advanced: '上級',
  expert: 'エキスパート',
};

const sizeClasses = {
  small: 'w-8 h-8 text-xs',
  medium: 'w-12 h-12 text-sm',
  large: 'w-16 h-16 text-lg',
};

export function LevelBadge({ level, tier, size = 'medium', showDelta }: LevelBadgeProps) {
  return (
    <div className="relative">
      <div className={`
        ${sizeClasses[size]}
        ${tierColors[tier]}
        rounded-full flex items-center justify-center font-bold
        shadow-sm
      `}>
        {level}
      </div>
      {showDelta && (
        <span className={`
          absolute -top-1 -right-1 
          px-1 text-xs font-medium rounded
          ${showDelta > 0 ? 'bg-success text-success-foreground' : 'bg-destructive text-destructive-foreground'}
        `}>
          {showDelta > 0 ? `+${showDelta}` : showDelta}
        </span>
      )}
    </div>
  );
}
```

### Widget.SkillGauge Component

**Location**: `frontend/components/Widget.SkillGauge.tsx`

```tsx
interface SkillGaugeProps {
  label: string;
  value: number;
  maxValue: number;
  color: 'primary' | 'success' | 'warning' | 'destructive';
}

export function SkillGauge({ label, value, maxValue, color }: SkillGaugeProps) {
  const percentage = Math.min(100, (value / maxValue) * 100);
  
  const colorClasses = {
    primary: 'bg-primary',
    success: 'bg-success',
    warning: 'bg-warning',
    destructive: 'bg-destructive',
  };
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm text-muted-foreground">{value}/{maxValue}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full ${colorClasses[color]} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
```

### useUserLevel Hook

**Location**: `frontend/hooks/useUserLevel.ts`

```typescript
interface UseUserLevelReturn {
  userLevel: UserLevel | null;
  expertise: UserExpertise[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useUserLevel(userId?: string): UseUserLevelReturn {
  const [userLevel, setUserLevel] = useState<UserLevel | null>(null);
  const [expertise, setExpertise] = useState<UserExpertise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchUserLevel = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [levelRes, expertiseRes] = await Promise.all([
        fetch(`/api/users/${userId}/level`),
        fetch(`/api/users/${userId}/expertise`),
      ]);
      
      if (!levelRes.ok || !expertiseRes.ok) {
        throw new Error('Failed to fetch user level data');
      }
      
      const levelData = await levelRes.json();
      const expertiseData = await expertiseRes.json();
      
      setUserLevel(levelData);
      setExpertise(expertiseData.sort((a, b) => b.expertiseLevel - a.expertiseLevel));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [userId]);
  
  useEffect(() => {
    if (userId) {
      fetchUserLevel();
    }
  }, [userId, fetchUserLevel]);
  
  return { userLevel, expertise, loading, error, refetch: fetchUserLevel };
}
```
