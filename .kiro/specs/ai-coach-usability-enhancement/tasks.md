# Implementation Plan: AI Coach Usability Enhancement

## Overview

AIコーチの使用性向上のための実装計画。外部仕様ファイルへの分離、会話品質の向上、ガードレールの最適化を段階的に実装する。

## Tasks

- [ ] 1. 外部仕様ファイルの作成とSpecLoaderの実装
  - [x] 1.1 仕様ファイルディレクトリの作成と初期ファイル作成
    - `backend/specs/ai-coach/` ディレクトリを作成
    - 現在の `aiCoachSpec.ts` から内容を抽出して5つのマークダウンファイルに分離
    - `role.md`, `guardrails.md`, `conversation.md`, `habits.md`, `response-format.md` を作成
    - _Requirements: 1.1, 1.3_

  - [x] 1.2 SpecLoaderクラスの実装
    - `backend/src/services/specLoader.ts` を作成
    - `loadSpecs()` メソッド: 指定ディレクトリから全ファイルを読み込み
    - `buildSystemPrompt()` メソッド: 仕様をシステムプロンプトに変換
    - ファイル欠損時のデフォルト値とログ出力を実装
    - _Requirements: 1.1, 1.2, 1.4_

  - [ ]* 1.3 SpecLoaderのプロパティテスト
    - **Property 1: Spec Loading Round-Trip**
    - **Property 2: Missing Spec File Fallback**
    - **Validates: Requirements 1.1, 1.2, 1.4**

- [ ] 2. AICoachServiceの改善
  - [x] 2.1 SpecLoaderの統合
    - `aiCoachService.ts` を修正してSpecLoaderを使用
    - 埋め込み仕様から外部ファイル読み込みに切り替え
    - 初期化時にSpecLoaderを呼び出し
    - _Requirements: 1.2, 1.5_

  - [x] 2.2 ConversationContextの実装
    - `backend/src/types/conversation.ts` を作成
    - ConversationContext インターフェースを定義
    - セッション内の習慣・ゴール追跡機能を追加
    - リダイレクト回数のカウント機能を追加
    - _Requirements: 6.1, 6.2, 6.5_

  - [ ]* 2.3 コンテキスト認識のプロパティテスト
    - **Property 17: Context Awareness**
    - **Validates: Requirements 6.1, 6.2, 6.5**

- [x] 3. Checkpoint - 基盤実装の確認
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. 会話ガイドラインの改善
  - [x] 4.1 conversation.md の詳細化
    - 挨拶への対応パターンを追加
    - 感情認識のガイドラインを追加
    - 質問制限（最大2つ/ターン）のルールを明記
    - 選択肢提示のフォーマットを定義
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 4.2 EmotionDetectorヘルパーの実装
    - `backend/src/utils/emotionDetector.ts` を作成
    - フラストレーション検出パターンを実装
    - 挨拶検出パターンを実装
    - 曖昧なヘルプリクエスト検出を実装
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 4.3 会話品質のプロパティテスト
    - **Property 4: Greeting Response Quality**
    - **Property 5: Emotional Acknowledgment**
    - **Property 6: Help Options Presentation**
    - **Property 7: Question Limit Per Turn**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

- [ ] 5. ガードレールの最適化
  - [x] 5.1 guardrails.md の改善
    - ウェルネストピックの許可範囲を明確化
    - 付随的な言及の許容ルールを追加
    - リダイレクト回数制限（2回）を明記
    - 丁寧な拒否メッセージのテンプレートを追加
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 5.2 GuardrailCheckerの実装
    - `backend/src/services/guardrailChecker.ts` を作成
    - `isWithinScope()` メソッド: スコープ判定（wellness/borderline/out_of_scope）
    - `needsRedirect()` メソッド: リダイレクト判定とカウント
    - `isHabitSafe()` メソッド: 習慣の安全性チェック
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 5.3 ガードレールのプロパティテスト
    - **Property 8: Wellness Topic Handling**
    - **Property 9: Incidental Mention Tolerance**
    - **Property 10: Gentle Redirection**
    - **Property 11: Redirect Limit and Decline**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

- [x] 6. Checkpoint - 会話品質とガードレールの確認
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. UIコンポーネント活用の強化
  - [x] 7.1 habits.md のツール使用ルール追加
    - 習慣作成意図の検出パターンを追加
    - ツール使用のタイミングルール（2ターン以内）を明記
    - テキストのみの応答を避けるルールを追加
    - 修正・確認時の対応ルールを追加
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 7.2 IntentDetectorヘルパーの実装
    - `backend/src/utils/intentDetector.ts` を作成
    - 習慣作成意図の検出パターンを実装
    - 複数習慣リクエストの検出を実装
    - 修正・確認意図の検出を実装
    - _Requirements: 4.1, 4.2, 4.4, 4.5_

  - [ ]* 7.3 ツール使用のプロパティテスト
    - **Property 12: Tool Usage for Habit Creation**
    - **Property 13: Multiple Suggestions Tool Usage**
    - **Property 14: Suggestion Modification Handling**
    - **Property 15: Confirmation Acknowledgment**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

- [x] 8. 応答フォーマットの改善
  - [x] 8.1 response-format.md の詳細化
    - 文字数制限（簡単な確認: 200文字以下）を明記
    - 箇条書き・番号付きリストのルールを追加
    - 絵文字使用ルール（1-2個/応答）を明記
    - Call-to-Actionのテンプレートを追加
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 8.2 ResponseFormatterヘルパーの実装
    - `backend/src/utils/responseFormatter.ts` を作成
    - 絵文字カウント機能を実装
    - 質問カウント機能を実装
    - 応答長チェック機能を実装
    - _Requirements: 5.1, 5.5_

  - [ ]* 8.3 応答フォーマットのプロパティテスト
    - **Property 16: Response Format Constraints**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

- [x] 9. Checkpoint - ツール使用と応答フォーマットの確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. エラーハンドリングの改善
  - [x] 10.1 エラーハンドリングの実装
    - `aiCoachService.ts` にフォールバック応答を追加
    - ツール失敗時の代替応答を実装
    - 技術的エラーメッセージのサニタイズを実装
    - レート制限時の丁寧なメッセージを実装
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 10.2 エラーハンドリングのプロパティテスト
    - **Property 19: Graceful Error Handling**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**

- [ ] 11. 行動科学知識の活用強化
  - [x] 11.1 habits.md の行動科学セクション強化
    - 習慣スタッキングの提案タイミングを明記
    - 2分ルールの適用条件を追加
    - アイデンティティベースの言語パターンを追加
    - 科学的根拠の引用フォーマットを定義
    - _Requirements: 8.1, 8.2, 8.3, 8.5_

  - [ ]* 11.2 行動科学統合のプロパティテスト
    - **Property 20: Behavioral Science Integration**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.5**

- [x] 12. 参照解決とコンテキスト認識の強化
  - [x] 12.1 ReferenceResolverヘルパーの実装
    - `backend/src/utils/referenceResolver.ts` を作成
    - 「それ」「あれ」「that one」などの参照解決を実装
    - 曖昧な参照の検出と明確化質問の生成を実装
    - _Requirements: 6.3, 6.4_

  - [ ]* 12.2 参照解決のプロパティテスト
    - **Property 18: Reference Resolution**
    - **Validates: Requirements 6.3, 6.4**

- [ ] 13. 統合とaiCoachSpec.tsの更新
  - [x] 13.1 aiCoachSpec.tsの簡素化
    - 埋め込み仕様を削除
    - SpecLoaderを使用するように変更
    - ヘルパー関数を新しいユーティリティに委譲
    - _Requirements: 1.1, 1.2_

  - [x] 13.2 全コンポーネントの統合
    - AICoachServiceに全ヘルパーを統合
    - ConversationContextの管理を実装
    - エンドツーエンドの動作確認
    - _Requirements: All_

- [x] 14. 拡張UIコンポーネントの実装（フロントエンド）
  - [x] 14.1 ChoiceButtonsコンポーネントの作成
    - `frontend/app/dashboard/components/Widget.ChoiceButtons.tsx` を作成
    - 最大5つの選択肢をボタンとして表示
    - アイコン、説明、緊急度インジケーターをサポート
    - クリック時にonSelectコールバックを呼び出し
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 14.2 HabitStatsCardコンポーネントの作成
    - `frontend/app/dashboard/components/Widget.HabitStats.tsx` を作成
    - 達成率、トレンド、ストリーク日数を表示
    - 直近の履歴をミニカレンダーで表示
    - _Requirements: 9.1_

  - [x] 14.3 HabitDetailCardコンポーネントの作成
    - `frontend/app/dashboard/components/Widget.HabitDetail.tsx` を作成
    - 習慣の詳細情報と統計を表示
    - 編集・削除ボタンを含む
    - _Requirements: 9.3_

  - [x] 14.4 WorkloadChartコンポーネントの作成
    - `frontend/app/dashboard/components/Widget.WorkloadChart.tsx` を作成
    - 日/週のワークロードを視覚的に表示
    - 習慣ごとの内訳を円グラフまたは棒グラフで表示
    - _Requirements: 9.6_

  - [x] 14.5 ProgressIndicatorコンポーネントの作成
    - `frontend/app/dashboard/components/Widget.Progress.tsx` を更新
    - 線形・円形の進捗表示をサポート
    - カラーバリエーションを追加
    - _Requirements: 9.5_

  - [x] 14.6 QuickActionButtonsコンポーネントの作成
    - `frontend/app/dashboard/components/Widget.QuickActions.tsx` を作成
    - よく使うアクションをアイコンボタンで表示
    - 水平・グリッドレイアウトをサポート
    - _Requirements: 9.2_

- [x] 15. AIコーチのUIコンポーネント活用（バックエンド）
  - [x] 15.1 UIコンポーネント指示ツールの追加
    - `aiCoachService.ts` に `render_ui_component` ツールを追加
    - AIが適切なUIコンポーネントを選択できるようにする
    - _Requirements: 9.7_

  - [x] 15.2 習慣統計表示ツールの追加
    - `show_habit_stats` ツールを追加
    - 習慣の統計をHabitStatsCardで表示
    - _Requirements: 9.1_

  - [x] 15.3 選択肢ボタン表示ツールの追加
    - `show_choice_buttons` ツールを追加
    - 選択肢をChoiceButtonsで表示
    - _Requirements: 10.1, 10.5_

  - [x] 15.4 ワークロードチャート表示ツールの追加
    - `show_workload_chart` ツールを追加
    - ワークロード分析をWorkloadChartで表示
    - _Requirements: 9.6_

  - [ ]* 15.5 UIコンポーネント活用のプロパティテスト
    - **Property 21: UI Component Usage for Structured Data**
    - **Property 22: Choice Buttons for Options**
    - **Property 23: Choice Button Click Handling**
    - **Validates: Requirements 9.1-9.7, 10.1-10.5**

- [x] 16. Section.Coach.tsxの拡張
  - [x] 16.1 UIコンポーネントレンダリングの実装
    - `Section.Coach.tsx` を更新
    - AI応答の `uiComponents` フィールドを処理
    - 適切なコンポーネントを動的にレンダリング
    - _Requirements: 9.7_

  - [x] 16.2 ChoiceButtonsのクリックハンドリング
    - ボタンクリック時にアクションをユーザーメッセージとして送信
    - 会話フローに統合
    - _Requirements: 10.2_

- [x] 17. Final Checkpoint - 全テスト実行
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- TypeScript + fast-check を使用してプロパティベーステストを実装
