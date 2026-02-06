/**
 * Unit tests for DynamoDBCredentialsStore.saveCredential()
 *
 * Verifies that the UpdateCommand path correctly handles
 * optional fields (endpoint, metadata) being undefined.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so the mock variable is available in vi.mock factories
const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}));

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn().mockReturnValue({ send: mockSend }),
  },
  GetCommand: vi.fn().mockImplementation((input: unknown) => ({ __type: 'GetCommand', input })),
  PutCommand: vi.fn().mockImplementation((input: unknown) => ({ __type: 'PutCommand', input })),
  UpdateCommand: vi.fn().mockImplementation((input: unknown) => ({ __type: 'UpdateCommand', input })),
}));

// Mock crypto for encrypt function
vi.mock('crypto', async () => {
  const actual = await vi.importActual<typeof import('crypto')>('crypto');
  return {
    ...actual,
    scryptSync: vi.fn().mockReturnValue(Buffer.alloc(32, 1)),
    createCipheriv: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue(Buffer.from('encrypted')),
      final: vi.fn().mockReturnValue(Buffer.alloc(0)),
      getAuthTag: vi.fn().mockReturnValue(Buffer.from('authtag1234567890')),
    }),
    randomBytes: vi.fn().mockReturnValue(Buffer.alloc(16, 2)),
  };
});

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  getLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { DynamoDBCredentialsStore } from '../../src/services/credentials-store.js';
import type { CredentialInput, CredentialType } from '../../src/services/credentials-store.js';

describe('DynamoDBCredentialsStore.saveCredential', () => {
  let store: DynamoDBCredentialsStore;
  const userId = 'test-user-id';
  const credentialType: CredentialType = 'openai';

  beforeEach(() => {
    vi.clearAllMocks();
    store = new DynamoDBCredentialsStore({ tableName: 'test-credentials' });
  });

  describe('UpdateCommand path (existing record)', () => {
    beforeEach(() => {
      // First call = GetCommand returns existing item
      mockSend.mockResolvedValueOnce({
        Item: { userId, credentialType, encryptedApiKey: 'old-encrypted', isActive: true },
      });
      // Second call = UpdateCommand succeeds
      mockSend.mockResolvedValueOnce({});
    });

    it('should succeed when endpoint and metadata are undefined', async () => {
      const input: CredentialInput = {
        apiKey: 'sk-test-key-12345',
        model: 'gpt-4o-mini',
      };

      await expect(store.saveCredential(userId, credentialType, input)).resolves.not.toThrow();

      // Verify UpdateCommand was called (second send call)
      expect(mockSend).toHaveBeenCalledTimes(2);
      const updateCall = mockSend.mock.calls[1][0];
      expect(updateCall.__type).toBe('UpdateCommand');

      const { UpdateExpression, ExpressionAttributeValues } = updateCall.input;

      // endpoint and metadata should NOT be in UpdateExpression
      expect(UpdateExpression).not.toContain('endpoint');
      expect(UpdateExpression).not.toContain('metadata');

      // endpoint and metadata should NOT be in ExpressionAttributeValues
      expect(ExpressionAttributeValues).not.toHaveProperty(':endpoint');
      expect(ExpressionAttributeValues).not.toHaveProperty(':metadata');
    });

    it('should include endpoint in UpdateExpression when provided', async () => {
      const input: CredentialInput = {
        apiKey: 'sk-test-key-12345',
        model: 'gpt-4o-mini',
        endpoint: 'https://api.example.com',
      };

      await store.saveCredential(userId, credentialType, input);

      const updateCall = mockSend.mock.calls[1][0];
      const { UpdateExpression, ExpressionAttributeValues } = updateCall.input;

      expect(UpdateExpression).toContain('endpoint = :endpoint');
      expect(ExpressionAttributeValues[':endpoint']).toBe('https://api.example.com');
    });

    it('should include metadata in UpdateExpression when provided', async () => {
      const input: CredentialInput = {
        apiKey: 'sk-test-key-12345',
        model: 'gpt-4o-mini',
        metadata: { note: 'test' },
      };

      await store.saveCredential(userId, credentialType, input);

      const updateCall = mockSend.mock.calls[1][0];
      const { UpdateExpression, ExpressionAttributeValues, ExpressionAttributeNames } = updateCall.input;

      expect(UpdateExpression).toContain('#metadata = :metadata');
      expect(ExpressionAttributeValues[':metadata']).toEqual({ note: 'test' });
      expect(ExpressionAttributeNames['#metadata']).toBe('metadata');
    });

    it('should include both endpoint and metadata when both provided', async () => {
      const input: CredentialInput = {
        apiKey: 'sk-test-key-12345',
        model: 'gpt-4o-mini',
        endpoint: 'https://api.example.com',
        metadata: { note: 'test' },
      };

      await store.saveCredential(userId, credentialType, input);

      const updateCall = mockSend.mock.calls[1][0];
      const { UpdateExpression, ExpressionAttributeValues } = updateCall.input;

      expect(UpdateExpression).toContain('endpoint = :endpoint');
      expect(UpdateExpression).toContain('#metadata = :metadata');
      expect(ExpressionAttributeValues[':endpoint']).toBe('https://api.example.com');
      expect(ExpressionAttributeValues[':metadata']).toEqual({ note: 'test' });
    });

    it('should always include base fields in UpdateExpression', async () => {
      const input: CredentialInput = {
        apiKey: 'sk-test-key-12345',
      };

      await store.saveCredential(userId, credentialType, input);

      const updateCall = mockSend.mock.calls[1][0];
      const { UpdateExpression } = updateCall.input;

      expect(UpdateExpression).toContain('encryptedApiKey = :encryptedApiKey');
      expect(UpdateExpression).toContain('#model = :model');
      expect(UpdateExpression).toContain('updatedAt = :updatedAt');
      expect(UpdateExpression).toContain('isActive = :isActive');
      expect(UpdateExpression).toMatch(/^SET /);
    });

    it('should have consistent keys between UpdateExpression and ExpressionAttributeValues', async () => {
      const input: CredentialInput = {
        apiKey: 'sk-test-key-12345',
        model: 'gpt-4o-mini',
      };

      await store.saveCredential(userId, credentialType, input);

      const updateCall = mockSend.mock.calls[1][0];
      const { UpdateExpression, ExpressionAttributeValues } = updateCall.input;

      // Extract all :placeholder references from UpdateExpression
      const exprPlaceholders = UpdateExpression.match(/:\w+/g) || [];
      const valueKeys = Object.keys(ExpressionAttributeValues);

      // Every placeholder in UpdateExpression must exist in ExpressionAttributeValues
      for (const placeholder of exprPlaceholders) {
        expect(valueKeys).toContain(placeholder);
      }

      // Every key in ExpressionAttributeValues must be referenced in UpdateExpression
      for (const key of valueKeys) {
        expect(UpdateExpression).toContain(key);
      }
    });
  });

  describe('PutCommand path (new record)', () => {
    beforeEach(() => {
      // GetCommand returns no item
      mockSend.mockResolvedValueOnce({ Item: undefined });
      // PutCommand succeeds
      mockSend.mockResolvedValueOnce({});
    });

    it('should succeed when endpoint and metadata are undefined', async () => {
      const input: CredentialInput = {
        apiKey: 'sk-test-key-12345',
        model: 'gpt-4o-mini',
      };

      await expect(store.saveCredential(userId, credentialType, input)).resolves.not.toThrow();

      expect(mockSend).toHaveBeenCalledTimes(2);
      const putCall = mockSend.mock.calls[1][0];
      expect(putCall.__type).toBe('PutCommand');
    });
  });
});
