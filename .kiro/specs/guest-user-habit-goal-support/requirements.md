# Requirements Document

## Introduction

ゲストユーザー（ログインしていないユーザー）がダッシュボードでHabit（習慣）とGoal（目標）の登録・管理を行えるようにする機能です。現在はログインしていない状態ではこれらの機能が制限されていますが、ユーザーエクスペリエンスを向上させるため、ローカルストレージを活用してゲストユーザーでも基本的な機能を利用できるようにします。

## Glossary

- **Guest_User**: ログインしていない状態でダッシュボードを利用するユーザー
- **Authenticated_User**: Supabase認証を通じてログインしているユーザー
- **Dashboard**: アプリケーションのメイン画面（/dashboard）
- **Habit**: ユーザーが追跡したい習慣や行動
- **Goal**: ユーザーが設定する目標
- **Activity**: Habitの実行記録
- **Local_Storage**: ブラウザのローカルストレージ（ゲストデータ保存用）
- **Auth_Hook**: 認証状態を管理するReactフック（useAuth）

## Requirements

### Requirement 1: ゲストユーザーの認証状態管理

**User Story:** As a guest user, I want to access habit and goal features without logging in, so that I can try the application before creating an account.

#### Acceptance Criteria

1. WHEN a guest user accesses the dashboard, THE Auth_Hook SHALL recognize them as having limited authenticated access
2. WHEN a guest user's session is established, THE Auth_Hook SHALL set appropriate permissions for local-only features
3. WHEN determining feature access, THE Auth_Hook SHALL distinguish between guest users and unauthenticated users
4. THE Auth_Hook SHALL maintain backward compatibility with existing authenticated user flows

### Requirement 2: ゲストユーザーのGoal管理

**User Story:** As a guest user, I want to create and manage goals, so that I can organize my habits and track my progress.

#### Acceptance Criteria

1. WHEN a guest user creates a goal, THE Goal_Manager SHALL save it to Local_Storage
2. WHEN a guest user views goals, THE Goal_Manager SHALL load them from Local_Storage
3. WHEN a guest user updates a goal, THE Goal_Manager SHALL persist changes to Local_Storage
4. WHEN a guest user deletes a goal, THE Goal_Manager SHALL remove it from Local_Storage
5. THE Goal_Manager SHALL maintain the same UI behavior for guest users as authenticated users

### Requirement 3: ゲストユーザーのHabit管理

**User Story:** As a guest user, I want to create and manage habits, so that I can track my daily activities and build better routines.

#### Acceptance Criteria

1. WHEN a guest user creates a habit, THE Habit_Manager SHALL save it to Local_Storage
2. WHEN a guest user views habits, THE Habit_Manager SHALL load them from Local_Storage
3. WHEN a guest user updates a habit, THE Habit_Manager SHALL persist changes to Local_Storage
4. WHEN a guest user deletes a habit, THE Habit_Manager SHALL remove it from Local_Storage
5. WHEN a guest user completes a habit, THE Activity_Manager SHALL record the activity in Local_Storage

### Requirement 4: ゲストユーザーのActivity記録

**User Story:** As a guest user, I want to track my habit completion, so that I can see my progress over time.

#### Acceptance Criteria

1. WHEN a guest user marks a habit as complete, THE Activity_Manager SHALL create an activity record in Local_Storage
2. WHEN a guest user views activity history, THE Activity_Manager SHALL load records from Local_Storage
3. WHEN displaying statistics, THE Dashboard SHALL include guest user's local activities
4. THE Activity_Manager SHALL maintain activity timestamps and habit associations for guest users

### Requirement 5: データの一貫性とパフォーマンス

**User Story:** As a guest user, I want my data to be reliably stored and quickly accessible, so that I have a smooth experience using the application.

#### Acceptance Criteria

1. WHEN guest data is saved, THE Local_Storage SHALL handle serialization and deserialization correctly
2. WHEN the browser is refreshed, THE Dashboard SHALL restore guest user's data from Local_Storage
3. WHEN Local_Storage operations fail, THE System SHALL handle errors gracefully without crashing
4. THE System SHALL maintain reasonable performance when loading guest data from Local_Storage

### Requirement 6: ユーザーエクスペリエンスの統一

**User Story:** As a guest user, I want the same interface and functionality as logged-in users, so that I can evaluate the full application experience.

#### Acceptance Criteria

1. WHEN a guest user interacts with goal modals, THE UI SHALL provide the same features as for authenticated users
2. WHEN a guest user interacts with habit modals, THE UI SHALL provide the same features as for authenticated users
3. WHEN a guest user views the dashboard, THE Layout SHALL display the same sections as for authenticated users
4. THE Dashboard SHALL not display authentication-specific features to guest users
5. THE Dashboard SHALL provide clear indication of guest mode without disrupting the user experience

### Requirement 7: 将来のアカウント作成への配慮

**User Story:** As a guest user who later creates an account, I want to understand how my local data relates to cloud storage, so that I can make informed decisions about data migration.

#### Acceptance Criteria

1. WHEN a guest user creates an account, THE System SHALL preserve their local data during the authentication process
2. THE System SHALL provide clear messaging about local vs cloud data storage
3. THE System SHALL maintain data integrity during any future migration processes
4. THE System SHALL not automatically delete local guest data upon authentication