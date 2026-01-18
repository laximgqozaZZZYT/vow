/**
 * Property-based tests for Naming Convention Consistency
 * 
 * **Feature: todo-site-refactoring, Property 3: Naming convention consistency**
 * **Validates: Requirements 1.3**
 * 
 * Property 3: Naming convention consistency
 * *For any* newly created sub-component, the naming should follow the established 
 * pattern of FeatureName + ComponentType (e.g., CalendarControls, MindmapControls)
 * 
 * Requirements:
 * - 1.3: WHEN creating sub-components, THE Refactoring_System SHALL follow 
 *        consistent naming conventions
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Configuration
// ============================================================================

const dashboardDir = path.join(__dirname, '../app/dashboard');
const componentsDir = path.join(dashboardDir, 'components');
const hooksDir = path.join(dashboardDir, 'hooks');
const utilsDir = path.join(dashboardDir, 'utils');
const typesDir = path.join(dashboardDir, 'types');

// Established naming patterns based on design.md
const COMPONENT_NAMING_PATTERNS = {
  // Feature-specific components: FeatureName + ComponentType
  featureComponents: /^(Calendar|Mindmap|Modal|Widget|Section|Form|Layout|Editable)[A-Z][a-zA-Z]*$/,
  
  // Sub-components in feature directories: FeatureName + ComponentType
  subComponents: /^(Calendar|Mindmap)[A-Z][a-zA-Z]*$/,
  
  // General component patterns
  generalComponents: /^[A-Z][a-zA-Z]+(\.[A-Z][a-zA-Z]+)*$/,
};

// Hook naming pattern: use + PascalCase
const HOOK_NAMING_PATTERN = /^use[A-Z][a-zA-Z]*$/;

// Utility naming pattern: camelCase
const UTILITY_NAMING_PATTERN = /^[a-z][a-zA-Z]*$/;

// Type file naming pattern: camelCase, PascalCase, or dot notation (e.g., mindmap.types)
const TYPE_FILE_NAMING_PATTERN = /^[a-z][a-zA-Z]*$|^[A-Z][a-zA-Z]*$|^[a-z][a-zA-Z]*\.[a-z]+$/;

// Feature directories that should contain properly named components
const FEATURE_DIRECTORIES = ['calendar', 'mindmap'];

// Expected component types based on design.md
const EXPECTED_COMPONENT_TYPES = [
  'Controls',   // e.g., CalendarControls, MindmapControls
  'Events',     // e.g., CalendarEvents
  'Node',       // e.g., MindmapNode
  'Header',     // e.g., MindmapHeader
  'Menu',       // e.g., MindmapMobileMenu
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all TypeScript/TSX files in a directory recursively
 */
function getTypeScriptFiles(dir: string, extensions: string[] = ['.ts', '.tsx']): string[] {
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
      } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  }
  
  walkDir(dir);
  return files;
}

/**
 * Extract the component name from a file path
 */
function extractComponentName(filePath: string): string {
  const fileName = path.basename(filePath);
  // Remove extension
  return fileName.replace(/\.(tsx?|jsx?)$/, '');
}

/**
 * Check if a component name follows the FeatureName + ComponentType pattern
 */
function followsFeatureComponentPattern(name: string, featureName: string): boolean {
  // Component should start with the feature name (PascalCase)
  const pascalFeature = featureName.charAt(0).toUpperCase() + featureName.slice(1);
  return name.startsWith(pascalFeature) && name.length > pascalFeature.length;
}

/**
 * Check if a hook name follows the use* pattern
 */
function followsHookNamingPattern(name: string): boolean {
  return HOOK_NAMING_PATTERN.test(name);
}

/**
 * Check if a utility name follows camelCase pattern
 */
function followsUtilityNamingPattern(name: string): boolean {
  return UTILITY_NAMING_PATTERN.test(name);
}

/**
 * Validate component naming against established patterns
 */
function validateComponentNaming(name: string): {
  valid: boolean;
  pattern: string;
  reason?: string;
} {
  // Check for dot notation (e.g., Widget.Calendar, Modal.Habit)
  if (name.includes('.')) {
    const parts = name.split('.');
    const allPascalCase = parts.every(part => /^[A-Z][a-zA-Z]*$/.test(part));
    if (allPascalCase) {
      return { valid: true, pattern: 'dot-notation' };
    }
    return { 
      valid: false, 
      pattern: 'dot-notation', 
      reason: `Parts should be PascalCase: ${parts.filter(p => !/^[A-Z][a-zA-Z]*$/.test(p)).join(', ')}` 
    };
  }
  
  // Check for PascalCase
  if (/^[A-Z][a-zA-Z]*$/.test(name)) {
    return { valid: true, pattern: 'PascalCase' };
  }
  
  return { 
    valid: false, 
    pattern: 'unknown', 
    reason: 'Component name should be PascalCase or use dot notation' 
  };
}

// ============================================================================
// Test Interfaces
// ============================================================================

interface NamingValidationResult {
  file: string;
  name: string;
  valid: boolean;
  pattern: string;
  reason?: string;
}

interface FeatureComponentValidation {
  feature: string;
  components: NamingValidationResult[];
  allValid: boolean;
}

// ============================================================================
// Property-Based Tests
// ============================================================================

describe('Property 3: Naming convention consistency', () => {
  /**
   * **Property 3: Naming convention consistency**
   * **Validates: Requirements 1.3**
   */
  
  describe('Component naming conventions', () => {
    /**
     * Test 3.1: All component files should follow PascalCase or dot notation
     */
    test('all component files should follow established naming patterns', () => {
      const componentFiles = getTypeScriptFiles(componentsDir, ['.tsx']);
      const validationResults: NamingValidationResult[] = [];
      
      for (const file of componentFiles) {
        const name = extractComponentName(file);
        
        // Skip index files
        if (name === 'index') continue;
        
        const validation = validateComponentNaming(name);
        validationResults.push({
          file: path.relative(componentsDir, file),
          name,
          ...validation,
        });
      }
      
      // Report results
      const invalidComponents = validationResults.filter(r => !r.valid);
      const validComponents = validationResults.filter(r => r.valid);
      
      console.log('\n=== Component Naming Validation ===');
      console.log(`Total components: ${validationResults.length}`);
      console.log(`Valid: ${validComponents.length}`);
      console.log(`Invalid: ${invalidComponents.length}`);
      
      if (invalidComponents.length > 0) {
        console.log('\n⚠️ Components with invalid naming:');
        invalidComponents.forEach(c => {
          console.log(`  - ${c.file}: ${c.reason}`);
        });
      }
      
      // Property: All components should have valid naming
      expect(invalidComponents.length).toBe(0);
    });

    /**
     * Test 3.2: Feature directory components should follow FeatureName + ComponentType pattern
     */
    test('feature directory components should follow FeatureName + ComponentType pattern', () => {
      const featureValidations: FeatureComponentValidation[] = [];
      
      for (const feature of FEATURE_DIRECTORIES) {
        const featureDir = path.join(componentsDir, feature);
        if (!fs.existsSync(featureDir)) continue;
        
        const featureFiles = getTypeScriptFiles(featureDir, ['.tsx']);
        const components: NamingValidationResult[] = [];
        
        for (const file of featureFiles) {
          const name = extractComponentName(file);
          
          // Skip index files
          if (name === 'index') continue;
          
          const followsPattern = followsFeatureComponentPattern(name, feature);
          components.push({
            file: path.relative(featureDir, file),
            name,
            valid: followsPattern,
            pattern: 'FeatureName + ComponentType',
            reason: followsPattern ? undefined : `Should start with "${feature.charAt(0).toUpperCase() + feature.slice(1)}"`,
          });
        }
        
        featureValidations.push({
          feature,
          components,
          allValid: components.every(c => c.valid),
        });
      }
      
      // Report results
      console.log('\n=== Feature Component Naming Validation ===');
      for (const validation of featureValidations) {
        const status = validation.allValid ? '✅' : '❌';
        console.log(`${status} ${validation.feature}/`);
        validation.components.forEach(c => {
          const compStatus = c.valid ? '  ✓' : '  ✗';
          console.log(`${compStatus} ${c.name}${c.reason ? ` (${c.reason})` : ''}`);
        });
      }
      
      // Property: All feature components should follow the pattern
      const allValid = featureValidations.every(v => v.allValid);
      expect(allValid).toBe(true);
    });

    /**
     * Test 3.3: Newly extracted components should follow naming conventions
     * Specifically validates CalendarControls and MindmapControls from Phase 3a
     */
    test('newly extracted components should follow naming conventions', () => {
      const newComponents = [
        { path: 'calendar/CalendarControls.tsx', expectedPattern: 'CalendarControls' },
        { path: 'mindmap/MindmapControls.tsx', expectedPattern: 'MindmapControls' },
      ];
      
      const results: { name: string; exists: boolean; valid: boolean }[] = [];
      
      for (const comp of newComponents) {
        const fullPath = path.join(componentsDir, comp.path);
        const exists = fs.existsSync(fullPath);
        const name = extractComponentName(fullPath);
        const valid = exists && name === comp.expectedPattern;
        
        results.push({ name: comp.expectedPattern, exists, valid });
      }
      
      console.log('\n=== Newly Extracted Components ===');
      results.forEach(r => {
        const status = r.valid ? '✅' : (r.exists ? '⚠️' : '❌');
        console.log(`${status} ${r.name}: ${r.exists ? 'exists' : 'missing'}${r.valid ? ', valid naming' : ''}`);
      });
      
      // All new components should exist and have valid naming
      const allValid = results.every(r => r.valid);
      expect(allValid).toBe(true);
    });

    /**
     * Test 3.4: Property-based test for component naming across random samples
     */
    test('randomly selected components should follow naming conventions', () => {
      const componentFiles = getTypeScriptFiles(componentsDir, ['.tsx'])
        .filter(f => !path.basename(f).startsWith('index'));
      
      if (componentFiles.length === 0) {
        console.log('No component files to test');
        return;
      }
      
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: componentFiles.length - 1 }),
          (index) => {
            const file = componentFiles[index];
            const name = extractComponentName(file);
            const validation = validateComponentNaming(name);
            
            return validation.valid;
          }
        ),
        { numRuns: Math.min(100, componentFiles.length) }
      );
    });
  });

  describe('Hook naming conventions', () => {
    /**
     * Test 3.5: All hooks should follow use* naming pattern
     */
    test('all hooks should follow use* naming pattern', () => {
      const hookFiles = getTypeScriptFiles(hooksDir, ['.ts']);
      const validationResults: NamingValidationResult[] = [];
      
      for (const file of hookFiles) {
        const name = extractComponentName(file);
        
        // Skip index files
        if (name === 'index') continue;
        
        const valid = followsHookNamingPattern(name);
        validationResults.push({
          file: path.relative(hooksDir, file),
          name,
          valid,
          pattern: 'use*',
          reason: valid ? undefined : 'Hook name should start with "use" followed by PascalCase',
        });
      }
      
      // Report results
      const invalidHooks = validationResults.filter(r => !r.valid);
      const validHooks = validationResults.filter(r => r.valid);
      
      console.log('\n=== Hook Naming Validation ===');
      console.log(`Total hooks: ${validationResults.length}`);
      console.log(`Valid: ${validHooks.length}`);
      console.log(`Invalid: ${invalidHooks.length}`);
      
      if (invalidHooks.length > 0) {
        console.log('\n⚠️ Hooks with invalid naming:');
        invalidHooks.forEach(h => {
          console.log(`  - ${h.file}: ${h.reason}`);
        });
      }
      
      // Property: All hooks should follow use* pattern
      expect(invalidHooks.length).toBe(0);
    });

    /**
     * Test 3.6: Property-based test for hook naming
     */
    test('randomly selected hooks should follow use* pattern', () => {
      const hookFiles = getTypeScriptFiles(hooksDir, ['.ts'])
        .filter(f => !path.basename(f).startsWith('index'));
      
      if (hookFiles.length === 0) {
        console.log('No hook files to test');
        return;
      }
      
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: hookFiles.length - 1 }),
          (index) => {
            const file = hookFiles[index];
            const name = extractComponentName(file);
            return followsHookNamingPattern(name);
          }
        ),
        { numRuns: Math.min(100, hookFiles.length) }
      );
    });

    /**
     * Test 3.7: Newly created hooks should follow naming conventions
     */
    test('newly created hooks should follow naming conventions', () => {
      const newHooks = [
        'useDeviceDetection',
        'useApiWithLoading',
        'useLocalStorage',
      ];
      
      const results: { name: string; exists: boolean; valid: boolean }[] = [];
      
      for (const hookName of newHooks) {
        const fullPath = path.join(hooksDir, `${hookName}.ts`);
        const exists = fs.existsSync(fullPath);
        const valid = exists && followsHookNamingPattern(hookName);
        
        results.push({ name: hookName, exists, valid });
      }
      
      console.log('\n=== Newly Created Hooks ===');
      results.forEach(r => {
        const status = r.valid ? '✅' : (r.exists ? '⚠️' : '❌');
        console.log(`${status} ${r.name}: ${r.exists ? 'exists' : 'missing'}${r.valid ? ', valid naming' : ''}`);
      });
      
      // All new hooks should exist and have valid naming
      const allValid = results.every(r => r.valid);
      expect(allValid).toBe(true);
    });
  });

  describe('Utility naming conventions', () => {
    /**
     * Test 3.8: All utility files should follow camelCase naming
     */
    test('all utility files should follow camelCase naming', () => {
      const utilFiles = getTypeScriptFiles(utilsDir, ['.ts']);
      const validationResults: NamingValidationResult[] = [];
      
      for (const file of utilFiles) {
        const name = extractComponentName(file);
        
        // Skip index files
        if (name === 'index') continue;
        
        const valid = followsUtilityNamingPattern(name);
        validationResults.push({
          file: path.relative(utilsDir, file),
          name,
          valid,
          pattern: 'camelCase',
          reason: valid ? undefined : 'Utility file name should be camelCase',
        });
      }
      
      // Report results
      const invalidUtils = validationResults.filter(r => !r.valid);
      const validUtils = validationResults.filter(r => r.valid);
      
      console.log('\n=== Utility Naming Validation ===');
      console.log(`Total utilities: ${validationResults.length}`);
      console.log(`Valid: ${validUtils.length}`);
      console.log(`Invalid: ${invalidUtils.length}`);
      
      if (invalidUtils.length > 0) {
        console.log('\n⚠️ Utilities with invalid naming:');
        invalidUtils.forEach(u => {
          console.log(`  - ${u.file}: ${u.reason}`);
        });
      }
      
      // Property: All utilities should follow camelCase pattern
      expect(invalidUtils.length).toBe(0);
    });

    /**
     * Test 3.9: Property-based test for utility naming
     */
    test('randomly selected utilities should follow camelCase pattern', () => {
      const utilFiles = getTypeScriptFiles(utilsDir, ['.ts'])
        .filter(f => !path.basename(f).startsWith('index'));
      
      if (utilFiles.length === 0) {
        console.log('No utility files to test');
        return;
      }
      
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: utilFiles.length - 1 }),
          (index) => {
            const file = utilFiles[index];
            const name = extractComponentName(file);
            return followsUtilityNamingPattern(name);
          }
        ),
        { numRuns: Math.min(100, utilFiles.length) }
      );
    });

    /**
     * Test 3.10: Newly created utilities should follow naming conventions
     */
    test('newly created utilities should follow naming conventions', () => {
      const newUtils = [
        'dateUtils',
        'chartUtils',
        'chartSeriesBuilder',
        'animationCapture',
      ];
      
      const results: { name: string; exists: boolean; valid: boolean }[] = [];
      
      for (const utilName of newUtils) {
        const fullPath = path.join(utilsDir, `${utilName}.ts`);
        const exists = fs.existsSync(fullPath);
        const valid = exists && followsUtilityNamingPattern(utilName);
        
        results.push({ name: utilName, exists, valid });
      }
      
      console.log('\n=== Newly Created Utilities ===');
      results.forEach(r => {
        const status = r.valid ? '✅' : (r.exists ? '⚠️' : '❌');
        console.log(`${status} ${r.name}: ${r.exists ? 'exists' : 'missing'}${r.valid ? ', valid naming' : ''}`);
      });
      
      // All new utilities should exist and have valid naming
      const allValid = results.every(r => r.valid);
      expect(allValid).toBe(true);
    });
  });

  describe('Type file naming conventions', () => {
    /**
     * Test 3.11: Type files should follow naming conventions
     */
    test('type files should follow naming conventions', () => {
      const typeFiles = getTypeScriptFiles(typesDir, ['.ts']);
      const validationResults: NamingValidationResult[] = [];
      
      for (const file of typeFiles) {
        const name = extractComponentName(file);
        
        // Skip index files
        if (name === 'index') continue;
        
        const valid = TYPE_FILE_NAMING_PATTERN.test(name);
        validationResults.push({
          file: path.relative(typesDir, file),
          name,
          valid,
          pattern: 'camelCase, PascalCase, or dot notation',
          reason: valid ? undefined : 'Type file name should be camelCase, PascalCase, or dot notation (e.g., feature.types)',
        });
      }
      
      // Report results
      const invalidTypes = validationResults.filter(r => !r.valid);
      const validTypes = validationResults.filter(r => r.valid);
      
      console.log('\n=== Type File Naming Validation ===');
      console.log(`Total type files: ${validationResults.length}`);
      console.log(`Valid: ${validTypes.length}`);
      console.log(`Invalid: ${invalidTypes.length}`);
      
      if (invalidTypes.length > 0) {
        console.log('\n⚠️ Type files with invalid naming:');
        invalidTypes.forEach(t => {
          console.log(`  - ${t.file}: ${t.reason}`);
        });
      }
      
      // Property: All type files should follow naming conventions
      expect(invalidTypes.length).toBe(0);
    });
  });

  describe('Comprehensive naming convention summary', () => {
    /**
     * Test 3.12: Generate comprehensive naming convention report
     */
    test('should generate comprehensive naming convention report', () => {
      // Collect all validation results
      const componentFiles = getTypeScriptFiles(componentsDir, ['.tsx'])
        .filter(f => !path.basename(f).startsWith('index'));
      const hookFiles = getTypeScriptFiles(hooksDir, ['.ts'])
        .filter(f => !path.basename(f).startsWith('index'));
      const utilFiles = getTypeScriptFiles(utilsDir, ['.ts'])
        .filter(f => !path.basename(f).startsWith('index'));
      const typeFiles = getTypeScriptFiles(typesDir, ['.ts'])
        .filter(f => !path.basename(f).startsWith('index'));
      
      // Validate each category
      const componentResults = componentFiles.map(f => {
        const name = extractComponentName(f);
        return { name, valid: validateComponentNaming(name).valid };
      });
      
      const hookResults = hookFiles.map(f => {
        const name = extractComponentName(f);
        return { name, valid: followsHookNamingPattern(name) };
      });
      
      const utilResults = utilFiles.map(f => {
        const name = extractComponentName(f);
        return { name, valid: followsUtilityNamingPattern(name) };
      });
      
      const typeResults = typeFiles.map(f => {
        const name = extractComponentName(f);
        return { name, valid: TYPE_FILE_NAMING_PATTERN.test(name) };
      });
      
      // Calculate statistics
      const stats = {
        components: {
          total: componentResults.length,
          valid: componentResults.filter(r => r.valid).length,
        },
        hooks: {
          total: hookResults.length,
          valid: hookResults.filter(r => r.valid).length,
        },
        utilities: {
          total: utilResults.length,
          valid: utilResults.filter(r => r.valid).length,
        },
        types: {
          total: typeResults.length,
          valid: typeResults.filter(r => r.valid).length,
        },
      };
      
      const totalFiles = stats.components.total + stats.hooks.total + stats.utilities.total + stats.types.total;
      const totalValid = stats.components.valid + stats.hooks.valid + stats.utilities.valid + stats.types.valid;
      const complianceRate = totalFiles > 0 ? ((totalValid / totalFiles) * 100).toFixed(1) : '0';
      
      console.log('\n========================================');
      console.log('  NAMING CONVENTION COMPLIANCE REPORT');
      console.log('========================================');
      console.log(`  Components: ${stats.components.valid}/${stats.components.total} valid`);
      console.log(`  Hooks: ${stats.hooks.valid}/${stats.hooks.total} valid`);
      console.log(`  Utilities: ${stats.utilities.valid}/${stats.utilities.total} valid`);
      console.log(`  Types: ${stats.types.valid}/${stats.types.total} valid`);
      console.log('----------------------------------------');
      console.log(`  Total: ${totalValid}/${totalFiles} valid`);
      console.log(`  Compliance rate: ${complianceRate}%`);
      console.log('========================================\n');
      
      // Final assertion: All files should follow naming conventions
      expect(totalValid).toBe(totalFiles);
    });
  });
});
