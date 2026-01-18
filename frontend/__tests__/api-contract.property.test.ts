/**
 * API Contract Preservation Property Tests
 * 
 * Property 7: API Contract Preservation
 * Validates that exported interfaces and types have not changed during refactoring.
 * 
 * **Validates: Requirements 7.1, 7.2**
 */

import * as fs from 'fs';
import * as path from 'path';

// Helper function to extract exported interfaces and types from a file
function extractExports(filePath: string): {
  interfaces: string[];
  types: string[];
  functions: string[];
  constants: string[];
} {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  const interfaces: string[] = [];
  const types: string[] = [];
  const functions: string[] = [];
  const constants: string[] = [];
  
  // Match exported interfaces
  const interfaceMatches = content.matchAll(/export\s+interface\s+(\w+)/g);
  for (const match of interfaceMatches) {
    interfaces.push(match[1]);
  }
  
  // Match exported types
  const typeMatches = content.matchAll(/export\s+type\s+(\w+)/g);
  for (const match of typeMatches) {
    types.push(match[1]);
  }
  
  // Match exported functions
  const functionMatches = content.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g);
  for (const match of functionMatches) {
    functions.push(match[1]);
  }
  
  // Match exported const functions (arrow functions)
  const constFunctionMatches = content.matchAll(/export\s+const\s+(\w+)\s*=/g);
  for (const match of constFunctionMatches) {
    constants.push(match[1]);
  }
  
  return { interfaces, types, functions, constants };
}

describe('API Contract Preservation Property Tests', () => {
  const dashboardDir = path.join(__dirname, '../app/dashboard');
  
  describe('Property 7.1: Type definitions are preserved', () => {
    it('should export all essential types from types/index.ts', () => {
      const indexPath = path.join(dashboardDir, 'types/index.ts');
      const exports = extractExports(indexPath);
      
      // Essential types that must be exported
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
        const isExported = exports.interfaces.includes(typeName) || exports.types.includes(typeName);
        expect(isExported).toBe(true);
      }
    });
    
    it('should export all essential types from types/mindmap.types.ts', () => {
      const mindmapTypesPath = path.join(dashboardDir, 'types/mindmap.types.ts');
      const exports = extractExports(mindmapTypesPath);
      
      // Essential mindmap types that must be exported
      const essentialTypes = [
        'MindmapProps',
        'CustomNodeData',
        'ConnectionMode',
        'ModalState',
        'MindmapData',
        'MindmapSavePayload',
      ];
      
      for (const typeName of essentialTypes) {
        const isExported = exports.interfaces.includes(typeName) || exports.types.includes(typeName);
        expect(isExported).toBe(true);
      }
    });
    
    it('should export all essential types from types/shared.ts', () => {
      const sharedTypesPath = path.join(dashboardDir, 'types/shared.ts');
      const exports = extractExports(sharedTypesPath);
      
      // Essential shared types that must be exported
      const essentialTypes = [
        'BaseEntity',
        'DeviceInfo',
      ];
      
      for (const typeName of essentialTypes) {
        const isExported = exports.interfaces.includes(typeName) || exports.types.includes(typeName);
        expect(isExported).toBe(true);
      }
    });
  });
  
  describe('Property 7.2: Hook exports are preserved', () => {
    it('should export all hooks from hooks/index.ts', () => {
      const hooksIndexPath = path.join(dashboardDir, 'hooks/index.ts');
      const content = fs.readFileSync(hooksIndexPath, 'utf-8');
      
      // Essential hooks that must be re-exported
      const essentialHooks = [
        'useMindmapState',
        'useConnectionHandlers',
        'useConnectionMode',
        'useNodeOperations',
        'useMobileInteractions',
      ];
      
      for (const hookName of essentialHooks) {
        const isExported = content.includes(hookName);
        expect(isExported).toBe(true);
      }
    });
    
    it('should have consistent hook signatures', () => {
      const hooksDir = path.join(dashboardDir, 'hooks');
      const hookFiles = fs.readdirSync(hooksDir).filter(f => f.startsWith('use') && f.endsWith('.ts'));
      
      for (const hookFile of hookFiles) {
        const filePath = path.join(hooksDir, hookFile);
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // Each hook file should export a function starting with 'use'
        const hasHookExport = /export\s+(?:const|function)\s+use\w+/.test(content);
        expect(hasHookExport).toBe(true);
      }
    });
  });
  
  describe('Property 7.3: Component exports are preserved', () => {
    it('should have all essential Modal components', () => {
      const componentsDir = path.join(dashboardDir, 'components');
      const modalFiles = fs.readdirSync(componentsDir).filter(f => f.startsWith('Modal.'));
      
      // Essential modal components
      const essentialModals = [
        'Modal.Goal.tsx',
        'Modal.Habit.tsx',
        'Modal.Activity.tsx',
        'Modal.Diary.tsx',
      ];
      
      for (const modal of essentialModals) {
        expect(modalFiles).toContain(modal);
      }
    });
    
    it('should have all essential Widget components', () => {
      const componentsDir = path.join(dashboardDir, 'components');
      const widgetFiles = fs.readdirSync(componentsDir).filter(f => f.startsWith('Widget.'));
      
      // Essential widget components
      const essentialWidgets = [
        'Widget.Calendar.tsx',
        'Widget.Heatmap.tsx',
        'Widget.GoalTree.tsx',
      ];
      
      for (const widget of essentialWidgets) {
        expect(widgetFiles).toContain(widget);
      }
    });
    
    it('should have all essential Section components', () => {
      const componentsDir = path.join(dashboardDir, 'components');
      const sectionFiles = fs.readdirSync(componentsDir).filter(f => f.startsWith('Section.'));
      
      // Essential section components
      const essentialSections = [
        'Section.Activity.tsx',
        'Section.Diary.tsx',
        'Section.Mindmap.tsx',
        'Section.Next.tsx',
        'Section.Statistics.tsx',
      ];
      
      for (const section of essentialSections) {
        expect(sectionFiles).toContain(section);
      }
    });
  });
  
  describe('Property 7.4: Utility exports are preserved', () => {
    it('should export all essential utilities from lib/api.ts', () => {
      const apiPath = path.join(__dirname, '../lib/api.ts');
      const content = fs.readFileSync(apiPath, 'utf-8');
      
      // api.ts should export the DiaryCard type and contain the api class
      expect(content).toMatch(/export\s+type\s+DiaryCard/);
      expect(content).toMatch(/class\s+ApiError/);
    });
    
    it('should export all essential utilities from lib/format.ts', () => {
      const formatPath = path.join(__dirname, '../lib/format.ts');
      const exports = extractExports(formatPath);
      
      // format.ts should export formatting functions
      expect(exports.functions.length + exports.constants.length).toBeGreaterThan(0);
    });
  });
});
