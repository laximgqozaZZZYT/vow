# Drilldown (Fukabori) Feature Fix - Technical Design

## Overview
- **Purpose**: Technical design for fixing the drilldown feature in vow-coach-agent
- **Status**: In Progress
- **Version**: 1.0.0
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect

## Architecture

### Current State

```
Frontend (MOC Section)
    |
    v
/api/agents/chat (agents.ts)
    |
    v
vow-coach-agent.ts
    |
    v
coachTools (NO drilldown tools)
```

### Target State

```
Frontend (MOC Section)
    |
    v
/api/agents/chat (agents.ts)
    |
    v
vow-coach-agent.ts
    |
    v
coachTools (WITH drilldown tools)
    |
    v
drilldown/ module
```

## Design Decisions

### 1. Import Drilldown Tools into vow-coach-agent

**Approach**: Import the existing drilldown tools from `drilldown/tools.ts` and add them to `coachTools` array.

**Rationale**:
- Reuse existing, tested implementation
- Maintain consistency with manager-agent
- No duplication of drilldown logic

**Implementation**:
```typescript
// In vow-coach-agent.ts
import {
  drilldownAnalysisTool,
  genreQuickRepliesTool,
  purposeQuickRepliesTool,
  responseTypeQuickRepliesTool,
} from './drilldown/index.js';
```

### 2. Convert Mastra Tools to CoachTools Format

The drilldown tools are defined as Mastra `createTool()` format, but `coachTools` uses a different format with `name`, `description`, `inputSchema`, and `execute`.

**Approach**: Create wrapper functions that adapt the Mastra tool format to CoachTools format.

**Implementation**:
```typescript
{
  name: 'drilldown_analysis',
  description: drilldownAnalysisTool.description,
  descriptionJa: drilldownAnalysisTool.description, // Same for now
  inputSchema: z.object({
    query: z.string(),
    conversationHistory: z.array(z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    })).optional(),
    locale: z.enum(['ja', 'en']).default('ja'),
  }),
  execute: async (input, context) => {
    // Call the Mastra tool's execute function
    return drilldownAnalysisTool.execute(input);
  },
}
```

### 3. Update System Prompt

Add drilldown instructions to the vow-coach-agent's system prompt.

**Location**: `generateSystemPrompt()` function in `vow-coach-agent.ts`

**Content to Add**:
```
## 掘り下げモード（フカボリ）
ユーザーの質問が曖昧な場合は、drilldown_analysisツールを使用して判定し、
段階的に情報を収集します。

### 曖昧な質問の例
- 「何か新しいことを始めたい」
- 「もっと良い生活を送りたい」
- 「自分を変えたい」
- 「おすすめを教えて」

### 掘り下げフロー
1. drilldown_analysis で曖昧さを判定
2. 曖昧な場合は genre_quick_replies でジャンル選択を表示
3. ジャンル選択後は purpose_quick_replies で目的選択を表示
4. 目的選択後は response_type_quick_replies で回答タイプを表示
```

### 4. Frontend Tool Output Parsing

The frontend's `parseQuickReplies` function already handles drilldown tools correctly:

```typescript
// Already in Section.MOC.tsx
const selectionToolNames = [
  // ... existing tools
  'drilldown_analysis',
  'genre_quick_replies',
  'purpose_quick_replies',
  'response_type_quick_replies',
];
```

**Verification needed**: Ensure the tool output format from vow-coach-agent matches what the frontend expects.

## Interfaces

### Drilldown Tool Output Format

All drilldown tools must return outputs in this format:

```typescript
interface DrilldownToolOutput {
  needsDrilldown?: boolean;        // For drilldown_analysis
  currentStep?: DrilldownStep;     // For drilldown_analysis
  drilldownState?: DrilldownState; // For drilldown_analysis
  quickReplies: Array<{
    id: string;
    label: string;
    value: string;
    icon?: string;
  }>;
  message: string;
  selectionType: 'drilldown_genre' | 'drilldown_purpose' | 'drilldown_response_type';
  targetAgent?: 'habit-coach' | 'goal-planner' | 'manager';
}
```

### CoachTools Format

```typescript
interface CoachTool {
  name: string;
  description: string;
  descriptionJa: string;
  inputSchema: z.ZodSchema;
  execute: (input: unknown, context: CoachExecutionContext) => Promise<unknown>;
}
```

## Dependencies

### Existing Modules
- `drilldown/index.ts` - Exports all drilldown functionality
- `drilldown/tools.ts` - Mastra tool definitions
- `drilldown/controller.ts` - Drilldown flow controller
- `drilldown/types.ts` - Type definitions
- `drilldown/categories.ts` - Genre/purpose/response type definitions

### No New Dependencies Required

## Testing Strategy

### Manual Testing
1. Start the application
2. Navigate to MOC section
3. Send message: "何か新しいことを始めたい"
4. Verify genre selection buttons appear
5. Click a genre
6. Verify purpose selection buttons appear
7. Click a purpose
8. Verify response type selection buttons appear
9. Click a response type
10. Verify appropriate suggestions are generated

### Log Verification
Check backend logs for:
- `[vow-coach-agent] Using drilldown_analysis tool`
- `[vow-coach-agent] drilldownAnalysis result: ...`

Check frontend console for:
- `[parseQuickReplies] Found selectionType: drilldown_genre`

## Rollback Plan

If issues occur after deployment:
1. Remove drilldown tools from `coachTools` array
2. Remove drilldown instructions from system prompt
3. Redeploy backend

## Agent Coordination Notes

This fix is self-contained in the backend:
- Only `vow-coach-agent.ts` needs modification
- No frontend changes required (frontend already supports drilldown tools)
- No database changes required
- No API endpoint changes required
