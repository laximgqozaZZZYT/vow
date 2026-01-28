/**
 * Level Compatibility API Integration Tests
 *
 * Tests for gamification-xp-balance API endpoints:
 * - GET /api/habits/:id/level-compatibility
 * - POST /api/users/:id/check-habit-compatibility
 * - GET /api/habits/:id/workload-level-consistency
 *
 * Requirements: 2.7, 2.8, 5.5
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { createLevelRouter } from '../../../src/routers/level.js';

// Test user and habit data
const testUserId = 'test-user-123';
const testHabitId = 'test-habit-456';

const testHabit = {
  id: testHabitId,
  name: 'Test Habit',
  owner_id: testUserId,
  owner_type: 'user',
  level: 120,
  level_tier: 'advanced',
  frequency: 'daily',
  workload_per_count: 30,
  workload_unit: 'minutes',
  target_count: 1,
  active: true,
};

const testUserLevel = {
  user_id: testUserId,
  overall_level: 50,
};

// Create mock Supabase client factory
function createMockSupabase(responses: { habit?: unknown; userLevel?: unknown }) {
  const mockChain = {
    from: (table: string) => {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                is: () => ({
                  order: () => Promise.resolve({ data: [], error: null }),
                }),
                not: () => ({
                  order: () => Promise.resolve({ data: [], error: null }),
                }),
              }),
              single: () => {
                if (table === 'habits') {
                  return Promise.resolve({ data: responses.habit, error: null });
                }
                if (table === 'user_levels') {
                  return Promise.resolve({ data: responses.userLevel, error: null });
                }
                return Promise.resolve({ data: null, error: null });
              },
            }),
            single: () => {
              if (table === 'habits') {
                return Promise.resolve({ data: responses.habit, error: null });
              }
              if (table === 'user_levels') {
                return Promise.resolve({ data: responses.userLevel, error: null });
              }
              return Promise.resolve({ data: null, error: null });
            },
          }),
          single: () => {
            if (table === 'habits') {
              return Promise.resolve({ data: responses.habit, error: null });
            }
            if (table === 'user_levels') {
              return Promise.resolve({ data: responses.userLevel, error: null });
            }
            return Promise.resolve({ data: null, error: null });
          },
        }),
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: { id: 'new-id' }, error: null }),
          }),
        }),
        update: () => ({
          eq: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: responses.habit, error: null }),
            }),
          }),
        }),
      };
    },
  };
  
  return mockChain;
}

describe('Level Compatibility API Integration Tests', () => {
  describe('POST /api/users/:id/check-habit-compatibility', () => {
    it('should check compatibility for proposed level with mismatch', async () => {
      const mockSupabase = createMockSupabase({ userLevel: testUserLevel });
      
      const app = new Hono();
      app.use('*', async (c, next) => {
        c.set('userId', testUserId);
        c.set('supabase', mockSupabase);
        await next();
      });
      app.route('/api', createLevelRouter());

      const res = await app.request(`/api/users/${testUserId}/check-habit-compatibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposedLevel: 150,
          habitName: 'New Habit',
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.mismatch).toBeDefined();
      expect(body.mismatch.isMismatch).toBe(true);
      expect(body.mismatch.levelGap).toBe(100);
      expect(body.mismatch.severity).toBe('moderate');
      expect(body.babyStepPlans).toBeDefined();
      expect(body.babyStepPlans.lv50).toBeDefined();
      expect(body.babyStepPlans.lv10).toBeDefined();
    });

    it('should return no mismatch for compatible proposed level', async () => {
      const mockSupabase = createMockSupabase({ userLevel: testUserLevel });
      
      const app = new Hono();
      app.use('*', async (c, next) => {
        c.set('userId', testUserId);
        c.set('supabase', mockSupabase);
        await next();
      });
      app.route('/api', createLevelRouter());

      const res = await app.request(`/api/users/${testUserId}/check-habit-compatibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposedLevel: 70,
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.mismatch.isMismatch).toBe(false);
      expect(body.babyStepPlans).toBeUndefined();
    });

    it('should reject invalid proposed level', async () => {
      const mockSupabase = createMockSupabase({ userLevel: testUserLevel });
      
      const app = new Hono();
      app.use('*', async (c, next) => {
        c.set('userId', testUserId);
        c.set('supabase', mockSupabase);
        await next();
      });
      app.onError((err, c) => {
        const status = (err as { code?: number }).code || 500;
        return c.json({ error: err.message }, status as 400 | 403 | 404 | 500);
      });
      app.route('/api', createLevelRouter());

      const res = await app.request(`/api/users/${testUserId}/check-habit-compatibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposedLevel: 250, // Invalid: > 199
        }),
      });

      expect(res.status).toBe(400);
    });

    it('should reject missing proposed level', async () => {
      const mockSupabase = createMockSupabase({ userLevel: testUserLevel });
      
      const app = new Hono();
      app.use('*', async (c, next) => {
        c.set('userId', testUserId);
        c.set('supabase', mockSupabase);
        await next();
      });
      app.onError((err, c) => {
        const status = (err as { code?: number }).code || 500;
        return c.json({ error: err.message }, status as 400 | 403 | 404 | 500);
      });
      app.route('/api', createLevelRouter());

      const res = await app.request(`/api/users/${testUserId}/check-habit-compatibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });

    it('should reject checking other user compatibility', async () => {
      const mockSupabase = createMockSupabase({ userLevel: testUserLevel });
      
      const app = new Hono();
      app.use('*', async (c, next) => {
        c.set('userId', testUserId);
        c.set('supabase', mockSupabase);
        await next();
      });
      // Add error handler
      app.onError((err, c) => {
        const status = (err as { code?: number }).code || 500;
        return c.json({ error: err.message }, status as 400 | 403 | 404 | 500);
      });
      app.route('/api', createLevelRouter());

      const res = await app.request('/api/users/other-user/check-habit-compatibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposedLevel: 100,
        }),
      });

      expect(res.status).toBe(403);
    });
  });

  describe('Mismatch Severity Classification', () => {
    it('should classify mild mismatch (gap 50-75)', async () => {
      const mockSupabase = createMockSupabase({ userLevel: testUserLevel });
      
      const app = new Hono();
      app.use('*', async (c, next) => {
        c.set('userId', testUserId);
        c.set('supabase', mockSupabase);
        await next();
      });
      app.route('/api', createLevelRouter());

      // User level 50, proposed 110 = gap 60 (mild)
      const res = await app.request(`/api/users/${testUserId}/check-habit-compatibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposedLevel: 110 }),
      });

      const body = await res.json();
      expect(body.mismatch.severity).toBe('mild');
      expect(body.mismatch.recommendation).toBe('suggest_baby_steps');
    });

    it('should classify moderate mismatch (gap 76-100)', async () => {
      const mockSupabase = createMockSupabase({ userLevel: testUserLevel });
      
      const app = new Hono();
      app.use('*', async (c, next) => {
        c.set('userId', testUserId);
        c.set('supabase', mockSupabase);
        await next();
      });
      app.route('/api', createLevelRouter());

      // User level 50, proposed 140 = gap 90 (moderate)
      const res = await app.request(`/api/users/${testUserId}/check-habit-compatibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposedLevel: 140 }),
      });

      const body = await res.json();
      expect(body.mismatch.severity).toBe('moderate');
      expect(body.mismatch.recommendation).toBe('strongly_suggest_baby_steps');
    });

    it('should classify severe mismatch (gap > 100)', async () => {
      const mockSupabase = createMockSupabase({ userLevel: testUserLevel });
      
      const app = new Hono();
      app.use('*', async (c, next) => {
        c.set('userId', testUserId);
        c.set('supabase', mockSupabase);
        await next();
      });
      app.route('/api', createLevelRouter());

      // User level 50, proposed 180 = gap 130 (severe)
      const res = await app.request(`/api/users/${testUserId}/check-habit-compatibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposedLevel: 180 }),
      });

      const body = await res.json();
      expect(body.mismatch.severity).toBe('severe');
      expect(body.mismatch.recommendation).toBe('strongly_suggest_baby_steps');
    });
  });

  describe('Baby Step Plans Generation', () => {
    it('should generate lv50 and lv10 baby step plans on mismatch', async () => {
      const mockSupabase = createMockSupabase({ userLevel: testUserLevel });
      
      const app = new Hono();
      app.use('*', async (c, next) => {
        c.set('userId', testUserId);
        c.set('supabase', mockSupabase);
        await next();
      });
      app.route('/api', createLevelRouter());

      const res = await app.request(`/api/users/${testUserId}/check-habit-compatibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposedLevel: 150,
          habitName: 'Morning Run',
        }),
      });

      const body = await res.json();
      
      // Check lv50 plan
      expect(body.babyStepPlans.lv50).toBeDefined();
      expect(body.babyStepPlans.lv50.targetLevel).toBe(50);
      expect(body.babyStepPlans.lv50.name).toContain('半分の負荷');
      expect(body.babyStepPlans.lv50.rationale).toBeDefined();

      // Check lv10 plan
      expect(body.babyStepPlans.lv10).toBeDefined();
      expect(body.babyStepPlans.lv10.targetLevel).toBe(10);
      expect(body.babyStepPlans.lv10.name).toContain('2分だけ');
      expect(body.babyStepPlans.lv10.rationale).toBeDefined();
    });
  });
});
