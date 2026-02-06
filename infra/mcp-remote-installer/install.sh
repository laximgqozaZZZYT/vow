#!/bin/bash
# =============================================================================
# VOW MCP Remote Agent Installer
# =============================================================================
# This script installs and configures the MCP client for remote Claude Code
# instances to connect to the VOW project's central task server.
#
# Usage:
#   ./install.sh --server-url http://192.168.2.126:3456 --token <AUTH_TOKEN>
#
# Requirements:
#   - Node.js 18+ and npm
#   - Claude Code CLI installed
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
INSTALL_DIR="$HOME/vow-mcp-agent"
SERVER_URL=""
AUTH_TOKEN=""
AGENT_NAME="$(hostname)-agent"
AGENT_ROLE="developer"
MACHINE_ID=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --server-url)
      SERVER_URL="$2"
      shift 2
      ;;
    --token)
      AUTH_TOKEN="$2"
      shift 2
      ;;
    --name)
      AGENT_NAME="$2"
      shift 2
      ;;
    --role)
      AGENT_ROLE="$2"
      shift 2
      ;;
    --install-dir)
      INSTALL_DIR="$2"
      shift 2
      ;;
    --machine-id)
      MACHINE_ID="$2"
      shift 2
      ;;
    -h|--help)
      echo "VOW MCP Remote Agent Installer"
      echo ""
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --server-url URL   Central task server URL (required)"
      echo "  --token TOKEN      Authentication token (required)"
      echo "  --name NAME        Agent display name (default: hostname-agent)"
      echo "  --role ROLE        Agent role (default: developer)"
      echo "                     Options: manager, developer, reviewer, tester,"
      echo "                              documenter, analyst, architect, devops, general"
      echo "  --install-dir DIR  Installation directory (default: ~/vow-mcp-agent)"
      echo "  --machine-id ID    Machine identifier (auto-generated if not specified)"
      echo "  -h, --help         Show this help message"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

# Header
echo -e "${BLUE}"
echo "============================================================"
echo "  VOW MCP Remote Agent Installer"
echo "============================================================"
echo -e "${NC}"

# Validate required arguments
if [ -z "$SERVER_URL" ]; then
  echo -e "${RED}Error: --server-url is required${NC}"
  echo "Example: $0 --server-url http://192.168.2.126:3456 --token YOUR_TOKEN"
  exit 1
fi

if [ -z "$AUTH_TOKEN" ]; then
  echo -e "${RED}Error: --token is required${NC}"
  echo "Example: $0 --server-url http://192.168.2.126:3456 --token YOUR_TOKEN"
  exit 1
fi

# Generate machine ID if not provided
if [ -z "$MACHINE_ID" ]; then
  MACHINE_ID="remote-$(hostname | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g')-$(date +%s | tail -c 5)"
fi

echo -e "${GREEN}Configuration:${NC}"
echo "  Server URL:   $SERVER_URL"
echo "  Agent Name:   $AGENT_NAME"
echo "  Agent Role:   $AGENT_ROLE"
echo "  Machine ID:   $MACHINE_ID"
echo "  Install Dir:  $INSTALL_DIR"
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
  echo -e "${RED}Error: Node.js is not installed${NC}"
  echo "Please install Node.js 18+ from https://nodejs.org/"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo -e "${RED}Error: Node.js 18+ is required (found v$NODE_VERSION)${NC}"
  exit 1
fi
echo -e "  ${GREEN}✓${NC} Node.js $(node -v)"

# Check npm
if ! command -v npm &> /dev/null; then
  echo -e "${RED}Error: npm is not installed${NC}"
  exit 1
fi
echo -e "  ${GREEN}✓${NC} npm $(npm -v)"

# Check Claude CLI
if ! command -v claude &> /dev/null; then
  echo -e "${YELLOW}Warning: Claude Code CLI not found in PATH${NC}"
  echo "  You may need to install it or add it to your PATH"
else
  echo -e "  ${GREEN}✓${NC} Claude Code CLI found"
fi

# Test server connectivity
echo ""
echo -e "${YELLOW}Testing connection to task server...${NC}"
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$SERVER_URL/health" 2>/dev/null || echo "000")

if [ "$HEALTH_RESPONSE" = "200" ]; then
  echo -e "  ${GREEN}✓${NC} Server is reachable"
else
  echo -e "${RED}Error: Cannot connect to server at $SERVER_URL${NC}"
  echo "  HTTP Status: $HEALTH_RESPONSE"
  echo "  Please check:"
  echo "    1. Server is running"
  echo "    2. Network connectivity"
  echo "    3. Firewall allows port 3456"
  exit 1
fi

# Test authentication
echo -e "${YELLOW}Testing authentication...${NC}"
AUTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  "$SERVER_URL/agents" 2>/dev/null || echo "000")

if [ "$AUTH_RESPONSE" = "200" ]; then
  echo -e "  ${GREEN}✓${NC} Authentication successful"
else
  echo -e "${RED}Error: Authentication failed${NC}"
  echo "  HTTP Status: $AUTH_RESPONSE"
  echo "  Please check your token is correct"
  exit 1
fi

# Create installation directory
echo ""
echo -e "${YELLOW}Creating installation directory...${NC}"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# Create package.json
echo -e "${YELLOW}Initializing Node.js project...${NC}"
cat > package.json << 'PACKAGE_EOF'
{
  "name": "vow-mcp-agent",
  "version": "1.0.0",
  "description": "VOW MCP Remote Agent - connects to central task server",
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
    "@modelcontextprotocol/sdk": "^1.0.0",
    "uuid": "^11.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/uuid": "^10.0.0",
    "typescript": "^5.7.0"
  }
}
PACKAGE_EOF

# Create tsconfig.json
cat > tsconfig.json << 'TSCONFIG_EOF'
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

# Create src directory
mkdir -p src

# Create types.ts
cat > src/types.ts << 'TYPES_EOF'
export type TaskStatus = "pending" | "assigned" | "in_progress" | "completed" | "failed";
export type TaskPriority = "low" | "normal" | "high" | "urgent";
export type AgentRole = "manager" | "developer" | "reviewer" | "tester" | "documenter" | "analyst" | "architect" | "devops" | "general";
export type AgentStatus = "idle" | "busy" | "offline";

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  assignedTo: string | null;
  status: TaskStatus;
  result: string | null;
  tags: string[];
  parentTaskId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deadline: string | null;
}

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  capabilities: string[];
  status: AgentStatus;
  currentTaskId: string | null;
  machineId: string;
  lastHeartbeat: string;
  registeredAt: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
TYPES_EOF

# Create mcp-bridge.ts (the main MCP client)
cat > src/mcp-bridge.ts << 'BRIDGE_EOF'
#!/usr/bin/env node
/**
 * VOW MCP Bridge - Remote agent client for VOW project
 * Connects to central Task Server and provides MCP tools for Claude Code
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { v4 as uuidv4 } from "uuid";

// Configuration from environment
const SERVER_URL = process.env.TASK_SERVER_URL || "http://localhost:3456";
const AUTH_TOKEN = process.env.TASK_SERVER_TOKEN || "";
const AGENT_NAME = process.env.AGENT_NAME || "Remote Agent";
const AGENT_ROLE = process.env.AGENT_ROLE || "developer";
const MACHINE_ID = process.env.MACHINE_ID || `remote-${uuidv4().slice(0, 8)}`;

// Registered agent info
let registeredAgentId: string | null = null;

// HTTP client helper
async function apiCall<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const response = await fetch(`${SERVER_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AUTH_TOKEN}`,
        ...(registeredAgentId ? { "X-Agent-ID": registeredAgentId } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const result = await response.json();
    return result as { success: boolean; data?: T; error?: string };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Create MCP Server
const server = new Server(
  {
    name: "vow-remote-agent",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "register_agent",
        description: "Register this agent with the VOW task server. Required before using other tools.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Display name for this agent" },
            role: {
              type: "string",
              enum: ["manager", "developer", "reviewer", "tester", "documenter", "analyst", "architect", "devops", "general"],
              description: "Role/specialization of this agent",
            },
            capabilities: {
              type: "array",
              items: { type: "string" },
              description: "List of capabilities (e.g., ['typescript', 'react', 'testing'])",
            },
          },
          required: ["name", "role"],
        },
      },
      {
        name: "heartbeat",
        description: "Send heartbeat to server. Call periodically to stay registered.",
        inputSchema: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["idle", "busy"], description: "Current status" },
          },
        },
      },
      {
        name: "list_agents",
        description: "List all registered agents and their status",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "create_task",
        description: "Create a new task for the VOW project",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "Brief title of the task" },
            description: { type: "string", description: "Detailed description" },
            priority: { type: "string", enum: ["low", "normal", "high", "urgent"] },
            tags: { type: "array", items: { type: "string" } },
            assign_to: { type: "string", description: "Agent ID to assign to" },
          },
          required: ["title", "description"],
        },
      },
      {
        name: "list_tasks",
        description: "List tasks with optional filters",
        inputSchema: {
          type: "object",
          properties: {
            status: { type: "string", description: "Filter by status (comma-separated)" },
            assigned_to: { type: "string", description: "Filter by agent ID" },
          },
        },
      },
      {
        name: "get_my_tasks",
        description: "Get all tasks assigned to this agent",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "claim_task",
        description: "Claim a task and start working on it",
        inputSchema: {
          type: "object",
          properties: {
            task_id: { type: "string", description: "ID of the task to claim" },
          },
          required: ["task_id"],
        },
      },
      {
        name: "submit_result",
        description: "Submit the result of a completed task",
        inputSchema: {
          type: "object",
          properties: {
            task_id: { type: "string", description: "ID of the task" },
            result: { type: "string", description: "The result/output" },
            success: { type: "boolean", description: "Whether task completed successfully" },
          },
          required: ["task_id", "result", "success"],
        },
      },
      {
        name: "dashboard",
        description: "Get overview of all tasks and agents (statistics)",
        inputSchema: { type: "object", properties: {} },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  const formatResponse = (result: { success: boolean; data?: unknown; error?: string }) => ({
    content: [{ type: "text" as const, text: JSON.stringify(result.success ? result.data : { error: result.error }, null, 2) }],
  });

  switch (name) {
    case "register_agent": {
      const { name: agentName, role, capabilities = [] } = args as { name: string; role: string; capabilities?: string[] };
      const result = await apiCall<{ agentId: string }>("POST", "/agents/register", {
        name: agentName,
        role,
        capabilities,
        machineId: MACHINE_ID,
      });
      if (result.success && result.data) {
        registeredAgentId = result.data.agentId;
        return formatResponse({ success: true, data: { message: "Agent registered", agentId: registeredAgentId, serverUrl: SERVER_URL } });
      }
      return formatResponse(result);
    }

    case "heartbeat": {
      if (!registeredAgentId) return formatResponse({ success: false, error: "Agent not registered" });
      const { status = "idle" } = (args as { status?: string }) || {};
      return formatResponse(await apiCall("POST", `/agents/${registeredAgentId}/heartbeat`, { status }));
    }

    case "list_agents":
      return formatResponse(await apiCall("GET", "/agents"));

    case "create_task": {
      const { title, description, priority, tags, assign_to } = args as { title: string; description: string; priority?: string; tags?: string[]; assign_to?: string };
      return formatResponse(await apiCall("POST", "/tasks", { title, description, priority, tags, assignTo: assign_to }));
    }

    case "list_tasks": {
      const { status, assigned_to } = (args as { status?: string; assigned_to?: string }) || {};
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (assigned_to) params.set("assignedTo", assigned_to);
      return formatResponse(await apiCall("GET", `/tasks${params.toString() ? `?${params}` : ""}`));
    }

    case "get_my_tasks":
      if (!registeredAgentId) return formatResponse({ success: false, error: "Agent not registered" });
      return formatResponse(await apiCall("GET", `/tasks?assignedTo=${registeredAgentId}`));

    case "claim_task": {
      if (!registeredAgentId) return formatResponse({ success: false, error: "Agent not registered" });
      const { task_id } = args as { task_id: string };
      return formatResponse(await apiCall("POST", `/tasks/${task_id}/claim`));
    }

    case "submit_result": {
      const { task_id, result, success } = args as { task_id: string; result: string; success: boolean };
      return formatResponse(await apiCall("POST", `/tasks/${task_id}/submit`, { result, success }));
    }

    case "dashboard":
      return formatResponse(await apiCall("GET", "/dashboard"));

    default:
      return formatResponse({ success: false, error: `Unknown tool: ${name}` });
  }
});

// Resources
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [{ uri: "vow://config", mimeType: "application/json", name: "Agent Configuration" }],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  if (request.params.uri === "vow://config") {
    return {
      contents: [{
        uri: "vow://config",
        mimeType: "application/json",
        text: JSON.stringify({ serverUrl: SERVER_URL, agentId: registeredAgentId, agentName: AGENT_NAME, role: AGENT_ROLE, machineId: MACHINE_ID }, null, 2),
      }],
    };
  }
  throw new Error(`Resource not found: ${request.params.uri}`);
});

// Start server with auto-registration
async function main() {
  if (AUTH_TOKEN && AGENT_NAME) {
    console.error(`Auto-registering: ${AGENT_NAME} (${AGENT_ROLE})`);
    const result = await apiCall<{ agentId: string }>("POST", "/agents/register", {
      name: AGENT_NAME,
      role: AGENT_ROLE,
      capabilities: [],
      machineId: MACHINE_ID,
    });
    if (result.success && result.data) {
      registeredAgentId = result.data.agentId;
      console.error(`Registered as: ${registeredAgentId}`);
    }
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("VOW MCP Agent running");
  console.error(`Server: ${SERVER_URL}`);
  console.error(`Agent: ${registeredAgentId || "(not registered)"}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
BRIDGE_EOF

echo -e "  ${GREEN}✓${NC} Source files created"

# Install dependencies
echo ""
echo -e "${YELLOW}Installing dependencies...${NC}"
npm install --quiet

# Build TypeScript
echo -e "${YELLOW}Building TypeScript...${NC}"
npm run build

echo -e "  ${GREEN}✓${NC} Build complete"

# Create MCP configuration file for Claude Code
echo ""
echo -e "${YELLOW}Creating Claude Code MCP configuration...${NC}"

MCP_CONFIG_DIR="$HOME/.claude"
mkdir -p "$MCP_CONFIG_DIR"

# Create or update mcp.json
MCP_CONFIG_FILE="$MCP_CONFIG_DIR/mcp.json"

cat > "$MCP_CONFIG_FILE" << MCPCONFIG_EOF
{
  "mcpServers": {
    "vow-agent": {
      "command": "node",
      "args": ["$INSTALL_DIR/build/mcp-bridge.js"],
      "env": {
        "TASK_SERVER_URL": "$SERVER_URL",
        "TASK_SERVER_TOKEN": "$AUTH_TOKEN",
        "AGENT_NAME": "$AGENT_NAME",
        "AGENT_ROLE": "$AGENT_ROLE",
        "MACHINE_ID": "$MACHINE_ID"
      }
    }
  }
}
MCPCONFIG_EOF

echo -e "  ${GREEN}✓${NC} MCP config created at $MCP_CONFIG_FILE"

# Create convenience scripts
echo -e "${YELLOW}Creating convenience scripts...${NC}"

# Start script
cat > "$INSTALL_DIR/start-agent.sh" << STARTSCRIPT_EOF
#!/bin/bash
# Start the VOW MCP Agent manually (for debugging)
export TASK_SERVER_URL="$SERVER_URL"
export TASK_SERVER_TOKEN="$AUTH_TOKEN"
export AGENT_NAME="$AGENT_NAME"
export AGENT_ROLE="$AGENT_ROLE"
export MACHINE_ID="$MACHINE_ID"

node "$INSTALL_DIR/build/mcp-bridge.js"
STARTSCRIPT_EOF
chmod +x "$INSTALL_DIR/start-agent.sh"

# Status script
cat > "$INSTALL_DIR/check-status.sh" << STATUSSCRIPT_EOF
#!/bin/bash
# Check VOW task server status
echo "VOW Task Server Status"
echo "======================"
echo "Server URL: $SERVER_URL"
echo ""

# Health check
echo -n "Health: "
HEALTH=\$(curl -s "$SERVER_URL/health" 2>/dev/null)
if [ \$? -eq 0 ]; then
  echo "\$HEALTH" | jq -r '.data.status // "unknown"' 2>/dev/null || echo "OK"
else
  echo "UNREACHABLE"
fi

# Dashboard
echo ""
echo "Dashboard:"
curl -s -H "Authorization: Bearer $AUTH_TOKEN" "$SERVER_URL/dashboard" 2>/dev/null | jq '.data' 2>/dev/null || echo "Failed to fetch dashboard"
STATUSSCRIPT_EOF
chmod +x "$INSTALL_DIR/check-status.sh"

echo -e "  ${GREEN}✓${NC} Scripts created"

# Create environment file for reference
cat > "$INSTALL_DIR/.env" << ENVFILE_EOF
# VOW MCP Agent Configuration
TASK_SERVER_URL=$SERVER_URL
TASK_SERVER_TOKEN=$AUTH_TOKEN
AGENT_NAME=$AGENT_NAME
AGENT_ROLE=$AGENT_ROLE
MACHINE_ID=$MACHINE_ID
ENVFILE_EOF

# Final output
echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  Installation Complete!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo "Installation directory: $INSTALL_DIR"
echo ""
echo "The MCP server has been configured for Claude Code."
echo "When you run 'claude', it will automatically connect to the VOW task server."
echo ""
echo -e "${YELLOW}Quick Start:${NC}"
echo "  1. Start Claude Code:  claude"
echo "  2. In Claude, the VOW agent tools are now available"
echo "  3. Use 'register_agent' tool to register with the server"
echo ""
echo -e "${YELLOW}Available Scripts:${NC}"
echo "  $INSTALL_DIR/start-agent.sh   - Start agent manually (debug)"
echo "  $INSTALL_DIR/check-status.sh  - Check server status"
echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo "  MCP Config:  $MCP_CONFIG_FILE"
echo "  Environment: $INSTALL_DIR/.env"
echo ""
echo -e "${BLUE}Happy coding with VOW!${NC}"
