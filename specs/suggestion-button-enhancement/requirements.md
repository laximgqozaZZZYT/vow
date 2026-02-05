# Suggestion Button Enhancement - Requirements

## Overview
- **Feature Name**: SuggestionButton機能拡張
- **Status**: Draft
- **Version**: 1.0.0
- **Created**: 2026-02-04
- **Author**: vow-spec-architect
- **Location**: `/home/ubuntu/Downloads/vow/specs/suggestion-button-enhancement/`

## Background

現在のSuggestionCard (`Section.MOC.tsx`) は個別の候補カードを表示し、クリックで詳細モーダルを開く機能を持っている。
本拡張では、複数候補の選択・一括操作・候補の調整機能を追加する。

### 現状分析

**既存ファイル:**
- `Section.MOC.tsx` - SuggestionCard コンポーネント (Line 3127-3295)
- `GroupChatMessage` 型定義 (Line 48-90)
- `SuggestionButtonType`: `'habit' | 'goal' | 'stickyn' | 'reply'`

**既存の候補タイプ:**
- `habit` - 習慣候補
- `goal` - 目標候補
- `stickyn` - スティッキーノート候補
- `reply` - その他テキスト用

**既存のアクション:**
- accept (採用) - モーダルを開いて登録
- snooze (後で) - 後で確認リストに追加
- dismiss (不要) - 候補を却下

---

## Functional Requirements

### FR-001: 候補ボタンの型（種類）表示
- **Priority**: High
- **Description**: 各候補ボタンに種類（Habit/Goal/Sticky'n/Category/Text）を視覚的に区別できるバッジを表示する
- **Acceptance Criteria**:
  - [AC-001-1] Habit候補には青色バッジ「Habit」を表示
  - [AC-001-2] Goal候補には紫色バッジ「Goal」を表示
  - [AC-001-3] Sticky'n候補には黄色バッジ「Sticky'n」を表示
  - [AC-001-4] Category候補には緑色バッジ「Category」を表示
  - [AC-001-5] Text候補にはグレーバッジ「Text」を表示
- **Current Status**: Habit/Goal/Stickyn/Replyは既に実装済み (Line 3133-3138)
- **Required Change**: `category` と `text` タイプを追加

### FR-002: 詳細確認機能
- **Priority**: High
- **Description**: Habit/Goal/Sticky'n の候補ボタンを押下すると、その詳細を確認できるモーダルを表示する
- **Acceptance Criteria**:
  - [AC-002-1] 候補カードをクリックすると詳細モーダルが開く
  - [AC-002-2] モーダル内で候補の全情報（名前、説明、頻度、所要時間等）を確認できる
  - [AC-002-3] モーダル内で編集してから登録できる
  - [AC-002-4] モーダルからキャンセルして候補一覧に戻れる
- **Current Status**: 既存の `handleCardClick` -> `onAction('accept')` でモーダルを開く実装あり

### FR-003: チェックボタン（複数選択）
- **Priority**: High
- **Description**: 各候補ボタンの右側にチェックボックスを追加し、複数候補を選択可能にする
- **Acceptance Criteria**:
  - [AC-003-1] 各SuggestionCardの右端にチェックボックスを表示
  - [AC-003-2] チェックボックスをクリックしても詳細モーダルは開かない（独立した操作）
  - [AC-003-3] 複数の候補を同時に選択できる
  - [AC-003-4] 選択状態は視覚的に明確に表示される（ボーダー色変更、背景色変更等）
  - [AC-003-5] 「すべて選択」「すべて解除」のトグル機能を提供
- **Current Status**: 未実装

### FR-004: アクションボタン群
- **Priority**: High
- **Description**: 候補群の下部に候補を調整するアクションボタンを配置する
- **Acceptance Criteria**:
  - [AC-004-1] 「もっと具体的に」ボタン - 選択した候補をより具体的な内容に変換
  - [AC-004-2] 「もっとかんたんに」ボタン - 選択した候補を簡単な内容に変換
  - [AC-004-3] 「もっと難しく」ボタン - 選択した候補を難しい内容に変換
  - [AC-004-4] 「もっとアレンジして」ボタン - 選択した候補を別のアレンジで再生成
  - [AC-004-5] 「他には」ボタン - 全く別の候補を提示
  - [AC-004-6] 選択した候補がない場合、ボタンは無効化（disabled）状態
  - [AC-004-7] ボタン押下でAIに調整リクエストを送信
- **Current Status**: followUpActionsとして部分的に実装済み (Line 3100-3113)
- **Required Change**: 複数選択との連携、新しいアクションタイプの追加

### FR-005: 一括登録機能
- **Priority**: High
- **Description**: チェックした候補を「登録」ボタンで一括登録できる
- **Acceptance Criteria**:
  - [AC-005-1] 「登録」ボタンを候補群の下部に表示
  - [AC-005-2] 選択した候補がない場合、「登録」ボタンは無効化
  - [AC-005-3] 「登録」ボタン押下で選択した全候補を順次登録
  - [AC-005-4] 登録処理中は進捗インジケータを表示
  - [AC-005-5] 登録完了後、登録済み候補は「採用済み」状態に変更
  - [AC-005-6] 一部登録失敗時はエラーを表示し、成功分のみ状態更新
- **Current Status**: 未実装

---

## Non-Functional Requirements

### NFR-001: パフォーマンス
- 候補50件まで表示してもUIがスムーズに動作すること
- チェックボックス操作のレスポンスは100ms以内

### NFR-002: アクセシビリティ
- チェックボックスにはaria-labelを付与
- キーボードナビゲーション（Tab/Space/Enter）をサポート
- フォーカス状態を視覚的に明示

### NFR-003: レスポンシブ対応
- モバイル画面でもチェックボックスは操作しやすいサイズ（最小44x44px タップ領域）
- 横幅が狭い場合、アクションボタンは折り返し表示

### NFR-004: 多言語対応
- 全てのラベルはlocale（ja/en）に対応
- 日本語がデフォルト

---

## Dependencies

### Internal Dependencies
- `Section.MOC.tsx` - メインコンポーネント
- `Modal.Habit.tsx` - 習慣登録モーダル
- `Modal.Goal.tsx` - 目標登録モーダル
- `Modal.Sticky.tsx` - スティッキー登録モーダル
- `useMastraAgent.ts` - AI Agent通信
- `useMcpChat.ts` - MCP Chat通信

### External Dependencies
- React 19
- Tailwind CSS 4
- TypeScript

---

## Out of Scope

- 候補のドラッグ&ドロップ並び替え
- 候補のグルーピング表示
- 候補の保存・履歴管理
- オフライン対応

---

## Agent Coordination Notes

この仕様は以下のエージェントが実装を担当できる:

1. **Frontend Developer**: UI コンポーネントの実装
2. **Backend Developer**: 調整リクエストAPIの実装（必要な場合）

**並列作業可能なタスク:**
- チェックボックスUI実装とアクションボタン実装は並列可能
- 型定義の更新は先行して完了させる必要あり

**Integration Points:**
- 既存の `parseSuggestions` 関数への影響はなし
- 新規の選択状態管理が必要
