# Requirements Document

## Introduction

AIコーチセクションのUIを大幅に改善し、Geminiスタイルの広々としたレイアウトを実現する。また、AIが選択肢ボタンを積極的に活用できるよう拡張し、トークン消費を抑えるためのカテゴリ別提案マスターデータを導入する。

## Glossary

- **AI_Coach_Section**: ダッシュボード内のAIコーチングインターフェース全体を指すコンポーネント
- **Chat_Area**: ユーザーとAIの会話履歴を表示するエリア
- **Input_Area**: ユーザーがメッセージを入力するエリア
- **Choice_Buttons**: AIが提示する選択肢をボタンとして表示するコンポーネント
- **Master_Data**: カテゴリ別のHabit/Goal提案を格納したMarkdownファイル群
- **Message_Bubble**: 会話内の個々のメッセージを表示するUI要素
- **Quick_Actions**: よく使うアクションへのショートカットボタン群

## Requirements

### Requirement 1: チャットエリアの拡大

**User Story:** As a user, I want a larger chat area, so that I can read conversation history comfortably without excessive scrolling.

#### Acceptance Criteria

1. THE Chat_Area SHALL occupy at least 60% of the AI_Coach_Section's vertical space
2. THE Chat_Area SHALL have a minimum height of 400px on desktop devices
3. WHEN the viewport height is less than 600px, THE Chat_Area SHALL have a minimum height of 250px
4. THE Chat_Area SHALL support smooth scrolling to the latest message

### Requirement 2: 入力エリアの拡大

**User Story:** As a user, I want a larger input area, so that I can compose longer messages comfortably.

#### Acceptance Criteria

1. THE Input_Area SHALL have a minimum height of 80px
2. THE Input_Area SHALL expand automatically up to 160px when the user types multiple lines
3. THE Input_Area SHALL be positioned at the bottom of the AI_Coach_Section with sticky positioning
4. WHEN the user presses Enter without Shift, THE Input_Area SHALL submit the message
5. WHEN the user presses Shift+Enter, THE Input_Area SHALL insert a new line

### Requirement 3: メッセージバブルの改善

**User Story:** As a user, I want larger and more readable message bubbles, so that I can easily read the conversation.

#### Acceptance Criteria

1. THE Message_Bubble SHALL have a minimum padding of 16px
2. THE Message_Bubble SHALL have a font size of at least 16px for body text
3. THE Message_Bubble for user messages SHALL be aligned to the right with a distinct background color
4. THE Message_Bubble for assistant messages SHALL be aligned to the left with a distinct background color
5. THE Message_Bubble SHALL have a maximum width of 85% of the Chat_Area width

### Requirement 4: 選択肢ボタンの拡張

**User Story:** As a user, I want to see choice buttons for common responses, so that I can quickly respond to AI questions without typing.

#### Acceptance Criteria

1. WHEN the AI asks a question with predefined options, THE Choice_Buttons SHALL be displayed below the message
2. THE Choice_Buttons SHALL support displaying 2-5 options
3. WHEN a Choice_Button is clicked, THE system SHALL send the selected option as a user message
4. THE Choice_Buttons SHALL support icons (emoji) for each option
5. THE Choice_Buttons SHALL support optional description text for each option
6. WHEN the AI response contains a `choice_buttons` field, THE system SHALL render the Choice_Buttons component

### Requirement 5: バックエンドの選択肢ボタン対応

**User Story:** As a developer, I want the backend to return choice button data, so that the AI can present interactive options to users.

#### Acceptance Criteria

1. WHEN the AI determines that a question has predefined options, THE backend SHALL include a `choice_buttons` field in the response
2. THE `choice_buttons` field SHALL contain an array of choice objects with `id`, `label`, and optional `icon` and `description` fields
3. THE backend SHALL use the `show_choice_buttons` tool to generate choice button data
4. WHEN the user selects a choice, THE backend SHALL process the selection as a regular user message

### Requirement 6: カテゴリ別提案マスターデータ

**User Story:** As a system administrator, I want predefined habit and goal suggestions organized by category, so that the AI can provide consistent suggestions without generating them each time.

#### Acceptance Criteria

1. THE Master_Data SHALL be stored in Markdown files under `backend/specs/ai-coach/suggestions/` directory
2. THE Master_Data SHALL include categories: 健康・運動, 仕事・生産性, 学習・スキル, 趣味・リラックス, 人間関係, 財務
3. WHEN the AI needs to suggest habits, THE system SHALL reference the Master_Data instead of generating suggestions
4. THE Master_Data SHALL contain 5-10 realistic habit suggestions per category
5. THE Master_Data SHALL contain 3-5 realistic goal suggestions per category
6. THE Master_Data SHALL include for each habit: name, type (do/avoid), frequency, suggested target count, workload unit, and reason

### Requirement 7: クイックアクションの改善

**User Story:** As a user, I want prominent quick action buttons, so that I can start common tasks quickly.

#### Acceptance Criteria

1. WHEN no conversation exists, THE Quick_Actions SHALL be displayed prominently in the center of the Chat_Area
2. THE Quick_Actions SHALL include at least 4 common actions: 習慣を追加, ゴールを設定, 進捗を確認, アドバイスをもらう
3. WHEN a Quick_Action is clicked, THE system SHALL send the corresponding prompt to the AI
4. THE Quick_Actions SHALL have large, touch-friendly buttons (minimum 48px height)

### Requirement 8: レスポンシブデザイン

**User Story:** As a mobile user, I want the AI coach interface to work well on small screens, so that I can use it on my phone.

#### Acceptance Criteria

1. WHEN the viewport width is less than 768px, THE AI_Coach_Section SHALL use a full-width layout
2. WHEN the viewport width is less than 768px, THE Input_Area SHALL have a minimum height of 60px
3. THE Choice_Buttons SHALL wrap to multiple rows on narrow screens
4. THE Message_Bubble SHALL have a maximum width of 95% on mobile devices

### Requirement 9: トークン使用量の最適化

**User Story:** As a system administrator, I want to reduce token consumption, so that the service can be more cost-effective.

#### Acceptance Criteria

1. WHEN suggesting habits for a category, THE system SHALL load suggestions from Master_Data instead of generating them
2. THE system SHALL cache Master_Data in memory to avoid repeated file reads
3. WHEN the AI references Master_Data, THE system SHALL include only relevant category data in the prompt
4. THE system SHALL log token usage reduction metrics for monitoring

### Requirement 10: 会話クリア機能の改善

**User Story:** As a user, I want to easily clear the conversation, so that I can start fresh when needed.

#### Acceptance Criteria

1. THE system SHALL display a clear conversation button in the header area
2. WHEN the clear button is clicked, THE system SHALL show a confirmation dialog
3. WHEN confirmed, THE system SHALL clear all messages and reset the UI to the initial state
