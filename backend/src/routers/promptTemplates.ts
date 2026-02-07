/**
 * Prompt Templates Router
 *
 * Serves prompt templates stored in Supabase in markdown format.
 * Templates use {{variable}} placeholders for runtime substitution.
 *
 * Endpoints:
 *   GET /api/prompt-templates/:key?locale=ja  - Get a prompt template by key
 *
 * @module routers/promptTemplates
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { AuthContext } from '../middleware/auth.js';
import { getSupabaseClient } from '../utils/supabase.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('promptTemplatesRouter');

const promptTemplatesRouter = new Hono<{ Variables: AuthContext }>();

/**
 * GET /api/prompt-templates/:key
 *
 * Fetches a prompt template by template_key and optional locale.
 * Auth required (Bearer token via global JWT middleware).
 *
 * Query params:
 *   locale - 'ja' | 'en' (default: 'ja')
 *
 * Response: { template_key, locale, content, description, version }
 *
 * Cache headers:
 *   Cache-Control: private, max-age=300 (5 min browser cache)
 *
 * Fallback behavior:
 *   If the requested locale is not found, falls back to 'ja'.
 */
promptTemplatesRouter.get('/:key', async (c: Context<{ Variables: AuthContext }>) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const key = c.req.param('key');
  const locale = c.req.query('locale') || 'ja';

  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('prompt_templates')
      .select('template_key, locale, content, description, version')
      .eq('template_key', key)
      .eq('locale', locale)
      .single();

    if (error || !data) {
      // Try fallback to 'ja' if requested locale not found
      if (locale !== 'ja') {
        const { data: fallback, error: fallbackError } = await supabase
          .from('prompt_templates')
          .select('template_key, locale, content, description, version')
          .eq('template_key', key)
          .eq('locale', 'ja')
          .single();

        if (!fallbackError && fallback) {
          logger.info('Prompt template served (fallback locale)', {
            key,
            requestedLocale: locale,
            fallbackLocale: 'ja',
            userId: user.sub,
          });

          return c.json(fallback, 200, {
            'Cache-Control': 'private, max-age=300',
          });
        }
      }

      logger.warning('Prompt template not found', { key, locale, userId: user.sub });
      return c.json({ error: `Template '${key}' not found` }, 404);
    }

    logger.info('Prompt template served', {
      key,
      locale,
      userId: user.sub,
      version: data.version,
    });

    return c.json(data, 200, {
      'Cache-Control': 'private, max-age=300',
    });
  } catch (error) {
    logger.error('Failed to get prompt template', error as Error, {
      key,
      locale,
    });
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export function createPromptTemplatesRouter(): Hono<{ Variables: AuthContext }> {
  return promptTemplatesRouter;
}

export { promptTemplatesRouter };
