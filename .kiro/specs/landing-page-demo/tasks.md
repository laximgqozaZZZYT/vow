# Implementation Plan: Landing Page Demo

## Overview

VOWアプリケーションのランディングページにインタラクティブなデモセクションを追加します。実際のダッシュボードコンポーネントを再利用し、静的テストデータと自動再生アニメーションでユーザーに操作フローを紹介します。

**【最重要】** デモセクションは `/dashboard` と**完全に同一のレイアウト**を使用すること。コンポーネント配置、スペーシング、グリッド構造に一切の差異があってはならない。

## Tasks

- [x] 1. デモデータモジュールの作成
  - [x] 1.1 デモデータファイルの作成 (frontend/app/demo/data/demoData.ts)
    - Goal型に準拠した2つのサンプル目標を定義
    - Habit型に準拠した3つのサンプル習慣を定義（朝の運動、読書、瞑想）
    - 過去7日分のActivityデータを生成するヘルパー関数を作成
    - Sticky型に準拠した2つのサンプル付箋を定義
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_
  
  - [x] 1.2 デモデータのプロパティテスト
    - **Property 1: Demo Data Completeness**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.6**

- [x] 2. デモセクションコンポーネントの作成
  - [x] 2.1 DemoDataProviderコンテキストの作成 (frontend/app/demo/contexts/DemoDataContext.tsx)
    - デモデータを提供するReact Contextを作成
    - モックハンドラー（onHabitAction, onStickyCreate等）を実装
    - _Requirements: 3.5, 3.6_
  
  - [x] 2.2 Section.Demoコンポーネントの作成 (frontend/app/demo/components/Section.Demo.tsx)
    - 実際のダッシュボードと同じレイアウト構造を使用
    - CSS transform scaleで縮小表示を実装
    - デモ用のフレーム/コンテナを追加
    - タイトル「ダッシュボードプレビュー」を表示
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_
  
  - [x] 2.3 レイアウト一貫性のプロパティテスト
    - **Property 2: Layout Structure Consistency**
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.7**
  
  - [x] 2.4 API分離のプロパティテスト
    - **Property 3: API Isolation**
    - **Validates: Requirements 3.5, 3.6**

- [x] 3. Checkpoint - デモセクション基本動作確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. アニメーション制御の実装
  - [x] 4.1 useDemoAnimationフックの作成 (frontend/app/demo/hooks/useDemoAnimation.ts)
    - アニメーションステップの管理
    - 再生/一時停止/再開の制御
    - ループ処理の実装
    - _Requirements: 4.1, 4.5_
  
  - [x] 4.2 DemoAnimationControllerコンポーネントの作成 (frontend/app/demo/components/DemoAnimationController.tsx)
    - アニメーションシーケンスの定義
    - ステップ間のトランジション制御
    - _Requirements: 4.2, 4.3, 4.4_
  
  - [x] 4.3 DemoOverlayコンポーネントの作成 (frontend/app/demo/components/DemoOverlay.tsx)
    - カーソルアニメーション表示
    - ハイライト効果の実装
    - _Requirements: 4.6_
  
  - [x] 4.4 インタラクション応答の実装
    - ホバー/タッチ時の一時停止
    - 3秒後の自動再開
    - _Requirements: 4.7, 4.8_
  
  - [x] 4.5 アニメーションループのプロパティテスト
    - **Property 4: Animation Loop Continuity**
    - **Validates: Requirements 4.5**
  
  - [x] 4.6 インタラクション応答のプロパティテスト
    - **Property 5: Animation Interaction Response**
    - **Validates: Requirements 4.7, 4.8**

- [x] 5. アクセシビリティとパフォーマンスの実装
  - [x] 5.1 遅延読み込みの実装
    - dynamic importを使用したコード分割
    - Intersection Observerによる可視性検出
    - _Requirements: 5.1, 5.5_
  
  - [x] 5.2 prefers-reduced-motion対応
    - メディアクエリの検出
    - アニメーション無効化時の静的表示
    - _Requirements: 5.2_
  
  - [x] 5.3 エラーバウンダリとフォールバックの実装
    - ErrorBoundaryコンポーネントの作成
    - 静的フォールバック表示
    - _Requirements: 5.6_
  
  - [x] 5.4 reduced-motionのプロパティテスト
    - **Property 6: Reduced Motion Respect**
    - **Validates: Requirements 5.2**
  
  - [x] 5.5 タッチターゲットのプロパティテスト
    - **Property 7: Touch Target Accessibility**
    - **Validates: Requirements 5.3**

- [x] 6. Checkpoint - アニメーションとアクセシビリティ確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. ランディングページへの統合
  - [x] 7.1 page.tsxの更新 (frontend/app/page.tsx)
    - デモセクションのインポートと配置
    - ヒーローセクションの下に配置
    - _Requirements: 2.1_
  
  - [x] 7.2 デザインシステム準拠の確認
    - CSS変数の使用確認
    - Tailwindクラスの確認
    - ダークモード対応確認
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  
  - [x] 7.3 デザインシステム準拠のプロパティテスト
    - **Property 8: Design System Compliance**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6**

- [x] 8. Final Checkpoint - 全体動作確認
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- すべてのタスク（プロパティテスト含む）が必須です
- 実際のダッシュボードコンポーネント（NextSection, StickiesSection, CalendarWidget, StaticsSection）をそのまま再利用
- CSS transform scaleを使用してコンポーネント内部レイアウトを変更せずに縮小
- fast-checkライブラリを使用したプロパティベーステスト
