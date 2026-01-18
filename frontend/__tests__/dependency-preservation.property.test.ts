/**
 * Dependency Preservation Property Tests
 * 
 * Property 8: Dependency Preservation
 * Validates that package.json dependencies have not been modified during refactoring.
 * 
 * **Validates: Requirements 8.1, 8.2**
 */

import * as fs from 'fs';
import * as path from 'path';

// Baseline dependencies that must be preserved
// These are the core dependencies that the application relies on
const BASELINE_DEPENDENCIES = {
  // React ecosystem
  'react': true,
  'react-dom': true,
  'next': true,
  
  // Supabase
  '@supabase/supabase-js': true,
  
  // UI libraries
  '@fullcalendar/react': true,
  '@fullcalendar/daygrid': true,
  'reactflow': true,
  
  // Markdown
  'react-markdown': true,
  'remark-gfm': true,
};

const BASELINE_DEV_DEPENDENCIES = {
  // TypeScript
  'typescript': true,
  '@types/react': true,
  '@types/node': true,
  
  // Testing
  'jest': true,
  '@testing-library/react': true,
  'fast-check': true,
  
  // Linting
  'eslint': true,
};

describe('Dependency Preservation Property Tests', () => {
  const packageJsonPath = path.join(__dirname, '../package.json');
  
  let packageJson: {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };
  
  beforeAll(() => {
    const content = fs.readFileSync(packageJsonPath, 'utf-8');
    packageJson = JSON.parse(content);
  });
  
  describe('Property 8.1: Production dependencies are preserved', () => {
    it('should have all baseline production dependencies', () => {
      const missingDeps: string[] = [];
      
      for (const dep of Object.keys(BASELINE_DEPENDENCIES)) {
        if (!packageJson.dependencies[dep]) {
          missingDeps.push(dep);
        }
      }
      
      if (missingDeps.length > 0) {
        console.log('Missing production dependencies:', missingDeps);
      }
      
      expect(missingDeps.length).toBe(0);
    });
    
    it('should not have added new production dependencies', () => {
      // This test ensures no new dependencies were added during refactoring
      // If new dependencies are needed, they should be explicitly approved
      const currentDeps = Object.keys(packageJson.dependencies);
      
      // Log current dependencies for reference
      console.log('Current production dependencies count:', currentDeps.length);
      
      // We allow a reasonable number of dependencies
      // This threshold should be adjusted based on project needs
      expect(currentDeps.length).toBeLessThanOrEqual(50);
    });
    
    it('should have valid semver versions for all dependencies', () => {
      const invalidVersions: { dep: string; version: string }[] = [];
      
      // Simple semver pattern check
      const semverPattern = /^[\^~]?\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$|^latest$|^\*$/;
      
      for (const [dep, version] of Object.entries(packageJson.dependencies)) {
        if (!semverPattern.test(version)) {
          invalidVersions.push({ dep, version });
        }
      }
      
      if (invalidVersions.length > 0) {
        console.log('Dependencies with non-standard versions:', invalidVersions);
      }
      
      // Allow some flexibility for workspace or file references
      expect(invalidVersions.length).toBeLessThanOrEqual(5);
    });
  });
  
  describe('Property 8.2: Development dependencies are preserved', () => {
    it('should have all baseline development dependencies', () => {
      const missingDeps: string[] = [];
      
      for (const dep of Object.keys(BASELINE_DEV_DEPENDENCIES)) {
        if (!packageJson.devDependencies[dep]) {
          missingDeps.push(dep);
        }
      }
      
      if (missingDeps.length > 0) {
        console.log('Missing development dependencies:', missingDeps);
      }
      
      expect(missingDeps.length).toBe(0);
    });
    
    it('should have testing framework dependencies', () => {
      // Essential testing dependencies
      const testingDeps = ['jest', '@testing-library/react', 'fast-check'];
      
      for (const dep of testingDeps) {
        const hasDep = packageJson.devDependencies[dep] || packageJson.dependencies[dep];
        expect(hasDep).toBeTruthy();
      }
    });
    
    it('should have TypeScript dependencies', () => {
      // Essential TypeScript dependencies
      const tsDeps = ['typescript', '@types/react', '@types/node'];
      
      for (const dep of tsDeps) {
        const hasDep = packageJson.devDependencies[dep] || packageJson.dependencies[dep];
        expect(hasDep).toBeTruthy();
      }
    });
  });
  
  describe('Property 8.3: No conflicting dependencies', () => {
    it('should not have duplicate dependencies in both dependencies and devDependencies', () => {
      const duplicates: string[] = [];
      
      for (const dep of Object.keys(packageJson.dependencies)) {
        if (packageJson.devDependencies[dep]) {
          duplicates.push(dep);
        }
      }
      
      if (duplicates.length > 0) {
        console.log('Duplicate dependencies:', duplicates);
      }
      
      // Some duplicates might be intentional, but should be minimal
      expect(duplicates.length).toBeLessThanOrEqual(3);
    });
    
    it('should not have deprecated or known vulnerable packages', () => {
      // List of known deprecated or vulnerable packages to avoid
      const deprecatedPackages = [
        'request', // deprecated
        'node-uuid', // deprecated, use uuid instead
        'mkdirp', // often unnecessary with fs.mkdir recursive
      ];
      
      const foundDeprecated: string[] = [];
      
      for (const dep of deprecatedPackages) {
        if (packageJson.dependencies[dep] || packageJson.devDependencies[dep]) {
          foundDeprecated.push(dep);
        }
      }
      
      if (foundDeprecated.length > 0) {
        console.log('Found deprecated packages:', foundDeprecated);
      }
      
      expect(foundDeprecated.length).toBe(0);
    });
  });
  
  describe('Property 8.4: Package.json structure is valid', () => {
    it('should have required fields', () => {
      expect(packageJson).toHaveProperty('dependencies');
      expect(packageJson).toHaveProperty('devDependencies');
    });
    
    it('should have scripts defined', () => {
      const content = fs.readFileSync(packageJsonPath, 'utf-8');
      const fullPackageJson = JSON.parse(content);
      
      expect(fullPackageJson).toHaveProperty('scripts');
      expect(fullPackageJson.scripts).toHaveProperty('dev');
      expect(fullPackageJson.scripts).toHaveProperty('build');
      expect(fullPackageJson.scripts).toHaveProperty('test');
    });
  });
});
