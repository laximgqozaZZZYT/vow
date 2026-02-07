/**
 * Agent Configs Router
 *
 * CRUD API for managing agent configurations (built-in + custom roles).
 * Follows the same pattern as prompts.ts router.
 *
 * Endpoints:
 *   GET    /api/agent-configs           - List all configs (built-in + custom)
 *   GET    /api/agent-configs/:agentId  - Get single config
 *   POST   /api/agent-configs           - Create custom agent
 *   PUT    /api/agent-configs/:agentId  - Update agent config
 *   DELETE /api/agent-configs/:agentId  - Delete custom agent (built-in → 403)
 *   POST   /api/agent-configs/migrate   - Bulk migrate from localStorage
 *
 * @module routers/agentConfigs
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { AuthContext } from '../middleware/auth.js';
import {
  getAllAgentConfigs,
  getAgentConfig,
  updateAgentConfig,
  createCustomAgentConfig,
  bulkCreateCustomAgentConfigs,
  deleteCustomAgentConfig,
} from '../services/agent-config-service.js';
import { getSupabaseClient } from '../utils/supabase.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('agentConfigsRouter');

/**
 * Frontend-facing agent config shape
 */
interface AgentConfigResponse {
  id: string;
  name: string;
  role: string;
  description: string;
  icon: string;
  systemPrompt: string;
  capabilities: string[];
  isBuiltIn: boolean;
}

/**
 * Convert backend AgentConfig to frontend response shape
 */
function toResponse(config: {
  agentId: string;
  name: string;
  role: string;
  description: string | null;
  icon: string;
  instructions: string;
  capabilities: string[];
  isBuiltIn: boolean;
}): AgentConfigResponse {
  return {
    id: config.agentId,
    name: config.name,
    role: config.role,
    description: config.description || '',
    icon: config.icon,
    systemPrompt: config.instructions,
    capabilities: config.capabilities,
    isBuiltIn: config.isBuiltIn,
  };
}

const agentConfigsRouter = new Hono<{ Variables: AuthContext }>();

/**
 * POST /api/agent-configs/migrate
 * Bulk migrate custom agents from localStorage.
 * Must be defined before /:agentId to avoid route conflicts.
 */
agentConfigsRouter.post('/migrate', async (c: Context<{ Variables: AuthContext }>) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.json();
    const agents = body['agents'];

    if (!Array.isArray(agents)) {
      return c.json({ error: 'Missing or invalid "agents" array' }, 400);
    }

    const supabase = getSupabaseClient();
    const configs = agents.map((a: Record<string, unknown>) => ({
      agentId: (a['id'] as string) || `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: (a['name'] as string) || 'Unnamed Agent',
      description: (a['description'] as string) || '',
      icon: (a['icon'] as string) || '🤖',
      instructions: (a['systemPrompt'] as string) || '',
      role: (a['role'] as string) || 'custom',
      capabilities: (a['capabilities'] as string[]) || [],
    }));

    const created = await bulkCreateCustomAgentConfigs(supabase, user.sub, configs);

    logger.info('localStorage migration completed', {
      userId: user.sub,
      requested: configs.length,
      created: created.length,
    });

    return c.json({
      success: true,
      migrated: created.length,
      configs: created.map(toResponse),
    });
  } catch (error) {
    logger.error('Failed to migrate agent configs', error as Error, { userId: user.sub });
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /api/agent-configs
 * List all agent configs for the authenticated user (built-in + custom).
 */
agentConfigsRouter.get('/', async (c: Context<{ Variables: AuthContext }>) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const supabase = getSupabaseClient();
    const configs = await getAllAgentConfigs(supabase, user.sub);

    return c.json({
      configs: configs.map(toResponse),
    });
  } catch (error) {
    logger.error('Failed to list agent configs', error as Error, { userId: user.sub });
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /api/agent-configs/:agentId
 * Get a single agent config.
 */
agentConfigsRouter.get('/:agentId', async (c: Context<{ Variables: AuthContext }>) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const agentId = c.req.param('agentId');

  try {
    const supabase = getSupabaseClient();
    const config = await getAgentConfig(supabase, user.sub, agentId);

    if (!config) {
      return c.json({ error: 'Agent config not found' }, 404);
    }

    return c.json(toResponse(config));
  } catch (error) {
    logger.error('Failed to get agent config', error as Error, { userId: user.sub, agentId });
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /api/agent-configs
 * Create a new custom agent config.
 */
agentConfigsRouter.post('/', async (c: Context<{ Variables: AuthContext }>) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.json();

    const name = body['name'];
    if (!name || typeof name !== 'string' || !name.trim()) {
      return c.json({ error: 'Missing or invalid "name" field' }, 400);
    }

    const supabase = getSupabaseClient();
    const config = await createCustomAgentConfig(supabase, user.sub, {
      name: name.trim(),
      description: (body['description'] as string) || '',
      icon: (body['icon'] as string) || '🤖',
      instructions: (body['systemPrompt'] as string) || (body['instructions'] as string) || '',
      role: (body['role'] as string) || 'custom',
      capabilities: (body['capabilities'] as string[]) || [],
    });

    if (!config) {
      return c.json({ error: 'Failed to create agent config' }, 500);
    }

    logger.info('Custom agent created', { userId: user.sub, agentId: config.agentId });

    return c.json(toResponse(config), 201);
  } catch (error) {
    logger.error('Failed to create agent config', error as Error, { userId: user.sub });
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * PUT /api/agent-configs/:agentId
 * Update an existing agent config.
 */
agentConfigsRouter.put('/:agentId', async (c: Context<{ Variables: AuthContext }>) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const agentId = c.req.param('agentId');

  try {
    const body = await c.req.json();

    const updates: Record<string, unknown> = {};
    if (body['name'] !== undefined) updates['name'] = body['name'];
    if (body['description'] !== undefined) updates['description'] = body['description'];
    if (body['icon'] !== undefined) updates['icon'] = body['icon'];
    if (body['systemPrompt'] !== undefined) updates['instructions'] = body['systemPrompt'];
    if (body['instructions'] !== undefined) updates['instructions'] = body['instructions'];
    if (body['role'] !== undefined) updates['role'] = body['role'];
    if (body['capabilities'] !== undefined) updates['capabilities'] = body['capabilities'];
    if (body['model'] !== undefined) updates['model'] = body['model'];
    if (body['temperature'] !== undefined) updates['temperature'] = body['temperature'];
    if (body['maxTokens'] !== undefined) updates['maxTokens'] = body['maxTokens'];
    if (body['enabledTools'] !== undefined) updates['enabledTools'] = body['enabledTools'];
    if (body['enabled'] !== undefined) updates['enabled'] = body['enabled'];

    const supabase = getSupabaseClient();
    const config = await updateAgentConfig(supabase, user.sub, agentId, updates);

    if (!config) {
      return c.json({ error: 'Failed to update agent config' }, 500);
    }

    logger.info('Agent config updated', { userId: user.sub, agentId });

    return c.json(toResponse(config));
  } catch (error) {
    logger.error('Failed to update agent config', error as Error, { userId: user.sub, agentId });
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * DELETE /api/agent-configs/:agentId
 * Delete a custom agent config. Built-in agents return 403.
 */
agentConfigsRouter.delete('/:agentId', async (c: Context<{ Variables: AuthContext }>) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const agentId = c.req.param('agentId');

  try {
    const supabase = getSupabaseClient();

    // Check if it's a built-in agent first
    const existing = await getAgentConfig(supabase, user.sub, agentId);
    if (existing?.isBuiltIn) {
      return c.json({ error: 'Cannot delete built-in agent' }, 403);
    }

    const deleted = await deleteCustomAgentConfig(supabase, user.sub, agentId);

    if (!deleted) {
      return c.json({ error: 'Failed to delete agent config or agent not found' }, 404);
    }

    logger.info('Custom agent deleted', { userId: user.sub, agentId });

    return c.json({ success: true, message: 'Agent config deleted' });
  } catch (error) {
    logger.error('Failed to delete agent config', error as Error, { userId: user.sub, agentId });
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export function createAgentConfigsRouter(): Hono<{ Variables: AuthContext }> {
  return agentConfigsRouter;
}

export { agentConfigsRouter };
