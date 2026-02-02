#!/bin/bash
#===============================================================================
# VOW Multi-Agent Launcher
# Manages 10-20 parallel Claude agents for VOW project development
#===============================================================================

set -e

VOW_DIR="/home/ubuntu/Downloads/vow"
MCP_DIR="/home/ubuntu/mcp-multi-agent"
SESSION_NAME="vow-multi-agent"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_header() {
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  $1${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
}

print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_warning() { echo -e "${YELLOW}! $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }
print_info() { echo -e "${CYAN}→ $1${NC}"; }

show_help() {
    cat << 'EOF'
VOW Multi-Agent Development Environment

Usage: ./multi-agent-launcher.sh <command> [options]

Commands:
    start [n]           Start environment with n agents (default: 4, max: 20)
    stop                Stop all agents and server
    status              Check status of server and agents

    server-start        Start task distribution server only
    server-stop         Stop task distribution server

    connect             Connect to existing tmux session

    remote-info         Show info for connecting from remote machines

    help                Show this help message

Examples:
    ./multi-agent-launcher.sh start 10      # Start with 10 agents
    ./multi-agent-launcher.sh status        # Check status
    ./multi-agent-launcher.sh remote-info   # Get remote connection info

VOW Project-Specific Agent Roles:
    0: Manager      - Coordinates tasks across all agents
    1-3: Frontend   - React/Next.js components, hooks
    4-5: Backend    - TypeScript Lambda, services
    6-7: Test       - Jest tests, property tests
    8: Spec         - KIRO spec management
    9: DevOps       - Deployment, infrastructure
    10+: General    - Flexible assignment

Environment:
    Server URL:     http://192.168.2.126:3456
    MCP Config:     /home/ubuntu/mcp-multi-agent/mcp-config.json
    VOW Project:    /home/ubuntu/Downloads/vow
EOF
}

ensure_server() {
    source "$MCP_DIR/config/server.env" 2>/dev/null || true

    if ! pgrep -f "node.*server.js" > /dev/null; then
        print_info "Starting task distribution server..."
        cd "$MCP_DIR/mcp-task-distributor"
        nohup node build/server.js > "$MCP_DIR/logs/server.log" 2>&1 &
        sleep 2

        if pgrep -f "node.*server.js" > /dev/null; then
            print_success "Server started on port 3456"
        else
            print_error "Failed to start server"
            exit 1
        fi
    else
        print_success "Server already running"
    fi
}

start_environment() {
    local NUM_AGENTS=${1:-4}

    if [[ $NUM_AGENTS -lt 1 ]] || [[ $NUM_AGENTS -gt 20 ]]; then
        print_error "Number of agents must be between 1 and 20"
        exit 1
    fi

    print_header "VOW Multi-Agent Environment ($NUM_AGENTS agents)"

    # Ensure server is running
    ensure_server

    # Source config
    source "$MCP_DIR/config/server.env"

    # Check if session exists
    if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
        print_warning "Session '$SESSION_NAME' already exists"
        echo "Options:"
        echo "  Connect: $0 connect"
        echo "  Stop:    $0 stop"
        exit 1
    fi

    # Create tmux session
    tmux new-session -d -s "$SESSION_NAME" -n "agents"

    # Calculate grid layout
    if [[ $NUM_AGENTS -le 4 ]]; then
        COLS=2
    elif [[ $NUM_AGENTS -le 9 ]]; then
        COLS=3
    elif [[ $NUM_AGENTS -le 16 ]]; then
        COLS=4
    else
        COLS=5
    fi

    # Create panes
    for ((i=1; i<NUM_AGENTS; i++)); do
        if (( i % COLS == 0 )); then
            ROW_START=$(( (i / COLS - 1) * COLS ))
            tmux split-window -v -t "$SESSION_NAME:agents.$ROW_START"
        else
            PREV=$((i - 1))
            tmux split-window -h -t "$SESSION_NAME:agents.$PREV"
        fi
        tmux select-layout -t "$SESSION_NAME:agents" tiled
    done

    tmux select-layout -t "$SESSION_NAME:agents" tiled

    # VOW-specific agent configuration
    for ((i=0; i<NUM_AGENTS; i++)); do
        local ROLE NAME WORK_DIR

        case $i in
            0) ROLE="manager"; NAME="Manager"; WORK_DIR="$VOW_DIR" ;;
            1) ROLE="developer"; NAME="Frontend-1"; WORK_DIR="$VOW_DIR/frontend" ;;
            2) ROLE="developer"; NAME="Frontend-2"; WORK_DIR="$VOW_DIR/frontend" ;;
            3) ROLE="developer"; NAME="Frontend-3"; WORK_DIR="$VOW_DIR/frontend" ;;
            4) ROLE="developer"; NAME="Backend-1"; WORK_DIR="$VOW_DIR/backend" ;;
            5) ROLE="developer"; NAME="Backend-2"; WORK_DIR="$VOW_DIR/backend" ;;
            6) ROLE="tester"; NAME="Tester-1"; WORK_DIR="$VOW_DIR" ;;
            7) ROLE="tester"; NAME="Tester-2"; WORK_DIR="$VOW_DIR" ;;
            8) ROLE="documenter"; NAME="Spec"; WORK_DIR="$VOW_DIR/.kiro/specs" ;;
            9) ROLE="devops"; NAME="DevOps"; WORK_DIR="$VOW_DIR/infra" ;;
            10) ROLE="architect"; NAME="Architect"; WORK_DIR="$VOW_DIR" ;;
            11) ROLE="reviewer"; NAME="Reviewer"; WORK_DIR="$VOW_DIR" ;;
            *) ROLE="general"; NAME="Agent-$i"; WORK_DIR="$VOW_DIR" ;;
        esac

        # Set pane title
        tmux select-pane -t "$SESSION_NAME:agents.$i" -T "$NAME ($ROLE)"

        # Setup environment
        tmux send-keys -t "$SESSION_NAME:agents.$i" "cd $WORK_DIR" Enter
        tmux send-keys -t "$SESSION_NAME:agents.$i" "export TASK_SERVER_URL=$TASK_SERVER_URL" Enter
        tmux send-keys -t "$SESSION_NAME:agents.$i" "export TASK_SERVER_TOKEN=$TASK_SERVER_TOKEN" Enter
        tmux send-keys -t "$SESSION_NAME:agents.$i" "export AGENT_NAME='$NAME'" Enter
        tmux send-keys -t "$SESSION_NAME:agents.$i" "export AGENT_ROLE='$ROLE'" Enter
        tmux send-keys -t "$SESSION_NAME:agents.$i" "export MACHINE_ID='$(hostname)'" Enter
        tmux send-keys -t "$SESSION_NAME:agents.$i" "echo '══════════════════════════════════════'" Enter
        tmux send-keys -t "$SESSION_NAME:agents.$i" "echo '  $NAME ($ROLE)'" Enter
        tmux send-keys -t "$SESSION_NAME:agents.$i" "echo '  Dir: $WORK_DIR'" Enter
        tmux send-keys -t "$SESSION_NAME:agents.$i" "echo '══════════════════════════════════════'" Enter
        tmux send-keys -t "$SESSION_NAME:agents.$i" "echo 'To start: claude --mcp-config $MCP_DIR/mcp-config.json'" Enter
    done

    # Enable pane borders
    tmux set-option -t "$SESSION_NAME" pane-border-status top
    tmux set-option -t "$SESSION_NAME" pane-border-format " #{pane_title} "

    # Select first pane
    tmux select-pane -t "$SESSION_NAME:agents.0"

    print_success "Environment created with $NUM_AGENTS agents"
    echo ""
    echo "Server:   $TASK_SERVER_URL"
    echo "Token:    ${TASK_SERVER_TOKEN:0:20}..."
    echo ""
    echo "To connect: tmux attach -t $SESSION_NAME"
    echo ""
    echo "In each pane, start Claude with:"
    echo "  claude --mcp-config $MCP_DIR/mcp-config.json"
}

stop_environment() {
    print_header "Stopping VOW Multi-Agent Environment"

    # Kill tmux session
    if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
        tmux kill-session -t "$SESSION_NAME"
        print_success "Tmux session stopped"
    else
        print_warning "Tmux session not running"
    fi

    # Stop server
    if pgrep -f "node.*server.js" > /dev/null; then
        pkill -f "node.*server.js"
        print_success "Server stopped"
    else
        print_warning "Server not running"
    fi
}

show_status() {
    print_header "VOW Multi-Agent Status"

    echo ""
    echo "=== Server ==="
    if pgrep -f "node.*server.js" > /dev/null; then
        print_success "Task server: Running"
        HEALTH=$(curl -s http://localhost:3456/health 2>/dev/null)
        if [[ -n "$HEALTH" ]]; then
            echo "$HEALTH" | jq -r '.data | "  Agents: \(.agents), Tasks: \(.tasks)"' 2>/dev/null || echo "  $HEALTH"
        fi
    else
        print_error "Task server: Stopped"
    fi

    echo ""
    echo "=== Tmux Session ==="
    if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
        print_success "Session '$SESSION_NAME': Running"
        PANE_COUNT=$(tmux list-panes -t "$SESSION_NAME:agents" 2>/dev/null | wc -l)
        echo "  Panes: $PANE_COUNT"
    else
        print_warning "Session '$SESSION_NAME': Not running"
    fi

    echo ""
    echo "=== Configuration ==="
    if [[ -f "$MCP_DIR/config/server.env" ]]; then
        source "$MCP_DIR/config/server.env"
        echo "  URL:   $TASK_SERVER_URL"
        echo "  Token: ${TASK_SERVER_TOKEN:0:20}..."
    fi
}

show_remote_info() {
    print_header "Remote Machine Connection Info"

    source "$MCP_DIR/config/server.env" 2>/dev/null || true
    LOCAL_IP=$(hostname -I | awk '{print $1}')

    echo ""
    echo "=== Server Info ==="
    echo "  Host IP: $LOCAL_IP"
    echo "  Port: 3456"
    echo "  URL: http://$LOCAL_IP:3456"
    echo "  Token: $TASK_SERVER_TOKEN"
    echo ""
    echo "=== Remote Machine Setup ==="
    echo ""
    echo "1. Copy MCP config to remote machine:"
    echo "   scp $MCP_DIR/mcp-config.json remote:/path/to/"
    echo ""
    echo "2. On remote machine, set environment:"
    cat << EOF
   export TASK_SERVER_URL=http://$LOCAL_IP:3456
   export TASK_SERVER_TOKEN=$TASK_SERVER_TOKEN
   export AGENT_NAME="Remote-Agent-1"
   export AGENT_ROLE="developer"
   export MACHINE_ID="remote-machine"
EOF
    echo ""
    echo "3. Test connection:"
    echo "   curl -H \"Authorization: Bearer \$TASK_SERVER_TOKEN\" \$TASK_SERVER_URL/health"
    echo ""
    echo "4. Start Claude:"
    echo "   claude --mcp-config /path/to/mcp-config.json"
    echo ""
}

#===============================================================================
# Main
#===============================================================================

case "${1:-help}" in
    start)
        start_environment "${2:-4}"
        ;;
    stop)
        stop_environment
        ;;
    status)
        show_status
        ;;
    server-start)
        ensure_server
        ;;
    server-stop)
        pkill -f "node.*server.js" && print_success "Server stopped" || print_warning "Server not running"
        ;;
    connect)
        tmux attach -t "$SESSION_NAME" || print_error "Session not found"
        ;;
    remote-info)
        show_remote_info
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
