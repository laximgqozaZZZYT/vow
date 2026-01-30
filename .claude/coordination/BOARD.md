# Agent Coordination Board

## 運用ルール

### push/pull プロトコル
1. **作業開始前**: `git pull origin develop` で最新を取得
2. **状態変更時**: このファイルを更新し `git push`
3. **報告時**: `REPORTS.md` に追記し `git push`

### ステータス定義
- `待機中`: タスク未割当
- `作業中`: エージェントが作業中
- `レビュー待ち`: 完了、司令塔確認待ち
- `完了`: 司令塔承認済み

---

## 現在のタスク割り当て

### 司令塔 (Commander)
| 状態 | 役割 |
|------|------|
| 作業中 | 全体調整、タスク割り当て、進捗管理 |

### Agent-A: habit-goal-level-system
| 項目 | 内容 |
|------|------|
| 状態 | 指示書準備完了 |
| 担当仕様 | habit-goal-level-system (82%) |
| 目標 | THLI-24プロパティテスト実装・100%完了 |
| 対象ファイル | `backend/src/__tests__/services/*.property.test.ts` |
| ブランチ | `feat/habit-goal-level-system-property-tests` |
| 指示書 | `INSTRUCTIONS_AGENT_A.md` |
| 開始時刻 | - |
| 最終更新 | 2025-01-30 |

### Agent-B: user-level-system
| 項目 | 内容 |
|------|------|
| 状態 | 指示書準備完了 |
| 担当仕様 | user-level-system (52%) |
| 目標 | フロントエンドUI実装・75%以上 |
| 対象ファイル | `frontend/app/dashboard/components/*.tsx` |
| ブランチ | `feat/user-level-system-frontend` |
| 指示書 | `INSTRUCTIONS_AGENT_B.md` |
| 開始時刻 | - |
| 最終更新 | 2025-01-30 |

---

## 完了済みタスク

| 完了日時 | エージェント | タスク | 結果 |
|----------|--------------|--------|------|
| 2025-01-30 | 仕様書担当 | 全仕様調査・整理 | 53件調査完了 |
| 2025-01-30 | CI/CD担当 | ワークフロー・スクリプト整備 | 7WF + 4スクリプト |

---

## 注意事項

### ファイル競合回避
- 各エージェントは担当ファイル以外を編集しない
- 共通ファイル編集が必要な場合は司令塔に報告

### 報告タイミング
1. 作業開始時: BOARD.mdの状態を「作業中」に更新
2. 中間報告: 1時間ごと、または重要な進捗時
3. 完了時: REPORTS.mdに結果報告、BOARD.mdを「レビュー待ち」に更新

---

*最終更新: 2025-01-30 by Commander*
