# 🔧 トラブルシューティングガイド

デプロイ時およびクラウド開発環境でよくある問題と解決方法

## 目次

- [CodeCatalyst Dev Environment](#-codecatalyst-dev-environment)
- [デプロイ・ビルド関連](#-よくある問題と解決方法)
- [Supabase認証エラー](#2-supabase認証エラー)
- [データベース接続エラー](#3-データベース接続エラー)
- [ビルドエラー](#4-ビルドエラー)
- [OAuth認証エラー](#5-oauth認証エラー)
- [環境変数エラー](#6-環境変数エラー)
- [デバッグ方法](#-デバッグ方法)
- [高度なトラブルシューティング](#️-高度なトラブルシューティング)
- [サポートリソース](#-サポートリソース)
- [緊急時対応](#-緊急時対応)

---

## ☁️ CodeCatalyst Dev Environment

Amazon CodeCatalystのDev Environment使用時によくある問題と解決方法です。

### Dev Environment起動エラー

| エラー種別 | 原因 | 対処方法 |
|-----------|------|---------|
| Provisioning Failed | リソース不足 | 時間をおいて再試行（5-10分後） |
| Devfile Error | 設定ファイル不正 | devfile.yamlの構文を確認 |
| Repository Clone Failed | Git認証エラー | GitHub連携を再設定 |
| Timeout | プロビジョニング時間超過 | 再度Dev Environmentを作成 |

#### Provisioning Failed の詳細対処

```bash
# 1. Dev Environmentを削除して再作成
# CodeCatalyst Console → Dev Environments → Delete

# 2. 別のCompute設定を試す
# 2-core, 4GB RAM → 4-core, 8GB RAM（無料枠消費が早くなる点に注意）

# 3. リージョンの混雑を避ける
# 時間帯を変えて再試行（日本時間の深夜帯が比較的空いている）
```

#### Devfile Error の詳細対処

```yaml
# devfile.yaml の構文チェックポイント

# ❌ よくある間違い
schemaVersion: 2.2.0  # バージョン番号は文字列で
metadata:
  name: my-project
  version: 1.0.0      # バージョン番号は文字列で

# ✅ 正しい形式
schemaVersion: "2.2.0"
metadata:
  name: my-project
  version: "1.0.0"
```

```bash
# devfile.yaml の検証
# https://devfile.io/docs/2.2.0/devfile-schema で構文チェック可能
```

#### Repository Clone Failed の詳細対処

1. **GitHub連携の再設定**:
   - CodeCatalyst Console → Project → Source repositories
   - 「Unlink」で連携解除
   - 「Link repository」で再連携
   - GitHubで権限を再承認

2. **リポジトリアクセス権限の確認**:
   - GitHubでリポジトリの Settings → Collaborators を確認
   - CodeCatalystアプリに適切な権限があるか確認

### 接続エラー

| エラー種別 | 原因 | 対処方法 |
|-----------|------|---------|
| Session Timeout | アイドルタイムアウト | Dev Environmentを再起動 |
| Connection Lost | ネットワーク問題 | ブラウザをリロード |
| IDE Not Loading | ブラウザキャッシュ | キャッシュクリア後に再アクセス |
| WebSocket Error | プロキシ/ファイアウォール | ネットワーク設定を確認 |

#### Session Timeout の詳細対処

```bash
# Dev Environmentの再起動手順
# 1. CodeCatalyst Console → Dev Environments
# 2. 対象のDev Environmentを選択
# 3. 「Start」をクリック
# 4. ステータスが「Running」になるまで待機（約30秒〜2分）
# 5. 「Open in Kiro IDE」をクリック
```

#### Connection Lost の詳細対処

1. **ブラウザのリロード**: `Ctrl + Shift + R`（ハードリロード）
2. **別のブラウザで試す**: Chrome, Firefox, Edge など
3. **シークレットモードで試す**: 拡張機能の干渉を排除
4. **VPN/プロキシを無効化**: 企業ネットワークの場合

### 開発サーバーエラー

| エラー種別 | 原因 | 対処方法 |
|-----------|------|---------|
| Port Already in Use | 前回のプロセスが残存 | プロセスを終了して再起動 |
| Module Not Found | 依存関係未インストール | `npm install` を実行 |
| Preview Not Loading | ポートフォワーディング問題 | Portsタブで確認・再設定 |
| HMR Not Working | WebSocket接続問題 | 開発サーバーを再起動 |

#### Port Already in Use の詳細対処

```bash
# 使用中のポートを確認
lsof -i :3000

# プロセスを終了
kill -9 <PID>

# または、すべてのnodeプロセスを終了
pkill -f node

# 開発サーバーを再起動
cd frontend
npm run dev
```

#### Preview Not Loading の詳細対処

1. **Portsタブを確認**:
   - Kiro IDE下部の「Ports」タブをクリック
   - 3000番ポートが表示されているか確認
   - 「Visibility」が「Public」になっているか確認

2. **手動でポートフォワーディング**:
   - 「Ports」タブで「Add Port」をクリック
   - ポート番号「3000」を入力
   - 「Public」を選択

3. **URLを直接開く**:
   - Portsタブに表示されるURLをコピー
   - 新しいブラウザタブで開く

### Git操作エラー

| エラー種別 | 原因 | 対処方法 |
|-----------|------|---------|
| Permission Denied | 認証情報の問題 | Git認証を再設定 |
| Push Rejected | リモートに新しいコミットあり | `git pull` してから `git push` |
| Merge Conflict | コンフリクト発生 | 手動でコンフリクトを解決 |

#### Permission Denied の詳細対処

```bash
# Git認証情報の確認
git config --list | grep credential

# GitHub認証の再設定（CodeCatalyst内）
# 通常はCodeCatalystが自動で認証を管理するため、
# GitHub連携を再設定することで解決

# 手動でトークンを設定する場合
git config --global credential.helper store
# その後、push時にGitHubのPersonal Access Tokenを入力
```

### 無料枠の管理

#### 使用量の確認方法

1. **CodeCatalyst Console**にアクセス
2. **Space設定**を開く
3. **「Billing」セクション**で使用量を確認

#### 無料枠超過を防ぐベストプラクティス

| 対策 | 説明 | 効果 |
|------|------|------|
| アイドルタイムアウト設定 | 15分に設定 | 無駄な稼働を防止 |
| 作業終了時に停止 | 手動でDev Environmentを停止 | 確実に稼働を止める |
| 週末は停止 | 使用しない時間帯は停止状態を維持 | 大幅な節約 |
| 使用量アラート | 50%到達時に確認 | 超過前に対策可能 |

#### 使用量の目安

| シナリオ | 週間使用時間 | 月間使用時間 | コスト |
|---------|-------------|-------------|--------|
| 軽量利用 | 10時間 | 40時間 | **$0（無料枠内）** |
| 標準利用 | 15時間 | 60時間 | **$0（無料枠内）** |
| ヘビー利用 | 20時間 | 80時間 | ~$22（超過20時間分） |

#### 超過料金が発生した場合

```bash
# 超過料金の計算
# Dev Environment: $0.018/分 = $1.08/時間

# 例: 80時間使用した場合
# 無料枠: 60時間
# 超過: 20時間
# 超過料金: 20時間 × $1.08 = $21.60
```

### ローカルVS Code接続エラー

| エラー種別 | 原因 | 対処方法 |
|-----------|------|---------|
| Connection Refused | Dev Environmentが停止中 | Dev Environmentを起動 |
| Extension Not Found | AWS Toolkit未インストール | 拡張機能をインストール |
| Authentication Failed | Builder IDセッション切れ | 再サインイン |

#### AWS Toolkit設定手順

```bash
# 1. VS Code拡張機能をインストール
# 拡張機能マーケットプレイスで「AWS Toolkit」を検索

# 2. Builder IDでサインイン
# コマンドパレット（Ctrl + Shift + P）
# 「AWS: Sign in to AWS Builder ID」を選択

# 3. Dev Environmentに接続
# AWS Toolkitサイドバー → CodeCatalyst → Dev Environment → 右クリック → Open in VS Code
```

---

## 🚨 よくある問題と解決方法

### よくある問題と解決方法

**1. ビルドエラー**
```bash
# 依存関係の再インストール
cd frontend
rm -rf node_modules package-lock.json
npm install

# Next.js Static Export用ビルド
npm run build
```

**2. 認証エラー**
- Supabase OAuth設定を再確認
- Google Cloud Console のRedirect URIを確認
- ブラウザキャッシュをクリア

**3. データが表示されない**
- RLSポリシーが正しく設定されているか確認
- ユーザーがログインしているか確認
- ブラウザの開発者ツールでエラーを確認

---

### 2. Supabase認証エラー

#### 症状
```
Invalid JWT: signature verification failed
AuthError: Invalid JWT signature
```

#### 原因
- `SUPABASE_JWKS_URL` のプロジェクトIDが間違っている
- Supabase環境変数が正しく設定されていない

#### 解決方法
1. **Supabase情報再確認**:
   ```bash
   # Supabase Dashboard → Settings → API
   Project URL: https://abcdefghijklmnop.supabase.co
   
   # Railway環境変数
   SUPABASE_JWKS_URL=https://abcdefghijklmnop.supabase.co/.well-known/jwks.json
   SUPABASE_JWT_AUD=authenticated
   SUPABASE_JWT_ISS=https://abcdefghijklmnop.supabase.co/auth/v1
   ```

2. **JWKS URL動作確認**:
   ```bash
   curl https://abcdefghijklmnop.supabase.co/.well-known/jwks.json
   # 正常な場合、JSON形式の公開鍵情報が返される
   ```

3. **フロントエンド環境変数確認**:
   ```bash
   # Supabase統合版設定
   NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

---

### 3. データベース接続エラー

#### 症状
```
Can't reach database server
Error: P1001: Can't reach database server
```

#### 原因
- Supabaseデータベースサービスが起動していない
- `DATABASE_URL` が正しく設定されていない

#### 解決方法
1. **Supabaseサービス確認**:
   - Supabase Dashboard → Settings → Database
   - Status が "Healthy" になっているか確認

2. **DATABASE_URL確認**:
   ```bash
   # Supabase Dashboard → Settings → Database
   # Connection string が正しく設定されているか確認
   ```

3. **接続テスト**:
   ```bash
   # Supabase Dashboard → SQL Editor
   # SQLクエリを実行してデータベースが応答するか確認
   SELECT 1;
   ```

---

### 4. ビルドエラー

#### 症状
```
Module not found: Can't resolve 'module-name'
Build failed with exit code 1
```

#### 原因
- 依存関係が正しくインストールされていない
- package.json の設定に問題がある

#### 解決方法

**Supabase統合版**:
1. **依存関係確認**:
   ```bash
   # frontend/package.json の dependencies を確認
   ```

2. **キャッシュクリア**:
   - GitHub Actions でキャッシュクリア
   - 再デプロイ

3. **ローカルビルドテスト**:
   ```bash
   cd frontend
   npm run build
   # ローカルでビルドが成功するか確認
   ```

---

### 5. OAuth認証エラー

#### 症状
```
OAuth error: redirect_uri_mismatch
Invalid redirect URI
```

#### 原因
- Google Cloud ConsoleのRedirect URIが正しく設定されていない
- SupabaseのSite URLが間違っている

#### 解決方法
1. **Google Cloud Console設定確認**:
   ```bash
   # Authorized redirect URIs に以下を設定
   https://abcdefghijklmnop.supabase.co/auth/v1/callback
   ```

2. **Supabase設定確認**:
   ```bash
   # Authentication → Settings
   Site URL: https://jamiyzsyclvlvstmeeir.supabase.co
   Additional Redirect URLs:
     https://jamiyzsyclvlvstmeeir.supabase.co/dashboard
     https://jamiyzsyclvlvstmeeir.supabase.co/login
   ```

3. **OAuth フロー確認**:
   - ブラウザ開発者ツールのNetworkタブでOAuthリクエストを確認
   - redirect_uri パラメータが正しいか確認

---

### 6. 環境変数エラー

#### 症状
```
Environment variable NEXT_PUBLIC_SUPABASE_URL is not defined
Missing required environment variables
```

#### 原因
- 環境変数が正しく設定されていない
- 環境変数名にタイポがある

#### 解決方法
1. **Supabase環境変数確認**:
   ```bash
   # Settings → Environment Variables で以下を確認
   NODE_ENV=production
   NEXT_PUBLIC_SUPABASE_URL=https://...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

3. **環境変数名確認**:
   - `NEXT_PUBLIC_` プレフィックスが正しいか確認
   - スペルミスがないか確認

---

## 🔍 デバッグ方法

### GitHub Actions ログ確認

1. **デプロイログ**:
   - GitHub → Actions タブ
   - 最新ワークフローをクリック → ログ確認
   - ビルドエラーやデプロイエラーを確認

2. **Supabase ログ確認**:
   - Supabase Dashboard → Logs
   - リアルタイムログを確認

### ローカルデバッグ

1. **フロントエンドテスト**:
   ```bash
   cd frontend
   npm run dev
   # http://localhost:3000 でアクセス
   ```

2. **セキュリティテスト**:
   ```bash
   npm run security-full
   ```

---

## 🛠️ 高度なトラブルシューティング

### データベースマイグレーション問題

#### 症状
```
Migration failed: Table already exists
Schema drift detected
```

#### 解決方法
1. **マイグレーション状態確認**:
   ```bash
   # Supabase Dashboard → SQL Editor
   SELECT * FROM _prisma_migrations;
   ```

2. **手動マイグレーション**:
   ```bash
   # ローカルで実行
   cd backend
   DATABASE_URL="postgresql://..." npx prisma migrate deploy
   ```

3. **スキーマリセット**（注意：データが削除される）:
   ```bash
   # Supabase Dashboard → SQL Editor
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   ```

### パフォーマンス問題

#### 症状
- ページ読み込みが遅い
- APIレスポンスが遅い

#### 解決方法
1. **Supabase メトリクス確認**:
   - リソース使用率が高い場合：プランアップグレード検討
   - データベース負荷が高い場合：クエリ最適化

2. **パフォーマンス分析**:
   - Core Web Vitals を確認
   - 遅いページを特定

3. **データベース最適化**:
   ```sql
   -- インデックス追加
   CREATE INDEX idx_user_id ON goals(owner_id);
   CREATE INDEX idx_created_at ON diary_cards(created_at);
   ```

### セキュリティ問題

#### 症状
- セキュリティテストが失敗する
- 不正なアクセスが検出される

#### 解決方法
1. **セキュリティテスト詳細確認**:
   ```bash
   npm run security-test
   npm run penetration-test
   ```

2. **ログ監視**:
   - 異常なアクセスパターンを確認
   - レート制限の動作を確認

3. **セキュリティ設定見直し**:
   - CORS設定の厳格化
   - JWT有効期限の短縮
   - レート制限の強化

---

## 📞 サポートリソース

### 公式サポート
- **GitHub**: https://support.github.com
- **Supabase**: https://supabase.com/support
- **Amazon CodeCatalyst**: https://aws.amazon.com/codecatalyst/

### コミュニティ
- **Supabase Discord**: https://discord.supabase.com
- **AWS re:Post**: https://repost.aws/tags/TAVwIhLzReRouKddnUmQ_phA/amazon-codecatalyst

### ドキュメント
- **GitHub Docs**: https://docs.github.com
- **Supabase Docs**: https://supabase.com/docs
- **Next.js Docs**: https://nextjs.org/docs
- **CodeCatalyst Docs**: https://docs.aws.amazon.com/codecatalyst/
- **Devfile Docs**: https://devfile.io/docs/

---

## 🆘 緊急時対応

### サービス停止時
1. **ステータス確認**:
   - GitHub Status: https://www.githubstatus.com
   - Supabase Status: https://status.supabase.com

2. **一時的な回避策**:
   - ローカル環境での動作確認
   - 別のデプロイ環境への切り替え

3. **ユーザー通知**:
   - メンテナンス情報の掲示
   - 復旧予定時刻の案内

### データ損失時
1. **バックアップ確認**:
   - Supabase自動バックアップ
   - 手動エクスポートデータ

2. **復旧手順**:
   - バックアップからの復元
   - データ整合性の確認

---

**最終更新**: 2026年1月6日  
**対象バージョン**: v2.0.0 - Supabase統合版