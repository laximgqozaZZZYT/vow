/**
 * Coaching Router
 *
 * API endpoints for workload coaching proposals.
 *
 * Requirements: 10.3, 10.4
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSettings, type Settings } from '../config.js';
import { getLogger } from '../utils/logger.js';
import { getWorkloadCoachingService } from '../services/workloadCoachingService.js';
import { getUserFriendlyMessage } from '../errors/index.js';

const logger = getLogger('coachingRouter');

/**
 * Get Supabase client instance.
 */
function getSupabaseClient(settings: Settings): SupabaseClient {
  if (!settings.supabaseUrl || !settings.supabaseAnonKey) {
    throw new Error('Supabase is not configured');
  }
  return createClient(settings.supabaseUrl, settings.supabaseAnonKey);
}

/**
 * Extract user ID from request context.
 */
function getUserId(c: Context): string | null {
  // Try to get from auth middleware
  const userId = c.get('userId') as string | undefined;
  if (userId) return userId;

  // Try to get from Authorization header (for API key auth)
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    // In a real implementation, decode the JWT to get user ID
    // For now, return null to indicate auth required
  }

  return null;
}

/**
 * Create the coaching router.
 */
export function createCoachingRouter(): Hono {
  const router = new Hono();

  /**
   * GET /api/coaching/proposals
   *
   * Get pending coaching proposals for the authenticated user.
   */
  router.get('/proposals', async (c: Context) => {
    const settings = getSettings();
    const userId = getUserId(c);

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    try {
      const supabase = getSupabaseClient(settings);
      const coachingService = getWorkloadCoachingService(supabase);

      // Check for new coaching candidates
      const candidates = await coachingService.checkForCoachingCandidates(userId);

      // Create proposals for new candidates
      for (const candidate of candidates) {
        let proposal;
        if (candidate.reason === 'consecutive_miss') {
          proposal = coachingService.generateWorkloadAdjustment(
            candidate.habitId,
            candidate.habitName,
            candidate.currentTargetCount,
            candidate.workloadUnit,
            candidate.consecutiveMissDays || 3
          );
        } else {
          proposal = coachingService.generateBabyStep(
            candidate.habitId,
            candidate.habitName,
            candidate.currentTargetCount,
            candidate.workloadUnit,
            candidate.daysSinceCreation || 7
          );
        }

        await coachingService.createProposal(userId, proposal);
      }

      // Get all pending proposals
      const proposals = await coachingService.getPendingProposals(userId);

      // Enrich with habit names
      const { data: habits } = await supabase
        .from('habits')
        .select('id, name')
        .in('id', proposals.map(p => p.habitId));

      const habitMap = new Map((habits || []).map(h => [h.id, h.name]));
      const enrichedProposals = proposals.map(p => ({
        ...p,
        habitName: habitMap.get(p.habitId) || '',
      }));

      return c.json({
        proposals: enrichedProposals,
        count: enrichedProposals.length,
      });
    } catch (error) {
      logger.error('Failed to get coaching proposals', error instanceof Error ? error : undefined, { userId });
      return c.json({ error: getUserFriendlyMessage(error) }, 500);
    }
  });

  /**
   * POST /api/coaching/apply/:id
   *
   * Apply a coaching proposal.
   */
  router.post('/apply/:id', async (c: Context) => {
    const settings = getSettings();
    const userId = getUserId(c);
    const proposalId = c.req.param('id');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!proposalId) {
      return c.json({ error: 'Proposal ID is required' }, 400);
    }

    try {
      const supabase = getSupabaseClient(settings);
      const coachingService = getWorkloadCoachingService(supabase);

      await coachingService.applyProposal(userId, proposalId);

      logger.info('Coaching proposal applied', { userId, proposalId });

      return c.json({
        success: true,
        message: '提案を適用しました',
      });
    } catch (error) {
      logger.error('Failed to apply coaching proposal', error instanceof Error ? error : undefined, { userId, proposalId });
      return c.json({ error: getUserFriendlyMessage(error) }, 500);
    }
  });

  /**
   * POST /api/coaching/dismiss/:id
   *
   * Dismiss a coaching proposal.
   */
  router.post('/dismiss/:id', async (c: Context) => {
    const settings = getSettings();
    const userId = getUserId(c);
    const proposalId = c.req.param('id');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!proposalId) {
      return c.json({ error: 'Proposal ID is required' }, 400);
    }

    try {
      const supabase = getSupabaseClient(settings);
      const coachingService = getWorkloadCoachingService(supabase);

      await coachingService.dismissProposal(userId, proposalId);

      logger.info('Coaching proposal dismissed', { userId, proposalId });

      return c.json({
        success: true,
        message: '提案を拒否しました',
      });
    } catch (error) {
      logger.error('Failed to dismiss coaching proposal', error instanceof Error ? error : undefined, { userId, proposalId });
      return c.json({ error: getUserFriendlyMessage(error) }, 500);
    }
  });

  /**
   * POST /api/coaching/snooze/:id
   *
   * Snooze a coaching proposal for 24 hours.
   */
  router.post('/snooze/:id', async (c: Context) => {
    const settings = getSettings();
    const userId = getUserId(c);
    const proposalId = c.req.param('id');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!proposalId) {
      return c.json({ error: 'Proposal ID is required' }, 400);
    }

    try {
      const supabase = getSupabaseClient(settings);
      const coachingService = getWorkloadCoachingService(supabase);

      await coachingService.snoozeProposal(userId, proposalId);

      logger.info('Coaching proposal snoozed', { userId, proposalId });

      return c.json({
        success: true,
        message: '24時間後に再表示します',
      });
    } catch (error) {
      logger.error('Failed to snooze coaching proposal', error instanceof Error ? error : undefined, { userId, proposalId });
      return c.json({ error: getUserFriendlyMessage(error) }, 500);
    }
  });

  /**
   * GET /api/coaching/recovery/:habitId
   *
   * Check for recovery opportunity for a specific habit.
   */
  router.get('/recovery/:habitId', async (c: Context) => {
    const settings = getSettings();
    const userId = getUserId(c);
    const habitId = c.req.param('habitId');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!habitId) {
      return c.json({ error: 'Habit ID is required' }, 400);
    }

    try {
      const supabase = getSupabaseClient(settings);
      const coachingService = getWorkloadCoachingService(supabase);

      const recovery = await coachingService.checkForRecoveryOpportunity(userId, habitId);

      return c.json({
        hasRecoveryOpportunity: recovery !== null,
        recovery,
      });
    } catch (error) {
      logger.error('Failed to check recovery opportunity', error instanceof Error ? error : undefined, { userId, habitId });
      return c.json({ error: getUserFriendlyMessage(error) }, 500);
    }
  });

  return router;
}

// Export default router instance
export const coachingRouter = createCoachingRouter();
