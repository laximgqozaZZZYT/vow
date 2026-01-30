# Implementation Plan: Gamification XP Balance

## Overview

本実装計画は、行動科学に基づく経験値倍率システムとユーザーレベル・習慣レベルの比較ロジックを実装します。既存の `experienceCalculatorService.ts` と `levelManagerService.ts` を拡張し、新しいAPIエンドポイントとUIコンポーネントを追加します。

## Tasks

- [x] 1. データベーススキーマ拡張
  - [x] 1.1 experience_log テーブルに新規カラムを追加するマイグレーションを作成
    - completion_rate, applied_multiplier, multiplier_tier, multiplier_reason カラム追加
    - _Requirements: 6.4_
  - [x] 1.2 habits テーブルにミスマッチ関連カラムを追加
    - mismatch_acknowledged, mismatch_acknowledged_at, original_level_gap カラム追加
    - _Requirements: 3.6_
  - [x] 1.3 level_mismatch_log テーブルを新規作成
    - ミスマッチ検出履歴を記録するテーブル
    - _Requirements: 7.5_

- [x] 2. XP倍率計算サービスの実装
  - [x] 2.1 xpMultiplierService.ts を新規作成
    - calculateXPMultiplier() 関数を実装
    - XPMultiplierResult 型定義
    - getMultiplierRationale() 関数を実装
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_
  - [x] 2.2 XP倍率計算のプロパティテストを作成
    - **Property 1: XP Multiplier Tier Mapping**
    - **Property 2: Completion Rate Calculation**
    - **Validates: Requirements 1.1-1.8**
  - [x] 2.3 experienceCalculatorService.ts を更新してXP倍率を統合
    - awardExperiencePoints() メソッドを更新
    - 新しいフィールドを experience_log に記録
    - _Requirements: 6.4_

- [x] 3. レベルミスマッチ検出の実装
  - [x] 3.1 levelManagerService.ts に detectLevelMismatch() メソッドを追加
    - LevelMismatchResult 型定義
    - MismatchSeverity 分類ロジック
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  - [x] 3.2 レベルミスマッチ検出のプロパティテストを作成
    - **Property 3: Level Mismatch Detection Threshold**
    - **Property 4: Mismatch Severity Classification**
    - **Property 5: Mismatch Result Structure Completeness**
    - **Validates: Requirements 2.2-2.6**
  - [x] 3.3 checkHabitLevelCompatibility() メソッドを追加
    - ミスマッチ検出とベビーステップ提案の統合
    - _Requirements: 3.1, 3.4_

- [x] 4. Checkpoint - コアロジックの検証
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. APIエンドポイントの実装
  - [x] 5.1 GET /api/habits/:id/level-compatibility エンドポイントを追加
    - levelRoutes.ts に新規ルートを追加
    - _Requirements: 2.7_
  - [x] 5.2 POST /api/users/:id/check-habit-compatibility エンドポイントを追加
    - 提案された習慣レベルの互換性チェック
    - _Requirements: 2.8_
  - [x] 5.3 GET /api/habits/:id/workload-level-consistency エンドポイントを追加
    - Workload設定とレベルの整合性チェック
    - _Requirements: 5.5_
  - [x] 5.4 APIエンドポイントの統合テストを作成
    - 各エンドポイントのレスポンス検証
    - _Requirements: 2.7, 2.8, 5.5_

- [x] 6. AIコーチ統合の実装
  - [x] 6.1 check_habit_level_compatibility ツールを COACH_TOOLS に追加
    - aiCoachService.ts を更新
    - _Requirements: 4.4_
  - [x] 6.2 create_habit_suggestion ツールにレベルチェックを統合
    - 習慣提案時に自動でレベル互換性をチェック
    - _Requirements: 4.1, 4.2_
  - [x] 6.3 ミスマッチ検出時のベビーステップ提案フローを実装
    - suggest_baby_steps ツールとの連携
    - _Requirements: 4.5_
  - [x] 6.4 ai_suggestion_history にミスマッチ提案を記録
    - suggestion_type: 'level_mismatch_baby_step' の追加
    - _Requirements: 4.6_
  - [x] 6.5 AIコーチ統合のプロパティテストを作成
    - **Property 7: Experience Log Field Completeness**
    - **Validates: Requirements 4.1, 4.2, 4.5, 4.6**

- [x] 7. Checkpoint - バックエンド実装の検証
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. フロントエンドUIコンポーネントの実装
  - [x] 8.1 XP獲得トースト通知コンポーネントを作成
    - Toast.XPEarned.tsx を新規作成
    - 倍率、達成率、理由の表示
    - カラーコーディング（green/yellow/orange/red）
    - _Requirements: 6.1, 6.2, 6.3_
  - [x] 8.2 レベルミスマッチ警告モーダルを作成
    - Modal.LevelMismatch.tsx を新規作成
    - 3つの選択肢（このまま作成/ベビーステップ提案/キャンセル）
    - _Requirements: 3.2, 3.3_
  - [x] 8.3 ベビーステップ比較ビューを作成
    - Section.BabyStepComparison.tsx を新規作成
    - オリジナル/Lv.50/Lv.10 の比較表示
    - _Requirements: 3.5_
  - [x] 8.4 習慣作成フローにミスマッチチェックを統合
    - Modal.Habit.tsx を更新
    - _Requirements: 3.1, 3.2_

- [x] 9. Workload-Level整合性検証の実装
  - [x] 9.1 validateWorkloadLevelConsistency() メソッドを実装
    - levelManagerService.ts に追加
    - _Requirements: 5.2_
  - [x] 9.2 習慣詳細画面に整合性インジケーターを追加
    - 不整合時の警告表示
    - _Requirements: 5.6_
  - [x] 9.3 Workload-Level整合性のプロパティテストを作成
    - **Property 9: Workload-Level Consistency Detection**
    - **Validates: Requirements 5.3**

- [x] 10. 定期実行ジョブの実装
  - [x] 10.1 レベルミスマッチ検出ジョブを作成
    - scheduledJobs.ts に新規ジョブを追加
    - cron: 0 4 * * * (毎日4時)
    - _Requirements: 7.1_
  - [x] 10.2 ミスマッチ状態変化の通知ロジックを実装
    - 新規ミスマッチ検出時の通知
    - ミスマッチ解消時のメタデータ更新
    - _Requirements: 7.2, 7.3_
  - [x] 10.3 ジョブ実行ログの記録を実装
    - job_execution_log テーブルへの記録
    - _Requirements: 7.5_
  - [x] 10.4 定期実行ジョブのプロパティテストを作成
    - **Property 10: Scheduled Job Mismatch State Transitions**
    - **Validates: Requirements 7.2, 7.3**

- [x] 11. Final Checkpoint - 全体統合テスト
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- 既存の `experienceCalculatorService.ts` と `levelManagerService.ts` を拡張する形で実装
- フロントエンドコンポーネントは design-system.md のルールに従う
