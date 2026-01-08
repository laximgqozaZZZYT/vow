/**
 * Property-based tests for guest user authentication state
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

// Mock api.me() function
const mockApiMe = jest.fn();
jest.mock('../lib/api', () => ({
  me: mockApiMe
}));

// Mock supabase client
jest.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn().mockReturnValue({ 
        data: { subscription: { unsubscribe: jest.fn() } } 
      })
    }
  }
}));

import { renderHook, waitFor } from '@testing-library/react';
import { useAuth } from '../app/dashboard/hooks/useAuth';

// Mock useRouter
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush
  })
}));

describe('useAuth - Guest User Support', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.clear();
  });

  /**
   * Property 1: Guest user authentication state
   * Feature: guest-user-habit-goal-support, Property 1: Guest user authentication state
   * Validates: Requirements 1.1
   */
  test('Property 1: Guest users should be authenticated to enable local features', async () => {
    // Setup: Mock api.me() to return guest user
    mockApiMe.mockResolvedValue({
      actor: {
        type: 'guest',
        id: 'guest-123'
      }
    });

    // Execute: Render the hook
    const { result } = renderHook(() => useAuth());

    // Wait for authentication to complete
    await waitFor(() => {
      expect(result.current.isAuthed).toBe(true);
    });

    // Verify: Guest user should be authenticated
    expect(result.current.isAuthed).toBe(true);
    expect(result.current.actorLabel).toBe('guest:guest-123');
  });

  /**
   * Property 2: Backward compatibility preservation
   * Feature: guest-user-habit-goal-support, Property 2: Backward compatibility preservation
   * Validates: Requirements 1.4
   */
  test('Property 2: Authenticated users should maintain existing behavior', async () => {
    // Setup: Mock api.me() to return authenticated user
    mockApiMe.mockResolvedValue({
      actor: {
        type: 'user',
        id: 'user-456'
      }
    });

    // Execute: Render the hook
    const { result } = renderHook(() => useAuth());

    // Wait for authentication to complete
    await waitFor(() => {
      expect(result.current.isAuthed).toBe(true);
    });

    // Verify: Authenticated user behavior unchanged
    expect(result.current.isAuthed).toBe(true);
    expect(result.current.actorLabel).toBe('user:user-456');
  });

  test('Property 2: Unauthenticated users should remain unauthenticated', async () => {
    // Setup: Mock api.me() to return no actor or unknown type
    mockApiMe.mockResolvedValue({
      actor: null
    });

    // Execute: Render the hook
    const { result } = renderHook(() => useAuth());

    // Wait for authentication to complete
    await waitFor(() => {
      expect(result.current.isAuthed).toBe(false);
    });

    // Verify: Unauthenticated user behavior unchanged
    expect(result.current.isAuthed).toBe(false);
    expect(result.current.actorLabel).toBe('');
  });
});