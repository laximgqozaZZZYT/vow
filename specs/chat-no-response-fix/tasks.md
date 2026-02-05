# Chat "No Response" Bug Fix - Tasks

## Overview
- Purpose: タスク分解とチェックリスト
- Status: Ready for Implementation
- Version: 1.0.0
- Last Updated: 2026-02-04
- Author: vow-spec-architect

## Task Breakdown

### Phase 1: Investigation & Diagnosis (Completed)

- [x] Task 1.1: Analyze useMcpChat.ts SSE parsing logic
- [x] Task 1.2: Analyze MCP Task Server chat endpoint
- [x] Task 1.3: Identify SSE event format mismatch
- [x] Task 1.4: Determine root cause

**Findings Summary:**
- SSE形式自体は互換性がある（data.typeフォールバックが動作）
- 問題の本質はClaude CLIが出力を生成しないこと
- stderrにエラーがある可能性があるが、クライアントに伝わらない

---

### Phase 2: Backend Fixes (MCP Task Server)

#### Task 2.1: Add stderr Error Propagation
**Priority:** High
**Estimated Time:** 30 min
**Assignable to:** Backend Developer

**Description:**
Claude CLIのstderrの内容をSSEエラーイベントとしてクライアントに送信する。

**Changes:**
- File: `/home/ubuntu/.mcp-multi-agent/mcp-task-distributor/src/server.ts`
- Location: Lines 296-336 (GET endpoint), 398-436 (POST endpoint)

**Implementation:**
```typescript
// Add stderr accumulation
let stderrContent = '';

claudeProcess.stderr?.on('data', (data: Buffer) => {
  const text = data.toString();
  stderrContent += text;
  console.error('[Chat] stderr:', text);
});

// In close handler, check for empty response with stderr
claudeProcess.on('close', (code: number | null) => {
  if (!fullResponse.trim() && (stderrContent.trim() || code !== 0)) {
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: stderrContent.trim() || `Claude CLI exited with code ${code}`,
      exitCode: code
    })}\n\n`);
  } else {
    // ... existing completion logic
  }
  res.end();
});
```

**Acceptance Criteria:**
- [ ] stderrの内容がエラーイベントとして送信される
- [ ] 終了コードが非ゼロの場合、エラーとして扱われる
- [ ] 正常応答時の動作に影響がない

---

#### Task 2.2: Add Request Timeout
**Priority:** Medium
**Estimated Time:** 20 min
**Assignable to:** Backend Developer

**Description:**
長時間応答がない場合のタイムアウト処理を追加。

**Changes:**
- File: `/home/ubuntu/.mcp-multi-agent/mcp-task-distributor/src/server.ts`

**Implementation:**
```typescript
const CHAT_TIMEOUT_MS = 60000; // 60 seconds

// In chat endpoint
const timeout = setTimeout(() => {
  if (!res.writableEnded) {
    claudeProcess.kill('SIGTERM');
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: 'Request timed out after 60 seconds. Claude CLI may be unresponsive.'
    })}\n\n`);
    res.end();
  }
}, CHAT_TIMEOUT_MS);

claudeProcess.on('close', (code: number | null) => {
  clearTimeout(timeout);
  // ... rest of handler
});
```

**Acceptance Criteria:**
- [ ] 60秒後にタイムアウトイベントが送信される
- [ ] プロセスが適切に終了される
- [ ] 正常完了時にタイマーがクリアされる

---

#### Task 2.3: Rebuild MCP Task Server
**Priority:** High
**Estimated Time:** 5 min
**Assignable to:** Backend Developer

**Description:**
変更をビルドしてサーバーを再起動。

**Commands:**
```bash
cd /home/ubuntu/.mcp-multi-agent/mcp-task-distributor
npm run build
# Restart the server
```

**Acceptance Criteria:**
- [ ] ビルドがエラーなく完了する
- [ ] サーバーが正常に起動する

---

### Phase 3: Frontend Fixes

#### Task 3.1: Improve Error Message Display
**Priority:** High
**Estimated Time:** 20 min
**Assignable to:** Frontend Developer

**Description:**
「(No response)」を情報量の多いエラーメッセージに改善。

**Changes:**
- File: `/home/ubuntu/Downloads/vow/frontend/app/dashboard/hooks/useMcpChat.ts`
- Location: Lines 392-397

**Implementation:**
```typescript
// Add error tracking before the while loop
let lastError: string | null = null;

// In parsing, track errors
if (effectiveType === 'error') {
  lastError = data.error || data.message || 'Unknown error';
  console.error('[useMcpChat] Server error:', lastError);
  // Don't throw immediately, let the stream close naturally
}

// In stream complete section (line 392)
if (!fullContent) {
  const errorMessage = lastError
    ? lastError  // Use the actual error from server
    : '応答がありませんでした。サーバーの状態を確認してください。';

  setMessages(prev => prev.map(msg =>
    msg.id === assistantMessageId
      ? {
          ...msg,
          content: errorMessage,
          status: lastError ? 'error' as const : 'complete' as const
        }
      : msg
  ));
}
```

**Acceptance Criteria:**
- [ ] サーバーからのエラーメッセージが表示される
- [ ] エラー時にステータスが'error'になる
- [ ] 日本語で分かりやすいメッセージが表示される

---

#### Task 3.2: Add Error Status Styling (Optional)
**Priority:** Low
**Estimated Time:** 15 min
**Assignable to:** Frontend Developer

**Description:**
エラーメッセージの視覚的な区別を追加。

**Changes:**
- File: `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`
- Add error state styling to message display

**Acceptance Criteria:**
- [ ] エラーメッセージが視覚的に区別できる
- [ ] 赤色または警告色で表示される

---

### Phase 4: Testing

#### Task 4.1: Manual Testing
**Priority:** High
**Estimated Time:** 30 min
**Assignable to:** Tester

**Test Cases:**

1. **正常系テスト**
   - [ ] メッセージを送信してストリーミング応答を確認
   - [ ] 複数のメッセージでセッション履歴が維持されることを確認

2. **エラー系テスト**
   - [ ] MCPサーバー停止時のエラーメッセージ確認
   - [ ] タイムアウト時のエラーメッセージ確認
   - [ ] 「(No response)」ではなく具体的なエラーが表示されることを確認

3. **互換性テスト**
   - [ ] Mastraエージェントモードが正常に動作することを確認
   - [ ] MCPエージェントモードが正常に動作することを確認

---

### Phase 5: Deployment

#### Task 5.1: Deploy Changes
**Priority:** High
**Estimated Time:** 10 min
**Assignable to:** DevOps

**Steps:**
1. MCP Task Serverの変更をデプロイ（ローカル）
2. フロントエンドの変更をdevブランチにマージ
3. 動作確認

---

## Summary

| Phase | Tasks | Estimated Total Time |
|-------|-------|---------------------|
| Phase 2: Backend | 3 tasks | 55 min |
| Phase 3: Frontend | 2 tasks | 35 min |
| Phase 4: Testing | 1 task | 30 min |
| Phase 5: Deployment | 1 task | 10 min |
| **Total** | **7 tasks** | **~2.5 hours** |

## Dependencies

```
Task 2.1 (stderr propagation)
    |
    v
Task 2.2 (timeout) -----> Task 2.3 (rebuild)
                              |
                              v
                    Task 3.1 (error display)
                              |
                              v
                    Task 3.2 (styling, optional)
                              |
                              v
                    Task 4.1 (testing)
                              |
                              v
                    Task 5.1 (deployment)
```

## Quick Start

最小限の修正で問題を解決するには:

1. **Task 2.1** を実施（stderr propagation）
2. **Task 2.3** を実施（rebuild）
3. **Task 3.1** を実施（error display）
4. テスト

これで「(No response)」の代わりに実際のエラーメッセージが表示されるようになる。
