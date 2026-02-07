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

---

# MCP Connection 401 Bug Investigation (2026-02-06)

## Problem
AWS開発環境で、MCPリモートサーバー(192.168.2.110:3456)への接続がページ遷移後に401で失敗。値を変えずに手動「接続」で復帰。PC・スマホ両方で再現。

## Round 1: Investigation

### Agent-α: Frontend Lifecycle
- authTokenは全ページでnull→実値の2段階遷移。useEffect `[authToken]`で必ず2回発火
- FIRE 1(null)→localStorage→500msタイマー。FIRE 2(実token)→cleanup(タイマーキャンセル+SSE全閉)→backend→新タイマー
- 通常(Supabase<500ms)ではFIRE 1タイマーはキャンセルされFIRE 2のみ接続。**正常動作**
- cleanup関数が`connectedServersRef`をクリアしない→onerrorでstale state
- **結論**: 2重発火は寄与要因だが主原因ではない

### Agent-β: Backend Decryption
- `isEncryptedToken()`はMCPトークン(mcp-xxx)に正しくfalse返す（ハイフン非一致）
- `decryptServerTokens()` line 160: 復号失敗→`serverToken: ''`（CONFIRMED）
- 3種の暗号化キー存在。現行は一致。`.env.terraform`に別キーあり（sourceリスク）
- PUTは正しく暗号化（二重暗号化なし）
- **結論**: 現在のキー設定下では主原因ではない

### Agent-γ: localStorage Flow
- `saveConfigToLocalStorage`は空token書込みガードなし
- backend復号失敗→空token→localStorageに永続化→汚染
- auto-connect line 445は空tokenをガード(falsy)だがstale非空tokenは通過
- manual reconnectは`configRef.current`使用（backend最新データ反映済み）
- **結論**: 正常時はlocalStorageに正しいtoken有。増幅要因のみ

### Agent-δ: SSE/Reconnect
- `/health`チェックは認証不要→token問題をマスク
- `apiRequest`の401が`.catch(() => [])`で無視→SSE接続に進むが失敗
- Supabase JWT無効中のnavigation→backend 401→localStorage fallback→stale MCP token
- **結論**: 最有力=Supabase JWT一時無効→backend API 401→localStorage fallback

### Round 1 コンセンサス
| 仮説 | α | β | γ | δ | 総合 |
|------|---|---|---|---|------|
| backend復号失敗(空token) | 寄与 | 低い | 増幅 | - | △ |
| authToken 2重発火 | 寄与 | - | 主要 | - | △ |
| Supabase JWT無効→backend 401→fallback | - | - | - | 最有力 | ◎ |
| connectedServersRef stale | 寄与 | - | - | 寄与 | △ |

---

## Round 1: Cross-Reference & Corrections

### 担当マトリクス
| Agent | レビュー対象 |
|-------|------------|
| α | β + δ の findings |
| β | α + γ の findings |
| γ | δ + α の findings |
| δ | β + γ の findings |

### 訂正事項（~~打ち消し~~ → 修正）

1. ~~γ: 複数の`useMultiAgentServer`インスタンスが同時に動作し競合~~ → **βとδが訂正**: dashboardはタブベース(`renderSectionContent`がswitch文)で1セクションのみレンダリング。同時動作は最大2インスタンス（MOCSection + useMOCChat）。

2. ~~δ: `connectToServer`のstale closure参照が主原因~~ → **δ自身+αが訂正**: `connectToServer`は`useCallback`で参照安定。serverパラメータ経由でtokenを渡すためstale closureにならない。

3. ~~γ Round1: authToken 2重発火が「主要」原因~~ → **β+αが修正**: 2重発火は寄与要因だが、通常 getSession() < 500ms で FIRE 1 タイマーはキャンセルされる。主原因ではない。

4. ~~δ Round1: Supabase JWT一時無効が「最有力」~~ → **γが訂正**: onAuthStateChange の TOKEN_REFRESHED イベントが真の原因。JWT が無効になるのではなく、リフレッシュで新しいtoken文字列に変わること自体が `useEffect([authToken])` をトリガーする。

### 新発見（Cross-Reference で判明）

**【最重要】TOKEN_REFRESHED が根本原因 (γ, α が独立して発見)**
- `useAuth.ts:292`: `setAuthToken(token)` が TOKEN_REFRESHED を含む**全イベント**で無条件発火
- TOKEN_REFRESHED は ~55分ごと or タブフォーカス時に発火
- → `useMultiAgentServer` の `useEffect([authToken])` がトリガー
- → cleanup で **全SSE接続が切断** (line 467: `eventSourcesRef.current.forEach((es) => es.close())`)
- → 再接続まで500ms+のギャップ発生

**Section.Agents vs Section.MOC の非対称性 (α, γ)**
- Section.Agents: one-shot `getSession()` のみ（`onAuthStateChange` リスナー無し）→ **TOKEN_REFRESHED の影響を受けない**
- Section.MOC: DashboardPage から `authToken` をprops受信 → **TOKEN_REFRESHED で毎回SSE全切断**

**MCP Task Server認証の仕組み (δ: server.ts 読解)**
- `/home/ubuntu/.mcp-multi-agent/mcp-task-distributor/src/server.ts:147-182`
- `token !== AUTH_TOKEN` の単純文字列比較。セッション管理・レート制限なし
- 401 = トークン不一致のみ。サーバー側状態は関係なし

**`connectedServersRef` が一度もクリアされない (α, β, δ)**
- `connectedServersRef.current.add()` (line 560) はあるが `.delete()` / `.clear()` が存在しない
- cleanup でもクリアされず → `onerror` の `wasConnected` が常に `true`
- → エラー状態のUI更新がスキップされ、stale "connected" 表示が残る

**リトライカウンター枯渇 → 永続的エラー状態 (δ)**
- `onerror` で最大3回リトライ後、`connectionState: 'error'` で永続停止
- manual reconnect (line 839) でリトライカウンターをリセット → **だから手動再接続が有効**
- リトライカウンターは `window` オブジェクトに保存 → 複数インスタンスで共有・競合

**`.catch(() => [])` によるサイレントエラー (α, δ)**
- `connectToServer` 内の REST API 呼び出し (line 760-762) が 401 を無言で飲み込む
- `/health` は認証不要で常に成功 → token問題をマスク

**トークン不一致リスク (δ)**
- `server.env`: `TASK_SERVER_TOKEN=mcp-dca3c407f66c5b62840b06c3d624c857`
- Frontend default: `mcp-multi-agent-token-f75a6267`
- 2つの異なるトークン → 設定不整合の可能性

**本番環境の47バイト暗号化キー (α, β)**
- prod tfstate の `A58hDV8F0Q...` は47バイト（AES-256は32バイト必要）
- `crypto.subtle.importKey` で `OperationError` → 復号失敗 → `serverToken: ''` 返却
- 本番環境で永続的なトークン復号失敗を引き起こす

### Cross-Reference コンセンサス（修正後）

| 仮説 | α | β | γ | δ | 総合 |
|------|---|---|---|---|------|
| **TOKEN_REFRESHED → useEffect再発火 → SSE全切断** | ◎主因 | △寄与 | ◎主因 | △寄与 | **◎◎ 主因** |
| リトライカウンター枯渇 → 永続エラー | - | △ | - | ◎ | **◎ 永続化要因** |
| connectedServersRef未クリア → stale UI | ◎ | ◎ | - | ◎ | **○ マスク要因** |
| 2重発火 (null→real) | △寄与 | △寄与 | △修正 | △寄与 | **△ 寄与要因** |
| backend復号失敗 (空token) | △ | △ | △ | △ | **△ 増幅要因** |
| `.catch(() => [])` サイレントエラー | ◎ | - | - | ◎ | **△ デバッグ阻害** |
| prod 47バイトキー | ◎ | ◎ | - | - | **△ prod限定** |

---

## Round 2: Deep Dive

### Agent-α: TOKEN_REFRESHED仮説の検証
- ~~TOKEN_REFRESHED が主原因~~ → **修正**: TOKEN_REFRESHED は寄与要因のみ。~55分ごとの発火であり、「ページ遷移後」の症状と一致しない
- **真の主因はタブ切り替え時のコンポーネントunmount/remount**
  - `renderSectionContent()` が switch 文でコンポーネントを切り替え → 完全な破棄・再生成
  - unmount 時: `eventSourcesRef.current.forEach((es) => es.close())` で全SSE切断
  - remount 時: `useEffect([authToken])` が再発火、500ms後にauto-connect
- TOKEN_REFRESHED は新しいJWT文字列を毎回生成（`iat`/`exp`変更）→ `setAuthToken(token)` は等値チェックなし → 不要なuseEffect再発火を引き起こす（~1時間ごと）
- **Section.Agents の「免疫」は疑問**: remount 時に2段階初期化（null→real）があり、MOCより脆弱な可能性
- **推奨Fix**: `useMultiAgentServer` を親コンポーネント `DashboardPage` にリフトアップ

### Agent-β: リトライカウンター枯渇メカニズム
- **CONFIRMED**: `es.close()` は `onerror` を発火しない（HTML Living Standard準拠）→ Round 1の仮説を訂正
- リトライカウンターのライフサイクル:
  - `window[retry_${server.id}]` に保存（グローバル、ページリロードまで永続）
  - リセット箇所: auto-connect (line 448), manual reconnect (line 839)
  - インクリメント: `onerror` ハンドラ (line 707)
  - maxRetries = 3 → 到達後 PERMANENT error state
- **危険シナリオ**: SSE接続後に通信切断 → 3回リトライ → 永続エラー → サーバー復旧しても自動回復なし
- auto-connect は常にカウンターを0にリセット → ページ遷移後は正常に回復可能
- **永続エラーの条件**: 同一ページでauthToken変化なし + リトライ枯渇 → 手動操作かauthToken変化まで回復不能

### Agent-γ: ページ遷移の正確なトレース
- **Scenario A (Agents タブ切替)**: double-fire パターン
  1. remount → `authToken=null` → localStorage読込 → auto-connect(500ms)
  2. `getSession()` 解決 → `authToken=real` → cleanup(SSE全切断!) → backend読込 → auto-connect(500ms)
  3. **競合**: ①のSSE切断による `onerror` が②のリトライカウンターリセット後にインクリメントする可能性
- **Scenario B (MOC タブ切替)**: single-fire パターン（親からauthToken受信 → double-fire なし）
  - ただし `connectedServersRef` のstaleエントリが残り、エラーUIをマスク
- **Scenario C (Dashboard→Settings→Dashboard)**: 全コンポーネント破棄→再構築
- **推奨Fix**: AgentsSectionもMOCと同様に親からauthTokenをprops受信すべき

### Agent-δ: トークンフロー端対端トレース
- **MCP serverToken フローは正常**: localStorage も backend も常に実トークンを保有
  - Backend GET: 暗号化解除済みの平文トークンを返却（マスクなし）
  - localStorage: backend成功時に実トークンで更新
  - `'********'` が返されるパスは存在しない（PUT専用ロジック）
- **server.env トークン不一致**: `server.env` = `mcp-dca3c407...` vs 稼働中サーバー = `mcp-multi-agent-token-f75a6267`（起動時の環境変数オーバーライド）
- **`connectToServer` はキャンセル不可**: useEffect cleanup 後も非同期処理が継続 → 孤立接続の原因
- **【重要仮説】401 は MCP サーバーではなく VOW バックエンド由来の可能性**
  - Supabase JWT 失効 → `loadConfigFromBackend(expired_jwt)` → VOW backend 401
  - ブラウザコンソール/Network タブで MCP サーバーの 401 と誤認
  - 手動再接続が機能する理由: 操作時にはSupabase JWTがリフレッシュ済み

### Round 2 コンセンサス

| 仮説 | α | β | γ | δ | 総合 |
|------|---|---|---|---|------|
| **タブ切替 unmount/remount → SSE全切断 → 再初期化** | ◎主因 | ◎前提 | ◎主因 | ◎前提 | **◎◎ 最主因** |
| **double-fire (null→real) による競合** | ◎主因 | △寄与 | ◎主因 | ◎中 | **◎ AgentsSection主因** |
| リトライカウンター枯渇 → 永続エラー | △ | ◎確認 | ◎増幅 | △ | **◎ 永続化要因** |
| TOKEN_REFRESHED → SSE全切断 (~1h/回) | △二次 | - | - | - | **△ 二次要因** |
| connectedServersRef 未クリア → stale UI | - | ◎確認 | ◎確認 | △ | **○ マスク要因** |
| connectToServer キャンセル不可 → 孤立接続 | - | - | - | ◎ | **○ 増幅要因** |
| 401 は VOW backend 由来 (Supabase JWT) | ◎可能性 | - | - | ◎最有力 | **△ 要検証** |
| es.close() は onerror 非発火 (HTML spec) | - | ◎訂正 | - | - | **◎ 確定事実** |

---

## Round 2: Cross-Reference

### 訂正事項（打ち消し線）

1. ~~Agent-γ Scenario A Step 12: 「es.close() が onerror を非同期発火」~~ → **全4エージェント確認**: `es.close()` は onerror を発火しない（HTML Living Standard §9.2.8）。γ の「三次根本原因: リトライカウンター競合」仮説は無効
2. ~~Agent-γ: 「connectedServersRef がマウントをまたいで永続」~~ → **修正**: `useRef` はインスタンス単位。remount で新しい空 Set が生成される。stale 問題は同一インスタンス内の authToken 変化時のみ
3. ~~Agent-α: 「Section.Agents は MOC より MORE fragile（脆弱）」~~ → **修正**: double-fire の 2段階（null→real）はほぼ常に無害。FIRE 1 の 500ms auto-connect タイマーは cleanup で ~10-50ms 以内にキャンセルされる（発火前）。リトライカウンターを汚染しない
4. ~~Agent-δ: 「401 は VOW backend 由来（Supabase JWT）」が最有力~~ → **修正**: VOW backend の 401 は `console.debug` + localStorage フォールバックでサイレント処理。ユーザーに見えるエラーは MCP 接続リトライ枯渇由来。VOW backend 401 説は「最有力」ではなく「未証明」

### 新発見

#### Agent-α（β+δ レビュー）
- **【CRITICAL】4つの独立 hook インスタンスがリトライカウンター共有**: MOC, Agents, AIHub, AIAssistant が各自 `useMultiAgentServer` をインスタンス化 → 同じ `window[retry_${server.id}]` を共有 → リトライバジェット3回が1回の障害ラウンドで枯渇可能
- **onerror の reconnect ガードが非対称**: `enabled && autoConnect` のみチェック。`serverUrl`/`serverToken` はチェックしない（auto-connect の4条件と不一致）
- connectSSE が `connectToServer` をクロージャでキャプチャ（deps 未指定）→ stale closure だが、全 deps が stable なため実害なし

#### Agent-β（α+γ レビュー）
- connectedServersRef の stale 問題は double-fire の一般的ケースで **影響ゼロ**: FIRE 1 で EventSource は作成されない（500ms タイマーが cleanup 前に発火しない）→ stale エントリが存在しない
- **connectToServer の catch と onerror が競合**: SSE 接続失敗時、catch は `error` 状態設定、onerror は `connecting` 状態設定 → 短時間の状態フリッカー

#### Agent-γ（δ+α レビュー）
- **`migrationStatus` 依存の増幅効果**: `useAuth` の `useEffect([migrationStatus])` が auth listener を再サブスクリプション → `INITIAL_SESSION` イベント発火 → `setAuthToken(token)` の等値チェックなし → 不要な useEffect 再発火の増幅源
- stale closure（connectSSE → connectToServer）は安全：deps が全て stable

#### Agent-δ（β+γ レビュー）
- double-fire は実質無害（500ms タイマーキャンセルで確認済み）
- **AgentsSection は mount 後に authToken を更新しない**: `onAuthStateChange` 未サブスクリプション → TOKEN_REFRESHED による再発火は起きない（Settings ページとは異なる）
- クロスページリトライカウンター汚染は auto-connect リセットで防止済み

### Round 2 Cross-Reference コンセンサス

| 仮説 | R2確定度 | 変化 |
|------|---------|------|
| **タブ切替 unmount/remount → SSE 全切断** | ◎◎ PRIMARY TRIGGER | 変化なし |
| **リトライカウンター枯渇 → 永続エラー** | ◎◎ AMPLIFICATION | ↑ 4インスタンス共有で増悪 |
| double-fire (null→real) 競合 | △ ほぼ無害 | ↓↓ 大幅下方修正 |
| connectedServersRef stale | △ 実害ゼロ | ↓↓ 大幅下方修正 |
| TOKEN_REFRESHED → SSE切断 | △ 二次要因(~1h/回) | 変化なし |
| 401 は VOW backend 由来 | △ 未証明 | ↓ 「最有力」→「未証明」 |
| es.close() は onerror 非発火 | ◎ 確定事実 | 変化なし |
| 【NEW】4インスタンスがリトライバジェット共有 | ◎ CRITICAL | 新規発見 |
| 【NEW】onerror reconnect ガード非対称 | ○ リスク | 新規発見 |
| 【NEW】migrationStatus による増幅 | ○ 寄与要因 | 新規発見 |

### 未解決: 初回401の真因

全エージェントが一致: MCP serverToken フロー自体は正常（実トークン常に利用可能）。しかし **最初の MCP サーバー 401 がなぜ発生するか** は未解決。候補:
1. トークン不一致（server.env vs 稼働中サーバー引数）
2. SSE 再接続時のタイミング問題（config 読込完了前に接続試行）
3. 4インスタンスのリトライ枯渇が一過性の障害を永続化

### 推奨Fix（優先順位）
1. **HIGH**: `useMultiAgentServer` を DashboardLayout/Context に移動（タブ切替で SSE 切断しない）
2. **HIGH**: AgentsSection に authToken を props で渡す（MOCSection と統一）
3. **MEDIUM**: リトライ枯渇後の自動回復追加（60秒ごとの再試行）
4. **MEDIUM**: リトライカウンターをインスタンス単位に変更（window グローバルから useRef に）
5. **LOW**: onerror reconnect ガードに serverUrl/serverToken チェック追加
6. **LOW**: authToken null 時の auto-connect スキップ

---

## Round 3: Deep Dive

*(pending)*

---

## Round 3: Cross-Reference

*(pending)*

---

## Final Root Cause & Fix

*(pending)*
