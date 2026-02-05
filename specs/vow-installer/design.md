# VOW Application Installer - Technical Design

## Overview

- **Purpose**: インストーラの技術設計書
- **Status**: Draft
- **Version**: 1.0.0
- **Last Updated**: 2026-02-05
- **Author**: vow-spec-architect

## Architecture

### Directory Structure

```
vow/
├── install.sh                 # メインエントリーポイント
├── scripts/
│   └── installer/
│       ├── lib/
│       │   ├── common.sh      # 共通関数（ログ、色、ユーティリティ）
│       │   ├── prereq.sh      # 前提条件チェック
│       │   ├── wizard.sh      # 対話的ウィザード
│       │   ├── env-setup.sh   # 環境変数設定
│       │   └── service.sh     # サービス管理
│       ├── templates/
│       │   ├── env.template   # .env.local テンプレート
│       │   ├── start-dev.template  # 開発サーバー起動テンプレート
│       │   └── stop-dev.template   # 開発サーバー停止テンプレート
│       └── config.sh          # 設定値（バージョン要件等）
├── start-dev.sh               # 生成される起動スクリプト
└── stop-dev.sh                # 生成される停止スクリプト
```

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      install.sh (Entry Point)                │
│  - Parse arguments                                          │
│  - Load libraries                                           │
│  - Orchestrate installation flow                            │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  prereq.sh  │   │  wizard.sh  │   │ env-setup.sh│
│             │   │             │   │             │
│ - Node.js   │   │ - Mode      │   │ - .env.local│
│ - npm       │   │   Selection │   │ - Supabase  │
│ - git       │   │ - Config    │   │ - API Keys  │
│ - Docker    │   │   Input     │   │ - Backup    │
└──────┬──────┘   └──────┬──────┘   └──────┬──────┘
       │                 │                 │
       └────────────┬────┴────────────────┘
                    │
                    ▼
          ┌─────────────────┐
          │   service.sh    │
          │                 │
          │ - npm install   │
          │ - npm build     │
          │ - npm test      │
          │ - start/stop    │
          └─────────────────┘
```

## Detailed Design

### 1. common.sh - 共通関数

```bash
# 定数
readonly VOW_INSTALLER_VERSION="1.0.0"
readonly LOG_FILE="install.log"

# 色定義
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m'  # No Color

# ログ関数
log_info()    { echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1" | tee -a "$LOG_FILE"; }
log_warning() { echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$LOG_FILE"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"; }
log_step()    { echo -e "${CYAN}[STEP]${NC} $1" | tee -a "$LOG_FILE"; }

# 進捗バー
show_progress() {
  local current=$1
  local total=$2
  local width=50
  local percent=$((current * 100 / total))
  local filled=$((width * current / total))
  local empty=$((width - filled))
  printf "\r[%${filled}s%${empty}s] %d%%" "" "" "$percent" | tr ' ' '#' '='
}

# バージョン比較
version_gte() {
  # $1 >= $2 なら true
  printf '%s\n%s' "$2" "$1" | sort -V -C
}

# ユーザー確認
confirm() {
  local prompt="${1:-Continue?}"
  read -p "$prompt [y/N] " -n 1 -r
  echo
  [[ $REPLY =~ ^[Yy]$ ]]
}

# クリーンアップ関数（Ctrl+C対応）
cleanup() {
  echo ""
  log_warning "Installation cancelled by user."
  exit 2
}

trap cleanup INT TERM
```

### 2. prereq.sh - 前提条件チェック

```bash
# 設定（config.shから読み込み）
readonly REQUIRED_NODE_VERSION="20.0.0"
readonly REQUIRED_NPM_VERSION="10.0.0"
readonly REQUIRED_GIT_VERSION="2.0.0"
readonly RECOMMENDED_DOCKER_VERSION="24.0.0"

check_node() {
  if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed."
    echo "  Install: https://nodejs.org/ or use nvm:"
    echo "    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash"
    echo "    nvm install 20"
    return 1
  fi

  local version=$(node --version | sed 's/v//')
  if ! version_gte "$version" "$REQUIRED_NODE_VERSION"; then
    log_error "Node.js $version is too old. Required: $REQUIRED_NODE_VERSION+"
    return 1
  fi

  log_success "Node.js $version"
  return 0
}

check_npm() {
  if ! command -v npm &> /dev/null; then
    log_error "npm is not installed."
    return 1
  fi

  local version=$(npm --version)
  if ! version_gte "$version" "$REQUIRED_NPM_VERSION"; then
    log_warning "npm $version is below recommended version $REQUIRED_NPM_VERSION"
    # 警告のみ、続行可能
  fi

  log_success "npm $version"
  return 0
}

check_git() {
  if ! command -v git &> /dev/null; then
    log_error "git is not installed."
    return 1
  fi

  local version=$(git --version | awk '{print $3}')
  log_success "git $version"
  return 0
}

check_docker() {
  if ! command -v docker &> /dev/null; then
    log_warning "Docker is not installed (optional)"
    return 1
  fi

  local version=$(docker --version | awk '{print $3}' | tr -d ',')
  log_success "Docker $version"
  return 0
}

check_docker_compose() {
  if docker compose version &> /dev/null; then
    local version=$(docker compose version --short)
    log_success "Docker Compose $version"
    return 0
  elif command -v docker-compose &> /dev/null; then
    local version=$(docker-compose --version | awk '{print $3}' | tr -d ',')
    log_success "docker-compose $version"
    return 0
  else
    log_warning "Docker Compose is not installed (optional)"
    return 1
  fi
}

run_prerequisite_checks() {
  log_step "Checking prerequisites..."

  local errors=0

  check_node || ((errors++))
  check_npm || ((errors++))
  check_git || ((errors++))

  # Docker は任意
  DOCKER_AVAILABLE=false
  if check_docker && check_docker_compose; then
    DOCKER_AVAILABLE=true
  fi

  if [[ $errors -gt 0 ]]; then
    log_error "Prerequisite check failed. Please install missing dependencies."
    return 1
  fi

  log_success "All prerequisites satisfied."
  return 0
}
```

### 3. wizard.sh - 対話的ウィザード

```bash
# ウィザード状態
declare -A WIZARD_STATE=(
  [mode]=""           # development | production | docker
  [supabase_url]=""
  [supabase_key]=""
  [openai_key]=""
  [slack_webhook]=""
  [run_tests]="false"
  [run_e2e]="false"
)

show_welcome() {
  clear
  echo "====================================="
  echo "   VOW Application Installer v$VOW_INSTALLER_VERSION"
  echo "====================================="
  echo ""
  echo "This wizard will guide you through setting up the VOW application."
  echo ""
  echo "Press Ctrl+C at any time to cancel."
  echo ""
}

select_mode() {
  log_step "Step 1: Select Setup Mode"
  echo ""
  echo "1) Development  - Local development with hot reload"
  echo "2) Production   - Production-like build for testing"
  echo "3) Docker       - Full stack in Docker containers"
  echo ""

  while true; do
    read -p "Select mode [1-3]: " choice
    case $choice in
      1) WIZARD_STATE[mode]="development"; break ;;
      2) WIZARD_STATE[mode]="production"; break ;;
      3)
        if [[ "$DOCKER_AVAILABLE" != "true" ]]; then
          log_error "Docker is not available. Please select another option."
          continue
        fi
        WIZARD_STATE[mode]="docker"
        break
        ;;
      *) echo "Invalid option. Please enter 1, 2, or 3." ;;
    esac
  done

  log_success "Mode selected: ${WIZARD_STATE[mode]}"
}

input_supabase_config() {
  log_step "Step 2: Supabase Configuration"
  echo ""
  echo "You need a Supabase project. Create one at: https://supabase.com"
  echo "Find your credentials in: Project Settings > API"
  echo ""

  # URL入力
  while true; do
    read -p "Supabase Project URL (e.g., https://xxx.supabase.co): " url
    if [[ $url =~ ^https://[a-z0-9]+\.supabase\.co$ ]]; then
      WIZARD_STATE[supabase_url]="$url"
      break
    else
      echo "Invalid URL format. Expected: https://xxxxx.supabase.co"
    fi
  done

  # Anon Key入力
  while true; do
    read -p "Supabase Anon Key: " key
    if [[ ${#key} -gt 100 ]]; then
      WIZARD_STATE[supabase_key]="$key"
      break
    else
      echo "Key seems too short. Please check and re-enter."
    fi
  done

  log_success "Supabase configuration saved."
}

input_optional_config() {
  log_step "Step 3: Optional Configuration"
  echo ""

  if confirm "Configure OpenAI API Key? (for AI features)"; then
    read -p "OpenAI API Key: " key
    WIZARD_STATE[openai_key]="$key"
  fi

  if confirm "Configure Slack Webhook? (for notifications)"; then
    read -p "Slack Webhook URL: " url
    WIZARD_STATE[slack_webhook]="$url"
  fi

  if confirm "Run unit tests after build?"; then
    WIZARD_STATE[run_tests]="true"
  fi

  if confirm "Run E2E tests after build? (requires Playwright)"; then
    WIZARD_STATE[run_e2e]="true"
  fi
}

show_summary() {
  log_step "Step 4: Confirm Configuration"
  echo ""
  echo "========================================"
  echo "  Configuration Summary"
  echo "========================================"
  echo "  Mode:          ${WIZARD_STATE[mode]}"
  echo "  Supabase URL:  ${WIZARD_STATE[supabase_url]}"
  echo "  Supabase Key:  ${WIZARD_STATE[supabase_key]:0:20}..."
  echo "  OpenAI Key:    ${WIZARD_STATE[openai_key]:+configured}"
  echo "  Slack Webhook: ${WIZARD_STATE[slack_webhook]:+configured}"
  echo "  Run Tests:     ${WIZARD_STATE[run_tests]}"
  echo "  Run E2E:       ${WIZARD_STATE[run_e2e]}"
  echo "========================================"
  echo ""

  if ! confirm "Proceed with installation?"; then
    log_warning "Installation cancelled."
    exit 2
  fi
}

run_wizard() {
  show_welcome
  select_mode
  input_supabase_config
  input_optional_config
  show_summary
}
```

### 4. env-setup.sh - 環境変数設定

```bash
# テンプレートファイルパス
readonly ENV_TEMPLATE="scripts/installer/templates/env.template"

backup_existing_env() {
  local env_file="$1"

  if [[ -f "$env_file" ]]; then
    local backup="${env_file}.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$env_file" "$backup"
    log_info "Existing $env_file backed up to $backup"
  fi
}

generate_env_file() {
  local target="${1:-frontend/.env.local}"

  log_step "Generating $target..."

  backup_existing_env "$target"

  cat > "$target" << EOF
# Generated by VOW Installer v$VOW_INSTALLER_VERSION
# Date: $(date -Iseconds)

# Supabase Configuration (Required)
NEXT_PUBLIC_SUPABASE_URL=${WIZARD_STATE[supabase_url]}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${WIZARD_STATE[supabase_key]}

# Supabase Integration Settings
NEXT_PUBLIC_USE_EDGE_FUNCTIONS=false
NEXT_PUBLIC_USE_SUPABASE_API=true

# Site URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Backend API URL (for local development)
NEXT_PUBLIC_API_URL=http://localhost:4000
EOF

  # Optional configurations
  if [[ -n "${WIZARD_STATE[openai_key]}" ]]; then
    echo "" >> "$target"
    echo "# OpenAI Configuration (Optional)" >> "$target"
    echo "OPENAI_API_KEY=${WIZARD_STATE[openai_key]}" >> "$target"
    echo "OPENAI_ENABLED=true" >> "$target"
  fi

  if [[ -n "${WIZARD_STATE[slack_webhook]}" ]]; then
    echo "" >> "$target"
    echo "# Slack Configuration (Optional)" >> "$target"
    echo "SLACK_WEBHOOK_URL=${WIZARD_STATE[slack_webhook]}" >> "$target"
    echo "SLACK_ENABLED=true" >> "$target"
  fi

  log_success "Generated $target"
}

generate_backend_env() {
  local target="backend/.env"

  log_step "Generating $target..."

  backup_existing_env "$target"

  cat > "$target" << EOF
# Generated by VOW Installer v$VOW_INSTALLER_VERSION
# Date: $(date -Iseconds)

# Server Configuration
PORT=4000
NODE_ENV=development

# Supabase Configuration
SUPABASE_URL=${WIZARD_STATE[supabase_url]}
SUPABASE_SERVICE_ROLE_KEY=${WIZARD_STATE[supabase_key]}
EOF

  if [[ -n "${WIZARD_STATE[openai_key]}" ]]; then
    echo "OPENAI_API_KEY=${WIZARD_STATE[openai_key]}" >> "$target"
    echo "OPENAI_ENABLED=true" >> "$target"
  fi

  log_success "Generated $target"
}

setup_environment() {
  generate_env_file "frontend/.env.local"
  generate_backend_env
}
```

### 5. service.sh - サービス管理

```bash
install_dependencies() {
  log_step "Installing dependencies..."

  local total_steps=2
  local current=0

  # Frontend
  ((current++))
  log_info "[$current/$total_steps] Installing frontend dependencies..."
  cd frontend
  if [[ -f "package-lock.json" ]]; then
    npm ci --prefer-offline 2>&1 | tee -a "../$LOG_FILE"
  else
    npm install --prefer-offline 2>&1 | tee -a "../$LOG_FILE"
  fi
  cd ..

  # Backend
  ((current++))
  log_info "[$current/$total_steps] Installing backend dependencies..."
  cd backend
  if [[ -f "package-lock.json" ]]; then
    npm ci --prefer-offline 2>&1 | tee -a "../$LOG_FILE"
  else
    npm install --prefer-offline 2>&1 | tee -a "../$LOG_FILE"
  fi
  cd ..

  log_success "Dependencies installed."
}

build_projects() {
  log_step "Building projects..."

  # Backend build (TypeScript)
  log_info "Building backend..."
  cd backend
  npm run build 2>&1 | tee -a "../$LOG_FILE"
  if [[ $? -ne 0 ]]; then
    log_error "Backend build failed."
    cd ..
    return 1
  fi
  cd ..

  # Frontend build (Next.js)
  log_info "Building frontend..."
  cd frontend
  npm run build 2>&1 | tee -a "../$LOG_FILE"
  if [[ $? -ne 0 ]]; then
    log_error "Frontend build failed."
    log_info "Hint: Check .env.local and TypeScript errors"
    cd ..
    return 1
  fi
  cd ..

  log_success "Build completed."
}

run_tests() {
  if [[ "${WIZARD_STATE[run_tests]}" != "true" ]]; then
    log_info "Skipping unit tests (not requested)."
    return 0
  fi

  log_step "Running unit tests..."

  # Backend tests
  log_info "Running backend tests..."
  cd backend
  npm test 2>&1 | tee -a "../$LOG_FILE" || log_warning "Some backend tests failed"
  cd ..

  # Frontend tests
  log_info "Running frontend tests..."
  cd frontend
  npm test 2>&1 | tee -a "../$LOG_FILE" || log_warning "Some frontend tests failed"
  cd ..

  log_success "Tests completed."
}

run_e2e_tests() {
  if [[ "${WIZARD_STATE[run_e2e]}" != "true" ]]; then
    log_info "Skipping E2E tests (not requested)."
    return 0
  fi

  log_step "Running E2E tests..."

  cd frontend
  npx playwright install --with-deps 2>&1 | tee -a "../$LOG_FILE"
  npm run test:e2e 2>&1 | tee -a "../$LOG_FILE" || log_warning "Some E2E tests failed"
  cd ..

  log_success "E2E tests completed."
}

generate_start_script() {
  log_step "Generating start-dev.sh..."

  cat > start-dev.sh << 'EOF'
#!/bin/bash
# Generated by VOW Installer
# Starts frontend and backend development servers

set -e

echo "Starting VOW development servers..."

# Kill existing processes on ports
cleanup() {
  echo "Stopping servers..."
  pkill -f "next dev" 2>/dev/null || true
  pkill -f "tsx watch" 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

# Start backend (port 4000)
echo "Starting backend on port 4000..."
cd backend
npm run dev &
BACKEND_PID=$!
cd ..

# Wait for backend to be ready
sleep 3

# Start frontend (port 3000)
echo "Starting frontend on port 3000..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "========================================"
echo "  VOW Development Servers Running"
echo "========================================"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:4000"
echo "========================================"
echo "  Press Ctrl+C to stop all servers"
echo ""

# Wait for either process to exit
wait $FRONTEND_PID $BACKEND_PID
EOF

  chmod +x start-dev.sh
  log_success "Generated start-dev.sh"
}

generate_stop_script() {
  log_step "Generating stop-dev.sh..."

  cat > stop-dev.sh << 'EOF'
#!/bin/bash
# Generated by VOW Installer
# Stops frontend and backend development servers

echo "Stopping VOW development servers..."

pkill -f "next dev" 2>/dev/null && echo "Frontend stopped" || echo "Frontend was not running"
pkill -f "tsx watch" 2>/dev/null && echo "Backend stopped" || echo "Backend was not running"

echo "Done."
EOF

  chmod +x stop-dev.sh
  log_success "Generated stop-dev.sh"
}

docker_setup() {
  log_step "Setting up Docker environment..."

  # Export environment for docker-compose
  export NEXT_PUBLIC_SUPABASE_URL="${WIZARD_STATE[supabase_url]}"
  export NEXT_PUBLIC_SUPABASE_ANON_KEY="${WIZARD_STATE[supabase_key]}"

  if [[ -n "${WIZARD_STATE[openai_key]}" ]]; then
    export OPENAI_API_KEY="${WIZARD_STATE[openai_key]}"
    export OPENAI_ENABLED=true
  fi

  log_info "Building Docker images..."
  docker compose build 2>&1 | tee -a "$LOG_FILE"

  log_info "Starting containers..."
  docker compose up -d 2>&1 | tee -a "$LOG_FILE"

  # Health check
  log_info "Waiting for services to be healthy..."
  local retries=30
  while [[ $retries -gt 0 ]]; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
      log_success "Services are running!"
      break
    fi
    ((retries--))
    sleep 2
  done

  if [[ $retries -eq 0 ]]; then
    log_warning "Services may not be fully ready. Check with: docker compose ps"
  fi
}
```

## Non-Interactive Mode

`--non-interactive` フラグ使用時は環境変数から設定を読み取る：

```bash
# Required environment variables for non-interactive mode
VOW_SUPABASE_URL=https://xxx.supabase.co
VOW_SUPABASE_KEY=your_anon_key

# Optional
VOW_OPENAI_KEY=sk-xxx
VOW_SLACK_WEBHOOK=https://hooks.slack.com/xxx
VOW_MODE=development  # development | production | docker
VOW_RUN_TESTS=true
VOW_RUN_E2E=false
```

## Error Handling Strategy

```bash
# Global error handler
handle_error() {
  local line=$1
  local exit_code=$2
  log_error "Error on line $line (exit code: $exit_code)"
  log_error "Check $LOG_FILE for details"

  echo ""
  echo "Troubleshooting steps:"
  echo "1. Review the log file: cat $LOG_FILE"
  echo "2. Check prerequisites: node -v, npm -v, git --version"
  echo "3. Verify .env.local configuration"
  echo "4. Run install.sh again after fixing issues"
  echo ""

  exit 1
}

trap 'handle_error ${LINENO} $?' ERR
```

## Testing Strategy

### Unit Tests
- `test/installer/prereq.test.sh` - 前提条件チェックのテスト
- `test/installer/wizard.test.sh` - ウィザードフローのテスト
- `test/installer/env.test.sh` - 環境変数生成のテスト

### Integration Tests
- Docker環境でのフルインストールテスト
- 各種OSでの互換性テスト

## Security Considerations

- APIキーは `.env.local` に保存（.gitignore済み）
- ログファイルにはシークレットを含めない
- テンプレートファイルにはプレースホルダーのみ
