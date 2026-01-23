/**
 * Property-based tests for Demo API Isolation
 *
 * **Feature: landing-page-demo, Property 3: API Isolation**
 * **Validates: Requirements 3.5, 3.6**
 *
 * Tests that the Demo_Section component makes ZERO API calls during rendering.
 * All data SHALL come from static demo data imports.
 *
 * Property Definition:
 * *For any* rendering of the Demo_Section, zero API calls SHALL be made.
 * All data SHALL come from static demo data imports.
 */

import * as fc from 'fast-check';
import React from 'react';
import { render, act } from '@testing-library/react';

// ============================================================================
// Mocks - Must be defined before imports
// ============================================================================

// Track all fetch calls
const fetchCalls: Array<{ url: string; options?: RequestInit }> = [];
const originalFetch = global.fetch;

// Mock fetch globally to track all API calls
beforeAll(() => {
  global.fetch = jest.fn((url: string | URL | Request, options?: RequestInit) => {
    const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
    fetchCalls.push({ url: urlString, options });
    // Return a mock response that won't break anything
    return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
  }) as jest.Mock;
});

afterAll(() => {
  global.fetch = originalFetch;
});

beforeEach(() => {
  // Clear fetch calls before each test
  fetchCalls.length = 0;
  jest.clearAllMocks();
});

// Mock mermaid module to avoid ESM import issues
jest.mock('mermaid', () => ({
  default: {
    initialize: jest.fn(),
    run: jest.fn(),
  },
}));

// Mock FullCalendar to avoid complex dependencies
jest.mock('@fullcalendar/react', () => {
  return function MockFullCalendar() {
    return <div data-testid="mock-fullcalendar">Calendar</div>;
  };
});

jest.mock('@fullcalendar/daygrid', () => ({}));
jest.mock('@fullcalendar/timegrid', () => ({}));
jest.mock('@fullcalendar/interaction', () => ({}));
jest.mock('@fullcalendar/rrule', () => ({}));

// Mock reactflow to avoid complex dependencies
jest.mock('reactflow', () => ({
  ReactFlow: () => <div data-testid="mock-reactflow">ReactFlow</div>,
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
  useNodesState: () => [[], jest.fn(), jest.fn()],
  useEdgesState: () => [[], jest.fn(), jest.fn()],
  addEdge: jest.fn(),
  MarkerType: { ArrowClosed: 'arrowclosed' },
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
}));

// Mock XMLHttpRequest to track any XHR calls
const xhrCalls: Array<{ method: string; url: string }> = [];
const MockXMLHttpRequest = jest.fn().mockImplementation(() => ({
  open: jest.fn((method: string, url: string) => {
    xhrCalls.push({ method, url });
  }),
  send: jest.fn(),
  setRequestHeader: jest.fn(),
  readyState: 4,
  status: 200,
  response: '{}',
  responseText: '{}',
  onreadystatechange: null,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}));

const originalXHR = global.XMLHttpRequest;
beforeAll(() => {
  (global as any).XMLHttpRequest = MockXMLHttpRequest;
});

afterAll(() => {
  (global as any).XMLHttpRequest = originalXHR;
});

beforeEach(() => {
  xhrCalls.length = 0;
  MockXMLHttpRequest.mockClear();
});

// ============================================================================
// Imports - After mocks
// ============================================================================

import DemoSection, { DemoDashboardContent } from '../app/demo/components/Section.Demo';
import { DemoDataProvider } from '../app/demo/contexts/DemoDataContext';
import { HandednessProvider } from '../app/dashboard/contexts/HandednessContext';
import { demoGoals, demoHabits, demoActivities, demoStickies } from '../app/demo/data/demoData';

// ============================================================================
// Property Tests
// ============================================================================

describe('Demo API Isolation Property Tests', () => {
  /**
   * **Property 3: API Isolation**
   * **Validates: Requirements 3.5, 3.6**
   */
  describe('Property 3: API Isolation', () => {
    
    describe('Requirement 3.5: Pass demo data instead of API-fetched data', () => {
      test('DemoDataProvider should provide static demo data without API calls', () => {
        fc.assert(
          fc.property(
            fc.constant(null),
            () => {
              // Clear any previous calls
              fetchCalls.length = 0;
              xhrCalls.length = 0;
              
              // Render the DemoDataProvider with a consumer component
              let capturedData: any = null;
              
              const DataConsumer = () => {
                const { useDemoData } = require('../app/demo/contexts/DemoDataContext');
                capturedData = useDemoData();
                return null;
              };
              
              const { unmount } = render(
                <DemoDataProvider>
                  <DataConsumer />
                </DemoDataProvider>
              );
              
              // Verify data is provided
              expect(capturedData).not.toBeNull();
              expect(capturedData.habits).toBeDefined();
              expect(capturedData.goals).toBeDefined();
              expect(capturedData.activities).toBeDefined();
              expect(capturedData.stickies).toBeDefined();
              
              // Verify NO API calls were made
              expect(fetchCalls).toHaveLength(0);
              expect(xhrCalls).toHaveLength(0);
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Demo data should match static imports exactly', () => {
        fc.assert(
          fc.property(
            fc.constant(null),
            () => {
              let capturedData: any = null;
              
              const DataConsumer = () => {
                const { useDemoData } = require('../app/demo/contexts/DemoDataContext');
                capturedData = useDemoData();
                return null;
              };
              
              const { unmount } = render(
                <DemoDataProvider>
                  <DataConsumer />
                </DemoDataProvider>
              );
              
              // Verify data matches static imports
              expect(capturedData.habits).toHaveLength(demoHabits.length);
              expect(capturedData.goals).toHaveLength(demoGoals.length);
              expect(capturedData.stickies).toHaveLength(demoStickies.length);
              
              // Verify habit IDs match
              const habitIds = capturedData.habits.map((h: any) => h.id);
              const expectedHabitIds = demoHabits.map(h => h.id);
              expect(habitIds).toEqual(expectedHabitIds);
              
              // Verify goal IDs match
              const goalIds = capturedData.goals.map((g: any) => g.id);
              const expectedGoalIds = demoGoals.map(g => g.id);
              expect(goalIds).toEqual(expectedGoalIds);
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Demo handlers should not make API calls', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.constant(null),
            async () => {
              fetchCalls.length = 0;
              xhrCalls.length = 0;
              
              let capturedData: any = null;
              
              const DataConsumer = () => {
                const { useDemoData } = require('../app/demo/contexts/DemoDataContext');
                capturedData = useDemoData();
                return null;
              };
              
              const { unmount } = render(
                <DemoDataProvider>
                  <DataConsumer />
                </DemoDataProvider>
              );
              
              // Call all handlers
              await act(async () => {
                capturedData.onHabitAction('demo-habit-1', 'complete', 1);
                capturedData.onStickyCreate();
                capturedData.onStickyComplete('demo-sticky-1');
              });
              
              // Verify NO API calls were made
              expect(fetchCalls).toHaveLength(0);
              expect(xhrCalls).toHaveLength(0);
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Requirement 3.6: NO API calls during rendering', () => {
      test('DemoSection rendering should make zero fetch calls', () => {
        fc.assert(
          fc.property(
            fc.constant(null),
            () => {
              // Clear any previous calls
              fetchCalls.length = 0;
              xhrCalls.length = 0;
              
              // Render the full DemoSection
              const { unmount } = render(<DemoSection />);
              
              // Verify NO fetch calls were made
              expect(fetchCalls).toHaveLength(0);
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('DemoSection rendering should make zero XHR calls', () => {
        fc.assert(
          fc.property(
            fc.constant(null),
            () => {
              // Clear any previous calls
              fetchCalls.length = 0;
              xhrCalls.length = 0;
              
              // Render the full DemoSection
              const { unmount } = render(<DemoSection />);
              
              // Verify NO XHR calls were made
              expect(xhrCalls).toHaveLength(0);
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('DemoDashboardContent rendering should make zero API calls', () => {
        fc.assert(
          fc.property(
            fc.constant(null),
            () => {
              // Clear any previous calls
              fetchCalls.length = 0;
              xhrCalls.length = 0;
              
              // Render the dashboard content with providers
              const { unmount } = render(
                <DemoDataProvider>
                  <HandednessProvider>
                    <DemoDashboardContent />
                  </HandednessProvider>
                </DemoDataProvider>
              );
              
              // Verify NO API calls were made
              expect(fetchCalls).toHaveLength(0);
              expect(xhrCalls).toHaveLength(0);
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Multiple renders should still make zero API calls', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 1, max: 5 }),
            (renderCount) => {
              // Clear any previous calls
              fetchCalls.length = 0;
              xhrCalls.length = 0;
              
              // Render multiple times
              for (let i = 0; i < renderCount; i++) {
                const { unmount } = render(<DemoSection />);
                unmount();
              }
              
              // Verify NO API calls were made across all renders
              expect(fetchCalls).toHaveLength(0);
              expect(xhrCalls).toHaveLength(0);
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Rendering with different scale values should make zero API calls', () => {
        fc.assert(
          fc.property(
            fc.float({ min: Math.fround(0.1), max: Math.fround(1.0), noNaN: true }),
            (scale) => {
              // Clear any previous calls
              fetchCalls.length = 0;
              xhrCalls.length = 0;
              
              // Render with different scale
              const { unmount } = render(<DemoSection scale={scale} />);
              
              // Verify NO API calls were made
              expect(fetchCalls).toHaveLength(0);
              expect(xhrCalls).toHaveLength(0);
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Data source verification', () => {
      test('All demo data should be imported from static file, not fetched', () => {
        fc.assert(
          fc.property(
            fc.constant(null),
            () => {
              // Verify static imports exist and have data
              expect(demoHabits).toBeDefined();
              expect(demoHabits.length).toBeGreaterThanOrEqual(3);
              
              expect(demoGoals).toBeDefined();
              expect(demoGoals.length).toBeGreaterThanOrEqual(2);
              
              expect(demoActivities).toBeDefined();
              expect(demoActivities.length).toBeGreaterThan(0);
              
              expect(demoStickies).toBeDefined();
              expect(demoStickies.length).toBeGreaterThanOrEqual(2);
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Demo data should have valid structure without needing API validation', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 0, max: demoHabits.length - 1 }),
            (habitIndex) => {
              const habit = demoHabits[habitIndex];
              
              // Verify habit has required fields (static data, no API needed)
              expect(habit.id).toBeDefined();
              expect(habit.name).toBeDefined();
              expect(habit.goalId).toBeDefined();
              expect(habit.type).toBeDefined();
              expect(habit.time).toBeDefined();
              expect(habit.endTime).toBeDefined();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Demo goals should have valid structure without needing API validation', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 0, max: demoGoals.length - 1 }),
            (goalIndex) => {
              const goal = demoGoals[goalIndex];
              
              // Verify goal has required fields (static data, no API needed)
              expect(goal.id).toBeDefined();
              expect(goal.name).toBeDefined();
              expect(goal.createdAt).toBeDefined();
              expect(goal.updatedAt).toBeDefined();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Demo stickies should have valid structure without needing API validation', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 0, max: demoStickies.length - 1 }),
            (stickyIndex) => {
              const sticky = demoStickies[stickyIndex];
              
              // Verify sticky has required fields (static data, no API needed)
              expect(sticky.id).toBeDefined();
              expect(sticky.name).toBeDefined();
              expect(sticky.description).toBeDefined();
              expect(typeof sticky.completed).toBe('boolean');
              expect(typeof sticky.displayOrder).toBe('number');
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Context isolation verification', () => {
      test('DemoDataContext should not trigger any network requests', () => {
        fc.assert(
          fc.property(
            fc.constant(null),
            () => {
              fetchCalls.length = 0;
              xhrCalls.length = 0;
              
              // Create a component that uses the context
              const TestComponent = () => {
                const { useDemoData } = require('../app/demo/contexts/DemoDataContext');
                const data = useDemoData();
                
                // Access all data properties
                const _ = {
                  habits: data.habits,
                  goals: data.goals,
                  activities: data.activities,
                  stickies: data.stickies,
                };
                
                return <div>Test</div>;
              };
              
              const { unmount } = render(
                <DemoDataProvider>
                  <TestComponent />
                </DemoDataProvider>
              );
              
              // Verify NO network requests
              expect(fetchCalls).toHaveLength(0);
              expect(xhrCalls).toHaveLength(0);
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Animation state changes should not trigger API calls', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.constant(null),
            async () => {
              fetchCalls.length = 0;
              xhrCalls.length = 0;
              
              let setAnimationState: any = null;
              
              const TestComponent = () => {
                const { useDemoData } = require('../app/demo/contexts/DemoDataContext');
                const data = useDemoData();
                setAnimationState = data.setAnimationState;
                return <div>Test</div>;
              };
              
              const { unmount } = render(
                <DemoDataProvider>
                  <TestComponent />
                </DemoDataProvider>
              );
              
              // Change animation state
              await act(async () => {
                setAnimationState({
                  currentStep: 1,
                  isPlaying: true,
                  isPaused: false,
                  highlightedElement: 'test-element',
                  cursorPosition: { x: 100, y: 100 },
                });
              });
              
              // Verify NO API calls
              expect(fetchCalls).toHaveLength(0);
              expect(xhrCalls).toHaveLength(0);
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Reset demo data should not trigger API calls', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.constant(null),
            async () => {
              fetchCalls.length = 0;
              xhrCalls.length = 0;
              
              let resetDemoData: any = null;
              
              const TestComponent = () => {
                const { useDemoData } = require('../app/demo/contexts/DemoDataContext');
                const data = useDemoData();
                resetDemoData = data.resetDemoData;
                return <div>Test</div>;
              };
              
              const { unmount } = render(
                <DemoDataProvider>
                  <TestComponent />
                </DemoDataProvider>
              );
              
              // Reset demo data
              await act(async () => {
                resetDemoData();
              });
              
              // Verify NO API calls
              expect(fetchCalls).toHaveLength(0);
              expect(xhrCalls).toHaveLength(0);
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });
    });
  });
});
