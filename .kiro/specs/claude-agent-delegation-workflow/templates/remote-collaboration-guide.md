# Remote Agent Collaboration Guide

This guide explains how Claude AI agents on different machines can collaborate on the VOW project using GitHub as the coordination hub.

## Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          GitHub Repository                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │   Issues    │  │   Branches  │  │   Actions   │                 │
│  │ (Task Mgmt) │  │ (Code Sync) │  │ (CI/CD)     │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
└─────────────────────────────────────────────────────────────────────┘
        ▲                   ▲                   ▲
        │                   │                   │
   ┌────┴────┐         ┌────┴────┐         ┌────┴────┐
   │ Agent A │         │ Agent B │         │ Agent C │
   │ Machine1│         │ Machine2│         │ Machine3│
   └─────────┘         └─────────┘         └─────────┘
```

## Getting Started (New Machine)

### 1. Clone the Repository

```bash
git clone https://github.com/{owner}/vow.git
cd vow
```

### 2. Read Project Context

```bash
# Read the agent guide
cat CLAUDE.md

# Read project overview
cat .kiro/specs/project-overview/requirements.md
cat .kiro/specs/project-overview/design.md
```

### 3. Check Available Tasks

Option A: Use GitHub Issues
```bash
# List agent tasks
gh issue list --label "agent-task"
```

Option B: Read specs directly
```bash
# List specs with open tasks
for spec in .kiro/specs/*/; do
  name=$(basename "$spec")
  if [ -f "$spec/tasks.md" ]; then
    open=$(grep -c '^\- \[ \]' "$spec/tasks.md" 2>/dev/null || echo 0)
    if [ "$open" -gt 0 ]; then
      echo "$name: $open open tasks"
    fi
  fi
done
```

### 4. Claim a Task

Option A: Using GitHub Issues (Recommended)
```bash
# Self-assign an issue
gh issue edit {issue_number} --add-assignee @me

# Add a comment
gh issue comment {issue_number} --body "Starting work on this task"
```

Option B: Create a tracking issue
```bash
gh issue create \
  --title "[AGENT] Working on {spec-name} - {role}" \
  --label "agent-task,in-progress" \
  --body "Agent starting work on {spec-name}

Tasks:
- [ ] Task 1
- [ ] Task 2

Branch: feat/{spec-name}-{role}"
```

## Workflow

### Phase 1: Preparation

```bash
# 1. Sync with remote
git fetch origin
git checkout develop
git pull origin develop

# 2. Create feature branch
git checkout -b feat/{spec-name}-{role}

# 3. Read delegation context (if available)
cat .kiro/specs/{spec-name}/delegation-{role}.md

# Or generate new context
./scripts/agents/generate-context.sh {spec-name} {role}
```

### Phase 2: Implementation

```bash
# 1. Make changes according to spec

# 2. Run local tests frequently
cd frontend && npm test
cd ../backend && npm test

# 3. Commit with clear messages
git add {files}
git commit -m "feat({scope}): {description}

Relates to #{issue_number}"
```

### Phase 3: Sync & Validate

```bash
# 1. Push to remote
git push -u origin feat/{spec-name}-{role}

# 2. Create Pull Request
gh pr create \
  --title "feat({scope}): {description}" \
  --body "## Summary
{what this PR does}

## Related Issues
Closes #{issue_number}

## Checklist
- [ ] Tests pass
- [ ] Linting passes
- [ ] Follows design system
- [ ] Documentation updated (if needed)"

# 3. Wait for CI to pass
gh pr checks

# 4. Request review (or self-merge if small change)
gh pr merge --auto --squash
```

## Coordination Mechanisms

### 1. GitHub Issues for Task Management

- **Labels**:
  - `agent-task` - Task assignable to agents
  - `in-progress` - Currently being worked on
  - `blocked` - Waiting for dependency
  - `needs-review` - Ready for review

- **Commands in Issue Comments**:
  - `/agent-status` - Trigger status report workflow
  - `/list-tasks` - List all open tasks

### 2. Branch Protection

- `develop` branch is the integration branch
- All changes must go through Pull Requests
- CI must pass before merge

### 3. Conflict Prevention

**Before starting work:**
```bash
# Check if anyone else is working on same files
gh pr list --state open
git log --oneline origin/develop..origin/feat/* -- {your-files}
```

**If conflicts exist:**
1. Communicate via issue comments
2. Rebase on latest develop
3. Resolve conflicts locally
4. Push force (only your feature branch!)

### 4. GitHub Actions Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| agent-ci.yml | PR, push to develop | Validate changes |
| agent-sync.yml | Manual, issue comment | Coordination tasks |
| deploy-lambda-dev.yml | Push to develop | Deploy to dev |
| deploy-lambda-prod.yml | Push to main | Deploy to prod |

## Communication

### Async Communication (Preferred)

1. **Issue Comments**: For task-specific discussion
2. **PR Reviews**: For code feedback
3. **Commit Messages**: For change documentation

### Status Updates

Update your assigned issue regularly:
```bash
gh issue comment {issue_number} --body "Progress update:
- [x] Completed task 1
- [ ] Working on task 2
- [ ] Task 3 pending

ETA: {estimate}"
```

### Handoff

When handing off to another agent:
```bash
gh issue comment {issue_number} --body "## Handoff Notes

### Completed
- Task 1: {details}
- Task 2: {details}

### In Progress
- Task 3: {current state}

### Files Changed
- path/to/file1.ts
- path/to/file2.tsx

### Issues Encountered
- {issue description and resolution}

### Next Steps
1. {step 1}
2. {step 2}

Branch: feat/{branch-name}
Last commit: {commit hash}"
```

## Troubleshooting

### Merge Conflicts

```bash
# Update your branch with latest develop
git fetch origin
git rebase origin/develop

# Resolve conflicts
# ... edit files ...
git add {resolved-files}
git rebase --continue

# Force push (only your branch!)
git push --force-with-lease
```

### CI Failures

```bash
# Check CI status
gh pr checks

# View CI logs
gh run view --log-failed
```

### Lost Context

```bash
# Re-read project context
cat CLAUDE.md
cat .kiro/specs/project-overview/design.md

# Re-read spec
cat .kiro/specs/{spec-name}/requirements.md
cat .kiro/specs/{spec-name}/tasks.md
```

## Best Practices

1. **Small, focused PRs**: One feature/fix per PR
2. **Clear commit messages**: Include context and rationale
3. **Frequent syncs**: Pull develop often to avoid conflicts
4. **Document blockers**: Comment on issues when stuck
5. **Test locally**: Don't rely solely on CI
6. **Follow conventions**: Use existing patterns from codebase
