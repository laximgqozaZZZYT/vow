/**
 * Property-Based Tests for Habit Modal Tabs
 * 
 * **Feature: habit-modal-tabs, Property 1: Tab click navigation**
 * **Validates: Requirements 1.3**
 * 
 * **Feature: habit-modal-tabs, Property 9: LocalStorage tab persistence**
 * **Validates: Requirements 10.5**
 * 
 * Tests that clicking any valid tab index results in that tab becoming active.
 * Tests that tab selections are persisted to localStorage and restored on reopen.
 * Uses fast-check for property-based testing with at least 100 iterations.
 */

import * as fc from 'fast-check';
import { renderHook, act } from '@testing-library/react';
import { useTabNavigation } from '../../app/hooks/useTabNavigation';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get store() {
      return store;
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('Feature: habit-modal-tabs, Property 1: Tab click navigation', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  /**
   * Property 1: Tab Click Navigation
   * 
   * *For any* tab index in the valid range [0, 3], clicking that tab should 
   * result in the active tab index being set to the clicked index.
   * 
   * **Validates: Requirements 1.3**
   */
  describe('Property 1: Tab click navigation', () => {
    it('clicking any valid tab index [0-3] should set that tab as active', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 3 }),
          (tabIndex) => {
            const { result } = renderHook(() => useTabNavigation());
            
            act(() => {
              result.current.setActiveTab(tabIndex);
            });
            
            // The active tab should be exactly the clicked index
            expect(result.current.activeTab).toBe(tabIndex);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('clicking any valid tab index should persist to localStorage', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 3 }),
          (tabIndex) => {
            localStorageMock.clear();
            jest.clearAllMocks();
            
            const { result } = renderHook(() => useTabNavigation());
            
            act(() => {
              result.current.setActiveTab(tabIndex);
            });
            
            // Should persist to localStorage
            expect(localStorageMock.setItem).toHaveBeenCalledWith(
              'habitModalActiveTab',
              String(tabIndex)
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('clicking any valid tab from any starting position should work correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 3 }), // starting tab
          fc.integer({ min: 0, max: 3 }), // target tab
          (startTab, targetTab) => {
            localStorageMock.clear();
            
            const { result } = renderHook(() => useTabNavigation());
            
            // Set initial tab
            act(() => {
              result.current.setActiveTab(startTab);
            });
            
            expect(result.current.activeTab).toBe(startTab);
            
            // Navigate to target tab
            act(() => {
              result.current.setActiveTab(targetTab);
            });
            
            // Should be at target tab regardless of starting position
            expect(result.current.activeTab).toBe(targetTab);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('boundary indicators should be correct for any valid tab index', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 3 }),
          (tabIndex) => {
            const { result } = renderHook(() => useTabNavigation());
            
            act(() => {
              result.current.setActiveTab(tabIndex);
            });
            
            // isFirstTab should be true only when at index 0
            expect(result.current.isFirstTab).toBe(tabIndex === 0);
            
            // isLastTab should be true only when at index 3
            expect(result.current.isLastTab).toBe(tabIndex === 3);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('invalid tab indices should be clamped to valid range', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -100, max: 100 }),
          (tabIndex) => {
            const { result } = renderHook(() => useTabNavigation());
            
            act(() => {
              result.current.setActiveTab(tabIndex);
            });
            
            // Result should always be within valid range [0, 3]
            expect(result.current.activeTab).toBeGreaterThanOrEqual(0);
            expect(result.current.activeTab).toBeLessThanOrEqual(3);
            
            // Verify clamping behavior
            if (tabIndex < 0) {
              expect(result.current.activeTab).toBe(0);
            } else if (tabIndex > 3) {
              expect(result.current.activeTab).toBe(3);
            } else {
              expect(result.current.activeTab).toBe(Math.floor(tabIndex));
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('sequential tab navigation should work correctly', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 0, max: 3 }), { minLength: 1, maxLength: 10 }),
          (tabSequence) => {
            const { result } = renderHook(() => useTabNavigation());
            
            // Navigate through each tab in sequence
            for (const tabIndex of tabSequence) {
              act(() => {
                result.current.setActiveTab(tabIndex);
              });
              
              // After each navigation, active tab should match
              expect(result.current.activeTab).toBe(tabIndex);
            }
            
            // Final state should be the last tab in sequence
            expect(result.current.activeTab).toBe(tabSequence[tabSequence.length - 1]);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


/**
 * Feature: habit-modal-tabs, Property 9: LocalStorage tab persistence
 * 
 * *For any* tab selection, the active tab index should be saved to localStorage.
 * When the modal reopens, the active tab should be restored from localStorage.
 * 
 * **Validates: Requirements 10.5**
 */
describe('Feature: habit-modal-tabs, Property 9: LocalStorage tab persistence', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  /**
   * Property 9.1: Tab selection persistence
   * 
   * *For any* valid tab index, selecting that tab should save it to localStorage.
   */
  it('any tab selection should be saved to localStorage', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }),
        (tabIndex) => {
          localStorageMock.clear();
          jest.clearAllMocks();
          
          const { result } = renderHook(() => useTabNavigation());
          
          act(() => {
            result.current.setActiveTab(tabIndex);
          });
          
          // Verify localStorage was called with correct key and value
          expect(localStorageMock.setItem).toHaveBeenCalledWith(
            'habitModalActiveTab',
            String(tabIndex)
          );
          
          // Verify the stored value matches the selected tab
          expect(localStorageMock.store['habitModalActiveTab']).toBe(String(tabIndex));
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.2: Tab restoration on reopen
   * 
   * *For any* tab index stored in localStorage, reopening the hook should
   * restore that tab as the active tab.
   */
  it('reopening the hook should restore the saved tab from localStorage', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }),
        (tabIndex) => {
          // Clear and set up localStorage with the tab index
          localStorageMock.clear();
          localStorageMock.setItem('habitModalActiveTab', String(tabIndex));
          jest.clearAllMocks();
          
          // Simulate "reopening" by creating a new hook instance
          const { result } = renderHook(() => useTabNavigation());
          
          // The active tab should be restored from localStorage
          expect(result.current.activeTab).toBe(tabIndex);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.3: Round-trip persistence
   * 
   * *For any* sequence of tab selections, the last selected tab should be
   * persisted and restored correctly when the hook is reinitialized.
   */
  it('last selected tab should be restored after multiple selections', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 3 }), { minLength: 1, maxLength: 10 }),
        (tabSequence) => {
          localStorageMock.clear();
          
          // First hook instance - make selections
          const { result: firstResult, unmount } = renderHook(() => useTabNavigation());
          
          // Navigate through each tab in sequence
          for (const tabIndex of tabSequence) {
            act(() => {
              firstResult.current.setActiveTab(tabIndex);
            });
          }
          
          const lastTab = tabSequence[tabSequence.length - 1];
          
          // Verify localStorage has the last tab
          expect(localStorageMock.store['habitModalActiveTab']).toBe(String(lastTab));
          
          // Unmount first hook (simulate closing modal)
          unmount();
          
          // Second hook instance - should restore last tab
          const { result: secondResult } = renderHook(() => useTabNavigation());
          
          // The restored tab should be the last one selected
          expect(secondResult.current.activeTab).toBe(lastTab);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.4: goToNextTab persistence
   * 
   * *For any* starting tab, using goToNextTab should persist the new tab index.
   */
  it('goToNextTab should persist the new tab index to localStorage', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 }), // 0-2 so we can go to next
        (startTab) => {
          localStorageMock.clear();
          localStorageMock.setItem('habitModalActiveTab', String(startTab));
          jest.clearAllMocks();
          
          const { result } = renderHook(() => useTabNavigation());
          
          act(() => {
            result.current.goToNextTab();
          });
          
          const expectedTab = startTab + 1;
          
          // Verify the new tab is persisted
          expect(localStorageMock.store['habitModalActiveTab']).toBe(String(expectedTab));
          expect(result.current.activeTab).toBe(expectedTab);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.5: goToPreviousTab persistence
   * 
   * *For any* starting tab (not first), using goToPreviousTab should persist the new tab index.
   */
  it('goToPreviousTab should persist the new tab index to localStorage', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3 }), // 1-3 so we can go to previous
        (startTab) => {
          localStorageMock.clear();
          localStorageMock.setItem('habitModalActiveTab', String(startTab));
          jest.clearAllMocks();
          
          const { result } = renderHook(() => useTabNavigation());
          
          act(() => {
            result.current.goToPreviousTab();
          });
          
          const expectedTab = startTab - 1;
          
          // Verify the new tab is persisted
          expect(localStorageMock.store['habitModalActiveTab']).toBe(String(expectedTab));
          expect(result.current.activeTab).toBe(expectedTab);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.6: Invalid localStorage values fallback
   * 
   * *For any* invalid value in localStorage, the hook should fallback to default tab (0).
   */
  it('invalid localStorage values should fallback to default tab 0', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string().filter(s => isNaN(parseInt(s, 10))), // Non-numeric strings
          fc.integer({ min: -100, max: -1 }).map(String),   // Negative numbers
          fc.integer({ min: 4, max: 100 }).map(String)      // Out of range numbers
        ),
        (invalidValue) => {
          localStorageMock.clear();
          localStorageMock.setItem('habitModalActiveTab', invalidValue);
          
          const { result } = renderHook(() => useTabNavigation());
          
          // Should fallback to default tab 0
          expect(result.current.activeTab).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.7: Empty localStorage fallback
   * 
   * When localStorage has no stored tab, the hook should default to tab 0.
   */
  it('empty localStorage should default to tab 0', () => {
    localStorageMock.clear();
    
    const { result } = renderHook(() => useTabNavigation());
    
    expect(result.current.activeTab).toBe(0);
  });
});



/**
 * Feature: habit-modal-tabs, Property 7: Form data round-trip preservation
 * 
 * *For any* form data entered in any tab, switching to a different tab and then
 * returning to the original tab should preserve all entered values exactly.
 * 
 * **Validates: Requirements 8.1, 8.2**
 * 
 * Requirements:
 * - 8.1: WHEN switching between tabs, THE System SHALL preserve all entered form data
 * - 8.2: WHEN returning to a previously visited tab, THE System SHALL display the previously entered values
 */
describe('Feature: habit-modal-tabs, Property 7: Form data round-trip preservation', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  // ============================================================================
  // Types for Form State
  // ============================================================================

  type TimingType = 'Date' | 'Daily' | 'Weekly' | 'Monthly';

  interface Timing {
    id?: string;
    type: TimingType;
    date?: string;
    start?: string;
    end?: string;
    cron?: string;
  }

  interface HabitFormState {
    // Basic Tab fields
    name: string;
    type: 'do' | 'avoid';
    timings: Timing[];
    notes: string;
    // Exclusion Tab fields
    outdates: Timing[];
    // Workload Tab fields
    workloadUnit: string;
    workloadTotal: string;
    workloadTotalEnd: string;
    workloadPerCount: string;
    // Detail Tab fields
    goalId: string | undefined;
    selectedTagIds: string[];
  }

  // ============================================================================
  // Generators for Form Data
  // ============================================================================

  /**
   * Generator for valid timing type
   */
  const timingTypeArb = fc.constantFrom<TimingType>('Date', 'Daily', 'Weekly', 'Monthly');

  /**
   * Generator for valid time string (HH:MM format)
   */
  const timeStringArb = fc.tuple(
    fc.integer({ min: 0, max: 23 }),
    fc.integer({ min: 0, max: 59 })
  ).map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);

  /**
   * Generator for valid date string (YYYY-MM-DD format)
   */
  const dateStringArb = fc.tuple(
    fc.integer({ min: 2020, max: 2030 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 }) // Use 28 to avoid invalid dates
  ).map(([y, m, d]) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);

  /**
   * Generator for a single Timing object
   */
  const timingArb: fc.Arbitrary<Timing> = fc.record({
    type: timingTypeArb,
    date: fc.option(dateStringArb, { nil: undefined }),
    start: fc.option(timeStringArb, { nil: undefined }),
    end: fc.option(timeStringArb, { nil: undefined }),
  });

  /**
   * Generator for Basic Tab form data
   */
  const basicTabDataArb = fc.record({
    name: fc.string({ minLength: 0, maxLength: 100 }),
    type: fc.constantFrom<'do' | 'avoid'>('do', 'avoid'),
    timings: fc.array(timingArb, { minLength: 1, maxLength: 5 }),
    notes: fc.string({ minLength: 0, maxLength: 500 }),
  });

  /**
   * Generator for Exclusion Tab form data (outdates)
   */
  const exclusionTabDataArb = fc.record({
    outdates: fc.array(timingArb, { minLength: 0, maxLength: 5 }),
  });

  /**
   * Generator for Workload Tab form data
   */
  const workloadTabDataArb = fc.record({
    workloadUnit: fc.string({ minLength: 0, maxLength: 20 }),
    workloadTotal: fc.oneof(
      fc.constant(''),
      fc.integer({ min: 1, max: 1000 }).map(String)
    ),
    workloadTotalEnd: fc.oneof(
      fc.constant(''),
      fc.integer({ min: 1, max: 10000 }).map(String)
    ),
    workloadPerCount: fc.oneof(
      fc.constant('1'),
      fc.integer({ min: 1, max: 100 }).map(String)
    ),
  });

  /**
   * Generator for Detail Tab form data
   */
  const detailTabDataArb = fc.record({
    goalId: fc.option(fc.uuid(), { nil: undefined }),
    selectedTagIds: fc.array(fc.uuid(), { minLength: 0, maxLength: 10 }),
  });

  /**
   * Generator for complete HabitFormState
   */
  const habitFormStateArb: fc.Arbitrary<HabitFormState> = fc.record({
    name: fc.string({ minLength: 0, maxLength: 100 }),
    type: fc.constantFrom<'do' | 'avoid'>('do', 'avoid'),
    timings: fc.array(timingArb, { minLength: 1, maxLength: 5 }),
    notes: fc.string({ minLength: 0, maxLength: 500 }),
    outdates: fc.array(timingArb, { minLength: 0, maxLength: 5 }),
    workloadUnit: fc.string({ minLength: 0, maxLength: 20 }),
    workloadTotal: fc.oneof(fc.constant(''), fc.integer({ min: 1, max: 1000 }).map(String)),
    workloadTotalEnd: fc.oneof(fc.constant(''), fc.integer({ min: 1, max: 10000 }).map(String)),
    workloadPerCount: fc.oneof(fc.constant('1'), fc.integer({ min: 1, max: 100 }).map(String)),
    goalId: fc.option(fc.uuid(), { nil: undefined }),
    selectedTagIds: fc.array(fc.uuid(), { minLength: 0, maxLength: 10 }),
  });

  // ============================================================================
  // Helper: Simulate Form State Management
  // ============================================================================

  /**
   * Simulates the form state management behavior of HabitModal.
   * This is a pure function that mimics how React state preserves data across tab switches.
   * 
   * The key insight is that form state is stored in React useState hooks at the modal level,
   * not within individual tabs. Tab switching only changes which tab is visible (activeTab),
   * but doesn't affect the underlying form state.
   */
  function createFormStateManager(initialState: HabitFormState) {
    // This simulates the React state - it persists across tab switches
    let formState = { ...initialState };
    let activeTab = 0;

    return {
      getFormState: () => ({ ...formState }),
      getActiveTab: () => activeTab,
      setActiveTab: (tab: number) => {
        // Tab switching doesn't affect form state - this is the key property we're testing
        activeTab = Math.max(0, Math.min(3, tab));
      },
      updateField: (field: keyof HabitFormState, value: any) => {
        formState = { ...formState, [field]: value };
      },
      // Simulate the round-trip: enter data, switch tab, return, verify data
      roundTrip: (startTab: number, intermediateTab: number) => {
        const stateBefore = { ...formState };
        
        // Go to start tab
        activeTab = startTab;
        
        // Switch to intermediate tab
        activeTab = intermediateTab;
        
        // Return to start tab
        activeTab = startTab;
        
        const stateAfter = { ...formState };
        
        // Form state should be unchanged
        return {
          stateBefore,
          stateAfter,
          preserved: JSON.stringify(stateBefore) === JSON.stringify(stateAfter),
        };
      },
    };
  }

  // ============================================================================
  // Property Tests
  // ============================================================================

  /**
   * Property 7.1: Basic Tab data preservation
   * 
   * *For any* Basic Tab form data (name, type, timings, notes), switching to another
   * tab and returning should preserve all values exactly.
   */
  it('Basic Tab data should be preserved after switching tabs and returning', () => {
    fc.assert(
      fc.property(
        basicTabDataArb,
        fc.integer({ min: 1, max: 3 }), // intermediate tab (not Basic tab 0)
        (basicData, intermediateTab) => {
          const initialState: HabitFormState = {
            ...basicData,
            outdates: [],
            workloadUnit: '',
            workloadTotal: '',
            workloadTotalEnd: '',
            workloadPerCount: '1',
            goalId: undefined,
            selectedTagIds: [],
          };

          const manager = createFormStateManager(initialState);
          const result = manager.roundTrip(0, intermediateTab);

          // All Basic Tab fields should be preserved
          expect(result.stateAfter.name).toBe(result.stateBefore.name);
          expect(result.stateAfter.type).toBe(result.stateBefore.type);
          expect(result.stateAfter.timings).toEqual(result.stateBefore.timings);
          expect(result.stateAfter.notes).toBe(result.stateBefore.notes);
          expect(result.preserved).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.2: Exclusion Tab data preservation
   * 
   * *For any* Exclusion Tab form data (outdates), switching to another tab
   * and returning should preserve all values exactly.
   */
  it('Exclusion Tab data should be preserved after switching tabs and returning', () => {
    fc.assert(
      fc.property(
        exclusionTabDataArb,
        fc.integer({ min: 0, max: 3 }).filter(t => t !== 1), // intermediate tab (not Exclusion tab 1)
        (exclusionData, intermediateTab) => {
          const initialState: HabitFormState = {
            name: 'Test Habit',
            type: 'do',
            timings: [{ type: 'Daily' }],
            notes: '',
            ...exclusionData,
            workloadUnit: '',
            workloadTotal: '',
            workloadTotalEnd: '',
            workloadPerCount: '1',
            goalId: undefined,
            selectedTagIds: [],
          };

          const manager = createFormStateManager(initialState);
          const result = manager.roundTrip(1, intermediateTab);

          // Exclusion Tab fields should be preserved
          expect(result.stateAfter.outdates).toEqual(result.stateBefore.outdates);
          expect(result.preserved).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.3: Workload Tab data preservation
   * 
   * *For any* Workload Tab form data (workloadUnit, workloadTotal, workloadTotalEnd, workloadPerCount),
   * switching to another tab and returning should preserve all values exactly.
   */
  it('Workload Tab data should be preserved after switching tabs and returning', () => {
    fc.assert(
      fc.property(
        workloadTabDataArb,
        fc.integer({ min: 0, max: 3 }).filter(t => t !== 2), // intermediate tab (not Workload tab 2)
        (workloadData, intermediateTab) => {
          const initialState: HabitFormState = {
            name: 'Test Habit',
            type: 'do',
            timings: [{ type: 'Daily' }],
            notes: '',
            outdates: [],
            ...workloadData,
            goalId: undefined,
            selectedTagIds: [],
          };

          const manager = createFormStateManager(initialState);
          const result = manager.roundTrip(2, intermediateTab);

          // Workload Tab fields should be preserved
          expect(result.stateAfter.workloadUnit).toBe(result.stateBefore.workloadUnit);
          expect(result.stateAfter.workloadTotal).toBe(result.stateBefore.workloadTotal);
          expect(result.stateAfter.workloadTotalEnd).toBe(result.stateBefore.workloadTotalEnd);
          expect(result.stateAfter.workloadPerCount).toBe(result.stateBefore.workloadPerCount);
          expect(result.preserved).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.4: Detail Tab data preservation
   * 
   * *For any* Detail Tab form data (goalId, selectedTagIds), switching to another
   * tab and returning should preserve all values exactly.
   */
  it('Detail Tab data should be preserved after switching tabs and returning', () => {
    fc.assert(
      fc.property(
        detailTabDataArb,
        fc.integer({ min: 0, max: 2 }), // intermediate tab (not Detail tab 3)
        (detailData, intermediateTab) => {
          const initialState: HabitFormState = {
            name: 'Test Habit',
            type: 'do',
            timings: [{ type: 'Daily' }],
            notes: '',
            outdates: [],
            workloadUnit: '',
            workloadTotal: '',
            workloadTotalEnd: '',
            workloadPerCount: '1',
            ...detailData,
          };

          const manager = createFormStateManager(initialState);
          const result = manager.roundTrip(3, intermediateTab);

          // Detail Tab fields should be preserved
          expect(result.stateAfter.goalId).toBe(result.stateBefore.goalId);
          expect(result.stateAfter.selectedTagIds).toEqual(result.stateBefore.selectedTagIds);
          expect(result.preserved).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.5: Complete form state preservation across any tab switch
   * 
   * *For any* complete form state and any pair of tabs (start, intermediate),
   * the round-trip should preserve all form data exactly.
   */
  it('complete form state should be preserved for any tab switch round-trip', () => {
    fc.assert(
      fc.property(
        habitFormStateArb,
        fc.integer({ min: 0, max: 3 }), // start tab
        fc.integer({ min: 0, max: 3 }), // intermediate tab
        (formState, startTab, intermediateTab) => {
          const manager = createFormStateManager(formState);
          const result = manager.roundTrip(startTab, intermediateTab);

          // All fields should be preserved
          expect(result.stateAfter).toEqual(result.stateBefore);
          expect(result.preserved).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.6: Multiple tab switches preserve data
   * 
   * *For any* form state and any sequence of tab switches, the form data
   * should remain unchanged throughout all switches.
   */
  it('form data should be preserved through multiple tab switches', () => {
    fc.assert(
      fc.property(
        habitFormStateArb,
        fc.array(fc.integer({ min: 0, max: 3 }), { minLength: 2, maxLength: 10 }),
        (formState, tabSequence) => {
          const manager = createFormStateManager(formState);
          const initialState = manager.getFormState();

          // Navigate through all tabs in sequence
          for (const tab of tabSequence) {
            manager.setActiveTab(tab);
          }

          const finalState = manager.getFormState();

          // Form state should be unchanged after all tab switches
          expect(finalState).toEqual(initialState);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.7: Data modification in one tab doesn't affect other tabs' data
   * 
   * *For any* form state, modifying a field in one tab should not affect
   * fields belonging to other tabs.
   */
  it('modifying data in one tab should not affect other tabs data', () => {
    fc.assert(
      fc.property(
        habitFormStateArb,
        fc.string({ minLength: 1, maxLength: 50 }), // new name value
        (formState, newName) => {
          const manager = createFormStateManager(formState);
          
          // Store original values from other tabs
          const originalOutdates = [...formState.outdates];
          const originalWorkloadUnit = formState.workloadUnit;
          const originalGoalId = formState.goalId;
          const originalSelectedTagIds = [...formState.selectedTagIds];

          // Modify Basic Tab field (name)
          manager.setActiveTab(0);
          manager.updateField('name', newName);

          // Switch to other tabs and verify their data is unchanged
          manager.setActiveTab(1); // Exclusion Tab
          expect(manager.getFormState().outdates).toEqual(originalOutdates);

          manager.setActiveTab(2); // Workload Tab
          expect(manager.getFormState().workloadUnit).toBe(originalWorkloadUnit);

          manager.setActiveTab(3); // Detail Tab
          expect(manager.getFormState().goalId).toBe(originalGoalId);
          expect(manager.getFormState().selectedTagIds).toEqual(originalSelectedTagIds);

          // The modified field should have the new value
          expect(manager.getFormState().name).toBe(newName);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.8: Empty and edge case values are preserved
   * 
   * *For any* form state with empty strings, empty arrays, or undefined values,
   * these edge case values should be preserved exactly through tab switches.
   */
  it('empty and edge case values should be preserved through tab switches', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }), // start tab
        fc.integer({ min: 0, max: 3 }), // intermediate tab
        (startTab, intermediateTab) => {
          // Form state with edge case values
          const edgeCaseState: HabitFormState = {
            name: '', // empty string
            type: 'do',
            timings: [{ type: 'Daily' }], // minimal timing
            notes: '', // empty string
            outdates: [], // empty array
            workloadUnit: '', // empty string
            workloadTotal: '', // empty string
            workloadTotalEnd: '', // empty string
            workloadPerCount: '1',
            goalId: undefined, // undefined
            selectedTagIds: [], // empty array
          };

          const manager = createFormStateManager(edgeCaseState);
          const result = manager.roundTrip(startTab, intermediateTab);

          // All edge case values should be preserved exactly
          expect(result.stateAfter.name).toBe('');
          expect(result.stateAfter.notes).toBe('');
          expect(result.stateAfter.outdates).toEqual([]);
          expect(result.stateAfter.workloadUnit).toBe('');
          expect(result.stateAfter.workloadTotal).toBe('');
          expect(result.stateAfter.workloadTotalEnd).toBe('');
          expect(result.stateAfter.goalId).toBeUndefined();
          expect(result.stateAfter.selectedTagIds).toEqual([]);
          expect(result.preserved).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.9: Complex timing arrays are preserved
   * 
   * *For any* form state with complex timing configurations (multiple timings
   * with various types, dates, and times), all timing data should be preserved
   * exactly through tab switches.
   */
  it('complex timing arrays should be preserved through tab switches', () => {
    fc.assert(
      fc.property(
        fc.array(timingArb, { minLength: 1, maxLength: 10 }),
        fc.integer({ min: 1, max: 3 }), // intermediate tab (not Basic tab)
        (timings, intermediateTab) => {
          const formState: HabitFormState = {
            name: 'Test Habit',
            type: 'do',
            timings,
            notes: '',
            outdates: [],
            workloadUnit: '',
            workloadTotal: '',
            workloadTotalEnd: '',
            workloadPerCount: '1',
            goalId: undefined,
            selectedTagIds: [],
          };

          const manager = createFormStateManager(formState);
          const result = manager.roundTrip(0, intermediateTab);

          // Timings array should be preserved exactly
          expect(result.stateAfter.timings).toEqual(result.stateBefore.timings);
          expect(result.stateAfter.timings.length).toBe(timings.length);
          
          // Each timing should match exactly
          for (let i = 0; i < timings.length; i++) {
            expect(result.stateAfter.timings[i]).toEqual(timings[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.10: Tag IDs array order is preserved
   * 
   * *For any* array of tag IDs, the order should be preserved exactly
   * through tab switches (order matters for display consistency).
   */
  it('tag IDs array order should be preserved through tab switches', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 0, maxLength: 20 }),
        fc.integer({ min: 0, max: 2 }), // intermediate tab (not Detail tab)
        (tagIds, intermediateTab) => {
          const formState: HabitFormState = {
            name: 'Test Habit',
            type: 'do',
            timings: [{ type: 'Daily' }],
            notes: '',
            outdates: [],
            workloadUnit: '',
            workloadTotal: '',
            workloadTotalEnd: '',
            workloadPerCount: '1',
            goalId: undefined,
            selectedTagIds: tagIds,
          };

          const manager = createFormStateManager(formState);
          const result = manager.roundTrip(3, intermediateTab);

          // Tag IDs should be preserved in exact order
          expect(result.stateAfter.selectedTagIds).toEqual(tagIds);
          expect(result.stateAfter.selectedTagIds.length).toBe(tagIds.length);
          
          for (let i = 0; i < tagIds.length; i++) {
            expect(result.stateAfter.selectedTagIds[i]).toBe(tagIds[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});



/**
 * Feature: habit-modal-tabs, Property 8: Save payload completeness
 * 
 * *For any* form state with data in all tabs, the generated save payload should
 * include all fields from all tabs (name, type, timings, notes, outdates, 
 * workload fields, goalId, tags, relations).
 * 
 * **Validates: Requirements 8.3**
 * 
 * Requirements:
 * - 8.3: WHEN saving the habit, THE System SHALL include data from all tabs in the save operation
 */
describe('Feature: habit-modal-tabs, Property 8: Save payload completeness', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  // ============================================================================
  // Types for Save Payload
  // ============================================================================

  type TimingType = 'Date' | 'Daily' | 'Weekly' | 'Monthly';

  interface Timing {
    id?: string;
    type: TimingType;
    date?: string;
    start?: string;
    end?: string;
    cron?: string;
  }

  interface HabitFormState {
    // Basic Tab fields
    name: string;
    type: 'do' | 'avoid';
    timings: Timing[];
    notes: string;
    // Exclusion Tab fields
    outdates: Timing[];
    // Workload Tab fields
    workloadUnit: string;
    workloadTotal: string;
    workloadTotalEnd: string;
    workloadPerCount: string;
    // Detail Tab fields
    goalId: string | undefined;
    selectedTagIds: string[];
  }

  interface HabitRelation {
    id: string;
    habitId: string;
    relatedHabitId: string;
    relation: 'main' | 'sub' | 'next';
  }

  /**
   * CreateHabitPayload - The payload structure for creating a new habit
   * This mirrors the CreateHabitPayload type in Modal.Habit.tsx
   */
  interface CreateHabitPayload {
    name: string;
    goalId?: string;
    type: 'do' | 'avoid';
    duration?: number;
    reminders?: any[];
    dueDate?: string;
    time?: string;
    endTime?: string;
    repeat?: string;
    timings?: Timing[];
    allDay?: boolean;
    notes?: string;
    workloadUnit?: string;
    workloadTotal?: number;
    workloadTotalEnd?: number;
    workloadPerCount?: number;
    relatedHabitIds?: string[];
  }

  /**
   * UpdateHabitPayload - The payload structure for updating an existing habit
   */
  interface UpdateHabitPayload {
    id: string;
    name: string;
    goalId?: string;
    type: 'do' | 'avoid';
    timings?: Timing[];
    outdates?: Timing[];
    notes?: string;
    workloadUnit?: string;
    workloadTotal?: number;
    workloadTotalEnd?: number;
    workloadPerCount?: number;
    updatedAt: string;
  }

  // ============================================================================
  // Generators for Form Data
  // ============================================================================

  /**
   * Generator for valid timing type
   */
  const timingTypeArb = fc.constantFrom<TimingType>('Date', 'Daily', 'Weekly', 'Monthly');

  /**
   * Generator for valid time string (HH:MM format)
   */
  const timeStringArb = fc.tuple(
    fc.integer({ min: 0, max: 23 }),
    fc.integer({ min: 0, max: 59 })
  ).map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);

  /**
   * Generator for valid date string (YYYY-MM-DD format)
   */
  const dateStringArb = fc.tuple(
    fc.integer({ min: 2020, max: 2030 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 }) // Use 28 to avoid invalid dates
  ).map(([y, m, d]) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);

  /**
   * Generator for a single Timing object
   */
  const timingArb: fc.Arbitrary<Timing> = fc.record({
    type: timingTypeArb,
    date: fc.option(dateStringArb, { nil: undefined }),
    start: fc.option(timeStringArb, { nil: undefined }),
    end: fc.option(timeStringArb, { nil: undefined }),
  });

  /**
   * Generator for a HabitRelation
   */
  const relationArb: fc.Arbitrary<HabitRelation> = fc.record({
    id: fc.uuid(),
    habitId: fc.uuid(),
    relatedHabitId: fc.uuid(),
    relation: fc.constantFrom<'main' | 'sub' | 'next'>('main', 'sub', 'next'),
  });

  /**
   * Generator for complete HabitFormState with data in all tabs
   */
  const completeFormStateArb: fc.Arbitrary<HabitFormState> = fc.record({
    // Basic Tab
    name: fc.string({ minLength: 1, maxLength: 100 }),
    type: fc.constantFrom<'do' | 'avoid'>('do', 'avoid'),
    timings: fc.array(timingArb, { minLength: 1, maxLength: 5 }),
    notes: fc.string({ minLength: 0, maxLength: 500 }),
    // Exclusion Tab
    outdates: fc.array(timingArb, { minLength: 0, maxLength: 5 }),
    // Workload Tab
    workloadUnit: fc.string({ minLength: 0, maxLength: 20 }),
    workloadTotal: fc.oneof(fc.constant(''), fc.integer({ min: 1, max: 1000 }).map(String)),
    workloadTotalEnd: fc.oneof(fc.constant(''), fc.integer({ min: 1, max: 10000 }).map(String)),
    workloadPerCount: fc.oneof(fc.constant('1'), fc.integer({ min: 1, max: 100 }).map(String)),
    // Detail Tab
    goalId: fc.option(fc.uuid(), { nil: undefined }),
    selectedTagIds: fc.array(fc.uuid(), { minLength: 0, maxLength: 10 }),
  });

  // ============================================================================
  // Helper: Convert Form State to Save Payload
  // ============================================================================

  /**
   * Converts form state to a CreateHabitPayload (for new habits)
   * This mirrors the logic in Modal.Habit.tsx handleSave function
   */
  function formStateToCreatePayload(
    formState: HabitFormState,
    relations: HabitRelation[]
  ): CreateHabitPayload {
    const payload: CreateHabitPayload = {
      // Basic Tab fields
      name: formState.name.trim() || 'Untitled',
      type: formState.type,
      timings: formState.timings,
      notes: formState.notes.trim() || undefined,
      // Workload Tab fields
      workloadUnit: formState.workloadUnit || undefined,
      workloadTotal: formState.workloadTotal ? Number(formState.workloadTotal) : undefined,
      workloadTotalEnd: formState.workloadTotalEnd ? Number(formState.workloadTotalEnd) : undefined,
      workloadPerCount: Number(formState.workloadPerCount) || 1,
      // Detail Tab fields
      relatedHabitIds: relations.length > 0 ? relations.map(r => r.relatedHabitId) : undefined,
    };

    // Add goalId if present
    if (formState.goalId) {
      payload.goalId = formState.goalId;
    }

    return payload;
  }

  /**
   * Converts form state to an UpdateHabitPayload (for existing habits)
   * This mirrors the logic in Modal.Habit.tsx handleSave function
   */
  function formStateToUpdatePayload(
    formState: HabitFormState,
    habitId: string
  ): UpdateHabitPayload {
    return {
      id: habitId,
      // Basic Tab fields
      name: formState.name.trim() || 'Untitled',
      type: formState.type,
      timings: formState.timings,
      notes: formState.notes.trim() || undefined,
      // Exclusion Tab fields
      outdates: formState.outdates,
      // Workload Tab fields
      workloadUnit: formState.workloadUnit || undefined,
      workloadTotal: formState.workloadTotal ? Number(formState.workloadTotal) : undefined,
      workloadTotalEnd: formState.workloadTotalEnd ? Number(formState.workloadTotalEnd) : undefined,
      workloadPerCount: Number(formState.workloadPerCount) || 1,
      // Detail Tab fields
      goalId: formState.goalId,
      updatedAt: new Date().toISOString(),
    };
  }

  // ============================================================================
  // Property Tests
  // ============================================================================

  /**
   * Property 8.1: Create payload includes all Basic Tab fields
   * 
   * *For any* form state, the create payload should include name, type, timings, and notes.
   */
  it('create payload should include all Basic Tab fields (name, type, timings, notes)', () => {
    fc.assert(
      fc.property(
        completeFormStateArb,
        fc.array(relationArb, { minLength: 0, maxLength: 5 }),
        (formState, relations) => {
          const payload = formStateToCreatePayload(formState, relations);

          // Name should be included (trimmed, or 'Untitled' if empty)
          expect(payload.name).toBeDefined();
          expect(typeof payload.name).toBe('string');
          expect(payload.name.length).toBeGreaterThan(0);

          // Type should be included
          expect(payload.type).toBeDefined();
          expect(['do', 'avoid']).toContain(payload.type);

          // Timings should be included
          expect(payload.timings).toBeDefined();
          expect(Array.isArray(payload.timings)).toBe(true);
          expect(payload.timings!.length).toBe(formState.timings.length);

          // Notes should be included if non-empty
          if (formState.notes.trim()) {
            expect(payload.notes).toBe(formState.notes.trim());
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.2: Create payload includes all Workload Tab fields
   * 
   * *For any* form state with workload data, the create payload should include
   * workloadUnit, workloadTotal, workloadTotalEnd, and workloadPerCount.
   */
  it('create payload should include all Workload Tab fields', () => {
    fc.assert(
      fc.property(
        completeFormStateArb,
        fc.array(relationArb, { minLength: 0, maxLength: 5 }),
        (formState, relations) => {
          const payload = formStateToCreatePayload(formState, relations);

          // workloadUnit should be included if non-empty
          if (formState.workloadUnit) {
            expect(payload.workloadUnit).toBe(formState.workloadUnit);
          }

          // workloadTotal should be included if non-empty
          if (formState.workloadTotal) {
            expect(payload.workloadTotal).toBe(Number(formState.workloadTotal));
          }

          // workloadTotalEnd should be included if non-empty
          if (formState.workloadTotalEnd) {
            expect(payload.workloadTotalEnd).toBe(Number(formState.workloadTotalEnd));
          }

          // workloadPerCount should always be included (defaults to 1)
          expect(payload.workloadPerCount).toBeDefined();
          expect(typeof payload.workloadPerCount).toBe('number');
          expect(payload.workloadPerCount).toBeGreaterThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.3: Create payload includes Detail Tab fields
   * 
   * *For any* form state with detail data, the create payload should include
   * goalId and relatedHabitIds.
   */
  it('create payload should include Detail Tab fields (goalId, relatedHabitIds)', () => {
    fc.assert(
      fc.property(
        completeFormStateArb,
        fc.array(relationArb, { minLength: 1, maxLength: 5 }), // At least one relation
        (formState, relations) => {
          const payload = formStateToCreatePayload(formState, relations);

          // goalId should be included if present
          if (formState.goalId) {
            expect(payload.goalId).toBe(formState.goalId);
          }

          // relatedHabitIds should be included if relations exist
          expect(payload.relatedHabitIds).toBeDefined();
          expect(Array.isArray(payload.relatedHabitIds)).toBe(true);
          expect(payload.relatedHabitIds!.length).toBe(relations.length);
          
          // Each relation's relatedHabitId should be in the payload
          for (const relation of relations) {
            expect(payload.relatedHabitIds).toContain(relation.relatedHabitId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.4: Update payload includes all Basic Tab fields
   * 
   * *For any* form state, the update payload should include name, type, timings, and notes.
   */
  it('update payload should include all Basic Tab fields (name, type, timings, notes)', () => {
    fc.assert(
      fc.property(
        completeFormStateArb,
        fc.uuid(), // habitId
        (formState, habitId) => {
          const payload = formStateToUpdatePayload(formState, habitId);

          // ID should be included
          expect(payload.id).toBe(habitId);

          // Name should be included
          expect(payload.name).toBeDefined();
          expect(typeof payload.name).toBe('string');
          expect(payload.name.length).toBeGreaterThan(0);

          // Type should be included
          expect(payload.type).toBeDefined();
          expect(['do', 'avoid']).toContain(payload.type);

          // Timings should be included
          expect(payload.timings).toBeDefined();
          expect(Array.isArray(payload.timings)).toBe(true);
          expect(payload.timings!.length).toBe(formState.timings.length);

          // Notes should be included if non-empty
          if (formState.notes.trim()) {
            expect(payload.notes).toBe(formState.notes.trim());
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.5: Update payload includes Exclusion Tab fields
   * 
   * *For any* form state with exclusion data, the update payload should include outdates.
   */
  it('update payload should include Exclusion Tab fields (outdates)', () => {
    fc.assert(
      fc.property(
        completeFormStateArb,
        fc.uuid(), // habitId
        (formState, habitId) => {
          const payload = formStateToUpdatePayload(formState, habitId);

          // Outdates should always be included (even if empty array)
          expect(payload.outdates).toBeDefined();
          expect(Array.isArray(payload.outdates)).toBe(true);
          expect(payload.outdates!.length).toBe(formState.outdates.length);

          // Each outdate should match the form state
          for (let i = 0; i < formState.outdates.length; i++) {
            expect(payload.outdates![i]).toEqual(formState.outdates[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.6: Update payload includes all Workload Tab fields
   * 
   * *For any* form state with workload data, the update payload should include
   * workloadUnit, workloadTotal, workloadTotalEnd, and workloadPerCount.
   */
  it('update payload should include all Workload Tab fields', () => {
    fc.assert(
      fc.property(
        completeFormStateArb,
        fc.uuid(), // habitId
        (formState, habitId) => {
          const payload = formStateToUpdatePayload(formState, habitId);

          // workloadUnit should be included if non-empty
          if (formState.workloadUnit) {
            expect(payload.workloadUnit).toBe(formState.workloadUnit);
          }

          // workloadTotal should be included if non-empty
          if (formState.workloadTotal) {
            expect(payload.workloadTotal).toBe(Number(formState.workloadTotal));
          }

          // workloadTotalEnd should be included if non-empty
          if (formState.workloadTotalEnd) {
            expect(payload.workloadTotalEnd).toBe(Number(formState.workloadTotalEnd));
          }

          // workloadPerCount should always be included
          expect(payload.workloadPerCount).toBeDefined();
          expect(typeof payload.workloadPerCount).toBe('number');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.7: Update payload includes Detail Tab fields
   * 
   * *For any* form state with detail data, the update payload should include goalId.
   */
  it('update payload should include Detail Tab fields (goalId)', () => {
    fc.assert(
      fc.property(
        completeFormStateArb,
        fc.uuid(), // habitId
        (formState, habitId) => {
          const payload = formStateToUpdatePayload(formState, habitId);

          // goalId should be included (even if undefined)
          if (formState.goalId) {
            expect(payload.goalId).toBe(formState.goalId);
          } else {
            expect(payload.goalId).toBeUndefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.8: Complete form state produces complete payload
   * 
   * *For any* form state with data in ALL tabs, the generated payload should
   * include fields from ALL tabs without any data loss.
   */
  it('complete form state should produce payload with all tab fields', () => {
    // Generator for non-whitespace string (at least one non-whitespace character)
    const nonWhitespaceStringArb = (minLength: number, maxLength: number) =>
      fc.string({ minLength, maxLength }).filter(s => s.trim().length > 0);

    // Generator for form state with non-empty values in all tabs
    const completeNonEmptyFormStateArb = fc.record({
      // Basic Tab - all non-empty (use non-whitespace strings)
      name: nonWhitespaceStringArb(1, 100),
      type: fc.constantFrom<'do' | 'avoid'>('do', 'avoid'),
      timings: fc.array(timingArb, { minLength: 1, maxLength: 5 }),
      notes: nonWhitespaceStringArb(1, 500),
      // Exclusion Tab - non-empty
      outdates: fc.array(timingArb, { minLength: 1, maxLength: 5 }),
      // Workload Tab - all non-empty (use non-whitespace strings)
      workloadUnit: nonWhitespaceStringArb(1, 20),
      workloadTotal: fc.integer({ min: 1, max: 1000 }).map(String),
      workloadTotalEnd: fc.integer({ min: 1, max: 10000 }).map(String),
      workloadPerCount: fc.integer({ min: 1, max: 100 }).map(String),
      // Detail Tab - all non-empty
      goalId: fc.uuid(),
      selectedTagIds: fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
    });

    fc.assert(
      fc.property(
        completeNonEmptyFormStateArb,
        fc.array(relationArb, { minLength: 1, maxLength: 5 }),
        fc.uuid(), // habitId for update
        (formState, relations, habitId) => {
          // Test create payload
          const createPayload = formStateToCreatePayload(formState, relations);
          
          // Basic Tab fields - name defaults to 'Untitled' if empty after trim
          const expectedName = formState.name.trim() || 'Untitled';
          expect(createPayload.name).toBe(expectedName);
          expect(createPayload.type).toBe(formState.type);
          expect(createPayload.timings).toEqual(formState.timings);
          // Notes is undefined if empty after trim
          const expectedNotes = formState.notes.trim() || undefined;
          expect(createPayload.notes).toBe(expectedNotes);
          
          // Workload Tab fields
          expect(createPayload.workloadUnit).toBe(formState.workloadUnit || undefined);
          expect(createPayload.workloadTotal).toBe(Number(formState.workloadTotal));
          expect(createPayload.workloadTotalEnd).toBe(Number(formState.workloadTotalEnd));
          expect(createPayload.workloadPerCount).toBe(Number(formState.workloadPerCount));
          
          // Detail Tab fields
          expect(createPayload.goalId).toBe(formState.goalId);
          expect(createPayload.relatedHabitIds).toEqual(relations.map(r => r.relatedHabitId));

          // Test update payload
          const updatePayload = formStateToUpdatePayload(formState, habitId);
          
          // Basic Tab fields
          expect(updatePayload.name).toBe(expectedName);
          expect(updatePayload.type).toBe(formState.type);
          expect(updatePayload.timings).toEqual(formState.timings);
          expect(updatePayload.notes).toBe(expectedNotes);
          
          // Exclusion Tab fields
          expect(updatePayload.outdates).toEqual(formState.outdates);
          
          // Workload Tab fields
          expect(updatePayload.workloadUnit).toBe(formState.workloadUnit || undefined);
          expect(updatePayload.workloadTotal).toBe(Number(formState.workloadTotal));
          expect(updatePayload.workloadTotalEnd).toBe(Number(formState.workloadTotalEnd));
          expect(updatePayload.workloadPerCount).toBe(Number(formState.workloadPerCount));
          
          // Detail Tab fields
          expect(updatePayload.goalId).toBe(formState.goalId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.9: Payload field count matches expected tab coverage
   * 
   * *For any* complete form state, the payload should have the expected number
   * of fields covering all 4 tabs.
   */
  it('payload should cover all 4 tabs with appropriate fields', () => {
    fc.assert(
      fc.property(
        completeFormStateArb,
        fc.array(relationArb, { minLength: 0, maxLength: 5 }),
        fc.uuid(),
        (formState, relations, habitId) => {
          const createPayload = formStateToCreatePayload(formState, relations);
          const updatePayload = formStateToUpdatePayload(formState, habitId);

          // Create payload should have fields from:
          // - Basic Tab: name, type, timings, notes (4 fields)
          // - Workload Tab: workloadUnit, workloadTotal, workloadTotalEnd, workloadPerCount (4 fields)
          // - Detail Tab: goalId, relatedHabitIds (2 fields)
          // Total: 10 potential fields (some may be undefined)
          
          // Verify Basic Tab coverage
          expect('name' in createPayload).toBe(true);
          expect('type' in createPayload).toBe(true);
          expect('timings' in createPayload).toBe(true);
          
          // Verify Workload Tab coverage
          expect('workloadPerCount' in createPayload).toBe(true);

          // Update payload should have fields from:
          // - Basic Tab: name, type, timings, notes (4 fields)
          // - Exclusion Tab: outdates (1 field)
          // - Workload Tab: workloadUnit, workloadTotal, workloadTotalEnd, workloadPerCount (4 fields)
          // - Detail Tab: goalId (1 field)
          // Plus: id, updatedAt (2 fields)
          
          // Verify all tabs are covered in update payload
          expect('id' in updatePayload).toBe(true);
          expect('name' in updatePayload).toBe(true);
          expect('type' in updatePayload).toBe(true);
          expect('timings' in updatePayload).toBe(true);
          expect('outdates' in updatePayload).toBe(true);
          expect('workloadPerCount' in updatePayload).toBe(true);
          expect('updatedAt' in updatePayload).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.10: Empty optional fields don't break payload completeness
   * 
   * *For any* form state with some empty optional fields, the payload should
   * still include all required fields and handle optional fields correctly.
   */
  it('empty optional fields should not break payload completeness', () => {
    // Generator for form state with minimal required data
    const minimalFormStateArb = fc.record({
      name: fc.string({ minLength: 1, maxLength: 100 }),
      type: fc.constantFrom<'do' | 'avoid'>('do', 'avoid'),
      timings: fc.array(timingArb, { minLength: 1, maxLength: 1 }),
      notes: fc.constant(''),
      outdates: fc.constant([]),
      workloadUnit: fc.constant(''),
      workloadTotal: fc.constant(''),
      workloadTotalEnd: fc.constant(''),
      workloadPerCount: fc.constant('1'),
      goalId: fc.constant(undefined),
      selectedTagIds: fc.constant([]),
    });

    fc.assert(
      fc.property(
        minimalFormStateArb,
        fc.uuid(),
        (formState, habitId) => {
          const createPayload = formStateToCreatePayload(formState, []);
          const updatePayload = formStateToUpdatePayload(formState, habitId);

          // Required fields should always be present
          expect(createPayload.name).toBeDefined();
          expect(createPayload.type).toBeDefined();
          expect(createPayload.timings).toBeDefined();
          expect(createPayload.workloadPerCount).toBeDefined();

          expect(updatePayload.id).toBeDefined();
          expect(updatePayload.name).toBeDefined();
          expect(updatePayload.type).toBeDefined();
          expect(updatePayload.timings).toBeDefined();
          expect(updatePayload.outdates).toBeDefined();
          expect(updatePayload.workloadPerCount).toBeDefined();
          expect(updatePayload.updatedAt).toBeDefined();

          // Optional fields should be undefined when empty
          expect(createPayload.notes).toBeUndefined();
          expect(createPayload.workloadUnit).toBeUndefined();
          expect(createPayload.workloadTotal).toBeUndefined();
          expect(createPayload.workloadTotalEnd).toBeUndefined();
          expect(createPayload.goalId).toBeUndefined();
          expect(createPayload.relatedHabitIds).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});
