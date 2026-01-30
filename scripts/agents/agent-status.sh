#!/bin/bash
# Check status of all agent sessions and work progress
# Usage: ./agent-status.sh [session_name]

SESSION_NAME="${1:-vow-agents}"
PROJECT_DIR="${HOME}/Downloads/vow"

echo "=== VOW Multi-Agent Status ==="
echo ""

# Check if session exists
if ! tmux has-session -t "${SESSION_NAME}" 2>/dev/null; then
    echo "Session '${SESSION_NAME}' not found."
    echo "Run ./setup-agents.sh to create the environment."
    exit 0
fi

# List all windows in the session
echo "## Active Windows"
echo ""
printf "| %-20s | %-10s | %-30s |\n" "Window" "Index" "Status"
printf "|%-22s|%-12s|%-32s|\n" "----------------------" "------------" "--------------------------------"

tmux list-windows -t "${SESSION_NAME}" -F "#{window_index}|#{window_name}|#{window_active}" | while IFS='|' read -r idx name active; do
    if [ "$active" == "1" ]; then
        status="Active *"
    else
        status="Ready"
    fi
    printf "| %-20s | %-10s | %-30s |\n" "$name" "$idx" "$status"
done

echo ""

# Check git status
echo "## Git Status"
echo ""
cd "${PROJECT_DIR}"
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo "Current branch: ${BRANCH}"

UNCOMMITTED=$(git status --porcelain 2>/dev/null | wc -l)
if [ "$UNCOMMITTED" -gt 0 ]; then
    echo "Uncommitted changes: ${UNCOMMITTED} files"
    echo ""
    git status --short | head -10
    if [ "$UNCOMMITTED" -gt 10 ]; then
        echo "... and $((UNCOMMITTED - 10)) more files"
    fi
else
    echo "Working directory clean"
fi

echo ""

# List feature branches
echo "## Feature Branches"
echo ""
FEATURE_BRANCHES=$(git branch --list "feat/*" 2>/dev/null | wc -l)
if [ "$FEATURE_BRANCHES" -gt 0 ]; then
    git branch --list "feat/*" --format="  %(refname:short) - %(committerdate:relative)"
else
    echo "  No feature branches"
fi

echo ""

# Show recent commits
echo "## Recent Commits (last 5)"
echo ""
git log --oneline -5 2>/dev/null || echo "  No commits"

echo ""

# Check spec status (quick summary)
echo "## Spec Status Summary"
echo ""
SPECS_DIR="${PROJECT_DIR}/.kiro/specs"
TOTAL_SPECS=$(ls -d "${SPECS_DIR}"/*/ 2>/dev/null | wc -l)
COMPLETED=0
IN_PROGRESS=0
NOT_STARTED=0

for spec_dir in "${SPECS_DIR}"/*/; do
    if [ -f "${spec_dir}/tasks.md" ]; then
        TOTAL=$(grep -c '^\- \[' "${spec_dir}/tasks.md" 2>/dev/null || echo 0)
        DONE=$(grep -c '^\- \[x\]' "${spec_dir}/tasks.md" 2>/dev/null || echo 0)
        if [ "$TOTAL" -gt 0 ]; then
            PCT=$((DONE * 100 / TOTAL))
            if [ "$PCT" -eq 100 ]; then
                ((COMPLETED++))
            elif [ "$PCT" -gt 0 ]; then
                ((IN_PROGRESS++))
            else
                ((NOT_STARTED++))
            fi
        fi
    fi
done

echo "Total specs: ${TOTAL_SPECS}"
echo "  Completed: ${COMPLETED}"
echo "  In progress: ${IN_PROGRESS}"
echo "  Not started: ${NOT_STARTED}"
echo ""

echo "=== End Status ==="
