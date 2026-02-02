/**
 * Strands Worker Agents Module for VOW Backend
 *
 * Exports worker agent implementations for the VOW multi-agent system.
 * Workers specialize in different domains and claim tasks from the
 * MCP Task Server based on their role and capabilities.
 *
 * Available Workers:
 * - FrontendWorkerAgent: React/TypeScript/CSS tasks
 * - BackendWorkerAgent: Node.js/Express/Lambda tasks
 *
 * Requirements:
 * - B-009: Strands Worker Agent Pool
 * - 7.1-7.8: Worker agent implementation requirements
 *
 * @module agents/strands/workers
 */

// Base Worker
export {
  BaseWorkerAgent,
  getWorkerConfig,
  createTaskContext,
  parseTaskMetadata,
  WORKER_ENV_KEYS,
  type WorkerConfig,
  type WorkerStatus,
  type WorkerRegistration,
  type TaskClaimResult,
  type TaskResult,
  type WorkerEventHandlers,
  type TaskProcessor,
} from './base-worker.js';

// Frontend Worker
export {
  FrontendWorkerAgent,
  getFrontendWorkerAgent,
  resetFrontendWorkerAgent,
  createFrontendWorkerAgent,
} from './frontend-worker.js';

// Backend Worker
export {
  BackendWorkerAgent,
  getBackendWorkerAgent,
  resetBackendWorkerAgent,
  createBackendWorkerAgent,
} from './backend-worker.js';

// =============================================================================
// Worker Pool Management
// =============================================================================

import { FrontendWorkerAgent } from './frontend-worker.js';
import { BackendWorkerAgent } from './backend-worker.js';
import type { WorkerConfig, WorkerEventHandlers } from './base-worker.js';
import { getLogger } from '../../../utils/logger.js';

const logger = getLogger('worker-pool');

/**
 * Worker pool configuration
 */
export interface WorkerPoolConfig {
  /** Number of frontend workers */
  frontendWorkers: number;
  /** Number of backend workers */
  backendWorkers: number;
  /** Base configuration for all workers */
  baseConfig?: Partial<WorkerConfig>;
  /** Event handlers for all workers */
  eventHandlers?: WorkerEventHandlers;
}

/**
 * Default worker pool configuration
 */
export const DEFAULT_WORKER_POOL_CONFIG: WorkerPoolConfig = {
  frontendWorkers: 2,
  backendWorkers: 2,
};

/**
 * Worker pool for managing multiple worker agents
 */
export class WorkerPool {
  private readonly config: WorkerPoolConfig;
  private readonly frontendWorkers: FrontendWorkerAgent[] = [];
  private readonly backendWorkers: BackendWorkerAgent[] = [];
  private isRunning = false;

  constructor(config: Partial<WorkerPoolConfig> = {}) {
    this.config = { ...DEFAULT_WORKER_POOL_CONFIG, ...config };

    logger.info('Worker pool initialized', {
      frontendWorkers: this.config.frontendWorkers,
      backendWorkers: this.config.backendWorkers,
    });
  }

  /**
   * Start all workers in the pool
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warning('Worker pool already running');
      return;
    }

    logger.info('Starting worker pool');

    // Create frontend workers
    for (let i = 0; i < this.config.frontendWorkers; i++) {
      const worker = new FrontendWorkerAgent({
        ...this.config.baseConfig,
        agentName: `frontend-worker-${i + 1}`,
      });

      if (this.config.eventHandlers) {
        worker.setEventHandlers(this.config.eventHandlers);
      }

      this.frontendWorkers.push(worker);
    }

    // Create backend workers
    for (let i = 0; i < this.config.backendWorkers; i++) {
      const worker = new BackendWorkerAgent({
        ...this.config.baseConfig,
        agentName: `backend-worker-${i + 1}`,
      });

      if (this.config.eventHandlers) {
        worker.setEventHandlers(this.config.eventHandlers);
      }

      this.backendWorkers.push(worker);
    }

    // Start all workers
    const allWorkers = [...this.frontendWorkers, ...this.backendWorkers];
    await Promise.all(allWorkers.map((worker) => worker.start()));

    this.isRunning = true;

    logger.info('Worker pool started', {
      totalWorkers: allWorkers.length,
      frontendWorkers: this.frontendWorkers.length,
      backendWorkers: this.backendWorkers.length,
    });
  }

  /**
   * Stop all workers in the pool
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping worker pool');

    const allWorkers = [...this.frontendWorkers, ...this.backendWorkers];
    await Promise.all(allWorkers.map((worker) => worker.stop()));

    this.frontendWorkers.length = 0;
    this.backendWorkers.length = 0;
    this.isRunning = false;

    logger.info('Worker pool stopped');
  }

  /**
   * Get pool status
   */
  getStatus(): {
    isRunning: boolean;
    frontendWorkers: Array<{ id: string | null; status: string; currentTask: string | null }>;
    backendWorkers: Array<{ id: string | null; status: string; currentTask: string | null }>;
  } {
    return {
      isRunning: this.isRunning,
      frontendWorkers: this.frontendWorkers.map((w) => ({
        id: w.getWorkerId(),
        status: w.getStatus(),
        currentTask: w.getCurrentTask()?.id || null,
      })),
      backendWorkers: this.backendWorkers.map((w) => ({
        id: w.getWorkerId(),
        status: w.getStatus(),
        currentTask: w.getCurrentTask()?.id || null,
      })),
    };
  }

  /**
   * Get all frontend workers
   */
  getFrontendWorkers(): FrontendWorkerAgent[] {
    return [...this.frontendWorkers];
  }

  /**
   * Get all backend workers
   */
  getBackendWorkers(): BackendWorkerAgent[] {
    return [...this.backendWorkers];
  }

  /**
   * Get total worker count
   */
  getTotalWorkerCount(): number {
    return this.frontendWorkers.length + this.backendWorkers.length;
  }

  /**
   * Get idle worker count
   */
  getIdleWorkerCount(): number {
    const allWorkers = [...this.frontendWorkers, ...this.backendWorkers];
    return allWorkers.filter((w) => w.getStatus() === 'idle').length;
  }

  /**
   * Get busy worker count
   */
  getBusyWorkerCount(): number {
    const allWorkers = [...this.frontendWorkers, ...this.backendWorkers];
    return allWorkers.filter((w) => w.getStatus() === 'busy').length;
  }
}

// =============================================================================
// Singleton Worker Pool
// =============================================================================

let workerPoolInstance: WorkerPool | null = null;

/**
 * Get or create the worker pool singleton
 */
export function getWorkerPool(config?: Partial<WorkerPoolConfig>): WorkerPool {
  if (!workerPoolInstance) {
    workerPoolInstance = new WorkerPool(config);
  }
  return workerPoolInstance;
}

/**
 * Reset the worker pool instance (useful for testing)
 */
export async function resetWorkerPool(): Promise<void> {
  if (workerPoolInstance) {
    await workerPoolInstance.stop();
  }
  workerPoolInstance = null;
}

// =============================================================================
// Quick Start Functions
// =============================================================================

/**
 * Start the default worker pool
 *
 * @param config - Optional configuration overrides
 * @returns The started worker pool
 */
export async function startWorkerPool(config?: Partial<WorkerPoolConfig>): Promise<WorkerPool> {
  const pool = getWorkerPool(config);
  await pool.start();
  return pool;
}

/**
 * Stop the worker pool
 */
export async function stopWorkerPool(): Promise<void> {
  if (workerPoolInstance) {
    await workerPoolInstance.stop();
  }
}
