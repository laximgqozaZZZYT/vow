# Remote CLI Role - Requirements Specification

## Overview

- **Purpose**: VOWアプリのMOCセクション（チャットUI）に「Remote CLI」という新しい役割（ロール）を追加し、リモートMCPサーバ上のClaude Code CLIとの対話をVOW UI上で行えるようにする
- **Status**: Draft
- **Version**: 1.0
- **Last Updated**: 2026-02-07
- **Author**: vow-spec-architect

---

## 1. Background (背景)

VOWアプリのMOCセクションは現在、AIコーチ（習慣・目標提案）を中心としたチャット機能を提供している。MCPサーバとSSE接続し、AIコーチプロンプトに基づくJSON形式（`AICandidateResponse`）の応答を受け取り、候補ボタン（Goal/Habit/Sticky/Reply）として表示している。

しかし、MCPサーバに接続されたClaude Code CLIをリモート操作ツールとして使用するユースケースでは、AIコーチの候補ボタン体系は不適切であり、CLI操作に特化した別のUIフロー（役割）が必要となる。

### 1.1 現在のアーキテクチャのポイント

| コンポーネント | 場所 | 機能 |
|---|---|---|
| `ProviderSelector` | `Chat.ProviderSelector.tsx` | AI/MCPプルダウン選択 |
| `role-prompts.ts` | `constants/role-prompts.ts` | `AgentRole`型とROLE_CONFIGSの定義 |
| `useRolePrompt` | `hooks/useRolePrompt.ts` | ロール別プロンプト取得（API→キャッシュ→ローカル） |
| `useMcpChat` | `hooks/useMcpChat.ts` | MCPサーバとのSSEチャット |
| `useProviderChat` | `hooks/useProviderChat.ts` | APIプロバイダーチャット |
| `useAIProvider` | `hooks/useAIProvider.ts` | プロバイダー検出・選択管理 |
| `Section.MOC.tsx` | `components/Section.MOC.tsx` | MOCセクション本体（チャット、候補表示） |
| `ai-candidate-response.ts` | `types/ai-candidate-response.ts` | AICoach候補レスポンス型 |

---

## 2. Functional Requirements (機能要件)

### FR-001: AgentRole型に `remoteCli` を追加

- `constants/role-prompts.ts` の `AgentRole` 型に `'remoteCli'` を追加する
- `ROLE_CONFIGS` に `remoteCli` 用の `RoleConfig` を追加する
- Remote CLI用のシステムプロンプトを定義する（JSON形式応答ではなく、プレーンテキストまたはMarkdown応答を指示する）
- `getAvailableRoles()` のリストに含まれるようにする

### FR-002: ロールドロップダウンUIの追加

- チャットタブ内のAIプルダウンメニュー（`ProviderSelector`）の隣に、「ロール」プルダウンメニューを新設する
- ユーザーが利用可能な役割を選択できるようにする
- 選択された役割は `localStorage` に永続化する
- デフォルト値は `'AICoach'`
- ロールドロップダウンのラベルは `ロール:` とする

### FR-003: MCP限定の有効化制御

- 「Remote CLI」ロールは、AIプルダウンでMCPサーバが選択されている場合にのみ選択可能とする
- APIプロバイダー（OpenAI, Anthropic等）が選択されている場合は、Remote CLIはグレーアウト＋disabled表示にする
- MCPサーバが選択されていない状態でRemote CLIが選択されていた場合、自動的にデフォルトロール（AICoach）にフォールバックする

### FR-004: Remote CLI用候補ボタンの差し替え

- Remote CLIロール選択時、初期候補ボタン（`quickActions`）をCLI操作に特化した内容に差し替える
- Remote CLI用候補ボタン例:
  - 「プロジェクト状態確認」 (`git status && ls`)
  - 「ファイル一覧」 (`ls -la`)
  - 「テスト実行」 (`npm test`)
  - 「ビルド確認」 (`npm run build`)
  - 「ログ確認」 (`tail -f logs`)
  - 「デプロイ」 (`npm run deploy`)
- 候補ボタンの表示形式は既存の `quickActions` と同じUI形式を維持する

### FR-005: MCPサーバからの選択肢をReply型候補ボタンとして表示

- MCPサーバのSSEレスポンス中に選択肢情報（`suggestions`、`options`、`choices`等）が含まれている場合、これをReply型候補ボタンとして表示する
- 候補ボタンのクリック時に、そのボタンの `label` をユーザーメッセージとして自動送信する
- MCPサーバのレスポンス（`complete` イベントの `toolCalls` 内）から選択肢を抽出するロジックを追加する
- 選択肢のデータ形式:
  ```typescript
  interface McpSuggestion {
    label: string;      // ボタン表示テキスト
    value: string;      // 送信される値（省略時はlabel）
    icon?: string;      // オプショナルなアイコン
    description?: string; // ツールチップ的な補足
  }
  ```

### FR-006: リアルタイム表示の最適化

- SSEストリーミングの表示を現在の実装から改善し、よりリアルタイムに近い表示を実現する
- 具体的な改善点:
  1. **トークン単位の逐次表示**: 現在の実装（`useMcpChat.ts` L434-444）は既にトークン単位で表示しているが、`setMessages` の更新頻度を最適化する（バッチ更新間隔: 50ms）
  2. **複数回答の連投許可**: 1つのユーザーメッセージに対して、MCPサーバが複数の `complete` イベントを送信した場合、それぞれを別々のアシスタントメッセージとして表示する
  3. **回答間のインジケーター**: 複数回答が来る可能性がある場合、最初の回答完了後に「追加の応答を待っています...」というインジケーターを表示する

### FR-007: Remote CLI用プロンプトテンプレート

- Supabaseの `prompt_templates` テーブルに Remote CLI 用のプロンプトテンプレートを追加する
- テンプレートキー: `remote-cli`
- プロンプト内容: Claude Code CLIとして振る舞うための指示（ファイル操作、コマンド実行、プロジェクト管理等）
- JSON形式応答は要求せず、Markdown形式のプレーンテキスト応答を指示する
- `useRolePrompt` の3層フォールバック（API→キャッシュ→ローカル）に対応する

### FR-008: 中間目標 - Claude Code CLIとのリモート対話

- VOWのチャットUIからMCPサーバ経由でClaude Code CLIに命令を送信できる
- Claude Code CLIの応答がリアルタイムでストリーミング表示される
- ツール呼び出し結果（ファイル読み書き、コマンド実行等）が適切にフォーマットされて表示される
- 会話のコンテキストが維持される（セッションID経由）

---

## 3. Non-Functional Requirements (非機能要件)

### NFR-001: パフォーマンス

- ロールドロップダウンの切り替えは100ms以内に完了すること
- ストリーミング表示の更新間隔は50ms以下を目標とする
- 複数回答連投時、最大10個のメッセージを安定して表示できること

### NFR-002: 後方互換性

- 既存の `AgentRole` 型を利用するすべてのコードが壊れないこと
- Remote CLI未使用時のチャット動作は一切変更しないこと
- `AICoach` がデフォルトロールのままであること

### NFR-003: アクセシビリティ

- ロールドロップダウンは適切な `aria-label` を持つこと
- キーボードナビゲーションに対応すること

### NFR-004: レスポンシブデザイン

- モバイル画面（320px幅以上）でもロールドロップダウンが使用可能であること
- AIプルダウンとロールプルダウンが横並びで、画面幅が狭い場合は折り返すこと

### NFR-005: エラーハンドリング

- MCPサーバが切断された場合、Remote CLIロールは自動的に無効化されること
- エラーメッセージは日本語で表示すること
- ネットワークエラー時のリトライは既存の仕組みを活用すること

---

## 4. Out of Scope (スコープ外)

- ターミナルUIの完全再現（コマンドライン入力のシンタックスハイライト等）
- ファイルエディタの統合
- MCPサーバの認証フロー変更
- 他のロール（Manager, Developer等）のRemote CLI的な機能拡張
- AIプロバイダー（OpenAI等）でのRemote CLI機能（MCPサーバ限定）

---

## 5. Acceptance Criteria (受入基準)

### AC-001: ロール追加

- [ ] `AgentRole` 型に `'remoteCli'` が存在する
- [ ] `ROLE_CONFIGS.remoteCli` が定義されている
- [ ] `getAvailableRoles()` の返り値に `remoteCli` が含まれる
- [ ] Remote CLIのシステムプロンプトがJSON形式応答を要求しない

### AC-002: ロールドロップダウン

- [ ] AIプルダウンの隣にロールプルダウンが表示される
- [ ] ロール選択が `localStorage` に保存・復元される
- [ ] デフォルトはAICoachが選択されている

### AC-003: MCP限定制御

- [ ] APIプロバイダー選択時にRemote CLIがdisabledになる
- [ ] MCPサーバ選択時にRemote CLIが有効になる
- [ ] MCPからAPIに切替時、Remote CLIロールからAICoachに自動フォールバックする

### AC-004: 候補ボタン差し替え

- [ ] Remote CLI選択時、候補ボタンがCLI操作用に変わる
- [ ] AICoach選択時、従来の候補ボタンが表示される

### AC-005: MCPサーバ選択肢のReply表示

- [ ] MCPサーバの `complete` イベント内の選択肢データがReply型ボタンとして表示される
- [ ] Reply型ボタンクリックでメッセージが自動送信される

### AC-006: リアルタイム表示

- [ ] ストリーミング応答がトークン単位でリアルタイムに表示される
- [ ] 1つの質問に対する複数回答が別々のメッセージバブルとして表示される

### AC-007: Claude Code CLIリモート対話

- [ ] VOWのチャットUIからClaude Code CLIに命令を送信できる
- [ ] CLIの応答がストリーミング表示される
- [ ] セッションが維持され、コンテキストが引き継がれる

---

## 6. Dependencies (依存関係)

| 依存元 | 依存先 | 種類 |
|--------|--------|------|
| FR-002 (ロールドロップダウン) | FR-001 (AgentRole追加) | 必須 |
| FR-003 (MCP限定制御) | FR-002 (ロールドロップダウン) | 必須 |
| FR-004 (候補ボタン差し替え) | FR-001 (AgentRole追加) | 必須 |
| FR-005 (Reply表示) | FR-008 (CLIリモート対話) | 推奨 |
| FR-006 (リアルタイム表示) | 既存 `useMcpChat` | 改善 |
| FR-007 (プロンプトテンプレート) | FR-001 (AgentRole追加) | 推奨 |
| FR-008 (CLIリモート対話) | FR-001, FR-002, FR-003 | 必須 |

---

## 7. Glossary (用語集)

| 用語 | 説明 |
|------|------|
| Remote CLI | リモートサーバ上のClaude Code CLIとのインタラクションを行うためのロール |
| MCP | Model Context Protocol - AIモデルとツール/リソースを接続するプロトコル |
| SSE | Server-Sent Events - サーバからクライアントへの一方向ストリーミング |
| Role (ロール) | AIの振る舞いを定義するプロンプトとUI設定のセット |
| Candidate Button (候補ボタン) | AIの応答に基づいてユーザーに提示されるアクションボタン |
| Reply型候補ボタン | クリック時に `label` をそのままユーザーメッセージとして送信するボタン |
| `AICandidateResponse` | AIコーチ用のJSON応答フォーマット（Remote CLIでは不使用） |
