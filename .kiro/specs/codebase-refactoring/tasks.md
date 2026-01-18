# Implementation Plan: Codebase Refactoring

## Overview

本プロジェクトのフロントエンドコードベースをリファクタリングし、可読性、保守性、パフォーマンス、型安全性を向上させます。Next.jsのベストプラクティスに沿ったディレクトリ構造への移行も含みます。

**重要な制約**: 既存の挙動は一切変更しません。各フェーズ完了後にテストを実行して確認します。

## Tasks

- [x] 1. Phase 1: 型安全性の向上
  - any型の排除と明示的な型定義の追加

- [x] 1.1 `frontend/app/dashboard/types/`の型定義を確認・整理
  - 既存の型定義ファイル（index.ts, mindmap.types.ts, shared.ts）を確認
  - 重複している型定義を統合
  - 未定義の型を追加
  - _Requirements: 4.1, 4.2, 4.4_

- [x] 1.2 Mindmapコンポーネントのany型を排除
  - `Widget.Mindmap.tsx`のany型を具体的な型に置換
  - `Widget.EditableMindmap.tsx`のany型を具体的な型に置換
  - `Widget.Mindmap.Refactored.tsx`のany型を具体的な型に置換
  - _Requirements: 4.1_

- [x] 1.3 カスタムフックのany型を排除
  - `useMindmapState.ts`のany型を排除
  - `useConnectionHandlers.ts`の未使用インポートを削除
  - その他のフックファイルのany型を確認・修正
  - _Requirements: 4.1, 4.2_

- [x] 1.4 型安全性のプロパティテストを作成
  - **Property 4: Type Safety**
  - any型の使用箇所をカウントするテスト
  - **Validates: Requirements 4.1, 4.2**

- [x] 1.5 Checkpoint - Phase 1完了確認
  - TypeScriptコンパイルエラーがないことを確認
  - 既存テストがパスすることを確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 2. Phase 2: ディレクトリ構造の整理
  - Next.jsベストプラクティスに準拠した構造への移行

- [x] 2.1 共通コンポーネントの移動
  - `frontend/app/components/`を`frontend/components/`に移動
  - インポートパスを更新（`@/components/*`エイリアス使用）
  - _Requirements: 1.1_

- [x] 2.2 共通フックの移動
  - `frontend/app/hooks/`を`frontend/hooks/`に移動
  - インポートパスを更新（`@/hooks/*`エイリアス使用）
  - _Requirements: 1.1_

- [x] 2.3 コンテキストの移動
  - `frontend/app/contexts/`を`frontend/contexts/`に移動
  - インポートパスを更新（`@/contexts/*`エイリアス使用）
  - _Requirements: 1.1_

- [x] 2.4 tsconfig.jsonのパスエイリアス確認・更新
  - 既存の`@/*`エイリアスで対応可能（追加不要）
  - _Requirements: 1.1_

- [x] 2.5 Checkpoint - Phase 2完了確認
  - TypeScriptコンパイルエラーがないことを確認
  - 既存テストがパスすることを確認
  - 開発サーバーが正常に起動することを確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Phase 3: 重複コードの統合
  - Mindmapコンポーネントの統合

- [x] 3.1 Widget.Mindmap.tsxとWidget.EditableMindmap.tsxの重複ロジックを分析
  - 共通のイベントハンドラーを特定: onConnect, onConnectStart, onConnectEnd
  - 共通のUI要素を特定: Header, Controls, Background, Panel
  - 共通の状態管理ロジックを特定: nodes/edges state, connection mode
  - 分析結果: Widget.Mindmap.Refactored.tsxが既にフックを使用して整理済み
  - Widget.UnifiedRelationMap.tsxが実際のメイン表示コンポーネント
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 3.2 共通ロジックをカスタムフックに抽出
  - 既存のフック（useMindmapState, useConnectionHandlers等）を活用
  - Widget.EditableMindmap.Refactored.tsxで既に実装済み
  - _Requirements: 2.1_

- [x] 3.3 Widget.Mindmap.Refactored.tsxを正式版として採用
  - Widget.Mindmap.tsx削除（未使用のため）
  - Widget.EditableMindmap.tsxをRefactored版に置換
  - Section.Mindmap.tsxのインポートを更新
  - _Requirements: 2.1, 2.2_

- [x] 3.4 コード重複削減のプロパティテストを作成
  - **Property 2: Code Duplication Reduction**
  - 重複コードブロックの検出テスト
  - 現在のベースライン: 21重複（将来のフェーズで削減予定）
  - **Validates: Requirements 2.1, 2.2, 2.3**

- [x] 3.5 Checkpoint - Phase 3完了確認
  - TypeScriptコンパイルエラーなし（SEO関連テストを除く）
  - 既存テストがパス（33テスト）
  - Mindmapコンポーネントの統合完了

- [x] 4. Phase 4: 関数の分割と簡素化
  - 大きな関数・コンポーネントの分割

- [x] 4.1 50行を超える関数を特定・分割
  - 各ファイルの関数サイズを確認
  - 大きな関数を小さな関数に分割
  - 単一責任の原則を適用
  - _Requirements: 3.1, 3.3_

- [x] 4.2 300行を超えるコンポーネントを特定・分割
  - 大きなコンポーネントをサブコンポーネントに分割
  - 適切なpropsインターフェースを定義
  - _Requirements: 3.2_

- [x] 4.3 JSDocコメントを追加
  - エクスポートされた関数にJSDocを追加
  - エクスポートされたコンポーネントにJSDocを追加
  - _Requirements: 3.4_

- [x] 4.4 コードサイズ制限のプロパティテストを作成
  - **Property 3: Code Size Limits**
  - 関数サイズとファイルサイズの検証テスト
  - **Validates: Requirements 3.1, 3.2**

- [x] 4.5 Checkpoint - Phase 4完了確認
  - 分割後のコードが正常に動作することを確認
  - 既存テストがパスすることを確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Phase 5: パフォーマンス最適化
  - React最適化フックの適用

- [x] 5.1 useMemoの適用
  - 高コストな計算を特定
  - useMemoでメモ化
  - 依存配列を適切に設定
  - _Requirements: 5.1_

- [x] 5.2 useCallbackの適用
  - 子コンポーネントに渡されるコールバックを特定
  - useCallbackでメモ化
  - 依存配列を適切に設定
  - _Requirements: 5.2_

- [x] 5.3 不要な再レンダリングの削減
  - React DevToolsで再レンダリングを確認
  - 必要に応じてReact.memoを適用
  - _Requirements: 5.3_

- [x] 5.4 React最適化フックのプロパティテストを作成
  - **Property 5: React Optimization Hooks**
  - useMemo/useCallbackの使用状況検証テスト
  - **Validates: Requirements 5.1, 5.2**

- [x] 5.5 Checkpoint - Phase 5完了確認
  - パフォーマンスが改善されていることを確認
  - 既存テストがパスすることを確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Phase 6: クリーンアップ
  - 未使用コードの削除とモダン構文の適用

- [x] 6.1 未使用インポートの削除
  - ESLintで未使用インポートを検出
  - 未使用インポートを削除
  - _Requirements: 6.1_

- [x] 6.2 var宣言をconst/letに置換
  - var宣言を検索
  - const/letに置換
  - _Requirements: 6.2_

- [x] 6.3 モダン構文の適用
  - テンプレートリテラルの使用
  - オプショナルチェイニングの使用
  - Nullish coalescingの使用
  - _Requirements: 6.1_

- [x] 6.4 未使用ファイルの削除
  - 使用されていないファイルを特定
  - バックアップ後に削除
  - _Requirements: 6.1_

- [x] 6.5 モダン構文準拠のプロパティテストを作成
  - **Property 6: Modern Syntax Compliance**
  - var宣言の不在を検証するテスト
  - **Validates: Requirements 6.1, 6.2**

- [x] 6.6 Final Checkpoint - 全フェーズ完了確認
  - 全ての既存テストがパスすることを確認
  - TypeScriptコンパイルエラーがないことを確認
  - ESLintエラーがないことを確認
  - 開発サーバーが正常に起動することを確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. APIコントラクト保持の検証
  - **Property 7: API Contract Preservation**
  - エクスポートされたインターフェースが変更されていないことを検証
  - **Validates: Requirements 7.1, 7.2**

- [x] 8. 依存関係保持の検証
  - **Property 8: Dependency Preservation**
  - package.jsonの依存関係が変更されていないことを検証
  - **Validates: Requirements 8.1, 8.2**

## Notes

- 各Checkpointでテストを実行し、問題があれば前のステップに戻ります
- 既存の挙動を変更しないことが最優先です
- プロパティテストは`fast-check`ライブラリを使用します（既存の依存関係）
