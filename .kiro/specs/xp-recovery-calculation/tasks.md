# Implementation Plan: XP Recovery Calculation

## Overview

過去の習慣完了履歴から経験値を遡及計算するXPリカバリー機能を実装します。既存のexperienceCalculatorServiceを再利用し、バッチ処理と重複防止機能を備えたサービスを構築します。

## Tasks

- [x] 1. データベースマイグレーション
  - [x] 1.1 job_execution_logテーブルの制約を更新し、'xp_recovery'と'xp_recovery_single'ジョブタイプを追加
    - `supabase/migrations/`に新規マイグレーションファイルを作成
    - _Requirements: 7.1, 7.2_
  - [x] 1.2 experience_logテーブルにactivity_idインデックスを追加
    - 重複チェックの高速化のため
    - _Requirements: 2.1_

- [x] 2. リポジトリレイヤーの実装
  - [x] 2.1 ActivityRepositoryに完了Activity取得メソッドを追加
    - `backend/src/repositories/activityRepository.ts`を作成または拡張
    - `getCompletedActivities(userId, options)`メソッドを実装
    - `countCompletedActivities(userId)`メソッドを実装
    - _Requirements: 1.1_
  - [ ]* 2.2 ActivityRepository用プロパティテスト作成
    - **Property 1: Activity取得の正確性**
    - **Validates: Requirements 1.1**
  - [x] 2.3 ExperienceLogRepositoryに重複チェックメソッドを追加
    - `backend/src/repositories/experienceLogRepository.ts`を作成または拡張
    - `getProcessedActivityIds(userId, activityIds)`メソッドを実装
    - _Requirements: 2.1, 2.2_
  - [x] 2.4 JobExecutionLogRepositoryを作成
    - `backend/src/repositories/jobExecutionLogRepository.ts`を作成
    - `startJob`, `completeJob`, `failJob`メソッドを実装
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 3. XPRecoveryServiceの実装
  - [x] 3.1 XPRecoveryServiceクラスの基本構造を作成
    - `backend/src/services/xpRecoveryService.ts`を作成
    - コンストラクタで依存関係を注入
    - _Requirements: 6.1_
  - [x] 3.2 recalculateForUserメソッドを実装
    - 完了Activity取得
    - 重複チェック
    - 経験値計算（experienceCalculatorService再利用）
    - 結果サマリー返却
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4_
  - [x] 3.3 バッチ処理ロジックを実装
    - 100件単位でのバッチ分割
    - エラー時の継続処理
    - 進捗ログ出力
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [ ]* 3.4 冪等性プロパティテスト作成
    - **Property 2: 冪等性（重複付与防止）**
    - **Validates: Requirements 2.2**
  - [ ]* 3.5 バッチ処理プロパティテスト作成
    - **Property 3: バッチ処理の正確性**
    - **Validates: Requirements 3.1**
  - [ ]* 3.6 エラー耐性プロパティテスト作成
    - **Property 4: エラー耐性（バッチ継続）**
    - **Validates: Requirements 3.2**
  - [ ]* 3.7 結果サマリープロパティテスト作成
    - **Property 5: 結果サマリーの完全性**
    - **Validates: Requirements 2.4, 3.3**
  - [x] 3.8 recalculateForAllUsersメソッドを実装
    - 全ユーザーIDを取得
    - 各ユーザーに対してrecalculateForUserを実行
    - 全体の結果サマリーを返却
    - _Requirements: 4.1_

- [x] 4. Checkpoint - バックエンドサービス確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. APIエンドポイントの実装
  - [x] 5.1 XPリカバリー用ルーターを作成
    - `backend/src/routes/xpRecoveryRoutes.ts`を作成
    - 認証ミドルウェアを適用
    - _Requirements: 4.3_
  - [x] 5.2 POST /api/users/:id/recalculate-xp エンドポイントを実装
    - ユーザー認証チェック（自分自身のみ許可）
    - XPRecoveryService.recalculateForUserを呼び出し
    - 結果をJSON形式で返却
    - _Requirements: 4.2, 4.4, 4.5_
  - [x] 5.3 POST /api/admin/recalculate-xp エンドポイントを実装
    - 管理者権限チェック
    - XPRecoveryService.recalculateForAllUsersを呼び出し
    - 結果をJSON形式で返却
    - _Requirements: 4.1, 4.4, 4.5_
  - [ ]* 5.4 APIエンドポイントのユニットテスト作成
    - 認証テスト
    - 正常系・異常系レスポンステスト
    - _Requirements: 4.3, 4.4, 4.5_
  - [x] 5.5 ルーターをメインアプリに登録
    - `backend/src/app.ts`または`backend/src/routes/index.ts`に追加
    - _Requirements: 4.1, 4.2_

- [x] 6. フロントエンド実装
  - [x] 6.1 設定画面に再計算ボタンを追加
    - `frontend/app/dashboard/components/`に適切なコンポーネントを作成または拡張
    - デザインシステムに従ったボタンスタイル
    - _Requirements: 5.1_
  - [x] 6.2 確認ダイアログコンポーネントを実装
    - 再計算実行前の確認UI
    - 「実行」「キャンセル」ボタン
    - _Requirements: 5.2_
  - [x] 6.3 API呼び出しフックを作成
    - `frontend/hooks/useXPRecovery.ts`を作成
    - POST /api/users/:id/recalculate-xp を呼び出し
    - ローディング状態管理
    - _Requirements: 5.3, 5.4_
  - [x] 6.4 結果表示UIを実装
    - 成功時: 付与されたXP、更新されたレベルを表示
    - エラー時: 日本語エラーメッセージを表示
    - _Requirements: 5.5, 5.6_

- [x] 7. ジョブログ機能の実装
  - [x] 7.1 XPRecoveryServiceにジョブログ記録を統合
    - 処理開始時にstartJob呼び出し
    - 処理完了時にcompleteJob呼び出し
    - エラー時にfailJob呼び出し
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [ ]* 7.2 ジョブログプロパティテスト作成
    - **Property 9: ジョブログのラウンドトリップ**
    - **Validates: Requirements 7.1, 7.2, 7.3**

- [x] 8. Final Checkpoint - 全体確認
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- 既存のexperienceCalculatorServiceの計算ロジック（Property 6, 7, 8）は既にテスト済みのため、統合テストで検証
- フロントエンドはデザインシステム（design-system.md）に従って実装
- デプロイはdeployment.mdの手順に従い、開発環境→本番環境の順で実施
