/**
 * Dashboard Data Schemas
 *
 * Zod schemas for dashboard section data used by DashboardDataService.
 * These schemas define platform-agnostic data structures that can be
 * consumed by various integrations (Slack, LINE, Discord, etc.).
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */

import { z } from 'zod';

// ============================================================================
// Daily Progress Schemas
// ============================================================================

/**
 * Schema for a single habit's progress data.
 * Requirements: 7.3 - DailyProgressData schema with all required fields
 */
export const dailyProgressItemSchema = z.object({
  /** Unique identifier for the habit */
  habitId: z.string(),
  /** Display name of the habit */
  habitName: z.string(),
  /** Name of the associated goal */
  goalName: z.string(),
  /** Sum of today's activity amounts */
  currentCount: z.number().min(0),
  /** Target count (workloadTotal or must field) */
  totalCount: z.number().positive(),
  /** Percentage of progress (currentCount / totalCount) * 100 */
  progressRate: z.number().min(0),
  /** Unit of measurement (e.g., "回", "分", "ページ") */
  workloadUnit: z.string().nullable(),
  /** Amount added per increment (default: 1) */
  workloadPerCount: z.number().positive(),
  /** Current streak count in days */
  streak: z.number().int().min(0),
  /** True if progressRate >= 100 */
  completed: z.boolean(),
});

export type DailyProgressItem = z.infer<typeof dailyProgressItemSchema>;

/**
 * Schema for the full daily progress response.
 * Requirements: 7.3 - DailyProgressData schema with all required fields
 */
export const dailyProgressDataSchema = z.object({
  /** Date in YYYY-MM-DD format */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Formatted date string (e.g., "2026年1月20日（月）") */
  dateDisplay: z.string(),
  /** Total number of active habits */
  totalHabits: z.number().int().min(0),
  /** Number of habits with progressRate >= 100 */
  completedHabits: z.number().int().min(0),
  /** Percentage of completed habits (0-100) */
  completionRate: z.number().min(0).max(100),
  /** List of habit progress items */
  habits: z.array(dailyProgressItemSchema),
});

export type DailyProgressData = z.infer<typeof dailyProgressDataSchema>;

// ============================================================================
// Statistics Schemas
// ============================================================================

/**
 * Schema for TOP3 habit item.
 */
export const top3HabitSchema = z.object({
  /** Unique identifier for the habit */
  habitId: z.string(),
  /** Display name of the habit */
  habitName: z.string(),
  /** Progress rate (0-100+) */
  progressRate: z.number().min(0),
});

export type Top3Habit = z.infer<typeof top3HabitSchema>;

/**
 * Schema for statistics summary data.
 * Requirements: 7.4 - StatisticsData schema with all required fields
 */
export const statisticsDataSchema = z.object({
  /** Total number of active habits */
  totalActiveHabits: z.number().int().min(0),
  /** Today's achievement rate (0-100) */
  todayAchievementRate: z.number().min(0).max(100),
  /** Number of habits achieved today */
  todayAchieved: z.number().int().min(0),
  /** Total habits counted for today */
  todayTotal: z.number().int().min(0),
  /** Cumulative achievement rate (0-100) */
  cumulativeAchievementRate: z.number().min(0).max(100),
  /** Number of habits achieved cumulatively */
  cumulativeAchieved: z.number().int().min(0),
  /** Total habits counted cumulatively */
  cumulativeTotal: z.number().int().min(0),
  /** TOP3 habits by progress rate */
  top3Habits: z.array(top3HabitSchema).max(3),
  /** Formatted date string */
  dateDisplay: z.string(),
});

export type StatisticsData = z.infer<typeof statisticsDataSchema>;

// ============================================================================
// Next Habits Schemas
// ============================================================================

/**
 * Schema for a single upcoming habit item.
 * Requirements: 7.5 - NextHabitsData schema with all required fields
 */
export const nextHabitItemSchema = z.object({
  /** Unique identifier for the habit */
  habitId: z.string(),
  /** Display name of the habit */
  habitName: z.string(),
  /** Scheduled start time in ISO format */
  startTime: z.string(),
  /** Formatted start time (e.g., "14:30" or "明日 09:00") */
  startTimeDisplay: z.string(),
  /** Unit of measurement */
  workloadUnit: z.string().nullable(),
  /** Target amount per completion */
  targetAmount: z.number().positive(),
});

export type NextHabitItem = z.infer<typeof nextHabitItemSchema>;

/**
 * Schema for the next habits response.
 * Requirements: 7.5 - NextHabitsData schema with all required fields
 */
export const nextHabitsDataSchema = z.object({
  /** List of upcoming habit items */
  habits: z.array(nextHabitItemSchema),
  /** Total count of upcoming habits */
  count: z.number().int().min(0),
});

export type NextHabitsData = z.infer<typeof nextHabitsDataSchema>;

// ============================================================================
// Stickies Schemas
// ============================================================================

/**
 * Schema for a single sticky item.
 * Requirements: 7.6 - StickiesData schema with all required fields
 */
export const stickyItemSchema = z.object({
  /** Unique identifier for the sticky */
  id: z.string(),
  /** Display name of the sticky */
  name: z.string(),
  /** Optional description */
  description: z.string().nullable(),
  /** Completion status */
  completed: z.boolean(),
  /** Display order */
  displayOrder: z.number().int(),
});

export type StickyItem = z.infer<typeof stickyItemSchema>;

/**
 * Schema for the stickies response.
 * Requirements: 7.6 - StickiesData schema with all required fields
 */
export const stickiesDataSchema = z.object({
  /** List of sticky items */
  stickies: z.array(stickyItemSchema),
  /** Count of incomplete stickies */
  incompleteCount: z.number().int().min(0),
  /** Count of completed stickies */
  completedCount: z.number().int().min(0),
});

export type StickiesData = z.infer<typeof stickiesDataSchema>;

// ============================================================================
// Sticky Database Schema
// ============================================================================

/**
 * Schema for sticky data from database.
 */
export const stickyDbSchema = z.object({
  id: z.string().uuid(),
  owner_type: z.string().default('user'),
  owner_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable().optional(),
  completed: z.boolean().default(false),
  completed_at: z.string().datetime().nullable().optional(),
  display_order: z.number().int().default(0),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullable().optional(),
});

export type StickyDb = z.infer<typeof stickyDbSchema>;
