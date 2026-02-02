#!/bin/bash
#===============================================================================
# Package MCP Task Distribution Server for Download
# Creates a distributable zip file of the MCP server
#===============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_SOURCE="/home/ubuntu/mcp-multi-agent"
OUTPUT_DIR="/home/ubuntu/Downloads/vow/frontend/public/downloads"
PACKAGE_NAME="vow-mcp-server"
VERSION="2.0.0"

mkdir -p "$OUTPUT_DIR"

echo "Creating MCP Server package..."

# Create temp directory
TEMP_DIR=$(mktemp -d)
PACKAGE_DIR="$TEMP_DIR/$PACKAGE_NAME"
mkdir -p "$PACKAGE_DIR"

# Copy MCP Task Distributor source
mkdir -p "$PACKAGE_DIR/mcp-task-distributor"
cp -r "$MCP_SOURCE/mcp-task-distributor/src" "$PACKAGE_DIR/mcp-task-distributor/"
cp "$MCP_SOURCE/mcp-task-distributor/package.json" "$PACKAGE_DIR/mcp-task-distributor/"
cp "$MCP_SOURCE/mcp-task-distributor/tsconfig.json" "$PACKAGE_DIR/mcp-task-distributor/"

# Create setup script
cat > "$PACKAGE_DIR/setup.sh" << 'SETUP_EOF'
#!/bin/bash
#===============================================================================
# VOW MCP Task Distribution Server Setup
#===============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         VOW MCP Task Distribution Server Setup             ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is required but not installed.${NC}"
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${YELLOW}Warning: Node.js 18+ recommended (found v$(node -v))${NC}"
fi

echo -e "${GREEN}✓ Node.js $(node -v) detected${NC}"

# Install dependencies
echo ""
echo "Installing dependencies..."
cd mcp-task-distributor
npm install

# Build TypeScript
echo ""
echo "Building server..."
npm run build

# Generate auth token
AUTH_TOKEN="mcp-$(openssl rand -hex 16 2>/dev/null || cat /dev/urandom | tr -dc 'a-f0-9' | head -c 32)"

# Create config directory
mkdir -p ../config
cat > ../config/server.env << EOF
# MCP Task Distribution Server Configuration
TASK_SERVER_PORT=3456
TASK_SERVER_HOST=0.0.0.0
TASK_SERVER_TOKEN=$AUTH_TOKEN
EOF

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    Setup Complete!                          ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Server Token: ${YELLOW}$AUTH_TOKEN${NC}"
echo ""
echo "To start the server:"
echo -e "  ${CYAN}cd $(pwd) && source ../config/server.env && npm run start:server${NC}"
echo ""
echo "Or use the start script:"
echo -e "  ${CYAN}../start-server.sh${NC}"
echo ""
echo "Server will be available at:"
echo -e "  ${CYAN}http://localhost:3456${NC}"
echo ""
echo "Add this token to your VOW dashboard Multi-Agent settings."
SETUP_EOF
chmod +x "$PACKAGE_DIR/setup.sh"

# Create start script
cat > "$PACKAGE_DIR/start-server.sh" << 'START_EOF'
#!/bin/bash
cd "$(dirname "${BASH_SOURCE[0]}")"

if [ -f config/server.env ]; then
    source config/server.env
fi

export TASK_SERVER_PORT="${TASK_SERVER_PORT:-3456}"
export TASK_SERVER_HOST="${TASK_SERVER_HOST:-0.0.0.0}"

if [ -z "$TASK_SERVER_TOKEN" ]; then
    export TASK_SERVER_TOKEN="mcp-$(openssl rand -hex 16 2>/dev/null || echo "default-token-$(date +%s)")"
    echo "Generated token: $TASK_SERVER_TOKEN"
fi

echo "Starting MCP Task Distribution Server..."
echo "  Port: $TASK_SERVER_PORT"
echo "  Host: $TASK_SERVER_HOST"
echo ""

cd mcp-task-distributor
node build/server.js
START_EOF
chmod +x "$PACKAGE_DIR/start-server.sh"

# Create stop script
cat > "$PACKAGE_DIR/stop-server.sh" << 'STOP_EOF'
#!/bin/bash
pkill -f "node.*server.js" && echo "Server stopped." || echo "No server running."
STOP_EOF
chmod +x "$PACKAGE_DIR/stop-server.sh"

# Create MCP config template
cat > "$PACKAGE_DIR/mcp-config.template.json" << 'MCP_EOF'
{
  "mcpServers": {
    "task-distributor": {
      "command": "node",
      "args": ["<PATH_TO>/mcp-task-distributor/build/mcp-bridge.js"],
      "env": {
        "TASK_SERVER_URL": "http://localhost:3456",
        "TASK_SERVER_TOKEN": "<YOUR_TOKEN>",
        "AGENT_NAME": "Agent-1",
        "AGENT_ROLE": "developer",
        "MACHINE_ID": "local"
      }
    }
  }
}
MCP_EOF

# Create README
cat > "$PACKAGE_DIR/README.md" << 'README_EOF'
# VOW MCP Task Distribution Server

Multi-agent task distribution server for coordinating Claude Code agents.

## Quick Start

```bash
# 1. Run setup
./setup.sh

# 2. Start server
./start-server.sh

# 3. Server runs at http://localhost:3456
```

## Configuration

After setup, configuration is stored in `config/server.env`:
- `TASK_SERVER_PORT` - Server port (default: 3456)
- `TASK_SERVER_HOST` - Bind address (default: 0.0.0.0)
- `TASK_SERVER_TOKEN` - Authentication token

## Connecting Claude Code Agents

1. Copy `mcp-config.template.json` to `~/.claude/mcp-config.json`
2. Update the paths and token
3. Start Claude Code: `claude --mcp-config ~/.claude/mcp-config.json`

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/agents` | GET | List all agents |
| `/agents` | POST | Register new agent |
| `/tasks` | GET | List all tasks |
| `/tasks` | POST | Create new task |
| `/tasks/:id/assign` | POST | Assign task to agent |
| `/tasks/:id/claim` | POST | Agent claims a task |
| `/tasks/:id/complete` | POST | Submit task result |
| `/dashboard` | GET | Get statistics |
| `/events` | GET | SSE event stream |

## VOW Dashboard Integration

1. Open VOW Dashboard → Agents section
2. Click settings (gear icon)
3. Add new server:
   - Name: Local MCP Server
   - URL: http://localhost:3456
   - Token: (from setup)
4. Enable and connect

## Requirements

- Node.js 18+
- npm

## License

MIT
README_EOF

# Create zip file
cd "$TEMP_DIR"
zip -r "$OUTPUT_DIR/$PACKAGE_NAME-v$VERSION.zip" "$PACKAGE_NAME"

# Cleanup
rm -rf "$TEMP_DIR"

echo ""
echo -e "${GREEN}Package created: $OUTPUT_DIR/$PACKAGE_NAME-v$VERSION.zip${NC}"
echo ""
ls -lh "$OUTPUT_DIR/$PACKAGE_NAME-v$VERSION.zip"
