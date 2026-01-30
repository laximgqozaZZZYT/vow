# Implementation Plan: User Level System

## Overview

ユーザーレベルシステムの実装計画です。習慣/タスクの完了履歴に基づいてユーザーの成長を自動測定・可視化する機能を実装します。

## Tasks

- [x] 1. データベーススキーマの作成
  - [x] 1.1 user_levels テーブルの作成
    - overall_level, overall_tier, habit_continuity_power, resilience_score, total_experience_points カラムを含む
    - _Requirements: 1.1, 1.5_
  - [x] 1.2 user_expertise テーブルの作成
    - domain_code, expertise_level, expertise_tier, experience_points カラムを含む
    - _Requirements: 1.2_
  - [x] 1.3 user_level_history テーブルの作成
    - change_type, old_level, new_level, change_reason, metrics_snapshot カラムを含む
    - _Requirements: 1.3_
  - [x] 1.4 occupation_domains テーブルの作成
    - major_code, middle_code, minor_code, keywords カラムを含む
    - _Requirements: 1.4_
  - [x] 1.5 experience_log テーブルの作成
    - 経験値付与の監査ログ用
    - _Requirements: 13.5_
  - [x] 1.6 habits テーブルに domain_codes カラムを追加
    - _Requirements: 1.6_
  - [x] 1.7 goals テーブルに domain_codes カラムを追加
    - _Requirements: 1.7_

- [x] 2. Checkpoint - スキーマ確認
  - Ensure all migrations run successfully, ask the user if questions arise.

- [x] 3. 職業分類ドメインマスターデータのシード
  - [x] 3.1 JSCO（厚生労働省編職業分類）の小分類データを100件以上シード
    - 大分類 A-K を含む
    - 各ドメインにキーワード配列を設定
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 3.2 ドメインキーワード非空プロパティテスト
    - **Property 2: Domain Keywords Non-Empty**
    - **Validates: Requirements 2.3**

- [x] 4. バックエンドサービス層の実装
  - [x] 4.1 UserLevelService の実装
    - getUserLevel, calculateHabitContinuityPower, calculateResilienceScore, calculateOverallLevel メソッド
    - _Requirements: 4.1, 5.1, 7.1_
  - [x] 4.2 習慣継続力計算のプロパティテスト
    - **Property 7: Habit Continuity Power Formula**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
  - [x] 4.3 レジリエンス計算のプロパティテスト
    - **Property 8: Resilience Score Formula**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
  - [x] 4.4 総合レベル計算のプロパティテスト
    - **Property 11: Overall Level Formula**
    - **Validates: Requirements 7.1, 7.2, 7.3**
  - [x] 4.5 レベルティア計算のプロパティテスト
    - **Property 1: Level Tier Calculation Correctness**
    - **Validates: Requirements 1.5**

- [x] 5. ExperienceCalculatorService の実装
  - [x] 5.1 経験値計算ロジックの実装
    - calculateExperiencePoints, awardExperiencePoints, calculateExpertiseLevel メソッド
    - _Requirements: 6.1, 6.2, 6.3, 6.5_
  - [x] 5.2 経験値計算のプロパティテスト
    - **Property 9: Experience Points Calculation**
    - **Validates: Requirements 6.1, 6.2, 6.3, 16.2**
  - [x] 5.3 専門性レベル計算のプロパティテスト
    - **Property 10: Expertise Level Formula (Logarithmic Scale)**
    - **Validates: Requirements 6.5**
  - [x] 5.4 経験値比例配分のプロパティテスト
    - **Property 6: Proportional Experience Distribution**
    - **Validates: Requirements 3.6, 6.4**
  - [x] 5.5 レベル値クランプのプロパティテスト
    - **Property 12: Level Value Clamping**
    - **Validates: Requirements 7.6**

- [x] 6. DomainMappingService の実装
  - [x] 6.1 AIドメイン提案機能の実装
    - suggestDomains メソッド（OpenAI API使用）
    - _Requirements: 3.1_
  - [x] 6.2 ドメイン検索機能の実装
    - searchDomains, getAllDomains, getDomainByCode メソッド
    - _Requirements: 2.4, 2.5_
  - [x] 6.3 最大3ドメイン提案のプロパティテスト
    - **Property 4: Maximum Domain Suggestions**
    - **Validates: Requirements 3.1**
  - [x] 6.4 ドメイン検索結果のプロパティテスト
    - **Property 3: Domain Search Returns Matching Results**
    - **Validates: Requirements 2.5**

- [x] 7. LevelDecayService の実装
  - [x] 7.1 レベル減衰ロジックの実装
    - calculateDecay, applyDecay メソッド
    - 14日間の猶予期間、週1ポイント減衰、最大20%制限
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  - [x] 7.2 レベル減衰ルールのプロパティテスト
    - **Property 13: Level Decay Rules**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
  - [x] 7.3 継続力/レジリエンス減衰なしのプロパティテスト
    - **Property 14: No Decay on Shared Metrics**
    - **Validates: Requirements 8.5**

- [x] 8. Checkpoint - サービス層確認
  - Ensure all services are implemented and tests pass, ask the user if questions arise.

- [x] 9. 習慣完了時の経験値付与統合
  - [x] 9.1 ActivityService に経験値付与ロジックを統合
    - 習慣完了時に ExperienceCalculatorService を呼び出し
    - _Requirements: 6.6, 13.1_
  - [x] 9.2 デフォルトドメイン割り当ての実装
    - ドメインなし習慣は "000" (General) に経験値付与
    - _Requirements: 3.5, 13.6_
  - [x] 9.3 デフォルトドメイン割り当てのプロパティテスト
    - **Property 5: Default Domain Assignment**
    - **Validates: Requirements 3.5, 13.6**
  - [x] 9.4 レベル履歴記録の実装
    - レベル変更時に user_level_history に記録
    - _Requirements: 6.7, 7.5, 8.6_
  - [x] 9.5 レベル履歴記録のプロパティテスト
    - **Property 15: Level History Recording**
    - **Validates: Requirements 4.6, 6.7, 7.5, 8.6**
  - [x] 9.6 経験値ログ完全性のプロパティテスト
    - **Property 16: Experience Log Completeness**
    - **Validates: Requirements 13.5**
  - [x] 9.7 専門性レベル単調性のプロパティテスト
    - **Property 18: Expertise Level Monotonicity**
    - **Validates: Requirements 16.3**

- [x] 10. API エンドポイントの実装
  - [x] 10.1 GET /api/users/:id/level エンドポイント
    - ユーザーの総合レベル情報を返す
    - _Requirements: 12.1_
  - [x] 10.2 GET /api/users/:id/expertise エンドポイント
    - ユーザーの専門性一覧を返す
    - _Requirements: 12.2_
  - [x] 10.3 GET /api/users/:id/expertise/:domain_code エンドポイント
    - 特定ドメインの詳細を返す
    - _Requirements: 12.3_
  - [x] 10.4 GET /api/users/:id/level-history エンドポイント
    - レベル変更履歴を返す（フィルタ対応）
    - _Requirements: 12.4_
  - [x] 10.5 GET /api/domains エンドポイント
    - 職業分類ドメイン一覧を返す（ページネーション対応）
    - _Requirements: 2.4_
  - [x] 10.6 GET /api/domains/search エンドポイント
    - キーワードでドメインを検索
    - _Requirements: 2.5_
  - [x] 10.7 POST /api/habits/:id/suggest-domains エンドポイント
    - AIによるドメイン提案を返す
    - _Requirements: 3.7_

- [x] 11. Checkpoint - API確認
  - Ensure all API endpoints work correctly, ask the user if questions arise.

- [ ] 12. フロントエンド - 共通コンポーネント
  - [x] 12.1 Widget.LevelBadge コンポーネントの作成
    - レベル数値とティア別カラー表示
    - small/medium/large サイズ対応
    - _Requirements: 9.4_
  - [ ] 12.2 Widget.SkillGauge コンポーネントの作成
    - プログレスバー形式のスキル表示
    - _Requirements: 9.1_

- [ ] 13. フロントエンド - Profile セクション
  - [x] 13.1 useUserLevel フックの作成
    - ユーザーレベルと専門性データの取得
    - _Requirements: 9.1_
  - [ ] 13.2 Section.UserLevel コンポーネントの作成
    - 総合レベルカード、スキルゲージ、専門性ドメイン一覧
    - _Requirements: 9.1, 9.2_
  - [x] 13.3 Settings ページの Profile セクションに統合
    - Section.UserLevel を Profile タブに追加
    - _Requirements: 9.1_

- [ ] 14. フロントエンド - モーダルコンポーネント
  - [ ] 14.1 Modal.ExpertiseList コンポーネントの作成
    - 全専門性ドメインの一覧表示（大分類でグループ化）
    - 検索機能付き
    - _Requirements: 9.3, 10.1, 10.2_
  - [ ] 14.2 Modal.DomainDetails コンポーネントの作成
    - ドメイン詳細（階層、レベル、経験値、関連習慣）
    - _Requirements: 10.4_
  - [ ] 14.3 Modal.LevelHistory コンポーネントの作成
    - レベル変更履歴のタイムライン表示
    - フィルタ機能付き
    - _Requirements: 11.1, 11.2, 11.3_

- [ ] 15. フロントエンド - チャートコンポーネント
  - [ ] 15.1 Chart.ExpertiseRadar コンポーネントの作成
    - Top 5 専門性のレーダーチャート
    - _Requirements: 9.2_

- [ ] 16. Checkpoint - フロントエンド確認
  - Ensure all frontend components render correctly, ask the user if questions arise.

- [ ] 17. 習慣作成/編集時のドメイン選択UI
  - [ ] 17.1 習慣作成モーダルにドメイン選択を追加
    - AI提案表示、手動選択ドロップダウン
    - _Requirements: 3.2, 3.3, 3.4_
  - [ ] 17.2 習慣編集モーダルにドメイン編集を追加
    - 既存ドメインの表示と変更
    - _Requirements: 3.3, 3.4_

- [ ] 18. 経験値獲得通知
  - [ ] 18.1 経験値獲得トースト通知の実装
    - "経験値 +X を獲得しました！" 表示
    - _Requirements: 13.2_
  - [ ] 18.2 レベルアップ通知の実装
    - 専門性レベルアップ時の通知
    - _Requirements: 13.3_
  - [ ] 18.3 総合レベルアップ演出の実装
    - 総合レベルアップ時のセレブレーションモーダル
    - _Requirements: 13.4_

- [ ] 19. 定期計算ジョブの実装
  - [ ] 19.1 日次レベル再計算ジョブの実装
    - habit_continuity_power, resilience_score, overall_level の再計算
    - バッチ処理（100ユーザー/バッチ）
    - _Requirements: 14.1, 14.2_
  - [ ] 19.2 レベル減衰ジョブの実装
    - 14日以上非アクティブなドメインの減衰処理
    - _Requirements: 8.7, 14.5_
  - [ ] 19.3 ジョブ実行ログの実装
    - job_execution_log への記録
    - _Requirements: 14.3_

- [ ] 20. 新規ユーザー初期化
  - [ ] 20.1 ユーザー作成時の初期レベル設定
    - user_levels レコードの自動作成
    - _Requirements: 15.1_
  - [ ] 20.2 既存習慣からの初期計算
    - ゲストからの移行時に既存履歴から計算
    - _Requirements: 15.2_
  - [ ] 20.3 専門性レコード作成タイミングのプロパティテスト
    - **Property 17: Expertise Record Creation Timing**
    - **Validates: Requirements 15.3**

- [ ] 21. Final Checkpoint
  - Ensure all tests pass and the feature works end-to-end, ask the user if questions arise.

## Notes

- All tasks including property tests are required for comprehensive coverage
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (18 properties total)
- Unit tests validate specific examples and edge cases
- TypeScript + fast-check for property-based testing
