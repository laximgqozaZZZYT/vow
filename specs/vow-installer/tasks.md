# VOW Application Installer - Implementation Tasks

## Overview

- **Total Tasks**: 21
- **Estimated Total Time**: 16 hours
- **Recommended Agents**: 3 (parallel execution)
- **Last Updated**: 2026-02-05

## Task Dependencies Graph

```
Phase 1: Foundation (Agent A, B, C 並列可能)
├── TASK-1.1 共通関数ライブラリ (Agent A)
├── TASK-1.2 前提条件チェック (Agent A)
├── TASK-1.3 設定ファイル (Agent A)
│
├── TASK-2.1 環境変数テンプレート (Agent B)
├── TASK-2.2 .env.local生成 (Agent B)
├── TASK-2.3 バックエンド.env生成 (Agent B)
│
└── TASK-3.1 依存関係インストール (Agent C)
    TASK-3.2 ビルド関数 (Agent C)
    TASK-3.3 テスト実行関数 (Agent C)

Phase 2: Integration (全タスク完了後)
├── TASK-4.1 対話的ウィザード (Agent A)
├── TASK-4.2 非対話モード (Agent A)
│
├── TASK-5.1 start-dev.sh生成 (Agent B)
├── TASK-5.2 stop-dev.sh生成 (Agent B)
│
└── TASK-6.1 Docker統合 (Agent C)

Phase 3: Main Installer (Phase 2完了後)
└── TASK-7.1 メインインストーラ (Any Agent)
    TASK-7.2 エントリーポイント (Any Agent)

Phase 4: Testing & Documentation
├── TASK-8.1 ユニットテスト
├── TASK-8.2 統合テスト
└── TASK-8.3 ドキュメント更新
```

---

## Phase 1: Foundation (Parallelizable)

### Agent A: Core Infrastructure

#### TASK-1.1: 共通関数ライブラリ作成
- **File**: `/home/ubuntu/Downloads/vow/scripts/installer/lib/common.sh`
- **Time**: 1 hour
- **Prerequisites**: None
- **Description**:
  - ログ関数（log_info, log_success, log_warning, log_error, log_step）
  - 色定義（RED, GREEN, YELLOW, BLUE, CYAN, NC）
  - バージョン比較関数 `version_gte()`
  - ユーザー確認関数 `confirm()`
  - プログレスバー関数 `show_progress()`
  - クリーンアップ/トラップ設定
- **Acceptance Criteria**:
  - `source common.sh` でエラーなくロードできる
  - 全関数が期待通りの出力を生成する
  - Ctrl+C でクリーンアップが実行される

#### TASK-1.2: 前提条件チェック実装
- **File**: `/home/ubuntu/Downloads/vow/scripts/installer/lib/prereq.sh`
- **Time**: 1.5 hours
- **Prerequisites**: TASK-1.1
- **Description**:
  - `check_node()` - Node.js 20+チェック
  - `check_npm()` - npm 10+チェック
  - `check_git()` - git存在チェック
  - `check_docker()` - Docker存在チェック（optional）
  - `check_docker_compose()` - Docker Compose存在チェック（optional）
  - `run_prerequisite_checks()` - 全チェック実行
- **Interface**:
  ```bash
  # Return: 0=success, 1=failure
  # Sets: DOCKER_AVAILABLE=true/false
  run_prerequisite_checks
  ```
- **Acceptance Criteria**:
  - Node.js未インストール環境で明確なエラー表示
  - Docker未インストール時は警告のみ（続行可能）

#### TASK-1.3: 設定ファイル作成
- **File**: `/home/ubuntu/Downloads/vow/scripts/installer/config.sh`
- **Time**: 0.5 hours
- **Prerequisites**: None
- **Description**:
  - バージョン要件定義
  - ポート番号定義
  - ファイルパス定義
- **Content**:
  ```bash
  # Version requirements
  readonly REQUIRED_NODE_VERSION="20.0.0"
  readonly REQUIRED_NPM_VERSION="10.0.0"
  readonly REQUIRED_GIT_VERSION="2.0.0"
  readonly RECOMMENDED_DOCKER_VERSION="24.0.0"

  # Ports
  readonly FRONTEND_PORT=3000
  readonly BACKEND_PORT=4000

  # Paths
  readonly FRONTEND_DIR="frontend"
  readonly BACKEND_DIR="backend"
  readonly LOG_FILE="install.log"
  ```

---

### Agent B: Environment Setup

#### TASK-2.1: 環境変数テンプレート作成
- **File**: `/home/ubuntu/Downloads/vow/scripts/installer/templates/env.template`
- **Time**: 0.5 hours
- **Prerequisites**: None
- **Description**:
  - フロントエンド用 .env.local テンプレート
  - プレースホルダー（{{SUPABASE_URL}}等）使用
  - コメントで各変数の説明を含める
- **Content Structure**:
  ```
  # Supabase Configuration (Required)
  NEXT_PUBLIC_SUPABASE_URL={{SUPABASE_URL}}
  NEXT_PUBLIC_SUPABASE_ANON_KEY={{SUPABASE_KEY}}
  ...
  ```

#### TASK-2.2: .env.local生成関数実装
- **File**: `/home/ubuntu/Downloads/vow/scripts/installer/lib/env-setup.sh`
- **Time**: 1 hour
- **Prerequisites**: TASK-2.1
- **Description**:
  - `backup_existing_env()` - 既存ファイルのバックアップ
  - `generate_env_file()` - テンプレートから .env.local 生成
  - `validate_env_file()` - 生成ファイルの検証
- **Interface**:
  ```bash
  # Reads from WIZARD_STATE associative array
  # Creates: frontend/.env.local
  generate_env_file "frontend/.env.local"
  ```
- **Acceptance Criteria**:
  - 既存ファイルが `.backup.YYYYMMDD_HHMMSS` 形式でバックアップされる
  - 生成ファイルに必須変数が全て含まれる

#### TASK-2.3: バックエンド環境変数生成
- **File**: (TASK-2.2 と同じファイルに追加)
- **Time**: 0.5 hours
- **Prerequisites**: TASK-2.2
- **Description**:
  - `generate_backend_env()` - backend/.env 生成
  - ポート設定、Supabase設定、オプション設定
- **Acceptance Criteria**:
  - backend/.env が正しく生成される
  - バックエンドサーバーが起動できる設定になっている

---

### Agent C: Service Management

#### TASK-3.1: 依存関係インストール関数
- **File**: `/home/ubuntu/Downloads/vow/scripts/installer/lib/service.sh`
- **Time**: 1 hour
- **Prerequisites**: TASK-1.1
- **Description**:
  - `install_frontend_deps()` - Frontend npm install
  - `install_backend_deps()` - Backend npm install
  - `install_dependencies()` - 全依存関係インストール
  - package-lock.json存在時は `npm ci` 使用
  - プログレス表示
- **Interface**:
  ```bash
  # Return: 0=success, 1=failure
  install_dependencies
  ```
- **Acceptance Criteria**:
  - Frontend/Backend両方の node_modules がインストールされる
  - エラー時に詳細なメッセージが表示される

#### TASK-3.2: ビルド関数実装
- **File**: (TASK-3.1 と同じファイルに追加)
- **Time**: 1 hour
- **Prerequisites**: TASK-3.1
- **Description**:
  - `build_frontend()` - Next.js ビルド
  - `build_backend()` - TypeScript コンパイル
  - `build_projects()` - 両方のビルド実行
  - エラー時のヒント表示
- **Acceptance Criteria**:
  - ビルドエラー時に解決ヒントが表示される
  - ビルド成功時にログに記録される

#### TASK-3.3: テスト実行関数
- **File**: (TASK-3.1 と同じファイルに追加)
- **Time**: 0.5 hours
- **Prerequisites**: TASK-3.2
- **Description**:
  - `run_unit_tests()` - Jest/Vitest テスト実行
  - `run_e2e_tests()` - Playwright E2E テスト実行
  - テスト失敗時も続行可能（警告表示）
- **Acceptance Criteria**:
  - テストスキップ時に明確なメッセージ
  - テスト失敗時も install は完了する

---

## Phase 2: Integration

### Agent A: Wizard Implementation

#### TASK-4.1: 対話的ウィザード実装
- **File**: `/home/ubuntu/Downloads/vow/scripts/installer/lib/wizard.sh`
- **Time**: 2 hours
- **Prerequisites**: TASK-1.1, TASK-1.3
- **Description**:
  - `WIZARD_STATE` 連想配列定義
  - `show_welcome()` - ウェルカム画面
  - `select_mode()` - モード選択（development/production/docker）
  - `input_supabase_config()` - Supabase設定入力
  - `input_optional_config()` - オプション設定入力
  - `show_summary()` - 設定サマリー表示と確認
  - `run_wizard()` - ウィザードメイン関数
- **Interface**:
  ```bash
  # Populates WIZARD_STATE array
  # Returns: 0=success, 2=cancelled
  run_wizard
  ```
- **Acceptance Criteria**:
  - Supabase URL形式バリデーションが機能する
  - ESCキー/Ctrl+Cでキャンセル可能
  - 設定サマリーが見やすく表示される

#### TASK-4.2: 非対話モード実装
- **File**: (TASK-4.1 と同じファイルに追加)
- **Time**: 1 hour
- **Prerequisites**: TASK-4.1
- **Description**:
  - `load_from_environment()` - 環境変数からWIZARD_STATE読み込み
  - `validate_environment()` - 必須環境変数チェック
  - 環境変数名: `VOW_SUPABASE_URL`, `VOW_SUPABASE_KEY`, `VOW_MODE`, etc.
- **Acceptance Criteria**:
  - `--non-interactive` フラグで環境変数から設定取得
  - 必須変数未設定時にエラー

---

### Agent B: Script Generation

#### TASK-5.1: start-dev.sh生成
- **File**: (TASK-2.2 と同じファイルに追加、または新規)
- **Time**: 1 hour
- **Prerequisites**: TASK-1.3
- **Description**:
  - `generate_start_script()` - 開発サーバー起動スクリプト生成
  - Frontend: `npm run dev` (port 3000)
  - Backend: `npm run dev` (port 4000)
  - Ctrl+C で両サーバー停止
  - 起動確認メッセージ
- **Output**: `/home/ubuntu/Downloads/vow/start-dev.sh`
- **Acceptance Criteria**:
  - 生成スクリプトが実行可能（chmod +x）
  - 両サーバーが並列起動する
  - Ctrl+Cで両方停止する

#### TASK-5.2: stop-dev.sh生成
- **File**: (TASK-5.1 と同じ)
- **Time**: 0.5 hours
- **Prerequisites**: TASK-5.1
- **Description**:
  - `generate_stop_script()` - 停止スクリプト生成
  - `pkill` でプロセス停止
- **Output**: `/home/ubuntu/Downloads/vow/stop-dev.sh`
- **Acceptance Criteria**:
  - サーバーが確実に停止する
  - サーバー未起動時もエラーにならない

---

### Agent C: Docker Integration

#### TASK-6.1: Docker Compose統合
- **File**: (TASK-3.1 と同じファイルに追加)
- **Time**: 1.5 hours
- **Prerequisites**: TASK-1.2, TASK-2.2
- **Description**:
  - `docker_setup()` - Docker Compose セットアップ
  - 環境変数エクスポート
  - `docker compose build`
  - `docker compose up -d`
  - ヘルスチェック（リトライ付き）
- **Acceptance Criteria**:
  - `--docker` フラグで Docker Compose 起動
  - ヘルスチェック後に完了報告
  - Docker未インストール時にエラー

---

## Phase 3: Main Installer

#### TASK-7.1: メインインストーラ実装
- **File**: `/home/ubuntu/Downloads/vow/scripts/installer/main.sh`
- **Time**: 1.5 hours
- **Prerequisites**: Phase 1, Phase 2 全タスク
- **Description**:
  - 全ライブラリのsource
  - インストールフロー制御
  - エラーハンドリング
  - ログファイル管理
- **Flow**:
  ```
  1. Parse arguments
  2. run_prerequisite_checks()
  3. run_wizard() or load_from_environment()
  4. setup_environment()
  5. install_dependencies()
  6. build_projects()
  7. run_tests() (optional)
  8. run_e2e_tests() (optional)
  9. generate_start_script()
  10. generate_stop_script()
  11. show_completion_message()
  ```

#### TASK-7.2: エントリーポイント作成
- **File**: `/home/ubuntu/Downloads/vow/install.sh`
- **Time**: 0.5 hours
- **Prerequisites**: TASK-7.1
- **Description**:
  - シンプルなエントリーポイント
  - scripts/installer/main.sh を呼び出す
  - 実行権限付与
- **Content**:
  ```bash
  #!/bin/bash
  # VOW Application Installer
  # Usage: ./install.sh [--non-interactive] [--docker] [--verbose]

  set -e
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  source "$SCRIPT_DIR/scripts/installer/main.sh"
  main "$@"
  ```
- **Acceptance Criteria**:
  - `./install.sh` で実行可能
  - `./install.sh --help` でヘルプ表示

---

## Phase 4: Testing & Documentation

#### TASK-8.1: ユニットテスト作成
- **Files**: `/home/ubuntu/Downloads/vow/scripts/installer/tests/`
- **Time**: 1.5 hours
- **Prerequisites**: Phase 3
- **Description**:
  - `test-prereq.sh` - 前提条件チェックテスト
  - `test-env.sh` - 環境変数生成テスト
  - `test-service.sh` - サービス管理テスト
- **Acceptance Criteria**:
  - 各テストが独立して実行可能
  - モック環境でテスト可能

#### TASK-8.2: 統合テスト作成
- **File**: `/home/ubuntu/Downloads/vow/scripts/installer/tests/integration-test.sh`
- **Time**: 1 hour
- **Prerequisites**: TASK-8.1
- **Description**:
  - Docker環境でのフルインストールテスト
  - クリーンな環境からの実行確認
- **Acceptance Criteria**:
  - CI/CDパイプラインで実行可能

#### TASK-8.3: ドキュメント更新
- **Files**:
  - `/home/ubuntu/Downloads/vow/docs/SETUP.md` (更新)
  - `/home/ubuntu/Downloads/vow/README.md` (更新)
- **Time**: 1 hour
- **Prerequisites**: Phase 3
- **Description**:
  - インストーラの使い方を追記
  - Quick Start セクション更新
  - トラブルシューティング追加
- **Acceptance Criteria**:
  - 初心者がドキュメントだけでセットアップ可能

---

## Summary by Agent

### Agent A (Core Infrastructure)
| Task ID | Task Name | Time | Status |
|---------|-----------|------|--------|
| TASK-1.1 | 共通関数ライブラリ | 1h | [ ] |
| TASK-1.2 | 前提条件チェック | 1.5h | [ ] |
| TASK-1.3 | 設定ファイル | 0.5h | [ ] |
| TASK-4.1 | 対話的ウィザード | 2h | [ ] |
| TASK-4.2 | 非対話モード | 1h | [ ] |
| **Total** | | **6h** | |

### Agent B (Environment Setup)
| Task ID | Task Name | Time | Status |
|---------|-----------|------|--------|
| TASK-2.1 | 環境変数テンプレート | 0.5h | [ ] |
| TASK-2.2 | .env.local生成 | 1h | [ ] |
| TASK-2.3 | バックエンド.env生成 | 0.5h | [ ] |
| TASK-5.1 | start-dev.sh生成 | 1h | [ ] |
| TASK-5.2 | stop-dev.sh生成 | 0.5h | [ ] |
| **Total** | | **3.5h** | |

### Agent C (Service Management)
| Task ID | Task Name | Time | Status |
|---------|-----------|------|--------|
| TASK-3.1 | 依存関係インストール | 1h | [ ] |
| TASK-3.2 | ビルド関数 | 1h | [ ] |
| TASK-3.3 | テスト実行関数 | 0.5h | [ ] |
| TASK-6.1 | Docker統合 | 1.5h | [ ] |
| **Total** | | **4h** | |

### Shared Tasks (Any Agent)
| Task ID | Task Name | Time | Status |
|---------|-----------|------|--------|
| TASK-7.1 | メインインストーラ | 1.5h | [ ] |
| TASK-7.2 | エントリーポイント | 0.5h | [ ] |
| TASK-8.1 | ユニットテスト | 1.5h | [ ] |
| TASK-8.2 | 統合テスト | 1h | [ ] |
| TASK-8.3 | ドキュメント更新 | 1h | [ ] |
| **Total** | | **5.5h** | |

---

## Parallel Execution Timeline

```
Hour 1-2: Phase 1 (Parallel)
  Agent A: TASK-1.1, TASK-1.2
  Agent B: TASK-2.1, TASK-2.2
  Agent C: TASK-3.1

Hour 3-4: Phase 1 (continued) + Phase 2 (start)
  Agent A: TASK-1.3, TASK-4.1 (start)
  Agent B: TASK-2.3, TASK-5.1
  Agent C: TASK-3.2, TASK-3.3

Hour 5-6: Phase 2 (complete)
  Agent A: TASK-4.1 (complete), TASK-4.2
  Agent B: TASK-5.2
  Agent C: TASK-6.1

Hour 7-8: Phase 3
  Any Agent: TASK-7.1, TASK-7.2

Hour 9-10: Phase 4
  Agent A: TASK-8.1
  Agent B: TASK-8.2
  Agent C: TASK-8.3
```

**Estimated Total Duration**: 10 hours (with 3 parallel agents)
**Estimated Sequential Duration**: 16 hours (single agent)

---

## Notes for Agents

### Before Starting
1. Read `requirements.md` and `design.md` thoroughly
2. Check task prerequisites
3. Claim your tasks by updating this file

### File Conventions
- Use 2-space indentation for shell scripts
- Include shebang `#!/bin/bash` at top
- Add `set -e` for error handling
- Use `shellcheck` for linting

### Testing
- Test each function individually before integration
- Use mock data for Supabase credentials during development
- Verify on both bash and zsh

### Coordination
- Update task status when starting/completing
- Document any interface changes in design.md
- Notify other agents of breaking changes
