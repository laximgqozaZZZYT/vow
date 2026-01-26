/**
 * Unit tests for Habit Status Utilities
 * 
 * Tests the habit status determination logic for the Kanban board.
 * 
 * **Validates: Requirements 2.3, 2.4, 2.5, 2.6**
 */

import {
  getHabitStatus,
  groupHabitsByStatus,
  getTodayDateString,
  getTodayActivitiesForHabit,
  getHabitStatusCounts,
  type HabitStatus,
} from '../../app/dashboard/utils/habitStatusUtils';
import type { Habit, Activity } from '../../app/dashboard/types';

// Helper to create a mock habit
function createMockHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-1',
    goalId: 'goal-1',
    name: 'Test Habit',
    active: true,
    type: 'do',
    count: 0,
    must: 1,
    completed: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// Helper to create a mock activity
function createMockActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'activity-1',
    kind: 'start',
    habitId: 'habit-1',
    habitName: 'Test Habit',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to get today's date string for testing
function getToday(): string {
  return getTodayDateString();
}

describe('habitStatusUtils', () => {
  describe('getTodayDateString', () => {
    it('should return a valid YYYY-MM-DD format string', () => {
      const result = getTodayDateString();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should return today\'s date in local timezone', () => {
      const result = getTodayDateString();
      const today = new Date();
      const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      expect(result).toBe(expected);
    });
  });

  describe('getTodayActivitiesForHabit', () => {
    const today = getToday();
    const yesterday = (() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();

    it('should filter activities for the specified habit and today', () => {
      const activities: Activity[] = [
        createMockActivity({ id: 'a1', habitId: 'habit-1', timestamp: `${today}T10:00:00Z` }),
        createMockActivity({ id: 'a2', habitId: 'habit-1', timestamp: `${yesterday}T10:00:00Z` }),
        createMockActivity({ id: 'a3', habitId: 'habit-2', timestamp: `${today}T10:00:00Z` }),
      ];

      const result = getTodayActivitiesForHabit('habit-1', activities, today);
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('a1');
    });

    it('should return empty array when no matching activities', () => {
      const activities: Activity[] = [
        createMockActivity({ id: 'a1', habitId: 'habit-2', timestamp: `${today}T10:00:00Z` }),
      ];

      const result = getTodayActivitiesForHabit('habit-1', activities, today);
      
      expect(result).toHaveLength(0);
    });
  });

  describe('getHabitStatus', () => {
    const today = getToday();

    describe('planned status', () => {
      /**
       * **Validates: Requirement 2.4**
       * Habits with no activity today should be in the 「予定」column
       */
      it('should return "planned" when habit has no activities today', () => {
        const habit = createMockHabit({ id: 'habit-1' });
        const activities: Activity[] = [];

        const result = getHabitStatus(habit, activities);

        expect(result).toBe('planned');
      });

      it('should return "planned" when habit has activities from other days only', () => {
        const habit = createMockHabit({ id: 'habit-1' });
        const yesterday = (() => {
          const d = new Date();
          d.setDate(d.getDate() - 1);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        })();
        const activities: Activity[] = [
          createMockActivity({ habitId: 'habit-1', kind: 'complete', timestamp: `${yesterday}T10:00:00Z` }),
        ];

        const result = getHabitStatus(habit, activities);

        expect(result).toBe('planned');
      });

      it('should return "planned" when habit was started and then paused', () => {
        const habit = createMockHabit({ id: 'habit-1' });
        const activities: Activity[] = [
          createMockActivity({ id: 'a1', habitId: 'habit-1', kind: 'start', timestamp: `${today}T09:00:00Z` }),
          createMockActivity({ id: 'a2', habitId: 'habit-1', kind: 'pause', timestamp: `${today}T10:00:00Z` }),
        ];

        const result = getHabitStatus(habit, activities);

        expect(result).toBe('planned');
      });
    });

    describe('in_progress status', () => {
      /**
       * **Validates: Requirement 2.5**
       * Habits with a 'start' activity today without 'complete' should be in 「進行中」column
       */
      it('should return "in_progress" when habit has start activity without complete', () => {
        const habit = createMockHabit({ id: 'habit-1' });
        const activities: Activity[] = [
          createMockActivity({ habitId: 'habit-1', kind: 'start', timestamp: `${today}T10:00:00Z` }),
        ];

        const result = getHabitStatus(habit, activities);

        expect(result).toBe('in_progress');
      });

      it('should return "in_progress" when habit was paused and then restarted', () => {
        const habit = createMockHabit({ id: 'habit-1' });
        const activities: Activity[] = [
          createMockActivity({ id: 'a1', habitId: 'habit-1', kind: 'start', timestamp: `${today}T09:00:00Z` }),
          createMockActivity({ id: 'a2', habitId: 'habit-1', kind: 'pause', timestamp: `${today}T10:00:00Z` }),
          createMockActivity({ id: 'a3', habitId: 'habit-1', kind: 'start', timestamp: `${today}T11:00:00Z` }),
        ];

        const result = getHabitStatus(habit, activities);

        expect(result).toBe('in_progress');
      });
    });

    describe('completed_daily status', () => {
      /**
       * **Validates: Requirement 2.6**
       * Habits with a 'complete' activity today should be in 「完了(日次)」column
       */
      it('should return "completed_daily" when habit has complete activity today', () => {
        const habit = createMockHabit({ id: 'habit-1' });
        const activities: Activity[] = [
          createMockActivity({ habitId: 'habit-1', kind: 'complete', timestamp: `${today}T10:00:00Z` }),
        ];

        const result = getHabitStatus(habit, activities);

        expect(result).toBe('completed_daily');
      });

      it('should return "completed_daily" when habit was started and then completed', () => {
        const habit = createMockHabit({ id: 'habit-1' });
        const activities: Activity[] = [
          createMockActivity({ id: 'a1', habitId: 'habit-1', kind: 'start', timestamp: `${today}T09:00:00Z` }),
          createMockActivity({ id: 'a2', habitId: 'habit-1', kind: 'complete', timestamp: `${today}T10:00:00Z` }),
        ];

        const result = getHabitStatus(habit, activities);

        expect(result).toBe('completed_daily');
      });

      it('should return "completed_daily" even if there are activities after complete', () => {
        const habit = createMockHabit({ id: 'habit-1' });
        const activities: Activity[] = [
          createMockActivity({ id: 'a1', habitId: 'habit-1', kind: 'complete', timestamp: `${today}T09:00:00Z` }),
          createMockActivity({ id: 'a2', habitId: 'habit-1', kind: 'start', timestamp: `${today}T10:00:00Z` }),
        ];

        const result = getHabitStatus(habit, activities);

        expect(result).toBe('completed_daily');
      });
    });

    describe('edge cases', () => {
      it('should only consider activities for the specific habit', () => {
        const habit = createMockHabit({ id: 'habit-1' });
        const activities: Activity[] = [
          createMockActivity({ habitId: 'habit-2', kind: 'complete', timestamp: `${today}T10:00:00Z` }),
        ];

        const result = getHabitStatus(habit, activities);

        expect(result).toBe('planned');
      });

      it('should handle skip activity as not affecting status', () => {
        const habit = createMockHabit({ id: 'habit-1' });
        const activities: Activity[] = [
          createMockActivity({ habitId: 'habit-1', kind: 'skip', timestamp: `${today}T10:00:00Z` }),
        ];

        const result = getHabitStatus(habit, activities);

        expect(result).toBe('planned');
      });
    });
  });

  describe('groupHabitsByStatus', () => {
    const today = getToday();

    it('should group habits into correct status categories', () => {
      const habits: Habit[] = [
        createMockHabit({ id: 'habit-1', name: 'Planned Habit' }),
        createMockHabit({ id: 'habit-2', name: 'In Progress Habit' }),
        createMockHabit({ id: 'habit-3', name: 'Completed Habit' }),
      ];

      const activities: Activity[] = [
        createMockActivity({ habitId: 'habit-2', kind: 'start', timestamp: `${today}T09:00:00Z` }),
        createMockActivity({ habitId: 'habit-3', kind: 'complete', timestamp: `${today}T10:00:00Z` }),
      ];

      const result = groupHabitsByStatus(habits, activities);

      expect(result.planned).toHaveLength(1);
      expect(result.planned[0].id).toBe('habit-1');

      expect(result.in_progress).toHaveLength(1);
      expect(result.in_progress[0].id).toBe('habit-2');

      expect(result.completed_daily).toHaveLength(1);
      expect(result.completed_daily[0].id).toBe('habit-3');
    });

    it('should return empty arrays when no habits provided', () => {
      const result = groupHabitsByStatus([], []);

      expect(result.planned).toHaveLength(0);
      expect(result.in_progress).toHaveLength(0);
      expect(result.completed_daily).toHaveLength(0);
    });

    it('should put all habits in planned when no activities', () => {
      const habits: Habit[] = [
        createMockHabit({ id: 'habit-1' }),
        createMockHabit({ id: 'habit-2' }),
        createMockHabit({ id: 'habit-3' }),
      ];

      const result = groupHabitsByStatus(habits, []);

      expect(result.planned).toHaveLength(3);
      expect(result.in_progress).toHaveLength(0);
      expect(result.completed_daily).toHaveLength(0);
    });

    it('should handle multiple habits in the same status', () => {
      const habits: Habit[] = [
        createMockHabit({ id: 'habit-1' }),
        createMockHabit({ id: 'habit-2' }),
      ];

      const activities: Activity[] = [
        createMockActivity({ habitId: 'habit-1', kind: 'complete', timestamp: `${today}T10:00:00Z` }),
        createMockActivity({ habitId: 'habit-2', kind: 'complete', timestamp: `${today}T11:00:00Z` }),
      ];

      const result = groupHabitsByStatus(habits, activities);

      expect(result.completed_daily).toHaveLength(2);
      expect(result.planned).toHaveLength(0);
      expect(result.in_progress).toHaveLength(0);
    });
  });

  describe('getHabitStatusCounts', () => {
    const today = getToday();

    it('should return correct counts for each status', () => {
      const habits: Habit[] = [
        createMockHabit({ id: 'habit-1' }),
        createMockHabit({ id: 'habit-2' }),
        createMockHabit({ id: 'habit-3' }),
        createMockHabit({ id: 'habit-4' }),
      ];

      const activities: Activity[] = [
        createMockActivity({ habitId: 'habit-2', kind: 'start', timestamp: `${today}T09:00:00Z` }),
        createMockActivity({ habitId: 'habit-3', kind: 'complete', timestamp: `${today}T10:00:00Z` }),
        createMockActivity({ habitId: 'habit-4', kind: 'complete', timestamp: `${today}T11:00:00Z` }),
      ];

      const result = getHabitStatusCounts(habits, activities);

      expect(result.planned).toBe(1);
      expect(result.in_progress).toBe(1);
      expect(result.completed_daily).toBe(2);
    });

    it('should return zeros when no habits', () => {
      const result = getHabitStatusCounts([], []);

      expect(result.planned).toBe(0);
      expect(result.in_progress).toBe(0);
      expect(result.completed_daily).toBe(0);
    });
  });
});
