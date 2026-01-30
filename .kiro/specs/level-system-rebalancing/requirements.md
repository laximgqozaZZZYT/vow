# Requirements Document

## Introduction

本ドキュメントは、ユーザーレベル（Expertise Level）と習慣レベル（THLI-24）の両システムにおけるレベルインフレーション問題を解決するための「レベルシステムリバランシング」の要件を定義します。

### 現状の問題

**ユーザーレベル（Expertise Level）の問題:**
- 現在の計算式: `min(199, floor(10 * log2(experience_points / 100 + 1)))`
- 習慣完了時の基本XP: `habit_difficulty_level * 10`（例: Lv.50の習慣 = 500 XP）
- ストリークボーナス: `min(streak_days * 2, 50)`
- 問題: ユーザーが短期間で高レベルに到達してしまう（数週間でLv.100以上）

**習慣レベル（THLI-24）の問題:**
- スケール: 0-199
- 24変数を4ドメインで評価
- 問題: レベルが特定の範囲に偏り、1-200の範囲に均等に分布しない

### 目標

1. **ユーザーレベル**: Lv.100到達に6ヶ月以上、Lv.200到達に2年以上の継続的な努力が必要となる進行曲線
2. **習慣レベル**: 1-200の範囲に適切に分布する難易度評価
3. **既存ユーザー**: インフレしたレベルの適切な移行戦略
4. **UI**: 新しいスケールに対応したレベル表示の更新

## Glossary

- **Level_Rebalancing_Service**: レベル計算式の調整と移行を管理するサービス
- **XP_Formula**: 経験値からレベルを計算する数式
- **Progression_Curve**: レベル進行の曲線（対数、線形、指数など）
- **Level_Migration**: 既存ユーザーのレベルを新しいスケールに移行するプロセス
- **THLI_Rubric**: THLI-24の各変数のスコアリング基準
- **Level_Compression**: インフレしたレベルを適切な範囲に圧縮する処理
- **Tier_Boundary**: レベルティアの境界値（beginner/intermediate/advanced/expert）
- **XP_Decay_Rate**: 経験値の減衰率（新しい計算式での調整係数）

## Requirements

### Requirement 1: ユーザーレベル計算式のリバランス

**User Story:** システム管理者として、ユーザーレベルの進行曲線を調整したい。これにより、長期的な継続が適切に報われるシステムになります。

#### Acceptance Criteria

1. WHEN calculating expertise_level from experience_points, THE Level_Rebalancing_Service SHALL use the new formula: `min(9999, floor(5 * log2(experience_points / 1000 + 1)))`
2. WHEN a user reaches Lv.50 (intermediate tier), THE System SHALL require approximately 3 months of daily habit completion (assuming average habit level of 50)
3. WHEN a user reaches Lv.100 (advanced tier), THE System SHALL require approximately 6-9 months of consistent daily habit completion
4. WHEN a user reaches Lv.500 (expert tier), THE System SHALL require approximately 12-18 months of consistent daily habit completion
5. WHEN a user reaches Lv.9999 (maximum), THE System SHALL require approximately 24+ months of exceptional dedication
6. THE System SHALL use updated tier boundaries: beginner (0-49), intermediate (50-99), advanced (100-499), expert (500-9999)
7. THE System SHALL store the formula version in a configuration table to enable future adjustments without code changes

### Requirement 2: 基本XP獲得量の調整

**User Story:** ユーザーとして、習慣完了時に獲得するXPが適切な量であってほしい。これにより、レベルアップの達成感が維持されます。

#### Acceptance Criteria

1. WHEN a habit is completed, THE System SHALL calculate base XP as: `floor(habit_difficulty_level * 2)` (reduced from * 10)
2. WHEN calculating streak bonus, THE System SHALL use: `min(streak_days, 30)` (reduced from streak_days * 2, max 50)
3. WHEN a habit has no THLI-24 level (level = NULL), THE System SHALL use a default level of 25 (reduced from 50) for XP calculation
4. WHEN calculating total XP, THE System SHALL apply the formula: `base_xp + streak_bonus`
5. THE System SHALL cap daily XP gain per habit at 100 XP to prevent exploitation
6. WHEN displaying XP gain, THE System SHALL show the breakdown: "基本XP: X + ストリークボーナス: Y = 合計: Z"
7. THE System SHALL log all XP calculations with the formula version used for audit purposes

### Requirement 3: XP乗数システムの調整

**User Story:** ユーザーとして、完了率に応じたXP乗数が適切に機能してほしい。これにより、計画通りの実行が報われます。

#### Acceptance Criteria

1. WHEN completion rate is 0-49%, THE System SHALL apply XP multiplier of 0.2x (reduced from 0.3x)
2. WHEN completion rate is 50-79%, THE System SHALL apply XP multiplier of 0.5x (reduced from 0.6x)
3. WHEN completion rate is 80-99%, THE System SHALL apply XP multiplier of 0.8x (unchanged)
4. WHEN completion rate is 100-120%, THE System SHALL apply XP multiplier of 1.0x (unchanged - maximum reward)
5. WHEN completion rate is 121-150%, THE System SHALL apply XP multiplier of 0.85x (reduced from 0.9x)
6. WHEN completion rate is 151%+, THE System SHALL apply XP multiplier of 0.6x (reduced from 0.7x)
7. THE System SHALL display the applied multiplier tier in the XP notification toast

### Requirement 4: THLI-24スコアリング基準の調整

**User Story:** ユーザーとして、習慣の難易度レベルが1-200の範囲に適切に分布してほしい。これにより、自分の習慣の相対的な難易度を正確に把握できます。

#### Acceptance Criteria

1. WHEN scoring THLI-24 variables, THE System SHALL use an expanded discrete score set: {0.0, 0.7, 1.4, 2.1, 2.8, 3.5, 4.1, 4.8, 5.5, 6.2, 6.9, 7.6, 8.3} (13 levels instead of 7)
2. WHEN calculating the final THLI-24 level, THE System SHALL normalize the sum of 24 variables to the 0-199 scale using: `floor((sum_of_variables / max_possible_sum) * 199)`
3. WHEN a habit has low complexity (simple daily habits like "水を飲む"), THE System SHALL score it in the 1-30 range
4. WHEN a habit has moderate complexity (regular exercise, reading), THE System SHALL score it in the 31-80 range
5. WHEN a habit has high complexity (skill development, creative work), THE System SHALL score it in the 81-140 range
6. WHEN a habit has expert-level complexity (professional training, competitive sports), THE System SHALL score it in the 141-199 range
7. THE System SHALL provide calibration examples in the THLI-24 prompt for each complexity tier

### Requirement 5: 既存ユーザーのレベル移行

**User Story:** 既存ユーザーとして、レベルリバランス後も自分の努力が認められてほしい。これにより、モチベーションを維持できます。

#### Acceptance Criteria

1. WHEN the rebalancing is deployed, THE System SHALL calculate new levels for all existing users using the new formula
2. WHEN migrating user levels, THE System SHALL apply a compression function: `new_level = floor(old_level * 0.5)` to prevent drastic drops
3. WHEN a user's level would decrease by more than 50%, THE System SHALL cap the decrease at 50% of the original level
4. WHEN migration is complete, THE System SHALL create a user_level_history record with change_reason = "system_rebalancing"
5. THE System SHALL display a one-time notification to users explaining the rebalancing: "レベルシステムが調整されました。長期的な成長をより正確に反映するようになりました。"
6. THE System SHALL provide a "レベル移行詳細" modal showing: old_level, new_level, explanation of changes
7. THE System SHALL award a "Pioneer Badge" to users who had reached Lv.100+ before rebalancing as recognition

### Requirement 6: 習慣レベルの再評価

**User Story:** 既存ユーザーとして、習慣のTHLI-24レベルも新しい基準で再評価されてほしい。これにより、XP計算が正確になります。

#### Acceptance Criteria

1. WHEN the rebalancing is deployed, THE System SHALL mark all existing habit levels as "needs_recalibration"
2. WHEN a user views a habit with "needs_recalibration" status, THE System SHALL display a prompt: "新しい評価基準で再評価しますか？"
3. WHEN a user accepts recalibration, THE System SHALL re-run the THLI-24 assessment using the updated rubrics
4. WHEN recalibrating, THE System SHALL NOT consume the user's monthly THLI assessment quota
5. THE System SHALL provide a batch recalibration option: "すべての習慣を再評価" (limited to 10 habits per day for free users)
6. WHEN a habit is recalibrated, THE System SHALL create a level_history record with reason = "rubric_recalibration"
7. THE System SHALL preserve the original assessment data in a separate field for comparison

### Requirement 7: レベル進行シミュレーター

**User Story:** ユーザーとして、新しいレベルシステムでの進行をシミュレートしたい。これにより、目標設定に役立ちます。

#### Acceptance Criteria

1. THE System SHALL provide a GET /api/level-simulator endpoint that accepts: {current_xp, daily_habits, average_habit_level, streak_days}
2. WHEN simulating level progression, THE System SHALL calculate projected levels at: 1 week, 1 month, 3 months, 6 months, 1 year, 2 years
3. WHEN displaying simulation results, THE System SHALL show a chart with: current level, projected levels, tier milestones
4. THE System SHALL provide preset scenarios: "カジュアル" (1 habit/day, Lv.25), "アクティブ" (3 habits/day, Lv.50), "ハードコア" (5+ habits/day, Lv.75)
5. WHEN a user selects a scenario, THE System SHALL display estimated time to reach each tier milestone
6. THE System SHALL include a disclaimer: "実際の進行は習慣の完了率や難易度により異なります"
7. THE simulator SHALL be accessible from the Settings > Profile > Level section

### Requirement 8: UI表示の更新

**User Story:** ユーザーとして、新しいレベルシステムに対応したUI表示を見たい。これにより、進捗を正確に把握できます。

#### Acceptance Criteria

1. WHEN displaying level badges, THE System SHALL use updated tier colors: beginner (bg-muted), intermediate (bg-primary), advanced (bg-warning), expert (bg-destructive with glow effect)
2. WHEN displaying level progress, THE System SHALL show a progress bar to the next tier with percentage and XP remaining
3. WHEN a user is close to a tier milestone (within 10%), THE System SHALL display a motivational message: "あと X XP で [次のティア] に到達！"
4. WHEN displaying the level history timeline, THE System SHALL highlight rebalancing events with a special icon and explanation
5. THE System SHALL update the radar chart to show expertise levels on the new scale with adjusted axis labels
6. WHEN displaying habit level badges, THE System SHALL show the recalibration status if applicable: "要再評価" badge
7. THE System SHALL provide tooltips explaining the new level system when users hover over level displays

### Requirement 9: レベル減衰の調整

**User Story:** システムとして、長期間活動がないユーザーのレベル減衰を新しいスケールに合わせて調整したい。

#### Acceptance Criteria

1. WHEN applying level decay, THE System SHALL reduce expertise_level by 0.5 points per week of inactivity (reduced from 1 point)
2. THE System SHALL extend the grace period before decay begins to 21 days (increased from 14 days)
3. THE System SHALL cap level decay at 15% of the original expertise_level (reduced from 20%)
4. WHEN a user resumes activity after decay, THE System SHALL apply a "recovery bonus" of 1.5x XP for the first 7 days
5. THE System SHALL NOT apply decay to users who have been active in the past 30 days in any domain
6. WHEN decay is applied, THE System SHALL create a user_level_history record with change_reason = "level_decay_v2"
7. THE System SHALL display decay warnings 7 days before decay begins: "14日間活動がありません。あと7日で減衰が始まります"

### Requirement 10: APIエンドポイントの更新

**User Story:** フロントエンド開発者として、リバランスされたレベルシステムに対応したAPIエンドポイントが必要です。

#### Acceptance Criteria

1. THE System SHALL update GET /api/users/:id/level to include: formula_version, is_migrated, migration_date fields
2. THE System SHALL provide GET /api/level-config endpoint returning: current formula, XP multipliers, tier boundaries, decay settings
3. THE System SHALL provide POST /api/users/:id/recalibrate-habits endpoint to trigger batch habit recalibration
4. THE System SHALL provide GET /api/users/:id/migration-status endpoint returning: old_level, new_level, migration_date, pioneer_badge_awarded
5. THE System SHALL update all XP-related endpoints to return the formula version used in calculations
6. THE System SHALL provide GET /api/level-milestones endpoint returning: XP required for each level, estimated time at different activity levels
7. ALL endpoints SHALL include rate limiting to prevent abuse during migration period

### Requirement 11: 設定とフィーチャーフラグ

**User Story:** システム管理者として、リバランスを段階的にロールアウトしたい。これにより、問題があれば迅速に対応できます。

#### Acceptance Criteria

1. THE System SHALL store all level formula parameters in a level_config table: {config_key, config_value, version, effective_from, effective_to}
2. THE System SHALL support feature flags: "level_rebalancing_enabled", "migration_in_progress", "new_xp_formula_enabled"
3. WHEN "level_rebalancing_enabled" is false, THE System SHALL use the original formulas for all calculations
4. THE System SHALL support A/B testing by enabling new formulas for a percentage of users
5. THE System SHALL log all formula changes with timestamp and admin user for audit purposes
6. WHEN rolling back, THE System SHALL restore previous formula version and recalculate affected user levels
7. THE System SHALL provide an admin dashboard showing: users migrated, average level change, error count

### Requirement 12: データ整合性とバックアップ

**User Story:** システム管理者として、移行前のデータをバックアップし、必要に応じてロールバックできるようにしたい。

#### Acceptance Criteria

1. BEFORE migration begins, THE System SHALL create a backup of user_levels, user_expertise, and level_history tables
2. THE System SHALL store pre-migration levels in a user_levels_backup table with: user_id, old_overall_level, old_expertise_levels (JSONB), backup_timestamp
3. WHEN a rollback is requested, THE System SHALL restore levels from the backup table within 1 hour
4. THE System SHALL validate data integrity after migration: count of users, sum of XP, level distribution histogram
5. THE System SHALL generate a migration report: users_affected, average_level_change, max_level_change, errors
6. THE System SHALL retain backup data for 90 days after successful migration
7. THE System SHALL provide a manual rollback option for individual users if needed

