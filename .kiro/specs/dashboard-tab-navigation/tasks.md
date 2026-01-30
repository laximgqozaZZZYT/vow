# Implementation Plan: Dashboard Tab Navigation

## Overview

ダッシュボードのタブナビゲーション化機能の実装計画。既存のセクションコンポーネントを維持しながら、新しいタブナビゲーションUIを追加する。TypeScriptとReactを使用し、デザインシステムに準拠した実装を行う。

## Tasks

- [x] 1. タブ設定とフックの実装
  - [x] 1.1 タブ設定定義ファイルの作成
    - `frontend/app/dashboard/constants/tabConfig.ts` を作成
    - TAB_CONFIGS配列とDEFAULT_TAB定数を定義
    - 各タブのid, label, icon, supportsFullViewを設定
    - _Requirements: 1.1, 4.1_
  
  - [x] 1.2 useTabNavigationフックの実装
    - `frontend/app/dashboard/hooks/useTabNavigation.ts` を作成
    - activeTab, setActiveTab, isFullView, toggleFullView, exitFullViewを実装
    - 初期タブとavailableTabsのバリデーション
    - _Requirements: 2.2, 2.4, 4.2, 4.4_
  
  - [ ]* 1.3 useTabNavigationフックのプロパティテスト
    - **Property 4: Tab State Persistence**
    - **Validates: Requirements 2.4**

- [x] 2. TabNavigationコンポーネントの実装
  - [x] 2.1 TabNavigationコンポーネントの作成
    - `frontend/app/dashboard/components/Layout.TabNavigation.tsx` を作成
    - タブバーのレンダリング、アクティブタブのスタイリング
    - デザインシステム準拠（CSS変数、8pxスペーシング、rounded-md）
    - _Requirements: 1.1, 1.2, 1.3, 6.1, 6.2, 6.3_
  
  - [x] 2.2 レスポンシブ対応の実装
    - モバイル時の水平スクロール対応
    - タッチターゲット44x44px以上の確保
    - _Requirements: 1.4, 5.1, 5.2, 5.3_
  
  - [ ]* 2.3 TabNavigationのプロパティテスト
    - **Property 1: Tab Rendering Completeness**
    - **Property 2: Active Tab State Consistency**
    - **Property 6: Touch Target Accessibility**
    - **Validates: Requirements 1.1, 1.2, 2.2, 5.3**

- [x] 3. TabContentコンポーネントの実装
  - [x] 3.1 TabContentコンポーネントの作成
    - `frontend/app/dashboard/components/Layout.TabContent.tsx` を作成
    - activeTabに基づくセクションの条件付きレンダリング
    - フルビューモード時のオーバーレイ表示
    - _Requirements: 2.1, 3.1, 3.2, 4.2, 4.3_
  
  - [x] 3.2 フルビュートグルボタンの実装
    - supportsFullViewがtrueのセクションにトグルボタンを表示
    - フルビューモード時のクローズボタン
    - _Requirements: 4.1, 4.3_
  
  - [ ]* 3.3 TabContentのプロパティテスト
    - **Property 3: Single Section Display**
    - **Property 5: Full View Mode Toggle**
    - **Validates: Requirements 2.1, 4.1, 4.2, 4.3, 4.4**

- [x] 4. Checkpoint - コンポーネント単体テスト確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. ダッシュボードページへの統合
  - [x] 5.1 DashboardLayoutの更新
    - `frontend/app/dashboard/page.tsx` を更新
    - TabNavigationとTabContentコンポーネントを統合
    - 既存のpageSections配列との連携
    - _Requirements: 1.3, 2.3, 3.3_
  
  - [x] 5.2 既存セクションとの連携確認
    - 各セクションへのprops受け渡し
    - モーダルとの相互作用の維持
    - _Requirements: 3.1_

- [x] 6. Final checkpoint - 全テスト確認
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- 既存のセクションコンポーネント（Section.*.tsx, Widget.*.tsx）は変更しない
- デプロイは開発環境（developブランチ）のみ
- デザインシステム（design-system.md）に準拠したスタイリングを使用
