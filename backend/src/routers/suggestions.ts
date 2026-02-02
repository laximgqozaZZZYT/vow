/**
 * Suggestions Router
 *
 * API endpoints for managing deferred AI suggestions.
 * When users select "Later" on a suggestion, it is saved here for future reference.
 *
 * Endpoints:
 * - POST   /api/suggestions       - Save a deferred suggestion
 * - GET    /api/suggestions       - Get saved suggestions
 * - PATCH  /api/suggestions/:id   - Update suggestion status
 * - DELETE /api/suggestions/:id   - Delete a suggestion
 *
 * @module routers/suggestions
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { getSupabaseClient } from '../utils/supabase.js';
import { getLogger } from '../utils/logger.js';
import type { AuthContext } from '../middleware/auth.js';
import { getUserFriendlyMessage } from '../errors/index.js';

const logger = getLogger('suggestionsRouter');

// =============================================================================
// Schemas
// =============================================================================

/**
 * Suggestion data schema
 */
const SuggestionDataSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['do', 'avoid']).optional(),
  frequency: z.string().optional(),
  reason: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  suggestedHabits: z.array(z.string()).optional(),
  rationale: z.string().optional(),
}).passthrough(); // Allow additional properties

/**
 * Create suggestion request schema
 */
const CreateSuggestionSchema = z.object({
  suggestionType: z.enum(['habit', 'goal']),
  suggestionData: SuggestionDataSchema,
  source: z.enum(['coach', 'manager', 'analysis', 'manual']).default('coach'),
  goalId: z.string().uuid().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  expiresAt: z.string().datetime().optional().nullable(),
});

/**
 * Update suggestion request schema
 */
const UpdateSuggestionSchema = z.object({
  status: z.enum(['pending', 'accepted', 'dismissed', 'snoozed']).optional(),
  snoozeUntil: z.string().datetime().optional().nullable(),
  acceptedEntityId: z.string().uuid().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

// Note: Query parameters are parsed manually in the handler
// to avoid Zod validator issues with query string parsing

// =============================================================================
// Types
// =============================================================================

/**
 * Saved suggestion record
 */
export interface SavedSuggestion {
  id: string;
  userId: string;
  suggestionType: 'habit' | 'goal';
  suggestionData: Record<string, unknown>;
  source: 'coach' | 'manager' | 'analysis' | 'manual';
  status: 'pending' | 'accepted' | 'dismissed' | 'snoozed';
  goalId?: string | null;
  acceptedEntityId?: string | null;
  priority: 'low' | 'medium' | 'high';
  snoozeUntil?: string | null;
  expiresAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// Router
// =============================================================================

const suggestionsRouter = new Hono<{ Variables: AuthContext }>();

/**
 * POST /api/suggestions
 * Save a deferred suggestion for later review.
 */
suggestionsRouter.post(
  '/',
  zValidator('json', CreateSuggestionSchema),
  async (c: Context<{ Variables: AuthContext }>) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userId = user.sub;
    const body = c.req.valid('json' as never) as z.infer<typeof CreateSuggestionSchema>;

    try {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from('deferred_suggestions')
        .insert({
          user_id: userId,
          suggestion_type: body.suggestionType,
          suggestion_data: body.suggestionData,
          source: body.source,
          status: 'pending',
          goal_id: body.goalId || null,
          priority: body.priority,
          expires_at: body.expiresAt || null,
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to save suggestion', error, { userId });
        return c.json({ error: 'SAVE_FAILED', message: '提案の保存に失敗しました' }, 500);
      }

      logger.info('Suggestion saved', {
        userId,
        suggestionId: data.id,
        type: body.suggestionType,
        source: body.source,
      });

      return c.json({
        suggestion: {
          id: data.id,
          suggestionType: data.suggestion_type,
          suggestionData: data.suggestion_data,
          source: data.source,
          status: data.status,
          goalId: data.goal_id,
          priority: data.priority,
          expiresAt: data.expires_at,
          createdAt: data.created_at,
        },
      }, 201);
    } catch (err) {
      logger.error('Save suggestion error', err instanceof Error ? err : undefined, { userId });
      return c.json({ error: 'SAVE_FAILED', message: getUserFriendlyMessage(err) }, 500);
    }
  }
);

/**
 * GET /api/suggestions
 * Get saved suggestions for the authenticated user.
 */
suggestionsRouter.get('/', async (c: Context<{ Variables: AuthContext }>) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const userId = user.sub;

  // Parse query parameters
  const type = c.req.query('type') as 'habit' | 'goal' | undefined;
  const status = c.req.query('status') as 'pending' | 'accepted' | 'dismissed' | 'snoozed' | 'all' | undefined;
  const source = c.req.query('source') as 'coach' | 'manager' | 'analysis' | 'manual' | 'all' | undefined;
  const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 100);
  const offset = parseInt(c.req.query('offset') || '0', 10);
  const includeExpired = c.req.query('includeExpired') === 'true';

  try {
    const supabase = getSupabaseClient();

    let query = supabase
      .from('deferred_suggestions')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (type) {
      query = query.eq('suggestion_type', type);
    }
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (source && source !== 'all') {
      query = query.eq('source', source);
    }
    if (!includeExpired) {
      const now = new Date().toISOString();
      query = query.or(`expires_at.is.null,expires_at.gt.${now}`);
    }

    const { data, error, count } = await query;

    if (error) {
      logger.error('Failed to fetch suggestions', error, { userId });
      return c.json({ error: 'FETCH_FAILED', message: '提案の取得に失敗しました' }, 500);
    }

    const suggestions = (data || []).map((s: any) => ({
      id: s.id,
      suggestionType: s.suggestion_type,
      suggestionData: s.suggestion_data,
      source: s.source,
      status: s.status,
      goalId: s.goal_id,
      acceptedEntityId: s.accepted_entity_id,
      priority: s.priority,
      snoozeUntil: s.snooze_until,
      expiresAt: s.expires_at,
      notes: s.notes,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));

    return c.json({
      suggestions,
      total: count || 0,
      limit,
      offset,
    });
  } catch (err) {
    logger.error('Fetch suggestions error', err instanceof Error ? err : undefined, { userId });
    return c.json({ error: 'FETCH_FAILED', message: getUserFriendlyMessage(err) }, 500);
  }
});

/**
 * GET /api/suggestions/stats
 * Get suggestion statistics for the authenticated user.
 */
suggestionsRouter.get('/stats', async (c: Context<{ Variables: AuthContext }>) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const userId = user.sub;

  try {
    const supabase = getSupabaseClient();

    // Get counts by status
    const { data, error } = await supabase
      .from('deferred_suggestions')
      .select('status, suggestion_type')
      .eq('user_id', userId);

    if (error) {
      logger.error('Failed to fetch suggestion stats', error, { userId });
      return c.json({ error: 'FETCH_FAILED', message: '統計の取得に失敗しました' }, 500);
    }

    const stats = {
      total: data?.length || 0,
      byStatus: {
        pending: 0,
        accepted: 0,
        dismissed: 0,
        snoozed: 0,
      },
      byType: {
        habit: 0,
        goal: 0,
      },
    };

    for (const item of data || []) {
      if (item.status in stats.byStatus) {
        stats.byStatus[item.status as keyof typeof stats.byStatus]++;
      }
      if (item.suggestion_type in stats.byType) {
        stats.byType[item.suggestion_type as keyof typeof stats.byType]++;
      }
    }

    return c.json({ stats });
  } catch (err) {
    logger.error('Fetch suggestion stats error', err instanceof Error ? err : undefined, { userId });
    return c.json({ error: 'FETCH_FAILED', message: getUserFriendlyMessage(err) }, 500);
  }
});

/**
 * PATCH /api/suggestions/:id
 * Update a suggestion's status or other properties.
 */
suggestionsRouter.patch(
  '/:id',
  zValidator('json', UpdateSuggestionSchema),
  async (c: Context<{ Variables: AuthContext }>) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userId = user.sub;
    const suggestionId = c.req.param('id');
    const body = c.req.valid('json' as never) as z.infer<typeof UpdateSuggestionSchema>;

    try {
      const supabase = getSupabaseClient();

      // Build update object
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (body['status'] !== undefined) {
        updateData['status'] = body['status'];
      }
      if (body['snoozeUntil'] !== undefined) {
        updateData['snooze_until'] = body['snoozeUntil'];
      }
      if (body['acceptedEntityId'] !== undefined) {
        updateData['accepted_entity_id'] = body['acceptedEntityId'];
      }
      if (body['notes'] !== undefined) {
        updateData['notes'] = body['notes'];
      }

      const { data, error } = await supabase
        .from('deferred_suggestions')
        .update(updateData)
        .eq('id', suggestionId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return c.json({ error: 'NOT_FOUND', message: '提案が見つかりません' }, 404);
        }
        logger.error('Failed to update suggestion', error, { userId, suggestionId });
        return c.json({ error: 'UPDATE_FAILED', message: '提案の更新に失敗しました' }, 500);
      }

      logger.info('Suggestion updated', {
        userId,
        suggestionId,
        status: body['status'],
      });

      return c.json({
        suggestion: {
          id: data.id,
          suggestionType: data.suggestion_type,
          suggestionData: data.suggestion_data,
          source: data.source,
          status: data.status,
          goalId: data.goal_id,
          acceptedEntityId: data.accepted_entity_id,
          priority: data.priority,
          snoozeUntil: data.snooze_until,
          expiresAt: data.expires_at,
          notes: data.notes,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        },
      });
    } catch (err) {
      logger.error('Update suggestion error', err instanceof Error ? err : undefined, { userId, suggestionId });
      return c.json({ error: 'UPDATE_FAILED', message: getUserFriendlyMessage(err) }, 500);
    }
  }
);

/**
 * DELETE /api/suggestions/:id
 * Delete a suggestion.
 */
suggestionsRouter.delete('/:id', async (c: Context<{ Variables: AuthContext }>) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const userId = user.sub;
  const suggestionId = c.req.param('id');

  try {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('deferred_suggestions')
      .delete()
      .eq('id', suggestionId)
      .eq('user_id', userId);

    if (error) {
      logger.error('Failed to delete suggestion', error, { userId, suggestionId });
      return c.json({ error: 'DELETE_FAILED', message: '提案の削除に失敗しました' }, 500);
    }

    logger.info('Suggestion deleted', { userId, suggestionId });

    return c.json({ success: true, message: '提案を削除しました' });
  } catch (err) {
    logger.error('Delete suggestion error', err instanceof Error ? err : undefined, { userId, suggestionId });
    return c.json({ error: 'DELETE_FAILED', message: getUserFriendlyMessage(err) }, 500);
  }
});

/**
 * POST /api/suggestions/:id/snooze
 * Snooze a suggestion for a specified duration.
 */
suggestionsRouter.post('/:id/snooze', async (c: Context<{ Variables: AuthContext }>) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const userId = user.sub;
  const suggestionId = c.req.param('id');

  // Default snooze duration: 24 hours
  const body = await c.req.json().catch(() => ({}));
  const hours = parseInt(body.hours || '24', 10);
  const snoozeUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

  try {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('deferred_suggestions')
      .update({
        status: 'snoozed',
        snooze_until: snoozeUntil,
        updated_at: new Date().toISOString(),
      })
      .eq('id', suggestionId)
      .eq('user_id', userId);

    if (error) {
      if (error.code === 'PGRST116') {
        return c.json({ error: 'NOT_FOUND', message: '提案が見つかりません' }, 404);
      }
      logger.error('Failed to snooze suggestion', error, { userId, suggestionId });
      return c.json({ error: 'SNOOZE_FAILED', message: 'スヌーズに失敗しました' }, 500);
    }

    logger.info('Suggestion snoozed', { userId, suggestionId, hours, snoozeUntil });

    return c.json({
      success: true,
      message: `${hours}時間後に再表示します`,
      snoozeUntil,
    });
  } catch (err) {
    logger.error('Snooze suggestion error', err instanceof Error ? err : undefined, { userId, suggestionId });
    return c.json({ error: 'SNOOZE_FAILED', message: getUserFriendlyMessage(err) }, 500);
  }
});

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create the suggestions router
 */
export function createSuggestionsRouter(): Hono<{ Variables: AuthContext }> {
  return suggestionsRouter;
}

export { suggestionsRouter };
