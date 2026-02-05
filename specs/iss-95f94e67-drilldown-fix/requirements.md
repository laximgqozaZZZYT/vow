# Drilldown (Fukabori) Feature Fix - Requirements

## Overview
- **Purpose**: Fix the category drilldown feature that is not functioning in the MOC section
- **Status**: In Progress
- **Version**: 1.0.0
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect
- **Issue ID**: ISS-95f94e67 (95f94e67-8d2d-4cb4-aa56-61a1c58814a0)

## Problem Statement

The Drilldown (Fukabori / 深堀) feature for clarifying vague user queries is not functioning in the MOC section. When users provide ambiguous requests, the system should guide them through a structured selection process (genre -> purpose -> response type), but this is not happening.

## Root Cause Analysis

After investigation, the root cause has been identified:

1. **Drilldown tools exist only in `manager-agent.ts`**: The drilldown tools (`drilldown_analysis`, `genre_quick_replies`, `purpose_quick_replies`, `response_type_quick_replies`) are imported and registered only in the Manager Agent.

2. **Frontend calls `/api/agents/chat`**: The MOC section's `useMastraAgent` hook calls `/api/agents/chat`, which uses `vow-coach-agent.ts`.

3. **`vow-coach-agent` lacks drilldown tools**: The `coachTools` array in `vow-coach-agent.ts` does not include any drilldown tools.

4. **Result**: When users send vague queries through the MOC chat, the vow-coach-agent cannot trigger the drilldown flow because it doesn't have access to the drilldown tools.

## Requirements

### Functional Requirements

- [FR-001] **Drilldown tools must be available in vow-coach-agent**: The drilldown analysis and quick reply tools must be registered in the vow-coach-agent to enable the Fukabori feature when users send vague queries.

- [FR-002] **System prompt must instruct drilldown usage**: The vow-coach-agent's system prompt must include instructions for when and how to use the drilldown tools for vague queries.

- [FR-003] **Frontend must correctly parse drilldown tool outputs**: The `parseQuickReplies` function in `Section.MOC.tsx` must correctly extract `quickReplies` and `selectionType` from drilldown tool outputs.

- [FR-004] **Quick reply clicks must continue drilldown flow**: When a user clicks a drilldown quick reply, the message must be sent to the AI with appropriate context to continue the flow.

### Non-Functional Requirements

- [NFR-001] **Backward compatibility**: Existing coach functionality must not be affected by adding drilldown tools.

- [NFR-002] **Tool output format consistency**: Drilldown tool outputs must match the format expected by the frontend's `parseQuickReplies` function.

## Acceptance Criteria

- [AC-001] When a user sends "何か新しいことを始めたい" (I want to start something new), the system must respond with genre selection buttons.

- [AC-002] After selecting a genre, the system must respond with purpose selection buttons for that genre.

- [AC-003] After selecting a purpose, the system must respond with response type selection buttons.

- [AC-004] After completing the drilldown flow, the system must delegate to the appropriate specialist (habit-coach or goal-planner) based on the response type.

- [AC-005] The drilldown flow must work with both Japanese and English locales.

## Out of Scope

- Changes to the Manager Agent's drilldown implementation
- Changes to the multi-chat API endpoint
- New drilldown categories or response types

## Related Files

### Backend
- `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/vow-coach-agent.ts` - Main agent that needs drilldown tools
- `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/drilldown/` - Drilldown module (already implemented)
- `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/agents/manager-agent.ts` - Reference for drilldown integration

### Frontend
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx` - MOC section with quick reply handling
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/hooks/useMastraAgent.ts` - Agent hook for API calls
- `/home/ubuntu/Downloads/vow/frontend/lib/mastra/config.ts` - API endpoint configuration

### API
- `/home/ubuntu/Downloads/vow/backend/src/routers/agents.ts` - `/api/agents/chat` endpoint
