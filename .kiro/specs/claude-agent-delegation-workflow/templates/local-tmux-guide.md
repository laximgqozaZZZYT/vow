# ローカル tmux マルチエージェント開発ガイド

本ドキュメントは、tmuxを使用して複数のClaude AIエージェントを並列で動作させ、VOWプロジェクトを効率的に開発する手順を説明します。

## 前提条件

- tmux がインストールされていること
- Claude Code CLI がインストールされていること
- VOW プロジェクトが `~/Downloads/vow` に存在すること

## クイックスタート

### Step 1: tmux 環境の初期化

```bash
cd ~/Downloads/vow
./scripts/agents/setup-agents.sh
```

これにより `vow-agents` セッションが作成され、以下のウィンドウが用意されます：

| ウィンドウ | 用途 |
|-----------|------|
| 0: coordinator | メイン調整（あなたがいる場所） |
| 1: frontend | フロントエンド開発用 |
| 2: backend | バックエンド開発用 |
| 3: test | テスト実行用 |
| 4: sync | Git操作用 |
| 5: specs | 仕様書確認用 |

### Step 2: セッションにアタッチ

```bash
tmux attach -t vow-agents
```

### Step 3: 各ウィンドウでClaude Codeを起動

**ウィンドウ切り替え方法:**
- `Ctrl+b n` - 次のウィンドウ
- `Ctrl+b p` - 前のウィンドウ
- `Ctrl+b 1` - ウィンドウ1（frontend）に移動
- `Ctrl+b 2` - ウィンドウ2（backend）に移動

**各ウィンドウでClaude Codeを起動:**

```bash
# ウィンドウ1 (frontend) で
claude

# ウィンドウ2 (backend) で
claude

# 必要に応じて他のウィンドウでも
```

## 並列開発ワークフロー

### Phase 1: タスクの確認と割り当て

**coordinator ウィンドウで:**

```bash
# スペック状況を確認
./scripts/agents/agent-status.sh

# 特定のスペックの詳細を確認
cat .kiro/specs/{spec-name}/tasks.md
```

### Phase 2: エージェントへのタスク委任

各ウィンドウのClaude Codeに、担当するタスクを指示します。

**例: frontend エージェント (ウィンドウ1)**
```
あなたはfrontendエージェントです。
.kiro/specs/habit-goal-level-system/tasks.md を読んで、
UI関連のタスク（LevelBadge, AssessmentModal等）を実装してください。

ブランチ: feat/level-system-frontend
```

**例: backend エージェント (ウィンドウ2)**
```
あなたはbackendエージェントです。
.kiro/specs/habit-goal-level-system/tasks.md を読んで、
サービス関連のタスク（thliAssessmentService等）を実装してください。

ブランチ: feat/level-system-backend
```

### Phase 3: 並列作業の実行

各エージェントが独立して作業を進めます。

**重要なルール:**
1. 各エージェントは担当ファイル以外を編集しない
2. 各エージェントは独自のfeatureブランチで作業
3. developブランチへの直接コミットは禁止

### Phase 4: 同期と統合

**sync ウィンドウで定期的に確認:**

```bash
# 全ブランチの状況
git branch -a

# 各ブランチの差分
git log --oneline develop..feat/level-system-frontend
git log --oneline develop..feat/level-system-backend

# 競合の可能性を確認
git diff --name-only develop..feat/level-system-frontend
git diff --name-only develop..feat/level-system-backend
```

## 推奨するタスク分割パターン

### パターン A: 機能別分割

```
┌─────────────────────────────────────────────────┐
│ coordinator: タスク管理・レビュー                │
├─────────────────────────────────────────────────┤
│ frontend: UIコンポーネント                      │
│   - Modal.*.tsx, Widget.*.tsx, Section.*.tsx   │
├─────────────────────────────────────────────────┤
│ backend: APIとサービス                          │
│   - services/*.ts, routers/*.ts               │
├─────────────────────────────────────────────────┤
│ test: テスト作成                                │
│   - __tests__/*.test.ts                        │
└─────────────────────────────────────────────────┘
```

### パターン B: スペック別分割

```
┌─────────────────────────────────────────────────┐
│ coordinator: 全体調整                           │
├─────────────────────────────────────────────────┤
│ agent-1: habit-goal-level-system               │
├─────────────────────────────────────────────────┤
│ agent-2: user-level-system                     │
├─────────────────────────────────────────────────┤
│ agent-3: board-kanban-section                  │
└─────────────────────────────────────────────────┘
```

## tmux 便利コマンド

### セッション管理

```bash
# セッション一覧
tmux list-sessions

# セッションにアタッチ
tmux attach -t vow-agents

# セッションからデタッチ
Ctrl+b d

# セッションを終了
tmux kill-session -t vow-agents
```

### ウィンドウ管理

```bash
# ウィンドウ一覧
Ctrl+b w

# 新しいウィンドウ作成
Ctrl+b c

# ウィンドウ名変更
Ctrl+b ,

# ウィンドウ切り替え
Ctrl+b n  # 次
Ctrl+b p  # 前
Ctrl+b 0-9  # 番号指定
```

### ペイン分割（1つのウィンドウを分割）

```bash
# 水平分割
Ctrl+b %

# 垂直分割
Ctrl+b "

# ペイン間移動
Ctrl+b 矢印キー

# ペインを閉じる
Ctrl+b x
```

### スクロール・コピー

```bash
# スクロールモード開始
Ctrl+b [

# スクロールモード終了
q または Enter

# コピー開始
Space

# コピー終了
Enter
```

## エージェント間のコミュニケーション

### 方法1: 共有ファイル

```bash
# 進捗を共有ファイルに記録
echo "frontend: LevelBadge完了" >> /tmp/vow-agent-status.txt

# 他のエージェントが確認
cat /tmp/vow-agent-status.txt
```

### 方法2: Git コミットメッセージ

```bash
# 作業内容をコミットメッセージで共有
git commit -m "feat(level): Add LevelBadge component

- Implemented tier color coding
- Added responsive design
- Note to backend: Expects level field in Habit type"
```

### 方法3: スペックファイルの更新

```bash
# tasks.md を更新して進捗を共有
# [x] 完了, [~] 進行中, [ ] 未着手
```

## トラブルシューティング

### エージェントがハングした場合

```bash
# 該当ウィンドウで Ctrl+c で中断
# または新しいウィンドウを作成
Ctrl+b c
```

### 競合が発生した場合

```bash
# sync ウィンドウで
git fetch origin
git checkout feat/your-branch
git rebase develop
# 競合を解決
git add .
git rebase --continue
```

### セッションが切断された場合

```bash
# 再アタッチ
tmux attach -t vow-agents

# セッションが残っていない場合は再作成
./scripts/agents/setup-agents.sh
```

## 本日の推奨タスク（優先度順）

1. **habit-goal-level-system** (82% → 100%)
   - 残り: Property tests
   - 担当: test エージェント

2. **user-level-system** (52% → 70%)
   - 残り: XP計算、レベル表示
   - 担当: frontend + backend 並列

3. **board-kanban-section** (36% → 60%)
   - 残り: Kanban UI
   - 担当: frontend エージェント

## 次のステップ

1. `./scripts/agents/setup-agents.sh` を実行
2. `tmux attach -t vow-agents` でアタッチ
3. 各ウィンドウで `claude` を起動
4. このガイドに従ってタスクを割り当て
5. 作業開始！
