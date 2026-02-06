# AI API キー保存処理の修正 -- 実装タスク一覧

## 概要

**ステータス**: ready
**作成日**: 2026-02-06
**作成者**: vow-spec-architect
**関連仕様**: `requirements.md`, `design.md`

---

## タスク一覧

### Task 1: UpdateCommand の動的構築に修正

- **担当**: backend-implementer
- **推奨モデル**: Sonnet
- **ファイル**:
  - `backend/src/services/credentials-store.ts`
- **依存**: なし
- **見積もり**: 15 分
- **ステータス**: pending

**詳細**:

`DynamoDBCredentialsStore.saveCredential()` メソッド (Line 383-402) の `UpdateCommand` パスを以下のように修正する。

1. `UpdateExpression` の SET 句を動的に構築する配列 `setClauses` を作成
2. 常に含むフィールド: `encryptedApiKey`, `#model`, `updatedAt`, `isActive`
3. `input.endpoint !== undefined` のときのみ `endpoint = :endpoint` を追加
4. `input.metadata !== undefined` のときのみ `#metadata = :metadata` を追加
5. `ExpressionAttributeValues` と `ExpressionAttributeNames` も対応するフィールドのみ含める
6. 最終的な `UpdateExpression` は `` `SET ${setClauses.join(', ')}` `` で生成

**変更する行**: 383-402 (UpdateCommand ブロック全体)

**変更しない行**:
- Line 300-304: `removeUndefinedValues: true` の設定 (そのまま)
- Line 403-422: PutCommand ブロック (そのまま)
- Line 80-93: `encrypt()` 関数 (そのまま)
- Line 99-120: `decrypt()` 関数 (そのまま)

**受け入れ条件**:
- [ ] `input.endpoint` が `undefined` の場合、`UpdateExpression` に `endpoint` が含まれない
- [ ] `input.metadata` が `undefined` の場合、`UpdateExpression` に `metadata` が含まれない
- [ ] `input.endpoint` が `undefined` の場合、`ExpressionAttributeValues` に `:endpoint` キーが含まれない
- [ ] `input.metadata` が `undefined` の場合、`ExpressionAttributeValues` に `:metadata` キーが含まれない
- [ ] `input.endpoint` に値がある場合、`UpdateExpression` に `endpoint = :endpoint` が含まれる
- [ ] `input.metadata` に値がある場合、`UpdateExpression` に `#metadata = :metadata` が含まれる
- [ ] 常に `encryptedApiKey`, `#model`, `updatedAt`, `isActive` は SET 句に含まれる
- [ ] TypeScript のコンパイルが通る
- [ ] 既存の PutCommand パス（新規作成）の動作が変わらない

---

### Task 2: ユニットテストの作成

- **担当**: backend-implementer (または tester)
- **推奨モデル**: Sonnet
- **ファイル**:
  - `backend/tests/unit/credentials-store.test.ts` (新規作成)
- **依存**: Task 1
- **見積もり**: 30 分
- **ステータス**: pending

**詳細**:

`DynamoDBCredentialsStore` のテストを Vitest で作成する。DynamoDB への接続は行わず、`DynamoDBDocumentClient.send` をモックして引数を検証する。

**テストケース**:

```
describe('DynamoDBCredentialsStore')
  describe('saveCredential')
    describe('新規作成 (PutCommand path)')
      it('endpoint/metadata が undefined でも PutCommand を送信できる')
      it('endpoint/metadata に値がある場合も PutCommand を送信できる')

    describe('更新 (UpdateCommand path)')
      it('endpoint と metadata が undefined の場合、UpdateExpression に含めない')
      it('endpoint が指定されている場合、UpdateExpression に endpoint を含める')
      it('metadata が指定されている場合、UpdateExpression に metadata を含める')
      it('endpoint と metadata 両方が指定されている場合、両方を含める')
      it('UpdateExpression の全プレースホルダが ExpressionAttributeValues に存在する')
      it('encryptedApiKey, model, updatedAt, isActive は常に SET 句に含まれる')
```

**モック方針**:
- `@aws-sdk/client-dynamodb` の `DynamoDBClient` をモック
- `@aws-sdk/lib-dynamodb` の `DynamoDBDocumentClient`, `GetCommand`, `PutCommand`, `UpdateCommand` をモック
- `GetCommand` のレスポンスを制御して「既存あり」「既存なし」を切り替え
- `UpdateCommand` の呼び出し引数をキャプチャして `UpdateExpression` と `ExpressionAttributeValues` を検証
- `crypto` モジュールはモック不要（実際に暗号化を実行して問題ない。ただし環境変数 `CREDENTIALS_ENCRYPTION_KEY` が未設定の場合はフォールバックキーが使用される）

**受け入れ条件**:
- [ ] `npx vitest run tests/unit/credentials-store.test.ts` で全テストがパスする
- [ ] Bug #1 の再現テスト（修正前のコードではテストが失敗することを確認可能）
- [ ] カバレッジ: `saveCredential` メソッドの UpdateCommand パスを網羅

---

### Task 3: AIProviderSettings.tsx の password input 属性追加

- **担当**: frontend-implementer
- **推奨モデル**: Sonnet
- **ファイル**:
  - `frontend/app/settings/components/AIProviderSettings.tsx`
- **依存**: なし (Task 1 と並列実行可能)
- **見積もり**: 5 分
- **ステータス**: pending

**詳細**:

Line 264-269 の `<input type="password">` に以下の属性を追加する:

```diff
 <input
   type="password"
+  id="ai-provider-api-key"
+  name="ai-provider-api-key"
+  autoComplete="off"
   value={apiKey}
   onChange={(e) => setApiKey(e.target.value)}
```

**受け入れ条件**:
- [ ] `id="ai-provider-api-key"` が付与されている
- [ ] `name="ai-provider-api-key"` が付与されている
- [ ] `autoComplete="off"` が付与されている
- [ ] `value` と `onChange` は変更されていない
- [ ] TypeScript / ESLint エラーがない
- [ ] ブラウザでの表示・入力動作に変化がない（視覚的には同じ）

---

### Task 4: page.tsx の MCP トークン password input 属性追加

- **担当**: frontend-implementer
- **推奨モデル**: Sonnet
- **ファイル**:
  - `frontend/app/settings/page.tsx`
- **依存**: なし (Task 1 と並列実行可能)
- **見積もり**: 5 分
- **ステータス**: pending

**詳細**:

2 箇所の MCP トークン入力フィールドに属性を追加する。

**箇所 A: MCP 編集トークン (Line 1353-1358)**

```diff
 <input
   type="password"
+  id="mcp-edit-token"
+  name="mcp-edit-token"
+  autoComplete="off"
   value={editServerToken}
   onChange={(e) => setEditServerToken(e.target.value)}
```

**箇所 B: MCP 追加トークン (Line 1499-1504)**

```diff
 <input
   type="password"
+  id="mcp-new-token"
+  name="mcp-new-token"
+  autoComplete="off"
   value={newServerToken}
   onChange={(e) => setNewServerToken(e.target.value)}
```

**変更しない箇所** (厳格に非変更):
- `handleAddServer` 関数
- `handleUpdateServer` 関数
- `handleSaveConfig` 関数
- `saveConfigToBackend` 関数
- `addServer` / `updateServer` / `removeServer` のいずれのロジックも
- MCP サーバー一覧の表示・接続・切断ロジック

**受け入れ条件**:
- [ ] MCP 編集トークン入力に `id="mcp-edit-token"`, `name="mcp-edit-token"`, `autoComplete="off"` が付与されている
- [ ] MCP 追加トークン入力に `id="mcp-new-token"`, `name="mcp-new-token"`, `autoComplete="off"` が付与されている
- [ ] `value` と `onChange` は変更されていない
- [ ] MCP サーバーの追加・編集・保存フローの JS ロジックに一切の変更がない
- [ ] TypeScript / ESLint エラーがない

---

## タスク依存関係

```
Task 1 (Backend: UpdateCommand 修正) -----> Task 2 (テスト作成)
     |                                          |
     |  (並列実行可能)                            |
     v                                          v
Task 3 (Frontend: AI input 属性)           完了確認
     |
     |  (並列実行可能)
     v
Task 4 (Frontend: MCP input 属性)
```

- Task 1 と Task 3 と Task 4 は互いに独立しており並列実行可能
- Task 2 は Task 1 の完了後に実行（修正後のコードに対してテストを書くため）
- Task 3 と Task 4 は同一エージェントが連続実行することを推奨（同じフロントエンドコンテキスト）

---

## 完了の定義 (Definition of Done)

- [ ] Task 1: `backend/src/services/credentials-store.ts` の UpdateCommand が動的 SET 句で構築されている
- [ ] Task 2: `backend/tests/unit/credentials-store.test.ts` が作成され、全テストがパスしている
- [ ] Task 3: `AIProviderSettings.tsx` の API キー input に `id`, `name`, `autoComplete` が付与されている
- [ ] Task 4: `page.tsx` の 2 箇所の MCP トークン input に `id`, `name`, `autoComplete` が付与されている
- [ ] TypeScript コンパイルが通る (`cd backend && npx tsc --noEmit`)
- [ ] Vitest テストが通る (`cd backend && npx vitest run`)
- [ ] MCP サーバー設定フローの JS ロジックに変更がない (git diff で確認)
- [ ] `encrypt()` / `decrypt()` 関数に変更がない
- [ ] DynamoDB テーブルスキーマに変更がない

---

## エージェント調整ノート

### 実装エージェントへの注意事項

1. **backend の修正 (Task 1)**: `saveCredential` メソッドの UpdateCommand ブロック (if 文の中身) のみを変更する。PutCommand ブロック、encrypt/decrypt 関数、DocClient の初期化は触らない。

2. **テスト作成 (Task 2)**: `backend/tests/unit/` ディレクトリに配置する。既存のテストファイル命名規則に従い `credentials-store.test.ts` とする。Vitest を使用する（Jest ではない）。

3. **フロントエンド修正 (Task 3, 4)**: DOM 属性の追加のみ。React コンポーネントの state やコールバック関数は一切変更しない。

4. **Git ブランチ**: `fix/credential-save-overwrite` ブランチで作業することを推奨。

5. **テスト実行コマンド**:
   - バックエンド: `cd /home/ubuntu/Downloads/vow/backend && npx vitest run`
   - フロントエンド: `cd /home/ubuntu/Downloads/vow/frontend && npx next build` (型チェック含む)
