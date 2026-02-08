# MOC Task Kanban + Remote CLI Skill Set - Implementation Tasks

## Overview

- **Purpose**: 実装タスクの分解と並列化可能な単位への整理
- **Status**: Draft
- **Version**: 1.0
- **Last Updated**: 2026-02-07
- **Author**: vow-spec-architect
- **Spec ID**: MOC-TASK-KANBAN-001
- **Estimated Total Effort**: 30-35 hours

---

## Phase 0: Database & Types Foundation (基盤)

**推定時間**: 5時間
**前提条件**: なし
**並列化**: Phase 0のTask 0.1〜0.3は並列実行可能

### Task 0.1: Supabase Migration

- **担当可能**: any agent
- **推定時間**: 1.5時間
- **作成ファイル**: `supabase/migrations/YYYYMMDDHHMMSS_add_skill_sets.sql`
- **作業内容**:
  - [ ] `notes` テーブル作成（id, title, content, owner_type, owner_id, timestamps）
  - [ ] `skill_sets` テーブル作成（id, name, description, note_id FK, status, execution_result, last_executed_at, display_order, owner_type, owner_id, timestamps）
  - [ ] `skill_set_stickies` 関連テーブル作成（skill_set_id FK, sticky_id FK, display_order）
  - [ ] `skill_set_goals` 関連テーブル作成（skill_set_id FK, goal_id FK）
  - [ ] `skill_set_habits` 関連テーブル作成（skill_set_id FK, habit_id FK）
  - [ ] 全テーブルにRLSポリシー設定（owner_type/owner_idベース、既存stickiesと同パターン）
  - [ ] インデックス作成（owner, status, note_id, FK列）
  - [ ] updated_atトリガー（notes, skill_sets）
- **受入基準**:
  - `supabase db push` または `supabase migration up` でエラーなく適用される
  - RLSが有効で、別ユーザーのデータにアクセスできない
- **参考ファイル**: `supabase/migrations/20260116000000_add_stickies.sql`（パターン参照）

### Task 0.2: TypeScript Type Definitions

- **担当可能**: any agent
- **推定時間**: 1時間
- **作成ファイル**: `frontend/app/dashboard/types/skill-set.types.ts`
- **変更ファイル**: `frontend/app/dashboard/types/index.ts`（export追加）
- **作業内容**:
  - [ ] `Note` interface
  - [ ] `CreateNotePayload`, `UpdateNotePayload` interfaces
  - [ ] `SkillSetStatus` type
  - [ ] `SkillSet` interface（note, stickies, goals, habits のJOIN型含む）
  - [ ] `SkillSetStickyItem` interface
  - [ ] `CreateSkillSetPayload`, `UpdateSkillSetPayload` interfaces
  - [ ] `SkillSetExecutionResult` interface
  - [ ] `SkillSetProgressReport` interface
  - [ ] `TaskKanbanColumnId` type
  - [ ] `TaskKanbanColumnConfig` interface
  - [ ] `TASK_KANBAN_COLUMNS` constant
  - [ ] `index.ts` にNoteのexport追加
- **受入基準**:
  - TypeScript コンパイルエラーなし
  - 既存型との整合性（Goal, Habit, Sticky型を参照）

### Task 0.3: Zod Validation Schemas

- **担当可能**: any agent
- **推定時間**: 0.5時間
- **作成ファイル**:
  - `backend/src/schemas/skillSet.ts`
  - `backend/src/schemas/note.ts`
- **作業内容**:
  - [ ] `createSkillSetSchema` Zodスキーマ
  - [ ] `updateSkillSetSchema` Zodスキーマ
  - [ ] `changeStatusSchema` Zodスキーマ
  - [ ] `createNoteSchema` Zodスキーマ
  - [ ] `updateNoteSchema` Zodスキーマ
- **受入基準**:
  - バリデーションテスト（正常系/異常系）がパス
- **参考ファイル**: `backend/src/schemas/` 内の既存ファイル

---

## Phase 1: Backend API (バックエンドAPI)

**推定時間**: 6時間
**前提条件**: Phase 0完了
**並列化**: Task 1.1と1.2は並列実行可能。Task 1.3はTask 1.1に依存

### Task 1.1: Note Repository & Router

- **担当可能**: backend agent
- **推定時間**: 2時間
- **作成ファイル**:
  - `backend/src/repositories/noteRepository.ts`
  - `backend/src/routers/notes.ts`
- **変更ファイル**: `backend/src/index.ts`（ルーター登録）
- **作業内容**:
  - [ ] `NoteRepository` クラス
    - `findAll(ownerId: string): Promise<Note[]>`
    - `findById(id: string): Promise<Note | null>`
    - `create(payload: CreateNotePayload, ownerId: string): Promise<Note>`
    - `update(id: string, payload: UpdateNotePayload): Promise<void>`
    - `delete(id: string): Promise<void>`
  - [ ] Express ルーター: GET /notes, GET /notes/:id, POST /notes, PUT /notes/:id, DELETE /notes/:id
  - [ ] 認証ミドルウェア適用
  - [ ] Zodバリデーション適用
  - [ ] `index.ts` にルーター登録
- **受入基準**:
  - 全エンドポイントが認証済みユーザーで正常に動作
  - 未認証リクエストで401返却
  - バリデーションエラーで400返却
- **参考ファイル**: `backend/src/routers/` 内の既存ルーター

### Task 1.2: Skill Set Repository

- **担当可能**: backend agent
- **推定時間**: 3時間
- **作成ファイル**:
  - `backend/src/repositories/skillSetRepository.ts`
- **作業内容**:
  - [ ] `SkillSetRepository` クラス
    - `findAll(ownerId: string): Promise<SkillSet[]>` - JOIN: notes, skill_set_stickies+stickies, skill_set_goals+goals, skill_set_habits+habits
    - `findById(id: string): Promise<SkillSet | null>` - 同上
    - `findByStatus(ownerId: string, status: SkillSetStatus): Promise<SkillSet[]>`
    - `create(payload: CreateSkillSetPayload, ownerId: string): Promise<SkillSet>` - 関連テーブルへの同時INSERT
    - `update(id: string, payload: UpdateSkillSetPayload): Promise<void>` - 関連テーブルのINSERT/DELETE含む
    - `changeStatus(id: string, status: SkillSetStatus): Promise<void>`
    - `delete(id: string): Promise<void>` - CASCADE削除
    - `updateExecutionResult(id: string, result: SkillSetExecutionResult): Promise<void>`
  - [ ] Supabase clientのJOINクエリ構築
  - [ ] 関連テーブル操作のトランザクション的処理
- **受入基準**:
  - findAllで全JOIN結果が正しく構造化されている
  - createで関連テーブルにも正しくINSERTされる
  - updateでadd/removeが正しく動作する
  - deleteでCASCADE削除が動作する

### Task 1.3: Skill Set Router

- **担当可能**: backend agent
- **推定時間**: 1時間
- **前提条件**: Task 1.2完了
- **作成ファイル**:
  - `backend/src/routers/skillSets.ts`
- **変更ファイル**: `backend/src/index.ts`（ルーター登録）
- **作業内容**:
  - [ ] Express ルーター:
    - GET /skill-sets - 一覧取得
    - GET /skill-sets/:id - 詳細取得
    - POST /skill-sets - 作成
    - PUT /skill-sets/:id - 更新
    - DELETE /skill-sets/:id - 削除
    - PATCH /skill-sets/:id/status - ステータス変更
    - POST /skill-sets/:id/execute - 実行開始
  - [ ] 認証ミドルウェア適用
  - [ ] Zodバリデーション適用
  - [ ] `index.ts` にルーター登録
- **受入基準**:
  - 全エンドポイントが正常に動作
  - execute エンドポイントがプロンプトを構築して返却する

---

## Phase 2: Frontend Data Layer (フロントエンドデータ層)

**推定時間**: 5時間
**前提条件**: Phase 0 Task 0.2完了（型定義）
**並列化**: Task 2.1〜2.4は並列実行可能（Phase 1のバックエンドAPIをモック/スタブで開発可能）

### Task 2.1: Frontend API Client Extension

- **担当可能**: frontend agent
- **推定時間**: 0.5時間
- **変更ファイル**: `frontend/lib/api.ts`
- **作業内容**:
  - [ ] `skillSets` APIメソッド群を追加（list, get, create, update, delete, changeStatus, execute）
  - [ ] `notes` APIメソッド群を追加（list, get, create, update, delete）
- **受入基準**:
  - TypeScriptコンパイルエラーなし
  - 正しいHTTPメソッドとパスでリクエストが送信される

### Task 2.2: useNotes Hook

- **担当可能**: frontend agent
- **推定時間**: 1時間
- **作成ファイル**: `frontend/app/dashboard/hooks/useNotes.ts`
- **作業内容**:
  - [ ] `useNotes` hook実装
    - notes state管理
    - CRUD操作（createNote, updateNote, deleteNote）
    - 初回ロード時のfetch
    - エラーハンドリング
    - ローディング状態
- **受入基準**:
  - Note一覧の取得・表示が正常に動作
  - CRUD操作が楽観的更新で動作

### Task 2.3: useSkillSets Hook

- **担当可能**: frontend agent
- **推定時間**: 2時間
- **作成ファイル**: `frontend/app/dashboard/hooks/useSkillSets.ts`
- **作業内容**:
  - [ ] `useSkillSets` hook実装
    - skillSets state管理（JOIN結果を含む完全なSkillSet配列）
    - CRUD操作（createSkillSet, updateSkillSet, deleteSkillSet）
    - ステータス変更ショートカット（changeStatus）
    - 初回ロード時のfetch
    - 楽観的更新パターン
    - エラーハンドリング + ロールバック
    - ローディング状態
- **受入基準**:
  - スキルセット一覧がJOIN結果を含んで正しく取得される
  - ステータス変更が楽観的に更新され、失敗時にロールバックされる
  - CRUD操作が正常に動作する

### Task 2.4: useTaskKanbanDragDrop Hook

- **担当可能**: frontend agent
- **推定時間**: 1.5時間
- **作成ファイル**: `frontend/app/dashboard/hooks/useTaskKanbanDragDrop.ts`
- **作業内容**:
  - [ ] `useTaskKanbanDragDrop` hook実装
    - ドラッグ状態管理（draggedCardId, dropTargetColumn, sourceColumn, isDragging）
    - デスクトップ: handleDragStart/End/Over/Leave/Drop
    - モバイル: handleTouchStart/Move/End（ロングプレス検出含む）
    - ドロップ時のstatusChangeコールバック呼び出し
    - ドラッグ中のビジュアルフィードバック情報
  - [ ] 既存 `useKanbanDragDrop` のコアロジックを参照しつつ、HabitAction非依存の汎用版として実装
- **受入基準**:
  - デスクトップでドラッグ&ドロップが動作する
  - モバイルでロングプレス + タッチドラッグが動作する
  - ドロップ時にstatusChangeコールバックが正しいパラメータで呼ばれる
- **参考ファイル**: `frontend/app/dashboard/hooks/useKanbanDragDrop.ts`

---

## Phase 3: Kanban UI Components (カンバンUIコンポーネント)

**推定時間**: 8時間
**前提条件**: Phase 0 Task 0.2完了（型定義）、Phase 2 Task 2.4完了（D&D hook）
**並列化**: Task 3.1〜3.3は並列実行可能（ただしTask 3.4はTask 3.1-3.3に依存）

### Task 3.1: MOC.SkillSetCard Component

- **担当可能**: frontend agent
- **推定時間**: 2時間
- **作成ファイル**: `frontend/app/dashboard/components/MOC.SkillSetCard.tsx`
- **作業内容**:
  - [ ] カードコンポーネント実装
    - ステータスドット（色: todo=warning, in_progress=blue, done=success）
    - タイトル表示
    - コンテキストメニューボタン（編集/削除/実行）
    - Noteプレビュー（"Note: {title}"）
    - Sticky数表示（"{count} steps"）
    - Goal/Habitバッジ（タグ形式）
    - 進捗バー（in_progressかつprogress情報がある場合）
    - 進捗メッセージ表示
    - ドラッグハンドル
    - draggable属性
    - isDragging時の透明度変更
  - [ ] コンテキストメニューの実装（ポップオーバーまたはドロップダウン）
  - [ ] ドラッグイベントハンドラの接続
- **受入基準**:
  - カードが正しく表示される（全情報が含まれる）
  - ドラッグ可能である
  - コンテキストメニューが動作する
  - 進捗バーがアニメーションする
- **参考ファイル**: `frontend/app/dashboard/components/Board.HabitCard.tsx`

### Task 3.2: MOC.TaskKanbanColumn Component

- **担当可能**: frontend agent
- **推定時間**: 1.5時間
- **作成ファイル**: `frontend/app/dashboard/components/MOC.TaskKanbanColumn.tsx`
- **作業内容**:
  - [ ] カラムコンポーネント実装
    - カラムヘッダー（タイトル + カード数バッジ）
    - カード一覧描画（SkillSetCardの配列）
    - ドロップターゲットスタイリング（isDragOver時のハイライト）
    - 空状態表示（「スキルセットがありません」）
    - TODOカラムの「+ 新規スキルセット」ボタン
    - ドラッグイベントハンドラ（onDragOver, onDragLeave, onDrop）
  - [ ] カラムのアクセントカラー設定（columnConfigから）
- **受入基準**:
  - カラムヘッダーが正しく表示される
  - ドロップターゲットハイライトが表示される
  - 空状態が正しく表示される
  - TODOカラムに「+ 新規」ボタンがある
- **参考ファイル**: `frontend/app/dashboard/components/Board.KanbanColumn.tsx`

### Task 3.3: MOC.TaskKanban Component (Main Board)

- **担当可能**: frontend agent
- **推定時間**: 2.5時間
- **作成ファイル**: `frontend/app/dashboard/components/MOC.TaskKanban.tsx`
- **前提条件**: Task 3.1, 3.2が存在する前提（interface参照のみ）
- **作業内容**:
  - [ ] Kanbanボード全体レイアウト
    - 3カラムのflex配置（デスクトップ/モバイル対応）
    - スクロールコンテナの設定
    - モバイルスナップスクロール
    - カラムインジケータドット（モバイル）
    - カラムラベル（モバイル）
  - [ ] useTaskKanbanDragDrop hookの統合
  - [ ] useMobileSwipe hookの統合（既存hookの再利用）
  - [ ] オートスクロール（ドラッグ中のエッジスクロール）
  - [ ] スキルセットのステータス別グルーピング
  - [ ] モーダル制御（新規作成/編集/詳細）
  - [ ] propsの受け渡し
- **受入基準**:
  - 3カラムレイアウトが正しく表示される
  - モバイルでスワイプナビゲーションが動作する
  - ドラッグ&ドロップが動作する（ステータス変更）
  - カード数に応じてカラムバッジが更新される
- **参考ファイル**: `frontend/app/dashboard/components/Board.KanbanLayout.tsx`

### Task 3.4: Section.MOC.tsx Integration

- **担当可能**: frontend agent
- **推定時間**: 2時間
- **変更ファイル**: `frontend/app/dashboard/components/Section.MOC.tsx`
- **前提条件**: Task 3.3完了、Phase 2完了
- **作業内容**:
  - [ ] `useSkillSets` hookの呼び出し追加
  - [ ] `useNotes` hookの呼び出し追加
  - [ ] `useSkillSetExecution` hookの呼び出し追加（Task 5.2完了後）
  - [ ] `activeTab === 'tasks'` セクションの変更
    - 既存 `TaskListView` を `MOC.TaskKanban` に置き換え
    - 必要なpropsの接続
  - [ ] MCP接続状態の`isRemoteCliConnected`プロップとして転送
  - [ ] 新規Sticky'n作成時の既存 `onStickyCreated` との連携
  - [ ] import文の追加
- **受入基準**:
  - タスクタブでKanbanボードが表示される
  - データが正しく取得・表示される
  - スキルセットのCRUD操作が動作する
  - Remote CLI接続状態が正しく伝播する

---

## Phase 4: Skill Set Modal (スキルセットモーダル)

**推定時間**: 6時間
**前提条件**: Phase 0 Task 0.2完了
**並列化**: Phase 3と並列実行可能（独立したコンポーネント）

### Task 4.1: Modal.SkillSet - Base Structure

- **担当可能**: frontend agent
- **推定時間**: 2時間
- **作成ファイル**: `frontend/app/dashboard/components/Modal.SkillSet.tsx`
- **作業内容**:
  - [ ] モーダル基本構造（create/edit/viewモード）
    - オーバーレイ + カード
    - ヘッダー（タイトル + 閉じるボタン）
    - フッター（キャンセル/保存/削除ボタン）
    - フォーカストラップ
    - ESCキーで閉じる
  - [ ] 名前入力フィールド
  - [ ] 説明入力フィールド（textarea）
  - [ ] ステータス表示（view/editモード）
  - [ ] モード別のボタン表示制御
  - [ ] フォームstate管理
- **受入基準**:
  - モーダルが開閉する
  - 名前と説明の入力が動作する
  - create/edit/viewモードで適切にUI切り替えされる
- **参考ファイル**: `frontend/app/dashboard/components/Modal.Sticky.tsx`

### Task 4.2: Modal.SkillSet - Note Selector & Editor

- **担当可能**: frontend agent
- **推定時間**: 2時間
- **変更ファイル**: `frontend/app/dashboard/components/Modal.SkillSet.tsx`
- **作業内容**:
  - [ ] Noteセレクター
    - 既存Note一覧のドロップダウン選択
    - 選択時にNoteをセット
    - 「クリア」ボタン（Note紐づき解除）
  - [ ] Note新規作成インラインフォーム
    - 「+ 新規作成」ボタンでフォーム表示
    - title入力
    - content入力（Markdownエディタ / textarea）
    - 「作成」ボタンでNote作成 → 即座にスキルセットに紐づけ
  - [ ] Noteプレビュー
    - 選択されたNoteのMarkdownレンダリング表示
    - ReactMarkdown使用
  - [ ] Note編集モード
    - 「編集」ボタンでtextareaに切り替え
    - 保存で更新
- **受入基準**:
  - 既存Noteをドロップダウンから選択できる
  - 新規Noteをインラインで作成できる
  - NoteのMarkdownプレビューが表示される
  - Noteの内容をインライン編集できる

### Task 4.3: Modal.SkillSet - Sticky Selector & Goal/Habit Linker

- **担当可能**: frontend agent
- **推定時間**: 2時間
- **変更ファイル**: `frontend/app/dashboard/components/Modal.SkillSet.tsx`
- **作業内容**:
  - [ ] Sticky'nセレクター
    - 既存Sticky'n一覧からの追加（検索フィルタ + チェックボックス）
    - 新規Sticky'n作成インラインフォーム
    - 選択済みSticky'nリスト表示
    - ドラッグ&ドロップで表示順変更（簡易的にボタンでUp/Downも可）
    - 個別Sticky'nの除外ボタン
    - 各Sticky'nの完了チェックボックス表示
  - [ ] Goal紐づけUI
    - 既存Goal一覧のドロップダウン
    - 選択済みGoalのバッジ表示（x削除ボタン付き）
  - [ ] Habit紐づけUI
    - 既存Habit一覧のドロップダウン
    - 選択済みHabitのバッジ表示（x削除ボタン付き）
  - [ ] 実行履歴セクション
    - 最終実行日時
    - 実行結果（成功/失敗/メッセージ）
  - [ ] 「実行する」ボタン
    - Remote CLI接続時のみ有効
    - 未接続時はグレーアウト + ツールチップ
    - Note未設定時は無効
- **受入基準**:
  - Sticky'nの追加/除外/並び替えが動作する
  - 新規Sticky'n作成が動作する
  - Goal/Habitの追加/削除が動作する
  - 実行ボタンが適切な条件で有効/無効になる

---

## Phase 5: Remote CLI Execution Integration (リモートCLI実行連携)

**推定時間**: 5時間
**前提条件**: Phase 2 Task 2.3完了、Phase 3 Task 3.4完了
**並列化**: Task 5.1と5.2は順次実行

### Task 5.1: Prompt Builder

- **担当可能**: any agent
- **推定時間**: 1.5時間
- **作成ファイル**: `frontend/app/dashboard/utils/skillSetPromptBuilder.ts`
- **作業内容**:
  - [ ] `buildExecutionPrompt(skillSet: SkillSet): string` 関数
    - コンテキスト部分（Goal/Habit情報）
    - メインプロンプト部分（NoteのMarkdownコンテンツ）
    - サブ指示部分（Sticky'nリスト → 番号付きリスト）
    - 進捗報告指示部分（JSONフォーマット指定）
  - [ ] ユニットテスト
    - 全要素がある場合
    - Note のみの場合
    - Sticky'nのみの場合
    - Goal/Habitが空の場合
- **受入基準**:
  - 全パターンで正しいプロンプトが生成される
  - テストがパスする

### Task 5.2: useSkillSetExecution Hook

- **担当可能**: frontend agent
- **推定時間**: 2.5時間
- **作成ファイル**: `frontend/app/dashboard/hooks/useSkillSetExecution.ts`
- **作業内容**:
  - [ ] `useSkillSetExecution` hook実装
    - `execute(skillSet: SkillSet)`:
      1. プロンプトビルダーでプロンプト構築
      2. スキルセットステータスを `in_progress` に更新
      3. Remote CLIにプロンプトをsendMessage
      4. executingSkillSetIdをセット
    - `cancel()`: 実行キャンセル
    - `handleMessage(message: MastraMessage)`:
      1. メッセージから`SkillSetProgressReport`を抽出
      2. progressMapを更新
      3. `status: "done"`検出時にスキルセットステータスを`done`に更新
      4. `status: "error"`検出時にエラー状態表示
  - [ ] `extractProgressReport(message: MastraMessage): SkillSetProgressReport | null`
    - toolCalls出力からの検出
    - メッセージ本文内JSONブロックからの検出
  - [ ] Section.MOC.tsxのonMessageコールバックへの統合ポイント
- **受入基準**:
  - プロンプトが正しくRemote CLIに送信される
  - 進捗報告が検出されprogressMapが更新される
  - 完了報告でステータスが`done`に変わる
  - Remote CLI未接続時にエラーが表示される

### Task 5.3: Chat Task Execution Trigger

- **担当可能**: frontend agent
- **推定時間**: 1時間
- **変更ファイル**: `frontend/app/dashboard/components/Section.MOC.tsx`
- **作業内容**:
  - [ ] タスク実行リクエスト検出ロジック
    - `isTaskExecutionRequest(message: string): boolean`
    - 日本語/英語パターンマッチング
  - [ ] チャット送信ハンドラへの統合
    - Remote CLIモード時のみ検出動作
    - TODOスキルセットが0件の場合のメッセージ
    - 1件の場合の自動実行
    - 複数件の場合の選択UIクイックリプライ
  - [ ] 選択UIのクイックリプライボタン生成
    - スキルセット名をラベルとするボタン群
    - ボタンクリックで該当スキルセットを実行
- **受入基準**:
  - 「タスク実行をしてください」で検出される
  - 英語の "execute task" でも検出される
  - スキルセット選択UIが表示される
  - 選択後にRemote CLIにプロンプトが送信される

---

## Phase 6: Testing & Polish (テストと仕上げ)

**推定時間**: 5時間
**前提条件**: Phase 1-5完了
**並列化**: Task 6.1〜6.3は並列実行可能

### Task 6.1: Unit Tests

- **担当可能**: tester agent
- **推定時間**: 2時間
- **作成ファイル**:
  - `frontend/app/dashboard/__tests__/useSkillSets.test.ts`
  - `frontend/app/dashboard/__tests__/useNotes.test.ts`
  - `frontend/app/dashboard/__tests__/skillSetPromptBuilder.test.ts`
  - `backend/src/__tests__/skillSetRepository.test.ts`
  - `backend/src/__tests__/noteRepository.test.ts`
- **作業内容**:
  - [ ] useSkillSets hookのテスト（CRUD操作、楽観的更新、エラーハンドリング）
  - [ ] useNotes hookのテスト
  - [ ] skillSetPromptBuilderのテスト（全パターン）
  - [ ] SkillSetRepositoryのテスト（JOIN, CRUD, CASCADE）
  - [ ] NoteRepositoryのテスト

### Task 6.2: Integration Tests

- **担当可能**: tester agent
- **推定時間**: 1.5時間
- **作成ファイル**:
  - `frontend/app/dashboard/__tests__/MOC.TaskKanban.integration.test.tsx`
- **作業内容**:
  - [ ] Kanbanボードの描画テスト（3カラム表示、カード配置）
  - [ ] ドラッグ&ドロップのテスト（ステータス変更）
  - [ ] モーダルの開閉テスト
  - [ ] スキルセット作成フローテスト

### Task 6.3: Mobile UX Polish

- **担当可能**: frontend agent
- **推定時間**: 1.5時間
- **変更ファイル**: `frontend/app/dashboard/components/MOC.TaskKanban.tsx` 他
- **作業内容**:
  - [ ] モバイルスワイプの調整
  - [ ] タッチドラッグの感度調整
  - [ ] カードのタッチターゲットサイズ確認（44px以上）
  - [ ] モーダルのモバイル最適化（フルスクリーン表示）
  - [ ] 進捗バーのアニメーション（CSS transition）
  - [ ] ローディングスケルトン表示

---

## Task Dependency Graph (タスク依存関係図)

```
Phase 0 (Foundation)
  [0.1] Migration ────────────────────────┐
  [0.2] Type Definitions ──┬──────────────┤
  [0.3] Zod Schemas ───────┤              │
                           │              │
Phase 1 (Backend)          │              │
  [1.1] Note Repo/Router ──┼── (0.1,0.3) │
  [1.2] SkillSet Repo ─────┤── (0.1,0.3) │
  [1.3] SkillSet Router ───┘── (1.2)     │
                                          │
Phase 2 (Frontend Data)                   │
  [2.1] API Client ────────┬── (0.2)     │
  [2.2] useNotes ──────────┤── (0.2)     │
  [2.3] useSkillSets ──────┤── (0.2)     │
  [2.4] useTaskKanbanDD ───┘── (0.2)     │
                                          │
Phase 3 (Kanban UI)                       │
  [3.1] SkillSetCard ──────┬── (0.2)     │
  [3.2] TaskKanbanColumn ──┤── (0.2)     │
  [3.3] TaskKanban ─────────┤── (2.4, 3.1, 3.2)
  [3.4] Section.MOC ───────┘── (3.3, 2.3, 2.2)
                                          │
Phase 4 (Modal) - parallel with Phase 3   │
  [4.1] Modal Base ─────────┬── (0.2)    │
  [4.2] Note Selector ──────┤── (4.1)    │
  [4.3] Sticky/Goal Linker ─┘── (4.1)    │
                                          │
Phase 5 (Execution)                       │
  [5.1] Prompt Builder ─────┬── (0.2)    │
  [5.2] useSkillSetExec ────┤── (5.1, 2.3)
  [5.3] Chat Trigger ───────┘── (5.2, 3.4)
                                          │
Phase 6 (Testing)                         │
  [6.1] Unit Tests ─────────┬── (1-5)    │
  [6.2] Integration Tests ──┤── (3.4, 4) │
  [6.3] Mobile Polish ──────┘── (3.3)    │
```

---

## Parallel Execution Recommendations (並列実行の推奨)

### Wave 1 (同時実行: 3 agents)
- **Agent A (backend)**: Task 0.1 (Migration) → Task 1.1 → Task 1.2 → Task 1.3
- **Agent B (frontend)**: Task 0.2 (Types) → Task 2.1 → Task 2.2 → Task 2.3
- **Agent C (frontend)**: Task 0.3 (Schemas) → Task 2.4 → Task 3.1

### Wave 2 (同時実行: 3 agents)
- **Agent A (frontend)**: Task 3.2 → Task 3.3 → Task 3.4
- **Agent B (frontend)**: Task 4.1 → Task 4.2 → Task 4.3
- **Agent C (frontend)**: Task 5.1 → Task 5.2

### Wave 3 (同時実行: 2-3 agents)
- **Agent A**: Task 5.3
- **Agent B (tester)**: Task 6.1 → Task 6.2
- **Agent C (frontend)**: Task 6.3

### Estimated Timeline (並列実行時)
- **Wave 1**: 8-10 hours
- **Wave 2**: 6-8 hours
- **Wave 3**: 3-4 hours
- **Total**: 17-22 hours (vs 30-35 hours sequential)

---

## Agent Coordination Notes (エージェント間調整メモ)

### File Ownership Rules

| ファイル | 所有Agent | 競合リスク |
|---------|----------|-----------|
| `supabase/migrations/*` | Agent A (backend) | 低 |
| `frontend/app/dashboard/types/skill-set.types.ts` | Agent B (frontend) | 低（早期確定） |
| `frontend/app/dashboard/components/Section.MOC.tsx` | Agent A (Wave 2) | **高** - 他タスクとの競合注意 |
| `frontend/lib/api.ts` | Agent B (frontend) | 中 - 他機能との競合可能性 |
| `backend/src/index.ts` | Agent A (backend) | 中 - ルーター登録で競合可能性 |

### Integration Points

1. **Task 3.4 (Section.MOC Integration)** は最後に統合するのが安全。全コンポーネントとhookが完成してからSection.MOCに統合する
2. **Task 5.2 (useSkillSetExecution)** はSection.MOCのonMessageコールバックへの統合が必要。Task 3.4と同一agentが担当するのが効率的
3. **型定義 (Task 0.2)** は最優先で確定させ、他agentが参照できるようにする
