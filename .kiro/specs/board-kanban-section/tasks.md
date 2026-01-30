# Implementation Plan: Board Kanban Section

## Overview

「Next」セクションを「Board」セクションに変換し、カンバンボードレイアウトを実装する。既存のドラッグ&ドロップパターンを活用し、モバイル対応のスワイプナビゲーションを含む。

## Tasks

- [ ] 1. ユーティリティとフックの実装
  - [x] 1.1 習慣ステータス判定ユーティリティの作成
    - `frontend/app/dashboard/utils/habitStatusUtils.ts` を作成
    - `getHabitStatus(habit, activities)` 関数を実装
    - `groupHabitsByStatus(habits, activities)` 関数を実装
    - 今日の日付判定、アクティビティフィルタリングロジック
    - _Requirements: 2.3, 2.4, 2.5, 2.6_

  - [ ]* 1.2 習慣ステータス判定のプロパティテスト
    - **Property 3: Habit status classification**
    - **Validates: Requirements 2.3, 2.4, 2.5, 2.6**

  - [x] 1.3 useBoardLayoutフックの実装
    - `frontend/app/dashboard/hooks/useBoardLayout.ts` を作成
    - ローカルストレージからの読み込み/保存
    - デフォルト値 'detailed' の設定
    - toggleLayoutMode 関数の実装
    - _Requirements: 1.1, 1.3, 1.4, 1.5_

  - [ ]* 1.4 レイアウト永続化のプロパティテスト
    - **Property 2: Layout preference persistence round-trip**
    - **Validates: Requirements 1.4, 1.5**

- [x] 2. チェックポイント - ユーティリティとフックの確認
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. カンバンドラッグ&ドロップフックの実装
  - [x] 3.1 useKanbanDragDropフックの作成
    - `frontend/app/dashboard/hooks/useKanbanDragDrop.ts` を作成
    - 既存の `useDragAndDrop.ts` パターンを参考に実装
    - デスクトップ用ドラッグイベントハンドラー
    - ドロップ時のアクションマッピング（start, complete, pause）
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 3.2 タッチデバイス対応の追加
    - ロングプレス検出（400ms）
    - タッチムーブでのドラッグプレビュー更新
    - タッチエンドでのドロップ処理
    - 触覚フィードバック（navigator.vibrate）
    - _Requirements: 5.4_

  - [ ]* 3.3 ドロップアクションマッピングのプロパティテスト
    - **Property 9: Drop action mapping**
    - **Validates: Requirements 4.3, 4.4, 4.5**

- [ ] 4. モバイルスワイプフックの実装
  - [x] 4.1 useMobileSwipeフックの作成
    - `frontend/app/dashboard/hooks/useMobileSwipe.ts` を作成
    - タッチスタート/ムーブ/エンドのハンドラー
    - スワイプ方向検出とカラムインデックス更新
    - スクロールとの競合防止
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ]* 4.2 スワイプナビゲーションのプロパティテスト
    - **Property 11: Mobile swipe navigation**
    - **Validates: Requirements 5.2**

- [x] 5. チェックポイント - フックの確認
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. UIコンポーネントの実装
  - [x] 6.1 HabitCardコンポーネントの作成
    - `frontend/app/dashboard/components/Board.HabitCard.tsx` を作成
    - 習慣名、時間、進捗、ワークロード情報の表示
    - 完了ボタンと数量入力
    - ドラッグハンドル（draggable属性）
    - 経過時間表示（進行中の場合）
    - 最小タッチターゲット44x44px
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 5.5_

  - [x] 6.2 KanbanColumnコンポーネントの作成
    - `frontend/app/dashboard/components/Board.KanbanColumn.tsx` を作成
    - カラムヘッダー（タイトル、カウント）
    - HabitCardのリスト表示
    - ドロップターゲットのスタイリング
    - _Requirements: 2.1, 2.2_

  - [x] 6.3 KanbanLayoutコンポーネントの作成
    - `frontend/app/dashboard/components/Board.KanbanLayout.tsx` を作成
    - 3カラムの水平レイアウト
    - useKanbanDragDropフックの統合
    - モバイル用スクロールコンテナ
    - カラムインジケーター（モバイル）
    - _Requirements: 2.1, 5.1, 5.3_

- [ ] 7. Section.Boardコンポーネントの実装
  - [x] 7.1 BoardSectionコンポーネントの作成
    - `frontend/app/dashboard/components/Section.Board.tsx` を作成
    - useBoardLayoutフックの統合
    - レイアウトトグルボタン
    - 条件付きレンダリング（Simple/Detailed）
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 7.2 SimpleLayoutの実装
    - 既存NextSectionのロジックを移植
    - 同じ習慣フィルタリングロジックを使用
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 7.3 レイアウトデータ一貫性のプロパティテスト
    - **Property 14: Layout data consistency**
    - **Validates: Requirements 6.3**

- [x] 8. チェックポイント - コンポーネントの確認
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. タブ設定とダッシュボード統合
  - [x] 9.1 タブ設定の更新
    - `frontend/app/dashboard/constants/tabConfig.ts` を更新
    - 'next' → 'board' への変更
    - labelJa を 'ボード' に変更
    - 後方互換性のためのエイリアス処理
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 9.2 ダッシュボードページの更新
    - `frontend/app/dashboard/page.tsx` を更新
    - NextSection → BoardSection へのインポート変更
    - renderSectionContent の 'next'/'board' ケース更新
    - _Requirements: 7.3_

  - [x] 9.3 既存Section.Next.tsxの削除または非推奨化
    - Section.Next.tsx を削除（または非推奨コメント追加）
    - 関連するインポートの更新

- [ ] 10. スタイリングとアクセシビリティ
  - [x] 10.1 カンバンボード用CSSの追加
    - `frontend/app/dashboard/components/Board.css` を作成
    - ドラッグ&ドロップのスタイル（既存DragAndDrop.cssを参考）
    - モバイルスワイプのスタイル
    - prefers-reduced-motion対応
    - _Requirements: 4.1, 4.2, 5.6_

  - [x] 10.2 レスポンシブデザインの調整
    - デスクトップ: 3カラム横並び
    - モバイル: 横スクロール + インジケーター
    - ブレークポイント: 768px
    - _Requirements: 5.1_

- [x] 11. 最終チェックポイント
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- 既存の `useDragAndDrop.ts` と `DragAndDrop.css` のパターンを活用
- デザインシステムのCSS変数（bg-card, border-border等）を使用
- モバイルファーストでレスポンシブ対応
- 後方互換性のため 'next' タブIDも引き続きサポート
