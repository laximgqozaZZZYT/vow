# Requirements Document

## Introduction

本ドキュメントは、ゲーミフィケーション機能の改善要件を定義します。現在のシステムには以下の重大な問題が発見されました：

1. **ユーザーレベルと習慣レベルの比較ロジックが未実装**: 初心者ユーザー（User Lv.10）が上級者向け習慣（Habit Lv.150）を追加しても警告されない
2. **経験値倍率システムが行動科学に基づいていない**: 現在の単純な倍率（0.8/1.0/1.2）では、計画遵守や過剰達成の抑制が考慮されていない
3. **習慣作成時のレベル適合性チェックがない**: 設計ドキュメントには「ユーザーLvに対し習慣Lvが高すぎる場合にベビーステップ提案」と記載されているが未実装

本改善により、行動科学に基づいた経験値システムと、ユーザーの成長段階に適した習慣提案を実現します。

## Glossary

- **Level_Manager_Service**: レベル変更の検出と適用を管理するサービス
- **XP_Multiplier**: 経験値倍率 - 達成度に応じて経験値を調整する係数
- **Completion_Rate**: 達成率 - 目標に対する実際の達成度（0-200%+）
- **Level_Mismatch**: レベルミスマッチ - ユーザーレベルと習慣レベルの不適合状態
- **Baby_Step_Trigger**: ベビーステップトリガー - レベルミスマッチ検出時にベビーステップ提案を開始する仕組み
- **Implementation_Intentions**: 実行意図 - 行動科学における計画遵守の概念
- **Sustainable_Behavior**: 持続可能な行動 - 燃え尽き症候群を防ぐ適度な行動パターン
- **Partial_Reinforcement**: 部分強化 - 部分的な達成でも正の強化を維持する心理学的概念
- **User_Level**: ユーザーレベル - ユーザーの総合的な能力と成長を表す数値（0-199）
- **Habit_Level**: 習慣レベル - THLI-24フレームワークで評価された習慣の難易度（0-199）
- **Mismatch_Threshold**: ミスマッチ閾値 - レベルミスマッチを検出する差分の閾値（デフォルト: 50）

## Requirements

### Requirement 1: 行動科学に基づく経験値倍率システム

**User Story:** ユーザーとして、計画通りに習慣を達成した時に最大の報酬を得たい。また、過剰に頑張りすぎた時は適度に抑制されることで、燃え尽き症候群を防ぎたい。

#### Acceptance Criteria

1. WHEN a habit is completed with completion_rate between 0% and 49%, THE System SHALL apply an XP_Multiplier of 0.3 to recognize minimal effort
2. WHEN a habit is completed with completion_rate between 50% and 79%, THE System SHALL apply an XP_Multiplier of 0.6 to provide partial reinforcement
3. WHEN a habit is completed with completion_rate between 80% and 99%, THE System SHALL apply an XP_Multiplier of 0.8 to recognize near-completion
4. WHEN a habit is completed with completion_rate between 100% and 120%, THE System SHALL apply an XP_Multiplier of 1.0 to maximize reward for plan adherence (Implementation Intentions)
5. WHEN a habit is completed with completion_rate between 121% and 150%, THE System SHALL apply an XP_Multiplier of 0.9 to mildly discourage over-achievement
6. WHEN a habit is completed with completion_rate above 150%, THE System SHALL apply an XP_Multiplier of 0.7 to prevent burnout (Sustainable Behavior)
7. THE System SHALL calculate completion_rate as (actual_count / target_count) * 100 for count-based habits
8. THE System SHALL calculate completion_rate as (actual_duration / target_duration) * 100 for duration-based habits
9. WHEN displaying experience points earned, THE System SHALL show the applied multiplier and the behavioral science rationale (e.g., "計画通り達成！ ×1.0")

### Requirement 2: ユーザーレベルと習慣レベルの比較ロジック

**User Story:** システムとして、ユーザーのレベルに対して習慣のレベルが高すぎる場合を検出したい。これにより、ユーザーが無理な習慣を設定することを防げます。

#### Acceptance Criteria

1. THE Level_Manager_Service SHALL implement a detectLevelMismatch(userId, habitLevel) method that compares user level with habit level
2. WHEN habit_level exceeds user_level by more than Mismatch_Threshold (default: 50), THE System SHALL flag the habit as a Level_Mismatch
3. WHEN detecting level mismatch, THE System SHALL return a LevelMismatchResult object containing: isMismatch (boolean), userLevel (number), habitLevel (number), levelGap (number), severity ('mild' | 'moderate' | 'severe')
4. WHEN levelGap is between 50 and 75, THE System SHALL classify severity as 'mild'
5. WHEN levelGap is between 76 and 100, THE System SHALL classify severity as 'moderate'
6. WHEN levelGap exceeds 100, THE System SHALL classify severity as 'severe'
7. THE System SHALL provide a GET /api/habits/:id/level-compatibility endpoint that returns the level mismatch analysis for a specific habit
8. THE System SHALL provide a POST /api/users/:id/check-habit-compatibility endpoint that accepts a proposed habit level and returns compatibility analysis

### Requirement 3: 習慣作成時のレベル適合性チェック

**User Story:** ユーザーとして、新しい習慣を作成する際に、その習慣が自分のレベルに適しているかを知りたい。適していない場合は、より簡単なバージョンを提案してほしい。

#### Acceptance Criteria

1. WHEN a user creates a new habit with a THLI-24 level assessment, THE System SHALL automatically check level compatibility using detectLevelMismatch
2. IF a Level_Mismatch is detected during habit creation, THE System SHALL display a warning modal with the level gap and severity
3. WHEN displaying the warning modal, THE System SHALL offer three options: "このまま作成" (proceed anyway), "ベビーステップを提案" (suggest baby steps), "キャンセル" (cancel)
4. WHEN user selects "ベビーステップを提案", THE System SHALL trigger the existing Baby_Step_Generator to create Lv.50 and Lv.10 plans
5. WHEN baby step plans are generated, THE System SHALL display them in a comparison view showing: original habit, Lv.50 version, Lv.10 version with level compatibility indicators
6. IF user proceeds with a mismatched habit, THE System SHALL record the decision in habit metadata with fields: mismatch_acknowledged (boolean), acknowledged_at (timestamp), original_level_gap (number)
7. THE System SHALL NOT block habit creation for mismatched habits, only warn and suggest alternatives

### Requirement 4: AIコーチングでのベビーステップ提案トリガー

**User Story:** ユーザーとして、AIコーチとの会話中に習慣のレベルが高すぎると判断された場合、自動的にベビーステップの提案を受けたい。

#### Acceptance Criteria

1. WHEN the AI Coach suggests a habit using create_habit_suggestion tool, THE System SHALL check level compatibility before presenting the suggestion
2. IF a Level_Mismatch is detected in AI-suggested habit, THE AI_Coach SHALL automatically explain the mismatch and offer baby step alternatives
3. WHEN explaining level mismatch, THE AI_Coach SHALL use user-friendly language: "この習慣はあなたの現在のレベル（Lv.{userLevel}）に対して少し難しいかもしれません（習慣Lv.{habitLevel}）。より始めやすいバージョンを提案しましょうか？"
4. THE AI_Coach SHALL add a new function calling tool: check_habit_level_compatibility(habit_name, estimated_level) that returns compatibility analysis
5. WHEN baby steps are suggested by AI Coach, THE System SHALL use the existing suggest_baby_steps tool with the detected habit level
6. THE AI_Coach SHALL track level mismatch suggestions in ai_suggestion_history table with suggestion_type: 'level_mismatch_baby_step'

### Requirement 5: Workload設定とTHLI-24レベルの整合性検証

**User Story:** システムとして、習慣のWorkload設定（頻度、時間、回数）がTHLI-24レベルと整合しているかを検証したい。

#### Acceptance Criteria

1. WHEN a habit's workload settings are modified, THE System SHALL recalculate the estimated THLI-24 level impact
2. THE System SHALL implement a validateWorkloadLevelConsistency(habit) method that checks if workload settings align with the assessed level
3. IF workload settings suggest a significantly different level (±20 points) from the assessed level, THE System SHALL flag the inconsistency
4. WHEN an inconsistency is detected, THE System SHALL suggest either: re-assessing the habit level, or adjusting workload to match the current level
5. THE System SHALL provide a GET /api/habits/:id/workload-level-consistency endpoint that returns consistency analysis
6. WHEN displaying habit details, THE System SHALL show a consistency indicator if workload and level are misaligned

### Requirement 6: 経験値倍率の表示とフィードバック

**User Story:** ユーザーとして、習慣を完了した時に獲得した経験値と適用された倍率を視覚的に確認したい。これにより、計画通りの達成が最も報われることを理解できます。

#### Acceptance Criteria

1. WHEN a habit is completed, THE System SHALL display a toast notification showing: base XP, applied multiplier, final XP, and completion rate
2. THE toast notification SHALL use color coding: green for 100-120% (optimal), yellow for 80-99% or 121-150% (good), orange for 50-79% or 151%+ (acceptable), red for 0-49% (minimal)
3. WHEN displaying the multiplier, THE System SHALL include a brief explanation tooltip: "計画通り達成で最大報酬！" for 1.0x, "頑張りすぎ注意！" for 0.9x or 0.7x
4. THE System SHALL update the experience_log table to include: completion_rate, applied_multiplier, multiplier_reason fields
5. WHEN viewing habit history, THE System SHALL show a chart of completion rates and applied multipliers over time
6. THE System SHALL provide aggregate statistics: average completion rate, most common multiplier tier, total XP earned with each multiplier

### Requirement 7: レベルミスマッチ検出の定期実行

**User Story:** システムとして、既存の習慣に対してもレベルミスマッチを定期的にチェックしたい。ユーザーのレベルが上がった場合、以前は難しかった習慣が適切になる可能性があります。

#### Acceptance Criteria

1. THE System SHALL run a daily scheduled job (cron: 0 4 * * *) that checks level compatibility for all active habits with assessed levels
2. WHEN the scheduled job detects a new mismatch (habit was compatible but user level decreased), THE System SHALL create a notification for the user
3. WHEN the scheduled job detects a resolved mismatch (habit was mismatched but user level increased), THE System SHALL update the habit metadata and optionally notify the user
4. THE scheduled job SHALL process users in batches of 100 with 1-second delay between batches
5. THE System SHALL log job execution to job_execution_log table with: job_name "level_mismatch_detection", users_processed, mismatches_found, mismatches_resolved
6. WHEN a severe mismatch (levelGap > 100) is detected for an existing habit, THE System SHALL trigger an AI Coach notification suggesting baby steps

