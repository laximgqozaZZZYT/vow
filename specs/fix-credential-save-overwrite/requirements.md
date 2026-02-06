# AI API キー保存処理の修正 -- 要件定義

## 概要

**ステータス**: ready
**作成日**: 2026-02-06
**作成者**: vow-spec-architect
**重要度**: Critical (全 AI プロバイダーの API キー更新が不可能な状態)

### 背景

設定画面から AI プロバイダー（OpenAI, Anthropic, Gemini, Codex, Custom）の API キーを保存する処理に 2 つのバグが存在し、以下の影響が生じている。

1. **既存クレデンシャルの上書き更新が常に失敗する** -- DynamoDB `UpdateCommand` が `ValidationException` を投げるため、一度保存した API キーをユーザーが変更・更新することができない。
2. **ブラウザのオートフィルが MCP トークンと API キーを混同する** -- 同一ページ上の 3 つの `type="password"` 入力フィールドに識別属性がなく、ブラウザが MCP サーバー認証トークンの値を API キーフィールドにオートフィルする可能性がある。

### 目的

- ユーザーが設定画面から全 AI プロバイダーの API キーを新規保存および上書き更新できるようにする。
- ブラウザのパスワードオートフィルが各フィールドを正しく区別できるようにする。
- 既存の MCP サーバー設定フロー、暗号化ロジック、DynamoDB テーブルスキーマには一切影響を与えない。

---

## 要件 (Requirements)

### 機能要件

1. **REQ-001**: DynamoDB の `UpdateCommand` で `endpoint` や `metadata` が `undefined` の場合でも、`ValidationException` を発生させずに正常に更新処理を完了すること。
   - 受け入れ条件: `input.endpoint` が `undefined` のときに `saveCredential()` を呼んでも例外が発生しない。
   - 受け入れ条件: `input.metadata` が `undefined` のときに `saveCredential()` を呼んでも例外が発生しない。
   - 受け入れ条件: `input.endpoint` と `input.metadata` の両方が `undefined` のときにも正常に更新される。
   - 受け入れ条件: 更新後のレコードで `updatedAt > createdAt` となる。

2. **REQ-002**: `endpoint` や `metadata` に値が指定されている場合は、従来通り DynamoDB レコードに保存されること。
   - 受け入れ条件: `input.endpoint = 'https://api.example.com'` で保存後、`getCredential()` で取得した結果に `endpoint: 'https://api.example.com'` が含まれる。
   - 受け入れ条件: `input.metadata = { note: 'test' }` で保存後、DynamoDB レコードに `metadata: { note: 'test' }` が格納される。

3. **REQ-003**: 全 AI プロバイダー（openai, anthropic, gemini, codex, custom）の API キー保存・更新が正常に動作すること。
   - 受け入れ条件: 各プロバイダーで新規保存 -> 上書き更新の 2 段階が成功する。

4. **REQ-004**: AI API キーの `<input type="password">` フィールドに `name`、`id`、`autoComplete` 属性を付与し、ブラウザが MCP トークンフィールドと区別できるようにすること。
   - 受け入れ条件: `AIProviderSettings.tsx` の API キー入力フィールドに `name="ai-provider-api-key"`, `id="ai-provider-api-key"`, `autoComplete="off"` が設定されている。

5. **REQ-005**: MCP サーバー設定の password input フィールドにも識別属性を付与し、オートフィル混同を防止すること。ただし MCP 機能（追加・編集・保存・接続）の動作には影響を与えないこと。
   - 受け入れ条件: MCP 編集トークン入力に `name="mcp-edit-token"`, `id="mcp-edit-token"`, `autoComplete="off"` が設定されている。
   - 受け入れ条件: MCP 追加トークン入力に `name="mcp-new-token"`, `id="mcp-new-token"`, `autoComplete="off"` が設定されている。
   - 受け入れ条件: MCP サーバーの追加・編集・保存の動作が変更前と同一であること。

### 非機能要件

- **NFR-001**: 暗号化ロジック（`encrypt()`, `decrypt()` 関数）は変更しない。
- **NFR-002**: DynamoDB テーブルスキーマ（パーティションキー `userId`、ソートキー `credentialType`）は変更しない。
- **NFR-003**: `removeUndefinedValues: true` の設定は保持する（PutCommand や他の箇所で活用されているため）。
- **NFR-004**: MCP サーバー設定の JavaScript ロジック（`addServer`, `updateServer`, `removeServer`, `saveConfigToBackend`）は一切変更しない。
- **NFR-005**: 修正にはユニットテストを含める。Vitest フレームワークを使用する。

---

## 影響範囲

### 修正対象ファイル

| ファイル | 修正内容 | Bug |
|---------|---------|-----|
| `backend/src/services/credentials-store.ts` | `saveCredential` の `UpdateCommand` を動的に構築 | #1 |
| `frontend/app/settings/components/AIProviderSettings.tsx` | API キー input に属性追加 | #2 |
| `frontend/app/settings/page.tsx` | MCP トークン input に属性追加 | #2 |

### 変更しないファイル・ロジック

- `backend/src/routers/credentials.ts` -- ルーターロジックは問題なし
- `frontend/hooks/useCredentials.ts` -- フック側は問題なし
- `encrypt()` / `decrypt()` 関数
- DynamoDB テーブル定義 (infra/)
- MCP サーバーの JS ロジック全般

---

## 根本原因分析

### Bug #1: UpdateCommand の ValidationException

**原因チェーン**:

```
1. DynamoDBDocumentClient は marshallOptions.removeUndefinedValues = true で初期化
2. saveCredential() が呼ばれると ExpressionAttributeValues に input.endpoint (undefined) と
   input.metadata (undefined) が含まれる
3. removeUndefinedValues が :endpoint と :metadata を ExpressionAttributeValues から除去
4. しかし UpdateExpression は引き続き "endpoint = :endpoint" と "metadata = :metadata" を参照
5. DynamoDB が「ExpressionAttributeValues に :endpoint が存在しない」として ValidationException を投げる
```

**再現条件**: `input.endpoint` または `input.metadata` が `undefined` の状態で、既存レコードに対して `saveCredential()` を呼ぶ。フロントエンドから通常のフローで API キーを保存する場合、これらのフィールドは渡されないため、ほぼ確実にこの条件に該当する。

**DynamoDB の証拠**: 本番レコードの `createdAt === updatedAt`（`2026-02-06T12:17:45.239Z`）であり、初回作成後に一度も更新が成功していない。

### Bug #2: パスワードフィールド識別不能

**原因**: 設定ページに 3 つの `type="password"` 入力フィールドが存在するが、全て `name`, `id`, `autoComplete` 属性が欠如しており、`<form>` タグでも囲まれていない。ブラウザのパスワードマネージャーはフィールドの識別にこれらの属性を使用するため、フィールドを区別できず、意図しないオートフィルが発生する可能性がある。
