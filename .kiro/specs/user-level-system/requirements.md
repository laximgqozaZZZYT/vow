# Requirements Document

## Introduction

本ドキュメントは、ユーザーの成長と専門性を自動的に測定・追跡する「ユーザーレベルシステム」の要件を定義します。

既存のTHLI-24システムは習慣/タスクの「難易度」を測定しますが、ユーザーが習慣を継続することで主観的な難易度が下がり、レベルダウンが発生する可能性があります。これはユーザーが成長しているにもかかわらず、数値が下がるという矛盾を生みます。

ユーザーレベルシステムは、この問題を解決するために、習慣/タスクの難易度とは別に「ユーザー自身の成長と能力」を追跡します。完了した習慣/タスクの履歴に基づいて自動的に計算され、ユーザーの継続力、レジリエンス、および100以上の職業分類ドメインにおける専門性レベルを可視化します。

## Glossary

- **User_Level_Service**: ユーザーレベルの計算と管理を行うサービス
- **User_Level**: ユーザーの総合的な能力と成長を表す数値（0-199スケール）
- **Habit_Continuity_Power**: 習慣継続力 - ユーザーが習慣をどれだけ一貫して維持しているかを測定する指標
- **Resilience_Score**: レジリエンス - 習慣の中断や失敗からの回復力を測定する指標
- **Expertise_Level**: 専門性レベル - 特定のドメインにおけるユーザーの専門知識と能力
- **Occupation_Domain**: 職業分類ドメイン - 厚生労働省編職業分類（JSCO）に基づく職業カテゴリ
- **JSCO**: Japan Standard Classification of Occupations - 厚生労働省編職業分類
- **Domain_Mapping_Service**: 習慣/タスクを職業分類ドメインにマッピングするサービス
- **Experience_Points**: 経験値 - 完了した習慣/タスクから獲得するポイント
- **Level_Decay**: レベル減衰 - 活動がない期間に応じてレベルが徐々に低下する仕組み
- **Streak**: 連続達成日数 - 習慣を連続して完了した日数
- **Recovery_Rate**: 回復率 - 習慣中断後に再開するまでの速度

## Requirements

### Requirement 1: ユーザーレベルスキーマ拡張

**User Story:** 開発者として、ユーザーレベルと専門性を保存するためのデータベーススキーマを拡張したい。これにより、ユーザーの成長を時系列で追跡できるようになります。

#### Acceptance Criteria

1. THE System SHALL create a user_levels table with fields: id, user_id, overall_level (0-199), overall_tier, habit_continuity_power (0-100), resilience_score (0-100), total_experience_points, last_calculated_at, created_at, updated_at
2. THE System SHALL create a user_expertise table with fields: id, user_id, domain_code (JSCO小分類コード), domain_name, expertise_level (0-199), expertise_tier, experience_points, habit_count, task_count, last_activity_at, created_at, updated_at
3. THE System SHALL create a user_level_history table with fields: id, user_id, old_level, new_level, change_reason, metrics_snapshot (JSONB), created_at
4. THE System SHALL create an occupation_domains table with fields: id, major_code (大分類), major_name, middle_code (中分類), middle_name, minor_code (小分類), minor_name, keywords (TEXT[]), created_at
5. WHEN a user_level record is created or updated, THE System SHALL automatically calculate overall_tier based on overall_level (beginner: 0-49, intermediate: 50-99, advanced: 100-149, expert: 150-199)
6. THE System SHALL add domain_codes (TEXT[]) column to habits table to store associated occupation domain codes
7. THE System SHALL add domain_codes (TEXT[]) column to goals table to store associated occupation domain codes

### Requirement 2: 職業分類ドメインマスターデータ

**User Story:** システム管理者として、厚生労働省編職業分類（JSCO）に基づく100以上の職業ドメインをシステムに登録したい。これにより、ユーザーの専門性を詳細に追跡できます。

#### Acceptance Criteria

1. THE System SHALL seed the occupation_domains table with at least 100 domains from JSCO minor classification (小分類) level
2. WHEN seeding occupation domains, THE System SHALL include major categories: A-管理的職業, B-専門的・技術的職業, C-事務的職業, D-販売の職業, E-サービスの職業, F-保安の職業, G-農林漁業の職業, H-生産工程の職業, I-輸送・機械運転の職業, J-建設・採掘の職業, K-運搬・清掃・包装等の職業
3. WHEN seeding occupation domains, THE System SHALL include keywords array for each domain to enable habit/task matching (e.g., domain "Software Developer" has keywords ["programming", "coding", "software", "development", "プログラミング", "開発"])
4. THE System SHALL provide a GET /api/domains endpoint that returns all occupation domains with pagination and search capability
5. THE System SHALL provide a GET /api/domains/search endpoint that accepts a query string and returns matching domains based on keywords

### Requirement 3: 習慣/タスクとドメインのマッピング

**User Story:** ユーザーとして、習慣やタスクが自動的に適切な職業ドメインにマッピングされてほしい。これにより、手動でカテゴリを選択する手間が省けます。

#### Acceptance Criteria

1. WHEN a habit or goal is created, THE Domain_Mapping_Service SHALL analyze the name and notes fields using AI to suggest up to 3 relevant occupation domains
2. WHEN AI suggests domains, THE System SHALL display the suggestions to the user with confidence scores and allow acceptance, modification, or rejection
3. WHEN a user accepts domain suggestions, THE System SHALL store the domain_codes in the habit or goal record
4. WHEN a user manually selects domains, THE System SHALL provide a searchable dropdown with all occupation domains grouped by major category
5. IF a habit or goal has no domain mapping, THE System SHALL still track it under a "General" domain (code: "000") for overall level calculation
6. WHEN a habit spans multiple domains, THE System SHALL distribute experience points proportionally across all mapped domains (e.g., 3 domains = 33% each)
7. THE System SHALL provide a POST /api/habits/:id/suggest-domains endpoint that returns AI-suggested domains for a habit

### Requirement 4: 習慣継続力（Habit Continuity Power）の計算

**User Story:** ユーザーとして、自分の習慣継続力を数値で確認したい。これにより、習慣形成の進捗を客観的に把握できます。

#### Acceptance Criteria

1. WHEN calculating habit_continuity_power, THE User_Level_Service SHALL use the formula: (weighted_streak_score * 0.4) + (completion_rate_30d * 0.3) + (active_habit_ratio * 0.3)
2. WHEN calculating weighted_streak_score, THE System SHALL sum (streak_days * habit_level / 100) for all active habits and normalize to 0-100 scale
3. WHEN calculating completion_rate_30d, THE System SHALL compute (completed_activities / expected_activities) * 100 for the past 30 days across all active habits
4. WHEN calculating active_habit_ratio, THE System SHALL compute (habits_with_activity_in_7d / total_active_habits) * 100
5. THE System SHALL recalculate habit_continuity_power daily via scheduled job and store in user_levels table
6. WHEN habit_continuity_power changes by more than 5 points, THE System SHALL create a user_level_history record with change_reason "continuity_change"

### Requirement 5: レジリエンス（Resilience Score）の計算

**User Story:** ユーザーとして、習慣の中断からどれだけ早く回復できているかを知りたい。これにより、自分の回復力を把握し改善できます。

#### Acceptance Criteria

1. WHEN calculating resilience_score, THE User_Level_Service SHALL use the formula: (recovery_rate * 0.5) + (bounce_back_count * 0.3) + (streak_recovery_ratio * 0.2)
2. WHEN calculating recovery_rate, THE System SHALL compute average days to resume a habit after a break (lower is better, normalized to 0-100 where 1 day = 100, 7+ days = 0)
3. WHEN calculating bounce_back_count, THE System SHALL count the number of times a user resumed a habit after missing 3+ consecutive expected completions in the past 90 days, normalized to 0-100
4. WHEN calculating streak_recovery_ratio, THE System SHALL compute (recovered_streaks / broken_streaks) * 100 for the past 90 days
5. IF a user has no habit breaks in the past 90 days, THE System SHALL set resilience_score to 100 (perfect resilience)
6. THE System SHALL recalculate resilience_score daily via scheduled job and store in user_levels table

### Requirement 6: 専門性レベル（Expertise Level）の計算

**User Story:** ユーザーとして、各職業ドメインにおける自分の専門性レベルを確認したい。これにより、どの分野で成長しているかを把握できます。

#### Acceptance Criteria

1. WHEN a habit or task is completed, THE User_Level_Service SHALL calculate experience_points as: habit_level * completion_quality_multiplier * frequency_bonus
2. WHEN calculating completion_quality_multiplier, THE System SHALL use: 1.0 for normal completion, 1.2 for exceeding target (e.g., 120% of workload), 0.8 for partial completion
3. WHEN calculating frequency_bonus, THE System SHALL apply: 1.0 for first completion of the day, 0.5 for subsequent completions of the same habit on the same day
4. WHEN experience_points are earned, THE System SHALL distribute them to all mapped domains of the habit/task proportionally
5. WHEN calculating expertise_level for a domain, THE System SHALL use the formula: min(199, floor(log2(experience_points + 1) * 20))
6. THE System SHALL update expertise_level in user_expertise table immediately after each habit/task completion
7. WHEN expertise_level changes, THE System SHALL create a user_level_history record with change_reason "expertise_gain" and domain information

### Requirement 7: 総合ユーザーレベル（Overall User Level）の計算

**User Story:** ユーザーとして、自分の総合的な成長レベルを一目で確認したい。これにより、全体的な進捗を把握できます。

#### Acceptance Criteria

1. WHEN calculating overall_level, THE User_Level_Service SHALL use the formula: (top_expertise_avg * 0.5) + (habit_continuity_power * 0.25) + (resilience_score * 0.25)
2. WHEN calculating top_expertise_avg, THE System SHALL compute the average expertise_level of the user's top 5 domains (by expertise_level)
3. IF a user has fewer than 5 domains with expertise, THE System SHALL use all available domains for the average calculation
4. THE System SHALL recalculate overall_level daily via scheduled job and store in user_levels table
5. WHEN overall_level changes, THE System SHALL create a user_level_history record with change_reason "level_recalculation" and metrics_snapshot containing all component scores
6. THE System SHALL enforce overall_level to be within 0-199 range, clamping values that exceed bounds

### Requirement 8: レベル減衰（Level Decay）メカニズム

**User Story:** システムとして、長期間活動がないユーザーのレベルを徐々に減衰させたい。これにより、アクティブなユーザーの成長が正確に反映されます。

#### Acceptance Criteria

1. WHEN a user has no habit completions for 14 consecutive days, THE System SHALL begin applying level decay to expertise levels
2. WHEN applying level decay, THE System SHALL reduce expertise_level by 1 point per week of inactivity (after the initial 14-day grace period)
3. THE System SHALL cap level decay at 20% of the original expertise_level (e.g., level 100 can decay to minimum 80)
4. WHEN a user resumes activity in a domain, THE System SHALL stop decay and allow normal experience point accumulation
5. THE System SHALL NOT apply decay to habit_continuity_power or resilience_score (these are calculated fresh daily)
6. WHEN level decay is applied, THE System SHALL create a user_level_history record with change_reason "level_decay"
7. THE System SHALL run level decay calculation as part of the daily scheduled job

### Requirement 9: ユーザーレベルダッシュボード表示

**User Story:** ユーザーとして、自分のレベルと専門性をダッシュボードで視覚的に確認したい。これにより、成長を実感できます。

#### Acceptance Criteria

1. WHEN displaying the user level section, THE System SHALL show: overall_level with tier badge, habit_continuity_power gauge, resilience_score gauge, and top 5 expertise domains with levels
2. WHEN displaying expertise domains, THE System SHALL use a radar chart or bar chart showing the user's top domains
3. WHEN a user clicks on "View All Expertise", THE System SHALL display a Modal.ExpertiseList showing all domains with expertise > 0, grouped by major category
4. WHEN displaying level badges, THE System SHALL use consistent color coding: beginner (bg-success), intermediate (bg-primary), advanced (bg-warning), expert (bg-destructive)
5. THE System SHALL display level change indicators (+X or -X) for any level that changed in the past 7 days
6. WHEN displaying the dashboard on mobile (< 768px), THE System SHALL show a compact view with overall_level prominently and expandable sections for details

### Requirement 10: 専門性ドメイン一覧と検索

**User Story:** ユーザーとして、100以上の専門性ドメインを簡単に閲覧・検索したい。これにより、自分の成長分野を探索できます。

#### Acceptance Criteria

1. WHEN displaying the expertise domain list, THE System SHALL group domains by major category (大分類) with collapsible sections
2. WHEN a user searches for a domain, THE System SHALL filter domains by name and keywords in real-time (debounced 300ms)
3. WHEN displaying a domain, THE System SHALL show: domain_name, major_category, user's expertise_level (if any), and habit_count linked to this domain
4. WHEN a user clicks on a domain, THE System SHALL display a Modal.DomainDetails showing: full domain hierarchy (大分類 > 中分類 > 小分類), expertise_level, experience_points, linked habits, and level history for this domain
5. THE System SHALL highlight domains where the user has expertise_level > 0 with a distinct visual indicator
6. WHEN no search results are found, THE System SHALL display a message "該当するドメインが見つかりません" with suggestions for related domains

### Requirement 11: ユーザーレベル履歴とタイムライン

**User Story:** ユーザーとして、自分のレベル変化の履歴を時系列で確認したい。これにより、成長の軌跡を振り返れます。

#### Acceptance Criteria

1. WHEN displaying user level history, THE System SHALL show a vertical timeline of all level changes sorted by created_at DESC
2. WHEN displaying a history entry, THE System SHALL show: date, change_reason (translated to Japanese), old_level → new_level with delta, and affected domain (if expertise change)
3. THE System SHALL allow filtering history by: date range (last 7 days, 30 days, 90 days, all), change type (all, expertise_gain, level_decay, continuity_change, resilience_change)
4. WHEN exporting level history, THE System SHALL provide CSV format with columns: date, change_reason, old_level, new_level, delta, domain_name, metrics_snapshot
5. THE System SHALL display a summary at the top of the history: total level gained, domains improved, longest streak achieved

### Requirement 12: API エンドポイント

**User Story:** フロントエンド開発者として、ユーザーレベル機能を統合するためのRESTful APIエンドポイントが必要です。

#### Acceptance Criteria

1. THE System SHALL provide GET /api/users/:id/level endpoint that returns: overall_level, overall_tier, habit_continuity_power, resilience_score, total_experience_points, last_calculated_at
2. THE System SHALL provide GET /api/users/:id/expertise endpoint that returns: array of user_expertise records with domain details, sorted by expertise_level DESC
3. THE System SHALL provide GET /api/users/:id/expertise/:domain_code endpoint that returns: detailed expertise for a specific domain including linked habits and history
4. THE System SHALL provide GET /api/users/:id/level-history endpoint that returns: paginated array of user_level_history records with filters support
5. THE System SHALL provide POST /api/users/:id/recalculate-level endpoint that triggers immediate level recalculation (admin only)
6. ALL endpoints SHALL require authentication and validate that the requesting user owns the data or has admin privileges

### Requirement 13: 習慣完了時の経験値付与

**User Story:** ユーザーとして、習慣を完了するたびに経験値を獲得し、専門性レベルが上がるのを実感したい。

#### Acceptance Criteria

1. WHEN a habit is completed (activity created with kind = "complete"), THE System SHALL calculate and award experience points based on the habit's level and completion quality
2. WHEN experience points are awarded, THE System SHALL display a toast notification: "経験値 +X を獲得しました！" with domain names if applicable
3. IF the experience points cause an expertise_level increase, THE System SHALL display an additional notification: "[ドメイン名] のレベルが Y になりました！"
4. IF the experience points cause an overall_level increase, THE System SHALL display a celebration modal with the new level and tier
5. THE System SHALL log all experience point awards in an experience_log table for audit purposes
6. WHEN a habit has no domain mapping, THE System SHALL award experience points to the "General" domain

### Requirement 14: 定期計算ジョブ

**User Story:** システム管理者として、ユーザーレベルの定期的な再計算を自動化したい。これにより、レベルが常に最新の状態に保たれます。

#### Acceptance Criteria

1. THE System SHALL run a daily scheduled job (cron: 0 3 * * *) that recalculates habit_continuity_power, resilience_score, and overall_level for all active users
2. WHEN the scheduled job runs, THE System SHALL process users in batches of 100 with 1-second delay between batches to avoid database overload
3. THE System SHALL log job execution to job_execution_log table with: job_name "user_level_calculation", users_processed, levels_updated, errors
4. WHEN the scheduled job detects a level change > 5 points for any user, THE System SHALL create a notification for that user
5. THE System SHALL run level decay calculation as part of the daily job, applying decay to inactive users
6. IF the scheduled job fails, THE System SHALL retry up to 3 times with exponential backoff and alert administrators on final failure

### Requirement 15: 初期レベル設定

**User Story:** 新規ユーザーとして、アカウント作成時に初期レベルが設定されてほしい。これにより、すぐにレベルシステムを利用開始できます。

#### Acceptance Criteria

1. WHEN a new user is created, THE System SHALL create a user_levels record with: overall_level = 0, habit_continuity_power = 0, resilience_score = 50 (neutral starting point), total_experience_points = 0
2. WHEN a new user has existing habits (e.g., migrated from guest), THE System SHALL trigger an initial level calculation based on existing activity history
3. THE System SHALL NOT create any user_expertise records until the user completes their first habit with a domain mapping
4. WHEN displaying level for a new user, THE System SHALL show a "Getting Started" state with guidance on how to earn experience points

### Requirement 16: 習慣レベルとユーザーレベルの連携

**User Story:** ユーザーとして、習慣の難易度レベル（THLI-24）が自分のユーザーレベルにどう影響するかを理解したい。

#### Acceptance Criteria

1. WHEN calculating experience points from a habit completion, THE System SHALL use the habit's THLI-24 level as a multiplier (higher level habits give more XP)
2. IF a habit has no THLI-24 level (level = NULL), THE System SHALL use a default level of 50 for experience point calculation
3. WHEN a habit's THLI-24 level decreases (user got better at it), THE System SHALL NOT decrease the user's expertise level (expertise only grows or decays from inactivity)
4. THE System SHALL display both habit level and user expertise level in the habit detail view to show the distinction
5. WHEN suggesting domain mappings for a habit, THE System SHALL consider the habit's THLI-24 level to suggest appropriate expertise domains

