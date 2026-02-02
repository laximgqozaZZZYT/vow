#!/bin/bash
#===============================================================================
# Auto Agent Spawner
# Automatically spawns Claude Code agents for pending tasks
# Agents exit after completing their assigned task
#===============================================================================

set -e

# Configuration
MCP_SERVER_URL="${TASK_SERVER_URL:-http://localhost:3456}"
MCP_TOKEN="${TASK_SERVER_TOKEN:-mcp-2583b09967362d705553582c115c81b4}"
MCP_CONFIG="/home/ubuntu/mcp-multi-agent/mcp-config.json"
VOW_DIR="/home/ubuntu/Downloads/vow"
LOG_DIR="/home/ubuntu/mcp-multi-agent/logs"
POLL_INTERVAL="${POLL_INTERVAL:-5}"
MAX_CONCURRENT_AGENTS="${MAX_CONCURRENT_AGENTS:-5}"
AGENT_TIMEOUT="${AGENT_TIMEOUT:-900}"  # 15 minutes default

# Session prefix for spawned agents
SESSION_PREFIX="vow-auto-agent"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/auto-spawner.log"
PID_FILE="/tmp/auto-agent-spawner.pid"
ACTIVE_AGENTS_FILE="/tmp/auto-agents-active.json"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_info() { log "INFO: $1"; }
log_warn() { log "WARN: $1"; }
log_error() { log "ERROR: $1"; }
log_success() { log "SUCCESS: $1"; }

show_help() {
    cat << 'EOF'
Auto Agent Spawner - Automatically spawns Claude agents for pending tasks

Usage: ./auto-agent-spawner.sh <command> [options]

Commands:
    start               Start spawner daemon
    stop                Stop spawner daemon
    status              Show status and active agents
    spawn <task_id>     Manually spawn agent for specific task
    cleanup             Clean up stale auto-spawned sessions
    cleanup-all [mins]  Clean up ALL stale agents (default: 60 mins)
    test                Test spawn a simple agent
    help                Show this help

Environment Variables:
    TASK_SERVER_URL         MCP server URL (default: http://localhost:3456)
    TASK_SERVER_TOKEN       Auth token
    MAX_CONCURRENT_AGENTS   Max parallel agents (default: 5)
    AGENT_TIMEOUT           Timeout per task in seconds (default: 300)
    POLL_INTERVAL           Check interval in seconds (default: 5)

How it works:
    1. Monitors MCP server for pending/assigned tasks
    2. Spawns Claude Code in tmux sessions for each task
    3. Agent claims task, works on it, submits result
    4. Agent session is cleaned up after completion

Examples:
    ./auto-agent-spawner.sh start      # Start daemon
    ./auto-agent-spawner.sh status     # Check active agents
    ./auto-agent-spawner.sh cleanup    # Remove stale sessions
EOF
}

# Initialize active agents tracking
init_active_agents() {
    if [ ! -f "$ACTIVE_AGENTS_FILE" ]; then
        echo '{}' > "$ACTIVE_AGENTS_FILE"
    fi
}

# Get active agent count
get_active_count() {
    jq 'length' "$ACTIVE_AGENTS_FILE" 2>/dev/null || echo "0"
}

# Add agent to tracking
track_agent() {
    local task_id=$1
    local session_name=$2
    local pid=$3

    local tmp=$(mktemp)
    jq --arg tid "$task_id" --arg sess "$session_name" --arg pid "$pid" \
        '. + {($tid): {"session": $sess, "pid": $pid, "started": now | todate}}' \
        "$ACTIVE_AGENTS_FILE" > "$tmp" && mv "$tmp" "$ACTIVE_AGENTS_FILE"
}

# Remove agent from tracking
untrack_agent() {
    local task_id=$1
    local tmp=$(mktemp)
    jq --arg tid "$task_id" 'del(.[$tid])' "$ACTIVE_AGENTS_FILE" > "$tmp" && mv "$tmp" "$ACTIVE_AGENTS_FILE"
}

# Unregister agent from MCP server by ID
unregister_agent_by_id() {
    local agent_id=$1
    curl -s -X DELETE -H "Authorization: Bearer $MCP_TOKEN" \
        "$MCP_SERVER_URL/agents/$agent_id" 2>/dev/null
    log_info "Unregistered agent: $agent_id"
}

# Find and unregister auto-spawned agents for a task
unregister_agents_for_task() {
    local task_id=$1
    local task_prefix="${task_id:0:8}"

    # Get all agents and find ones matching this task
    local agents=$(curl -s -H "Authorization: Bearer $MCP_TOKEN" "$MCP_SERVER_URL/agents" 2>/dev/null)

    # Find agents with names containing the task prefix
    echo "$agents" | jq -r ".data[] | select(.name | contains(\"$task_prefix\")) | .id" 2>/dev/null | while read agent_id; do
        if [ -n "$agent_id" ]; then
            unregister_agent_by_id "$agent_id"
        fi
    done
}

# Clean up all stale auto-spawned agents from server
cleanup_stale_agents() {
    log_info "Cleaning up stale auto-spawned agents..."

    # Get all agents
    local agents=$(curl -s -H "Authorization: Bearer $MCP_TOKEN" "$MCP_SERVER_URL/agents" 2>/dev/null)

    # Find auto-spawned agents (name starts with "Auto-")
    local auto_agents=$(echo "$agents" | jq -r '.data[] | select(.name | startswith("Auto-")) | .id' 2>/dev/null)

    local count=0
    for agent_id in $auto_agents; do
        if [ -n "$agent_id" ]; then
            unregister_agent_by_id "$agent_id"
            ((count++)) || true
        fi
    done

    log_info "Cleaned up $count stale auto-spawned agents"
}

# Clean up ALL agents with stale heartbeats (older than threshold)
cleanup_all_stale_agents() {
    local threshold_minutes=${1:-60}  # Default: 1 hour
    local server_url="${MCP_SERVER_URL:-http://localhost:3456}"
    local token="${MCP_TOKEN:-mcp-2583b09967362d705553582c115c81b4}"

    echo "Cleaning up all agents with heartbeat older than ${threshold_minutes} minutes..."
    echo "Server: $server_url"

    # Get all agents
    local agents_json
    agents_json=$(curl -s -H "Authorization: Bearer $token" "$server_url/agents" 2>/dev/null)

    if [ -z "$agents_json" ] || ! echo "$agents_json" | jq -e '.success' >/dev/null 2>&1; then
        echo "Error: Failed to fetch agents from server"
        return 1
    fi

    local now=$(date +%s)
    local threshold_seconds=$((threshold_minutes * 60))
    local count=0

    # Process each agent
    local agent_ids
    agent_ids=$(echo "$agents_json" | jq -r '.data[].id' 2>/dev/null)

    if [ -z "$agent_ids" ]; then
        echo "No agents found on server"
        return 0
    fi

    for agent_id in $agent_ids; do
        local agent_data
        agent_data=$(echo "$agents_json" | jq -r ".data[] | select(.id == \"$agent_id\")" 2>/dev/null)
        local name=$(echo "$agent_data" | jq -r '.name // "unknown"')
        local heartbeat=$(echo "$agent_data" | jq -r '.lastHeartbeat // ""')

        if [ -n "$heartbeat" ] && [ "$heartbeat" != "null" ]; then
            # Convert ISO 8601 heartbeat to epoch
            local heartbeat_epoch
            heartbeat_epoch=$(date -d "$heartbeat" +%s 2>/dev/null || echo "0")
            local age=$((now - heartbeat_epoch))

            if [ "$age" -gt "$threshold_seconds" ]; then
                echo "  Removing: $name (last heartbeat: $((age / 60)) mins ago)"
                curl -s -X DELETE -H "Authorization: Bearer $token" \
                    "$server_url/agents/$agent_id" >/dev/null 2>&1
                count=$((count + 1))
            else
                echo "  Active: $name (last heartbeat: $((age / 60)) mins ago)"
            fi
        fi
    done

    echo ""
    echo "Cleaned up $count stale agents"
}

# Check if task already has an active agent
has_active_agent() {
    local task_id=$1
    jq -e --arg tid "$task_id" '.[$tid]' "$ACTIVE_AGENTS_FILE" > /dev/null 2>&1
}

# Get pending tasks that need agents
get_tasks_needing_agents() {
    # Get tasks that are pending or assigned but not in_progress
    local tasks=$(curl -s -H "Authorization: Bearer $MCP_TOKEN" "$MCP_SERVER_URL/tasks" 2>/dev/null)
    echo "$tasks" | jq -r '.data // [] | .[] | select(.status == "pending" or .status == "assigned") | .id' 2>/dev/null
}

# Get task details
get_task() {
    local task_id=$1
    curl -s -H "Authorization: Bearer $MCP_TOKEN" "$MCP_SERVER_URL/tasks/$task_id" 2>/dev/null | jq '.data'
}

# Get role for task based on tags or content
determine_agent_role() {
    local task_json=$1
    local tags=$(echo "$task_json" | jq -r '.tags // [] | join(" ")')
    local title=$(echo "$task_json" | jq -r '.title // ""' | tr '[:upper:]' '[:lower:]')
    local desc=$(echo "$task_json" | jq -r '.description // ""' | tr '[:upper:]' '[:lower:]')

    # Check tags first
    if [[ "$tags" =~ "frontend" ]] || [[ "$tags" =~ "react" ]] || [[ "$tags" =~ "ui" ]]; then
        echo "developer"
    elif [[ "$tags" =~ "backend" ]] || [[ "$tags" =~ "api" ]] || [[ "$tags" =~ "lambda" ]]; then
        echo "developer"
    elif [[ "$tags" =~ "test" ]] || [[ "$tags" =~ "jest" ]]; then
        echo "tester"
    elif [[ "$tags" =~ "review" ]]; then
        echo "reviewer"
    elif [[ "$tags" =~ "spec" ]] || [[ "$tags" =~ "design" ]]; then
        echo "architect"
    # Check content
    elif [[ "$title$desc" =~ "テスト" ]] || [[ "$title$desc" =~ "test" ]]; then
        echo "tester"
    elif [[ "$title$desc" =~ "レビュー" ]] || [[ "$title$desc" =~ "review" ]]; then
        echo "reviewer"
    else
        echo "developer"
    fi
}

# Generate unique agent name
generate_agent_name() {
    local role=$1
    local task_id=$2
    echo "Auto-${role^}-${task_id:0:8}"
}

# Get role-specific instructions
get_role_instructions() {
    local role=$1
    case "$role" in
        developer)
            cat << 'ROLE_EOF'
【Developer向けガイドライン】
- React 19 + Next.js 16 + TypeScript + Tailwind CSS 4 を使用
- コンポーネント命名規則: Modal.*.tsx, Section.*.tsx, Widget.*.tsx, Form.*.tsx
- 必ず既存コードを読んでパターンを理解してから修正
- 型定義は types/ ディレクトリを確認
- フックは hooks/ ディレクトリに配置
- テストは __tests__/ に配置（Jest使用）
ROLE_EOF
            ;;
        tester)
            cat << 'ROLE_EOF'
【Tester向けガイドライン】
- Jest + React Testing Library を使用
- テストファイルは *.test.ts, *.test.tsx
- プロパティベーステストには fast-check を使用
- カバレッジを意識したテスト作成
- エッジケースと境界値を重点的にテスト
ROLE_EOF
            ;;
        reviewer)
            cat << 'ROLE_EOF'
【Reviewer向けガイドライン】
- コードの品質、可読性、保守性を評価
- セキュリティ問題（XSS, インジェクション等）をチェック
- パフォーマンス問題を指摘
- ベストプラクティスからの逸脱を報告
- 具体的な改善提案を含める
ROLE_EOF
            ;;
        architect)
            cat << 'ROLE_EOF'
【Architect向けガイドライン】
- システム設計とアーキテクチャを担当
- .kiro/specs/ のSPEC形式に従う
- 技術選定の根拠を明確に
- スケーラビリティと保守性を考慮
- 依存関係と影響範囲を分析
ROLE_EOF
            ;;
        *)
            cat << 'ROLE_EOF'
【一般ガイドライン】
- 既存コードのパターンに従う
- 変更は最小限に
- 不明点は推測せずコードを確認
ROLE_EOF
            ;;
    esac
}

# Create the agent prompt
create_agent_prompt() {
    local task_id=$1
    local task_json=$2
    local role=$3
    local agent_name=$4

    local title=$(echo "$task_json" | jq -r '.title // "Untitled"')
    local description=$(echo "$task_json" | jq -r '.description // ""')
    local tags=$(echo "$task_json" | jq -r '.tags // [] | join(", ")')
    local priority=$(echo "$task_json" | jq -r '.priority // "normal"')

    # Get role-specific instructions
    local role_instructions=$(get_role_instructions "$role")

    cat << EOF
あなたはVOWプロジェクト専用の自動エージェントです。タスクを確実に遂行してください。

═══════════════════════════════════════════════════════════════
エージェント情報
═══════════════════════════════════════════════════════════════
名前: $agent_name
ロール: $role
タスクID: $task_id

═══════════════════════════════════════════════════════════════
タスク詳細
═══════════════════════════════════════════════════════════════
タイトル: $title
優先度: $priority
タグ: $tags

説明:
$description

═══════════════════════════════════════════════════════════════
プロジェクト情報 (VOW - 習慣・目標トラッカー)
═══════════════════════════════════════════════════════════════
【技術スタック】
- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS 4
- Backend: TypeScript Lambda, Express
- Database: Supabase (PostgreSQL)
- Infrastructure: AWS (Amplify, Lambda, API Gateway)

【ディレクトリ構造】
/home/ubuntu/Downloads/vow/
├── frontend/                 # Next.jsアプリケーション
│   ├── app/dashboard/        # メインダッシュボード
│   │   ├── components/       # UIコンポーネント
│   │   ├── hooks/            # カスタムフック
│   │   └── types/            # 型定義
│   └── lib/                  # 共通ユーティリティ
├── backend/                  # Lambdaバックエンド
│   └── src/
│       ├── routers/          # APIルート
│       ├── services/         # ビジネスロジック
│       └── repositories/     # データアクセス
└── .kiro/specs/              # 機能仕様書

$role_instructions

═══════════════════════════════════════════════════════════════
実行手順 (この順序で実行してください)
═══════════════════════════════════════════════════════════════

【ステップ1: タスク開始】
claim_task MCPツールを呼び出し:
- taskId: "$task_id"

【ステップ2: タスク実行】
1. まず関連ファイルを読んで現状を理解する
2. 必要な変更を計画する
3. 変更を実装する
4. 変更が正しいことを確認する

【ステップ3: 結果報告】
submit_result MCPツールを呼び出し:
- taskId: "$task_id"
- result: 実行内容の詳細な要約（変更したファイル、行った修正、確認結果など）

※ エージェント登録は自動で行われます。register_agentを呼ぶ必要はありません。

═══════════════════════════════════════════════════════════════
重要な注意事項
═══════════════════════════════════════════════════════════════
- コードを変更する前に必ず既存コードを読む
- 推測で動かない。わからないことはファイルを読んで確認する
- 変更は最小限に。不要な変更を加えない
- エラーが発生したら原因を調査し、解決を試みる
- 解決できない場合は、何を試したかを含めてsubmit_resultで報告

では、ステップ1のclaim_taskから開始してください。
EOF
}

# Spawn an agent for a task
spawn_agent() {
    local task_id=$1

    # Check if already has agent
    if has_active_agent "$task_id"; then
        log_warn "Task $task_id already has an active agent"
        return 1
    fi

    # Check concurrent limit
    local active=$(get_active_count)
    if [ "$active" -ge "$MAX_CONCURRENT_AGENTS" ]; then
        log_warn "Max concurrent agents reached ($MAX_CONCURRENT_AGENTS)"
        return 1
    fi

    # Get task details
    local task_json=$(get_task "$task_id")
    if [ -z "$task_json" ] || [ "$task_json" == "null" ]; then
        log_error "Failed to get task: $task_id"
        return 1
    fi

    local role=$(determine_agent_role "$task_json")
    local agent_name=$(generate_agent_name "$role" "$task_id")
    local session_name="${SESSION_PREFIX}-${task_id:0:8}"

    log_info "Spawning agent '$agent_name' for task $task_id (role: $role)"

    # Create prompt file
    local prompt_file="/tmp/agent-prompt-${task_id}.txt"
    create_agent_prompt "$task_id" "$task_json" "$role" "$agent_name" > "$prompt_file"

    # Determine working directory based on role
    local work_dir="$VOW_DIR"
    case "$role" in
        developer)
            # Check if frontend or backend task
            local desc=$(echo "$task_json" | jq -r '.description // ""')
            if [[ "$desc" =~ "frontend" ]] || [[ "$desc" =~ "React" ]]; then
                work_dir="$VOW_DIR/frontend"
            elif [[ "$desc" =~ "backend" ]] || [[ "$desc" =~ "Lambda" ]]; then
                work_dir="$VOW_DIR/backend"
            fi
            ;;
    esac

    # Create tmux session and run Claude
    tmux new-session -d -s "$session_name" -c "$work_dir"

    # Set environment variables
    tmux send-keys -t "$session_name" "export TASK_SERVER_URL='$MCP_SERVER_URL'" Enter
    tmux send-keys -t "$session_name" "export TASK_SERVER_TOKEN='$MCP_TOKEN'" Enter
    tmux send-keys -t "$session_name" "export AGENT_NAME='$agent_name'" Enter
    tmux send-keys -t "$session_name" "export AGENT_ROLE='$role'" Enter
    sleep 0.5

    # Start Claude with the prompt
    # Run Claude with automated permission acceptance
    # yes 2 | head -1 sends "2" to accept the bypass permissions warning
    # Then the prompt file is sent as the actual task
    # --dangerously-skip-permissions allows all operations without confirmation
    # -p mode prints response and exits
    tmux send-keys -t "$session_name" "{ yes 2 | head -1; cat '$prompt_file'; } | claude --mcp-config '$MCP_CONFIG' --dangerously-skip-permissions -p 2>&1 | tee /tmp/agent-output-${task_id}.log" Enter

    # Track the agent
    track_agent "$task_id" "$session_name" "$$"

    log_success "Agent spawned: $agent_name (session: $session_name)"

    # Start monitor in background
    monitor_agent "$task_id" "$session_name" &

    return 0
}

# Monitor agent and clean up when done
monitor_agent() {
    local task_id=$1
    local session_name=$2
    local start_time=$(date +%s)

    while true; do
        # Check if session still exists
        if ! tmux has-session -t "$session_name" 2>/dev/null; then
            log_info "Agent session $session_name ended"
            unregister_agents_for_task "$task_id"
            untrack_agent "$task_id"
            rm -f "/tmp/agent-prompt-${task_id}.txt" "/tmp/agent-output-${task_id}.log"
            return 0
        fi

        # Check timeout
        local now=$(date +%s)
        local elapsed=$((now - start_time))
        if [ "$elapsed" -ge "$AGENT_TIMEOUT" ]; then
            log_warn "Agent timeout for task $task_id (${elapsed}s)"
            tmux kill-session -t "$session_name" 2>/dev/null || true
            unregister_agents_for_task "$task_id"
            untrack_agent "$task_id"
            rm -f "/tmp/agent-prompt-${task_id}.txt" "/tmp/agent-output-${task_id}.log"
            return 1
        fi

        # Check if task is completed
        local task_status=$(curl -s -H "Authorization: Bearer $MCP_TOKEN" \
            "$MCP_SERVER_URL/tasks/$task_id" 2>/dev/null | jq -r '.data.status // "unknown"')

        if [ "$task_status" == "completed" ] || [ "$task_status" == "failed" ]; then
            log_info "Task $task_id finished with status: $task_status"
            sleep 3  # Give agent time to clean up
            tmux kill-session -t "$session_name" 2>/dev/null || true
            unregister_agents_for_task "$task_id"
            untrack_agent "$task_id"
            rm -f "/tmp/agent-prompt-${task_id}.txt" "/tmp/agent-output-${task_id}.log"
            return 0
        fi

        sleep 10
    done
}

# Main daemon loop
daemon_loop() {
    log_info "Auto Agent Spawner started"
    init_active_agents

    while true; do
        # Clean up finished agents first
        cleanup_finished_agents

        # Get tasks needing agents
        local tasks=$(get_tasks_needing_agents)

        for task_id in $tasks; do
            if ! has_active_agent "$task_id"; then
                log_info "Found task needing agent: $task_id"
                spawn_agent "$task_id" || true
                sleep 2  # Brief pause between spawns
            fi
        done

        sleep "$POLL_INTERVAL"
    done
}

# Clean up agents for finished tasks
cleanup_finished_agents() {
    local tracked=$(jq -r 'keys[]' "$ACTIVE_AGENTS_FILE" 2>/dev/null)

    for task_id in $tracked; do
        local session=$(jq -r --arg tid "$task_id" '.[$tid].session // ""' "$ACTIVE_AGENTS_FILE")

        # Check if session still exists
        if [ -n "$session" ] && ! tmux has-session -t "$session" 2>/dev/null; then
            log_info "Cleaning up stale tracking for task $task_id"
            untrack_agent "$task_id"
        fi

        # Check if task is done
        local status=$(curl -s -H "Authorization: Bearer $MCP_TOKEN" \
            "$MCP_SERVER_URL/tasks/$task_id" 2>/dev/null | jq -r '.data.status // "unknown"')

        if [ "$status" == "completed" ] || [ "$status" == "failed" ]; then
            if [ -n "$session" ] && tmux has-session -t "$session" 2>/dev/null; then
                log_info "Killing session for completed task $task_id"
                tmux kill-session -t "$session" 2>/dev/null || true
            fi
            untrack_agent "$task_id"
        fi
    done
}

# Start daemon
start_daemon() {
    if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
        log_warn "Daemon already running (PID: $(cat $PID_FILE))"
        return 1
    fi

    log_info "Starting Auto Agent Spawner daemon..."
    init_active_agents

    nohup "$0" _daemon > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"

    sleep 1
    if kill -0 $(cat "$PID_FILE") 2>/dev/null; then
        echo -e "${GREEN}Auto Agent Spawner started${NC}"
        echo "PID: $(cat $PID_FILE)"
        echo "Log: $LOG_FILE"
        echo ""
        echo "Agents will automatically spawn for pending tasks."
        echo "Max concurrent: $MAX_CONCURRENT_AGENTS"
        echo "Timeout per task: ${AGENT_TIMEOUT}s"
    else
        log_error "Failed to start daemon"
        rm -f "$PID_FILE"
        return 1
    fi
}

# Stop daemon
stop_daemon() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
            rm -f "$PID_FILE"
            echo -e "${GREEN}Auto Agent Spawner stopped${NC}"

            # Also stop all spawned agent sessions
            for session in $(tmux list-sessions -F '#{session_name}' 2>/dev/null | grep "^$SESSION_PREFIX"); do
                tmux kill-session -t "$session" 2>/dev/null || true
            done
            echo '{}' > "$ACTIVE_AGENTS_FILE"
        else
            rm -f "$PID_FILE"
            echo "Daemon not running (stale PID file removed)"
        fi
    else
        echo "Daemon not running"
    fi
}

# Show status
show_status() {
    echo -e "${CYAN}Auto Agent Spawner Status${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Daemon status
    if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
        echo -e "Daemon:     ${GREEN}Running${NC} (PID: $(cat $PID_FILE))"
    else
        echo -e "Daemon:     ${YELLOW}Stopped${NC}"
    fi

    echo "Server:     $MCP_SERVER_URL"
    echo "Max agents: $MAX_CONCURRENT_AGENTS"
    echo "Timeout:    ${AGENT_TIMEOUT}s"
    echo ""

    # Active agents
    echo -e "${CYAN}Active Agents:${NC}"
    if [ -f "$ACTIVE_AGENTS_FILE" ]; then
        local count=$(get_active_count)
        if [ "$count" -gt 0 ]; then
            jq -r 'to_entries[] | "  [\(.key)] \(.value.session) - started: \(.value.started)"' "$ACTIVE_AGENTS_FILE"
        else
            echo "  (none)"
        fi
    else
        echo "  (none)"
    fi
    echo ""

    # Tmux sessions
    echo -e "${CYAN}Agent Sessions:${NC}"
    local sessions=$(tmux list-sessions -F '#{session_name}' 2>/dev/null | grep "^$SESSION_PREFIX" || true)
    if [ -n "$sessions" ]; then
        echo "$sessions" | while read session; do
            echo "  - $session"
        done
    else
        echo "  (none)"
    fi
    echo ""

    # Recent logs
    echo -e "${CYAN}Recent Logs:${NC}"
    if [ -f "$LOG_FILE" ]; then
        tail -5 "$LOG_FILE" 2>/dev/null || echo "  (empty)"
    else
        echo "  (no log file)"
    fi
}

# Cleanup stale sessions and agents
cleanup_sessions() {
    echo "Cleaning up stale agent sessions and registrations..."

    # Kill tmux sessions
    for session in $(tmux list-sessions -F '#{session_name}' 2>/dev/null | grep "^$SESSION_PREFIX"); do
        echo "Killing session: $session"
        tmux kill-session -t "$session" 2>/dev/null || true
    done

    # Clean up stale agent registrations from server
    cleanup_stale_agents

    # Reset tracking file
    echo '{}' > "$ACTIVE_AGENTS_FILE"

    # Clean up temp files
    rm -f /tmp/agent-prompt-*.txt /tmp/agent-output-*.log

    echo -e "${GREEN}Cleanup complete${NC}"
}

# Test spawn
test_spawn() {
    echo "Creating test task..."

    local result=$(curl -s -X POST -H "Authorization: Bearer $MCP_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "title": "Test task - auto spawn verification",
            "description": "This is a test task to verify the auto-spawn system. Simply report success.",
            "priority": "normal",
            "tags": ["test", "auto-spawn-verification"]
        }' \
        "$MCP_SERVER_URL/tasks")

    local task_id=$(echo "$result" | jq -r '.data.id // empty')

    if [ -n "$task_id" ]; then
        echo -e "${GREEN}Test task created: $task_id${NC}"
        echo "Spawning agent..."
        spawn_agent "$task_id"
        echo ""
        echo "Check status with: ./auto-agent-spawner.sh status"
        echo "View session with: tmux attach -t ${SESSION_PREFIX}-${task_id:0:8}"
    else
        echo -e "${RED}Failed to create test task${NC}"
        echo "$result"
    fi
}

# Main
case "${1:-help}" in
    start)
        start_daemon
        ;;
    stop)
        stop_daemon
        ;;
    status)
        show_status
        ;;
    spawn)
        if [ -z "$2" ]; then
            echo "Usage: $0 spawn <task_id>"
            exit 1
        fi
        init_active_agents
        spawn_agent "$2"
        ;;
    cleanup)
        cleanup_sessions
        ;;
    cleanup-all)
        # Clean up all stale agents (including permanent ones)
        cleanup_all_stale_agents "${2:-60}"
        ;;
    test)
        init_active_agents
        test_spawn
        ;;
    _daemon)
        daemon_loop
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
