# VOW Agent Workflow - Single Entry Point Architecture

## 概要

ユーザーは**1つの窓口（親エージェント）**のみと対話します。
親エージェントが内容を分析し、専門エージェントに作業を委譲します。

```
┌─────────────────────────────────────────────────────────────────┐
│                         ユーザー                                 │
│                           │                                     │
│                           ▼                                     │
│   ┌───────────────────────────────────────────────┐            │
│   │       親エージェント (Coordinator)             │            │
│   │       モデル: Opus                             │            │
│   │       ディレクトリ: ~/Downloads/vow            │            │
│   │                                               │            │
│   │  責任:                                        │            │
│   │  - ユーザーリクエストの分析                   │            │
│   │  - 適切な専門エージェントへの委譲             │            │
│   │  - 結果の統合・報告                           │            │
│   └───────────────────────────────────────────────┘            │
│                           │                                     │
│           ┌───────────────┴───────────────┐                    │
│           ▼                               ▼                    │
│   ┌───────────────┐               ┌───────────────┐            │
│   │  調査フェーズ  │               │  実装フェーズ  │            │
│   │               │      →        │               │            │
│   │  researcher   │   調査結果    │  implementer  │            │
│   │  (Opus)       │      →        │  (Opus)       │            │
│   │               │               │               │            │
│   │  読み取り専用 │               │  編集権限あり │            │
│   └───────────────┘               └───────────────┘            │
│                                           │                    │
│                           ┌───────────────┼───────────────┐    │
│                           ▼               ▼               ▼    │
│                     ┌──────────┐   ┌──────────┐   ┌──────────┐│
│                     │Frontend  │   │Backend   │   │MCP       ││
│                     │領域      │   │領域      │   │領域      ││
│                     └──────────┘   └──────────┘   └──────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## 親エージェントの起動

```bash
cd ~/Downloads/vow
claude --model opus
```

## 親エージェントの動作

### 1. リクエスト分析

ユーザーからのリクエストを以下の観点で分析:

- **対象領域**: Frontend / Backend / MCP Server / Infrastructure
- **作業タイプ**: 実装 / バグ修正 / リファクタリング / 調査
- **複雑度**: 単純（単独処理）/ 複雑（並列処理）

### 2. 委譲判断

| リクエスト例 | 委譲先 |
|--------------|--------|
| "ボタンのUIを修正" | frontend-implementer |
| "APIエンドポイント追加" | backend-implementer |
| "MCPサーバーの不具合" | mcp-implementer |
| "新機能の設計" | 自身で対応（仕様作成後に委譲）|
| "複数領域にまたがる変更" | 複数エージェントに並列委譲 |

### 3. Taskツールによる委譲

```
Task tool:
  subagent_type: "implementer"
  model: "opus"
  prompt: |
    ## タスク
    {具体的なタスク内容}

    ## 対象ファイル
    - {ファイルパス}

    ## 受け入れ条件
    - {条件1}
    - {条件2}

    ## 参照仕様
    specs/{feature}/requirements.md
  run_in_background: true  # 必要に応じて
```

### 4. 結果統合

- 各エージェントの作業結果を収集
- ユーザーに統合レポートを提示
- 必要に応じて追加作業を指示

## 並列委譲の例

ユーザー: "MOCセクションのチャット機能を改善してほしい"

親エージェントの対応:

```
1. 分析:
   - Frontend: UI改善
   - Backend: API改善
   - MCP Server: 接続改善

2. 仕様作成:
   specs/moc-chat-improvement/
   ├── requirements.md
   ├── design.md
   └── tasks.md

3. 並列委譲:
   Task (frontend-implementer): "Task 1-3を実装"
   Task (backend-implementer): "Task 4-6を実装"
   Task (mcp-implementer): "Task 7-9を実装"

4. 結果収集・報告
```

## エージェント役割定義

| 役割 | subagent_type | モデル | 責任 |
|------|---------------|--------|------|
| 親エージェント (Coordinator) | - | Opus | ユーザー窓口、分析、委譲、統合 |
| 調査エージェント (Researcher) | researcher | Opus | 不具合調査、原因分析、コード解析 |
| 実装エージェント (Implementer) | implementer | Opus | コード実装、修正、リファクタリング |
| コードレビュー | code-reviewer | Opus | 品質チェック、セキュリティレビュー |
| テスト | tester | Opus | テスト実行、検証 |

### 重要: 調査と実装の分離

**調査エージェント** (researcher)
- 不具合の原因調査
- コードベースの分析
- 影響範囲の特定
- 修正方針の提案
- **ファイル編集は行わない**

**実装エージェント** (implementer)
- 調査結果に基づく実装
- コード修正
- 新機能追加
- **調査結果を受け取って作業**

### 不具合修正のフロー

```
ユーザー: "チャットが動かない"
    │
    ▼
親エージェント: 分析
    │
    ▼
┌─────────────────────────────────────────┐
│  Step 1: 調査                           │
│  Task (researcher):                     │
│    "チャット機能の不具合を調査してください"│
│    → 原因: XXX、修正方針: YYY            │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  Step 2: 実装                           │
│  Task (implementer):                    │
│    "調査結果に基づき修正してください"     │
│    "原因: XXX、修正方針: YYY"           │
│    → 修正完了                           │
└─────────────────────────────────────────┘
    │
    ▼
親エージェント: 結果報告
```

## 委譲時のプロンプトテンプレート

### 調査タスク（researcher）

```
## 調査依頼

### 問題の概要
{ユーザーからの報告内容}

### 調査範囲
- {対象ディレクトリ/ファイル}

### 調査観点
1. 問題の再現条件
2. 根本原因の特定
3. 影響範囲の分析
4. 修正方針の提案

### 期待する出力形式
{
  "problem_summary": "問題の要約",
  "root_cause": "根本原因",
  "affected_files": ["ファイル1", "ファイル2"],
  "fix_approach": "修正方針",
  "estimated_effort": "見積もり時間"
}

### 制約
- ファイルの編集は行わないでください
- 調査結果のみを報告してください
```

### 実装タスク（implementer）

```
## コンテキスト
{背景説明}

## タスク
{具体的な作業内容}

## 対象ファイル
- {ファイルパス1}
- {ファイルパス2}

## 技術スタック
- {使用技術}

## 受け入れ条件
- [ ] {条件1}
- [ ] {条件2}

## 参照ドキュメント
- specs/{feature}/requirements.md
- specs/{feature}/design.md

## 制約事項
- {制約1}
- {制約2}
```

### 調査タスク

```
## 調査目的
{何を明らかにしたいか}

## 調査範囲
- {ディレクトリ/ファイル}

## 期待する出力
- {レポート形式}

## 調査観点
- {観点1}
- {観点2}
```

## ファイル競合回避

親エージェントは以下を管理:

1. **specs/COORDINATION.md**: 現在のタスク割り当て
2. **specs/{feature}/tasks.md**: タスクのステータス

各エージェントは割り当てられたファイルのみを編集。
共通ファイルの編集が必要な場合は親エージェントに報告。

## 実践例: 不具合修正のフルフロー

### ユーザーの報告
```
"MOCセクションでチャットが返答しない"
```

### Step 1: 親エージェントが分析

親エージェントは問題を分類:
- タイプ: 不具合
- 領域: Frontend + MCP Server
- アクション: 調査 → 実装

### Step 2: 調査エージェントに委譲

```
親エージェント → Task tool:
  subagent_type: "researcher"
  model: "opus"
  prompt: |
    ## 調査依頼

    ### 問題
    MOCセクションでチャットが返答しない

    ### 調査範囲
    - frontend/app/dashboard/components/Section.MOC.tsx
    - frontend/app/dashboard/hooks/useMcpChat.ts
    - ~/.mcp-multi-agent/mcp-task-distributor/src/server.ts

    ### 調査観点
    1. エラーログの確認
    2. APIリクエスト/レスポンスの確認
    3. 根本原因の特定

    ### 制約
    - ファイル編集は行わない
    - 調査結果のみ報告
```

### Step 3: 調査結果を受領

```
調査エージェント → 親エージェント:
{
  "problem_summary": "systemPromptがMCPサーバーに渡されていない",
  "root_cause": "Section.MOC.tsx が useMcpChat を呼び出す際に systemMessage を渡していない",
  "affected_files": [
    "frontend/app/dashboard/components/Section.MOC.tsx:278-290"
  ],
  "fix_approach": "useMcpChat の呼び出しに systemMessage パラメータを追加",
  "estimated_effort": "30分"
}
```

### Step 4: 実装エージェントに委譲

```
親エージェント → Task tool:
  subagent_type: "implementer"
  model: "opus"
  prompt: |
    ## 実装依頼

    ### 調査結果
    - 問題: systemPromptがMCPサーバーに渡されていない
    - 原因: Section.MOC.tsx が useMcpChat を呼び出す際に systemMessage を渡していない
    - 対象ファイル: frontend/app/dashboard/components/Section.MOC.tsx:278-290

    ### 修正方針
    useMcpChat の呼び出しに systemMessage パラメータを追加

    ### タスク
    1. getRoleSystemPrompt をインポート
    2. aiCoachSystemPrompt を useMemo で作成
    3. useMcpChat に systemMessage を渡す

    ### 受け入れ条件
    - [ ] ビルドが成功する
    - [ ] チャットが正常に応答する
```

### Step 5: 実装完了・報告

```
実装エージェント → 親エージェント:
## 完了報告

### 変更内容
- Section.MOC.tsx に systemMessage パラメータを追加
- getRoleSystemPrompt をインポート

### 変更ファイル
- frontend/app/dashboard/components/Section.MOC.tsx (+15行)

### ビルド結果
成功
```

### Step 6: ユーザーへ報告

```
親エージェント → ユーザー:
## 修正完了

### 問題
MOCセクションでチャットが返答しない

### 原因
systemPromptがMCPサーバーに渡されていませんでした

### 修正
Section.MOC.tsx に systemMessage パラメータを追加しました

### 確認方法
1. ブラウザをハードリフレッシュ (Ctrl+Shift+R)
2. MOCセクションで「ゴールを設定したい」と入力
3. JSONフォーマットで候補が表示されることを確認
```

---

## 通信プロトコル

### エージェント → 親エージェント

```
## 進捗報告
- 完了: {タスク名}
- 作業中: {タスク名}
- ブロッカー: {問題点}

## 結果
{成果物・変更内容}

## 次のアクション
{推奨事項}
```

### 親エージェント → ユーザー

```
## 作業完了報告

### 実行したタスク
1. {タスク1} - {担当エージェント}
2. {タスク2} - {担当エージェント}

### 変更されたファイル
- {ファイルパス1}
- {ファイルパス2}

### 確認事項
{ユーザーに確認してほしい内容}

### 次のステップ
{推奨アクション}
```
