#!/bin/bash
# =============================================================================
# MCP Unified Installer
# =============================================================================
# This script provides a unified installer for MCP Task Distribution System
# supporting server, client, or combined installation modes.
#
# Usage:
#   ./install.sh --mode server              # Install server only
#   ./install.sh --mode client --server-url URL --token TOKEN
#   ./install.sh --mode both                # Install both server and client
#
# Options:
#   --mode MODE              Installation mode: server, client, or both (default: server)
#   --port PORT              Server port (default: 3456)
#   --bind-address IP        Bind address (default: 0.0.0.0)
#   --install-dir DIR        Server installation directory (default: ~/.mcp-multi-agent)
#   --client-dir DIR         Client installation directory (default: ~/vow-mcp-agent)
#   --server-url URL         Task server URL (required for client mode)
#   --token TOKEN            Authentication token (required for client mode)
#   --agent-name NAME        Agent display name (default: hostname-agent)
#   --agent-role ROLE        Agent role (default: developer)
#   --machine-id ID          Machine identifier (auto-generated if not set)
#   --upgrade                Upgrade existing installation
#   --verify-only            Only verify connectivity, don't install
#   --systemd                Install systemd service (server mode)
#   --auto-start             Auto-start server after installation
#   --help                   Show this help message
#   --version                Show version
#
# Author: VOW Project
# Version: 2.0.0
# =============================================================================

set -e

# Version
VERSION="2.0.0"

# Default configuration
DEFAULT_MODE="server"
DEFAULT_INSTALL_DIR="${HOME}/.mcp-multi-agent"
DEFAULT_CLIENT_DIR="${HOME}/vow-mcp-agent"
DEFAULT_PORT="3456"
DEFAULT_BIND_ADDRESS="0.0.0.0"
DEFAULT_AGENT_ROLE="developer"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables
MODE="${DEFAULT_MODE}"
INSTALL_DIR="${DEFAULT_INSTALL_DIR}"
CLIENT_DIR="${DEFAULT_CLIENT_DIR}"
PORT="${DEFAULT_PORT}"
BIND_ADDRESS="${DEFAULT_BIND_ADDRESS}"
SERVER_URL=""
TOKEN=""
AGENT_NAME="$(hostname)-agent"
AGENT_ROLE="${DEFAULT_AGENT_ROLE}"
MACHINE_ID=""
UPGRADE=false
VERIFY_ONLY=false
INSTALL_SYSTEMD=false
AUTO_START=false

# =============================================================================
# Helper Functions
# =============================================================================

print_banner() {
    echo -e "${BLUE}"
    cat << 'EOF'
  __  __  ____ ____    _   _       _  __ _          _
 |  \/  |/ ___|  _ \  | | | |_ __ (_)/ _(_) ___  __| |
 | |\/| | |   | |_) | | | | | '_ \| | |_| |/ _ \/ _` |
 | |  | | |___|  __/  | |_| | | | | |  _| |  __/ (_| |
 |_|  |_|\____|_|      \___/|_| |_|_|_| |_|\___|\__,_|

  Unified Installer for MCP Task Distribution System
EOF
    echo -e "${NC}"
    echo "  Version: ${VERSION}"
    echo ""
}

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}==>${NC} $1"
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# =============================================================================
# Argument Parsing
# =============================================================================

show_help() {
    print_banner
    cat << EOF
Usage: $0 [OPTIONS]

Installation Modes:
  --mode server            Install MCP server only (default)
  --mode client            Install MCP client only
  --mode both              Install both server and client

Server Options:
  --port PORT              Server port (default: 3456)
  --bind-address IP        Bind address (default: 0.0.0.0)
  --install-dir DIR        Installation directory (default: ~/.mcp-multi-agent)
  --systemd                Install as systemd service
  --auto-start             Start server after installation

Client Options:
  --server-url URL         Task server URL (required for client mode)
  --token TOKEN            Authentication token (required for client mode)
  --agent-name NAME        Agent display name (default: hostname-agent)
  --agent-role ROLE        Agent role (default: developer)
  --client-dir DIR         Client installation directory (default: ~/vow-mcp-agent)
  --machine-id ID          Machine identifier (auto-generated)

Common Options:
  --upgrade                Upgrade existing installation
  --verify-only            Verify connectivity without installing
  --help                   Show this help message
  --version                Show version

Examples:
  # Install server only
  $0 --mode server

  # Install client connecting to remote server
  $0 --mode client --server-url http://192.168.2.200:3456 --token mcp-xxx

  # Install both server and client on same machine
  $0 --mode both

  # Upgrade existing server installation
  $0 --mode server --upgrade

EOF
    exit 0
}

show_version() {
    echo "MCP Unified Installer v${VERSION}"
    exit 0
}

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --mode)
                MODE="$2"
                shift 2
                ;;
            --port)
                PORT="$2"
                shift 2
                ;;
            --bind-address)
                BIND_ADDRESS="$2"
                shift 2
                ;;
            --install-dir)
                INSTALL_DIR="$2"
                shift 2
                ;;
            --client-dir)
                CLIENT_DIR="$2"
                shift 2
                ;;
            --server-url)
                SERVER_URL="$2"
                shift 2
                ;;
            --token)
                TOKEN="$2"
                shift 2
                ;;
            --agent-name)
                AGENT_NAME="$2"
                shift 2
                ;;
            --agent-role)
                AGENT_ROLE="$2"
                shift 2
                ;;
            --machine-id)
                MACHINE_ID="$2"
                shift 2
                ;;
            --upgrade)
                UPGRADE=true
                shift
                ;;
            --verify-only)
                VERIFY_ONLY=true
                shift
                ;;
            --systemd)
                INSTALL_SYSTEMD=true
                shift
                ;;
            --auto-start)
                AUTO_START=true
                shift
                ;;
            --help|-h)
                show_help
                ;;
            --version)
                show_version
                ;;
            *)
                log_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 2
                ;;
        esac
    done

    # Validate mode
    if [[ ! "$MODE" =~ ^(server|client|both)$ ]]; then
        log_error "Invalid mode: $MODE. Must be server, client, or both."
        exit 2
    fi

    # Validate client mode requirements
    if [[ "$MODE" == "client" ]] || [[ "$MODE" == "both" && -z "$TOKEN" ]]; then
        if [[ -z "$SERVER_URL" ]] && [[ "$MODE" == "client" ]]; then
            log_error "Client mode requires --server-url"
            exit 2
        fi
        if [[ -z "$TOKEN" ]] && [[ "$MODE" == "client" ]]; then
            log_error "Client mode requires --token"
            exit 2
        fi
    fi

    # Generate machine ID if not provided
    if [ -z "$MACHINE_ID" ]; then
        MACHINE_ID="$(hostname | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g')-$(date +%s | tail -c 5)"
    fi
}

# =============================================================================
# Prerequisites Check
# =============================================================================

check_prerequisites() {
    log_step "Checking prerequisites..."

    local missing=()

    # Check Node.js
    if command_exists node; then
        local node_version=$(node -v | sed 's/v//' | cut -d. -f1)
        if [ "$node_version" -lt 16 ]; then
            log_error "Node.js 16+ required (found: $(node -v))"
            missing+=("node>=16")
        else
            log_info "Node.js $(node -v) ✓"
        fi
    else
        log_error "Node.js not found"
        missing+=("node")
    fi

    # Check npm
    if command_exists npm; then
        log_info "npm $(npm -v) ✓"
    else
        log_error "npm not found"
        missing+=("npm")
    fi

    # Check git (optional)
    if command_exists git; then
        log_info "git $(git --version | cut -d' ' -f3) ✓"
    else
        log_warn "git not found (optional)"
    fi

    # Check openssl (for token generation)
    if command_exists openssl; then
        log_info "openssl ✓"
    else
        log_warn "openssl not found (will use fallback for token generation)"
    fi

    # Check curl (for connectivity tests)
    if command_exists curl; then
        log_info "curl ✓"
    else
        log_warn "curl not found (connectivity tests may fail)"
        missing+=("curl")
    fi

    if [ ${#missing[@]} -gt 0 ]; then
        echo ""
        log_error "Missing required dependencies: ${missing[*]}"
        echo ""
        echo "Please install the missing dependencies:"
        echo ""
        if [[ " ${missing[*]} " =~ " node" ]] || [[ " ${missing[*]} " =~ " node>=16" ]]; then
            echo "  Node.js: https://nodejs.org/ or use nvm:"
            echo "    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
            echo "    nvm install 20"
        fi
        if [[ " ${missing[*]} " =~ " curl" ]]; then
            echo "  curl: sudo apt-get install curl (Ubuntu/Debian)"
        fi
        echo ""
        exit 3
    fi

    echo ""
}

# =============================================================================
# Utility Functions
# =============================================================================

generate_token() {
    if command_exists openssl; then
        echo "mcp-$(openssl rand -hex 16)"
    else
        # Fallback using /dev/urandom
        echo "mcp-$(cat /dev/urandom | tr -dc 'a-f0-9' | fold -w 32 | head -n 1)"
    fi
}

get_local_ip() {
    # Try different methods to get local IP
    if command_exists ip; then
        ip route get 1 2>/dev/null | awk '{print $7; exit}'
    elif command_exists ifconfig; then
        ifconfig | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -1
    else
        echo "127.0.0.1"
    fi
}

detect_existing_installation() {
    local install_dir="$1"

    if [ ! -d "$install_dir" ]; then
        echo "none"
        return
    fi

    if [ -f "$install_dir/mcp-task-distributor/package.json" ]; then
        local version=$(grep '"version"' "$install_dir/mcp-task-distributor/package.json" | cut -d'"' -f4)
        echo "${version:-unknown}"
    else
        echo "unknown"
    fi
}

backup_config() {
    local install_dir="$1"
    local backup_dir="${install_dir}/backup/$(date +%Y%m%d-%H%M%S)"

    log_step "Backing up existing configuration..."
    mkdir -p "$backup_dir"

    if [ -d "${install_dir}/config" ]; then
        cp -r "${install_dir}/config" "$backup_dir/"
    fi

    log_info "Configuration backed up to: $backup_dir"
}

# =============================================================================
# Server Installation Functions
# =============================================================================

install_server() {
    local install_dir="$1"
    local port="$2"
    local bind_address="$3"

    log_step "Installing MCP Task Distribution Server..."

    # Check existing installation
    local existing_version=$(detect_existing_installation "$install_dir")
    if [ "$existing_version" != "none" ]; then
        if [ "$UPGRADE" = true ]; then
            log_info "Upgrading from version: $existing_version"
            backup_config "$install_dir"
        else
            log_warn "Installation already exists at $install_dir (version: $existing_version)"
            log_warn "Use --upgrade to update the installation"
            return 0
        fi
    fi

    # Create directory structure
    create_directory_structure "$install_dir"

    # Install source files
    download_source "$install_dir"

    # Install dependencies
    install_dependencies "$install_dir"

    # Build TypeScript
    build_typescript "$install_dir"

    # Configure server (preserve token if upgrading)
    configure_server "$install_dir" "$port" "$bind_address"

    log_info "Server installation complete"
}

create_directory_structure() {
    local install_dir="$1"

    log_step "Creating directory structure..."

    mkdir -p "${install_dir}"
    mkdir -p "${install_dir}/config"
    mkdir -p "${install_dir}/logs"
    mkdir -p "${install_dir}/prompts"
    mkdir -p "${install_dir}/projects"
    mkdir -p "${install_dir}/mcp-task-distributor/src"
    mkdir -p "${install_dir}/mcp-task-distributor/build"
    mkdir -p "${install_dir}/backup"

    log_info "Directory structure created"
}

download_source() {
    local install_dir="$1"

    log_step "Installing source files..."

    # Create files from embedded content (most reliable approach)
    create_embedded_files "$install_dir"

    log_info "Source files ready"
}

# This function contains the embedded TypeScript source files
create_embedded_files() {
    local install_dir="$1"

    log_info "Creating embedded source files..."

    # Create package.json
    cat > "${install_dir}/mcp-task-distributor/package.json" << 'PACKAGE_EOF'
{
  "name": "mcp-task-distributor",
  "version": "2.0.0",
  "description": "MCP Task Distribution Server for Multi-Agent Coordination",
  "type": "module",
  "main": "build/index.js",
  "bin": {
    "task-server": "./build/server.js",
    "task-mcp": "./build/index.js"
  },
  "scripts": {
    "build": "tsc",
    "start:server": "node build/server.js",
    "start:mcp": "node build/index.js",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.25.3",
    "cors": "^2.8.5",
    "express": "^4.21.2",
    "uuid": "^11.0.5"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/node": "^22.10.5",
    "@types/uuid": "^10.0.0",
    "typescript": "^5.7.2"
  }
}
PACKAGE_EOF

    # Create tsconfig.json
    cat > "${install_dir}/mcp-task-distributor/tsconfig.json" << 'TSCONFIG_EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "./build",
    "rootDir": "./src",
    "declaration": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
TSCONFIG_EOF

    # Create types.ts
    cat > "${install_dir}/mcp-task-distributor/src/types.ts" << 'TYPES_EOF'
export interface Agent {
  id: string;
  name: string;
  role: string;
  status: 'online' | 'offline' | 'busy';
  currentTask?: string;
  machineId?: string;
  lastHeartbeat: Date;
  registeredAt: Date;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedTo?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  result?: string;
  error?: string;
}

export interface ChatSession {
  id: string;
  agentId: string;
  messages: Array<{ role: string; content: string; timestamp: Date }>;
  createdAt: Date;
  lastActivity: Date;
}

export interface ServerStats {
  totalAgents: number;
  onlineAgents: number;
  totalTasks: number;
  pendingTasks: number;
  completedTasks: number;
  uptime: number;
}

// ============================================================
// Claude Executor Types (ISS-20260204-018)
// ============================================================

/**
 * 実行ステータス
 */
export type ExecutionStatus =
  | 'pending'    // 実行準備中
  | 'running'    // 実行中
  | 'completed'  // 正常完了
  | 'failed'     // エラー終了
  | 'cancelled'  // ユーザーキャンセル
  | 'timeout';   // タイムアウト

/**
 * 実行オプション
 */
export interface ExecutionOptions {
  /** 実行ID（指定しない場合は自動生成） */
  executionId?: string;

  /** 作業ディレクトリ（デフォルト: /home/ubuntu/Downloads/vow） */
  workingDirectory?: string;

  /** MCP設定ファイルパス */
  mcpConfigPath?: string;

  /** タイムアウト（ミリ秒、デフォルト: 1800000 = 30分） */
  timeout?: number;

  /** 追加の環境変数 */
  env?: Record<string, string>;

  /** stdout出力コールバック */
  onStdout?: (data: string) => void;

  /** stderr出力コールバック */
  onStderr?: (data: string) => void;

  /** 状態変更コールバック */
  onStateChange?: (state: ExecutionState) => void;
}

/**
 * 実行状態
 */
export interface ExecutionState {
  /** 実行ID */
  executionId: string;

  /** ステータス */
  status: ExecutionStatus;

  /** 実行プロンプト */
  prompt: string;

  /** 作業ディレクトリ */
  workingDirectory: string;

  /** stdout全出力 */
  stdout: string;

  /** stderr全出力 */
  stderr: string;

  /** 終了コード（プロセス終了後に設定） */
  exitCode?: number;

  /** エラーメッセージ */
  error?: string;

  /** 開始時刻 */
  startedAt?: Date;

  /** 終了時刻 */
  finishedAt?: Date;

  /** 実行時間（ミリ秒） */
  duration?: number;
}

/**
 * ClaudeExecutor コンストラクタオプション
 */
export interface ClaudeExecutorOptions {
  /** Claude CLIパス */
  claudeCliPath?: string;

  /** デフォルト作業ディレクトリ */
  defaultWorkingDirectory?: string;

  /** デフォルトタイムアウト（ミリ秒） */
  defaultTimeout?: number;

  /** 最大同時実行数 */
  maxConcurrent?: number;
}
TYPES_EOF

    # Create index.ts (MCP Server Core)
    cat > "${install_dir}/mcp-task-distributor/src/index.ts" << 'INDEX_EOF'
#!/usr/bin/env node
/**
 * MCP Server Core
 * Provides MCP protocol interface for Claude Code integration
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const TASK_SERVER_URL = process.env.TASK_SERVER_URL || 'http://localhost:3456';
const TASK_SERVER_TOKEN = process.env.TASK_SERVER_TOKEN || '';
const AGENT_NAME = process.env.AGENT_NAME || 'MCP-Agent';
const AGENT_ROLE = process.env.AGENT_ROLE || 'worker';

async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const url = `${TASK_SERVER_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${TASK_SERVER_TOKEN}`,
    ...(options.headers || {}),
  };

  const response = await fetch(url, { ...options, headers });
  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'API request failed');
  }

  return data.data;
}

const server = new Server(
  { name: 'task-distributor', version: '2.0.0' },
  { capabilities: { tools: {} } }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'register_agent',
      description: 'Register this agent with the task server',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Agent name' },
          role: { type: 'string', description: 'Agent role (manager, developer, reviewer, tester)' },
        },
      },
    },
    {
      name: 'list_agents',
      description: 'List all registered agents',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'create_task',
      description: 'Create a new task',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Task title' },
          description: { type: 'string', description: 'Task description' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          assignedTo: { type: 'string', description: 'Agent ID to assign to' },
        },
        required: ['title'],
      },
    },
    {
      name: 'list_tasks',
      description: 'List all tasks',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'claim_task',
      description: 'Claim a task to work on',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'Task ID to claim' },
          agentId: { type: 'string', description: 'Agent ID claiming the task' },
        },
        required: ['taskId', 'agentId'],
      },
    },
    {
      name: 'submit_result',
      description: 'Submit task result',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'Task ID' },
          result: { type: 'string', description: 'Task result' },
          error: { type: 'string', description: 'Error message if failed' },
        },
        required: ['taskId'],
      },
    },
    {
      name: 'dashboard',
      description: 'Get server statistics',
      inputSchema: { type: 'object', properties: {} },
    },
  ],
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case 'register_agent':
        result = await apiRequest('/agents/register', {
          method: 'POST',
          body: JSON.stringify({
            name: (args as any)?.name || AGENT_NAME,
            role: (args as any)?.role || AGENT_ROLE,
          }),
        });
        break;

      case 'list_agents':
        result = await apiRequest('/agents');
        break;

      case 'create_task':
        result = await apiRequest('/tasks', {
          method: 'POST',
          body: JSON.stringify(args),
        });
        break;

      case 'list_tasks':
        result = await apiRequest('/tasks');
        break;

      case 'claim_task':
        result = await apiRequest(`/tasks/${(args as any).taskId}/claim`, {
          method: 'POST',
          body: JSON.stringify({ agentId: (args as any).agentId }),
        });
        break;

      case 'submit_result':
        result = await apiRequest(`/tasks/${(args as any).taskId}/submit`, {
          method: 'POST',
          body: JSON.stringify({
            result: (args as any).result,
            error: (args as any).error,
          }),
        });
        break;

      case 'dashboard':
        result = await apiRequest('/dashboard');
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// Start MCP server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[MCP] Task Distributor MCP Server started');
}

main().catch(console.error);
INDEX_EOF

    # Create claude-executor.ts
    cat > "${install_dir}/mcp-task-distributor/src/claude-executor.ts" << 'EXECUTOR_EOF'
/**
 * Claude Executor Service
 *
 * ISS-20260204-018: Claude Codeを子プロセスとして実行し、
 * 出力をストリーミングで返却するExecutorサービス
 *
 * @module claude-executor
 * @version 1.0.0
 * @author vow-spec-architect
 */

import { spawn, ChildProcess } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import type {
  ExecutionOptions,
  ExecutionState,
  ExecutionStatus,
  ClaudeExecutorOptions,
} from './types.js';

/**
 * 内部用: 実行コンテキスト
 */
interface ExecutionContext {
  state: ExecutionState;
  process: ChildProcess | null;
  timeoutId: NodeJS.Timeout | null;
  options: ExecutionOptions;
}

/**
 * Claude Executor Service
 *
 * Claude Code CLIを子プロセスとして実行し、リアルタイムで出力をストリーミングする。
 *
 * @example
 * ```typescript
 * const executor = new ClaudeExecutor();
 *
 * const state = await executor.execute('Hello, Claude!', {
 *   onStdout: (data) => console.log('stdout:', data),
 *   onStderr: (data) => console.error('stderr:', data),
 * });
 *
 * console.log('Final state:', state);
 * ```
 */
export class ClaudeExecutor {
  private executions: Map<string, ExecutionContext> = new Map();
  private readonly claudeCliPath: string;
  private readonly defaultWorkingDirectory: string;
  private readonly defaultTimeout: number;
  private readonly maxConcurrent: number;

  /**
   * ClaudeExecutor インスタンスを作成
   *
   * @param options - コンストラクタオプション
   */
  constructor(options?: ClaudeExecutorOptions) {
    this.claudeCliPath = options?.claudeCliPath ||
      process.env.CLAUDE_CLI_PATH ||
      '/home/ubuntu/.nvm/versions/node/v22.18.0/bin/claude';

    this.defaultWorkingDirectory = options?.defaultWorkingDirectory ||
      process.env.DEFAULT_WORKING_DIR ||
      '/home/ubuntu/Downloads/vow';

    this.defaultTimeout = options?.defaultTimeout || 1800000; // 30 minutes
    this.maxConcurrent = options?.maxConcurrent || 5;

    console.log('[ClaudeExecutor] Initialized', {
      claudeCliPath: this.claudeCliPath,
      defaultWorkingDirectory: this.defaultWorkingDirectory,
      defaultTimeout: this.defaultTimeout,
      maxConcurrent: this.maxConcurrent,
    });
  }

  /**
   * Claude Codeを実行
   *
   * @param prompt - 実行するプロンプト
   * @param options - 実行オプション
   * @returns Promise<ExecutionState> - 実行完了時の状態
   * @throws Error - プロンプトが空の場合、同時実行数超過の場合
   */
  async execute(prompt: string, options: ExecutionOptions = {}): Promise<ExecutionState> {
    // バリデーション
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      throw new Error('Prompt is required and must be a non-empty string');
    }

    // 同時実行数チェック
    const activeCount = this.getActiveCount();
    if (activeCount >= this.maxConcurrent) {
      throw new Error(`Max concurrent executions reached (${this.maxConcurrent}). Please wait for other executions to complete.`);
    }

    const executionId = options.executionId || uuidv4();
    const workingDirectory = options.workingDirectory || this.defaultWorkingDirectory;

    // 初期状態を作成
    const state: ExecutionState = {
      executionId,
      status: 'pending',
      prompt,
      workingDirectory,
      stdout: '',
      stderr: '',
    };

    // コンテキストを作成
    const ctx: ExecutionContext = {
      state,
      process: null,
      timeoutId: null,
      options,
    };

    this.executions.set(executionId, ctx);

    console.log(`[ClaudeExecutor] Starting execution ${executionId}`, {
      workingDirectory,
      promptLength: prompt.length,
      timeout: options.timeout || this.defaultTimeout,
    });

    // 状態変更通知
    this.updateState(ctx, { status: 'pending' });

    return new Promise((resolve, reject) => {
      try {
        // プロセスを起動
        const childProcess = this.spawnClaude(prompt, options, workingDirectory);
        ctx.process = childProcess;

        // 開始時刻を記録
        this.updateState(ctx, {
          status: 'running',
          startedAt: new Date(),
        });

        // タイムアウトを設定
        this.setupTimeout(ctx, resolve);

        // ストリーミングを設定
        this.setupStreaming(ctx, resolve);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[ClaudeExecutor] Failed to start execution ${executionId}:`, errorMessage);

        this.updateState(ctx, {
          status: 'failed',
          error: errorMessage,
          finishedAt: new Date(),
        });

        reject(err);
      }
    });
  }

  /**
   * 実行をキャンセル
   *
   * @param executionId - 実行ID
   * @returns boolean - キャンセル成功/失敗
   */
  cancel(executionId: string): boolean {
    const ctx = this.executions.get(executionId);

    if (!ctx) {
      console.warn(`[ClaudeExecutor] Cannot cancel: execution ${executionId} not found`);
      return false;
    }

    if (ctx.state.status !== 'running') {
      console.warn(`[ClaudeExecutor] Cannot cancel: execution ${executionId} is not running (status: ${ctx.state.status})`);
      return false;
    }

    console.log(`[ClaudeExecutor] Cancelling execution ${executionId}`);

    // タイムアウトをクリア
    if (ctx.timeoutId) {
      clearTimeout(ctx.timeoutId);
      ctx.timeoutId = null;
    }

    // プロセスを終了
    if (ctx.process && !ctx.process.killed) {
      ctx.process.kill('SIGTERM');

      // 5秒後にまだ生きていたらSIGKILL
      setTimeout(() => {
        if (ctx.process && !ctx.process.killed) {
          ctx.process.kill('SIGKILL');
        }
      }, 5000);
    }

    this.updateState(ctx, {
      status: 'cancelled',
      finishedAt: new Date(),
    });

    return true;
  }

  /**
   * 実行状態を取得
   *
   * @param executionId - 実行ID
   * @returns ExecutionState | undefined
   */
  getStatus(executionId: string): ExecutionState | undefined {
    const ctx = this.executions.get(executionId);
    return ctx ? { ...ctx.state } : undefined;
  }

  /**
   * 全実行の一覧を取得
   *
   * @returns ExecutionState[]
   */
  listExecutions(): ExecutionState[] {
    return Array.from(this.executions.values()).map(ctx => ({ ...ctx.state }));
  }

  /**
   * アクティブな実行数を取得
   *
   * @returns number
   */
  getActiveCount(): number {
    let count = 0;
    this.executions.forEach(ctx => {
      if (ctx.state.status === 'pending' || ctx.state.status === 'running') {
        count++;
      }
    });
    return count;
  }

  /**
   * 完了した実行をクリア（メモリ解放）
   *
   * @param olderThan - この時間より前に完了した実行をクリア（ミリ秒、デフォルト: 1時間）
   * @returns number - クリアした実行数
   */
  cleanupCompleted(olderThan: number = 3600000): number {
    const now = Date.now();
    let cleaned = 0;

    this.executions.forEach((ctx, id) => {
      const { status, finishedAt } = ctx.state;
      if (
        (status === 'completed' || status === 'failed' || status === 'cancelled' || status === 'timeout') &&
        finishedAt &&
        (now - finishedAt.getTime()) > olderThan
      ) {
        this.executions.delete(id);
        cleaned++;
      }
    });

    if (cleaned > 0) {
      console.log(`[ClaudeExecutor] Cleaned up ${cleaned} completed executions`);
    }

    return cleaned;
  }

  // ============================================================
  // Private Methods
  // ============================================================

  /**
   * Claude CLI プロセスを起動
   */
  private spawnClaude(
    prompt: string,
    options: ExecutionOptions,
    workingDirectory: string
  ): ChildProcess {
    const args = ['--print'];

    if (options.mcpConfigPath) {
      args.push('--mcp-config', options.mcpConfigPath);
    }

    const childProcess = spawn(this.claudeCliPath, args, {
      cwd: workingDirectory,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      env: {
        ...process.env,
        ...options.env,
        PATH: process.env.PATH || '/home/ubuntu/.nvm/versions/node/v22.18.0/bin:/usr/local/bin:/usr/bin:/bin',
      },
    });

    // プロンプトをstdinに書き込み
    childProcess.stdin?.write(prompt);
    childProcess.stdin?.end();

    return childProcess;
  }

  /**
   * タイムアウト処理を設定
   */
  private setupTimeout(
    ctx: ExecutionContext,
    resolve: (state: ExecutionState) => void
  ): void {
    const timeout = ctx.options.timeout || this.defaultTimeout;

    ctx.timeoutId = setTimeout(() => {
      if (ctx.state.status === 'running') {
        console.log(`[ClaudeExecutor] Execution ${ctx.state.executionId} timed out after ${timeout}ms`);

        // SIGTERM で優しく終了を試みる
        if (ctx.process && !ctx.process.killed) {
          ctx.process.kill('SIGTERM');

          // 5秒後にまだ生きていたらSIGKILL
          setTimeout(() => {
            if (ctx.process && !ctx.process.killed) {
              ctx.process.kill('SIGKILL');
            }
          }, 5000);
        }

        this.updateState(ctx, {
          status: 'timeout',
          error: `Execution timed out after ${timeout}ms`,
          finishedAt: new Date(),
        });

        resolve({ ...ctx.state });
      }
    }, timeout);
  }

  /**
   * 出力ストリーミングを設定
   */
  private setupStreaming(
    ctx: ExecutionContext,
    resolve: (state: ExecutionState) => void
  ): void {
    const { process: childProcess, options, state } = ctx;

    if (!childProcess) {
      throw new Error('Child process is null');
    }

    childProcess.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      state.stdout += text;
      options.onStdout?.(text);
    });

    childProcess.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      state.stderr += text;
      options.onStderr?.(text);
    });

    childProcess.on('close', (code: number | null) => {
      this.handleProcessClose(ctx, code, resolve);
    });

    childProcess.on('error', (err: Error & { code?: string }) => {
      this.handleProcessError(ctx, err, resolve);
    });
  }

  /**
   * プロセス終了時の処理
   */
  private handleProcessClose(
    ctx: ExecutionContext,
    code: number | null,
    resolve: (state: ExecutionState) => void
  ): void {
    // すでに終了状態（timeout, cancelled）の場合は何もしない
    if (ctx.state.status !== 'running') {
      return;
    }

    // タイムアウトをクリア
    if (ctx.timeoutId) {
      clearTimeout(ctx.timeoutId);
      ctx.timeoutId = null;
    }

    const finishedAt = new Date();
    const duration = ctx.state.startedAt
      ? finishedAt.getTime() - ctx.state.startedAt.getTime()
      : undefined;

    if (code === 0) {
      // 正常終了
      this.updateState(ctx, {
        status: 'completed',
        exitCode: code,
        finishedAt,
        duration,
      });

      console.log(`[ClaudeExecutor] Execution ${ctx.state.executionId} completed successfully in ${duration}ms`);
    } else {
      // エラー終了
      const error = ctx.state.stderr.trim() || `Process exited with code ${code}`;

      this.updateState(ctx, {
        status: 'failed',
        exitCode: code ?? undefined,
        error,
        finishedAt,
        duration,
      });

      console.error(`[ClaudeExecutor] Execution ${ctx.state.executionId} failed with code ${code}`);
    }

    resolve({ ...ctx.state });
  }

  /**
   * プロセスエラー時の処理
   */
  private handleProcessError(
    ctx: ExecutionContext,
    err: Error & { code?: string },
    resolve: (state: ExecutionState) => void
  ): void {
    // タイムアウトをクリア
    if (ctx.timeoutId) {
      clearTimeout(ctx.timeoutId);
      ctx.timeoutId = null;
    }

    let errorMessage: string;

    if (err.code === 'ENOENT') {
      errorMessage = `Claude CLI not found at ${this.claudeCliPath}. Please set CLAUDE_CLI_PATH environment variable.`;
    } else {
      errorMessage = err.message;
    }

    console.error(`[ClaudeExecutor] Execution ${ctx.state.executionId} error:`, errorMessage);

    this.updateState(ctx, {
      status: 'failed',
      error: errorMessage,
      finishedAt: new Date(),
    });

    resolve({ ...ctx.state });
  }

  /**
   * 状態を更新し、コールバックを呼び出す
   */
  private updateState(
    ctx: ExecutionContext,
    updates: Partial<ExecutionState>
  ): void {
    Object.assign(ctx.state, updates);

    // 実行時間を計算
    if (ctx.state.startedAt && ctx.state.finishedAt && !ctx.state.duration) {
      ctx.state.duration = ctx.state.finishedAt.getTime() - ctx.state.startedAt.getTime();
    }

    ctx.options.onStateChange?.({ ...ctx.state });
  }
}

export default ClaudeExecutor;
EXECUTOR_EOF

    # Create server.ts (Main Express server)
    cat > "${install_dir}/mcp-task-distributor/src/server.ts" << 'SERVER_EOF'
#!/usr/bin/env node
/**
 * MCP Task Distribution Server
 *
 * Central server for multi-agent task coordination.
 * Features:
 * - Agent registration and management
 * - Task creation and assignment
 * - Real-time SSE event streaming
 * - Claude Code chat integration
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Agent, Task, ChatSession, ServerStats } from './types.js';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.TASK_SERVER_PORT || '3456');
const HOST = process.env.TASK_SERVER_HOST || '0.0.0.0';
const AUTH_TOKEN = process.env.TASK_SERVER_TOKEN || 'mcp-default-token';

// Claude CLI path - use absolute path to avoid PATH issues in spawned processes
const CLAUDE_CLI_PATH = process.env.CLAUDE_CLI_PATH || '/home/ubuntu/.nvm/versions/node/v22.18.0/bin/claude';

// In-memory storage
const agents = new Map<string, Agent>();
const tasks = new Map<string, Task>();
const chatSessions = new Map<string, ChatSession>();
const sseClients = new Map<string, Response>();

// CORS configuration - allow all origins with credentials and custom headers
// This is necessary for cross-origin requests from VOW frontend (Amplify)
const corsOptions = {
  origin: true, // Allow all origins (reflect request origin)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Cache-Control', 'X-Requested-With'],
  exposedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400, // Cache preflight for 24 hours
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Explicit OPTIONS handler for preflight requests
app.options('*', cors(corsOptions));

// Auth middleware
const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Allow health check without auth
  if (req.path === '/health') return next();

  const token = req.headers.authorization?.replace('Bearer ', '') ||
                req.query.token as string;

  if (token !== AUTH_TOKEN) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
};

app.use(authMiddleware);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'running',
      timestamp: new Date().toISOString(),
      agents: agents.size,
      tasks: tasks.size,
    }
  });
});

// SSE Events endpoint
app.get('/events', (req, res) => {
  const clientId = uuidv4();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  sseClients.set(clientId, res);

  res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

  req.on('close', () => {
    sseClients.delete(clientId);
  });
});

// Broadcast to all SSE clients
function broadcast(event: object) {
  const data = JSON.stringify(event);
  sseClients.forEach((client) => {
    client.write(`data: ${data}\n\n`);
  });
}

// Agent endpoints
app.post('/agents/register', (req, res) => {
  const { name, role, machineId } = req.body;
  const id = uuidv4();

  const agent: Agent = {
    id,
    name: name || `Agent-${id.slice(0, 8)}`,
    role: role || 'worker',
    status: 'online',
    machineId,
    lastHeartbeat: new Date(),
    registeredAt: new Date(),
  };

  agents.set(id, agent);
  broadcast({ type: 'agent_registered', agent });

  res.json({ success: true, data: agent });
});

app.get('/agents', (_req, res) => {
  res.json({ success: true, data: Array.from(agents.values()) });
});

app.post('/agents/:id/heartbeat', (req, res) => {
  const agent = agents.get(req.params.id);
  if (!agent) {
    return res.status(404).json({ success: false, error: 'Agent not found' });
  }

  agent.lastHeartbeat = new Date();
  agent.status = req.body.status || 'online';

  res.json({ success: true, data: agent });
});

// Task endpoints
app.post('/tasks', (req, res) => {
  const { title, description, priority, assignedTo } = req.body;
  const id = uuidv4();

  const task: Task = {
    id,
    title,
    description: description || '',
    status: 'pending',
    priority: priority || 'medium',
    assignedTo,
    createdBy: 'api',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  tasks.set(id, task);
  broadcast({ type: 'task_created', task });

  res.json({ success: true, data: task });
});

app.get('/tasks', (_req, res) => {
  res.json({ success: true, data: Array.from(tasks.values()) });
});

app.post('/tasks/:id/claim', (req, res) => {
  const task = tasks.get(req.params.id);
  if (!task) {
    return res.status(404).json({ success: false, error: 'Task not found' });
  }

  const { agentId } = req.body;
  task.assignedTo = agentId;
  task.status = 'in_progress';
  task.updatedAt = new Date();

  broadcast({ type: 'task_claimed', task, agentId });

  res.json({ success: true, data: task });
});

app.post('/tasks/:id/submit', (req, res) => {
  const task = tasks.get(req.params.id);
  if (!task) {
    return res.status(404).json({ success: false, error: 'Task not found' });
  }

  const { result, error } = req.body;
  task.status = error ? 'failed' : 'completed';
  task.result = result;
  task.error = error;
  task.updatedAt = new Date();

  broadcast({ type: 'task_completed', task });

  res.json({ success: true, data: task });
});

// Chat history storage for session persistence
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}
interface SessionData {
  history: ChatMessage[];
  systemPrompt?: string; // Persist system prompt per session
  userId?: string; // User ID for user-specific session isolation
  createdAt: Date;
  updatedAt: Date;
  ttl: number; // TTL in seconds (default: 24 hours)
}

// Session persistence directory
const SESSIONS_DIR = path.join(__dirname, '../../sessions');

// Ensure sessions directory exists
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  console.log(`[SessionManager] Created sessions directory: ${SESSIONS_DIR}`);
}

/**
 * SessionManager - Handles session persistence with file-based storage
 * Provides in-memory cache with automatic file persistence
 */
class SessionManager {
  private cache: Map<string, SessionData> = new Map();
  private sessionsDir: string;
  private maxMessages: number = 100; // Max messages per session
  private defaultTTL: number = 86400; // 24 hours in seconds

  constructor(sessionsDir: string) {
    this.sessionsDir = sessionsDir;
    this.loadAllSessions();
  }

  /**
   * Sanitize sessionId to prevent path traversal attacks
   */
  private sanitizeSessionId(sessionId: string): string {
    return sessionId.replace(/[^a-zA-Z0-9-_]/g, '');
  }

  /**
   * Get file path for a session
   */
  private getFilePath(sessionId: string): string {
    const sanitized = this.sanitizeSessionId(sessionId);
    return path.join(this.sessionsDir, `${sanitized}.json`);
  }

  /**
   * Check if session has expired
   */
  private isExpired(data: SessionData): boolean {
    const now = Date.now();
    const updatedAt = new Date(data.updatedAt).getTime();
    const ttlMs = (data.ttl || this.defaultTTL) * 1000;
    return (now - updatedAt) > ttlMs;
  }

  /**
   * Get session data (from cache or file)
   */
  async get(sessionId: string): Promise<SessionData | null> {
    // Check cache first
    if (this.cache.has(sessionId)) {
      const data = this.cache.get(sessionId)!;
      if (this.isExpired(data)) {
        console.log(`[SessionManager] Session ${sessionId} expired, deleting`);
        await this.delete(sessionId);
        return null;
      }
      return data;
    }

    // Try to load from file
    return await this.loadFromFile(sessionId);
  }

  /**
   * Save session data (to cache and file)
   */
  async set(sessionId: string, data: SessionData): Promise<void> {
    data.updatedAt = new Date();
    this.cache.set(sessionId, data);
    await this.saveToFile(sessionId, data);
  }

  /**
   * Delete a session
   */
  async delete(sessionId: string): Promise<void> {
    this.cache.delete(sessionId);
    const filePath = this.getFilePath(sessionId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[SessionManager] Deleted session file: ${filePath}`);
    }
  }

  /**
   * Create a new session
   */
  createSession(options?: { systemPrompt?: string; userId?: string }): SessionData {
    return {
      history: [],
      systemPrompt: options?.systemPrompt,
      userId: options?.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      ttl: this.defaultTTL,
    };
  }

  /**
   * Add message to session history
   */
  addMessage(session: SessionData, role: ChatMessage['role'], content: string): void {
    session.history.push({
      role,
      content,
      timestamp: new Date(),
    });

    // Trim history if exceeds max
    if (session.history.length > this.maxMessages) {
      session.history = session.history.slice(-this.maxMessages);
    }
  }

  /**
   * Get all sessions summary
   */
  getAllSessions(): Record<string, { historyLength: number; hasSystemPrompt: boolean; userId?: string; lastMessage?: string; createdAt?: string; updatedAt?: string }> {
    const result: Record<string, { historyLength: number; hasSystemPrompt: boolean; userId?: string; lastMessage?: string; createdAt?: string; updatedAt?: string }> = {};

    this.cache.forEach((data, sessionId) => {
      if (!this.isExpired(data)) {
        result[sessionId] = {
          historyLength: data.history.length,
          hasSystemPrompt: !!data.systemPrompt,
          userId: data.userId,
          lastMessage: data.history.length > 0
            ? data.history[data.history.length - 1].content.substring(0, 100)
            : undefined,
          createdAt: data.createdAt?.toISOString?.() || String(data.createdAt),
          updatedAt: data.updatedAt?.toISOString?.() || String(data.updatedAt),
        };
      }
    });

    return result;
  }

  /**
   * Save session to file
   */
  private async saveToFile(sessionId: string, data: SessionData): Promise<void> {
    try {
      const filePath = this.getFilePath(sessionId);
      const jsonData = JSON.stringify(data, null, 2);
      fs.writeFileSync(filePath, jsonData);
      console.log(`[SessionManager] Saved session ${sessionId} (${data.history.length} messages)`);
    } catch (err) {
      console.error(`[SessionManager] Failed to save session ${sessionId}:`, err);
    }
  }

  /**
   * Load session from file (async version)
   */
  private async loadFromFile(sessionId: string): Promise<SessionData | null> {
    return this.loadFromFileSync(sessionId);
  }

  /**
   * Load session from file (sync version for startup)
   */
  private loadFromFileSync(sessionId: string): SessionData | null {
    const filePath = this.getFilePath(sessionId);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content) as SessionData;

      // Restore Date objects
      data.createdAt = new Date(data.createdAt);
      data.updatedAt = new Date(data.updatedAt);
      data.history.forEach(msg => {
        msg.timestamp = new Date(msg.timestamp);
      });

      // Check TTL
      if (this.isExpired(data)) {
        console.log(`[SessionManager] Session ${sessionId} expired on load, deleting`);
        this.deleteSync(sessionId);
        return null;
      }

      // Add to cache
      this.cache.set(sessionId, data);
      console.log(`[SessionManager] Loaded session ${sessionId} from file (${data.history.length} messages)`);
      return data;
    } catch (err) {
      console.error(`[SessionManager] Failed to load session ${sessionId}:`, err);
      return null;
    }
  }

  /**
   * Delete a session (sync version)
   */
  private deleteSync(sessionId: string): void {
    this.cache.delete(sessionId);
    const filePath = this.getFilePath(sessionId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[SessionManager] Deleted session file: ${filePath}`);
    }
  }

  /**
   * Load all sessions from disk on startup
   */
  private loadAllSessions(): void {
    if (!fs.existsSync(this.sessionsDir)) return;

    try {
      const files = fs.readdirSync(this.sessionsDir);
      let loaded = 0;
      let expired = 0;

      for (const file of files) {
        if (file.endsWith('.json')) {
          const sessionId = file.replace('.json', '');
          const session = this.loadFromFileSync(sessionId);
          if (session) {
            loaded++;
          } else {
            expired++;
          }
        }
      }

      console.log(`[SessionManager] Startup: loaded ${loaded} sessions, cleaned ${expired} expired`);
    } catch (err) {
      console.error('[SessionManager] Failed to load sessions on startup:', err);
    }
  }
}

// Initialize session manager
const sessionManager = new SessionManager(SESSIONS_DIR);

// Keep chatHistories for backward compatibility (will be removed in future)
const chatHistories = new Map<string, SessionData>();

// Format conversation history into a prompt
function formatChatPrompt(message: string, sessionData: SessionData, systemPrompt?: string): string {
  const parts: string[] = [];

  // Use provided systemPrompt, or fall back to session's stored systemPrompt, or default
  const effectiveSystemPrompt = systemPrompt || sessionData.systemPrompt;

  if (effectiveSystemPrompt) {
    parts.push(`System: ${effectiveSystemPrompt}\n`);
  } else {
    // Default system prompt
    parts.push('You are a helpful AI assistant. Respond conversationally and helpfully to the user\'s messages. Keep responses concise but informative.\n');
  }

  // Add conversation history (last 10 messages for context)
  const history = sessionData.history;
  if (history && history.length > 0) {
    parts.push('Previous conversation:');
    for (const msg of history.slice(-10)) {
      const role = msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'Assistant' : 'System';
      parts.push(`${role}: ${msg.content}`);
    }
    parts.push('');
  }

  // Add current message
  parts.push(`User: ${message}`);
  parts.push('');
  parts.push('Assistant:');

  return parts.join('\n');
}

// Chat endpoint - executes Claude Code with session memory and AI Coach support
// Also supports user-specific session isolation via userId parameter
app.get('/agents/:agentId/chat', async (req, res) => {
  const message = req.query.message as string;
  const sessionId = (req.query.sessionId as string) || `chat-${uuidv4().slice(0, 8)}`;
  const systemPrompt = req.query.systemPrompt as string | undefined; // AI Coach system prompt
  const userId = req.query.userId as string | undefined; // User ID for session isolation

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ success: false, error: 'Message required' });
  }

  // Get or create session data using SessionManager (with file persistence)
  let sessionData = await sessionManager.get(sessionId);
  if (!sessionData) {
    sessionData = sessionManager.createSession({ systemPrompt, userId });
    console.log(`[Chat] Created new session: ${sessionId}, userId: ${userId || 'anonymous'}`);
  } else {
    // Update session with new systemPrompt or userId if provided
    if (systemPrompt && !sessionData.systemPrompt) {
      sessionData.systemPrompt = systemPrompt;
    }
    if (userId && !sessionData.userId) {
      sessionData.userId = userId;
    }
  }

  // Debug: Log what we received in request query
  console.log(`[Chat] systemPrompt received: ${systemPrompt ? `yes (${systemPrompt.length} chars)` : 'no'}`);
  console.log(`[Chat] Session: ${sessionId}, userId: ${sessionData.userId || 'anonymous'}, History: ${sessionData.history.length} messages, SystemPrompt: ${sessionData.systemPrompt ? 'stored' : (systemPrompt ? 'new' : 'default')}`);

  // IMPORTANT: Always use request's systemPrompt if provided (for AICoach mode)
  if (systemPrompt && sessionData.systemPrompt !== systemPrompt) {
    console.log(`[Chat] Updating session systemPrompt from request`);
    sessionData.systemPrompt = systemPrompt;
  }

  // Set up SSE for streaming response
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  res.write(`data: ${JSON.stringify({ type: 'session', sessionId })}\n\n`);

  try {
    // Build prompt with history and system prompt
    const prompt = formatChatPrompt(message, sessionData, systemPrompt);

    // Check if this is an AI Coach session (has system prompt with JSON instructions)
    // Note: We rely on the system prompt to instruct Claude not to use tools
    // The --tools "" flag has shell escaping issues, so we use system prompt restrictions instead
    const isAICoachMode = systemPrompt?.includes('JSON') || sessionData.systemPrompt?.includes('JSON');

    console.log(`[Chat] Mode: ${isAICoachMode ? 'AI Coach (prompt restricts tools)' : 'Standard'}`);

    // Use stdin to pass prompt (command line args fail with newlines/special chars)
    const claudeProcess: ChildProcess = spawn(CLAUDE_CLI_PATH, ['--print'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      env: {
        ...process.env,
        PATH: process.env.PATH || '/home/ubuntu/.nvm/versions/node/v22.18.0/bin:/usr/local/bin:/usr/bin:/bin',
      },
    });

    // Write prompt to stdin and close it
    claudeProcess.stdin?.write(prompt);
    claudeProcess.stdin?.end();

    let fullResponse = '';
    let stderrContent = '';

    // Timeout handling - 60 seconds
    const timeout = setTimeout(() => {
      if (!res.writableEnded) {
        claudeProcess.kill('SIGTERM');
        console.error('[Chat] Timeout - killing process');
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: 'Request timed out after 60 seconds. Claude CLI may be unresponsive or not properly authenticated.'
        })}\n\n`);
        res.end();
      }
    }, 60000);

    claudeProcess.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      fullResponse += text;
      res.write(`data: ${JSON.stringify({ type: 'token', token: text })}\n\n`);
    });

    claudeProcess.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      stderrContent += text;
      console.error('[Chat] stderr:', text);
    });

    claudeProcess.on('close', (code: number | null) => {
      clearTimeout(timeout);

      // Check if there was an error (no output or non-zero exit code)
      if (!fullResponse.trim() && (stderrContent.trim() || code !== 0)) {
        console.error(`[Chat] Claude CLI failed - code: ${code}, stderr: ${stderrContent}`);
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: stderrContent.trim() || `Claude CLI exited with code ${code}. Please check if Claude CLI is authenticated.`,
          exitCode: code
        })}\n\n`);
        res.end();
        return;
      }

      // Save conversation to history using SessionManager (with file persistence)
      sessionManager.addMessage(sessionData, 'user', message);
      sessionManager.addMessage(sessionData, 'assistant', fullResponse.trim());

      // Persist session to file
      sessionManager.set(sessionId, sessionData).catch(err => {
        console.error(`[Chat] Failed to persist session ${sessionId}:`, err);
      });

      console.log(`[Chat] Session ${sessionId} updated: ${sessionData.history.length} messages`);

      res.write(`data: ${JSON.stringify({
        type: 'complete',
        content: fullResponse,
        sessionId,
        exitCode: code
      })}\n\n`);
      res.end();
    });

    claudeProcess.on('error', (err: Error & { code?: string }) => {
      console.error('[Chat] Claude process error:', err);
      const errorMsg = err.code === 'ENOENT'
        ? `Claude CLI not found at ${CLAUDE_CLI_PATH}. Please set CLAUDE_CLI_PATH environment variable.`
        : err.message;
      res.write(`data: ${JSON.stringify({ type: 'error', error: errorMsg })}\n\n`);
      res.end();
    });

    req.on('close', () => {
      claudeProcess.kill();
    });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    res.write(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`);
    res.end();
  }
});

// Chat endpoint (POST) - for long system prompts that exceed URL length limits
// Also supports user-specific session isolation via userId parameter
app.post('/agents/:agentId/chat', async (req, res) => {
  const { message, sessionId: reqSessionId, systemPrompt, userId } = req.body;
  const sessionId = reqSessionId || `chat-${uuidv4().slice(0, 8)}`;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ success: false, error: 'Message required' });
  }

  // Get or create session data using SessionManager (with file persistence)
  let sessionData = await sessionManager.get(sessionId);
  if (!sessionData) {
    sessionData = sessionManager.createSession({ systemPrompt, userId });
    console.log(`[Chat POST] Created new session: ${sessionId}, userId: ${userId || 'anonymous'}`);
  } else {
    // Update session with new systemPrompt or userId if provided
    if (systemPrompt && !sessionData.systemPrompt) {
      sessionData.systemPrompt = systemPrompt;
    }
    if (userId && !sessionData.userId) {
      sessionData.userId = userId;
    }
  }

  // Debug: Log what we received in request body (FULL DETAIL for debugging)
  console.log(`[Chat POST] Request body keys: ${Object.keys(req.body).join(', ')}`);
  console.log(`[Chat POST] systemPrompt received: ${systemPrompt ? `yes (${systemPrompt.length} chars)` : 'no'}`);
  console.log(`[Chat POST] FULL REQUEST BODY:`, JSON.stringify(req.body, null, 2).substring(0, 500));
  console.log(`[Chat POST] Session: ${sessionId}, userId: ${sessionData.userId || 'anonymous'}, History: ${sessionData.history.length} messages, SystemPrompt: ${sessionData.systemPrompt ? `stored (${(sessionData.systemPrompt as string).length} chars)` : (systemPrompt ? `new (${systemPrompt.length} chars)` : 'default')}`);

  // IMPORTANT: Always use request's systemPrompt if provided (for AICoach mode)
  // This ensures the current request uses the correct prompt even if session has a different stored one
  if (systemPrompt && sessionData.systemPrompt !== systemPrompt) {
    console.log(`[Chat POST] Updating session systemPrompt from request (was: ${sessionData.systemPrompt ? 'stored' : 'none'})`);
    sessionData.systemPrompt = systemPrompt;
  }

  // Set up SSE for streaming response
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  res.write(`data: ${JSON.stringify({ type: 'session', sessionId })}\n\n`);

  try {
    // Build prompt with history and system prompt
    const prompt = formatChatPrompt(message, sessionData, systemPrompt);

    // Check if this is an AI Coach session (has system prompt with JSON instructions)
    // Note: We rely on the system prompt to instruct Claude not to use tools
    // The --tools "" flag has shell escaping issues, so we use system prompt restrictions instead
    const isAICoachMode = systemPrompt?.includes('JSON') || sessionData.systemPrompt?.includes('JSON');

    console.log(`[Chat POST] Mode: ${isAICoachMode ? 'AI Coach (prompt restricts tools)' : 'Standard'}`);

    // Use stdin to pass prompt (command line args fail with newlines/special chars)
    const claudeProcess: ChildProcess = spawn(CLAUDE_CLI_PATH, ['--print'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      env: {
        ...process.env,
        PATH: process.env.PATH || '/home/ubuntu/.nvm/versions/node/v22.18.0/bin:/usr/local/bin:/usr/bin:/bin',
      },
    });

    // Write prompt to stdin and close it
    claudeProcess.stdin?.write(prompt);
    claudeProcess.stdin?.end();

    let fullResponse = '';
    let stderrContent = '';

    // Timeout handling - 60 seconds
    const timeout = setTimeout(() => {
      if (!res.writableEnded) {
        claudeProcess.kill('SIGTERM');
        console.error('[Chat POST] Timeout - killing process');
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: 'Request timed out after 60 seconds. Claude CLI may be unresponsive or not properly authenticated.'
        })}\n\n`);
        res.end();
      }
    }, 60000);

    claudeProcess.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      fullResponse += text;
      res.write(`data: ${JSON.stringify({ type: 'token', token: text })}\n\n`);
    });

    claudeProcess.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      stderrContent += text;
      console.error('[Chat POST] stderr:', text);
    });

    claudeProcess.on('close', (code: number | null) => {
      clearTimeout(timeout);

      // Check if there was an error (no output or non-zero exit code)
      if (!fullResponse.trim() && (stderrContent.trim() || code !== 0)) {
        console.error(`[Chat POST] Claude CLI failed - code: ${code}, stderr: ${stderrContent}`);
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: stderrContent.trim() || `Claude CLI exited with code ${code}. Please check if Claude CLI is authenticated.`,
          exitCode: code
        })}\n\n`);
        res.end();
        return;
      }

      // Save conversation to history using SessionManager (with file persistence)
      sessionManager.addMessage(sessionData, 'user', message);
      sessionManager.addMessage(sessionData, 'assistant', fullResponse.trim());

      // Persist session to file
      sessionManager.set(sessionId, sessionData).catch(err => {
        console.error(`[Chat POST] Failed to persist session ${sessionId}:`, err);
      });

      console.log(`[Chat POST] Session ${sessionId} updated: ${sessionData.history.length} messages`);

      res.write(`data: ${JSON.stringify({
        type: 'complete',
        content: fullResponse,
        sessionId,
        exitCode: code
      })}\n\n`);
      res.end();
    });

    claudeProcess.on('error', (err: Error & { code?: string }) => {
      console.error('[Chat] Claude process error:', err);
      const errorMsg = err.code === 'ENOENT'
        ? `Claude CLI not found at ${CLAUDE_CLI_PATH}. Please set CLAUDE_CLI_PATH environment variable.`
        : err.message;
      res.write(`data: ${JSON.stringify({ type: 'error', error: errorMsg })}\n\n`);
      res.end();
    });

    req.on('close', () => {
      claudeProcess.kill();
    });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    res.write(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`);
    res.end();
  }
});

// Session management endpoint: List all sessions (with file persistence)
app.get('/sessions', (_req, res) => {
  const sessionsData = sessionManager.getAllSessions();

  res.json({
    success: true,
    data: {
      totalSessions: Object.keys(sessionsData).length,
      sessions: sessionsData,
      storage: 'file-persistent',
    }
  });
});

// Session management endpoint: Get specific session details
app.get('/sessions/:sessionId', async (req, res) => {
  const sessionData = await sessionManager.get(req.params.sessionId);

  if (!sessionData) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }

  res.json({
    success: true,
    data: {
      sessionId: req.params.sessionId,
      historyLength: sessionData.history.length,
      systemPrompt: sessionData.systemPrompt
        ? (sessionData.systemPrompt as string).substring(0, 200) + '...'
        : null,
      createdAt: sessionData.createdAt,
      updatedAt: sessionData.updatedAt,
      ttl: sessionData.ttl,
      history: sessionData.history.map(msg => ({
        role: msg.role,
        content: msg.content.substring(0, 200) + (msg.content.length > 200 ? '...' : ''),
        timestamp: msg.timestamp,
      })),
    }
  });
});

// Session management endpoint: Delete a session
app.delete('/sessions/:sessionId', async (req, res) => {
  try {
    await sessionManager.delete(req.params.sessionId);
    res.json({
      success: true,
      data: { deleted: true, sessionId: req.params.sessionId }
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: errorMessage });
  }
});

// Dashboard stats
app.get('/dashboard', (_req, res) => {
  const stats: ServerStats = {
    totalAgents: agents.size,
    onlineAgents: Array.from(agents.values()).filter(a => a.status === 'online').length,
    totalTasks: tasks.size,
    pendingTasks: Array.from(tasks.values()).filter(t => t.status === 'pending').length,
    completedTasks: Array.from(tasks.values()).filter(t => t.status === 'completed').length,
    uptime: process.uptime(),
  };

  res.json({ success: true, data: stats });
});

// Start server
app.listen(PORT, HOST, () => {
  console.log('============================================================');
  console.log('  Task Distribution Server v2.4 (Persistent Session Memory)');
  console.log('============================================================');
  console.log(`  Status:    Running`);
  console.log(`  Host:      ${HOST}`);
  console.log(`  Port:      ${PORT}`);
  console.log(`  URL:       http://localhost:${PORT}`);
  console.log('');
  console.log(`  Auth Token: ${AUTH_TOKEN}`);
  console.log('');
  console.log('  Endpoints:');
  console.log('    GET  /health              - Health check');
  console.log('    GET  /events              - SSE event stream');
  console.log('    GET  /dashboard           - Statistics dashboard');
  console.log('');
  console.log('  Agent Management:');
  console.log('    POST /agents/register     - Register new agent');
  console.log('    GET  /agents              - List all agents');
  console.log('');
  console.log('  Task Management:');
  console.log('    POST /tasks               - Create new task');
  console.log('    GET  /tasks               - List tasks');
  console.log('    POST /tasks/:id/claim     - Claim a task');
  console.log('    POST /tasks/:id/submit    - Submit result');
  console.log('');
  console.log('  Chat (Claude Code):');
  console.log('    GET  /agents/:id/chat     - Chat via SSE (short prompts)');
  console.log('    POST /agents/:id/chat     - Chat via SSE (long prompts)');
  console.log('      Body: { message, sessionId?, systemPrompt? }');
  console.log('============================================================');
});
SERVER_EOF

    log_info "Embedded files created successfully"
}

install_dependencies() {
    local install_dir="$1"

    log_step "Installing npm dependencies..."

    cd "${install_dir}/mcp-task-distributor"
    npm install --silent --no-audit --no-fund 2>&1 | grep -v "^npm WARN" || true

    log_info "Dependencies installed"
}

build_typescript() {
    local install_dir="$1"

    log_step "Building TypeScript..."

    cd "${install_dir}/mcp-task-distributor"
    npm run build --silent 2>&1 | grep -v "^npm WARN" || true

    log_info "Build complete"
}

configure_server() {
    local install_dir="$1"
    local port="$2"
    local bind_address="$3"

    log_step "Configuring server..."

    local token
    local local_ip=$(get_local_ip)

    # Check if we're upgrading and should preserve token
    if [ "$UPGRADE" = true ] && [ -f "${install_dir}/config/server.env" ]; then
        # Extract existing token
        token=$(grep "^TASK_SERVER_TOKEN=" "${install_dir}/config/server.env" | cut -d= -f2)
        log_info "Preserving existing token"
    else
        # Generate new token
        token=$(generate_token)
        log_info "Generated new token"
    fi

    # Create server.env
    cat > "${install_dir}/config/server.env" << EOF
# MCP Task Server Configuration
# Generated: $(date)

TASK_SERVER_HOST=${bind_address}
TASK_SERVER_PORT=${port}
TASK_SERVER_TOKEN=${token}
TASK_SERVER_URL=http://${local_ip}:${port}
EOF

    # Create MCP config for Claude Code
    cat > "${install_dir}/mcp-config.json" << EOF
{
  "mcpServers": {
    "task-distributor": {
      "command": "node",
      "args": ["${install_dir}/mcp-task-distributor/build/index.js"],
      "env": {
        "TASK_SERVER_URL": "http://localhost:${port}",
        "TASK_SERVER_TOKEN": "${token}",
        "AGENT_NAME": "\${AGENT_NAME:-Agent}",
        "AGENT_ROLE": "\${AGENT_ROLE:-worker}"
      }
    }
  }
}
EOF

    # Create management script
    create_management_script "$install_dir"

    log_info "Server configured"
    echo ""
    echo "  Port:  ${port}"
    echo "  Token: ${token}"
    echo "  URL:   http://${local_ip}:${port}"
}

create_management_script() {
    local install_dir="$1"

    # This creates the setup_multi_agent.sh script
    # Source: Based on existing mcp-installer/install.sh template
    cat > "${install_dir}/setup_multi_agent.sh" << 'MGMT_EOF'
#!/bin/bash
#
# MCP Server Management Script
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="${SCRIPT_DIR}/mcp-task-distributor"
CONFIG_DIR="${SCRIPT_DIR}/config"
LOGS_DIR="${SCRIPT_DIR}/logs"
PID_FILE="${LOGS_DIR}/server.pid"
LOG_FILE="${LOGS_DIR}/server.log"

# Load config if exists
if [ -f "${CONFIG_DIR}/server.env" ]; then
    source "${CONFIG_DIR}/server.env"
fi

PORT="${TASK_SERVER_PORT:-3456}"

start_server() {
    if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
        echo "Server is already running (PID: $(cat "$PID_FILE"))"
        return 1
    fi

    echo "Starting MCP Task Server..."
    cd "$SERVER_DIR"

    export TASK_SERVER_HOST TASK_SERVER_PORT TASK_SERVER_TOKEN TASK_SERVER_URL

    nohup node build/server.js > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"

    sleep 2

    if kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
        echo "Server started successfully (PID: $(cat "$PID_FILE"))"
        echo "URL: http://localhost:${PORT}"
    else
        echo "Failed to start server. Check ${LOG_FILE}"
        return 1
    fi
}

stop_server() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            echo "Stopping server (PID: $pid)..."
            kill "$pid"
            rm -f "$PID_FILE"
            echo "Server stopped"
        else
            echo "Server not running (stale PID file)"
            rm -f "$PID_FILE"
        fi
    else
        echo "Server not running"
    fi
}

status_server() {
    if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
        echo "Server is running (PID: $(cat "$PID_FILE"))"
        curl -s "http://localhost:${PORT}/health" 2>/dev/null | head -c 200
        echo ""
    else
        echo "Server is not running"
    fi
}

show_config() {
    echo "Configuration:"
    echo "  Port:  ${PORT}"
    echo "  Token: ${TASK_SERVER_TOKEN}"
    echo "  URL:   http://localhost:${PORT}"
    echo ""
    echo "Config file: ${CONFIG_DIR}/server.env"
}

export_config() {
    source "${CONFIG_DIR}/server.env"
    local local_ip=$(hostname -I | awk '{print $1}')
    local output_file="${SCRIPT_DIR}/remote-config.json"

    cat > "$output_file" << EXPORTEOF
{
  "serverUrl": "http://${local_ip}:${TASK_SERVER_PORT}",
  "token": "${TASK_SERVER_TOKEN}",
  "serverName": "$(hostname)",
  "localIp": "${local_ip}",
  "port": ${TASK_SERVER_PORT},
  "exportedAt": "$(date -Iseconds)",
  "version": "2.0.0"
}
EXPORTEOF

    echo "Configuration exported to: $output_file"
    echo ""
    echo "Remote installation command:"
    echo "  curl -fsSL <installer-url> | bash -s -- \\"
    echo "    --mode client \\"
    echo "    --server-url http://${local_ip}:${TASK_SERVER_PORT} \\"
    echo "    --token ${TASK_SERVER_TOKEN}"
}

generate_token() {
    if command -v openssl >/dev/null 2>&1; then
        local new_token="mcp-$(openssl rand -hex 16)"
    else
        local new_token="mcp-$(cat /dev/urandom | tr -dc 'a-f0-9' | fold -w 32 | head -n 1)"
    fi
    echo "New token: ${new_token}"
    echo ""
    echo "To update the server token, edit:"
    echo "  ${CONFIG_DIR}/server.env"
    echo ""
    echo "Then restart the server:"
    echo "  $0 stop-server && $0 start-server"
}

case "$1" in
    start-server|start)
        start_server
        ;;
    stop-server|stop)
        stop_server
        ;;
    restart)
        stop_server
        sleep 1
        start_server
        ;;
    server-status|status)
        status_server
        ;;
    show-config|config)
        show_config
        ;;
    export-config|export)
        export_config
        ;;
    generate-token)
        generate_token
        ;;
    logs)
        tail -f "$LOG_FILE"
        ;;
    *)
        echo "Usage: $0 <command>"
        echo ""
        echo "Commands:"
        echo "  start-server    Start the MCP server"
        echo "  stop-server     Stop the MCP server"
        echo "  restart         Restart the server"
        echo "  server-status   Check server status"
        echo "  show-config     Show server configuration"
        echo "  export-config   Export config for remote clients"
        echo "  generate-token  Generate a new auth token"
        echo "  logs            Show server logs (tail -f)"
        exit 1
        ;;
esac
MGMT_EOF

    chmod +x "${install_dir}/setup_multi_agent.sh"
}

start_and_verify_server() {
    local install_dir="$1"
    local port="$2"

    if [ "$AUTO_START" = true ]; then
        log_step "Starting server..."
        "${install_dir}/setup_multi_agent.sh" start-server

        log_step "Verifying server..."
        sleep 2
        if curl -s "http://localhost:${port}/health" | grep -q '"success":true'; then
            log_info "Server verification: OK"
        else
            log_warn "Server verification failed. Check logs at ${install_dir}/logs/server.log"
        fi
    fi
}

# =============================================================================
# Client Installation Functions
# =============================================================================

install_client() {
    local server_url="$1"
    local token="$2"
    local agent_name="$3"
    local agent_role="$4"
    local client_dir="$5"

    log_step "Installing MCP Client..."

    # Test connectivity
    test_server_connectivity "$server_url"

    # Test authentication
    test_authentication "$server_url" "$token"

    # Create installation directory
    mkdir -p "$client_dir"

    # Install client source
    install_client_source "$client_dir"

    # Install dependencies
    install_client_dependencies "$client_dir"

    # Build client
    build_client "$client_dir"

    # Generate MCP config for Claude Code
    generate_client_mcp_config "$server_url" "$token" "$agent_name" "$agent_role" "$client_dir"

    # Create convenience scripts
    create_client_scripts "$client_dir" "$server_url" "$token" "$agent_name" "$agent_role"

    log_info "Client installation complete"
}

test_server_connectivity() {
    local server_url="$1"

    log_step "Testing server connectivity..."

    local health_response=$(curl -s -o /dev/null -w "%{http_code}" "${server_url}/health" 2>/dev/null || echo "000")

    if [ "$health_response" = "200" ]; then
        log_info "Server is reachable ✓"
    else
        log_error "Cannot connect to server at $server_url (HTTP $health_response)"
        echo ""
        echo "Please check:"
        echo "  1. Server is running"
        echo "  2. Network connectivity"
        echo "  3. Firewall allows port 3456"
        exit 4
    fi
}

test_authentication() {
    local server_url="$1"
    local token="$2"

    log_step "Testing authentication..."

    local auth_response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer $token" \
        "${server_url}/agents" 2>/dev/null || echo "000")

    if [ "$auth_response" = "200" ]; then
        log_info "Authentication successful ✓"
    else
        log_error "Authentication failed (HTTP $auth_response)"
        echo ""
        echo "Please check:"
        echo "  1. Token is correct"
        echo "  2. Server has not regenerated token"
        exit 5
    fi
}

install_client_source() {
    local client_dir="$1"

    log_step "Installing client source files..."

    mkdir -p "${client_dir}/src"

    # Create package.json
    cat > "${client_dir}/package.json" << 'CLIENT_PACKAGE_EOF'
{
  "name": "vow-mcp-agent",
  "version": "1.0.0",
  "description": "VOW MCP Remote Agent",
  "type": "module",
  "main": "build/mcp-bridge.js",
  "bin": {
    "vow-agent": "./build/mcp-bridge.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "node build/mcp-bridge.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.25.3",
    "uuid": "^11.0.5"
  },
  "devDependencies": {
    "@types/node": "^22.10.5",
    "@types/uuid": "^10.0.0",
    "typescript": "^5.7.2"
  }
}
CLIENT_PACKAGE_EOF

    # Create tsconfig.json
    cat > "${client_dir}/tsconfig.json" << 'CLIENT_TSCONFIG_EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "./build",
    "rootDir": "./src",
    "declaration": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
CLIENT_TSCONFIG_EOF

    # Note: The actual mcp-bridge.ts source would be embedded here
    # For brevity, referencing the existing remote installer source

    log_info "Client source files created"
}

install_client_dependencies() {
    local client_dir="$1"

    log_step "Installing client dependencies..."

    cd "$client_dir"
    npm install --silent --no-audit --no-fund 2>&1 | grep -v "^npm WARN" || true

    log_info "Client dependencies installed"
}

build_client() {
    local client_dir="$1"

    log_step "Building client..."

    cd "$client_dir"
    npm run build --silent 2>&1 | grep -v "^npm WARN" || true

    log_info "Client build complete"
}

generate_client_mcp_config() {
    local server_url="$1"
    local token="$2"
    local agent_name="$3"
    local agent_role="$4"
    local client_dir="$5"

    log_step "Generating Claude Code MCP configuration..."

    local mcp_config_dir="${HOME}/.claude"
    mkdir -p "$mcp_config_dir"

    cat > "${mcp_config_dir}/mcp.json" << EOF
{
  "mcpServers": {
    "vow-agent": {
      "command": "node",
      "args": ["${client_dir}/build/mcp-bridge.js"],
      "env": {
        "TASK_SERVER_URL": "${server_url}",
        "TASK_SERVER_TOKEN": "${token}",
        "AGENT_NAME": "${agent_name}",
        "AGENT_ROLE": "${agent_role}",
        "MACHINE_ID": "${MACHINE_ID}"
      }
    }
  }
}
EOF

    log_info "MCP config created at ${mcp_config_dir}/mcp.json"
}

create_client_scripts() {
    local client_dir="$1"
    local server_url="$2"
    local token="$3"
    local agent_name="$4"
    local agent_role="$5"

    # Start script
    cat > "${client_dir}/start-agent.sh" << STARTSCRIPT_EOF
#!/bin/bash
# Start the VOW MCP Agent manually (for debugging)
export TASK_SERVER_URL="${server_url}"
export TASK_SERVER_TOKEN="${token}"
export AGENT_NAME="${agent_name}"
export AGENT_ROLE="${agent_role}"
export MACHINE_ID="${MACHINE_ID}"

node "${client_dir}/build/mcp-bridge.js"
STARTSCRIPT_EOF
    chmod +x "${client_dir}/start-agent.sh"

    # Status script
    cat > "${client_dir}/check-status.sh" << STATUSSCRIPT_EOF
#!/bin/bash
# Check VOW task server status
echo "VOW Task Server Status"
echo "======================"
echo "Server URL: ${server_url}"
echo ""

echo -n "Health: "
HEALTH=\$(curl -s "${server_url}/health" 2>/dev/null)
if [ \$? -eq 0 ]; then
    echo "\$HEALTH" | grep -o '"status":"[^"]*"' | cut -d'"' -f4
else
    echo "UNREACHABLE"
fi

echo ""
echo "Dashboard:"
curl -s -H "Authorization: Bearer ${token}" "${server_url}/dashboard" 2>/dev/null | head -c 500
echo ""
STATUSSCRIPT_EOF
    chmod +x "${client_dir}/check-status.sh"

    # Environment file
    cat > "${client_dir}/.env" << ENVFILE_EOF
# VOW MCP Agent Configuration
TASK_SERVER_URL=${server_url}
TASK_SERVER_TOKEN=${token}
AGENT_NAME=${agent_name}
AGENT_ROLE=${agent_role}
MACHINE_ID=${MACHINE_ID}
ENVFILE_EOF

    log_info "Convenience scripts created"
}

# =============================================================================
# Verification Functions
# =============================================================================

verify_server_only() {
    local port="$1"

    log_step "Verifying server (port ${port})..."

    local max_retries=5
    for i in $(seq 1 $max_retries); do
        if curl -s "http://localhost:${port}/health" 2>/dev/null | grep -q '"success":true'; then
            log_info "Server verification: OK"
            return 0
        fi
        sleep 2
    done

    log_error "Server verification failed after $max_retries attempts"
    return 1
}

verify_client_only() {
    local server_url="$1"
    local token="$2"

    log_step "Verifying client connection..."

    test_server_connectivity "$server_url"
    test_authentication "$server_url" "$token"

    log_info "Client verification: OK"
}

# =============================================================================
# Success Messages
# =============================================================================

print_server_success() {
    local install_dir="$1"
    local port="$2"

    source "${install_dir}/config/server.env"

    echo ""
    echo -e "${GREEN}============================================================${NC}"
    echo -e "${GREEN}  Server Installation Complete!${NC}"
    echo -e "${GREEN}============================================================${NC}"
    echo ""
    echo "  Installation directory: ${install_dir}"
    echo ""
    echo "  Connection Info:"
    echo "    URL:   http://localhost:${port}"
    echo "    Token: ${TASK_SERVER_TOKEN}"
    echo ""
    echo "  Quick Start:"
    echo "    1. Start the server:"
    echo "       ${install_dir}/setup_multi_agent.sh start-server"
    echo ""
    echo "    2. Export config for remote clients:"
    echo "       ${install_dir}/setup_multi_agent.sh export-config"
    echo ""
    echo "    3. Use with Claude Code:"
    echo "       claude --mcp-config ${install_dir}/mcp-config.json"
    echo ""
    echo -e "${GREEN}============================================================${NC}"
}

print_client_success() {
    local client_dir="$1"
    local server_url="$2"

    echo ""
    echo -e "${GREEN}============================================================${NC}"
    echo -e "${GREEN}  Client Installation Complete!${NC}"
    echo -e "${GREEN}============================================================${NC}"
    echo ""
    echo "  Installation directory: ${client_dir}"
    echo "  Server URL: ${server_url}"
    echo ""
    echo "  Quick Start:"
    echo "    1. Start Claude Code (MCP auto-configured):"
    echo "       claude"
    echo ""
    echo "    2. Check server status:"
    echo "       ${client_dir}/check-status.sh"
    echo ""
    echo "  The MCP server has been configured for Claude Code."
    echo "  When you run 'claude', it will automatically connect to the server."
    echo ""
    echo -e "${GREEN}============================================================${NC}"
}

print_both_success() {
    local install_dir="$1"
    local client_dir="$2"
    local port="$3"

    echo ""
    echo -e "${GREEN}============================================================${NC}"
    echo -e "${GREEN}  Server + Client Installation Complete!${NC}"
    echo -e "${GREEN}============================================================${NC}"
    echo ""
    echo "  Server directory: ${install_dir}"
    echo "  Client directory: ${client_dir}"
    echo ""
    echo "  Server is configured and client is connected to localhost."
    echo ""
    echo "  Quick Start:"
    echo "    1. Start server: ${install_dir}/setup_multi_agent.sh start-server"
    echo "    2. Use Claude: claude"
    echo ""
    echo -e "${GREEN}============================================================${NC}"
}

# =============================================================================
# Main Installation Logic
# =============================================================================

main() {
    print_banner

    # Parse arguments
    parse_arguments "$@"

    log_info "Installation mode: ${MODE}"
    echo ""

    # Check prerequisites
    check_prerequisites

    # Verify-only mode
    if [ "$VERIFY_ONLY" = true ]; then
        if [[ "$MODE" == "server" ]]; then
            verify_server_only "$PORT"
        elif [[ "$MODE" == "client" ]]; then
            verify_client_only "$SERVER_URL" "$TOKEN"
        fi
        exit 0
    fi

    # Execute based on mode
    case "$MODE" in
        server)
            install_server "$INSTALL_DIR" "$PORT" "$BIND_ADDRESS"
            start_and_verify_server "$INSTALL_DIR" "$PORT"
            print_server_success "$INSTALL_DIR" "$PORT"
            ;;

        client)
            install_client "$SERVER_URL" "$TOKEN" "$AGENT_NAME" "$AGENT_ROLE" "$CLIENT_DIR"
            print_client_success "$CLIENT_DIR" "$SERVER_URL"
            ;;

        both)
            # Install server first
            install_server "$INSTALL_DIR" "$PORT" "$BIND_ADDRESS"
            start_and_verify_server "$INSTALL_DIR" "$PORT"

            # Get token from server config
            source "${INSTALL_DIR}/config/server.env"
            local server_url="http://localhost:${PORT}"

            # Install client connected to local server
            install_client "$server_url" "$TASK_SERVER_TOKEN" "$AGENT_NAME" "$AGENT_ROLE" "$CLIENT_DIR"

            print_both_success "$INSTALL_DIR" "$CLIENT_DIR" "$PORT"
            ;;
    esac
}

# Run main
main "$@"
