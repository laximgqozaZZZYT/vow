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

## 解決済み: MCP Remote Server モバイル接続問題

### 問題概要
- **報告日**: 2026-02-06
- **解決日**: 2026-02-06
- **状態**: 原因特定・ワークアラウンド適用済み / 根本対策は未実装

### 根本原因

**MCPサーバーのトークンがPC端末のlocalStorageにしか存在しない。**

バックエンドAPI (`GET /api/mcp-connections`) はセキュリティのため `serverToken` を `'********'` にマスクして返す。
フロントエンド (`useMultiAgentServer.ts` line 284-299) はlocalStorageの実トークンとマージして復元するが、
**スマホなど別端末のlocalStorageには実トークンが一度も保存されたことがない**ため、
`Bearer ********` で認証しようとして401 Unauthorizedになる。

```
PC (初回設定端末):
  バックエンドAPI → token='********' + localStorage実トークン → マージ成功 ✅

スマホ (別端末):
  バックエンドAPI → token='********' + localStorage空 → '********'のまま → 401 ❌
```

### デバッグログによる裏付け

| ステップ | PC | スマホ |
|---|---|---|
| STEP 1 ヘルスチェック (認証不要) | 200 OK | 200 OK |
| STEP 2 認証テスト (Bearer token) | **200 OK** | **401 Unauthorized** |
| STEP 3 SSE接続 | 接続成功 | エラー (readyState=2) |

→ ネットワークは疎通するが、トークンの値が異なることが原因

### ワークアラウンド（適用済み）
スマホの Settings > AI設定 > MCPサーバー(momo) で認証トークンを再入力して保存。
→ スマホのlocalStorageに実トークンが保存され、正常動作を確認。

### 根本対策（未実装）
別端末でもトークン再入力なしで接続できるようにする仕組みが必要。
→ バックエンドでの暗号化保存＆復元が有力候補。詳細は別途検討中。

### 過去の調査: Tailscale Funnel

Tailscale Funnel経由のHTTPSアクセスはポート制限等で断念。
現在はTailscale直接接続 (192.168.2.110:3456) を使用。

---

## 作業中: AI APIキー設定が保存後に消える問題

### 問題概要
- **報告日**: 2026-02-06
- **状態**: 作業中
- **対象**: Settings > AI APIキー設定

### 根本原因

**2つの問題が複合:**

1. **InMemoryStore使用 (`credentials-store.ts:601-602`)**
   - `NODE_ENV !== 'production'` の場合、DynamoDBではなくインメモリMapに保存
   - バックエンド再起動/Lambdaコールドスタートで全データ消失
   - 開発環境・ステージング環境で再現

2. **バリデーション不足 (`credentials.ts:33`)**
   - `VALID_CREDENTIAL_TYPES = ['openai', 'anthropic', 'custom']` に `gemini`/`codex` が欠落
   - フロントエンドは4種送信 → `gemini`/`codex` は 400 エラーで拒否

### 修正計画

| ファイル | 変更内容 |
|---------|---------|
| `backend/src/services/credentials-store.ts` | 開発環境でもDynamoDBを使用するように変更 |
| `backend/src/routers/credentials.ts` | `VALID_CREDENTIAL_TYPES` に `gemini`, `codex` を追加 |

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
