/**
 * Test Fixtures for Sticky-Habit Subtask Integration
 *
 * This file contains pre-generated test data with actual IDs
 * for testing the Sticky-Habit subtask relationship feature.
 * 
 * Use these fixtures for:
 * - Unit tests
 * - Property-based tests
 * - Integration tests
 * - Manual testing in development
 *
 * Requirements: Sticky-Habit Subtask Integration testing
 */

import type { Goal, Habit, Sticky } from '@/app/dashboard/types';
import type { Timing } from '@/app/dashboard/types/shared';

// ============================================================================
// Helper Functions
// ============================================================================

function getISODate(daysAgo: number = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

// ============================================================================
// Test Goals
// ============================================================================

export const testGoals: Goal[] = [
  {
    id: 'test-goal-1',
    name: '健康的な生活',
    details: '運動と食事で健康を維持する',
    parentId: null,
    isCompleted: false,
    createdAt: getISODate(30),
    updatedAt: getISODate(1),
  },
  {
    id: 'test-goal-2',
    name: 'スキルアップ',
    details: '新しいスキルを習得する',
    parentId: null,
    isCompleted: false,
    createdAt: getISODate(30),
    updatedAt: getISODate(1),
  },
];

// ============================================================================
// Test Habits (with subtask relationships)
// ============================================================================

export const testHabits: Habit[] = [
  // Habit with multiple subtasks (all incomplete) - should show warning
  {
    id: 'test-habit-1',
    goalId: 'test-goal-1',
    name: '朝の運動',
    active: true,
    type: 'do',
    count: 0,
    must: 30,
    completed: false,
    dueDate: getTodayString(),
    time: '07:00',
    endTime: '07:30',
    repeat: 'Daily',
    workloadUnit: '分',
    workloadTotal: 30,
    workloadPerCount: 30,
    timings: [{ type: 'Daily', start: '07:00', end: '07:30' } as Timing],
    createdAt: getISODate(30),
    updatedAt: getISODate(1),
  },
  // Habit with subtasks (some complete) - should NOT show warning
  {
    id: 'test-habit-2',
    goalId: 'test-goal-1',
    name: '水を飲む',
    active: true,
    type: 'do',
    count: 3,
    must: 8,
    completed: false,
    dueDate: getTodayString(),
    time: '08:00',
    endTime: '20:00',
    repeat: 'Daily',
    workloadUnit: '杯',
    workloadTotal: 8,
    workloadPerCount: 1,
    timings: [{ type: 'Daily', start: '08:00', end: '20:00' } as Timing],
    createdAt: getISODate(30),
    updatedAt: getISODate(1),
  },
  // Habit with NO subtasks - should NOT show expand button
  {
    id: 'test-habit-3',
    goalId: 'test-goal-2',
    name: '読書',
    active: true,
    type: 'do',
    count: 0,
    must: 30,
    completed: false,
    dueDate: getTodayString(),
    time: '21:00',
    endTime: '21:30',
    repeat: 'Daily',
    workloadUnit: '分',
    workloadTotal: 30,
    workloadPerCount: 30,
    timings: [{ type: 'Daily', start: '21:00', end: '21:30' } as Timing],
    createdAt: getISODate(30),
    updatedAt: getISODate(1),
  },
  // Habit with single subtask (complete) - should NOT show warning
  {
    id: 'test-habit-4',
    goalId: 'test-goal-2',
    name: 'コーディング練習',
    active: true,
    type: 'do',
    count: 0,
    must: 60,
    completed: false,
    dueDate: getTodayString(),
    time: '20:00',
    endTime: '21:00',
    repeat: 'Daily',
    workloadUnit: '分',
    workloadTotal: 60,
    workloadPerCount: 60,
    timings: [{ type: 'Daily', start: '20:00', end: '21:00' } as Timing],
    createdAt: getISODate(30),
    updatedAt: getISODate(1),
  },
  // Completed habit with incomplete subtasks - subtasks should remain unchanged
  {
    id: 'test-habit-5',
    goalId: 'test-goal-1',
    name: '瞑想',
    active: true,
    type: 'do',
    count: 10,
    must: 10,
    completed: true,
    lastCompletedAt: getISODate(0),
    dueDate: getTodayString(),
    time: '06:00',
    endTime: '06:10',
    repeat: 'Daily',
    workloadUnit: '分',
    workloadTotal: 10,
    workloadPerCount: 10,
    timings: [{ type: 'Daily', start: '06:00', end: '06:10' } as Timing],
    createdAt: getISODate(30),
    updatedAt: getISODate(0),
  },
];

// ============================================================================
// Test Stickies (with habit relationships)
// ============================================================================

export const testStickies: Sticky[] = [
  // Subtasks for test-habit-1 (all incomplete - triggers warning)
  {
    id: 'test-sticky-1',
    name: 'ランニングシューズを買う',
    description: '新しいランニングシューズを購入',
    completed: false,
    displayOrder: 0,
    habits: [testHabits[0]], // test-habit-1
    createdAt: getISODate(7),
    updatedAt: getISODate(1),
  },
  {
    id: 'test-sticky-2',
    name: 'ストレッチマットを準備',
    description: 'ヨガマットを購入または準備',
    completed: false,
    displayOrder: 1,
    habits: [testHabits[0]], // test-habit-1
    createdAt: getISODate(7),
    updatedAt: getISODate(1),
  },
  {
    id: 'test-sticky-3',
    name: '運動プランを作成',
    description: '週間の運動スケジュールを作成',
    completed: false,
    displayOrder: 2,
    habits: [testHabits[0]], // test-habit-1
    createdAt: getISODate(7),
    updatedAt: getISODate(1),
  },

  // Subtasks for test-habit-2 (mixed completion - no warning)
  {
    id: 'test-sticky-4',
    name: 'ウォーターボトル購入',
    description: '1リットルのボトルを購入',
    completed: true,
    completedAt: getISODate(2),
    displayOrder: 0,
    habits: [testHabits[1]], // test-habit-2
    createdAt: getISODate(10),
    updatedAt: getISODate(2),
  },
  {
    id: 'test-sticky-5',
    name: 'リマインダー設定',
    description: '2時間ごとに水を飲むリマインダー',
    completed: false,
    displayOrder: 1,
    habits: [testHabits[1]], // test-habit-2
    createdAt: getISODate(10),
    updatedAt: getISODate(1),
  },

  // Subtask for test-habit-4 (single, complete - no warning)
  {
    id: 'test-sticky-6',
    name: '開発環境セットアップ',
    description: 'VSCodeと必要な拡張機能をインストール',
    completed: true,
    completedAt: getISODate(5),
    displayOrder: 0,
    habits: [testHabits[3]], // test-habit-4
    createdAt: getISODate(14),
    updatedAt: getISODate(5),
  },

  // Subtask for test-habit-5 (completed habit, incomplete subtask)
  {
    id: 'test-sticky-7',
    name: '瞑想アプリをインストール',
    description: 'Headspaceまたは他のアプリを試す',
    completed: false,
    displayOrder: 0,
    habits: [testHabits[4]], // test-habit-5
    createdAt: getISODate(7),
    updatedAt: getISODate(1),
  },

  // Sticky with multiple habit relations
  {
    id: 'test-sticky-8',
    name: '健康管理アプリ導入',
    description: '運動と水分摂取を記録するアプリ',
    completed: false,
    displayOrder: 0,
    habits: [testHabits[0], testHabits[1]], // test-habit-1 AND test-habit-2
    createdAt: getISODate(5),
    updatedAt: getISODate(1),
  },

  // Standalone sticky (no habit relation)
  {
    id: 'test-sticky-9',
    name: '買い物リスト',
    description: '牛乳、パン、卵',
    completed: false,
    displayOrder: 0,
    habits: [],
    createdAt: getISODate(1),
    updatedAt: getISODate(0),
  },
];

// ============================================================================
// Test Scenarios
// ============================================================================

/**
 * Scenario 1: Habit with all incomplete subtasks (should show warning)
 */
export const scenarioAllIncomplete = {
  habit: testHabits[0], // test-habit-1
  subtasks: testStickies.filter(s => 
    s.habits?.some(h => h.id === 'test-habit-1')
  ),
  expectedWarning: true,
  expectedExpandButton: true,
};

/**
 * Scenario 2: Habit with mixed completion subtasks (no warning)
 */
export const scenarioMixedCompletion = {
  habit: testHabits[1], // test-habit-2
  subtasks: testStickies.filter(s => 
    s.habits?.some(h => h.id === 'test-habit-2')
  ),
  expectedWarning: false,
  expectedExpandButton: true,
};

/**
 * Scenario 3: Habit with no subtasks (no expand button)
 */
export const scenarioNoSubtasks = {
  habit: testHabits[2], // test-habit-3
  subtasks: [],
  expectedWarning: false,
  expectedExpandButton: false,
};

/**
 * Scenario 4: Habit with single complete subtask (no warning)
 */
export const scenarioSingleComplete = {
  habit: testHabits[3], // test-habit-4
  subtasks: testStickies.filter(s => 
    s.habits?.some(h => h.id === 'test-habit-4')
  ),
  expectedWarning: false,
  expectedExpandButton: true,
};

/**
 * Scenario 5: Completed habit with incomplete subtask
 * (subtask should remain unchanged when habit completes)
 */
export const scenarioCompletedHabitWithSubtask = {
  habit: testHabits[4], // test-habit-5
  subtasks: testStickies.filter(s => 
    s.habits?.some(h => h.id === 'test-habit-5')
  ),
  expectedWarning: true, // All subtasks incomplete
  expectedExpandButton: true,
  habitCompleted: true,
};

/**
 * Scenario 6: Sticky with multiple habit relations
 */
export const scenarioMultipleHabitRelations = {
  sticky: testStickies[7], // test-sticky-8
  relatedHabits: [testHabits[0], testHabits[1]],
  expectedInBothHabitSubtaskLists: true,
};

// ============================================================================
// Export All Test Data
// ============================================================================

export const testFixtures = {
  goals: testGoals,
  habits: testHabits,
  stickies: testStickies,
  scenarios: {
    allIncomplete: scenarioAllIncomplete,
    mixedCompletion: scenarioMixedCompletion,
    noSubtasks: scenarioNoSubtasks,
    singleComplete: scenarioSingleComplete,
    completedHabitWithSubtask: scenarioCompletedHabitWithSubtask,
    multipleHabitRelations: scenarioMultipleHabitRelations,
  },
};

export default testFixtures;
