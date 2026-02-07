/**
 * Session Store - Agent Session Management
 *
 * DynamoDB-based session storage for VowCoachAgent with in-memory fallback.
 * Supports multi-process/server environments with TTL-based expiration.
 *
 * Features:
 * - DynamoDB primary storage with 24-hour TTL
 * - In-memory fallback for development/testing
 * - Interface-based design for easy swapping
 * - Automatic session cleanup
 *
 * @module services/session-store
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { getLogger } from '../utils/logger.js';
import type { CoachSession, CoachMessage } from '../agents/mastra/vow-coach-agent.js';

const logger = getLogger('services.session-store');

/** File path for persisting in-memory sessions across dev server restarts */
const DEV_SESSION_FILE = join(
  process.env['HOME'] || '/tmp',
  '.vow-dev-sessions.json'
);

// =============================================================================
// Constants
// =============================================================================

/** DynamoDB table name for agent sessions */
const SESSIONS_TABLE_NAME = process.env['AGENT_SESSIONS_TABLE'] || 'vow_agent_sessions';

/** Default session TTL in seconds (24 hours) */
const DEFAULT_TTL_SECONDS = 24 * 60 * 60;

/** AWS region */
const AWS_REGION = process.env['AWS_REGION'] || 'ap-northeast-1';

// =============================================================================
// Types
// =============================================================================

/**
 * Session metadata stored alongside session data
 */
export interface SessionMetadata {
  /** Agent type (e.g., 'coach', 'assistant') */
  agentType?: string | undefined;
  /** Locale for the session */
  locale?: 'ja' | 'en' | undefined;
  /** Client info (app version, platform, etc.) */
  clientInfo?: Record<string, unknown> | undefined;
  /** Custom metadata */
  [key: string]: unknown;
}

/**
 * Stored session data format for DynamoDB
 */
export interface StoredSession {
  /** Primary Key: Session ID */
  sessionId: string;
  /** Sort Key: User ID */
  userId: string;
  /** Serialized messages array */
  messages: StoredMessage[];
  /** Session creation timestamp (ISO string) */
  createdAt: string;
  /** Last activity timestamp (ISO string) */
  updatedAt: string;
  /** TTL timestamp for automatic DynamoDB deletion */
  ttl: number;
  /** Quota used in this session */
  quotaUsed: number;
  /** Optional metadata */
  metadata?: SessionMetadata | undefined;
}

/**
 * Message format for storage (Date converted to ISO string)
 */
export interface StoredMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  toolCalls?: {
    toolName: string;
    input: unknown;
    output: unknown;
    success: boolean;
    durationMs: number;
  }[] | undefined;
}

/**
 * Options for session operations
 */
export interface SessionOptions {
  /** TTL in seconds (default: 24 hours) */
  ttlSeconds?: number;
  /** Session metadata */
  metadata?: SessionMetadata;
}

/**
 * Session Store Interface
 * Defines the contract for session storage implementations.
 */
export interface SessionStore {
  /**
   * Get a session by ID and user ID
   */
  getSession(sessionId: string, userId: string): Promise<CoachSession | null>;

  /**
   * Get or create a session
   */
  getOrCreateSession(
    userId: string,
    sessionId?: string,
    options?: SessionOptions
  ): Promise<CoachSession>;

  /**
   * Save/update a session
   */
  saveSession(session: CoachSession, options?: SessionOptions): Promise<void>;

  /**
   * Add a message to a session
   */
  addMessageToSession(
    sessionId: string,
    userId: string,
    message: CoachMessage
  ): Promise<void>;

  /**
   * Delete a session
   */
  deleteSession(sessionId: string, userId: string): Promise<void>;

  /**
   * List sessions for a user
   */
  listUserSessions(userId: string, limit?: number): Promise<CoachSession[]>;

  /**
   * Increment quota used for a session
   */
  incrementQuotaUsed(sessionId: string, userId: string): Promise<void>;

  /**
   * Clear expired sessions (for in-memory store)
   */
  clearExpiredSessions?(): Promise<number>;
}

// =============================================================================
// DynamoDB Session Store
// =============================================================================

/**
 * DynamoDB-based session store for production use.
 * Supports multi-process/server environments with TTL-based expiration.
 */
export class DynamoDBSessionStore implements SessionStore {
  private readonly docClient: DynamoDBDocumentClient;
  private readonly tableName: string;
  private readonly defaultTtlSeconds: number;

  constructor(options?: {
    tableName?: string;
    ttlSeconds?: number;
    region?: string;
  }) {
    this.tableName = options?.tableName || SESSIONS_TABLE_NAME;
    this.defaultTtlSeconds = options?.ttlSeconds || DEFAULT_TTL_SECONDS;

    const dynamoClient = new DynamoDBClient({
      region: options?.region || AWS_REGION,
    });
    this.docClient = DynamoDBDocumentClient.from(dynamoClient, {
      marshallOptions: {
        removeUndefinedValues: true,
      },
    });

    logger.info('DynamoDBSessionStore initialized', {
      tableName: this.tableName,
      ttlSeconds: this.defaultTtlSeconds,
    });
  }

  /**
   * Convert stored session to CoachSession
   */
  private toCoachSession(stored: StoredSession): CoachSession {
    return {
      id: stored.sessionId,
      userId: stored.userId,
      messages: stored.messages.map((m) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      })),
      createdAt: new Date(stored.createdAt),
      lastActivityAt: new Date(stored.updatedAt),
      quotaUsed: stored.quotaUsed,
    };
  }

  /**
   * Convert CoachSession to stored format
   */
  private toStoredSession(
    session: CoachSession,
    options?: SessionOptions
  ): StoredSession {
    const now = new Date();
    const ttlSeconds = options?.ttlSeconds || this.defaultTtlSeconds;
    const ttl = Math.floor(now.getTime() / 1000) + ttlSeconds;

    return {
      sessionId: session.id,
      userId: session.userId,
      messages: session.messages.map((m) => ({
        ...m,
        timestamp: m.timestamp.toISOString(),
      })),
      createdAt: session.createdAt.toISOString(),
      updatedAt: now.toISOString(),
      ttl,
      quotaUsed: session.quotaUsed,
      metadata: options?.metadata,
    };
  }

  async getSession(
    sessionId: string,
    userId: string
  ): Promise<CoachSession | null> {
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { sessionId, userId },
        })
      );

      if (!result.Item) {
        return null;
      }

      return this.toCoachSession(result.Item as StoredSession);
    } catch (error) {
      logger.error('Failed to get session', error as Error, {
        sessionId,
        userId,
      });
      throw error;
    }
  }

  async getOrCreateSession(
    userId: string,
    sessionId?: string,
    options?: SessionOptions
  ): Promise<CoachSession> {
    const id = sessionId || `session_${userId}_${Date.now()}`;

    // Try to get existing session
    const existing = await this.getSession(id, userId);
    if (existing) {
      return existing;
    }

    // Create new session
    const now = new Date();
    const session: CoachSession = {
      id,
      userId,
      messages: [],
      createdAt: now,
      lastActivityAt: now,
      quotaUsed: 0,
    };

    await this.saveSession(session, options);
    logger.info('Created new session', { sessionId: id, userId });

    return session;
  }

  async saveSession(
    session: CoachSession,
    options?: SessionOptions
  ): Promise<void> {
    try {
      const stored = this.toStoredSession(session, options);

      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: stored,
        })
      );

      logger.debug('Session saved', {
        sessionId: session.id,
        userId: session.userId,
        messageCount: session.messages.length,
      });
    } catch (error) {
      logger.error('Failed to save session', error as Error, {
        sessionId: session.id,
        userId: session.userId,
      });
      throw error;
    }
  }

  async addMessageToSession(
    sessionId: string,
    userId: string,
    message: CoachMessage
  ): Promise<void> {
    try {
      const now = new Date();
      const ttl = Math.floor(now.getTime() / 1000) + this.defaultTtlSeconds;

      const storedMessage: StoredMessage = {
        ...message,
        timestamp: message.timestamp.toISOString(),
      };

      await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { sessionId, userId },
          UpdateExpression:
            'SET messages = list_append(if_not_exists(messages, :empty), :msg), updatedAt = :now, #ttl = :ttl',
          ExpressionAttributeNames: {
            '#ttl': 'ttl',
          },
          ExpressionAttributeValues: {
            ':msg': [storedMessage],
            ':empty': [],
            ':now': now.toISOString(),
            ':ttl': ttl,
          },
        })
      );

      logger.debug('Message added to session', {
        sessionId,
        userId,
        role: message.role,
      });
    } catch (error) {
      logger.error('Failed to add message to session', error as Error, {
        sessionId,
        userId,
      });
      throw error;
    }
  }

  async deleteSession(sessionId: string, userId: string): Promise<void> {
    try {
      await this.docClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { sessionId, userId },
        })
      );

      logger.info('Session deleted', { sessionId, userId });
    } catch (error) {
      logger.error('Failed to delete session', error as Error, {
        sessionId,
        userId,
      });
      throw error;
    }
  }

  async listUserSessions(
    userId: string,
    limit: number = 10
  ): Promise<CoachSession[]> {
    try {
      // Note: This requires a GSI on userId for efficient queries
      // For now, we use a Scan with filter (less efficient but works without GSI)
      const result = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'userId-updatedAt-index',
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: {
            ':userId': userId,
          },
          ScanIndexForward: false, // Descending order (newest first)
          Limit: limit,
        })
      );

      return (result.Items || []).map((item) =>
        this.toCoachSession(item as StoredSession)
      );
    } catch (error) {
      // If GSI doesn't exist, fallback to returning empty array
      if (
        error instanceof Error &&
        error.message.includes('ValidationException')
      ) {
        logger.warning('GSI not available for listUserSessions', {
          userId,
          error: error.message,
        });
        return [];
      }
      logger.error('Failed to list user sessions', error as Error, { userId });
      throw error;
    }
  }

  async incrementQuotaUsed(sessionId: string, userId: string): Promise<void> {
    try {
      const now = new Date();
      const ttl = Math.floor(now.getTime() / 1000) + this.defaultTtlSeconds;

      await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { sessionId, userId },
          UpdateExpression:
            'SET quotaUsed = if_not_exists(quotaUsed, :zero) + :one, updatedAt = :now, #ttl = :ttl',
          ExpressionAttributeNames: {
            '#ttl': 'ttl',
          },
          ExpressionAttributeValues: {
            ':one': 1,
            ':zero': 0,
            ':now': now.toISOString(),
            ':ttl': ttl,
          },
        })
      );

      logger.debug('Quota incremented', { sessionId, userId });
    } catch (error) {
      logger.error('Failed to increment quota', error as Error, {
        sessionId,
        userId,
      });
      throw error;
    }
  }
}

// =============================================================================
// In-Memory Session Store (Development/Testing)
// =============================================================================

/**
 * In-memory session store for development and testing.
 * Not suitable for production multi-process environments.
 */
export class InMemorySessionStore implements SessionStore {
  private readonly sessions: Map<string, StoredSession>;
  private readonly defaultTtlSeconds: number;
  private readonly persistFile: string;

  constructor(options?: { ttlSeconds?: number }) {
    this.sessions = new Map();
    this.defaultTtlSeconds = options?.ttlSeconds || DEFAULT_TTL_SECONDS;
    this.persistFile = DEV_SESSION_FILE;

    // Load persisted sessions from file (survives tsx watch restarts)
    this.loadFromFile();

    logger.info('InMemorySessionStore initialized', {
      ttlSeconds: this.defaultTtlSeconds,
      persistFile: this.persistFile,
      loadedSessions: this.sessions.size,
    });
  }

  /**
   * Load sessions from persistence file (for dev server restart survival)
   */
  private loadFromFile(): void {
    try {
      if (!existsSync(this.persistFile)) {
        return;
      }
      const data = readFileSync(this.persistFile, 'utf-8');
      const entries: Array<[string, StoredSession]> = JSON.parse(data);
      const now = Math.floor(Date.now() / 1000);
      let loaded = 0;
      let expired = 0;
      for (const [key, session] of entries) {
        if (session.ttl >= now) {
          this.sessions.set(key, session);
          loaded++;
        } else {
          expired++;
        }
      }
      logger.info('Loaded sessions from file', {
        file: this.persistFile,
        loaded,
        expired,
      });
    } catch (err) {
      logger.warning('Failed to load sessions from file (starting fresh)', {
        file: this.persistFile,
        error: (err as Error).message,
      });
    }
  }

  /**
   * Persist sessions to file (fire-and-forget, best effort)
   */
  private saveToFile(): void {
    try {
      const dir = dirname(this.persistFile);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      const entries = Array.from(this.sessions.entries());
      writeFileSync(this.persistFile, JSON.stringify(entries), 'utf-8');
    } catch (err) {
      logger.warning('Failed to persist sessions to file', {
        file: this.persistFile,
        error: (err as Error).message,
      });
    }
  }

  /**
   * Generate composite key for session lookup
   */
  private getKey(sessionId: string, userId: string): string {
    return `${sessionId}::${userId}`;
  }

  /**
   * Convert stored session to CoachSession
   */
  private toCoachSession(stored: StoredSession): CoachSession {
    return {
      id: stored.sessionId,
      userId: stored.userId,
      messages: stored.messages.map((m) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      })),
      createdAt: new Date(stored.createdAt),
      lastActivityAt: new Date(stored.updatedAt),
      quotaUsed: stored.quotaUsed,
    };
  }

  async getSession(
    sessionId: string,
    userId: string
  ): Promise<CoachSession | null> {
    const key = this.getKey(sessionId, userId);
    const stored = this.sessions.get(key);

    if (!stored) {
      logger.info('Session not found in memory', { sessionId, userId, key, totalSessions: this.sessions.size });
      return null;
    }

    // Check TTL
    const now = Math.floor(Date.now() / 1000);
    if (stored.ttl < now) {
      this.sessions.delete(key);
      logger.info('Session expired (TTL)', { sessionId, userId });
      return null;
    }

    logger.info('Session found in memory', {
      sessionId,
      userId,
      messageCount: stored.messages.length,
    });
    return this.toCoachSession(stored);
  }

  async getOrCreateSession(
    userId: string,
    sessionId?: string,
    options?: SessionOptions
  ): Promise<CoachSession> {
    const id = sessionId || `session_${userId}_${Date.now()}`;

    // Try to get existing session
    const existing = await this.getSession(id, userId);
    if (existing) {
      return existing;
    }

    // Create new session
    const now = new Date();
    const session: CoachSession = {
      id,
      userId,
      messages: [],
      createdAt: now,
      lastActivityAt: now,
      quotaUsed: 0,
    };

    await this.saveSession(session, options);
    logger.info('Created new in-memory session', { sessionId: id, userId, totalSessions: this.sessions.size });

    return session;
  }

  async saveSession(
    session: CoachSession,
    options?: SessionOptions
  ): Promise<void> {
    const now = new Date();
    const ttlSeconds = options?.ttlSeconds || this.defaultTtlSeconds;
    const ttl = Math.floor(now.getTime() / 1000) + ttlSeconds;

    const stored: StoredSession = {
      sessionId: session.id,
      userId: session.userId,
      messages: session.messages.map((m) => ({
        ...m,
        timestamp: m.timestamp.toISOString(),
      })),
      createdAt: session.createdAt.toISOString(),
      updatedAt: now.toISOString(),
      ttl,
      quotaUsed: session.quotaUsed,
      metadata: options?.metadata,
    };

    const key = this.getKey(session.id, session.userId);
    this.sessions.set(key, stored);
    this.saveToFile();

    logger.debug('In-memory session saved', {
      sessionId: session.id,
      userId: session.userId,
      messageCount: session.messages.length,
    });
  }

  async addMessageToSession(
    sessionId: string,
    userId: string,
    message: CoachMessage
  ): Promise<void> {
    const key = this.getKey(sessionId, userId);
    const stored = this.sessions.get(key);

    if (!stored) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const now = new Date();
    const storedMessage: StoredMessage = {
      ...message,
      timestamp: message.timestamp.toISOString(),
    };

    stored.messages.push(storedMessage);
    stored.updatedAt = now.toISOString();
    stored.ttl = Math.floor(now.getTime() / 1000) + this.defaultTtlSeconds;

    this.sessions.set(key, stored);
    this.saveToFile();

    logger.info('Message added to in-memory session', {
      sessionId,
      userId,
      role: message.role,
      totalMessages: stored.messages.length,
    });
  }

  async deleteSession(sessionId: string, userId: string): Promise<void> {
    const key = this.getKey(sessionId, userId);
    this.sessions.delete(key);
    this.saveToFile();
    logger.info('In-memory session deleted', { sessionId, userId });
  }

  async listUserSessions(
    userId: string,
    limit: number = 10
  ): Promise<CoachSession[]> {
    const userSessions: StoredSession[] = [];
    const now = Math.floor(Date.now() / 1000);

    for (const stored of this.sessions.values()) {
      if (stored.userId === userId && stored.ttl >= now) {
        userSessions.push(stored);
      }
    }

    // Sort by updatedAt descending
    userSessions.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    return userSessions.slice(0, limit).map((s) => this.toCoachSession(s));
  }

  async incrementQuotaUsed(sessionId: string, userId: string): Promise<void> {
    const key = this.getKey(sessionId, userId);
    const stored = this.sessions.get(key);

    if (!stored) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    stored.quotaUsed = (stored.quotaUsed || 0) + 1;
    stored.updatedAt = new Date().toISOString();

    this.sessions.set(key, stored);
    this.saveToFile();
    logger.debug('In-memory quota incremented', { sessionId, userId });
  }

  async clearExpiredSessions(): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    let cleared = 0;

    for (const [key, stored] of this.sessions.entries()) {
      if (stored.ttl < now) {
        this.sessions.delete(key);
        cleared++;
      }
    }

    if (cleared > 0) {
      logger.info('Cleared expired in-memory sessions', { count: cleared });
    }

    return cleared;
  }
}

// =============================================================================
// Factory and Singleton Management
// =============================================================================

let sessionStoreInstance: SessionStore | null = null;

/**
 * Session store configuration options
 */
export interface SessionStoreConfig {
  /** Use in-memory store instead of DynamoDB */
  useInMemory?: boolean;
  /** DynamoDB table name (for DynamoDB store) */
  tableName?: string;
  /** TTL in seconds */
  ttlSeconds?: number;
  /** AWS region (for DynamoDB store) */
  region?: string;
}

/**
 * Get or create the session store singleton.
 *
 * By default, uses DynamoDB in production (NODE_ENV=production)
 * and in-memory store in development.
 *
 * @param config - Optional configuration to override defaults
 */
export function getSessionStore(config?: SessionStoreConfig): SessionStore {
  if (sessionStoreInstance) {
    return sessionStoreInstance;
  }

  const isProduction = process.env['NODE_ENV'] === 'production';
  const useInMemory = config?.useInMemory ?? !isProduction;

  if (useInMemory) {
    const ttlSeconds = config?.ttlSeconds;
    sessionStoreInstance = new InMemorySessionStore(
      ttlSeconds !== undefined ? { ttlSeconds } : undefined
    );
  } else {
    const storeOptions: { tableName?: string; ttlSeconds?: number; region?: string } = {};
    if (config?.tableName !== undefined) storeOptions.tableName = config.tableName;
    if (config?.ttlSeconds !== undefined) storeOptions.ttlSeconds = config.ttlSeconds;
    if (config?.region !== undefined) storeOptions.region = config.region;

    sessionStoreInstance = new DynamoDBSessionStore(
      Object.keys(storeOptions).length > 0 ? storeOptions : undefined
    );
  }

  logger.info('Session store initialized', {
    type: useInMemory ? 'InMemory' : 'DynamoDB',
    isProduction,
  });

  return sessionStoreInstance;
}

/**
 * Reset the session store singleton (for testing)
 */
export function resetSessionStore(): void {
  sessionStoreInstance = null;
  logger.debug('Session store reset');
}

/**
 * Create a DynamoDB session store (explicit factory)
 */
export function createDynamoDBSessionStore(
  options?: SessionStoreConfig
): DynamoDBSessionStore {
  const storeOptions: { tableName?: string; ttlSeconds?: number; region?: string } = {};
  if (options?.tableName !== undefined) storeOptions.tableName = options.tableName;
  if (options?.ttlSeconds !== undefined) storeOptions.ttlSeconds = options.ttlSeconds;
  if (options?.region !== undefined) storeOptions.region = options.region;

  return new DynamoDBSessionStore(
    Object.keys(storeOptions).length > 0 ? storeOptions : undefined
  );
}

/**
 * Create an in-memory session store (explicit factory)
 */
export function createInMemorySessionStore(
  options?: SessionStoreConfig
): InMemorySessionStore {
  const ttlSeconds = options?.ttlSeconds;
  return new InMemorySessionStore(
    ttlSeconds !== undefined ? { ttlSeconds } : undefined
  );
}
