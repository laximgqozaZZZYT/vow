/**
 * Modern Syntax Compliance Property Tests
 * 
 * Property 6: Modern Syntax Compliance
 * Validates that the codebase follows ES6+ modern syntax standards.
 * 
 * **Validates: Requirements 6.1, 6.2**
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

// Helper function to count var declarations in a file
function countVarDeclarations(filePath: string): { count: number; locations: string[] } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const locations: string[] = [];
  let count = 0;
  
  // Pattern for var declarations
  const varPattern = /\bvar\s+\w+\s*=/;
  
  // Patterns to exclude (false positives)
  const excludePatterns = [
    /\/\//,                // Single-line comments
    /\/\*/,                // Block comments start
    /\*\//,                // Block comment end
    /'var'/,               // String literal 'var'
    /"var"/,               // String literal "var"
    /`var`/,               // Template literal `var`
  ];
  
  lines.forEach((line, index) => {
    // Skip if line matches exclude patterns
    if (excludePatterns.some(pattern => pattern.test(line))) {
      return;
    }
    
    if (varPattern.test(line)) {
      count++;
      locations.push(`Line ${index + 1}: ${line.trim().substring(0, 80)}`);
    }
  });
  
  return { count, locations };
}

// Helper function to check for modern syntax usage
function checkModernSyntaxUsage(filePath: string): {
  hasOptionalChaining: boolean;
  hasNullishCoalescing: boolean;
  hasTemplateStrings: boolean;
  hasArrowFunctions: boolean;
  hasDestructuring: boolean;
} {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  return {
    hasOptionalChaining: /\?\.\w+/.test(content) || /\?\.\[/.test(content),
    hasNullishCoalescing: /\?\?/.test(content),
    hasTemplateStrings: /`[^`]*\$\{[^}]+\}[^`]*`/.test(content),
    hasArrowFunctions: /=>\s*[{(]/.test(content) || /=>\s*\w/.test(content),
    hasDestructuring: /const\s*\{[^}]+\}\s*=/.test(content) || /const\s*\[[^\]]+\]\s*=/.test(content),
  };
}

describe('Modern Syntax Compliance Property Tests', () => {
  const frontendDir = path.join(__dirname, '..');
  const dashboardDir = path.join(frontendDir, 'app/dashboard');
  
  describe('Property 6.1: No var declarations', () => {
    it('should have no var declarations in dashboard components', () => {
      const componentsDir = path.join(dashboardDir, 'components');
      const files = getTypeScriptFiles(componentsDir);
      
      let totalVarCount = 0;
      const fileResults: { file: string; count: number; locations: string[] }[] = [];
      
      for (const file of files) {
        const result = countVarDeclarations(file);
        if (result.count > 0) {
          totalVarCount += result.count;
          fileResults.push({
            file: path.relative(componentsDir, file),
            count: result.count,
            locations: result.locations,
          });
        }
      }
      
      // Log results for debugging
      if (fileResults.length > 0) {
        console.log('Files with var declarations in components:');
        fileResults.forEach(({ file, count, locations }) => {
          console.log(`  ${file}: ${count} occurrences`);
          locations.forEach(loc => console.log(`    ${loc}`));
        });
      }
      
      // No var declarations should exist
      expect(totalVarCount).toBe(0);
    });
    
    it('should have no var declarations in dashboard hooks', () => {
      const hooksDir = path.join(dashboardDir, 'hooks');
      const files = getTypeScriptFiles(hooksDir);
      
      let totalVarCount = 0;
      const fileResults: { file: string; count: number; locations: string[] }[] = [];
      
      for (const file of files) {
        const result = countVarDeclarations(file);
        if (result.count > 0) {
          totalVarCount += result.count;
          fileResults.push({
            file: path.relative(hooksDir, file),
            count: result.count,
            locations: result.locations,
          });
        }
      }
      
      // Log results for debugging
      if (fileResults.length > 0) {
        console.log('Files with var declarations in hooks:');
        fileResults.forEach(({ file, count, locations }) => {
          console.log(`  ${file}: ${count} occurrences`);
          locations.forEach(loc => console.log(`    ${loc}`));
        });
      }
      
      // No var declarations should exist
      expect(totalVarCount).toBe(0);
    });
    
    it('should have no var declarations in lib directory', () => {
      const libDir = path.join(frontendDir, 'lib');
      const files = getTypeScriptFiles(libDir);
      
      let totalVarCount = 0;
      const fileResults: { file: string; count: number; locations: string[] }[] = [];
      
      for (const file of files) {
        const result = countVarDeclarations(file);
        if (result.count > 0) {
          totalVarCount += result.count;
          fileResults.push({
            file: path.relative(libDir, file),
            count: result.count,
            locations: result.locations,
          });
        }
      }
      
      // Log results for debugging
      if (fileResults.length > 0) {
        console.log('Files with var declarations in lib:');
        fileResults.forEach(({ file, count, locations }) => {
          console.log(`  ${file}: ${count} occurrences`);
          locations.forEach(loc => console.log(`    ${loc}`));
        });
      }
      
      // No var declarations should exist
      expect(totalVarCount).toBe(0);
    });
  });
  
  describe('Property 6.2: Modern syntax features are used', () => {
    it('should use modern syntax in dashboard components', () => {
      const componentsDir = path.join(dashboardDir, 'components');
      const files = getTypeScriptFiles(componentsDir);
      
      let filesWithModernSyntax = 0;
      let totalFiles = 0;
      
      for (const file of files) {
        totalFiles++;
        const usage = checkModernSyntaxUsage(file);
        
        // A file is considered modern if it uses at least 2 modern features
        const modernFeatureCount = [
          usage.hasOptionalChaining,
          usage.hasNullishCoalescing,
          usage.hasTemplateStrings,
          usage.hasArrowFunctions,
          usage.hasDestructuring,
        ].filter(Boolean).length;
        
        if (modernFeatureCount >= 2) {
          filesWithModernSyntax++;
        }
      }
      
      // At least 80% of files should use modern syntax
      const modernSyntaxRatio = filesWithModernSyntax / totalFiles;
      expect(modernSyntaxRatio).toBeGreaterThanOrEqual(0.8);
    });
    
    it('should use arrow functions in hooks', () => {
      const hooksDir = path.join(dashboardDir, 'hooks');
      const files = getTypeScriptFiles(hooksDir);
      
      let filesWithArrowFunctions = 0;
      
      for (const file of files) {
        const usage = checkModernSyntaxUsage(file);
        if (usage.hasArrowFunctions) {
          filesWithArrowFunctions++;
        }
      }
      
      // At least 90% of hook files should use arrow functions
      const arrowFunctionRatio = filesWithArrowFunctions / files.length;
      expect(arrowFunctionRatio).toBeGreaterThanOrEqual(0.9);
    });
    
    it('should use destructuring in components', () => {
      const componentsDir = path.join(dashboardDir, 'components');
      const files = getTypeScriptFiles(componentsDir);
      
      let filesWithDestructuring = 0;
      
      for (const file of files) {
        const usage = checkModernSyntaxUsage(file);
        if (usage.hasDestructuring) {
          filesWithDestructuring++;
        }
      }
      
      // At least 70% of component files should use destructuring
      // Some smaller utility files may not need destructuring
      const destructuringRatio = filesWithDestructuring / files.length;
      expect(destructuringRatio).toBeGreaterThanOrEqual(0.7);
    });
  });
  
  describe('Property 6.3: No backup files exist', () => {
    it('should have no .bak files in the codebase', () => {
      const findBackupFiles = (dir: string, files: string[] = []): string[] => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          // Skip node_modules and .next
          if (entry.name === 'node_modules' || entry.name === '.next') {
            continue;
          }
          
          if (entry.isDirectory()) {
            findBackupFiles(fullPath, files);
          } else if (entry.isFile() && entry.name.endsWith('.bak')) {
            files.push(fullPath);
          }
        }
        
        return files;
      };
      
      const backupFiles = findBackupFiles(frontendDir);
      
      // Log results for debugging
      if (backupFiles.length > 0) {
        console.log('Backup files found:');
        backupFiles.forEach(file => console.log(`  ${path.relative(frontendDir, file)}`));
      }
      
      // No backup files should exist
      expect(backupFiles.length).toBe(0);
    });
  });
});
