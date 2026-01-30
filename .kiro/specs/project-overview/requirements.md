# Requirements Document: VOW Project Overview

## Introduction

VOW（習慣・目標トラッカー）は、個人の習慣管理と目標設定を支援するWebアプリケーションです。本ドキュメントは、他のAIエージェントがプロジェクト全体を理解し、効率的に開発作業を行うための包括的な仕様書です。

**本番URL**: https://main.do1k9oyyorn24.amplifyapp.com/

## Glossary

- **THLI-24**: Total Habit Load Index - 24変数で習慣難易度を0-199スケールで評価するAIフレームワーク
- **Level Tier**: 習慣難易度の分類（beginner: 0-49, intermediate: 50-99, advanced: 100-149, expert: 150-199）
- **Baby Step**: 習慣の簡略版（Lv.50 または Lv.10）
- **XP (Experience Points)**: ユーザーの経験値ポイント
- **Workload**: 習慣の作業量（単位付き）
- **Guest Mode**: LocalStorageベースのアカウント不要モード
- **RLS (Row Level Security)**: Supabaseのデータアクセス制御

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フロントエンド | Next.js 16.1.1, React 19, TypeScript |
| スタイリング | Tailwind CSS 4 |
| バックエンド | Lambda (TypeScript), Express |
| データベース | Supabase (PostgreSQL) |
| 認証 | Supabase Auth (Google/GitHub OAuth) |
| インフラ | AWS (Lambda, API Gateway, Amplify), Terraform/CDK |
| カレンダー | FullCalendar |
| マインドマップ | React Flow |
| AI | OpenAI API (GPT-4) |
| テスト | Jest, fast-check (Property-Based Testing) |

## Requirements

### Requirement 1: コア機能 - 目標管理

**User Story:** ユーザーとして、階層構造で目標を整理し、進捗を可視化したい。

#### Acceptance Criteria

1. THE System SHALL support creating goals with name, details, due date fields
2. THE System SHALL support hierarchical goal structure with parent-child relationships
3. THE System SHALL support tagging goals with custom tags
4. THE System SHALL calculate goal progress based on child habit completion
5. THE System SHALL support OKR-style milestones for goals
6. THE System SHALL support domain codes for XP distribution

### Requirement 2: コア機能 - 習慣トラッキング

**User Story:** ユーザーとして、日々の習慣を記録し、継続状況を確認したい。

#### Acceptance Criteria

1. THE System SHALL support creating habits with type (do/avoid), count, must fields
2. THE System SHALL support recurring habits with repeat patterns
3. THE System SHALL support habit timings with start/end times
4. THE System SHALL support workload tracking with unit, total, per-count values
5. THE System SHALL record activities (start, complete, skip, pause) with timestamps
6. THE System SHALL support habit reminders (absolute time or relative)
7. THE System SHALL support THLI-24 level assessment for habits (0-199 scale)
8. THE System SHALL auto-calculate level tier from level value

### Requirement 3: コア機能 - マインドマップ

**User Story:** ユーザーとして、目標と習慣の関係を視覚的に管理したい。

#### Acceptance Criteria

1. THE System SHALL display goals and habits as connected nodes using React Flow
2. THE System SHALL support drag-and-drop node positioning
3. THE System SHALL support creating connections between nodes
4. THE System SHALL support Goal Enclosure layout (goals contain related habits)
5. THE System SHALL support mobile-friendly touch interactions

### Requirement 4: コア機能 - 統計・分析

**User Story:** ユーザーとして、習慣の継続状況を統計で確認したい。

#### Acceptance Criteria

1. THE System SHALL display habit completion heatmap
2. THE System SHALL display weekly/monthly progress charts
3. THE System SHALL display workload charts
4. THE System SHALL support filtering by date range and tags

### Requirement 5: AIコーチ機能

**User Story:** ユーザーとして、AIコーチからパーソナライズされたアドバイスを受けたい。

#### Acceptance Criteria

1. THE System SHALL provide AI-powered habit suggestions via chat interface
2. THE System SHALL support THLI-24 assessment conversations
3. THE System SHALL generate baby steps for struggling habits (Lv.50, Lv.10)
4. THE System SHALL detect level-up/level-down candidates automatically
5. THE System SHALL enforce usage quota (10 assessments/month for free users)
6. THE System SHALL support guardrails to prevent harmful suggestions
7. THE System SHALL store AI conversations for reference

### Requirement 6: ゲーミフィケーション

**User Story:** ユーザーとして、習慣達成でXPを獲得し、レベルアップを楽しみたい。

#### Acceptance Criteria

1. THE System SHALL award XP for habit completions
2. THE System SHALL support domain-based XP distribution
3. THE System SHALL track user level with XP thresholds
4. THE System SHALL support XP multipliers based on streak
5. THE System SHALL support XP recovery for missed completions
6. THE System SHALL display level badges and progress

### Requirement 7: 認証・データ管理

**User Story:** ユーザーとして、安全にデータを保存し、デバイス間で同期したい。

#### Acceptance Criteria

1. THE System SHALL support Google OAuth login
2. THE System SHALL support GitHub OAuth login
3. THE System SHALL support guest mode with LocalStorage
4. THE System SHALL migrate guest data to authenticated account on login
5. THE System SHALL protect data with Row Level Security (RLS)
6. THE System SHALL support premium subscription features

### Requirement 8: Slack連携

**User Story:** ユーザーとして、Slackから習慣を記録・確認したい。

#### Acceptance Criteria

1. THE System SHALL support Slack OAuth installation
2. THE System SHALL support /vow slash commands
3. THE System SHALL send habit reminder notifications to Slack
4. THE System SHALL support interactive buttons for habit actions

### Requirement 9: 埋め込みウィジェット

**User Story:** ユーザーとして、ダッシュボードを外部サイトに埋め込みたい。

#### Acceptance Criteria

1. THE System SHALL provide embeddable widget endpoints
2. THE System SHALL support domain-based access control
3. THE System SHALL support configurable widget appearance

### Requirement 10: ダッシュボードUI

**User Story:** ユーザーとして、直感的なUIで習慣・目標を管理したい。

#### Acceptance Criteria

1. THE System SHALL provide tab-based navigation (Board, Calendar, Mindmap, etc.)
2. THE System SHALL support responsive design (mobile/tablet/desktop)
3. THE System SHALL support dark mode
4. THE System SHALL follow design system guidelines (see steering/design-system.md)
5. THE System SHALL support keyboard shortcuts for power users

## 実装状況サマリー

### 完了済みスペック (100%)

- ai-coach-quality-improvement
- ai-coach-ui-redesign
- codebase-refactoring
- dashboard-section-commands
- dashboard-tab-navigation
- dev-environment-deploy-flow
- edit-modal-ux-redesign
- embeddable-dashboard-widgets
- gamification-xp-balance
- goal-enclosure-diagram
- habit-load-completion-display
- habit-modal-tabs
- landing-page-demo
- level-system-rebalancing
- slack-habit-notifications
- slack-integration
- slack-lambda-stability
- sticky-habit-subtask-integration
- todo-site-refactoring
- xp-recovery-calculation

### 進行中スペック (50-99%)

- ai-coach-guardrails (80%)
- ai-coach-usability-enhancement (59%)
- aws-cloud-lift (89%)
- aws-production-migration (93%)
- aws-serverless-migration (88%)
- backend-typescript-migration (91%)
- board-gantt-chart (75%)
- habit-goal-level-system (82%)
- mindmap-refactoring (75%)
- premium-subscription-ai-features (88%)
- seo-metadata-enhancement (82%)
- shadcn-linear-design-system (87%)
- user-level-system (52%)

### 未着手/初期段階スペック (0-49%)

- aws-slack-production-setup (22%)
- backend-containerization (33%)
- board-kanban-section (36%)
- board-progress-calculation (33%)
- claude-agent-delegation-workflow (0%)
- goal-okr-milestones (0%)
- habit-modal-view-modes (50%)
- habit-progress-timeline-fixes (14%)
- habit-sticky-commit-integration (0%)
- japanese-documentation-update (8%)
- landing-page-conversion-optimization (8%)
- notification-reminders (0%)
- slack-command-fix (67%)
- slack-habit-dashboard-command (33%)
- slack-oauth-fix (33%)
- task-priority-status (0%)
- weekly-review-analytics (0%)
