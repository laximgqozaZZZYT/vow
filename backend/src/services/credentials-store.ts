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
  const secretKey = process.env['CREDENTIALS_ENCRYPTION_KEY'];

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
export type CredentialType = 'openai' | 'anthropic' | 'custom';

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
        await this.docClient.send(
          new UpdateCommand({
            TableName: this.tableName,
            Key: { userId, credentialType: type },
            UpdateExpression: 'SET encryptedApiKey = :encryptedApiKey, #model = :model, endpoint = :endpoint, updatedAt = :updatedAt, isActive = :isActive, metadata = :metadata',
            ExpressionAttributeNames: {
              '#model': 'model',
            },
            ExpressionAttributeValues: {
              ':encryptedApiKey': encryptedApiKey,
              ':model': input.model,
              ':endpoint': input.endpoint,
              ':updatedAt': now,
              ':isActive': true,
              ':metadata': input.metadata,
            },
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
 * Get or create the credentials store singleton.
 */
export function getCredentialsStore(config?: CredentialsStoreConfig): CredentialsStore {
  if (credentialsStoreInstance) {
    return credentialsStoreInstance;
  }

  const isProduction = process.env['NODE_ENV'] === 'production';
  const useInMemory = config?.useInMemory ?? !isProduction;

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
    isProduction,
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
  // If no userId, use environment variable
  if (!userId) {
    return process.env['OPENAI_API_KEY'] || null;
  }

  // Try to get user's saved key
  const store = getCredentialsStore();
  const userKey = await store.getApiKey(userId, 'openai');

  if (userKey) {
    return userKey;
  }

  // Fall back to environment variable
  return process.env['OPENAI_API_KEY'] || null;
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
