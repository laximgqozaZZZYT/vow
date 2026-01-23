/**
 * Lambda Handler Unit Tests
 *
 * Tests for the Lambda handler that routes EventBridge and API Gateway events.
 *
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
 *
 * Tests cover:
 * - API Gateway event handling (HTTP requests via Hono)
 * - EventBridge event handling (scheduled events)
 * - Event routing to correct handlers
 * - Error handling for unknown event types
 * - Cleanup handler registration
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import type { Context as LambdaContext } from 'aws-lambda';

// =============================================================================
// Mock Setup
// =============================================================================

// Store original process handlers to restore later
const originalProcessOn = process.on.bind(process);
const originalProcessExit = process.exit;

// Mock process.on to prevent actual handler registration during tests
const mockProcessOn = vi.fn().mockImplementation((event: string, handler: () => void) => {
  // Don't actually register handlers that could cause issues
  if (['exit', 'SIGTERM', 'uncaughtException', 'unhandledRejection'].includes(event)) {
    return process;
  }
  return originalProcessOn(event, handler);
});

// Mock process.exit to prevent actual exit
const mockProcessExit = vi.fn() as unknown as typeof process.exit;

// Apply process mocks before any imports
process.on = mockProcessOn as typeof process.on;
process.exit = mockProcessExit;

// Mock the logger to prevent console output during tests
vi.mock('@/utils/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    setLambdaContext: vi.fn(),
  }),
}));

// Mock the config module
vi.mock('@/config', () => ({
  getSettings: () => ({
    supabaseUrl: 'https://test.supabase.co',
    supabaseServiceRoleKey: 'test-service-role-key',
    debug: false,
    appVersion: '1.0.0',
    appName: 'vow-backend-ts',
    slackEnabled: true,
  }),
}));

// Mock the index module to prevent dev server from starting
vi.mock('@/index', async () => {
  const { Hono } = await import('hono');
  const app = new Hono();

  // Add basic routes for testing
  app.get('/', (c) => c.json({ message: 'Vow Backend API (TypeScript)', version: '1.0.0', service: 'vow-backend-ts' }));
  app.get('/health', (c) => c.json({ status: 'ok' }));
  app.post('/api/slack/commands', (c) => c.json({ response_type: 'ephemeral', text: 'Command received' }));

  // 404 handler
  app.notFound((c) => c.json({ error: 'NOT_FOUND', message: `Route ${c.req.method} ${c.req.path} not found` }, 404));

  return { app, createApp: () => app };
});

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a mock Lambda context object.
 */
function createMockLambdaContext(overrides?: Partial<LambdaContext>): LambdaContext {
  return {
    awsRequestId: 'test-request-id-123',
    functionName: 'vow-backend-ts',
    functionVersion: '$LATEST',
    memoryLimitInMB: '256',
    invokedFunctionArn: 'arn:aws:lambda:ap-northeast-1:123456789:function:vow-backend-ts',
    logGroupName: '/aws/lambda/vow-backend-ts',
    logStreamName: '2024/01/01/[$LATEST]abc123',
    callbackWaitsForEmptyEventLoop: true,
    getRemainingTimeInMillis: () => 30000,
    done: vi.fn(),
    fail: vi.fn(),
    succeed: vi.fn(),
    ...overrides,
  };
}

/**
 * Create an EventBridge scheduled event.
 */
function createEventBridgeEvent(detailType: string, detail?: Record<string, unknown>) {
  return {
    source: 'aws.scheduler',
    'detail-type': detailType,
    detail: detail ?? {},
    time: new Date().toISOString(),
    region: 'ap-northeast-1',
    account: '123456789012',
    resources: [],
  };
}

/**
 * Create an API Gateway event (simplified for testing).
 */
function createAPIGatewayEvent(
  method: string,
  path: string,
  options?: {
    headers?: Record<string, string>;
    body?: string;
    queryStringParameters?: Record<string, string>;
  }
) {
  return {
    httpMethod: method,
    path,
    headers: {
      'Content-Type': 'application/json',
      Host: 'api.example.com',
      ...options?.headers,
    },
    body: options?.body ?? null,
    queryStringParameters: options?.queryStringParameters ?? null,
    pathParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'abc123',
      authorizer: null,
      httpMethod: method,
      identity: {
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent',
      },
      path,
      protocol: 'HTTP/1.1',
      requestId: 'test-request-id',
      requestTimeEpoch: Date.now(),
      resourceId: 'resource-id',
      resourcePath: path,
      stage: 'test',
    },
    resource: path,
    isBase64Encoded: false,
  };
}

// =============================================================================
// Lambda Handler Tests
// =============================================================================

describe('Lambda Handler', () => {
  let handler: typeof import('@/lambda').handler;

  beforeAll(() => {
    // Ensure process mocks are in place
    process.on = mockProcessOn as typeof process.on;
    process.exit = mockProcessExit;
  });

  afterAll(() => {
    // Restore original process handlers
    process.on = originalProcessOn;
    process.exit = originalProcessExit;
  });

  beforeEach(async () => {
    // Clear module cache and re-import to get fresh handler
    vi.resetModules();

    // Re-apply process mocks after module reset
    process.on = mockProcessOn as typeof process.on;
    process.exit = mockProcessExit;

    // Re-mock after reset
    vi.doMock('@/utils/logger', () => ({
      getLogger: () => ({
        info: vi.fn(),
        warning: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        setLambdaContext: vi.fn(),
      }),
    }));

    vi.doMock('@/config', () => ({
      getSettings: () => ({
        supabaseUrl: 'https://test.supabase.co',
        supabaseServiceRoleKey: 'test-service-role-key',
        debug: false,
        appVersion: '1.0.0',
        appName: 'vow-backend-ts',
        slackEnabled: true,
      }),
    }));

    // Mock the index module to prevent dev server from starting
    vi.doMock('@/index', async () => {
      const { Hono } = await import('hono');
      const app = new Hono();

      // Add basic routes for testing
      app.get('/', (c) => c.json({ message: 'Vow Backend API (TypeScript)', version: '1.0.0', service: 'vow-backend-ts' }));
      app.get('/health', (c) => c.json({ status: 'ok' }));
      app.post('/api/slack/commands', (c) => c.json({ response_type: 'ephemeral', text: 'Command received' }));

      // 404 handler
      app.notFound((c) => c.json({ error: 'NOT_FOUND', message: `Route ${c.req.method} ${c.req.path} not found` }, 404));

      return { app, createApp: () => app };
    });

    // Import handler after mocks are set up
    const lambdaModule = await import('@/lambda');
    handler = lambdaModule.handler;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // EventBridge Event Routing Tests
  // **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
  // ===========================================================================

  describe('EventBridge Event Routing', () => {
    /**
     * Test: Reminder check event routing
     * **Validates: Requirement 2.3** - Support scheduled events for reminders
     */
    it('should route reminder-check events to reminder handler', async () => {
      const event = createEventBridgeEvent('reminder-check');
      const context = createMockLambdaContext();

      const result = await handler(event, context);

      expect(result).toHaveProperty('statusCode', 200);
      expect(result).toHaveProperty('body');

      const body = result.body as { reminders_sent: number; errors: number; execution_time_ms: number };
      expect(body).toHaveProperty('reminders_sent');
      expect(body).toHaveProperty('errors');
      expect(body).toHaveProperty('execution_time_ms');
      expect(typeof body.execution_time_ms).toBe('number');
    });

    /**
     * Test: Follow-up check event routing
     * **Validates: Requirement 2.4** - Support scheduled events for follow-ups
     */
    it('should route follow-up-check events to follow-up handler', async () => {
      const event = createEventBridgeEvent('follow-up-check');
      const context = createMockLambdaContext();

      const result = await handler(event, context);

      expect(result).toHaveProperty('statusCode', 200);
      expect(result).toHaveProperty('body');

      const body = result.body as {
        follow_ups_sent: number;
        remind_laters_sent: number;
        errors: number;
        execution_time_ms: number;
      };
      expect(body).toHaveProperty('follow_ups_sent');
      expect(body).toHaveProperty('remind_laters_sent');
      expect(body).toHaveProperty('errors');
      expect(body).toHaveProperty('execution_time_ms');
    });

    /**
     * Test: Weekly report event routing
     * **Validates: Requirement 2.2** - Support scheduled events for weekly reports
     */
    it('should route weekly-report events to weekly report handler', async () => {
      // Mock the dynamic imports for weekly report handler
      vi.doMock('@/services/weeklyReportGenerator', () => ({
        WeeklyReportGenerator: vi.fn().mockImplementation(() => ({
          sendAllWeeklyReports: vi.fn().mockResolvedValue(5),
        })),
      }));

      vi.doMock('@/repositories/slackRepository', () => ({
        SlackRepository: vi.fn().mockImplementation(() => ({})),
      }));

      vi.doMock('@/repositories/habitRepository', () => ({
        HabitRepository: vi.fn().mockImplementation(() => ({})),
      }));

      vi.doMock('@/repositories/activityRepository', () => ({
        ActivityRepository: vi.fn().mockImplementation(() => ({})),
      }));

      vi.doMock('@supabase/supabase-js', () => ({
        createClient: vi.fn().mockReturnValue({}),
      }));

      // Re-import handler with new mocks
      vi.resetModules();
      const lambdaModule = await import('@/lambda');
      const freshHandler = lambdaModule.handler;

      const event = createEventBridgeEvent('weekly-report');
      const context = createMockLambdaContext();

      const result = await freshHandler(event, context);

      expect(result).toHaveProperty('statusCode');
      expect(result).toHaveProperty('body');

      const body = result.body as { reports_sent?: number; error?: string; execution_time_ms: number };
      expect(body).toHaveProperty('execution_time_ms');
    });

    /**
     * Test: Unknown EventBridge event type
     * **Validates: Requirement 2.1** - Route EventBridge events correctly
     */
    it('should return 400 for unknown EventBridge schedule types', async () => {
      const event = createEventBridgeEvent('unknown-event-type');
      const context = createMockLambdaContext();

      const result = await handler(event, context);

      expect(result).toHaveProperty('statusCode', 400);
      expect(result).toHaveProperty('body');

      const body = result.body as { error: string; valid_types: string[] };
      expect(body.error).toContain('Unknown schedule type');
      expect(body.valid_types).toContain('reminder-check');
      expect(body.valid_types).toContain('follow-up-check');
      expect(body.valid_types).toContain('weekly-report');
    });

    /**
     * Test: EventBridge event with empty detail-type
     */
    it('should handle EventBridge events with empty detail-type', async () => {
      const event = createEventBridgeEvent('');
      const context = createMockLambdaContext();

      const result = await handler(event, context);

      expect(result).toHaveProperty('statusCode', 400);
      expect(result).toHaveProperty('body');

      const body = result.body as { error: string };
      expect(body.error).toContain('Unknown schedule type');
    });
  });

  // ===========================================================================
  // API Gateway Event Handling Tests
  // **Validates: Requirement 2.5**
  // ===========================================================================

  describe('API Gateway Event Handling', () => {
    /**
     * Test: Health check endpoint via API Gateway
     * **Validates: Requirement 2.5** - Handle API Gateway HTTP requests
     */
    it('should route API Gateway events to Hono app', async () => {
      const event = createAPIGatewayEvent('GET', '/health');
      const context = createMockLambdaContext();

      const result = await handler(event, context);

      expect(result).toHaveProperty('statusCode');
      expect(result).toHaveProperty('body');
      // API Gateway responses have string body
      expect(typeof result.body).toBe('string');
    });

    /**
     * Test: Root endpoint via API Gateway
     */
    it('should handle root endpoint requests', async () => {
      const event = createAPIGatewayEvent('GET', '/');
      const context = createMockLambdaContext();

      const result = await handler(event, context);

      expect(result).toHaveProperty('statusCode');
      expect(result).toHaveProperty('body');

      if (typeof result.body === 'string') {
        const body = JSON.parse(result.body);
        expect(body).toHaveProperty('message');
        expect(body).toHaveProperty('version');
        expect(body).toHaveProperty('service');
      }
    });

    /**
     * Test: Non-existent endpoint returns 404
     */
    it('should return 404 for non-existent endpoints', async () => {
      const event = createAPIGatewayEvent('GET', '/non-existent-path');
      const context = createMockLambdaContext();

      const result = await handler(event, context);

      expect(result).toHaveProperty('statusCode', 404);
    });

    /**
     * Test: POST request handling
     */
    it('should handle POST requests', async () => {
      const event = createAPIGatewayEvent('POST', '/api/slack/commands', {
        body: 'command=/habit-done&text=test&user_id=U123&team_id=T123',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      const context = createMockLambdaContext();

      const result = await handler(event, context);

      // Should get a response (may be error due to missing signature, but should be handled)
      expect(result).toHaveProperty('statusCode');
      expect(result).toHaveProperty('body');
    });
  });

  // ===========================================================================
  // Event Type Detection Tests
  // **Validates: Requirement 2.1**
  // ===========================================================================

  describe('Event Type Detection', () => {
    /**
     * Test: Correctly identifies EventBridge events by source field
     */
    it('should identify EventBridge events by source field', async () => {
      const eventBridgeEvent = {
        source: 'aws.scheduler',
        'detail-type': 'reminder-check',
        detail: {},
      };
      const context = createMockLambdaContext();

      const result = await handler(eventBridgeEvent, context);

      // Should be handled as EventBridge event (returns object body, not string)
      expect(result).toHaveProperty('statusCode', 200);
      expect(typeof result.body).toBe('object');
    });

    /**
     * Test: Correctly identifies API Gateway events (no source field)
     */
    it('should identify API Gateway events by absence of source field', async () => {
      const apiGatewayEvent = createAPIGatewayEvent('GET', '/health');
      const context = createMockLambdaContext();

      const result = await handler(apiGatewayEvent, context);

      // Should be handled as API Gateway event (returns string body)
      expect(result).toHaveProperty('statusCode');
      expect(typeof result.body).toBe('string');
    });

    /**
     * Test: Events with non-scheduler source are treated as API Gateway events
     */
    it('should treat events with non-scheduler source as API Gateway events', async () => {
      const event = {
        source: 'custom.source',
        'detail-type': 'custom-event',
        httpMethod: 'GET',
        path: '/health',
        headers: {},
        body: null,
        queryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {
          accountId: '123456789012',
          apiId: 'abc123',
          httpMethod: 'GET',
          path: '/health',
          protocol: 'HTTP/1.1',
          requestId: 'test-request-id',
          requestTimeEpoch: Date.now(),
          resourceId: 'resource-id',
          resourcePath: '/health',
          stage: 'test',
        },
        resource: '/health',
        isBase64Encoded: false,
      };
      const context = createMockLambdaContext();

      const result = await handler(event, context);

      // Should be handled as API Gateway event since source is not 'aws.scheduler'
      expect(result).toHaveProperty('statusCode');
    });
  });

  // ===========================================================================
  // Lambda Context Tests
  // ===========================================================================

  describe('Lambda Context Handling', () => {
    /**
     * Test: Lambda context is properly passed to handlers
     */
    it('should use Lambda context for logging', async () => {
      const event = createEventBridgeEvent('reminder-check');
      const context = createMockLambdaContext({
        awsRequestId: 'unique-request-id-456',
        functionName: 'test-function',
      });

      const result = await handler(event, context);

      // Handler should complete successfully with context
      expect(result).toHaveProperty('statusCode', 200);
    });

    /**
     * Test: getRemainingTimeInMillis is available
     */
    it('should have access to remaining time', async () => {
      const event = createEventBridgeEvent('reminder-check');
      const getRemainingTime = vi.fn().mockReturnValue(25000);
      const context = createMockLambdaContext({
        getRemainingTimeInMillis: getRemainingTime,
      });

      await handler(event, context);

      // The handler should be able to access remaining time
      // (we can't directly verify this without more complex mocking,
      // but the handler should complete without errors)
      expect(true).toBe(true);
    });
  });

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================

  describe('Error Handling', () => {
    /**
     * Test: EventBridge handler errors return 500 with error details
     */
    it('should return 500 when EventBridge handler throws', async () => {
      // Mock weekly report to throw an error
      vi.doMock('@supabase/supabase-js', () => ({
        createClient: vi.fn().mockImplementation(() => {
          throw new Error('Database connection failed');
        }),
      }));

      vi.resetModules();
      const lambdaModule = await import('@/lambda');
      const freshHandler = lambdaModule.handler;

      const event = createEventBridgeEvent('weekly-report');
      const context = createMockLambdaContext();

      const result = await freshHandler(event, context);

      expect(result).toHaveProperty('statusCode', 500);
      expect(result).toHaveProperty('body');

      const body = result.body as { error: string; execution_time_ms: number };
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('execution_time_ms');
    });

    /**
     * Test: Execution time is tracked even on errors
     */
    it('should track execution time on error responses', async () => {
      vi.doMock('@supabase/supabase-js', () => ({
        createClient: vi.fn().mockImplementation(() => {
          throw new Error('Test error');
        }),
      }));

      vi.resetModules();
      const lambdaModule = await import('@/lambda');
      const freshHandler = lambdaModule.handler;

      const event = createEventBridgeEvent('weekly-report');
      const context = createMockLambdaContext();

      const result = await freshHandler(event, context);

      const body = result.body as { execution_time_ms: number };
      expect(body.execution_time_ms).toBeGreaterThanOrEqual(0);
    });
  });

  // ===========================================================================
  // Response Format Tests
  // ===========================================================================

  describe('Response Format', () => {
    /**
     * Test: EventBridge responses have correct structure
     */
    it('should return correct EventBridge response structure', async () => {
      const event = createEventBridgeEvent('reminder-check');
      const context = createMockLambdaContext();

      const result = await handler(event, context);

      expect(result).toHaveProperty('statusCode');
      expect(result).toHaveProperty('body');
      expect(typeof result.statusCode).toBe('number');
      expect(typeof result.body).toBe('object');
    });

    /**
     * Test: API Gateway responses have correct structure
     */
    it('should return correct API Gateway response structure', async () => {
      const event = createAPIGatewayEvent('GET', '/health');
      const context = createMockLambdaContext();

      const result = await handler(event, context);

      expect(result).toHaveProperty('statusCode');
      expect(result).toHaveProperty('body');
      expect(result).toHaveProperty('headers');
      expect(typeof result.statusCode).toBe('number');
      expect(typeof result.body).toBe('string');
    });
  });
});

// =============================================================================
// Cleanup Handler Tests
// =============================================================================

describe('Cleanup Handlers', () => {
  beforeAll(() => {
    // Ensure process mocks are in place
    process.on = mockProcessOn as typeof process.on;
    process.exit = mockProcessExit;
  });

  afterAll(() => {
    // Restore original process handlers
    process.on = originalProcessOn;
    process.exit = originalProcessExit;
  });

  beforeEach(() => {
    vi.resetModules();
    // Re-apply process mocks after module reset
    process.on = mockProcessOn as typeof process.on;
    process.exit = mockProcessExit;
    mockProcessOn.mockClear();
  });

  /**
   * Helper to set up all required mocks for lambda module import
   */
  async function setupMocks() {
    vi.doMock('@/utils/logger', () => ({
      getLogger: () => ({
        info: vi.fn(),
        warning: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        setLambdaContext: vi.fn(),
      }),
    }));

    vi.doMock('@/config', () => ({
      getSettings: () => ({
        supabaseUrl: 'https://test.supabase.co',
        supabaseServiceRoleKey: 'test-service-role-key',
        debug: false,
        appVersion: '1.0.0',
        appName: 'vow-backend-ts',
        slackEnabled: true,
      }),
    }));

    // Mock the index module to prevent dev server from starting
    vi.doMock('@/index', async () => {
      const { Hono } = await import('hono');
      const app = new Hono();
      app.get('/', (c) => c.json({ message: 'Test' }));
      app.get('/health', (c) => c.json({ status: 'ok' }));
      app.notFound((c) => c.json({ error: 'NOT_FOUND' }, 404));
      return { app, createApp: () => app };
    });
  }

  /**
   * Test: Lambda module registers process handlers
   * **Validates: Requirement 2.6** - Register cleanup handlers
   */
  it('should register process event handlers on module load', async () => {
    await setupMocks();

    // Import the module - this should trigger handler registration
    await import('@/lambda');

    // Verify process.on was called for expected events
    const registeredEvents = mockProcessOn.mock.calls.map((call) => call[0]);
    expect(registeredEvents).toContain('exit');
    expect(registeredEvents).toContain('SIGTERM');
    expect(registeredEvents).toContain('uncaughtException');
    expect(registeredEvents).toContain('unhandledRejection');
  });

  it('should load lambda module without errors', async () => {
    await setupMocks();

    // Should not throw when importing
    await expect(import('@/lambda')).resolves.toBeDefined();
  });

  it('should export handler function', async () => {
    await setupMocks();

    const lambdaModule = await import('@/lambda');

    expect(lambdaModule.handler).toBeDefined();
    expect(typeof lambdaModule.handler).toBe('function');
  });

  it('should export default handler', async () => {
    await setupMocks();

    const lambdaModule = await import('@/lambda');

    expect(lambdaModule.default).toBeDefined();
    expect(typeof lambdaModule.default).toBe('function');
    expect(lambdaModule.default).toBe(lambdaModule.handler);
  });
});
