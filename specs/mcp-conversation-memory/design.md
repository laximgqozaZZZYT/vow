# MCP Conversation Memory - Technical Design

## Overview
- **Purpose**: MCPサーバーとフロントエンドの会話記憶機能の技術設計
- **Status**: Draft
- **Version**: 1.0.0
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect

## Architecture

### Current Architecture (問題あり)

```
┌─────────────────────────────────────────────────────────────────┐
│ Frontend (Browser)                                               │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ useMcpChat.ts                                             │   │
│ │ - sessionIdRef = useRef(new random ID)  ← 毎回新規生成    │   │
│ │ - No localStorage persistence           ← 永続化なし     │   │
│ └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ POST /agents/:id/chat
┌─────────────────────────────────────────────────────────────────┐
│ MCP Server (server.ts)                                          │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ chatHistories = new Map<string, SessionData>()            │   │
│ │                       ↑                                    │   │
│ │           インメモリのみ（再起動で消失）                   │   │
│ └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Proposed Architecture (改善後)

```
┌─────────────────────────────────────────────────────────────────┐
│ Frontend (Browser)                                               │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ useMcpChat.ts                                             │   │
│ │ - sessionId from localStorage (or create new)             │   │
│ │ - localStorage.setItem('mcp_session_id', sessionId)       │   │
│ │ - clearMessages() resets sessionId                        │   │
│ └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ POST /agents/:id/chat
┌─────────────────────────────────────────────────────────────────┐
│ MCP Server (server.ts)                                          │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ SessionManager                                             │   │
│ │ ┌─────────────────┐      ┌─────────────────────────────┐  │   │
│ │ │ In-Memory Cache │ ←──→ │ File Persistence            │  │   │
│ │ │ (Map)           │      │ sessions/{sessionId}.json   │  │   │
│ │ └─────────────────┘      └─────────────────────────────┘  │   │
│ └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Technical Design

### 1. Frontend Changes (useMcpChat.ts)

#### 1.1 SessionId Persistence Key
```typescript
const STORAGE_KEY = 'vow_mcp_session_id';
```

#### 1.2 SessionId Initialization
```typescript
// Before (問題のあるコード)
const sessionIdRef = useRef<string>(`mcp-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

// After (修正後)
const getOrCreateSessionId = (): string => {
  if (typeof window === 'undefined') {
    return `mcp-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    return stored;
  }

  const newId = `mcp-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  localStorage.setItem(STORAGE_KEY, newId);
  return newId;
};

const sessionIdRef = useRef<string>(getOrCreateSessionId());
```

#### 1.3 Session Reset on clearMessages()
```typescript
const clearMessages = useCallback(() => {
  // ... existing code ...

  // Reset sessionId to start a fresh conversation on the server
  const newSessionId = `mcp-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  sessionIdRef.current = newSessionId;

  // Update localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, newSessionId);
  }
}, [systemMessage]);
```

#### 1.4 Session Update from Server Response
```typescript
// Server returns sessionId in 'session' or 'complete' events
if ((effectiveType === 'session' || effectiveType === 'start') && data.sessionId) {
  sessionIdRef.current = data.sessionId;
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, data.sessionId);
  }
}
```

### 2. Backend Changes (server.ts)

#### 2.1 Session Storage Directory
```typescript
const SESSIONS_DIR = path.join(__dirname, '../sessions');

// Ensure directory exists on startup
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}
```

#### 2.2 SessionManager Class
```typescript
interface SessionData {
  history: ChatMessage[];
  systemPrompt?: string;
  createdAt: Date;
  updatedAt: Date;
  ttl: number; // seconds
}

class SessionManager {
  private cache: Map<string, SessionData> = new Map();
  private sessionsDir: string;

  constructor(sessionsDir: string) {
    this.sessionsDir = sessionsDir;
    this.loadAllSessions();
  }

  private getFilePath(sessionId: string): string {
    // Sanitize sessionId to prevent path traversal
    const sanitized = sessionId.replace(/[^a-zA-Z0-9-_]/g, '');
    return path.join(this.sessionsDir, `${sanitized}.json`);
  }

  async get(sessionId: string): Promise<SessionData | null> {
    // Check cache first
    if (this.cache.has(sessionId)) {
      const data = this.cache.get(sessionId)!;
      // Check TTL
      if (this.isExpired(data)) {
        await this.delete(sessionId);
        return null;
      }
      return data;
    }

    // Load from file
    return await this.loadFromFile(sessionId);
  }

  async set(sessionId: string, data: SessionData): Promise<void> {
    data.updatedAt = new Date();
    this.cache.set(sessionId, data);
    await this.saveToFile(sessionId, data);
  }

  async delete(sessionId: string): Promise<void> {
    this.cache.delete(sessionId);
    const filePath = this.getFilePath(sessionId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  private async saveToFile(sessionId: string, data: SessionData): Promise<void> {
    const filePath = this.getFilePath(sessionId);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  private async loadFromFile(sessionId: string): Promise<SessionData | null> {
    const filePath = this.getFilePath(sessionId);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content) as SessionData;
      // Restore Date objects
      data.createdAt = new Date(data.createdAt);
      data.updatedAt = new Date(data.updatedAt);
      data.history.forEach(msg => msg.timestamp = new Date(msg.timestamp));

      // Check TTL
      if (this.isExpired(data)) {
        await this.delete(sessionId);
        return null;
      }

      this.cache.set(sessionId, data);
      return data;
    } catch (err) {
      console.error(`[SessionManager] Failed to load session ${sessionId}:`, err);
      return null;
    }
  }

  private loadAllSessions(): void {
    if (!fs.existsSync(this.sessionsDir)) return;

    const files = fs.readdirSync(this.sessionsDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const sessionId = file.replace('.json', '');
        this.loadFromFile(sessionId);
      }
    }
    console.log(`[SessionManager] Loaded ${this.cache.size} sessions from disk`);
  }

  private isExpired(data: SessionData): boolean {
    const now = Date.now();
    const updatedAt = data.updatedAt.getTime();
    const ttlMs = (data.ttl || 86400) * 1000; // default 24 hours
    return (now - updatedAt) > ttlMs;
  }
}
```

#### 2.3 Chat Endpoint Update
```typescript
// Replace the simple Map with SessionManager
const sessionManager = new SessionManager(SESSIONS_DIR);

app.post('/agents/:agentId/chat', async (req, res) => {
  const { message, sessionId: reqSessionId, systemPrompt } = req.body;
  const sessionId = reqSessionId || `chat-${uuidv4().slice(0, 8)}`;

  // Get or create session using SessionManager
  let sessionData = await sessionManager.get(sessionId);
  if (!sessionData) {
    sessionData = {
      history: [],
      systemPrompt: systemPrompt,
      createdAt: new Date(),
      updatedAt: new Date(),
      ttl: 86400, // 24 hours
    };
  } else if (systemPrompt && !sessionData.systemPrompt) {
    sessionData.systemPrompt = systemPrompt;
  }

  // ... rest of the chat logic ...

  // Save session after receiving response
  claudeProcess.on('close', async (code) => {
    sessionData.history.push({ role: 'user', content: message, timestamp: new Date() });
    sessionData.history.push({ role: 'assistant', content: fullResponse.trim(), timestamp: new Date() });

    // Keep only last 100 messages
    if (sessionData.history.length > 100) {
      sessionData.history = sessionData.history.slice(-100);
    }

    await sessionManager.set(sessionId, sessionData);

    // ... rest of the close handler ...
  });
});
```

### 3. API Endpoints

#### 3.1 List Sessions
```
GET /sessions
Response: {
  success: true,
  data: {
    totalSessions: number,
    sessions: {
      [sessionId]: {
        historyLength: number,
        hasSystemPrompt: boolean,
        lastMessage?: string,
        createdAt: string,
        updatedAt: string,
      }
    }
  }
}
```

#### 3.2 Get Session Detail
```
GET /sessions/:sessionId
Response: {
  success: true,
  data: {
    sessionId: string,
    history: ChatMessage[],
    systemPrompt?: string,
    createdAt: string,
    updatedAt: string,
  }
}
```

#### 3.3 Delete Session
```
DELETE /sessions/:sessionId
Response: {
  success: true,
  data: { deleted: true }
}
```

## Data Structures

### ChatMessage
```typescript
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}
```

### SessionData
```typescript
interface SessionData {
  history: ChatMessage[];
  systemPrompt?: string;
  createdAt: Date;
  updatedAt: Date;
  ttl: number; // seconds, default 86400 (24h)
}
```

### Session File Format
```json
{
  "history": [
    {
      "role": "user",
      "content": "Hello",
      "timestamp": "2026-02-04T12:00:00.000Z"
    },
    {
      "role": "assistant",
      "content": "Hi! How can I help you?",
      "timestamp": "2026-02-04T12:00:01.000Z"
    }
  ],
  "systemPrompt": "You are a helpful assistant.",
  "createdAt": "2026-02-04T12:00:00.000Z",
  "updatedAt": "2026-02-04T12:00:01.000Z",
  "ttl": 86400
}
```

## Dependencies

### New Dependencies (server.ts)
- None (uses Node.js built-in `fs` and `path` modules)

### Frontend Dependencies
- None (uses browser's localStorage API)

## Testing Strategy

1. **Unit Tests**
   - SessionManager class methods
   - Session expiration logic
   - File read/write operations

2. **Integration Tests**
   - Full chat flow with session persistence
   - Server restart and session recovery
   - Concurrent session access

3. **E2E Tests**
   - Browser reload maintains conversation
   - New conversation clears history
   - Long conversation truncation

## Migration Plan

1. Deploy backend changes first (backward compatible)
2. Deploy frontend changes
3. Monitor for any session-related errors
4. Clean up old in-memory code after verification
