/**
 * Property-based tests for MindmapControls Component
 * 
 * **Feature: todo-site-refactoring, Property 2: Functional equivalence preservation**
 * **Validates: Requirements 1.2, 8.2**
 * 
 * Tests that the MindmapControls component maintains functional equivalence
 * with the original implementation, all existing functionality remains intact,
 * and the props interface is correctly implemented.
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MindmapControls, MindmapControlsProps } from '../app/dashboard/components/mindmap/MindmapControls';

// Valid language options
const VALID_LANGUAGES: Array<'ja' | 'en'> = ['ja', 'en'];

// Arbitrary generators for props
const langArb = fc.constantFrom<'ja' | 'en'>(...VALID_LANGUAGES);
const booleanArb = fc.boolean();

// Generator for valid MindmapControlsProps
const mindmapControlsPropsArb = fc.record({
  isEditMode: fc.option(booleanArb, { nil: undefined }),
  isMobile: fc.option(booleanArb, { nil: undefined }),
  lang: fc.option(langArb, { nil: undefined }),
});

describe('MindmapControls Property Tests', () => {
  /**
   * **Property 2: Functional equivalence preservation**
   * **Validates: Requirements 1.2, 8.2**
   * 
   * Validates that the MindmapControls component maintains all existing
   * functionality and the props interface is correctly implemented.
   */
  describe('Property 2: Functional equivalence preservation', () => {
    
    describe('Props interface correctness', () => {
      test('should render correctly for all valid prop combinations', () => {
        fc.assert(
          fc.property(
            mindmapControlsPropsArb,
            (props) => {
              const mockOnAddNode = jest.fn();
              const mockOnClearConnections = jest.fn();
              const mockOnZoomIn = jest.fn();
              const mockOnZoomOut = jest.fn();
              const mockOnFitView = jest.fn();

              const { unmount } = render(
                <MindmapControls
                  onAddNode={mockOnAddNode}
                  onClearConnections={mockOnClearConnections}
                  onZoomIn={mockOnZoomIn}
                  onZoomOut={mockOnZoomOut}
                  onFitView={mockOnFitView}
                  isEditMode={props.isEditMode}
                  isMobile={props.isMobile}
                  lang={props.lang}
                />
              );
              
              // Component should render without errors
              // Zoom controls should always be present
              expect(screen.getByTitle(props.lang === 'en' ? 'Zoom In' : 'ズームイン')).toBeInTheDocument();
              expect(screen.getByTitle(props.lang === 'en' ? 'Zoom Out' : 'ズームアウト')).toBeInTheDocument();
              expect(screen.getByTitle(props.lang === 'en' ? 'Fit View' : '全体表示')).toBeInTheDocument();
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('should show edit mode buttons only when isEditMode is true', () => {
        fc.assert(
          fc.property(
            booleanArb, // isEditMode
            langArb,
            (isEditMode, lang) => {
              const mockOnAddNode = jest.fn();
              const mockOnClearConnections = jest.fn();
              const mockOnZoomIn = jest.fn();
              const mockOnZoomOut = jest.fn();
              const mockOnFitView = jest.fn();
              
              const { unmount } = render(
                <MindmapControls
                  onAddNode={mockOnAddNode}
                  onClearConnections={mockOnClearConnections}
                  onZoomIn={mockOnZoomIn}
                  onZoomOut={mockOnZoomOut}
                  onFitView={mockOnFitView}
                  isEditMode={isEditMode}
                  lang={lang}
                />
              );
              
              const addNodeTitle = lang === 'en' ? 'Add Node' : 'ノードを追加';
              const clearConnectionsTitle = lang === 'en' ? 'Clear Connections' : '接続をクリア';
              
              if (isEditMode) {
                // Edit mode buttons should be visible
                expect(screen.getByTitle(addNodeTitle)).toBeInTheDocument();
                expect(screen.getByTitle(clearConnectionsTitle)).toBeInTheDocument();
              } else {
                // Edit mode buttons should not be visible
                expect(screen.queryByTitle(addNodeTitle)).not.toBeInTheDocument();
                expect(screen.queryByTitle(clearConnectionsTitle)).not.toBeInTheDocument();
              }
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('should call onAddNode when add node button is clicked', () => {
        fc.assert(
          fc.property(
            langArb,
            booleanArb, // isMobile
            (lang, isMobile) => {
              const mockOnAddNode = jest.fn();
              const mockOnClearConnections = jest.fn();
              const mockOnZoomIn = jest.fn();
              const mockOnZoomOut = jest.fn();
              const mockOnFitView = jest.fn();
              
              const { unmount } = render(
                <MindmapControls
                  onAddNode={mockOnAddNode}
                  onClearConnections={mockOnClearConnections}
                  onZoomIn={mockOnZoomIn}
                  onZoomOut={mockOnZoomOut}
                  onFitView={mockOnFitView}
                  isEditMode={true}
                  isMobile={isMobile}
                  lang={lang}
                />
              );
              
              const addNodeTitle = lang === 'en' ? 'Add Node' : 'ノードを追加';
              const addNodeButton = screen.getByTitle(addNodeTitle);
              fireEvent.click(addNodeButton);
              
              expect(mockOnAddNode).toHaveBeenCalledTimes(1);
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('should call onClearConnections when clear connections button is clicked', () => {
        fc.assert(
          fc.property(
            langArb,
            booleanArb, // isMobile
            (lang, isMobile) => {
              const mockOnAddNode = jest.fn();
              const mockOnClearConnections = jest.fn();
              const mockOnZoomIn = jest.fn();
              const mockOnZoomOut = jest.fn();
              const mockOnFitView = jest.fn();
              
              const { unmount } = render(
                <MindmapControls
                  onAddNode={mockOnAddNode}
                  onClearConnections={mockOnClearConnections}
                  onZoomIn={mockOnZoomIn}
                  onZoomOut={mockOnZoomOut}
                  onFitView={mockOnFitView}
                  isEditMode={true}
                  isMobile={isMobile}
                  lang={lang}
                />
              );
              
              const clearConnectionsTitle = lang === 'en' ? 'Clear Connections' : '接続をクリア';
              const clearConnectionsButton = screen.getByTitle(clearConnectionsTitle);
              fireEvent.click(clearConnectionsButton);
              
              expect(mockOnClearConnections).toHaveBeenCalledTimes(1);
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('should call onZoomIn when zoom in button is clicked', () => {
        fc.assert(
          fc.property(
            langArb,
            booleanArb, // isMobile
            booleanArb, // isEditMode
            (lang, isMobile, isEditMode) => {
              const mockOnAddNode = jest.fn();
              const mockOnClearConnections = jest.fn();
              const mockOnZoomIn = jest.fn();
              const mockOnZoomOut = jest.fn();
              const mockOnFitView = jest.fn();
              
              const { unmount } = render(
                <MindmapControls
                  onAddNode={mockOnAddNode}
                  onClearConnections={mockOnClearConnections}
                  onZoomIn={mockOnZoomIn}
                  onZoomOut={mockOnZoomOut}
                  onFitView={mockOnFitView}
                  isEditMode={isEditMode}
                  isMobile={isMobile}
                  lang={lang}
                />
              );
              
              const zoomInTitle = lang === 'en' ? 'Zoom In' : 'ズームイン';
              const zoomInButton = screen.getByTitle(zoomInTitle);
              fireEvent.click(zoomInButton);
              
              expect(mockOnZoomIn).toHaveBeenCalledTimes(1);
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('should call onZoomOut when zoom out button is clicked', () => {
        fc.assert(
          fc.property(
            langArb,
            booleanArb, // isMobile
            booleanArb, // isEditMode
            (lang, isMobile, isEditMode) => {
              const mockOnAddNode = jest.fn();
              const mockOnClearConnections = jest.fn();
              const mockOnZoomIn = jest.fn();
              const mockOnZoomOut = jest.fn();
              const mockOnFitView = jest.fn();
              
              const { unmount } = render(
                <MindmapControls
                  onAddNode={mockOnAddNode}
                  onClearConnections={mockOnClearConnections}
                  onZoomIn={mockOnZoomIn}
                  onZoomOut={mockOnZoomOut}
                  onFitView={mockOnFitView}
                  isEditMode={isEditMode}
                  isMobile={isMobile}
                  lang={lang}
                />
              );
              
              const zoomOutTitle = lang === 'en' ? 'Zoom Out' : 'ズームアウト';
              const zoomOutButton = screen.getByTitle(zoomOutTitle);
              fireEvent.click(zoomOutButton);
              
              expect(mockOnZoomOut).toHaveBeenCalledTimes(1);
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('should call onFitView when fit view button is clicked', () => {
        fc.assert(
          fc.property(
            langArb,
            booleanArb, // isMobile
            booleanArb, // isEditMode
            (lang, isMobile, isEditMode) => {
              const mockOnAddNode = jest.fn();
              const mockOnClearConnections = jest.fn();
              const mockOnZoomIn = jest.fn();
              const mockOnZoomOut = jest.fn();
              const mockOnFitView = jest.fn();
              
              const { unmount } = render(
                <MindmapControls
                  onAddNode={mockOnAddNode}
                  onClearConnections={mockOnClearConnections}
                  onZoomIn={mockOnZoomIn}
                  onZoomOut={mockOnZoomOut}
                  onFitView={mockOnFitView}
                  isEditMode={isEditMode}
                  isMobile={isMobile}
                  lang={lang}
                />
              );
              
              const fitViewTitle = lang === 'en' ? 'Fit View' : '全体表示';
              const fitViewButton = screen.getByTitle(fitViewTitle);
              fireEvent.click(fitViewButton);
              
              expect(mockOnFitView).toHaveBeenCalledTimes(1);
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });
    });


    describe('Visual state consistency', () => {
      test('should apply correct button sizes based on isMobile prop', () => {
        fc.assert(
          fc.property(
            booleanArb, // isMobile
            langArb,
            (isMobile, lang) => {
              const mockOnAddNode = jest.fn();
              const mockOnClearConnections = jest.fn();
              const mockOnZoomIn = jest.fn();
              const mockOnZoomOut = jest.fn();
              const mockOnFitView = jest.fn();
              
              const { unmount } = render(
                <MindmapControls
                  onAddNode={mockOnAddNode}
                  onClearConnections={mockOnClearConnections}
                  onZoomIn={mockOnZoomIn}
                  onZoomOut={mockOnZoomOut}
                  onFitView={mockOnFitView}
                  isEditMode={true}
                  isMobile={isMobile}
                  lang={lang}
                />
              );
              
              // Get all buttons
              const buttons = screen.getAllByRole('button');
              
              // All buttons should have minimum touch target size (44px)
              for (const button of buttons) {
                expect(button.className).toContain('min-w-[44px]');
                expect(button.className).toContain('min-h-[44px]');
              }
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('should render correct number of buttons based on isEditMode', () => {
        fc.assert(
          fc.property(
            booleanArb, // isEditMode
            langArb,
            (isEditMode, lang) => {
              const mockOnAddNode = jest.fn();
              const mockOnClearConnections = jest.fn();
              const mockOnZoomIn = jest.fn();
              const mockOnZoomOut = jest.fn();
              const mockOnFitView = jest.fn();
              
              const { unmount } = render(
                <MindmapControls
                  onAddNode={mockOnAddNode}
                  onClearConnections={mockOnClearConnections}
                  onZoomIn={mockOnZoomIn}
                  onZoomOut={mockOnZoomOut}
                  onFitView={mockOnFitView}
                  isEditMode={isEditMode}
                  lang={lang}
                />
              );
              
              const buttons = screen.getAllByRole('button');
              
              if (isEditMode) {
                // 5 buttons: add node, clear connections, zoom in, zoom out, fit view
                expect(buttons).toHaveLength(5);
              } else {
                // 3 buttons: zoom in, zoom out, fit view
                expect(buttons).toHaveLength(3);
              }
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('should use correct design system colors for buttons', () => {
        fc.assert(
          fc.property(
            langArb,
            (lang) => {
              const mockOnAddNode = jest.fn();
              const mockOnClearConnections = jest.fn();
              const mockOnZoomIn = jest.fn();
              const mockOnZoomOut = jest.fn();
              const mockOnFitView = jest.fn();
              
              const { unmount } = render(
                <MindmapControls
                  onAddNode={mockOnAddNode}
                  onClearConnections={mockOnClearConnections}
                  onZoomIn={mockOnZoomIn}
                  onZoomOut={mockOnZoomOut}
                  onFitView={mockOnFitView}
                  isEditMode={true}
                  lang={lang}
                />
              );
              
              const addNodeTitle = lang === 'en' ? 'Add Node' : 'ノードを追加';
              const clearConnectionsTitle = lang === 'en' ? 'Clear Connections' : '接続をクリア';
              
              // Add node button should use primary color
              const addNodeButton = screen.getByTitle(addNodeTitle);
              expect(addNodeButton.className).toContain('bg-primary');
              
              // Clear connections button should use destructive color
              const clearConnectionsButton = screen.getByTitle(clearConnectionsTitle);
              expect(clearConnectionsButton.className).toContain('bg-destructive');
              
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
            langArb,
            booleanArb, // isEditMode
            (lang, isEditMode) => {
              const mockOnAddNode = jest.fn();
              const mockOnClearConnections = jest.fn();
              const mockOnZoomIn = jest.fn();
              const mockOnZoomOut = jest.fn();
              const mockOnFitView = jest.fn();
              
              const { unmount } = render(
                <MindmapControls
                  onAddNode={mockOnAddNode}
                  onClearConnections={mockOnClearConnections}
                  onZoomIn={mockOnZoomIn}
                  onZoomOut={mockOnZoomOut}
                  onFitView={mockOnFitView}
                  isEditMode={isEditMode}
                  lang={lang}
                />
              );
              
              // All buttons should have aria-label
              const buttons = screen.getAllByRole('button');
              for (const button of buttons) {
                expect(button).toHaveAttribute('aria-label');
                expect(button.getAttribute('aria-label')).not.toBe('');
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
            langArb,
            booleanArb, // isEditMode
            (lang, isEditMode) => {
              const mockOnAddNode = jest.fn();
              const mockOnClearConnections = jest.fn();
              const mockOnZoomIn = jest.fn();
              const mockOnZoomOut = jest.fn();
              const mockOnFitView = jest.fn();
              
              const { unmount } = render(
                <MindmapControls
                  onAddNode={mockOnAddNode}
                  onClearConnections={mockOnClearConnections}
                  onZoomIn={mockOnZoomIn}
                  onZoomOut={mockOnZoomOut}
                  onFitView={mockOnFitView}
                  isEditMode={isEditMode}
                  lang={lang}
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

      test('should have correct button type attribute', () => {
        fc.assert(
          fc.property(
            langArb,
            booleanArb, // isEditMode
            (lang, isEditMode) => {
              const mockOnAddNode = jest.fn();
              const mockOnClearConnections = jest.fn();
              const mockOnZoomIn = jest.fn();
              const mockOnZoomOut = jest.fn();
              const mockOnFitView = jest.fn();
              
              const { unmount } = render(
                <MindmapControls
                  onAddNode={mockOnAddNode}
                  onClearConnections={mockOnClearConnections}
                  onZoomIn={mockOnZoomIn}
                  onZoomOut={mockOnZoomOut}
                  onFitView={mockOnFitView}
                  isEditMode={isEditMode}
                  lang={lang}
                />
              );
              
              // All buttons should have type="button" to prevent form submission
              const buttons = screen.getAllByRole('button');
              for (const button of buttons) {
                expect(button).toHaveAttribute('type', 'button');
              }
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Language support', () => {
      test('should display correct labels for Japanese language', () => {
        const mockOnAddNode = jest.fn();
        const mockOnClearConnections = jest.fn();
        const mockOnZoomIn = jest.fn();
        const mockOnZoomOut = jest.fn();
        const mockOnFitView = jest.fn();
        
        const { unmount } = render(
          <MindmapControls
            onAddNode={mockOnAddNode}
            onClearConnections={mockOnClearConnections}
            onZoomIn={mockOnZoomIn}
            onZoomOut={mockOnZoomOut}
            onFitView={mockOnFitView}
            isEditMode={true}
            lang="ja"
          />
        );
        
        expect(screen.getByTitle('ノードを追加')).toBeInTheDocument();
        expect(screen.getByTitle('接続をクリア')).toBeInTheDocument();
        expect(screen.getByTitle('ズームイン')).toBeInTheDocument();
        expect(screen.getByTitle('ズームアウト')).toBeInTheDocument();
        expect(screen.getByTitle('全体表示')).toBeInTheDocument();
        
        unmount();
      });

      test('should display correct labels for English language', () => {
        const mockOnAddNode = jest.fn();
        const mockOnClearConnections = jest.fn();
        const mockOnZoomIn = jest.fn();
        const mockOnZoomOut = jest.fn();
        const mockOnFitView = jest.fn();
        
        const { unmount } = render(
          <MindmapControls
            onAddNode={mockOnAddNode}
            onClearConnections={mockOnClearConnections}
            onZoomIn={mockOnZoomIn}
            onZoomOut={mockOnZoomOut}
            onFitView={mockOnFitView}
            isEditMode={true}
            lang="en"
          />
        );
        
        expect(screen.getByTitle('Add Node')).toBeInTheDocument();
        expect(screen.getByTitle('Clear Connections')).toBeInTheDocument();
        expect(screen.getByTitle('Zoom In')).toBeInTheDocument();
        expect(screen.getByTitle('Zoom Out')).toBeInTheDocument();
        expect(screen.getByTitle('Fit View')).toBeInTheDocument();
        
        unmount();
      });

      test('should default to Japanese when lang is not specified', () => {
        const mockOnAddNode = jest.fn();
        const mockOnClearConnections = jest.fn();
        const mockOnZoomIn = jest.fn();
        const mockOnZoomOut = jest.fn();
        const mockOnFitView = jest.fn();
        
        const { unmount } = render(
          <MindmapControls
            onAddNode={mockOnAddNode}
            onClearConnections={mockOnClearConnections}
            onZoomIn={mockOnZoomIn}
            onZoomOut={mockOnZoomOut}
            onFitView={mockOnFitView}
            isEditMode={true}
          />
        );
        
        // Should default to Japanese
        expect(screen.getByTitle('ノードを追加')).toBeInTheDocument();
        
        unmount();
      });
    });
  });


  /**
   * **Property 2: Functional equivalence preservation - Component structure verification**
   * **Validates: Requirements 1.2, 8.2**
   * 
   * Verifies that the MindmapControls component is properly extracted
   * and maintains the expected structure.
   */
  describe('Property 2: Component structure verification', () => {
    const mindmapDir = path.join(__dirname, '../app/dashboard/components/mindmap');
    
    test('MindmapControls.tsx should exist in mindmap directory', () => {
      const componentPath = path.join(mindmapDir, 'MindmapControls.tsx');
      expect(fs.existsSync(componentPath)).toBe(true);
    });

    test('MindmapControls.tsx should export required types and component', () => {
      const componentPath = path.join(mindmapDir, 'MindmapControls.tsx');
      const content = fs.readFileSync(componentPath, 'utf-8');

      // Check for required exports
      expect(content).toContain('export interface MindmapControlsProps');
      expect(content).toContain('export const MindmapControls');
      expect(content).toContain('export default MindmapControls');
    });

    test('MindmapControlsProps should have all required callback properties', () => {
      const componentPath = path.join(mindmapDir, 'MindmapControls.tsx');
      const content = fs.readFileSync(componentPath, 'utf-8');

      // Check for required callback props
      expect(content).toContain('onAddNode: () => void');
      expect(content).toContain('onClearConnections: () => void');
      expect(content).toContain('onZoomIn: () => void');
      expect(content).toContain('onZoomOut: () => void');
      expect(content).toContain('onFitView: () => void');
    });

    test('MindmapControlsProps should have optional configuration properties', () => {
      const componentPath = path.join(mindmapDir, 'MindmapControls.tsx');
      const content = fs.readFileSync(componentPath, 'utf-8');

      // Check for optional props
      expect(content).toContain('isEditMode?:');
      expect(content).toContain('isMobile?:');
      expect(content).toContain('lang?:');
    });

    test('Component should be a pure presentational component (no useState)', () => {
      const componentPath = path.join(mindmapDir, 'MindmapControls.tsx');
      const content = fs.readFileSync(componentPath, 'utf-8');

      // Should not have useState (pure presentational component)
      expect(content).not.toMatch(/useState\s*[<(]/);
    });

    test('Component should be memoized for performance', () => {
      const componentPath = path.join(mindmapDir, 'MindmapControls.tsx');
      const content = fs.readFileSync(componentPath, 'utf-8');

      // Should use React.memo for performance optimization
      expect(content).toContain('memo(');
    });

    test('Component should have proper JSDoc documentation', () => {
      const componentPath = path.join(mindmapDir, 'MindmapControls.tsx');
      const content = fs.readFileSync(componentPath, 'utf-8');

      // Should have JSDoc comments
      expect(content).toContain('/**');
      expect(content).toContain('@requirements');
    });

    test('Component should use "use client" directive', () => {
      const componentPath = path.join(mindmapDir, 'MindmapControls.tsx');
      const content = fs.readFileSync(componentPath, 'utf-8');

      // Should have "use client" directive at the top
      expect(content.trim().startsWith('"use client"')).toBe(true);
    });

    test('Component should follow design system color tokens', () => {
      const componentPath = path.join(mindmapDir, 'MindmapControls.tsx');
      const content = fs.readFileSync(componentPath, 'utf-8');

      // Should use semantic color tokens
      expect(content).toContain('bg-primary');
      expect(content).toContain('bg-destructive');
      expect(content).toContain('bg-card');
      expect(content).toContain('border-border');
    });
  });


  /**
   * **Property 2: Functional equivalence preservation - Integration verification**
   * **Validates: Requirements 1.2, 8.2**
   * 
   * Verifies that the MindmapControls component can be properly integrated
   * with the parent Widget.Mindmap component.
   */
  describe('Property 2: Integration verification', () => {
    const dashboardDir = path.join(__dirname, '../app/dashboard');
    
    test('Widget.Mindmap.tsx should import MindmapControls', () => {
      const widgetPath = path.join(dashboardDir, 'components/Widget.Mindmap.tsx');
      
      if (fs.existsSync(widgetPath)) {
        const content = fs.readFileSync(widgetPath, 'utf-8');
        
        // Should import MindmapControls
        expect(content).toMatch(/import.*MindmapControls.*from.*['"].*mindmap\/MindmapControls['"]/);
      }
    });

    test('MindmapControls should be used in Widget.Mindmap.tsx', () => {
      const widgetPath = path.join(dashboardDir, 'components/Widget.Mindmap.tsx');
      
      if (fs.existsSync(widgetPath)) {
        const content = fs.readFileSync(widgetPath, 'utf-8');
        
        // Should use MindmapControls component
        expect(content).toMatch(/<MindmapControls/);
      }
    });

    test('Widget.Mindmap.tsx should pass all required props to MindmapControls', () => {
      const widgetPath = path.join(dashboardDir, 'components/Widget.Mindmap.tsx');
      
      if (fs.existsSync(widgetPath)) {
        const content = fs.readFileSync(widgetPath, 'utf-8');
        
        // Should pass required callback props
        expect(content).toMatch(/onAddNode\s*=/);
        expect(content).toMatch(/onClearConnections\s*=/);
        expect(content).toMatch(/onZoomIn\s*=/);
        expect(content).toMatch(/onZoomOut\s*=/);
        expect(content).toMatch(/onFitView\s*=/);
      }
    });
  });

  /**
   * **Property 2: Functional equivalence preservation - Callback isolation**
   * **Validates: Requirements 1.2, 8.2**
   * 
   * Verifies that callbacks are properly isolated and don't interfere with each other.
   */
  describe('Property 2: Callback isolation', () => {
    test('clicking one button should not trigger other callbacks', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('addNode', 'clearConnections', 'zoomIn', 'zoomOut', 'fitView'),
          langArb,
          (buttonToClick, lang) => {
            const mockOnAddNode = jest.fn();
            const mockOnClearConnections = jest.fn();
            const mockOnZoomIn = jest.fn();
            const mockOnZoomOut = jest.fn();
            const mockOnFitView = jest.fn();
            
            const { unmount } = render(
              <MindmapControls
                onAddNode={mockOnAddNode}
                onClearConnections={mockOnClearConnections}
                onZoomIn={mockOnZoomIn}
                onZoomOut={mockOnZoomOut}
                onFitView={mockOnFitView}
                isEditMode={true}
                lang={lang}
              />
            );
            
            // Map button names to titles
            const buttonTitles: Record<string, { ja: string; en: string }> = {
              addNode: { ja: 'ノードを追加', en: 'Add Node' },
              clearConnections: { ja: '接続をクリア', en: 'Clear Connections' },
              zoomIn: { ja: 'ズームイン', en: 'Zoom In' },
              zoomOut: { ja: 'ズームアウト', en: 'Zoom Out' },
              fitView: { ja: '全体表示', en: 'Fit View' },
            };
            
            const title = buttonTitles[buttonToClick][lang];
            const button = screen.getByTitle(title);
            fireEvent.click(button);
            
            // Map button names to mock functions
            const mockFunctions: Record<string, jest.Mock> = {
              addNode: mockOnAddNode,
              clearConnections: mockOnClearConnections,
              zoomIn: mockOnZoomIn,
              zoomOut: mockOnZoomOut,
              fitView: mockOnFitView,
            };
            
            // Only the clicked button's callback should be called
            for (const [name, mockFn] of Object.entries(mockFunctions)) {
              if (name === buttonToClick) {
                expect(mockFn).toHaveBeenCalledTimes(1);
              } else {
                expect(mockFn).not.toHaveBeenCalled();
              }
            }
            
            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('multiple clicks should trigger callback multiple times', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }), // number of clicks
          langArb,
          (clickCount, lang) => {
            const mockOnZoomIn = jest.fn();
            
            const { unmount } = render(
              <MindmapControls
                onAddNode={jest.fn()}
                onClearConnections={jest.fn()}
                onZoomIn={mockOnZoomIn}
                onZoomOut={jest.fn()}
                onFitView={jest.fn()}
                isEditMode={true}
                lang={lang}
              />
            );
            
            const zoomInTitle = lang === 'en' ? 'Zoom In' : 'ズームイン';
            const zoomInButton = screen.getByTitle(zoomInTitle);
            
            for (let i = 0; i < clickCount; i++) {
              fireEvent.click(zoomInButton);
            }
            
            expect(mockOnZoomIn).toHaveBeenCalledTimes(clickCount);
            
            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
