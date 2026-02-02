/**
 * Frontend Worker Agent for VOW Backend
 *
 * Specialized worker for processing frontend-related tasks:
 * - React/TypeScript components
 * - CSS/Tailwind styling
 * - UI/UX implementation
 * - Frontend testing
 *
 * Requirements:
 * - B-009: Strands Worker Agent Pool
 * - 7.2: Frontend Worker implementation
 *
 * @module agents/strands/workers/frontend-worker
 */

import { z } from 'zod';
import type { ToolExecutionContext } from '../types.js';
import type { McpTask } from '../task-orchestrator.js';
import {
  BaseWorkerAgent,
  parseTaskMetadata,
  type WorkerConfig,
} from './base-worker.js';

// =============================================================================
// Constants
// =============================================================================

/** Frontend worker role name */
const FRONTEND_ROLE = 'frontend';

/** Frontend worker capabilities */
const FRONTEND_CAPABILITIES = [
  'react',
  'typescript',
  'nextjs',
  'tailwindcss',
  'css',
  'html',
  'jest',
  'testing-library',
  'component-development',
  'ui-implementation',
  'accessibility',
  'responsive-design',
];

/** Task types that frontend worker can handle */
const HANDLEABLE_TASK_TYPES = [
  'frontend',
  'react',
  'component',
  'ui',
  'style',
  'css',
  'test-frontend',
  'accessibility',
];

// =============================================================================
// Tool Schemas
// =============================================================================

/**
 * Schema for analyze_component tool
 */
const AnalyzeComponentSchema = z.object({
  componentPath: z.string()
    .describe('Path to the React component file'),
  analysisType: z.enum(['structure', 'performance', 'accessibility', 'all']).default('all')
    .describe('Type of analysis to perform'),
});

type AnalyzeComponentInput = z.infer<typeof AnalyzeComponentSchema>;

/**
 * Schema for suggest_improvements tool
 */
const SuggestImprovementsSchema = z.object({
  componentPath: z.string()
    .describe('Path to the React component file'),
  focusAreas: z.array(z.string()).optional()
    .describe('Specific areas to focus improvements on'),
});

type SuggestImprovementsInput = z.infer<typeof SuggestImprovementsSchema>;

/**
 * Schema for generate_test tool
 */
const GenerateTestSchema = z.object({
  componentPath: z.string()
    .describe('Path to the React component file'),
  testTypes: z.array(z.enum(['unit', 'integration', 'snapshot', 'accessibility'])).default(['unit'])
    .describe('Types of tests to generate'),
});

type GenerateTestInput = z.infer<typeof GenerateTestSchema>;

/**
 * Schema for style_check tool
 */
const StyleCheckSchema = z.object({
  filePath: z.string()
    .describe('Path to the file to check'),
  checkTypes: z.array(z.enum(['tailwind', 'css', 'consistency', 'accessibility'])).default(['tailwind', 'consistency'])
    .describe('Types of style checks to perform'),
});

type StyleCheckInput = z.infer<typeof StyleCheckSchema>;

// =============================================================================
// Tool Result Types
// =============================================================================

interface ComponentAnalysisResult {
  componentPath: string;
  analysisType: string;
  structure?: {
    hasProps: boolean;
    hasState: boolean;
    hasEffects: boolean;
    childComponents: string[];
    imports: string[];
  };
  performance?: {
    memoized: boolean;
    potentialReRenders: string[];
    suggestions: string[];
  };
  accessibility?: {
    hasAriaLabels: boolean;
    hasRoles: boolean;
    issues: string[];
    suggestions: string[];
  };
}

interface ImprovementSuggestion {
  area: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  codeSnippet?: string;
}

interface TestGenerationResult {
  componentPath: string;
  testTypes: string[];
  generatedTests: Array<{
    type: string;
    testCode: string;
    description: string;
  }>;
}

interface StyleCheckResult {
  filePath: string;
  issues: Array<{
    type: string;
    message: string;
    line?: number;
    suggestion?: string;
  }>;
  passed: boolean;
}

// =============================================================================
// Frontend Worker Agent
// =============================================================================

/**
 * Frontend Worker Agent
 *
 * Specializes in processing frontend tasks including:
 * - React component development
 * - TypeScript implementation
 * - CSS/Tailwind styling
 * - Frontend testing
 * - Accessibility compliance
 */
export class FrontendWorkerAgent extends BaseWorkerAgent {
  constructor(config?: Partial<WorkerConfig>) {
    super({
      ...config,
      agentRole: FRONTEND_ROLE,
      agentName: config?.agentName || `frontend-worker-${Date.now()}`,
    });

    // Register frontend-specific tools
    this.registerFrontendTools();
  }

  // ===========================================================================
  // Abstract Method Implementations
  // ===========================================================================

  /**
   * Get the worker's role name
   */
  getRole(): string {
    return FRONTEND_ROLE;
  }

  /**
   * Get the worker's capabilities
   */
  getCapabilities(): string[] {
    return FRONTEND_CAPABILITIES;
  }

  /**
   * Process a frontend task
   */
  async processTask(task: McpTask, context: ToolExecutionContext): Promise<unknown> {
    const startTime = Date.now();
    const metadata = parseTaskMetadata(task);

    this.logger.info('Processing frontend task', {
      taskId: task.id,
      title: task.title,
      priority: task.priority,
      files: metadata.files,
    });

    try {
      // Determine task type and process accordingly
      const taskType = this.determineTaskType(task);

      switch (taskType) {
        case 'component-analysis':
          return await this.handleComponentAnalysis(task, context);

        case 'component-development':
          return await this.handleComponentDevelopment(task, context);

        case 'styling':
          return await this.handleStyling(task, context);

        case 'testing':
          return await this.handleTesting(task, context);

        case 'accessibility':
          return await this.handleAccessibility(task, context);

        default:
          return await this.handleGenericFrontendTask(task, context);
      }
    } catch (error) {
      this.logger.error('Frontend task processing failed', error as Error, {
        taskId: task.id,
        durationMs: Date.now() - startTime,
      });
      throw error;
    }
  }

  /**
   * Check if this worker can handle a specific task
   */
  canHandleTask(task: McpTask): boolean {
    const metadata = parseTaskMetadata(task);

    // Check if task specifies frontend role
    if (metadata.targetRole === FRONTEND_ROLE) {
      return true;
    }

    // Check if task requires frontend capabilities
    if (metadata.requiredCapabilities) {
      const hasRequired = metadata.requiredCapabilities.some(
        (cap) => FRONTEND_CAPABILITIES.includes(cap)
      );
      if (hasRequired) {
        return true;
      }
    }

    // Check task title/description for frontend keywords
    const taskText = `${task.title} ${task.description || ''}`.toLowerCase();
    return HANDLEABLE_TASK_TYPES.some((type) => taskText.includes(type));
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Register frontend-specific tools
   */
  private registerFrontendTools(): void {
    // Analyze Component Tool
    this.registerTool<AnalyzeComponentInput, ComponentAnalysisResult>({
      name: 'analyze_component',
      description: 'Analyze a React component for structure, performance, and accessibility',
      inputSchema: AnalyzeComponentSchema as z.ZodSchema<AnalyzeComponentInput>,
      execute: async (input, _context) => {
        return this.executeAnalyzeComponent(input);
      },
    });

    // Suggest Improvements Tool
    this.registerTool<SuggestImprovementsInput, ImprovementSuggestion[]>({
      name: 'suggest_improvements',
      description: 'Suggest improvements for a React component',
      inputSchema: SuggestImprovementsSchema,
      execute: async (input, _context) => {
        return this.executeSuggestImprovements(input);
      },
    });

    // Generate Test Tool
    this.registerTool<GenerateTestInput, TestGenerationResult>({
      name: 'generate_test',
      description: 'Generate tests for a React component',
      inputSchema: GenerateTestSchema as z.ZodSchema<GenerateTestInput>,
      execute: async (input, _context) => {
        return this.executeGenerateTest(input);
      },
    });

    // Style Check Tool
    this.registerTool<StyleCheckInput, StyleCheckResult>({
      name: 'style_check',
      description: 'Check styling consistency and Tailwind usage',
      inputSchema: StyleCheckSchema as z.ZodSchema<StyleCheckInput>,
      execute: async (input, _context) => {
        return this.executeStyleCheck(input);
      },
    });
  }

  /**
   * Determine the type of frontend task
   */
  private determineTaskType(task: McpTask): string {
    const taskText = `${task.title} ${task.description || ''}`.toLowerCase();

    if (taskText.includes('analyz')) {
      return 'component-analysis';
    }
    if (taskText.includes('component') || taskText.includes('develop')) {
      return 'component-development';
    }
    if (taskText.includes('style') || taskText.includes('css') || taskText.includes('tailwind')) {
      return 'styling';
    }
    if (taskText.includes('test')) {
      return 'testing';
    }
    if (taskText.includes('accessib') || taskText.includes('a11y')) {
      return 'accessibility';
    }

    return 'generic';
  }

  /**
   * Handle component analysis task
   */
  private async handleComponentAnalysis(
    task: McpTask,
    _context: ToolExecutionContext
  ): Promise<ComponentAnalysisResult> {
    const metadata = parseTaskMetadata(task);
    const componentPath = metadata.files?.[0] || (task.metadata?.['componentPath'] as string | undefined);

    if (!componentPath) {
      throw new Error('Component path not specified in task');
    }

    return this.executeAnalyzeComponent(
      { componentPath, analysisType: 'all' }
    );
  }

  /**
   * Handle component development task
   */
  private async handleComponentDevelopment(
    task: McpTask,
    _context: ToolExecutionContext
  ): Promise<{
    status: string;
    files: string[];
    description: string;
  }> {
    const metadata = parseTaskMetadata(task);

    this.logger.info('Handling component development task', {
      taskId: task.id,
      workingDirectory: metadata.workingDirectory,
      files: metadata.files,
    });

    // This is a placeholder implementation
    // In a real implementation, this would:
    // 1. Parse the task requirements
    // 2. Generate or modify component code
    // 3. Update related files
    // 4. Run linting and tests

    return {
      status: 'completed',
      files: metadata.files || [],
      description: `Processed component development task: ${task.title}`,
    };
  }

  /**
   * Handle styling task
   */
  private async handleStyling(
    task: McpTask,
    _context: ToolExecutionContext
  ): Promise<StyleCheckResult> {
    const metadata = parseTaskMetadata(task);
    const filePath = metadata.files?.[0] || (task.metadata?.['filePath'] as string | undefined);

    if (!filePath) {
      throw new Error('File path not specified in task');
    }

    return this.executeStyleCheck(
      { filePath, checkTypes: ['tailwind', 'consistency', 'accessibility'] }
    );
  }

  /**
   * Handle testing task
   */
  private async handleTesting(
    task: McpTask,
    _context: ToolExecutionContext
  ): Promise<TestGenerationResult> {
    const metadata = parseTaskMetadata(task);
    const componentPath = metadata.files?.[0] || (task.metadata?.['componentPath'] as string | undefined);

    if (!componentPath) {
      throw new Error('Component path not specified in task');
    }

    return this.executeGenerateTest(
      { componentPath, testTypes: ['unit', 'integration'] }
    );
  }

  /**
   * Handle accessibility task
   */
  private async handleAccessibility(
    task: McpTask,
    _context: ToolExecutionContext
  ): Promise<ComponentAnalysisResult> {
    const metadata = parseTaskMetadata(task);
    const componentPath = metadata.files?.[0] || (task.metadata?.['componentPath'] as string | undefined);

    if (!componentPath) {
      throw new Error('Component path not specified in task');
    }

    return this.executeAnalyzeComponent(
      { componentPath, analysisType: 'accessibility' }
    );
  }

  /**
   * Handle generic frontend task
   */
  private async handleGenericFrontendTask(
    task: McpTask,
    _context: ToolExecutionContext
  ): Promise<{
    status: string;
    message: string;
    taskId: string;
  }> {
    this.logger.info('Handling generic frontend task', {
      taskId: task.id,
    });

    // Placeholder for generic task handling
    return {
      status: 'completed',
      message: `Processed frontend task: ${task.title}`,
      taskId: task.id,
    };
  }

  // ===========================================================================
  // Tool Implementations
  // ===========================================================================

  /**
   * Execute analyze_component tool
   */
  private async executeAnalyzeComponent(
    input: AnalyzeComponentInput
  ): Promise<ComponentAnalysisResult> {
    this.logger.info('Analyzing component', {
      componentPath: input.componentPath,
      analysisType: input.analysisType,
    });

    // This is a placeholder implementation
    // In a real implementation, this would:
    // 1. Read the component file
    // 2. Parse the AST
    // 3. Analyze structure, performance, and accessibility
    // 4. Generate a detailed report

    const result: ComponentAnalysisResult = {
      componentPath: input.componentPath,
      analysisType: input.analysisType,
    };

    if (input.analysisType === 'all' || input.analysisType === 'structure') {
      result.structure = {
        hasProps: true,
        hasState: false,
        hasEffects: false,
        childComponents: [],
        imports: ['react'],
      };
    }

    if (input.analysisType === 'all' || input.analysisType === 'performance') {
      result.performance = {
        memoized: false,
        potentialReRenders: [],
        suggestions: ['Consider using React.memo for pure components'],
      };
    }

    if (input.analysisType === 'all' || input.analysisType === 'accessibility') {
      result.accessibility = {
        hasAriaLabels: false,
        hasRoles: false,
        issues: [],
        suggestions: ['Add aria-label to interactive elements'],
      };
    }

    return result;
  }

  /**
   * Execute suggest_improvements tool
   */
  private async executeSuggestImprovements(
    input: SuggestImprovementsInput
  ): Promise<ImprovementSuggestion[]> {
    this.logger.info('Suggesting improvements', {
      componentPath: input.componentPath,
      focusAreas: input.focusAreas,
    });

    // Placeholder implementation
    return [
      {
        area: 'performance',
        description: 'Consider using useMemo for expensive computations',
        priority: 'medium',
      },
      {
        area: 'accessibility',
        description: 'Add aria-label to buttons without visible text',
        priority: 'high',
      },
      {
        area: 'code-quality',
        description: 'Extract repeated logic into a custom hook',
        priority: 'low',
      },
    ];
  }

  /**
   * Execute generate_test tool
   */
  private async executeGenerateTest(
    input: GenerateTestInput
  ): Promise<TestGenerationResult> {
    this.logger.info('Generating tests', {
      componentPath: input.componentPath,
      testTypes: input.testTypes,
    });

    // Placeholder implementation
    return {
      componentPath: input.componentPath,
      testTypes: input.testTypes,
      generatedTests: input.testTypes.map((type) => ({
        type,
        testCode: `// ${type} test for ${input.componentPath}\ndescribe('Component', () => {\n  it('should render', () => {\n    // test implementation\n  });\n});`,
        description: `Generated ${type} test`,
      })),
    };
  }

  /**
   * Execute style_check tool
   */
  private async executeStyleCheck(
    input: StyleCheckInput
  ): Promise<StyleCheckResult> {
    this.logger.info('Checking styles', {
      filePath: input.filePath,
      checkTypes: input.checkTypes,
    });

    // Placeholder implementation
    return {
      filePath: input.filePath,
      issues: [],
      passed: true,
    };
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

let frontendWorkerInstance: FrontendWorkerAgent | null = null;

/**
 * Get or create the Frontend Worker Agent singleton
 */
export function getFrontendWorkerAgent(config?: Partial<WorkerConfig>): FrontendWorkerAgent {
  if (!frontendWorkerInstance) {
    frontendWorkerInstance = new FrontendWorkerAgent(config);
  }
  return frontendWorkerInstance;
}

/**
 * Reset the Frontend Worker Agent instance (useful for testing)
 */
export async function resetFrontendWorkerAgent(): Promise<void> {
  if (frontendWorkerInstance) {
    await frontendWorkerInstance.stop();
  }
  frontendWorkerInstance = null;
}

/**
 * Create a new Frontend Worker Agent instance (for multi-worker setups)
 */
export function createFrontendWorkerAgent(config?: Partial<WorkerConfig>): FrontendWorkerAgent {
  return new FrontendWorkerAgent(config);
}
