/**
 * Prompts Router
 *
 * API endpoint for retrieving canonical system prompts by role.
 * Used by the frontend to fetch the single source of truth prompt
 * for MCP chat and other client-side prompt consumers.
 *
 * Endpoints:
 *   GET /api/prompts/:role?locale=ja  - Get canonical prompt for a role
 *
 * @see /home/ubuntu/Downloads/vow/specs/role-based-prompt-system/architecture.md Section 5.2
 * @see /home/ubuntu/Downloads/vow/specs/role-based-prompt-system/migration-plan.md Phase 1
 *
 * @module routers/prompts
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { AuthContext } from '../middleware/auth.js';
import { getCanonicalPrompt, getPromptForUser, type AgentRole, type Locale } from '../prompts/prompt-registry.js';
import { getLogger } from '../utils/logger.js';
import { getAgentConfig, updateAgentConfig, resetAgentConfig } from '../services/agent-config-service.js';
import { getSupabaseClient } from '../utils/supabase.js';

const logger = getLogger('promptsRouter');

const VALID_ROLES: AgentRole[] = ['AICoach', 'coach', 'manager', 'default'];
const VALID_LOCALES: Locale[] = ['ja', 'en'];

const promptsRouter = new Hono<{ Variables: AuthContext }>();

/**
 * GET /api/prompts/:role/user
 * Get the user's customized prompt for a role.
 * Returns user override if exists, otherwise canonical default.
 */
promptsRouter.get('/:role/user', async (c: Context<{ Variables: AuthContext }>) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const rawRole = c.req.param('role') as string;
  const role = rawRole === 'coach' ? 'AICoach' : rawRole;
  if (!VALID_ROLES.includes(role as AgentRole)) {
    return c.json({ error: 'Invalid role', validRoles: VALID_ROLES }, 400);
  }

  const localeParam = (c.req.query('locale') || 'ja') as Locale;

  try {
    const supabase = getSupabaseClient();
    const promptResponse = await getPromptForUser(role as AgentRole, localeParam, supabase, user.sub);

    // Check if this is a user override or canonical
    const config = await getAgentConfig(supabase, user.sub, role);
    const isCustomized = !!(config?.instructions && config.instructions.trim().length > 0);

    return c.json({
      ...promptResponse,
      isCustomized,
    });
  } catch (error) {
    logger.error('Failed to get user prompt', error as Error, { role, userId: user.sub });
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * PUT /api/prompts/:role/user
 * Save user's prompt customization.
 */
promptsRouter.put('/:role/user', async (c: Context<{ Variables: AuthContext }>) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const rawRole = c.req.param('role') as string;
  const role = rawRole === 'coach' ? 'AICoach' : rawRole;
  if (!VALID_ROLES.includes(role as AgentRole)) {
    return c.json({ error: 'Invalid role', validRoles: VALID_ROLES }, 400);
  }

  try {
    const body = await c.req.json();
    const instructions = body.instructions;

    if (!instructions || typeof instructions !== 'string') {
      return c.json({ error: 'Missing or invalid "instructions" field' }, 400);
    }

    const supabase = getSupabaseClient();
    const updated = await updateAgentConfig(supabase, user.sub, role, { instructions });

    if (!updated) {
      return c.json({ error: 'Failed to save prompt customization' }, 500);
    }

    logger.info('User prompt saved', { role, userId: user.sub });

    return c.json({
      success: true,
      message: 'Prompt customization saved',
      agentId: role,
    });
  } catch (error) {
    logger.error('Failed to save user prompt', error as Error, { role, userId: user.sub });
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * DELETE /api/prompts/:role/user
 * Reset user's prompt to canonical default.
 */
promptsRouter.delete('/:role/user', async (c: Context<{ Variables: AuthContext }>) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const rawRole = c.req.param('role') as string;
  const role = rawRole === 'coach' ? 'AICoach' : rawRole;
  if (!VALID_ROLES.includes(role as AgentRole)) {
    return c.json({ error: 'Invalid role', validRoles: VALID_ROLES }, 400);
  }

  try {
    const supabase = getSupabaseClient();
    await resetAgentConfig(supabase, user.sub, role);

    logger.info('User prompt reset to canonical', { role, userId: user.sub });

    return c.json({
      success: true,
      message: 'Prompt reset to default',
    });
  } catch (error) {
    logger.error('Failed to reset user prompt', error as Error, { role, userId: user.sub });
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /api/prompts/:role
 *
 * Returns the canonical system prompt for the specified role.
 * Auth required (Bearer token).
 *
 * Query params:
 *   locale - 'ja' | 'en' (default: 'ja')
 *
 * Response: { systemPrompt, role, locale, version, hash }
 *
 * Cache headers:
 *   Cache-Control: private, max-age=300 (5 min browser cache)
 *   ETag: based on prompt hash
 */
promptsRouter.get('/:role', async (c: Context<{ Variables: AuthContext }>) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const rawRole = c.req.param('role') as string;
  // Resolve alias: 'coach' -> 'AICoach'
  const role = rawRole === 'coach' ? 'AICoach' : rawRole;
  if (!VALID_ROLES.includes(role as AgentRole)) {
    return c.json(
      { error: 'Invalid role', validRoles: VALID_ROLES },
      400
    );
  }

  const localeParam = c.req.query('locale') || 'ja';
  if (!VALID_LOCALES.includes(localeParam as Locale)) {
    return c.json(
      { error: 'Invalid locale', validLocales: VALID_LOCALES },
      400
    );
  }

  const locale = localeParam as Locale;

  try {
    const promptResponse = getCanonicalPrompt(role as AgentRole, locale);

    // ETag for conditional requests
    const etag = `"${promptResponse.hash}"`;
    const ifNoneMatch = c.req.header('if-none-match');
    if (ifNoneMatch === etag) {
      return new Response(null, { status: 304 });
    }

    logger.info('Prompt served', {
      role,
      locale,
      userId: user.sub,
      version: promptResponse.version,
    });

    return c.json(promptResponse, 200, {
      'Cache-Control': 'private, max-age=300',
      'ETag': etag,
    });
  } catch (error) {
    logger.error('Failed to get prompt', error as Error, {
      role,
      locale,
    });
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export function createPromptsRouter(): Hono<{ Variables: AuthContext }> {
  return promptsRouter;
}

export { promptsRouter };
