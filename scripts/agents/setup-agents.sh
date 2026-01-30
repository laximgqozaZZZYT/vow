#!/bin/bash
# VOW Multi-Agent Development Environment Setup
# This script creates a tmux environment for coordinating multiple Claude agents

set -e

PROJECT_DIR="${HOME}/Downloads/vow"
SESSION_NAME="vow-agents"

echo "=== VOW Multi-Agent Environment Setup ==="
echo "Project directory: ${PROJECT_DIR}"

# Check if tmux is installed
if ! command -v tmux &> /dev/null; then
    echo "Error: tmux is not installed. Please install tmux first."
    exit 1
fi

# Kill existing session if it exists
tmux kill-session -t "${SESSION_NAME}" 2>/dev/null || true

# Create main session with coordinator window
echo "Creating tmux session: ${SESSION_NAME}"
tmux new-session -d -s "${SESSION_NAME}" -n "coordinator" -c "${PROJECT_DIR}"

# Set up coordinator window
tmux send-keys -t "${SESSION_NAME}:coordinator" "echo '=== VOW Coordinator ===' && echo 'Use /agents, /spec, /delegate, /sync, /deploy skills'" Enter

# Create window for frontend agent
tmux new-window -t "${SESSION_NAME}" -n "frontend" -c "${PROJECT_DIR}/frontend"
tmux send-keys -t "${SESSION_NAME}:frontend" "echo '=== Frontend Agent ===' && echo 'Working directory: frontend/'" Enter

# Create window for backend agent
tmux new-window -t "${SESSION_NAME}" -n "backend" -c "${PROJECT_DIR}/backend"
tmux send-keys -t "${SESSION_NAME}:backend" "echo '=== Backend Agent ===' && echo 'Working directory: backend/'" Enter

# Create window for test agent
tmux new-window -t "${SESSION_NAME}" -n "test" -c "${PROJECT_DIR}"
tmux send-keys -t "${SESSION_NAME}:test" "echo '=== Test Agent ===' && echo 'Run: npm test'" Enter

# Create window for git/sync operations
tmux new-window -t "${SESSION_NAME}" -n "sync" -c "${PROJECT_DIR}"
tmux send-keys -t "${SESSION_NAME}:sync" "echo '=== Sync/Git Window ===' && git status" Enter

# Create window for specs
tmux new-window -t "${SESSION_NAME}" -n "specs" -c "${PROJECT_DIR}/.kiro/specs"
tmux send-keys -t "${SESSION_NAME}:specs" "echo '=== Specs Window ===' && ls -la" Enter

# Select coordinator window
tmux select-window -t "${SESSION_NAME}:coordinator"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Session created: ${SESSION_NAME}"
echo ""
echo "Windows:"
echo "  0: coordinator - Main coordination"
echo "  1: frontend    - Frontend development"
echo "  2: backend     - Backend development"
echo "  3: test        - Testing"
echo "  4: sync        - Git operations"
echo "  5: specs       - Specification files"
echo ""
echo "To attach: tmux attach -t ${SESSION_NAME}"
echo "To list windows: tmux list-windows -t ${SESSION_NAME}"
echo ""
echo "Keyboard shortcuts (in tmux):"
echo "  Ctrl+b n     - Next window"
echo "  Ctrl+b p     - Previous window"
echo "  Ctrl+b 0-5   - Go to window number"
echo "  Ctrl+b d     - Detach from session"
echo ""
