# MOC Task Kanban + Remote CLI Skill Set - Requirements Specification

## Overview

- **Purpose**: MOCセクションのタスクタブにKanban UIを導入し、「スキルセット」というカード型タスク単位を管理できるようにする。スキルセットは1つのメインNote（カスタムプロンプト）と複数のSticky'n（サブ指示/コンテキスト）で構成され、Goal/Habitに紐づく。MOCチャットで「タスク実行をしてください」と要求すると、Remote CLIが登録されたスキルセットを自動実行し、進捗報告によりKanbanカードがTODO→進行中→完了と移動する
- **Status**: Draft
- **Version**: 1.0
- **Last Updated**: 2026-02-07
- **Author**: vow-spec-architect
- **Spec ID**: MOC-TASK-KANBAN-001

---

## 1. Background (背景)

### 1.1 現在の状態

MOCセクションのタスクタブ（`TabId = 'tasks'`）は現在、MCPサーバから取得したタスクを3セクション（進行中/待機中/完了）のリスト表示で表示している（`TaskListView`コンポーネント）。このリストビューは単純なステータス別表示であり、以下の課題がある:

1. **タスクの構造化が不十分**: タスクはtitle/description/statusのみで、再利用可能な指示セットとして構成されていない
2. **Kanban操作がない**: Boardセクションが持つドラッグ&ドロップのKanban UIが活用されていない
3. **Remote CLI連携が弱い**: チャットで個別にコマンドを打つ必要があり、事前定義されたタスクの一括実行ができない
4. **Goal/Habitとの紐づけがない**: タスクがどの目標・習慣に関連するか不明確

### 1.2 Board KanbanとのUI共通性

Boardセクションの既存Kanban実装（`Board.KanbanLayout.tsx`, `Board.KanbanColumn.tsx`）は以下の特徴を持つ:

| 特徴 | 実装 |
|------|------|
| 4カラムレイアウト | 予定 / 進行中 / 完了(日次) / 完了 |
| ドラッグ&ドロップ | `useKanbanDragDrop` hook |
| モバイルスワイプ | `useMobileSwipe` hook |
| モバイルインジケータ | ドットナビゲーション |
| カード表示 | `Board.HabitCard` コンポーネント |
| ステータスグループ化 | `groupHabitsByStatus` ユーティリティ |

本仕様では、このKanban UIのアーキテクチャを活用しつつ、タスクタブ専用のカラム構成とカードコンポーネントを新規作成する。

### 1.3 "Note"エンティティについて

現時点ではVOWプロジェクトに独立した「Note」エンティティは存在しない（`Habit.notes`は文字列フィールド）。本仕様ではスキルセットのメインプロンプトとして新規の「Note」テーブルを導入する。Noteは再利用可能なテキストブロックで、Markdown形式のカスタムプロンプトを保持する。

---

## 2. User Stories (ユーザーストーリー)

### US-001: スキルセットの作成
> **As a** VOWユーザー
> **I want to** MOCセクションのタスクタブでスキルセットを新規作成し、メインプロンプト（Note）とサブ項目（Sticky'n）を組み合わせてタスクを定義したい
> **So that** 複雑な作業指示を構造化して再利用できる

### US-002: 既存Note/Sticky'nの流用
> **As a** VOWユーザー
> **I want to** 既存のNoteやSticky'nをスキルセットに流用できるようにしたい
> **So that** 既に作成済みの指示やコンテキストを再利用できる

### US-003: Goal/Habitへの紐づけ
> **As a** VOWユーザー
> **I want to** スキルセットを特定のGoalやHabitに紐づけたい
> **So that** どの目標・習慣に関連するタスクかが明確になる

### US-004: Kanban UIでのタスク管理
> **As a** VOWユーザー
> **I want to** タスクタブでKanbanボードを使ってスキルセットの状態を視覚的に管理したい
> **So that** TODO/進行中/完了の状態遷移を直感的に把握できる

### US-005: チャットからのタスク実行指示
> **As a** VOWユーザー
> **I want to** MOCチャットで「タスク実行をしてください」と発言することで、登録済みスキルセットをRemote CLIに実行させたい
> **So that** 複雑な作業を一言で開始できる

### US-006: Remote CLIからの進捗追跡
> **As a** VOWユーザー
> **I want to** Remote CLIからの進捗報告に基づいてKanbanカードが自動的に移動する
> **So that** タスクの進行状態をリアルタイムで確認できる

### US-007: タスクタブ内でのNote/Sticky'n新規作成
> **As a** VOWユーザー
> **I want to** タスクタブ内でNoteやSticky'nを新規作成できる（既存のものに加えて）
> **So that** タスクタブから離れずにスキルセットの内容を準備できる

---

## 3. Functional Requirements (機能要件)

### 3.1 Kanban Board UI

#### FR-001: タスクタブにKanban UIを導入

- MOCセクションのタスクタブ（`activeTab === 'tasks'`）の表示を、現在のリストビュー（`TaskListView`）からKanbanボードに置き換える
- 3カラム構成: **TODO** / **進行中 (In Progress)** / **完了 (Done)**
- Board.KanbanLayoutと同様のレスポンシブレイアウト:
  - デスクトップ: 3カラム横並び
  - モバイル: 水平スクロール + スナップ + インジケータドット

#### FR-002: スキルセットカードの表示

- 各カラムにスキルセットをカードとして表示する
- カードには以下の情報を含む:
  - スキルセット名（タイトル）
  - 紐づきGoal/Habitの名前（バッジ表示）
  - メインNote名（プロンプト名のプレビュー）
  - Sticky'nアイテム数（例: "4 steps"）
  - ステータスインジケータ（色付きドット）
  - 最終更新日時

#### FR-003: ドラッグ&ドロップでのカラム移動

- ユーザーがスキルセットカードをドラッグして別のカラムにドロップすることでステータスを変更できる
- デスクトップ: HTML5 Drag and Drop API
- モバイル: ロングプレス + タッチドラッグ
- ドロップ時のステータス遷移:
  - TODO → 進行中: 手動開始（Remote CLI実行はまだ起動しない）
  - 進行中 → 完了: 手動完了マーク
  - TODO ← 進行中: ステータスリセット
  - 進行中 ← 完了: ステータスリセット

#### FR-004: カラムヘッダー

- 各カラムにヘッダーを表示（日本語タイトル + カード数バッジ）
- TODOカラムに「+ 新規スキルセット」ボタンを配置

### 3.2 Skill Set (スキルセット) 構成

#### FR-010: スキルセットの構成要素

スキルセットは以下の要素で構成される:

| 要素 | 必須 | 説明 |
|------|------|------|
| 名前 (name) | YES | スキルセットのタイトル |
| メインNote | YES | カスタムプロンプト（Markdown形式のテキストブロック） |
| Sticky'nリスト | NO | 0〜N個のサブ指示/コンテキスト項目 |
| Goal紐づき | NO | 0〜N個のGoalとの関連 |
| Habit紐づき | NO | 0〜N個のHabitとの関連 |
| ステータス | YES | `todo` / `in_progress` / `done` |
| 説明 (description) | NO | スキルセットの概要説明 |

#### FR-011: Noteエンティティの新設

- 新規テーブル `notes` を作成する
- Note は再利用可能なテキストブロック（Markdown形式）
- フィールド:
  - `id` (TEXT, PK)
  - `title` (TEXT, NOT NULL) - ノートのタイトル
  - `content` (TEXT, NOT NULL) - Markdown形式の本文
  - `owner_type` (TEXT) - 所有者タイプ
  - `owner_id` (TEXT) - 所有者ID
  - `created_at` (TIMESTAMPTZ)
  - `updated_at` (TIMESTAMPTZ)
- RLSポリシーを設定（認証ユーザーのみ自分のデータにアクセス）

#### FR-012: スキルセットエンティティ

- 新規テーブル `skill_sets` を作成する
- フィールド:
  - `id` (TEXT, PK)
  - `name` (TEXT, NOT NULL) - スキルセット名
  - `description` (TEXT) - 概要説明
  - `note_id` (TEXT, FK → notes.id) - メインNoteへの参照
  - `status` (TEXT, DEFAULT 'todo') - `todo` / `in_progress` / `done`
  - `execution_result` (JSONB) - 実行結果（Remote CLIからの最終レポート）
  - `last_executed_at` (TIMESTAMPTZ) - 最終実行日時
  - `display_order` (INTEGER, DEFAULT 0) - 表示順
  - `owner_type` (TEXT) - 所有者タイプ
  - `owner_id` (TEXT) - 所有者ID
  - `created_at` (TIMESTAMPTZ)
  - `updated_at` (TIMESTAMPTZ)

#### FR-013: スキルセットとSticky'nの関連

- 新規テーブル `skill_set_stickies` を作成する
- フィールド:
  - `id` (TEXT, PK)
  - `skill_set_id` (TEXT, FK → skill_sets.id, ON DELETE CASCADE)
  - `sticky_id` (TEXT, FK → stickies.id, ON DELETE CASCADE)
  - `display_order` (INTEGER, DEFAULT 0) - スキルセット内での表示順
  - `owner_type` (TEXT)
  - `owner_id` (TEXT)
  - `created_at` (TIMESTAMPTZ)
  - UNIQUE(skill_set_id, sticky_id)

#### FR-014: スキルセットとGoalの関連

- 新規テーブル `skill_set_goals` を作成する
- フィールド:
  - `id` (TEXT, PK)
  - `skill_set_id` (TEXT, FK → skill_sets.id, ON DELETE CASCADE)
  - `goal_id` (TEXT, FK → goals.id, ON DELETE CASCADE)
  - `owner_type` (TEXT)
  - `owner_id` (TEXT)
  - `created_at` (TIMESTAMPTZ)
  - UNIQUE(skill_set_id, goal_id)

#### FR-015: スキルセットとHabitの関連

- 新規テーブル `skill_set_habits` を作成する
- フィールド:
  - `id` (TEXT, PK)
  - `skill_set_id` (TEXT, FK → skill_sets.id, ON DELETE CASCADE)
  - `habit_id` (TEXT, FK → habits.id, ON DELETE CASCADE)
  - `owner_type` (TEXT)
  - `owner_id` (TEXT)
  - `created_at` (TIMESTAMPTZ)
  - UNIQUE(skill_set_id, habit_id)

#### FR-016: 既存Note/Sticky'nの流用

- スキルセット作成/編集時に既存のNoteを選択できるセレクタUIを提供する
- スキルセット作成/編集時に既存のSticky'nを選択して紐づけできるUIを提供する
- 既存エンティティへの参照であり、コピーではない（変更が反映される）

#### FR-017: タスクタブ内での新規Note作成

- スキルセット作成ダイアログ内で「新規Note作成」ボタンを配置する
- インラインエディタでtitleとcontent（Markdown）を入力できる
- 作成されたNoteは `notes` テーブルに保存され、即座にスキルセットに紐づく

#### FR-018: タスクタブ内での新規Sticky'n作成

- スキルセット作成ダイアログ内で「新規Sticky'n追加」ボタンを配置する
- name（とオプションのdescription）を入力するインラインフォームを表示する
- 作成されたSticky'nは `stickies` テーブルに保存され、即座にスキルセットに紐づく

### 3.3 Remote CLI 実行連携

#### FR-020: チャットからのタスク実行トリガー

- MOCチャット（Remote CLIモード）でユーザーが「タスク実行をしてください」（またはそれに類する表現）と入力した場合、以下のフローを実行する:
  1. `skill_sets` テーブルからステータス `todo` のスキルセットを取得
  2. 複数ある場合はユーザーに選択UIを提示（クイックリプライボタン方式）
  3. 1つのみの場合はそのスキルセットで実行開始
  4. ユーザーが明示的にスキルセット名を指定した場合は名前で検索して実行

#### FR-021: スキルセットからプロンプトの組み立て

- 選択されたスキルセットの実行時、以下の順序でプロンプトを構築する:
  1. **コンテキスト**: 紐づきGoal/Habitの情報をヘッダーとして付与
  2. **メインプロンプト**: NoteのMarkdownコンテンツをそのまま挿入
  3. **サブ指示**: Sticky'nアイテムをdisplay_order順に番号付きリストとして追加
  4. **進捗報告指示**: Remote CLIへの進捗報告フォーマット指示を末尾に付与

#### FR-022: Remote CLIへのプロンプト送信

- 構築されたプロンプトをRemote CLIロールのMCPチャット経由で送信する
- 送信時にスキルセットのステータスを `in_progress` に更新
- Kanbanカードを「進行中」カラムに自動移動

#### FR-023: Remote CLIからの進捗報告によるステータス更新

- Remote CLIからのSSEレスポンスを解析し、進捗報告を検出する
- 進捗報告のフォーマット:
  ```json
  {
    "type": "skill_set_progress",
    "skillSetId": "<id>",
    "status": "in_progress" | "done" | "error",
    "progress": 0-100,
    "message": "ステップ2/4完了: テスト実行中"
  }
  ```
- `status: "done"` を受信した場合、スキルセットのステータスを `done` に更新
- `status: "error"` を受信した場合、エラー状態を表示しつつステータスは `in_progress` のまま維持

#### FR-024: 進捗バーのカード表示

- 進行中のスキルセットカードに進捗バー（0-100%）を表示する
- 進捗メッセージ（「ステップ2/4完了: テスト実行中」等）を表示する
- 進捗はリアルタイムで更新される（SSE経由）

#### FR-025: カード内から直接実行

- Kanbanカードのコンテキストメニュー（または実行ボタン）から直接スキルセットを実行できる
- チャットを経由せず、カードのアクションボタンで実行を開始する
- 実行開始時にRemote CLI接続が確認できない場合はエラーメッセージを表示

### 3.4 スキルセット詳細/編集モーダル

#### FR-030: スキルセット詳細モーダル

- Kanbanカードをクリック/タップすると詳細モーダルを表示する
- モーダルに表示する情報:
  - スキルセット名（編集可能）
  - 説明（編集可能）
  - メインNote（プレビュー + 切り替えボタン）
  - Sticky'nリスト（ドラッグで並び替え可能）
  - 紐づきGoal/Habit（追加/削除可能）
  - ステータス
  - 実行履歴（最終実行結果）
  - 「実行」ボタン

#### FR-031: Note選択/切り替え

- モーダル内でメインNoteを以下の方法で設定できる:
  - 既存Noteの一覧からドロップダウンで選択
  - 「新規作成」ボタンでインライン作成
  - 現在のNoteのプレビュー表示（Markdownレンダリング）
  - 「編集」ボタンでNote内容のインライン編集

#### FR-032: Sticky'n管理

- モーダル内でSticky'nアイテムを管理できる:
  - 既存Sticky'nの追加（検索 + 選択UI）
  - 新規Sticky'n作成（インラインフォーム）
  - ドラッグ&ドロップで表示順の変更
  - 個別Sticky'nの除外（紐づき解除、削除ではない）
  - チェックボックスで各Sticky'nの完了状態を表示

#### FR-033: Goal/Habit紐づけ管理

- モーダル内でGoal/Habitの紐づけを管理できる:
  - 既存Goal/Habitの追加（ドロップダウン選択）
  - 紐づき解除
  - 紐づきGoal/Habitの名前とアイコンを表示

---

## 4. Non-Functional Requirements (非機能要件)

### NFR-001: パフォーマンス
- Kanbanボードの初期描画は500ms以内
- ドラッグ&ドロップ操作のレスポンスは60fps
- スキルセット一覧の取得は1秒以内

### NFR-002: レスポンシブデザイン
- デスクトップ（768px以上）: 3カラム横並び表示
- モバイル（768px未満）: 1カラムずつ水平スクロール + スナップ + インジケータドット
- 既存Board Kanbanと同等のモバイル体験を提供する

### NFR-003: アクセシビリティ
- キーボード操作でのカラム間移動をサポート
- aria-labelの適切な設定
- フォーカストラップ（モーダル表示時）
- 色覚特性に配慮したステータス表示（色 + アイコン）

### NFR-004: データ整合性
- スキルセットのステータス変更はSupabaseに即時反映
- 楽観的更新（UI即時反映 + サーバー同期）を採用
- 競合発生時はサーバー側を優先

### NFR-005: セキュリティ
- RLSによるユーザー単位のデータ分離
- Remote CLI実行前のユーザー確認ダイアログ
- 破壊的操作の防止（既存のRemote CLI安全性ルールを適用）

---

## 5. UI/UX Design Guidelines (UI/UXガイドライン)

### 5.1 デザイントークン

既存のTailwind CSSクラスとデザイントークンに従う:

| 要素 | クラス |
|------|--------|
| カラム背景 | `bg-muted` |
| カラムヘッダー | `bg-card` |
| カード背景 | `bg-card` |
| カードボーダー | `border-border` |
| ドラッグ中ハイライト | `border-primary border-2 bg-primary/5` |
| TODOカラムアクセント | `border-warning/50 bg-warning/5` |
| 進行中カラムアクセント | `border-blue-500/50 bg-blue-500/5` |
| 完了カラムアクセント | `border-success/50 bg-success/5` |

### 5.2 カラム構成

```
+----------------+  +----------------+  +----------------+
|  TODO          |  |  進行中        |  |  完了          |
|  (3)           |  |  (1)           |  |  (2)           |
+----------------+  +----------------+  +----------------+
| [+ 新規]       |  |                |  |                |
|                |  | +-----------+  |  | +-----------+  |
| +-----------+  |  | | Skill A   |  |  | | Skill B   |  |
| | Skill C   |  |  | | [===--] 60%| | | | Done!     |  |
| | Note: ... |  |  | | Running...|  |  | | 2026-02-07|  |
| | 3 steps   |  |  | +-----------+  |  | +-----------+  |
| | #Goal1    |  |  |                |  |                |
| +-----------+  |  |                |  |                |
+----------------+  +----------------+  +----------------+
```

### 5.3 カードレイアウト

```
+------------------------------------------+
| [Status Dot] Skill Set Name       [Menu] |
|                                          |
| Note: "コードレビュープロンプト"         |
| Steps: 4 items                           |
|                                          |
| [#Goal1] [#Habit2]                       |
|                                          |
| [========--------] 60%                   |
| "ステップ3/4実行中..."                  |
+------------------------------------------+
```

---

## 6. Acceptance Criteria (受入基準)

### AC-001: Kanban UIの表示
- [ ] タスクタブを開くと3カラムのKanbanボードが表示される
- [ ] 各カラムにスキルセットカードが正しくグループ化されている
- [ ] カラムヘッダーにカード数バッジが表示される

### AC-002: カードのドラッグ&ドロップ
- [ ] デスクトップでカードをドラッグしてカラム間移動できる
- [ ] モバイルでロングプレス + タッチドラッグで移動できる
- [ ] ドロップ時にステータスが正しく更新される
- [ ] ドロップターゲットにハイライト表示がある

### AC-003: スキルセットの作成
- [ ] TODOカラムの「+ 新規」ボタンでスキルセット作成ダイアログが開く
- [ ] 名前、Note（新規/既存）、Sticky'n（新規/既存）を設定できる
- [ ] Goal/Habitを紐づけできる
- [ ] 作成後、TODOカラムにカードが追加される

### AC-004: チャットからのタスク実行
- [ ] Remote CLIモードで「タスク実行をしてください」と入力するとスキルセット選択UIが表示される
- [ ] スキルセット選択後、Remote CLIにプロンプトが送信される
- [ ] 送信と同時にKanbanカードが「進行中」に移動する

### AC-005: 進捗追跡
- [ ] Remote CLIからの進捗報告でカードの進捗バーが更新される
- [ ] 完了報告でカードが「完了」カラムに自動移動する
- [ ] エラー発生時にカードにエラー状態が表示される

### AC-006: Noteエンティティ
- [ ] 新規Noteを作成できる
- [ ] 既存Noteを選択してスキルセットに紐づけできる
- [ ] Noteの内容をMarkdownプレビューで確認できる
- [ ] Note内容をインライン編集できる

### AC-007: レスポンシブデザイン
- [ ] モバイル（768px未満）で水平スクロール + スナップが動作する
- [ ] インジケータドットが表示され、現在のカラムが示される
- [ ] デスクトップで3カラム横並び表示される

---

## 7. Out of Scope (スコープ外)

- **スキルセットの自動スケジューリング**: 時間指定での自動実行は含まない（手動またはチャットからのトリガーのみ）
- **複数スキルセットの同時実行**: 同時に1つのスキルセットのみ実行可能（キュー実行は将来拡張）
- **スキルセットのテンプレートライブラリ**: コミュニティ共有のテンプレートは含まない
- **Noteの独立管理UI**: Noteはスキルセットコンテキスト内でのみ作成/編集（将来的に独立タブを検討）
- **既存TaskListViewの廃止**: 既存のMCPタスクリストは別途残す可能性あり（設計フェーズで決定）

---

## 8. Dependencies (依存関係)

| 依存先 | バージョン | 用途 |
|--------|-----------|------|
| Board.KanbanLayout | 既存 | UIパターンの参照（直接再利用ではなく新規実装） |
| useKanbanDragDrop | 既存 | ドラッグ&ドロップhookの参照（汎用化して再利用） |
| useMobileSwipe | 既存 | モバイルスワイプhookの再利用 |
| useMcpChat | 既存 | Remote CLIとの通信 |
| useRoleSelection | 既存 | Remote CLIロールの検出 |
| Supabase | 既存 | データベースとRLS |
| Section.MOC.tsx | 既存 | 統合先コンポーネント |
| moc.types.ts | 既存 | タブ型定義の拡張 |

---

## 9. Glossary (用語集)

| 用語 | 定義 |
|------|------|
| **スキルセット (Skill Set)** | 1つのNote（メインプロンプト）と0〜N個のSticky'n（サブ指示）で構成される実行可能なタスク単位 |
| **Note** | Markdown形式のテキストブロック。スキルセットのメインプロンプトとして使用される |
| **Sticky'n** | 既存のTODOアイテム。スキルセット内ではサブ指示やコンテキスト情報として機能する |
| **Kanbanカード** | Kanbanボード上でスキルセットを表すUI要素 |
| **Remote CLI** | MCPサーバ経由で接続されたClaude Code CLIインスタンス |
| **進捗報告** | Remote CLIからSSE経由で送信されるスキルセット実行の進捗情報 |
