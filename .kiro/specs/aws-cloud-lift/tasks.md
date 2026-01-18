# 実装計画: AWS開発環境クラウドリフト

## 概要

習慣管理ダッシュボードアプリケーションの開発環境をAWSクラウドにサーバーレスアーキテクチャで構築するための実装タスクです。本番環境（Vercel + Supabase）は現状維持とし、開発環境のみをAWSに構築します。

主な機能：
- AWS Amplify Hostingによるサーバーレスデプロイ（推奨）
- Dockerコンテナ化による環境の一貫性
- AWS CDK（Python）によるインフラのコード化
- GitHub連携による自動デプロイ

## タスク

- [ ] 1. Dockerコンテナ化
  - [ ] 1.1 Dockerfileを作成
    - frontend/Dockerfileを作成
    - Node.js 20 LTSベースイメージ
    - マルチステージビルドで最適化
    - _Requirements: 2.1, 2.2, 2.6_
  
  - [ ] 1.2 .dockerignoreを作成
    - frontend/.dockerignoreを作成
    - node_modules, .next, .gitなどを除外
    - _Requirements: 2.6_
  
  - [ ] 1.3 docker-compose.ymlを作成
    - ルートディレクトリにdocker-compose.ymlを作成
    - ホットリロード対応の開発設定
    - 環境変数の設定
    - _Requirements: 2.4, 2.5, 8.1, 8.2_

- [ ] 2. Next.js設定の調整
  - [ ] 2.1 next.config.tsを更新
    - standalone出力モードを有効化
    - Docker/Amplify対応の設定
    - _Requirements: 2.3_
  
  - [ ] 2.2 amplify.ymlを作成
    - ルートディレクトリにamplify.ymlを作成
    - Next.js SSR用のビルド設定
    - _Requirements: 3.3, 3.4_

- [ ] 3. AWS CDKプロジェクトのセットアップ
  - [ ] 3.1 CDKプロジェクト構造を作成
    - infra/ディレクトリを作成
    - app.py, stack.py, requirements.txt, cdk.jsonを作成
    - _Requirements: 10.1, 10.5_
  
  - [ ] 3.2 CDK依存関係をインストール
    - Python仮想環境を作成
    - aws-cdk-lib, aws-cdk.aws-amplify-alphaをインストール
    - _Requirements: 10.1_

- [ ] 4. Amplify Hostingスタックの実装
  - [ ] 4.1 SSMパラメータストアの設定
    - 環境変数用のSSMパラメータを定義
    - Supabase認証情報の保存先
    - _Requirements: 6.3, 6.4_
  
  - [ ] 4.2 Amplify Appの定義
    - GitHubソースコードプロバイダーの設定
    - Next.js SSR（WEB_COMPUTE）プラットフォーム
    - 環境変数の設定
    - _Requirements: 3.1, 3.2, 3.3, 3.6_
  
  - [ ] 4.3 ブランチ設定
    - developブランチの自動デプロイ設定
    - ビルドトリガーの設定
    - _Requirements: 3.4, 3.5, 7.1_

- [ ] 5. 環境変数の設定
  - [ ] 5.1 .env.exampleを更新
    - 必要な環境変数をドキュメント化
    - 開発環境用の設定例
    - _Requirements: 6.5_
  
  - [ ] 5.2 SSMパラメータを作成（手動）
    - AWS CLIまたはコンソールでパラメータを作成
    - NEXT_PUBLIC_SUPABASE_URL
    - NEXT_PUBLIC_SUPABASE_ANON_KEY
    - _Requirements: 6.1, 6.2, 6.3_

- [ ] 6. ローカル開発環境の動作確認
  - [ ] 6.1 docker-compose起動確認
    - `docker-compose up`でアプリが起動することを確認
    - localhost:3000にアクセス可能なことを確認
    - _Requirements: 8.1, 8.4_
  
  - [ ] 6.2 ホットリロード確認
    - ファイル変更が即座に反映されることを確認
    - _Requirements: 8.1_

- [ ] 7. CDKデプロイ
  - [ ] 7.1 CDK Bootstrap
    - `cdk bootstrap`でAWS環境を準備
    - _Requirements: 10.6_
  
  - [ ] 7.2 CDK Synth
    - `cdk synth`でCloudFormationテンプレートを生成
    - エラーがないことを確認
    - _Requirements: 10.6_
  
  - [ ] 7.3 CDK Deploy
    - `cdk deploy`でAmplify Hostingをデプロイ
    - デプロイが成功することを確認
    - _Requirements: 10.6_

- [ ] 8. Amplify Hosting動作確認
  - [ ] 8.1 GitHub連携確認
    - AmplifyコンソールでGitHub連携を確認
    - developブランチが認識されていることを確認
    - _Requirements: 3.2_
  
  - [ ] 8.2 自動デプロイ確認
    - developブランチにpushして自動ビルドを確認
    - ビルドが成功することを確認
    - _Requirements: 3.4, 7.1_
  
  - [ ] 8.3 アプリケーション動作確認
    - Amplify URLにアクセス
    - Next.js SSRが正常に動作することを確認
    - Supabase接続が正常なことを確認
    - _Requirements: 3.3, 3.5_

- [ ] 9. ドキュメントの更新
  - [ ] 9.1 CLOUD_DEV_SETUP.mdを更新
    - Docker開発環境のセットアップ手順
    - CDKデプロイ手順
    - Amplify Hosting設定手順
    - _Requirements: 11.1, 11.2, 11.3_
  
  - [ ] 9.2 トラブルシューティングを追加
    - よくある問題と解決方法
    - コスト管理のベストプラクティス
    - _Requirements: 11.4, 11.5_

- [ ]* 10. App Runnerオプション（オプション）
  - [ ]* 10.1 ECRリポジトリの追加
    - CDKスタックにECRリポジトリを追加
    - ライフサイクルポリシーの設定
    - _Requirements: 4.1, 5.1, 5.3_
  
  - [ ]* 10.2 App Runnerサービスの追加
    - CDKスタックにApp Runnerを追加
    - ECRからのデプロイ設定
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  
  - [ ]* 10.3 GitHub Actions CI/CDの作成
    - .github/workflows/deploy-apprunner.ymlを作成
    - OIDC認証の設定
    - _Requirements: 7.2, 7.4_

- [ ] 11. 最終チェックポイント
  - docker-compose upでローカル開発が動作することを確認
  - cdk deployでAmplify Hostingがデプロイされることを確認
  - developブランチへのpushで自動デプロイが動作することを確認
  - Amplify URLでアプリケーションが正常に動作することを確認
  - 環境変数が正しく設定されていることを確認

## 備考

- `*` マークのタスクはオプションで、App Runnerが必要な場合のみ実装
- 各タスクは特定の要件にトレースされています
- 本番環境（Vercel + Supabase）は変更しません
- AWS CDKはPythonを使用（snake_case、L2コンストラクト優先）

## 前提条件

- AWSアカウント（Free Tier利用可能）
- GitHubアカウント（リポジトリアクセス用）
- Docker Desktop（ローカル開発用）
- Python 3.9以上（CDK用）
- Node.js 20 LTS（開発用）

## 想定所要時間

| 作業 | 所要時間 |
|------|---------|
| Dockerコンテナ化 | 約30分 |
| Next.js設定調整 | 約15分 |
| CDKプロジェクトセットアップ | 約20分 |
| Amplifyスタック実装 | 約45分 |
| 環境変数設定 | 約15分 |
| ローカル動作確認 | 約15分 |
| CDKデプロイ | 約20分 |
| Amplify動作確認 | 約20分 |
| ドキュメント更新 | 約30分 |
| **合計** | **約3.5時間** |
