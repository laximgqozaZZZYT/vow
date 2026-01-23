/**
 * Repository Unit Tests
 *
 * Tests for TypeScript repositories with mocked Supabase client.
 * Property 1: Repository CRUD Consistency
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from '@/repositories/base';
import { HabitRepository } from '@/repositories/habitRepository';
import { ActivityRepository } from '@/repositories/activityRepository';
import { GoalRepository } from '@/repositories/goalRepository';
import { SlackRepository } from '@/repositories/slackRepository';
import type { Habit, Activity, Goal } from '@/schemas/habit';

// ============================================================================
// Mock Supabase Client Factory
// ============================================================================

/**
 * Creates a mock Supabase client with chainable query builder methods.
 */
function createMockSupabaseClient() {
  const mockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn(),
  };

  const mockClient = {
    from: vi.fn().mockReturnValue(mockQueryBuilder),
  } as unknown as SupabaseClient;

  return { mockClient, mockQueryBuilder };
}

// ============================================================================
// Test Entity Fixtures
// ============================================================================

const testHabit: Habit = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  owner_type: 'user',
  owner_id: '123e4567-e89b-12d3-a456-426614174001',
  name: 'Exercise',
  description: 'Daily exercise routine',
  goal_id: '123e4567-e89b-12d3-a456-426614174002',
  active: true,
  frequency: 'daily',
  target_count: 1,
  workload_unit: 'minutes',
  workload_per_count: 30,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-15T12:00:00Z',
};

const testActivity: Activity = {
  id: '223e4567-e89b-12d3-a456-426614174000',
  owner_type: 'user',
  owner_id: '123e4567-e89b-12d3-a456-426614174001',
  habit_id: '123e4567-e89b-12d3-a456-426614174000',
  habit_name: 'Exercise',
  kind: 'complete',
  timestamp: '2024-01-15T10:00:00Z',
  amount: 1,
  memo: 'Morning workout',
  created_at: '2024-01-15T10:00:00Z',
};

const testGoal: Goal = {
  id: '323e4567-e89b-12d3-a456-426614174000',
  owner_type: 'user',
  owner_id: '123e4567-e89b-12d3-a456-426614174001',
  name: 'Health',
  description: 'Improve overall health',
  parent_id: null,
  status: 'active',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: null,
};

// ============================================================================
// Concrete Implementation for Testing BaseRepository
// ============================================================================

class TestRepository extends BaseRepository<Record<string, unknown>> {
  constructor(supabase: SupabaseClient) {
    super(supabase, 'test_table');
  }
}


// ============================================================================
// BaseRepository Tests
// ============================================================================

describe('BaseRepository', () => {
  let mockClient: SupabaseClient;
  let mockQueryBuilder: ReturnType<typeof createMockSupabaseClient>['mockQueryBuilder'];
  let repository: TestRepository;

  beforeEach(() => {
    const mocks = createMockSupabaseClient();
    mockClient = mocks.mockClient;
    mockQueryBuilder = mocks.mockQueryBuilder;
    repository = new TestRepository(mockClient);
  });

  describe('getById', () => {
    it('should return entity when found', async () => {
      const testEntity = { id: 'test-id', name: 'Test' };
      mockQueryBuilder.single.mockResolvedValue({ data: testEntity, error: null });

      const result = await repository.getById('test-id');

      expect(mockClient.from).toHaveBeenCalledWith('test_table');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('*');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'test-id');
      expect(result).toEqual(testEntity);
    });

    it('should return null when entity not found', async () => {
      mockQueryBuilder.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });

      const result = await repository.getById('non-existent-id');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      mockQueryBuilder.single.mockResolvedValue({ data: null, error: { message: 'Database error' } });

      const result = await repository.getById('test-id');

      expect(result).toBeNull();
    });
  });

  describe('getAll', () => {
    it('should return all entities with default limit', async () => {
      const entities = [{ id: '1' }, { id: '2' }];
      mockQueryBuilder.limit.mockResolvedValue({ data: entities, error: null });

      const result = await repository.getAll();

      expect(mockQueryBuilder.select).toHaveBeenCalledWith('*');
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(100);
      expect(result).toEqual(entities);
    });

    it('should return entities with custom limit', async () => {
      const entities = [{ id: '1' }];
      mockQueryBuilder.limit.mockResolvedValue({ data: entities, error: null });

      const result = await repository.getAll(10);

      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(10);
      expect(result).toEqual(entities);
    });

    it('should return empty array on error', async () => {
      mockQueryBuilder.limit.mockResolvedValue({ data: null, error: { message: 'Error' } });

      const result = await repository.getAll();

      expect(result).toEqual([]);
    });
  });


  describe('create', () => {
    it('should create and return entity', async () => {
      const newEntity = { name: 'New Entity' };
      const createdEntity = { id: 'new-id', ...newEntity };
      mockQueryBuilder.single.mockResolvedValue({ data: createdEntity, error: null });

      const result = await repository.create(newEntity);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(newEntity);
      expect(mockQueryBuilder.select).toHaveBeenCalled();
      expect(result).toEqual(createdEntity);
    });

    it('should throw error on creation failure', async () => {
      mockQueryBuilder.single.mockResolvedValue({ data: null, error: { message: 'Insert failed' } });

      await expect(repository.create({ name: 'Test' })).rejects.toThrow(
        'Failed to create entity in test_table: Insert failed'
      );
    });
  });

  describe('update', () => {
    it('should update and return entity', async () => {
      const updates = { name: 'Updated Name' };
      const updatedEntity = { id: 'test-id', ...updates };
      mockQueryBuilder.single.mockResolvedValue({ data: updatedEntity, error: null });

      const result = await repository.update('test-id', updates);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith(updates);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'test-id');
      expect(result).toEqual(updatedEntity);
    });

    it('should return null when entity not found', async () => {
      mockQueryBuilder.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });

      const result = await repository.update('non-existent', { name: 'Test' });

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should return true when entity deleted', async () => {
      mockQueryBuilder.select.mockResolvedValue({ data: [{ id: 'test-id' }], error: null });

      const result = await repository.delete('test-id');

      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'test-id');
      expect(result).toBe(true);
    });

    it('should return false when entity not found', async () => {
      mockQueryBuilder.select.mockResolvedValue({ data: [], error: null });

      const result = await repository.delete('non-existent');

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockQueryBuilder.select.mockResolvedValue({ data: null, error: { message: 'Error' } });

      const result = await repository.delete('test-id');

      expect(result).toBe(false);
    });
  });

  describe('exists', () => {
    it('should return true when entity exists', async () => {
      mockQueryBuilder.limit.mockResolvedValue({ data: [{ id: 'test-id' }], error: null });

      const result = await repository.exists('test-id');

      expect(mockQueryBuilder.select).toHaveBeenCalledWith('id');
      expect(result).toBe(true);
    });

    it('should return false when entity does not exist', async () => {
      mockQueryBuilder.limit.mockResolvedValue({ data: [], error: null });

      const result = await repository.exists('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('count', () => {
    it('should return count of entities', async () => {
      mockQueryBuilder.select.mockResolvedValue({ count: 42, error: null });

      const result = await repository.count();

      expect(mockQueryBuilder.select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
      expect(result).toBe(42);
    });

    it('should return 0 on error', async () => {
      mockQueryBuilder.select.mockResolvedValue({ count: null, error: { message: 'Error' } });

      const result = await repository.count();

      expect(result).toBe(0);
    });
  });
});


// ============================================================================
// HabitRepository Tests
// ============================================================================

describe('HabitRepository', () => {
  let mockClient: SupabaseClient;
  let mockQueryBuilder: ReturnType<typeof createMockSupabaseClient>['mockQueryBuilder'];
  let repository: HabitRepository;

  beforeEach(() => {
    const mocks = createMockSupabaseClient();
    mockClient = mocks.mockClient;
    mockQueryBuilder = mocks.mockQueryBuilder;
    repository = new HabitRepository(mockClient);
  });

  describe('getActiveDoHabits', () => {
    it('should return active do habits for owner', async () => {
      const habits = [testHabit];
      mockQueryBuilder.eq.mockReturnThis();
      // The last eq() call returns the final result
      (mockQueryBuilder.eq as Mock).mockImplementation(() => {
        mockQueryBuilder.eq.mockReturnThis();
        return mockQueryBuilder;
      });
      // Mock the final resolution
      mockQueryBuilder.eq.mockResolvedValueOnce({ data: habits, error: null });

      // Reset and set up proper chain
      const mocks = createMockSupabaseClient();
      mockClient = mocks.mockClient;
      mockQueryBuilder = mocks.mockQueryBuilder;
      repository = new HabitRepository(mockClient);
      
      // Set up the chain to resolve at the end
      mockQueryBuilder.eq.mockReturnValue({
        ...mockQueryBuilder,
        eq: vi.fn().mockReturnValue({
          ...mockQueryBuilder,
          eq: vi.fn().mockReturnValue({
            ...mockQueryBuilder,
            eq: vi.fn().mockResolvedValue({ data: habits, error: null }),
          }),
        }),
      });

      const result = await repository.getActiveDoHabits('user', 'owner-123');

      expect(mockClient.from).toHaveBeenCalledWith('habits');
      expect(result).toEqual(habits);
    });

    it('should return empty array when no habits found', async () => {
      mockQueryBuilder.eq.mockReturnValue({
        ...mockQueryBuilder,
        eq: vi.fn().mockReturnValue({
          ...mockQueryBuilder,
          eq: vi.fn().mockReturnValue({
            ...mockQueryBuilder,
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      });

      const result = await repository.getActiveDoHabits('user', 'owner-123');

      expect(result).toEqual([]);
    });

    it('should return empty array on error', async () => {
      mockQueryBuilder.eq.mockReturnValue({
        ...mockQueryBuilder,
        eq: vi.fn().mockReturnValue({
          ...mockQueryBuilder,
          eq: vi.fn().mockReturnValue({
            ...mockQueryBuilder,
            eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'Error' } }),
          }),
        }),
      });

      const result = await repository.getActiveDoHabits('user', 'owner-123');

      expect(result).toEqual([]);
    });
  });

  describe('findByName', () => {
    it('should return habit when found by name', async () => {
      mockQueryBuilder.ilike.mockResolvedValue({ data: [testHabit], error: null });

      const result = await repository.findByName('user', 'owner-123', 'Exercise');

      expect(mockQueryBuilder.ilike).toHaveBeenCalledWith('name', 'Exercise');
      expect(result).toEqual(testHabit);
    });

    it('should return null when habit not found', async () => {
      mockQueryBuilder.ilike.mockResolvedValue({ data: [], error: null });

      const result = await repository.findByName('user', 'owner-123', 'NonExistent');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      mockQueryBuilder.ilike.mockResolvedValue({ data: null, error: { message: 'Error' } });

      const result = await repository.findByName('user', 'owner-123', 'Exercise');

      expect(result).toBeNull();
    });
  });


  describe('searchByName', () => {
    it('should return habits matching search query', async () => {
      const habits = [testHabit];
      mockQueryBuilder.limit.mockResolvedValue({ data: habits, error: null });

      const result = await repository.searchByName('user', 'owner-123', 'Exer');

      expect(mockQueryBuilder.ilike).toHaveBeenCalledWith('name', '%Exer%');
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(5);
      expect(result).toEqual(habits);
    });

    it('should use custom limit', async () => {
      mockQueryBuilder.limit.mockResolvedValue({ data: [], error: null });

      await repository.searchByName('user', 'owner-123', 'Test', 10);

      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(10);
    });

    it('should return empty array when no matches', async () => {
      mockQueryBuilder.limit.mockResolvedValue({ data: [], error: null });

      const result = await repository.searchByName('user', 'owner-123', 'xyz');

      expect(result).toEqual([]);
    });
  });

  describe('getByOwner', () => {
    it('should return all habits for owner', async () => {
      const habits = [testHabit];
      mockQueryBuilder.eq.mockReturnValue({
        ...mockQueryBuilder,
        eq: vi.fn().mockResolvedValue({ data: habits, error: null }),
      });

      const result = await repository.getByOwner('user', 'owner-123');

      expect(result).toEqual(habits);
    });

    it('should filter active habits when activeOnly is true', async () => {
      const habits = [testHabit];
      mockQueryBuilder.eq.mockReturnValue({
        ...mockQueryBuilder,
        eq: vi.fn().mockReturnValue({
          ...mockQueryBuilder,
          eq: vi.fn().mockResolvedValue({ data: habits, error: null }),
        }),
      });

      const result = await repository.getByOwner('user', 'owner-123', true);

      expect(result).toEqual(habits);
    });

    it('should return empty array on error', async () => {
      mockQueryBuilder.eq.mockReturnValue({
        ...mockQueryBuilder,
        eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'Error' } }),
      });

      const result = await repository.getByOwner('user', 'owner-123');

      expect(result).toEqual([]);
    });
  });

  describe('getHabitsByGoal', () => {
    it('should return habits for a goal', async () => {
      const habits = [testHabit];
      mockQueryBuilder.eq.mockReturnValue({
        ...mockQueryBuilder,
        eq: vi.fn().mockResolvedValue({ data: habits, error: null }),
      });

      const result = await repository.getHabitsByGoal('goal-123');

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('goal_id', 'goal-123');
      expect(result).toEqual(habits);
    });

    it('should return empty array when no habits for goal', async () => {
      mockQueryBuilder.eq.mockReturnValue({
        ...mockQueryBuilder,
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      });

      const result = await repository.getHabitsByGoal('goal-123');

      expect(result).toEqual([]);
    });
  });

  describe('getHabitsWithTriggers', () => {
    it('should return habits with trigger_time set', async () => {
      const habits = [{ ...testHabit, trigger_time: '09:00' }];
      mockQueryBuilder.eq.mockResolvedValue({ data: habits, error: null });

      const result = await repository.getHabitsWithTriggers();

      expect(mockQueryBuilder.not).toHaveBeenCalledWith('trigger_time', 'is', null);
      expect(result).toEqual(habits);
    });

    it('should return empty array when no habits with triggers', async () => {
      mockQueryBuilder.eq.mockResolvedValue({ data: [], error: null });

      const result = await repository.getHabitsWithTriggers();

      expect(result).toEqual([]);
    });
  });
});


// ============================================================================
// ActivityRepository Tests
// ============================================================================

describe('ActivityRepository', () => {
  let mockClient: SupabaseClient;
  let mockQueryBuilder: ReturnType<typeof createMockSupabaseClient>['mockQueryBuilder'];
  let repository: ActivityRepository;

  beforeEach(() => {
    const mocks = createMockSupabaseClient();
    mockClient = mocks.mockClient;
    mockQueryBuilder = mocks.mockQueryBuilder;
    repository = new ActivityRepository(mockClient);
  });

  describe('getActivitiesInRange', () => {
    it('should return activities within time range', async () => {
      const activities = [testActivity];
      mockQueryBuilder.lte.mockResolvedValue({ data: activities, error: null });

      const start = new Date('2024-01-15T00:00:00Z');
      const end = new Date('2024-01-15T23:59:59Z');
      const result = await repository.getActivitiesInRange('user', 'owner-123', start, end);

      expect(mockQueryBuilder.gte).toHaveBeenCalledWith('timestamp', start.toISOString());
      expect(mockQueryBuilder.lte).toHaveBeenCalledWith('timestamp', end.toISOString());
      expect(result).toEqual(activities);
    });

    it('should filter by kind', async () => {
      mockQueryBuilder.lte.mockResolvedValue({ data: [], error: null });

      const start = new Date('2024-01-15T00:00:00Z');
      const end = new Date('2024-01-15T23:59:59Z');
      await repository.getActivitiesInRange('user', 'owner-123', start, end, 'skip');

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('kind', 'skip');
    });

    it('should return empty array on error', async () => {
      mockQueryBuilder.lte.mockResolvedValue({ data: null, error: { message: 'Error' } });

      const start = new Date('2024-01-15T00:00:00Z');
      const end = new Date('2024-01-15T23:59:59Z');
      const result = await repository.getActivitiesInRange('user', 'owner-123', start, end);

      expect(result).toEqual([]);
    });
  });

  describe('getHabitActivities', () => {
    it('should return activities for a habit', async () => {
      const activities = [testActivity];
      mockQueryBuilder.limit.mockResolvedValue({ data: activities, error: null });

      const result = await repository.getHabitActivities('habit-123');

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('habit_id', 'habit-123');
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('timestamp', { ascending: false });
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(365);
      expect(result).toEqual(activities);
    });

    it('should use custom limit', async () => {
      mockQueryBuilder.limit.mockResolvedValue({ data: [], error: null });

      await repository.getHabitActivities('habit-123', 'complete', 100);

      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(100);
    });

    it('should return empty array on error', async () => {
      mockQueryBuilder.limit.mockResolvedValue({ data: null, error: { message: 'Error' } });

      const result = await repository.getHabitActivities('habit-123');

      expect(result).toEqual([]);
    });
  });


  describe('hasCompletionToday', () => {
    it('should return true when completion exists', async () => {
      mockQueryBuilder.limit.mockResolvedValue({ data: [{ id: 'activity-1' }], error: null });

      const start = new Date('2024-01-15T00:00:00Z');
      const end = new Date('2024-01-15T23:59:59Z');
      const result = await repository.hasCompletionToday('habit-123', start, end);

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('habit_id', 'habit-123');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('kind', 'complete');
      expect(result).toBe(true);
    });

    it('should return false when no completion exists', async () => {
      mockQueryBuilder.limit.mockResolvedValue({ data: [], error: null });

      const start = new Date('2024-01-15T00:00:00Z');
      const end = new Date('2024-01-15T23:59:59Z');
      const result = await repository.hasCompletionToday('habit-123', start, end);

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockQueryBuilder.limit.mockResolvedValue({ data: null, error: { message: 'Error' } });

      const start = new Date('2024-01-15T00:00:00Z');
      const end = new Date('2024-01-15T23:59:59Z');
      const result = await repository.hasCompletionToday('habit-123', start, end);

      expect(result).toBe(false);
    });
  });

  describe('hasCompletionOnDate', () => {
    it('should return true when completion exists on date', async () => {
      mockQueryBuilder.limit.mockResolvedValue({ data: [{ id: 'activity-1' }], error: null });

      const result = await repository.hasCompletionOnDate('user', 'owner-123', 'habit-123', '2024-01-15');

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('date', '2024-01-15');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('completed', true);
      expect(result).toBe(true);
    });

    it('should return false when no completion on date', async () => {
      mockQueryBuilder.limit.mockResolvedValue({ data: [], error: null });

      const result = await repository.hasCompletionOnDate('user', 'owner-123', 'habit-123', '2024-01-15');

      expect(result).toBe(false);
    });
  });

  describe('getLatestActivity', () => {
    it('should return most recent activity', async () => {
      mockQueryBuilder.single.mockResolvedValue({ data: testActivity, error: null });

      const result = await repository.getLatestActivity('habit-123');

      expect(mockQueryBuilder.order).toHaveBeenCalledWith('timestamp', { ascending: false });
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(1);
      expect(result).toEqual(testActivity);
    });

    it('should return null when no activity exists', async () => {
      mockQueryBuilder.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });

      const result = await repository.getLatestActivity('habit-123');

      expect(result).toBeNull();
    });
  });

  describe('countActivitiesInRange', () => {
    it('should return count of activities', async () => {
      mockQueryBuilder.lte.mockResolvedValue({ count: 5, error: null });

      const start = new Date('2024-01-01T00:00:00Z');
      const end = new Date('2024-01-31T23:59:59Z');
      const result = await repository.countActivitiesInRange('habit-123', start, end);

      expect(result).toBe(5);
    });

    it('should return 0 on error', async () => {
      mockQueryBuilder.lte.mockResolvedValue({ count: null, error: { message: 'Error' } });

      const start = new Date('2024-01-01T00:00:00Z');
      const end = new Date('2024-01-31T23:59:59Z');
      const result = await repository.countActivitiesInRange('habit-123', start, end);

      expect(result).toBe(0);
    });
  });

  describe('sumAmountInRange', () => {
    it('should return sum of amounts', async () => {
      const activities = [
        { amount: 10 },
        { amount: 20 },
        { amount: 15 },
      ];
      mockQueryBuilder.lte.mockResolvedValue({ data: activities, error: null });

      const start = new Date('2024-01-01T00:00:00Z');
      const end = new Date('2024-01-31T23:59:59Z');
      const result = await repository.sumAmountInRange('habit-123', start, end);

      expect(result).toBe(45);
    });

    it('should use default amount of 1 when amount is null', async () => {
      const activities = [
        { amount: null },
        { amount: 10 },
        { amount: null },
      ];
      mockQueryBuilder.lte.mockResolvedValue({ data: activities, error: null });

      const start = new Date('2024-01-01T00:00:00Z');
      const end = new Date('2024-01-31T23:59:59Z');
      const result = await repository.sumAmountInRange('habit-123', start, end);

      expect(result).toBe(12); // 1 + 10 + 1
    });

    it('should return 0 on error', async () => {
      mockQueryBuilder.lte.mockResolvedValue({ data: null, error: { message: 'Error' } });

      const start = new Date('2024-01-01T00:00:00Z');
      const end = new Date('2024-01-31T23:59:59Z');
      const result = await repository.sumAmountInRange('habit-123', start, end);

      expect(result).toBe(0);
    });
  });
});


// ============================================================================
// GoalRepository Tests
// ============================================================================

describe('GoalRepository', () => {
  let mockClient: SupabaseClient;
  let mockQueryBuilder: ReturnType<typeof createMockSupabaseClient>['mockQueryBuilder'];
  let repository: GoalRepository;

  beforeEach(() => {
    const mocks = createMockSupabaseClient();
    mockClient = mocks.mockClient;
    mockQueryBuilder = mocks.mockQueryBuilder;
    repository = new GoalRepository(mockClient);
  });

  describe('getByOwner', () => {
    it('should return all goals for owner', async () => {
      const goals = [testGoal];
      mockQueryBuilder.eq.mockReturnValue({
        ...mockQueryBuilder,
        eq: vi.fn().mockResolvedValue({ data: goals, error: null }),
      });

      const result = await repository.getByOwner('user', 'owner-123');

      expect(mockClient.from).toHaveBeenCalledWith('goals');
      expect(result).toEqual(goals);
    });

    it('should return empty array when no goals found', async () => {
      mockQueryBuilder.eq.mockReturnValue({
        ...mockQueryBuilder,
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      });

      const result = await repository.getByOwner('user', 'owner-123');

      expect(result).toEqual([]);
    });

    it('should return empty array on error', async () => {
      mockQueryBuilder.eq.mockReturnValue({
        ...mockQueryBuilder,
        eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'Error' } }),
      });

      const result = await repository.getByOwner('user', 'owner-123');

      expect(result).toEqual([]);
    });
  });

  describe('getActiveGoals', () => {
    it('should return active goals for owner', async () => {
      const goals = [testGoal];
      mockQueryBuilder.eq.mockReturnValue({
        ...mockQueryBuilder,
        eq: vi.fn().mockReturnValue({
          ...mockQueryBuilder,
          eq: vi.fn().mockResolvedValue({ data: goals, error: null }),
        }),
      });

      const result = await repository.getActiveGoals('user', 'owner-123');

      expect(result).toEqual(goals);
    });

    it('should return empty array when no active goals', async () => {
      mockQueryBuilder.eq.mockReturnValue({
        ...mockQueryBuilder,
        eq: vi.fn().mockReturnValue({
          ...mockQueryBuilder,
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      const result = await repository.getActiveGoals('user', 'owner-123');

      expect(result).toEqual([]);
    });
  });

  describe('findByName', () => {
    it('should return goal when found by name', async () => {
      mockQueryBuilder.ilike.mockResolvedValue({ data: [testGoal], error: null });

      const result = await repository.findByName('user', 'owner-123', 'Health');

      expect(mockQueryBuilder.ilike).toHaveBeenCalledWith('name', 'Health');
      expect(result).toEqual(testGoal);
    });

    it('should return null when goal not found', async () => {
      mockQueryBuilder.ilike.mockResolvedValue({ data: [], error: null });

      const result = await repository.findByName('user', 'owner-123', 'NonExistent');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      mockQueryBuilder.ilike.mockResolvedValue({ data: null, error: { message: 'Error' } });

      const result = await repository.findByName('user', 'owner-123', 'Health');

      expect(result).toBeNull();
    });
  });
});


// ============================================================================
// SlackRepository Tests
// ============================================================================

describe('SlackRepository', () => {
  let mockClient: SupabaseClient;
  let mockQueryBuilder: ReturnType<typeof createMockSupabaseClient>['mockQueryBuilder'];
  let repository: SlackRepository;

  beforeEach(() => {
    const mocks = createMockSupabaseClient();
    mockClient = mocks.mockClient;
    mockQueryBuilder = mocks.mockQueryBuilder;
    repository = new SlackRepository(mockClient);
  });

  const testConnection = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    owner_type: 'user',
    owner_id: '123e4567-e89b-12d3-a456-426614174001',
    slack_user_id: 'U12345678',
    slack_team_id: 'T12345678',
    slack_team_name: 'Test Workspace',
    slack_user_name: 'testuser',
    connected_at: '2024-01-01T00:00:00Z',
    is_valid: true,
  };

  describe('createConnection', () => {
    it('should create a new connection', async () => {
      mockQueryBuilder.single.mockResolvedValue({ data: testConnection, error: null });

      const connectionData = {
        slack_user_id: 'U12345678',
        slack_team_id: 'T12345678',
        access_token: 'xoxp-token',
      };
      const result = await repository.createConnection('user', 'owner-123', connectionData);

      expect(mockQueryBuilder.upsert).toHaveBeenCalled();
      expect(result).toEqual(testConnection);
    });

    it('should throw error on creation failure', async () => {
      mockQueryBuilder.single.mockResolvedValue({ data: null, error: { message: 'Insert failed' } });

      const connectionData = {
        slack_user_id: 'U12345678',
        slack_team_id: 'T12345678',
        access_token: 'xoxp-token',
      };

      await expect(repository.createConnection('user', 'owner-123', connectionData)).rejects.toThrow(
        'Failed to create Slack connection'
      );
    });
  });

  describe('getConnection', () => {
    it('should return connection when found', async () => {
      mockQueryBuilder.single.mockResolvedValue({ data: testConnection, error: null });

      const result = await repository.getConnection('user', 'owner-123');

      expect(mockClient.from).toHaveBeenCalledWith('slack_connections');
      expect(result).toEqual(testConnection);
    });

    it('should return null when connection not found', async () => {
      mockQueryBuilder.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });

      const result = await repository.getConnection('user', 'non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getConnectionBySlackUser', () => {
    it('should return connection by Slack user and team', async () => {
      mockQueryBuilder.single.mockResolvedValue({ data: testConnection, error: null });

      const result = await repository.getConnectionBySlackUser('U12345678', 'T12345678');

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('slack_user_id', 'U12345678');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('slack_team_id', 'T12345678');
      expect(result).toEqual(testConnection);
    });

    it('should return null when not found', async () => {
      mockQueryBuilder.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });

      const result = await repository.getConnectionBySlackUser('U99999999', 'T99999999');

      expect(result).toBeNull();
    });
  });

  describe('updateConnection', () => {
    it('should update and return connection', async () => {
      const updatedConnection = { ...testConnection, slack_user_name: 'newname' };
      mockQueryBuilder.single.mockResolvedValue({ data: updatedConnection, error: null });

      const result = await repository.updateConnection('user', 'owner-123', { slack_user_name: 'newname' });

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({ slack_user_name: 'newname' });
      expect(result).toEqual(updatedConnection);
    });

    it('should return null when connection not found', async () => {
      mockQueryBuilder.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });

      const result = await repository.updateConnection('user', 'non-existent', { slack_user_name: 'test' });

      expect(result).toBeNull();
    });
  });


  describe('deleteConnection', () => {
    it('should return true when connection deleted', async () => {
      mockQueryBuilder.select.mockResolvedValue({ data: [testConnection], error: null });

      const result = await repository.deleteConnection('user', 'owner-123');

      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when connection not found', async () => {
      mockQueryBuilder.select.mockResolvedValue({ data: [], error: null });

      const result = await repository.deleteConnection('user', 'non-existent');

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockQueryBuilder.select.mockResolvedValue({ data: null, error: { message: 'Error' } });

      const result = await repository.deleteConnection('user', 'owner-123');

      expect(result).toBe(false);
    });
  });

  describe('markConnectionInvalid', () => {
    it('should mark connection as invalid', async () => {
      mockQueryBuilder.select.mockResolvedValue({ data: [{ ...testConnection, is_valid: false }], error: null });

      const result = await repository.markConnectionInvalid('user', 'owner-123');

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({ is_valid: false });
      expect(result).toBe(true);
    });

    it('should return false when connection not found', async () => {
      mockQueryBuilder.select.mockResolvedValue({ data: [], error: null });

      const result = await repository.markConnectionInvalid('user', 'non-existent');

      expect(result).toBe(false);
    });
  });

  describe('getPreferences', () => {
    it('should return preferences when found', async () => {
      const prefs = {
        slack_notifications_enabled: true,
        weekly_slack_report_enabled: true,
        weekly_report_day: 1,
        weekly_report_time: '09:00',
      };
      mockQueryBuilder.single.mockResolvedValue({ data: prefs, error: null });

      const result = await repository.getPreferences('user', 'owner-123');

      expect(mockClient.from).toHaveBeenCalledWith('notification_preferences');
      expect(result).toEqual(prefs);
    });

    it('should return null when preferences not found', async () => {
      mockQueryBuilder.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });

      const result = await repository.getPreferences('user', 'non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updatePreferences', () => {
    it('should update and return preferences', async () => {
      const updatedPrefs = {
        slack_notifications_enabled: true,
        weekly_slack_report_enabled: false,
        weekly_report_day: 0,
        weekly_report_time: '10:00',
      };
      mockQueryBuilder.single.mockResolvedValue({ data: updatedPrefs, error: null });

      const result = await repository.updatePreferences('user', 'owner-123', {
        weekly_slack_report_enabled: false,
        weekly_report_time: '10:00',
      });

      expect(mockQueryBuilder.upsert).toHaveBeenCalled();
      expect(result).toEqual(updatedPrefs);
    });

    it('should throw error on update failure', async () => {
      mockQueryBuilder.single.mockResolvedValue({ data: null, error: { message: 'Update failed' } });

      await expect(
        repository.updatePreferences('user', 'owner-123', { weekly_report_day: 1 })
      ).rejects.toThrow('Failed to update preferences');
    });
  });


  describe('getFollowUpStatus', () => {
    it('should return follow-up status when found', async () => {
      const status = {
        owner_type: 'user',
        owner_id: 'owner-123',
        habit_id: 'habit-123',
        date: '2024-01-15',
        reminder_sent_at: null,
        follow_up_sent_at: null,
        skipped: false,
      };
      mockQueryBuilder.single.mockResolvedValue({ data: status, error: null });

      const result = await repository.getFollowUpStatus('user', 'owner-123', 'habit-123', '2024-01-15');

      expect(mockClient.from).toHaveBeenCalledWith('slack_follow_up_status');
      expect(result).toEqual(status);
    });

    it('should return null when status not found', async () => {
      mockQueryBuilder.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });

      const result = await repository.getFollowUpStatus('user', 'owner-123', 'habit-123', '2024-01-15');

      expect(result).toBeNull();
    });
  });

  describe('markReminderSent', () => {
    it('should mark reminder as sent', async () => {
      const status = {
        owner_type: 'user',
        owner_id: 'owner-123',
        habit_id: 'habit-123',
        date: '2024-01-15',
        reminder_sent_at: '2024-01-15T09:00:00Z',
      };
      mockQueryBuilder.single.mockResolvedValue({ data: status, error: null });

      const result = await repository.markReminderSent('user', 'owner-123', 'habit-123', '2024-01-15');

      expect(mockQueryBuilder.upsert).toHaveBeenCalled();
      expect(result).toEqual(status);
    });
  });

  describe('markFollowUpSent', () => {
    it('should mark follow-up as sent', async () => {
      const status = {
        owner_type: 'user',
        owner_id: 'owner-123',
        habit_id: 'habit-123',
        date: '2024-01-15',
        follow_up_sent_at: '2024-01-15T18:00:00Z',
      };
      mockQueryBuilder.single.mockResolvedValue({ data: status, error: null });

      const result = await repository.markFollowUpSent('user', 'owner-123', 'habit-123', '2024-01-15');

      expect(result).toEqual(status);
    });
  });

  describe('markSkipped', () => {
    it('should mark habit as skipped', async () => {
      const status = {
        owner_type: 'user',
        owner_id: 'owner-123',
        habit_id: 'habit-123',
        date: '2024-01-15',
        skipped: true,
      };
      mockQueryBuilder.single.mockResolvedValue({ data: status, error: null });

      const result = await repository.markSkipped('user', 'owner-123', 'habit-123', '2024-01-15');

      expect(result).toEqual(status);
    });
  });

  describe('setRemindLater', () => {
    it('should set remind later time', async () => {
      const remindAt = new Date('2024-01-15T14:00:00Z');
      const status = {
        owner_type: 'user',
        owner_id: 'owner-123',
        habit_id: 'habit-123',
        date: '2024-01-15',
        remind_later_at: remindAt.toISOString(),
      };
      mockQueryBuilder.single.mockResolvedValue({ data: status, error: null });

      const result = await repository.setRemindLater('user', 'owner-123', 'habit-123', '2024-01-15', remindAt);

      expect(result).toEqual(status);
    });
  });

  describe('getHabitsNeedingFollowUp', () => {
    it('should return habits needing follow-up', async () => {
      const statuses = [
        { owner_type: 'user', owner_id: 'owner-123', habit_id: 'habit-1', date: '2024-01-15' },
        { owner_type: 'user', owner_id: 'owner-456', habit_id: 'habit-2', date: '2024-01-15' },
      ];
      // Set up proper chain: select -> eq -> is -> eq
      mockQueryBuilder.eq.mockReturnValue({
        ...mockQueryBuilder,
        is: vi.fn().mockReturnValue({
          ...mockQueryBuilder,
          eq: vi.fn().mockResolvedValue({ data: statuses, error: null }),
        }),
      });

      const result = await repository.getHabitsNeedingFollowUp('2024-01-15');

      expect(result).toEqual(statuses);
    });

    it('should return empty array when no habits need follow-up', async () => {
      mockQueryBuilder.eq.mockReturnValue({
        ...mockQueryBuilder,
        is: vi.fn().mockReturnValue({
          ...mockQueryBuilder,
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      const result = await repository.getHabitsNeedingFollowUp('2024-01-15');

      expect(result).toEqual([]);
    });
  });

  describe('getHabitsNeedingRemindLater', () => {
    it('should return habits where remind_later_at has passed', async () => {
      const currentTime = new Date('2024-01-15T15:00:00Z');
      const statuses = [
        { owner_type: 'user', owner_id: 'owner-123', habit_id: 'habit-1', remind_later_at: '2024-01-15T14:00:00Z' },
      ];
      mockQueryBuilder.eq.mockResolvedValue({ data: statuses, error: null });

      const result = await repository.getHabitsNeedingRemindLater(currentTime);

      expect(mockQueryBuilder.lte).toHaveBeenCalledWith('remind_later_at', currentTime.toISOString());
      expect(result).toEqual(statuses);
    });

    it('should return empty array on error', async () => {
      mockQueryBuilder.eq.mockResolvedValue({ data: null, error: { message: 'Error' } });

      const result = await repository.getHabitsNeedingRemindLater(new Date());

      expect(result).toEqual([]);
    });
  });
});
