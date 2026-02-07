# AI Provider Unification - Requirements Specification

## Overview

- **Purpose**: MOCセクションのAIチャット経路として、既存のMCPサーバーに加え、Settings画面で登録したOpenAI API等のAIプロバイダーを選択・利用可能にする。生成AI設定（プロバイダー/モデル/APIキー）と役割・プロンプト設定は完全に分離した状態を維持する。
- **Status**: Draft
- **Version**: 1.0.0
- **Last Updated**: 2026-02-07
- **Author**: vow-spec-architect

---

## 1. Refactoring Priority Assessment (リファクタリング優先判定)

### 1.1 判定結果: Phase 1 リファクタリング必須、Phase 2 で機能追加

調査の結果、以下の理由により**リファクタリングを Phase 1 として先行実施**し、AIプロバイダー統合は **Phase 2** として段階的に進める構成を採用する。

### 1.2 リファクタリングが必要な理由

| # | 問題 | 重大度 | 詳細 |
|---|------|--------|------|
| R-1 | `aiCoachService.ts` のデッドコード残存 | 高 | 3,573行。`useMastraAgent.ts` と `vow-coach-agent.ts` は削除済みだが、`aiCoachService.ts` 内にMastra関連のスタブ、dead code paths、不要なimportが残存。`shouldUseMastraCoach()` が常に `false` を返す死んだフラグで制御されている |
| R-2 | `aiCoachService.ts` が OpenAI 直接依存 | 高 | `/api/ai/chat` エンドポイントは `aiCoachService.ts` 経由で OpenAI API を直接呼び出す。プロバイダー抽象化なし。新プロバイダーを追加するには、この結合を解消する必要がある |
| R-3 | `remove-openai-chat-path` spec との矛盾 | 中 | 既存specは「OpenAI経路の完全削除」を計画していたが、今回の要望は「OpenAI APIを選択可能にする」こと。specの廃止と方針転換を正式に記録する必要がある |
| R-4 | `extractAICandidateResponse` の脆弱性 | 中 | JSONコードブロック (```` ```json ... ``` ````) と直接JSONの2パターンのみ対応。ストリーミング中の不完全JSON、テキスト混在応答、```マーカー不一致時のフォールバックが不足 |
| R-5 | CredentialStore と LLM Config の二重管理 | 低 | `credentials-store.ts` のユーザー別APIキーと `llm-config.ts` の環境変数ベースの設定が独立して存在。統合的なプロバイダー選択にはこの2つの橋渡しが必要 |

### 1.3 リファクタリング不要（既に完了済み）な項目

| 項目 | 状態 |
|------|------|
| `useMastraAgent.ts` の削除 | 完了済み |
| `vow-coach-agent.ts` の削除 | 完了済み |
| `agents.ts` から `/api/agents/chat` (OpenAI) エンドポイントの削除 | 完了済み |
| プロンプトのバックエンド統一 (`prompt-registry.ts`, `prompts.ts` API) | 完了済み |
| `useRolePrompt` フックの SWR パターン | 完了済み |
| Credential管理UI (`AIProviderSettings.tsx`) | 完了済み |
| Credential バックエンドAPI (`credentials.ts` router) | 完了済み |

---

## 2. Functional Requirements (機能要件)

### Phase 1: リファクタリング (前提条件整備)

- **[FR-101]** `aiCoachService.ts` のデッドコード除去: Mastra関連スタブ (`CoachToolStub`, `getVowCoachAgent`, `OpenAIToolRegistry`, `convertCoachToolsToOpenAI`)、`shouldUseMastraCoach()` フラグ、およびそれに依存する分岐を完全に削除する
- **[FR-102]** `extractAICandidateResponse` の堅牢化: 以下のパターンに対応する
  - (a) ```` ```json { ... } ``` ```` コードブロック (既存)
  - (b) 直接JSON文字列 (既存)
  - (c) テキスト + JSONの混在（テキスト部分の前後にJSONが埋め込まれたケース）
  - (d) ストリーミング中の不完全JSON（パースエラー時に `null` を返し、呼び出し元でストリーミング完了後にリトライ）
  - (e) パース失敗時のフォールバック: `message` フィールドのみを持つ最小限の `AICandidateResponse` を生成し、テキストとして表示
- **[FR-103]** `remove-openai-chat-path` specを obsolete として明示的にマーク。代替として本specを参照する旨を記載
- **[FR-104]** `aiCoachService.ts` からプロバイダー固有のコード（OpenAI クライアント生成、Function Calling ツール定義）を分離し、プロバイダー非依存のインターフェースを定義する

### Phase 2: AIプロバイダー統合

- **[FR-201]** AIプロバイダー抽象化レイヤー (`AIChatProvider` インターフェース) を定義。以下のメソッドを持つ:
  - `chat(messages, systemPrompt, options): AsyncGenerator<ChatChunk>` -- ストリーミング応答
  - `isAvailable(): boolean` -- プロバイダーが利用可能か
  - `getProviderInfo(): ProviderInfo` -- プロバイダーのメタ情報
- **[FR-202]** 以下のプロバイダー実装を作成:
  - `McpChatProvider` -- 既存の MCP サーバー経由チャット（`useMcpChat` のサーバーサイド相当）
  - `OpenAIChatProvider` -- OpenAI API 直接呼び出し
  - `AnthropicChatProvider` -- Anthropic Claude API (将来)
  - `GeminiChatProvider` -- Google Gemini API (将来)
- **[FR-203]** MOCセクションにプロバイダー選択UIを追加: チャット入力エリア上部にプロバイダーセレクター（ドロップダウンまたはタブ）を表示。選択肢は:
  - MCP接続済みサーバー（既存の接続情報から動的取得）
  - Settings で登録済みの APIプロバイダー（Credential が exists=true のもの）
- **[FR-204]** プロバイダー選択状態は `localStorage` に保存し、ページリロード後も維持
- **[FR-205]** APIプロバイダー経由のチャットでも `AICandidateResponse` JSON形式の応答を取得するため、`systemPrompt` に候補JSON形式の指示を含める。これは既存の `useRolePrompt` で取得するプロンプトをそのまま使用する
- **[FR-206]** APIプロバイダー経由のチャットは、バックエンド `/api/ai/provider-chat` エンドポイントを経由する（フロントエンドから直接 OpenAI API を呼ばない。APIキーの安全性のため）
- **[FR-207]** バックエンド `/api/ai/provider-chat` エンドポイントは SSE ストリーミングに対応する。レスポンスフォーマットは MCP サーバーの SSE と同じ形式 (`event: token`, `data: {token: "..."}`, `event: complete`) を採用し、フロントエンドの `useMcpChat` のパーサーを再利用可能にする

### Phase 2 追加: 設定との分離

- **[FR-208]** 役割・プロンプト設定 (`useRolePrompt`, `agent_configs`, `prompt-registry`) はプロバイダー選択から完全に独立。同じロールプロンプトがどのプロバイダーでも使用される
- **[FR-209]** Settings > AI設定画面の既存UIはそのまま維持。プロバイダーの追加・削除はSettings画面で行い、MOCセクションでは「どのプロバイダーを使うか」の選択のみを行う

---

## 3. Non-Functional Requirements (非機能要件)

- **[NFR-001]** MCP経由のチャットの既存パフォーマンス（レイテンシ、ストリーミング速度）に影響を与えない
- **[NFR-002]** APIキーはフロントエンドに露出しない。すべてのAPI呼び出しはバックエンド経由で行う
- **[NFR-003]** プロバイダー切り替え時のUI遷移は 200ms 以内
- **[NFR-004]** Phase 1 のリファクタリングは既存の全テストを破壊しない
- **[NFR-005]** `useMcpChat.ts` のコード変更は最小限（インターフェース互換性を維持）
- **[NFR-006]** トークン使用量の計測・課金は既存の `tokenManager` を通じて行う

---

## 4. Acceptance Criteria (受け入れ基準)

### Phase 1 受け入れ基準

- **[AC-101]** `aiCoachService.ts` から Mastra 関連のデッドコードが完全に除去されていること (`grep -r "mastra\|Mastra\|VowCoach\|shouldUseMastra" backend/src/services/aiCoachService.ts` の結果が空)
- **[AC-102]** `extractAICandidateResponse` がテキスト混在応答、不完全JSON、コードブロックなしJSONの全パターンで正しく動作すること（ユニットテスト必須）
- **[AC-103]** `remove-openai-chat-path` specが obsolete とマークされていること
- **[AC-104]** `cd frontend && npx tsc --noEmit` および `cd backend && npx tsc --noEmit` が通過すること
- **[AC-105]** 既存の MCP チャットが Phase 1 完了後も正常動作すること

### Phase 2 受け入れ基準

- **[AC-201]** MOCセクションのチャット入力エリアにプロバイダー選択UIが表示されること
- **[AC-202]** Settings で OpenAI APIキーを登録済みの状態で、MOCセクションからOpenAI APIを選択してチャットできること
- **[AC-203]** OpenAI API経由のチャットで `AICandidateResponse` JSON形式の応答が表示され、候補ボタンが正常に機能すること
- **[AC-204]** MCP経由のチャットの動作が Phase 2 導入後も変わらないこと
- **[AC-205]** プロバイダー選択状態がページリロード後も維持されること
- **[AC-206]** Settings でAPIキーを未登録のプロバイダーはMOCの選択リストに表示されないこと
- **[AC-207]** APIプロバイダー経由のチャットでストリーミング応答が正しくインクリメンタルに表示されること

---

## 5. Constraints (制約事項)

- `useMcpChat.ts` の既存MCP通信機能は保護（変更最小限）
- `useRolePrompt.ts` はそのまま維持
- `role-prompts.ts` はローカルフォールバックとして維持
- `AICandidateResponse` 型定義はMCP/OpenAI両方で統一
- フロントエンドから直接 OpenAI API (api.openai.com) を呼び出さない
- `prompt-registry.ts` と `/api/prompts/:role` API はそのまま維持

---

## 6. Dependencies (依存関係)

| 依存元 | 依存先 | 種類 |
|--------|--------|------|
| Phase 2 全体 | Phase 1 完了 | ブロッキング |
| FR-206 (provider-chat API) | FR-104 (プロバイダー抽象化) | ブロッキング |
| FR-203 (プロバイダー選択UI) | FR-206 (provider-chat API) | ブロッキング |
| FR-205 (JSON応答) | FR-102 (extractAICandidateResponse 堅牢化) | ブロッキング |

---

## 7. Out of Scope (対象外)

- Gemini, Codex プロバイダーの実装（インターフェースのみ定義、実装は後続タスク）
- MCP サーバーの自動セットアップ・インストール
- 会話履歴のプロバイダー間共有
- プロバイダー間の自動フォールバック（手動切り替えのみ）
- Mastra/Multi-agent システムの復活
- Settings 画面のUI変更（既存のAIProviderSettings.tsx はそのまま）
