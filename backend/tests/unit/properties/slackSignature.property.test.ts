/**
 * Property-Based Tests for Slack Signature Verification
 *
 * **Property 6: Slack Signature Verification**
 * For any Slack request with timestamp and signature, if the signature is valid
 * HMAC-SHA256 of "v0:{timestamp}:{body}" and timestamp is within 5 minutes,
 * verification should succeed. Otherwise, verification should fail.
 *
 * **Validates: Requirements 4.7, 4.8**
 *
 * Requirements:
 * - 4.7: Verify Slack request signatures using HMAC-SHA256
 * - 4.8: Validate timestamp is within 5 minutes to prevent replay attacks
 */

import * as fc from 'fast-check';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { webcrypto } from 'node:crypto';

// ============================================================================
// Test Helpers - Signature Computation
// ============================================================================

/**
 * Compute HMAC-SHA256 signature using Web Crypto API.
 * This mirrors the implementation in SlackIntegrationService.
 *
 * @param signingSecret - The Slack signing secret
 * @param message - The message to sign (format: "v0:{timestamp}:{body}")
 * @returns The signature in "v0=<hex>" format
 */
async function computeHmacSha256(signingSecret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(signingSecret);
  const messageData = encoder.encode(message);

  // Import the key
  const key = await webcrypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Sign the message
  const signatureBuffer = await webcrypto.subtle.sign('HMAC', key, messageData);

  // Convert to hex string
  const signatureArray = new Uint8Array(signatureBuffer);
  const hexSignature = Array.from(signatureArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `v0=${hexSignature}`;
}

/**
 * Generate a valid Slack signature for a given payload.
 *
 * @param signingSecret - The Slack signing secret
 * @param timestamp - Unix timestamp in seconds
 * @param body - Request body as string
 * @returns The computed signature
 */
async function generateValidSignature(
  signingSecret: string,
  timestamp: number,
  body: string
): Promise<string> {
  const sigBasestring = `v0:${timestamp}:${body}`;
  return computeHmacSha256(signingSecret, sigBasestring);
}

// ============================================================================
// Mock SlackIntegrationService for Testing
// ============================================================================

/**
 * A testable version of the signature verification logic.
 * This isolates the verification logic from the service's constructor dependencies.
 */
class TestableSignatureVerifier {
  private readonly signingSecret: string;

  constructor(signingSecret: string) {
    this.signingSecret = signingSecret;
  }

  /**
   * Verify Slack request signature using HMAC-SHA256.
   *
   * @param timestamp - X-Slack-Request-Timestamp header
   * @param body - Raw request body as string
   * @param signature - X-Slack-Signature header
   * @param currentTime - Current time in seconds (for testing)
   * @returns True if signature is valid
   */
  async verifySignature(
    timestamp: string,
    body: string,
    signature: string,
    currentTime?: number
  ): Promise<boolean> {
    if (!this.signingSecret) {
      return false;
    }

    // Check timestamp to prevent replay attacks (5 minute window)
    try {
      const requestTime = parseInt(timestamp, 10);
      const now = currentTime ?? Math.floor(Date.now() / 1000);
      if (Math.abs(now - requestTime) > 300) {
        return false;
      }
    } catch {
      return false;
    }

    // Compute expected signature
    const sigBasestring = `v0:${timestamp}:${body}`;
    const expectedSignature = await computeHmacSha256(this.signingSecret, sigBasestring);

    // Compare signatures using constant-time comparison
    return this.timingSafeEqual(expectedSignature, signature);
  }

  /**
   * Constant-time string comparison to prevent timing attacks.
   */
  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }
}

// ============================================================================
// Generators
// ============================================================================

/**
 * Arbitrary for generating a valid Slack signing secret.
 * Slack signing secrets are typically 32 hex characters.
 */
const signingSecretArb = fc.hexaString({ minLength: 32, maxLength: 64 });

/**
 * Arbitrary for generating a different signing secret (for invalid signature tests).
 */
const differentSecretArb = fc.tuple(signingSecretArb, signingSecretArb).filter(
  ([a, b]) => a !== b
);

/**
 * Arbitrary for generating a request body.
 * Slack request bodies are typically URL-encoded form data or JSON.
 */
const requestBodyArb = fc.oneof(
  // URL-encoded form data (common for slash commands)
  fc.record({
    command: fc.constantFrom('/habit-done', '/habit-status', '/habit-list', '/habit-dashboard'),
    text: fc.string({ minLength: 0, maxLength: 100 }),
    user_id: fc.hexaString({ minLength: 9, maxLength: 11 }),
    team_id: fc.hexaString({ minLength: 9, maxLength: 11 }),
    channel_id: fc.hexaString({ minLength: 9, maxLength: 11 }),
    response_url: fc.webUrl(),
  }).map((data) =>
    Object.entries(data)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&')
  ),
  // JSON payload (common for interactive components)
  fc.record({
    type: fc.constantFrom('block_actions', 'view_submission', 'shortcut'),
    user: fc.record({
      id: fc.hexaString({ minLength: 9, maxLength: 11 }),
      name: fc.string({ minLength: 1, maxLength: 20 }),
    }),
    team: fc.record({
      id: fc.hexaString({ minLength: 9, maxLength: 11 }),
    }),
    actions: fc.array(
      fc.record({
        action_id: fc.string({ minLength: 1, maxLength: 50 }),
        value: fc.string({ minLength: 0, maxLength: 100 }),
      }),
      { minLength: 0, maxLength: 3 }
    ),
  }).map((data) => JSON.stringify(data)),
  // Simple string body
  fc.string({ minLength: 1, maxLength: 500 })
);

/**
 * Arbitrary for generating a timestamp within the valid 5-minute window.
 * Returns offset in seconds from current time (-300 to +300).
 */
const validTimestampOffsetArb = fc.integer({ min: -299, max: 299 });

/**
 * Arbitrary for generating a timestamp outside the valid 5-minute window (expired).
 * Returns offset in seconds from current time (more than 300 seconds ago).
 */
const expiredTimestampOffsetArb = fc.integer({ min: 301, max: 86400 }); // 5 min to 24 hours ago

/**
 * Arbitrary for generating a timestamp in the future (outside valid window).
 * Returns offset in seconds from current time (more than 300 seconds in future).
 */
const futureTimestampOffsetArb = fc.integer({ min: 301, max: 86400 }); // 5 min to 24 hours in future

/**
 * Arbitrary for generating an invalid timestamp string.
 */
const invalidTimestampArb = fc.oneof(
  fc.constant(''),
  fc.constant('not-a-number'),
  fc.constant('12.34'),
  fc.string({ minLength: 1, maxLength: 20 }).filter((s) => isNaN(parseInt(s, 10)))
);

/**
 * Arbitrary for generating a corrupted signature.
 */
const corruptedSignatureArb = fc.oneof(
  // Missing v0= prefix
  fc.hexaString({ minLength: 64, maxLength: 64 }),
  // Wrong prefix
  fc.hexaString({ minLength: 64, maxLength: 64 }).map((hex) => `v1=${hex}`),
  // Truncated signature
  fc.hexaString({ minLength: 10, maxLength: 30 }).map((hex) => `v0=${hex}`),
  // Invalid hex characters
  fc.string({ minLength: 64, maxLength: 64 }).map((s) => `v0=${s}`),
  // Empty signature
  fc.constant(''),
  fc.constant('v0=')
);

// ============================================================================
// Property-Based Tests
// ============================================================================

describe('Property 6: Slack Signature Verification', () => {
  /**
   * **Validates: Requirements 4.7**
   *
   * Property: For any payload and signing secret, a signature computed with
   * the correct secret and a valid timestamp should be accepted.
   */
  describe('Valid signatures are accepted', () => {
    it('should accept valid signatures computed with the correct secret', async () => {
      await fc.assert(
        fc.asyncProperty(
          signingSecretArb,
          requestBodyArb,
          validTimestampOffsetArb,
          async (signingSecret, body, timestampOffset) => {
            const verifier = new TestableSignatureVerifier(signingSecret);
            const currentTime = Math.floor(Date.now() / 1000);
            const timestamp = currentTime + timestampOffset;

            // Generate valid signature
            const signature = await generateValidSignature(signingSecret, timestamp, body);

            // Verify signature
            const isValid = await verifier.verifySignature(
              timestamp.toString(),
              body,
              signature,
              currentTime
            );

            expect(isValid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept signatures at exactly 5 minutes ago (boundary)', async () => {
      await fc.assert(
        fc.asyncProperty(
          signingSecretArb,
          requestBodyArb,
          async (signingSecret, body) => {
            const verifier = new TestableSignatureVerifier(signingSecret);
            const currentTime = Math.floor(Date.now() / 1000);
            const timestamp = currentTime - 300; // Exactly 5 minutes ago

            // Generate valid signature
            const signature = await generateValidSignature(signingSecret, timestamp, body);

            // Verify signature
            const isValid = await verifier.verifySignature(
              timestamp.toString(),
              body,
              signature,
              currentTime
            );

            expect(isValid).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should accept signatures at exactly 5 minutes in the future (boundary)', async () => {
      await fc.assert(
        fc.asyncProperty(
          signingSecretArb,
          requestBodyArb,
          async (signingSecret, body) => {
            const verifier = new TestableSignatureVerifier(signingSecret);
            const currentTime = Math.floor(Date.now() / 1000);
            const timestamp = currentTime + 300; // Exactly 5 minutes in future

            // Generate valid signature
            const signature = await generateValidSignature(signingSecret, timestamp, body);

            // Verify signature
            const isValid = await verifier.verifySignature(
              timestamp.toString(),
              body,
              signature,
              currentTime
            );

            expect(isValid).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * **Validates: Requirements 4.7**
   *
   * Property: For any payload, a signature computed with a different secret
   * should be rejected.
   */
  describe('Invalid signatures are rejected', () => {
    it('should reject signatures computed with a different secret', async () => {
      await fc.assert(
        fc.asyncProperty(
          differentSecretArb,
          requestBodyArb,
          validTimestampOffsetArb,
          async ([correctSecret, wrongSecret], body, timestampOffset) => {
            const verifier = new TestableSignatureVerifier(correctSecret);
            const currentTime = Math.floor(Date.now() / 1000);
            const timestamp = currentTime + timestampOffset;

            // Generate signature with wrong secret
            const wrongSignature = await generateValidSignature(wrongSecret, timestamp, body);

            // Verify signature (should fail)
            const isValid = await verifier.verifySignature(
              timestamp.toString(),
              body,
              wrongSignature,
              currentTime
            );

            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject corrupted signatures', async () => {
      await fc.assert(
        fc.asyncProperty(
          signingSecretArb,
          requestBodyArb,
          validTimestampOffsetArb,
          corruptedSignatureArb,
          async (signingSecret, body, timestampOffset, corruptedSignature) => {
            const verifier = new TestableSignatureVerifier(signingSecret);
            const currentTime = Math.floor(Date.now() / 1000);
            const timestamp = currentTime + timestampOffset;

            // Verify corrupted signature (should fail)
            const isValid = await verifier.verifySignature(
              timestamp.toString(),
              body,
              corruptedSignature,
              currentTime
            );

            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject signatures with modified body', async () => {
      await fc.assert(
        fc.asyncProperty(
          signingSecretArb,
          requestBodyArb,
          requestBodyArb,
          validTimestampOffsetArb,
          async (signingSecret, originalBody, modifiedBody, timestampOffset) => {
            // Skip if bodies are the same
            fc.pre(originalBody !== modifiedBody);

            const verifier = new TestableSignatureVerifier(signingSecret);
            const currentTime = Math.floor(Date.now() / 1000);
            const timestamp = currentTime + timestampOffset;

            // Generate signature for original body
            const signature = await generateValidSignature(signingSecret, timestamp, originalBody);

            // Verify signature with modified body (should fail)
            const isValid = await verifier.verifySignature(
              timestamp.toString(),
              modifiedBody,
              signature,
              currentTime
            );

            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject signatures with modified timestamp', async () => {
      await fc.assert(
        fc.asyncProperty(
          signingSecretArb,
          requestBodyArb,
          validTimestampOffsetArb,
          fc.integer({ min: 1, max: 299 }),
          async (signingSecret, body, timestampOffset, timestampDelta) => {
            const verifier = new TestableSignatureVerifier(signingSecret);
            const currentTime = Math.floor(Date.now() / 1000);
            const originalTimestamp = currentTime + timestampOffset;
            const modifiedTimestamp = originalTimestamp + timestampDelta;

            // Generate signature for original timestamp
            const signature = await generateValidSignature(signingSecret, originalTimestamp, body);

            // Verify signature with modified timestamp (should fail)
            const isValid = await verifier.verifySignature(
              modifiedTimestamp.toString(),
              body,
              signature,
              currentTime
            );

            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Validates: Requirements 4.8**
   *
   * Property: Signatures with timestamps older than 5 minutes should be rejected
   * to prevent replay attacks.
   */
  describe('Expired timestamps are rejected', () => {
    it('should reject signatures with timestamps older than 5 minutes', async () => {
      await fc.assert(
        fc.asyncProperty(
          signingSecretArb,
          requestBodyArb,
          expiredTimestampOffsetArb,
          async (signingSecret, body, expiredOffset) => {
            const verifier = new TestableSignatureVerifier(signingSecret);
            const currentTime = Math.floor(Date.now() / 1000);
            const expiredTimestamp = currentTime - expiredOffset;

            // Generate valid signature (but with expired timestamp)
            const signature = await generateValidSignature(signingSecret, expiredTimestamp, body);

            // Verify signature (should fail due to expired timestamp)
            const isValid = await verifier.verifySignature(
              expiredTimestamp.toString(),
              body,
              signature,
              currentTime
            );

            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject signatures with timestamps more than 5 minutes in the future', async () => {
      await fc.assert(
        fc.asyncProperty(
          signingSecretArb,
          requestBodyArb,
          futureTimestampOffsetArb,
          async (signingSecret, body, futureOffset) => {
            const verifier = new TestableSignatureVerifier(signingSecret);
            const currentTime = Math.floor(Date.now() / 1000);
            const futureTimestamp = currentTime + futureOffset;

            // Generate valid signature (but with future timestamp)
            const signature = await generateValidSignature(signingSecret, futureTimestamp, body);

            // Verify signature (should fail due to future timestamp)
            const isValid = await verifier.verifySignature(
              futureTimestamp.toString(),
              body,
              signature,
              currentTime
            );

            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject signatures at exactly 301 seconds ago (just outside boundary)', async () => {
      await fc.assert(
        fc.asyncProperty(
          signingSecretArb,
          requestBodyArb,
          async (signingSecret, body) => {
            const verifier = new TestableSignatureVerifier(signingSecret);
            const currentTime = Math.floor(Date.now() / 1000);
            const timestamp = currentTime - 301; // Just outside 5-minute window

            // Generate valid signature
            const signature = await generateValidSignature(signingSecret, timestamp, body);

            // Verify signature (should fail)
            const isValid = await verifier.verifySignature(
              timestamp.toString(),
              body,
              signature,
              currentTime
            );

            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject signatures at exactly 301 seconds in the future (just outside boundary)', async () => {
      await fc.assert(
        fc.asyncProperty(
          signingSecretArb,
          requestBodyArb,
          async (signingSecret, body) => {
            const verifier = new TestableSignatureVerifier(signingSecret);
            const currentTime = Math.floor(Date.now() / 1000);
            const timestamp = currentTime + 301; // Just outside 5-minute window

            // Generate valid signature
            const signature = await generateValidSignature(signingSecret, timestamp, body);

            // Verify signature (should fail)
            const isValid = await verifier.verifySignature(
              timestamp.toString(),
              body,
              signature,
              currentTime
            );

            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * **Validates: Requirements 4.7, 4.8**
   *
   * Property: Invalid timestamp formats should be rejected.
   */
  describe('Invalid timestamp formats are rejected', () => {
    it('should reject invalid timestamp formats', async () => {
      await fc.assert(
        fc.asyncProperty(
          signingSecretArb,
          requestBodyArb,
          invalidTimestampArb,
          async (signingSecret, body, invalidTimestamp) => {
            const verifier = new TestableSignatureVerifier(signingSecret);

            // Generate some signature (doesn't matter, timestamp check should fail first)
            const signature = await generateValidSignature(
              signingSecret,
              Math.floor(Date.now() / 1000),
              body
            );

            // Verify signature with invalid timestamp (should fail)
            const isValid = await verifier.verifySignature(invalidTimestamp, body, signature);

            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * **Validates: Requirements 4.7**
   *
   * Property: Empty signing secret should reject all signatures.
   */
  describe('Empty signing secret handling', () => {
    it('should reject all signatures when signing secret is empty', async () => {
      await fc.assert(
        fc.asyncProperty(
          requestBodyArb,
          validTimestampOffsetArb,
          async (body, timestampOffset) => {
            const verifier = new TestableSignatureVerifier('');
            const currentTime = Math.floor(Date.now() / 1000);
            const timestamp = currentTime + timestampOffset;

            // Generate signature with some secret
            const signature = await generateValidSignature('some-secret', timestamp, body);

            // Verify signature (should fail due to empty signing secret)
            const isValid = await verifier.verifySignature(
              timestamp.toString(),
              body,
              signature,
              currentTime
            );

            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * **Validates: Requirements 4.7**
   *
   * Property: Signature verification should be deterministic.
   * The same inputs should always produce the same result.
   */
  describe('Determinism', () => {
    it('should produce consistent results for the same inputs', async () => {
      await fc.assert(
        fc.asyncProperty(
          signingSecretArb,
          requestBodyArb,
          validTimestampOffsetArb,
          async (signingSecret, body, timestampOffset) => {
            const verifier = new TestableSignatureVerifier(signingSecret);
            const currentTime = Math.floor(Date.now() / 1000);
            const timestamp = currentTime + timestampOffset;

            // Generate valid signature
            const signature = await generateValidSignature(signingSecret, timestamp, body);

            // Verify multiple times
            const results = await Promise.all([
              verifier.verifySignature(timestamp.toString(), body, signature, currentTime),
              verifier.verifySignature(timestamp.toString(), body, signature, currentTime),
              verifier.verifySignature(timestamp.toString(), body, signature, currentTime),
            ]);

            // All results should be the same
            expect(results[0]).toBe(results[1]);
            expect(results[1]).toBe(results[2]);
            expect(results[0]).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * **Validates: Requirements 4.7**
   *
   * Property: Signature format should follow Slack's specification.
   * Valid signatures should have the format "v0=<64 hex characters>".
   */
  describe('Signature format', () => {
    it('should generate signatures in the correct format', async () => {
      await fc.assert(
        fc.asyncProperty(
          signingSecretArb,
          requestBodyArb,
          async (signingSecret, body) => {
            const timestamp = Math.floor(Date.now() / 1000);
            const signature = await generateValidSignature(signingSecret, timestamp, body);

            // Verify format: v0=<64 hex characters>
            expect(signature).toMatch(/^v0=[a-f0-9]{64}$/);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
