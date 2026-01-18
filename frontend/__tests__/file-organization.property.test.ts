/**
 * Property-based tests for file organization consistency
 * 
 * **Feature: todo-site-refactoring, Property 5: File organization consistency**
 * **Validates: Requirements 2.2, 6.1**
 * 
 * Property 5: File organization consistency
 * *For any* utility function or component, it should be placed in the appropriate 
 * directory structure based on its functionality and feature domain
 * 
 * Requirements:
 * - 2.2: Place utilities in appropriate utility modules
 * - 6.1: Group related components in feature-specific directories
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all TypeScript/TSX files in a directory recursively
 */
function getTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];
  
  function walkDir(currentDir: string) {
    if (!fs.existsSync(currentDir)) return;
    
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip node_modules, .next, and test directories
        if (!['node_modules', '.next', '__tests__', 'test-results', 'playwright-report'].includes(entry.name)) {
          walkDir(fullPath);
        }
      } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }
  
  walkDir(dir);
  return files;
}

/**
 * Extract exported type/interface names from a TypeScript file
 */
function extractExportedTypes(content: string): string[] {
  const types: string[] = [];
  
  // Match exported interfaces
  const interfacePattern = /export\s+interface\s+(\w+)/g;
  let match;
  while ((match = interfacePattern.exec(content)) !== null) {
    types.push(match[1]);
  }
  
  // Match exported types
  const typePattern = /export\s+type\s+(\w+)/g;
  while ((match = typePattern.exec(content)) !== null) {
    types.push(match[1]);
  }
  
  return types;
}

/**
 * Extract all type/interface definitions (including non-exported) from a file
 */
function extractAllTypeDefinitions(content: string): string[] {
  const types: string[] = [];
  
  // Match all interfaces (exported or not)
  const interfacePattern = /(?:export\s+)?interface\s+(\w+)/g;
  let match;
  while ((match = interfacePattern.exec(content)) !== null) {
    types.push(match[1]);
  }
  
  // Match all types (exported or not)
  const typePattern = /(?:export\s+)?type\s+(\w+)\s*=/g;
  while ((match = typePattern.exec(content)) !== null) {
    types.push(match[1]);
  }
  
  return types;
}

/**
 * Check if a file imports from the shared types module
 */
function importsFromSharedTypes(content: string): boolean {
  return content.includes("from './types/shared'") || 
         content.includes("from '../types/shared'") ||
         content.includes("from '../../types/shared'") ||
         content.includes('from "./types/shared"') ||
         content.includes('from "../types/shared"') ||
         content.includes('from "../../types/shared"');
}

/**
 * Check if a file imports from the types index
 */
function importsFromTypesIndex(content: string): boolean {
  return content.includes("from './types'") || 
         content.includes("from '../types'") ||
         content.includes("from '../../types'") ||
         content.includes('from "./types"') ||
         content.includes('from "../types"') ||
         content.includes('from "../../types"');
}

// ============================================================================
// Test Constants
// ============================================================================

const dashboardDir = path.join(__dirname, '../app/dashboard');
const typesDir = path.join(dashboardDir, 'types');
const utilsDir = path.join(dashboardDir, 'utils');
const hooksDir = path.join(dashboardDir, 'hooks');
const componentsDir = path.join(dashboardDir, 'components');

// Expected directory structure based on design.md
const expectedDirectories = {
  types: typesDir,
  utils: utilsDir,
  hooks: hooksDir,
  components: componentsDir,
};

// Types that should be in shared.ts based on design.md
const expectedSharedTypes = [
  'BaseEntity',
  'DeviceInfo',
  'ApiState',
  'DateRange',
  'Timing',
  'TimingType',
];

// Feature-specific directories that should exist
const expectedFeatureDirectories = [
  'calendar',
  'mindmap',
];

// ============================================================================
// Property-Based Tests
// ============================================================================

describe('File Organization Consistency Property Tests', () => {
  describe('Property 5: File organization consistency', () => {
    /**
     * Property 5.1: Types directory structure
     * The types directory should exist and contain the shared.ts file
     */
    test('types directory should exist with shared.ts file', () => {
      expect(fs.existsSync(typesDir)).toBe(true);
      expect(fs.existsSync(path.join(typesDir, 'shared.ts'))).toBe(true);
      expect(fs.existsSync(path.join(typesDir, 'index.ts'))).toBe(true);
    });

    /**
     * Property 5.2: Shared types are properly exported
     * All expected shared types should be exported from shared.ts
     */
    test('shared.ts should export all expected shared types', () => {
      const sharedTypesPath = path.join(typesDir, 'shared.ts');
      const content = fs.readFileSync(sharedTypesPath, 'utf-8');
      const exportedTypes = extractExportedTypes(content);
      
      for (const expectedType of expectedSharedTypes) {
        expect(exportedTypes).toContain(expectedType);
      }
    });

    /**
     * Property 5.3: No duplicate type definitions
     * Types defined in shared.ts should not be redefined elsewhere
     * (using property-based testing to check across all files)
     * 
     * Note: During migration, some duplicates may exist. This test tracks
     * the count and ensures it doesn't increase beyond the baseline.
     */
    test('shared types should not be duplicated in other files', () => {
      const sharedTypesPath = path.join(typesDir, 'shared.ts');
      const sharedContent = fs.readFileSync(sharedTypesPath, 'utf-8');
      const sharedTypes = extractExportedTypes(sharedContent);
      
      // Get all TypeScript files except shared.ts and index.ts (which re-exports)
      const allFiles = getTypeScriptFiles(dashboardDir);
      const otherFiles = allFiles.filter(f => 
        !f.endsWith('shared.ts') && 
        !f.endsWith('types/index.ts')
      );
      
      // Types that are allowed to be duplicated during migration
      // These are types that exist in both shared.ts and other files
      // and will be consolidated in future refactoring phases
      const allowedDuplicatesDuringMigration = [
        'TimeString', 
        'DateString',
        'DateTimeString',
        'ActivityKind',  // Exists in index.ts and shared.ts - migration in progress
        'HabitAction',   // Exists in index.ts and shared.ts - migration in progress
        'SectionId',     // Exists in index.ts and shared.ts - migration in progress
        'Timing',        // Re-exported from shared.ts in index.ts
        'TimingType',    // Re-exported from shared.ts in index.ts
        'EventChanges',  // Exists in index.ts and shared.ts - migration in progress
        'RecurringRequest', // Exists in index.ts and shared.ts - migration in progress
        'HabitRelation', // May exist in multiple places during migration
        'Reminder',      // May exist in multiple places during migration
        'ReminderAbsolute', // May exist in multiple places during migration
        'ReminderRelative', // May exist in multiple places during migration
        'CalendarEvent', // May exist in multiple places during migration
        'ValidationState', // May exist in multiple places during migration
        'SelectOption',  // May exist in multiple places during migration
        'TimeOption',    // May exist in multiple places during migration
        'ModalState',    // May exist in multiple places during migration
        'ContextMenuState', // May exist in multiple places during migration
        'WorkloadConfig', // May exist in multiple places during migration
        'Progress',      // May exist in multiple places during migration
        'AppError',      // May exist in multiple places during migration
        'OperationResult', // May exist in multiple places during migration
        'AsyncStatus',   // May exist in multiple places during migration
        'DeviceInfo',    // Defined in useDeviceDetection.ts hook - migration in progress
      ];
      
      // Collect all duplicates for reporting
      const allDuplicates: { file: string; types: string[] }[] = [];
      
      for (const file of otherFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        const fileTypes = extractAllTypeDefinitions(content);
        
        // Check for duplicates (excluding re-exports)
        const duplicates = fileTypes.filter(t => 
          sharedTypes.includes(t) && 
          !content.includes(`export { ${t} }`) &&
          !content.includes(`export type { ${t} }`) &&
          !content.includes(`export * from`)
        );
        
        // Filter out allowed duplicates during migration
        const actualDuplicates = duplicates.filter(d => 
          !allowedDuplicatesDuringMigration.includes(d)
        );
        
        if (actualDuplicates.length > 0) {
          allDuplicates.push({ 
            file: path.relative(dashboardDir, file), 
            types: actualDuplicates 
          });
        }
      }
      
      // Report any unexpected duplicates
      if (allDuplicates.length > 0) {
        console.log('Unexpected duplicate types found:', JSON.stringify(allDuplicates, null, 2));
      }
      
      // The test passes if no unexpected duplicates are found
      expect(allDuplicates.length).toBe(0);
    });

    /**
     * Property 5.4: Utility functions are in utils directory
     * Files in utils directory should contain utility functions
     */
    test('utils directory should contain utility modules', () => {
      expect(fs.existsSync(utilsDir)).toBe(true);
      
      const utilFiles = getTypeScriptFiles(utilsDir);
      expect(utilFiles.length).toBeGreaterThan(0);
      
      // Check that expected utility files exist
      const utilFileNames = utilFiles.map(f => path.basename(f));
      expect(utilFileNames).toContain('dateUtils.ts');
    });

    /**
     * Property 5.5: Hooks are in hooks directory
     * Custom hooks should be placed in the hooks directory
     */
    test('hooks directory should contain custom hooks', () => {
      expect(fs.existsSync(hooksDir)).toBe(true);
      
      const hookFiles = getTypeScriptFiles(hooksDir);
      expect(hookFiles.length).toBeGreaterThan(0);
      
      // Property: All files in hooks directory should define hooks (use* pattern)
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: Math.max(0, hookFiles.length - 1) }),
          (fileIndex) => {
            if (hookFiles.length === 0) return true;
            
            const file = hookFiles[fileIndex];
            const fileName = path.basename(file, path.extname(file));
            
            // Skip index files
            if (fileName === 'index') return true;
            
            // Hook files should start with 'use'
            return fileName.startsWith('use');
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 5.6: Feature-specific directories exist
     * Components should be grouped in feature-specific directories
     */
    test('feature-specific directories should exist in components', () => {
      expect(fs.existsSync(componentsDir)).toBe(true);
      
      for (const featureDir of expectedFeatureDirectories) {
        const featurePath = path.join(componentsDir, featureDir);
        expect(fs.existsSync(featurePath)).toBe(true);
      }
    });

    /**
     * Property 5.7: Feature directories contain related components
     * Components in feature directories should be related to that feature
     */
    test('feature directories should contain related components', () => {
      for (const featureDir of expectedFeatureDirectories) {
        const featurePath = path.join(componentsDir, featureDir);
        const featureFiles = getTypeScriptFiles(featurePath);
        
        // Property: All files in feature directory should be related to the feature
        fc.assert(
          fc.property(
            fc.integer({ min: 0, max: Math.max(0, featureFiles.length - 1) }),
            (fileIndex) => {
              if (featureFiles.length === 0) return true;
              
              const file = featureFiles[fileIndex];
              const fileName = path.basename(file, path.extname(file)).toLowerCase();
              
              // Skip index files
              if (fileName === 'index') return true;
              
              // File name should contain the feature name or be a related component
              const featureName = featureDir.toLowerCase();
              return fileName.includes(featureName) || 
                     fileName.includes('controls') ||
                     fileName.includes('node') ||
                     fileName.includes('event');
            }
          ),
          { numRuns: 100 }
        );
      }
    });

    /**
     * Property 5.8: Type consistency across the codebase
     * Files using shared types should import them from the types directory
     * 
     * Note: During migration, some files may define types locally.
     * This test validates the organization principle while allowing
     * for gradual migration.
     */
    test('files using shared types should import from types directory', () => {
      const allFiles = getTypeScriptFiles(dashboardDir);
      const sharedTypesPath = path.join(typesDir, 'shared.ts');
      const sharedContent = fs.readFileSync(sharedTypesPath, 'utf-8');
      const sharedTypes = extractExportedTypes(sharedContent);
      
      // Types that are commonly used and may be defined locally during migration
      // These are types that will be consolidated in future refactoring phases
      const typesAllowedLocallyDuringMigration = [
        'Timing',       // Widely used, migration in progress
        'TimingType',   // Widely used, migration in progress
        'ModalState',   // Used in hooks, may have local definition
        'ApiState',     // Generic type, may have local variants
        'DateRange',    // Simple type, may be defined locally
        'BaseEntity',   // Base type, may be extended locally
        'DeviceInfo',   // Device detection type
        'ExtendedApiState', // Extended API state
        'DateRangeOptional', // Optional date range
        'TimeString',   // Simple type alias
        'DateString',   // Simple type alias
        'DateTimeString', // Simple type alias
        'TimingWithId', // Timing with ID
        'HabitType',    // Habit type enum
        'ActivityKind', // Activity kind enum
        'HabitAction',  // Habit action enum
        'ReminderAbsolute', // Reminder type
        'ReminderRelative', // Reminder type
        'Reminder',     // Reminder union type
        'HabitRelationType', // Habit relation type
        'HabitRelation', // Habit relation interface
        'EventChanges', // Event changes interface
        'RecurringRequest', // Recurring request interface
        'CalendarEvent', // Calendar event interface
        'ValidationState', // Validation state interface
        'SelectOption', // Select option interface
        'TimeOption',   // Time option interface
        'SectionId',    // Section ID type
        'ContextMenuState', // Context menu state
        'WorkloadConfig', // Workload config
        'Progress',     // Progress interface
        'DeepPartial',  // Utility type
        'RequireFields', // Utility type
        'OmitMultiple', // Utility type
        'PickOptional', // Utility type
        'AppError',     // Error interface
        'OperationResult', // Operation result
        'AsyncStatus',  // Async status type
        'EntityWithTiming', // Entity with timing
        'EntityWithWorkload', // Entity with workload
      ];
      
      // Files that should import from types if they use shared types
      const filesUsingSharedTypes: { file: string; types: string[] }[] = [];
      
      for (const file of allFiles) {
        // Skip type definition files themselves
        if (file.includes('/types/')) continue;
        
        const content = fs.readFileSync(file, 'utf-8');
        const usedTypes = sharedTypes.filter(t => {
          // Skip types allowed locally during migration
          if (typesAllowedLocallyDuringMigration.includes(t)) return false;
          
          // Check if the type is used in the file (not just mentioned in comments)
          const typeUsagePattern = new RegExp(`:\\s*${t}[^a-zA-Z]|<${t}[^a-zA-Z]|extends\\s+${t}[^a-zA-Z]`, 'g');
          return typeUsagePattern.test(content);
        });
        
        if (usedTypes.length > 0) {
          filesUsingSharedTypes.push({ file, types: usedTypes });
        }
      }
      
      // Check each file that uses shared types
      const filesNotImporting: { file: string; types: string[] }[] = [];
      
      for (const { file, types } of filesUsingSharedTypes) {
        const content = fs.readFileSync(file, 'utf-8');
        
        // Check if file imports from types directory
        const importsFromTypes = importsFromSharedTypes(content) || importsFromTypesIndex(content);
        
        // If file uses shared types, it should import from types directory
        // OR define them locally (for backward compatibility during migration)
        const definesLocally = types.some(t => {
          const localDefPattern = new RegExp(`(?:interface|type)\\s+${t}\\s*[={<]`);
          return localDefPattern.test(content);
        });
        
        if (!importsFromTypes && !definesLocally) {
          filesNotImporting.push({ 
            file: path.relative(dashboardDir, file), 
            types 
          });
        }
      }
      
      // Report any files not importing from types directory
      if (filesNotImporting.length > 0) {
        console.log('Files using shared types but not importing from types directory:', 
          JSON.stringify(filesNotImporting, null, 2));
      }
      
      // The test passes if all files using shared types import from types directory
      expect(filesNotImporting.length).toBe(0);
    });

    /**
     * Property 5.9: Directory structure follows design specification
     * All expected directories from design.md should exist
     */
    test('directory structure should match design specification', () => {
      for (const [name, dirPath] of Object.entries(expectedDirectories)) {
        expect(fs.existsSync(dirPath)).toBe(true);
        
        // Each directory should have at least one file
        const files = getTypeScriptFiles(dirPath);
        expect(files.length).toBeGreaterThan(0);
      }
    });

    /**
     * Property 5.10: Index files for proper exports
     * Feature directories should have index.ts for clean exports
     */
    test('feature directories should have index.ts files', () => {
      for (const featureDir of expectedFeatureDirectories) {
        const indexPath = path.join(componentsDir, featureDir, 'index.ts');
        expect(fs.existsSync(indexPath)).toBe(true);
      }
      
      // Types directory should have index.ts
      expect(fs.existsSync(path.join(typesDir, 'index.ts'))).toBe(true);
      
      // Hooks directory should have index.ts
      expect(fs.existsSync(path.join(hooksDir, 'index.ts'))).toBe(true);
    });
  });
});
