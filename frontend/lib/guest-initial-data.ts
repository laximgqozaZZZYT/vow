/**
 * Guest Initial Data Setup
 *
 * This module provides initial sample data for guest users.
 * When a guest user first accesses the dashboard, this data is
 * automatically populated to demonstrate the app's features.
 *
 * Data includes:
 * - Sample goals with parent-child relationships
 * - Sample habits linked to goals
 * - Sample stickies with habit relationships (for subtask feature)
 * - Sample activities for the past 7 days
 */

import type { Goal, Habit, Activity, Sticky } from '@/app/dashboard/types';
import type { Timing } from '@/app/dashboard/types/shared';
import { debug } from './debug';

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEYS = {
  GOALS: 'guest-goals',
  HABITS: 'guest-habits',
  ACTIVITIES: 'guest-activities',
  STICKIES: 'guest-stickies',
  STICKY_HABITS: 'guest-sticky-habits',
  INITIALIZED: 'guest-data-initialized',
} as const;

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

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Initial Goals
// ============================================================================

function createInitialGoals(): Goal[] {
  const now = getISODate();
  const weekAgo = getISODate(7);

  return [
    // Parent Goal 1: 健康的な生活
    {
      id: generateId('goal'),
      name: '健康的な生活',
      details: '運動習慣と食生活の改善で、心身ともに健康な状態を維持する。',
      parentId: null,
      isCompleted: false,
      createdAt: weekAgo,
      updatedAt: now,
    },
    // Parent Goal 2: スキルアップ
    {
      id: generateId('goal'),
      name: 'スキルアップ',
      details: '読書や学習を通じて知識を深め、キャリアの幅を広げる。',
      parentId: null,
      isCompleted: false,
      createdAt: weekAgo,
      updatedAt: now,
    },
  ];
}

// ============================================================================
// Initial Habits
// ============================================================================

function createInitialHabits(goals: Goal[]): Habit[] {
  const now = getISODate();
  const weekAgo = getISODate(7);
  const today = getTodayString();

  const healthGoalId = goals[0]?.id || '';
  const skillGoalId = goals[1]?.id || '';

  return [
    // Health habits
    {
      id: generateId('habit'),
      goalId: healthGoalId,
      name: '朝のストレッチ',
      active: true,
      type: 'do',
      count: 0,
      must: 10,
      completed: false,
      dueDate: today,
      time: '06:30',
      endTime: '06:40',
      repeat: 'Daily',
      workloadUnit: '分',
      workloadTotal: 10,
      workloadPerCount: 10,
      timings: [{ type: 'Daily', start: '06:30', end: '06:40' } as Timing],
      createdAt: weekAgo,
      updatedAt: now,
    },
    {
      id: generateId('habit'),
      goalId: healthGoalId,
      name: '水を飲む',
      active: true,
      type: 'do',
      count: 2,
      must: 8,
      completed: false,
      dueDate: today,
      time: '08:00',
      endTime: '20:00',
      repeat: 'Daily',
      workloadUnit: '杯',
      workloadTotal: 8,
      workloadPerCount: 1,
      timings: [{ type: 'Daily', start: '08:00', end: '20:00' } as Timing],
      createdAt: weekAgo,
      updatedAt: now,
    },
    {
      id: generateId('habit'),
      goalId: healthGoalId,
      name: '瞑想',
      active: true,
      type: 'do',
      count: 0,
      must: 10,
      completed: false,
      dueDate: today,
      time: '21:00',
      endTime: '21:10',
      repeat: 'Daily',
      workloadUnit: '分',
      workloadTotal: 10,
      workloadPerCount: 10,
      timings: [{ type: 'Daily', start: '21:00', end: '21:10' } as Timing],
      createdAt: weekAgo,
      updatedAt: now,
    },
    // Skill habits
    {
      id: generateId('habit'),
      goalId: skillGoalId,
      name: '読書',
      active: true,
      type: 'do',
      count: 0,
      must: 30,
      completed: false,
      dueDate: today,
      time: '21:30',
      endTime: '22:00',
      repeat: 'Daily',
      workloadUnit: '分',
      workloadTotal: 30,
      workloadPerCount: 30,
      timings: [{ type: 'Daily', start: '21:30', end: '22:00' } as Timing],
      createdAt: weekAgo,
      updatedAt: now,
    },
    {
      id: generateId('habit'),
      goalId: skillGoalId,
      name: '英語学習',
      active: true,
      type: 'do',
      count: 0,
      must: 20,
      completed: false,
      dueDate: today,
      time: '12:00',
      endTime: '12:20',
      repeat: 'Daily',
      workloadUnit: '分',
      workloadTotal: 20,
      workloadPerCount: 20,
      timings: [{ type: 'Daily', start: '12:00', end: '12:20' } as Timing],
      createdAt: weekAgo,
      updatedAt: now,
    },
  ];
}

// ============================================================================
// Initial Stickies (with Habit Relations)
// ============================================================================

function createInitialStickies(habits: Habit[]): { stickies: Sticky[]; stickyHabits: Array<{ stickyId: string; habitId: string }> } {
  const now = getISODate();
  const stickies: Sticky[] = [];
  const stickyHabits: Array<{ stickyId: string; habitId: string }> = [];

  // Find habits by name for linking
  const stretchHabit = habits.find(h => h.name === '朝のストレッチ');
  const waterHabit = habits.find(h => h.name === '水を飲む');
  const meditationHabit = habits.find(h => h.name === '瞑想');
  const readingHabit = habits.find(h => h.name === '読書');
  const englishHabit = habits.find(h => h.name === '英語学習');

  // Sticky 1: Related to stretch habit (subtask)
  const sticky1Id = generateId('sticky');
  stickies.push({
    id: sticky1Id,
    name: 'ヨガマットを購入',
    description: '朝のストレッチ用にヨガマットを購入する',
    completed: false,
    displayOrder: 0,
    createdAt: now,
    updatedAt: now,
  });
  if (stretchHabit) {
    stickyHabits.push({ stickyId: sticky1Id, habitId: stretchHabit.id });
  }

  // Sticky 2: Related to water habit (subtask)
  const sticky2Id = generateId('sticky');
  stickies.push({
    id: sticky2Id,
    name: 'ウォーターボトル購入',
    description: '1リットルのウォーターボトルを購入',
    completed: true,
    completedAt: getISODate(2),
    displayOrder: 1,
    createdAt: now,
    updatedAt: now,
  });
  if (waterHabit) {
    stickyHabits.push({ stickyId: sticky2Id, habitId: waterHabit.id });
  }

  // Sticky 3: Related to meditation habit (subtask - incomplete)
  const sticky3Id = generateId('sticky');
  stickies.push({
    id: sticky3Id,
    name: '瞑想アプリをインストール',
    description: 'Headspaceまたは他の瞑想アプリを試す',
    completed: false,
    displayOrder: 2,
    createdAt: now,
    updatedAt: now,
  });
  if (meditationHabit) {
    stickyHabits.push({ stickyId: sticky3Id, habitId: meditationHabit.id });
  }

  // Sticky 4: Related to reading habit (subtask)
  const sticky4Id = generateId('sticky');
  stickies.push({
    id: sticky4Id,
    name: '今月読む本を選ぶ',
    description: '今月読む本を2冊選んで購入',
    completed: false,
    displayOrder: 3,
    createdAt: now,
    updatedAt: now,
  });
  if (readingHabit) {
    stickyHabits.push({ stickyId: sticky4Id, habitId: readingHabit.id });
  }

  // Sticky 5: Related to english habit (subtask)
  const sticky5Id = generateId('sticky');
  stickies.push({
    id: sticky5Id,
    name: '英語アプリをインストール',
    description: 'Duolingoまたは他の英語学習アプリを試す',
    completed: false,
    displayOrder: 4,
    createdAt: now,
    updatedAt: now,
  });
  if (englishHabit) {
    stickyHabits.push({ stickyId: sticky5Id, habitId: englishHabit.id });
  }

  // Sticky 6: Multiple habit relations (subtask for both stretch and meditation)
  const sticky6Id = generateId('sticky');
  stickies.push({
    id: sticky6Id,
    name: '朝のルーティン時間を確保',
    description: '6:30-7:00の時間を朝のルーティンに確保する',
    completed: false,
    displayOrder: 5,
    createdAt: now,
    updatedAt: now,
  });
  if (stretchHabit) {
    stickyHabits.push({ stickyId: sticky6Id, habitId: stretchHabit.id });
  }
  if (meditationHabit) {
    stickyHabits.push({ stickyId: sticky6Id, habitId: meditationHabit.id });
  }

  // Sticky 7: Standalone (no habit relation)
  stickies.push({
    id: generateId('sticky'),
    name: '買い物リスト',
    description: '牛乳、パン、卵、野菜',
    completed: false,
    displayOrder: 6,
    createdAt: now,
    updatedAt: now,
  });

  // Sticky 8: Standalone (no habit relation)
  stickies.push({
    id: generateId('sticky'),
    name: '週末の予定',
    description: '友人とランチ、映画を見る',
    completed: false,
    displayOrder: 7,
    createdAt: now,
    updatedAt: now,
  });

  return { stickies, stickyHabits };
}

// ============================================================================
// Initial Activities (Past 7 days)
// ============================================================================

function createInitialActivities(habits: Habit[]): Activity[] {
  const activities: Activity[] = [];
  let activityId = 1;

  // Generate activities for the past 7 days
  for (let daysAgo = 6; daysAgo >= 1; daysAgo--) {
    for (const habit of habits) {
      // Random completion (70% chance)
      if (Math.random() < 0.7) {
        const startTime = habit.time || '09:00';
        const endTime = habit.endTime || '09:30';
        const amount = habit.must || 1;

        // Start activity
        activities.push({
          id: generateId('activity'),
          kind: 'start',
          habitId: habit.id,
          habitName: habit.name,
          timestamp: getTimestamp(daysAgo, startTime),
          prevCount: 0,
          newCount: 0,
        });

        // Complete activity
        activities.push({
          id: generateId('activity'),
          kind: 'complete',
          habitId: habit.id,
          habitName: habit.name,
          timestamp: getTimestamp(daysAgo, endTime),
          amount: amount,
          prevCount: 0,
          newCount: amount,
        });
      }
    }
  }

  return activities;
}

function getTimestamp(daysAgo: number, time: string): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const [hours, minutes] = time.split(':').map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

// ============================================================================
// Main Initialization Function
// ============================================================================

/**
 * Initialize guest data if not already initialized.
 * This function checks if guest data exists and creates initial sample data if not.
 *
 * @returns true if data was initialized, false if data already existed
 */
export function initializeGuestData(): boolean {
  // Check if running in browser
  if (typeof window === 'undefined') {
    return false;
  }

  // Check if already initialized
  const isInitialized = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
  if (isInitialized === 'true') {
    debug.log('[GuestInitialData] Already initialized, skipping');
    return false;
  }

  // Check if any guest data already exists
  const existingGoals = localStorage.getItem(STORAGE_KEYS.GOALS);
  const existingHabits = localStorage.getItem(STORAGE_KEYS.HABITS);
  
  if (existingGoals || existingHabits) {
    debug.log('[GuestInitialData] Guest data already exists, marking as initialized');
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
    return false;
  }

  debug.log('[GuestInitialData] Initializing guest data with sample data');

  try {
    // Create initial data
    const goals = createInitialGoals();
    const habits = createInitialHabits(goals);
    const { stickies, stickyHabits } = createInitialStickies(habits);
    const activities = createInitialActivities(habits);

    // Save to localStorage
    localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(goals));
    localStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(habits));
    localStorage.setItem(STORAGE_KEYS.STICKIES, JSON.stringify(stickies));
    localStorage.setItem(STORAGE_KEYS.STICKY_HABITS, JSON.stringify(stickyHabits));
    localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(activities));
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');

    debug.log('[GuestInitialData] Initialized with:', {
      goals: goals.length,
      habits: habits.length,
      stickies: stickies.length,
      stickyHabits: stickyHabits.length,
      activities: activities.length,
    });

    return true;
  } catch (error) {
    console.error('[GuestInitialData] Failed to initialize:', error);
    return false;
  }
}

/**
 * Clear all guest data (for testing or reset purposes)
 */
export function clearGuestData(): void {
  if (typeof window === 'undefined') {
    return;
  }

  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });

  debug.log('[GuestInitialData] Cleared all guest data');
}

/**
 * Check if guest data has been initialized
 */
export function isGuestDataInitialized(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return localStorage.getItem(STORAGE_KEYS.INITIALIZED) === 'true';
}
