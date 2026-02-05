# QA Patrol Agent - Test Coverage Design

## Overview
- **Purpose**: MOCセクションの候補ボタン機能を網羅するブラックボックステスト設計
- **Status**: Draft
- **Version**: 1.0.0
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect

---

## 1. Coverage Target Summary

### 1.1 SuggestionButtonType Coverage

| 型 | 説明 | 実装ファイル位置 | テスト対象 |
|----|------|-----------------|-----------|
| `habit` | 習慣候補カード | Section.MOC.tsx:58 | BTN-001 - BTN-010 |
| `goal` | 目標候補カード | Section.MOC.tsx:58 | BTN-011 - BTN-020 |
| `stickyn` | スティッキーノート候補 | Section.MOC.tsx:58 | BTN-021 - BTN-025 |
| `category` | カテゴリ選択ボタン | Section.MOC.tsx:58 | BTN-026 - BTN-035 |
| `text` | テキストボタン | Section.MOC.tsx:58 | BTN-036 - BTN-040 |
| `reply` | クイックリプライ | Section.MOC.tsx:58 | BTN-041 - BTN-045 |

### 1.2 RefineActionType Coverage

| アクション | 説明 | テスト対象 |
|------------|------|-----------|
| `more_specific` | もっと具体的に | ACT-001 - ACT-005 |
| `easier` | もっとかんたんに | ACT-006 - ACT-010 |
| `harder` | もっと難しく | ACT-011 - ACT-015 |
| `different` | もっとアレンジして | ACT-016 - ACT-020 |
| `more_suggestions` | 他には | ACT-021 - ACT-025 |
| `different_habit` | 別の習慣を提案 | ACT-026 - ACT-030 |

### 1.3 DrilldownStep Coverage

| ステップ | 説明 | selectionType | テスト対象 |
|----------|------|---------------|-----------|
| `genre_selection` | ジャンル選択 | `drilldown_genre` | DRL-001 - DRL-010 |
| `purpose_selection` | 目的選択 | `drilldown_purpose` | DRL-011 - DRL-020 |
| `response_type_selection` | 回答型選択 | `drilldown_response_type` | DRL-021 - DRL-030 |

---

## 2. Button Type Coverage Matrix

### 2.1 Habit Button Tests (BTN-001 - BTN-010)

| 機能ID | 機能名 | テスト質問 | 期待する候補ボタン型 | 検証ポイント |
|--------|--------|-----------|-------------------|-------------|
| BTN-001 | Habit直接提案（健康） | 「運動の習慣を提案して」 | habit | suggest_habits ツールコール |
| BTN-002 | Habit直接提案（学習） | 「読書の習慣を提案して」 | habit | 習慣カード表示 |
| BTN-003 | Habit直接提案（生活） | 「朝活の習慣を提案して」 | habit | 頻度・時間情報含む |
| BTN-004 | Habit複数候補 | 「習慣をいくつか提案して」 | habit (複数) | 3件以上の候補 |
| BTN-005 | Habit具体的要求 | 「5分でできる習慣」 | habit | 所要時間5分以下 |
| BTN-006 | Habit時間指定 | 「朝7時にやる習慣」 | habit | 時間情報含む |
| BTN-007 | Habit頻度指定 | 「週3回の習慣」 | habit | 頻度情報含む |
| BTN-008 | Habit避けるタイプ | 「やめたい習慣を提案して」 | habit | type: 'avoid' |
| BTN-009 | Habit段階的 | 「初心者向けの習慣」 | habit | 難易度: easy |
| BTN-010 | Habit上級者向け | 「チャレンジングな習慣」 | habit | 難易度: hard |

### 2.2 Goal Button Tests (BTN-011 - BTN-020)

| 機能ID | 機能名 | テスト質問 | 期待する候補ボタン型 | 検証ポイント |
|--------|--------|-----------|-------------------|-------------|
| BTN-011 | Goal直接提案（健康） | 「ダイエットの目標を提案して」 | goal | suggest_goals ツールコール |
| BTN-012 | Goal直接提案（キャリア） | 「キャリアの目標を提案して」 | goal | 目標カード表示 |
| BTN-013 | Goal期間指定 | 「3ヶ月で達成できる目標」 | goal | 期間3ヶ月 |
| BTN-014 | Goal数値目標 | 「体重5kg減の目標」 | goal | 数値目標含む |
| BTN-015 | Goal複数候補 | 「目標をいくつか提案して」 | goal (複数) | 3件以上の候補 |
| BTN-016 | Goal段階的 | 「小さな目標から始めたい」 | goal | ステップ分解 |
| BTN-017 | Goal長期 | 「1年後の目標を設定」 | goal | 期間1年 |
| BTN-018 | Goal短期 | 「今週の目標」 | goal | 期間1週間 |
| BTN-019 | Goal資格系 | 「資格取得の目標」 | goal | 資格関連 |
| BTN-020 | Goal習慣連携 | 「習慣につながる目標」 | goal | 習慣との関連 |

### 2.3 Sticky'n Button Tests (BTN-021 - BTN-025)

| 機能ID | 機能名 | テスト質問 | 期待する候補ボタン型 | 検証ポイント |
|--------|--------|-----------|-------------------|-------------|
| BTN-021 | Sticky'n作成 | 「メモを追加したい」 | stickyn | Sticky'nカード表示 |
| BTN-022 | Sticky'nアイデア | 「アイデアをメモしたい」 | stickyn | アイデアタイプ |
| BTN-023 | Sticky'nリマインダー | 「リマインダーを設定」 | stickyn | リマインダー情報 |
| BTN-024 | Sticky'n目標連携 | 「目標のメモを追加」 | stickyn | 目標との関連 |
| BTN-025 | Sticky'n習慣連携 | 「習慣のメモを追加」 | stickyn | 習慣との関連 |

### 2.4 Category Button Tests (BTN-026 - BTN-035)

| 機能ID | 機能名 | テスト質問 | 期待する候補ボタン型 | 検証ポイント |
|--------|--------|-----------|-------------------|-------------|
| BTN-026 | カテゴリ選択（曖昧） | 「何か始めたい」 | category | カテゴリボタン表示 |
| BTN-027 | カテゴリ選択（健康） | 「健康について」 | category | 健康カテゴリ強調 |
| BTN-028 | カテゴリ選択（キャリア） | 「仕事を頑張りたい」 | category | キャリアカテゴリ |
| BTN-029 | カテゴリ選択（学習） | 「勉強したい」 | category | 学習カテゴリ |
| BTN-030 | カテゴリ選択（趣味） | 「趣味を見つけたい」 | category | 趣味カテゴリ |
| BTN-031 | カテゴリ選択（人間関係） | 「人間関係を良くしたい」 | category | 人間関係カテゴリ |
| BTN-032 | カテゴリ選択（お金） | 「お金を貯めたい」 | category | お金カテゴリ |
| BTN-033 | カテゴリ選択（生活） | 「生活を整えたい」 | category | ライフスタイルカテゴリ |
| BTN-034 | カテゴリ選択（その他） | 「よくわからないけど変わりたい」 | category | その他カテゴリ |
| BTN-035 | カテゴリ複数表示 | 「いろいろ相談したい」 | category (複数) | 全カテゴリ表示 |

### 2.5 Text Button Tests (BTN-036 - BTN-040)

| 機能ID | 機能名 | テスト質問 | 期待する候補ボタン型 | 検証ポイント |
|--------|--------|-----------|-------------------|-------------|
| BTN-036 | テキスト返答（情報） | 「習慣化のコツを教えて」 | text | テキスト回答 |
| BTN-037 | テキスト返答（質問） | 「なぜ習慣が続かないの？」 | text | 説明テキスト |
| BTN-038 | テキスト返答（励まし） | 「やる気が出ない」 | text | 励ましテキスト |
| BTN-039 | テキスト返答（アドバイス） | 「アドバイスください」 | text | アドバイステキスト |
| BTN-040 | テキスト返答（説明） | 「このアプリの使い方」 | text | 説明テキスト |

### 2.6 Reply Button Tests (BTN-041 - BTN-045)

| 機能ID | 機能名 | テスト質問 | 期待する候補ボタン型 | 検証ポイント |
|--------|--------|-----------|-------------------|-------------|
| BTN-041 | リプライ（確認） | 候補選択後 | reply | 「はい/いいえ」ボタン |
| BTN-042 | リプライ（次のアクション） | 登録後 | reply | 次のステップボタン |
| BTN-043 | リプライ（詳細確認） | 候補表示後 | reply | 「詳細を見る」ボタン |
| BTN-044 | リプライ（キャンセル） | 操作中 | reply | 「キャンセル」ボタン |
| BTN-045 | リプライ（続ける） | 一括登録後 | reply | 「続ける」ボタン |

---

## 3. Action Button Coverage Matrix

### 3.1 Refine Action Tests (ACT-001 - ACT-030)

| 機能ID | アクション | 前提条件 | テスト質問 | 期待する動作 |
|--------|-----------|---------|-----------|-------------|
| ACT-001 | more_specific | Habit候補表示後 | 「もっと具体的に」選択 | より詳細な習慣候補 |
| ACT-002 | more_specific | Goal候補表示後 | 「もっと具体的に」選択 | より詳細な目標候補 |
| ACT-003 | more_specific | 複数選択後 | 選択した候補を具体化 | 選択分のみ具体化 |
| ACT-004 | more_specific | 1件選択後 | 1件を具体化 | 1件のみ具体化 |
| ACT-005 | more_specific | 全選択後 | 全候補を具体化 | 全候補具体化 |
| ACT-006 | easier | Habit候補表示後 | 「もっとかんたんに」選択 | より簡単な習慣候補 |
| ACT-007 | easier | Goal候補表示後 | 「もっとかんたんに」選択 | より簡単な目標候補 |
| ACT-008 | easier | 難しい候補選択後 | 候補を簡単に | 難易度低下 |
| ACT-009 | easier | 複数選択後 | 複数を簡単に | 選択分のみ簡単化 |
| ACT-010 | easier | 初心者向け要求 | 初心者向けに | beginner向け候補 |
| ACT-011 | harder | Habit候補表示後 | 「もっと難しく」選択 | より難しい習慣候補 |
| ACT-012 | harder | Goal候補表示後 | 「もっと難しく」選択 | より難しい目標候補 |
| ACT-013 | harder | 簡単な候補選択後 | 候補を難しく | 難易度上昇 |
| ACT-014 | harder | 複数選択後 | 複数を難しく | 選択分のみ難化 |
| ACT-015 | harder | 上級者向け要求 | チャレンジングに | advanced向け候補 |
| ACT-016 | different | Habit候補表示後 | 「もっとアレンジして」選択 | 別アレンジの習慣 |
| ACT-017 | different | Goal候補表示後 | 「もっとアレンジして」選択 | 別アレンジの目標 |
| ACT-018 | different | 同じ候補連続後 | 異なるアプローチ | 新しいアプローチ |
| ACT-019 | different | 複数選択後 | 複数をアレンジ | 選択分のみ変更 |
| ACT-020 | different | スタイル変更要求 | 別スタイル | 異なるスタイル |
| ACT-021 | more_suggestions | Habit候補表示後 | 「他には」選択 | 追加の習慣候補 |
| ACT-022 | more_suggestions | Goal候補表示後 | 「他には」選択 | 追加の目標候補 |
| ACT-023 | more_suggestions | 候補不満時 | 別の候補を要求 | 完全に別の候補 |
| ACT-024 | more_suggestions | 3回目の要求 | さらに別の候補 | 重複なし |
| ACT-025 | more_suggestions | カテゴリ変更 | 別カテゴリの候補 | 異なるカテゴリ |
| ACT-026 | different_habit | 習慣改善提案後 | 「別の習慣」選択 | 異なる習慣候補 |
| ACT-027 | different_habit | レベル設定後 | 別の習慣を選択 | 別習慣リスト |
| ACT-028 | different_habit | 既存習慣選択後 | 他の習慣を見る | 他の既存習慣 |
| ACT-029 | different_habit | 習慣提案中 | 別カテゴリ習慣 | カテゴリ変更 |
| ACT-030 | different_habit | 改善提案後 | 新規習慣を見る | 新規候補表示 |

---

## 4. Drilldown Flow Coverage Matrix

### 4.1 Genre Selection Tests (DRL-001 - DRL-010)

| 機能ID | テストシナリオ | 開始質問 | 期待するジャンルボタン | 検証ポイント |
|--------|--------------|---------|---------------------|-------------|
| DRL-001 | 健康ジャンル選択 | 「何か始めたい」→「健康」 | 健康・運動 | genre_selection |
| DRL-002 | キャリアジャンル選択 | 「何か始めたい」→「キャリア」 | キャリア・仕事 | genre_selection |
| DRL-003 | 学習ジャンル選択 | 「何か始めたい」→「学習」 | 学習・スキル | genre_selection |
| DRL-004 | 趣味ジャンル選択 | 「何か始めたい」→「趣味」 | 趣味・創作 | genre_selection |
| DRL-005 | 人間関係ジャンル選択 | 「何か始めたい」→「人間関係」 | 人間関係 | genre_selection |
| DRL-006 | お金ジャンル選択 | 「何か始めたい」→「お金」 | お金・資産 | genre_selection |
| DRL-007 | ライフスタイル選択 | 「何か始めたい」→「生活」 | ライフスタイル | genre_selection |
| DRL-008 | その他ジャンル選択 | 「何か始めたい」→「その他」 | その他 | genre_selection |
| DRL-009 | 全ジャンル表示 | 「相談したい」 | 全8ジャンル | 8ボタン表示 |
| DRL-010 | ジャンルアイコン | 曖昧な質問 | アイコン付きジャンル | アイコン表示確認 |

### 4.2 Purpose Selection Tests (DRL-011 - DRL-020)

| 機能ID | テストシナリオ | 前提 | 期待する目的ボタン | 検証ポイント |
|--------|--------------|------|-------------------|-------------|
| DRL-011 | 健康→体重減 | 健康ジャンル選択後 | 体重を減らしたい | purpose_selection |
| DRL-012 | 健康→筋力 | 健康ジャンル選択後 | 筋力をつけたい | purpose_selection |
| DRL-013 | 健康→体調 | 健康ジャンル選択後 | 体調を整えたい | purpose_selection |
| DRL-014 | 健康→ストレス | 健康ジャンル選択後 | ストレス解消 | purpose_selection |
| DRL-015 | 健康→睡眠 | 健康ジャンル選択後 | 睡眠を改善したい | purpose_selection |
| DRL-016 | キャリア→昇進 | キャリアジャンル選択後 | 昇進・昇格したい | purpose_selection |
| DRL-017 | キャリア→スキル | キャリアジャンル選択後 | スキルアップしたい | purpose_selection |
| DRL-018 | 学習→言語 | 学習ジャンル選択後 | 新しい言語を学びたい | purpose_selection |
| DRL-019 | 学習→資格 | 学習ジャンル選択後 | 資格を取りたい | purpose_selection |
| DRL-020 | その他→自由入力 | その他選択後 | 自由に入力 | テキスト入力可 |

### 4.3 Response Type Selection Tests (DRL-021 - DRL-030)

| 機能ID | テストシナリオ | 前提 | 期待する回答型ボタン | 検証ポイント |
|--------|--------------|------|---------------------|-------------|
| DRL-021 | 習慣提案選択 | 目的選択後 | 具体的な習慣を提案 | response_type_selection |
| DRL-022 | 目標設定選択 | 目的選択後 | 目標設定をサポート | response_type_selection |
| DRL-023 | 情報選択 | 目的選択後 | まず情報を知りたい | response_type_selection |
| DRL-024 | アドバイス選択 | 目的選択後 | アドバイスがほしい | response_type_selection |
| DRL-025 | 習慣提案→習慣カード | 習慣提案選択後 | habit_cards | targetAgent: habit-coach |
| DRL-026 | 目標設定→目標カード | 目標設定選択後 | goal_cards | targetAgent: goal-planner |
| DRL-027 | 情報→テキスト | 情報選択後 | text_advice | targetAgent: manager |
| DRL-028 | アドバイス→テキスト | アドバイス選択後 | text_advice | targetAgent: manager |
| DRL-029 | 全回答型表示 | 目的選択後 | 4種類の回答型 | 4ボタン表示 |
| DRL-030 | 回答型説明 | 目的選択後 | 各選択肢に説明 | ラベル表示確認 |

---

## 5. Special Flow Coverage Matrix

### 5.1 Existing Item Selection Tests (EXT-001 - EXT-010)

| 機能ID | テストシナリオ | テスト質問 | 期待する動作 | 検証ポイント |
|--------|--------------|-----------|-------------|-------------|
| EXT-001 | 既存Habit選択 | 「習慣のレベルを設定」 | 既存Habitリスト表示 | list_habits ツールコール |
| EXT-002 | 既存Goal選択 | 「目標の進捗確認」 | 既存Goalリスト表示 | list_goals ツールコール |
| EXT-003 | 既存Habitレベル変更 | 「運動のレベルを上げたい」 | 既存習慣のレベルUI | レベル選択UI |
| EXT-004 | 既存Goal進捗更新 | 「目標の進捗を更新」 | 進捗更新UI | 進捗入力UI |
| EXT-005 | 既存Habit改善 | 「習慣を改善したい」 | 改善候補表示 | suggest_habit_improvements |
| EXT-006 | 空の既存リスト | （Habitなし状態） | 新規作成を促す | 「まだ習慣がありません」 |
| EXT-007 | 空の既存Goal | （Goalなし状態） | 新規作成を促す | 「まだ目標がありません」 |
| EXT-008 | 既存から1件選択 | リスト表示後 | 1件の詳細表示 | 詳細モーダル |
| EXT-009 | 既存をフィルタ | 「運動の習慣だけ見せて」 | フィルタされたリスト | カテゴリフィルタ |
| EXT-010 | 既存の検索 | 「朝の習慣はある？」 | 検索結果リスト | キーワード検索 |

### 5.2 Multi-Selection Tests (MUL-001 - MUL-010)

| 機能ID | テストシナリオ | 前提条件 | 期待する動作 | 検証ポイント |
|--------|--------------|---------|-------------|-------------|
| MUL-001 | 複数選択UI表示 | 候補3件以上表示後 | チェックボックス表示 | checkbox 表示 |
| MUL-002 | 1件選択 | 候補表示後 | 1件にチェック | selectedIndices: [0] |
| MUL-003 | 複数件選択 | 候補表示後 | 複数にチェック | selectedIndices: [0,1,2] |
| MUL-004 | 全選択 | 候補表示後 | 「すべて選択」クリック | 全件選択状態 |
| MUL-005 | 全解除 | 全選択後 | 「すべて解除」クリック | 選択なし状態 |
| MUL-006 | 選択状態視覚化 | 選択時 | 選択カードのハイライト | ring-2 ring-primary |
| MUL-007 | 選択カウント表示 | 選択時 | 「3件選択中」表示 | 選択数カウント |
| MUL-008 | 選択なしでアクション無効 | 選択なし | アクションボタン無効 | disabled 状態 |
| MUL-009 | 選択ありでアクション有効 | 1件以上選択 | アクションボタン有効 | enabled 状態 |
| MUL-010 | 選択状態のリセット | 新規候補表示後 | 選択状態クリア | selectedIndices: [] |

### 5.3 Batch Registration Tests (BAT-001 - BAT-010)

| 機能ID | テストシナリオ | 前提条件 | 期待する動作 | 検証ポイント |
|--------|--------------|---------|-------------|-------------|
| BAT-001 | 一括登録ボタン表示 | 候補選択後 | 「登録」ボタン表示 | RegisterButton 表示 |
| BAT-002 | 一括登録実行 | 3件選択後 | 3件一括登録 | 3回のAPI呼び出し |
| BAT-003 | 登録中ローディング | 登録処理中 | ローディング表示 | isRegistering: true |
| BAT-004 | 登録成功 | 登録完了後 | 成功メッセージ | status: 'accepted' |
| BAT-005 | 部分的失敗 | 1件失敗時 | エラー + 成功表示 | 失敗分のエラー表示 |
| BAT-006 | 全件失敗 | 全件失敗時 | エラーメッセージ | 全件エラー表示 |
| BAT-007 | 登録後の選択解除 | 登録成功後 | 選択状態クリア | selectedIndices: [] |
| BAT-008 | 登録後の状態更新 | 登録成功後 | カード状態更新 | 「採用済み」表示 |
| BAT-009 | Habit一括登録 | Habit3件選択 | 3件のHabit作成 | create_habit x 3 |
| BAT-010 | Goal一括登録 | Goal3件選択 | 3件のGoal作成 | create_goal x 3 |

---

## 6. End-to-End Flow Coverage

### 6.1 Complete Drilldown Flow Tests (FLW-001 - FLW-010)

| フローID | フロー名 | 開始質問 | 期待するステップ | 最終結果 |
|----------|----------|---------|----------------|---------|
| FLW-001 | カテゴリ掘り下げ→Habit | 「何か始めたい」 | genre→purpose→response_type→habit | Habitカード表示 |
| FLW-002 | カテゴリ掘り下げ→Goal | 「何か始めたい」 | genre→purpose→response_type→goal | Goalカード表示 |
| FLW-003 | カテゴリ掘り下げ→情報 | 「何か始めたい」 | genre→purpose→response_type→text | テキスト回答 |
| FLW-004 | 直接Habit提案 | 「運動の習慣を提案して」 | habit直接 | Habitカード即時表示 |
| FLW-005 | 直接Goal提案 | 「目標を提案して」 | goal直接 | Goalカード即時表示 |
| FLW-006 | Habit提案→調整→登録 | 提案→「もっと具体的に」→登録 | habit→refine→register | Habit作成完了 |
| FLW-007 | Goal提案→調整→登録 | 提案→「もっとかんたんに」→登録 | goal→refine→register | Goal作成完了 |
| FLW-008 | 複数選択→一括登録 | 提案→3件選択→登録 | habit→select→batch_register | 3件作成完了 |
| FLW-009 | 既存Habit改善フロー | 「習慣を改善したい」 | list→select→improve | 改善提案表示 |
| FLW-010 | レベル設定フロー | 「レベルを設定したい」 | list→select→level_ui | レベル設定完了 |

---

## 7. Test Question ID Mapping

### 7.1 Button Coverage Questions

質問データファイルへの追加ID一覧:

| カテゴリ | ID範囲 | 件数 |
|---------|--------|------|
| btn-habit-* | btn-habit-001 - btn-habit-010 | 10件 |
| btn-goal-* | btn-goal-001 - btn-goal-010 | 10件 |
| btn-stickyn-* | btn-stickyn-001 - btn-stickyn-005 | 5件 |
| btn-category-* | btn-category-001 - btn-category-010 | 10件 |
| btn-text-* | btn-text-001 - btn-text-005 | 5件 |
| btn-reply-* | btn-reply-001 - btn-reply-005 | 5件 |
| act-* | act-001 - act-030 | 30件 |
| drl-* | drl-001 - drl-030 | 30件 |
| ext-* | ext-001 - ext-010 | 10件 |
| mul-* | mul-001 - mul-010 | 10件 |
| bat-* | bat-001 - bat-010 | 10件 |
| flw-* | flw-001 - flw-010 | 10件 |

**合計: 145件**

---

## 8. Coverage Verification Checklist

### 8.1 SuggestionButtonType Coverage

- [ ] habit: 10/10 テストケース
- [ ] goal: 10/10 テストケース
- [ ] stickyn: 5/5 テストケース
- [ ] category: 10/10 テストケース
- [ ] text: 5/5 テストケース
- [ ] reply: 5/5 テストケース

### 8.2 RefineActionType Coverage

- [ ] more_specific: 5/5 テストケース
- [ ] easier: 5/5 テストケース
- [ ] harder: 5/5 テストケース
- [ ] different: 5/5 テストケース
- [ ] more_suggestions: 5/5 テストケース
- [ ] different_habit: 5/5 テストケース

### 8.3 DrilldownStep Coverage

- [ ] genre_selection: 10/10 テストケース
- [ ] purpose_selection: 10/10 テストケース
- [ ] response_type_selection: 10/10 テストケース

### 8.4 Special Flow Coverage

- [ ] existing item selection: 10/10 テストケース
- [ ] multi-selection: 10/10 テストケース
- [ ] batch registration: 10/10 テストケース
- [ ] end-to-end flows: 10/10 テストケース

---

## 9. Agent Coordination Notes

### 9.1 実装担当

このテストカバレッジ設計に基づいて、以下のエージェントが作業を分担できます:

1. **Tester Agent**: 質問データの追加（qa-patrol-questions.ts）
2. **QA Agent**: テスト実行とレポート作成
3. **Frontend Developer**: UI側のテスタビリティ改善（必要に応じて）

### 9.2 依存関係

- qa-patrol-types.ts の `coverageTarget` フィールド追加が必要
- qa-patrol-questions.ts への新規質問追加

### 9.3 優先度

1. **High**: BTN-001 - BTN-045（ボタン型の基本テスト）
2. **High**: DRL-001 - DRL-030（掘り下げフローテスト）
3. **Medium**: ACT-001 - ACT-030（アクションボタンテスト）
4. **Medium**: FLW-001 - FLW-010（E2Eフローテスト）
5. **Low**: EXT, MUL, BAT（特殊フローテスト）

---

## 10. References

- Section.MOC.tsx: `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`
- drilldown types: `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/drilldown/types.ts`
- drilldown categories: `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/drilldown/categories.ts`
- suggestion-button-enhancement spec: `/home/ubuntu/Downloads/vow/specs/suggestion-button-enhancement/`
- qa-patrol-types.ts: `/home/ubuntu/Downloads/vow/frontend/e2e/qa-patrol-types.ts`
- qa-patrol-questions.ts: `/home/ubuntu/Downloads/vow/frontend/e2e/qa-patrol-questions.ts`
