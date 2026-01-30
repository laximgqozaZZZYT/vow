# Implementation Plan: Level System Rebalancing

## Overview

ユーザーレベル（Expertise Level）と習慣レベル（THLI-24）のインフレーション問題を解決するためのリバランシング実装計画。新しい計算式、移行処理、UI更新を段階的に実装します。

## Tasks

- [x] 1. データベーススキーマとマイグレーション
  - [x] 1.1 level_config テーブルを作成
    - 計算式パラメータを保存するテーブル
    - 初期データ（v2.0設定）を投入
    - _Requirements: 1.7, 11.1_
  
  - [x] 1.2 feature_flags テーブルを作成
    - フィーチャーフラグ管理テーブル
    - 初期フラグ（level_rebalancing_enabled等）を投入
    - _Requirements: 11.2, 11.3_
  
  - [x] 1.3 user_levels_backup テーブルを作成
    - 移行前バックアップ用テーブル
    - _Requirements: 12.1, 12.2_
  
  - [x] 1.4 migration_log テーブルを作成
    - 移行ログ用テーブル
    - _Requirements: 5.4, 12.5_
  
  - [x] 1.5 既存テーブルにカラムを追加
    - user_levels: formula_version, is_migrated, migration_date, pioneer_badge_awarded
    - habits: needs_recalibration, recalibrated_at, old_level_assessment_data
    - _Requirements: 6.1, 6.7_

- [x] 2. バックエンドサービス実装
  - [x] 2.1 LevelConfigService を実装
    - getCurrentConfig(), updateConfig(), getFeatureFlag(), setFeatureFlag()
    - level_config テーブルからの設定読み込み
    - _Requirements: 1.7, 11.1, 11.2_
  
  - [x] 2.2 LevelRebalancingService を実装
    - calculateExpertiseLevel() - 新計算式: min(9999, floor(5 * log2(xp/1000 + 1)))
    - calculateBaseXP() - 新計算式: floor(habit_level * 2) + min(streak, 30)
    - getXPMultiplier() - 新乗数テーブル
    - _Requirements: 1.1, 2.1, 2.2, 3.1-3.6_
  
  - [ ]* 2.3 Property test: Level Calculation Correctness
    - **Property 1: Level Calculation Correctness**
    - **Validates: Requirements 1.1, 1.6**
  
  - [ ]* 2.4 Property test: XP Calculation Correctness
    - **Property 2: XP Calculation Correctness**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
  
  - [ ]* 2.5 Property test: XP Multiplier Correctness
    - **Property 3: XP Multiplier Correctness**
    - **Validates: Requirements 3.1-3.6**

- [x] 3. Checkpoint - 基本計算ロジックの確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. 移行サービス実装
  - [x] 4.1 MigrationService を実装
    - startMigration() - バッチ移行ジョブ
    - migrateUser() - 単一ユーザー移行（圧縮関数適用）
    - rollbackMigration() - ロールバック処理
    - getMigrationStatus() - 移行ステータス取得
    - _Requirements: 5.1, 5.2, 5.3, 12.3_
  
  - [x] 4.2 バックアップ・リストア機能を実装
    - createBackup() - 移行前バックアップ作成
    - restoreFromBackup() - バックアップからリストア
    - _Requirements: 12.1, 12.2, 12.3_
  
  - [ ]* 4.3 Property test: Level Compression Correctness
    - **Property 5: Level Compression Correctness**
    - **Validates: Requirements 5.2, 5.3**

- [x] 5. 既存サービスの更新
  - [x] 5.1 experienceCalculatorService.ts を更新
    - calculateExperiencePoints() - 新計算式を使用
    - calculateExpertiseLevel() - 新計算式を使用
    - フィーチャーフラグによる切り替え対応
    - _Requirements: 1.1, 2.1, 2.2, 2.4, 2.5_
  
  - [x] 5.2 userLevelService.ts を更新
    - calculateTier() - 新ティア境界（advanced: 100-499, expert: 500-9999）
    - clampLevel() - 最大値を9999に変更
    - _Requirements: 1.6_
  
  - [x] 5.3 xpMultiplierService.ts を更新
    - 新乗数テーブルを適用
    - _Requirements: 3.1-3.6_

- [x] 6. レベル減衰サービスの更新
  - [x] 6.1 levelDecayService.ts を更新
    - 猶予期間を21日に変更
    - 減衰率を0.5pt/週に変更
    - 最大減衰を15%に変更
    - 回復ボーナス（1.5x、7日間）を追加
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  
  - [ ]* 6.2 Property test: Level Decay Correctness
    - **Property 6: Level Decay Correctness**
    - **Validates: Requirements 9.1, 9.2, 9.3**
  
  - [ ]* 6.3 Property test: Recovery Bonus Application
    - **Property 7: Recovery Bonus Application**
    - **Validates: Requirements 9.4**

- [x] 7. Checkpoint - バックエンドサービスの確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. APIエンドポイント実装
  - [x] 8.1 GET /api/level-config エンドポイントを追加
    - 現在の計算式設定を返す
    - _Requirements: 10.2_
  
  - [x] 8.2 GET /api/users/:id/migration-status エンドポイントを追加
    - 移行ステータスを返す
    - _Requirements: 10.4_
  
  - [x] 8.3 GET /api/level-simulator エンドポイントを追加
    - レベル進行シミュレーション
    - _Requirements: 7.1, 7.2_
  
  - [ ]* 8.4 Property test: Level Simulation Projections
    - **Property 8: Level Simulation Projections**
    - **Validates: Requirements 7.2**
  
  - [x] 8.5 POST /api/users/:id/recalibrate-habits エンドポイントを追加
    - バッチ習慣再評価
    - _Requirements: 6.5, 10.3_
  
  - [x] 8.6 GET /api/users/:id/level を更新
    - formula_version, is_migrated, migration_date フィールドを追加
    - _Requirements: 10.1_

- [x] 9. THLI-24再評価サービス
  - [x] 9.1 THLIRecalibrationService を実装
    - recalibrateHabit() - 新基準での再評価
    - batchRecalibrate() - バッチ再評価
    - getExpandedScoreSet() - 13段階スコアセット
    - _Requirements: 4.1, 4.2, 6.2, 6.3_
  
  - [ ]* 9.2 Property test: THLI-24 Score Normalization
    - **Property 4: THLI-24 Score Normalization**
    - **Validates: Requirements 4.1, 4.2**

- [x] 10. Checkpoint - APIエンドポイントの確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. フロントエンドUI更新
  - [x] 11.1 Widget.LevelBadge を更新
    - 新ティア色（advanced: bg-warning, expert: bg-destructive with glow）
    - 9999までのレベル表示対応
    - _Requirements: 8.1_
  
  - [x] 11.2 Section.LevelProgress を作成
    - 次のティアまでのプログレスバー
    - 残りXP表示
    - _Requirements: 8.2, 8.3_
  
  - [x] 11.3 Modal.MigrationDetails を作成
    - 移行前後のレベル比較
    - Pioneer Badge表示
    - _Requirements: 5.6_
  
  - [x] 11.4 Section.LevelSimulator を作成
    - シミュレーションパラメータ入力
    - 進行予測チャート
    - プリセットシナリオ
    - _Requirements: 7.3, 7.4, 7.5_
  
  - [x] 11.5 習慣カードに再評価バッジを追加
    - "要再評価" バッジ表示
    - 再評価ボタン
    - _Requirements: 6.2, 8.6_

- [x] 12. 移行通知とバッジ
  - [x] 12.1 移行完了通知を実装
    - 一回限りの通知表示
    - 移行詳細モーダルへのリンク
    - _Requirements: 5.5_
  
  - [x] 12.2 Pioneer Badge を実装
    - バッジデータモデル
    - プロフィールでの表示
    - _Requirements: 5.7_

- [x] 13. Checkpoint - フロントエンドの確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. 移行スクリプトと管理ツール
  - [x] 14.1 移行バッチスクリプトを作成
    - バッチサイズ100ユーザー
    - 1秒間隔
    - エラーハンドリング
    - _Requirements: 5.1, 12.4_
  
  - [x] 14.2 ロールバックスクリプトを作成
    - 個別ユーザーロールバック
    - 全体ロールバック
    - _Requirements: 12.3, 12.7_
  
  - [x] 14.3 移行レポート生成を実装
    - 移行統計
    - エラーサマリー
    - _Requirements: 12.5_

- [x] 15. Final checkpoint - 全体確認
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- フィーチャーフラグを使用して段階的にロールアウト可能
- 移行前に必ずバックアップを作成すること
