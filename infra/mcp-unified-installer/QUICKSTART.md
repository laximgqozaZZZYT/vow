# MCP Unified Installer - Quick Start Guide

This guide will get you up and running with the MCP Task Distribution System in minutes.

## Scenario 1: Single Developer Machine

Install both server and client on your laptop for local development:

```bash
cd /path/to/vow/infra/mcp-unified-installer
./install.sh --mode both --auto-start
```

That's it! The server is now running and Claude Code is configured to use it.

**Test it:**
```bash
# Check server status
~/.mcp-multi-agent/setup_multi_agent.sh status

# Start Claude Code
claude
```

In Claude, you can now use MCP tools like `register_agent`, `create_task`, `list_tasks`, etc.

---

## Scenario 2: Remote Team Setup

### Step 1: Install Server on Host Machine

On your main development machine (e.g., `192.168.2.200`):

```bash
cd /path/to/vow/infra/mcp-unified-installer
./install.sh --mode server --auto-start
```

### Step 2: Export Configuration

```bash
~/.mcp-multi-agent/setup_multi_agent.sh export-config
```

This creates `remote-config.json` and displays a command like:

```bash
./install.sh --mode client \
  --server-url http://192.168.2.200:3456 \
  --token mcp-xxx
```

### Step 3: Install Client on Remote Machine(s)

Copy the command from Step 2 and run it on each remote machine:

```bash
cd /path/to/vow/infra/mcp-unified-installer
./install.sh --mode client \
  --server-url http://192.168.2.200:3456 \
  --token mcp-dca3c407f66c5b62840b06c3d624c857 \
  --agent-name laptop-dev \
  --agent-role developer
```

### Step 4: Start Working

On any machine with the client installed:

```bash
claude
```

All agents are now connected to the central task server!

---

## Scenario 3: Upgrade Existing Installation

If you already have the MCP server installed:

```bash
cd /path/to/vow/infra/mcp-unified-installer
./install.sh --mode server --upgrade
```

Your configuration and token are preserved automatically.

---

## Common Commands Cheat Sheet

### Server Management

```bash
# Start server
~/.mcp-multi-agent/setup_multi_agent.sh start

# Stop server
~/.mcp-multi-agent/setup_multi_agent.sh stop

# Check status
~/.mcp-multi-agent/setup_multi_agent.sh status

# View logs
~/.mcp-multi-agent/setup_multi_agent.sh logs

# Export config for remotes
~/.mcp-multi-agent/setup_multi_agent.sh export-config
```

### Client Management

```bash
# Check server connectivity
~/vow-mcp-agent/check-status.sh

# Start Claude Code
claude
```

### Verification

```bash
# Verify server (without installing)
./install.sh --verify-only --mode server

# Verify client connection
./install.sh --verify-only --mode client \
  --server-url http://192.168.2.200:3456 \
  --token mcp-xxx
```

---

## Troubleshooting Quick Fixes

### Problem: Cannot connect to server

**Solution:**
```bash
# On server machine, check if running:
~/.mcp-multi-agent/setup_multi_agent.sh status

# If not running:
~/.mcp-multi-agent/setup_multi_agent.sh start

# Check firewall:
sudo ufw allow 3456/tcp
```

### Problem: Authentication failed

**Solution:**
```bash
# On server machine, show current token:
~/.mcp-multi-agent/setup_multi_agent.sh show-config

# Use the displayed token in client installation
```

### Problem: Node.js version too old

**Solution:**
```bash
# Install latest LTS via nvm:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

---

## Next Steps

- Read the [full README](README.md) for advanced usage
- Check the [specification](../../specs/mcp-installer-enhancement/) for architecture details
- Join the VOW project development!

---

## Quick Reference

| Task | Command |
|------|---------|
| Install local dev | `./install.sh --mode both --auto-start` |
| Install server | `./install.sh --mode server` |
| Install client | `./install.sh --mode client --server-url URL --token TOKEN` |
| Upgrade | `./install.sh --mode server --upgrade` |
| Start server | `~/.mcp-multi-agent/setup_multi_agent.sh start` |
| Export config | `~/.mcp-multi-agent/setup_multi_agent.sh export-config` |
| Check status | `~/vow-mcp-agent/check-status.sh` |
| Use with Claude | `claude` |
