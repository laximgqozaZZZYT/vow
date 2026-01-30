# 要件定義書

## はじめに

本ドキュメントは、開発環境の再構築とデプロイフローの整備に関する要件を定義します。現在、AWS上の本番環境へ直接デプロイする状況となっており、開発環境での検証を経てから本番環境へデプロイするフローを実現することが目的です。

## 用語集

- **Development_Environment**: 開発・検証用のAWS環境（developブランチに対応）
- **Production_Environment**: 本番用のAWS環境（mainブランチに対応）
- **Deploy_Pipeline**: GitHub Actionsによる自動デプロイワークフロー
- **Terraform_Workspace**: Terraformの環境分離機能
- **Lambda_Function**: AWSのサーバーレス関数サービス
- **API_Gateway**: AWS API Gateway（Lambda関数のHTTPエンドポイント）
- **Amplify_App**: AWSのフロントエンドホスティングサービス
- **S3_Backend**: TerraformのステートファイルをS3に保存する機能
- **GitHub_Secrets**: GitHub Actionsで使用するシークレット管理機能

## 要件

### 要件 1: Terraform環境分離

**ユーザーストーリー:** インフラ管理者として、開発環境と本番環境のTerraformリソースを分離管理したい。これにより、開発環境の変更が本番環境に影響を与えないようにする。

#### 受け入れ基準

1. WHEN Terraformを実行する THEN THE Terraform_Workspace SHALL 環境ごとに独立したステートファイルを管理する
2. WHEN 開発環境用のTerraformを適用する THEN THE Development_Environment SHALL `terraform.development.tfvars`の設定値を使用する
3. WHEN 本番環境用のTerraformを適用する THEN THE Production_Environment SHALL `terraform.production.tfvars`の設定値を使用する
4. WHEN S3バックエンドを設定する THEN THE Terraform_Workspace SHALL 環境ごとに異なるステートファイルパスを使用する
5. WHEN DynamoDBロックテーブルを設定する THEN THE Terraform_Workspace SHALL 同時実行による競合を防止する

### 要件 2: 開発環境AWSリソース構築

**ユーザーストーリー:** 開発者として、本番環境と同等の構成を持つ開発環境を使用したい。これにより、本番デプロイ前に十分な検証ができる。

#### 受け入れ基準

1. WHEN 開発環境をデプロイする THEN THE Lambda_Function SHALL `vow-development-api`という名前で作成される
2. WHEN 開発環境をデプロイする THEN THE API_Gateway SHALL 開発環境専用のエンドポイントを提供する
3. WHEN 開発環境をデプロイする THEN THE Amplify_App SHALL developブランチに対応したフロントエンドをホストする
4. WHEN 開発環境の環境変数を設定する THEN THE Lambda_Function SHALL 開発環境用のSupabase URLとAPIキーを使用する
5. WHEN 開発環境のCORS設定を行う THEN THE API_Gateway SHALL 開発環境のフロントエンドURLを許可する

### 要件 3: GitHub Actionsデプロイフロー

**ユーザーストーリー:** 開発者として、ブランチに応じて適切な環境へ自動デプロイしたい。これにより、手動デプロイの手間とミスを削減する。

#### 受け入れ基準

1. WHEN developブランチにプッシュする THEN THE Deploy_Pipeline SHALL 開発環境へ自動デプロイする
2. WHEN mainブランチにプッシュする THEN THE Deploy_Pipeline SHALL 本番環境へ自動デプロイする
3. WHEN プルリクエストを作成する THEN THE Deploy_Pipeline SHALL テストのみを実行しデプロイは行わない
4. WHEN デプロイが失敗する THEN THE Deploy_Pipeline SHALL エラー通知を送信する
5. WHEN デプロイが成功する THEN THE Deploy_Pipeline SHALL デプロイ完了通知を送信する

### 要件 4: シークレット管理

**ユーザーストーリー:** インフラ管理者として、環境ごとのシークレットを安全に管理したい。これにより、機密情報の漏洩リスクを最小化する。

#### 受け入れ基準

1. WHEN GitHub Actionsを実行する THEN THE GitHub_Secrets SHALL 環境ごとに異なるシークレットを提供する
2. WHEN 開発環境用シークレットを設定する THEN THE GitHub_Secrets SHALL `_DEV`サフィックス付きの変数名を使用する
3. WHEN 本番環境用シークレットを設定する THEN THE GitHub_Secrets SHALL `_PROD`サフィックス付きの変数名を使用する
4. IF シークレットが未設定の場合 THEN THE Deploy_Pipeline SHALL デプロイを中止しエラーを報告する
5. WHEN Terraformを実行する THEN THE Terraform_Workspace SHALL AWS Secrets Managerから機密情報を取得する

### 要件 5: プロモーションフロー

**ユーザーストーリー:** 開発者として、開発環境で検証済みのコードを本番環境へ安全にプロモートしたい。これにより、本番環境の安定性を確保する。

#### 受け入れ基準

1. WHEN 開発環境での検証が完了する THEN THE Deploy_Pipeline SHALL developからmainへのプルリクエスト作成を促す
2. WHEN mainブランチへマージする THEN THE Deploy_Pipeline SHALL 本番環境へのデプロイを自動実行する
3. WHEN 本番デプロイ前にテストを実行する THEN THE Deploy_Pipeline SHALL すべてのテストが成功した場合のみデプロイを続行する
4. IF 本番デプロイが失敗する THEN THE Deploy_Pipeline SHALL 前バージョンへのロールバック手順を提供する
5. WHEN ロールバックを実行する THEN THE Lambda_Function SHALL 指定されたバージョンに戻る

### 要件 6: Amplify開発環境ブランチ

**ユーザーストーリー:** フロントエンド開発者として、developブランチのフロントエンドを開発環境で確認したい。これにより、本番デプロイ前にUIの検証ができる。

#### 受け入れ基準

1. WHEN Amplifyアプリを設定する THEN THE Amplify_App SHALL developブランチを開発環境として設定する
2. WHEN developブランチにプッシュする THEN THE Amplify_App SHALL 開発環境用のURLでフロントエンドをデプロイする
3. WHEN 開発環境のフロントエンドを設定する THEN THE Amplify_App SHALL 開発環境用のバックエンドAPIエンドポイントを使用する
4. WHEN 開発環境のフロントエンドを設定する THEN THE Amplify_App SHALL 開発環境用のSupabase設定を使用する
5. WHEN mainブランチにプッシュする THEN THE Amplify_App SHALL 本番環境用のURLでフロントエンドをデプロイする
