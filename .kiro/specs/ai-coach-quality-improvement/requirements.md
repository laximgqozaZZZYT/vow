# Requirements Document

## Introduction

AIコーチが提案するHabit（習慣）とGoal（目標）の品質を包括的に向上させる機能改善です。現在のAIコーチには、具体性の不足、コンテキスト活用不足、難易度・頻度の適切性、重複の問題があります。これらを解決し、ユーザーにとってより実行可能で効果的な提案を行えるようにします。

## Glossary

- **AI_Coach**: OpenAI Function Callingを使用してユーザーに習慣・ゴールを提案するサービス
- **Habit**: ユーザーが継続的に実行する行動（習慣）
- **Goal**: ユーザーが達成したい目標
- **User_Context**: ユーザーの既存習慣、達成率、履歴などの情報
- **Master_Data**: カテゴリ別の習慣・ゴール提案テンプレートデータ
- **Completion_Rate**: 習慣の達成率（完了数/期待完了数）
- **User_Level**: ユーザーの習慣管理経験レベル（beginner/intermediate/advanced）
- **Similarity_Score**: 2つの習慣名の類似度スコア（0-1）
- **Personalization_Engine**: ユーザーコンテキストに基づいて提案をカスタマイズするエンジン

## Requirements

### Requirement 1: ユーザーコンテキスト分析の強化

**User Story:** As a user, I want the AI coach to understand my current habits and achievement patterns, so that I receive suggestions that fit my actual situation.

#### Acceptance Criteria

1. WHEN the AI_Coach generates a suggestion, THE Personalization_Engine SHALL analyze the user's existing habits, completion rates, and activity history from the past 30 days
2. WHEN analyzing user context, THE Personalization_Engine SHALL calculate the average completion rate across all active habits
3. WHEN analyzing user context, THE Personalization_Engine SHALL identify the user's preferred frequency pattern (daily/weekly/monthly) based on existing habits
4. WHEN analyzing user context, THE Personalization_Engine SHALL identify the user's preferred time slots based on activity timestamps
5. IF the user has no existing habits, THEN THE Personalization_Engine SHALL use default beginner-friendly settings

### Requirement 2: ユーザーレベル自動判定

**User Story:** As a user, I want the AI coach to automatically assess my experience level, so that I receive appropriately challenging suggestions.

#### Acceptance Criteria

1. WHEN determining user level, THE Personalization_Engine SHALL classify users as beginner if they have fewer than 3 active habits or average completion rate below 40%
2. WHEN determining user level, THE Personalization_Engine SHALL classify users as intermediate if they have 3-7 active habits and average completion rate between 40-70%
3. WHEN determining user level, THE Personalization_Engine SHALL classify users as advanced if they have more than 7 active habits and average completion rate above 70%
4. WHEN suggesting habits to a beginner user, THE AI_Coach SHALL prioritize habits with frequency of daily and duration under 15 minutes
5. WHEN suggesting habits to an intermediate user, THE AI_Coach SHALL allow habits with weekly frequency and duration up to 30 minutes
6. WHEN suggesting habits to an advanced user, THE AI_Coach SHALL allow habits with any frequency and duration

### Requirement 3: 提案の具体性向上

**User Story:** As a user, I want specific and actionable habit suggestions, so that I know exactly what to do and when.

#### Acceptance Criteria

1. WHEN creating a habit suggestion, THE AI_Coach SHALL include a specific trigger time if the habit is daily frequency
2. WHEN creating a habit suggestion, THE AI_Coach SHALL include a concrete target count and workload unit
3. WHEN creating a habit suggestion, THE AI_Coach SHALL include an estimated duration in minutes
4. WHEN creating a habit suggestion, THE AI_Coach SHALL provide a reason that explains why this habit is effective for the user's specific situation
5. IF the user's context indicates a preferred time slot, THEN THE AI_Coach SHALL align the suggested trigger time with that preference

### Requirement 4: 重複検出の強化

**User Story:** As a user, I want to avoid receiving suggestions that duplicate my existing habits, so that I can focus on genuinely new behaviors.

#### Acceptance Criteria

1. WHEN generating a habit suggestion, THE AI_Coach SHALL calculate a similarity score between the suggestion and each existing habit
2. WHEN the similarity score exceeds 0.7, THE AI_Coach SHALL reject the suggestion and generate an alternative
3. WHEN calculating similarity, THE Personalization_Engine SHALL consider both exact name matching and semantic similarity
4. WHEN calculating similarity, THE Personalization_Engine SHALL normalize habit names by removing whitespace and converting to lowercase
5. THE AI_Coach SHALL log rejected suggestions with their similarity scores for debugging purposes

### Requirement 5: マスターデータ品質向上

**User Story:** As a user, I want high-quality habit templates that are based on behavioral science, so that I can build effective habits.

#### Acceptance Criteria

1. THE Master_Data SHALL include at least 10 habits per category with complete metadata (type, frequency, targetCount, workloadUnit, triggerTime, duration, reason)
2. THE Master_Data SHALL include difficulty levels (beginner/intermediate/advanced) for each habit
3. THE Master_Data SHALL include habit stacking suggestions that link new habits to common existing habits
4. WHEN loading master data, THE Master_Data_Loader SHALL validate that all required fields are present
5. IF a master data file is missing required fields, THEN THE Master_Data_Loader SHALL log a warning and use default values

### Requirement 6: プロンプト最適化

**User Story:** As a user, I want the AI coach to provide consistent, high-quality responses, so that I can trust its suggestions.

#### Acceptance Criteria

1. WHEN building the system prompt, THE AI_Coach SHALL include the user's current context summary (habit count, average completion rate, user level)
2. WHEN building the system prompt, THE AI_Coach SHALL include a list of existing habit names to avoid duplicates
3. WHEN building the system prompt, THE AI_Coach SHALL include the user's preferred time slots and frequency patterns
4. THE AI_Coach SHALL limit the system prompt to essential context to minimize token usage
5. WHEN the AI generates a suggestion, THE AI_Coach SHALL validate that the suggestion meets all quality criteria before returning it to the user

### Requirement 7: 習慣スタッキング提案の改善

**User Story:** As a user, I want habit stacking suggestions that connect new habits to my existing routines, so that I can build habits more easily.

#### Acceptance Criteria

1. WHEN suggesting habit stacking, THE AI_Coach SHALL identify the user's most consistent habits (completion rate above 80%) as anchor habits
2. WHEN suggesting habit stacking, THE AI_Coach SHALL propose linking the new habit to an anchor habit with a clear trigger phrase
3. WHEN the user has no anchor habits, THE AI_Coach SHALL suggest common daily routines (waking up, meals, bedtime) as triggers
4. THE AI_Coach SHALL format habit stacking suggestions as "[After existing habit], [new habit]" pattern

### Requirement 8: ゴール提案の品質向上

**User Story:** As a user, I want goal suggestions that are aligned with my interests and current habits, so that I can set meaningful objectives.

#### Acceptance Criteria

1. WHEN suggesting goals, THE AI_Coach SHALL analyze the user's existing habits to identify relevant goal categories
2. WHEN suggesting goals, THE AI_Coach SHALL include 2-4 specific habit suggestions that support each goal
3. WHEN suggesting goals, THE AI_Coach SHALL avoid suggesting goals that the user has already achieved or is actively working toward
4. WHEN the user has existing habits in a category, THE AI_Coach SHALL prioritize goals in related categories

