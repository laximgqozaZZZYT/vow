/**
 * Mastra Multi-Agent System for VOW
 *
 * Mastra Agentクラスを使用したマルチエージェントシステム
 *
 * エージェント構成:
 * - Manager Agent: 統括、タスク分配、応答集約
 * - Habit Coach Agent: 習慣分析・提案
 * - Goal Planner Agent: 目標設定・マイルストーン
 * - Progress Tracker Agent: 進捗追跡・分析
 *
 * @module agents/mastra/agents
 */

export { managerAgent } from './manager-agent.js';
export { habitCoachAgent } from './habit-coach-agent.js';
export { goalPlannerAgent } from './goal-planner-agent.js';
export { progressTrackerAgent } from './progress-tracker-agent.js';

export type { AgentResponse, MultiAgentResponse } from './types.js';
