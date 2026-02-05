# MCP Installer Enhancement Specification - Tasks

## Overview
- Purpose: MCPサーバインストーラ機能強化の実装タスクリスト
- Status: Draft
- Version: 1.0.0
- Last Updated: 2026-02-05
- Author: vow-spec-architect

---

## Implementation Phases

### Phase 1: Server Installer Enhancement (Priority: High)
**Estimated Time**: 2-3 hours
**Dependencies**: None

### Phase 2: Configuration Export Feature (Priority: High)
**Estimated Time**: 1 hour
**Dependencies**: Phase 1

### Phase 3: Unified Installer Creation (Priority: Medium)
**Estimated Time**: 3-4 hours
**Dependencies**: Phase 1, Phase 2

### Phase 4: Systemd Integration (Priority: Low)
**Estimated Time**: 1-2 hours
**Dependencies**: Phase 1

### Phase 5: Documentation & Testing (Priority: High)
**Estimated Time**: 2 hours
**Dependencies**: Phase 1-4

---

## Task List

### Phase 1: Server Installer Enhancement

#### TASK-001: Add Upgrade Support
- **Status**: [ ] Pending
- **Assignable to**: implementer
- **Files**:
  - `/home/ubuntu/Downloads/vow/infra/mcp-installer/install.sh`

**Implementation**:
```bash
# Add to install.sh:
# 1. Detect existing installation
# 2. Backup config if upgrading
# 3. Update source files only
# 4. Preserve existing token
```

**Acceptance Criteria**:
- [ ] `--upgrade` flag works correctly
- [ ] Config files are backed up before upgrade
- [ ] Token is preserved during upgrade
- [ ] Version number is updated in package.json

---

#### TASK-002: Add Verification Commands
- **Status**: [ ] Pending
- **Assignable to**: implementer
- **Files**:
  - `/home/ubuntu/Downloads/vow/infra/mcp-installer/install.sh`

**Implementation**:
```bash
# Add to install.sh:
# 1. --verify-only flag
# 2. verify_server() function
# 3. Post-install verification
```

**Acceptance Criteria**:
- [ ] `--verify-only` skips installation, runs checks only
- [ ] Health check passes after installation
- [ ] Clear error messages on failure

---

#### TASK-003: Improve Error Handling
- **Status**: [ ] Pending
- **Assignable to**: implementer
- **Files**:
  - `/home/ubuntu/Downloads/vow/infra/mcp-installer/install.sh`

**Implementation**:
```bash
# Add to install.sh:
# 1. Specific exit codes (2=args, 3=prereq, 4=network, etc.)
# 2. Detailed error messages with solutions
# 3. set -euo pipefail for strict mode
```

**Acceptance Criteria**:
- [ ] Exit codes match specification
- [ ] Error messages include remediation steps
- [ ] No silent failures

---

### Phase 2: Configuration Export Feature

#### TASK-004: Add export-config Command
- **Status**: [x] Complete (2026-02-05)
- **Assignable to**: implementer
- **Files**:
  - `/home/ubuntu/.mcp-multi-agent/setup_multi_agent.sh` (template in install.sh)
  - `/home/ubuntu/Downloads/vow/infra/mcp-installer/install.sh`

**Implementation**:
```bash
# Add to setup_multi_agent.sh embedded template:
export_config() {
    source "${CONFIG_DIR}/server.env"
    local local_ip=$(get_local_ip)

    cat > "${SCRIPT_DIR}/remote-config.json" << EOF
{
  "serverUrl": "http://${local_ip}:${TASK_SERVER_PORT}",
  "token": "${TASK_SERVER_TOKEN}",
  "serverName": "$(hostname)",
  "exportedAt": "$(date -Iseconds)"
}
EOF

    echo "Exported to: ${SCRIPT_DIR}/remote-config.json"
    echo ""
    echo "Remote install command:"
    echo "  ./install.sh --mode client --server-url http://${local_ip}:${TASK_SERVER_PORT} --token ${TASK_SERVER_TOKEN}"
}

# Add case in command dispatch:
export-config|export)
    export_config
    ;;
```

**Acceptance Criteria**:
- [x] `./setup_multi_agent.sh export-config` generates JSON file
- [x] JSON contains all required fields
- [x] Remote install command is displayed
- [x] Command is added to help text

---

#### TASK-005: Add verify-connection Command
- **Status**: [x] Complete (2026-02-05)
- **Assignable to**: implementer
- **Note**: Implemented as `verify-connection` instead of `remote-info` enhancement
- **Files**:
  - `/home/ubuntu/.mcp-multi-agent/setup_multi_agent.sh` (template)

**Implementation**:
```bash
# Enhance existing or add new command:
remote_info() {
    source "${CONFIG_DIR}/server.env"
    local local_ip=$(get_local_ip)

    echo "=========================================="
    echo "  MCP Server Remote Connection Info"
    echo "=========================================="
    echo ""
    echo "  Server URL:  http://${local_ip}:${TASK_SERVER_PORT}"
    echo "  Token:       ${TASK_SERVER_TOKEN}"
    echo ""
    echo "  Test with:"
    echo "    curl -H 'Authorization: Bearer ${TASK_SERVER_TOKEN}' \\"
    echo "      http://${local_ip}:${TASK_SERVER_PORT}/health"
    echo ""
}
```

**Acceptance Criteria**:
- [ ] `remote-info` command shows connection details
- [ ] Includes test curl command
- [ ] Works from any directory

---

### Phase 3: Unified Installer Creation

#### TASK-006: Create Unified Installer Structure
- **Status**: [ ] Pending
- **Assignable to**: implementer
- **Files**:
  - `/home/ubuntu/Downloads/vow/infra/mcp-unified-installer/install.sh` (new)
  - `/home/ubuntu/Downloads/vow/infra/mcp-unified-installer/lib/common.sh` (new)

**Implementation**:
```bash
# Create directory structure:
mkdir -p /home/ubuntu/Downloads/vow/infra/mcp-unified-installer/{lib,templates}

# Create install.sh with:
# - Mode selection (--mode server|client|both)
# - Common argument parsing
# - Source lib/common.sh
# - Call appropriate install function
```

**Acceptance Criteria**:
- [ ] Directory structure created
- [ ] install.sh is executable
- [ ] `--help` shows all options
- [ ] Mode selection works

---

#### TASK-007: Implement Server Mode in Unified Installer
- **Status**: [ ] Pending
- **Assignable to**: implementer
- **Prerequisites**: TASK-006
- **Files**:
  - `/home/ubuntu/Downloads/vow/infra/mcp-unified-installer/lib/server-install.sh` (new)

**Implementation**:
```bash
# Extract server installation logic from existing install.sh
# Refactor for modularity
# Add upgrade detection
```

**Acceptance Criteria**:
- [ ] `./install.sh --mode server` works identically to existing
- [ ] Upgrade support included
- [ ] No regression from existing functionality

---

#### TASK-008: Implement Client Mode in Unified Installer
- **Status**: [ ] Pending
- **Assignable to**: implementer
- **Prerequisites**: TASK-006
- **Files**:
  - `/home/ubuntu/Downloads/vow/infra/mcp-unified-installer/lib/client-install.sh` (new)

**Implementation**:
```bash
# Extract client installation logic from mcp-remote-installer
# Adapt for unified installer interface
# Add pre-flight connectivity check
```

**Acceptance Criteria**:
- [ ] `./install.sh --mode client --server-url URL --token TOKEN` works
- [ ] Pre-flight check verifies server reachability
- [ ] Claude Code MCP config generated correctly

---

#### TASK-009: Implement Both Mode
- **Status**: [ ] Pending
- **Assignable to**: implementer
- **Prerequisites**: TASK-007, TASK-008
- **Files**:
  - `/home/ubuntu/Downloads/vow/infra/mcp-unified-installer/install.sh`

**Implementation**:
```bash
# Add logic to install.sh:
if [ "$MODE" = "both" ]; then
    install_server
    start_server
    # Auto-detect local server for client config
    install_client --server-url "http://localhost:${PORT}" --token "${TOKEN}"
fi
```

**Acceptance Criteria**:
- [ ] `./install.sh --mode both` installs server then client
- [ ] Client auto-connects to local server
- [ ] Both components work together

---

### Phase 4: Systemd Integration

#### TASK-010: Create Systemd Service Template
- **Status**: [ ] Pending
- **Assignable to**: implementer
- **Files**:
  - `/home/ubuntu/Downloads/vow/infra/mcp-installer/templates/mcp-task-server.service` (new)

**Implementation**:
```ini
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

**Acceptance Criteria**:
- [ ] Service file is valid systemd format
- [ ] Uses user home directory variables
- [ ] Restart on failure configured

---

#### TASK-011: Add install-service Command
- **Status**: [ ] Pending
- **Assignable to**: implementer
- **Prerequisites**: TASK-010
- **Files**:
  - `/home/ubuntu/Downloads/vow/infra/mcp-installer/install.sh`

**Implementation**:
```bash
# Add to setup_multi_agent.sh template:
install_service() {
    local service_dir="$HOME/.config/systemd/user"
    mkdir -p "$service_dir"

    cp "${SCRIPT_DIR}/templates/mcp-task-server.service" "$service_dir/"
    sed -i "s|%h|$HOME|g" "$service_dir/mcp-task-server.service"

    systemctl --user daemon-reload
    echo "Service installed. Run: systemctl --user enable --now mcp-task-server"
}
```

**Acceptance Criteria**:
- [ ] `./setup_multi_agent.sh install-service` creates service file
- [ ] `systemctl --user start mcp-task-server` works
- [ ] Service survives logout (with lingering enabled)

---

### Phase 5: Documentation & Testing

#### TASK-012: Update README Files
- **Status**: [ ] Pending
- **Assignable to**: implementer
- **Files**:
  - `/home/ubuntu/Downloads/vow/infra/mcp-installer/README.md`
  - `/home/ubuntu/Downloads/vow/infra/mcp-remote-installer/README.md`
  - `/home/ubuntu/Downloads/vow/infra/mcp-unified-installer/README.md` (new)

**Acceptance Criteria**:
- [ ] All new features documented
- [ ] Quick start guides included
- [ ] Troubleshooting section added

---

#### TASK-013: Update CLAUDE.md
- **Status**: [ ] Pending
- **Assignable to**: implementer
- **Files**:
  - `/home/ubuntu/Downloads/vow/CLAUDE.md`

**Implementation**:
Add section for new installer features and commands.

**Acceptance Criteria**:
- [ ] New commands documented
- [ ] Export-config workflow explained
- [ ] Unified installer usage documented

---

#### TASK-014: Integration Testing
- **Status**: [ ] Pending
- **Assignable to**: tester
- **Prerequisites**: All previous tasks

**Test Cases**:
1. Fresh server installation
2. Server upgrade (v1.0 -> v1.1)
3. Client installation with valid credentials
4. Client installation with invalid credentials (should fail gracefully)
5. Unified installer: server mode
6. Unified installer: client mode
7. Unified installer: both mode
8. export-config and remote installation flow
9. Systemd service start/stop/restart
10. Cross-machine remote connection

**Acceptance Criteria**:
- [ ] All test cases pass
- [ ] No regressions from existing functionality
- [ ] Error handling works correctly

---

## Task Dependencies Graph

```
TASK-001 (Upgrade) ─────────────┐
TASK-002 (Verify) ──────────────┼───► Phase 1 Complete
TASK-003 (Errors) ──────────────┘
        │
        ▼
TASK-004 (Export) ──────────────┐
TASK-005 (RemoteInfo) ──────────┴───► Phase 2 Complete
        │
        ▼
TASK-006 (Structure) ───────────────────────────┐
        │                                       │
        ├──► TASK-007 (ServerMode) ─────────────┤
        │                                       ├───► Phase 3 Complete
        └──► TASK-008 (ClientMode) ─────────────┤
                      │                         │
                      └──► TASK-009 (BothMode) ─┘
        │
        ▼
TASK-010 (ServiceTemplate) ─────┐
        │                       ├───────────────► Phase 4 Complete
        └──► TASK-011 (ServiceCmd) ─────────────┘
        │
        ▼
TASK-012 (README) ──────────────┐
TASK-013 (CLAUDE.md) ───────────┼───────────────► Phase 5 Complete
TASK-014 (Testing) ─────────────┘
```

---

## Priority Recommendations

### Immediate (Today)
1. **TASK-004**: Export-config command - Most requested feature
2. **TASK-005**: Remote-info enhancement

### Short Term (This Week)
3. **TASK-001**: Upgrade support
4. **TASK-002**: Verification commands
5. **TASK-003**: Error handling

### Medium Term (Next Sprint)
6. **TASK-006 ~ TASK-009**: Unified installer
7. **TASK-010 ~ TASK-011**: Systemd integration

### Ongoing
8. **TASK-012 ~ TASK-014**: Documentation and testing

---

## Agent Assignment Recommendations

| Task | Recommended Agent | Reason |
|------|-------------------|--------|
| TASK-001~003 | implementer | Shell scripting |
| TASK-004~005 | implementer | Shell scripting |
| TASK-006~009 | implementer | Shell scripting, architecture |
| TASK-010~011 | devops | Systemd expertise |
| TASK-012~013 | documenter | Documentation |
| TASK-014 | tester | QA expertise |
