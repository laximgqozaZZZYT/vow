# Chat "No Response" Bug Fix - Design Document

## Overview
- Purpose: 「(No response)」問題の修正設計
- Status: Design Complete
- Version: 1.0.0
- Last Updated: 2026-02-04
- Author: vow-spec-architect

## Architecture

### Current Flow (Problematic)

```
User Input
    |
    v
MOCSection (Section.MOC.tsx)
    |
    v
useMcpChat Hook
    |
    v
fetch POST /agents/:agentId/chat
    |
    v
MCP Task Server (server.ts)
    |
    v
spawn Claude CLI (--print mode)
    |
    v
Claude CLI stdout -> SSE token events
    |
    v
fullResponse accumulation
    |
    v
SSE complete event
    |
    v
useMcpChat parses SSE
    |
    v
[BUG] fullContent is empty -> "(No response)"
```

### Problem Points

1. **Claude CLI may output nothing**
   - Authentication issues
   - Path issues
   - Silent failures

2. **stderr is logged but not sent to client**
   - Error information is lost
   - Client sees "(No response)" instead of actual error

3. **No content in complete event**
   - When fullResponse is empty, complete event sends `content: ""`
   - Frontend falls back to "(No response)"

## Proposed Solution

### Solution 1: Improve Error Handling (Recommended)

#### Backend Changes (server.ts)

1. **Send stderr content as error events**
```typescript
let stderrContent = '';

claudeProcess.stderr?.on('data', (data: Buffer) => {
  const text = data.toString();
  stderrContent += text;
  console.error('[Chat] stderr:', text);
});

claudeProcess.on('close', (code: number | null) => {
  // If no stdout but has stderr, send error
  if (!fullResponse.trim() && stderrContent.trim()) {
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: stderrContent.trim() || 'Claude CLI produced no output',
      exitCode: code
    })}\n\n`);
  } else {
    // Normal completion
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      content: fullResponse,
      sessionId,
      exitCode: code
    })}\n\n`);
  }
  res.end();
});
```

2. **Add timeout handling**
```typescript
const timeout = setTimeout(() => {
  claudeProcess.kill();
  res.write(`data: ${JSON.stringify({
    type: 'error',
    error: 'Request timed out after 60 seconds'
  })}\n\n`);
  res.end();
}, 60000);

claudeProcess.on('close', () => {
  clearTimeout(timeout);
  // ... rest of handling
});
```

#### Frontend Changes (useMcpChat.ts)

1. **Improve "(No response)" message with context**
```typescript
// Line 392-397: Add more informative message
if (!fullContent) {
  // Check if there was an error event
  const errorMessage = lastError
    ? `Error: ${lastError}`
    : locale === 'ja'
      ? '(応答がありませんでした。MCPサーバーの状態を確認してください)'
      : '(No response received. Please check MCP server status)';

  setMessages(prev => prev.map(msg =>
    msg.id === assistantMessageId
      ? { ...msg, content: errorMessage, status: 'error' as const }
      : msg
  ));
}
```

2. **Track error events**
```typescript
// Add state to track last error
let lastError: string | null = null;

// In the parsing loop:
if (effectiveType === 'error') {
  lastError = data.error || 'Unknown error from MCP agent';
  throw new Error(lastError);
}
```

### Solution 2: Alternative - Direct Claude SDK Integration

Instead of spawning Claude CLI, use Claude SDK directly:

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

app.post('/agents/:agentId/chat', async (req, res) => {
  // ... SSE setup ...

  try {
    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: message }],
      system: systemPrompt,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        const text = event.delta.text || '';
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ type: 'token', token: text })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({
      type: 'complete',
      content: fullResponse,
      sessionId
    })}\n\n`);
    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: error.message
    })}\n\n`);
    res.end();
  }
});
```

### Recommended Approach

**Solution 1** (Improve Error Handling) because:
1. Minimal changes required
2. Preserves existing architecture
3. Quick to implement
4. Provides better error visibility

## Technical Design

### Interfaces

#### SSE Event Format (Standardized)

```typescript
// Session event
interface SessionEvent {
  type: 'session';
  sessionId: string;
}

// Token event (streaming)
interface TokenEvent {
  type: 'token';
  token: string;
}

// Complete event
interface CompleteEvent {
  type: 'complete';
  content: string;
  sessionId: string;
  exitCode?: number;
  toolCalls?: ToolCall[];
}

// Error event
interface ErrorEvent {
  type: 'error';
  error: string;
  exitCode?: number;
  details?: string;  // stderr content
}
```

### Dependencies

- No new dependencies required for Solution 1
- Solution 2 would require: `@anthropic-ai/sdk`

## Implementation Notes

### Files to Modify

1. `/home/ubuntu/.mcp-multi-agent/mcp-task-distributor/src/server.ts`
   - Add stderr accumulation
   - Send error events when no stdout
   - Add timeout handling

2. `/home/ubuntu/Downloads/vow/frontend/app/dashboard/hooks/useMcpChat.ts`
   - Track error events
   - Improve "(No response)" message
   - Set status to 'error' when appropriate

3. (Optional) `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`
   - Improve error message display styling

### Testing Strategy

1. **Unit Tests**
   - Mock Claude CLI failures
   - Verify error events are sent
   - Verify frontend handles errors

2. **Integration Tests**
   - Test with MCP server running
   - Test timeout scenarios
   - Test authentication failures

3. **Manual Tests**
   - Send message in MOC section
   - Verify streaming works
   - Verify errors are displayed properly

## Rollback Plan

If issues arise:
1. Revert server.ts changes
2. Revert useMcpChat.ts changes
3. Both files have minimal changes, easy to revert
