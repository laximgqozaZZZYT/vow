# 🚀 WEBサービス公開チェックリスト

**簡単3ステップでWEBサービスを公開**

## 📋 事前準備（5分）

- [ ] GitHubアカウント準備
- [ ] Supabaseアカウント準備
- [ ] Google Cloud Consoleアカウント準備

---

## 1️⃣ Supabase設定（10分）

### プロジェクト作成
- [ ] https://supabase.com でプロジェクト作成
- [ ] プロジェクト名: `vow-app`
- [ ] リージョン: `Northeast Asia (Tokyo)`
- [ ] データベースパスワード保存

### 重要情報取得
- [ ] Project URL をコピー: `https://____________.supabase.co`
- [ ] anon public key をコピー
- [ ] service_role key をコピー

### データベース設定
- [ ] SQL Editor で以下を実行:
```sql
-- 基本テーブル作成とRLS設定
-- （deployment-guide.md の 2.3 データベース設定を参照）
```

### 認証設定
- [ ] Authentication → Settings で Site URL 設定
- [ ] Google OAuth プロバイダー有効化
- [ ] パスワード保護有効化

---

## 2️⃣ Google OAuth設定（5分）

### Google Cloud Console
- [ ] https://console.cloud.google.com でプロジェクト作成
- [ ] OAuth 2.0 Client ID 作成
- [ ] Authorized JavaScript origins: `https://____________.supabase.co`
- [ ] Authorized redirect URIs: `https://____________.supabase.co/auth/v1/callback`
- [ ] Client ID と Client Secret をコピー

### Supabase OAuth設定
- [ ] Supabase → Authentication → Providers → Google
- [ ] Client ID と Client Secret を設定
- [ ] Save をクリック

---

## 3️⃣ Supabase静的ホスティングデプロイ（5分）

### Next.js設定更新
- [ ] `frontend/next.config.ts` に以下を追加:
```typescript
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  // 既存の設定...
};
```

### Supabase CLI設定
- [ ] `npm install -g supabase` でCLIインストール
- [ ] `supabase login` でログイン
- [ ] `supabase link --project-ref ____________` でプロジェクト接続

### 静的サイトビルド・デプロイ
- [ ] `cd frontend && npm run build`
- [ ] `out/` ディレクトリが生成されることを確認
- [ ] `supabase storage cp -r out/* supabase://website/`
- [ ] Supabase Dashboard → Storage → website → Public設定をON

### アクセス確認
- [ ] `https://____________.supabase.co/storage/v1/object/public/website/index.html` でアクセス確認

---

## ✅ 最終確認（2分）

### 動作テスト
- [ ] 本番URLにアクセス
- [ ] Googleログイン動作確認
- [ ] ダッシュボードでデータ作成・表示確認
- [ ] 異なるアカウントでデータ分離確認

### セキュリティテスト
- [ ] `npm run security-full` 実行
- [ ] 全テスト成功確認

---

## 🎉 公開完了！

**合計所要時間**: 約15-20分

**アクセスURL**:
- Supabase静的ホスティング: `https://____________.supabase.co/storage/v1/object/public/website/index.html`
- カスタムドメイン設定時: `https://vow-app.com`

**コスト**: 無料（無料枠内）

---

## 🆘 トラブル時の対処

**ビルドエラー**:
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

**Static Export問題**:
- `next.config.ts`で`output: 'export'`設定確認
- `images.unoptimized: true`設定確認

**アップロードエラー**:
```bash
supabase logout && supabase login
supabase link --project-ref ____________
```

**認証エラー**:
- Google OAuth設定を再確認
- ブラウザキャッシュクリア

**データが見えない**:
- RLSポリシー設定確認
- ログイン状態確認

---

**詳細手順**: `docs/deployment-guide.md` を参照