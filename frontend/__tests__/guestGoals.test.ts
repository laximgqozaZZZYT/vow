/**
 * Property-based tests for guest user goal operations
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

describe('Guest User Goal Operations', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  /**
   * Property 3: Guest goal creation
   * Feature: guest-user-habit-goal-support, Property 3: Guest goal creation
   * Validates: Requirements 2.1, 2.2
   */
  test('Property 3: Guest users can create and retrieve goals from localStorage', async () => {
    // Test data
    const testGoal = {
      name: 'Test Goal',
      details: 'Test goal details',
      dueDate: '2024-12-31'
    };

    // Create goal as guest user
    const createdGoal = await supabaseDirectClient.createGoal(testGoal);
    
    // Verify goal was created with correct structure
    expect(createdGoal).toMatchObject({
      name: testGoal.name,
      details: testGoal.details,
      dueDate: testGoal.dueDate,
      isCompleted: false
    });
    expect(createdGoal.id).toMatch(/^goal-\d+$/);
    expect(createdGoal.createdAt).toBeDefined();
    expect(createdGoal.updatedAt).toBeDefined();

    // Retrieve goals and verify the created goal is present
    const goals = await supabaseDirectClient.getGoals();
    expect(goals).toHaveLength(1);
    expect(goals[0]).toMatchObject(createdGoal);

    // Verify data is stored in localStorage
    const storedGoals = JSON.parse(mockLocalStorage.getItem('guest-goals') || '[]');
    expect(storedGoals).toHaveLength(1);
    expect(storedGoals[0]).toMatchObject(createdGoal);
  });

  test('Property 3: Multiple goal creation and retrieval', async () => {
    const goals = [
      { name: 'Goal 1', details: 'First goal' },
      { name: 'Goal 2', details: 'Second goal' },
      { name: 'Goal 3', details: 'Third goal' }
    ];

    // Create multiple goals
    const createdGoals = [];
    for (const goal of goals) {
      const created = await supabaseDirectClient.createGoal(goal);
      createdGoals.push(created);
    }

    // Retrieve all goals
    const retrievedGoals = await supabaseDirectClient.getGoals();
    
    // Verify all goals are present
    expect(retrievedGoals).toHaveLength(3);
    
    // Verify each goal matches what was created
    for (let i = 0; i < goals.length; i++) {
      expect(retrievedGoals[i]).toMatchObject({
        name: goals[i].name,
        details: goals[i].details,
        isCompleted: false
      });
    }
  });

  test('Property 3: Goal creation with minimal data', async () => {
    // Test with only required fields
    const minimalGoal = { name: 'Minimal Goal' };
    
    const createdGoal = await supabaseDirectClient.createGoal(minimalGoal);
    
    expect(createdGoal).toMatchObject({
      name: 'Minimal Goal',
      isCompleted: false
    });
    expect(createdGoal.details).toBeUndefined();
    expect(createdGoal.dueDate).toBeUndefined();
    expect(createdGoal.parentId).toBeUndefined();
  });
});