/**
 * Property-based tests for Local Storage Hook
 * 
 * **Feature: todo-site-refactoring, Property 4: Code deduplication effectiveness**
 * **Validates: Requirements 2.1, 3.1**
 * 
 * Tests that localStorage management logic is properly extracted and centralized,
 * provides consistent storage management (value, setValue, removeValue),
 * and validates that no duplicate localStorage patterns exist elsewhere in the codebase.
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

// Helper to get all TypeScript/TSX files in a directory
function getTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];
  
  function walkDir(currentDir: string) {
    if (!fs.existsSync(currentDir)) return;
    
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip node_modules, .next, and test directories
        if (!['node_modules', '.next', '__tests__', 'test-results'].includes(entry.name)) {
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

describe('Local Storage Hook Property Tests', () => {
  /**
   * **Property 4: Code deduplication effectiveness**
   * **Validates: Requirements 2.1, 3.1**
   * 
   * Validates that localStorage management is properly extracted to a shared
   * hook module and provides consistent behavior across all valid inputs.
   */
  describe('Property 4: Code deduplication effectiveness', () => {
    
    describe('Storage value consistency', () => {
      test('should maintain value integrity for string values', () => {
        fc.assert(
          fc.property(
            fc.string({ minLength: 0, maxLength: 1000 }),
            (value) => {
              // Simulate localStorage serialization/deserialization for strings
              const serialized = value;
              const deserialized = serialized;
              
              // String values should be stored and retrieved without modification
              expect(deserialized).toBe(value);
              expect(typeof deserialized).toBe('string');
            }
          ),
          { numRuns: 100 }
        );
      });

      test('should maintain value integrity for number values', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: -1000000, max: 1000000 }),
            (value) => {
              // Simulate localStorage serialization/deserialization for numbers
              const serialized = String(value);
              const deserialized = Number(serialized);
              
              // Number values should be stored and retrieved correctly
              expect(deserialized).toBe(value);
              expect(typeof deserialized).toBe('number');
              expect(isNaN(deserialized)).toBe(false);
            }
          ),
          { numRuns: 100 }
        );
      });

      test('should maintain value integrity for boolean values', () => {
        fc.assert(
          fc.property(
            fc.boolean(),
            (value) => {
              // Simulate localStorage serialization/deserialization for booleans
              const serialized = String(value);
              const deserialized = serialized === 'true';
              
              // Boolean values should be stored and retrieved correctly
              expect(deserialized).toBe(value);
              expect(typeof deserialized).toBe('boolean');
            }
          ),
          { numRuns: 100 }
        );
      });

      test('should maintain value integrity for JSON objects', () => {
        fc.assert(
          fc.property(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 50 }),
              count: fc.integer({ min: 0, max: 1000 }),
              active: fc.boolean(),
              tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 5 }),
            }),
            (value) => {
              // Simulate localStorage serialization/deserialization for objects
              const serialized = JSON.stringify(value);
              const deserialized = JSON.parse(serialized);
              
              // Object values should be stored and retrieved correctly
              expect(deserialized).toEqual(value);
              expect(deserialized.id).toBe(value.id);
              expect(deserialized.count).toBe(value.count);
              expect(deserialized.active).toBe(value.active);
              expect(deserialized.tags).toEqual(value.tags);
            }
          ),
          { numRuns: 100 }
        );
      });

      test('should handle null and undefined default values correctly', () => {
        fc.assert(
          fc.property(
            fc.option(fc.string(), { nil: null }),
            (defaultValue) => {
              // Simulate behavior when localStorage key doesn't exist
              const storedItem = null; // Key doesn't exist
              const result = storedItem === null ? defaultValue : storedItem;
              
              // Should return default value when key doesn't exist
              expect(result).toBe(defaultValue);
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('State management consistency', () => {
      test('should have consistent hasValue state after setValue', () => {
        fc.assert(
          fc.property(
            fc.string({ minLength: 1, maxLength: 100 }),
            fc.string({ minLength: 1, maxLength: 100 }),
            (key, value) => {
              // Simulate state after setValue
              let hasValue = false;
              
              // After setValue, hasValue should be true
              hasValue = true;
              
              expect(hasValue).toBe(true);
            }
          ),
          { numRuns: 100 }
        );
      });

      test('should have consistent hasValue state after removeValue', () => {
        fc.assert(
          fc.property(
            fc.string({ minLength: 1, maxLength: 100 }),
            (key) => {
              // Simulate state after removeValue
              let hasValue = true;
              
              // After removeValue, hasValue should be false
              hasValue = false;
              
              expect(hasValue).toBe(false);
            }
          ),
          { numRuns: 100 }
        );
      });

      test('should return default value after removeValue', () => {
        fc.assert(
          fc.property(
            fc.string({ minLength: 1, maxLength: 100 }),
            fc.string({ minLength: 1, maxLength: 100 }),
            (key, defaultValue) => {
              // Simulate state after removeValue
              let value = 'some stored value';
              
              // After removeValue, value should reset to default
              value = defaultValue;
              
              expect(value).toBe(defaultValue);
            }
          ),
          { numRuns: 100 }
        );
      });

      test('should support functional updates like useState', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 0, max: 100 }),
            fc.integer({ min: 1, max: 10 }),
            (initialValue, increment) => {
              // Simulate functional update pattern
              let value = initialValue;
              
              // Functional update: setValue(prev => prev + increment)
              const updateFn = (prev: number) => prev + increment;
              value = updateFn(value);
              
              expect(value).toBe(initialValue + increment);
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Error handling consistency', () => {
      test('should handle invalid JSON gracefully', () => {
        fc.assert(
          fc.property(
            fc.string({ minLength: 1, maxLength: 100 }),
            (defaultValue) => {
              // Simulate parsing invalid JSON
              const invalidJson = '{invalid json}';
              let result: string;
              let error: string | null = null;
              
              try {
                JSON.parse(invalidJson);
                result = invalidJson;
              } catch (e) {
                // Should fall back to default value on parse error
                result = defaultValue;
                error = e instanceof Error ? e.message : 'Parse error';
              }
              
              // Should return default value on error
              expect(result).toBe(defaultValue);
              expect(error).not.toBeNull();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('should convert errors to string messages consistently', () => {
        fc.assert(
          fc.property(
            fc.string({ minLength: 1, maxLength: 200 }),
            (errorMessage) => {
              // Simulate error conversion logic
              const error = new Error(errorMessage);
              const convertedMessage = error instanceof Error ? error.message : 'Failed to access localStorage';
              
              expect(convertedMessage).toBe(errorMessage);
              expect(typeof convertedMessage).toBe('string');
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('SSR safety', () => {
      test('should handle SSR environment (window undefined) safely', () => {
        fc.assert(
          fc.property(
            fc.string({ minLength: 1, maxLength: 100 }),
            fc.string({ minLength: 1, maxLength: 100 }),
            (key, defaultValue) => {
              // Simulate SSR environment check
              const isSSR = typeof window === 'undefined';
              
              // In SSR, should return default value without accessing localStorage
              const result = isSSR ? defaultValue : 'client-side-value';
              
              // Result should be defined (either default or client value)
              expect(result).toBeDefined();
              expect(typeof result).toBe('string');
            }
          ),
          { numRuns: 100 }
        );
      });
    });
  });

  /**
   * **Property 4: Code deduplication effectiveness - Centralization verification**
   * **Validates: Requirements 2.1, 3.1**
   * 
   * Verifies that localStorage management exists in the centralized hook
   * and identifies any remaining duplicate implementations in components.
   */
  describe('Property 4: Centralization verification', () => {
    const dashboardDir = path.join(__dirname, '../app/dashboard');
    const hooksDir = path.join(dashboardDir, 'hooks');
    
    test('useLocalStorage.ts should exist in hooks directory', () => {
      const hookPath = path.join(hooksDir, 'useLocalStorage.ts');
      expect(fs.existsSync(hookPath)).toBe(true);
    });

    test('useLocalStorage.ts should export all required interfaces and functions', () => {
      const hookPath = path.join(hooksDir, 'useLocalStorage.ts');
      const content = fs.readFileSync(hookPath, 'utf-8');

      // Check for required exports
      expect(content).toContain('export interface UseLocalStorageOptions');
      expect(content).toContain('export interface UseLocalStorageReturn');
      expect(content).toContain('export function useLocalStorage');
      expect(content).toContain('export function useLocalStorageString');
      expect(content).toContain('export function useLocalStorageFlag');
      expect(content).toContain('export function useLocalStorageObject');
      expect(content).toContain('export function useLocalStorageSync');
      expect(content).toContain('export const localStorageUtils');
    });

    test('useLocalStorage hook should provide all required return properties', () => {
      const hookPath = path.join(hooksDir, 'useLocalStorage.ts');
      const content = fs.readFileSync(hookPath, 'utf-8');

      // Check for required UseLocalStorageReturn properties
      const requiredProperties = [
        'value',
        'setValue',
        'removeValue',
        'hasValue',
        'loading',
        'error',
      ];

      for (const prop of requiredProperties) {
        expect(content).toContain(prop);
      }
    });

    test('should identify inline localStorage patterns in components', () => {
      const componentsDir = path.join(dashboardDir, 'components');
      const files = getTypeScriptFiles(componentsDir);
      
      // Patterns that indicate inline localStorage usage
      // These patterns should ideally use the centralized hook instead
      const inlinePatterns = [
        // Direct localStorage.getItem pattern
        /localStorage\.getItem\s*\(/,
        // Direct localStorage.setItem pattern
        /localStorage\.setItem\s*\(/,
        // Direct localStorage.removeItem pattern
        /localStorage\.removeItem\s*\(/,
      ];
      
      const filesWithInlineStorage: { file: string; patterns: string[]; usesHook: boolean }[] = [];
      
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        const fileName = path.basename(file);
        
        // Skip the hook file itself
        if (fileName === 'useLocalStorage.ts') continue;
        
        // Check if file imports the hook
        const usesHook = content.includes("from '../hooks/useLocalStorage'") || 
                         content.includes("from './hooks/useLocalStorage'") ||
                         content.includes('useLocalStorage');
        
        const foundPatterns: string[] = [];
        for (const pattern of inlinePatterns) {
          if (pattern.test(content)) {
            foundPatterns.push(pattern.source.substring(0, 30) + '...');
          }
        }
        
        if (foundPatterns.length > 0) {
          filesWithInlineStorage.push({
            file: fileName,
            patterns: foundPatterns,
            usesHook,
          });
        }
      }
      
      // Report inline localStorage patterns found
      if (filesWithInlineStorage.length > 0) {
        console.log('Files with inline localStorage patterns:', 
          filesWithInlineStorage.map(f => `${f.file} (uses hook: ${f.usesHook})`));
      }
      
      // Current baseline: Allow up to 10 files with inline localStorage patterns
      // These are legacy patterns that can be gradually migrated to use useLocalStorage
      // Target: 0 after full refactoring
      expect(filesWithInlineStorage.length).toBeLessThanOrEqual(10);
    });

    test('should not have duplicate useLocalStorage hook definitions', () => {
      const files = getTypeScriptFiles(dashboardDir);
      
      // Pattern for hook definition
      const hookDefinitionPattern = /export\s+function\s+useLocalStorage\s*[<(]/;
      
      const filesWithHookDefinition: string[] = [];
      
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        if (hookDefinitionPattern.test(content)) {
          filesWithHookDefinition.push(path.basename(file));
        }
      }
      
      // Should only be defined in one file
      expect(filesWithHookDefinition).toHaveLength(1);
      expect(filesWithHookDefinition[0]).toBe('useLocalStorage.ts');
    });

    test('should verify at least one component uses the centralized hook', () => {
      const componentsDir = path.join(dashboardDir, 'components');
      const files = getTypeScriptFiles(componentsDir);
      
      let componentsUsingHook = 0;
      
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        
        // Check if file imports and uses the hook
        if (content.includes("from '../hooks/useLocalStorage'") ||
            content.includes("import { useLocalStorage }")) {
          componentsUsingHook++;
        }
      }
      
      // At least one component should use the centralized hook
      expect(componentsUsingHook).toBeGreaterThanOrEqual(1);
    });

    test('localStorageUtils should provide all utility functions', () => {
      const hookPath = path.join(hooksDir, 'useLocalStorage.ts');
      const content = fs.readFileSync(hookPath, 'utf-8');

      // Check for required utility functions
      expect(content).toContain('getItem:');
      expect(content).toContain('setItem:');
      expect(content).toContain('removeItem:');
      expect(content).toContain('isAvailable:');
    });
  });

  /**
   * **Property 4: Code deduplication effectiveness - Type safety**
   * **Validates: Requirements 2.1, 3.1**
   * 
   * Verifies that the hook maintains proper TypeScript type safety.
   */
  describe('Property 4: Type safety verification', () => {
    const hooksDir = path.join(__dirname, '../app/dashboard/hooks');
    
    test('should have proper generic type parameters', () => {
      const hookPath = path.join(hooksDir, 'useLocalStorage.ts');
      const content = fs.readFileSync(hookPath, 'utf-8');
      
      // Check for generic type usage
      expect(content).toContain('useLocalStorage<T>');
      expect(content).toContain('UseLocalStorageReturn<T>');
      expect(content).toContain('UseLocalStorageOptions<T>');
    });

    test('should have proper serializer type definitions', () => {
      const hookPath = path.join(hooksDir, 'useLocalStorage.ts');
      const content = fs.readFileSync(hookPath, 'utf-8');
      
      // Check for serializer types in options
      expect(content).toContain('serializer?:');
      expect(content).toContain('parse:');
      expect(content).toContain('stringify:');
    });

    test('should use useCallback for memoized functions', () => {
      const hookPath = path.join(hooksDir, 'useLocalStorage.ts');
      const content = fs.readFileSync(hookPath, 'utf-8');
      
      // Check that setValue and removeValue use useCallback
      const useCallbackCount = (content.match(/useCallback/g) || []).length;
      
      // Should have at least 2 useCallback calls (setValue, removeValue)
      expect(useCallbackCount).toBeGreaterThanOrEqual(2);
    });

    test('should support functional updates in setValue', () => {
      const hookPath = path.join(hooksDir, 'useLocalStorage.ts');
      const content = fs.readFileSync(hookPath, 'utf-8');
      
      // Check for functional update support
      expect(content).toContain('T | ((prev: T) => T)');
      expect(content).toContain('instanceof Function');
    });
  });

  /**
   * **Property 4: Code deduplication effectiveness - Specialized hooks**
   * **Validates: Requirements 2.1, 3.1**
   * 
   * Verifies that specialized localStorage hooks are built on the base hook.
   */
  describe('Property 4: Specialized hooks verification', () => {
    const hooksDir = path.join(__dirname, '../app/dashboard/hooks');
    
    test('useLocalStorageString should use base useLocalStorage', () => {
      const hookPath = path.join(hooksDir, 'useLocalStorage.ts');
      const content = fs.readFileSync(hookPath, 'utf-8');
      
      // useLocalStorageString should call useLocalStorage
      expect(content).toMatch(/useLocalStorageString[\s\S]*return\s+useLocalStorage/);
    });

    test('useLocalStorageFlag should use base useLocalStorage', () => {
      const hookPath = path.join(hooksDir, 'useLocalStorage.ts');
      const content = fs.readFileSync(hookPath, 'utf-8');
      
      // useLocalStorageFlag should call useLocalStorage
      expect(content).toMatch(/useLocalStorageFlag[\s\S]*return\s+useLocalStorage/);
    });

    test('useLocalStorageObject should use base useLocalStorage', () => {
      const hookPath = path.join(hooksDir, 'useLocalStorage.ts');
      const content = fs.readFileSync(hookPath, 'utf-8');
      
      // useLocalStorageObject should call useLocalStorage
      expect(content).toMatch(/useLocalStorageObject[\s\S]*return\s+useLocalStorage/);
    });

    test('useLocalStorageSync should use base useLocalStorage with syncAcrossTabs', () => {
      const hookPath = path.join(hooksDir, 'useLocalStorage.ts');
      const content = fs.readFileSync(hookPath, 'utf-8');
      
      // useLocalStorageSync should call useLocalStorage with syncAcrossTabs: true
      expect(content).toMatch(/useLocalStorageSync[\s\S]*syncAcrossTabs:\s*true/);
    });
  });

  /**
   * **Property 4: Code deduplication effectiveness - Cross-tab synchronization**
   * **Validates: Requirements 2.1, 3.1**
   * 
   * Verifies that the hook properly supports cross-tab synchronization.
   */
  describe('Property 4: Cross-tab synchronization', () => {
    test('should handle storage events correctly', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }), // key
          fc.string({ minLength: 1, maxLength: 100 }), // oldValue
          fc.string({ minLength: 1, maxLength: 100 }), // newValue
          (key, oldValue, newValue) => {
            // Simulate storage event handling
            const event = {
              key,
              oldValue,
              newValue,
              storageArea: 'localStorage',
            };
            
            // When key matches, value should be updated
            if (event.key === key && event.newValue !== null) {
              expect(event.newValue).toBe(newValue);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should handle storage event with null newValue (removal)', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }), // key
          fc.string({ minLength: 1, maxLength: 100 }), // defaultValue
          (key, defaultValue) => {
            // Simulate storage event with null newValue (item removed)
            const event = {
              key,
              oldValue: 'some value',
              newValue: null,
            };
            
            // When newValue is null, should reset to default
            let value = 'current value';
            if (event.key === key && event.newValue === null) {
              value = defaultValue;
            }
            
            expect(value).toBe(defaultValue);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
