/**
 * Mastra Client Module for VOW Frontend
 *
 * Exports the Mastra client and utilities for frontend agent interactions.
 *
 * @module lib/mastra
 */

export {
  MastraClient,
  getFrontendMastraConfig,
  DEFAULT_FRONTEND_CONFIG,
  type FrontendMastraConfig,
  type AgentMessage,
  type AgentResponse,
  type ToolCallResult,
} from './config';
