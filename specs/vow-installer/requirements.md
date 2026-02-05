# VOW Application Installer Specification

## Overview

- **Purpose**: VOWアプリケーション全体をワンコマンドでセットアップできる統合インストーラ
- **Status**: Draft
- **Version**: 1.0.0
- **Last Updated**: 2026-02-05
- **Author**: vow-spec-architect

## Background

VOWプロジェクトには既存のセットアップスクリプトが存在するが、断片的で初心者には分かりにくい：
- `scripts/deploy-setup.sh` - フロントエンドのみ対象、対話型
- `scripts/quick-deploy.sh` - 全体対象だが、環境設定ガイダンスが不十分

統合インストーラにより、初心者でも確実にセットアップできる体験を提供する。

## Requirements

### Functional Requirements

#### [FR-001] ワンコマンド実行
- ユーザーはルートディレクトリで `./install.sh` を実行するだけでセットアップを開始できる
- 引数なしで対話的ウィザードモード、`--non-interactive` で自動モードをサポート
- 終了コード: 成功=0, エラー=1, ユーザーキャンセル=2

#### [FR-002] 前提条件チェック
- 必須ソフトウェアの存在確認:
  - Node.js 20.0.0以上 (package.json engines参照)
  - npm 10.0.0以上
  - git 2.0.0以上
- 推奨ソフトウェアの確認:
  - Docker 24.0以上 (optional)
  - Docker Compose 2.0以上 (optional)
- 不足時は明確なインストール手順を表示

#### [FR-003] 対話的セットアップウィザード
- ステップバイステップで設定を案内:
  1. セットアップモード選択（開発 / 本番ライク / Docker）
  2. Supabase接続設定入力
  3. APIキー設定（任意）
  4. 確認画面
- 各ステップで前のステップに戻れる（Back機能）
- ESCキーまたは Ctrl+C でキャンセル可能

#### [FR-004] 環境変数ファイル自動生成
- `.env.local` を自動生成（既存ファイルはバックアップ）
- 必須設定:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- 任意設定:
  - `NEXT_PUBLIC_USE_EDGE_FUNCTIONS` (default: false)
  - `NEXT_PUBLIC_USE_SUPABASE_API` (default: true)
  - `NEXT_PUBLIC_SITE_URL` (default: http://localhost:3000)
  - `OPENAI_API_KEY` (optional)
  - `SLACK_WEBHOOK_URL` (optional)

#### [FR-005] 依存関係インストール
- 3段階のnpm install実行:
  1. Root (存在する場合)
  2. Frontend (`/frontend`)
  3. Backend (`/backend`)
- `--prefer-offline` オプションでキャッシュ活用
- package-lock.json存在時は `npm ci` を使用

#### [FR-006] ビルド実行
- TypeScriptコンパイル:
  - Frontend: `npm run build`
  - Backend: `npm run build`
- ビルドエラー時は詳細なエラーメッセージと解決ヒントを表示

#### [FR-007] テスト実行（任意）
- ユニットテスト実行オプション:
  - Frontend: `npm test`
  - Backend: `npm test`
- E2Eテスト実行オプション（`--e2e`フラグ）:
  - `npm run test:e2e`
- テスト失敗時も続行可能（警告表示）

#### [FR-008] 開発サーバー起動スクリプト生成
- `start-dev.sh` スクリプトを生成:
  - Frontend開発サーバー (port 3000)
  - Backend開発サーバー (port 4000)
  - 並列起動またはtmux/screenセッション
- `stop-dev.sh` スクリプトも生成

#### [FR-009] Docker Compose起動オプション
- `--docker` フラグでDocker Composeモード:
  - docker-compose.yml を使用
  - 必要な環境変数を .env にエクスポート
  - `docker-compose up -d` 実行
- ヘルスチェック後に完了報告

### Non-Functional Requirements

#### [NFR-001] 対応OS
- Linux (Ubuntu 20.04+, Debian 11+)
- macOS (12.0 Monterey以降)
- Windows対応は将来バージョンで検討

#### [NFR-002] 実行時間
- 前提条件チェック: 5秒以内
- 依存関係インストール: 5分以内（ネットワーク状況による）
- ビルド: 3分以内
- 全体: 10分以内（テスト除く）

#### [NFR-003] エラーハンドリング
- 全てのコマンドの終了コードをチェック
- エラー発生時は即座に停止（`set -e`）
- ロールバック手順を提示

#### [NFR-004] ログ出力
- 進捗状況を色付きで表示
- 詳細ログは `install.log` に保存
- `--verbose` フラグで詳細出力

#### [NFR-005] 冪等性
- 何度実行しても同じ結果になること
- 既存ファイルは上書きせずバックアップ
- 部分的に失敗した後の再実行をサポート

## Acceptance Criteria

- [AC-001] クリーンな環境で `./install.sh` を実行し、全ステップが完了すること
- [AC-002] Node.js未インストール環境で実行時、明確なエラーメッセージが表示されること
- [AC-003] 生成された `start-dev.sh` で開発サーバーが正常に起動すること
- [AC-004] `--docker` オプションで Docker Compose 環境が正常に起動すること
- [AC-005] Ctrl+C でインストールをキャンセルした場合、クリーンな状態が保たれること
- [AC-006] 既存の `.env.local` がバックアップされ、新規ファイルが生成されること
- [AC-007] `--non-interactive` モードで環境変数から設定を読み取り自動実行できること

## Dependencies

### External Dependencies
- Node.js 20.0.0+
- npm 10.0.0+
- git 2.0.0+
- Docker 24.0+ (optional)
- Docker Compose 2.0+ (optional)

### Internal Dependencies
- `/frontend/package.json`
- `/backend/package.json`
- `/docker-compose.yml`
- `/docs/SETUP.md`

## Agent Coordination Notes

### 並列実装ポイント
このインストーラは以下の3つの独立したコンポーネントに分割可能：

1. **Core Installer** (`install.sh`)
   - 前提条件チェック
   - 対話的ウィザード
   - メインオーケストレーション
   - 担当: Agent A

2. **Environment Setup** (`lib/env-setup.sh`)
   - .env.local生成
   - Supabase設定ガイダンス
   - APIキー設定
   - 担当: Agent B

3. **Service Manager** (`lib/service-manager.sh`)
   - 依存関係インストール
   - ビルド実行
   - テスト実行
   - 開発サーバー管理
   - 担当: Agent C

### インターフェース定義
各コンポーネント間のインターフェースは `tasks.md` で定義。
