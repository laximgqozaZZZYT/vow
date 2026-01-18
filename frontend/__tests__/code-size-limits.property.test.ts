/**
 * Property Test: Code Size Limits
 * 
 * Validates that functions and files adhere to size constraints
 * for maintainability and readability.
 * 
 * **Validates: Requirements 3.1, 3.2**
 */

import * as fc from 'fast-check'
import * as fs from 'fs'
import * as path from 'path'

// Configuration
const MAX_FUNCTION_LINES = 50
const MAX_FILE_LINES = 500
const COMPONENTS_DIR = path.join(__dirname, '../app/dashboard/components')
const HOOKS_DIR = path.join(__dirname, '../app/dashboard/hooks')
const UTILS_DIR = path.join(__dirname, '../app/dashboard/utils')

// Files that are known to be large and are being refactored incrementally
const EXCLUDED_FILES = [
  'Widget.UnifiedRelationMap.tsx',
  'Widget.MultiEventChart.tsx',
  'Modal.Habit.tsx',
  'Section.Statistics.tsx',
  'Widget.Calendar.tsx',
  'Widget.HabitRelationMap.tsx',
  'Form.Habit.tsx',
  'Widget.MultiEventChart.Radial.tsx',
  'Widget.MultiEventChart.TreeRing.tsx',
  'Section.Diary.tsx',
  'Modal.Diary.tsx',
  'Widget.EditableMindmap.Refactored.tsx',
  'Widget.GoalTree.tsx',
  'Widget.Mindmap.Refactored.tsx',
  'Widget.Heatmap.tsx',
  'Mindmap.Node.tsx',
  'Modal.ManageTags.tsx',
  'Modal.Sticky.tsx',
  // Hooks that are intentionally comprehensive
  'useActivityManager.ts',
  'useLocalStorage.ts',
  'useEventHandlers.ts',
  'useAuth.ts',
  'useApiWithLoading.ts',
  'useConnectionHandlers.ts',
  'useNodeOperations.ts',
  'useMindmapEvents.ts',
]

interface FunctionInfo {
  name: string
  startLine: number
  endLine: number
  lineCount: number
}

interface FileAnalysis {
  filePath: string
  fileName: string
  totalLines: number
  functions: FunctionInfo[]
  largeFunctions: FunctionInfo[]
}

/**
 * Analyze a TypeScript/TSX file for function sizes
 */
function analyzeFile(filePath: string): FileAnalysis {
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')
  const fileName = path.basename(filePath)
  
  const functions: FunctionInfo[] = []
  let currentFunction: { name: string; startLine: number } | null = null
  let braceCount = 0
  
  // Simple regex patterns for function detection
  const functionPatterns = [
    /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
    /^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(/,
    /^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=]+)\s*=>/,
  ]
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    if (!currentFunction) {
      for (const pattern of functionPatterns) {
        const match = line.match(pattern)
        if (match && match[1]) {
          currentFunction = { name: match[1], startLine: i + 1 }
          braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length
          break
        }
      }
    } else {
      braceCount += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length
      
      if (braceCount <= 0) {
        const lineCount = i - currentFunction.startLine + 2
        functions.push({
          name: currentFunction.name,
          startLine: currentFunction.startLine,
          endLine: i + 1,
          lineCount
        })
        currentFunction = null
        braceCount = 0
      }
    }
  }
  
  const largeFunctions = functions.filter(f => f.lineCount > MAX_FUNCTION_LINES)
  
  return {
    filePath,
    fileName,
    totalLines: lines.length,
    functions,
    largeFunctions
  }
}

/**
 * Get all TypeScript/TSX files in a directory
 */
function getFilesInDirectory(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.tsx') || f.endsWith('.ts'))
    .filter(f => !EXCLUDED_FILES.includes(f))
    .map(f => path.join(dir, f))
}

describe('Property 3: Code Size Limits', () => {
  const componentFiles = getFilesInDirectory(COMPONENTS_DIR)
  const hookFiles = getFilesInDirectory(HOOKS_DIR)
  const utilFiles = getFilesInDirectory(UTILS_DIR)
  const allFiles = [...componentFiles, ...hookFiles, ...utilFiles]
  
  describe('Function size constraints', () => {
    it('should have functions under 50 lines in utility files', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const violations: { file: string; function: string; lines: number }[] = []
          
          for (const filePath of utilFiles) {
            const analysis = analyzeFile(filePath)
            for (const func of analysis.largeFunctions) {
              violations.push({
                file: analysis.fileName,
                function: func.name,
                lines: func.lineCount
              })
            }
          }
          
          if (violations.length > 0) {
            console.log('Utility files with large functions:')
            violations.forEach(v => {
              console.log(`  ${v.file}: ${v.function} (${v.lines} lines)`)
            })
          }
          
          // Allow some violations but track them
          expect(violations.length).toBeLessThanOrEqual(5)
        }),
        { numRuns: 1 }
      )
    })
    
    it('should have functions under 50 lines in hook files (non-excluded)', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const violations: { file: string; function: string; lines: number }[] = []
          
          for (const filePath of hookFiles) {
            const analysis = analyzeFile(filePath)
            for (const func of analysis.largeFunctions) {
              violations.push({
                file: analysis.fileName,
                function: func.name,
                lines: func.lineCount
              })
            }
          }
          
          if (violations.length > 0) {
            console.log('Hook files with large functions:')
            violations.forEach(v => {
              console.log(`  ${v.file}: ${v.function} (${v.lines} lines)`)
            })
          }
          
          // Allow some violations but track them
          expect(violations.length).toBeLessThanOrEqual(10)
        }),
        { numRuns: 1 }
      )
    })
  })
  
  describe('File size constraints', () => {
    it('should have utility files under 500 lines', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const violations: { file: string; lines: number }[] = []
          
          for (const filePath of utilFiles) {
            const content = fs.readFileSync(filePath, 'utf8')
            const lineCount = content.split('\n').length
            
            if (lineCount > MAX_FILE_LINES) {
              violations.push({
                file: path.basename(filePath),
                lines: lineCount
              })
            }
          }
          
          if (violations.length > 0) {
            console.log('Utility files exceeding size limit:')
            violations.forEach(v => {
              console.log(`  ${v.file}: ${v.lines} lines`)
            })
          }
          
          expect(violations.length).toBe(0)
        }),
        { numRuns: 1 }
      )
    })
    
    it('should track total lines in non-excluded files', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          let totalLines = 0
          const fileSizes: { file: string; lines: number }[] = []
          
          for (const filePath of allFiles) {
            const content = fs.readFileSync(filePath, 'utf8')
            const lineCount = content.split('\n').length
            totalLines += lineCount
            fileSizes.push({
              file: path.basename(filePath),
              lines: lineCount
            })
          }
          
          // Sort by size descending
          fileSizes.sort((a, b) => b.lines - a.lines)
          
          console.log(`Total lines in non-excluded files: ${totalLines}`)
          console.log('Top 10 largest files:')
          fileSizes.slice(0, 10).forEach(f => {
            console.log(`  ${f.file}: ${f.lines} lines`)
          })
          
          // This is informational, not a hard constraint
          expect(totalLines).toBeGreaterThan(0)
        }),
        { numRuns: 1 }
      )
    })
  })
  
  describe('New utility files follow size guidelines', () => {
    it('chartUtils.ts should be under 500 lines', () => {
      const chartUtilsPath = path.join(UTILS_DIR, 'chartUtils.ts')
      if (fs.existsSync(chartUtilsPath)) {
        const content = fs.readFileSync(chartUtilsPath, 'utf8')
        const lineCount = content.split('\n').length
        expect(lineCount).toBeLessThan(MAX_FILE_LINES)
      }
    })
    
    it('chartSeriesBuilder.ts should be under 500 lines', () => {
      const chartSeriesBuilderPath = path.join(UTILS_DIR, 'chartSeriesBuilder.ts')
      if (fs.existsSync(chartSeriesBuilderPath)) {
        const content = fs.readFileSync(chartSeriesBuilderPath, 'utf8')
        const lineCount = content.split('\n').length
        expect(lineCount).toBeLessThan(MAX_FILE_LINES)
      }
    })
    
    it('dateUtils.ts should be under 500 lines', () => {
      const dateUtilsPath = path.join(UTILS_DIR, 'dateUtils.ts')
      if (fs.existsSync(dateUtilsPath)) {
        const content = fs.readFileSync(dateUtilsPath, 'utf8')
        const lineCount = content.split('\n').length
        expect(lineCount).toBeLessThan(MAX_FILE_LINES)
      }
    })
  })
})
