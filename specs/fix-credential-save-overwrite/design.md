# AI API キー保存処理の修正 -- 設計仕様

## 概要

**ステータス**: ready
**作成日**: 2026-02-06
**作成者**: vow-spec-architect
**対応 Bug**: #1 (UpdateCommand ValidationException), #2 (パスワードフィールド識別不能)

---

## 修正 1: UpdateCommand の動的構築

### ファイル

`backend/src/services/credentials-store.ts`

### 修正方針

`UpdateExpression` と `ExpressionAttributeValues` を固定文字列で組み立てるのではなく、`undefined` でないフィールドだけを動的に含める。これにより `removeUndefinedValues: true` の設定と `UpdateExpression` の参照が常に一致する。

`removeUndefinedValues: true` の設定自体は変更しない。`PutCommand`（新規作成パス）で `undefined` 値の自動除去に依存しているためである。

### 修正前コード (Line 383-402)

```typescript
if (existingResult.Item) {
  // Update existing credential
  await this.docClient.send(
    new UpdateCommand({
      TableName: this.tableName,
      Key: { userId, credentialType: type },
      UpdateExpression: 'SET encryptedApiKey = :encryptedApiKey, #model = :model, endpoint = :endpoint, updatedAt = :updatedAt, isActive = :isActive, metadata = :metadata',
      ExpressionAttributeNames: {
        '#model': 'model',
      },
      ExpressionAttributeValues: {
        ':encryptedApiKey': encryptedApiKey,
        ':model': input.model,
        ':endpoint': input.endpoint,
        ':updatedAt': now,
        ':isActive': true,
        ':metadata': input.metadata,
      },
    })
  );
}
```

### 修正後コード

```typescript
if (existingResult.Item) {
  // Update existing credential
  // Build UpdateExpression dynamically to avoid referencing
  // undefined values that removeUndefinedValues would strip
  // from ExpressionAttributeValues.
  const setClauses: string[] = [
    'encryptedApiKey = :encryptedApiKey',
    '#model = :model',
    'updatedAt = :updatedAt',
    'isActive = :isActive',
  ];
  const exprAttrValues: Record<string, unknown> = {
    ':encryptedApiKey': encryptedApiKey,
    ':model': input.model,
    ':updatedAt': now,
    ':isActive': true,
  };
  const exprAttrNames: Record<string, string> = {
    '#model': 'model',
  };

  if (input.endpoint !== undefined) {
    setClauses.push('endpoint = :endpoint');
    exprAttrValues[':endpoint'] = input.endpoint;
  }

  if (input.metadata !== undefined) {
    setClauses.push('#metadata = :metadata');
    exprAttrValues[':metadata'] = input.metadata;
    exprAttrNames['#metadata'] = 'metadata';
  }

  await this.docClient.send(
    new UpdateCommand({
      TableName: this.tableName,
      Key: { userId, credentialType: type },
      UpdateExpression: `SET ${setClauses.join(', ')}`,
      ExpressionAttributeNames: exprAttrNames,
      ExpressionAttributeValues: exprAttrValues,
    })
  );
}
```

### 設計判断の根拠

1. **動的構築を選んだ理由**: `removeUndefinedValues` の設定を `false` に変更する方法もあるが、`PutCommand`（新規作成パス、Line 404-422）が `removeUndefinedValues: true` に依存して `undefined` のオプショナルフィールドを除外している。設定を変えると `PutCommand` 側で `undefined` を明示的にフィルタリングする追加作業が必要になり、影響範囲が広がる。

2. **`model` は常に含める理由**: `model` フィールドはフロントエンドから常に送信される（`AI_PROVIDERS[activeProvider].defaultModel` がフォールバック値として使われる）。`undefined` になるケースは通常ないが、万が一 `undefined` の場合でも `removeUndefinedValues` で除去された上で `UpdateExpression` 側では予約語として `#model` を使用しているため、同様の問題が起きる。しかし現状のフロントエンド実装では `model` は常に値を持つため、`model` は常に SET に含めて問題ない。

3. **`metadata` に `#metadata` を使う理由**: `metadata` は DynamoDB の予約語ではないが、将来の互換性のため `ExpressionAttributeNames` を使用する。これにより予約語の衝突を防ぐ。ただし、現在の実装で `endpoint` も `model`（予約語）と同様に直接使用しているため、既存のスタイルに合わせて `endpoint` はそのまま直接参照する。`metadata` のみ `ExpressionAttributeNames` を使用する理由は、`metadata` が条件付きで追加されるフィールドであり、`exprAttrNames` オブジェクトに動的に追加する明確なパターンを示すためである。

---

## 修正 2: AIProviderSettings.tsx の password input 属性追加

### ファイル

`frontend/app/settings/components/AIProviderSettings.tsx`

### 修正前コード (Line 264-269)

```tsx
<input
  type="password"
  value={apiKey}
  onChange={(e) => setApiKey(e.target.value)}
  placeholder={providerCredentials[activeProvider]?.exists ? '新しいキーで上書き' : 'APIキーを入力'}
  className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
/>
```

### 修正後コード

```tsx
<input
  type="password"
  id="ai-provider-api-key"
  name="ai-provider-api-key"
  autoComplete="off"
  value={apiKey}
  onChange={(e) => setApiKey(e.target.value)}
  placeholder={providerCredentials[activeProvider]?.exists ? '新しいキーで上書き' : 'APIキーを入力'}
  className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
/>
```

### 変更点

- `id="ai-provider-api-key"` -- フィールドの一意識別子
- `name="ai-provider-api-key"` -- フォーム送信名（ブラウザのパスワードマネージャーが識別に使用）
- `autoComplete="off"` -- ブラウザの自動補完を無効化

---

## 修正 3: page.tsx の MCP トークン password input 属性追加

### ファイル

`frontend/app/settings/page.tsx`

### 修正箇所 A: MCP 編集トークン (Line 1353-1358)

#### 修正前

```tsx
<input
  type="password"
  value={editServerToken}
  onChange={(e) => setEditServerToken(e.target.value)}
  placeholder="新しいトークンを入力..."
  className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
/>
```

#### 修正後

```tsx
<input
  type="password"
  id="mcp-edit-token"
  name="mcp-edit-token"
  autoComplete="off"
  value={editServerToken}
  onChange={(e) => setEditServerToken(e.target.value)}
  placeholder="新しいトークンを入力..."
  className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
/>
```

### 修正箇所 B: MCP 追加トークン (Line 1499-1504)

#### 修正前

```tsx
<input
  type="password"
  value={newServerToken}
  onChange={(e) => setNewServerToken(e.target.value)}
  placeholder="サーバー認証トークン"
  className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
/>
```

#### 修正後

```tsx
<input
  type="password"
  id="mcp-new-token"
  name="mcp-new-token"
  autoComplete="off"
  value={newServerToken}
  onChange={(e) => setNewServerToken(e.target.value)}
  placeholder="サーバー認証トークン"
  className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
/>
```

### MCP 機能への非影響の確認

追加する `id`, `name`, `autoComplete` 属性は HTML の表示・入力属性であり、React の `value` や `onChange` には影響しない。MCP サーバーの追加・編集・保存ロジック（`handleAddServer`, `handleUpdateServer`, `handleSaveConfig` 等の関数）は `editServerToken` / `newServerToken` の state 値を直接参照しており、これらの DOM 属性は参照しない。従って MCP 機能に対する副作用はゼロである。

---

## 修正 4: ユニットテストの追加

### ファイル

`backend/tests/unit/credentials-store.test.ts` (新規作成)

### テストフレームワーク

Vitest (プロジェクト既存設定に準拠)

### テスト対象

`DynamoDBCredentialsStore.saveCredential()` メソッドの UpdateCommand パスを中心にテストする。DynamoDB への実際の接続は行わず、`DynamoDBDocumentClient.send` をモックする。

### テストケース設計

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// テストケース一覧:
// 1. 新規作成（PutCommand パス）: endpoint/metadata が undefined でも成功
// 2. 更新（UpdateCommand パス）: endpoint/metadata が undefined でも成功
// 3. 更新（UpdateCommand パス）: endpoint が指定されている場合、UpdateExpression に含まれる
// 4. 更新（UpdateCommand パス）: metadata が指定されている場合、UpdateExpression に含まれる
// 5. 更新（UpdateCommand パス）: endpoint と metadata 両方が指定されている場合
// 6. 更新（UpdateCommand パス）: UpdateExpression に endpoint/metadata が含まれないとき、
//    ExpressionAttributeValues にも :endpoint/:metadata が含まれないこと
```

### テスト実装方針

```typescript
// DynamoDBDocumentClient.send をモック化
// - GetCommand: 既存レコードの有無を制御
// - UpdateCommand: 呼び出し引数をキャプチャして検証
// - PutCommand: 呼び出し引数をキャプチャして検証

// 検証ポイント:
// a) UpdateCommand の UpdateExpression に endpoint/metadata が含まれる/含まれないことを確認
// b) ExpressionAttributeValues のキーが UpdateExpression と一致することを確認
// c) 例外が発生しないことを確認
```

### モック構造

```typescript
vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@aws-sdk/lib-dynamodb', () => {
  const mockSend = vi.fn();
  return {
    DynamoDBDocumentClient: {
      from: vi.fn().mockReturnValue({ send: mockSend }),
    },
    GetCommand: vi.fn().mockImplementation((input) => ({ __type: 'GetCommand', input })),
    PutCommand: vi.fn().mockImplementation((input) => ({ __type: 'PutCommand', input })),
    UpdateCommand: vi.fn().mockImplementation((input) => ({ __type: 'UpdateCommand', input })),
  };
});
```

---

## データフロー図

```
[フロントエンド]                           [バックエンド]                        [DynamoDB]
     |                                        |                                   |
     |  POST /api/credentials/openai          |                                   |
     |  { apiKey, model }                     |                                   |
     |--------------------------------------->|                                   |
     |                                        |                                   |
     |                                        |  encrypt(apiKey)                  |
     |                                        |  GetCommand (exists check)        |
     |                                        |---------------------------------->|
     |                                        |<----------------------------------|
     |                                        |                                   |
     |                                        |  [既存あり]                        |
     |                                        |  UpdateCommand                    |
     |                                        |  (動的 SET clause:                 |
     |                                        |   endpoint/metadata は             |
     |                                        |   undefined なら省略)             |
     |                                        |---------------------------------->|
     |                                        |                  OK               |
     |                                        |<----------------------------------|
     |                                        |                                   |
     |  { success: true, maskedKey }          |                                   |
     |<---------------------------------------|                                   |
```

---

## リスク評価

| リスク | 影響度 | 発生確率 | 対策 |
|--------|--------|----------|------|
| 動的 SET clause の構築ミスで空の UpdateExpression になる | 高 | 低 | `encryptedApiKey`, `#model`, `updatedAt`, `isActive` の 4 フィールドは常に含むため空にならない |
| `model` が undefined で渡されるケース | 中 | 低 | フロントエンドで `defaultModel` がフォールバックされるため通常は発生しない。万が一の場合も `removeUndefinedValues` で除去されるが、SET clause には含まれるため同じ問題が起きうる。ただし現在の呼び出し元は常に model を設定するため許容する |
| MCP サーバー機能への影響 | 高 | なし | DOM 属性の追加のみで JS ロジックは変更しない |
| autoComplete="off" がブラウザに無視される | 低 | 中 | Chrome 等は autoComplete="off" を無視する場合があるが、`name` と `id` による区別が有効に機能する |
