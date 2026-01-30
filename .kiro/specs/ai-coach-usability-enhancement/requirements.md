# Requirements Document

## Introduction

AIコーチエージェントの使用性を向上させるため、ガードレールと仕様書（spec）を見直し、より自然で効果的なコーチング体験を提供する。現在の実装では`aiCoachSpec.ts`にすべての仕様が埋め込まれているが、これを外部マークダウンファイルに分離し、メンテナンス性と拡張性を向上させる。

## Glossary

- **AI_Coach**: Vowアプリの習慣管理AIコーチ。OpenAI Function Callingを使用してユーザーとの会話を行う
- **Guardrails**: AIの応答を制限するルール。不適切な応答や危険な提案を防ぐ
- **Spec_Document**: AIコーチの動作を定義する仕様書。役割、会話ガイドライン、習慣提案ルールなどを含む
- **Function_Calling**: OpenAI APIの機能で、AIが構造化されたツールを呼び出せる仕組み
- **Habit_Suggestion**: AIが提案する習慣。UIコンポーネントと連携して表示される
- **Conversation_Context**: 会話の文脈。過去のメッセージ履歴を含む

## Requirements

### Requirement 1: 外部マークダウンファイルへの分離

**User Story:** As a 開発者, I want AIコーチの仕様を外部マークダウンファイルに分離したい, so that コード変更なしに仕様を更新できる

#### Acceptance Criteria

1. THE Spec_Loader SHALL load spec documents from `backend/specs/ai-coach/` directory
2. WHEN the AI_Coach service initializes, THE Spec_Loader SHALL read and combine all spec markdown files
3. THE Spec_Document SHALL be organized into separate files: `role.md`, `guardrails.md`, `conversation.md`, `habits.md`, `response-format.md`
4. IF a spec file is missing, THEN THE Spec_Loader SHALL log a warning and use default values
5. WHEN spec files are updated, THE AI_Coach SHALL use the new content on next request without restart

### Requirement 2: 会話ガイドラインの改善

**User Story:** As a ユーザー, I want AIコーチとより自然な会話をしたい, so that コーチングがより効果的になる

#### Acceptance Criteria

1. WHEN a user sends a greeting message, THE AI_Coach SHALL respond warmly and guide toward habit-related topics
2. WHEN a user expresses frustration or difficulty, THE AI_Coach SHALL acknowledge emotions before providing advice
3. WHEN a user asks for help without specifics, THE AI_Coach SHALL offer 2-3 concrete options to choose from
4. THE AI_Coach SHALL limit clarifying questions to maximum 2 per turn to avoid overwhelming users
5. WHEN a user provides partial information, THE AI_Coach SHALL make reasonable assumptions and confirm them
6. THE AI_Coach SHALL use encouraging language and celebrate small wins

### Requirement 3: ガードレールの最適化

**User Story:** As a システム管理者, I want ガードレールが適切に機能しつつ過度に制限的でない, so that ユーザーが自然に会話できる

#### Acceptance Criteria

1. WHEN a user asks about general wellness topics related to habits, THE AI_Coach SHALL provide helpful responses within scope
2. THE AI_Coach SHALL NOT reject messages that mention out-of-scope topics incidentally
3. WHEN a user asks about borderline topics, THE AI_Coach SHALL redirect gently to habit-related aspects
4. THE Guardrails SHALL allow discussion of habit-related health topics without medical advice
5. IF a user persists with out-of-scope requests, THEN THE AI_Coach SHALL politely decline after 2 redirects

### Requirement 4: UIコンポーネント活用の強化

**User Story:** As a ユーザー, I want AIコーチが適切なタイミングでUIコンポーネントを使用する, so that 習慣作成がスムーズになる

#### Acceptance Criteria

1. WHEN a user expresses intent to create a habit, THE AI_Coach SHALL use the habit suggestion tool within 2 turns
2. WHEN suggesting multiple habits for a goal, THE AI_Coach SHALL use the multiple suggestions tool
3. THE AI_Coach SHALL NOT output habit suggestions as plain text when tools are available
4. WHEN a user modifies a suggested habit, THE AI_Coach SHALL update the suggestion using the tool
5. WHEN a user confirms a habit suggestion, THE AI_Coach SHALL acknowledge and offer next steps

### Requirement 5: 応答フォーマットの改善

**User Story:** As a ユーザー, I want AIコーチの応答が読みやすく行動しやすい, so that アドバイスを実践できる

#### Acceptance Criteria

1. THE AI_Coach SHALL keep responses under 200 characters for simple acknowledgments
2. WHEN providing analysis, THE AI_Coach SHALL use bullet points and visual indicators
3. THE AI_Coach SHALL end responses with a clear call-to-action or question
4. WHEN providing multiple options, THE AI_Coach SHALL number them for easy reference
5. THE AI_Coach SHALL use appropriate emoji sparingly (1-2 per response maximum)

### Requirement 6: コンテキスト認識の向上

**User Story:** As a ユーザー, I want AIコーチが会話の文脈を理解する, so that 繰り返し説明する必要がない

#### Acceptance Criteria

1. WHEN a user references a previous topic, THE AI_Coach SHALL recall relevant context from conversation history
2. THE AI_Coach SHALL remember user preferences mentioned in the current session
3. WHEN a user says "that one" or similar references, THE AI_Coach SHALL correctly identify the referent
4. IF context is ambiguous, THEN THE AI_Coach SHALL ask for clarification with specific options
5. THE AI_Coach SHALL maintain awareness of habits and goals discussed in the session

### Requirement 7: エラーハンドリングの改善

**User Story:** As a ユーザー, I want エラー時にも有用な応答を受け取りたい, so that 会話が途切れない

#### Acceptance Criteria

1. IF a tool call fails, THEN THE AI_Coach SHALL provide a helpful fallback response
2. WHEN habit data is unavailable, THE AI_Coach SHALL offer to help create habits instead
3. IF analysis returns no data, THEN THE AI_Coach SHALL explain why and suggest next steps
4. THE AI_Coach SHALL NOT expose technical error messages to users
5. WHEN rate limited, THE AI_Coach SHALL inform users politely and suggest trying again later

### Requirement 8: 行動科学知識の活用強化

**User Story:** As a ユーザー, I want 科学的根拠に基づいたアドバイスを受けたい, so that 習慣形成の成功率が上がる

#### Acceptance Criteria

1. WHEN suggesting habits, THE AI_Coach SHALL reference relevant behavioral science principles
2. THE AI_Coach SHALL proactively suggest habit stacking when appropriate
3. WHEN a user struggles with a habit, THE AI_Coach SHALL suggest the 2-minute rule
4. THE AI_Coach SHALL explain the "why" behind suggestions in simple terms
5. WHEN a user achieves a milestone, THE AI_Coach SHALL reinforce identity-based habits

### Requirement 9: 拡張UIコンポーネントの実装と活用

**User Story:** As a ユーザー, I want AIコーチがテキスト以外の視覚的なUIコンポーネントを積極的に使用する, so that 情報が分かりやすく、操作しやすい

#### Acceptance Criteria

1. WHEN a user asks about habit progress, THE AI_Coach SHALL display the HabitStatsCard component with visual charts
2. WHEN a user asks for recommendations, THE AI_Coach SHALL display QuickActionButtons for common actions
3. WHEN showing habit details, THE AI_Coach SHALL use the HabitDetailCard component with completion history
4. WHEN a user needs to make a choice, THE AI_Coach SHALL display ChoiceButtons instead of numbered text options
5. THE AI_Coach SHALL use ProgressIndicator component when showing goal or habit progress
6. WHEN analyzing workload, THE AI_Coach SHALL display WorkloadChart component with visual breakdown
7. THE AI_Coach SHALL prioritize UI components over plain text for structured data

### Requirement 10: インタラクティブな候補ボタンUI

**User Story:** As a ユーザー, I want 会話中に選択肢がボタンとして表示される, so that タップ/クリックで簡単に選択できる

#### Acceptance Criteria

1. WHEN the AI_Coach presents options, THE System SHALL render them as clickable buttons
2. WHEN a user clicks a choice button, THE System SHALL send the selection as a user message
3. THE ChoiceButtons SHALL support up to 5 options with icons and descriptions
4. WHEN options are time-sensitive, THE ChoiceButtons SHALL include visual urgency indicators
5. THE AI_Coach SHALL use ChoiceButtons for yes/no questions, multiple choice, and action confirmations
