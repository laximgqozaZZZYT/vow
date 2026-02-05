# MCP Conversation Memory - Implementation Tasks

## Overview
- **Purpose**: 会話記憶機能実装のタスク分解
- **Status**: Ready for Implementation
- **Version**: 1.0.0
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect

## Task Summary

| Task ID | Task Name | Estimated Time | Priority | Dependencies |
|---------|-----------|----------------|----------|--------------|
| MEM-001 | Frontend: sessionId localStorage persistence | 30min | High | None |
| MEM-002 | Backend: SessionManager class | 1h | High | None |
| MEM-003 | Backend: Chat endpoint integration | 30min | High | MEM-002 |
| MEM-004 | Backend: Session management API | 30min | Medium | MEM-002 |
| MEM-005 | Testing and verification | 30min | High | MEM-001, MEM-003 |

**Total Estimated Time**: 3 hours

---

## Task Details

### MEM-001: Frontend sessionId localStorage Persistence

**File**: `/home/ubuntu/Downloads/vow/frontend/app/dashboard/hooks/useMcpChat.ts`

**Description**: sessionIdをlocalStorageに永続化し、ページリロード後も同じセッションを維持する

**Changes**:
1. Storage key定数を追加
2. getOrCreateSessionId関数を追加
3. sessionIdRef初期化を修正
4. clearMessages関数でlocalStorageも更新
5. サーバーからのsessionId更新時にlocalStorageも更新

**Acceptance Criteria**:
- [AC-001] ページリロード後も同じsessionIdが使用される
- [AC-002] clearMessages()実行後は新しいsessionIdが生成される
- [AC-003] localStorageにsessionIdが保存される

**Assignable to**: Frontend Developer

---

### MEM-002: Backend SessionManager Class

**File**: `/home/ubuntu/.mcp-multi-agent/mcp-task-distributor/src/server.ts`

**Description**: セッション永続化を担当するSessionManagerクラスを実装

**Changes**:
1. SessionManagerクラスを新規作成
2. ファイルベースの永続化ロジック
3. メモリキャッシュとの同期
4. TTL（有効期限）チェック
5. サーバー起動時の既存セッション読み込み

**Acceptance Criteria**:
- [AC-001] セッションがJSONファイルとして保存される
- [AC-002] サーバー再起動後もセッションが復元される
- [AC-003] TTL超過したセッションは自動削除される
- [AC-004] 最大メッセージ数を超えた履歴は古いものから削除される

**Assignable to**: Backend Developer

---

### MEM-003: Backend Chat Endpoint Integration

**File**: `/home/ubuntu/.mcp-multi-agent/mcp-task-distributor/src/server.ts`

**Description**: ChatエンドポイントをSessionManagerを使用するように更新

**Changes**:
1. 既存のchatHistories Mapを削除
2. SessionManagerインスタンスを使用
3. GET/POST両方のchatエンドポイントを更新
4. セッション保存のエラーハンドリング追加

**Acceptance Criteria**:
- [AC-001] 会話がファイルに永続化される
- [AC-002] 既存のAPIレスポンス形式が維持される
- [AC-003] エラー時も適切にレスポンスが返される

**Prerequisites**: MEM-002

**Assignable to**: Backend Developer

---

### MEM-004: Backend Session Management API

**File**: `/home/ubuntu/.mcp-multi-agent/mcp-task-distributor/src/server.ts`

**Description**: セッション管理用のAPIエンドポイントを追加

**Changes**:
1. DELETE /sessions/:sessionId エンドポイント追加
2. 既存の GET /sessions, GET /sessions/:sessionId を更新（永続化データを返す）

**Acceptance Criteria**:
- [AC-001] セッションを削除できる
- [AC-002] セッション一覧にファイルベースのデータが含まれる

**Prerequisites**: MEM-002

**Assignable to**: Backend Developer

---

### MEM-005: Testing and Verification

**Description**: 実装した機能のテストと検証

**Test Cases**:
1. フロントエンドでページをリロードし、会話が継続することを確認
2. MCPサーバーを再起動し、会話履歴が復元されることを確認
3. clearMessages()を実行し、新しいセッションが開始されることを確認
4. 24時間以上経過したセッションが削除されることを確認（TTLテスト用に短い値で検証）

**Acceptance Criteria**:
- [AC-001] 全テストケースがパスする
- [AC-002] サーバーログにセッション操作が記録される

**Prerequisites**: MEM-001, MEM-003

**Assignable to**: Tester / Developer

---

## Implementation Order

```
┌─────────────────────────────────────────────────────────────┐
│  Phase 1: Core Implementation (Parallel)                    │
│  ┌─────────────────┐     ┌─────────────────────────────┐   │
│  │    MEM-001      │     │        MEM-002             │   │
│  │   Frontend      │     │       Backend              │   │
│  │  (30 min)       │     │      (1 hour)              │   │
│  └────────┬────────┘     └──────────┬──────────────────┘   │
│           │                         │                       │
└───────────┼─────────────────────────┼───────────────────────┘
            │                         │
            │                         ▼
            │              ┌─────────────────────────────┐
            │              │        MEM-003             │
            │              │  Chat Endpoint Integration │
            │              │      (30 min)              │
            │              └──────────┬──────────────────┘
            │                         │
            │                         ▼
            │              ┌─────────────────────────────┐
            │              │        MEM-004             │
            │              │  Session Management API    │
            │              │      (30 min)              │
            │              └──────────┬──────────────────┘
            │                         │
            ▼                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Phase 2: Testing                                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    MEM-005                          │   │
│  │              Testing & Verification                 │   │
│  │                   (30 min)                          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Quick Implementation Guide

### For Immediate Fix (Minimal Changes)

最小限の修正で問題を解決する場合、以下の2つの変更のみ実施:

**1. useMcpChat.ts (Line 92付近)**
```typescript
// Before
const sessionIdRef = useRef<string>(`mcp-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

// After
const STORAGE_KEY = 'vow_mcp_session_id';
const getOrCreateSessionId = (): string => {
  if (typeof window === 'undefined') {
    return `mcp-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;
  const newId = `mcp-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  localStorage.setItem(STORAGE_KEY, newId);
  return newId;
};
const sessionIdRef = useRef<string>(getOrCreateSessionId());
```

**2. clearMessages関数 (Line 505-518付近)**
```typescript
const clearMessages = useCallback(() => {
  setMessages(systemMessage ? [{
    id: generateMessageId(),
    role: 'system',
    content: systemMessage,
    status: 'complete',
    timestamp: new Date(),
  }] : []);
  setError(null);
  setConnectionState('idle');
  lastUserMessageRef.current = null;

  // Reset sessionId and update localStorage
  const newSessionId = `mcp-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  sessionIdRef.current = newSessionId;
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, newSessionId);
  }
}, [systemMessage]);
```

これだけで、ページリロード後も同じセッションが維持され、サーバー側で会話履歴が正しく使用されるようになります。
（注: サーバー再起動時の永続化は別途MEM-002/003の実装が必要）

---

## Agent Coordination Notes

- MEM-001とMEM-002は並列で実装可能
- MEM-003はMEM-002完了後に実施
- MEM-004はオプション（優先度低め）
- MEM-005は全タスク完了後に実施

各エージェントは作業開始前に `/home/ubuntu/Downloads/vow/specs/COORDINATION.md` を更新してください。
