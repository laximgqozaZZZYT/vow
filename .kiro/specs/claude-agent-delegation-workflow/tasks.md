# Implementation Plan: Claude Agent Delegation Workflow

## Overview

KIROで作成したSPECをClaude AIエージェントに委任するためのワークフローを実装します。主にMarkdownテンプレートとガイドラインドキュメントの作成が中心となります。

## Tasks

- [x] 1. Create project context documentation
  - [x] 1.1 Create project-context.md template
    - Created: .kiro/specs/project-overview/requirements.md
    - Created: .kiro/specs/project-overview/design.md
    - Created: .kiro/specs/project-overview/tasks.md
    - Created: CLAUDE.md (Agent guide for project root)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [x] 2. Create delegation templates
  - [x] 2.1 Create delegation-context.template.md
    - Created: scripts/agents/generate-context.sh (generates context dynamically)
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6, 3.7_

  - [ ] 2.2 Create task-split.template.md
    - Define parallel group structure
    - Include dependency mapping format
    - Define sync point markers
    - Include complexity estimation guidelines
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 2.3 Write property test for task independence detection
    - **Property 2: Task Independence Detection**
    - **Validates: Requirements 2.1, 2.2**

- [x] 3. Create agent guide documentation
  - [x] 3.1 Create agent-guide.template.md
    - Created: CLAUDE.md (comprehensive agent guide)
    - Created: .claude/skills/spec.md
    - Created: .claude/skills/agents.md
    - Created: .claude/skills/delegate.md
    - Created: .claude/skills/sync.md
    - Created: .claude/skills/deploy.md
    - _Requirements: 7.6, 10.1, 10.3, 10.4, 10.6_

  - [ ]* 3.2 Write property test for convention compliance
    - **Property 10: Convention Compliance**
    - **Validates: Requirements 10.1, 10.4, 10.6**

- [ ] 4. Checkpoint - Review templates
  - Ensure all templates are complete, ask the user if questions arise.

- [x] 5. Create work session management templates
  - [x] 5.1 Create work-session management tools
    - Created: scripts/agents/setup-agents.sh (tmux setup)
    - Created: scripts/agents/start-agent.sh (start new agent)
    - Created: scripts/agents/agent-status.sh (check status)
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6_

  - [x] 5.2 Create agent-handoff documentation
    - Created: .kiro/specs/claude-agent-delegation-workflow/templates/remote-collaboration-guide.md
    - Includes handoff notes template
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6_

  - [ ]* 5.3 Write property test for session state consistency
    - **Property 7: Session State Consistency**
    - **Validates: Requirements 4.1, 4.2, 4.4**

- [ ] 6. Create conflict prevention documentation
  - [ ] 6.1 Create conflict-matrix.template.md
    - Define file conflict risk levels (none, low, medium, high)
    - Include mitigation strategies per risk level
    - Define sequential execution recommendations
    - Include post-merge verification checklist
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 6.2 Write property test for conflict matrix correctness
    - **Property 8: Conflict Matrix Correctness**
    - **Validates: Requirements 5.1, 5.2, 5.4, 5.5**

- [x] 7. Create QA workflow documentation
  - [x] 7.1 Create qa-workflow via GitHub Actions
    - Created: .github/workflows/agent-ci.yml
    - Validates frontend (lint, type-check, tests)
    - Validates backend (build, tests)
    - Checks for merge conflicts
    - Generates agent report
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [ ] 8. Create KIRO optimization guidelines
  - [ ] 8.1 Create kiro-workflow-guide.md
    - Define SPEC creation best practices
    - Include templates for efficient SPEC creation
    - Define clear handoff points from KIRO to Claude agents
    - Include guidelines for SPEC iteration and updates
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 9. Checkpoint - Review all documentation
  - Ensure all documentation is complete and consistent, ask the user if questions arise.

- [ ] 10. Create validation utilities
  - [ ] 10.1 Create SPEC format validation script
    - Validate task checklist format (markdown checkboxes)
    - Validate file path references exist
    - Validate dependency references
    - _Requirements: 1.1, 1.2, 1.4, 1.6_

  - [ ]* 10.2 Write property test for SPEC format completeness
    - **Property 1: SPEC Format Completeness**
    - **Validates: Requirements 1.1, 1.2, 1.4, 1.6**

  - [ ] 10.3 Create dependency cycle detection script
    - Implement topological sort for task dependencies
    - Report circular dependencies with task chain
    - _Requirements: 2.4_

  - [ ]* 10.4 Write property test for dependency order validity
    - **Property 4: Dependency Order Validity**
    - **Validates: Requirements 2.4**

- [ ] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Additional Tasks (Multi-Agent Environment)

- [x] 12. Create tmux multi-agent environment
  - [x] 12.1 Setup script for tmux sessions
    - Created: scripts/agents/setup-agents.sh
  - [x] 12.2 Agent start script
    - Created: scripts/agents/start-agent.sh
  - [x] 12.3 Status monitoring script
    - Created: scripts/agents/agent-status.sh
  - [x] 12.4 Context generation script
    - Created: scripts/agents/generate-context.sh

- [x] 13. Create Claude Code Agent Skills
  - [x] 13.1 /spec skill - View and manage specs
    - Created: .claude/skills/spec.md
  - [x] 13.2 /agents skill - Manage agent sessions
    - Created: .claude/skills/agents.md
  - [x] 13.3 /delegate skill - Delegate tasks
    - Created: .claude/skills/delegate.md
  - [x] 13.4 /sync skill - Sync agent work
    - Created: .claude/skills/sync.md
  - [x] 13.5 /deploy skill - Deployment management
    - Created: .claude/skills/deploy.md
  - [x] 13.6 Settings configuration
    - Created: .claude/settings.json

- [x] 14. Create GitHub remote collaboration setup
  - [x] 14.1 Agent task issue template
    - Created: .github/ISSUE_TEMPLATE/agent-task.yml
  - [x] 14.2 Agent CI workflow
    - Created: .github/workflows/agent-ci.yml
  - [x] 14.3 Agent sync workflow
    - Created: .github/workflows/agent-sync.yml
  - [x] 14.4 Remote collaboration guide
    - Created: templates/remote-collaboration-guide.md

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- This implementation is primarily documentation-focused (Markdown templates)
- Property tests validate the structure and consistency of generated documents
- The workflow integrates with existing Git branching (develop → main) and deployment flow
- All templates should reference the design system tokens and coding conventions
- Multi-agent environment supports both local (tmux) and remote (GitHub) collaboration

## Created Files Summary

### Local Agent Environment
- `scripts/agents/setup-agents.sh` - Initialize tmux multi-agent environment
- `scripts/agents/start-agent.sh` - Start a new agent in tmux
- `scripts/agents/agent-status.sh` - Check status of all agents
- `scripts/agents/generate-context.sh` - Generate delegation context

### Claude Code Skills
- `.claude/settings.json` - Project settings for Claude Code
- `.claude/skills/spec.md` - /spec skill
- `.claude/skills/agents.md` - /agents skill
- `.claude/skills/delegate.md` - /delegate skill
- `.claude/skills/sync.md` - /sync skill
- `.claude/skills/deploy.md` - /deploy skill

### GitHub Integration
- `.github/ISSUE_TEMPLATE/agent-task.yml` - Issue template for agent tasks
- `.github/workflows/agent-ci.yml` - CI for validating agent changes
- `.github/workflows/agent-sync.yml` - Coordination workflows

### Documentation
- `CLAUDE.md` - Project root agent guide
- `.kiro/specs/project-overview/` - Project overview spec
- `templates/remote-collaboration-guide.md` - Remote agent collaboration guide
