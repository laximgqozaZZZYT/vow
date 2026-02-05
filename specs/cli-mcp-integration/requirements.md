# CLI MCP Integration - 仕様書

## 概要
CLIエンドポイント (`/api/agents/cli/chat`) でもMCP設定を読み取り、MCP経由（Claude Code）で回答生成を行う。

## 背景
- 現在CLIは `VowCoachAgent` (OpenAI gpt-4o) を使用
- WEBUIでは `useMcpAgent` 設定でMCPエージェント経由の回答が可能
- 同じマシンでClaude Code MCPサーバーが稼働している場合、CLIでもMCP経由で回答を得たい

## 要件

### 機能要件

1. **MCP設定の読み取り**
   - DynamoDBの `vow-mcp-connections-*` テーブルからユーザーのMCP設定を取得
   - `chatAgentSettings.useMcpAgent` が `true` の場合、MCP経由で回答生成

2. **MCP経由の回答生成**
   - MCPサーバーの `/agents/{agentId}/chat` エンドポイントを呼び出す
   - sessionIdを維持してマルチターン会話をサポート
   - SSEストリーミングは使用せず、同期レスポンスで返却

3. **フォールバック**
   - MCPサーバーに接続できない場合は既存のVowCoachAgentにフォールバック
   - `chatAgentSettings.fallbackToApi` が `true` の場合のみ

### 非機能要件

1. **タイムアウト**
   - MCPサーバーへのリクエストは30秒でタイムアウト

2. **エラーハンドリング**
   - MCP接続エラー時は適切なエラーメッセージを返却
   - フォールバック時はログに記録

## API設計

### リクエスト（変更なし）
```json
{
  "message": "あなたはClaudeか？",
  "sessionId": "optional-session-id",
  "locale": "ja"
}
```

### レスポンス（変更なし）
```json
{
  "message": "はい、私はClaudeです...",
  "sessionId": "cli_session_xxx",
  "toolCalls": [],
  "suggestions": [],
  "quotaRemaining": 100,
  "provider": "mcp"  // 追加: 使用したプロバイダーを明示
}
```

## 実装詳細

### 修正ファイル
- `backend/src/routers/agents.ts` - CLIエンドポイントの修正

### 処理フロー
1. CLIリクエスト受信
2. ユーザーIDからMCP設定を取得（DynamoDB）
3. `useMcpAgent: true` かつMCPサーバー設定あり？
   - Yes: MCPサーバーに転送
   - No: VowCoachAgentで処理
4. レスポンス返却

## 動作確認

```bash
# テストコマンド
curl -X POST http://localhost:4000/api/agents/cli/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"message": "あなたはClaudeか？"}'
```

期待結果: Claudeからの応答（「はい、私はClaude...」など）
