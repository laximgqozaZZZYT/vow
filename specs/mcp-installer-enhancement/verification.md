# MCP Installer Enhancement Specification - Verification

## Overview
- Purpose: MCPインストーラ機能強化の動作確認手順
- Status: Draft
- Version: 1.0.0
- Last Updated: 2026-02-05
- Author: vow-spec-architect

---

## 1. Pre-Implementation Verification (Current State)

### 1.1 Verify Existing Server is Working

```bash
# 1. Check server status
curl -s http://localhost:3456/health
# Expected: {"success":true,"data":{"status":"running",...}}

# 2. Check configuration
cat /home/ubuntu/.mcp-multi-agent/config/server.env
# Expected: Contains TASK_SERVER_HOST, PORT, TOKEN, URL

# 3. Test from remote (replace IP with actual)
curl -s http://192.168.2.200:3456/health
# Expected: Same as #1 (verifies 0.0.0.0 binding works)

# 4. Test authentication
TOKEN=$(grep TASK_SERVER_TOKEN /home/ubuntu/.mcp-multi-agent/config/server.env | cut -d= -f2)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3456/agents
# Expected: {"success":true,"data":[...]}
```

### 1.2 Verify Existing Installers

```bash
# Server installer location
ls -la /home/ubuntu/Downloads/vow/infra/mcp-installer/install.sh
# Expected: File exists, executable

# Remote installer location
ls -la /home/ubuntu/Downloads/vow/infra/mcp-remote-installer/install.sh
# Expected: File exists, executable

# Check installer version
grep "VERSION=" /home/ubuntu/Downloads/vow/infra/mcp-installer/install.sh
# Expected: VERSION="1.1.0" or similar
```

---

## 2. Phase 1 Verification: Server Installer Enhancement

### 2.1 Upgrade Support Test

```bash
# Pre-condition: Existing installation at ~/.mcp-multi-agent
ls /home/ubuntu/.mcp-multi-agent/config/server.env

# Test 1: Run without --upgrade (should warn)
cd /home/ubuntu/Downloads/vow/infra/mcp-installer
./install.sh
# Expected: Warning about existing installation

# Test 2: Run with --upgrade
./install.sh --upgrade
# Expected: Backup created, source updated, config preserved

# Test 3: Verify backup
ls /home/ubuntu/.mcp-multi-agent/backup/
# Expected: Directory with timestamped backup

# Test 4: Verify token preserved
OLD_TOKEN="mcp-dca3c407f66c5b62840b06c3d624c857"  # from before upgrade
NEW_TOKEN=$(grep TASK_SERVER_TOKEN /home/ubuntu/.mcp-multi-agent/config/server.env | cut -d= -f2)
[ "$OLD_TOKEN" = "$NEW_TOKEN" ] && echo "Token preserved: OK"
```

### 2.2 Verification Command Test

```bash
# Test 1: --verify-only with running server
./install.sh --verify-only
# Expected: "Server health check: OK", exit 0

# Test 2: --verify-only with stopped server
cd /home/ubuntu/.mcp-multi-agent && ./setup_multi_agent.sh stop-server
cd /home/ubuntu/Downloads/vow/infra/mcp-installer
./install.sh --verify-only
# Expected: "Server not running", exit 1
```

### 2.3 Error Handling Test

```bash
# Test 1: Invalid port
./install.sh --port abc
# Expected: Exit code 2, clear error message

# Test 2: Missing Node.js (simulate)
PATH=/tmp:$PATH ./install.sh
# Expected: Exit code 3, "Node.js not found" with install instructions
```

---

## 3. Phase 2 Verification: Configuration Export

### 3.1 Export-Config Command Test

```bash
# Ensure server is running
cd /home/ubuntu/.mcp-multi-agent
./setup_multi_agent.sh start-server

# Test export-config
./setup_multi_agent.sh export-config
# Expected output:
# - "Configuration exported to: .../remote-config.json"
# - Remote install command displayed

# Verify JSON file
cat remote-config.json
# Expected: Valid JSON with serverUrl, token, serverName, exportedAt

# Verify JSON is valid
jq . remote-config.json
# Expected: Formatted JSON output
```

### 3.2 Remote-Info Command Test

```bash
./setup_multi_agent.sh remote-info
# Expected output:
# - Server URL with actual IP
# - Token
# - Test curl command

# Test the displayed curl command
# (Copy and run the command shown in output)
# Expected: Health check succeeds
```

---

## 4. Phase 3 Verification: Unified Installer

### 4.1 Structure Verification

```bash
# Verify directory structure
ls -la /home/ubuntu/Downloads/vow/infra/mcp-unified-installer/
# Expected: install.sh, lib/, templates/

ls -la /home/ubuntu/Downloads/vow/infra/mcp-unified-installer/lib/
# Expected: common.sh, server-install.sh, client-install.sh
```

### 4.2 Server Mode Test

```bash
cd /home/ubuntu/Downloads/vow/infra/mcp-unified-installer

# Clean test (use different directory)
./install.sh --mode server --install-dir /tmp/mcp-test-server --port 3457

# Verify
curl http://localhost:3457/health
# Expected: {"success":true,...}

# Cleanup
rm -rf /tmp/mcp-test-server
```

### 4.3 Client Mode Test

```bash
# Pre-condition: Server running on default port
# Get server info
cd /home/ubuntu/.mcp-multi-agent
./setup_multi_agent.sh export-config
SERVER_URL=$(jq -r .serverUrl remote-config.json)
TOKEN=$(jq -r .token remote-config.json)

# Test client installation
cd /home/ubuntu/Downloads/vow/infra/mcp-unified-installer
./install.sh --mode client \
  --server-url "$SERVER_URL" \
  --token "$TOKEN" \
  --install-dir /tmp/mcp-test-client

# Verify MCP config created
cat ~/.claude/mcp.json
# Expected: Contains vow-agent configuration

# Cleanup
rm -rf /tmp/mcp-test-client
```

### 4.4 Both Mode Test

```bash
cd /home/ubuntu/Downloads/vow/infra/mcp-unified-installer

# Install both (use different port to avoid conflict)
./install.sh --mode both --port 3458 --install-dir /tmp/mcp-test-both

# Verify server
curl http://localhost:3458/health
# Expected: {"success":true,...}

# Verify client config
cat ~/.claude/mcp.json
# Expected: Updated with localhost:3458 connection

# Cleanup
rm -rf /tmp/mcp-test-both
```

---

## 5. Phase 4 Verification: Systemd Integration

### 5.1 Service Installation Test

```bash
cd /home/ubuntu/.mcp-multi-agent

# Stop manual server if running
./setup_multi_agent.sh stop-server

# Install systemd service
./setup_multi_agent.sh install-service

# Verify service file
cat ~/.config/systemd/user/mcp-task-server.service
# Expected: Valid systemd unit file

# Start via systemd
systemctl --user start mcp-task-server
systemctl --user status mcp-task-server
# Expected: Active (running)

# Verify health
curl http://localhost:3456/health
# Expected: {"success":true,...}
```

### 5.2 Service Persistence Test

```bash
# Enable auto-start
systemctl --user enable mcp-task-server

# Enable lingering (persist after logout)
loginctl enable-linger $USER

# Reboot test (optional, manual)
# After reboot:
systemctl --user status mcp-task-server
# Expected: Active (running)
```

---

## 6. Cross-Machine Remote Connection Test

### 6.1 Setup (Host Machine)

```bash
# On host machine (192.168.2.200 or similar)
cd /home/ubuntu/.mcp-multi-agent

# Ensure server is running
./setup_multi_agent.sh server-status
# If not running: ./setup_multi_agent.sh start-server

# Get connection info
./setup_multi_agent.sh export-config
cat remote-config.json
# Note the serverUrl and token
```

### 6.2 Test from Remote Machine

```bash
# On remote machine (different IP on same LAN)

# Step 1: Test connectivity
SERVER_URL="http://192.168.2.200:3456"  # Replace with actual
TOKEN="mcp-dca3c407f66c5b62840b06c3d624c857"  # Replace with actual

curl -s "$SERVER_URL/health"
# Expected: {"success":true,"data":{"status":"running",...}}

# Step 2: Test authentication
curl -s -H "Authorization: Bearer $TOKEN" "$SERVER_URL/agents"
# Expected: {"success":true,"data":[...]}

# Step 3: Install client (if not done)
curl -fsSL https://raw.githubusercontent.com/.../install.sh | bash -s -- \
  --mode client \
  --server-url "$SERVER_URL" \
  --token "$TOKEN" \
  --agent-name "remote-$(hostname)"

# Step 4: Verify MCP config
cat ~/.claude/mcp.json
# Expected: Contains server URL and token

# Step 5: Test with Claude Code
claude --mcp-config ~/.claude/mcp.json
# In Claude: Use MCP tools to interact with server
```

---

## 7. Troubleshooting Guide

### Issue: Server not reachable from remote

```bash
# Check 1: Server binding
grep TASK_SERVER_HOST /home/ubuntu/.mcp-multi-agent/config/server.env
# Should be: 0.0.0.0

# Check 2: Firewall
sudo ufw status
# If active: sudo ufw allow 3456/tcp

# Check 3: Server listening
netstat -tlnp | grep 3456
# Expected: Shows node process listening
```

### Issue: Authentication fails

```bash
# Check 1: Token matches
# Server token:
grep TASK_SERVER_TOKEN /home/ubuntu/.mcp-multi-agent/config/server.env

# Client token:
grep TASK_SERVER_TOKEN ~/.claude/mcp.json
# or check vow-mcp-agent/.env

# They must match exactly
```

### Issue: Systemd service won't start

```bash
# Check 1: Service logs
journalctl --user -u mcp-task-server -f

# Check 2: Node path
which node
# Ensure it matches service file ExecStart

# Check 3: Working directory
ls ~/.mcp-multi-agent/mcp-task-distributor/build/server.js
# Must exist
```

---

## 8. Acceptance Checklist

### Phase 1: Server Installer Enhancement
- [ ] `--upgrade` flag preserves configuration
- [ ] `--verify-only` checks server health
- [ ] Exit codes match specification (0-7)
- [ ] Error messages include remediation steps

### Phase 2: Configuration Export
- [ ] `export-config` generates valid JSON
- [ ] `remote-info` displays connection details
- [ ] Displayed curl command works

### Phase 3: Unified Installer
- [ ] `--mode server` works
- [ ] `--mode client` works
- [ ] `--mode both` works
- [ ] `--help` shows all options

### Phase 4: Systemd Integration
- [ ] Service file is valid
- [ ] `systemctl --user start` works
- [ ] Service survives logout (with lingering)

### Phase 5: Cross-Machine
- [ ] Remote health check works
- [ ] Remote authentication works
- [ ] Remote Claude Code can use MCP tools

---

## 9. Performance Benchmarks

| Operation | Target | Acceptable |
|-----------|--------|------------|
| Server install (cold) | < 3 min | < 5 min |
| Server install (with npm cache) | < 1 min | < 2 min |
| Client install | < 2 min | < 3 min |
| Verification only | < 5 sec | < 10 sec |
| Health check response | < 100 ms | < 500 ms |
| Remote connection (LAN) | < 200 ms | < 1 sec |
