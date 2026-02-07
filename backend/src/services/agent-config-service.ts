/**
 * Agent Configuration Service
 *
 * Manages user-customizable agent configurations stored in Supabase.
 * Supports on-demand agent instantiation based on user settings.
 *
 * @module services/agent-config-service
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('agent-config-service');

/**
 * Agent configuration stored in database
 */
export interface AgentConfig {
  id: string;
  userId: string;
  agentId: string;
  name: string;
  description: string | null;
  icon: string;
  instructions: string;
  model: string;
  temperature: number;
  maxTokens: number;
  enabledTools: string[];
  customTools: unknown[];
  enabled: boolean;
  role: string;
  capabilities: string[];
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Agent config update payload
 */
export interface AgentConfigUpdate {
  name?: string;
  description?: string;
  icon?: string;
  instructions?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  enabledTools?: string[];
  enabled?: boolean;
  role?: string;
  capabilities?: string[];
}

/**
 * Default agent IDs available in the system
 */
export const DEFAULT_AGENT_IDS = ['AICoach', 'habit-coach', 'goal-planner', 'progress-tracker'] as const;
export type DefaultAgentId = typeof DEFAULT_AGENT_IDS[number];

/**
 * Available tools for each agent type
 */
export const AGENT_AVAILABLE_TOOLS: Record<DefaultAgentId, string[]> = {
  'AICoach': ['analyze_habits', 'suggest_habits', 'generate_baby_steps', 'suggest_goals', 'check_progress'],
  'habit-coach': ['analyze_habits', 'suggest_habits', 'generate_baby_steps'],
  'goal-planner': ['create_smart_goal', 'suggest_goals', 'breakdown_milestones', 'prioritize_goals'],
  'progress-tracker': ['check_progress', 'generate_report', 'analyze_trends'],
};

/**
 * Convert database row to AgentConfig interface
 */
function rowToAgentConfig(row: Record<string, unknown>): AgentConfig {
  return {
    id: row['id'] as string,
    userId: row['user_id'] as string,
    agentId: row['agent_id'] as string,
    name: row['name'] as string,
    description: row['description'] as string | null,
    icon: row['icon'] as string,
    instructions: row['instructions'] as string,
    model: row['model'] as string,
    temperature: Number(row['temperature']),
    maxTokens: row['max_tokens'] as number,
    enabledTools: (row['enabled_tools'] as string[]) || [],
    customTools: (row['custom_tools'] as unknown[]) || [],
    enabled: row['enabled'] as boolean,
    role: (row['role'] as string) || 'custom',
    capabilities: (row['capabilities'] as string[]) || [],
    isBuiltIn: (row['is_builtin'] as boolean) || false,
    createdAt: row['created_at'] as string,
    updatedAt: row['updated_at'] as string,
  };
}

/**
 * Get agent configuration for a user
 * Creates default config if not exists
 */
export async function getAgentConfig(
  supabase: SupabaseClient,
  userId: string,
  agentId: string
): Promise<AgentConfig | null> {
  try {
    // Use the database function to get or create config
    const { data, error } = await supabase.rpc('get_or_create_agent_config', {
      p_user_id: userId,
      p_agent_id: agentId,
    });

    if (error) {
      logger.error('Failed to get agent config', error, { userId, agentId });
      return null;
    }

    if (!data) {
      return null;
    }

    return rowToAgentConfig(data);
  } catch (error) {
    logger.error('Error getting agent config', error as Error, { userId, agentId });
    return null;
  }
}

/**
 * Get all agent configurations for a user
 */
export async function getAllAgentConfigs(
  supabase: SupabaseClient,
  userId: string
): Promise<AgentConfig[]> {
  try {
    // First ensure all default agents have configs
    for (const agentId of DEFAULT_AGENT_IDS) {
      await getAgentConfig(supabase, userId, agentId);
    }

    // Now fetch all configs
    const { data, error } = await supabase
      .from('agent_configs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('Failed to get all agent configs', error, { userId });
      return [];
    }

    return (data || []).map(rowToAgentConfig);
  } catch (error) {
    logger.error('Error getting all agent configs', error as Error, { userId });
    return [];
  }
}

/**
 * Update agent configuration
 */
export async function updateAgentConfig(
  supabase: SupabaseClient,
  userId: string,
  agentId: string,
  updates: AgentConfigUpdate
): Promise<AgentConfig | null> {
  try {
    // Convert camelCase to snake_case for database
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates['name'] = updates.name;
    if (updates.description !== undefined) dbUpdates['description'] = updates.description;
    if (updates.icon !== undefined) dbUpdates['icon'] = updates.icon;
    if (updates.instructions !== undefined) dbUpdates['instructions'] = updates.instructions;
    if (updates.model !== undefined) dbUpdates['model'] = updates.model;
    if (updates.temperature !== undefined) dbUpdates['temperature'] = updates.temperature;
    if (updates.maxTokens !== undefined) dbUpdates['max_tokens'] = updates.maxTokens;
    if (updates.enabledTools !== undefined) dbUpdates['enabled_tools'] = updates.enabledTools;
    if (updates.enabled !== undefined) dbUpdates['enabled'] = updates.enabled;
    if (updates.role !== undefined) dbUpdates['role'] = updates.role;
    if (updates.capabilities !== undefined) dbUpdates['capabilities'] = updates.capabilities;

    const { data, error } = await supabase
      .from('agent_configs')
      .update(dbUpdates)
      .eq('user_id', userId)
      .eq('agent_id', agentId)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update agent config', error, { userId, agentId });
      return null;
    }

    logger.info('Agent config updated', { userId, agentId, updates: Object.keys(updates) });
    return rowToAgentConfig(data);
  } catch (error) {
    logger.error('Error updating agent config', error as Error, { userId, agentId });
    return null;
  }
}

/**
 * Reset agent configuration to defaults
 */
export async function resetAgentConfig(
  supabase: SupabaseClient,
  userId: string,
  agentId: string
): Promise<AgentConfig | null> {
  try {
    // Delete existing config
    await supabase
      .from('agent_configs')
      .delete()
      .eq('user_id', userId)
      .eq('agent_id', agentId);

    // Re-create with defaults
    return await getAgentConfig(supabase, userId, agentId);
  } catch (error) {
    logger.error('Error resetting agent config', error as Error, { userId, agentId });
    return null;
  }
}

/**
 * Create a custom agent configuration
 */
export async function createCustomAgentConfig(
  supabase: SupabaseClient,
  userId: string,
  config: {
    name: string;
    description?: string;
    icon?: string;
    instructions?: string;
    role?: string;
    capabilities?: string[];
  }
): Promise<AgentConfig | null> {
  try {
    const agentId = `custom-${Date.now()}`;

    const { data, error } = await supabase
      .from('agent_configs')
      .insert({
        user_id: userId,
        agent_id: agentId,
        name: config.name,
        description: config.description || '',
        icon: config.icon || '🤖',
        instructions: config.instructions || '',
        role: config.role || 'custom',
        capabilities: config.capabilities || [],
        is_builtin: false,
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create custom agent config', error, { userId, agentId });
      return null;
    }

    logger.info('Custom agent config created', { userId, agentId, name: config.name });
    return rowToAgentConfig(data);
  } catch (error) {
    logger.error('Error creating custom agent config', error as Error, { userId });
    return null;
  }
}

/**
 * Bulk create custom agent configs (for localStorage migration)
 */
export async function bulkCreateCustomAgentConfigs(
  supabase: SupabaseClient,
  userId: string,
  configs: Array<{
    agentId: string;
    name: string;
    description?: string;
    icon?: string;
    instructions?: string;
    role?: string;
    capabilities?: string[];
  }>
): Promise<AgentConfig[]> {
  try {
    const rows = configs.map(config => ({
      user_id: userId,
      agent_id: config.agentId,
      name: config.name,
      description: config.description || '',
      icon: config.icon || '🤖',
      instructions: config.instructions || '',
      role: config.role || 'custom',
      capabilities: config.capabilities || [],
      is_builtin: false,
    }));

    const { data, error } = await supabase
      .from('agent_configs')
      .upsert(rows, { onConflict: 'user_id,agent_id' })
      .select();

    if (error) {
      logger.error('Failed to bulk create custom agent configs', error, { userId, count: configs.length });
      return [];
    }

    logger.info('Bulk custom agent configs created', { userId, count: (data || []).length });
    return (data || []).map(rowToAgentConfig);
  } catch (error) {
    logger.error('Error bulk creating custom agent configs', error as Error, { userId });
    return [];
  }
}

/**
 * Delete a custom agent configuration (built-in agents cannot be deleted)
 */
export async function deleteCustomAgentConfig(
  supabase: SupabaseClient,
  userId: string,
  agentId: string
): Promise<boolean> {
  try {
    // First verify it's not a built-in agent
    const { data: existing } = await supabase
      .from('agent_configs')
      .select('is_builtin')
      .eq('user_id', userId)
      .eq('agent_id', agentId)
      .single();

    if (existing?.is_builtin) {
      logger.warning('Attempted to delete built-in agent config', { userId, agentId });
      return false;
    }

    const { error } = await supabase
      .from('agent_configs')
      .delete()
      .eq('user_id', userId)
      .eq('agent_id', agentId)
      .eq('is_builtin', false);

    if (error) {
      logger.error('Failed to delete custom agent config', error, { userId, agentId });
      return false;
    }

    logger.info('Custom agent config deleted', { userId, agentId });
    return true;
  } catch (error) {
    logger.error('Error deleting custom agent config', error as Error, { userId, agentId });
    return false;
  }
}

/**
 * Check if agent is enabled for user
 */
export async function isAgentEnabled(
  supabase: SupabaseClient,
  userId: string,
  agentId: string
): Promise<boolean> {
  const config = await getAgentConfig(supabase, userId, agentId);
  return config?.enabled ?? false;
}

/**
 * Get available tools for an agent
 */
export function getAvailableTools(agentId: string): string[] {
  if (agentId in AGENT_AVAILABLE_TOOLS) {
    return AGENT_AVAILABLE_TOOLS[agentId as DefaultAgentId];
  }
  return [];
}

export default {
  getAgentConfig,
  getAllAgentConfigs,
  updateAgentConfig,
  resetAgentConfig,
  isAgentEnabled,
  getAvailableTools,
  createCustomAgentConfig,
  bulkCreateCustomAgentConfigs,
  deleteCustomAgentConfig,
  DEFAULT_AGENT_IDS,
  AGENT_AVAILABLE_TOOLS,
};
