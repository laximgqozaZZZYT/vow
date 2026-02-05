# ISS-20260204-017: Suggestion Button Enhancement - Requirements

## Overview
- **Purpose**: AIコーチからの提案ボタン（SuggestionCard）の機能拡張と改善
- **Status**: In Progress
- **Version**: 1.0.0
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect
- **Issue ID**: ISS-20260204-017

## Background

### 関連Issue/仕様
- **前提仕様**: `suggestion-buttons-fix` - 提案ボタンが表示されない問題を修正（完了）
- **関連仕様**: `moc-mcp-remote-integration` - MOCセクションのMCP統合

### 現状
`suggestion-buttons-fix` によりAIコーチからの提案がSuggestionCardとして正しく表示されるようになった。
しかし、ユーザー体験を向上させるためにいくつかの機能拡張が求められている。

## Problem Statement

### 現在の制限事項
1. **ローディング状態の不足**: 提案生成中のビジュアルフィードバックがない
2. **スヌーズ機能の未実装**: 後で確認したい提案を保存する機能がない
3. **提案履歴の欠如**: 過去に表示された提案を確認できない
4. **一括操作の不足**: 複数の提案を一度に処理できない
5. **フィルタリング機能なし**: 提案を種類（習慣/目標）でフィルタできない

## Requirements

### Functional Requirements

#### FR-001: ローディングインジケータ
- 提案生成中にスケルトンローダーまたはスピナーを表示する
- 生成中のカード数を事前に表示する（可能な場合）
- 生成完了後にスムーズなアニメーションで表示する

#### FR-002: スヌーズ機能
- SuggestionCardに「後で」ボタンを追加
- スヌーズした提案をHistoryタブで確認可能にする
- スヌーズ期限（デフォルト24時間）を設定可能にする
- スヌーズ期限後に再通知オプション

#### FR-003: 提案履歴
- 過去の提案をHistoryタブに保存
- 提案の状態（受諾/スヌーズ/却下）を記録
- 提案の作成日時を表示
- 提案をカテゴリでフィルタ可能

#### FR-004: 一括操作
- 複数の提案を選択可能にする
- 一括での受諾/却下/スヌーズ
- 選択状態のビジュアル表示

#### FR-005: フィルタリング
- 提案種類（habit/goal/reply）でフィルタ
- カテゴリ（健康/学習/仕事等）でフィルタ
- 難易度でフィルタ

### Non-Functional Requirements

#### NFR-001: パフォーマンス
- 提案表示まで500ms以内
- アニメーションは60fps維持
- メモリ効率的な履歴管理（最大100件）

#### NFR-002: アクセシビリティ
- キーボード操作対応
- スクリーンリーダー対応
- カラーコントラスト比4.5:1以上

#### NFR-003: レスポンシブ
- モバイル画面での適切な表示
- タッチ操作の最適化
- スワイプジェスチャー対応（オプション）

## Acceptance Criteria

### AC-001: ローディング表示
- 「習慣を提案して」と入力後、即座にスケルトンローダーが表示される
- 提案生成完了後、スムーズにSuggestionCardに置き換わる

### AC-002: スヌーズ機能
- SuggestionCardの「後で」ボタンをクリックするとスヌーズされる
- スヌーズした提案がHistoryタブの「スヌーズ中」セクションに表示される
- 24時間後にスヌーズ期限切れの通知が表示される

### AC-003: 履歴管理
- 受諾した提案がHistoryタブに記録される
- 却下した提案も履歴として記録される
- 履歴をフィルタできる

### AC-004: 一括操作
- Shift+クリックで複数選択できる
- 「すべて選択」チェックボックスで全選択可能
- 選択中に「一括受諾」ボタンが表示される

### AC-005: フィルタリング
- 提案リスト上部にフィルタドロップダウンが表示される
- フィルタ選択後、即座にリストが更新される

## Out of Scope

- AIモデルの変更や提案アルゴリズムの変更
- バックエンドAPIの大幅な変更
- 他のセクション（Dashboard, Board等）への影響

## Dependencies

- React 19
- Tailwind CSS 4
- Section.MOC.tsx (既存)
- useMastraAgent.ts (既存)
- useMcpChat.ts (既存)
- localStorage (ブラウザ)

## Agent Coordination Notes

この仕様は以下のタスクに分割して並行作業可能:

1. **Task Group A** (Frontend - UI Components):
   - ローディングコンポーネント作成
   - SuggestionCardへのスヌーズボタン追加
   - フィルタUIコンポーネント

2. **Task Group B** (Frontend - State Management):
   - スヌーズ状態管理
   - 履歴状態管理
   - 選択状態管理

3. **Task Group C** (Frontend - History Tab):
   - Historyタブへの提案履歴表示
   - フィルタ機能実装

## Risk Assessment

| リスク | 影響度 | 対策 |
|--------|--------|------|
| localStorage容量制限 | 中 | 古い履歴の自動削除 |
| パフォーマンス低下 | 中 | React.memoとuseMemoの活用 |
| 既存機能への影響 | 低 | 既存テストの実行確認 |
