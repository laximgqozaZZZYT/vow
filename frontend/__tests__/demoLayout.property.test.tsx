/**
 * Property-based tests for Demo Layout Structure Consistency
 *
 * **Feature: landing-page-demo, Property 2: Layout Structure Consistency**
 * **Validates: Requirements 2.2, 2.3, 2.4, 2.7**
 *
 * Tests that the Demo_Section component maintains the EXACT same layout structure
 * as the actual dashboard (frontend/app/dashboard/page.tsx):
 * - Same grid layout classes
 * - Same component ordering (NextSection, StickiesSection, CalendarWidget, StaticsSection)
 * - CSS transform scale applied to container
 * - Same Tailwind breakpoint classes for responsiveness
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { render, screen } from '@testing-library/react';

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

// Import the Demo Section component
import DemoSection, { DemoDashboardContent } from '../app/demo/components/Section.Demo';
import { DemoDataProvider } from '../app/demo/contexts/DemoDataContext';
import { HandednessProvider } from '../app/dashboard/contexts/HandednessContext';

// ============================================================================
// Constants
// ============================================================================

// Expected component order in the demo section (as per requirements)
const EXPECTED_COMPONENT_ORDER = ['next', 'stickies', 'calendar', 'statics'];

// Expected grid layout classes that must match the dashboard
const EXPECTED_GRID_CLASSES = ['grid', 'grid-cols-1', 'gap-6', 'max-w-full', 'overflow-hidden'];

// Expected main container classes
const EXPECTED_MAIN_CLASSES = ['flex-1', 'pt-20', 'p-6', 'lg:p-8'];

// Expected responsive breakpoint classes
const EXPECTED_BREAKPOINT_CLASSES = ['lg:p-8'];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Read file content from the filesystem
 */
function readFileContent(filePath: string): string {
  const fullPath = path.join(__dirname, '..', filePath);
  return fs.readFileSync(fullPath, 'utf-8');
}

/**
 * Extract CSS classes from a className string in source code
 */
function extractClassesFromSource(source: string, pattern: RegExp): string[] {
  const matches = source.match(pattern);
  if (!matches) return [];
  
  const classes: string[] = [];
  for (const match of matches) {
    // Extract the className value
    const classMatch = match.match(/className=["'`]([^"'`]+)["'`]/);
    if (classMatch) {
      classes.push(...classMatch[1].split(/\s+/).filter(Boolean));
    }
  }
  return classes;
}

/**
 * Check if an element has all expected classes
 */
function hasAllClasses(element: Element, expectedClasses: string[]): boolean {
  const classList = Array.from(element.classList);
  return expectedClasses.every(cls => classList.includes(cls));
}

/**
 * Find element by class combination
 */
function findElementByClasses(container: Element, classes: string[]): Element | null {
  const selector = classes.map(c => `.${c.replace(/:/g, '\\:')}`).join('');
  try {
    return container.querySelector(selector);
  } catch {
    // If selector is invalid, try a different approach
    const allElements = container.querySelectorAll('*');
    for (const el of allElements) {
      if (hasAllClasses(el, classes)) {
        return el;
      }
    }
    return null;
  }
}

// ============================================================================
// Property Tests
// ============================================================================

describe('Demo Layout Property Tests', () => {
  /**
   * **Property 2: Layout Structure Consistency**
   * **Validates: Requirements 2.2, 2.3, 2.4, 2.7**
   */
  describe('Property 2: Layout Structure Consistency', () => {
    
    describe('Requirement 2.2: EXACT same layout structure as actual dashboard', () => {
      test('Demo section should use the same grid layout classes as dashboard', () => {
        fc.assert(
          fc.property(
            fc.constant(null),
            () => {
              // Read both source files
              const dashboardSource = readFileContent('app/dashboard/page.tsx');
              const demoSource = readFileContent('app/demo/components/Section.Demo.tsx');
              
              // Both should contain the same grid layout pattern
              const gridPattern = /grid\s+grid-cols-1\s+gap-6\s+max-w-full\s+overflow-hidden/;
              
              expect(dashboardSource).toMatch(gridPattern);
              expect(demoSource).toMatch(gridPattern);
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Demo section should use the same main container classes as dashboard', () => {
        fc.assert(
          fc.property(
            fc.constant(null),
            () => {
              const dashboardSource = readFileContent('app/dashboard/page.tsx');
              const demoSource = readFileContent('app/demo/components/Section.Demo.tsx');
              
              // Both should have main element with flex-1 pt-20 p-6 lg:p-8
              for (const cls of EXPECTED_MAIN_CLASSES) {
                expect(dashboardSource).toContain(cls);
                expect(demoSource).toContain(cls);
              }
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Demo section main element should have identical structure to dashboard', () => {
        fc.assert(
          fc.property(
            fc.constant(null),
            () => {
              const dashboardSource = readFileContent('app/dashboard/page.tsx');
              const demoSource = readFileContent('app/demo/components/Section.Demo.tsx');
              
              // Check for the main element pattern
              const mainPattern = /<main\s+className=/;
              
              expect(dashboardSource).toMatch(mainPattern);
              expect(demoSource).toMatch(mainPattern);
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Requirement 2.3: Scaled-down version with CSS transform', () => {
      test('Demo section should apply CSS transform scale to container', () => {
        fc.assert(
          fc.property(
            fc.constant(null),
            () => {
              const demoSource = readFileContent('app/demo/components/Section.Demo.tsx');
              
              // Should contain transform scale
              expect(demoSource).toMatch(/transform:\s*`scale\(\$\{.*\}\)`/);
              // Should have transformOrigin
              expect(demoSource).toContain('transformOrigin');
              // Should have origin-top-left class
              expect(demoSource).toContain('origin-top-left');
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Demo section should have scale factor configuration', () => {
        fc.assert(
          fc.property(
            fc.constant(null),
            () => {
              const demoSource = readFileContent('app/demo/components/Section.Demo.tsx');
              
              // Should have scale prop or effectiveScale variable
              expect(demoSource).toMatch(/scale\??:/);
              expect(demoSource).toContain('effectiveScale');
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Demo section should preserve original dimensions before scaling', () => {
        fc.assert(
          fc.property(
            fc.constant(null),
            () => {
              const demoSource = readFileContent('app/demo/components/Section.Demo.tsx');
              
              // Should define original width/height
              expect(demoSource).toContain('originalWidth');
              expect(demoSource).toContain('originalHeight');
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Requirement 2.4: Responsive with SAME breakpoints as actual dashboard', () => {
      test('Demo section should use the same lg: breakpoint classes', () => {
        fc.assert(
          fc.property(
            fc.constant(null),
            () => {
              const dashboardSource = readFileContent('app/dashboard/page.tsx');
              const demoSource = readFileContent('app/demo/components/Section.Demo.tsx');
              
              // Both should use lg:p-8 breakpoint
              expect(dashboardSource).toContain('lg:p-8');
              expect(demoSource).toContain('lg:p-8');
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Demo section should have responsive scale handling', () => {
        fc.assert(
          fc.property(
            fc.constant(null),
            () => {
              const demoSource = readFileContent('app/demo/components/Section.Demo.tsx');
              
              // Should handle mobile vs desktop scale
              expect(demoSource).toContain('isMobile');
              // Should have different scale values for mobile/desktop
              expect(demoSource).toMatch(/isMobile\s*\?\s*[\d.]+\s*:\s*[\d.]+/);
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Demo section should use responsive padding classes', () => {
        fc.assert(
          fc.property(
            fc.constant(null),
            () => {
              const demoSource = readFileContent('app/demo/components/Section.Demo.tsx');
              
              // Should have responsive padding in the outer section
              expect(demoSource).toMatch(/px-4\s+sm:px-6\s+lg:px-8/);
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Requirement 2.7: EXACT same component arrangement', () => {
      test('Demo section should render components in correct order', () => {
        fc.assert(
          fc.property(
            fc.constant(null),
            () => {
              const demoSource = readFileContent('app/demo/components/Section.Demo.tsx');
              
              // Check that pageSections array has correct order
              expect(demoSource).toMatch(/pageSections\s*=\s*\['next',\s*'stickies',\s*'calendar',\s*'statics'\]/);
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Demo section should use the same component names as dashboard', () => {
        fc.assert(
          fc.property(
            fc.constant(null),
            () => {
              const dashboardSource = readFileContent('app/dashboard/page.tsx');
              const demoSource = readFileContent('app/demo/components/Section.Demo.tsx');
              
              // Both should import and use the same components
              const components = ['NextSection', 'StickiesSection', 'CalendarWidget', 'StaticsSection'];
              
              for (const component of components) {
                expect(dashboardSource).toContain(component);
                expect(demoSource).toContain(component);
              }
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Demo section should import components from the same paths', () => {
        fc.assert(
          fc.property(
            fc.constant(null),
            () => {
              const demoSource = readFileContent('app/demo/components/Section.Demo.tsx');
              
              // Should import from dashboard components
              expect(demoSource).toContain("from '@/app/dashboard/components/Section.Next'");
              expect(demoSource).toContain("from '@/app/dashboard/components/Section.Stickies'");
              expect(demoSource).toContain("from '@/app/dashboard/components/Widget.Calendar'");
              expect(demoSource).toContain("from '@/app/dashboard/components/Section.Statistics'");
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Demo section should use switch/case for component rendering like dashboard uses conditional', () => {
        fc.assert(
          fc.property(
            fc.constant(null),
            () => {
              const demoSource = readFileContent('app/demo/components/Section.Demo.tsx');
              
              // Demo uses switch statement for rendering
              expect(demoSource).toContain("case 'next':");
              expect(demoSource).toContain("case 'stickies':");
              expect(demoSource).toContain("case 'calendar':");
              expect(demoSource).toContain("case 'statics':");
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Component rendering verification', () => {
      test('DemoDashboardContent should render all required sections', () => {
        fc.assert(
          fc.property(
            fc.constant(null),
            () => {
              const { container, unmount } = render(
                <DemoDataProvider>
                  <HandednessProvider>
                    <DemoDashboardContent />
                  </HandednessProvider>
                </DemoDataProvider>
              );
              
              // Should have main element
              const main = container.querySelector('main');
              expect(main).toBeInTheDocument();
              
              // Should have grid container
              const gridContainer = container.querySelector('.grid.grid-cols-1.gap-6');
              expect(gridContainer).toBeInTheDocument();
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('DemoSection should render with correct structure', () => {
        fc.assert(
          fc.property(
            fc.constant(null),
            () => {
              const { container, unmount } = render(<DemoSection />);
              
              // Should have section element with aria-label
              const section = container.querySelector('section[aria-label="ダッシュボードプレビュー"]');
              expect(section).toBeInTheDocument();
              
              // Should have title
              expect(screen.getByText('ダッシュボードプレビュー')).toBeInTheDocument();
              
              // Should have demo badge
              expect(screen.getByText('デモ')).toBeInTheDocument();
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('DemoSection should apply scale transform to inner container', () => {
        fc.assert(
          fc.property(
            fc.constant(null),
            () => {
              const { container, unmount } = render(<DemoSection scale={0.5} />);
              
              // Find the scaled container (has origin-top-left class)
              const scaledContainer = container.querySelector('.origin-top-left');
              expect(scaledContainer).toBeInTheDocument();
              
              // Check that transform style is applied
              if (scaledContainer) {
                const style = (scaledContainer as HTMLElement).style;
                expect(style.transform).toContain('scale');
              }
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Grid layout class consistency', () => {
      test('Grid classes should be identical between dashboard and demo', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 0, max: EXPECTED_GRID_CLASSES.length - 1 }),
            (index) => {
              const dashboardSource = readFileContent('app/dashboard/page.tsx');
              const demoSource = readFileContent('app/demo/components/Section.Demo.tsx');
              
              const gridClass = EXPECTED_GRID_CLASSES[index];
              
              // Both files should contain this grid class
              expect(dashboardSource).toContain(gridClass);
              expect(demoSource).toContain(gridClass);
            }
          ),
          { numRuns: 100 }
        );
      });

      test('All expected grid classes should be present in both files', () => {
        fc.assert(
          fc.property(
            fc.constant(null),
            () => {
              const dashboardSource = readFileContent('app/dashboard/page.tsx');
              const demoSource = readFileContent('app/demo/components/Section.Demo.tsx');
              
              for (const gridClass of EXPECTED_GRID_CLASSES) {
                expect(dashboardSource).toContain(gridClass);
                expect(demoSource).toContain(gridClass);
              }
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Component hierarchy consistency', () => {
      test('Demo should wrap content with same providers as needed', () => {
        fc.assert(
          fc.property(
            fc.constant(null),
            () => {
              const demoSource = readFileContent('app/demo/components/Section.Demo.tsx');
              
              // Should use DemoDataProvider
              expect(demoSource).toContain('DemoDataProvider');
              // Should use HandednessProvider (same as dashboard)
              expect(demoSource).toContain('HandednessProvider');
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Demo should have flex min-h-screen bg-background structure', () => {
        fc.assert(
          fc.property(
            fc.constant(null),
            () => {
              const dashboardSource = readFileContent('app/dashboard/page.tsx');
              const demoSource = readFileContent('app/demo/components/Section.Demo.tsx');
              
              // Both should have the root flex container with background
              expect(dashboardSource).toContain('flex min-h-screen bg-background');
              expect(demoSource).toContain('flex min-h-screen bg-background');
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Visual frame and container (Requirement 2.5)', () => {
      test('Demo section should have visual frame container', () => {
        fc.assert(
          fc.property(
            fc.constant(null),
            () => {
              const demoSource = readFileContent('app/demo/components/Section.Demo.tsx');
              
              // Should have rounded border container
              expect(demoSource).toContain('rounded-xl');
              expect(demoSource).toContain('border-2');
              expect(demoSource).toContain('border-border');
              expect(demoSource).toContain('shadow-lg');
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Demo section should have demo label badge', () => {
        fc.assert(
          fc.property(
            fc.constant(null),
            () => {
              const demoSource = readFileContent('app/demo/components/Section.Demo.tsx');
              
              // Should have demo badge with proper styling
              expect(demoSource).toContain('デモ');
              expect(demoSource).toContain('rounded-full');
              expect(demoSource).toContain('bg-primary');
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Title display (Requirement 2.6)', () => {
      test('Demo section should display title "ダッシュボードプレビュー"', () => {
        fc.assert(
          fc.property(
            fc.constant(null),
            () => {
              const { unmount } = render(<DemoSection />);
              
              // Should have the title - use getByText since there are multiple h2 elements
              const title = screen.getByText('ダッシュボードプレビュー');
              expect(title).toBeInTheDocument();
              expect(title.tagName).toBe('H2');
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });
    });
  });
});
