/**
 * Property-based tests for CalendarControls Component
 * 
 * **Feature: todo-site-refactoring, Property 2: Functional equivalence preservation**
 * **Validates: Requirements 1.2, 8.2**
 * 
 * Tests that the CalendarControls component maintains functional equivalence
 * with the original implementation, all existing functionality remains intact,
 * and the props interface is correctly implemented.
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CalendarControls, {
  CalendarControlsProps,
  CalendarViewType,
} from '../app/dashboard/components/calendar/CalendarControls';

// Valid view types for the calendar
const VALID_VIEW_TYPES: CalendarViewType[] = ['today', 'tomorrow', 'week', 'month'];

// Arbitrary generator for CalendarViewType
const viewTypeArb = fc.constantFrom<CalendarViewType>(...VALID_VIEW_TYPES);

describe('CalendarControls Property Tests', () => {
  /**
   * **Property 2: Functional equivalence preservation**
   * **Validates: Requirements 1.2, 8.2**
   * 
   * Validates that the CalendarControls component maintains all existing
   * functionality and the props interface is correctly implemented.
   */
  describe('Property 2: Functional equivalence preservation', () => {
    
    describe('Props interface correctness', () => {
      test('should render correctly for all valid view types', () => {
        fc.assert(
          fc.property(
            viewTypeArb,
            (selectedView) => {
              const mockOnViewChange = jest.fn();
              const mockOnScrollToNow = jest.fn();
              
              const { unmount } = render(
                <CalendarControls
                  selectedView={selectedView}
                  onViewChange={mockOnViewChange}
                  onScrollToNow={mockOnScrollToNow}
                />
              );
              
              // Component should render without errors
              // All four view buttons should be present
              expect(screen.getByRole('button', { name: /today/i })).toBeInTheDocument();
              expect(screen.getByRole('button', { name: /tomorrow/i })).toBeInTheDocument();
              expect(screen.getByRole('button', { name: /week/i })).toBeInTheDocument();
              expect(screen.getByRole('button', { name: /month/i })).toBeInTheDocument();
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('should correctly indicate selected view via aria-pressed', () => {
        fc.assert(
          fc.property(
            viewTypeArb,
            (selectedView) => {
              const mockOnViewChange = jest.fn();
              const mockOnScrollToNow = jest.fn();
              
              const { unmount } = render(
                <CalendarControls
                  selectedView={selectedView}
                  onViewChange={mockOnViewChange}
                  onScrollToNow={mockOnScrollToNow}
                />
              );
              
              // The selected view button should have aria-pressed="true"
              const selectedButton = screen.getByRole('button', { name: new RegExp(selectedView, 'i') });
              expect(selectedButton).toHaveAttribute('aria-pressed', 'true');
              
              // Other buttons should have aria-pressed="false"
              const otherViews = VALID_VIEW_TYPES.filter(v => v !== selectedView);
              for (const view of otherViews) {
                const button = screen.getByRole('button', { name: new RegExp(view, 'i') });
                expect(button).toHaveAttribute('aria-pressed', 'false');
              }
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('should call onViewChange with correct view type when button is clicked', () => {
        fc.assert(
          fc.property(
            viewTypeArb, // initial selected view
            viewTypeArb, // view to click
            (selectedView, clickedView) => {
              const mockOnViewChange = jest.fn();
              const mockOnScrollToNow = jest.fn();
              
              const { unmount } = render(
                <CalendarControls
                  selectedView={selectedView}
                  onViewChange={mockOnViewChange}
                  onScrollToNow={mockOnScrollToNow}
                />
              );
              
              // Click the button for the clicked view
              const button = screen.getByRole('button', { name: new RegExp(clickedView, 'i') });
              fireEvent.click(button);
              
              // onViewChange should be called with the clicked view
              expect(mockOnViewChange).toHaveBeenCalledWith(clickedView);
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('should call onScrollToNow when today view is clicked', () => {
        fc.assert(
          fc.property(
            viewTypeArb,
            (selectedView) => {
              const mockOnViewChange = jest.fn();
              const mockOnScrollToNow = jest.fn();
              
              // Mock setTimeout
              jest.useFakeTimers();
              
              const { unmount } = render(
                <CalendarControls
                  selectedView={selectedView}
                  onViewChange={mockOnViewChange}
                  onScrollToNow={mockOnScrollToNow}
                />
              );
              
              // Click the today button
              const todayButton = screen.getByRole('button', { name: /today/i });
              fireEvent.click(todayButton);
              
              // Fast-forward timers
              jest.runAllTimers();
              
              // onScrollToNow should be called when today is clicked
              expect(mockOnScrollToNow).toHaveBeenCalled();
              
              jest.useRealTimers();
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('should not call onScrollToNow when non-today view is clicked', () => {
        fc.assert(
          fc.property(
            viewTypeArb,
            fc.constantFrom<CalendarViewType>('tomorrow', 'week', 'month'),
            (selectedView, clickedView) => {
              const mockOnViewChange = jest.fn();
              const mockOnScrollToNow = jest.fn();
              
              // Mock setTimeout
              jest.useFakeTimers();
              
              const { unmount } = render(
                <CalendarControls
                  selectedView={selectedView}
                  onViewChange={mockOnViewChange}
                  onScrollToNow={mockOnScrollToNow}
                />
              );
              
              // Click a non-today button
              const button = screen.getByRole('button', { name: new RegExp(clickedView, 'i') });
              fireEvent.click(button);
              
              // Fast-forward timers
              jest.runAllTimers();
              
              // onScrollToNow should NOT be called for non-today views
              expect(mockOnScrollToNow).not.toHaveBeenCalled();
              
              jest.useRealTimers();
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Visual state consistency', () => {
      test('should apply active styling to selected view button', () => {
        fc.assert(
          fc.property(
            viewTypeArb,
            (selectedView) => {
              const mockOnViewChange = jest.fn();
              const mockOnScrollToNow = jest.fn();
              
              const { unmount } = render(
                <CalendarControls
                  selectedView={selectedView}
                  onViewChange={mockOnViewChange}
                  onScrollToNow={mockOnScrollToNow}
                />
              );
              
              // The selected button should have active styling (bg-sky-600)
              const selectedButton = screen.getByRole('button', { name: new RegExp(selectedView, 'i') });
              expect(selectedButton.className).toContain('bg-sky-600');
              expect(selectedButton.className).toContain('text-white');
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('should apply inactive styling to non-selected view buttons', () => {
        fc.assert(
          fc.property(
            viewTypeArb,
            (selectedView) => {
              const mockOnViewChange = jest.fn();
              const mockOnScrollToNow = jest.fn();
              
              const { unmount } = render(
                <CalendarControls
                  selectedView={selectedView}
                  onViewChange={mockOnViewChange}
                  onScrollToNow={mockOnScrollToNow}
                />
              );
              
              // Non-selected buttons should have inactive styling
              const otherViews = VALID_VIEW_TYPES.filter(v => v !== selectedView);
              for (const view of otherViews) {
                const button = screen.getByRole('button', { name: new RegExp(view, 'i') });
                expect(button.className).toContain('bg-white');
                expect(button.className).not.toContain('bg-sky-600');
              }
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('should render exactly four view buttons', () => {
        fc.assert(
          fc.property(
            viewTypeArb,
            (selectedView) => {
              const mockOnViewChange = jest.fn();
              const mockOnScrollToNow = jest.fn();
              
              const { unmount } = render(
                <CalendarControls
                  selectedView={selectedView}
                  onViewChange={mockOnViewChange}
                  onScrollToNow={mockOnScrollToNow}
                />
              );
              
              // Should have exactly 4 buttons
              const buttons = screen.getAllByRole('button');
              expect(buttons).toHaveLength(4);
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Accessibility compliance', () => {
      test('should have accessible labels for all buttons', () => {
        fc.assert(
          fc.property(
            viewTypeArb,
            (selectedView) => {
              const mockOnViewChange = jest.fn();
              const mockOnScrollToNow = jest.fn();
              
              const { unmount } = render(
                <CalendarControls
                  selectedView={selectedView}
                  onViewChange={mockOnViewChange}
                  onScrollToNow={mockOnScrollToNow}
                />
              );
              
              // All buttons should have aria-label
              for (const view of VALID_VIEW_TYPES) {
                const button = screen.getByRole('button', { name: new RegExp(`switch to ${view} view`, 'i') });
                expect(button).toBeInTheDocument();
              }
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('should have minimum touch target size', () => {
        fc.assert(
          fc.property(
            viewTypeArb,
            (selectedView) => {
              const mockOnViewChange = jest.fn();
              const mockOnScrollToNow = jest.fn();
              
              const { unmount } = render(
                <CalendarControls
                  selectedView={selectedView}
                  onViewChange={mockOnViewChange}
                  onScrollToNow={mockOnScrollToNow}
                />
              );
              
              // All buttons should have min-h-[44px] and min-w-[44px] classes
              const buttons = screen.getAllByRole('button');
              for (const button of buttons) {
                expect(button.className).toContain('min-h-[44px]');
                expect(button.className).toContain('min-w-[44px]');
              }
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('should have focus-visible outline for keyboard navigation', () => {
        fc.assert(
          fc.property(
            viewTypeArb,
            (selectedView) => {
              const mockOnViewChange = jest.fn();
              const mockOnScrollToNow = jest.fn();
              
              const { unmount } = render(
                <CalendarControls
                  selectedView={selectedView}
                  onViewChange={mockOnViewChange}
                  onScrollToNow={mockOnScrollToNow}
                />
              );
              
              // All buttons should have focus-visible classes
              const buttons = screen.getAllByRole('button');
              for (const button of buttons) {
                expect(button.className).toContain('focus-visible:outline');
              }
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });
    });
  });

  /**
   * **Property 2: Functional equivalence preservation - Component structure verification**
   * **Validates: Requirements 1.2, 8.2**
   * 
   * Verifies that the CalendarControls component is properly extracted
   * and maintains the expected structure.
   */
  describe('Property 2: Component structure verification', () => {
    const calendarDir = path.join(__dirname, '../app/dashboard/components/calendar');
    
    test('CalendarControls.tsx should exist in calendar directory', () => {
      const componentPath = path.join(calendarDir, 'CalendarControls.tsx');
      expect(fs.existsSync(componentPath)).toBe(true);
    });

    test('CalendarControls.tsx should export required types and component', () => {
      const componentPath = path.join(calendarDir, 'CalendarControls.tsx');
      const content = fs.readFileSync(componentPath, 'utf-8');

      // Check for required exports
      expect(content).toContain('export type CalendarViewType');
      expect(content).toContain('export interface CalendarControlsProps');
      expect(content).toContain('export default function CalendarControls');
    });

    test('CalendarControlsProps should have all required properties', () => {
      const componentPath = path.join(calendarDir, 'CalendarControls.tsx');
      const content = fs.readFileSync(componentPath, 'utf-8');

      // Check for required props
      expect(content).toContain('selectedView: CalendarViewType');
      expect(content).toContain('onViewChange: (view: CalendarViewType) => void');
      expect(content).toContain('onScrollToNow: () => void');
    });

    test('CalendarViewType should include all valid view types', () => {
      const componentPath = path.join(calendarDir, 'CalendarControls.tsx');
      const content = fs.readFileSync(componentPath, 'utf-8');

      // Check for all view types in the type definition
      expect(content).toMatch(/CalendarViewType\s*=\s*['"]today['"]/);
      expect(content).toContain("'tomorrow'");
      expect(content).toContain("'week'");
      expect(content).toContain("'month'");
    });

    test('Component should be a pure presentational component (no useState)', () => {
      const componentPath = path.join(calendarDir, 'CalendarControls.tsx');
      const content = fs.readFileSync(componentPath, 'utf-8');

      // Should not have useState (pure presentational component)
      expect(content).not.toMatch(/useState\s*[<(]/);
    });

    test('Component should have proper JSDoc documentation', () => {
      const componentPath = path.join(calendarDir, 'CalendarControls.tsx');
      const content = fs.readFileSync(componentPath, 'utf-8');

      // Should have JSDoc comments
      expect(content).toContain('/**');
      expect(content).toContain('@requirements');
    });

    test('Component should use "use client" directive', () => {
      const componentPath = path.join(calendarDir, 'CalendarControls.tsx');
      const content = fs.readFileSync(componentPath, 'utf-8');

      // Should have "use client" directive at the top
      expect(content.trim().startsWith('"use client"')).toBe(true);
    });
  });

  /**
   * **Property 2: Functional equivalence preservation - Integration verification**
   * **Validates: Requirements 1.2, 8.2**
   * 
   * Verifies that the CalendarControls component can be properly integrated
   * with the parent Widget.Calendar component.
   */
  describe('Property 2: Integration verification', () => {
    const dashboardDir = path.join(__dirname, '../app/dashboard');
    
    test('Widget.Calendar.tsx should import CalendarControls', () => {
      const widgetPath = path.join(dashboardDir, 'components/Widget.Calendar.tsx');
      
      if (fs.existsSync(widgetPath)) {
        const content = fs.readFileSync(widgetPath, 'utf-8');
        
        // Should import CalendarControls
        expect(content).toMatch(/import.*CalendarControls.*from.*['"].*calendar\/CalendarControls['"]/);
      }
    });

    test('CalendarControls should be used in Widget.Calendar.tsx', () => {
      const widgetPath = path.join(dashboardDir, 'components/Widget.Calendar.tsx');
      
      if (fs.existsSync(widgetPath)) {
        const content = fs.readFileSync(widgetPath, 'utf-8');
        
        // Should use CalendarControls component
        expect(content).toMatch(/<CalendarControls/);
      }
    });
  });

  /**
   * **Property 2: Functional equivalence preservation - State transition consistency**
   * **Validates: Requirements 1.2, 8.2**
   * 
   * Verifies that view transitions work correctly for all combinations.
   */
  describe('Property 2: State transition consistency', () => {
    test('should handle all view transitions correctly', () => {
      fc.assert(
        fc.property(
          viewTypeArb, // from view
          viewTypeArb, // to view
          (fromView, toView) => {
            const mockOnViewChange = jest.fn();
            const mockOnScrollToNow = jest.fn();
            
            const { rerender, unmount } = render(
              <CalendarControls
                selectedView={fromView}
                onViewChange={mockOnViewChange}
                onScrollToNow={mockOnScrollToNow}
              />
            );
            
            // Click the target view button
            const targetButton = screen.getByRole('button', { name: new RegExp(toView, 'i') });
            fireEvent.click(targetButton);
            
            // Verify onViewChange was called with correct view
            expect(mockOnViewChange).toHaveBeenCalledWith(toView);
            
            // Simulate parent updating the selectedView prop
            rerender(
              <CalendarControls
                selectedView={toView}
                onViewChange={mockOnViewChange}
                onScrollToNow={mockOnScrollToNow}
              />
            );
            
            // Verify the new view is now selected
            const newSelectedButton = screen.getByRole('button', { name: new RegExp(toView, 'i') });
            expect(newSelectedButton).toHaveAttribute('aria-pressed', 'true');
            
            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should maintain button order regardless of selected view', () => {
      fc.assert(
        fc.property(
          viewTypeArb,
          (selectedView) => {
            const mockOnViewChange = jest.fn();
            const mockOnScrollToNow = jest.fn();
            
            const { unmount } = render(
              <CalendarControls
                selectedView={selectedView}
                onViewChange={mockOnViewChange}
                onScrollToNow={mockOnScrollToNow}
              />
            );
            
            // Get all buttons
            const buttons = screen.getAllByRole('button');
            
            // Verify button order is always: today, tomorrow, week, month
            expect(buttons[0]).toHaveAttribute('aria-label', 'Switch to today view');
            expect(buttons[1]).toHaveAttribute('aria-label', 'Switch to tomorrow view');
            expect(buttons[2]).toHaveAttribute('aria-label', 'Switch to week view');
            expect(buttons[3]).toHaveAttribute('aria-label', 'Switch to month view');
            
            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
