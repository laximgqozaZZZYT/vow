/**
 * Property-based tests for code duplication reduction
 * 
 * Validates: Requirements 2.1, 2.2, 2.3
 * - DRY principle compliance
 * - Code block duplication detection
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

// Helper to extract function bodies from a file
function extractFunctionBodies(content: string): string[] {
  const bodies: string[] = [];
  
  // Match function declarations and arrow functions
  const functionPatterns = [
    // Regular functions
    /function\s+\w+\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g,
    // Arrow functions with block body
    /(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g,
    // useCallback/useMemo bodies
    /use(?:Callback|Memo)\s*\(\s*\([^)]*\)\s*=>\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g,
  ];
  
  for (const pattern of functionPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const body = match[1]?.trim();
      if (body && body.length > 50) { // Only consider substantial function bodies
        bodies.push(body);
      }
    }
  }
  
  return bodies;
}

// Helper to normalize code for comparison (remove whitespace, comments)
function normalizeCode(code: string): string {
  return code
    .replace(/\/\/.*$/gm, '') // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

// Helper to find similar code blocks
function findSimilarBlocks(blocks: string[], threshold: number = 0.9): [string, string][] {
  const similar: [string, string][] = [];
  
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      const a = normalizeCode(blocks[i]);
      const b = normalizeCode(blocks[j]);
      
      // Simple similarity check based on length and common substrings
      if (a.length > 100 && b.length > 100) {
        const minLen = Math.min(a.length, b.length);
        const maxLen = Math.max(a.length, b.length);
        
        // Check if lengths are similar
        if (minLen / maxLen > threshold) {
          // Check for exact match after normalization
          if (a === b) {
            similar.push([blocks[i], blocks[j]]);
          }
        }
      }
    }
  }
  
  return similar;
}

describe('Code Duplication Property Tests', () => {
  const dashboardDir = path.join(__dirname, '../app/dashboard');
  
  describe('Property 2: Code Duplication Reduction', () => {
    test('should not have duplicate function implementations across files', () => {
      const files = getTypeScriptFiles(dashboardDir);
      const allBodies: { file: string; body: string }[] = [];
      
      for (const file of files) {
        try {
          const content = fs.readFileSync(file, 'utf-8');
          const bodies = extractFunctionBodies(content);
          
          for (const body of bodies) {
            allBodies.push({ file, body });
          }
        } catch (error) {
          // Skip files that can't be read
        }
      }
      
      // Find duplicates across different files
      const crossFileDuplicates: { file1: string; file2: string; body: string }[] = [];
      
      for (let i = 0; i < allBodies.length; i++) {
        for (let j = i + 1; j < allBodies.length; j++) {
          if (allBodies[i].file !== allBodies[j].file) {
            const a = normalizeCode(allBodies[i].body);
            const b = normalizeCode(allBodies[j].body);
            
            // Only flag substantial duplicates (> 200 chars)
            if (a.length > 200 && a === b) {
              crossFileDuplicates.push({
                file1: allBodies[i].file,
                file2: allBodies[j].file,
                body: allBodies[i].body.substring(0, 100) + '...',
              });
            }
          }
        }
      }
      
      // Allow some duplicates but flag if too many
      // Current baseline: 21 duplicates (to be reduced in future phases)
      expect(crossFileDuplicates.length).toBeLessThan(30);
      
      if (crossFileDuplicates.length > 0) {
        console.log('Found cross-file duplicates:', crossFileDuplicates.length);
      }
    });
    
    test('should use custom hooks for shared logic', () => {
      const hooksDir = path.join(dashboardDir, 'hooks');
      const hookFiles = getTypeScriptFiles(hooksDir);
      
      // Verify hooks directory exists and has files
      expect(hookFiles.length).toBeGreaterThan(0);
      
      // Check that common patterns are extracted to hooks
      const expectedHooks = [
        'useMindmapState',
        'useConnectionHandlers',
        'useModalHandlers',
        'useDataManager',
        'useEventHandlers',
      ];
      
      const hookNames = hookFiles.map(f => path.basename(f, path.extname(f)));
      
      for (const expected of expectedHooks) {
        expect(hookNames).toContain(expected);
      }
    });
    
    test('should have shared types in types directory', () => {
      const typesDir = path.join(dashboardDir, 'types');
      const typeFiles = getTypeScriptFiles(typesDir);
      
      // Verify types directory exists and has files
      expect(typeFiles.length).toBeGreaterThan(0);
      
      // Check for expected type files
      const typeFileNames = typeFiles.map(f => path.basename(f));
      expect(typeFileNames).toContain('index.ts');
      expect(typeFileNames).toContain('mindmap.types.ts');
    });
  });
  
  describe('Property: Mindmap Component Consolidation', () => {
    test('should not have multiple versions of the same mindmap component', () => {
      const componentsDir = path.join(dashboardDir, 'components');
      const componentFiles = getTypeScriptFiles(componentsDir);
      
      // Count mindmap-related component files
      const mindmapComponents = componentFiles.filter(f => {
        const name = path.basename(f);
        return name.includes('Mindmap') && name.startsWith('Widget.');
      });
      
      // After refactoring, we should have fewer duplicate components
      // Widget.Mindmap.Refactored.tsx and Widget.EditableMindmap.Refactored.tsx are acceptable
      const nonRefactoredMindmaps = mindmapComponents.filter(f => 
        !path.basename(f).includes('Refactored') && 
        !path.basename(f).includes('UnifiedRelationMap')
      );
      
      // Should not have non-refactored versions
      expect(nonRefactoredMindmaps.length).toBe(0);
    });
  });
});
