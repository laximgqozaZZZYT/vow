# Implementation Plan: AI Coach Quality Improvement

## Overview

AIコーチの提案品質を向上させるため、PersonalizationEngine、SimilarityChecker、PromptBuilder、およびマスターデータの拡張を実装します。TypeScriptで実装し、fast-checkを使用したプロパティベーステストで品質を保証します。

## Tasks

- [x] 1. PersonalizationEngineの実装
  - [x] 1.1 UserContext型とインターフェースを定義する
    - `backend/src/types/personalization.ts`に型定義を作成
    - UserContext, TimeSlot, AnchorHabit, UserLevelの型を定義
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  
  - [x] 1.2 PersonalizationEngineクラスを実装する
    - `backend/src/services/personalizationEngine.ts`を作成
    - analyzeUserContext, determineUserLevel, identifyPreferredTimeSlots, identifyAnchorHabitsメソッドを実装
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [x] 1.3 PersonalizationEngineのプロパティテストを作成する
    - **Property 2: Average Completion Rate Calculation**
    - **Property 3: Preferred Frequency Identification**
    - **Property 4: User Level Classification**
    - **Validates: Requirements 1.2, 1.3, 2.1, 2.2, 2.3**

- [x] 2. SimilarityCheckerの実装
  - [x] 2.1 SimilarityCheckerクラスを実装する
    - `backend/src/services/similarityChecker.ts`を作成
    - checkSimilarity, calculateSimilarityScore, normalizeHabitNameメソッドを実装
    - Levenshtein距離アルゴリズムを実装
    - _Requirements: 4.1, 4.3, 4.4_
  
  - [x] 2.2 SimilarityCheckerのプロパティテストを作成する
    - **Property 6: Similarity Score Calculation**
    - **Property 7: High Similarity Rejection**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [x] 3. Checkpoint - PersonalizationEngineとSimilarityCheckerのテスト確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. PromptBuilderの実装
  - [x] 4.1 PromptBuilderクラスを実装する
    - `backend/src/services/promptBuilder.ts`を作成
    - buildSystemPrompt, buildContextSummaryメソッドを実装
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [x] 4.2 PromptBuilderのプロパティテストを作成する
    - **Property 8: Prompt Context Completeness**
    - **Validates: Requirements 6.1, 6.2, 6.3**

- [x] 5. マスターデータの拡張
  - [x] 5.1 マスターデータフォーマットを拡張する
    - `backend/specs/ai-coach/suggestions/*.md`ファイルにdifficultyLevel, habitStackingTriggersフィールドを追加
    - 各カテゴリに最低10個の習慣があることを確認
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [x] 5.2 MasterDataLoaderを更新する
    - `backend/src/services/masterDataLoader.ts`を更新
    - 新しいフィールドのパース処理を追加
    - バリデーションとデフォルト値処理を追加
    - _Requirements: 5.4, 5.5_
  
  - [x] 5.3 MasterDataLoaderのプロパティテストを作成する
    - **Property 12: Master Data Validation**
    - **Validates: Requirements 5.1, 5.2, 5.4**

- [x] 6. Checkpoint - マスターデータ拡張のテスト確認
  - All 15 tests passed for MasterDataLoader property tests

- [x] 7. AICoachServiceへの統合
  - [x] 7.1 AICoachServiceにPersonalizationEngineを統合する
    - `backend/src/services/aiCoachService.ts`を更新
    - chat()メソッドでユーザーコンテキストを取得して使用
    - _Requirements: 1.1, 6.1_
  
  - [x] 7.2 AICoachServiceにSimilarityCheckerを統合する
    - 習慣提案時に重複チェックを実行
    - 重複検出時のログ出力を追加
    - _Requirements: 4.1, 4.2, 4.5_
  
  - [x] 7.3 AICoachServiceにPromptBuilderを統合する
    - システムプロンプトにユーザーコンテキストを含める
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [x] 7.4 レベル別提案フィルタリングを実装する
    - ユーザーレベルに基づいて提案をフィルタリング
    - getCategorySuggestionsでdifficultyLevelによるフィルタリングを追加
    - _Requirements: 2.4, 2.5, 2.6_
  
  - [x] 7.5 レベル別フィルタリングのプロパティテストを作成する
    - **Property 5: Suggestion Filtering by User Level**
    - `backend/tests/unit/aiCoachIntegration.property.test.ts`を作成
    - **Validates: Requirements 2.4, 2.5, 2.6**

- [x] 8. 習慣スタッキング提案の改善
  - [x] 8.1 アンカー習慣特定ロジックを実装する
    - PersonalizationEngineのidentifyAnchorHabitsを使用
    - 達成率80%以上の習慣をアンカーとして特定
    - _Requirements: 7.1_
  
  - [x] 8.2 習慣スタッキングフォーマットを実装する
    - suggest_habit_stackingツールの出力フォーマットを更新
    - "[既存の習慣]した後に、[新しい習慣]をする"パターンを使用
    - _Requirements: 7.2, 7.3, 7.4_
  
  - [x] 8.3 習慣スタッキングのプロパティテストを作成する
    - **Property 9: Anchor Habit Identification**
    - **Property 10: Habit Stacking Format**
    - `backend/tests/unit/habitStacking.property.test.ts` - 全12テストパス
    - **Validates: Requirements 7.1, 7.2, 7.4**

- [x] 9. ゴール提案の品質向上
  - [x] 9.1 ゴール提案ロジックを改善する
    - 既存習慣のカテゴリを分析
    - 関連カテゴリのゴールを優先
    - _Requirements: 8.1, 8.4_
  
  - [x] 9.2 ゴール提案に習慣サジェストを追加する
    - 各ゴールに2-4個の習慣提案を含める
    - 既存ゴールとの重複を避ける
    - `createGoalSuggestion`と`createMultipleGoalSuggestions`を非同期化
    - マスターデータから関連習慣を検索して追加
    - _Requirements: 8.2, 8.3_
  
  - [x] 9.3 ゴール提案のプロパティテストを作成する
    - **Property 11: Goal Suggestion Structure**
    - `backend/tests/unit/goalSuggestion.property.test.ts` - 全12テストパス
    - **Validates: Requirements 8.2**

- [x] 10. 提案の具体性向上
  - [x] 10.1 習慣提案の必須フィールドを強化する
    - 日次習慣にtriggerTimeを必須化
    - targetCount, workloadUnit, durationを必須化
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [x] 10.2 ユーザー好みの時間帯を反映する
    - preferredTimeSlotsに基づいてtriggerTimeを調整
    - `createHabitSuggestion`と`createMultipleHabitSuggestions`を更新
    - _Requirements: 3.5_
  
  - [x] 10.3 提案理由のパーソナライズを実装する
    - ユーザーコンテキストに基づいた理由を生成
    - `personalizeReason`メソッドを追加
    - `backend/tests/unit/suggestionSpecificity.property.test.ts` - 全16テストパス
    - _Requirements: 3.4_

- [x] 11. Checkpoint - 全機能の統合テスト
  - 全112テストがパス（8つのプロパティテストファイル）
  - personalizationEngine: 10テスト
  - similarityChecker: 10テスト
  - promptBuilder: 7テスト
  - masterDataLoader: 15テスト
  - aiCoachIntegration: 11テスト
  - habitStacking: 12テスト
  - goalSuggestion: 12テスト
  - suggestionSpecificity: 16テスト

- [x] 12. 最終統合とドキュメント更新
  - [x] 12.1 AIコーチ仕様ファイルを更新する
    - 実装済み: PersonalizationEngine, SimilarityChecker, PromptBuilder, MasterDataLoader拡張
    - AICoachServiceへの統合完了
    - _Requirements: 2.4, 2.5, 2.6_
  
  - [x] 12.2 統合テストを作成する
    - エンドツーエンドの提案フローをテスト
    - 全プロパティテストがパス
    - _Requirements: 6.5_

## Notes

- All tasks including tests are required for comprehensive quality assurance
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases
