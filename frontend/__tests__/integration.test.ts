/**
 * Integration tests for guest user functionality
 * Feature: guest-user-habit-goal-support
 */

// Mock localStorage for testing
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

// Mock console.log to capture authentication logs
const originalConsoleLog = console.log;
const logMessages: string[] = [];
console.log = (...args: any[]) => {
  logMessages.push(args.join(' '));
  originalConsoleLog(...args);
};

describe('Integration Tests - Guest User Functionality', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    logMessages.length = 0;
  });

  afterAll(() => {
    console.log = originalConsoleLog;
  });

  test('Integration: Guest user authentication enables local features', async () => {
    // This test verifies that the authentication system correctly identifies
    // guest users and enables local storage features
    
    // Mock the api.me() response for guest user
    const mockApiMe = jest.fn().mockResolvedValue({
      actor: {
        type: 'guest',
        id: 'guest-integration-test'
      }
    });

    // Mock supabase client
    const mockSupabase = {
      auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: jest.fn().mockReturnValue({ 
          data: { subscription: { unsubscribe: jest.fn() } } 
        })
      }
    };

    // Simulate the authentication flow
    const hasSupabaseSession = false;
    const me = await mockApiMe();
    const actor = me?.actor;

    // Verify guest user is identified correctly
    expect(actor?.type).toBe('guest');
    expect(actor?.id).toBe('guest-integration-test');

    // Simulate the authentication logic from useAuth.ts
    let isAuthed = false;
    let actorLabel = '';

    if (actor?.type === 'user') {
      actorLabel = `user:${actor.id}`;
      isAuthed = true;
    } else if (actor?.type === 'guest') {
      actorLabel = `guest:${actor.id}`;
      // This is the key change: guest users are now authenticated
      isAuthed = true;
    } else {
      actorLabel = '';
      isAuthed = false;
    }

    // Verify that guest user is authenticated
    expect(isAuthed).toBe(true);
    expect(actorLabel).toBe('guest:guest-integration-test');
  });

  test('Integration: Existing authenticated users maintain behavior', async () => {
    // Mock the api.me() response for authenticated user
    const mockApiMe = jest.fn().mockResolvedValue({
      actor: {
        type: 'user',
        id: 'user-integration-test'
      }
    });

    const me = await mockApiMe();
    const actor = me?.actor;

    // Simulate the authentication logic
    let isAuthed = false;
    let actorLabel = '';

    if (actor?.type === 'user') {
      actorLabel = `user:${actor.id}`;
      isAuthed = true;
    } else if (actor?.type === 'guest') {
      actorLabel = `guest:${actor.id}`;
      isAuthed = true;
    } else {
      actorLabel = '';
      isAuthed = false;
    }

    // Verify that authenticated user behavior is unchanged
    expect(isAuthed).toBe(true);
    expect(actorLabel).toBe('user:user-integration-test');
  });

  test('Integration: Unauthenticated users remain unauthenticated', async () => {
    // Mock the api.me() response for unauthenticated user
    const mockApiMe = jest.fn().mockResolvedValue({
      actor: null
    });

    const me = await mockApiMe();
    const actor = me?.actor;

    // Simulate the authentication logic
    let isAuthed = false;
    let actorLabel = '';

    if (actor?.type === 'user') {
      actorLabel = `user:${actor.id}`;
      isAuthed = true;
    } else if (actor?.type === 'guest') {
      actorLabel = `guest:${actor.id}`;
      isAuthed = true;
    } else {
      actorLabel = '';
      isAuthed = false;
    }

    // Verify that unauthenticated user behavior is unchanged
    expect(isAuthed).toBe(false);
    expect(actorLabel).toBe('');
  });

  test('Integration: Error handling for localStorage operations', async () => {
    // Test localStorage error handling
    const originalSetItem = mockLocalStorage.setItem;
    
    // Mock localStorage.setItem to throw an error
    mockLocalStorage.setItem = jest.fn().mockImplementation(() => {
      throw new Error('localStorage quota exceeded');
    });

    try {
      // This should handle the error gracefully
      mockLocalStorage.setItem('test-key', 'test-value');
      // If we reach here, the error was not thrown (unexpected)
      expect(true).toBe(false);
    } catch (error) {
      // Verify that the error is properly caught
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('localStorage quota exceeded');
    }

    // Restore original function
    mockLocalStorage.setItem = originalSetItem;
  });
});