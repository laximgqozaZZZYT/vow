/**
 * Property-based tests for useExpandedHabits Hook
 * 
 * Tests the core property of the Habit expand/collapse state persistence:
 * - Property 12: Expanded State Persistence Round-Trip
 * 
 * **Validates: Requirements 7.1, 7.2**
 * 
 * Requirements tested:
 * - 7.1: WHEN a user expands or collapses a Habit's subtask list, THE System SHALL persist the state to local storage
 * - 7.2: WHEN the page is reloaded, THE System SHALL restore the expand/collapse state from local storage
 */

import * as fc from 'fast-check';
import {
  loadExpandedState,
  saveExpandedState,
  EXPANDED_HABITS_KEY,
} from '../app/dashboard/hooks/useExpandedHabits';

// ============================================================================
// LocalStorage Mock
// ============================================================================

/**
 * In-memory localStorage mock for testing
 */
class LocalStorageMock implements Storage {
  private store: Map<string, string> = new Map();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

// ============================================================================
// Test Setup
// ============================================================================

let localStorageMock: LocalStorageMock;
let originalLocalStorage: Storage;

beforeEach(() => {
  // Create fresh mock for each test
  localStorageMock = new LocalStorageMock();
  
  // Store original localStorage
  originalLocalStorage = window.localStorage;
  
  // Replace with mock
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  // Restore original localStorage
  Object.defineProperty(window, 'localStorage', {
    value: originalLocalStorage,
    writable: true,
    configurable: true,
  });
});

// ============================================================================
// Arbitraries (Test Data Generators)
// ============================================================================

/** Generate a valid habit ID string (UUID-like or simple alphanumeric) */
const habitIdArb = fc.stringMatching(/^[a-z0-9]{8,36}$/);

/** Generate an array of unique habit IDs */
const uniqueHabitIdsArb = (minLength: number = 0, maxLength: number = 20): fc.Arbitrary<string[]> =>
  fc.array(habitIdArb, { minLength, maxLength }).map((ids) => [...new Set(ids)]);

/** Generate a Set of habit IDs */
const habitIdSetArb = (minLength: number = 0, maxLength: number = 20): fc.Arbitrary<Set<string>> =>
  uniqueHabitIdsArb(minLength, maxLength).map((ids) => new Set(ids));

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Verify that two Sets contain the same elements
 */
function setsAreEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}

// ============================================================================
// Property Tests
// ============================================================================

describe('useExpandedHabits Property Tests', () => {
  describe('Property 12: Expanded State Persistence Round-Trip', () => {
    /**
     * **Validates: Requirements 7.1, 7.2**
     * 
     * *For any* habit, if the expanded state is toggled and saved to localStorage,
     * then reading from localStorage SHALL return the same expanded state.
     */
    test('save then load returns the same expanded state', () => {
      fc.assert(
        fc.property(habitIdSetArb(0, 20), (expandedIds) => {
          // Save the expanded state
          saveExpandedState(expandedIds);
          
          // Load the expanded state
          const loadedState = loadExpandedState();
          
          // Verify round-trip equality
          expect(setsAreEqual(expandedIds, loadedState)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: Requirements 7.1, 7.2**
     * 
     * Empty set should persist and load correctly
     */
    test('empty expanded state persists correctly', () => {
      const emptySet = new Set<string>();
      
      // Save empty state
      saveExpandedState(emptySet);
      
      // Load state
      const loadedState = loadExpandedState();
      
      // Should be empty
      expect(loadedState.size).toBe(0);
      expect(setsAreEqual(emptySet, loadedState)).toBe(true);
    });

    /**
     * **Validates: Requirements 7.1, 7.2**
     * 
     * Single habit ID should persist and load correctly
     */
    test('single habit ID persists correctly', () => {
      fc.assert(
        fc.property(habitIdArb, (habitId) => {
          const expandedIds = new Set([habitId]);
          
          // Save state
          saveExpandedState(expandedIds);
          
          // Load state
          const loadedState = loadExpandedState();
          
          // Should contain exactly the one habit ID
          expect(loadedState.size).toBe(1);
          expect(loadedState.has(habitId)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: Requirements 7.1, 7.2**
     * 
     * Multiple habit IDs should persist and load correctly
     */
    test('multiple habit IDs persist correctly', () => {
      fc.assert(
        fc.property(habitIdSetArb(2, 10), (expandedIds) => {
          // Save state
          saveExpandedState(expandedIds);
          
          // Load state
          const loadedState = loadExpandedState();
          
          // Should contain all habit IDs
          expect(loadedState.size).toBe(expandedIds.size);
          for (const id of expandedIds) {
            expect(loadedState.has(id)).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: Requirements 7.1, 7.2**
     * 
     * Overwriting existing state should work correctly
     */
    test('overwriting existing state works correctly', () => {
      fc.assert(
        fc.property(
          habitIdSetArb(1, 10),
          habitIdSetArb(1, 10),
          (firstState, secondState) => {
            // Save first state
            saveExpandedState(firstState);
            
            // Verify first state was saved
            let loadedState = loadExpandedState();
            expect(setsAreEqual(firstState, loadedState)).toBe(true);
            
            // Save second state (overwrite)
            saveExpandedState(secondState);
            
            // Verify second state is now loaded
            loadedState = loadExpandedState();
            expect(setsAreEqual(secondState, loadedState)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: Requirements 7.1, 7.2**
     * 
     * State should be stored under the correct localStorage key
     */
    test('state is stored under correct localStorage key', () => {
      fc.assert(
        fc.property(habitIdSetArb(1, 5), (expandedIds) => {
          // Save state
          saveExpandedState(expandedIds);
          
          // Verify it's stored under the correct key
          const storedValue = window.localStorage.getItem(EXPANDED_HABITS_KEY);
          expect(storedValue).not.toBeNull();
          
          // Parse and verify structure
          const parsed = JSON.parse(storedValue!);
          expect(parsed).toHaveProperty('expandedIds');
          expect(parsed).toHaveProperty('updatedAt');
          expect(Array.isArray(parsed.expandedIds)).toBe(true);
        }),
        { numRuns: 50 }
      );
    });

    /**
     * **Validates: Requirements 7.1, 7.2**
     * 
     * Stored data should have valid structure with updatedAt timestamp
     */
    test('stored data has valid structure with timestamp', () => {
      fc.assert(
        fc.property(habitIdSetArb(0, 10), (expandedIds) => {
          // Save state
          saveExpandedState(expandedIds);
          
          // Get stored value
          const storedValue = window.localStorage.getItem(EXPANDED_HABITS_KEY);
          expect(storedValue).not.toBeNull();
          
          // Parse and verify structure
          const parsed = JSON.parse(storedValue!);
          
          // Should have expandedIds array
          expect(Array.isArray(parsed.expandedIds)).toBe(true);
          expect(parsed.expandedIds.length).toBe(expandedIds.size);
          
          // Should have valid ISO timestamp
          expect(typeof parsed.updatedAt).toBe('string');
          const timestamp = new Date(parsed.updatedAt);
          expect(timestamp.getTime()).not.toBeNaN();
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Error Handling and Edge Cases', () => {
    /**
     * **Validates: Requirements 7.2**
     * 
     * Loading from empty localStorage should return empty Set
     */
    test('loading from empty localStorage returns empty Set', () => {
      // Ensure localStorage is empty
      window.localStorage.clear();
      
      // Load state
      const loadedState = loadExpandedState();
      
      // Should return empty Set
      expect(loadedState.size).toBe(0);
    });

    /**
     * **Validates: Requirements 7.2**
     * 
     * Loading with corrupted JSON should return empty Set (graceful fallback)
     */
    test('loading with corrupted JSON returns empty Set', () => {
      // Store corrupted JSON
      window.localStorage.setItem(EXPANDED_HABITS_KEY, '{invalid json}');
      
      // Load state - should not throw
      const loadedState = loadExpandedState();
      
      // Should return empty Set as fallback
      expect(loadedState.size).toBe(0);
    });

    /**
     * **Validates: Requirements 7.2**
     * 
     * Loading with invalid structure should return empty Set (graceful fallback)
     */
    test('loading with invalid structure returns empty Set', () => {
      // Store valid JSON but invalid structure
      window.localStorage.setItem(EXPANDED_HABITS_KEY, JSON.stringify({ foo: 'bar' }));
      
      // Load state - should not throw
      const loadedState = loadExpandedState();
      
      // Should return empty Set as fallback
      expect(loadedState.size).toBe(0);
    });

    /**
     * **Validates: Requirements 7.2**
     * 
     * Loading with non-array expandedIds should return empty Set
     */
    test('loading with non-array expandedIds returns empty Set', () => {
      // Store valid JSON but expandedIds is not an array
      window.localStorage.setItem(
        EXPANDED_HABITS_KEY,
        JSON.stringify({ expandedIds: 'not-an-array', updatedAt: new Date().toISOString() })
      );
      
      // Load state - should not throw
      const loadedState = loadExpandedState();
      
      // Should return empty Set as fallback
      expect(loadedState.size).toBe(0);
    });

    /**
     * **Validates: Requirements 7.2**
     * 
     * Loading with non-string items in expandedIds should return empty Set
     */
    test('loading with non-string items in expandedIds returns empty Set', () => {
      // Store valid JSON but expandedIds contains non-strings
      window.localStorage.setItem(
        EXPANDED_HABITS_KEY,
        JSON.stringify({ expandedIds: [123, null, { id: 'test' }], updatedAt: new Date().toISOString() })
      );
      
      // Load state - should not throw
      const loadedState = loadExpandedState();
      
      // Should return empty Set as fallback
      expect(loadedState.size).toBe(0);
    });

    /**
     * **Validates: Requirements 7.1, 7.2**
     * 
     * Habit IDs with special characters should persist correctly
     */
    test('habit IDs with special characters persist correctly', () => {
      const specialIds = new Set([
        'habit-with-dashes',
        'habit_with_underscores',
        'habit123',
        'UPPERCASE',
        'MixedCase123',
      ]);
      
      // Save state
      saveExpandedState(specialIds);
      
      // Load state
      const loadedState = loadExpandedState();
      
      // Should match exactly
      expect(setsAreEqual(specialIds, loadedState)).toBe(true);
    });

    /**
     * **Validates: Requirements 7.1, 7.2**
     * 
     * Large number of habit IDs should persist correctly
     */
    test('large number of habit IDs persists correctly', () => {
      fc.assert(
        fc.property(habitIdSetArb(50, 100), (expandedIds) => {
          // Save state
          saveExpandedState(expandedIds);
          
          // Load state
          const loadedState = loadExpandedState();
          
          // Should match exactly
          expect(setsAreEqual(expandedIds, loadedState)).toBe(true);
        }),
        { numRuns: 20 }
      );
    });
  });

  describe('Idempotency Properties', () => {
    /**
     * **Validates: Requirements 7.1, 7.2**
     * 
     * Saving the same state multiple times should be idempotent
     */
    test('saving same state multiple times is idempotent', () => {
      fc.assert(
        fc.property(
          habitIdSetArb(1, 10),
          fc.integer({ min: 2, max: 5 }),
          (expandedIds, saveCount) => {
            // Save the same state multiple times
            for (let i = 0; i < saveCount; i++) {
              saveExpandedState(expandedIds);
            }
            
            // Load state
            const loadedState = loadExpandedState();
            
            // Should still match the original
            expect(setsAreEqual(expandedIds, loadedState)).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * **Validates: Requirements 7.1, 7.2**
     * 
     * Loading multiple times should return consistent results
     */
    test('loading multiple times returns consistent results', () => {
      fc.assert(
        fc.property(
          habitIdSetArb(1, 10),
          fc.integer({ min: 2, max: 5 }),
          (expandedIds, loadCount) => {
            // Save state once
            saveExpandedState(expandedIds);
            
            // Load multiple times
            const results: Set<string>[] = [];
            for (let i = 0; i < loadCount; i++) {
              results.push(loadExpandedState());
            }
            
            // All results should be equal
            for (const result of results) {
              expect(setsAreEqual(expandedIds, result)).toBe(true);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Toggle Simulation', () => {
    /**
     * **Validates: Requirements 7.1, 7.2**
     * 
     * Simulating toggle operations should persist correctly
     */
    test('toggle operations persist correctly', () => {
      fc.assert(
        fc.property(
          habitIdSetArb(0, 5),
          habitIdArb,
          (initialIds, toggleId) => {
            // Start with initial state
            const expandedIds = new Set(initialIds);
            saveExpandedState(expandedIds);
            
            // Toggle the habit ID
            if (expandedIds.has(toggleId)) {
              expandedIds.delete(toggleId);
            } else {
              expandedIds.add(toggleId);
            }
            
            // Save toggled state
            saveExpandedState(expandedIds);
            
            // Load and verify
            const loadedState = loadExpandedState();
            expect(setsAreEqual(expandedIds, loadedState)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: Requirements 7.1, 7.2**
     * 
     * Multiple toggle operations should persist correctly
     */
    test('multiple toggle operations persist correctly', () => {
      fc.assert(
        fc.property(
          habitIdSetArb(0, 5),
          fc.array(habitIdArb, { minLength: 1, maxLength: 10 }),
          (initialIds, toggleIds) => {
            // Start with initial state
            const expandedIds = new Set(initialIds);
            
            // Apply all toggles
            for (const toggleId of toggleIds) {
              if (expandedIds.has(toggleId)) {
                expandedIds.delete(toggleId);
              } else {
                expandedIds.add(toggleId);
              }
            }
            
            // Save final state
            saveExpandedState(expandedIds);
            
            // Load and verify
            const loadedState = loadExpandedState();
            expect(setsAreEqual(expandedIds, loadedState)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
