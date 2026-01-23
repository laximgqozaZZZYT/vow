/**
 * Property-Based Tests for Token Encryption
 *
 * **Property 13: Token Encryption Round-Trip**
 * For any plaintext token and encryption key, encrypting and then decrypting
 * should return the original token. The encryption should be:
 * 1. Reversible (decrypt(encrypt(token)) === token)
 * 2. Non-deterministic (same input produces different ciphertext each time due to random IV)
 * 3. Secure (ciphertext should not reveal plaintext patterns)
 *
 * **Validates: Requirements 14.1, 14.2**
 *
 * Requirements:
 * - 14.1: Encrypt sensitive tokens before storage
 * - 14.2: Decrypt tokens when needed for API calls
 */

import * as fc from 'fast-check';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TokenEncryption, generateEncryptionKey, resetEncryption } from '../../../src/utils/encryption';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Generate a valid 32-byte base64-encoded encryption key.
 * AES-256 requires a 256-bit (32-byte) key.
 */
function generateValidKey(): string {
  return generateEncryptionKey();
}

// ============================================================================
// Generators
// ============================================================================

/**
 * Arbitrary for generating valid encryption keys.
 * Keys must be 32 bytes (256 bits) encoded as base64.
 */
const encryptionKeyArb = fc.uint8Array({ minLength: 32, maxLength: 32 }).map((bytes) =>
  Buffer.from(bytes).toString('base64')
);

/**
 * Arbitrary for generating plaintext tokens.
 * Tokens can be any string, including:
 * - Slack access tokens (xoxb-*, xoxp-*, xoxe-*)
 * - Refresh tokens
 * - API keys
 * - Random strings
 */
const plaintextTokenArb = fc.oneof(
  // Slack-like access tokens
  fc.tuple(
    fc.constantFrom('xoxb-', 'xoxp-', 'xoxe-'),
    fc.hexaString({ minLength: 10, maxLength: 50 }),
    fc.constant('-'),
    fc.hexaString({ minLength: 10, maxLength: 50 })
  ).map(([prefix, part1, sep, part2]) => `${prefix}${part1}${sep}${part2}`),
  // UUID-like tokens
  fc.uuid(),
  // Random alphanumeric tokens
  fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'), {
    minLength: 10,
    maxLength: 200,
  }),
  // Tokens with special characters
  fc.string({ minLength: 1, maxLength: 200 }),
  // Unicode tokens
  fc.unicodeString({ minLength: 1, maxLength: 100 }),
  // Empty-ish tokens (edge cases)
  fc.constantFrom(' ', '  ', '\t', '\n'),
);

/**
 * Arbitrary for generating non-empty plaintext tokens.
 */
const nonEmptyPlaintextArb = fc.string({ minLength: 1, maxLength: 500 });

/**
 * Arbitrary for generating different encryption keys (for testing key isolation).
 */
const differentKeysArb = fc.tuple(encryptionKeyArb, encryptionKeyArb).filter(
  ([key1, key2]) => key1 !== key2
);

// ============================================================================
// Property-Based Tests
// ============================================================================

describe('Property 13: Token Encryption Round-Trip', () => {
  beforeEach(() => {
    // Reset singleton instance before each test
    resetEncryption();
  });

  afterEach(() => {
    // Clean up after each test
    resetEncryption();
  });

  /**
   * **Validates: Requirements 14.1, 14.2**
   *
   * Property: For any plaintext token and valid encryption key,
   * encrypting and then decrypting should return the original token.
   */
  describe('Round-trip encryption/decryption', () => {
    it('should return original token after encrypt then decrypt', async () => {
      await fc.assert(
        fc.asyncProperty(
          encryptionKeyArb,
          nonEmptyPlaintextArb,
          async (key, plaintext) => {
            const encryption = new TokenEncryption(key);

            // Encrypt the plaintext
            const ciphertext = await encryption.encrypt(plaintext);

            // Decrypt the ciphertext
            const decrypted = await encryption.decrypt(ciphertext);

            // Should return original plaintext
            expect(decrypted).toBe(plaintext);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle Slack-like tokens correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          encryptionKeyArb,
          plaintextTokenArb,
          async (key, token) => {
            // Skip empty tokens for this test
            fc.pre(token.length > 0);

            const encryption = new TokenEncryption(key);

            // Encrypt the token
            const ciphertext = await encryption.encrypt(token);

            // Decrypt the ciphertext
            const decrypted = await encryption.decrypt(ciphertext);

            // Should return original token
            expect(decrypted).toBe(token);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle Unicode strings correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          encryptionKeyArb,
          fc.unicodeString({ minLength: 1, maxLength: 200 }),
          async (key, unicodeText) => {
            const encryption = new TokenEncryption(key);

            // Encrypt the unicode text
            const ciphertext = await encryption.encrypt(unicodeText);

            // Decrypt the ciphertext
            const decrypted = await encryption.decrypt(ciphertext);

            // Should return original unicode text
            expect(decrypted).toBe(unicodeText);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle very long tokens correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          encryptionKeyArb,
          fc.string({ minLength: 1000, maxLength: 5000 }),
          async (key, longToken) => {
            const encryption = new TokenEncryption(key);

            // Encrypt the long token
            const ciphertext = await encryption.encrypt(longToken);

            // Decrypt the ciphertext
            const decrypted = await encryption.decrypt(ciphertext);

            // Should return original long token
            expect(decrypted).toBe(longToken);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * **Validates: Requirements 14.1**
   *
   * Property: Encryption should be non-deterministic.
   * The same plaintext encrypted multiple times should produce different ciphertexts
   * due to random IV generation.
   */
  describe('Non-deterministic encryption', () => {
    it('should produce different ciphertexts for the same plaintext', async () => {
      await fc.assert(
        fc.asyncProperty(
          encryptionKeyArb,
          nonEmptyPlaintextArb,
          async (key, plaintext) => {
            const encryption = new TokenEncryption(key);

            // Encrypt the same plaintext multiple times
            const ciphertext1 = await encryption.encrypt(plaintext);
            const ciphertext2 = await encryption.encrypt(plaintext);
            const ciphertext3 = await encryption.encrypt(plaintext);

            // All ciphertexts should be different (due to random IV)
            expect(ciphertext1).not.toBe(ciphertext2);
            expect(ciphertext2).not.toBe(ciphertext3);
            expect(ciphertext1).not.toBe(ciphertext3);

            // But all should decrypt to the same plaintext
            const decrypted1 = await encryption.decrypt(ciphertext1);
            const decrypted2 = await encryption.decrypt(ciphertext2);
            const decrypted3 = await encryption.decrypt(ciphertext3);

            expect(decrypted1).toBe(plaintext);
            expect(decrypted2).toBe(plaintext);
            expect(decrypted3).toBe(plaintext);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Validates: Requirements 14.1**
   *
   * Property: Ciphertext should be valid base64 and have expected structure.
   * The ciphertext format is: base64(IV + encrypted_data + auth_tag)
   */
  describe('Ciphertext format', () => {
    it('should produce valid base64 ciphertext', async () => {
      await fc.assert(
        fc.asyncProperty(
          encryptionKeyArb,
          nonEmptyPlaintextArb,
          async (key, plaintext) => {
            const encryption = new TokenEncryption(key);

            // Encrypt the plaintext
            const ciphertext = await encryption.encrypt(plaintext);

            // Ciphertext should be valid base64
            expect(() => Buffer.from(ciphertext, 'base64')).not.toThrow();

            // Decoded ciphertext should have minimum length:
            // IV (12 bytes) + at least 1 byte of data + auth tag (16 bytes) = 29 bytes minimum
            const decoded = Buffer.from(ciphertext, 'base64');
            expect(decoded.length).toBeGreaterThanOrEqual(29);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce ciphertext longer than plaintext (due to IV and auth tag)', async () => {
      await fc.assert(
        fc.asyncProperty(
          encryptionKeyArb,
          nonEmptyPlaintextArb,
          async (key, plaintext) => {
            const encryption = new TokenEncryption(key);

            // Encrypt the plaintext
            const ciphertext = await encryption.encrypt(plaintext);

            // Decoded ciphertext should be longer than plaintext
            // because it includes IV (12 bytes) and auth tag (16 bytes)
            const decodedLength = Buffer.from(ciphertext, 'base64').length;
            const plaintextLength = Buffer.from(plaintext, 'utf-8').length;

            // Ciphertext = IV (12) + plaintext + auth tag (16) = plaintext + 28 bytes
            expect(decodedLength).toBe(plaintextLength + 28);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Validates: Requirements 14.1, 14.2**
   *
   * Property: Ciphertext should not reveal plaintext patterns.
   * Similar plaintexts should produce completely different ciphertexts.
   */
  describe('Ciphertext security', () => {
    it('should produce completely different ciphertexts for similar plaintexts', async () => {
      await fc.assert(
        fc.asyncProperty(
          encryptionKeyArb,
          nonEmptyPlaintextArb,
          async (key, plaintext) => {
            const encryption = new TokenEncryption(key);

            // Create a similar plaintext (append a character)
            const similarPlaintext = plaintext + 'x';

            // Encrypt both
            const ciphertext1 = await encryption.encrypt(plaintext);
            const ciphertext2 = await encryption.encrypt(similarPlaintext);

            // Ciphertexts should be completely different
            expect(ciphertext1).not.toBe(ciphertext2);

            // The decoded bytes should also be different
            const decoded1 = Buffer.from(ciphertext1, 'base64');
            const decoded2 = Buffer.from(ciphertext2, 'base64');

            // Compare byte by byte - they should differ significantly
            // (not just in the last few bytes)
            let differentBytes = 0;
            const minLength = Math.min(decoded1.length, decoded2.length);
            for (let i = 0; i < minLength; i++) {
              if (decoded1[i] !== decoded2[i]) {
                differentBytes++;
              }
            }

            // At least the IV (12 bytes) should be different
            expect(differentBytes).toBeGreaterThanOrEqual(12);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Validates: Requirements 14.2**
   *
   * Property: Decryption with wrong key should fail.
   * Using a different key to decrypt should throw an error.
   */
  describe('Key isolation', () => {
    it('should fail to decrypt with a different key', async () => {
      await fc.assert(
        fc.asyncProperty(
          differentKeysArb,
          nonEmptyPlaintextArb,
          async ([correctKey, wrongKey], plaintext) => {
            const encryptionCorrect = new TokenEncryption(correctKey);
            const encryptionWrong = new TokenEncryption(wrongKey);

            // Encrypt with correct key
            const ciphertext = await encryptionCorrect.encrypt(plaintext);

            // Decrypt with wrong key should fail
            await expect(encryptionWrong.decrypt(ciphertext)).rejects.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Validates: Requirements 14.1, 14.2**
   *
   * Property: Empty string handling.
   * Empty strings should be handled gracefully.
   */
  describe('Empty string handling', () => {
    it('should handle empty string encryption', async () => {
      await fc.assert(
        fc.asyncProperty(
          encryptionKeyArb,
          async (key) => {
            const encryption = new TokenEncryption(key);

            // Encrypt empty string
            const ciphertext = await encryption.encrypt('');

            // Should return empty string (as per implementation)
            expect(ciphertext).toBe('');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle empty string decryption', async () => {
      await fc.assert(
        fc.asyncProperty(
          encryptionKeyArb,
          async (key) => {
            const encryption = new TokenEncryption(key);

            // Decrypt empty string
            const decrypted = await encryption.decrypt('');

            // Should return empty string (as per implementation)
            expect(decrypted).toBe('');
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * **Validates: Requirements 14.1, 14.2**
   *
   * Property: Corrupted ciphertext should fail decryption.
   * Modifying the ciphertext should cause decryption to fail.
   */
  describe('Ciphertext integrity', () => {
    it('should fail to decrypt corrupted ciphertext', async () => {
      await fc.assert(
        fc.asyncProperty(
          encryptionKeyArb,
          nonEmptyPlaintextArb,
          fc.integer({ min: 0, max: 100 }),
          async (key, plaintext, corruptionIndex) => {
            const encryption = new TokenEncryption(key);

            // Encrypt the plaintext
            const ciphertext = await encryption.encrypt(plaintext);

            // Decode, corrupt, and re-encode
            const decoded = Buffer.from(ciphertext, 'base64');
            const actualIndex = corruptionIndex % decoded.length;
            decoded[actualIndex] = (decoded[actualIndex] + 1) % 256;
            const corruptedCiphertext = decoded.toString('base64');

            // Decryption should fail
            await expect(encryption.decrypt(corruptedCiphertext)).rejects.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should fail to decrypt truncated ciphertext', async () => {
      await fc.assert(
        fc.asyncProperty(
          encryptionKeyArb,
          nonEmptyPlaintextArb,
          fc.integer({ min: 1, max: 10 }),
          async (key, plaintext, truncateBytes) => {
            const encryption = new TokenEncryption(key);

            // Encrypt the plaintext
            const ciphertext = await encryption.encrypt(plaintext);

            // Decode and truncate
            const decoded = Buffer.from(ciphertext, 'base64');
            const truncated = decoded.subarray(0, Math.max(1, decoded.length - truncateBytes));
            const truncatedCiphertext = truncated.toString('base64');

            // Decryption should fail
            await expect(encryption.decrypt(truncatedCiphertext)).rejects.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Validates: Requirements 14.1, 14.2**
   *
   * Property: Encryption should be deterministic with respect to decryption.
   * Multiple decryptions of the same ciphertext should always return the same result.
   */
  describe('Decryption determinism', () => {
    it('should produce consistent decryption results', async () => {
      await fc.assert(
        fc.asyncProperty(
          encryptionKeyArb,
          nonEmptyPlaintextArb,
          async (key, plaintext) => {
            const encryption = new TokenEncryption(key);

            // Encrypt once
            const ciphertext = await encryption.encrypt(plaintext);

            // Decrypt multiple times
            const decrypted1 = await encryption.decrypt(ciphertext);
            const decrypted2 = await encryption.decrypt(ciphertext);
            const decrypted3 = await encryption.decrypt(ciphertext);

            // All decryptions should be identical
            expect(decrypted1).toBe(decrypted2);
            expect(decrypted2).toBe(decrypted3);
            expect(decrypted1).toBe(plaintext);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Validates: Requirements 14.1, 14.2**
   *
   * Property: encryptIfPresent and decryptIfPresent should handle null/undefined.
   */
  describe('Optional value handling', () => {
    it('should handle null values with encryptIfPresent', async () => {
      await fc.assert(
        fc.asyncProperty(
          encryptionKeyArb,
          async (key) => {
            const encryption = new TokenEncryption(key);

            // Encrypt null
            const result = await encryption.encryptIfPresent(null);

            // Should return null
            expect(result).toBeNull();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle undefined values with encryptIfPresent', async () => {
      await fc.assert(
        fc.asyncProperty(
          encryptionKeyArb,
          async (key) => {
            const encryption = new TokenEncryption(key);

            // Encrypt undefined
            const result = await encryption.encryptIfPresent(undefined);

            // Should return null
            expect(result).toBeNull();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle null values with decryptIfPresent', async () => {
      await fc.assert(
        fc.asyncProperty(
          encryptionKeyArb,
          async (key) => {
            const encryption = new TokenEncryption(key);

            // Decrypt null
            const result = await encryption.decryptIfPresent(null);

            // Should return null
            expect(result).toBeNull();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should round-trip with encryptIfPresent and decryptIfPresent', async () => {
      await fc.assert(
        fc.asyncProperty(
          encryptionKeyArb,
          nonEmptyPlaintextArb,
          async (key, plaintext) => {
            const encryption = new TokenEncryption(key);

            // Encrypt with encryptIfPresent
            const ciphertext = await encryption.encryptIfPresent(plaintext);

            // Should not be null
            expect(ciphertext).not.toBeNull();

            // Decrypt with decryptIfPresent
            const decrypted = await encryption.decryptIfPresent(ciphertext);

            // Should return original plaintext
            expect(decrypted).toBe(plaintext);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
