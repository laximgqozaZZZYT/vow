#!/bin/bash
#===============================================================================
# Manager Task Watcher
# Monitors MCP server for new tasks assigned to Manager and notifies tmux pane
#===============================================================================

set -e

# Configuration
MCP_SERVER_URL="${TASK_SERVER_URL:-http://localhost:3456}"
MCP_TOKEN="${TASK_SERVER_TOKEN:-mcp-2583b09967362d705553582c115c81b4}"
MANAGER_PANE="${MANAGER_TMUX_PANE:-vow-agents:0.0}"
POLL_INTERVAL="${POLL_INTERVAL:-10}"  # seconds
LOG_FILE="/home/ubuntu/mcp-multi-agent/logs/manager-watcher.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_info() { log "INFO: $1"; }
log_warn() { log "WARN: $1"; }
log_error() { log "ERROR: $1"; }

show_help() {
    cat << 'EOF'
Manager Task Watcher - Monitors and processes tasks for Manager agent

Usage: ./manager-watcher.sh <command> [options]

Commands:
    start               Start watching for tasks (foreground)
    daemon              Start as background daemon
    stop                Stop the daemon
    status              Check daemon status
    check               One-time check for pending tasks
    help                Show this help

Environment Variables:
    TASK_SERVER_URL     MCP server URL (default: http://localhost:3456)
    TASK_SERVER_TOKEN   Auth token
    MANAGER_TMUX_PANE   Tmux pane for Manager (default: vow-multi-agent:0.0)
    POLL_INTERVAL       Polling interval in seconds (default: 10)

Examples:
    ./manager-watcher.sh daemon    # Start as background daemon
    ./manager-watcher.sh check     # Check for pending tasks now
    ./manager-watcher.sh stop      # Stop the daemon
EOF
}

# Get Manager agent ID
get_manager_id() {
    local agents=$(curl -s -H "Authorization: Bearer $MCP_TOKEN" "$MCP_SERVER_URL/agents" 2>/dev/null)
    echo "$agents" | jq -r '.data[] | select(.role == "manager") | .id' | head -1
}

# Get tasks assigned to Manager
get_manager_tasks() {
    local manager_id=$1
    local status=${2:-assigned}

    curl -s -H "Authorization: Bearer $MCP_TOKEN" \
        "$MCP_SERVER_URL/tasks?assignedTo=$manager_id&status=$status" 2>/dev/null | \
        jq -r '.data // []'
}

# Get all pending tasks (not yet assigned)
get_pending_tasks() {
    curl -s -H "Authorization: Bearer $MCP_TOKEN" \
        "$MCP_SERVER_URL/tasks?status=pending" 2>/dev/null | \
        jq -r '.data // []'
}

# Notify Manager tmux pane
notify_manager() {
    local message=$1
    local task_json=$2

    if tmux has-session -t "${MANAGER_PANE%%:*}" 2>/dev/null; then
        # Send notification to Manager pane
        tmux send-keys -t "$MANAGER_PANE" "" # Clear any pending input
        tmux send-keys -t "$MANAGER_PANE" "# [TASK NOTIFICATION] $message" Enter

        if [ -n "$task_json" ]; then
            local task_id=$(echo "$task_json" | jq -r '.id')
            local task_title=$(echo "$task_json" | jq -r '.title')
            local task_desc=$(echo "$task_json" | jq -r '.description')

            # Create a prompt for Claude to process
            cat << EOF | tmux send-keys -t "$MANAGER_PANE" "$(cat)" Enter
新しいタスクが割り当てられました。MCPツール get_my_tasks を使用してタスクを確認し、処理してください。

タスクID: $task_id
タイトル: $task_title
説明: $task_desc

このタスクを処理するには、claim_task でタスクを開始し、完了後に submit_result で結果を報告してください。
EOF
        fi

        log_info "Notified Manager pane: $message"
        return 0
    else
        log_warn "Manager tmux pane not found: $MANAGER_PANE"
        return 1
    fi
}

# One-time check for tasks
check_tasks() {
    local manager_id=$(get_manager_id)

    if [ -z "$manager_id" ]; then
        log_error "No Manager agent registered"
        echo "No Manager agent registered on the server"
        return 1
    fi

    log_info "Manager agent ID: $manager_id"

    # Check assigned tasks
    local assigned=$(get_manager_tasks "$manager_id" "assigned")
    local assigned_count=$(echo "$assigned" | jq 'length')

    # Check in-progress tasks
    local in_progress=$(get_manager_tasks "$manager_id" "in_progress")
    local in_progress_count=$(echo "$in_progress" | jq 'length')

    # Check pending tasks (not yet assigned to anyone)
    local pending=$(get_pending_tasks)
    local pending_count=$(echo "$pending" | jq 'length')

    echo -e "${GREEN}Manager Task Status${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "Manager ID:     ${CYAN}$manager_id${NC}"
    echo -e "Assigned:       ${YELLOW}$assigned_count${NC} tasks"
    echo -e "In Progress:    ${YELLOW}$in_progress_count${NC} tasks"
    echo -e "Pending:        ${YELLOW}$pending_count${NC} tasks (unassigned)"
    echo ""

    if [ "$assigned_count" -gt 0 ]; then
        echo -e "${CYAN}Assigned Tasks:${NC}"
        echo "$assigned" | jq -r '.[] | "  - [\(.id)] \(.title)"'
        echo ""
    fi

    if [ "$in_progress_count" -gt 0 ]; then
        echo -e "${CYAN}In Progress:${NC}"
        echo "$in_progress" | jq -r '.[] | "  - [\(.id)] \(.title)"'
        echo ""
    fi

    if [ "$pending_count" -gt 0 ]; then
        echo -e "${CYAN}Pending (Unassigned):${NC}"
        echo "$pending" | jq -r '.[] | "  - [\(.id)] \(.title)"'
    fi
}

# Watch for new tasks (SSE)
watch_sse() {
    log_info "Starting SSE watcher..."

    local manager_id=$(get_manager_id)
    if [ -z "$manager_id" ]; then
        log_error "No Manager agent registered, waiting..."
        sleep 5
        return
    fi

    log_info "Watching for tasks assigned to Manager: $manager_id"

    # Use curl to listen to SSE events
    curl -s -N -H "Authorization: Bearer $MCP_TOKEN" \
        "$MCP_SERVER_URL/events?token=$MCP_TOKEN" 2>/dev/null | \
    while IFS= read -r line; do
        # Skip empty lines and comments
        [[ -z "$line" || "$line" == :* ]] && continue

        # Parse SSE data
        if [[ "$line" == data:* ]]; then
            local data="${line#data:}"
            local event_type=$(echo "$data" | jq -r '.type // empty')

            case "$event_type" in
                task_assigned)
                    local assigned_to=$(echo "$data" | jq -r '.data.agentId // empty')
                    local task_id=$(echo "$data" | jq -r '.data.taskId // empty')

                    if [ "$assigned_to" == "$manager_id" ]; then
                        log_info "New task assigned to Manager: $task_id"

                        # Get task details
                        local task=$(curl -s -H "Authorization: Bearer $MCP_TOKEN" \
                            "$MCP_SERVER_URL/tasks/$task_id" | jq '.data')

                        notify_manager "New task assigned: $task_id" "$task"
                    fi
                    ;;
                task_created)
                    local task_title=$(echo "$data" | jq -r '.data.title // empty')
                    log_info "New task created: $task_title"
                    ;;
            esac
        fi
    done
}

# Polling-based watcher (fallback)
watch_poll() {
    log_info "Starting polling watcher (interval: ${POLL_INTERVAL}s)..."

    local last_task_ids=""

    while true; do
        local manager_id=$(get_manager_id)

        if [ -z "$manager_id" ]; then
            log_warn "No Manager agent registered, retrying in ${POLL_INTERVAL}s..."
            sleep "$POLL_INTERVAL"
            continue
        fi

        # Get current assigned tasks
        local tasks=$(get_manager_tasks "$manager_id" "assigned")
        local current_task_ids=$(echo "$tasks" | jq -r '.[].id' | sort | tr '\n' ' ')

        # Check for new tasks
        if [ "$current_task_ids" != "$last_task_ids" ] && [ -n "$current_task_ids" ]; then
            # Find new tasks
            for task_id in $current_task_ids; do
                if [[ ! " $last_task_ids " =~ " $task_id " ]]; then
                    log_info "New task detected: $task_id"

                    local task=$(echo "$tasks" | jq ".[] | select(.id == \"$task_id\")")
                    notify_manager "New task assigned: $task_id" "$task"
                fi
            done
        fi

        last_task_ids="$current_task_ids"
        sleep "$POLL_INTERVAL"
    done
}

# Start daemon
start_daemon() {
    local pid_file="/tmp/manager-watcher.pid"

    if [ -f "$pid_file" ] && kill -0 $(cat "$pid_file") 2>/dev/null; then
        log_warn "Daemon already running (PID: $(cat $pid_file))"
        return 1
    fi

    log_info "Starting Manager Watcher daemon..."

    nohup "$0" _watch > "$LOG_FILE" 2>&1 &
    echo $! > "$pid_file"

    sleep 1
    if kill -0 $(cat "$pid_file") 2>/dev/null; then
        log_info "Daemon started (PID: $(cat $pid_file))"
        echo -e "${GREEN}Manager Watcher daemon started${NC}"
        echo "PID: $(cat $pid_file)"
        echo "Log: $LOG_FILE"
    else
        log_error "Failed to start daemon"
        rm -f "$pid_file"
        return 1
    fi
}

stop_daemon() {
    local pid_file="/tmp/manager-watcher.pid"

    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
            rm -f "$pid_file"
            log_info "Daemon stopped (PID: $pid)"
            echo -e "${GREEN}Manager Watcher daemon stopped${NC}"
        else
            rm -f "$pid_file"
            echo "Daemon not running (stale PID file removed)"
        fi
    else
        echo "Daemon not running"
    fi
}

daemon_status() {
    local pid_file="/tmp/manager-watcher.pid"

    echo -e "${CYAN}Manager Watcher Status${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    if [ -f "$pid_file" ] && kill -0 $(cat "$pid_file") 2>/dev/null; then
        echo -e "Status: ${GREEN}Running${NC}"
        echo "PID: $(cat $pid_file)"
    else
        echo -e "Status: ${YELLOW}Stopped${NC}"
    fi

    echo "Server: $MCP_SERVER_URL"
    echo "Poll Interval: ${POLL_INTERVAL}s"
    echo "Log: $LOG_FILE"
    echo ""

    # Show last few log entries
    if [ -f "$LOG_FILE" ]; then
        echo -e "${CYAN}Recent logs:${NC}"
        tail -5 "$LOG_FILE" 2>/dev/null || echo "(empty)"
    fi
}

# Internal watch command (used by daemon)
_watch() {
    log_info "Manager Watcher started"

    # Try SSE first, fall back to polling
    while true; do
        watch_sse || true
        log_warn "SSE connection lost, falling back to polling..."

        # Polling fallback
        for i in {1..6}; do
            watch_poll &
            poll_pid=$!
            sleep 60
            kill $poll_pid 2>/dev/null || true

            # Try SSE again
            break
        done
    done
}

# Main
case "${1:-help}" in
    start)
        watch_poll
        ;;
    daemon)
        start_daemon
        ;;
    stop)
        stop_daemon
        ;;
    status)
        daemon_status
        ;;
    check)
        check_tasks
        ;;
    _watch)
        _watch
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
