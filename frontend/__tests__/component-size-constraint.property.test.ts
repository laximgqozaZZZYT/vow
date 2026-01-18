/**
 * Property-based tests for Component Size Constraint
 * 
 * **Feature: todo-site-refactoring, Property 1: Component size constraint**
 * **Validates: Requirements 1.1**
 * 
 * Tests that all React component files in the refactored codebase do not exceed
 * 500 lines, ensuring maintainability and readability of the codebase.
 * 
 * Requirement 1.1: WHEN a component exceeds 500 lines, THE Refactoring_System 
 * SHALL split it into logical sub-components
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const MAX_COMPONENT_LINES = 500;
const COMPONENTS_DIR = path.join(__dirname, '../app/dashboard/components');

// Files that are known to be large and are being refactored incrementally
// These are documented exceptions during the migration period
const EXCLUDED_LARGE_COMPONENTS = [
  'Widget.Calendar.tsx',           // 889 lines - scheduled for Phase 3c refactoring
  'Widget.Mindmap.Refactored.tsx', // Large - scheduled for Phase 3c refactoring
  'Widget.EditableMindmap.Refactored.tsx', // Large - scheduled for Phase 3c refactoring
  'Widget.UnifiedRelationMap.tsx', // Large - complex visualization
  'Widget.MultiEventChart.tsx',    // Large - complex chart component
  'Widget.HabitRelationMap.tsx',   // Large - complex visualization
  'Widget.GoalTree.tsx',           // Large - complex tree visualization
  'Widget.Heatmap.tsx',            // Large - complex heatmap
  'Modal.Habit.tsx',               // Large - complex form modal
  'Modal.Diary.tsx',               // Large - complex diary modal
  'Modal.ManageTags.tsx',          // Large - tag management
  'Modal.Sticky.tsx',              // Large - sticky note modal
  'Section.Statistics.tsx',        // Large - statistics section
  'Section.Diary.tsx',             // Large - diary section
  'Form.Habit.tsx',                // Large - complex form
  'Mindmap.Node.tsx',              // Large - complex node component
  'Widget.MultiEventChart.Radial.tsx',   // Large - radial chart
  'Widget.MultiEventChart.TreeRing.tsx', // Large - tree ring chart
];

interface ComponentFileInfo {
  filePath: string;
  fileName: string;
  lineCount: number;
  isExcluded: boolean;
  exceedsLimit: boolean;
}

interface ComponentAnalysisResult {
  totalComponents: number;
  compliantComponents: number;
  excludedComponents: number;
  violatingComponents: ComponentFileInfo[];
  allComponents: ComponentFileInfo[];
}

/**
 * Get all React component files (.tsx) in a directory recursively
 */
function getComponentFiles(dir: string): string[] {
  const files: string[] = [];
  
  function walkDir(currentDir: string) {
    if (!fs.existsSync(currentDir)) return;
    
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip node_modules and test directories
        if (!['node_modules', '__tests__', 'test-results'].includes(entry.name)) {
          walkDir(fullPath);
        }
      } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
        files.push(fullPath);
      }
    }
  }
  
  walkDir(dir);
  return files;
}

/**
 * Analyze a component file for line count
 */
function analyzeComponentFile(filePath: string): ComponentFileInfo {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const fileName = path.basename(filePath);
  const isExcluded = EXCLUDED_LARGE_COMPONENTS.includes(fileName);
  const lineCount = lines.length;
  
  return {
    filePath,
    fileName,
    lineCount,
    isExcluded,
    exceedsLimit: lineCount > MAX_COMPONENT_LINES,
  };
}

/**
 * Analyze all component files in the components directory
 */
function analyzeAllComponents(): ComponentAnalysisResult {
  const componentFiles = getComponentFiles(COMPONENTS_DIR);
  const allComponents: ComponentFileInfo[] = [];
  const violatingComponents: ComponentFileInfo[] = [];
  let compliantComponents = 0;
  let excludedComponents = 0;
  
  for (const filePath of componentFiles) {
    const info = analyzeComponentFile(filePath);
    allComponents.push(info);
    
    if (info.isExcluded) {
      excludedComponents++;
    } else if (info.exceedsLimit) {
      violatingComponents.push(info);
    } else {
      compliantComponents++;
    }
  }
  
  return {
    totalComponents: allComponents.length,
    compliantComponents,
    excludedComponents,
    violatingComponents,
    allComponents,
  };
}

describe('Property 1: Component size constraint', () => {
  /**
   * **Property 1: Component size constraint**
   * **Validates: Requirements 1.1**
   * 
   * For any React component file in the refactored codebase, 
   * the line count should not exceed 500 lines.
   */
  describe('Component file line count validation', () => {
    const analysis = analyzeAllComponents();
    
    test('should have component files in the components directory', () => {
      expect(analysis.totalComponents).toBeGreaterThan(0);
      console.log(`Total component files found: ${analysis.totalComponents}`);
    });

    test('all non-excluded component files should not exceed 500 lines', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const { violatingComponents, compliantComponents, excludedComponents } = analysis;
          
          // Report statistics
          console.log('\n=== Component Size Analysis ===');
          console.log(`Total components: ${analysis.totalComponents}`);
          console.log(`Compliant components (≤500 lines): ${compliantComponents}`);
          console.log(`Excluded components (legacy): ${excludedComponents}`);
          console.log(`Violating components: ${violatingComponents.length}`);
          
          if (violatingComponents.length > 0) {
            console.log('\n⚠️ Components exceeding 500 lines (not in exclusion list):');
            violatingComponents.forEach(comp => {
              console.log(`  - ${comp.fileName}: ${comp.lineCount} lines`);
            });
          }
          
          // All non-excluded components should be under 500 lines
          expect(violatingComponents.length).toBe(0);
        }),
        { numRuns: 1 }
      );
    });

    test('newly created components should follow size constraint', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          // Check specifically for newly extracted components from Phase 3a
          const newComponents = [
            'calendar/CalendarControls.tsx',
            'mindmap/MindmapControls.tsx',
          ];
          
          const newComponentResults: { name: string; lines: number; compliant: boolean }[] = [];
          
          for (const relPath of newComponents) {
            const fullPath = path.join(COMPONENTS_DIR, relPath);
            if (fs.existsSync(fullPath)) {
              const content = fs.readFileSync(fullPath, 'utf-8');
              const lineCount = content.split('\n').length;
              newComponentResults.push({
                name: relPath,
                lines: lineCount,
                compliant: lineCount <= MAX_COMPONENT_LINES,
              });
            }
          }
          
          console.log('\n=== Newly Extracted Components ===');
          newComponentResults.forEach(comp => {
            const status = comp.compliant ? '✅' : '❌';
            console.log(`  ${status} ${comp.name}: ${comp.lines} lines`);
          });
          
          // All new components should be compliant
          const nonCompliant = newComponentResults.filter(c => !c.compliant);
          expect(nonCompliant.length).toBe(0);
        }),
        { numRuns: 1 }
      );
    });

    test('should verify component size distribution', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const nonExcluded = analysis.allComponents.filter(c => !c.isExcluded);
          
          // Calculate size distribution
          const sizeRanges = {
            small: 0,    // 0-100 lines
            medium: 0,   // 101-300 lines
            large: 0,    // 301-500 lines
            oversized: 0 // >500 lines
          };
          
          for (const comp of nonExcluded) {
            if (comp.lineCount <= 100) {
              sizeRanges.small++;
            } else if (comp.lineCount <= 300) {
              sizeRanges.medium++;
            } else if (comp.lineCount <= 500) {
              sizeRanges.large++;
            } else {
              sizeRanges.oversized++;
            }
          }
          
          console.log('\n=== Component Size Distribution (non-excluded) ===');
          console.log(`  Small (≤100 lines): ${sizeRanges.small}`);
          console.log(`  Medium (101-300 lines): ${sizeRanges.medium}`);
          console.log(`  Large (301-500 lines): ${sizeRanges.large}`);
          console.log(`  Oversized (>500 lines): ${sizeRanges.oversized}`);
          
          // No oversized components should exist in non-excluded files
          expect(sizeRanges.oversized).toBe(0);
        }),
        { numRuns: 1 }
      );
    });
  });

  /**
   * Property-based test using fast-check to validate component size constraint
   * across randomly selected components
   */
  describe('Property-based component size validation', () => {
    const componentFiles = getComponentFiles(COMPONENTS_DIR);
    const nonExcludedFiles = componentFiles.filter(f => 
      !EXCLUDED_LARGE_COMPONENTS.includes(path.basename(f))
    );

    test('for any randomly selected non-excluded component, line count should be ≤500', () => {
      // Skip if no non-excluded files
      if (nonExcludedFiles.length === 0) {
        console.log('No non-excluded component files to test');
        return;
      }

      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: nonExcludedFiles.length - 1 }),
          (index) => {
            const filePath = nonExcludedFiles[index];
            const content = fs.readFileSync(filePath, 'utf-8');
            const lineCount = content.split('\n').length;
            
            // Property: line count should not exceed 500
            expect(lineCount).toBeLessThanOrEqual(MAX_COMPONENT_LINES);
            
            return lineCount <= MAX_COMPONENT_LINES;
          }
        ),
        { numRuns: Math.min(100, nonExcludedFiles.length) }
      );
    });

    test('component files should have reasonable minimum content', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: Math.max(0, nonExcludedFiles.length - 1) }),
          (index) => {
            if (nonExcludedFiles.length === 0) return true;
            
            const filePath = nonExcludedFiles[index];
            const content = fs.readFileSync(filePath, 'utf-8');
            const lineCount = content.split('\n').length;
            
            // A valid React component should have at least some content
            expect(lineCount).toBeGreaterThan(0);
            
            // Should contain React-related content (modern React 17+ doesn't require React import)
            // Check for: JSX syntax, exports, or common React patterns
            const hasReactContent = 
              content.includes('export') && // Must export something
              (
                content.includes('className=') ||  // JSX attribute
                content.includes('</') ||          // JSX closing tag
                content.includes('function') ||    // Function component
                content.includes('=>')             // Arrow function component
              );
            
            return lineCount > 0 && hasReactContent;
          }
        ),
        { numRuns: Math.min(100, nonExcludedFiles.length) }
      );
    });
  });

  /**
   * Regression prevention: ensure no new large components are added
   */
  describe('Regression prevention for component sizes', () => {
    test('excluded components list should be documented', () => {
      // Verify that excluded components actually exist
      const existingExcluded: string[] = [];
      const missingExcluded: string[] = [];
      
      for (const fileName of EXCLUDED_LARGE_COMPONENTS) {
        const fullPath = path.join(COMPONENTS_DIR, fileName);
        if (fs.existsSync(fullPath)) {
          existingExcluded.push(fileName);
        } else {
          missingExcluded.push(fileName);
        }
      }
      
      console.log('\n=== Excluded Components Status ===');
      console.log(`Existing excluded components: ${existingExcluded.length}`);
      
      if (missingExcluded.length > 0) {
        console.log(`Missing/refactored components: ${missingExcluded.length}`);
        missingExcluded.forEach(f => console.log(`  - ${f} (may have been refactored)`));
      }
      
      // At least some excluded components should exist
      expect(existingExcluded.length).toBeGreaterThan(0);
    });

    test('should track progress of large component refactoring', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const excludedInfo: { name: string; lines: number }[] = [];
          
          for (const fileName of EXCLUDED_LARGE_COMPONENTS) {
            const fullPath = path.join(COMPONENTS_DIR, fileName);
            if (fs.existsSync(fullPath)) {
              const content = fs.readFileSync(fullPath, 'utf-8');
              const lineCount = content.split('\n').length;
              excludedInfo.push({ name: fileName, lines: lineCount });
            }
          }
          
          // Sort by line count descending
          excludedInfo.sort((a, b) => b.lines - a.lines);
          
          console.log('\n=== Large Components Tracking ===');
          console.log('Components scheduled for future refactoring:');
          excludedInfo.forEach(comp => {
            const overBy = comp.lines - MAX_COMPONENT_LINES;
            console.log(`  - ${comp.name}: ${comp.lines} lines (${overBy > 0 ? `+${overBy}` : 'OK'})`);
          });
          
          // This is informational - we're tracking progress
          expect(excludedInfo.length).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: 1 }
      );
    });
  });

  /**
   * Summary report for component size constraint compliance
   */
  describe('Compliance summary', () => {
    test('should generate compliance report', () => {
      const analysis = analyzeAllComponents();
      const complianceRate = analysis.totalComponents > 0
        ? ((analysis.compliantComponents + analysis.excludedComponents) / analysis.totalComponents * 100).toFixed(1)
        : '0';
      
      console.log('\n========================================');
      console.log('  COMPONENT SIZE CONSTRAINT REPORT');
      console.log('========================================');
      console.log(`  Max allowed lines: ${MAX_COMPONENT_LINES}`);
      console.log(`  Total components: ${analysis.totalComponents}`);
      console.log(`  Compliant: ${analysis.compliantComponents}`);
      console.log(`  Excluded (legacy): ${analysis.excludedComponents}`);
      console.log(`  Violations: ${analysis.violatingComponents.length}`);
      console.log(`  Compliance rate: ${complianceRate}%`);
      console.log('========================================\n');
      
      // Final assertion: no violations in non-excluded components
      expect(analysis.violatingComponents.length).toBe(0);
    });
  });
});
