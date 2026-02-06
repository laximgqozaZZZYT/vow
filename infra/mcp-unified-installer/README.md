# MCP Unified Installer

Unified installer for the MCP Task Distribution System supporting server, client, or combined installation modes.

## Version

2.0.0

## Features

- **Three Installation Modes**: Server only, client only, or both
- **Upgrade Support**: Seamlessly upgrade existing installations while preserving configuration
- **Configuration Export**: Easy sharing of connection info for remote clients
- **Connectivity Verification**: Pre-flight checks ensure successful installation
- **Auto-start Option**: Optionally start server immediately after installation
- **Systemd Integration**: Install as a system service (optional)
- **Comprehensive Error Handling**: Clear error messages with remediation steps

## Prerequisites

- Node.js 16+ (recommended: 18+ or 20+)
- npm 8+
- curl (for connectivity tests)
- openssl (for token generation, optional)
- Bash 4.0+

### Installing Prerequisites

**Ubuntu/Debian:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs curl
```

**Using nvm:**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20
```

## Installation Modes

### 1. Server Mode (Default)

Install the MCP Task Distribution Server on a host machine.

```bash
./install.sh --mode server
```

**Options:**
- `--port PORT` - Server port (default: 3456)
- `--bind-address IP` - Bind address (default: 0.0.0.0)
- `--install-dir DIR` - Installation directory (default: ~/.mcp-multi-agent)
- `--auto-start` - Start server immediately after installation
- `--systemd` - Install as systemd service
- `--upgrade` - Upgrade existing installation

**Example with custom port:**
```bash
./install.sh --mode server --port 8080 --auto-start
```

**Example with systemd:**
```bash
./install.sh --mode server --systemd --auto-start
```

### 2. Client Mode

Install the MCP client to connect to a remote task server.

```bash
./install.sh --mode client \
  --server-url http://192.168.2.200:3456 \
  --token mcp-xxx
```

**Options:**
- `--server-url URL` - Task server URL (required)
- `--token TOKEN` - Authentication token (required)
- `--agent-name NAME` - Agent display name (default: hostname-agent)
- `--agent-role ROLE` - Agent role (default: developer)
- `--client-dir DIR` - Installation directory (default: ~/vow-mcp-agent)
- `--machine-id ID` - Machine identifier (auto-generated)

**Available Roles:**
- `manager` - Task coordination and management
- `developer` - Code implementation
- `reviewer` - Code review and quality checks
- `tester` - Testing and QA
- `documenter` - Documentation writing
- `analyst` - Requirements analysis
- `architect` - System design
- `devops` - Deployment and operations
- `general` - General purpose tasks

**Example:**
```bash
./install.sh --mode client \
  --server-url http://192.168.2.200:3456 \
  --token mcp-dca3c407f66c5b62840b06c3d624c857 \
  --agent-name laptop-dev-agent \
  --agent-role developer
```

### 3. Both Mode

Install both server and client on the same machine (useful for development).

```bash
./install.sh --mode both
```

This will:
1. Install and configure the server
2. Start the server
3. Install the client configured to connect to localhost

### 4. Verify-Only Mode

Test connectivity without installing anything.

```bash
# Verify server
./install.sh --verify-only --mode server --port 3456

# Verify client connection
./install.sh --verify-only --mode client \
  --server-url http://192.168.2.200:3456 \
  --token mcp-xxx
```

## Upgrade Existing Installation

To upgrade an existing installation while preserving configuration:

```bash
./install.sh --mode server --upgrade
```

This will:
- Backup existing configuration to `~/.mcp-multi-agent/backup/<timestamp>/`
- Update source files and dependencies
- Preserve authentication token
- Rebuild TypeScript

## Server Management

After server installation, use the management script:

```bash
cd ~/.mcp-multi-agent

# Start server
./setup_multi_agent.sh start-server

# Stop server
./setup_multi_agent.sh stop-server

# Restart server
./setup_multi_agent.sh restart

# Check status
./setup_multi_agent.sh server-status

# Show configuration
./setup_multi_agent.sh show-config

# Export config for remote clients
./setup_multi_agent.sh export-config

# Generate new token
./setup_multi_agent.sh generate-token

# View logs
./setup_multi_agent.sh logs
```

## Exporting Configuration for Remote Clients

After installing the server, export connection information:

```bash
cd ~/.mcp-multi-agent
./setup_multi_agent.sh export-config
```

This creates `remote-config.json` and displays a ready-to-use installation command:

```bash
./install.sh --mode client \
  --server-url http://192.168.2.200:3456 \
  --token mcp-dca3c407f66c5b62840b06c3d624c857
```

## Client Management

After client installation:

```bash
cd ~/vow-mcp-agent

# Check server status
./check-status.sh

# Start agent manually (debugging)
./start-agent.sh

# Use with Claude Code (automatic)
claude
```

When you run `claude`, the MCP configuration is automatically loaded from `~/.claude/mcp.json`.

## Systemd Service (Server Only)

If you installed with `--systemd`, manage the service:

```bash
# Enable auto-start on login
systemctl --user enable mcp-task-server

# Start service
systemctl --user start mcp-task-server

# Stop service
systemctl --user stop mcp-task-server

# Check status
systemctl --user status mcp-task-server

# View logs
journalctl --user -u mcp-task-server -f

# Enable lingering (service runs even when logged out)
loginctl enable-linger $USER
```

## Directory Structure

### Server Installation
```
~/.mcp-multi-agent/
├── mcp-task-distributor/
│   ├── src/                    # TypeScript source
│   ├── build/                  # Compiled JavaScript
│   ├── package.json
│   └── tsconfig.json
├── config/
│   └── server.env              # Server configuration
├── logs/
│   └── server.log              # Server logs
├── backup/                     # Configuration backups
├── mcp-config.json             # MCP configuration for Claude
├── remote-config.json          # Exported config (after export-config)
└── setup_multi_agent.sh        # Management script
```

### Client Installation
```
~/vow-mcp-agent/
├── src/                        # TypeScript source
├── build/                      # Compiled JavaScript
├── package.json
├── tsconfig.json
├── .env                        # Environment variables
├── start-agent.sh              # Manual start script
└── check-status.sh             # Status check script

~/.claude/
└── mcp.json                    # MCP configuration for Claude Code
```

## Configuration Files

### Server Configuration (`~/.mcp-multi-agent/config/server.env`)
```bash
TASK_SERVER_HOST=0.0.0.0
TASK_SERVER_PORT=3456
TASK_SERVER_TOKEN=mcp-xxx
TASK_SERVER_URL=http://192.168.2.200:3456
```

### Client Environment (`~/vow-mcp-agent/.env`)
```bash
TASK_SERVER_URL=http://192.168.2.200:3456
TASK_SERVER_TOKEN=mcp-xxx
AGENT_NAME=laptop-agent
AGENT_ROLE=developer
MACHINE_ID=laptop-12345
```

## Troubleshooting

### Installation Fails: Missing Node.js

**Error:**
```
[ERROR] Node.js not found
```

**Solution:**
Install Node.js 16+ using nvm or your package manager.

### Installation Fails: Permission Denied

**Error:**
```
mkdir: cannot create directory: Permission denied
```

**Solution:**
Ensure you have write permissions to the installation directory. Don't use `sudo` with this installer.

### Server Won't Start

**Check logs:**
```bash
cat ~/.mcp-multi-agent/logs/server.log
```

**Common issues:**
1. Port already in use: Change port with `--port`
2. Node version too old: Upgrade to Node.js 16+
3. Missing dependencies: Run `npm install` in `~/.mcp-multi-agent/mcp-task-distributor`

### Client Cannot Connect

**Verify connectivity:**
```bash
curl http://192.168.2.200:3456/health
```

**Check authentication:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://192.168.2.200:3456/agents
```

**Common issues:**
1. Server not running: Start server on host machine
2. Firewall blocking: Allow TCP port 3456
3. Wrong token: Use `export-config` on server to get correct token
4. Network issue: Check IP address and connectivity

### Upgrade Fails

**Backup exists at:**
```
~/.mcp-multi-agent/backup/<timestamp>/
```

**Manual recovery:**
```bash
cd ~/.mcp-multi-agent
cp backup/<timestamp>/config/server.env config/
./setup_multi_agent.sh restart
```

## Network Configuration

### Firewall Rules (Host Machine)

**Ubuntu/Debian (ufw):**
```bash
sudo ufw allow 3456/tcp
```

**CentOS/RHEL (firewalld):**
```bash
sudo firewall-cmd --permanent --add-port=3456/tcp
sudo firewall-cmd --reload
```

### Multiple Network Interfaces

If your machine has multiple IP addresses, specify which to bind:

```bash
./install.sh --mode server --bind-address 192.168.2.200
```

## Security Considerations

1. **Token Security**: Keep your authentication token secure. Don't commit it to version control.
2. **Network Security**: Consider using a VPN or SSH tunnel for remote connections.
3. **File Permissions**: Config files are created with restricted permissions (600).
4. **Regular Updates**: Keep Node.js and dependencies up to date.

## Integration with Claude Code

After installation, Claude Code automatically uses the MCP server:

```bash
# Server mode: Use local MCP tools
cd ~/.mcp-multi-agent
claude --mcp-config mcp-config.json

# Client mode: Connects to remote server
claude  # Uses ~/.claude/mcp.json automatically
```

## Advanced Usage

### Custom Installation Paths

```bash
./install.sh --mode server --install-dir /opt/mcp-server
./install.sh --mode client --client-dir /opt/mcp-client --server-url ...
```

### Multiple Clients on Same Machine

Install clients in different directories with different names:

```bash
./install.sh --mode client --client-dir ~/agent1 \
  --agent-name agent1 --agent-role developer --server-url ...

./install.sh --mode client --client-dir ~/agent2 \
  --agent-name agent2 --agent-role reviewer --server-url ...
```

### Automated Installation (CI/CD)

```bash
# Unattended server installation
INSTALL_DIR=/opt/mcp AUTO_START=true ./install.sh --mode server --auto-start

# Unattended client installation
./install.sh --mode client \
  --server-url "$MCP_SERVER_URL" \
  --token "$MCP_TOKEN" \
  --agent-name "ci-agent-$BUILD_ID"
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | Prerequisites not met |
| 4 | Network error |
| 5 | Authentication error |

## Related Documentation

- [MCP Server Installer](../mcp-installer/README.md) - Original server installer
- [MCP Remote Installer](../mcp-remote-installer/README.md) - Original client installer
- [VOW Project CLAUDE.md](../../CLAUDE.md) - Agent coordination guide

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review server logs: `~/.mcp-multi-agent/logs/server.log`
3. Test connectivity with `--verify-only`
4. Check the original installer documentation

## Changelog

### Version 2.0.0 (2026-02-05)
- Initial unified installer release
- Combined server and client installation
- Added upgrade support
- Added configuration export feature
- Added systemd integration
- Added comprehensive verification
- Enhanced error handling
