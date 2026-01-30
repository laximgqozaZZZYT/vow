#!/bin/bash
# Start a new Claude agent in a tmux window
# Usage: ./start-agent.sh <role> [session_name]

set -e

ROLE="${1:-frontend}"
SESSION_NAME="${2:-vow-agents}"
PROJECT_DIR="${HOME}/Downloads/vow"

# Validate role
case "${ROLE}" in
    frontend|backend|test|infra|spec)
        ;;
    *)
        echo "Error: Invalid role '${ROLE}'"
        echo "Valid roles: frontend, backend, test, infra, spec"
        exit 1
        ;;
esac

# Check if session exists
if ! tmux has-session -t "${SESSION_NAME}" 2>/dev/null; then
    echo "Error: Session '${SESSION_NAME}' does not exist."
    echo "Run ./setup-agents.sh first"
    exit 1
fi

# Find next available window number for this role
EXISTING=$(tmux list-windows -t "${SESSION_NAME}" -F "#{window_name}" | grep "^${ROLE}" | wc -l)
WINDOW_NAME="${ROLE}-$((EXISTING + 1))"

# Determine working directory based on role
case "${ROLE}" in
    frontend)
        WORK_DIR="${PROJECT_DIR}/frontend"
        ;;
    backend)
        WORK_DIR="${PROJECT_DIR}/backend"
        ;;
    infra)
        WORK_DIR="${PROJECT_DIR}/infra"
        ;;
    spec)
        WORK_DIR="${PROJECT_DIR}/.kiro/specs"
        ;;
    *)
        WORK_DIR="${PROJECT_DIR}"
        ;;
esac

# Create new window
echo "Creating agent window: ${WINDOW_NAME}"
tmux new-window -t "${SESSION_NAME}" -n "${WINDOW_NAME}" -c "${WORK_DIR}"

# Set up the window with role-specific context
tmux send-keys -t "${SESSION_NAME}:${WINDOW_NAME}" "echo '=== Agent: ${WINDOW_NAME} ==='" Enter
tmux send-keys -t "${SESSION_NAME}:${WINDOW_NAME}" "echo 'Role: ${ROLE}'" Enter
tmux send-keys -t "${SESSION_NAME}:${WINDOW_NAME}" "echo 'Working directory: ${WORK_DIR}'" Enter
tmux send-keys -t "${SESSION_NAME}:${WINDOW_NAME}" "echo ''" Enter

# Role-specific setup
case "${ROLE}" in
    frontend)
        tmux send-keys -t "${SESSION_NAME}:${WINDOW_NAME}" "echo 'Reference: .kiro/steering/design-system.md'" Enter
        tmux send-keys -t "${SESSION_NAME}:${WINDOW_NAME}" "echo 'Components: app/dashboard/components/'" Enter
        ;;
    backend)
        tmux send-keys -t "${SESSION_NAME}:${WINDOW_NAME}" "echo 'Services: src/services/'" Enter
        tmux send-keys -t "${SESSION_NAME}:${WINDOW_NAME}" "echo 'Routers: src/routers/'" Enter
        ;;
    test)
        tmux send-keys -t "${SESSION_NAME}:${WINDOW_NAME}" "echo 'Run tests: npm test'" Enter
        tmux send-keys -t "${SESSION_NAME}:${WINDOW_NAME}" "echo 'Watch mode: npm run test:watch'" Enter
        ;;
    spec)
        tmux send-keys -t "${SESSION_NAME}:${WINDOW_NAME}" "echo 'Project overview: project-overview/'" Enter
        tmux send-keys -t "${SESSION_NAME}:${WINDOW_NAME}" "ls -la" Enter
        ;;
esac

echo ""
echo "Agent '${WINDOW_NAME}' started in session '${SESSION_NAME}'"
echo "To attach: tmux attach -t ${SESSION_NAME}"
echo "To switch to window: tmux select-window -t ${SESSION_NAME}:${WINDOW_NAME}"
