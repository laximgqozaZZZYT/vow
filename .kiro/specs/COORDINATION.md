# VOW Project - Agent Coordination File

**Last Updated**: 2025-02-02T11:00:00Z
**Updated By**: vow-spec-architect (Claude Code)

---

## Current Sprint Goals

### Sprint Focus: AI Coaching / Agents Integration

統合セクション (Section.AIAssistant) の実装を完了し、Coach Mode と Manager Mode のデュアルモード動作を実現する。

### Key Deliverables

1. **Section.AIAssistant** - 統合メインコンポーネント
2. **View.CoachMode** - 既存AI Coaching機能の抽出
3. **View.ManagerMode** - マルチエージェント操作UI
4. **Widget.TemplateSelector** - タスクテンプレート選択UI
5. **Widget.AgentStatusBar** - エージェント状態表示

---

## Active Specifications

| Spec Name | Status | Priority | Assigned To | Notes |
|-----------|--------|----------|-------------|-------|
| ai-agents-integration | Draft | High | TBD | 新規: Coach/Agents統合 |
| ai-agent-framework-integration | In Progress | High | - | Mastra/Strands統合 |
| multi-agent-dashboard-ui | In Progress | Medium | - | Phase 11-16 |
| habit-goal-level-system | In Progress (82%) | High | - | THLI-24 |
| user-level-system | In Progress (52%) | Medium | - | XP and user levels |

---

## Task Assignments

### ai-agents-integration Tasks

| Task ID | Title | Status | Assigned To | Blocked By |
|---------|-------|--------|-------------|------------|
| TASK-1.1 | Section.AIAssistant スケルトン | Pending | - | TASK-1.2 |
| TASK-1.2 | useAIAssistantMode フック | Pending | - | None |
| TASK-1.3 | Section.Coach リファクタリング | Pending | - | TASK-1.1 |
| TASK-2.1 | View.ManagerMode 作成 | Pending | - | TASK-1.1 |
| TASK-2.2 | taskTemplates.ts 作成 | Pending | - | None |
| TASK-2.3 | Widget.TemplateSelector 作成 | Pending | - | TASK-2.2 |
| TASK-2.4 | テンプレートからタスク作成 | Pending | - | TASK-2.3 |
| TASK-3.1 | チャットタイムライン統合 | Pending | - | TASK-2.1 |
| TASK-3.2 | タスクフォーカス機能 | Pending | - | TASK-3.1 |
| TASK-3.3 | リアルタイム更新最適化 | Pending | - | TASK-3.1 |
| TASK-4.1 | 推奨プロンプト強化 | Pending | - | TASK-1.3 |
| TASK-4.2 | ツールコール視覚化改善 | Pending | - | TASK-1.3 |
| TASK-5.1 | ユニットテスト作成 | Pending | - | Phase 1-2 |
| TASK-5.2 | 統合テスト作成 | Pending | - | Phase 1-3 |
| TASK-5.3 | E2Eテスト作成 | Pending | - | Phase 1-4 |

---

## Parallel Work Opportunities

以下のタスクは**独立して並列実行可能**:

1. **TASK-1.2** (useAIAssistantModeフック) と **TASK-2.2** (テンプレート定義)
   - 依存関係なし、異なるファイルを編集

2. **TASK-1.3** (Coach Modeリファクタ) と **TASK-2.1** (Manager Mode作成)
   - TASK-1.1完了後、2名で並列可能

---

## File Lock Status

現在ロック中のファイルはありません。

### File Ownership Rules

1. **Coach Mode関連** (`Section.Coach.tsx`, `View.CoachMode.tsx`)
   - 1名のみアサイン

2. **Manager Mode関連** (`Section.Agents.tsx`, `View.ManagerMode.tsx`)
   - 1名のみアサイン

3. **共通コンポーネント** (`Section.AIAssistant.tsx`)
   - Phase 1完了後にのみ編集

---

## Blocking Issues

現在ブロッキング問題はありません。

---

## Integration Points

### Between Coach Mode and Manager Mode

- **Shared State**: `inputValue`, `processing`, `error`
- **Shared Components**: `UnifiedInputArea`, `Modal.MultiAgentConfig`
- **Shared Hooks**: `useMultiAgentServer`

### With Existing Systems

- **Section.Coach.tsx**: View.CoachModeに抽出後、ラッパーとして維持
- **Section.Agents.tsx**: 既存機能を維持、View.ManagerModeは新規追加
- **Modal.ManagerChat.tsx**: Widget.GroupChatTimelineにロジック抽出

---

## Communication Protocol

### Before Starting Work

1. このファイルを確認
2. 担当タスクの依存関係をチェック
3. 対象ファイルがロックされていないか確認
4. Task Assignments テーブルを更新

### During Work

1. 30分ごとにコミット推奨
2. ブロッキング問題があればすぐにこのファイルに記録
3. 依存タスクが完了したら関連エージェントに通知

### After Completing Work

1. Task Status を更新
2. File Lock を解除
3. 次のタスクが着手可能になったエージェントに通知

---

## Review Checkpoints

- [ ] **Phase 1完了**: インターフェース確定レビュー (2名参加)
- [ ] **Phase 2完了**: テンプレート仕様レビュー
- [ ] **Phase 3完了**: チャットUI統合レビュー
- [ ] **Phase 5完了**: 最終統合テスト

---

## Notes for New Agents

1. **仕様書を読む**: `/home/ubuntu/Downloads/vow/.kiro/specs/ai-agents-integration/`
   - `requirements.md`: 要件定義
   - `design.md`: 技術設計
   - `tasks.md`: タスク詳細

2. **既存コードを確認**:
   - `Section.Coach.tsx`: AI Coachingの現在実装
   - `Section.Agents.tsx`: Agentsセクションの現在実装
   - `useMultiAgentServer.ts`: MCP接続フック

3. **テスト環境**:
   - `npm run dev` でフロントエンド起動
   - MCPサーバー接続は開発環境設定が必要

---

## Contact Points

- **仕様策定**: vow-spec-architect
- **フロントエンド**: TBD
- **バックエンド**: TBD
- **テスト**: TBD
