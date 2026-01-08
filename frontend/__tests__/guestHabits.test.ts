/**
 * Property-based tests for guest user habit operations
 * Feature: guest-user-habit-goal-support
 */

// Mock localStorage for testing
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

// Mock supabase client to simulate guest user
jest.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } })
    }
  }
}));

import { supabaseDirectClient } from '../lib/supabase-direct';

describe('Guest User Habit Operations', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  /**
   * Property 4: Guest habit creation
   * Feature: guest-user-habit-goal-support, Property 4: Guest habit creation
   * Validates: Requirements 3.1, 3.2
   */
  test('Property 4: Guest users can create and retrieve habits from localStorage', async () => {
    // Test data
    const testHabit = {
      name: 'Test Habit',
      type: 'do' as const,
      notes: 'Test habit notes',
      workloadUnit: 'minutes',
      workloadTotal: 30,
      workloadPerCount: 1
    };

    // Create habit as guest user
    const createdHabit = await supabaseDirectClient.createHabit(testHabit);
    
    // Verify habit was created with correct structure
    expect(createdHabit).toMatchObject({
      name: testHabit.name,
      type: testHabit.type,
      notes: testHabit.notes,
      workloadUnit: testHabit.workloadUnit,
      workloadTotal: testHabit.workloadTotal,
      workloadPerCount: testHabit.workloadPerCount,
      active: true,
      count: 0,
      completed: false
    });
    expect(createdHabit.id).toMatch(/^habit-\d+$/);
    expect(createdHabit.goalId).toBeDefined();
    expect(createdHabit.createdAt).toBeDefined();
    expect(createdHabit.updatedAt).toBeDefined();

    // Retrieve habits and verify the created habit is present
    const habits = await supabaseDirectClient.getHabits();
    expect(habits).toHaveLength(1);
    expect(habits[0]).toMatchObject(createdHabit);

    // Verify data is stored in localStorage
    const storedHabits = JSON.parse(mockLocalStorage.getItem('guest-habits') || '[]');
    expect(storedHabits).toHaveLength(1);
    expect(storedHabits[0]).toMatchObject(createdHabit);
  });

  test('Property 4: Multiple habit creation and retrieval', async () => {
    const habits = [
      { name: 'Habit 1', type: 'do' as const, workloadUnit: 'pages', workloadTotal: 10 },
      { name: 'Habit 2', type: 'avoid' as const, notes: 'Bad habit to avoid' },
      { name: 'Habit 3', type: 'do' as const, workloadUnit: 'hours', workloadTotal: 2 }
    ];

    // Create multiple habits
    const createdHabits = [];
    for (const habit of habits) {
      const created = await supabaseDirectClient.createHabit(habit);
      createdHabits.push(created);
    }

    // Retrieve all habits
    const retrievedHabits = await supabaseDirectClient.getHabits();
    
    // Verify all habits are present
    expect(retrievedHabits).toHaveLength(3);
    
    // Verify each habit matches what was created
    for (let i = 0; i < habits.length; i++) {
      expect(retrievedHabits[i]).toMatchObject({
        name: habits[i].name,
        type: habits[i].type,
        active: true,
        count: 0,
        completed: false
      });
    }
  });

  test('Property 4: Habit creation with minimal data', async () => {
    // Test with only required fields
    const minimalHabit = { 
      name: 'Minimal Habit',
      type: 'do' as const
    };
    
    const createdHabit = await supabaseDirectClient.createHabit(minimalHabit);
    
    expect(createdHabit).toMatchObject({
      name: 'Minimal Habit',
      type: 'do',
      active: true,
      count: 0,
      completed: false
    });
    expect(createdHabit.goalId).toBe('default-goal');
  });

  test('Property 4: Activity creation when habit is completed', async () => {
    // Create a habit first
    const habit = await supabaseDirectClient.createHabit({
      name: 'Test Habit',
      type: 'do' as const
    });

    // Create an activity for the habit
    const activityData = {
      kind: 'increment',
      habitId: habit.id,
      habitName: habit.name,
      amount: 1,
      prevCount: 0,
      newCount: 1
    };

    const createdActivity = await supabaseDirectClient.createActivity(activityData);

    // Verify activity was created
    expect(createdActivity).toMatchObject({
      kind: 'increment',
      habitId: habit.id,
      habitName: habit.name,
      amount: 1,
      prevCount: 0,
      newCount: 1
    });
    expect(createdActivity.id).toMatch(/^activity-\d+$/);
    expect(createdActivity.timestamp).toBeDefined();

    // Verify activity is stored in localStorage
    const storedActivities = JSON.parse(mockLocalStorage.getItem('guest-activities') || '[]');
    expect(storedActivities).toHaveLength(1);
    expect(storedActivities[0]).toMatchObject(createdActivity);

    // Retrieve activities and verify
    const activities = await supabaseDirectClient.getActivities();
    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject(createdActivity);
  });
});