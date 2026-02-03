# MCP Task Distribution Server - Installation Guide

Multi-Agent Coordination Server for VOW Project.

## Quick Install

### One-Line Install (from GitHub)

```bash
curl -fsSL https://raw.githubusercontent.com/laximgqozaZZZYT/vow/main/infra/mcp-installer/install.sh | bash
```

### Install from AWS (Development Environment)

```bash
curl -fsSL https://lyry9riumg.execute-api.ap-northeast-1.amazonaws.com/development/mcp-installer/install.sh | bash
```

### Install from Local Network

If the installer is being served locally:

```bash
curl -fsSL http://SERVER_IP:8080/install.sh | bash
```

## Installation Options

Control installation via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `INSTALL_DIR` | `~/.mcp-multi-agent` | Installation directory |
| `SERVER_PORT` | `3456` | Server port |
| `AUTO_START` | `false` | Start server after install |
| `SKIP_BUILD` | `false` | Skip TypeScript compilation |

### Examples

```bash
# Install to custom directory
curl -fsSL http://SERVER/install.sh | INSTALL_DIR=/opt/mcp-server bash

# Install and auto-start
curl -fsSL http://SERVER/install.sh | AUTO_START=true bash

# Install with custom port
curl -fsSL http://SERVER/install.sh | SERVER_PORT=4000 bash

# Combined options
curl -fsSL http://SERVER/install.sh | INSTALL_DIR=/opt/mcp SERVER_PORT=4000 AUTO_START=true bash
```

## Prerequisites

- **Node.js 16+** - JavaScript runtime
- **npm 8+** - Package manager
- **bash** - Shell environment

### Installing Node.js

```bash
# Using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18

# Or using package manager (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

## Post-Installation

### Start the Server

```bash
~/.mcp-multi-agent/mcp-server start
```

### Verify Installation

```bash
curl http://localhost:3456/health
```

### Use with Claude Code

```bash
claude --mcp-config ~/.mcp-multi-agent/mcp-config.json
```

### Connect from VOW Frontend

1. Go to the MOC (Multi-agent Orchestration Center) section
2. Open Chat Agent Settings
3. Click "Connect to Local Claude Code"
4. Or manually enter:
   - URL: `http://localhost:3456`
   - Token: (shown after installation)

## Server Management

```bash
# Start server
~/.mcp-multi-agent/mcp-server start

# Stop server
~/.mcp-multi-agent/mcp-server stop

# Restart server
~/.mcp-multi-agent/mcp-server restart

# Check status
~/.mcp-multi-agent/mcp-server status

# View logs
~/.mcp-multi-agent/mcp-server logs

# Show configuration
~/.mcp-multi-agent/mcp-server config
```

## Directory Structure

After installation:

```
~/.mcp-multi-agent/
├── mcp-server              # Management script
├── mcp-config.json         # Claude Code MCP configuration
├── config/
│   └── server.env          # Server configuration (token, port)
├── logs/
│   ├── server.log          # Server output
│   └── server.pid          # Process ID file
└── mcp-task-distributor/   # Server application
    ├── src/                # TypeScript source
    ├── build/              # Compiled JavaScript
    └── package.json        # Dependencies
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check (no auth) |
| `/events` | GET | SSE event stream |
| `/dashboard` | GET | Server statistics |
| `/agents` | GET | List agents |
| `/agents/register` | POST | Register agent |
| `/tasks` | GET/POST | List/create tasks |
| `/tasks/:id/claim` | POST | Claim a task |
| `/tasks/:id/submit` | POST | Submit result |
| `/agents/:id/chat` | GET | Chat with Claude Code |

## Serving the Installer (for distribution)

To distribute the installer over your local network:

```bash
cd /path/to/mcp-multi-agent
./serve-installer.sh 8080
```

Then on other machines:

```bash
curl -fsSL http://YOUR_IP:8080/install.sh | bash
```

## Uninstall

```bash
# Stop server first
~/.mcp-multi-agent/mcp-server stop

# Remove installation
rm -rf ~/.mcp-multi-agent
```

## Troubleshooting

### Server won't start

1. Check if port is already in use:
   ```bash
   lsof -i :3456
   ```

2. Check logs:
   ```bash
   cat ~/.mcp-multi-agent/logs/server.log
   ```

### Connection refused

1. Verify server is running:
   ```bash
   ~/.mcp-multi-agent/mcp-server status
   ```

2. Check firewall settings:
   ```bash
   sudo ufw allow 3456/tcp
   ```

### Authentication errors (401)

1. Verify token matches:
   ```bash
   cat ~/.mcp-multi-agent/config/server.env | grep TOKEN
   ```

2. Test with curl:
   ```bash
   source ~/.mcp-multi-agent/config/server.env
   curl -H "Authorization: Bearer $TASK_SERVER_TOKEN" http://localhost:3456/agents
   ```

## Support

For issues and feature requests, please visit:
- GitHub: https://github.com/YOUR_REPO/mcp-multi-agent/issues
- VOW Project: https://github.com/YOUR_REPO/vow
