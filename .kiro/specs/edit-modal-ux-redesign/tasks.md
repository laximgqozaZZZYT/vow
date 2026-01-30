# 実装計画: 編集モーダルUI/UX刷新

## 概要

Habit、Goal、Stickyの編集モーダルのUI/UXを改善する実装計画です。データスキーマは変更せず、以下の改善を段階的に実装します：
- SmartSelector（検索式マルチセレクト）コンポーネントの作成
- 固定フッター（StickyFooter）の実装
- 折りたたみセクションの改善
- 各モーダルへの適用

## タスク

- [x] 1. 共通コンポーネントの作成
  - [x] 1.1 SmartSelectorコンポーネントを作成
    - `frontend/app/dashboard/components/Widget.SmartSelector.tsx`を新規作成
    - 検索入力、ドロップダウン、選択済みChip表示を実装
    - キーボードナビゲーション（上下矢印、Enter、Escape）をサポート
    - 最近使用したアイテムのサジェスト機能を実装
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 7.1_

  - [ ]* 1.2 SmartSelectorのプロパティテストを作成
    - **Property 1: 選択状態の一貫性**
    - **Property 2: 検索フィルタリングの正確性**
    - **Property 6: キーボードナビゲーションの完全性**
    - **Validates: Requirements 1.1, 1.2, 1.3, 7.1**

  - [x] 1.3 StickyFooterコンポーネントを作成
    - `frontend/app/dashboard/components/Widget.StickyFooter.tsx`を新規作成
    - 保存、キャンセル、削除ボタンを固定表示
    - コンテンツとの境界にシャドウを表示
    - 削除ボタンを視覚的に分離
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 1.4 StickyFooterのプロパティテストを作成
    - **Property 4: 固定フッターの可視性**
    - **Validates: Requirements 4.1, 4.3**

  - [x] 1.5 SelectedChipコンポーネントを作成
    - `frontend/app/dashboard/components/Widget.SelectedChip.tsx`を新規作成
    - アクセントカラー適用、削除ボタン、ホバー時のフィードバック
    - ダークモード対応
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 1.6 SelectedChipのプロパティテストを作成
    - **Property 5: 視覚的区別の一貫性**
    - **Validates: Requirements 3.1, 3.2**

- [x] 2. チェックポイント - 共通コンポーネントの確認
  - すべてのテストが通ることを確認し、質問があればユーザーに確認

- [x] 3. Modal.Sticky.tsxの改善
  - [x] 3.1 StickyModalにSmartSelectorを適用
    - Tags選択をSmartSelectorに置き換え
    - Related Goals選択をSmartSelectorに置き換え
    - Related Habits選択をSmartSelectorに置き換え（do/avoid種類を視覚的に区別）
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 3.2 StickyModalにStickyFooterを適用
    - 既存のボタン配置を固定フッターに移行
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 3.3 StickyModalに折りたたみセクションを追加
    - Related Goals/Habitsセクションを折りたたみ可能に
    - _Requirements: 2.5_

  - [ ]* 3.4 StickyModalのユニットテストを作成
    - 選択・解除のコールバック呼び出しをテスト
    - _Requirements: 1.3, 1.4_

- [x] 4. Modal.Goal.tsxの改善
  - [x] 4.1 GoalModalのレイアウト最適化
    - 主要項目（名前、詳細、期日）を最上部に配置
    - TagSelectorをSmartSelectorに置き換え
    - _Requirements: 2.4, 1.1, 1.2, 1.3, 1.4_

  - [x] 4.2 GoalModalにStickyFooterを適用
    - 既存のボタン配置を固定フッターに移行
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 4.3 GoalModalのユニットテストを作成
    - 保存・キャンセル・削除のコールバック呼び出しをテスト
    - _Requirements: 4.1_

- [x] 5. チェックポイント - Goal/Stickyモーダルの確認
  - すべてのテストが通ることを確認し、質問があればユーザーに確認

- [x] 6. Modal.Habit.tsxの改善
  - [x] 6.1 HabitModalのWorkloadセクション改善
    - Normalビューでデフォルト折りたたみ
    - UnitとLoad per Countを2カラムレイアウトに
    - _Requirements: 2.1, 2.3_

  - [x] 6.2 HabitModalのTimingsセクション改善
    - Normalビューでデフォルト折りたたみ
    - _Requirements: 2.1, 2.2_

  - [x] 6.3 HabitModalにSmartSelectorを適用
    - Tags選択をSmartSelectorに置き換え
    - Related Habits選択をSmartSelectorに置き換え
    - Goal選択をSmartSelectorに置き換え
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 5.1, 5.2, 5.3_

  - [x] 6.4 HabitModalにStickyFooterを適用
    - 既存のボタン配置を固定フッターに移行
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 6.5 HabitModalのビューモード切り替え改善
    - Normal/Detailビュー切り替えを維持
    - ビューモードをlocalStorageに保存（既存機能を維持）
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 6.6 HabitModalのプロパティテストを作成
    - **Property 8: ビューモード切り替えの永続性**
    - **Validates: Requirements 8.4**

- [x] 7. レスポンシブ対応
  - [x] 7.1 SmartSelectorのレスポンシブ対応
    - 768px未満で適切なレイアウトに調整
    - タッチターゲット最小44x44pxを維持
    - _Requirements: 6.1, 6.2_

  - [x] 7.2 StickyFooterのレスポンシブ対応
    - モバイルでボタンを適切なサイズで表示
    - _Requirements: 6.4_

  - [x] 7.3 各モーダルの2カラムレイアウト対応
    - 768px未満で1カラムに変更
    - _Requirements: 6.1, 6.3_

  - [ ]* 7.4 レスポンシブ対応のプロパティテストを作成
    - **Property 7: レスポンシブレイアウトの適応**
    - **Validates: Requirements 6.1**

- [x] 8. アクセシビリティ対応
  - [x] 8.1 SmartSelectorのアクセシビリティ改善
    - aria-expanded、aria-controls属性を設定
    - フォーカストラップを実装
    - focus-visibleスタイルを適用
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 8.2 CollapsibleSectionのアクセシビリティ改善
    - aria-expanded、aria-controls属性を設定
    - _Requirements: 7.2_

  - [ ]* 8.3 アクセシビリティのユニットテストを作成
    - aria属性の正しい設定をテスト
    - _Requirements: 7.2_

- [x] 9. 最終チェックポイント
  - すべてのテストが通ることを確認し、質問があればユーザーに確認
  - 各モーダルの動作確認

## 備考

- `*`マークのタスクはオプションで、MVPでは省略可能
- 各タスクは特定の要件にトレースバック可能
- チェックポイントで段階的に検証を実施
- プロパティテストは`fast-check`ライブラリを使用
