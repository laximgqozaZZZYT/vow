# Amazon CodeCatalyst クラウド開発環境セットアップガイド

このドキュメントでは、習慣管理ダッシュボードアプリケーションのクラウド開発環境をAmazon CodeCatalystを使用して構築する手順を説明します。

## 目次

1. [概要](#概要)
2. [前提条件](#前提条件)
3. [Builder IDの作成](#builder-idの作成)
4. [Spaceの作成](#spaceの作成)
5. [Projectの作成とGitHub連携](#projectの作成とgithub連携)
6. [Dev Environmentの作成](#dev-environmentの作成)
7. [環境変数の設定](#環境変数の設定)
8. [Kiro IDEの使用方法](#kiro-ideの使用方法)
9. [ローカルVS Codeからの接続（オプション）](#ローカルvs-codeからの接続オプション)
10. [無料枠の管理](#無料枠の管理)

---

## 概要

### CodeCatalystとは

Amazon CodeCatalystは、AWSが提供するクラウドベースの統合開発プラットフォームです。以下の特徴があります：

- **Kiro IDE**: ブラウザベースのVS Code互換IDE
- **Dev Environments**: クラウド上の開発環境
- **GitHub連携**: 既存リポジトリとのシームレスな統合
- **無料枠**: 月60時間の開発環境使用が無料

### このセットアップで実現できること

| 機能 | 説明 |
|------|------|
| ブラウザ開発 | PCブラウザからKiro IDEにアクセスして開発 |
| モバイルアクセス | スマートフォンからもコード編集が可能 |
| ローカルVS Code連携 | 慣れたローカル環境からリモート接続 |
| 自動環境構築 | Devfileによる一貫した開発環境 |
| コスト最適化 | 無料枠内での運用が可能 |

### アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                    開発者アクセス                            │
├─────────────────┬─────────────────┬─────────────────────────┤
│   PCブラウザ    │  スマートフォン  │    ローカルVS Code      │
│   (Kiro IDE)    │   (Kiro IDE)    │    (Remote SSH)        │
└────────┬────────┴────────┬────────┴───────────┬─────────────┘
         │                 │                    │
         └─────────────────┼────────────────────┘
                           │ HTTPS
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Amazon CodeCatalyst                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Space: vow-dev-space                                 │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  Project: vow-app                               │  │  │
│  │  │  ┌───────────────────────────────────────────┐  │  │  │
│  │  │  │  Dev Environment                          │  │  │  │
│  │  │  │  - 2-core CPU, 4GB RAM, 16GB Storage     │  │  │  │
│  │  │  │  - Node.js 20 LTS                        │  │  │  │
│  │  │  │  - Next.js Dev Server (:3000)            │  │  │  │
│  │  │  └───────────────────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
    ┌─────────┐      ┌──────────┐      ┌─────────┐
    │ GitHub  │      │ Supabase │      │ Vercel  │
    │ (ソース) │      │ (DB/認証) │      │ (本番)  │
    └─────────┘      └──────────┘      └─────────┘
```

---

## 前提条件

セットアップを開始する前に、以下を準備してください：

- [ ] **メールアドレス**: Builder ID作成用
- [ ] **GitHubアカウント**: リポジトリ連携用
- [ ] **モダンブラウザ**: Chrome, Firefox, Safari, Edge のいずれか
- [ ] **Supabase認証情報**: 環境変数設定用（既存プロジェクトから取得）

---

## Builder IDの作成

AWS Builder IDは、CodeCatalystへのサインインに使用する個人IDです。

### 手順

1. **CodeCatalystにアクセス**
   
   ブラウザで [https://codecatalyst.aws/](https://codecatalyst.aws/) を開きます。

2. **サインアップを開始**
   
   「Sign up」ボタンをクリックします。

   ![Sign up button](https://docs.aws.amazon.com/images/codecatalyst/latest/userguide/images/sign-up-button.png)

3. **メールアドレスを入力**
   
   - 使用するメールアドレスを入力
   - 「Next」をクリック

4. **名前を入力**
   
   - 表示名（Display name）を入力
   - 「Next」をクリック

5. **メール認証**
   
   - 入力したメールアドレスに認証コードが送信されます
   - 認証コードを入力して「Verify」をクリック

6. **パスワード設定**
   
   - 安全なパスワードを設定
   - 「Create Builder ID」をクリック

### 確認

Builder IDの作成が完了すると、CodeCatalystのダッシュボードが表示されます。

> **💡 ヒント**: AWSアカウントとの連携はオプションです。Free Tierのみ使用する場合は連携不要です。

---

## Spaceの作成

Spaceは、CodeCatalystのワークスペースで、プロジェクトのコンテナとなります。

### 手順

1. **Space作成を開始**
   
   CodeCatalystダッシュボードで「Create Space」をクリックします。

2. **Space名を入力**
   
   ```
   Space name: vow-dev-space
   ```
   
   > **📝 命名規則**: 小文字、数字、ハイフンのみ使用可能

3. **Billing設定**
   
   ⚠️ **重要**: 必ず「**Free Tier**」を選択してください。
   
   - Free Tierを選択（クレジットカード不要）
   - 月60時間のDev Environment使用が無料

4. **Spaceを作成**
   
   「Create Space」をクリックして完了します。

### 確認

Space作成後、以下が表示されることを確認：
- Space名: `vow-dev-space`
- Billing: Free Tier

---

## Projectの作成とGitHub連携

### Projectの作成

1. **Project作成を開始**
   
   Space内で「Create Project」をクリックします。

2. **プロジェクトタイプを選択**
   
   「Start from scratch」を選択します。

3. **Project名を入力**
   
   ```
   Project name: vow-app
   ```

4. **Projectを作成**
   
   「Create Project」をクリックします。

### GitHubリポジトリの連携

1. **Source repositoriesに移動**
   
   Project内の「Source repositories」セクションを開きます。

2. **リポジトリをリンク**
   
   「Link repository」をクリックします。

3. **GitHubを選択**
   
   - 「GitHub」を選択
   - GitHubアカウントで認証
   - 必要な権限を許可

4. **リポジトリを選択**
   
   連携したいリポジトリ（vow-appリポジトリ）を選択します。

5. **連携を完了**
   
   「Link」をクリックして連携を完了します。

### 確認

- Source repositoriesにGitHubリポジトリが表示されること
- リポジトリのブランチが確認できること

---

## Dev Environmentの作成

Dev Environmentは、クラウド上の開発環境です。

### 手順

1. **Dev Environments画面に移動**
   
   Project内の「Dev Environments」をクリックします。

2. **Dev Environment作成を開始**
   
   「Create Dev Environment」をクリックします。

3. **IDEを選択**
   
   「**Kiro IDE**」を選択します。
   
   > **💡 ヒント**: VS Codeを選択することも可能ですが、Kiro IDEはブラウザで直接使用できます。

4. **リポジトリを選択**
   
   連携済みのGitHubリポジトリを選択します。

5. **ブランチを選択**
   
   開発に使用するブランチ（通常は `main` または `develop`）を選択します。

6. **Compute設定**
   
   | 設定項目 | 推奨値 |
   |---------|--------|
   | Compute | 2-core, 4GB RAM |
   | Storage | 16GB |
   
   > **⚠️ 注意**: より大きなインスタンスは無料枠を早く消費します。

7. **タイムアウト設定**
   
   ```
   Idle timeout: 15 minutes
   ```
   
   > **💡 コスト最適化**: 15分のアイドルタイムアウトで無駄な稼働を防止します。

8. **Dev Environmentを作成**
   
   「Create」をクリックします。

### 起動確認

- Dev Environmentのプロビジョニングが開始されます（約30秒〜2分）
- ステータスが「Running」になったら準備完了
- 「Open in Kiro IDE」をクリックしてIDEを開きます

---

## 環境変数の設定

### Dev Environment環境変数

Dev Environment内で環境変数を設定します。

1. **Kiro IDEのターミナルを開く**
   
   `Ctrl + `` または メニューから「Terminal」→「New Terminal」

2. **.env.localファイルを作成**
   
   ```bash
   cd frontend
   touch .env.local
   ```

3. **環境変数を設定**
   
   `.env.local` ファイルに以下を記述：
   
   ```bash
   # Supabase接続設定
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   NEXT_PUBLIC_API_URL=https://your-project.supabase.co/rest/v1
   NEXT_PUBLIC_USE_SUPABASE_API=true
   
   # 開発環境設定
   NODE_ENV=development
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```
   
   > **⚠️ セキュリティ**: `.env.local` はGitにコミットしないでください（.gitignoreに含まれています）。

### 環境変数の取得方法

Supabaseの認証情報は以下から取得できます：

1. [Supabase Dashboard](https://supabase.com/dashboard) にログイン
2. プロジェクトを選択
3. 「Settings」→「API」
4. 以下の値をコピー：
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Kiro IDEの使用方法

### 基本操作

| 操作 | ショートカット |
|------|---------------|
| ファイル検索 | `Ctrl + P` |
| コマンドパレット | `Ctrl + Shift + P` |
| ターミナル表示 | `Ctrl + `` |
| ファイル保存 | `Ctrl + S` |
| 検索 | `Ctrl + Shift + F` |

### 開発サーバーの起動

1. **ターミナルを開く**

2. **frontendディレクトリに移動**
   
   ```bash
   cd frontend
   ```

3. **依存関係をインストール**（初回のみ）
   
   ```bash
   npm install
   ```

4. **開発サーバーを起動**
   
   ```bash
   npm run dev
   ```

5. **プレビューにアクセス**
   
   - ポートフォワーディングが自動的に設定されます
   - 表示されるURLをクリックしてプレビューを開きます
   - または「Ports」タブから3000番ポートのURLを確認

### Git操作

Kiro IDEでは、VS Codeと同様のGit操作が可能です：

1. **Source Controlパネルを開く**
   
   左サイドバーの「Source Control」アイコンをクリック

2. **変更をステージング**
   
   変更ファイルの「+」をクリック

3. **コミット**
   
   コミットメッセージを入力して「✓」をクリック

4. **プッシュ**
   
   「...」メニューから「Push」を選択

### モバイルからのアクセス

スマートフォンからもKiro IDEにアクセスできます：

1. スマートフォンのブラウザで [https://codecatalyst.aws/](https://codecatalyst.aws/) を開く
2. Builder IDでサインイン
3. Space → Project → Dev Environments に移動
4. 「Open in Kiro IDE」をタップ

> **💡 ヒント**: モバイルでは主にコードレビューや軽微な修正に適しています。

---

## ローカルVS Codeからの接続（オプション）

ローカルのVS CodeからDev Environmentに接続することも可能です。

### 前提条件

- VS Code がインストールされていること
- 「Remote - SSH」拡張機能がインストールされていること

### 手順

1. **CodeCatalyst拡張機能をインストール**
   
   VS Codeの拡張機能マーケットプレイスで「AWS Toolkit」を検索してインストール

2. **AWS Toolkitでサインイン**
   
   - コマンドパレット（`Ctrl + Shift + P`）を開く
   - 「AWS: Sign in to AWS Builder ID」を選択
   - ブラウザで認証を完了

3. **Dev Environmentに接続**
   
   - AWS Toolkitのサイドバーを開く
   - 「CodeCatalyst」セクションを展開
   - Dev Environmentを右クリック
   - 「Open in VS Code」を選択

### 接続後の操作

接続後は、ローカルVS Codeの全機能が使用可能です：
- 拡張機能
- デバッグ
- ターミナル
- Git操作

---

## 無料枠の管理

### 無料枠の内容

| 項目 | 無料枠 | 超過料金 |
|------|--------|---------|
| Dev Environment時間 | 60時間/月 | $0.018/分 |
| ストレージ | 64GB | $0.08/GB/月 |
| ビルド時間 | 60分/月 | $0.01/分 |

### 使用量の確認

1. CodeCatalystダッシュボードにアクセス
2. Space設定を開く
3. 「Billing」セクションで使用量を確認

### コスト最適化のベストプラクティス

1. **アイドルタイムアウトを設定**
   
   15分のタイムアウトで無駄な稼働を防止

2. **作業終了時にDev Environmentを停止**
   
   ```
   Dev Environments → 対象環境 → Stop
   ```

3. **使用パターンを把握**
   
   | シナリオ | 週間使用時間 | 月間使用時間 | コスト |
   |---------|-------------|-------------|--------|
   | 軽量利用 | 10時間 | 40時間 | **$0** |
   | 標準利用 | 15時間 | 60時間 | **$0** |
   | ヘビー利用 | 20時間 | 80時間 | ~$22 |

4. **不要なDev Environmentを削除**
   
   使用しないDev Environmentは削除してストレージを節約

---

## 次のステップ

セットアップが完了したら、以下を試してみてください：

1. [ ] Kiro IDEでファイルを編集して保存
2. [ ] `npm run dev` で開発サーバーを起動
3. [ ] プレビューURLでアプリケーションを確認
4. [ ] 変更をコミットしてGitHubにプッシュ
5. [ ] スマートフォンからKiro IDEにアクセス

---

## 関連ドキュメント

- [トラブルシューティングガイド](./troubleshooting.md)
- [セットアップガイド（ローカル開発）](./SETUP.md)
- [Amazon CodeCatalyst公式ドキュメント](https://docs.aws.amazon.com/codecatalyst/)

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2024-XX-XX | 初版作成 |
