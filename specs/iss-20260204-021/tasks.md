# ISS-20260204-021: タスク一覧

## Overview
- **Purpose**: 実装タスクの進捗管理
- **Status**: Completed
- **Version**: 1.0.0
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect

## Implementation Tasks

### Phase 1: プロンプト修正

- [x] Task 1: 日本語プロンプトにレベル設定パターンを追加
  - ファイル: `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/vow-coach-agent.ts`
  - 担当: vow-spec-architect
  - 完了: 2026-02-04

- [x] Task 2: 英語プロンプトにレベル設定パターンを追加
  - ファイル: `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/vow-coach-agent.ts`
  - 担当: vow-spec-architect
  - 完了: 2026-02-04

### Phase 2: ビルド確認

- [x] Task 3: バックエンドのTypeScriptビルド確認
  - コマンド: `cd /home/ubuntu/Downloads/vow/backend && npm run build`
  - 結果: 成功
  - 完了: 2026-02-04

### Phase 3: Issue完了

- [x] Task 4: Issueをclosedに更新
  - API: Supabase REST API
  - 完了: 2026-02-04

## Progress Summary

| Phase | Tasks | Completed | Progress |
|-------|-------|-----------|----------|
| Phase 1 | 2 | 2 | 100% |
| Phase 2 | 1 | 1 | 100% |
| Phase 3 | 1 | 1 | 100% |
| **Total** | **4** | **4** | **100%** |

## Changes Made

### `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/vow-coach-agent.ts`

1. **Line 275付近**: 日本語プロンプトのツール呼び出しテーブルに以下を追加:
   ```
   | 「習慣のレベル設定」「レベルを変更」「レベルを設定」「既存の習慣の設定」 | **show_habit_selection** |
   ```

2. **Line 358-374付近**: 「習慣/目標の選択が必要なケース」セクションに以下を追加:
   - パターン: 「習慣のレベル設定」「レベルを変更」「レベルを設定」「既存の習慣の設定」
   - 絶対禁止リストに「どの習慣のレベルを設定しますか？」を追加
   - 使用例を追加

3. **Line 654付近**: 英語プロンプトのツール呼び出しテーブルに以下を追加:
   ```
   | "Set habit level", "Change habit level", "Configure existing habits" | **show_habit_selection** |
   ```

## Notes

- MCPサーバーを使用している場合、バックエンドの変更後はサーバーの再起動が必要
- 本番環境への反映にはデプロイが必要
