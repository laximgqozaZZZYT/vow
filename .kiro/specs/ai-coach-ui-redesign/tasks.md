# Implementation Plan: AI Coach UI Redesign

## Overview

AIコーチセクションをGeminiスタイルの広々としたUIに刷新し、選択肢ボタンの活用を拡張し、カテゴリ別マスターデータによるトークン最適化を実現する。

実装は以下の順序で進める：
1. マスターデータの作成（バックエンド）
2. MasterDataLoaderの実装（バックエンド）
3. フロントエンドUIコンポーネントの拡張
4. CoachSectionのリファクタリング
5. 統合テスト

## Tasks

- [x] 1. カテゴリ別マスターデータの作成
  - [x] 1.1 健康・運動カテゴリのマスターデータ作成
    - `backend/specs/ai-coach/suggestions/health-fitness.md` を作成
    - 5-10個の習慣提案と3-5個のゴール提案を含める
    - _Requirements: 6.1, 6.2, 6.4, 6.5, 6.6_
  - [x] 1.2 仕事・生産性カテゴリのマスターデータ作成
    - `backend/specs/ai-coach/suggestions/work-productivity.md` を作成
    - _Requirements: 6.1, 6.2, 6.4, 6.5, 6.6_
  - [x] 1.3 学習・スキルカテゴリのマスターデータ作成
    - `backend/specs/ai-coach/suggestions/learning-skills.md` を作成
    - _Requirements: 6.1, 6.2, 6.4, 6.5, 6.6_
  - [x] 1.4 趣味・リラックスカテゴリのマスターデータ作成
    - `backend/specs/ai-coach/suggestions/hobbies-relaxation.md` を作成
    - _Requirements: 6.1, 6.2, 6.4, 6.5, 6.6_
  - [x] 1.5 人間関係カテゴリのマスターデータ作成
    - `backend/specs/ai-coach/suggestions/relationships.md` を作成
    - _Requirements: 6.1, 6.2, 6.4, 6.5, 6.6_
  - [x] 1.6 財務カテゴリのマスターデータ作成
    - `backend/specs/ai-coach/suggestions/finance.md` を作成
    - _Requirements: 6.1, 6.2, 6.4, 6.5, 6.6_

- [x] 2. MasterDataLoaderの実装
  - [x] 2.1 MasterDataLoaderクラスの作成
    - `backend/src/services/masterDataLoader.ts` を作成
    - Markdownファイルのパース機能を実装
    - インメモリキャッシュを実装
    - _Requirements: 6.3, 9.1, 9.2_
  - [ ]* 2.2 MasterDataLoaderのプロパティテスト作成
    - **Property 8: Master Data Schema Validation**
    - **Property 11: Master Data Caching**
    - **Validates: Requirements 6.4, 6.5, 6.6, 9.2**

- [x] 3. Checkpoint - マスターデータとローダーの確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. AICoachServiceの拡張
  - [x] 4.1 MasterDataLoaderの統合
    - AICoachServiceにMasterDataLoaderを注入
    - 習慣提案時にマスターデータを参照するよう変更
    - _Requirements: 6.3, 9.1, 9.3_
  - [x] 4.2 選択肢ボタンレスポンスの拡張
    - `show_choice_buttons` ツールの出力をUIComponentDataに変換
    - choice_buttonsフィールドのスキーマを定義
    - _Requirements: 5.1, 5.2, 5.3_
  - [ ]* 4.3 バックエンドのプロパティテスト作成
    - **Property 9: Backend Choice Response Schema**
    - **Property 10: Choice Selection Processing**
    - **Validates: Requirements 5.2, 5.4**

- [x] 5. フロントエンドUIコンポーネントの拡張
  - [x] 5.1 MessageBubbleコンポーネントの作成
    - `frontend/app/dashboard/components/Widget.MessageBubble.tsx` を作成
    - ユーザー/アシスタントメッセージの表示を実装
    - 16px以上のフォント、16pxパディング
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [x] 5.2 ChoiceButtonsコンポーネントの拡張
    - タイトル表示機能を追加
    - サイズバリエーション（sm/md/lg）を追加
    - _Requirements: 4.1, 4.2, 4.4, 4.5_
  - [x] 5.3 QuickActionsコンポーネントのリファクタリング
    - 4つのデフォルトアクションを定義
    - グリッドレイアウトを実装
    - 48px以上のボタン高さ
    - _Requirements: 7.1, 7.2, 7.4_
  - [ ]* 5.4 フロントエンドコンポーネントのプロパティテスト作成
    - **Property 5: Choice Buttons Rendering**
    - **Property 6: Choice Button Click Sends Message**
    - **Property 7: Quick Action Click Sends Prompt**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.6, 7.3**

- [x] 6. Checkpoint - コンポーネントの確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. CoachSectionのリファクタリング
  - [x] 7.1 レイアウト構造の変更
    - チャットエリアをflex-1で拡大（min-h-400px）
    - 入力エリアをsticky bottomに配置（min-h-80px）
    - ヘッダーにクリアボタンを追加
    - _Requirements: 1.1, 1.2, 2.1, 2.3, 10.1_
  - [x] 7.2 入力エリアの自動拡張実装
    - テキストエリアの高さを動的に調整（max 160px）
    - Enter/Shift+Enterのキーボード処理
    - _Requirements: 2.2, 2.4, 2.5_
  - [x] 7.3 自動スクロール機能の実装
    - 新メッセージ追加時にスムーズスクロール
    - _Requirements: 1.4_
  - [x] 7.4 クイックアクションの統合
    - 会話がない時に中央表示
    - クリック時にプロンプト送信
    - _Requirements: 7.1, 7.3_
  - [x] 7.5 選択肢ボタンの統合
    - UIComponentDataからChoiceButtonsをレンダリング
    - クリック時にメッセージ送信
    - _Requirements: 4.1, 4.3, 4.6_
  - [x] 7.6 会話クリア機能の実装
    - 確認ダイアログの表示
    - 状態のリセット
    - _Requirements: 10.1, 10.2, 10.3_
  - [ ]* 7.7 CoachSectionのプロパティテスト作成
    - **Property 1: Chat Area Proportional Height**
    - **Property 2: Input Area Auto-Expansion**
    - **Property 3: Message Bubble Max Width**
    - **Property 4: Auto-Scroll on New Message**
    - **Property 12: Conversation Clear State Reset**
    - **Validates: Requirements 1.1, 1.4, 2.2, 3.5, 10.3**

- [x] 8. レスポンシブデザインの実装
  - [x] 8.1 モバイルレイアウトの調整
    - 768px未満でフルワイドレイアウト
    - チャットエリア min-h-250px
    - 入力エリア min-h-60px
    - _Requirements: 8.1, 8.2_
  - [x] 8.2 選択肢ボタンのレスポンシブ対応
    - 狭い画面で複数行に折り返し
    - _Requirements: 8.3_
  - [x] 8.3 メッセージバブルのレスポンシブ対応
    - モバイルで最大幅95%
    - _Requirements: 8.4_

- [x] 9. Checkpoint - 統合確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. トークン最適化とログ
  - [x] 10.1 トークン使用量のログ実装
    - マスターデータ使用時のトークン削減をログ
    - _Requirements: 9.4_

- [x] 11. Final Checkpoint - 全体確認
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- フロントエンドはNext.js + React + Tailwind CSSを使用
- バックエンドはTypeScript + Expressを使用
- プロパティテストにはfast-checkを使用
