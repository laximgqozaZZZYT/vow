# 実装計画: 開発環境の再構築とデプロイフローの整備

## 概要

Terraform Workspaceによる環境分離、GitHub Actionsによるブランチベースデプロイ、およびAmplify開発環境ブランチの設定を実装します。

## タスク

- [x] 1. Terraform S3バックエンドとWorkspace設定
  - [x] 1.1 S3バックエンド用のバケットとDynamoDBテーブルを作成するTerraformファイルを作成
    - `infra/terraform/backend-resources.tf`を作成
    - S3バケット `vow-terraform-state` を定義
    - DynamoDBテーブル `vow-terraform-locks` を定義
    - _Requirements: 1.4, 1.5_
  
  - [x] 1.2 `versions.tf`のバックエンド設定を有効化
    - S3バックエンドのコメントを解除
    - 環境ごとのキープレフィックスを設定
    - _Requirements: 1.1, 1.4_
  
  - [x] 1.3 環境切り替えスクリプトを作成
    - `infra/terraform/scripts/switch-env.sh`を作成
    - workspace選択とtfvars指定を自動化
    - _Requirements: 1.2, 1.3_

- [x] 2. 開発環境用tfvarsの整備
  - [x] 2.1 `terraform.development.tfvars`を更新
    - 開発環境用のLambda S3キーを設定
    - 開発環境用のCORS設定を追加
    - 開発環境用のフロントエンドURLを設定
    - _Requirements: 2.4, 2.5_
  
  - [x] 2.2 `terraform.production.tfvars`を更新
    - 本番環境用の設定を整理
    - シークレット参照をTF_VAR形式に統一
    - _Requirements: 1.3_

- [x] 3. チェックポイント - Terraform設定の検証
  - `terraform validate`と`terraform plan`で設定を検証
  - 問題があればユーザーに確認

- [x] 4. GitHub Actions開発環境デプロイワークフロー
  - [x] 4.1 `deploy-lambda-dev.yml`を作成
    - developブランチトリガーを設定
    - 開発環境用Lambda関数名を設定
    - テスト→ビルド→デプロイのジョブを定義
    - _Requirements: 3.1, 3.3_
  
  - [x] 4.2 既存の`deploy-lambda-prod.yml`を更新
    - mainブランチのみのトリガーを明確化
    - 本番環境用の設定を整理
    - _Requirements: 3.2_
  
  - [x] 4.3 シークレット検証ステップを追加
    - 必須シークレットの存在確認
    - 未設定時のエラー報告
    - _Requirements: 4.4_

- [x] 5. Amplify開発環境ブランチ設定
  - [x] 5.1 `amplify.tf`にdevelopブランチを追加
    - `aws_amplify_branch.develop`リソースを定義
    - 開発環境用の環境変数を設定
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [x] 5.2 Amplify環境変数用のTerraform変数を追加
    - `variables.tf`に開発環境用変数を追加
    - tfvarsファイルに値を設定
    - _Requirements: 6.3, 6.4_

- [x] 6. チェックポイント - GitHub ActionsとAmplify設定の検証
  - ワークフローファイルの構文検証
  - Terraform planで変更内容を確認
  - 問題があればユーザーに確認

- [x] 7. デプロイ検証スクリプト
  - [x] 7.1 ヘルスチェックスクリプトを作成
    - `infra/scripts/health-check.sh`を作成
    - Lambda関数の`/health`エンドポイント呼び出し
    - _Requirements: 3.4, 3.5_
  
  - [x] 7.2 環境設定検証スクリプトを作成
    - `infra/scripts/validate-env.sh`を作成
    - tfvarsと実際のリソース設定の一致を確認
    - _Requirements: 1.2, 1.3_

- [x] 8. ドキュメント更新
  - [x] 8.1 `infra/terraform/README.md`を更新
    - 環境切り替え手順を追加
    - S3バックエンド初期化手順を追加
    - _Requirements: 5.1_
  
  - [x] 8.2 デプロイフロー図を追加
    - 開発→本番のプロモーションフローを説明
    - ロールバック手順を追加
    - _Requirements: 5.1, 5.4_

- [x] 9. 最終チェックポイント
  - すべての設定ファイルを検証
  - ユーザーに最終確認を依頼

## 備考

- タスクは順番に実行し、各チェックポイントで検証を行う
- Terraformの実際の適用（`terraform apply`）はユーザーが手動で実行
- GitHub Secretsの設定はユーザーがGitHub UIで実行
