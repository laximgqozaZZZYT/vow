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

## MCP Multi-Agent Scale System (10-20 Agents)

- [x] 15. Create MCP Task Distribution Server
  - [x] 15.1 Central HTTP+SSE server for task management
    - Created: /home/ubuntu/.mcp-multi-agent/mcp-task-distributor/src/server.ts
    - Port: 3456, Host: 0.0.0.0
  - [x] 15.2 MCP Bridge for Claude Code integration
    - Created: /home/ubuntu/.mcp-multi-agent/mcp-task-distributor/src/mcp-bridge.ts
  - [x] 15.3 Task types and API definitions
    - Created: /home/ubuntu/.mcp-multi-agent/mcp-task-distributor/src/types.ts

- [x] 16. Create Multi-Machine Setup Scripts
  - [x] 16.1 Main setup script (1-20 agents)
    - Created: /home/ubuntu/.mcp-multi-agent/setup_multi_agent.sh
  - [x] 16.2 MCP configuration template
    - Created: /home/ubuntu/.mcp-multi-agent/mcp-config.json
  - [x] 16.3 Server configuration
    - Created: /home/ubuntu/.mcp-multi-agent/config/server.env
    - URL: http://192.168.2.126:3456
  - [x] 16.4 Agent role prompts
    - Created: /home/ubuntu/.mcp-multi-agent/prompts/

- [x] 17. Create MCP Multi-Agent Documentation
  - [x] 17.1 README with architecture diagram
    - Created: /home/ubuntu/.mcp-multi-agent/README.md
  - [x] 17.2 Remote machine connection guide
    - Included in README.md

- [x] 18. VOW Project Integration
  - [x] 18.1 Create VOW-specific multi-agent launcher
    - Created: scripts/agents/multi-agent-launcher.sh
  - [x] 18.2 Link MCP server from VOW scripts
    - Launcher uses /home/ubuntu/mcp-multi-agent
  - [x] 18.3 Update CLAUDE.md with MCP multi-agent usage
    - Updated: CLAUDE.md with full MCP Multi-Agent Scale System section

- [x] 19. Manager Agent Capabilities
  - [x] 19.1 Add trust management types
    - Updated: mcp-task-distributor/src/types.ts
    - Added: TrustedMachine, TrustLevel, TrustRequest, LDAPConfig, Project
  - [x] 19.2 Implement trust management API
    - Updated: mcp-task-distributor/src/server.ts
    - Endpoints: /trust/machines, /agents/invite, /agents/:id/remove
  - [x] 19.3 Add manager MCP tools
    - Updated: mcp-task-distributor/src/mcp-bridge.ts
    - Tools: list_trusted_machines, add_trusted_machine, invite_agent, etc.
  - [x] 19.4 LDAP integration support
    - Added: config/ldap.example.env
    - Endpoints: /config/ldap (GET/PUT), /config/ldap/test
  - [x] 19.5 Manager documentation
    - Created: prompts/manager-guide.md
    - Created: docs/remote-agent-guide.md
    - Updated: README.md with manager features

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
