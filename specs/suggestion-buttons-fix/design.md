# Suggestion Buttons Fix - Design

## Overview
- **Purpose**: 候補ボタンが表示されない問題の技術的な修正設計
- **Status**: Implementation Complete
- **Version**: 1.1.0
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect

## Technical Analysis

### Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (Section.MOC.tsx)                   │
│  ┌─────────────────────┐    ┌─────────────────────┐             │
│  │  useMastraAgent     │    │    useMcpChat       │             │
│  │  (OpenAI mode)      │    │    (MCP mode)       │             │
│  └──────────┬──────────┘    └──────────┬──────────┘             │
│             │                          │                         │
│             │     activeAgent.messages │                         │
│             │                          │                         │
│             └──────────┬───────────────┘                         │
│                        │                                         │
│                        ▼                                         │
│              ┌─────────────────┐                                 │
│              │    useEffect    │                                 │
│              │ (message sync)  │                                 │
│              └────────┬────────┘                                 │
│                       │                                          │
│                       ▼                                          │
│              ┌─────────────────┐                                 │
│              │parseSuggestions │──► msg.toolCalls?.length?       │
│              └────────┬────────┘    ↓                            │
│                       │         NO: suggestions = undefined      │
│                       │        YES: parse toolCalls.output       │
│                       ▼                                          │
│              ┌─────────────────┐                                 │
│              │ SuggestionCard  │                                 │
│              │  (conditional)  │                                 │
│              └─────────────────┘                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Root Cause Identification

**Problem Location**: `frontend/app/dashboard/components/Section.MOC.tsx` Line 600

```typescript
const suggestions = isComplete && msg.toolCalls?.length ? parseSuggestions(msg) : undefined;
```

`msg.toolCalls` が空または undefined の場合、`suggestions` は常に `undefined` になります。

**Why toolCalls is empty/undefined?**

1. **Mastra Agent (OpenAI mode)**:
   - Backend sends toolCalls in SSE `complete` event ✓
   - Frontend parses toolCalls in `useMastraAgent.ts` ✓
   - Message state update should include toolCalls ✓
   - **Issue**: React state update timing - toolCalls may not be in the message when useEffect runs

2. **MCP Agent (MCP mode)**:
   - MCP server may not be returning toolCalls in SSE response
   - `useMcpChat.ts` Line 330: `const toolCalls = data.toolCalls as MastraMessage['toolCalls'];`
   - If MCP server doesn't send toolCalls, this will be undefined

## Design Solution

### Solution 1: Fix Message State Update Timing (Frontend)

The useEffect in Section.MOC.tsx depends on `activeAgent.messages`, but React state updates are asynchronous. When a message status changes to 'complete' and toolCalls are added, the useEffect might not see the latest toolCalls immediately.

**Fix**: Add `msg.toolCalls` to the dependency tracking or use a ref to ensure we capture the latest state.

### Solution 2: Ensure Backend Sends toolCalls Correctly

Verify that `vow-coach-agent.ts` always returns toolCalls in the response, even for fallback scenarios.

**Current Code** (Line 2033-2041 in vow-coach-agent.ts):
```typescript
return {
  message: responseMessage,
  toolCalls: fallbackToolCalls,  // This creates fallback toolCalls
  suggestions,
};
```

The fallback toolCalls are for UI buttons, not suggestion data. We need to ensure suggestion tool calls have proper `output` with `suggestions` array.

### Solution 3: Fix parseSuggestions Logic

Current `parseSuggestions` function (Line 1944-2203) expects:
```typescript
toolCall.output.suggestions = [{ name, description, ... }, ...]
```

But the actual tool output structure from `suggestHabitsExecute` is:
```typescript
{ suggestions: [...], followUpActions: [...] }
```

This should work, but we need to verify the `output` field is not being stringified or transformed incorrectly.

## Proposed Changes

### Change 1: Add Debug Logging to Verify Data Flow

Add comprehensive logging to trace the exact point where toolCalls are lost:

**File: `frontend/app/dashboard/hooks/useMastraAgent.ts`**
- Log when toolCalls are received from SSE
- Log when message state is updated

**File: `frontend/app/dashboard/components/Section.MOC.tsx`**
- Log the raw `msg.toolCalls` before parsing
- Log each step of `parseSuggestions`

### Change 2: Fix Message State Update in useMastraAgent.ts

Ensure toolCalls are properly attached to the message object when status changes to 'complete'.

**Current Code** (Line 335-344):
```typescript
setMessages(prev => prev.map(msg =>
  msg.id === assistantMessageId
    ? {
        ...msg,
        content: fullContent,
        status: 'complete' as const,
        toolCalls: finalToolCalls,
      }
    : msg
));
```

**Issue**: `finalToolCalls` might be undefined if `chunk.toolCalls` is empty and accumulated `toolCalls` is also empty.

**Fix**: Ensure we always have toolCalls from the complete event:
```typescript
const finalToolCalls = chunk.toolCalls || toolCalls.length > 0 ? [...toolCalls, ...(chunk.toolCalls || [])] : undefined;
```

### Change 3: Fix MCP Server to Return toolCalls

If using MCP mode, the MCP server's chat endpoint needs to:
1. Execute the appropriate tools (suggest_habits, suggest_goals)
2. Include tool results in the `complete` SSE event

This may require changes to the MCP server implementation.

### Change 4: Fallback to Parsing Text Content

If toolCalls are not available, try to parse suggestions from the AI's text response:
- Look for JSON blocks in the response
- Parse habit/goal suggestions from structured text

## Implementation Priority

1. **High Priority**: Add debug logging to identify exact failure point
2. **High Priority**: Fix message state update timing in useMastraAgent.ts
3. **Medium Priority**: Verify backend toolCalls response format
4. **Medium Priority**: Add text-based suggestion parsing as fallback
5. **Low Priority**: MCP server toolCalls support (if needed)

## Testing Strategy

1. **Unit Test**: parseSuggestions function with various input formats
2. **Integration Test**: End-to-end flow from user input to suggestion card display
3. **Manual Test**: Console log verification in browser DevTools

## Interfaces

### ToolCallResult (existing)
```typescript
interface ToolCallResult {
  toolName: string;
  input: unknown;
  output: unknown;  // Should contain { suggestions: [...], followUpActions: [...] }
  success: boolean;
  durationMs: number;
}
```

### Expected output for suggest_habits/suggest_goals
```typescript
interface SuggestionOutput {
  suggestions: Array<{
    name: string;
    description: string;
    category: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    suggestionType: 'habit' | 'goal' | 'stickyn' | 'reply';
    // habit-specific
    frequency?: 'daily' | 'weekly' | '3x/week';
    estimatedTime?: string;
    // goal-specific
    suggestedHabits?: string[];
  }>;
  followUpActions?: Array<{
    id: string;
    label: string;
    action: 'more_specific' | 'easier' | 'harder' | 'different';
    category: string;
  }>;
}
```

## Dependencies

- React 19
- useMastraAgent hook
- useMcpChat hook
- VowCoachAgent (backend)
- coach-tools.ts (backend)

## Rollback Plan

If the fix causes issues:
1. Revert frontend changes to Section.MOC.tsx and hooks
2. Fallback to text-only suggestions (no buttons)
3. Log errors for investigation
