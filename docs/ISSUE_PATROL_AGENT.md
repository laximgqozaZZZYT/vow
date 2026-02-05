# Issue巡回・修正エージェント (Issue Patrol Agent)

## 概要

Issue巡回・修正エージェントは、QA巡回エージェントが報告したIssueを定期的に確認し、優先度の高いバグを自動的に修正するClaude Codeベースの自動修正システムです。

## 動作フロー

```
┌─────────────────┐
│  Issue確認      │
│  (Supabase API) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  優先度で       │
│  フィルタリング │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  問題分析       │
│  (cause確認)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  自動修正       │
│  (コード編集)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Issueクローズ  │
│  (resolution)   │
└─────────────────┘
```

## 機能

### 1. Issue確認

Supabase REST APIを使用して未解決Issueを取得：

```bash
curl -s -X GET \
  "https://{supabase_url}/rest/v1/issues?status=eq.open&order=priority.desc,created_at.desc" \
  -H "apikey: {anon_key}" \
  -H "Authorization: Bearer {service_role_key}"
```

### 2. 優先度フィルタリング

| 優先度 | 対応 |
|--------|------|
| critical | 即座に修正 |
| high | 優先的に修正 |
| medium | 状況に応じて修正 |
| low | 合格レポートの場合はクローズのみ |

### 3. 自動修正パターン

#### 共感不足の修正

**問題**: AIコーチがユーザーの感情に共感せずにアドバイスを開始

**修正内容**:
- システムプロンプトに共感必須ルールを追加
- 共感フレーズの例を明示
- 禁止パターンを記載

**対象ファイル**: `backend/src/agents/mastra/vow-coach-agent.ts`

#### キーワード不足の修正

**問題**: 期待するキーワードが回答に含まれない

**修正内容**:
- テストのキーワードパターンを拡張
- AIプロンプトのガイダンスを強化

### 4. Issueクローズ

修正完了後、resolution_notesを記載してIssueをクローズ：

```bash
curl -s -X PATCH \
  "https://{supabase_url}/rest/v1/issues?id=eq.{issue_id}" \
  -H "apikey: {anon_key}" \
  -H "Authorization: Bearer {service_role_key}" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "closed",
    "resolution_notes": "修正内容の説明",
    "resolved_at": "2026-02-03T12:00:00.000Z"
  }'
```

## 実行方法

### Claude Codeで実行

```bash
# Issue巡回エージェントを起動
claude --resume {agent_id}

# または新規起動
claude "Issue巡回・修正を実行してください。
1. Supabaseのissuesテーブルから未解決のIssueを取得
2. 優先度の高いバグを分析
3. 必要に応じてコードを修正
4. 修正完了後、Issueをクローズ"
```

### バックグラウンド実行

```bash
# Taskツールで起動
Task(
  description="Issue巡回・修正エージェント",
  prompt="未解決のIssueを確認し、優先度の高いバグを修正してください",
  subagent_type="general-purpose",
  run_in_background=true
)
```

## 修正履歴の例

### ISS-20260203-086: 共感不足の修正

**問題**: 「疲れました」という感情表現に対して、共感なしにアドバイスを開始

**修正ファイル**:
1. `backend/src/agents/mastra/vow-coach-agent.ts`
   - 感情表現への対応セクションに共感必須ルールを追加
2. `frontend/e2e/qa-patrol.spec.ts`
   - 共感パターン検証を拡張（「お疲れ」「応援」など追加）

**Resolution Notes**:
```
AIコーチのシステムプロンプトに明確な共感表現の必須ルールを追加。
感情表現（疲れ、ストレス、不安など）への応答時に「お疲れ様です」
「大変でしたね」「つらかったですね」などの共感フレーズを必ず使用
するよう指示を強化。
```

## API認証情報

### 環境変数

```bash
export SUPABASE_URL="https://jamiyzsyclvlvstmeeir.supabase.co"
export SUPABASE_ANON_KEY="sb_publishable_..."
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGci..."
```

### 注意事項

- Service Role Keyは管理者権限を持つため、取り扱いに注意
- 本番環境では環境変数またはシークレット管理を使用
- APIキーをコードにハードコードしない

## トラブルシューティング

### よくある問題

1. **認証エラー**
   - Service Role Keyが正しいか確認
   - Keyの有効期限を確認

2. **修正が反映されない**
   - ファイルの保存を確認
   - バックエンドの再起動が必要な場合あり

3. **Issueが更新されない**
   - RLSポリシーを確認
   - Service Role権限を確認

## 関連ドキュメント

- [QA巡回エージェント](./QA_PATROL_AGENT.md)
- [Issue管理API](../backend/src/routers/issues.ts)
