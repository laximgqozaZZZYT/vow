/**
 * Credentials Store - User API Credentials Management
 *
 * DynamoDB-based storage for user API credentials (OpenAI, etc.)
 * with AES-256-GCM encryption and in-memory fallback.
 *
 * Features:
 * - DynamoDB primary storage
 * - AES-256-GCM encryption for API keys
 * - In-memory fallback for development
 * - Per-user credential management
 *
 * Security:
 * - API keys are encrypted before storage
 * - Encryption key from environment variable (CREDENTIALS_ENCRYPTION_KEY)
 * - Unique IV for each encryption operation
 *
 * @module services/credentials-store
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { getLogger } from '../utils/logger.js';
import { getSettings } from '../config.js';

const logger = getLogger('services.credentials-store');

// =============================================================================
// Constants
// =============================================================================

/** DynamoDB table name for user credentials */
const CREDENTIALS_TABLE_NAME = process.env['USER_CREDENTIALS_TABLE'] || 'vow_user_credentials';

/** AWS region */
const AWS_REGION = process.env['AWS_REGION'] || 'ap-northeast-1';

/** Encryption algorithm */
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

/** IV length for AES-GCM */
const IV_LENGTH = 16;

/** Auth tag length for AES-GCM (16 bytes = 128 bits) */
// AUTH_TAG_LENGTH = 16 (used implicitly by GCM mode)

/** Salt for key derivation */
const KEY_SALT = 'vow-credentials-salt-v1';

// =============================================================================
// Encryption Utilities
// =============================================================================

/**
 * Get the encryption key from environment variable.
 * Derives a 32-byte key using scrypt.
 */
function getEncryptionKey(): Buffer {
  const secretKey = getSettings().credentialsEncryptionKey;

  if (!secretKey) {
    logger.warning('CREDENTIALS_ENCRYPTION_KEY not set, using fallback key (NOT SECURE FOR PRODUCTION)');
    // Fallback for development - NOT SECURE FOR PRODUCTION
    return scryptSync('dev-fallback-key-not-secure', KEY_SALT, 32);
  }

  // Derive a 32-byte key from the secret using scrypt
  return scryptSync(secretKey, KEY_SALT, 32);
}

/**
 * Encrypt a string using AES-256-GCM.
 * Returns format: iv:authTag:encryptedData (all base64 encoded)
 */
function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  // Combine IV, auth tag, and encrypted data
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt a string encrypted with AES-256-GCM.
 * Expects format: iv:authTag:encryptedData (all base64 encoded)
 */
function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();

  const parts = encryptedData.split(':');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new Error('Invalid encrypted data format');
  }

  const ivPart = parts[0];
  const authTagPart = parts[1];
  const encrypted = parts[2];

  const iv = Buffer.from(ivPart, 'base64');
  const authTag = Buffer.from(authTagPart, 'base64');

  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = decipher.update(encrypted, 'base64', 'utf8') + decipher.final('utf8');

  return decrypted;
}

/**
 * Check if a string appears to be encrypted (has the expected format)
 */
function isEncrypted(data: string): boolean {
  const parts = data.split(':');
  return parts.length === 3;
}

// =============================================================================
// Types
// =============================================================================

/**
 * Supported credential types
 */
export type CredentialType = 'openai' | 'anthropic' | 'gemini' | 'codex' | 'custom';

/**
 * AI Provider configuration
 */
export interface AIProviderConfig {
  id: CredentialType;
  name: string;
  nameJa: string;
  defaultModel: string;
  models: string[];
  supportsChat: boolean;
  supportsCompletion: boolean;
}

/**
 * Available AI providers configuration
 */
export const AI_PROVIDERS: Record<CredentialType, AIProviderConfig> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    nameJa: 'OpenAI',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
    supportsChat: true,
    supportsCompletion: true,
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    nameJa: 'Anthropic Claude',
    defaultModel: 'claude-sonnet-4-20250514',
    models: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
    supportsChat: true,
    supportsCompletion: false,
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    nameJa: 'Google Gemini',
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    supportsChat: true,
    supportsCompletion: true,
  },
  codex: {
    id: 'codex',
    name: 'OpenAI Codex',
    nameJa: 'OpenAI Codex',
    defaultModel: 'codex-mini-latest',
    models: ['codex-mini-latest', 'o3-mini', 'o1-mini', 'o1'],
    supportsChat: true,
    supportsCompletion: true,
  },
  custom: {
    id: 'custom',
    name: 'Custom Provider',
    nameJa: 'カスタムプロバイダー',
    defaultModel: '',
    models: [],
    supportsChat: true,
    supportsCompletion: true,
  },
};

/**
 * Stored credential data (with encrypted API key)
 */
export interface StoredCredential {
  /** Primary Key: User ID */
  userId: string;
  /** Sort Key: Credential type */
  credentialType: CredentialType;
  /** Encrypted API key */
  encryptedApiKey: string;
  /** Optional model configuration */
  model?: string | undefined;
  /** Optional API endpoint override */
  endpoint?: string | undefined;
  /** Creation timestamp (ISO string) */
  createdAt: string;
  /** Last updated timestamp (ISO string) */
  updatedAt: string;
  /** Whether the credential is active */
  isActive: boolean;
  /** Optional metadata */
  metadata?: Record<string, unknown> | undefined;
}

/**
 * Decrypted credential for use
 */
export interface DecryptedCredential {
  userId: string;
  credentialType: CredentialType;
  apiKey: string;
  model?: string | undefined;
  endpoint?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

/**
 * Credential input for saving
 */
export interface CredentialInput {
  apiKey: string;
  model?: string | undefined;
  endpoint?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

/**
 * Credential Store Interface
 */
export interface CredentialsStore {
  /**
   * Get a credential by user ID and type
   */
  getCredential(userId: string, type: CredentialType): Promise<DecryptedCredential | null>;

  /**
   * Save or update a credential
   */
  saveCredential(userId: string, type: CredentialType, input: CredentialInput): Promise<void>;

  /**
   * Delete a credential
   */
  deleteCredential(userId: string, type: CredentialType): Promise<void>;

  /**
   * Check if a user has a specific credential
   */
  hasCredential(userId: string, type: CredentialType): Promise<boolean>;

  /**
   * Get the API key for a specific service
   */
  getApiKey(userId: string, type: CredentialType): Promise<string | null>;
}

// =============================================================================
// DynamoDB Credentials Store
// =============================================================================

/**
 * DynamoDB-based credentials store with AES-256-GCM encryption.
 */
export class DynamoDBCredentialsStore implements CredentialsStore {
  private readonly docClient: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor(options?: {
    tableName?: string;
    region?: string;
  }) {
    this.tableName = options?.tableName || CREDENTIALS_TABLE_NAME;

    const dynamoClient = new DynamoDBClient({
      region: options?.region || AWS_REGION,
    });
    this.docClient = DynamoDBDocumentClient.from(dynamoClient, {
      marshallOptions: {
        removeUndefinedValues: true,
      },
    });

    logger.info('DynamoDBCredentialsStore initialized', {
      tableName: this.tableName,
    });
  }

  async getCredential(
    userId: string,
    type: CredentialType
  ): Promise<DecryptedCredential | null> {
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { userId, credentialType: type },
        })
      );

      if (!result.Item) {
        return null;
      }

      const stored = result.Item as StoredCredential;

      // Only return active credentials
      if (!stored.isActive) {
        return null;
      }

      // Decrypt the API key
      let apiKey: string;
      try {
        apiKey = decrypt(stored.encryptedApiKey);
      } catch (decryptError) {
        logger.error('Failed to decrypt API key', decryptError as Error, {
          userId,
          type,
        });
        return null;
      }

      return {
        userId: stored.userId,
        credentialType: stored.credentialType,
        apiKey,
        model: stored.model,
        endpoint: stored.endpoint,
        createdAt: stored.createdAt,
        updatedAt: stored.updatedAt,
      };
    } catch (error) {
      logger.error('Failed to get credential', error as Error, {
        userId,
        type,
      });
      return null;
    }
  }

  async saveCredential(
    userId: string,
    type: CredentialType,
    input: CredentialInput
  ): Promise<void> {
    try {
      const now = new Date().toISOString();

      // Encrypt the API key
      const encryptedApiKey = encrypt(input.apiKey);

      // Check if credential exists
      const existingResult = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { userId, credentialType: type },
        })
      );

      if (existingResult.Item) {
        // Update existing credential
        // Build UpdateExpression dynamically to avoid referencing
        // undefined values that removeUndefinedValues would strip
        // from ExpressionAttributeValues.
        const setClauses: string[] = [
          'encryptedApiKey = :encryptedApiKey',
          '#model = :model',
          'updatedAt = :updatedAt',
          'isActive = :isActive',
        ];
        const exprAttrValues: Record<string, unknown> = {
          ':encryptedApiKey': encryptedApiKey,
          ':model': input.model,
          ':updatedAt': now,
          ':isActive': true,
        };
        const exprAttrNames: Record<string, string> = {
          '#model': 'model',
        };

        if (input.endpoint !== undefined) {
          setClauses.push('endpoint = :endpoint');
          exprAttrValues[':endpoint'] = input.endpoint;
        }

        if (input.metadata !== undefined) {
          setClauses.push('#metadata = :metadata');
          exprAttrValues[':metadata'] = input.metadata;
          exprAttrNames['#metadata'] = 'metadata';
        }

        await this.docClient.send(
          new UpdateCommand({
            TableName: this.tableName,
            Key: { userId, credentialType: type },
            UpdateExpression: `SET ${setClauses.join(', ')}`,
            ExpressionAttributeNames: exprAttrNames,
            ExpressionAttributeValues: exprAttrValues,
          })
        );
      } else {
        // Create new credential
        const credential: StoredCredential = {
          userId,
          credentialType: type,
          encryptedApiKey,
          model: input.model,
          endpoint: input.endpoint,
          createdAt: now,
          updatedAt: now,
          isActive: true,
          metadata: input.metadata,
        };

        await this.docClient.send(
          new PutCommand({
            TableName: this.tableName,
            Item: credential,
          })
        );
      }

      logger.info('Credential saved (encrypted)', { userId, type });
    } catch (error) {
      logger.error('Failed to save credential', error as Error, {
        userId,
        type,
      });
      throw error;
    }
  }

  async deleteCredential(userId: string, type: CredentialType): Promise<void> {
    try {
      // Soft delete by setting isActive to false
      await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { userId, credentialType: type },
          UpdateExpression: 'SET isActive = :isActive, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':isActive': false,
            ':updatedAt': new Date().toISOString(),
          },
        })
      );

      logger.info('Credential deleted', { userId, type });
    } catch (error) {
      logger.error('Failed to delete credential', error as Error, {
        userId,
        type,
      });
      throw error;
    }
  }

  async hasCredential(userId: string, type: CredentialType): Promise<boolean> {
    const credential = await this.getCredential(userId, type);
    return credential !== null;
  }

  async getApiKey(userId: string, type: CredentialType): Promise<string | null> {
    const credential = await this.getCredential(userId, type);
    return credential?.apiKey || null;
  }
}

// =============================================================================
// In-Memory Credentials Store (Development/Testing)
// =============================================================================

/**
 * In-memory credentials store with encryption for development and testing.
 */
export class InMemoryCredentialsStore implements CredentialsStore {
  private readonly credentials: Map<string, StoredCredential>;

  constructor() {
    this.credentials = new Map();
    logger.info('InMemoryCredentialsStore initialized');
  }

  private getKey(userId: string, type: CredentialType): string {
    return `${userId}::${type}`;
  }

  async getCredential(
    userId: string,
    type: CredentialType
  ): Promise<DecryptedCredential | null> {
    const key = this.getKey(userId, type);
    const stored = this.credentials.get(key);

    if (!stored || !stored.isActive) {
      return null;
    }

    // Decrypt the API key
    let apiKey: string;
    try {
      apiKey = isEncrypted(stored.encryptedApiKey)
        ? decrypt(stored.encryptedApiKey)
        : stored.encryptedApiKey;
    } catch (decryptError) {
      logger.error('Failed to decrypt API key in memory store', decryptError as Error, { userId, type });
      return null;
    }

    return {
      userId: stored.userId,
      credentialType: stored.credentialType,
      apiKey,
      model: stored.model,
      endpoint: stored.endpoint,
      createdAt: stored.createdAt,
      updatedAt: stored.updatedAt,
    };
  }

  async saveCredential(
    userId: string,
    type: CredentialType,
    input: CredentialInput
  ): Promise<void> {
    const key = this.getKey(userId, type);
    const now = new Date().toISOString();

    const existing = this.credentials.get(key);

    // Encrypt the API key
    const encryptedApiKey = encrypt(input.apiKey);

    const credential: StoredCredential = {
      userId,
      credentialType: type,
      encryptedApiKey,
      model: input.model,
      endpoint: input.endpoint,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      isActive: true,
      metadata: input.metadata,
    };

    this.credentials.set(key, credential);
    logger.info('In-memory credential saved (encrypted)', { userId, type });
  }

  async deleteCredential(userId: string, type: CredentialType): Promise<void> {
    const key = this.getKey(userId, type);
    const credential = this.credentials.get(key);

    if (credential) {
      credential.isActive = false;
      credential.updatedAt = new Date().toISOString();
    }

    logger.info('In-memory credential deleted', { userId, type });
  }

  async hasCredential(userId: string, type: CredentialType): Promise<boolean> {
    const credential = await this.getCredential(userId, type);
    return credential !== null;
  }

  async getApiKey(userId: string, type: CredentialType): Promise<string | null> {
    const credential = await this.getCredential(userId, type);
    return credential?.apiKey || null;
  }
}

// =============================================================================
// Factory and Singleton Management
// =============================================================================

let credentialsStoreInstance: CredentialsStore | null = null;

/**
 * Credentials store configuration options
 */
export interface CredentialsStoreConfig {
  /** Use in-memory store instead of DynamoDB */
  useInMemory?: boolean;
  /** DynamoDB table name (for DynamoDB store) */
  tableName?: string;
  /** AWS region (for DynamoDB store) */
  region?: string;
}

/**
 * Determine whether to use the in-memory credentials store.
 * Returns true when running in local development without DynamoDB.
 */
function shouldUseInMemory(): boolean {
  if (process.env['USE_IN_MEMORY_CREDENTIALS'] === 'true') {
    return true;
  }
  // Auto-detect local development: if NODE_ENV is not production and no DynamoDB table is explicitly configured
  if (process.env['NODE_ENV'] !== 'production' && !process.env['USER_CREDENTIALS_TABLE']) {
    return true;
  }
  return false;
}

/**
 * Get or create the credentials store singleton.
 */
export function getCredentialsStore(config?: CredentialsStoreConfig): CredentialsStore {
  if (credentialsStoreInstance) {
    return credentialsStoreInstance;
  }

  const useInMemory = config?.useInMemory ?? shouldUseInMemory();

  if (useInMemory) {
    credentialsStoreInstance = new InMemoryCredentialsStore();
  } else {
    const storeOptions: { tableName?: string; region?: string } = {};
    if (config?.tableName !== undefined) storeOptions.tableName = config.tableName;
    if (config?.region !== undefined) storeOptions.region = config.region;

    credentialsStoreInstance = new DynamoDBCredentialsStore(
      Object.keys(storeOptions).length > 0 ? storeOptions : undefined
    );
  }

  logger.info('Credentials store initialized', {
    type: useInMemory ? 'InMemory' : 'DynamoDB',
  });

  return credentialsStoreInstance;
}

/**
 * Reset the credentials store singleton (for testing)
 */
export function resetCredentialsStore(): void {
  credentialsStoreInstance = null;
  logger.debug('Credentials store reset');
}

/**
 * Get OpenAI API key for a user.
 * Falls back to environment variable if user doesn't have a saved key.
 */
export async function getOpenAIApiKey(userId?: string): Promise<string | null> {
  // If no userId, use settings (Secrets Manager > process.env)
  if (!userId) {
    return getSettings().openaiApiKey || null;
  }

  // Try to get user's saved key
  const store = getCredentialsStore();
  const userKey = await store.getApiKey(userId, 'openai');

  if (userKey) {
    return userKey;
  }

  // Fall back to settings (Secrets Manager > process.env)
  return getSettings().openaiApiKey || null;
}

/**
 * Get model configuration for a user.
 */
export async function getOpenAIModel(userId?: string): Promise<string> {
  const defaultModel = process.env['OPENAI_MODEL'] || 'gpt-4o';

  if (!userId) {
    return defaultModel;
  }

  const store = getCredentialsStore();
  const credential = await store.getCredential(userId, 'openai');

  return credential?.model || defaultModel;
}

/**
 * Get Gemini API key for a user.
 * Falls back to environment variable if user doesn't have a saved key.
 */
export async function getGeminiApiKey(userId?: string): Promise<string | null> {
  // If no userId, use environment variable
  if (!userId) {
    return process.env['GEMINI_API_KEY'] || process.env['GOOGLE_API_KEY'] || null;
  }

  // Try to get user's saved key
  const store = getCredentialsStore();
  const userKey = await store.getApiKey(userId, 'gemini');

  if (userKey) {
    return userKey;
  }

  // Fall back to environment variable
  return process.env['GEMINI_API_KEY'] || process.env['GOOGLE_API_KEY'] || null;
}

/**
 * Get Gemini model configuration for a user.
 */
export async function getGeminiModel(userId?: string): Promise<string> {
  const defaultModel = process.env['GEMINI_MODEL'] || 'gemini-2.0-flash';

  if (!userId) {
    return defaultModel;
  }

  const store = getCredentialsStore();
  const credential = await store.getCredential(userId, 'gemini');

  return credential?.model || defaultModel;
}

/**
 * Get Anthropic API key for a user.
 * Falls back to environment variable if user doesn't have a saved key.
 */
export async function getAnthropicApiKey(userId?: string): Promise<string | null> {
  // If no userId, use environment variable
  if (!userId) {
    return process.env['ANTHROPIC_API_KEY'] || null;
  }

  // Try to get user's saved key
  const store = getCredentialsStore();
  const userKey = await store.getApiKey(userId, 'anthropic');

  if (userKey) {
    return userKey;
  }

  // Fall back to environment variable
  return process.env['ANTHROPIC_API_KEY'] || null;
}

/**
 * Get Anthropic model configuration for a user.
 */
export async function getAnthropicModel(userId?: string): Promise<string> {
  const defaultModel = process.env['ANTHROPIC_MODEL'] || 'claude-sonnet-4-20250514';

  if (!userId) {
    return defaultModel;
  }

  const store = getCredentialsStore();
  const credential = await store.getCredential(userId, 'anthropic');

  return credential?.model || defaultModel;
}

/**
 * Get Codex API key for a user.
 * Falls back to OpenAI API key if user doesn't have a saved Codex key.
 */
export async function getCodexApiKey(userId?: string): Promise<string | null> {
  // If no userId, use environment variable / settings
  if (!userId) {
    return process.env['CODEX_API_KEY'] || getSettings().openaiApiKey || null;
  }

  // Try to get user's saved Codex key
  const store = getCredentialsStore();
  const userKey = await store.getApiKey(userId, 'codex');

  if (userKey) {
    return userKey;
  }

  // Fall back to OpenAI key or settings
  const openaiKey = await store.getApiKey(userId, 'openai');
  if (openaiKey) {
    return openaiKey;
  }

  return process.env['CODEX_API_KEY'] || getSettings().openaiApiKey || null;
}

/**
 * Get Codex model configuration for a user.
 */
export async function getCodexModel(userId?: string): Promise<string> {
  const defaultModel = process.env['CODEX_MODEL'] || 'codex-mini-latest';

  if (!userId) {
    return defaultModel;
  }

  const store = getCredentialsStore();
  const credential = await store.getCredential(userId, 'codex');

  return credential?.model || defaultModel;
}

/**
 * Get API key for any provider.
 */
export async function getProviderApiKey(
  provider: CredentialType,
  userId?: string
): Promise<string | null> {
  switch (provider) {
    case 'openai':
      return getOpenAIApiKey(userId);
    case 'anthropic':
      return getAnthropicApiKey(userId);
    case 'gemini':
      return getGeminiApiKey(userId);
    case 'codex':
      return getCodexApiKey(userId);
    case 'custom':
      if (!userId) return null;
      const store = getCredentialsStore();
      return store.getApiKey(userId, 'custom');
    default:
      return null;
  }
}

/**
 * Get model for any provider.
 */
export async function getProviderModel(
  provider: CredentialType,
  userId?: string
): Promise<string> {
  switch (provider) {
    case 'openai':
      return getOpenAIModel(userId);
    case 'anthropic':
      return getAnthropicModel(userId);
    case 'gemini':
      return getGeminiModel(userId);
    case 'codex':
      return getCodexModel(userId);
    case 'custom':
      if (!userId) return '';
      const store = getCredentialsStore();
      const credential = await store.getCredential(userId, 'custom');
      return credential?.model || '';
    default:
      return '';
  }
}

/**
 * Get all available providers for a user (those with API keys configured).
 */
export async function getAvailableProviders(userId?: string): Promise<CredentialType[]> {
  const providers: CredentialType[] = [];

  for (const providerType of ['openai', 'anthropic', 'gemini', 'codex'] as CredentialType[]) {
    const apiKey = await getProviderApiKey(providerType, userId);
    if (apiKey) {
      providers.push(providerType);
    }
  }

  return providers;
}
