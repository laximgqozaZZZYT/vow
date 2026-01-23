/**
 * Middleware Unit Tests
 *
 * Tests for JWT authentication middleware and CORS middleware.
 *
 * **Validates: Requirements 3.1, 3.6, 3.7**
 *
 * Tests cover:
 * - JWT token validation (valid tokens, expired tokens, invalid signatures)
 * - Path exclusion (public paths should bypass auth)
 * - CORS configuration
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import * as jose from 'jose';
import {
  jwtAuthMiddleware,
  getCurrentUser,
  getUserId,
  getUserEmail,
  clearJWKSCache,
  getExcludedPaths,
  addExcludedPath,
  removeExcludedPath,
} from '@/middleware/auth';
import {
  corsMiddleware,
  devCorsMiddleware,
  strictCorsMiddleware,
} from '@/middleware/cors';
import { AuthenticationError, TokenExpiredError } from '@/errors';
import { resetSettings } from '@/config';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a test Hono app with JWT auth middleware.
 */
function createTestApp() {
  const app = new Hono();

  // Add error handler to convert AuthenticationError to 401 response
  app.onError((err, c) => {
    if (err instanceof AuthenticationError || err instanceof TokenExpiredError) {
      return c.json({ error: err.message }, 401);
    }
    return c.json({ error: 'Internal error' }, 500);
  });

  app.use('*', jwtAuthMiddleware());
  app.get('/health', (c) => c.json({ status: 'ok' }));
  app.get('/api/protected', (c) => {
    const user = getCurrentUser(c);
    return c.json({ user });
  });
  app.get('/api/slack/commands', (c) => c.json({ status: 'ok' }));
  app.get('/api/slack/interactions', (c) => c.json({ status: 'ok' }));
  app.get('/api/slack/callback', (c) => c.json({ status: 'ok' }));
  app.get('/development/health', (c) => c.json({ status: 'ok' }));
  app.get('/production/api/protected', (c) => {
    const user = getCurrentUser(c);
    return c.json({ user });
  });
  return app;
}

/**
 * Create a valid HS256 JWT token.
 */
async function createHS256Token(
  payload: Record<string, unknown>,
  secret: string,
  options?: { expiresIn?: string }
): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);
  const jwt = new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setAudience('authenticated'); // Required by the middleware

  if (options?.expiresIn) {
    jwt.setExpirationTime(options.expiresIn);
  } else {
    jwt.setExpirationTime('1h');
  }

  return jwt.sign(secretKey);
}

/**
 * Create an expired HS256 JWT token.
 */
async function createExpiredToken(
  payload: Record<string, unknown>,
  secret: string
): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);
  const jwt = new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(Math.floor(Date.now() / 1000) - 7200) // 2 hours ago
    .setExpirationTime(Math.floor(Date.now() / 1000) - 3600); // 1 hour ago

  return jwt.sign(secretKey);
}

// ============================================================================
// JWT Auth Middleware Tests
// ============================================================================

describe('JWT Auth Middleware', () => {
  const TEST_SECRET = 'dev-secret-key-change-in-production';
  let app: Hono;

  beforeEach(() => {
    // Reset settings and JWKS cache before each test
    resetSettings();
    clearJWKSCache();
    app = createTestApp();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Path Exclusion Tests
  // **Validates: Requirements 3.6, 3.7**
  // ==========================================================================

  describe('Path Exclusion', () => {
    it('should allow access to /health without authentication', async () => {
      const res = await app.request('/health');

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ status: 'ok' });
    });

    it('should allow access to /api/slack/commands without authentication', async () => {
      const res = await app.request('/api/slack/commands');

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ status: 'ok' });
    });

    it('should allow access to /api/slack/interactions without authentication', async () => {
      const res = await app.request('/api/slack/interactions');

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ status: 'ok' });
    });

    it('should allow access to /api/slack/callback without authentication', async () => {
      const res = await app.request('/api/slack/callback');

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ status: 'ok' });
    });

    it('should strip API Gateway stage prefix and allow excluded paths', async () => {
      const res = await app.request('/development/health');

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ status: 'ok' });
    });

    it('should skip authentication for OPTIONS requests (CORS preflight)', async () => {
      const res = await app.request('/api/protected', {
        method: 'OPTIONS',
      });

      // OPTIONS should pass through without auth error
      expect(res.status).not.toBe(401);
    });

    it('should require authentication for protected paths', async () => {
      const res = await app.request('/api/protected');

      expect(res.status).toBe(401);
    });

    it('should require authentication for protected paths with stage prefix', async () => {
      const res = await app.request('/production/api/protected');

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // JWT Token Validation Tests
  // **Validates: Requirements 3.1**
  // ==========================================================================

  describe('JWT Token Validation', () => {
    it('should accept valid HS256 token', async () => {
      const token = await createHS256Token(
        { sub: 'user-123', email: 'test@example.com' },
        TEST_SECRET
      );

      const res = await app.request('/api/protected', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.user.sub).toBe('user-123');
      expect(body.user.email).toBe('test@example.com');
    });

    it('should reject request without Authorization header', async () => {
      const res = await app.request('/api/protected');

      expect(res.status).toBe(401);
    });

    it('should reject request with invalid Authorization format', async () => {
      const res = await app.request('/api/protected', {
        headers: {
          Authorization: 'InvalidFormat token123',
        },
      });

      expect(res.status).toBe(401);
    });

    it('should reject request with malformed token', async () => {
      const res = await app.request('/api/protected', {
        headers: {
          Authorization: 'Bearer invalid.token.here',
        },
      });

      expect(res.status).toBe(401);
    });

    it('should reject expired token', async () => {
      const token = await createExpiredToken(
        { sub: 'user-123', email: 'test@example.com' },
        TEST_SECRET
      );

      const res = await app.request('/api/protected', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(401);
    });

    it('should reject token with invalid signature', async () => {
      // Create token with different secret
      const token = await createHS256Token(
        { sub: 'user-123', email: 'test@example.com' },
        'wrong-secret-key'
      );

      const res = await app.request('/api/protected', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(401);
    });

    it('should accept token with stage prefix in path', async () => {
      const token = await createHS256Token(
        { sub: 'user-123', email: 'test@example.com' },
        TEST_SECRET
      );

      const res = await app.request('/production/api/protected', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.user.sub).toBe('user-123');
    });
  });

  // ==========================================================================
  // Helper Function Tests
  // ==========================================================================

  describe('Helper Functions', () => {
    describe('getExcludedPaths', () => {
      it('should return list of excluded paths', () => {
        const paths = getExcludedPaths();

        expect(paths).toContain('/health');
        expect(paths).toContain('/api/slack/commands');
        expect(paths).toContain('/api/slack/interactions');
        expect(paths).toContain('/api/slack/callback');
      });
    });

    describe('addExcludedPath / removeExcludedPath', () => {
      it('should add and remove paths from exclusion list', () => {
        const testPath = '/api/test/custom';

        // Add path
        addExcludedPath(testPath);
        expect(getExcludedPaths()).toContain(testPath);

        // Remove path
        removeExcludedPath(testPath);
        expect(getExcludedPaths()).not.toContain(testPath);
      });

      it('should not add duplicate paths', () => {
        const testPath = '/api/test/duplicate';
        const initialLength = getExcludedPaths().length;

        addExcludedPath(testPath);
        addExcludedPath(testPath);

        expect(getExcludedPaths().filter((p) => p === testPath)).toHaveLength(1);

        // Cleanup
        removeExcludedPath(testPath);
      });
    });

    describe('clearJWKSCache', () => {
      it('should clear JWKS cache without error', () => {
        expect(() => clearJWKSCache()).not.toThrow();
      });
    });
  });

  // ==========================================================================
  // Context Helper Tests
  // ==========================================================================

  describe('Context Helpers', () => {
    it('getCurrentUser should throw when not authenticated', async () => {
      const testApp = new Hono();
      testApp.get('/test', (c) => {
        try {
          getCurrentUser(c);
          return c.json({ error: 'Should have thrown' });
        } catch (error) {
          if (error instanceof AuthenticationError) {
            return c.json({ error: error.message }, 401);
          }
          throw error;
        }
      });

      const res = await testApp.request('/test');
      expect(res.status).toBe(401);
    });

    it('getUserId should return user sub claim', async () => {
      const token = await createHS256Token(
        { sub: 'user-456', email: 'test@example.com' },
        TEST_SECRET
      );

      const testApp = new Hono();
      testApp.onError((err, c) => {
        if (err instanceof AuthenticationError || err instanceof TokenExpiredError) {
          return c.json({ error: err.message }, 401);
        }
        return c.json({ error: 'Internal error' }, 500);
      });
      testApp.use('*', jwtAuthMiddleware());
      testApp.get('/test', (c) => {
        const userId = getUserId(c);
        return c.json({ userId });
      });

      const res = await testApp.request('/test', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.userId).toBe('user-456');
    });

    it('getUserEmail should return user email claim', async () => {
      const token = await createHS256Token(
        { sub: 'user-789', email: 'user@example.com' },
        TEST_SECRET
      );

      const testApp = new Hono();
      testApp.onError((err, c) => {
        if (err instanceof AuthenticationError || err instanceof TokenExpiredError) {
          return c.json({ error: err.message }, 401);
        }
        return c.json({ error: 'Internal error' }, 500);
      });
      testApp.use('*', jwtAuthMiddleware());
      testApp.get('/test', (c) => {
        const email = getUserEmail(c);
        return c.json({ email });
      });

      const res = await testApp.request('/test', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.email).toBe('user@example.com');
    });

    it('getUserEmail should return undefined when email not in token', async () => {
      const token = await createHS256Token({ sub: 'user-no-email' }, TEST_SECRET);

      const testApp = new Hono();
      testApp.onError((err, c) => {
        if (err instanceof AuthenticationError || err instanceof TokenExpiredError) {
          return c.json({ error: err.message }, 401);
        }
        return c.json({ error: 'Internal error' }, 500);
      });
      testApp.use('*', jwtAuthMiddleware());
      testApp.get('/test', (c) => {
        const email = getUserEmail(c);
        return c.json({ email: email ?? null });
      });

      const res = await testApp.request('/test', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.email).toBeNull();
    });
  });
});

// ============================================================================
// CORS Middleware Tests
// ============================================================================

describe('CORS Middleware', () => {
  beforeEach(() => {
    resetSettings();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Origin Validation Tests
  // ==========================================================================

  describe('Origin Validation', () => {
    it('should allow configured origins', async () => {
      const app = new Hono();
      app.use('*', corsMiddleware({ origins: ['http://localhost:3000'] }));
      app.get('/test', (c) => c.json({ status: 'ok' }));

      const res = await app.request('/test', {
        headers: {
          Origin: 'http://localhost:3000',
        },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
    });

    it('should reject non-configured origins', async () => {
      const app = new Hono();
      app.use('*', corsMiddleware({ origins: ['http://localhost:3000'] }));
      app.get('/test', (c) => c.json({ status: 'ok' }));

      const res = await app.request('/test', {
        headers: {
          Origin: 'http://evil.com',
        },
      });

      // Request still succeeds but without CORS headers for the origin
      expect(res.status).toBe(200);
      expect(res.headers.get('Access-Control-Allow-Origin')).not.toBe('http://evil.com');
    });

    it('should allow wildcard origin', async () => {
      const app = new Hono();
      app.use('*', corsMiddleware({ origins: ['*'] }));
      app.get('/test', (c) => c.json({ status: 'ok' }));

      const res = await app.request('/test', {
        headers: {
          Origin: 'http://any-origin.com',
        },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://any-origin.com');
    });

    it('should support multiple origins', async () => {
      const app = new Hono();
      app.use(
        '*',
        corsMiddleware({
          origins: ['http://localhost:3000', 'https://app.example.com'],
        })
      );
      app.get('/test', (c) => c.json({ status: 'ok' }));

      // Test first origin
      const res1 = await app.request('/test', {
        headers: {
          Origin: 'http://localhost:3000',
        },
      });
      expect(res1.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');

      // Test second origin
      const res2 = await app.request('/test', {
        headers: {
          Origin: 'https://app.example.com',
        },
      });
      expect(res2.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.com');
    });
  });

  // ==========================================================================
  // Preflight Request Tests
  // ==========================================================================

  describe('Preflight Requests', () => {
    it('should handle OPTIONS preflight requests', async () => {
      const app = new Hono();
      app.use('*', corsMiddleware({ origins: ['http://localhost:3000'] }));
      app.get('/test', (c) => c.json({ status: 'ok' }));

      const res = await app.request('/test', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type',
        },
      });

      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
      expect(res.headers.get('Access-Control-Allow-Methods')).toBeTruthy();
    });

    it('should include allowed headers in preflight response', async () => {
      const app = new Hono();
      app.use(
        '*',
        corsMiddleware({
          origins: ['http://localhost:3000'],
          allowHeaders: ['Content-Type', 'Authorization', 'X-Custom-Header'],
        })
      );
      app.get('/test', (c) => c.json({ status: 'ok' }));

      const res = await app.request('/test', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
        },
      });

      const allowedHeaders = res.headers.get('Access-Control-Allow-Headers');
      expect(allowedHeaders).toContain('Content-Type');
      expect(allowedHeaders).toContain('Authorization');
    });
  });

  // ==========================================================================
  // Credentials Tests
  // ==========================================================================

  describe('Credentials', () => {
    it('should include credentials header when enabled', async () => {
      const app = new Hono();
      app.use(
        '*',
        corsMiddleware({
          origins: ['http://localhost:3000'],
          credentials: true,
        })
      );
      app.get('/test', (c) => c.json({ status: 'ok' }));

      const res = await app.request('/test', {
        headers: {
          Origin: 'http://localhost:3000',
        },
      });

      expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });
  });

  // ==========================================================================
  // Dev CORS Middleware Tests
  // ==========================================================================

  describe('devCorsMiddleware', () => {
    it('should allow all origins in development mode', async () => {
      const app = new Hono();
      app.use('*', devCorsMiddleware());
      app.get('/test', (c) => c.json({ status: 'ok' }));

      const res = await app.request('/test', {
        headers: {
          Origin: 'http://any-origin.com',
        },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('should not include credentials with wildcard origin', async () => {
      const app = new Hono();
      app.use('*', devCorsMiddleware());
      app.get('/test', (c) => c.json({ status: 'ok' }));

      const res = await app.request('/test', {
        headers: {
          Origin: 'http://any-origin.com',
        },
      });

      // Credentials should be false with wildcard origin
      expect(res.headers.get('Access-Control-Allow-Credentials')).not.toBe('true');
    });
  });

  // ==========================================================================
  // Strict CORS Middleware Tests
  // ==========================================================================

  describe('strictCorsMiddleware', () => {
    it('should only allow explicitly configured origins', async () => {
      const app = new Hono();
      app.use('*', strictCorsMiddleware(['https://trusted.example.com']));
      app.get('/test', (c) => c.json({ status: 'ok' }));

      // Allowed origin
      const res1 = await app.request('/test', {
        headers: {
          Origin: 'https://trusted.example.com',
        },
      });
      expect(res1.headers.get('Access-Control-Allow-Origin')).toBe('https://trusted.example.com');

      // Disallowed origin
      const res2 = await app.request('/test', {
        headers: {
          Origin: 'https://untrusted.example.com',
        },
      });
      expect(res2.headers.get('Access-Control-Allow-Origin')).not.toBe(
        'https://untrusted.example.com'
      );
    });

    it('should include credentials for strict mode', async () => {
      const app = new Hono();
      app.use('*', strictCorsMiddleware(['https://trusted.example.com']));
      app.get('/test', (c) => c.json({ status: 'ok' }));

      const res = await app.request('/test', {
        headers: {
          Origin: 'https://trusted.example.com',
        },
      });

      expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });
  });

  // ==========================================================================
  // Max Age Tests
  // ==========================================================================

  describe('Max Age', () => {
    it('should include max-age header in preflight response', async () => {
      const app = new Hono();
      app.use(
        '*',
        corsMiddleware({
          origins: ['http://localhost:3000'],
          maxAge: 3600,
        })
      );
      app.get('/test', (c) => c.json({ status: 'ok' }));

      const res = await app.request('/test', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'GET',
        },
      });

      expect(res.headers.get('Access-Control-Max-Age')).toBe('3600');
    });
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('Middleware Error Handling', () => {
  beforeEach(() => {
    resetSettings();
    clearJWKSCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return 401 for authentication errors', async () => {
    const app = new Hono();
    app.use('*', jwtAuthMiddleware());
    app.get('/protected', (c) => c.json({ status: 'ok' }));

    // Add error handler
    app.onError((err, c) => {
      if (err instanceof AuthenticationError) {
        return c.json({ error: err.message }, 401);
      }
      return c.json({ error: 'Internal error' }, 500);
    });

    const res = await app.request('/protected');

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('authentication');
  });

  it('should return 401 for expired token errors', async () => {
    const TEST_SECRET = 'dev-secret-key-change-in-production';
    const token = await createExpiredToken({ sub: 'user-123' }, TEST_SECRET);

    const app = new Hono();
    app.use('*', jwtAuthMiddleware());
    app.get('/protected', (c) => c.json({ status: 'ok' }));

    // Add error handler
    app.onError((err, c) => {
      if (err instanceof TokenExpiredError) {
        return c.json({ error: 'Token expired' }, 401);
      }
      if (err instanceof AuthenticationError) {
        return c.json({ error: err.message }, 401);
      }
      return c.json({ error: 'Internal error' }, 500);
    });

    const res = await app.request('/protected', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(res.status).toBe(401);
  });
});
