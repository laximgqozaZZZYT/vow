/**
 * Type Safety Property Tests
 * 
 * Property 4: Type Safety
 * Validates that any types are minimized in the codebase.
 * 
 * Requirements: 4.1, 4.2
 */

import * as fs from 'fs';
import * as path from 'path';

// Helper function to recursively get all TypeScript files
function getTypeScriptFiles(dir: string, files: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    // Skip node_modules, .next, and test files
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '__tests__') {
      continue;
    }
    
    if (entry.isDirectory()) {
      getTypeScriptFiles(fullPath, files);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Helper function to count 'any' type usage in a file
function countAnyTypes(filePath: string): { count: number; locations: string[] } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const locations: string[] = [];
  let count = 0;
  
  // Patterns that indicate explicit 'any' type usage
  const anyPatterns = [
    /:\s*any\b/,           // : any
    /as\s+any\b/,          // as any
    /<any>/,               // <any>
    /any\[\]/,             // any[]
    /Promise<any>/,        // Promise<any>
    /Record<[^,]+,\s*any>/, // Record<string, any>
  ];
  
  // Patterns to exclude (false positives)
  const excludePatterns = [
    /isAny/i,              // Variable names like isAnyNodeEditing
    /\/\//,                // Comments
    /\/\*/,                // Block comments
    /\*\//,                // Block comment end
    /'any'/,               // String literal 'any'
    /"any"/,               // String literal "any"
  ];
  
  lines.forEach((line, index) => {
    // Skip if line matches exclude patterns
    if (excludePatterns.some(pattern => pattern.test(line))) {
      return;
    }
    
    for (const pattern of anyPatterns) {
      if (pattern.test(line)) {
        count++;
        locations.push(`Line ${index + 1}: ${line.trim().substring(0, 80)}`);
        break; // Count each line only once
      }
    }
  });
  
  return { count, locations };
}

describe('Type Safety Property Tests', () => {
  const dashboardDir = path.join(__dirname, '../app/dashboard');
  
  describe('Property 4: any type usage is minimized', () => {
    it('should have minimal any types in dashboard types directory', () => {
      const typesDir = path.join(dashboardDir, 'types');
      const files = getTypeScriptFiles(typesDir);
      
      let totalAnyCount = 0;
      const fileResults: { file: string; count: number; locations: string[] }[] = [];
      
      for (const file of files) {
        const result = countAnyTypes(file);
        if (result.count > 0) {
          totalAnyCount += result.count;
          fileResults.push({
            file: path.relative(typesDir, file),
            count: result.count,
            locations: result.locations,
          });
        }
      }
      
      // Log results for debugging
      if (fileResults.length > 0) {
        console.log('Files with any types in types directory:');
        fileResults.forEach(({ file, count, locations }) => {
          console.log(`  ${file}: ${count} occurrences`);
          locations.forEach(loc => console.log(`    ${loc}`));
        });
      }
      
      // Allow up to 5 any types in types directory (for edge cases)
      // This threshold should be reduced in future refactoring phases
      expect(totalAnyCount).toBeLessThanOrEqual(5);
    });
    
    it('should have minimal any types in dashboard hooks directory', () => {
      const hooksDir = path.join(dashboardDir, 'hooks');
      const files = getTypeScriptFiles(hooksDir);
      
      let totalAnyCount = 0;
      const fileResults: { file: string; count: number; locations: string[] }[] = [];
      
      for (const file of files) {
        const result = countAnyTypes(file);
        if (result.count > 0) {
          totalAnyCount += result.count;
          fileResults.push({
            file: path.relative(hooksDir, file),
            count: result.count,
            locations: result.locations,
          });
        }
      }
      
      // Log results for debugging
      if (fileResults.length > 0) {
        console.log('Files with any types in hooks directory:');
        fileResults.forEach(({ file, count, locations }) => {
          console.log(`  ${file}: ${count} occurrences`);
          locations.forEach(loc => console.log(`    ${loc}`));
        });
      }
      
      // Allow up to 35 any types in hooks directory (for complex callback types)
      // This threshold should be reduced in future refactoring phases
      expect(totalAnyCount).toBeLessThanOrEqual(35);
    });
    
    it('should have minimal any types in Mindmap components', () => {
      const componentsDir = path.join(dashboardDir, 'components');
      const mindmapFiles = getTypeScriptFiles(componentsDir).filter(
        file => path.basename(file).includes('Mindmap')
      );
      
      let totalAnyCount = 0;
      const fileResults: { file: string; count: number; locations: string[] }[] = [];
      
      for (const file of mindmapFiles) {
        const result = countAnyTypes(file);
        if (result.count > 0) {
          totalAnyCount += result.count;
          fileResults.push({
            file: path.relative(componentsDir, file),
            count: result.count,
            locations: result.locations,
          });
        }
      }
      
      // Log results for debugging
      if (fileResults.length > 0) {
        console.log('Files with any types in Mindmap components:');
        fileResults.forEach(({ file, count, locations }) => {
          console.log(`  ${file}: ${count} occurrences`);
          locations.forEach(loc => console.log(`    ${loc}`));
        });
      }
      
      // Allow up to 55 any types in Mindmap components (large files with complex types)
      // This threshold should be reduced in future refactoring phases
      expect(totalAnyCount).toBeLessThanOrEqual(55);
    });
  });
  
  describe('Property 4.2: Type definitions are properly exported', () => {
    it('should export all necessary types from types/index.ts', () => {
      const indexPath = path.join(dashboardDir, 'types/index.ts');
      const content = fs.readFileSync(indexPath, 'utf-8');
      
      // Check for essential type exports
      const essentialTypes = [
        'Goal',
        'Habit',
        'Activity',
        'Tag',
        'AuthContext',
        'Mindmap',
        'MindmapNode',
        'MindmapConnection',
      ];
      
      for (const typeName of essentialTypes) {
        const exportPattern = new RegExp(`export\\s+(interface|type)\\s+${typeName}\\b`);
        expect(content).toMatch(exportPattern);
      }
    });
    
    it('should export all necessary types from types/mindmap.types.ts', () => {
      const mindmapTypesPath = path.join(dashboardDir, 'types/mindmap.types.ts');
      const content = fs.readFileSync(mindmapTypesPath, 'utf-8');
      
      // Check for essential mindmap type exports
      const essentialTypes = [
        'MindmapProps',
        'CustomNodeData',
        'ConnectionMode',
        'ModalState',
        'MindmapData',
        'MindmapSavePayload',
      ];
      
      for (const typeName of essentialTypes) {
        const exportPattern = new RegExp(`export\\s+(interface|type)\\s+${typeName}\\b`);
        expect(content).toMatch(exportPattern);
      }
    });
  });
});
