# Design Document: Habit and Goal Level System with THLI-24 AI Assessment

## Overview

This design document specifies the architecture and implementation details for a comprehensive habit and goal level system that uses the THLI-24 (Total Habit Load Index) framework to assess habit difficulty through AI-powered natural language processing.

### System Goals

1. **Accurate Level Assessment**: Use the THLI-24 framework to calculate habit difficulty levels (0-199 scale) based on 24 variables across 4 domains
2. **Intelligent Workload Management**: Automatically detect when users need level-ups (progression) or level-downs (baby steps) based on performance
3. **Natural Conversation**: Conduct assessments through conversational AI that adapts to user context and language
4. **Cost Management**: Enforce usage quotas (10 assessments/month for free users) while providing value
5. **Quality Assurance**: Validate assessments using cross-framework checks (NASA-TLX, SRBAI, COM-B)

### Key Features

- **THLI-24 Assessment Engine**: Two-pass system (Audit → Score) with Missingness Firewall
- **Baby Step Generator**: AI-powered generation of Lv.50 and Lv.10 simplified habits
- **Level History Tracking**: Complete audit trail of level changes with workload deltas
- **Scheduled Detection**: Daily jobs to identify level-up and level-down candidates
- **UI Components**: Level badges, assessment modals, history timelines
- **API Integration**: RESTful endpoints for frontend integration

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Level Badge  │  │ Assessment   │  │ Level History│          │
│  │ Component    │  │ Modal        │  │ Timeline     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │ HTTP/REST
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (Lambda + TypeScript)                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    API Routes Layer                       │   │
│  │  /api/habits/:id/assess-level                            │   │
│  │  /api/habits/:id/level-history                           │   │
│  │  /api/habits/:id/accept-baby-step                        │   │
│  │  /api/users/:id/thli-quota                               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   Service Layer                           │   │
│  │  ┌────────────────┐  ┌────────────────┐                 │   │
│  │  │ THLI           │  │ Level          │                 │   │
│  │  │ Assessment     │  │ Manager        │                 │   │
│  │  │ Service        │  │ Service        │                 │   │
│  │  └────────────────┘  └────────────────┘                 │   │
│  │  ┌────────────────┐  ┌────────────────┐                 │   │
│  │  │ Baby Step      │  │ Usage Quota    │                 │   │
│  │  │ Generator      │  │ Service        │                 │   │
│  │  └────────────────┘  └────────────────┘                 │   │
│  │  ┌────────────────┐  ┌────────────────┐                 │   │
│  │  │ AI Coach       │  │ Spec Loader    │                 │   │
│  │  │ Service        │  │ (THLI Prompt)  │                 │   │
│  │  └────────────────┘  └────────────────┘                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  Repository Layer                         │   │
│  │  HabitRepository, ActivityRepository, LevelHistoryRepo   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    External Services                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ OpenAI API   │  │ Supabase     │  │ Scheduled    │          │
│  │ (GPT-4)      │  │ PostgreSQL   │  │ Jobs (Cron)  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow: THLI-24 Assessment

```
User initiates assessment
        │
        ▼
Check quota (Usage Quota Service)
        │
        ▼
Load THLI-24 prompt (Spec Loader)
        │
        ▼
Inject user context (Personalization Engine)
        │
        ▼
Start conversational audit (AI Coach Service)
        │
        ▼
Gather facts F01-F16 (multi-turn conversation)
        │
        ▼
Calculate ICI (THLI Assessment Service)
        │
        ├─── ICI < 0.6 or U4 exists ───┐
        │                               ▼
        │                    Missingness Firewall
        │                               │
        │                               ▼
        │                    Generate VOI questions
        │                               │
        │                               ▼
        │                    Store partial assessment
        │
        ▼
Score 24 variables (discrete set)
        │
        ▼
Calculate O/E/C levels
        │
        ▼
Cross-framework validation (TLX/SRBAI/COM-B)
        │
        ▼
Store assessment data (level_assessment_data JSONB)
        │
        ▼
Update habit.level, habit.level_tier
        │
        ▼
Record in level_history
        │
        ▼
Decrement quota (quota_used += 1)
        │
        ▼
Return results to user
```

## Components and Interfaces

### 1. THLI Assessment Service

**Purpose**: Core service that implements the THLI-24 framework for habit level assessment.

**Location**: `backend/src/services/thliAssessmentService.ts`

**Interface**:

```typescript
interface THLIAssessmentService {
  /**
   * Initiate a new THLI-24 assessment for a habit
   * @param habitId - The habit to assess
   * @param userId - The user performing the assessment
   * @param conversationContext - Optional existing conversation context
   * @returns Assessment session with conversation ID
   */
  initiateAssessment(
    habitId: string,
    userId: string,
    conversationContext?: ConversationContext
  ): Promise<AssessmentSession>;

  /**
   * Continue an existing assessment with user response
   * @param sessionId - The assessment session ID
   * @param userResponse - User's response to the current question
   * @returns Next question or final results
   */
  continueAssessment(
    sessionId: string,
    userResponse: string
  ): Promise<AssessmentStep>;

  /**
   * Calculate THLI-24 level from gathered facts
   * @param facts - The 16 habit facts (F01-F16)
   * @returns Level estimates and assessment data
   */
  calculateLevel(facts: HabitFacts): Promise<LevelEstimate>;

  /**
   * Perform cross-framework validation
   * @param thliScore - The THLI-24 score
   * @param facts - The habit facts
   * @returns Validation results with gate status
   */
  crossFrameworkValidation(
    thliScore: number,
    facts: HabitFacts
  ): Promise<ValidationResult>;
}

interface HabitFacts {
  F01_action_definition: FactValue;
  F02_done_definition: FactValue;
  F03_typical_duration: FactValue;
  F04_actual_frequency: FactValue;
  F05_target_frequency: FactValue;
  F06_time_window_fixed: FactValue;
  F07_locations: FactValue;
  F08_travel_mode_distance: FactValue;
  F09_tools_resources: FactValue;
  F10_setup_steps: FactValue;
  F11_cleanup_steps: FactValue;
  F12_interruptions: FactValue;
  F13_visibility: FactValue;
  F14_failure_consequence: FactValue;
  F15_skill_certainty: FactValue;
  F16_avoidance_signals: FactValue;
}

interface FactValue {
  value: string | number | boolean;
  uType: 'U0' | 'U1' | 'U2' | 'U3' | 'U4'; // Uncertainty type
  eType: 'E0' | 'E1' | 'E2' | 'E3'; // Evidence type
  source: 'user_stated' | 'inferred' | 'default';
}

interface LevelEstimate {
  optimistic: number; // O level
  expected: { min: number; max: number }; // E level range
  conservative: number; // C level
  tier: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  variables: THLIVariable[]; // All 24 variables with scores
  ici: number; // Information Completeness Index
  abUsed: number; // Assumption Budget used
  firewallTriggered: boolean;
  voiQuestions?: VOIQuestion[]; // If firewall triggered
  promptVersion: string; // e.g., "v1.9"
}

interface THLIVariable {
  id: string; // e.g., "①", "②", ..., "㉔"
  name: string; // e.g., "Cognitive Load", "Physical Demand"
  domain: 'cognitive' | 'physical' | 'temporal' | 'social';
  score: number; // From discrete set {0.0, 1.4, 2.8, 4.1, 5.5, 6.9, 8.3}
  stoplight: 'green' | 'yellow' | 'red';
  rationale: string;
  causingFacts: string[]; // e.g., ["F01", "F03"]
}

interface VOIQuestion {
  factId: string; // e.g., "F04"
  question: string; // The question to ask user
  deltaLvUpper: number; // Potential impact on level
  priority: number; // 1-5, higher is more important
}

interface AssessmentSession {
  sessionId: string;
  habitId: string;
  userId: string;
  status: 'in_progress' | 'completed' | 'failed' | 'needs_more_data';
  conversationId: string;
  currentStep: 'audit' | 'score' | 'validation';
  gatheredFacts: Partial<HabitFacts>;
  createdAt: Date;
}

interface AssessmentStep {
  type: 'question' | 'result' | 'error';
  question?: string; // Next question to ask
  result?: LevelEstimate; // Final results
  error?: string; // Error message
  progress: { current: number; total: number }; // e.g., 5/16 facts gathered
}
```

**Key Methods**:

1. `initiateAssessment()`: Starts a new assessment session
   - Checks user quota
   - Loads THLI-24 prompt template
   - Injects habit context
   - Returns first audit question

2. `continueAssessment()`: Processes user responses
   - Parses response to extract fact values
   - Determines U-type and E-type
   - Decides next question or moves to scoring
   - Handles Missingness Firewall

3. `calculateLevel()`: Implements THLI-24 scoring algorithm
   - Validates ICI >= 0.6
   - Scores all 24 variables using rubrics
   - Calculates O/E/C estimates
   - Applies Range Justification Contract

4. `crossFrameworkValidation()`: Validates against external frameworks
   - Calculates NASA-TLX score
   - Calculates SRBAI automaticity score
   - Maps to COM-B framework
   - Returns gate status (pass/fail)

### 2. Level Manager Service

**Purpose**: Manages level changes, detects level-up/level-down candidates, and coordinates baby step generation.

**Location**: `backend/src/services/levelManagerService.ts`

**Interface**:

```typescript
interface LevelManagerService {
  /**
   * Detect habits that are candidates for level-up
   * @param userId - The user to check
   * @returns Array of level-up candidates
   */
  detectLevelUpCandidates(userId: string): Promise<LevelSuggestion[]>;

  /**
   * Detect habits that are candidates for level-down
   * @param userId - The user to check
   * @returns Array of level-down candidates
   */
  detectLevelDownCandidates(userId: string): Promise<LevelSuggestion[]>;

  /**
   * Apply a level-up to a habit
   * @param habitId - The habit to level up
   * @param targetLevel - The new target level
   * @param workloadChanges - Proposed workload changes
   * @returns Updated habit
   */
  applyLevelUp(
    habitId: string,
    targetLevel: number,
    workloadChanges: WorkloadChanges
  ): Promise<Habit>;

  /**
   * Apply a level-down (baby step) to a habit
   * @param habitId - The habit to level down
   * @param babyStepPlan - The baby step plan to apply
   * @returns Updated habit
   */
  applyLevelDown(
    habitId: string,
    babyStepPlan: BabyStepPlan
  ): Promise<Habit>;

  /**
   * Get level history for a habit
   * @param habitId - The habit ID
   * @param filters - Optional filters
   * @returns Array of level changes
   */
  getLevelHistory(
    habitId: string,
    filters?: LevelHistoryFilters
  ): Promise<LevelChange[]>;
}

interface LevelSuggestion {
  id: string;
  habitId: string;
  habitName: string;
  suggestionType: 'level_up' | 'level_down';
  currentLevel: number;
  targetLevel: number;
  proposedChanges: WorkloadChanges | BabyStepPlan;
  reason: string;
  detectedAt: Date;
  status: 'pending' | 'accepted' | 'dismissed';
}

interface WorkloadChanges {
  workloadPerCount?: { old: number; new: number; changePercent: number };
  frequency?: { old: string; new: string };
  duration?: { old: number; new: number };
  targetCount?: { old: number; new: number };
  complexity?: { old: string; new: string };
}

interface LevelChange {
  id: string;
  entityType: 'habit' | 'goal';
  entityId: string;
  oldLevel: number | null;
  newLevel: number;
  reason: string;
  workloadDelta: WorkloadChanges;
  assessedAt: Date;
  createdAt: Date;
}

interface LevelHistoryFilters {
  dateRange?: { start: Date; end: Date };
  changeType?: 'all' | 'level_up' | 'level_down' | 're_assessment';
}
```

### 3. Baby Step Generator Service

**Purpose**: Generates simplified versions of habits at target difficulty levels (Lv.50 and Lv.10).

**Location**: `backend/src/services/babyStepGeneratorService.ts`

**Interface**:

```typescript
interface BabyStepGeneratorService {
  /**
   * Generate baby step plans for a struggling habit
   * @param habitId - The habit to simplify
   * @param currentAssessment - Current THLI-24 assessment
   * @returns Lv.50 and Lv.10 baby step plans
   */
  generateBabySteps(
    habitId: string,
    currentAssessment: LevelEstimate
  ): Promise<BabyStepPlans>;

  /**
   * Calculate which variables to reduce to reach target level
   * @param currentVariables - Current THLI-24 variables
   * @param targetLevel - Target level (e.g., 50 or 10)
   * @returns Variables to reduce and by how much
   */
  calculateVariableReductions(
    currentVariables: THLIVariable[],
    targetLevel: number
  ): Promise<VariableReduction[]>;

  /**
   * Generate a minimal viable habit (Lv.10)
   * @param habit - The original habit
   * @returns Minimal habit with cue, action, stop condition
   */
  generateMinimalHabit(habit: Habit): Promise<MinimalHabit>;
}

interface BabyStepPlans {
  lv50: BabyStepPlan;
  lv10: BabyStepPlan;
}

interface BabyStepPlan {
  targetLevel: number;
  name: string; // Simplified habit name
  changes: VariableReduction[];
  workloadChanges: WorkloadChanges;
  explanation: string; // User-friendly explanation
  estimatedDifficulty: string; // e.g., "半分の負荷"
}

interface VariableReduction {
  variableId: string; // e.g., "⑱"
  variableName: string; // e.g., "Frequency"
  currentValue: string;
  newValue: string;
  pointsReduced: number;
  rationale: string;
}

interface MinimalHabit {
  cue: string; // e.g., "朝起きたら"
  action: string; // e.g., "玄関で靴を履く"
  stopCondition: string; // e.g., "靴を履いたら終わり"
  fallback: string; // e.g., "靴を履けなかったら、靴を見るだけでもOK"
  estimatedDuration: number; // 2 minutes
}
```

**Algorithm for Variable Reduction**:

```typescript
function calculateVariableReductions(
  currentVariables: THLIVariable[],
  targetLevel: number
): VariableReduction[] {
  const currentLevel = sumVariableScores(currentVariables);
  const pointsToReduce = currentLevel - targetLevel;
  
  // Priority order for reduction (highest impact first)
  const reductionPriority = [
    '⑱', // Frequency (temporal)
    '⑬', // Duration (temporal)
    '⑫', // Complexity (cognitive)
    '⑪', // Setup/Cleanup (physical)
    '⑩', // Travel Distance (physical)
    '⑨', // Tools/Resources (physical)
    '⑧', // Interruptions (social)
  ];
  
  const reductions: VariableReduction[] = [];
  let remainingPoints = pointsToReduce;
  
  for (const varId of reductionPriority) {
    if (remainingPoints <= 0) break;
    
    const variable = currentVariables.find(v => v.id === varId);
    if (!variable || variable.score === 0) continue;
    
    // Calculate how much we can reduce this variable
    const maxReduction = variable.score;
    const reduction = Math.min(maxReduction, remainingPoints);
    
    reductions.push({
      variableId: varId,
      variableName: variable.name,
      currentValue: getVariableValue(variable),
      newValue: getReducedValue(variable, reduction),
      pointsReduced: reduction,
      rationale: getReductionRationale(variable, reduction),
    });
    
    remainingPoints -= reduction;
  }
  
  return reductions;
}
```

### 4. Usage Quota Service

**Purpose**: Manages THLI-24 assessment quotas for free and premium users.

**Location**: `backend/src/services/usageQuotaService.ts`

**Interface**:

```typescript
interface UsageQuotaService {
  /**
   * Check if user has remaining THLI assessments
   * @param userId - The user to check
   * @returns Quota status
   */
  checkQuota(userId: string): Promise<QuotaStatus>;

  /**
   * Consume one THLI assessment from user's quota
   * @param userId - The user
   * @returns Updated quota status
   */
  consumeAssessment(userId: string): Promise<QuotaStatus>;

  /**
   * Reset monthly quotas (called by scheduled job)
   * @returns Number of quotas reset
   */
  resetMonthlyQuotas(): Promise<number>;

  /**
   * Get quota history for a user
   * @param userId - The user
   * @returns Array of quota periods
   */
  getQuotaHistory(userId: string): Promise<QuotaPeriod[]>;
}

interface QuotaStatus {
  quotaUsed: number;
  quotaLimit: number; // -1 for unlimited (premium)
  remaining: number;
  periodStart: Date;
  periodEnd: Date;
  isUnlimited: boolean;
}

interface QuotaPeriod {
  id: string;
  userId: string;
  quotaType: 'thli_assessments';
  quotaUsed: number;
  quotaLimit: number;
  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
}
```

## Data Models

### Database Schema Extensions

#### 1. Habits Table (Extended)

```sql
ALTER TABLE habits ADD COLUMN IF NOT EXISTS level INTEGER;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS level_tier TEXT CHECK (level_tier IN ('beginner', 'intermediate', 'advanced', 'expert'));
ALTER TABLE habits ADD COLUMN IF NOT EXISTS level_assessment_data JSONB;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS level_last_assessed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_habits_level ON habits(level);
CREATE INDEX IF NOT EXISTS idx_habits_level_tier ON habits(level_tier);
CREATE INDEX IF NOT EXISTS idx_habits_level_assessed ON habits(level_last_assessed_at);

COMMENT ON COLUMN habits.level IS 'THLI-24 level (0-199 scale)';
COMMENT ON COLUMN habits.level_tier IS 'Level tier: beginner (0-49), intermediate (50-99), advanced (100-149), expert (150-199)';
COMMENT ON COLUMN habits.level_assessment_data IS 'Full THLI-24 assessment data including all 24 variables, ICI, AB_used, O/E/C estimates';
```

**level_assessment_data JSONB Structure**:

```json
{
  "facts": {
    "F01": { "value": "30分ジョギング", "uType": "U0", "eType": "E2" },
    "F02": { "value": "3km走り終える", "uType": "U0", "eType": "E2" },
    ...
  },
  "variables": [
    {
      "id": "①",
      "name": "Cognitive Load",
      "domain": "cognitive",
      "score": 2.8,
      "stoplight": "yellow",
      "rationale": "Moderate planning required",
      "causingFacts": ["F01", "F15"]
    },
    ...
  ],
  "ici": 0.85,
  "abUsed": 2,
  "firewallTriggered": false,
  "oLevel": 65,
  "eLevelRange": { "min": 70, "max": 80 },
  "cLevel": 85,
  "crossFramework": {
    "tlxScore": 72,
    "srbaiScore": 45,
    "combScore": 68,
    "gateStatus": "pass"
  },
  "promptVersion": "v1.9",
  "assessedAt": "2025-01-27T10:30:00Z"
}
```

#### 2. Goals Table (Extended)

```sql
ALTER TABLE goals ADD COLUMN IF NOT EXISTS level INTEGER;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS level_tier TEXT CHECK (level_tier IN ('beginner', 'intermediate', 'advanced', 'expert'));
ALTER TABLE goals ADD COLUMN IF NOT EXISTS level_last_assessed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_goals_level ON goals(level);

COMMENT ON COLUMN goals.level IS 'Aggregated level from child habits (MAX)';
```

#### 3. Level History Table (New)

```sql
CREATE TABLE IF NOT EXISTS level_history (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('habit', 'goal')),
  entity_id TEXT NOT NULL,
  old_level INTEGER,
  new_level INTEGER NOT NULL,
  reason TEXT NOT NULL,
  workload_delta JSONB,
  assessed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_level_history_entity ON level_history(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_level_history_assessed ON level_history(assessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_level_history_reason ON level_history(reason);

COMMENT ON TABLE level_history IS 'Tracks all level changes for habits and goals';
COMMENT ON COLUMN level_history.reason IS 'Reason for level change: initial_assessment, re_assessment, level_up_progression, level_down_baby_step_lv50, level_down_baby_step_lv10';
```

**workload_delta JSONB Structure**:

```json
{
  "workloadPerCount": { "old": 10, "new": 12, "changePercent": 20 },
  "frequency": { "old": "weekly", "new": "daily" },
  "duration": { "old": 30, "new": 45 }
}
```

#### 4. Level Suggestions Table (New)

```sql
CREATE TABLE IF NOT EXISTS level_suggestions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  suggestion_type TEXT NOT NULL CHECK (suggestion_type IN ('level_up', 'level_down')),
  current_level INTEGER NOT NULL,
  target_level INTEGER NOT NULL,
  proposed_changes JSONB NOT NULL,
  reason TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed')),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_level_suggestions_user ON level_suggestions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_level_suggestions_habit ON level_suggestions(habit_id);
CREATE INDEX IF NOT EXISTS idx_level_suggestions_detected ON level_suggestions(detected_at DESC);

COMMENT ON TABLE level_suggestions IS 'Stores detected level-up and level-down suggestions';
```

#### 5. Token Quotas Table (Extended)

```sql
-- Add new quota type for THLI assessments
-- Existing table structure:
-- CREATE TABLE token_quotas (
--   id TEXT PRIMARY KEY,
--   user_id UUID NOT NULL,
--   quota_type TEXT NOT NULL,
--   quota_used INTEGER NOT NULL DEFAULT 0,
--   quota_limit INTEGER NOT NULL,
--   period_start TIMESTAMPTZ NOT NULL,
--   period_end TIMESTAMPTZ NOT NULL,
--   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

-- Insert default quota for new users
INSERT INTO token_quotas (user_id, quota_type, quota_used, quota_limit, period_start, period_end)
VALUES (
  :user_id,
  'thli_assessments',
  0,
  10, -- Free plan: 10 assessments/month
  date_trunc('month', NOW()),
  date_trunc('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 second'
);

COMMENT ON COLUMN token_quotas.quota_limit IS 'Quota limit per period. -1 indicates unlimited (premium users)';
```

#### 6. THLI Validation Log Table (New)

```sql
CREATE TABLE IF NOT EXISTS thli_validation_log (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thli_score INTEGER NOT NULL,
  tlx_score INTEGER,
  srbai_score INTEGER,
  comb_score INTEGER,
  gate_status TEXT NOT NULL CHECK (gate_status IN ('pass', 'fail')),
  discrepancy_details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_thli_validation_habit ON thli_validation_log(habit_id);
CREATE INDEX IF NOT EXISTS idx_thli_validation_gate ON thli_validation_log(gate_status);
CREATE INDEX IF NOT EXISTS idx_thli_validation_created ON thli_validation_log(created_at DESC);

COMMENT ON TABLE thli_validation_log IS 'Logs cross-framework validation results for quality monitoring';
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Before defining the correctness properties, I need to analyze the acceptance criteria from the requirements document to determine which are testable as properties, examples, or edge cases.

## Correctness Properties (Continued from design.md)

### Property 1: Level Field Constraints
*For any* habit or goal in the database, if level is not NULL, then level must be an integer between 0 and 199 inclusive, and level_tier must be correctly calculated as: beginner (0-49), intermediate (50-99), advanced (100-149), or expert (150-199).

**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: Assessment Data Completeness
*For any* completed THLI-24 assessment stored in level_assessment_data, the JSONB object must contain all required fields: facts (F01-F16), variables (①-㉔ with 24 entries), ici, abUsed, firewallTriggered, oLevel, eLevelRange, cLevel, crossFramework, promptVersion, and assessedAt.

**Validates: Requirements 1.4, 2.5**

### Property 3: Level Change History Invariant
*For any* level change (initial assessment, re-assessment, level-up, or level-down), a corresponding record must be created in the level_history table with entity_type, entity_id, old_level, new_level, reason, workload_delta, and assessed_at fields populated.

**Validates: Requirements 1.5, 5.4, 6.6**

### Property 4: ICI Calculation Correctness
*For any* set of habit facts, the Information Completeness Index (ICI) must be calculated as count(facts with uType='U0' in core fact set {F01,F02,F03,F04,F06,F07,F08,F09,F10,F11,F12,F13,F14,F16}) / 14, resulting in a value between 0.0 and 1.0.

**Validates: Requirements 2.2**

### Property 5: Missingness Firewall Triggering
*For any* THLI-24 assessment, if ICI < 0.6 OR any fact has uType='U4' OR any No-Inference fact (F04, F13, F14, F16) has uType != 'U0' OR abUsed > 6, then firewallTriggered must be true and scoring must be prevented (only Conservative estimate with wide range stored).

**Validates: Requirements 2.3, 2.8**

### Property 6: Discrete Score Set Validation
*For any* THLI-24 variable score stored in level_assessment_data, the score value must be from the discrete set {0.0, 1.4, 2.8, 4.1, 5.5, 6.9, 8.3}. No other values are permitted.

**Validates: Requirements 2.4, 18.5**

### Property 7: VOI Question Ranking and Limiting
*For any* assessment where the Missingness Firewall triggers, if VOI questions are generated, they must be ranked by ΔLv_upper in descending order (highest impact first) and the returned list must contain at most 5 questions.

**Validates: Requirements 2.7**

### Property 8: Habit Inventory Filtering
*For any* user initiating a habit inventory, the system must query and assess only habits WHERE active = true AND level IS NULL, excluding all other habits from the batch assessment.

**Validates: Requirements 3.1**

### Property 9: Failed Assessment Status Marking
*For any* assessment that fails due to insufficient data (Missingness Firewall triggered with ICI < 0.6), the habit or assessment session must be marked with status = "pending_data" or "needs_more_data", not as "completed" or "failed".

**Validates: Requirements 3.3**

### Property 10: Inventory Summary Accuracy
*For any* completed habit inventory, the summary report's level distribution (count of beginner, intermediate, advanced, expert) must exactly match the count of assessed habits in each tier, and the average level must equal sum(levels) / count(assessed_habits).

**Validates: Requirements 3.4**

### Property 11: Quota Enforcement During Assessment
*For any* free user (quota_limit != -1) attempting to initiate a THLI-24 assessment, if quota_used >= quota_limit for the current period, then the assessment must be prevented and an error with upgrade_required: true must be returned.

**Validates: Requirements 3.5, 7.4**

### Property 12: Inventory Resumability
*For any* interrupted habit inventory process, when resumed, the system must continue assessment from the next unassessed habit (not re-assess already completed habits), preserving all previously stored assessment results.

**Validates: Requirements 3.6**

### Property 13: Quota Increment on Success Only
*For any* THLI-24 assessment attempt, quota_used must be incremented by 1 if and only if the assessment completes successfully (status = "completed"), not when declined, failed, or interrupted.

**Validates: Requirements 4.5, 7.6**

### Property 14: Assessment Conversation Storage
*For any* THLI-24 assessment conducted through the AI coach, a conversation record must be stored in ai_coach_conversations or equivalent table with conversation_type = "thli_assessment" and the full conversation history.

**Validates: Requirements 4.7**

### Property 15: Level-Up Candidate Detection
*For any* active habit, if completion_rate >= 0.9 over the past 30 days AND days_since_last_level_change >= 30 AND level IS NOT NULL, then the habit must be flagged as a level-up candidate by the detection job.

**Validates: Requirements 5.1, 17.2**

### Property 16: Level-Up Frequency Limit
*For any* habit, level-up suggestions must not be created more frequently than once per 30 days. If a level-up was accepted or suggested within the past 30 days, no new level-up suggestion should be generated.

**Validates: Requirements 5.5**

### Property 17: Level-Down Candidate Detection
*For any* active habit, if completion_rate < 0.5 over the past 14 days AND days_active >= 14 AND level IS NOT NULL, then the habit must be flagged as a level-down candidate by the detection job.

**Validates: Requirements 6.1, 17.3**

### Property 18: Baby Step Plan Generation Completeness
*For any* level-down suggestion, both a Lv.50 plan (target_level ≈ current_level * 0.5) and a Lv.10 plan (target_level <= 10) must be generated, each with complete fields: targetLevel, name, changes, workloadChanges, explanation.

**Validates: Requirements 6.2**

### Property 19: Lv.50 Target Level Calculation
*For any* Lv.50 baby step plan, the target_level must be calculated as floor(current_level * 0.5), and the sum of pointsReduced across all variable reductions must approximately equal (current_level - target_level) within ±5 points.

**Validates: Requirements 6.3, 16.1**

### Property 20: Lv.10 Minimal Habit Structure
*For any* Lv.10 baby step plan, the minimal habit must contain all required components: cue (non-empty string), action (non-empty string), stopCondition (non-empty string), and fallback (non-empty string).

**Validates: Requirements 6.4, 16.5**

### Property 21: Free User Quota Allocation
*For any* new free user (subscription_tier = "free" or equivalent), a token_quotas record must be created with quota_type = "thli_assessments", quota_limit = 10, quota_used = 0, and period covering the current month.

**Validates: Requirements 7.1**

### Property 22: Premium User Unlimited Quota
*For any* premium user (subscription_tier = "premium" or equivalent), the token_quotas record for "thli_assessments" must have quota_limit = -1, indicating unlimited assessments.

**Validates: Requirements 7.2**

### Property 23: Monthly Quota Reset
*For any* quota period where period_end < NOW(), when the reset job runs, a new token_quotas record must be created with quota_used = 0, period_start = first day of new month, period_end = last day of new month, preserving the same quota_limit.

**Validates: Requirements 7.5**

### Property 24: Goal Level Aggregation
*For any* goal with child habits, the goal's level must equal MAX(child_habit_levels) where child habits have level IS NOT NULL. If no child habits have levels, goal level must be NULL.

**Validates: Requirements 8.4**

### Property 25: Level History Sorting
*For any* level history query for a habit or goal, the returned records must be sorted by assessed_at in descending order (most recent first), regardless of filters applied.

**Validates: Requirements 9.1**

### Property 26: Level History Filtering
*For any* level history query with filters (date range or change type), the returned records must include only entries that match ALL specified filter criteria, and must still be sorted by assessed_at DESC.

**Validates: Requirements 9.4**

### Property 27: Level History CSV Export Completeness
*For any* level history CSV export, the CSV must contain all required columns: date, old_level, new_level, delta, reason, workload_changes_json, with one row per history entry and proper CSV escaping.

**Validates: Requirements 9.5**

### Property 28: Prompt Template Validation
*For any* loaded THLI-24 prompt template, the content must contain all required section headers: "Role", "Facts system", "PASS 1", "PASS 2", "External Cross-Check Lens", "Output format". If any section is missing, validation must fail.

**Validates: Requirements 11.3**

### Property 29: Prompt Version Recording
*For any* THLI-24 assessment stored in level_assessment_data, the promptVersion field must be populated with the semantic version string (e.g., "v1.9") of the prompt template used for that assessment.

**Validates: Requirements 11.5**

### Property 30: Prompt Context Injection
*For any* THLI-24 assessment prompt built for a specific habit, all placeholder variables ({{HABIT_NAME}}, {{CURRENT_WORKLOAD}}, {{GOAL_CONTEXT}}, {{USER_LEVEL}}) must be replaced with actual values from the habit and user context. No placeholders should remain in the final prompt.

**Validates: Requirements 11.7**

### Property 31: Cross-Framework Gate Failure Detection
*For any* THLI-24 assessment where the absolute difference between thli_score and any cross-framework score (tlx_score, srbai_score, comb_score) exceeds 20 points, the gate_status must be set to "fail" and a warning flag must be added to the assessment.

**Validates: Requirements 12.2**

### Property 32: Cross-Framework Validation Logging
*For any* THLI-24 assessment that undergoes cross-framework validation, a record must be created in thli_validation_log table with habit_id, user_id, thli_score, tlx_score, srbai_score, comb_score, gate_status, and created_at fields populated.

**Validates: Requirements 12.4**

### Property 33: Language-Based Prompt Selection
*For any* THLI-24 assessment, if the user's language preference is "ja" (Japanese), the system must load thli-24-v1.9-prompt-ja.md; if "en" (English), load thli-24-v1.9-prompt.md. The loaded prompt must match the user's language.

**Validates: Requirements 15.2**

### Property 34: Context Value Injection Correctness
*For any* THLI-24 assessment with context injection, the injected values must match the actual habit data: {{HABIT_NAME}} = habit.name, {{CURRENT_WORKLOAD}} = habit.workload_per_count or workload_total, {{GOAL_CONTEXT}} = parent goal name if exists.

**Validates: Requirements 15.5**

### Property 35: Localized Prompt Consistency
*For any* sample habit assessed with both Japanese and English THLI-24 prompts, the resulting level estimates must be within ±5 points of each other, ensuring translation consistency.

**Validates: Requirements 15.7**

### Property 36: Variable Reduction Priority Order
*For any* baby step generation, when reducing variables to reach target level, the reductions must follow the priority order: ⑱ Frequency (first), ⑬ Duration (second), ⑫ Complexity (third), ⑪ Setup/Cleanup (fourth), ⑩ Travel Distance (fifth), until sufficient points are reduced.

**Validates: Requirements 16.2**

### Property 37: Frequency Reduction Transformations
*For any* baby step plan that reduces frequency (variable ⑱), the transformation must follow the rules: daily→3x/week (reduces 2.8 points), 3x/week→weekly (reduces 1.4 points), weekly→biweekly (reduces 1.4 points).

**Validates: Requirements 16.3**

### Property 38: Duration Reduction Transformations
*For any* baby step plan that reduces duration (variable ⑬), the transformation must follow the rules: >60min→30min (reduces 2.8 points), 30min→15min (reduces 1.4 points), 15min→5min (reduces 1.4 points).

**Validates: Requirements 16.4**

### Property 39: Level Suggestion Creation on Detection
*For any* habit detected as a level-up or level-down candidate by the scheduled job, a record must be created in level_suggestions table with suggestion_type, current_level, target_level, proposed_changes, detected_at, and status = "pending".

**Validates: Requirements 17.4**

### Property 40: Scheduled Job Execution Logging
*For any* scheduled job execution (level-up detection, level-down detection, quota reset), a record must be created in job_execution_log table with job_name, started_at, completed_at, habits_processed, suggestions_created, and errors fields.

**Validates: Requirements 17.7**

### Property 41: API Retry with Exponential Backoff
*For any* OpenAI API call that fails with a retryable error (timeout, rate limit, 5xx), the system must retry up to 3 times with exponential backoff delays of 2s, 4s, 8s between attempts before giving up.

**Validates: Requirements 18.1**

### Property 42: Conversation State Preservation on Failure
*For any* THLI-24 assessment where all API retries fail, the conversation state (gathered facts, current step, conversation history) must be saved to failed_assessments or equivalent table, allowing later resumption.

**Validates: Requirements 18.2**

### Property 43: Firewall Non-Error Classification
*For any* THLI-24 assessment where the Missingness Firewall triggers (ICI < 0.6 or other conditions), the system must NOT throw an error or mark the assessment as "failed". Instead, it must store status = "needs_more_data" and generate VOI questions.

**Validates: Requirements 18.3**

### Property 44: Quota Exhaustion Graceful Handling
*For any* THLI-24 assessment in progress when the user's quota is exhausted (quota_used reaches quota_limit), the current assessment must be allowed to complete successfully, and only subsequent assessment attempts must be blocked.

**Validates: Requirements 18.4**

### Property 45: Cross-Framework Failure Partial Success
*For any* THLI-24 assessment where cross-framework validation fails (gate_status = "fail"), the THLI-24 assessment data must still be stored in level_assessment_data with a warning flag, and the habit's level must still be updated (not rolled back).

**Validates: Requirements 18.6**
## Error Handling

### Error Categories

1. **User Input Errors**
   - Invalid habit ID
   - Malformed request data
   - Unauthorized access attempts
   
   **Handling**: Return 400 Bad Request with descriptive error message

2. **Quota Exceeded Errors**
   - Free user exhausted monthly THLI assessments
   
   **Handling**: Return 402 Payment Required with upgrade_required: true flag

3. **External Service Errors**
   - OpenAI API timeout
   - OpenAI API rate limit
   - OpenAI API 5xx errors
   
   **Handling**: Retry with exponential backoff (2s, 4s, 8s), then save state and return 503 Service Unavailable

4. **Data Validation Errors**
   - THLI variable score not in discrete set
   - Missing required fields in assessment data
   - Invalid level value (< 0 or > 199)
   
   **Handling**: Log warning, use fallback values, flag assessment for review

5. **Business Logic Errors**
   - Missingness Firewall triggered (not an error, normal flow)
   - Cross-framework validation failed (warning, not error)
   
   **Handling**: Store partial results, generate VOI questions or warnings

### Error Response Format

```typescript
interface ErrorResponse {
  error: {
    code: string; // e.g., "QUOTA_EXCEEDED", "ASSESSMENT_FAILED"
    message: string; // User-friendly message in user's language
    details?: Record<string, unknown>; // Additional context
    retryable: boolean; // Can user retry?
    upgradeRequired?: boolean; // For quota errors
  };
  timestamp: string;
  requestId: string;
}
```

### Retry Strategy

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 2000
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries || !isRetryable(error)) {
        throw error;
      }
      const delay = baseDelay * Math.pow(2, attempt);
      await sleep(delay);
    }
  }
  throw new Error('Max retries exceeded');
}

function isRetryable(error: unknown): boolean {
  if (error instanceof OpenAIError) {
    return error.status === 429 || // Rate limit
           error.status === 503 || // Service unavailable
           error.status >= 500;    // Server errors
  }
  return false;
}
```

### State Recovery

When an assessment fails after retries:

1. Save conversation state to `failed_assessments` table:
   ```sql
   INSERT INTO failed_assessments (
     user_id, habit_id, conversation_id,
     gathered_facts, current_step, error_message,
     created_at
   ) VALUES (...);
   ```

2. Return resumption token to user:
   ```json
   {
     "status": "failed",
     "message": "評価を一時保存しました。後で続きから再開できます。",
     "resumptionToken": "fa_abc123",
     "canResume": true
   }
   ```

3. On resume, load state and continue:
   ```typescript
   const state = await loadFailedAssessment(resumptionToken);
   return continueAssessment(state.conversationId, userResponse);
   ```

## Testing Strategy

### Dual Testing Approach

This system requires both **unit tests** and **property-based tests** for comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs using randomized testing

### Property-Based Testing Configuration

**Library**: fast-check (TypeScript property-based testing library)

**Configuration**:
- Minimum 100 iterations per property test
- Each property test must reference its design document property number
- Tag format: `Feature: habit-goal-level-system, Property {number}: {property_text}`

**Example Property Test**:

```typescript
import fc from 'fast-check';
import { describe, it } from 'vitest';

describe('THLI-24 Assessment Service', () => {
  it('Property 6: Discrete Score Set Validation', () => {
    // Feature: habit-goal-level-system, Property 6: Discrete score set validation
    
    const discreteScoreSet = [0.0, 1.4, 2.8, 4.1, 5.5, 6.9, 8.3];
    
    fc.assert(
      fc.property(
        fc.array(fc.record({
          id: fc.constantFrom('①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩',
                             '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳',
                             '㉑', '㉒', '㉓', '㉔'),
          score: fc.constantFrom(...discreteScoreSet),
          name: fc.string(),
          domain: fc.constantFrom('cognitive', 'physical', 'temporal', 'social'),
        }), { minLength: 24, maxLength: 24 }),
        (variables) => {
          // Store assessment with these variables
          const assessmentData = {
            variables,
            ici: 0.85,
            abUsed: 2,
            // ... other fields
          };
          
          // Verify all scores are from discrete set
          const allScoresValid = variables.every(v => 
            discreteScoreSet.includes(v.score)
          );
          
          return allScoresValid;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4: ICI Calculation Correctness', () => {
    // Feature: habit-goal-level-system, Property 4: ICI calculation
    
    fc.assert(
      fc.property(
        fc.record({
          F01: fc.record({ uType: fc.constantFrom('U0', 'U1', 'U2', 'U3', 'U4') }),
          F02: fc.record({ uType: fc.constantFrom('U0', 'U1', 'U2', 'U3', 'U4') }),
          F03: fc.record({ uType: fc.constantFrom('U0', 'U1', 'U2', 'U3', 'U4') }),
          F04: fc.record({ uType: fc.constantFrom('U0', 'U1', 'U2', 'U3', 'U4') }),
          F06: fc.record({ uType: fc.constantFrom('U0', 'U1', 'U2', 'U3', 'U4') }),
          F07: fc.record({ uType: fc.constantFrom('U0', 'U1', 'U2', 'U3', 'U4') }),
          F08: fc.record({ uType: fc.constantFrom('U0', 'U1', 'U2', 'U3', 'U4') }),
          F09: fc.record({ uType: fc.constantFrom('U0', 'U1', 'U2', 'U3', 'U4') }),
          F10: fc.record({ uType: fc.constantFrom('U0', 'U1', 'U2', 'U3', 'U4') }),
          F11: fc.record({ uType: fc.constantFrom('U0', 'U1', 'U2', 'U3', 'U4') }),
          F12: fc.record({ uType: fc.constantFrom('U0', 'U1', 'U2', 'U3', 'U4') }),
          F13: fc.record({ uType: fc.constantFrom('U0', 'U1', 'U2', 'U3', 'U4') }),
          F14: fc.record({ uType: fc.constantFrom('U0', 'U1', 'U2', 'U3', 'U4') }),
          F16: fc.record({ uType: fc.constantFrom('U0', 'U1', 'U2', 'U3', 'U4') }),
        }),
        (facts) => {
          const coreFactIds = ['F01', 'F02', 'F03', 'F04', 'F06', 'F07', 'F08', 
                               'F09', 'F10', 'F11', 'F12', 'F13', 'F14', 'F16'];
          
          const u0Count = coreFactIds.filter(id => 
            facts[id as keyof typeof facts].uType === 'U0'
          ).length;
          
          const expectedICI = u0Count / 14;
          const calculatedICI = calculateICI(facts);
          
          return Math.abs(calculatedICI - expectedICI) < 0.001;
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Unit Test Coverage

**Critical Unit Tests**:

1. **Schema Validation**
   - Test level tier calculation for boundary values (0, 49, 50, 99, 100, 149, 150, 199)
   - Test JSONB structure validation for assessment data
   - Test foreign key constraints

2. **THLI-24 Scoring**
   - Test Missingness Firewall with ICI = 0.59 (should trigger)
   - Test Missingness Firewall with ICI = 0.60 (should not trigger)
   - Test U4 fact detection
   - Test No-Inference fact validation (F04, F13, F14, F16)
   - Test Assumption Budget limit (AB_used = 6 vs 7)

3. **Baby Step Generation**
   - Test Lv.50 generation for habit at level 100 (should target ~50)
   - Test Lv.10 generation for habit at level 80 (should target ≤10)
   - Test variable reduction priority order
   - Test frequency transformation rules
   - Test duration transformation rules

4. **Quota Management**
   - Test free user quota initialization (should be 10)
   - Test premium user quota initialization (should be -1)
   - Test quota exhaustion blocking
   - Test quota increment on success
   - Test quota non-increment on failure
   - Test monthly quota reset

5. **Error Handling**
   - Test OpenAI API retry logic (3 attempts)
   - Test exponential backoff delays (2s, 4s, 8s)
   - Test state saving on final failure
   - Test resumption from saved state

6. **Cross-Framework Validation**
   - Test gate failure when deviation > 20 points
   - Test gate pass when deviation ≤ 20 points
   - Test validation logging

### Integration Tests

1. **End-to-End Assessment Flow**
   - Create habit → Initiate assessment → Complete audit → Verify level stored → Check history created

2. **Level-Up Flow**
   - Create habit → Complete activities → Run detection job → Verify suggestion created → Accept suggestion → Verify habit updated

3. **Level-Down Flow**
   - Create habit → Fail activities → Run detection job → Verify baby step plans → Accept Lv.50 → Verify habit simplified

4. **Quota Enforcement Flow**
   - Create free user → Exhaust quota → Attempt assessment → Verify blocked → Upgrade to premium → Verify unblocked

### Test Data Generators

```typescript
// Generator for random habits
const habitArbitrary = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 5, maxLength: 50 }),
  type: fc.constantFrom('do', 'avoid'),
  frequency: fc.constantFrom('daily', 'weekly', 'monthly'),
  workload_per_count: fc.integer({ min: 1, max: 100 }),
  duration: fc.integer({ min: 5, max: 120 }),
  active: fc.boolean(),
  level: fc.option(fc.integer({ min: 0, max: 199 }), { nil: null }),
});

// Generator for THLI-24 facts
const habitFactsArbitrary = fc.record({
  F01: factValueArbitrary,
  F02: factValueArbitrary,
  // ... F03-F16
});

const factValueArbitrary = fc.record({
  value: fc.oneof(fc.string(), fc.integer(), fc.boolean()),
  uType: fc.constantFrom('U0', 'U1', 'U2', 'U3', 'U4'),
  eType: fc.constantFrom('E0', 'E1', 'E2', 'E3'),
  source: fc.constantFrom('user_stated', 'inferred', 'default'),
});
```

### Performance Tests

1. **Batch Inventory Performance**
   - Test inventory of 100 habits completes within 5 minutes
   - Test rate limiting (1 assessment per 2 seconds)

2. **Database Query Performance**
   - Test level history query for habit with 100 entries completes within 100ms
   - Test level-up detection query across 1000 habits completes within 1 second

3. **API Response Time**
   - Test /api/habits/:id/level-details responds within 200ms
   - Test /api/habits/:id/level-history responds within 300ms

### Test Environment Setup

```typescript
// Test database setup
beforeAll(async () => {
  await runMigrations();
  await seedTestData();
});

afterEach(async () => {
  await cleanupTestData();
});

// Mock OpenAI API for deterministic tests
vi.mock('openai', () => ({
  OpenAI: vi.fn(() => ({
    chat: {
      completions: {
        create: vi.fn(async (params) => {
          // Return deterministic responses based on params
          return mockOpenAIResponse(params);
        }),
      },
    },
  })),
}));
```

### Continuous Integration

- Run all unit tests on every commit
- Run property tests (100 iterations) on every PR
- Run integration tests on develop branch
- Run performance tests weekly
- Fail build if any test fails or coverage drops below 80%

## Implementation Notes

### THLI-24 Prompt Storage

Store the full THLI-24 v1.9 prompt in:
- `backend/src/specs/ai-coach/thli-24-v1.9-prompt.md` (English)
- `backend/src/specs/ai-coach/thli-24-v1.9-prompt-ja.md` (Japanese)

The prompt should be loaded using the existing SpecLoader pattern and cached in memory.

### Database Migration Order

1. Add columns to habits and goals tables
2. Create level_history table
3. Create level_suggestions table
4. Create thli_validation_log table
5. Add indexes
6. Insert default quotas for existing users

### API Route Implementation

Follow existing patterns in `backend/src/routes/`:
- Use Express Router
- Apply authentication middleware
- Validate request bodies with Zod schemas
- Return consistent error responses
- Log all requests

### Frontend Component Structure

```
frontend/app/dashboard/components/
├── LevelBadge.tsx              # Reusable level badge component
├── Modal.LevelDetails.tsx      # Full assessment details modal
├── Modal.AssessmentResult.tsx  # Assessment completion modal
├── Modal.BabyStepPlan.tsx      # Baby step plan selection modal
├── Section.LevelHistory.tsx    # Level history timeline
└── Widget.QuotaStatus.tsx      # THLI quota display widget
```

### Scheduled Job Implementation

Use existing cron job infrastructure:
- Add jobs to `backend/src/jobs/`
- Register in job scheduler
- Run daily at 2 AM JST
- Log execution to job_execution_log

### Monitoring and Observability

1. **Metrics to Track**
   - THLI assessments per day
   - Firewall trigger rate
   - Cross-framework gate failure rate
   - Average assessment duration
   - Quota exhaustion rate
   - Level-up/level-down acceptance rate

2. **Alerts to Configure**
   - Firewall trigger rate > 50% (may indicate prompt issues)
   - Cross-framework gate failure rate > 30%
   - OpenAI API error rate > 10%
   - Assessment duration > 5 minutes

3. **Dashboards**
   - THLI assessment funnel (initiated → completed → accepted)
   - Level distribution histogram
   - Baby step effectiveness (acceptance rate, completion rate after)
