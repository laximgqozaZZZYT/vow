/**
 * Demo Data for Landing Page Demo Section
 *
 * This file contains static demo data for the landing page demo section.
 * All data follows the existing type definitions (Goal, Habit, Activity, Sticky).
 * 
 * Simulates a user who has been using the app for several months with:
 * - Hierarchical goal structure (parent-child relationships)
 * - Rich activity history spanning 90+ days
 * - Multiple habits with varying completion rates
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 */

import type { Goal, Habit, Activity, Sticky } from '@/app/dashboard/types';
import type { Timing } from '@/app/dashboard/types/shared';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get today's date string in YYYY-MM-DD format
 */
export function getTodayString(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

/**
 * Get a date string for N days ago in YYYY-MM-DD format
 */
export function getDateStringDaysAgo(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}

/**
 * Get an ISO timestamp for a specific date and time
 */
export function getTimestamp(daysAgo: number, time: string): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const [hours, minutes] = time.split(':').map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

/**
 * Get an ISO date string for N months ago
 */
export function getDateMonthsAgo(monthsAgo: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() - monthsAgo);
  return date.toISOString();
}

/**
 * Generate past activities for the given habits over the specified number of days
 * Creates realistic completion records with varying completion rates
 * Simulates several months of usage (90 days)
 *
 * @param habits - Array of habits to generate activities for
 * @param days - Number of days to generate activities for (default: 90)
 * @returns Array of Activity records
 */
export function generatePastActivities(habits: Habit[], days: number = 90): Activity[] {
  const activities: Activity[] = [];
  let activityId = 1;

  // Completion rates for each habit (to create realistic variation)
  // Rates improve over time to show user progress
  const completionRates: Record<string, { base: number; growth: number }> = {
    'demo-habit-1': { base: 0.6, growth: 0.003 },  // 朝の運動 - starts at 60%, improves
    'demo-habit-2': { base: 0.5, growth: 0.004 },  // 読書 - starts at 50%, improves faster
    'demo-habit-3': { base: 0.7, growth: 0.002 },  // 瞑想 - starts at 70%, steady
    'demo-habit-4': { base: 0.4, growth: 0.005 },  // 英語学習 - starts at 40%, improves most
    'demo-habit-5': { base: 0.8, growth: 0.001 },  // 水を飲む - starts at 80%, already good
  };

  // Partial progress for today (to show progress bar animation when completing)
  const todayPartialProgress: Record<string, number> = {
    'demo-habit-1': 0,   // 朝の運動: 0/1 (0%) - not started
    'demo-habit-2': 15,  // 読書: 15/30分 (50%) - halfway done
    'demo-habit-3': 7,   // 瞑想: 7/10分 (70%) - almost done
    'demo-habit-4': 10,  // 英語学習: 10/20分 (50%) - halfway
    'demo-habit-5': 5,   // 水を飲む: 5/8杯 (62.5%) - good progress
  };

  for (let daysAgo = days - 1; daysAgo >= 0; daysAgo--) {
    for (const habit of habits) {
      const rateConfig = completionRates[habit.id] ?? { base: 0.75, growth: 0 };
      // Completion rate improves over time (older days have lower rate)
      const dayProgress = (days - daysAgo) / days;
      const completionRate = Math.min(rateConfig.base + (dayProgress * rateConfig.growth * days), 0.95);
      
      // For today (daysAgo === 0), use partial progress
      if (daysAgo === 0) {
        const partialAmount = todayPartialProgress[habit.id] ?? 0;
        
        if (partialAmount > 0) {
          const startTime = habit.time || '09:00';
          activities.push({
            id: `demo-activity-${activityId++}`,
            kind: 'start',
            habitId: habit.id,
            habitName: habit.name,
            timestamp: getTimestamp(daysAgo, startTime),
            prevCount: 0,
            newCount: 0,
          });

          const currentTime = new Date();
          const partialEndTime = `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`;
          activities.push({
            id: `demo-activity-${activityId++}`,
            kind: 'complete',
            habitId: habit.id,
            habitName: habit.name,
            timestamp: getTimestamp(daysAgo, partialEndTime),
            amount: partialAmount,
            prevCount: 0,
            newCount: partialAmount,
          });
        }
      } else {
        // For past days, use random completion based on rate
        const shouldComplete = Math.random() < completionRate;

        if (shouldComplete) {
          const startTime = habit.time || '09:00';
          activities.push({
            id: `demo-activity-${activityId++}`,
            kind: 'start',
            habitId: habit.id,
            habitName: habit.name,
            timestamp: getTimestamp(daysAgo, startTime),
            prevCount: 0,
            newCount: 0,
          });

          const endTime = habit.endTime || '09:30';
          const amount = habit.must || 1;
          activities.push({
            id: `demo-activity-${activityId++}`,
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
  }

  return activities;
}

// ============================================================================
// Demo Goals - Hierarchical Structure
// ============================================================================

/**
 * Sample goals with Japanese names and parent-child relationships
 * Creates a tree structure for Statistics section visualization
 * 
 * Structure:
 * - 健康的な生活 (Parent)
 *   - 体力向上 (Child)
 *   - メンタルヘルス (Child)
 * - キャリア発展 (Parent)
 *   - スキルアップ (Child)
 *   - 語学力向上 (Child)
 */
export const demoGoals: Goal[] = [
  // Parent Goal 1: 健康的な生活
  {
    id: 'demo-goal-1',
    name: '健康的な生活',
    details: '心身ともに健康な状態を維持し、エネルギッシュな毎日を送る。運動、食事、睡眠のバランスを整える。',
    dueDate: null,
    parentId: null,
    isCompleted: false,
    createdAt: getDateMonthsAgo(4),
    updatedAt: getDateMonthsAgo(1),
  },
  // Child Goal 1-1: 体力向上
  {
    id: 'demo-goal-1-1',
    name: '体力向上',
    details: '毎日の運動習慣を身につけ、基礎体力を向上させる。週5日以上の運動を目標とする。',
    dueDate: null,
    parentId: 'demo-goal-1',
    isCompleted: false,
    createdAt: getDateMonthsAgo(4),
    updatedAt: getDateMonthsAgo(1),
  },
  // Child Goal 1-2: メンタルヘルス
  {
    id: 'demo-goal-1-2',
    name: 'メンタルヘルス',
    details: '瞑想や十分な水分摂取で心の健康を保つ。ストレス管理と集中力向上を目指す。',
    dueDate: null,
    parentId: 'demo-goal-1',
    isCompleted: false,
    createdAt: getDateMonthsAgo(3),
    updatedAt: getDateMonthsAgo(1),
  },
  // Parent Goal 2: キャリア発展
  {
    id: 'demo-goal-2',
    name: 'キャリア発展',
    details: '専門性を高め、キャリアの幅を広げる。継続的な学習と実践を通じて成長する。',
    dueDate: null,
    parentId: null,
    isCompleted: false,
    createdAt: getDateMonthsAgo(3),
    updatedAt: getDateMonthsAgo(1),
  },
  // Child Goal 2-1: スキルアップ
  {
    id: 'demo-goal-2-1',
    name: 'スキルアップ',
    details: '読書や学習を通じて知識を深め、専門性を高める。月に2冊以上の本を読む。',
    dueDate: null,
    parentId: 'demo-goal-2',
    isCompleted: false,
    createdAt: getDateMonthsAgo(3),
    updatedAt: getDateMonthsAgo(1),
  },
  // Child Goal 2-2: 語学力向上
  {
    id: 'demo-goal-2-2',
    name: '語学力向上',
    details: '英語力を向上させ、グローバルなコミュニケーション能力を身につける。',
    dueDate: null,
    parentId: 'demo-goal-2',
    isCompleted: false,
    createdAt: getDateMonthsAgo(2),
    updatedAt: getDateMonthsAgo(1),
  },
];

// ============================================================================
// Demo Habits
// ============================================================================

/**
 * Sample habits with Japanese names and realistic timing data
 * Each habit is linked to a child goal for proper hierarchy display
 */
export const demoHabits: Habit[] = [
  // Habit linked to 体力向上 (demo-goal-1-1)
  {
    id: 'demo-habit-1',
    goalId: 'demo-goal-1-1',
    name: '朝の運動',
    active: true,
    type: 'do',
    count: 0,
    must: 1,
    completed: false,
    dueDate: getTodayString(),
    time: '07:00',
    endTime: '07:30',
    repeat: 'Daily',
    workloadUnit: '回',
    workloadTotal: 1,
    workloadPerCount: 1,
    timings: [{ type: 'Daily', start: '07:00', end: '07:30' } as Timing],
    createdAt: getDateMonthsAgo(4),
    updatedAt: getDateMonthsAgo(1),
  },
  // Habit linked to スキルアップ (demo-goal-2-1)
  {
    id: 'demo-habit-2',
    goalId: 'demo-goal-2-1',
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
    createdAt: getDateMonthsAgo(3),
    updatedAt: getDateMonthsAgo(1),
  },
  // Habit linked to メンタルヘルス (demo-goal-1-2)
  {
    id: 'demo-habit-3',
    goalId: 'demo-goal-1-2',
    name: '瞑想',
    active: true,
    type: 'do',
    count: 0,
    must: 10,
    completed: false,
    dueDate: getTodayString(),
    time: '06:30',
    endTime: '06:40',
    repeat: 'Daily',
    workloadUnit: '分',
    workloadTotal: 10,
    workloadPerCount: 10,
    timings: [{ type: 'Daily', start: '06:30', end: '06:40' } as Timing],
    createdAt: getDateMonthsAgo(3),
    updatedAt: getDateMonthsAgo(1),
  },
  // Habit linked to 語学力向上 (demo-goal-2-2)
  {
    id: 'demo-habit-4',
    goalId: 'demo-goal-2-2',
    name: '英語学習',
    active: true,
    type: 'do',
    count: 0,
    must: 20,
    completed: false,
    dueDate: getTodayString(),
    time: '12:00',
    endTime: '12:20',
    repeat: 'Daily',
    workloadUnit: '分',
    workloadTotal: 20,
    workloadPerCount: 20,
    timings: [{ type: 'Daily', start: '12:00', end: '12:20' } as Timing],
    createdAt: getDateMonthsAgo(2),
    updatedAt: getDateMonthsAgo(1),
  },
  // Habit linked to メンタルヘルス (demo-goal-1-2)
  {
    id: 'demo-habit-5',
    goalId: 'demo-goal-1-2',
    name: '水を飲む',
    active: true,
    type: 'do',
    count: 0,
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
    createdAt: getDateMonthsAgo(2),
    updatedAt: getDateMonthsAgo(1),
  },
];

// ============================================================================
// Demo Activities
// ============================================================================

/**
 * Sample activities representing completion records for the past 90 days
 * Simulates several months of app usage
 */
export const demoActivities: Activity[] = generatePastActivities(demoHabits, 90);

// ============================================================================
// Demo Stickies
// ============================================================================

/**
 * Sample stickies with Japanese content
 */
export const demoStickies: Sticky[] = [
  {
    id: 'demo-sticky-1',
    name: '買い物リスト',
    description: '牛乳、パン、卵、野菜、果物',
    completed: false,
    displayOrder: 0,
    createdAt: getDateMonthsAgo(1),
    updatedAt: getTodayString(),
  },
  {
    id: 'demo-sticky-2',
    name: 'ミーティング準備',
    description: '資料を確認、アジェンダ作成、質問リスト',
    completed: false,
    displayOrder: 1,
    createdAt: getDateMonthsAgo(1),
    updatedAt: getTodayString(),
  },
  {
    id: 'demo-sticky-3',
    name: '今週の目標',
    description: '運動5日達成、本1冊読了、英語20分×5日',
    completed: false,
    displayOrder: 2,
    createdAt: getDateStringDaysAgo(3),
    updatedAt: getTodayString(),
  },
];

// ============================================================================
// Export All Demo Data
// ============================================================================

export const demoData = {
  goals: demoGoals,
  habits: demoHabits,
  activities: demoActivities,
  stickies: demoStickies,
};

export default demoData;
