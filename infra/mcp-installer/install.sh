#!/bin/bash
#
# MCP Task Distribution Server - Installer
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/laximgqozaZZZYT/vow/main/infra/mcp-installer/install.sh | bash
#   or
#   curl -fsSL https://lyry9riumg.execute-api.ap-northeast-1.amazonaws.com/development/mcp-installer/install.sh | bash
#
# Options (via environment variables):
#   INSTALL_DIR     - Installation directory (default: ~/.mcp-multi-agent)
#   SERVER_PORT     - Server port (default: 3456)
#   AUTO_START      - Start server after install (default: false)
#   SKIP_BUILD      - Skip TypeScript build (default: false)
#
# Author: VOW Project
# Version: 1.0.0
#

set -e

# =============================================================================
# Configuration
# =============================================================================

VERSION="1.1.0"
DEFAULT_INSTALL_DIR="${HOME}/.mcp-multi-agent"
DEFAULT_PORT="3456"
REPO_URL="${REPO_URL:-https://github.com/laximgqozaZZZYT/vow}"
TARBALL_URL="${TARBALL_URL:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =============================================================================
# Helper Functions
# =============================================================================

print_banner() {
    echo -e "${BLUE}"
    cat << 'EOF'
  __  __  ____ ____    ____
 |  \/  |/ ___|  _ \  / ___|  ___ _ ____   _____ _ __
 | |\/| | |   | |_) | \___ \ / _ \ '__\ \ / / _ \ '__|
 | |  | | |___|  __/   ___) |  __/ |   \ V /  __/ |
 |_|  |_|\____|_|     |____/ \___|_|    \_/ \___|_|

  Task Distribution Server for Multi-Agent Coordination
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

    # Check git (optional, for cloning)
    if command_exists git; then
        log_info "git $(git --version | cut -d' ' -f3) ✓"
    else
        log_warn "git not found (will use tarball download)"
    fi

    # Check openssl (for token generation)
    if command_exists openssl; then
        log_info "openssl ✓"
    else
        log_warn "openssl not found (will use fallback for token generation)"
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
            echo "    nvm install 18"
        fi
        echo ""
        exit 1
    fi

    echo ""
}

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

# =============================================================================
# Installation Functions
# =============================================================================

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

    log_info "Directory structure created"
}

download_source() {
    local install_dir="$1"
    local temp_dir=$(mktemp -d)

    log_step "Downloading source files..."

    if [ -n "$TARBALL_URL" ]; then
        # Download from tarball
        log_info "Downloading from: $TARBALL_URL"
        curl -fsSL "$TARBALL_URL" -o "${temp_dir}/mcp-server.tar.gz"
        tar -xzf "${temp_dir}/mcp-server.tar.gz" -C "${temp_dir}"
        cp -r "${temp_dir}"/*/* "${install_dir}/" 2>/dev/null || cp -r "${temp_dir}"/* "${install_dir}/"
        rm -rf "${temp_dir}"
    elif [ -n "$MCP_REPO_URL" ] && command_exists git; then
        # Clone from dedicated MCP repository (if specified)
        log_info "Cloning from: $MCP_REPO_URL"
        git clone --depth 1 "$MCP_REPO_URL" "${temp_dir}/repo"
        cp -r "${temp_dir}/repo/"* "${install_dir}/"
        rm -rf "${temp_dir}"
    else
        # Create files from embedded content (default - most reliable)
        log_info "Creating files from embedded templates..."
        create_embedded_files "${install_dir}"
    fi

    log_info "Source files ready"
}

create_embedded_files() {
    local install_dir="$1"

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
    "task-mcp": "./build/mcp-bridge.js"
  },
  "scripts": {
    "build": "tsc",
    "start:server": "node build/server.js",
    "start:mcp": "node build/mcp-bridge.js",
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
    "skipLibCheck": true,
    "outDir": "./build",
    "rootDir": "./src",
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "build"]
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
TYPES_EOF

    # Create a minimal server.ts that will be expanded
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
import type { Agent, Task, ChatSession, ServerStats } from './types.js';

const app = express();
const PORT = parseInt(process.env.TASK_SERVER_PORT || '3456');
const HOST = process.env.TASK_SERVER_HOST || '0.0.0.0';
const AUTH_TOKEN = process.env.TASK_SERVER_TOKEN || 'mcp-default-token';

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
const chatHistories = new Map<string, ChatMessage[]>();

// Format conversation history into a prompt
function formatChatPrompt(message: string, history: ChatMessage[], systemPrompt?: string): string {
  const parts: string[] = [];

  // Add system prompt if provided (for AI Coach mode)
  if (systemPrompt) {
    parts.push(`System: ${systemPrompt}\n`);
  } else {
    // Default system prompt
    parts.push('You are a helpful AI assistant. Respond conversationally and helpfully to the user\'s messages. Keep responses concise but informative.\n');
  }

  // Add conversation history (last 10 messages for context)
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
app.get('/agents/:agentId/chat', async (req, res) => {
  const message = req.query.message as string;
  const sessionId = (req.query.sessionId as string) || `chat-${uuidv4().slice(0, 8)}`;
  const systemPrompt = req.query.systemPrompt as string | undefined; // AI Coach system prompt

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ success: false, error: 'Message required' });
  }

  // Get or create session history
  let history = chatHistories.get(sessionId) || [];

  console.log(`[Chat] Session: ${sessionId}, History: ${history.length} messages, SystemPrompt: ${systemPrompt ? 'provided' : 'default'}`);

  // Set up SSE for streaming response
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  res.write(`data: ${JSON.stringify({ type: 'session', sessionId })}\n\n`);

  try {
    // Build prompt with history and system prompt
    const prompt = formatChatPrompt(message, history, systemPrompt);

    const claudeProcess: ChildProcess = spawn('claude', ['--print', prompt], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // stdinを閉じないとClaude CLIがハングする
    claudeProcess.stdin?.end();

    let fullResponse = '';

    claudeProcess.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      fullResponse += text;
      res.write(`data: ${JSON.stringify({ type: 'token', token: text })}\n\n`);
    });

    claudeProcess.stderr?.on('data', (data: Buffer) => {
      console.error('[Chat] stderr:', data.toString());
    });

    claudeProcess.on('close', (code: number | null) => {
      // Save conversation to history
      history.push({ role: 'user', content: message, timestamp: new Date() });
      history.push({ role: 'assistant', content: fullResponse.trim(), timestamp: new Date() });

      // Keep only last 20 messages
      if (history.length > 20) {
        history = history.slice(-20);
      }
      chatHistories.set(sessionId, history);

      res.write(`data: ${JSON.stringify({
        type: 'complete',
        content: fullResponse,
        sessionId,
        exitCode: code
      })}\n\n`);
      res.end();
    });

    claudeProcess.on('error', (err: Error) => {
      res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
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
  console.log('  Task Distribution Server v2.3 (Chat with Session Memory)');
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
  console.log('    GET  /agents/:id/chat     - Chat via SSE (EventSource)');
  console.log('      Query params: message, sessionId, systemPrompt');
  console.log('============================================================');
});
SERVER_EOF

    # Create index.ts (MCP server core)
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

    # Create management script (compatible with original setup_multi_agent.sh commands)
    cat > "${install_dir}/setup_multi_agent.sh" << 'MGMT_EOF'
#!/bin/bash
#
# MCP Server Management Script
# Compatible with original command format:
#   ./setup_multi_agent.sh start-server
#   ./setup_multi_agent.sh stop-server
#   ./setup_multi_agent.sh server-status
#   ./setup_multi_agent.sh show-config
#   ./setup_multi_agent.sh generate-token
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

    # Export environment variables for the server process
    export TASK_SERVER_HOST TASK_SERVER_PORT TASK_SERVER_TOKEN TASK_SERVER_URL

    nohup node build/server.js > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"

    sleep 2

    if kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
        echo "Server started successfully (PID: $(cat "$PID_FILE"))"
        echo "URL: http://localhost:${PORT}"
        echo "Token: ${TASK_SERVER_TOKEN}"
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
        curl -s "http://localhost:${PORT}/health" | head -c 200
        echo ""
    else
        echo "Server is not running"
    fi
}

show_logs() {
    if [ -f "$LOG_FILE" ]; then
        tail -f "$LOG_FILE"
    else
        echo "No log file found"
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

# Command dispatch - support both old and new style commands
case "$1" in
    # Original command format (start-server, stop-server, etc.)
    start-server)
        start_server
        ;;
    stop-server)
        stop_server
        ;;
    server-status)
        status_server
        ;;
    show-config)
        show_config
        ;;
    generate-token)
        generate_token
        ;;
    # Also support short commands for convenience
    start)
        start_server
        ;;
    stop)
        stop_server
        ;;
    restart)
        stop_server
        sleep 1
        start_server
        ;;
    status)
        status_server
        ;;
    logs)
        show_logs
        ;;
    config)
        show_config
        ;;
    *)
        echo "Usage: $0 <command>"
        echo ""
        echo "Commands:"
        echo "  start-server    Start the MCP server"
        echo "  stop-server     Stop the MCP server"
        echo "  server-status   Check server status"
        echo "  show-config     Show server configuration"
        echo "  generate-token  Generate a new auth token"
        echo ""
        echo "  (Short aliases: start, stop, restart, status, logs, config)"
        exit 1
        ;;
esac
MGMT_EOF
    chmod +x "${install_dir}/setup_multi_agent.sh"

    # Also create a symlink for backward compatibility
    ln -sf "${install_dir}/setup_multi_agent.sh" "${install_dir}/mcp-server"
}

install_dependencies() {
    local install_dir="$1"

    log_step "Installing dependencies..."

    cd "${install_dir}/mcp-task-distributor"
    npm install --silent

    log_info "Dependencies installed"
}

build_typescript() {
    local install_dir="$1"

    if [ "${SKIP_BUILD:-false}" = "true" ]; then
        log_warn "Skipping TypeScript build (SKIP_BUILD=true)"
        return
    fi

    log_step "Building TypeScript..."

    cd "${install_dir}/mcp-task-distributor"
    npm run build --silent

    log_info "Build complete"
}

configure_server() {
    local install_dir="$1"
    local port="${SERVER_PORT:-$DEFAULT_PORT}"
    local token=$(generate_token)
    local local_ip=$(get_local_ip)

    log_step "Configuring server..."

    # Create server.env
    cat > "${install_dir}/config/server.env" << EOF
# MCP Task Server Configuration
# Generated: $(date)

TASK_SERVER_HOST=0.0.0.0
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

    log_info "Server configured"
    echo ""
    echo "  Port:  ${port}"
    echo "  Token: ${token}"
    echo "  URL:   http://${local_ip}:${port}"
}

print_success() {
    local install_dir="$1"

    source "${install_dir}/config/server.env"

    echo ""
    echo -e "${GREEN}============================================================${NC}"
    echo -e "${GREEN}  Installation Complete!${NC}"
    echo -e "${GREEN}============================================================${NC}"
    echo ""
    echo "  Installation directory: ${install_dir}"
    echo ""
    echo "  Quick Start:"
    echo "    1. Start the server:"
    echo "       ${install_dir}/setup_multi_agent.sh start-server"
    echo ""
    echo "    2. Test the server:"
    echo "       curl http://localhost:${TASK_SERVER_PORT}/health"
    echo ""
    echo "    3. Use with Claude Code:"
    echo "       claude --mcp-config ${install_dir}/mcp-config.json"
    echo ""
    echo "  Connection Info (for VOW frontend):"
    echo "    URL:   http://localhost:${TASK_SERVER_PORT}"
    echo "    Token: ${TASK_SERVER_TOKEN}"
    echo ""
    echo "  Management Commands:"
    echo "    ${install_dir}/setup_multi_agent.sh start-server     # Start server"
    echo "    ${install_dir}/setup_multi_agent.sh stop-server      # Stop server"
    echo "    ${install_dir}/setup_multi_agent.sh server-status    # Check status"
    echo "    ${install_dir}/setup_multi_agent.sh show-config      # Show config"
    echo "    ${install_dir}/setup_multi_agent.sh generate-token   # New token"
    echo ""
    echo -e "${GREEN}============================================================${NC}"
}

# =============================================================================
# Main Installation
# =============================================================================

main() {
    print_banner

    local install_dir="${INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"

    log_info "Installing to: ${install_dir}"
    echo ""

    check_prerequisites
    create_directory_structure "${install_dir}"
    download_source "${install_dir}"
    install_dependencies "${install_dir}"
    build_typescript "${install_dir}"
    configure_server "${install_dir}"

    # Auto-start if requested
    if [ "${AUTO_START:-false}" = "true" ]; then
        log_step "Starting server..."
        "${install_dir}/mcp-server" start
    fi

    print_success "${install_dir}"
}

# Run main
main "$@"
