# Implementation Plan: TODOサイトリファクタリング（低リスクタスクのみ）

## Overview

TODOサイトの保守性向上を目的とした段階的リファクタリング。既存機能を破壊することなく、低リスクなタスクのみを実施して基盤を整備する。

## Tasks

- [x] 1. Phase 1: ユーティリティ抽出 ✅ COMPLETED
  - 重複する日付・時間処理ユーティリティを統合 ✅
  - モバイル検出ロジックを共通フックに抽出 ✅
  - 共通型定義を整理・統合 ✅
  - _Requirements: 2.1, 2.2, 3.1_

- [x] 1.1 日付・時間処理ユーティリティの作成 ✅ COMPLETED
  - `frontend/app/dashboard/utils/dateUtils.ts` を作成 ✅
  - formatLocalDate, parseYMD, ymd, addDays, getTimeString 関数を実装 ✅
  - buildTimeOptions, minutesFromHHMM 関数も追加実装 ✅
  - 既存コードから重複する日付処理ロジックを特定・統合 ✅
  - _Requirements: 2.1_

- [ ]* 1.2 日付ユーティリティのプロパティテスト作成
  - **Property 4: Code deduplication effectiveness**
  - **Validates: Requirements 2.1, 3.1**

- [x] 1.3 モバイル検出フックの作成 ✅ COMPLETED
  - `frontend/app/dashboard/hooks/useDeviceDetection.ts` を作成 ✅
  - isMobile, isTablet, isDesktop, screenWidth, screenHeight, isTouchDevice を提供 ✅
  - 既存の重複するモバイル検出ロジック（window.innerWidth等）を統合 ✅
  - 後方互換性のためのヘルパー関数も提供 ✅
  - _Requirements: 3.1_

- [ ]* 1.4 デバイス検出フックのプロパティテスト作成
  - **Property 4: Code deduplication effectiveness**
  - **Validates: Requirements 2.1, 3.1**

- [x] 1.5 共通型定義の統合 ✅ COMPLETED
  - `frontend/app/dashboard/types/shared.ts` を作成 ✅
  - BaseEntity, DeviceInfo, ApiState, DateRange, TimeString 型を定義 ✅
  - TimingType, Timing, HabitRelation など既存の重複する型定義を統合 ✅
  - ユーティリティ型とエラーハンドリング型も追加 ✅
  - _Requirements: 2.2, 6.1_

- [ ]* 1.6 型定義統合のプロパティテスト作成
  - **Property 5: File organization consistency**
  - **Validates: Requirements 2.2, 6.1**

- [x] 2. Phase 2a: 独立したカスタムフックの抽出 ✅ COMPLETED
  - API呼び出しの共通パターンを抽出 ✅
  - ローカルストレージ管理を統一 ✅
  - 既存コンポーネントの状態に影響を与えない純粋な機能抽出 ✅
  - _Requirements: 2.1, 4.1_

- [x] 2.1 API呼び出し共通フックの作成 ✅ COMPLETED
  - `frontend/app/dashboard/hooks/useApiWithLoading.ts` を作成 ✅
  - loading, error, execute, reset を提供する汎用APIフック ✅
  - 既存のAPI呼び出しパターンを分析・統合 ✅
  - リトライ機能や複数API管理も追加実装 ✅
  - _Requirements: 2.1, 5.1_

- [ ]* 2.2 API共通フックのプロパティテスト作成
  - **Property 4: Code deduplication effectiveness**
  - **Validates: Requirements 2.1, 3.1**

- [x] 2.3 ローカルストレージ管理フックの作成 ✅ COMPLETED
  - `frontend/app/dashboard/hooks/useLocalStorage.ts` を作成 ✅
  - value, setValue, removeValue を提供する汎用ストレージフック ✅
  - 既存のlocalStorage使用箇所を特定・統合 ✅
  - SSR対応、タブ間同期、型安全性も追加実装 ✅
  - _Requirements: 2.1_

- [ ]* 2.4 ローカルストレージフックのプロパティテスト作成
  - **Property 4: Code deduplication effectiveness**
  - **Validates: Requirements 2.1, 3.1**

- [ ] 3. Phase 3a: 独立性の高いコンポーネント抽出
  - 状態を持たない純粋な表示コンポーネントを抽出
  - 親コンポーネントからpropsを受け取るのみの低リスク分割
  - 既存の大型コンポーネントから独立性の高い部分を分離
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 3.1 カレンダーコントロールコンポーネントの抽出
  - `frontend/app/dashboard/components/calendar/` ディレクトリを作成
  - `CalendarControls.tsx` を作成（ナビゲーション部分）
  - Widget.Calendar.tsx からナビゲーション部分を抽出
  - selectedView, onViewChange, onScrollToNow のpropsインターフェース
  - _Requirements: 1.1, 1.2, 1.3_

- [ ]* 3.2 カレンダーコントロールのプロパティテスト作成
  - **Property 2: Functional equivalence preservation**
  - **Validates: Requirements 1.2, 8.2**

- [ ] 3.3 マインドマップコントロールコンポーネントの抽出
  - `frontend/app/dashboard/components/mindmap/` ディレクトリを作成
  - `MindmapControls.tsx` を作成（ツールバー部分）
  - Widget.Mindmap.tsx からツールバー部分を抽出
  - onAddNode, onClearConnections, onZoomIn, onZoomOut, onFitView のpropsインターフェース
  - _Requirements: 1.1, 1.2, 1.3_

- [ ]* 3.4 マインドマップコントロールのプロパティテスト作成
  - **Property 2: Functional equivalence preservation**
  - **Validates: Requirements 1.2, 8.2**

- [ ] 4. 統合テストとチェックポイント
  - 全ての抽出されたコンポーネントとユーティリティが正常に動作することを確認
  - 既存機能に影響がないことを検証
  - _Requirements: 1.2, 8.2_

- [ ] 4.1 機能等価性の検証
  - 既存のテストスイートを実行して全てパスすることを確認
  - 抽出されたコンポーネントが元の機能と同等に動作することを確認
  - _Requirements: 1.2, 8.2_

- [ ]* 4.2 コンポーネントサイズ制約の検証
  - **Property 1: Component size constraint**
  - **Validates: Requirements 1.1**

- [ ]* 4.3 命名規則一貫性の検証
  - **Property 3: Naming convention consistency**
  - **Validates: Requirements 1.3**

- [ ]* 4.4 ファイル組織一貫性の検証
  - **Property 5: File organization consistency**
  - **Validates: Requirements 2.2, 6.1**

- [ ]* 4.5 段階的実装順序の検証
  - **Property 6: Incremental refactoring order**
  - **Validates: Requirements 8.1**

- [ ] 5. 最終チェックポイント
  - 全ての低リスクタスクが完了し、既存機能が正常に動作することを確認
  - 将来の中・高リスクリファクタリングのための基盤が整備されたことを確認

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- 低リスクタスクのみに限定することで、既存機能への影響を最小化
- 段階的なアプローチにより、各ステップでの検証が可能