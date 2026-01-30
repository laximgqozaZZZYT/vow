# Requirements Document

## Introduction

This document specifies requirements for a Habit and Goal Level System that uses the THLI-24 (Total Habit Load Index) framework to assess habit difficulty levels through AI-powered natural language processing. The system enables users to inventory existing habits, measure new habit difficulty, adjust workload based on performance, and generate baby steps for struggling habits.

The THLI-24 framework is a comprehensive habit assessment methodology that uses 24 variables across 4 domains (Cognitive, Physical, Temporal, Social) to calculate habit difficulty scores on a 0-199 scale. It implements a two-pass system (Audit → Score) with a "Missingness Firewall" to ensure data quality, and provides Optimistic/Expected/Conservative (O/E/C) level estimates.

## Glossary

- **THLI_Assessment_Service**: The service that implements the THLI-24 framework for habit level assessment
- **Level_Manager**: The component responsible for tracking and updating habit/goal levels over time
- **Baby_Step_Generator**: The AI-powered service that creates simplified versions of habits at target difficulty levels
- **Missingness_Firewall**: The THLI-24 mechanism that prevents scoring when insufficient data is available (ICI < 0.6)
- **VOI_Question**: Value of Information question generated to gather missing habit data
- **ICI**: Information Completeness Index, measuring the proportion of available habit facts
- **O/E/C_Estimates**: Optimistic, Expected, and Conservative level estimates provided by THLI-24
- **Level_Tier**: Categorical classification of habit difficulty (beginner: 0-49, intermediate: 50-99, advanced: 100-149, expert: 150-199)
- **Usage_Quota_Service**: The service that enforces THLI-24 assessment limits for free plan users
- **Habit_Inventory**: The process of batch-assessing all existing habits to establish baseline levels
- **Level_History_Tracker**: The component that records level changes over time for analysis

## Requirements

### Requirement 1: Schema Extensions for Level Tracking

**User Story:** As a developer, I want to extend the database schema to support habit and goal levels, so that the system can store and track difficulty assessments over time.

#### Acceptance Criteria

1. WHEN a habit or goal is created, THE System SHALL initialize the level field to NULL (pending assessment)
2. WHEN a THLI-24 assessment is completed, THE System SHALL store the level value as an integer between 0 and 199
3. WHEN a level is updated, THE System SHALL automatically calculate and store the corresponding level_tier based on the level value (beginner: 0-49, intermediate: 50-99, advanced: 100-149, expert: 150-199)
4. THE System SHALL store THLI-24 audit results in the level_assessment_data JSONB field with all 24 variables, ICI score, AB_used count, and prompt version
5. WHEN a level changes, THE System SHALL record the change in the level_history table with timestamp, old_level, new_level, reason, and workload_delta
6. THE System SHALL add level, level_tier, level_assessment_data, and level_last_assessed_at fields to both habits and goals tables
7. THE System SHALL create a level_history table with fields: id, entity_type (habit/goal), entity_id, old_level, new_level, reason, workload_delta, assessed_at, created_at

### Requirement 2: THLI-24 Assessment Engine

**User Story:** As a user, I want the system to assess my habit's difficulty level using the THLI-24 framework, so that I can understand how challenging my habits are.

#### Acceptance Criteria

1. WHEN a user initiates a level assessment, THE THLI_Assessment_Service SHALL conduct a conversational audit to gather habit facts F01-F16 using OpenAI Function Calling
2. WHEN the audit phase is complete, THE THLI_Assessment_Service SHALL calculate the Information Completeness Index (ICI) as count(U0 in core facts)/14
3. IF ICI is less than 0.6 OR any U4 exists OR any No-Inference fact (F04/F13/F14/F16) is not U0 OR AB_used exceeds 6, THEN THE Missingness_Firewall SHALL prevent scoring and generate VOI questions
4. WHEN sufficient data is available (Firewall not triggered), THE THLI_Assessment_Service SHALL calculate O/E/C level estimates using the THLI-24 scoring algorithm with discrete score set {0.0, 1.4, 2.8, 4.1, 5.5, 6.9, 8.3}
5. WHEN scoring is complete, THE System SHALL store the assessment results in level_assessment_data JSONB with structure: {facts: {F01-F16}, variables: {①-㉔}, ici: number, ab_used: number, firewall_triggered: boolean, o_level: number, e_level_range: [min, max], c_level: number, prompt_version: string, assessed_at: timestamp}
6. THE THLI_Assessment_Service SHALL support both new habit assessment (during creation) and re-assessment of existing habits (on-demand)
7. WHEN VOI questions are generated, THE System SHALL rank them by ΔLv_upper (potential impact on level estimate) and return maximum 5 questions
8. WHEN the Firewall triggers, THE System SHALL store only Conservative-level estimate with wide range and mark status as "provisional_firewalled"

### Requirement 3: AI-Powered Habit Inventory

**User Story:** As a user, I want to assess all my existing habits at once, so that I can understand my overall habit difficulty landscape.

#### Acceptance Criteria

1. WHEN a user initiates a habit inventory (via "すべての習慣を評価" button in dashboard), THE Level_Manager SHALL query all active habits WHERE active = true AND level IS NULL
2. WHEN processing a batch inventory, THE System SHALL assess each habit sequentially using the THLI_Assessment_Service with a rate limit of 1 assessment per 2 seconds to avoid API throttling
3. WHEN a habit assessment fails due to insufficient data (Firewall triggered), THE System SHALL mark it as status: "pending_data" and store the VOI questions in a pending_assessments table for later completion
4. WHEN the inventory is complete, THE System SHALL provide a summary report showing: total habits assessed, level distribution histogram (beginner: X, intermediate: Y, advanced: Z, expert: W), average level, and list of habits pending data
5. THE System SHALL enforce usage quota limits during batch inventory: if remaining quota < number of unassessed habits, prompt user to select which habits to prioritize
6. THE inventory process SHALL be resumable: if interrupted, the System SHALL continue from the last successfully assessed habit
7. THE System SHALL display a progress indicator during inventory: "習慣評価中... (3/10 完了)" with estimated time remaining

### Requirement 4: New Habit Level Assessment

**User Story:** As a user, I want to assess the difficulty level of a new habit before committing to it, so that I can make informed decisions about habit adoption.

#### Acceptance Criteria

1. WHEN a user creates a new habit via the AI coach (using create_habit_suggestion tool), THE System SHALL offer an optional level assessment with message: "この習慣のレベルを測定しますか？(残り X/10 回)"
2. WHEN a user accepts the assessment offer, THE THLI_Assessment_Service SHALL initiate a conversational audit using the AI coach chat interface with the THLI-24 prompt loaded
3. WHEN the assessment is complete, THE System SHALL display the O/E/C level estimates in a Modal.AssessmentResult component with: level range (e.g., "Lv.45-65"), tier (intermediate), recommended starting workload, and explanation of what this level means
4. WHEN a user declines the assessment, THE System SHALL create the habit with level = NULL, level_tier = NULL and show a reminder: "後で「レベル測定」ボタンから評価できます"
5. THE System SHALL decrement the user's THLI assessment quota (quota_used += 1) only when an assessment is successfully completed (not when declined or failed)
6. WHEN displaying the assessment offer, THE System SHALL show the user's current quota status: "今月の残り評価回数: X/10" for free users, "無制限" for premium users
7. THE assessment conversation SHALL be stored in the ai_coach_conversations table with conversation_type: "thli_assessment" for future reference

### Requirement 5: Automatic Level Up Detection

**User Story:** As a user, I want the system to detect when I'm ready for a more challenging version of my habit, so that I can continue progressing.

#### Acceptance Criteria

1. WHEN a habit has been completed consistently for 30 days with completion rate above 90%, THE Level_Manager SHALL flag it as a level-up candidate
2. WHEN a level-up is suggested, THE System SHALL use the THLI_Assessment_Service to re-assess the habit and calculate a new target level (current level + 10 to 20 points)
3. WHEN a new target level is calculated, THE Baby_Step_Generator SHALL propose specific workload increases: increase workload_per_count by 10-20%, OR increase frequency from weekly to daily, OR add complexity to the action definition
4. WHEN a user accepts a level-up, THE System SHALL update the habit's workload_per_count, workload_total, or frequency fields and record the level change in level_history with reason "level_up_progression"
5. THE System SHALL not suggest level-ups more frequently than once per 30 days for the same habit
6. WHEN suggesting level-up, THE System SHALL display the current level, target level, and specific changes to workload in the UI
7. THE Level_Manager SHALL run level-up detection as a scheduled job once per day for all active habits

### Requirement 6: Automatic Level Down and Baby Step Generation

**User Story:** As a user, I want the system to detect when I'm struggling with a habit and suggest easier versions, so that I can maintain momentum.

#### Acceptance Criteria

1. WHEN a habit has a completion rate below 50% over the past 14 days, THE Level_Manager SHALL flag it as a level-down candidate
2. WHEN a level-down is suggested, THE Baby_Step_Generator SHALL create two baby step plans using THLI-24 framework: Lv.50 plan (target level = current level * 0.5) and Lv.10 plan (minimal viable habit with target level ≤ 10)
3. WHEN generating Lv.50 baby steps, THE System SHALL reduce variables by adjusting: frequency (daily→weekly), duration (reduce by 50%), target count (reduce by 50%), or complexity (simplify action definition)
4. WHEN generating Lv.10 baby steps, THE System SHALL create a minimal habit with: clear cue, single first action (2-minute rule), immediate stop condition, and fallback plan
5. WHEN baby step plans are presented, THE System SHALL explain which specific THLI-24 variables are being reduced (e.g., "⑱ Frequency: daily→weekly reduces temporal load by 4.1 points")
6. WHEN a user accepts a baby step plan, THE System SHALL update the habit's fields (frequency, workload_per_count, duration, name) and record the level change with reason "level_down_baby_step_lv50" or "level_down_baby_step_lv10"
7. THE Baby_Step_Generator SHALL use the existing habit's context (goal_id, type, notes) to maintain continuity while simplifying the habit

### Requirement 7: Usage Quota Management for Free Plan

**User Story:** As a product manager, I want to limit THLI-24 assessments for free users, so that we can manage AI costs while providing value.

#### Acceptance Criteria

1. THE System SHALL allocate 10 THLI-24 assessments per month to free plan users (stored in token_quotas table with quota_type 'thli_assessments')
2. THE System SHALL allocate unlimited THLI-24 assessments to premium plan users (quota_limit = -1 indicates unlimited)
3. WHEN a user initiates an assessment, THE Usage_Quota_Service SHALL check remaining quota by querying token_quotas WHERE user_id = ? AND quota_type = 'thli_assessments' AND period_start <= NOW() AND period_end >= NOW()
4. IF a free user has exhausted their quota (quota_used >= quota_limit), THEN THE System SHALL return an error response with upgrade_required: true and prevent the assessment
5. WHEN a new month begins (period_end < NOW()), THE System SHALL create a new quota period record with quota_used = 0 and period_start = first day of month, period_end = last day of month
6. WHEN an assessment is completed successfully, THE System SHALL increment quota_used by 1 in the token_quotas table
7. THE System SHALL display remaining assessments in the UI as "THLI-24 assessments: X/10 remaining this month" for free users

### Requirement 8: Level Display and Visualization

**User Story:** As a user, I want to see my habit levels visually, so that I can quickly understand my habit difficulty landscape.

#### Acceptance Criteria

1. WHEN displaying a habit card, THE System SHALL show a level badge with the current level number and tier color using the LevelBadge component
2. WHEN a habit has no level assessment, THE System SHALL display "Not Assessed" with an "Assess Level" button that opens the AI coach chat with pre-filled message "この習慣のレベルを測定してください"
3. WHEN a user clicks on a level badge, THE System SHALL display a Modal.LevelDetails component showing: level number, tier, all 24 THLI-24 variables with scores and stoplights (Green/Yellow/Red), O/E/C estimates, cross-framework scores (TLX/SRBAI/COM-B), and assessment timestamp
4. WHEN displaying a goal, THE System SHALL show an aggregated level badge calculated as MAX(child_habit_levels) with label "Goal Level (from habits)"
5. THE System SHALL use consistent color coding: beginner (bg-success/text-success), intermediate (bg-primary/text-primary), advanced (bg-warning/text-warning), expert (bg-destructive/text-destructive)
6. THE LevelBadge component SHALL be responsive: on mobile (< 768px) show compact version with only level number, on desktop show full version with tier label
7. WHEN a habit has a recent level change (within 7 days), THE System SHALL display a small delta indicator (e.g., "+5" or "-10") next to the level badge with animation

### Requirement 9: Level History Timeline

**User Story:** As a user, I want to see how my habit levels have changed over time, so that I can track my progress and understand patterns.

#### Acceptance Criteria

1. WHEN a user views a habit's level history (via "View History" button in Modal.LevelDetails), THE System SHALL display a Section.LevelHistory component with a vertical timeline of all level changes sorted by assessed_at DESC
2. WHEN displaying level history, THE System SHALL show for each entry: date (formatted as "YYYY年MM月DD日"), old level → new level with arrow, delta with color (green for increase, red for decrease), reason label (translated: "level_up_progression" → "レベルアップ", "level_down_baby_step_lv50" → "ベビーステップ (Lv.50)", etc.), and workload_delta details
3. WHEN a level change was triggered by a level-up or level-down, THE System SHALL display an expandable section showing the specific workload changes: {field: "workload_per_count", old_value: 10, new_value: 12, change: "+20%"}
4. THE System SHALL allow filtering level history by: date range (last 7 days, last 30 days, last 90 days, all time), change type (all, level_up, level_down, re_assessment)
5. WHEN exporting level history (via "Export CSV" button), THE System SHALL provide CSV format with columns: date, old_level, new_level, delta, reason, workload_changes_json
6. THE timeline component SHALL use Tailwind CSS with: vertical line (border-l-2 border-border), timeline dots (w-3 h-3 rounded-full bg-primary), and cards (bg-card border border-border rounded-lg p-4)
7. WHEN the level history is empty, THE System SHALL display an empty state message: "まだレベル変更の履歴がありません" with an illustration

### Requirement 10: AI Coach Integration for THLI-24 Conversations

**User Story:** As a user, I want to have natural conversations with the AI coach during level assessments, so that the process feels intuitive and personalized.

#### Acceptance Criteria

1. WHEN conducting a THLI-24 assessment, THE AI_Coach SHALL use the existing PersonalizationEngine to load user context (existing habits, completion rates, preferences) before starting the audit
2. WHEN asking audit questions, THE AI_Coach SHALL adapt question phrasing based on user's previous responses and communication style using the existing PromptBuilder
3. WHEN the Missingness_Firewall triggers, THE AI_Coach SHALL explain why more information is needed in user-friendly language and ask the highest-priority VOI question (ranked by ΔLv_upper)
4. WHEN presenting assessment results, THE AI_Coach SHALL explain the level in user-friendly terms with specific examples (e.g., "Level 75 is like running 5km three times per week - challenging but sustainable")
5. THE AI_Coach SHALL support new function calling tools: assess_habit_level(habit_id, conversation_context), suggest_baby_steps(habit_id, target_level), suggest_level_up(habit_id)
6. WHEN assess_habit_level is called, THE System SHALL initiate a multi-turn conversation to gather F01-F16 facts, storing intermediate state in the conversation context
7. THE AI_Coach SHALL use the existing aiCoachService.ts architecture with COACH_TOOLS array extended to include THLI-24 tools

### Requirement 11: THLI-24 Prompt Template Management

**User Story:** As a developer, I want the THLI-24 prompt stored as a versioned template, so that we can update the framework without code changes.

#### Acceptance Criteria

1. THE System SHALL store the THLI-24 v1.9 prompt as a markdown file in backend/src/specs/ai-coach/thli-24-v1.9-prompt.md
2. WHEN the THLI_Assessment_Service initializes, THE System SHALL load the prompt template using the existing SpecLoader pattern (similar to how aiCoachService loads system prompts)
3. WHEN the prompt template is loaded, THE System SHALL validate it contains all required sections: Role, Facts System, PASS 1 Audit, PASS 2 Scoring, External Cross-Check Lens, Output Format
4. THE System SHALL support prompt versioning with semantic version numbers in the filename (e.g., thli-24-v1.9-prompt.md, thli-24-v2.0-prompt.md)
5. WHEN an assessment is stored, THE System SHALL record which prompt version was used in level_assessment_data.prompt_version field (e.g., "v1.9")
6. THE SpecLoader SHALL cache loaded THLI-24 prompts in memory and provide a clearCache() method for hot-reload support during development
7. WHEN building the assessment prompt, THE System SHALL inject user-specific context (habit name, existing workload, goal context) into the template using placeholder replacement

### Requirement 12: Cross-Framework Validation

**User Story:** As a user, I want the system to validate THLI-24 assessments against established frameworks, so that I can trust the accuracy of level estimates.

#### Acceptance Criteria

1. WHEN a THLI-24 assessment is complete, THE System SHALL perform cross-checks with NASA-TLX (6 dimensions: Mental, Physical, Temporal, Effort, Frustration, Performance), SRBAI (4 automaticity prompts), and COM-B (Capability, Opportunity, Motivation) frameworks
2. WHEN cross-check results deviate significantly (absolute difference > 20 points on 0-199 scale), THE System SHALL flag the assessment with external_lens_gate: "fail" and suggest re-assessment
3. WHEN displaying assessment results, THE System SHALL show cross-framework comparison scores in the UI as: {tlx_score: number, srbai_score: number, comb_score: number, gate_status: "pass" | "fail"}
4. THE System SHALL log cross-framework validation results to a separate table thli_validation_log for quality monitoring and analysis
5. WHEN a cross-check fails (gate_status = "fail"), THE System SHALL provide specific guidance on which variables may need clarification by identifying the domain with largest discrepancy

### Requirement 13: API Routes for Level Management

**User Story:** As a frontend developer, I want RESTful API endpoints for level management, so that I can integrate THLI-24 features into the UI.

#### Acceptance Criteria

1. THE System SHALL provide POST /api/habits/:id/assess-level endpoint that initiates a THLI-24 assessment and returns {assessment_id, status: "in_progress", conversation_id}
2. THE System SHALL provide GET /api/habits/:id/level-history endpoint that returns an array of level changes with fields: {id, old_level, new_level, reason, workload_delta, assessed_at, created_at}
3. THE System SHALL provide POST /api/habits/:id/accept-baby-step endpoint that accepts a baby step plan and updates the habit with body: {plan_type: "lv50" | "lv10", proposed_changes: object}
4. THE System SHALL provide POST /api/habits/:id/accept-level-up endpoint that accepts a level-up suggestion and updates the habit with body: {target_level: number, workload_changes: object}
5. THE System SHALL provide GET /api/users/:id/thli-quota endpoint that returns remaining THLI-24 assessments: {quota_used: number, quota_limit: number, period_start: date, period_end: date, remaining: number}
6. THE System SHALL provide GET /api/habits/:id/level-details endpoint that returns full THLI-24 assessment data: {level, level_tier, assessment_data: object, last_assessed_at: date, cross_framework_scores: object}
7. ALL endpoints SHALL require authentication and validate that the user owns the habit/goal being accessed

### Requirement 14: UI Components for Level Display

**User Story:** As a user, I want to see my habit levels visually in the dashboard, so that I can quickly understand my habit difficulty landscape.

#### Acceptance Criteria

1. WHEN displaying a habit card in the dashboard, THE System SHALL show a level badge component with: level number, level tier (beginner/intermediate/advanced/expert), and tier-specific color (beginner: green, intermediate: blue, advanced: orange, expert: red)
2. WHEN a habit has no level assessment (level = NULL), THE System SHALL display "Not Assessed" badge with neutral gray color and an "Assess Level" button
3. WHEN a user clicks on a level badge, THE System SHALL open a modal displaying: full THLI-24 assessment details, all 24 variables with scores, O/E/C estimates, cross-framework scores, and assessment date
4. WHEN displaying a goal card, THE System SHALL show an aggregated level calculated as: MAX(child_habit_levels) if any child has level, else "Not Assessed"
5. THE level badge component SHALL use Tailwind CSS with design tokens: bg-success (beginner), bg-primary (intermediate), bg-warning (advanced), bg-destructive (expert)
6. THE level badge SHALL be positioned in the top-right corner of habit/goal cards with absolute positioning and z-index: 10
7. THE System SHALL use consistent typography: level number in text-h3 (20px semibold), tier label in text-small (14px normal)


### Requirement 15: THLI-24 Prompt Refinement and Localization

**User Story:** As a Japanese user, I want the THLI-24 assessment to be conducted in natural Japanese, so that I can provide accurate information about my habits.

#### Acceptance Criteria

1. THE System SHALL store a Japanese-localized version of the THLI-24 v1.9 prompt in backend/src/specs/ai-coach/thli-24-v1.9-prompt-ja.md with all sections translated
2. WHEN building the assessment prompt, THE System SHALL detect the user's language preference from their profile or browser settings and load the appropriate prompt file (ja or en)
3. THE Japanese prompt SHALL maintain all technical terms in English (ICI, U0-U4, E0-E3, F01-F16, ①-㉔) while translating explanations and examples
4. THE System SHALL refine the THLI-24 prompt to include habit-specific context injection points: {{HABIT_NAME}}, {{CURRENT_WORKLOAD}}, {{GOAL_CONTEXT}}, {{USER_LEVEL}}
5. WHEN conducting an assessment, THE System SHALL inject actual values into the prompt template: "あなたは「{{HABIT_NAME}}」という習慣を評価しています。現在のワークロード: {{CURRENT_WORKLOAD}}"
6. THE refined prompt SHALL include examples specific to common habit categories: exercise (運動), reading (読書), meditation (瞑想), learning (学習)
7. THE System SHALL validate that the localized prompt produces consistent level estimates (±5 points) compared to the English version using a test suite of 10 sample habits

### Requirement 16: Baby Step Generation Algorithm

**User Story:** As a user struggling with a habit, I want the system to generate specific, actionable baby steps, so that I can rebuild momentum.

#### Acceptance Criteria

1. WHEN generating a Lv.50 baby step, THE Baby_Step_Generator SHALL calculate target_level = current_level * 0.5 and identify which THLI-24 variables to reduce to reach that target
2. THE Baby_Step_Generator SHALL prioritize reducing variables in this order: ⑱ Frequency (highest impact), ⑬ Duration, ⑫ Complexity, ⑪ Setup/Cleanup, ⑩ Travel Distance
3. WHEN reducing frequency (⑱), THE System SHALL apply these transformations: daily→3x/week (reduces by 2.8 points), 3x/week→weekly (reduces by 1.4 points), weekly→biweekly (reduces by 1.4 points)
4. WHEN reducing duration (⑬), THE System SHALL apply: >60min→30min (reduces by 2.8 points), 30min→15min (reduces by 1.4 points), 15min→5min (reduces by 1.4 points)
5. WHEN generating a Lv.10 baby step, THE System SHALL create a minimal habit with: single action (2-minute rule), clear cue ("After [existing habit]"), immediate stop condition ("Just do X, then stop"), fallback plan ("If you can't do X, do Y instead")
6. THE Baby_Step_Generator SHALL preserve the habit's core identity: if original habit is "30分ジョギング", Lv.50 becomes "15分ジョギング", Lv.10 becomes "玄関で靴を履く"
7. WHEN presenting baby step plans, THE System SHALL show a comparison table: {variable: "頻度", current: "毎日", lv50: "週3回", lv10: "週1回", points_reduced: 2.8}

### Requirement 17: Scheduled Jobs for Level Management

**User Story:** As a system administrator, I want automated jobs to detect level-up and level-down candidates, so that users receive timely suggestions.

#### Acceptance Criteria

1. THE System SHALL run a daily scheduled job (cron: 0 2 * * *) that queries all active habits and calculates completion rates for the past 30 days
2. WHEN the level-up detection job runs, THE System SHALL identify habits WHERE completion_rate >= 0.9 AND days_since_last_level_change >= 30 AND level IS NOT NULL
3. WHEN the level-down detection job runs, THE System SHALL identify habits WHERE completion_rate < 0.5 AND days_active >= 14 AND level IS NOT NULL
4. THE System SHALL store detected candidates in a level_suggestions table with fields: {id, habit_id, suggestion_type: "level_up" | "level_down", current_level, target_level, proposed_changes: JSONB, detected_at, status: "pending" | "accepted" | "dismissed"}
5. WHEN a user logs in, THE System SHALL check for pending level suggestions and display a notification badge on the dashboard: "レベル調整の提案があります (3件)"
6. THE scheduled job SHALL respect rate limits: process maximum 100 habits per run, with 1-second delay between THLI-24 re-assessments
7. THE System SHALL log all scheduled job executions to a job_execution_log table with: {job_name, started_at, completed_at, habits_processed, suggestions_created, errors}

### Requirement 18: Error Handling and Fallback Strategies

**User Story:** As a user, I want the system to handle errors gracefully during level assessments, so that I don't lose progress or encounter confusing error messages.

#### Acceptance Criteria

1. WHEN an OpenAI API call fails during assessment (timeout, rate limit, or error response), THE System SHALL retry up to 3 times with exponential backoff (2s, 4s, 8s)
2. IF all retries fail, THE System SHALL save the conversation state to a failed_assessments table and display user-friendly message: "評価を一時保存しました。後で続きから再開できます"
3. WHEN the Missingness Firewall triggers, THE System SHALL NOT treat it as an error but as a normal flow, storing the partial assessment with status: "needs_more_data"
4. WHEN a user's quota is exhausted mid-assessment, THE System SHALL complete the current assessment (don't waste the conversation) and then show the upgrade prompt
5. THE System SHALL validate all THLI-24 variable scores are within the discrete set {0.0, 1.4, 2.8, 4.1, 5.5, 6.9, 8.3} before storing, logging a warning if invalid scores are detected
6. WHEN cross-framework validation fails (gate_status: "fail"), THE System SHALL still store the THLI-24 assessment but mark it with a warning flag and suggest re-assessment
7. THE System SHALL provide a "Resume Assessment" button for failed or interrupted assessments that loads the conversation history and continues from the last question
