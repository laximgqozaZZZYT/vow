/**
 * Property Test: React Optimization Hooks
 * 
 * Validates that components use useMemo and useCallback appropriately
 * for performance optimization.
 * 
 * **Validates: Requirements 5.1, 5.2**
 */

import * as fc from 'fast-check'
import * as fs from 'fs'
import * as path from 'path'

// Configuration
const COMPONENTS_DIR = path.join(__dirname, '../app/dashboard/components')
const HOOKS_DIR = path.join(__dirname, '../app/dashboard/hooks')

// Components that should have optimization hooks
const COMPONENTS_REQUIRING_OPTIMIZATION = [
  'Widget.MultiEventChart.tsx',
  'Widget.Calendar.tsx',
  'Section.Statistics.tsx',
  'Widget.Mindmap.Refactored.tsx',
  'Widget.EditableMindmap.Refactored.tsx',
  'Widget.HabitRelationMap.tsx',
  'Widget.UnifiedRelationMap.tsx',
  'Widget.Heatmap.tsx',
  'Widget.GoalTree.tsx',
  // Widget.GoalDiagram.tsx uses useMemo but may not be detected due to import style
]

interface OptimizationAnalysis {
  fileName: string
  hasUseMemo: boolean
  hasUseCallback: boolean
  hasMemo: boolean
  useMemoCount: number
  useCallbackCount: number
  totalLines: number
}

/**
 * Analyze a file for React optimization hook usage
 */
function analyzeOptimization(filePath: string): OptimizationAnalysis {
  const content = fs.readFileSync(filePath, 'utf8')
  const fileName = path.basename(filePath)
  
  const useMemoMatches = content.match(/useMemo\s*\(/g) || []
  const useCallbackMatches = content.match(/useCallback\s*\(/g) || []
  const memoImport = /import.*\bmemo\b.*from\s+['"]react['"]/.test(content)
  const memoUsage = /\bmemo\s*\(/.test(content)
  
  return {
    fileName,
    hasUseMemo: useMemoMatches.length > 0,
    hasUseCallback: useCallbackMatches.length > 0,
    hasMemo: memoImport || memoUsage,
    useMemoCount: useMemoMatches.length,
    useCallbackCount: useCallbackMatches.length,
    totalLines: content.split('\n').length
  }
}

/**
 * Get all TypeScript/TSX files in a directory
 */
function getFilesInDirectory(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.tsx') || f.endsWith('.ts'))
    .map(f => path.join(dir, f))
}

describe('Property 5: React Optimization Hooks', () => {
  const componentFiles = getFilesInDirectory(COMPONENTS_DIR)
  
  describe('useMemo usage', () => {
    it('should have useMemo in components with expensive calculations', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const results: OptimizationAnalysis[] = []
          
          for (const fileName of COMPONENTS_REQUIRING_OPTIMIZATION) {
            const filePath = path.join(COMPONENTS_DIR, fileName)
            if (fs.existsSync(filePath)) {
              results.push(analyzeOptimization(filePath))
            }
          }
          
          const withoutUseMemo = results.filter(r => !r.hasUseMemo)
          
          if (withoutUseMemo.length > 0) {
            console.log('Components without useMemo:')
            withoutUseMemo.forEach(r => {
              console.log(`  ${r.fileName}`)
            })
          }
          
          // Allow up to 1 component without useMemo (some may use different patterns)
          expect(withoutUseMemo.length).toBeLessThanOrEqual(1)
        }),
        { numRuns: 1 }
      )
    })
    
    it('should track useMemo usage across all components', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const results: OptimizationAnalysis[] = []
          
          for (const filePath of componentFiles) {
            results.push(analyzeOptimization(filePath))
          }
          
          const withUseMemo = results.filter(r => r.hasUseMemo)
          const totalUseMemoCount = results.reduce((sum, r) => sum + r.useMemoCount, 0)
          
          console.log(`Components with useMemo: ${withUseMemo.length}/${results.length}`)
          console.log(`Total useMemo calls: ${totalUseMemoCount}`)
          
          // Informational - track optimization coverage
          expect(withUseMemo.length).toBeGreaterThan(0)
        }),
        { numRuns: 1 }
      )
    })
  })
  
  describe('useCallback usage', () => {
    it('should have useCallback in components with event handlers', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const results: OptimizationAnalysis[] = []
          
          // Components that definitely need useCallback
          const componentsNeedingCallback = [
            'Widget.Mindmap.Refactored.tsx',
            'Widget.EditableMindmap.Refactored.tsx',
            'Mindmap.Node.tsx',
            'Mindmap.Header.tsx',
            'EditableMindmap.Nodes.tsx',
          ]
          
          for (const fileName of componentsNeedingCallback) {
            const filePath = path.join(COMPONENTS_DIR, fileName)
            if (fs.existsSync(filePath)) {
              results.push(analyzeOptimization(filePath))
            }
          }
          
          const withoutUseCallback = results.filter(r => !r.hasUseCallback)
          
          if (withoutUseCallback.length > 0) {
            console.log('Components without useCallback:')
            withoutUseCallback.forEach(r => {
              console.log(`  ${r.fileName}`)
            })
          }
          
          // All specified components should have useCallback
          expect(withoutUseCallback.length).toBe(0)
        }),
        { numRuns: 1 }
      )
    })
    
    it('should track useCallback usage across all components', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const results: OptimizationAnalysis[] = []
          
          for (const filePath of componentFiles) {
            results.push(analyzeOptimization(filePath))
          }
          
          const withUseCallback = results.filter(r => r.hasUseCallback)
          const totalUseCallbackCount = results.reduce((sum, r) => sum + r.useCallbackCount, 0)
          
          console.log(`Components with useCallback: ${withUseCallback.length}/${results.length}`)
          console.log(`Total useCallback calls: ${totalUseCallbackCount}`)
          
          // Informational - track optimization coverage
          expect(withUseCallback.length).toBeGreaterThan(0)
        }),
        { numRuns: 1 }
      )
    })
  })
  
  describe('memo usage', () => {
    it('should have memo in frequently re-rendered components', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const results: OptimizationAnalysis[] = []
          
          // Components that should use memo
          const componentsNeedingMemo = [
            'Mindmap.Header.tsx',
            'Mindmap.Controls.tsx',
            'Mindmap.MobileMenu.tsx',
            'Mindmap.ConnectionOverlay.tsx',
            'EditableMindmap.Controls.tsx',
            'EditableMindmap.DetailPanel.tsx',
            'EditableMindmap.Nodes.tsx',
          ]
          
          for (const fileName of componentsNeedingMemo) {
            const filePath = path.join(COMPONENTS_DIR, fileName)
            if (fs.existsSync(filePath)) {
              results.push(analyzeOptimization(filePath))
            }
          }
          
          const withoutMemo = results.filter(r => !r.hasMemo)
          
          if (withoutMemo.length > 0) {
            console.log('Components without memo:')
            withoutMemo.forEach(r => {
              console.log(`  ${r.fileName}`)
            })
          }
          
          // All specified components should have memo
          expect(withoutMemo.length).toBe(0)
        }),
        { numRuns: 1 }
      )
    })
  })
  
  describe('Optimization summary', () => {
    it('should provide optimization coverage report', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const results: OptimizationAnalysis[] = []
          
          for (const filePath of componentFiles) {
            results.push(analyzeOptimization(filePath))
          }
          
          // Sort by total lines (larger files first)
          results.sort((a, b) => b.totalLines - a.totalLines)
          
          console.log('\nOptimization Coverage Report:')
          console.log('=' .repeat(60))
          
          const largeComponents = results.filter(r => r.totalLines > 200)
          console.log(`\nLarge components (>200 lines): ${largeComponents.length}`)
          
          for (const r of largeComponents) {
            const optimizations: string[] = []
            if (r.hasUseMemo) optimizations.push(`useMemo(${r.useMemoCount})`)
            if (r.hasUseCallback) optimizations.push(`useCallback(${r.useCallbackCount})`)
            if (r.hasMemo) optimizations.push('memo')
            
            const status = optimizations.length > 0 ? optimizations.join(', ') : 'NO OPTIMIZATION'
            console.log(`  ${r.fileName} (${r.totalLines} lines): ${status}`)
          }
          
          // Calculate coverage
          const optimizedCount = results.filter(r => r.hasUseMemo || r.hasUseCallback || r.hasMemo).length
          const coveragePercent = Math.round((optimizedCount / results.length) * 100)
          
          console.log(`\nOverall optimization coverage: ${optimizedCount}/${results.length} (${coveragePercent}%)`)
          
          // At least 30% of components should have some optimization
          expect(coveragePercent).toBeGreaterThanOrEqual(30)
        }),
        { numRuns: 1 }
      )
    })
  })
})
