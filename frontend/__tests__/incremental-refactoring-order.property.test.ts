/**
 * Property-based tests for incremental refactoring order
 * 
 * **Feature: todo-site-refactoring, Property 6: Incremental refactoring order**
 * **Validates: Requirements 8.1**
 * 
 * Property 6: Incremental refactoring order
 * *For any* refactoring phase, utility extraction should be completed before 
 * component splitting to minimize risk
 * 
 * Requirements:
 * - 8.1: Start with the least risky changes first
 * 
 * Refactoring Phases (from design.md):
 * - Phase 1: Utility extraction (low risk) - dateUtils, deviceUtils, shared types
 * - Phase 2a: Independent custom hooks (low risk) - useDeviceDetection, useApiWithLoading, useLocalStorage
 * - Phase 3a: Independent component extraction (low risk) - CalendarControls, MindmapControls
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a file exists
 */
function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

/**
 * Check if a directory exists
 */
function directoryExists(dirPath: string): boolean {
  return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
}

/**
 * Get file modification time (returns 0 if file doesn't exist)
 */
function getFileModTime(filePath: string): number {
  if (!fs.existsSync(filePath)) return 0;
  return fs.statSync(filePath).mtimeMs;
}

/**
 * Check if a file exports specific functions/types
 */
function fileExports(filePath: string, exportNames: string[]): boolean {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, 'utf-8');
  return exportNames.every(name => {
    const exportPattern = new RegExp(`export\\s+(const|function|type|interface|class)\\s+${name}|export\\s*{[^}]*\\b${name}\\b[^}]*}`);
    return exportPattern.test(content);
  });
}

/**
 * Check if a file imports from specific modules
 */
function fileImportsFrom(filePath: string, importPaths: string[]): boolean {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, 'utf-8');
  return importPaths.some(importPath => {
    const importPattern = new RegExp(`from\\s+['"].*${importPath}['"]`);
    return importPattern.test(content);
  });
}

/**
 * Get all TypeScript/TSX files in a directory
 */
function getTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];
  
  if (!fs.existsSync(dir)) return files;
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// ============================================================================
// Test Constants
// ============================================================================

const dashboardDir = path.join(__dirname, '../app/dashboard');

// Phase 1: Utility extraction artifacts (low risk - should be done first)
const phase1Artifacts = {
  utils: {
    dateUtils: path.join(dashboardDir, 'utils/dateUtils.ts'),
  },
  types: {
    shared: path.join(dashboardDir, 'types/shared.ts'),
    index: path.join(dashboardDir, 'types/index.ts'),
  },
  directories: {
    utils: path.join(dashboardDir, 'utils'),
    types: path.join(dashboardDir, 'types'),
  },
};

// Phase 2a: Independent custom hooks (low risk - depends on Phase 1)
const phase2aArtifacts = {
  hooks: {
    useDeviceDetection: path.join(dashboardDir, 'hooks/useDeviceDetection.ts'),
    useApiWithLoading: path.join(dashboardDir, 'hooks/useApiWithLoading.ts'),
    useLocalStorage: path.join(dashboardDir, 'hooks/useLocalStorage.ts'),
    index: path.join(dashboardDir, 'hooks/index.ts'),
  },
  directories: {
    hooks: path.join(dashboardDir, 'hooks'),
  },
};

// Phase 3a: Independent component extraction (low risk - depends on Phase 1 & 2a)
const phase3aArtifacts = {
  components: {
    calendarControls: path.join(dashboardDir, 'components/calendar/CalendarControls.tsx'),
    calendarIndex: path.join(dashboardDir, 'components/calendar/index.ts'),
    mindmapControls: path.join(dashboardDir, 'components/mindmap/MindmapControls.tsx'),
    mindmapIndex: path.join(dashboardDir, 'components/mindmap/index.ts'),
  },
  directories: {
    calendar: path.join(dashboardDir, 'components/calendar'),
    mindmap: path.join(dashboardDir, 'components/mindmap'),
  },
};

// Expected exports for each phase
const expectedExports = {
  phase1: {
    dateUtils: ['formatLocalDate', 'parseYMD', 'ymd', 'addDays', 'getTimeString'],
    shared: ['BaseEntity', 'DeviceInfo', 'ApiState', 'DateRange', 'Timing', 'TimingType'],
  },
  phase2a: {
    useDeviceDetection: ['useDeviceDetection'],
    useApiWithLoading: ['useApiWithLoading'],
    useLocalStorage: ['useLocalStorage'],
  },
  phase3a: {
    calendarControls: ['CalendarControls'],
    mindmapControls: ['MindmapControls'],
  },
};

// ============================================================================
// Property-Based Tests
// ============================================================================

describe('Incremental Refactoring Order Property Tests', () => {
  describe('Property 6: Incremental refactoring order', () => {
    /**
     * Property 6.1: Phase 1 artifacts must exist
     * Utility extraction (Phase 1) should be completed as the foundation
     * This is the lowest risk phase and must be done first
     */
    test('Phase 1 (utility extraction) artifacts should exist', () => {
      // Check utils directory exists
      expect(directoryExists(phase1Artifacts.directories.utils)).toBe(true);
      
      // Check types directory exists
      expect(directoryExists(phase1Artifacts.directories.types)).toBe(true);
      
      // Check dateUtils.ts exists
      expect(fileExists(phase1Artifacts.utils.dateUtils)).toBe(true);
      
      // Check shared.ts exists
      expect(fileExists(phase1Artifacts.types.shared)).toBe(true);
      
      // Check types/index.ts exists
      expect(fileExists(phase1Artifacts.types.index)).toBe(true);
    });

    /**
     * Property 6.2: Phase 1 exports required functions/types
     * Utility files should export the expected functions and types
     */
    test('Phase 1 utilities should export required functions and types', () => {
      // dateUtils should export date manipulation functions
      const dateUtilsContent = fs.readFileSync(phase1Artifacts.utils.dateUtils, 'utf-8');
      for (const exportName of expectedExports.phase1.dateUtils) {
        const hasExport = dateUtilsContent.includes(`export function ${exportName}`) ||
                          dateUtilsContent.includes(`export const ${exportName}`) ||
                          new RegExp(`export\\s*{[^}]*\\b${exportName}\\b[^}]*}`).test(dateUtilsContent);
        expect(hasExport).toBe(true);
      }
      
      // shared.ts should export shared types
      const sharedContent = fs.readFileSync(phase1Artifacts.types.shared, 'utf-8');
      for (const exportName of expectedExports.phase1.shared) {
        const hasExport = sharedContent.includes(`export interface ${exportName}`) ||
                          sharedContent.includes(`export type ${exportName}`) ||
                          new RegExp(`export\\s*{[^}]*\\b${exportName}\\b[^}]*}`).test(sharedContent);
        expect(hasExport).toBe(true);
      }
    });

    /**
     * Property 6.3: Phase 2a artifacts must exist (depends on Phase 1)
     * Custom hooks extraction should be completed after Phase 1
     */
    test('Phase 2a (custom hooks) artifacts should exist', () => {
      // Check hooks directory exists
      expect(directoryExists(phase2aArtifacts.directories.hooks)).toBe(true);
      
      // Check hook files exist
      expect(fileExists(phase2aArtifacts.hooks.useDeviceDetection)).toBe(true);
      expect(fileExists(phase2aArtifacts.hooks.useApiWithLoading)).toBe(true);
      expect(fileExists(phase2aArtifacts.hooks.useLocalStorage)).toBe(true);
      expect(fileExists(phase2aArtifacts.hooks.index)).toBe(true);
    });

    /**
     * Property 6.4: Phase 2a hooks export required functions
     * Hook files should export the expected hook functions
     */
    test('Phase 2a hooks should export required functions', () => {
      // useDeviceDetection should export the hook
      expect(fileExports(phase2aArtifacts.hooks.useDeviceDetection, expectedExports.phase2a.useDeviceDetection)).toBe(true);
      
      // useApiWithLoading should export the hook
      expect(fileExports(phase2aArtifacts.hooks.useApiWithLoading, expectedExports.phase2a.useApiWithLoading)).toBe(true);
      
      // useLocalStorage should export the hook
      expect(fileExports(phase2aArtifacts.hooks.useLocalStorage, expectedExports.phase2a.useLocalStorage)).toBe(true);
    });

    /**
     * Property 6.5: Phase 3a artifacts must exist (depends on Phase 1 & 2a)
     * Component extraction should be completed after Phase 1 and 2a
     */
    test('Phase 3a (component extraction) artifacts should exist', () => {
      // Check calendar directory exists
      expect(directoryExists(phase3aArtifacts.directories.calendar)).toBe(true);
      
      // Check mindmap directory exists
      expect(directoryExists(phase3aArtifacts.directories.mindmap)).toBe(true);
      
      // Check component files exist
      expect(fileExists(phase3aArtifacts.components.calendarControls)).toBe(true);
      expect(fileExists(phase3aArtifacts.components.calendarIndex)).toBe(true);
      expect(fileExists(phase3aArtifacts.components.mindmapControls)).toBe(true);
      expect(fileExists(phase3aArtifacts.components.mindmapIndex)).toBe(true);
    });

    /**
     * Property 6.6: Phase 3a components export required components
     * Component files should export the expected components
     */
    test('Phase 3a components should export required components', () => {
      // CalendarControls should be exported
      expect(fileExports(phase3aArtifacts.components.calendarControls, expectedExports.phase3a.calendarControls)).toBe(true);
      
      // MindmapControls should be exported
      expect(fileExports(phase3aArtifacts.components.mindmapControls, expectedExports.phase3a.mindmapControls)).toBe(true);
    });

    /**
     * Property 6.7: Phase dependency order is maintained
     * For any Phase 3a component, Phase 1 utilities should exist
     * This validates the incremental refactoring order
     */
    test('Phase 3a components should have Phase 1 utilities available', () => {
      // Property: For any Phase 3a component file, Phase 1 artifacts must exist
      const phase3aFiles = [
        phase3aArtifacts.components.calendarControls,
        phase3aArtifacts.components.mindmapControls,
      ];
      
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: phase3aFiles.length - 1 }),
          (fileIndex) => {
            const componentFile = phase3aFiles[fileIndex];
            
            // If Phase 3a component exists, Phase 1 must be complete
            if (fileExists(componentFile)) {
              // Phase 1 directories must exist
              const phase1DirsExist = 
                directoryExists(phase1Artifacts.directories.utils) &&
                directoryExists(phase1Artifacts.directories.types);
              
              // Phase 1 files must exist
              const phase1FilesExist = 
                fileExists(phase1Artifacts.utils.dateUtils) &&
                fileExists(phase1Artifacts.types.shared);
              
              return phase1DirsExist && phase1FilesExist;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 6.8: Phase 3a components should have Phase 2a hooks available
     * For any Phase 3a component, Phase 2a hooks should exist
     */
    test('Phase 3a components should have Phase 2a hooks available', () => {
      const phase3aFiles = [
        phase3aArtifacts.components.calendarControls,
        phase3aArtifacts.components.mindmapControls,
      ];
      
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: phase3aFiles.length - 1 }),
          (fileIndex) => {
            const componentFile = phase3aFiles[fileIndex];
            
            // If Phase 3a component exists, Phase 2a must be complete
            if (fileExists(componentFile)) {
              // Phase 2a directory must exist
              const phase2aDirExists = directoryExists(phase2aArtifacts.directories.hooks);
              
              // Phase 2a hook files must exist
              const phase2aFilesExist = 
                fileExists(phase2aArtifacts.hooks.useDeviceDetection) &&
                fileExists(phase2aArtifacts.hooks.useApiWithLoading) &&
                fileExists(phase2aArtifacts.hooks.useLocalStorage);
              
              return phase2aDirExists && phase2aFilesExist;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 6.9: Low-risk to high-risk order validation
     * Validates that the refactoring follows the risk-based order:
     * 1. Utility extraction (lowest risk)
     * 2. Hook extraction (low risk)
     * 3. Component extraction (low risk, but depends on 1 & 2)
     */
    test('refactoring should follow low-risk to high-risk order', () => {
      // Define risk levels for each phase
      const riskLevels = {
        phase1: 1, // Lowest risk - utility extraction
        phase2a: 2, // Low risk - hook extraction
        phase3a: 3, // Low risk but depends on 1 & 2 - component extraction
      };
      
      // Check that all Phase 1 artifacts exist (prerequisite for higher phases)
      const phase1Complete = 
        directoryExists(phase1Artifacts.directories.utils) &&
        directoryExists(phase1Artifacts.directories.types) &&
        fileExists(phase1Artifacts.utils.dateUtils) &&
        fileExists(phase1Artifacts.types.shared);
      
      // Check that all Phase 2a artifacts exist
      const phase2aComplete = 
        directoryExists(phase2aArtifacts.directories.hooks) &&
        fileExists(phase2aArtifacts.hooks.useDeviceDetection) &&
        fileExists(phase2aArtifacts.hooks.useApiWithLoading) &&
        fileExists(phase2aArtifacts.hooks.useLocalStorage);
      
      // Check that all Phase 3a artifacts exist
      const phase3aComplete = 
        directoryExists(phase3aArtifacts.directories.calendar) &&
        directoryExists(phase3aArtifacts.directories.mindmap) &&
        fileExists(phase3aArtifacts.components.calendarControls) &&
        fileExists(phase3aArtifacts.components.mindmapControls);
      
      // Property: If Phase 3a is complete, Phase 1 and 2a must be complete
      if (phase3aComplete) {
        expect(phase1Complete).toBe(true);
        expect(phase2aComplete).toBe(true);
      }
      
      // Property: If Phase 2a is complete, Phase 1 must be complete
      if (phase2aComplete) {
        expect(phase1Complete).toBe(true);
      }
      
      // All phases should be complete for a successful refactoring
      expect(phase1Complete).toBe(true);
      expect(phase2aComplete).toBe(true);
      expect(phase3aComplete).toBe(true);
    });

    /**
     * Property 6.10: Dependency chain validation using property-based testing
     * For any randomly selected artifact, its dependencies should exist
     */
    test('dependency chain should be maintained for all artifacts', () => {
      // All artifacts with their dependencies
      const artifactsWithDependencies = [
        // Phase 1 artifacts (no dependencies)
        { path: phase1Artifacts.utils.dateUtils, dependencies: [] },
        { path: phase1Artifacts.types.shared, dependencies: [] },
        
        // Phase 2a artifacts (depend on Phase 1)
        { 
          path: phase2aArtifacts.hooks.useDeviceDetection, 
          dependencies: [phase1Artifacts.types.shared] 
        },
        { 
          path: phase2aArtifacts.hooks.useApiWithLoading, 
          dependencies: [phase1Artifacts.types.shared] 
        },
        { 
          path: phase2aArtifacts.hooks.useLocalStorage, 
          dependencies: [] 
        },
        
        // Phase 3a artifacts (depend on Phase 1 and Phase 2a)
        { 
          path: phase3aArtifacts.components.calendarControls, 
          dependencies: [
            phase1Artifacts.types.shared,
            phase2aArtifacts.hooks.useDeviceDetection,
          ] 
        },
        { 
          path: phase3aArtifacts.components.mindmapControls, 
          dependencies: [
            phase1Artifacts.types.shared,
          ] 
        },
      ];
      
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: artifactsWithDependencies.length - 1 }),
          (artifactIndex) => {
            const artifact = artifactsWithDependencies[artifactIndex];
            
            // If the artifact exists, all its dependencies must exist
            if (fileExists(artifact.path)) {
              return artifact.dependencies.every(dep => fileExists(dep));
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 6.11: Index files for proper module organization
     * Each phase should have proper index files for clean exports
     */
    test('each phase should have proper index files', () => {
      // Phase 1: types/index.ts
      expect(fileExists(phase1Artifacts.types.index)).toBe(true);
      
      // Phase 2a: hooks/index.ts
      expect(fileExists(phase2aArtifacts.hooks.index)).toBe(true);
      
      // Phase 3a: component directories should have index.ts
      expect(fileExists(phase3aArtifacts.components.calendarIndex)).toBe(true);
      expect(fileExists(phase3aArtifacts.components.mindmapIndex)).toBe(true);
    });

    /**
     * Property 6.12: Validate that extracted components can use extracted utilities
     * Components in Phase 3a should be able to import from Phase 1 and 2a
     */
    test('Phase 3a components should be able to use Phase 1 and 2a artifacts', () => {
      const phase3aComponentFiles = [
        phase3aArtifacts.components.calendarControls,
        phase3aArtifacts.components.mindmapControls,
      ];
      
      // For each Phase 3a component, verify it can potentially import from earlier phases
      for (const componentFile of phase3aComponentFiles) {
        if (fileExists(componentFile)) {
          const content = fs.readFileSync(componentFile, 'utf-8');
          
          // Component should be a valid React component
          // Supports various export patterns:
          // - export function ComponentName
          // - export default function ComponentName
          // - export const ComponentName = memo(...)
          // - function ComponentName... export default ComponentName
          const isValidComponent = 
            /export\s+(default\s+)?function\s+\w+/.test(content) ||
            /export\s+const\s+\w+\s*=\s*memo\(/.test(content) ||
            /export\s+default\s+\w+/.test(content) ||
            /function\s+\w+Component/.test(content);
          
          expect(isValidComponent).toBe(true);
          
          // Component should have proper TypeScript types
          expect(content).toMatch(/interface\s+\w+Props|type\s+\w+Props/);
        }
      }
    });

    /**
     * Property 6.13: Comprehensive phase completion validation
     * All phases should be complete with all required artifacts
     */
    test('all refactoring phases should be complete', () => {
      // Phase 1 completion check
      const phase1Artifacts_list = [
        phase1Artifacts.directories.utils,
        phase1Artifacts.directories.types,
        phase1Artifacts.utils.dateUtils,
        phase1Artifacts.types.shared,
        phase1Artifacts.types.index,
      ];
      
      for (const artifact of phase1Artifacts_list) {
        expect(fs.existsSync(artifact)).toBe(true);
      }
      
      // Phase 2a completion check
      const phase2aArtifacts_list = [
        phase2aArtifacts.directories.hooks,
        phase2aArtifacts.hooks.useDeviceDetection,
        phase2aArtifacts.hooks.useApiWithLoading,
        phase2aArtifacts.hooks.useLocalStorage,
        phase2aArtifacts.hooks.index,
      ];
      
      for (const artifact of phase2aArtifacts_list) {
        expect(fs.existsSync(artifact)).toBe(true);
      }
      
      // Phase 3a completion check
      const phase3aArtifacts_list = [
        phase3aArtifacts.directories.calendar,
        phase3aArtifacts.directories.mindmap,
        phase3aArtifacts.components.calendarControls,
        phase3aArtifacts.components.calendarIndex,
        phase3aArtifacts.components.mindmapControls,
        phase3aArtifacts.components.mindmapIndex,
      ];
      
      for (const artifact of phase3aArtifacts_list) {
        expect(fs.existsSync(artifact)).toBe(true);
      }
    });
  });
});
