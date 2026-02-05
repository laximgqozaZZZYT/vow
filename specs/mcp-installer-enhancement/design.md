# MCP Installer Enhancement Specification - Design

## Overview
- Purpose: MCPサーバインストーラの機能強化設計書
- Status: Draft
- Version: 1.0.0
- Last Updated: 2026-02-05
- Author: vow-spec-architect

---

## 1. System Architecture

### 1.1 Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Host Machine (192.168.2.200)                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │           MCP Task Server (/home/ubuntu/.mcp-multi-agent)  │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │  │
│  │  │ Express │ │  Task   │ │  Agent  │ │   SSE   │          │  │
│  │  │  :3456  │ │  Queue  │ │Registry │ │Broadcast│          │  │
│  │  └────┬────┘ └─────────┘ └─────────┘ └─────────┘          │  │
│  │       │ 0.0.0.0:3456                                       │  │
│  └───────┼───────────────────────────────────────────────────┘  │
│          │                                                       │
│  ┌───────┼───────────────────────────────────────────────────┐  │
│  │       │    Local Claude Code Agents (MCP Bridge)           │  │
│  │       │    (claude --mcp-config mcp-config.json)           │  │
│  └───────┼───────────────────────────────────────────────────┘  │
└──────────┼──────────────────────────────────────────────────────┘
           │ LAN (HTTP)
           ▼
┌──────────────────────────────────────────────────────────────────┐
│                  Remote Machine (192.168.2.xxx)                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │           Remote Claude Code Agent (~/vow-mcp-agent)        │  │
│  │           (claude --mcp-config ~/.claude/mcp.json)          │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 1.2 Installer File Structure

```
infra/
├── mcp-installer/
│   ├── install.sh              # Server installer (existing, v1.1.0)
│   ├── lambda/                 # Lambda deployment files
│   ├── serve-installer.sh      # Local HTTP server for testing
│   └── README.md
│
├── mcp-remote-installer/
│   ├── install.sh              # Client installer (existing, v1.0.0)
│   ├── scripts/
│   │   └── mcp-bridge.ts       # MCP client source
│   └── README.md
│
└── mcp-unified-installer/      # NEW: Unified installer
    ├── install.sh              # Main unified installer
    ├── lib/
    │   ├── common.sh           # Shared functions
    │   ├── server-install.sh   # Server installation logic
    │   ├── client-install.sh   # Client installation logic
    │   └── verify.sh           # Verification functions
    ├── templates/
    │   ├── server.env.template
    │   ├── mcp-config.template
    │   └── systemd.service.template
    └── README.md
```

---

## 2. Unified Installer Design

### 2.1 Command Line Interface

```bash
# Usage
./install.sh [OPTIONS]

# Mode selection
--mode server              # Install server only (default)
--mode client              # Install client only
--mode both                # Install server + client

# Server options
--port PORT                # Server port (default: 3456)
--bind-address IP          # Bind address (default: 0.0.0.0)
--install-dir DIR          # Installation directory (default: ~/.mcp-multi-agent)

# Client options
--server-url URL           # Task server URL (required for client mode)
--token TOKEN              # Authentication token (required for client mode)
--agent-name NAME          # Agent display name (default: hostname-agent)
--agent-role ROLE          # Agent role (default: developer)

# Common options
--upgrade                  # Upgrade existing installation
--verify-only              # Only verify connectivity, don't install
--systemd                  # Install systemd service (server mode)
--help                     # Show help message
--version                  # Show version
```

### 2.2 Installation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Unified Installer Flow                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────┐
│   Start     │
└──────┬──────┘
       │
       ▼
┌──────────────────┐
│ Parse Arguments  │
│ Validate Options │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     No    ┌──────────────────┐
│ Prerequisites OK?├──────────►│ Show Error &     │
└────────┬─────────┘           │ Installation Tips│
         │ Yes                  └──────────────────┘
         ▼
┌──────────────────┐
│ Detect Existing  │
│ Installation     │
└────────┬─────────┘
         │
    ┌────┴────┐
    │ Mode?   │
    └────┬────┘
         │
    ┌────┼────┬───────────┐
    ▼    ▼    ▼           ▼
┌──────┐┌──────┐┌──────┐┌──────┐
│Server││Client││ Both ││Verify│
│ Mode ││ Mode ││ Mode ││ Only │
└──┬───┘└──┬───┘└──┬───┘└──┬───┘
   │       │       │       │
   ▼       ▼       ▼       ▼
┌──────────────────────────────┐
│      Mode-Specific Setup     │
│  - Directory creation        │
│  - Source installation       │
│  - npm install & build       │
│  - Configuration generation  │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│     Connection Verification  │
│  - Health check (server)     │
│  - Auth test (client)        │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│     Post-Install Tasks       │
│  - Systemd registration (opt)│
│  - Quick start guide display │
└──────────────┬───────────────┘
               │
               ▼
┌─────────────┐
│    Done     │
└─────────────┘
```

### 2.3 Server Installation Logic

```bash
install_server() {
    local install_dir="${INSTALL_DIR:-$HOME/.mcp-multi-agent}"
    local port="${PORT:-3456}"
    local bind_address="${BIND_ADDRESS:-0.0.0.0}"

    # 1. Check existing installation
    if [ -d "$install_dir" ] && [ -f "$install_dir/config/server.env" ]; then
        if [ "$UPGRADE" = "true" ]; then
            backup_config "$install_dir"
        else
            log_warn "Installation exists. Use --upgrade to update."
            return 1
        fi
    fi

    # 2. Create directory structure
    create_directories "$install_dir"

    # 3. Install source files (embedded or from repo)
    install_source_files "$install_dir"

    # 4. Install dependencies
    npm_install "$install_dir/mcp-task-distributor"

    # 5. Build TypeScript
    npm_build "$install_dir/mcp-task-distributor"

    # 6. Generate configuration
    generate_server_config "$install_dir" "$port" "$bind_address"

    # 7. Create management script
    create_management_script "$install_dir"

    # 8. Start server and verify
    start_and_verify_server "$install_dir" "$port"

    # 9. Optional: Install systemd service
    if [ "$INSTALL_SYSTEMD" = "true" ]; then
        install_systemd_service "$install_dir"
    fi

    # 10. Display success message
    display_server_success "$install_dir" "$port"
}
```

### 2.4 Client Installation Logic

```bash
install_client() {
    local server_url="${SERVER_URL}"
    local token="${TOKEN}"
    local agent_name="${AGENT_NAME:-$(hostname)-agent}"
    local agent_role="${AGENT_ROLE:-developer}"
    local install_dir="${CLIENT_INSTALL_DIR:-$HOME/vow-mcp-agent}"

    # 1. Validate server URL and token
    validate_required_params "$server_url" "$token"

    # 2. Test connectivity
    test_server_connectivity "$server_url"

    # 3. Test authentication
    test_authentication "$server_url" "$token"

    # 4. Create installation directory
    mkdir -p "$install_dir"

    # 5. Install MCP client source
    install_client_source "$install_dir"

    # 6. Install dependencies
    npm_install "$install_dir"

    # 7. Build TypeScript
    npm_build "$install_dir"

    # 8. Generate Claude Code MCP config
    generate_mcp_config "$server_url" "$token" "$agent_name" "$agent_role" "$install_dir"

    # 9. Create convenience scripts
    create_client_scripts "$install_dir" "$server_url" "$token"

    # 10. Display success message
    display_client_success "$install_dir" "$server_url"
}
```

---

## 3. Configuration Export Feature

### 3.1 Export Command

```bash
# setup_multi_agent.sh に追加
export_config() {
    local config_file="${CONFIG_DIR}/server.env"
    source "$config_file"

    local local_ip=$(get_local_ip)
    local output_file="${SCRIPT_DIR}/remote-config.json"

    cat > "$output_file" << EOF
{
  "serverUrl": "http://${local_ip}:${TASK_SERVER_PORT}",
  "token": "${TASK_SERVER_TOKEN}",
  "serverName": "$(hostname)",
  "exportedAt": "$(date -Iseconds)"
}
EOF

    echo "Configuration exported to: $output_file"
    echo ""
    echo "Remote installation command:"
    echo "  curl -fsSL https://raw.githubusercontent.com/.../install.sh | bash -s -- \\"
    echo "    --mode client \\"
    echo "    --server-url http://${local_ip}:${TASK_SERVER_PORT} \\"
    echo "    --token ${TASK_SERVER_TOKEN}"
}
```

### 3.2 Configuration File Format

```json
// remote-config.json
{
  "serverUrl": "http://192.168.2.200:3456",
  "token": "mcp-dca3c407f66c5b62840b06c3d624c857",
  "serverName": "ubuntu-dev",
  "localIp": "192.168.2.200",
  "port": 3456,
  "exportedAt": "2026-02-05T10:30:00+09:00",
  "version": "1.1.0"
}
```

---

## 4. Systemd Service Integration

### 4.1 Service File Template

```ini
# /home/ubuntu/.config/systemd/user/mcp-task-server.service
[Unit]
Description=MCP Task Distribution Server
After=network.target

[Service]
Type=simple
WorkingDirectory=%h/.mcp-multi-agent/mcp-task-distributor
EnvironmentFile=%h/.mcp-multi-agent/config/server.env
ExecStart=/usr/bin/node %h/.mcp-multi-agent/mcp-task-distributor/build/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
```

### 4.2 Service Management Commands

```bash
# install-service command
install_systemd_service() {
    local install_dir="$1"
    local service_dir="$HOME/.config/systemd/user"
    local service_file="$service_dir/mcp-task-server.service"

    mkdir -p "$service_dir"

    # Generate service file from template
    envsubst < "${install_dir}/templates/systemd.service.template" > "$service_file"

    # Reload systemd
    systemctl --user daemon-reload

    echo "Service installed. Commands:"
    echo "  systemctl --user enable mcp-task-server  # Auto-start on login"
    echo "  systemctl --user start mcp-task-server   # Start now"
    echo "  systemctl --user status mcp-task-server  # Check status"
}
```

---

## 5. Upgrade Logic

### 5.1 Upgrade Detection

```bash
detect_existing_installation() {
    local install_dir="$1"

    if [ ! -d "$install_dir" ]; then
        echo "none"
        return
    fi

    if [ -f "$install_dir/mcp-task-distributor/package.json" ]; then
        local version=$(jq -r '.version' "$install_dir/mcp-task-distributor/package.json")
        echo "$version"
    else
        echo "unknown"
    fi
}
```

### 5.2 Upgrade Process

```bash
upgrade_installation() {
    local install_dir="$1"
    local current_version=$(detect_existing_installation "$install_dir")

    log_info "Current version: $current_version"
    log_info "New version: $INSTALLER_VERSION"

    # Backup configuration
    local backup_dir="${install_dir}/backup/$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$backup_dir"
    cp -r "${install_dir}/config" "$backup_dir/"
    log_info "Configuration backed up to: $backup_dir"

    # Update source files only
    install_source_files "$install_dir"

    # Rebuild
    npm_install "${install_dir}/mcp-task-distributor"
    npm_build "${install_dir}/mcp-task-distributor"

    # Restart if running
    if is_server_running "$install_dir"; then
        stop_server "$install_dir"
        start_server "$install_dir"
    fi

    log_info "Upgrade complete: $current_version -> $INSTALLER_VERSION"
}
```

---

## 6. Verification Module

### 6.1 Server Verification

```bash
verify_server() {
    local port="$1"
    local max_retries=5
    local retry_interval=2

    for i in $(seq 1 $max_retries); do
        if curl -s "http://localhost:${port}/health" | grep -q '"success":true'; then
            log_info "Server health check: OK"
            return 0
        fi
        sleep $retry_interval
    done

    log_error "Server health check failed after $max_retries attempts"
    return 1
}
```

### 6.2 Client Verification

```bash
verify_client_connection() {
    local server_url="$1"
    local token="$2"

    # Health check (no auth)
    if ! curl -s "${server_url}/health" | grep -q '"success":true'; then
        log_error "Cannot reach server: $server_url"
        return 1
    fi
    log_info "Server reachable: OK"

    # Auth check
    local auth_response=$(curl -s -w "%{http_code}" -o /dev/null \
        -H "Authorization: Bearer $token" \
        "${server_url}/agents")

    if [ "$auth_response" != "200" ]; then
        log_error "Authentication failed (HTTP $auth_response)"
        return 1
    fi
    log_info "Authentication: OK"

    return 0
}
```

---

## 7. Error Handling

### 7.1 Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | Prerequisites not met |
| 4 | Network error |
| 5 | Authentication error |
| 6 | Build error |
| 7 | Configuration error |

### 7.2 Error Messages

```bash
handle_error() {
    local code="$1"
    local message="$2"

    case $code in
        3)
            log_error "$message"
            echo ""
            echo "Please install missing prerequisites:"
            echo "  Node.js: https://nodejs.org/ (v16+ required)"
            echo "  npm: Included with Node.js"
            ;;
        4)
            log_error "Network error: $message"
            echo ""
            echo "Please check:"
            echo "  1. Server is running"
            echo "  2. Firewall allows port 3456"
            echo "  3. Network connectivity"
            ;;
        5)
            log_error "Authentication failed: $message"
            echo ""
            echo "Please verify:"
            echo "  1. Token is correct"
            echo "  2. Server has not regenerated token"
            ;;
        *)
            log_error "$message"
            ;;
    esac

    exit $code
}
```

---

## 8. Agent Coordination Notes

### For Implementation Agents:

1. **Server Installer の改修を先に実施**
   - 既存の `install.sh` をベースに拡張
   - `export-config` コマンドの追加
   - Systemd サービス対応の追加

2. **Client Installer は変更最小限**
   - 既存機能で十分動作確認済み
   - 統合インストーラからの呼び出しに対応

3. **Unified Installer は新規作成**
   - `infra/mcp-unified-installer/` に配置
   - 共通関数は `lib/common.sh` に集約

4. **テストは各フェーズで必須**
   - サーバインストール -> ヘルスチェック
   - クライアントインストール -> 認証テスト
   - 統合テスト -> 両方のモードを連続実行

5. **ドキュメント更新**
   - README.md の更新
   - CLAUDE.md への追記
