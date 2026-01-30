# Implementation Plan: Board Gantt Chart

## Overview

Board セクションにガントチャートビューを追加する実装計画。既存のカンバン/リストビューに加えて、Goals と Habits の時間軸ベースの可視化を提供する。タスクは段階的に構築され、各ステップでコア機能を検証してから次に進む。

## Tasks

- [x] 1. useBoardLayout フックの拡張
  - [x] 1.1 `frontend/app/dashboard/hooks/useBoardLayout.ts` を拡張
    - LayoutMode 型に 'gantt' を追加: `'simple' | 'detailed' | 'gantt'`
    - VALID_MODES 配列に 'gantt' を追加
    - 3モード間のサイクル切り替えロジックを実装
    - isGanttMode フラグを追加
    - _Requirements: 1.1, 1.3, 1.4_

- [x] 2. ガントチャートデータユーティリティの作成
  - [x] 2.1 `frontend/app/dashboard/utils/ganttDataUtils.ts` を作成
    - GanttRowData, DependencyData インターフェースを定義
    - buildGanttRows 関数を実装（Goals/Habits から階層的行データを構築）
    - calculateHabitProgress, calculateGoalProgress 関数を実装
    - buildDependencies 関数を実装（HabitRelation から依存関係を構築）
    - _Requirements: 2.1, 2.2, 2.3, 4.1, 4.2, 4.5, 6.1_
  
  - [x] 2.2 `frontend/app/dashboard/utils/lightningLineUtils.ts` を作成
    - LightningPoint インターフェースを定義
    - calculateLightningPoints 関数を実装
    - _Requirements: 7.2, 7.3, 7.4_
  
  - [ ]* 2.3 プロパティテストを作成
    - **Property 1: Row Hierarchy Correctness** - 階層関係の正確性を検証
    - **Property 3: Progress Calculation Correctness** - 進捗計算の正確性を検証
    - **Property 5: Lightning Line Deviation Correctness** - 稲妻線オフセットの正確性を検証
    - **Property 6: Collapse/Expand State Correctness** - 折りたたみ状態の正確性を検証
    - _Validates: Requirements 2.1-2.5, 4.1, 4.2, 4.5, 7.2-7.4_

- [x] 3. useGanttData フックの作成
  - [x] 3.1 `frontend/app/dashboard/hooks/useGanttData.ts` を作成
    - UseGanttDataProps, UseGanttDataReturn インターフェースを定義
    - expandedIds 状態管理を実装
    - toggleExpand 関数を実装
    - rows と dependencies の計算ロジックを実装
    - _Requirements: 2.4, 2.5, 2.6_

- [x] 4. useGanttTimeline フックの作成
  - [x] 4.1 `frontend/app/dashboard/hooks/useGanttTimeline.ts` を作成
    - ViewMode 型 ('day' | 'week' | 'month') を定義
    - TimelineCell インターフェースを定義
    - startDate/endDate の自動計算を実装
    - cells 配列の生成ロジックを実装
    - todayPosition の計算を実装
    - dayWidth の計算（ViewMode に応じて変動）を実装
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.7_
  
  - [ ]* 4.2 プロパティテストを作成
    - **Property 7: Timeline Scale Correctness** - タイムラインスケールの正確性を検証
    - _Validates: Requirements 8.1-8.5_

- [x] 5. チェックポイント - データ層の動作確認
  - ユーティリティとフックのテストがパスすることを確認

- [x] 6. ガントチャートコンポーネントの作成
  - [x] 6.1 `frontend/app/dashboard/components/Gantt.Bar.tsx` を作成
    - Schedule_Bar の描画（SVG rect）
    - Progress_Bar の描画（内部の塗りつぶし）
    - ホバー時のツールチップトリガー
    - デザインシステムカラーの適用（bg-primary, bg-success）
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4_
  
  - [x] 6.2 `frontend/app/dashboard/components/Gantt.Row.tsx` を作成
    - 行名の表示（階層に応じたインデント）
    - 折りたたみ/展開トグルボタン
    - ツリーライン/コネクタの描画
    - クリックイベントハンドラ
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 2.6, 5.1, 5.2, 5.3, 5.4, 9.1, 9.2_
  
  - [x] 6.3 `frontend/app/dashboard/components/Gantt.Dependency.tsx` を作成
    - 依存関係矢印の描画（SVG path）
    - ホバー時のハイライト
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [x] 6.4 `frontend/app/dashboard/components/Gantt.TimelineHeader.tsx` を作成
    - 日/週/月ラベルの表示
    - Today インジケータライン
    - ViewMode 切り替えボタン
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.7_
  
  - [x] 6.5 `frontend/app/dashboard/components/Gantt.LightningLine.tsx` を作成
    - 稲妻線の描画（SVG polyline）
    - 表示/非表示トグル
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  
  - [x] 6.6 `frontend/app/dashboard/components/Gantt.Tooltip.tsx` を作成
    - 名前、日付、進捗の表示
    - ポジショニングロジック
    - _Requirements: 9.3_

- [x] 7. メインガントレイアウトコンポーネントの作成
  - [x] 7.1 `frontend/app/dashboard/components/Board.GanttLayout.tsx` を作成
    - 全サブコンポーネントの統合
    - 水平スクロール対応
    - 行名パネルとチャートボディの分離
    - useGanttData, useGanttTimeline フックの使用
    - _Requirements: 1.2, 8.6_
  
  - [ ]* 7.2 プロパティテストを作成
    - **Property 2: Schedule Bar Position Correctness** - バー位置の正確性を検証
    - **Property 4: Dependency Arrow Correctness** - 依存関係矢印の正確性を検証
    - _Validates: Requirements 3.1, 3.2, 3.5, 6.1, 6.2_

- [x] 8. Section.Board.tsx の拡張
  - [x] 8.1 ビュートグルを3モード対応に更新
    - カンバン/リスト/ガントのアイコンと切り替えロジック
    - _Requirements: 1.1, 1.2_
  
  - [x] 8.2 GanttLayout の条件付きレンダリングを追加
    - isGanttMode 時に Board.GanttLayout を表示
    - Goals, HabitRelations データの受け渡し
    - _Requirements: 1.2_
  
  - [x] 8.3 親コンポーネントから Goals, HabitRelations を受け取るよう Props を拡張
    - BoardSectionProps に goals, habitRelations を追加
    - _Requirements: 2.1, 6.1_

- [x] 9. チェックポイント - 基本機能の動作確認
  - ガントチャートビューが表示されることを確認
  - 行の折りたたみ/展開が動作することを確認
  - スケジュールバーと進捗バーが表示されることを確認

- [ ] 10. インタラクティブ機能の追加
  - [ ] 10.1 Goal/Habit クリック時のモーダル表示
    - onGoalEdit, onHabitEdit コールバックの接続
    - _Requirements: 9.1, 9.2_
  
  - [ ] 10.2 キーボードナビゲーションの実装
    - 矢印キーで行間移動
    - Enter キーで編集モーダル
    - _Requirements: 9.4_

- [ ] 11. レスポンシブ・アクセシビリティ対応
  - [ ] 11.1 レスポンシブスタイリングの追加
    - モバイル時の水平スクロール対応
    - タッチターゲット 44x44px の確保
    - _Requirements: 10.1, 10.2, 10.5_
  
  - [ ] 11.2 ダークモード対応
    - CSS 変数の使用
    - _Requirements: 10.3_
  
  - [ ] 11.3 アクセシビリティ属性の追加
    - ARIA ラベル
    - prefers-reduced-motion の尊重
    - _Requirements: 10.4, 10.6_
  
  - [ ]* 11.4 アクセシビリティテストを作成
    - **Property 8: Touch Target Size Constraint** - タッチターゲットサイズの検証
    - _Validates: Requirements 10.5_

- [ ] 12. 最終チェックポイント
  - 全テストがパスすることを確認
  - ビルドが成功することを確認

## Notes

- タスクに `*` マークがあるものはオプションで、MVP では省略可能
- 各タスクは特定の要件にトレーサビリティを持つ
- チェックポイントで段階的な検証を行う
- SVG ベースの実装により、軽量で柔軟なガントチャートを実現
- 既存の useBoardLayout フックを拡張することで、一貫したユーザー体験を提供
- HabitRelation の 'next' 関係を活用して依存関係を可視化
