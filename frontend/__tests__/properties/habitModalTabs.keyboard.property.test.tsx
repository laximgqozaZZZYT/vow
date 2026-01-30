/**
 * Property-Based Tests for Habit Modal Tabs - Keyboard Navigation
 * 
 * **Feature: habit-modal-tabs, Property 10: Keyboard navigation**
 * **Validates: Requirements 11.1, 11.3**
 * 
 * *For any* focused tab, pressing ArrowRight should move focus to the next tab 
 * (if not last), pressing ArrowLeft should move focus to the previous tab 
 * (if not first), and pressing Enter or Space should activate the focused tab.
 * 
 * Uses fast-check for property-based testing with at least 100 iterations.
 */

import * as fc from 'fast-check';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TabNavigation, HABIT_MODAL_TABS } from '../../app/dashboard/components/TabNavigation';

describe('Feature: habit-modal-tabs, Property 10: Keyboard navigation', () => {
  afterEach(() => {
    cleanup();
  });

  /**
   * Property 10.1: ArrowRight navigation
   * 
   * *For any* focused tab index, pressing ArrowRight should move focus to the next tab.
   * At the last tab, it should wrap to the first tab.
   */
  it('ArrowRight should move focus to next tab (wrapping at end)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }), // starting focused tab
        (startIndex) => {
          cleanup();
          const onTabChange = jest.fn();
          
          render(
            <TabNavigation
              tabs={HABIT_MODAL_TABS}
              activeTab={startIndex}
              onTabChange={onTabChange}
            />
          );
          
          // Get all tab buttons
          const tabs = screen.getAllByRole('tab');
          
          // Focus the starting tab
          tabs[startIndex].focus();
          expect(document.activeElement).toBe(tabs[startIndex]);
          
          // Press ArrowRight
          fireEvent.keyDown(tabs[startIndex], { key: 'ArrowRight' });
          
          // Calculate expected focus index (wraps from last to first)
          const expectedFocusIndex = startIndex < 3 ? startIndex + 1 : 0;
          
          // Focus should have moved to the next tab (or wrapped to first)
          expect(document.activeElement).toBe(tabs[expectedFocusIndex]);
          
          // ArrowRight should NOT activate the tab, only move focus
          expect(onTabChange).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.2: ArrowLeft navigation
   * 
   * *For any* focused tab index, pressing ArrowLeft should move focus to the previous tab.
   * At the first tab, it should wrap to the last tab.
   */
  it('ArrowLeft should move focus to previous tab (wrapping at start)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }), // starting focused tab
        (startIndex) => {
          cleanup();
          const onTabChange = jest.fn();
          
          render(
            <TabNavigation
              tabs={HABIT_MODAL_TABS}
              activeTab={startIndex}
              onTabChange={onTabChange}
            />
          );
          
          // Get all tab buttons
          const tabs = screen.getAllByRole('tab');
          
          // Focus the starting tab
          tabs[startIndex].focus();
          expect(document.activeElement).toBe(tabs[startIndex]);
          
          // Press ArrowLeft
          fireEvent.keyDown(tabs[startIndex], { key: 'ArrowLeft' });
          
          // Calculate expected focus index (wraps from first to last)
          const expectedFocusIndex = startIndex > 0 ? startIndex - 1 : 3;
          
          // Focus should have moved to the previous tab (or wrapped to last)
          expect(document.activeElement).toBe(tabs[expectedFocusIndex]);
          
          // ArrowLeft should NOT activate the tab, only move focus
          expect(onTabChange).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.3: Enter key activation
   * 
   * *For any* focused tab index, pressing Enter should activate that tab.
   */
  it('Enter should activate the focused tab', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }), // active tab
        fc.integer({ min: 0, max: 3 }), // focused tab to activate
        (activeTab, focusedTab) => {
          cleanup();
          const onTabChange = jest.fn();
          
          render(
            <TabNavigation
              tabs={HABIT_MODAL_TABS}
              activeTab={activeTab}
              onTabChange={onTabChange}
            />
          );
          
          // Get all tab buttons
          const tabs = screen.getAllByRole('tab');
          
          // Focus the target tab
          tabs[focusedTab].focus();
          expect(document.activeElement).toBe(tabs[focusedTab]);
          
          // Press Enter
          fireEvent.keyDown(tabs[focusedTab], { key: 'Enter' });
          
          // onTabChange should be called with the focused tab index
          expect(onTabChange).toHaveBeenCalledWith(focusedTab);
          expect(onTabChange).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.4: Space key activation
   * 
   * *For any* focused tab index, pressing Space should activate that tab.
   */
  it('Space should activate the focused tab', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }), // active tab
        fc.integer({ min: 0, max: 3 }), // focused tab to activate
        (activeTab, focusedTab) => {
          cleanup();
          const onTabChange = jest.fn();
          
          render(
            <TabNavigation
              tabs={HABIT_MODAL_TABS}
              activeTab={activeTab}
              onTabChange={onTabChange}
            />
          );
          
          // Get all tab buttons
          const tabs = screen.getAllByRole('tab');
          
          // Focus the target tab
          tabs[focusedTab].focus();
          expect(document.activeElement).toBe(tabs[focusedTab]);
          
          // Press Space
          fireEvent.keyDown(tabs[focusedTab], { key: ' ' });
          
          // onTabChange should be called with the focused tab index
          expect(onTabChange).toHaveBeenCalledWith(focusedTab);
          expect(onTabChange).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.5: Sequential keyboard navigation
   * 
   * *For any* sequence of arrow key presses, the focus should move correctly
   * through the tabs, respecting wrapping behavior.
   */
  it('sequential arrow key navigation should work correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }), // starting tab
        fc.array(
          fc.constantFrom('ArrowLeft', 'ArrowRight'),
          { minLength: 1, maxLength: 10 }
        ), // sequence of arrow keys
        (startIndex, keySequence) => {
          cleanup();
          const onTabChange = jest.fn();
          
          render(
            <TabNavigation
              tabs={HABIT_MODAL_TABS}
              activeTab={startIndex}
              onTabChange={onTabChange}
            />
          );
          
          const tabs = screen.getAllByRole('tab');
          let currentFocusIndex = startIndex;
          
          // Focus the starting tab
          tabs[currentFocusIndex].focus();
          
          // Process each key in the sequence
          for (const key of keySequence) {
            fireEvent.keyDown(tabs[currentFocusIndex], { key });
            
            // Calculate expected focus after this key press
            if (key === 'ArrowRight') {
              currentFocusIndex = currentFocusIndex < 3 ? currentFocusIndex + 1 : 0;
            } else {
              currentFocusIndex = currentFocusIndex > 0 ? currentFocusIndex - 1 : 3;
            }
            
            // Verify focus moved correctly
            expect(document.activeElement).toBe(tabs[currentFocusIndex]);
          }
          
          // Arrow keys should not activate tabs
          expect(onTabChange).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.6: Navigation followed by activation
   * 
   * *For any* starting tab and navigation sequence, pressing Enter after
   * navigation should activate the currently focused tab.
   */
  it('Enter after navigation should activate the currently focused tab', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }), // starting tab
        fc.array(
          fc.constantFrom('ArrowLeft', 'ArrowRight'),
          { minLength: 0, maxLength: 5 }
        ), // navigation sequence
        (startIndex, keySequence) => {
          cleanup();
          const onTabChange = jest.fn();
          
          render(
            <TabNavigation
              tabs={HABIT_MODAL_TABS}
              activeTab={startIndex}
              onTabChange={onTabChange}
            />
          );
          
          const tabs = screen.getAllByRole('tab');
          let currentFocusIndex = startIndex;
          
          // Focus the starting tab
          tabs[currentFocusIndex].focus();
          
          // Navigate through the sequence
          for (const key of keySequence) {
            fireEvent.keyDown(tabs[currentFocusIndex], { key });
            
            if (key === 'ArrowRight') {
              currentFocusIndex = currentFocusIndex < 3 ? currentFocusIndex + 1 : 0;
            } else {
              currentFocusIndex = currentFocusIndex > 0 ? currentFocusIndex - 1 : 3;
            }
          }
          
          // Now press Enter to activate
          fireEvent.keyDown(tabs[currentFocusIndex], { key: 'Enter' });
          
          // Should activate the currently focused tab
          expect(onTabChange).toHaveBeenCalledWith(currentFocusIndex);
          expect(onTabChange).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * Property-Based Tests for Habit Modal Tabs - ARIA Selected State
 * 
 * **Feature: habit-modal-tabs, Property 11: ARIA selected state**
 * **Validates: Requirements 11.4**
 * 
 * *For any* active tab index, only the tab at that index should have 
 * aria-selected="true", and all other tabs should have aria-selected="false".
 * 
 * Uses fast-check for property-based testing with at least 100 iterations.
 */

describe('Feature: habit-modal-tabs, Property 11: ARIA selected state', () => {
  afterEach(() => {
    cleanup();
  });

  /**
   * Property 11.1: Only active tab has aria-selected="true"
   * 
   * *For any* active tab index, only that tab should have aria-selected="true".
   */
  it('only the active tab should have aria-selected="true"', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }), // active tab index
        (activeTabIndex) => {
          cleanup();
          const onTabChange = jest.fn();
          
          render(
            <TabNavigation
              tabs={HABIT_MODAL_TABS}
              activeTab={activeTabIndex}
              onTabChange={onTabChange}
            />
          );
          
          // Get all tab buttons
          const tabs = screen.getAllByRole('tab');
          
          // Verify exactly one tab has aria-selected="true"
          const selectedTabs = tabs.filter(
            (tab) => tab.getAttribute('aria-selected') === 'true'
          );
          expect(selectedTabs).toHaveLength(1);
          
          // Verify the active tab is the one with aria-selected="true"
          expect(tabs[activeTabIndex].getAttribute('aria-selected')).toBe('true');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.2: All non-active tabs have aria-selected="false"
   * 
   * *For any* active tab index, all other tabs should have aria-selected="false".
   */
  it('all non-active tabs should have aria-selected="false"', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }), // active tab index
        (activeTabIndex) => {
          cleanup();
          const onTabChange = jest.fn();
          
          render(
            <TabNavigation
              tabs={HABIT_MODAL_TABS}
              activeTab={activeTabIndex}
              onTabChange={onTabChange}
            />
          );
          
          // Get all tab buttons
          const tabs = screen.getAllByRole('tab');
          
          // Verify all non-active tabs have aria-selected="false"
          tabs.forEach((tab, index) => {
            if (index !== activeTabIndex) {
              expect(tab.getAttribute('aria-selected')).toBe('false');
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.3: ARIA selected state is mutually exclusive
   * 
   * *For any* active tab index, exactly one tab should have aria-selected="true"
   * and all others should have aria-selected="false" (mutual exclusivity).
   */
  it('aria-selected state should be mutually exclusive across all tabs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }), // active tab index
        (activeTabIndex) => {
          cleanup();
          const onTabChange = jest.fn();
          
          render(
            <TabNavigation
              tabs={HABIT_MODAL_TABS}
              activeTab={activeTabIndex}
              onTabChange={onTabChange}
            />
          );
          
          // Get all tab buttons
          const tabs = screen.getAllByRole('tab');
          
          // Count tabs with aria-selected="true" and aria-selected="false"
          let trueCount = 0;
          let falseCount = 0;
          
          tabs.forEach((tab, index) => {
            const ariaSelected = tab.getAttribute('aria-selected');
            if (ariaSelected === 'true') {
              trueCount++;
              // The true one must be the active tab
              expect(index).toBe(activeTabIndex);
            } else if (ariaSelected === 'false') {
              falseCount++;
            }
          });
          
          // Exactly one true, rest are false
          expect(trueCount).toBe(1);
          expect(falseCount).toBe(tabs.length - 1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.4: ARIA selected state updates correctly after tab change
   * 
   * *For any* initial active tab and any target tab, after clicking the target tab,
   * only the target tab should have aria-selected="true".
   */
  it('aria-selected state should update correctly when active tab changes', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }), // initial active tab
        fc.integer({ min: 0, max: 3 }), // target tab to click
        (initialActiveTab, targetTab) => {
          cleanup();
          let currentActiveTab = initialActiveTab;
          const onTabChange = jest.fn((index: number) => {
            currentActiveTab = index;
          });
          
          const { rerender } = render(
            <TabNavigation
              tabs={HABIT_MODAL_TABS}
              activeTab={currentActiveTab}
              onTabChange={onTabChange}
            />
          );
          
          // Get all tab buttons
          let tabs = screen.getAllByRole('tab');
          
          // Verify initial state
          expect(tabs[initialActiveTab].getAttribute('aria-selected')).toBe('true');
          
          // Click the target tab
          fireEvent.click(tabs[targetTab]);
          
          // Rerender with new active tab
          rerender(
            <TabNavigation
              tabs={HABIT_MODAL_TABS}
              activeTab={currentActiveTab}
              onTabChange={onTabChange}
            />
          );
          
          // Get tabs again after rerender
          tabs = screen.getAllByRole('tab');
          
          // Verify only the target tab now has aria-selected="true"
          tabs.forEach((tab, index) => {
            if (index === targetTab) {
              expect(tab.getAttribute('aria-selected')).toBe('true');
            } else {
              expect(tab.getAttribute('aria-selected')).toBe('false');
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.5: ARIA selected state consistency with different tab configurations
   * 
   * *For any* subset of tabs (at least 2) and any valid active index within that subset,
   * the ARIA selected state should be correctly applied.
   */
  it('aria-selected state should work correctly with different tab counts', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 4 }), // number of tabs to use
        fc.nat(), // seed for active tab (will be modulo'd)
        (tabCount, activeTabSeed) => {
          cleanup();
          const onTabChange = jest.fn();
          
          // Use a subset of tabs
          const tabsSubset = HABIT_MODAL_TABS.slice(0, tabCount);
          const activeTabIndex = activeTabSeed % tabCount;
          
          render(
            <TabNavigation
              tabs={tabsSubset}
              activeTab={activeTabIndex}
              onTabChange={onTabChange}
            />
          );
          
          // Get all tab buttons
          const tabs = screen.getAllByRole('tab');
          
          // Verify correct number of tabs rendered
          expect(tabs).toHaveLength(tabCount);
          
          // Verify ARIA selected state
          tabs.forEach((tab, index) => {
            const expectedSelected = index === activeTabIndex ? 'true' : 'false';
            expect(tab.getAttribute('aria-selected')).toBe(expectedSelected);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
