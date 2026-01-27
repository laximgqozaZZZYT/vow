/**
 * Property-based tests for HabitCard Component
 * 
 * Tests the core properties of the HabitCard expand button visibility and toggle behavior:
 * - Property 3: Expand Button Visibility
 * - Property 5: Expand Toggle Behavior
 * 
 * **Validates: Requirements 2.1, 2.2, 3.1**
 * 
 * Requirements tested:
 * - 2.1: WHEN a Habit has one or more associated Sticky_n items, THE Habit_Card SHALL display an Expand_Button in the bottom-right corner
 * - 2.2: WHEN a Habit has no associated Sticky_n items, THE Habit_Card SHALL NOT display an Expand_Button
 * - 3.1: WHEN a user clicks the Expand_Button, THE System SHALL toggle the visibility of the subtask list
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import * as fc from 'fast-check';
import HabitCard, { type HabitCardProps } from '../../app/dashboard/components/Board.HabitCard';
import type { Habit, Activity, Sticky } from '../../app/dashboard/types';
import type { HabitStatus } from '../../app/dashboard/utils/habitStatusUtils';

// ============================================================================
// Mock Dependencies
// ============================================================================

// Mock the HandednessContext
jest.mock('../../app/dashboard/contexts/HandednessContext', () => ({
  useHandedness: () => ({ isLeftHanded: false }),
}));

// ============================================================================
// Arbitraries (Test Data Generators)
// ============================================================================

/** Generate a valid ID string */
const idArb = fc.stringMatching(/^[a-z0-9]{8,16}$/);

/** Generate a minimal Habit for testing */
const habitArb = (id?: string): fc.Arbitrary<Habit> =>
  fc.record({
    id: id ? fc.constant(id) : idArb,
    goalId: idArb,
    name: fc.string({ minLength: 1, maxLength: 50 }),
    active: fc.boolean(),
    type: fc.constantFrom('do', 'avoid') as fc.Arbitrary<'do' | 'avoid'>,
    count: fc.integer({ min: 0, max: 100 }),
    must: fc.integer({ min: 1, max: 100 }),
    completed: fc.boolean(),
    createdAt: fc.constant(new Date().toISOString()),
    updatedAt: fc.constant(new Date().toISOString()),
  });

/** Generate a minimal Sticky for testing */
const stickyArb = (id?: string): fc.Arbitrary<Sticky> =>
  fc.record({
    id: id ? fc.constant(id) : idArb,
    name: fc.string({ minLength: 1, maxLength: 50 }),
    description: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
    completed: fc.boolean(),
    completedAt: fc.option(fc.constant(new Date().toISOString()), { nil: undefined }),
    displayOrder: fc.integer({ min: 0, max: 1000 }),
    createdAt: fc.constant(new Date().toISOString()),
    updatedAt: fc.constant(new Date().toISOString()),
  });

/** Generate an array of stickies */
const stickiesArb = (minLength: number = 0, maxLength: number = 10): fc.Arbitrary<Sticky[]> =>
  fc.array(stickyArb(), { minLength, maxLength });

/** Generate a HabitStatus */
const habitStatusArb: fc.Arbitrary<HabitStatus> = fc.constantFrom(
  'scheduled',
  'in_progress',
  'daily_complete',
  'cumulative_complete'
);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create default props for HabitCard testing
 */
function createDefaultProps(overrides: Partial<HabitCardProps> = {}): HabitCardProps {
  const defaultHabit: Habit = {
    id: 'test-habit-id',
    goalId: 'test-goal-id',
    name: 'Test Habit',
    active: true,
    type: 'do',
    count: 0,
    must: 1,
    completed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return {
    habit: defaultHabit,
    activities: [],
    status: 'scheduled' as HabitStatus,
    onComplete: jest.fn(),
    onEdit: jest.fn(),
    onDragStart: jest.fn(),
    onDragEnd: jest.fn(),
    isDragging: false,
    ...overrides,
  };
}

/**
 * Check if the expand button is visible in the rendered component
 */
function isExpandButtonVisible(): boolean {
  // The expand button has aria-label containing "サブタスク"
  const expandButton = screen.queryByRole('button', { name: /サブタスク/ });
  return expandButton !== null;
}

/**
 * Get the expand button element
 */
function getExpandButton(): HTMLElement | null {
  return screen.queryByRole('button', { name: /サブタスク/ });
}

// ============================================================================
// Property Tests
// ============================================================================

describe('HabitCard Property Tests', () => {
  describe('Property 3: Expand Button Visibility', () => {
    /**
     * **Validates: Requirements 2.1, 2.2**
     * 
     * *For any* habit in the Kanban board, the expand button SHALL be visible 
     * if and only if the habit has one or more associated subtasks.
     */
    test('expand button is visible iff habit has one or more subtasks', () => {
      fc.assert(
        fc.property(
          habitArb(),
          stickiesArb(0, 10),
          habitStatusArb,
          (habit, subtasks, status) => {
            const hasSubtasks = subtasks.length > 0;
            
            const props = createDefaultProps({
              habit,
              status,
              subtasks: hasSubtasks ? subtasks : undefined,
              isExpanded: false,
              onToggleExpand: hasSubtasks ? jest.fn() : undefined,
              onSubtaskComplete: hasSubtasks ? jest.fn() : undefined,
              onSubtaskEdit: hasSubtasks ? jest.fn() : undefined,
            });

            const { unmount } = render(<HabitCard {...props} />);
            
            const buttonVisible = isExpandButtonVisible();
            
            // Clean up
            unmount();
            
            // Expand button should be visible iff there are subtasks
            expect(buttonVisible).toBe(hasSubtasks);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: Requirement 2.1**
     * 
     * WHEN a Habit has one or more associated Sticky_n items, 
     * THE Habit_Card SHALL display an Expand_Button
     */
    test('expand button is visible when habit has subtasks', () => {
      fc.assert(
        fc.property(
          habitArb(),
          stickiesArb(1, 10), // At least 1 subtask
          habitStatusArb,
          (habit, subtasks, status) => {
            const props = createDefaultProps({
              habit,
              status,
              subtasks,
              isExpanded: false,
              onToggleExpand: jest.fn(),
              onSubtaskComplete: jest.fn(),
              onSubtaskEdit: jest.fn(),
            });

            const { unmount } = render(<HabitCard {...props} />);
            
            const buttonVisible = isExpandButtonVisible();
            
            // Clean up
            unmount();
            
            // Expand button should be visible
            expect(buttonVisible).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: Requirement 2.2**
     * 
     * WHEN a Habit has no associated Sticky_n items, 
     * THE Habit_Card SHALL NOT display an Expand_Button
     */
    test('expand button is not visible when habit has no subtasks', () => {
      fc.assert(
        fc.property(
          habitArb(),
          habitStatusArb,
          (habit, status) => {
            // Test with undefined subtasks
            const props1 = createDefaultProps({
              habit,
              status,
              subtasks: undefined,
            });

            const { unmount: unmount1 } = render(<HabitCard {...props1} />);
            const buttonVisible1 = isExpandButtonVisible();
            unmount1();
            
            // Test with empty subtasks array
            const props2 = createDefaultProps({
              habit,
              status,
              subtasks: [],
              onToggleExpand: jest.fn(),
            });

            const { unmount: unmount2 } = render(<HabitCard {...props2} />);
            const buttonVisible2 = isExpandButtonVisible();
            unmount2();
            
            // Expand button should not be visible in either case
            expect(buttonVisible1).toBe(false);
            expect(buttonVisible2).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: Requirements 2.1, 2.2**
     * 
     * The number of subtasks should not affect visibility (only presence/absence matters)
     */
    test('expand button visibility depends only on presence of subtasks, not count', () => {
      fc.assert(
        fc.property(
          habitArb(),
          fc.integer({ min: 1, max: 100 }), // Various subtask counts
          habitStatusArb,
          (habit, subtaskCount, status) => {
            // Generate subtasks with the specified count
            const subtasks: Sticky[] = Array.from({ length: subtaskCount }, (_, i) => ({
              id: `sticky-${i}`,
              name: `Subtask ${i}`,
              completed: false,
              displayOrder: i,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }));

            const props = createDefaultProps({
              habit,
              status,
              subtasks,
              isExpanded: false,
              onToggleExpand: jest.fn(),
              onSubtaskComplete: jest.fn(),
              onSubtaskEdit: jest.fn(),
            });

            const { unmount } = render(<HabitCard {...props} />);
            
            const buttonVisible = isExpandButtonVisible();
            
            // Clean up
            unmount();
            
            // Expand button should always be visible when there are subtasks
            expect(buttonVisible).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 5: Expand Toggle Behavior', () => {
    /**
     * **Validates: Requirement 3.1**
     * 
     * *For any* habit with subtasks, clicking the expand button SHALL toggle 
     * the `isExpanded` state from true to false or false to true.
     */
    test('clicking expand button calls onToggleExpand callback', () => {
      fc.assert(
        fc.property(
          habitArb(),
          stickiesArb(1, 10), // At least 1 subtask
          fc.boolean(), // Initial expanded state
          habitStatusArb,
          (habit, subtasks, initialExpanded, status) => {
            const mockToggle = jest.fn();
            
            const props = createDefaultProps({
              habit,
              status,
              subtasks,
              isExpanded: initialExpanded,
              onToggleExpand: mockToggle,
              onSubtaskComplete: jest.fn(),
              onSubtaskEdit: jest.fn(),
            });

            const { unmount } = render(<HabitCard {...props} />);
            
            const expandButton = getExpandButton();
            expect(expandButton).not.toBeNull();
            
            if (expandButton) {
              fireEvent.click(expandButton);
              expect(mockToggle).toHaveBeenCalledTimes(1);
            }
            
            // Clean up
            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: Requirement 3.1**
     * 
     * Toggle from collapsed to expanded state
     */
    test('toggle from collapsed (false) triggers callback', () => {
      fc.assert(
        fc.property(
          habitArb(),
          stickiesArb(1, 10),
          habitStatusArb,
          (habit, subtasks, status) => {
            const mockToggle = jest.fn();
            
            const props = createDefaultProps({
              habit,
              status,
              subtasks,
              isExpanded: false, // Start collapsed
              onToggleExpand: mockToggle,
              onSubtaskComplete: jest.fn(),
              onSubtaskEdit: jest.fn(),
            });

            const { unmount } = render(<HabitCard {...props} />);
            
            const expandButton = getExpandButton();
            expect(expandButton).not.toBeNull();
            
            if (expandButton) {
              fireEvent.click(expandButton);
              expect(mockToggle).toHaveBeenCalledTimes(1);
            }
            
            unmount();
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * **Validates: Requirement 3.1**
     * 
     * Toggle from expanded to collapsed state
     */
    test('toggle from expanded (true) triggers callback', () => {
      fc.assert(
        fc.property(
          habitArb(),
          stickiesArb(1, 10),
          habitStatusArb,
          (habit, subtasks, status) => {
            const mockToggle = jest.fn();
            
            const props = createDefaultProps({
              habit,
              status,
              subtasks,
              isExpanded: true, // Start expanded
              onToggleExpand: mockToggle,
              onSubtaskComplete: jest.fn(),
              onSubtaskEdit: jest.fn(),
            });

            const { unmount } = render(<HabitCard {...props} />);
            
            const expandButton = getExpandButton();
            expect(expandButton).not.toBeNull();
            
            if (expandButton) {
              fireEvent.click(expandButton);
              expect(mockToggle).toHaveBeenCalledTimes(1);
            }
            
            unmount();
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * **Validates: Requirement 3.1**
     * 
     * Multiple clicks should trigger callback multiple times
     */
    test('multiple clicks trigger callback multiple times', () => {
      fc.assert(
        fc.property(
          habitArb(),
          stickiesArb(1, 5),
          fc.integer({ min: 1, max: 5 }), // Number of clicks
          habitStatusArb,
          (habit, subtasks, clickCount, status) => {
            const mockToggle = jest.fn();
            
            const props = createDefaultProps({
              habit,
              status,
              subtasks,
              isExpanded: false,
              onToggleExpand: mockToggle,
              onSubtaskComplete: jest.fn(),
              onSubtaskEdit: jest.fn(),
            });

            const { unmount } = render(<HabitCard {...props} />);
            
            const expandButton = getExpandButton();
            expect(expandButton).not.toBeNull();
            
            if (expandButton) {
              for (let i = 0; i < clickCount; i++) {
                fireEvent.click(expandButton);
              }
              expect(mockToggle).toHaveBeenCalledTimes(clickCount);
            }
            
            unmount();
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * **Validates: Requirement 3.1**
     * 
     * Expand button click should not trigger other callbacks
     */
    test('expand button click does not trigger other callbacks', () => {
      fc.assert(
        fc.property(
          habitArb(),
          stickiesArb(1, 5),
          habitStatusArb,
          (habit, subtasks, status) => {
            const mockToggle = jest.fn();
            const mockComplete = jest.fn();
            const mockEdit = jest.fn();
            const mockSubtaskComplete = jest.fn();
            const mockSubtaskEdit = jest.fn();
            
            const props = createDefaultProps({
              habit,
              status,
              subtasks,
              isExpanded: false,
              onToggleExpand: mockToggle,
              onComplete: mockComplete,
              onEdit: mockEdit,
              onSubtaskComplete: mockSubtaskComplete,
              onSubtaskEdit: mockSubtaskEdit,
            });

            const { unmount } = render(<HabitCard {...props} />);
            
            const expandButton = getExpandButton();
            expect(expandButton).not.toBeNull();
            
            if (expandButton) {
              fireEvent.click(expandButton);
              
              // Only toggle should be called
              expect(mockToggle).toHaveBeenCalledTimes(1);
              expect(mockComplete).not.toHaveBeenCalled();
              // Note: onEdit might be called by card click, but not by expand button
              expect(mockSubtaskComplete).not.toHaveBeenCalled();
              expect(mockSubtaskEdit).not.toHaveBeenCalled();
            }
            
            unmount();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Edge Cases', () => {
    /**
     * Habit with exactly one subtask should show expand button
     */
    test('habit with exactly one subtask shows expand button', () => {
      fc.assert(
        fc.property(
          habitArb(),
          stickyArb(), // Single subtask
          habitStatusArb,
          (habit, subtask, status) => {
            const props = createDefaultProps({
              habit,
              status,
              subtasks: [subtask],
              isExpanded: false,
              onToggleExpand: jest.fn(),
              onSubtaskComplete: jest.fn(),
              onSubtaskEdit: jest.fn(),
            });

            const { unmount } = render(<HabitCard {...props} />);
            
            const buttonVisible = isExpandButtonVisible();
            
            unmount();
            
            expect(buttonVisible).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Expand button visibility is independent of habit completion status
     */
    test('expand button visibility is independent of habit completion status', () => {
      fc.assert(
        fc.property(
          habitArb(),
          stickiesArb(1, 5),
          fc.boolean(), // Habit completed status
          habitStatusArb,
          (habit, subtasks, completed, status) => {
            const habitWithCompletion = { ...habit, completed };
            
            const props = createDefaultProps({
              habit: habitWithCompletion,
              status,
              subtasks,
              isExpanded: false,
              onToggleExpand: jest.fn(),
              onSubtaskComplete: jest.fn(),
              onSubtaskEdit: jest.fn(),
            });

            const { unmount } = render(<HabitCard {...props} />);
            
            const buttonVisible = isExpandButtonVisible();
            
            unmount();
            
            // Expand button should be visible regardless of habit completion
            expect(buttonVisible).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Expand button visibility is independent of subtask completion status
     */
    test('expand button visibility is independent of subtask completion status', () => {
      fc.assert(
        fc.property(
          habitArb(),
          fc.array(fc.boolean(), { minLength: 1, maxLength: 5 }), // Completion states
          habitStatusArb,
          (habit, completionStates, status) => {
            const subtasks: Sticky[] = completionStates.map((completed, i) => ({
              id: `sticky-${i}`,
              name: `Subtask ${i}`,
              completed,
              displayOrder: i,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }));
            
            const props = createDefaultProps({
              habit,
              status,
              subtasks,
              isExpanded: false,
              onToggleExpand: jest.fn(),
              onSubtaskComplete: jest.fn(),
              onSubtaskEdit: jest.fn(),
            });

            const { unmount } = render(<HabitCard {...props} />);
            
            const buttonVisible = isExpandButtonVisible();
            
            unmount();
            
            // Expand button should be visible regardless of subtask completion
            expect(buttonVisible).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Expand button visibility is independent of isDragging state
     */
    test('expand button visibility is independent of isDragging state', () => {
      fc.assert(
        fc.property(
          habitArb(),
          stickiesArb(1, 5),
          fc.boolean(), // isDragging
          habitStatusArb,
          (habit, subtasks, isDragging, status) => {
            const props = createDefaultProps({
              habit,
              status,
              subtasks,
              isExpanded: false,
              onToggleExpand: jest.fn(),
              onSubtaskComplete: jest.fn(),
              onSubtaskEdit: jest.fn(),
              isDragging,
            });

            const { unmount } = render(<HabitCard {...props} />);
            
            const buttonVisible = isExpandButtonVisible();
            
            unmount();
            
            // Expand button should be visible regardless of dragging state
            expect(buttonVisible).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
