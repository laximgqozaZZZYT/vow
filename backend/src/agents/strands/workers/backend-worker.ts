/**
 * Backend Worker Agent for VOW Backend
 *
 * Specialized worker for processing backend-related tasks:
 * - Node.js/Express/Lambda development
 * - API implementation
 * - Database operations
 * - Backend testing
 *
 * Requirements:
 * - B-009: Strands Worker Agent Pool
 * - 7.3: Backend Worker implementation
 *
 * @module agents/strands/workers/backend-worker
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

/** Backend worker role name */
const BACKEND_ROLE = 'backend';

/** Backend worker capabilities */
const BACKEND_CAPABILITIES = [
  'nodejs',
  'typescript',
  'express',
  'lambda',
  'aws',
  'api',
  'rest',
  'graphql',
  'postgresql',
  'supabase',
  'jest',
  'database',
  'authentication',
  'authorization',
  'middleware',
  'validation',
  'error-handling',
];

/** Task types that backend worker can handle */
const HANDLEABLE_TASK_TYPES = [
  'backend',
  'api',
  'lambda',
  'service',
  'database',
  'migration',
  'endpoint',
  'test-backend',
  'router',
  'middleware',
];

// =============================================================================
// Tool Schemas
// =============================================================================

/**
 * Schema for analyze_endpoint tool
 */
const AnalyzeEndpointSchema = z.object({
  routerPath: z.string()
    .describe('Path to the router/endpoint file'),
  analysisType: z.enum(['security', 'performance', 'validation', 'all']).default('all')
    .describe('Type of analysis to perform'),
});

type AnalyzeEndpointInput = z.infer<typeof AnalyzeEndpointSchema>;

/**
 * Schema for analyze_service tool
 */
const AnalyzeServiceSchema = z.object({
  servicePath: z.string()
    .describe('Path to the service file'),
  analysisType: z.enum(['architecture', 'error-handling', 'testing', 'all']).default('all')
    .describe('Type of analysis to perform'),
});

type AnalyzeServiceInput = z.infer<typeof AnalyzeServiceSchema>;

/**
 * Schema for validate_schema tool
 */
const ValidateSchemaSchema = z.object({
  schemaPath: z.string()
    .describe('Path to the Zod schema or validation file'),
  strict: z.boolean().default(true)
    .describe('Whether to perform strict validation'),
});

type ValidateSchemaInput = z.infer<typeof ValidateSchemaSchema>;

/**
 * Schema for generate_api_test tool
 */
const GenerateApiTestSchema = z.object({
  routerPath: z.string()
    .describe('Path to the router file'),
  testTypes: z.array(z.enum(['unit', 'integration', 'e2e', 'property'])).default(['unit', 'integration'])
    .describe('Types of tests to generate'),
});

type GenerateApiTestInput = z.infer<typeof GenerateApiTestSchema>;

/**
 * Schema for analyze_lambda tool
 */
const AnalyzeLambdaSchema = z.object({
  handlerPath: z.string()
    .describe('Path to the Lambda handler file'),
  analysisType: z.enum(['cold-start', 'memory', 'errors', 'all']).default('all')
    .describe('Type of analysis to perform'),
});

type AnalyzeLambdaInput = z.infer<typeof AnalyzeLambdaSchema>;

// =============================================================================
// Tool Result Types
// =============================================================================

interface EndpointAnalysisResult {
  routerPath: string;
  analysisType: string;
  endpoints: Array<{
    method: string;
    path: string;
    hasValidation: boolean;
    hasAuthentication: boolean;
    hasErrorHandling: boolean;
  }>;
  security?: {
    issues: string[];
    suggestions: string[];
  };
  performance?: {
    issues: string[];
    suggestions: string[];
  };
  validation?: {
    issues: string[];
    suggestions: string[];
  };
}

interface ServiceAnalysisResult {
  servicePath: string;
  analysisType: string;
  methods: Array<{
    name: string;
    isAsync: boolean;
    hasErrorHandling: boolean;
    dependencies: string[];
  }>;
  architecture?: {
    pattern: string;
    issues: string[];
    suggestions: string[];
  };
  errorHandling?: {
    coverage: number;
    issues: string[];
    suggestions: string[];
  };
  testing?: {
    testability: 'high' | 'medium' | 'low';
    suggestions: string[];
  };
}

interface SchemaValidationResult {
  schemaPath: string;
  isValid: boolean;
  schemas: Array<{
    name: string;
    type: string;
    fields: number;
  }>;
  issues: string[];
  suggestions: string[];
}

interface ApiTestGenerationResult {
  routerPath: string;
  testTypes: string[];
  generatedTests: Array<{
    type: string;
    testCode: string;
    description: string;
  }>;
}

interface LambdaAnalysisResult {
  handlerPath: string;
  analysisType: string;
  handler: {
    name: string;
    estimatedColdStartMs: number;
    estimatedMemoryMb: number;
  };
  coldStart?: {
    issues: string[];
    suggestions: string[];
  };
  memory?: {
    issues: string[];
    suggestions: string[];
  };
  errors?: {
    coverage: number;
    issues: string[];
    suggestions: string[];
  };
}

// =============================================================================
// Backend Worker Agent
// =============================================================================

/**
 * Backend Worker Agent
 *
 * Specializes in processing backend tasks including:
 * - Node.js/Express development
 * - Lambda function implementation
 * - API endpoint development
 * - Database operations
 * - Backend testing
 */
export class BackendWorkerAgent extends BaseWorkerAgent {
  constructor(config?: Partial<WorkerConfig>) {
    super({
      ...config,
      agentRole: BACKEND_ROLE,
      agentName: config?.agentName || `backend-worker-${Date.now()}`,
    });

    // Register backend-specific tools
    this.registerBackendTools();
  }

  // ===========================================================================
  // Abstract Method Implementations
  // ===========================================================================

  /**
   * Get the worker's role name
   */
  getRole(): string {
    return BACKEND_ROLE;
  }

  /**
   * Get the worker's capabilities
   */
  getCapabilities(): string[] {
    return BACKEND_CAPABILITIES;
  }

  /**
   * Process a backend task
   */
  async processTask(task: McpTask, context: ToolExecutionContext): Promise<unknown> {
    const startTime = Date.now();
    const metadata = parseTaskMetadata(task);

    this.logger.info('Processing backend task', {
      taskId: task.id,
      title: task.title,
      priority: task.priority,
      files: metadata.files,
    });

    try {
      // Determine task type and process accordingly
      const taskType = this.determineTaskType(task);

      switch (taskType) {
        case 'endpoint-analysis':
          return await this.handleEndpointAnalysis(task, context);

        case 'service-development':
          return await this.handleServiceDevelopment(task, context);

        case 'lambda-development':
          return await this.handleLambdaDevelopment(task, context);

        case 'database':
          return await this.handleDatabaseTask(task, context);

        case 'testing':
          return await this.handleTesting(task, context);

        case 'api-development':
          return await this.handleApiDevelopment(task, context);

        default:
          return await this.handleGenericBackendTask(task, context);
      }
    } catch (error) {
      this.logger.error('Backend task processing failed', error as Error, {
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

    // Check if task specifies backend role
    if (metadata.targetRole === BACKEND_ROLE) {
      return true;
    }

    // Check if task requires backend capabilities
    if (metadata.requiredCapabilities) {
      const hasRequired = metadata.requiredCapabilities.some(
        (cap) => BACKEND_CAPABILITIES.includes(cap)
      );
      if (hasRequired) {
        return true;
      }
    }

    // Check task title/description for backend keywords
    const taskText = `${task.title} ${task.description || ''}`.toLowerCase();
    return HANDLEABLE_TASK_TYPES.some((type) => taskText.includes(type));
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Register backend-specific tools
   */
  private registerBackendTools(): void {
    // Analyze Endpoint Tool
    this.registerTool<AnalyzeEndpointInput, EndpointAnalysisResult>({
      name: 'analyze_endpoint',
      description: 'Analyze an API endpoint for security, performance, and validation',
      inputSchema: AnalyzeEndpointSchema as z.ZodSchema<AnalyzeEndpointInput>,
      execute: async (input, _context) => {
        return this.executeAnalyzeEndpoint(input);
      },
    });

    // Analyze Service Tool
    this.registerTool<AnalyzeServiceInput, ServiceAnalysisResult>({
      name: 'analyze_service',
      description: 'Analyze a service for architecture, error handling, and testability',
      inputSchema: AnalyzeServiceSchema as z.ZodSchema<AnalyzeServiceInput>,
      execute: async (input, _context) => {
        return this.executeAnalyzeService(input);
      },
    });

    // Validate Schema Tool
    this.registerTool<ValidateSchemaInput, SchemaValidationResult>({
      name: 'validate_schema',
      description: 'Validate Zod schemas and validation logic',
      inputSchema: ValidateSchemaSchema as z.ZodSchema<ValidateSchemaInput>,
      execute: async (input, _context) => {
        return this.executeValidateSchema(input);
      },
    });

    // Generate API Test Tool
    this.registerTool<GenerateApiTestInput, ApiTestGenerationResult>({
      name: 'generate_api_test',
      description: 'Generate tests for API endpoints',
      inputSchema: GenerateApiTestSchema as z.ZodSchema<GenerateApiTestInput>,
      execute: async (input, _context) => {
        return this.executeGenerateApiTest(input);
      },
    });

    // Analyze Lambda Tool
    this.registerTool<AnalyzeLambdaInput, LambdaAnalysisResult>({
      name: 'analyze_lambda',
      description: 'Analyze a Lambda function for cold start, memory usage, and error handling',
      inputSchema: AnalyzeLambdaSchema as z.ZodSchema<AnalyzeLambdaInput>,
      execute: async (input, _context) => {
        return this.executeAnalyzeLambda(input);
      },
    });
  }

  /**
   * Determine the type of backend task
   */
  private determineTaskType(task: McpTask): string {
    const taskText = `${task.title} ${task.description || ''}`.toLowerCase();

    if (taskText.includes('endpoint') || taskText.includes('router')) {
      return 'endpoint-analysis';
    }
    if (taskText.includes('service')) {
      return 'service-development';
    }
    if (taskText.includes('lambda') || taskText.includes('handler')) {
      return 'lambda-development';
    }
    if (taskText.includes('database') || taskText.includes('migration') || taskText.includes('sql')) {
      return 'database';
    }
    if (taskText.includes('test')) {
      return 'testing';
    }
    if (taskText.includes('api')) {
      return 'api-development';
    }

    return 'generic';
  }

  /**
   * Handle endpoint analysis task
   */
  private async handleEndpointAnalysis(
    task: McpTask,
    _context: ToolExecutionContext
  ): Promise<EndpointAnalysisResult> {
    const metadata = parseTaskMetadata(task);
    const routerPath = metadata.files?.[0] || (task.metadata?.['routerPath'] as string | undefined);

    if (!routerPath) {
      throw new Error('Router path not specified in task');
    }

    return this.executeAnalyzeEndpoint(
      { routerPath, analysisType: 'all' }
    );
  }

  /**
   * Handle service development task
   */
  private async handleServiceDevelopment(
    task: McpTask,
    _context: ToolExecutionContext
  ): Promise<{
    status: string;
    files: string[];
    description: string;
  }> {
    const metadata = parseTaskMetadata(task);

    this.logger.info('Handling service development task', {
      taskId: task.id,
      workingDirectory: metadata.workingDirectory,
      files: metadata.files,
    });

    // Placeholder implementation
    return {
      status: 'completed',
      files: metadata.files || [],
      description: `Processed service development task: ${task.title}`,
    };
  }

  /**
   * Handle Lambda development task
   */
  private async handleLambdaDevelopment(
    task: McpTask,
    _context: ToolExecutionContext
  ): Promise<LambdaAnalysisResult> {
    const metadata = parseTaskMetadata(task);
    const handlerPath = metadata.files?.[0] || (task.metadata?.['handlerPath'] as string | undefined);

    if (!handlerPath) {
      throw new Error('Handler path not specified in task');
    }

    return this.executeAnalyzeLambda(
      { handlerPath, analysisType: 'all' }
    );
  }

  /**
   * Handle database task
   */
  private async handleDatabaseTask(
    task: McpTask,
    _context: ToolExecutionContext
  ): Promise<{
    status: string;
    description: string;
    changes: string[];
  }> {
    const metadata = parseTaskMetadata(task);

    this.logger.info('Handling database task', {
      taskId: task.id,
      files: metadata.files,
    });

    // Placeholder implementation
    return {
      status: 'completed',
      description: `Processed database task: ${task.title}`,
      changes: [],
    };
  }

  /**
   * Handle testing task
   */
  private async handleTesting(
    task: McpTask,
    _context: ToolExecutionContext
  ): Promise<ApiTestGenerationResult> {
    const metadata = parseTaskMetadata(task);
    const routerPath = metadata.files?.[0] || (task.metadata?.['routerPath'] as string | undefined);

    if (!routerPath) {
      throw new Error('Router path not specified in task');
    }

    return this.executeGenerateApiTest(
      { routerPath, testTypes: ['unit', 'integration', 'property'] }
    );
  }

  /**
   * Handle API development task
   */
  private async handleApiDevelopment(
    task: McpTask,
    _context: ToolExecutionContext
  ): Promise<{
    status: string;
    files: string[];
    endpoints: string[];
  }> {
    const metadata = parseTaskMetadata(task);

    this.logger.info('Handling API development task', {
      taskId: task.id,
      workingDirectory: metadata.workingDirectory,
      files: metadata.files,
    });

    // Placeholder implementation
    return {
      status: 'completed',
      files: metadata.files || [],
      endpoints: [],
    };
  }

  /**
   * Handle generic backend task
   */
  private async handleGenericBackendTask(
    task: McpTask,
    _context: ToolExecutionContext
  ): Promise<{
    status: string;
    message: string;
    taskId: string;
  }> {
    this.logger.info('Handling generic backend task', {
      taskId: task.id,
    });

    // Placeholder for generic task handling
    return {
      status: 'completed',
      message: `Processed backend task: ${task.title}`,
      taskId: task.id,
    };
  }

  // ===========================================================================
  // Tool Implementations
  // ===========================================================================

  /**
   * Execute analyze_endpoint tool
   */
  private async executeAnalyzeEndpoint(
    input: AnalyzeEndpointInput
  ): Promise<EndpointAnalysisResult> {
    this.logger.info('Analyzing endpoint', {
      routerPath: input.routerPath,
      analysisType: input.analysisType,
    });

    // Placeholder implementation
    const result: EndpointAnalysisResult = {
      routerPath: input.routerPath,
      analysisType: input.analysisType,
      endpoints: [
        {
          method: 'GET',
          path: '/example',
          hasValidation: true,
          hasAuthentication: true,
          hasErrorHandling: true,
        },
      ],
    };

    if (input.analysisType === 'all' || input.analysisType === 'security') {
      result.security = {
        issues: [],
        suggestions: ['Consider adding rate limiting'],
      };
    }

    if (input.analysisType === 'all' || input.analysisType === 'performance') {
      result.performance = {
        issues: [],
        suggestions: ['Consider adding response caching'],
      };
    }

    if (input.analysisType === 'all' || input.analysisType === 'validation') {
      result.validation = {
        issues: [],
        suggestions: ['Add Zod schema for request body validation'],
      };
    }

    return result;
  }

  /**
   * Execute analyze_service tool
   */
  private async executeAnalyzeService(
    input: AnalyzeServiceInput
  ): Promise<ServiceAnalysisResult> {
    this.logger.info('Analyzing service', {
      servicePath: input.servicePath,
      analysisType: input.analysisType,
    });

    // Placeholder implementation
    const result: ServiceAnalysisResult = {
      servicePath: input.servicePath,
      analysisType: input.analysisType,
      methods: [
        {
          name: 'exampleMethod',
          isAsync: true,
          hasErrorHandling: true,
          dependencies: ['repository'],
        },
      ],
    };

    if (input.analysisType === 'all' || input.analysisType === 'architecture') {
      result.architecture = {
        pattern: 'Service Layer',
        issues: [],
        suggestions: ['Consider using dependency injection'],
      };
    }

    if (input.analysisType === 'all' || input.analysisType === 'error-handling') {
      result.errorHandling = {
        coverage: 80,
        issues: [],
        suggestions: ['Add custom error types'],
      };
    }

    if (input.analysisType === 'all' || input.analysisType === 'testing') {
      result.testing = {
        testability: 'high',
        suggestions: ['Mock dependencies for unit tests'],
      };
    }

    return result;
  }

  /**
   * Execute validate_schema tool
   */
  private async executeValidateSchema(
    input: ValidateSchemaInput
  ): Promise<SchemaValidationResult> {
    this.logger.info('Validating schema', {
      schemaPath: input.schemaPath,
      strict: input.strict,
    });

    // Placeholder implementation
    return {
      schemaPath: input.schemaPath,
      isValid: true,
      schemas: [
        {
          name: 'ExampleSchema',
          type: 'object',
          fields: 5,
        },
      ],
      issues: [],
      suggestions: [],
    };
  }

  /**
   * Execute generate_api_test tool
   */
  private async executeGenerateApiTest(
    input: GenerateApiTestInput
  ): Promise<ApiTestGenerationResult> {
    this.logger.info('Generating API tests', {
      routerPath: input.routerPath,
      testTypes: input.testTypes,
    });

    // Placeholder implementation
    return {
      routerPath: input.routerPath,
      testTypes: input.testTypes,
      generatedTests: input.testTypes.map((type) => ({
        type,
        testCode: `// ${type} test for ${input.routerPath}\nimport request from 'supertest';\n\ndescribe('API Endpoint', () => {\n  it('should respond', async () => {\n    // test implementation\n  });\n});`,
        description: `Generated ${type} test`,
      })),
    };
  }

  /**
   * Execute analyze_lambda tool
   */
  private async executeAnalyzeLambda(
    input: AnalyzeLambdaInput
  ): Promise<LambdaAnalysisResult> {
    this.logger.info('Analyzing Lambda', {
      handlerPath: input.handlerPath,
      analysisType: input.analysisType,
    });

    // Placeholder implementation
    const result: LambdaAnalysisResult = {
      handlerPath: input.handlerPath,
      analysisType: input.analysisType,
      handler: {
        name: 'handler',
        estimatedColdStartMs: 500,
        estimatedMemoryMb: 128,
      },
    };

    if (input.analysisType === 'all' || input.analysisType === 'cold-start') {
      result.coldStart = {
        issues: [],
        suggestions: ['Move imports inside handler if conditionally used'],
      };
    }

    if (input.analysisType === 'all' || input.analysisType === 'memory') {
      result.memory = {
        issues: [],
        suggestions: ['Consider increasing memory allocation for CPU-bound tasks'],
      };
    }

    if (input.analysisType === 'all' || input.analysisType === 'errors') {
      result.errors = {
        coverage: 85,
        issues: [],
        suggestions: ['Add structured error logging'],
      };
    }

    return result;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

let backendWorkerInstance: BackendWorkerAgent | null = null;

/**
 * Get or create the Backend Worker Agent singleton
 */
export function getBackendWorkerAgent(config?: Partial<WorkerConfig>): BackendWorkerAgent {
  if (!backendWorkerInstance) {
    backendWorkerInstance = new BackendWorkerAgent(config);
  }
  return backendWorkerInstance;
}

/**
 * Reset the Backend Worker Agent instance (useful for testing)
 */
export async function resetBackendWorkerAgent(): Promise<void> {
  if (backendWorkerInstance) {
    await backendWorkerInstance.stop();
  }
  backendWorkerInstance = null;
}

/**
 * Create a new Backend Worker Agent instance (for multi-worker setups)
 */
export function createBackendWorkerAgent(config?: Partial<WorkerConfig>): BackendWorkerAgent {
  return new BackendWorkerAgent(config);
}
