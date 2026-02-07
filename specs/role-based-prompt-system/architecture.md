# Role-Based Prompt System - Architecture Specification

## Overview

- **Purpose**: チャット機能のシステムプロンプトを「利用手段ごと」(MCP / OpenAI API) ではなく「役割ごと」(AIコーチ / マネージャー / etc.) に統一管理するためのアーキテクチャ設計
- **Status**: Draft
- **Version**: 2.0
- **Last Updated**: 2026-02-07
- **Author**: vow-spec-architect
- **Reviewed by**: Plan Agent (Opus) cross-review applied

---

## 1. Current State Analysis (現状分析)

### 1.1 プロンプトの分散状況

現在、チャット機能に関するシステムプロンプトは以下の **4箇所** に分散して定義されている。

| # | ファイル | 役割 | サイズ | 経路 |
|---|---------|------|--------|------|
| 1 | `frontend/app/dashboard/constants/ai-coach-prompt.ts` | AIコーチ (MCP向け) -- **正規プロンプト** | ~10KB (~6,000字) | MCP経由のチャット |
| 2 | `backend/src/agents/mastra/vow-coach-agent.ts` 内 `generateSystemPrompt()` | マネージャーAI (OpenAI API向け) | ~120KB全体 (~20,000字プロンプト部) | OpenAI API経由のチャット |
| 3 | `frontend/app/dashboard/constants/role-prompts.ts` | 全ロール定義 (MCP向け) | ~15KB | MCP経由のロール選択 |
| 4 | `frontend/app/dashboard/components/Section.Coach.tsx` (line 304) / `Section.AIHub.tsx` (line 555) | インライン最小プロンプト (~37字) | ~60 bytes | `useMastraAgent` 経由 |

加えて、バックエンド内の `getManagerSystemPrompt()` がマネージャーモード専用のプロンプトを別途定義している。

**注意**: #4 のインラインプロンプトは `'あなたはVOWアプリの習慣コーチです。ユーザーの習慣形成をサポートします。'` という約37字の最小プロンプトであり、AICandidateResponse JSON形式の指示を含まない。これは第3のプロンプトパターンであり、この経路からの応答はプレーンテキストとして返される。

### 1.2 現在のコードパス図

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              Section.MOC.tsx                                 │
│  (フロントエンド: MOCセクションコンポーネント)                               │
│                                                                              │
│  const aiCoachSystemPrompt = getRoleSystemPrompt('coach', locale);           │
│       ^ role-prompts.ts -> ai-coach-prompt.ts -> getAICoachSystemPrompt()   │
│                                                                              │
│  ┌────────────────────────┐    ┌────────────────────────────────────┐        │
│  │ useMcpChat({           │    │ useMastraAgent({                   │        │
│  │   systemMessage:       │    │   authToken,                       │        │
│  │     aiCoachSystemPrompt│    │   enableStreaming: false,           │        │
│  │ })                     │    │   /* systemMessageは渡されない */  │        │
│  └──────────┬─────────────┘    └──────────────┬─────────────────────┘        │
└─────────────┼──────────────────────────────────┼─────────────────────────────┘
              │                                  │
              ▼                                  ▼
┌─────────────────────────┐    ┌───────────────────────────────────────────────┐
│ MCP Server              │    │ Backend API                                    │
│ (Claude CLI等)          │    │ POST /api/agents/chat                          │
│                         │    │                                                │
│ systemPromptは          │    │ ┌──────────────────────────────────────────┐   │
│ フロントエンドから      │    │ │ agents.ts router                         │   │
│ POSTボディで送信される  │    │ │                                          │   │
│                         │    │ │ OpenAI API経路:                          │   │
│ requestBody = {         │    │ │   coachAgent.processMessage()             │   │
│   message,              │    │ │   → VowCoachAgent.generateResponse()     │   │
│   sessionId,            │    │ │   → this.getSystemPrompt(locale)         │   │
│   systemPrompt,  <- *   │    │ │   → generateSystemPrompt() [~20,000字] │   │
│   userId                │    │ │                                          │   │
│ }                       │    │ │ ※ MCP fallbackはこのエンドポイントには │   │
│                         │    │ │   存在しない                             │   │
│                         │    │ └──────────────────────────────────────────┘   │
└─────────────────────────┘    └───────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Section.Coach.tsx / Section.AIHub.tsx                                         │
│                                                                              │
│ useMastraAgent({                                                             │
│   systemMessage: 'あなたはVOWアプリの習慣コーチです。...' (~37字)           │
│ })                                                                           │
│   └─ POST /api/agents/chat (インラインの最小プロンプト)                      │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ CLI Chat Endpoint (MCP fallbackが存在する唯一のエンドポイント)               │
│                                                                              │
│ POST /api/agents/cli/chat (agents.ts line 1481)                              │
│   ├─ MCP経路: generateCoachSystemPrompt(locale) -> callMcpChat(...)          │
│   └─ fallbackToApi: VowCoachAgent.generateResponse(...)                      │
│                                                                              │
│ ※ この経路は「バックエンドがプロンプトを生成しMCPに渡す」パターンの          │
│   既存の実装例であり、推奨アーキテクチャのproof-of-conceptとなる             │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 経路別の詳細フロー

#### 経路A: MCP経由 (フロントエンド直接接続)

```
Section.MOC.tsx
  |
  +- getRoleSystemPrompt('coach', locale)
  |   +- role-prompts.ts
  |       +- coachRole.getSystemPrompt(locale)
  |           +- ai-coach-prompt.ts -> getAICoachSystemPrompt(locale)
  |               +- AI_COACH_SYSTEM_PROMPT_JA (~6,000字)
  |
  +- useMcpChat({ systemMessage: aiCoachSystemPrompt })
      +- fetch(POST) -> MCP Server
          body: { message, sessionId, systemPrompt: systemMessage, userId }
```

**特徴**:
- フロントエンドからMCPサーバーに直接接続する
- systemPromptはフロントエンドの `ai-coach-prompt.ts` から取得
- POSTリクエストのbodyに `systemPrompt` として送信される
- プロンプトサイズ: 約6,000字 (AIコーチ用、候補JSON形式)
- **このプロンプトがユーザーの希望する正規AIコーチプロンプトである**

#### 経路B: OpenAI API経由 (バックエンド経由)

```
Section.MOC.tsx
  |
  +- useMastraAgent({ authToken, enableStreaming: false })
      +- fetch(POST) -> Backend API /api/agents/chat
          body: { message, sessionId, locale, streaming }
          ※ systemPromptはbodyに含まれない
          |
          +- Backend: agents.ts router (line 461)
              |
              +- coachAgent.processMessage(message, executionContext)
                  |
                  +- VowCoachAgent.processMessage() (vow-coach-agent.ts)
                      |
                      +- this.generateResponse(message, session, context)
                          |              (vow-coach-agent.ts line 2274)
                          |
                          +- this.getSystemPrompt(locale, userContext)
                              |          (vow-coach-agent.ts line 2335)
                              |
                              +- generateSystemPrompt(locale, userContext)
                                  +- ~20,000字プロンプト
                                      +- OpenAI API chat completion
```

**特徴**:
- フロントエンドからバックエンドAPIに接続する
- systemPromptはフロントエンドからは送信されない
- バックエンド内の `generateSystemPrompt()` (~20,000字) が使用される
- コールチェーン: `processMessage()` -> `generateResponse()` -> `getSystemPrompt()` -> `generateSystemPrompt()`
- このプロンプトにはツール定義やAICandidateResponse仕様が詳細に記述されている
- **MCP fallbackはこの経路には存在しない** (`/api/agents/chat` ハンドラにはMCPロジックがない)

#### 経路C: CLI Chat エンドポイント (MCP fallback)

```
POST /api/agents/cli/chat (agents.ts line 1481)
  |
  +- ユーザー設定でMCPが有効な場合
  |   +- generateCoachSystemPrompt(locale) <- バックエンド側プロンプト生成
  |       +- callMcpChat(server, agentId, message, sessionId, systemPrompt)
  |
  +- MCP失敗時かつfallbackToApi=true
      +- VowCoachAgent.generateResponse(...)
```

**特徴**:
- **MCP fallback経路が存在するのはこのCLIエンドポイントのみ** (`/api/agents/cli/chat`, agents.ts lines 1502-1616)
- メインの `/api/agents/chat` エンドポイント (agents.ts lines 330-498) にはMCP fallbackは存在しない
- バックエンドがMCPサーバーとの通信を仲介する
- systemPromptはバックエンドの `generateCoachSystemPrompt(locale)` から生成 (agents.ts line 1543)
- フロントエンド側のプロンプト (`ai-coach-prompt.ts`) とは別物
- **この経路は「バックエンドがプロンプトを生成してMCPに渡す」パターンの既存proof-of-concept** であり、推奨アーキテクチャ (選択肢C) が提案する方式と同じ

#### 経路D: インライン最小プロンプト (Section.Coach / Section.AIHub)

```
Section.Coach.tsx / Section.AIHub.tsx
  |
  +- useMastraAgent({
  |     systemMessage: 'あなたはVOWアプリの習慣コーチです。ユーザーの習慣形成をサポートします。'
  |  })
  +- fetch(POST) -> Backend API /api/agents/chat
      body: { message, sessionId, locale, streaming, systemMessage }
```

**特徴**:
- 約37字のインラインプロンプトを直接 `useMastraAgent` に渡す
- AICandidateResponse JSON形式の指示が含まれないため、応答はプレーンテキスト
- 経路A/Bとは異なる第3のプロンプトパターン
- 統一対象として見落としやすい

### 1.4 核心的な問題

| 問題 | 詳細 |
|------|------|
| **プロンプトの重複** | AIコーチとしての基本指示 (JSON形式応答、候補スキーマ等) がフロントエンド (~6,000字) とバックエンド (~20,000字) の両方に定義されている |
| **内容の不一致** | フロントエンドのプロンプトはシンプルなJSON応答指示。バックエンドのプロンプトはツール定義、深掘りフロー、パーソナライゼーション等を含むリッチな指示。同じ「AIコーチ」役でありながら振る舞いが異なる |
| **管理場所の分散** | 「マネージャー」ロールのプロンプトだけでも、フロントエンド (`role-prompts.ts` 内) とバックエンド (`getManagerSystemPrompt()`) の2箇所に異なる定義がある |
| **利用手段とロールの混同** | 現在の設計は「MCP経由ならこのプロンプト」「OpenAI API経由ならこのプロンプト」という利用手段ベースの分岐になっている。本来は「AIコーチならこのプロンプト」というロールベースであるべき |
| **第3のパターンの放置** | `Section.Coach.tsx` / `Section.AIHub.tsx` のインライン最小プロンプト (~37字) はAICandidateResponse形式を返さず、他のAIコーチ経路と応答形式が不整合 |

---

## 2. Target Architecture (目標アーキテクチャ)

### 2.1 ロール (Role) の定義

| ロールID | 名称 | 説明 | 現在の主な使用経路 |
|----------|------|------|-------------------|
| `coach` | AIコーチ | 習慣形成・目標達成を支援。AICandidateResponse JSON形式で応答 | MCP経由 (フロントエンド) |
| `manager` | マネージャーAI | タスク管理・エージェント調整。ツール呼び出し可能 | OpenAI API経由 (バックエンド) |
| `developer` | 開発者 | コード実装 | (将来対応) |
| `reviewer` | レビュアー | コードレビュー | (将来対応) |
| `tester` | テスター | テスト実行 | (将来対応) |
| `analyst` | アナリスト | データ分析 | (将来対応) |
| `architect` | アーキテクト | システム設計 | (将来対応) |
| `default` | アシスタント | 汎用AI | フォールバック |

### 2.2 統一管理の原則

1. **ロールごとに1つのプロンプト定義**: 同じロールには同じプロンプトを使用する
2. **利用手段に依存しない**: MCP経由でもOpenAI API経由でも同じプロンプトを使用する
3. **Single Source of Truth**: プロンプト定義は1箇所のみに存在する
4. **パーソナライゼーションはレイヤー分離**: ベースプロンプト + ユーザーコンテキストの注入は分離する
5. **正規プロンプトの保全**: 現行のMCPプロンプト (`ai-coach-prompt.ts`) の内容を正規ベースとして保存・維持する

### 2.3 プロンプトの構成モデル

```
+---------------------------------------------------------+
| 最終的な System Prompt                                   |
|                                                         |
| = Canonical Base Prompt (正規AIコーチプロンプト)        |
|     ai-coach-prompt.ts の内容そのもの                   |
|   + Enhancement Layers (オプショナル追加レイヤー)       |
|     - Hearing Flow (ヒアリングフロー)                   |
|     - Emotional Response (感情対応)                      |
|     - Category Detection (カテゴリ検知)                  |
|     - Tool Instructions (ツール使用指示) <- 経路依存    |
|   + User Context (パーソナライゼーション) <- 動的       |
+---------------------------------------------------------+
```

各レイヤーの責任:

| レイヤー | 内容 | 管理場所 |
|----------|------|----------|
| Canonical Base Prompt | 正規AIコーチプロンプト (`ai-coach-prompt.ts` の内容)。ロールの人格、基本指示、会話ルール、AICandidateResponse JSON仕様、候補スキーマ、ツール使用禁止指示を含む | バックエンド `src/prompts/` に保存 (内容は現行MCPプロンプトそのもの) |
| Enhancement: Hearing Flow | ステップバイステップのカテゴリ -> サブカテゴリ -> 候補提示フロー | バックエンド `src/prompts/enhancements/` (オプショナル) |
| Enhancement: Emotional Response | 共感ファースト、ストレス/疲労対応ルール | バックエンド `src/prompts/enhancements/` (オプショナル) |
| Enhancement: Category Detection | 8カテゴリのキーワードマッピング、曖昧入力への対応 | バックエンド `src/prompts/enhancements/` (オプショナル) |
| Tool Instructions | ツール呼び出しの指示 (経路によって利用可否が異なる) | バックエンド (ツールがある場合のみ追加) |
| User Context | ユーザーの習慣データ、レベル、カテゴリ等 | バックエンド (動的生成) |

---

## 3. Design Options (設計選択肢の比較)

### 3.1 選択肢A: フロントエンドからバックエンドにsystemPromptを送信

**概要**: フロントエンド側でプロンプトを管理し、バックエンドAPI呼び出し時にもsystemPromptをリクエストbodyに含めて送信する。

```
+---------------------------------------------------+
| Frontend (Single Source of Truth)                   |
|                                                     |
| constants/role-prompts.ts                           |
|   +- coach -> getAICoachSystemPrompt()              |
|   +- manager -> getManagerSystemPrompt()            |
|   +- default -> getDefaultSystemPrompt()            |
|                                                     |
| useMcpChat({ systemMessage: prompt })               |
| useMastraAgent({ systemMessage: prompt })  <- 追加  |
|   body: { message, sessionId, systemPrompt }        |
+---------------------------------------------------+
         |                    |
         v                    v
    MCP Server          Backend API
    (promptを受取)      (promptを受取)
```

**メリット**:
- フロントエンド1箇所での管理 (Single Source of Truth)
- バックエンド側のプロンプトコードを削除できる
- 既にMCP経路では同様の仕組みが動作中 (`useMcpChat` の `systemPrompt` パラメータ)
- 実装工数が最も少ない

**デメリット**:
- セキュリティ懸念: systemPromptがネットワーク上を流れる (バックエンド向けリクエストに含まれる)
- プロンプトインジェクションのリスク: ユーザーがリクエストを改ざんしてsystemPromptを差し替え可能
- バックエンド固有のツール情報 (OpenAI function calling定義) をフロントエンドに持つ必要がある
- バックエンドの `generateSystemPrompt()` が持つパーソナライゼーション機能 (UserContextの注入) をフロントエンドで再現する必要がある
- プロンプトサイズが大きい場合 (~20,000字) リクエストサイズが増大する

### 3.2 選択肢B: 共有パッケージ (monorepo shared module) でプロンプトを管理

**概要**: プロンプト定義を独立したパッケージに切り出し、フロントエンドとバックエンドの両方からimportする。

```
+---------------------------------------------------+
| shared/prompts/ (New Package)                       |
|                                                     |
| role-prompts.ts                                     |
|   +- getCoachBasePrompt(locale)                     |
|   +- getCoachResponseFormat(locale)                 |
|   +- getManagerBasePrompt(locale)                   |
|   +- ...                                            |
|                                                     |
| types.ts                                            |
|   +- AgentRole                                      |
|   +- RoleConfig                                     |
|   +- AICandidateResponse                            |
+---------------------------------------------------+
                   |
         +---------+----------+
         v                    v
+------------------+  +------------------+
| Frontend         |  | Backend          |
|                  |  |                  |
| import {         |  | import {         |
|  getCoachPrompt  |  |  getCoachPrompt  |
| } from 'shared'  |  | } from 'shared'  |
|                  |  |                  |
| useMcpChat({     |  | + ツール指示追加 |
|  systemMessage   |  | + UserContext注入 |
| })               |  |                  |
+------------------+  +------------------+
```

**メリット**:
- 厳密なSingle Source of Truth
- TypeScriptの型をフロントエンド/バックエンドで共有可能
- バックエンド固有の拡張 (ツール指示、パーソナライゼーション) を分離して追加できる
- セキュリティ: プロンプトがネットワーク上を流れない

**デメリット**:
- monorepo構成の変更が必要 (現在はfrontend/backendが独立したパッケージ)
- ビルドパイプラインの変更が必要 (shared packageのビルド、依存関係管理)
- デプロイの複雑性が増す (特にLambdaバックエンドへの共有パッケージバンドル)
- 実装工数が最も大きい
- 現在のプロジェクト構成 (Next.js frontend + Lambda backend) との互換性確認が必要

### 3.3 選択肢C: バックエンドをプロンプトの正規保存先とし、フロントエンドはバックエンドから取得する (推奨)

**概要**: 現行のMCPプロンプト (`ai-coach-prompt.ts`) の内容をバックエンド側に保存し、プロンプト管理APIを追加する。フロントエンドはAPIからプロンプトを取得する。バックエンドのリッチな機能 (ヒアリングフロー、感情対応等) はオプショナルな追加レイヤーとして分離する。

**重要**: ここで言う「バックエンドに保存する内容」は、現行のバックエンドプロンプト (`generateSystemPrompt()` の ~20,000字) ではなく、**現行のMCPプロンプト (`ai-coach-prompt.ts` の ~6,000字)** である。バックエンドの追加機能は enhancement layers として分離し、上乗せする形とする。

```
+-----------------------------------------------------+
| Backend (Prompt Storage)                              |
|                                                       |
| src/prompts/                                          |
|   +- coach.ts                                         |
|   |   (ai-coach-prompt.ts の内容をそのまま保存)       |
|   +- enhancements/                                    |
|   |   +- hearing-flow.ts                              |
|   |   +- emotional-response.ts                        |
|   |   +- category-detection.ts                        |
|   +- manager-prompt.ts                                |
|   +- role-registry.ts                                 |
|                                                       |
| GET /api/prompts/:role?locale=ja                      |
|   -> { systemPrompt, role, version }                  |
|   (正規AIコーチプロンプトを返す)                      |
|                                                       |
| POST /api/agents/chat                                 |
|   -> 内部で正規プロンプト + enhancement layers を結合 |
+-----------------------------------------------------+
         ^                    |
         |                    |
         | GET /api/prompts   | (内部参照)
         |                    |
+----------------------+      |
| Frontend              |      |
|                       |      v
| useRolePrompt('coach')|   +--------------------------------+
|   -> キャッシュ管理    |   | OpenAI API Call                  |
|   -> useMcpChat({      |   |                                  |
|       systemMessage   |   | systemPrompt =                   |
|     })                |   |   canonicalBasePrompt             |
|                       |   |   + enhancementLayers             |
| role-prompts.ts は    |   |   + userContextSection            |
| API呼び出しに          |   |                                  |
| 置き換え              |   | ※ バックエンド内部で全レイヤーを |
|                       |   |   結合してOpenAI APIに送信        |
+----------------------+   +--------------------------------+
```

**メリット**:
- 正規プロンプト (`ai-coach-prompt.ts` の内容) がバックエンドに完全保存され、いつでも取得可能
- パーソナライゼーション (UserContext) をバックエンド側で注入しやすい
- ツール指示もバックエンド側で一貫して管理
- セキュリティ: プロンプト生成をサーバーサイドで制御
- 既存の `/api/agents/cli/chat` が既にこのパターンを実装済み (proof-of-concept)
- enhancement layers をオプショナルに追加できるため、段階的な機能移行が可能

**デメリット**:
- フロントエンドがプロンプト取得のために追加のAPI呼び出しが必要
- MCP経路の場合、フロントエンド -> バックエンド (プロンプト取得) -> MCPサーバー (チャット) というラウンドトリップが増える
- バックエンドAPIの可用性に依存する (バックエンドダウン時にMCPチャットも使えなくなる)
- プロンプト取得のキャッシュ戦略が必要

### 3.4 選択肢D: バックエンド側のプロンプトをフロントエンド側に統一 (フロントエンド正規ソース)

**概要**: バックエンドの `generateSystemPrompt()` の内容をフロントエンド側に移植し、フロントエンドを正規ソースとする。OpenAI API経由の場合もフロントエンドからプロンプトを送信する。

```
+----------------------------------------------------+
| Frontend (Single Source of Truth)                    |
|                                                      |
| constants/prompts/                                   |
|   +- base/                                           |
|   |   +- coach.ts        (統合済みCoachプロンプト)   |
|   |   +- manager.ts      (統合済みManagerプロンプト) |
|   |   +- ...                                         |
|   +- formats/                                        |
|   |   +- ai-candidate-response.ts (応答形式)        |
|   +- role-registry.ts    (ロール管理)                |
|                                                      |
| useMcpChat({ systemMessage: prompt })                |
| useMastraAgent({ systemMessage: prompt }) <- 追加    |
|   body: { message, sessionId, systemPrompt }         |
+----------------------------------------------------+
         |                    |
         v                    v
    MCP Server          Backend API
    (promptを受取)      (promptを受取、自前は不使用)
```

**メリット**:
- フロントエンドでの一元管理、選択肢Aと同様だがプロンプト内容を統一
- バックエンドからプロンプト生成コードを除去できる (大幅な簡素化)

**デメリット**:
- 選択肢Aと同じセキュリティ懸念
- バックエンドの `generateSystemPrompt()` が持つUserContext注入やツール定義を移植する必要がある
- バックエンド固有の情報 (OpenAI function calling ツール定義) をフロントエンドに移すのは不適切
- ツール定義はバックエンドのコードと密結合しており、フロントエンドでは管理が困難

---

## 4. Option Comparison Matrix (比較マトリクス)

| 評価軸 | A: FE->BE送信 | B: 共有pkg | C: BE保存+API (推奨) | D: FE正規+統一 |
|--------|:----------:|:---------:|:------------:|:-------------:|
| Single Source of Truth | o | oo | oo | o |
| セキュリティ | x | oo | oo | x |
| 実装工数 (小=良い) | oo | x | o | o |
| デプロイ影響 (小=良い) | oo | x | o | o |
| パーソナライゼーション対応 | x | o | oo | x |
| ツール定義との整合性 | x | o | oo | x |
| 既存アーキテクチャとの親和性 | oo | x | oo | o |
| MCP経路のレイテンシ | oo | oo | o (*) | oo |
| 正規プロンプトの保全 | o | o | oo | x |
| プロンプト一貫性保証 | x | oo | oo | x |

凡例: oo=優秀, o=良い, x=課題あり

(*) 選択肢CのMCPレイテンシはキャッシュ (SWR, localStorage) により軽減可能 (Section 5.5参照)

---

## 5. Recommended Architecture (推奨アーキテクチャ)

### 5.1 推奨案: 選択肢C (バックエンドをプロンプト保存先 + API提供)

**理由**:

1. **正規プロンプトの完全保全**: 現行のMCPプロンプト (`ai-coach-prompt.ts`) の内容をバックエンドにそのまま保存し、いつでも参照・取得可能にする。ユーザーが好むプロンプトの内容を改変せずに維持できる

2. **セキュリティとSoTの両立**: プロンプト定義をバックエンド側に集約することで、ネットワーク上をプロンプトが不必要に流れることを防ぎ、改ざんリスクを最小化できる

3. **パーソナライゼーションの自然な統合**: バックエンドは既にSupabaseアクセスを持ち、UserContextを取得してプロンプトに注入する仕組みがある。この機能をそのまま活かせる

4. **段階的な機能追加**: バックエンドの既存リッチ機能 (ヒアリングフロー、感情対応等) を enhancement layers として分離し、正規プロンプトに段階的に上乗せできる

5. **既存のproof-of-concept**: `/api/agents/cli/chat` エンドポイント (agents.ts line 1481) が既に「バックエンドがプロンプトを生成してMCPに渡す」パターンを実装しており、実現可能性が検証済み

6. **既存アーキテクチャとの親和性**: 現在のNext.js + Lambda構成をそのまま活かせる

### 5.2 推奨アーキテクチャの詳細設計

```
+------------------------------------------------------------------------+
| Backend: src/prompts/ (New Module)                                      |
|                                                                         |
| +---------------------------------------------------------------------+|
| | prompt-registry.ts                                                   ||
| |                                                                      ||
| | RolePromptRegistry                                                   ||
| |   .getCanonicalPrompt(role, locale) -> string                        ||
| |     (ai-coach-prompt.ts の内容をそのまま返す)                         ||
| |   .getEnhancementLayers(role, locale, options?) -> string            ||
| |     (ヒアリングフロー、感情対応等のオプショナルレイヤー)               ||
| |   .buildFullPrompt(role, locale, options?) -> string                  ||
| |     = canonicalPrompt + enhancementLayers + userContext               ||
| +---------------------------------------------------------------------+|
|                                                                         |
| +----------------------------+  +------------------------------------+ |
| | roles/                      |  | enhancements/                      | |
| |   coach.ts                 |  |   hearing-flow.ts                  | |
| |   (= ai-coach-prompt.ts   |  |   emotional-response.ts            | |
| |    の内容を完全保存)       |  |   category-detection.ts            | |
| |   manager.ts               |  |   casual-conversation.ts           | |
| |   default.ts               |  |                                    | |
| +----------------------------+  +------------------------------------+ |
|                                                                         |
| +---------------------------------------------------------------------+|
| | API Endpoint (追加)                                                  ||
| |                                                                      ||
| | GET /api/prompts/:role?locale=ja                                     ||
| |   Auth: Required (Bearer token)                                      ||
| |   Response: {                                                        ||
| |     systemPrompt: string,  // 正規プロンプト (ai-coach-prompt.ts相当)||
| |     role: AgentRole,                                                 ||
| |     locale: string,                                                  ||
| |     version: string,                                                 ||
| |     hash: string           // キャッシュ用                           ||
| |   }                                                                  ||
| |                                                                      ||
| | ※ このAPIは正規ベースプロンプトを返す                                ||
| | ※ Enhancement layers やUserContextは含めない (MCP経路向け)           ||
| | ※ バックエンドがOpenAI APIを呼ぶ場合は内部で全レイヤーを結合する     ||
| +---------------------------------------------------------------------+|
+-----------^--------------------------------------+---------------------+
            |                                      |
            | GET /api/prompts/coach               | (内部参照)
            |                                      |
            |                                      v
+----------------------+            +---------------------------------+
| Frontend              |            | OpenAI API Call                   |
|                       |            |                                   |
| useRolePrompt('coach')|            | systemPrompt =                   |
|   -> キャッシュ管理    |            |   canonicalBasePrompt             |
|   -> useMcpChat({      |            |   + enhancementLayers (optional) |
|       systemMessage   |            |   + userContextSection            |
|     })                |            |                                   |
|                       |            | ※ バックエンド内部で全レイヤーを |
| role-prompts.ts は    |            |   結合してOpenAI APIに送信        |
| API呼び出しに          |            +---------------------------------+
| 置き換え              |
+----------------------+
```

### 5.3 データフロー (推奨案適用後)

#### MCP経由チャット (推奨案適用後)

```
Section.MOC.tsx
  |
  +- useRolePrompt('coach', locale)  <- 新しいhook
  |   +- fetch(GET /api/prompts/coach?locale=ja)
  |       +- Backend: RolePromptRegistry.getCanonicalPrompt('coach', 'ja')
  |           +- 正規プロンプト (ai-coach-prompt.ts相当の内容)
  |       +- キャッシュ (localStorage + hash比較)
  |
  +- useMcpChat({ systemMessage: cachedPrompt })
      +- fetch(POST) -> MCP Server
          body: { message, sessionId, systemPrompt, userId }
```

#### OpenAI API経由チャット (推奨案適用後)

```
Section.MOC.tsx
  |
  +- useMastraAgent({ authToken })
      +- fetch(POST) -> Backend API /api/agents/chat
          body: { message, sessionId, locale }
          |
          +- Backend: agents.ts router
              +- coachAgent.processMessage(message, executionContext)
                  +- RolePromptRegistry.buildFullPrompt('coach', 'ja', {
                       includeEnhancements: true,
                       userContext: fetchedUserContext,
                     })
                  +- OpenAI API chat completion
```

### 5.4 プロンプト統一の方針

現在、複数の異なるプロンプト (FE MCP: ~6,000字, BE OpenAI: ~20,000字, インライン: ~37字) が存在する。統一にあたっての方針:

| 項目 | 方針 |
|------|------|
| **正規AIコーチプロンプト** | `ai-coach-prompt.ts` の内容をそのまま保存。バックエンドに配置するが、内容は現行のMCPプロンプトそのもの |
| 応答形式 (AICandidateResponse) | 正規プロンプト内に含まれる形で統一 |
| バックエンド追加レイヤー | ヒアリングフロー、感情対応、カテゴリ検知等はオプショナルな追加レイヤーとして分離 |
| ツール使用禁止指示 | 正規プロンプトに含まれている (MCP経路で必須)。OpenAI経路では不要だが害はない |
| パーソナライゼーション | バックエンド専用レイヤーとして分離 (UserContext注入) |
| 多言語対応 | 現在と同様、locale引数で切り替え |
| インラインプロンプト | `Section.Coach.tsx` / `Section.AIHub.tsx` のインライン最小プロンプトは正規プロンプトへの参照に置き換え |

**パラダイムシフトの理由**: 従来の設計では「バックエンドの `generateSystemPrompt()` をベース」としていたが、ユーザーが好むプロンプトは現行MCP側の `ai-coach-prompt.ts` (~6,000字) である。バックエンド側の追加機能 (ヒアリングフロー等) はリッチだが、正規プロンプトの上に独立した enhancement layer として追加する方が、正規プロンプトの内容を損なわずに機能拡張できる。

### 5.5 MCP経路のレイテンシ軽減策

選択肢Cの主要デメリットである「プロンプト取得のためのAPI追加呼び出し」に対する対策:

1. **初回ロード時のみAPI呼び出し**: フロントエンドのlocalStorageにプロンプトをキャッシュし、hash値で鮮度を管理
2. **SWR (Stale-While-Revalidate) パターン**: キャッシュされたプロンプトを即座に使用しつつ、バックグラウンドで最新版を取得
3. **バージョン管理**: プロンプトにバージョン番号を付与し、変更があった場合のみ再取得
4. **フォールバック**: API呼び出し失敗時はキャッシュされたプロンプトを使用。キャッシュもない場合はフロントエンド内蔵のミニマルプロンプトにフォールバック

```typescript
// Frontend: useRolePrompt hook (概念設計)
function useRolePrompt(role: AgentRole, locale: 'ja' | 'en') {
  const cacheKey = `vow_prompt_${role}_${locale}`;

  // 1. localStorageから即座にロード
  const cached = localStorage.getItem(cacheKey);

  // 2. バックグラウンドで最新版を取得
  useEffect(() => {
    fetch(`/api/prompts/${role}?locale=${locale}`)
      .then(res => res.json())
      .then(data => {
        if (data.hash !== cachedHash) {
          localStorage.setItem(cacheKey, JSON.stringify(data));
        }
      })
      .catch(() => { /* キャッシュ使用を継続 */ });
  }, [role, locale]);

  return cached?.systemPrompt ?? FALLBACK_PROMPTS[role];
}
```

---

## 6. Migration Strategy (移行戦略)

### 6.1 フェーズ0: 準備 (ユーザー影響なし)

- `generateSystemPrompt()` (約1,078行, vow-coach-agent.ts lines 225-1303) のテストを先に作成し、リファクタリング前の出力を記録する
- 現行の `ai-coach-prompt.ts` の内容を正規プロンプトとしてバックエンド側にコピー
- **影響範囲**: なし (既存動作に変更なし)

### 6.2 フェーズ1: プロンプト取得APIの追加

- `GET /api/prompts/:role?locale=ja` エンドポイントを追加
- 認証付き (ログインユーザーのみ)
- 正規プロンプト (= `ai-coach-prompt.ts` の内容) を返す
- **影響範囲**: バックエンドAPIの追加のみ

### 6.3 フェーズ2: バックエンド側のプロンプト整理

- `ai-coach-prompt.ts` の内容を `backend/src/prompts/roles/coach.ts` にそのまま保存
- `generateSystemPrompt()` からヒアリングフロー、感情対応、カテゴリ検知等を enhancement layers として分離
- 新しい `src/prompts/` モジュールを作成
- 既存の `VowCoachAgent` は新モジュールを参照するようリファクタリング
- **影響範囲**: バックエンドのみ、外部API変更なし

### 6.4 フェーズ3: フロントエンド側の切り替え

- `useRolePrompt` hookの実装
- `Section.MOC.tsx` でAPIからプロンプトを取得するよう変更
- `Section.Coach.tsx` / `Section.AIHub.tsx` のインライン最小プロンプトを `useRolePrompt` に置き換え
- `ai-coach-prompt.ts` をフォールバック専用として残す (AC-005: バックエンドダウン時の継続利用)
- `role-prompts.ts` のプロンプト定義をAPI取得に置き換え (メタデータ -- name, icon, description -- は残す)
- MOCセクションのエージェントタブ調査・修正 (Section 9参照)
- **影響範囲**: フロントエンドのみ

### 6.5 フェーズ4: クリーンアップ

- フロントエンド側の旧プロンプト定義を整理 (`ai-coach-prompt.ts` はフォールバック用に縮小版を残す)
- バックエンド側の旧 `generateSystemPrompt()` 関数を削除 (新モジュールに完全移行後)
- テストの整備
- `role-prompts.ts` の RoleConfig メタデータ (name, icon, description) は維持

---

## 7. Acceptance Criteria (受け入れ基準)

- **[AC-001]** 同じロール (例: coach) でMCP経由とOpenAI API経由の両方でチャットした場合、AIの基本的な振る舞い (応答形式、ロール人格) が一致すること。基本振る舞いは現行のMCPプロンプト (`ai-coach-prompt.ts`) の振る舞いをベースとする
- **[AC-002]** プロンプト定義が物理的に1箇所 (`backend/src/prompts/`) にのみ存在すること (フロントエンドのフォールバック用縮小版を除く)
- **[AC-003]** フロントエンドからバックエンドAPIにsystemPromptが直接送信されないこと (MCP経由のフロントエンド直接接続を除く)
- **[AC-004]** プロンプトのキャッシュが機能し、2回目以降のチャットでプロンプト取得APIが不要であること
- **[AC-005]** バックエンドAPIダウン時でもキャッシュされたプロンプトでMCPチャットが利用可能であること
- **[AC-006]** 既存の全テストが引き続きパスすること
- **[AC-007]** 現行のMCPプロンプト (`ai-coach-prompt.ts`) の内容がバックエンドに完全な形で保存され、いつでも参照・取得可能であること
- **[AC-008]** MOCセクションのエージェントタブがMCPサーバー未接続時でもビルトインエージェント一覧を表示すること

---

## 8. Agent Coordination Notes (エージェント調整ノート)

### 担当分離

| タスク | 推奨担当 | 依存 |
|--------|---------|------|
| `ai-coach-prompt.ts` 内容のバックエンド移植 | backend-implementer | なし |
| プロンプト取得API (`GET /api/prompts/:role?locale=ja`) 追加 | backend-implementer | 上記タスク |
| バックエンド `src/prompts/` モジュール作成 (enhancement layers分離) | backend-implementer | API追加完了後 |
| フロントエンド `useRolePrompt` hook作成 | frontend-implementer | API追加完了後 |
| `Section.MOC.tsx` の切り替え | frontend-implementer | hook作成完了後 |
| `Section.Coach.tsx` / `Section.AIHub.tsx` のインラインプロンプト修正 | frontend-implementer | hook作成完了後 |
| MOCエージェントタブ調査・修正 | frontend-implementer | なし (並行可能) |
| テスト作成 | tester | 各フェーズ完了後 |

### 注意事項

- バックエンドの `generateSystemPrompt()` は約1,078行 (lines 225-1303) のプロンプト文字列を含む大規模関数である。分割作業は慎重に行うこと
- `role-prompts.ts` はMCP経由のチャット以外にもUI (ロール選択ドロップダウン等) で使用されている可能性がある。RoleConfigのメタデータ (name, icon, description) は残す必要がある
- MCP経由のフロントエンド直接接続では、フロントエンドからMCPサーバーにsystemPromptを送信する仕組みは維持される (これはMCPプロトコルの要件)
- `/api/agents/cli/chat` (agents.ts line 1481) が既に「バックエンドがプロンプトを生成してMCPに渡す」パターンを実装しており、設計上の参考にすること
- **`aboutOperation` enum値の言語不整合**: フロントエンドEN版は英語値 (`"review" | "new_proposal" | "confirm" | "advice" | "others"`) を使用するが、バックエンドEN版は日本語値 (`"見直し" | "新規提案" | "確認" | "アドバイス" | "others"`) を使用している。プロンプト統一時にパーサーが壊れるリスクがあるため、統一前にバックエンドのEN版を修正すること

---

## 9. MOC Agent Tab Investigation (MOCエージェントタブ調査)

### 9.1 背景

MOCセクション (`Section.MOC.tsx`) のエージェントタブ (Agent tab) は `AgentListView` コンポーネント (line 1445-1507付近) を使用してエージェント一覧を表示する。しかし、MCPサーバーが接続されていない場合に正常に動作しない可能性がある。

### 9.2 調査スコープ

| 調査項目 | 詳細 |
|----------|------|
| `AgentListView` の動作確認 | MCPサーバー未接続時にコンポーネントがどのように表示されるか確認 |
| エージェント一覧のデータソース | MCP経由のみか、ビルトインエージェント定義も含むか |
| エラーハンドリング | MCP接続失敗時にブランク表示、エラー表示、フォールバック表示のいずれになるか |
| ビルトインエージェント | `role-prompts.ts` 等で定義されたロール情報をMCP未接続時でも表示できるか |

### 9.3 期待される修正

- MCPサーバー未接続時でも、ビルトインエージェント (coach, manager等) の一覧が表示されること
- MCPサーバー接続時は、ビルトインエージェントに加えてMCP経由で検出されたエージェントも表示されること
- エージェント一覧のデータソースを `RolePromptRegistry` (または `role-prompts.ts` のメタデータ) と統合し、MCP依存を解消する

### 9.4 実施フェーズ

フェーズ3 (フロントエンド側の切り替え) に含める。`useRolePrompt` hook実装と同時期に対応する。

---

## 10. Cross-Reference: migration-plan.md との整合

### エンドポイント名の標準化

| 用途 | 標準エンドポイント | 備考 |
|------|-------------------|------|
| プロンプト取得API (新規) | `GET /api/prompts/:role?locale=ja` | 両ドキュメントで統一 |
| メインチャットAPI (既存) | `POST /api/agents/chat` | agents.ts line 331。`/api/agents/coach/chat` ではない |
| CLI チャットAPI (既存) | `POST /api/agents/cli/chat` | agents.ts line 1481。MCP fallbackを持つ唯一のエンドポイント |

### 選択肢名の対応表

| architecture.md | migration-plan.md | 説明 |
|----------------|-------------------|------|
| 選択肢A: FE->BE送信 | Option A: Frontend-managed | フロントエンドからプロンプトを送信 |
| 選択肢B: 共有pkg | (該当なし) | monorepo共有モジュール |
| **選択肢C: BE保存+API (推奨)** | **Option B: Backend-managed (推奨)** | バックエンドがプロンプト保存先 |
| 選択肢D: FE正規+統一 | (該当なし) | フロントエンドに統一 |
| (該当なし) | Option C: Hybrid | バックエンド配信+フロントエンドキャッシュ |

**注意**: architecture.md の選択肢Cと migration-plan.md の Option B は同じ推奨案を指す。名称は異なるが内容は一致する。

### フェーズ対応表

| architecture.md | migration-plan.md | 内容 |
|----------------|-------------------|------|
| フェーズ0: 準備 | Phase 0: Preserve Canonical Prompt | 正規プロンプトのコピー・テスト作成 |
| フェーズ1: API追加 | Phase 1: Add Prompt API | `GET /api/prompts/:role` エンドポイント追加 |
| フェーズ2: BE整理 | Phase 2: Backend Uses Canonical Prompt | generateSystemPrompt() のレイヤー分離 |
| フェーズ3: FE切替 | Phase 3: Frontend Unification + MOC Agent Tab | フロントエンドの参照切り替え・エージェントタブ修正 |
| フェーズ4: クリーンアップ | (Phase 3に含む) | 最終整理 |
