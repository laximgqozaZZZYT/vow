/**
 * Property-Based Tests for Habit Modal Tabs - Exclusion Tab
 * 
 * **Feature: habit-modal-tabs, Property 2: Exclusion period addition invariant**
 * **Validates: Requirements 3.2**
 * 
 * Tests that adding a new exclusion period increases the list length by exactly 1
 * and the new period is present in the resulting list.
 * Uses fast-check for property-based testing with at least 100 iterations.
 */

import * as fc from 'fast-check';
import React from 'react';
import { render, fireEvent, within, cleanup } from '@testing-library/react';
import { ExclusionTab } from '../../app/dashboard/components/tabs/ExclusionTab';
import type { Timing, TimingType } from '../../app/dashboard/components/tabs/BasicTab';

// ============================================================================
// Generators
// ============================================================================

/**
 * Generator for valid TimingType values
 */
const timingTypeArb: fc.Arbitrary<TimingType> = fc.constantFrom('Date', 'Daily', 'Weekly', 'Monthly');

/**
 * Generator for a valid Timing (exclusion period) object - simplified for performance
 */
const timingArb: fc.Arbitrary<Timing> = fc.record({
  type: timingTypeArb,
  date: fc.option(fc.constant('2024-06-15'), { nil: undefined }),
  start: fc.option(fc.constant('09:00'), { nil: undefined }),
  end: fc.option(fc.constant('17:00'), { nil: undefined }),
});

/**
 * Generator for an array of Timing objects (exclusion periods)
 */
const outdatesArrayArb: fc.Arbitrary<Timing[]> = fc.array(timingArb, { minLength: 0, maxLength: 5 });

/**
 * Generator for a non-empty array of Timing objects
 */
const nonEmptyOutdatesArrayArb: fc.Arbitrary<Timing[]> = fc.array(timingArb, { minLength: 1, maxLength: 5 });

// ============================================================================
// Test Component Wrapper
// ============================================================================

interface TestWrapperProps {
  initialOutdates: Timing[];
  onOutdatesChange: (outdates: Timing[]) => void;
}

/**
 * Test wrapper component that renders ExclusionTab with controlled state
 */
function TestWrapper({ initialOutdates, onOutdatesChange }: TestWrapperProps) {
  return (
    <ExclusionTab
      isActive={true}
      outdates={initialOutdates}
      onOutdatesChange={onOutdatesChange}
      idPrefix="test"
    />
  );
}

// ============================================================================
// Property Tests
// ============================================================================

describe('Feature: habit-modal-tabs, Property 2: Exclusion period addition invariant', () => {
  afterEach(() => {
    cleanup();
  });

  /**
   * Property 2: Exclusion Period Addition Invariant
   * 
   * *For any* initial list of exclusion periods and any valid new exclusion period,
   * adding the new period should increase the list length by exactly 1 and the new
   * period should be present in the resulting list.
   * 
   * **Validates: Requirements 3.2**
   */
  describe('Property 2: Exclusion period addition invariant', () => {
    it('adding an exclusion should increase the list length by exactly 1', () => {
      fc.assert(
        fc.property(
          outdatesArrayArb,
          (initialOutdates) => {
            let capturedOutdates: Timing[] = [];
            const handleChange = (newOutdates: Timing[]) => {
              capturedOutdates = newOutdates;
            };

            const { container, unmount } = render(
              <TestWrapper
                initialOutdates={initialOutdates}
                onOutdatesChange={handleChange}
              />
            );

            const initialLength = initialOutdates.length;

            // Find and click the add button using aria-label
            const addButton = within(container).getByLabelText('除外期間を追加');
            fireEvent.click(addButton);

            // The new length should be exactly initialLength + 1
            expect(capturedOutdates.length).toBe(initialLength + 1);

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('the new exclusion period should be present in the resulting list', () => {
      fc.assert(
        fc.property(
          outdatesArrayArb,
          (initialOutdates) => {
            let capturedOutdates: Timing[] = [];
            const handleChange = (newOutdates: Timing[]) => {
              capturedOutdates = newOutdates;
            };

            const { container, unmount } = render(
              <TestWrapper
                initialOutdates={initialOutdates}
                onOutdatesChange={handleChange}
              />
            );

            // Find and click the add button
            const addButton = within(container).getByLabelText('除外期間を追加');
            fireEvent.click(addButton);

            // The new exclusion should be at the end of the list
            const newExclusion = capturedOutdates[capturedOutdates.length - 1];
            
            // Verify the new exclusion exists and has the expected structure
            expect(newExclusion).toBeDefined();
            expect(newExclusion).toHaveProperty('type');
            expect(['Date', 'Daily', 'Weekly', 'Monthly']).toContain(newExclusion.type);

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('all original exclusions should be preserved after adding a new one', () => {
      fc.assert(
        fc.property(
          nonEmptyOutdatesArrayArb, // At least one initial exclusion
          (initialOutdates) => {
            let capturedOutdates: Timing[] = [];
            const handleChange = (newOutdates: Timing[]) => {
              capturedOutdates = newOutdates;
            };

            const { container, unmount } = render(
              <TestWrapper
                initialOutdates={initialOutdates}
                onOutdatesChange={handleChange}
              />
            );

            // Find and click the add button
            const addButton = within(container).getByLabelText('除外期間を追加');
            fireEvent.click(addButton);

            // All original exclusions should still be present (in the same order)
            for (let i = 0; i < initialOutdates.length; i++) {
              expect(capturedOutdates[i]).toEqual(initialOutdates[i]);
            }

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('new exclusion type should match the first exclusion type when list is non-empty', () => {
      fc.assert(
        fc.property(
          nonEmptyOutdatesArrayArb, // At least one initial exclusion
          (initialOutdates) => {
            let capturedOutdates: Timing[] = [];
            const handleChange = (newOutdates: Timing[]) => {
              capturedOutdates = newOutdates;
            };

            const { container, unmount } = render(
              <TestWrapper
                initialOutdates={initialOutdates}
                onOutdatesChange={handleChange}
              />
            );

            // Find and click the add button
            const addButton = within(container).getByLabelText('除外期間を追加');
            fireEvent.click(addButton);

            // The new exclusion's type should match the first exclusion's type
            const newExclusion = capturedOutdates[capturedOutdates.length - 1];
            expect(newExclusion.type).toBe(initialOutdates[0].type);

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('new exclusion should default to Date type when list is empty', () => {
      let capturedOutdates: Timing[] = [];
      const handleChange = (newOutdates: Timing[]) => {
        capturedOutdates = newOutdates;
      };

      const { container, unmount } = render(
        <TestWrapper
          initialOutdates={[]}
          onOutdatesChange={handleChange}
        />
      );

      // Find and click the add button (use aria-label for header button)
      const addButton = within(container).getByLabelText('除外期間を追加');
      fireEvent.click(addButton);

      // The new exclusion should have type 'Date' as default
      expect(capturedOutdates.length).toBe(1);
      expect(capturedOutdates[0].type).toBe('Date');

      unmount();
    });

    it('multiple consecutive additions should each increase length by 1', () => {
      fc.assert(
        fc.property(
          nonEmptyOutdatesArrayArb, // Start with non-empty to avoid empty state complexity
          fc.integer({ min: 1, max: 3 }), // Number of additions (reduced for performance)
          (initialOutdates, numAdditions) => {
            let currentOutdates: Timing[] = [...initialOutdates];
            
            const handleChange = (newOutdates: Timing[]) => {
              currentOutdates = newOutdates;
            };

            const { rerender, container, unmount } = render(
              <TestWrapper
                initialOutdates={initialOutdates}
                onOutdatesChange={handleChange}
              />
            );

            const initialLength = initialOutdates.length;

            for (let i = 0; i < numAdditions; i++) {
              // Find and click the add button
              const addButton = within(container).getByLabelText('除外期間を追加');
              fireEvent.click(addButton);

              // After each addition, length should increase by 1
              expect(currentOutdates.length).toBe(initialLength + i + 1);

              // Re-render with updated outdates to simulate state update
              rerender(
                <TestWrapper
                  initialOutdates={currentOutdates}
                  onOutdatesChange={handleChange}
                />
              );
            }

            // Final length should be initial + numAdditions
            expect(currentOutdates.length).toBe(initialLength + numAdditions);

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
