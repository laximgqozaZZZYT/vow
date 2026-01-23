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
/**
 * Schema for a single habit's progress data.
 * Requirements: 7.3 - DailyProgressData schema with all required fields
 */
export declare const dailyProgressItemSchema: z.ZodObject<{
    /** Unique identifier for the habit */
    habitId: z.ZodString;
    /** Display name of the habit */
    habitName: z.ZodString;
    /** Name of the associated goal */
    goalName: z.ZodString;
    /** Sum of today's activity amounts */
    currentCount: z.ZodNumber;
    /** Target count (workloadTotal or must field) */
    totalCount: z.ZodNumber;
    /** Percentage of progress (currentCount / totalCount) * 100 */
    progressRate: z.ZodNumber;
    /** Unit of measurement (e.g., "回", "分", "ページ") */
    workloadUnit: z.ZodNullable<z.ZodString>;
    /** Amount added per increment (default: 1) */
    workloadPerCount: z.ZodNumber;
    /** Current streak count in days */
    streak: z.ZodNumber;
    /** True if progressRate >= 100 */
    completed: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    completed: boolean;
    streak: number;
    habitId: string;
    habitName: string;
    goalName: string;
    currentCount: number;
    totalCount: number;
    progressRate: number;
    workloadUnit: string | null;
    workloadPerCount: number;
}, {
    completed: boolean;
    streak: number;
    habitId: string;
    habitName: string;
    goalName: string;
    currentCount: number;
    totalCount: number;
    progressRate: number;
    workloadUnit: string | null;
    workloadPerCount: number;
}>;
export type DailyProgressItem = z.infer<typeof dailyProgressItemSchema>;
/**
 * Schema for the full daily progress response.
 * Requirements: 7.3 - DailyProgressData schema with all required fields
 */
export declare const dailyProgressDataSchema: z.ZodObject<{
    /** Date in YYYY-MM-DD format */
    date: z.ZodString;
    /** Formatted date string (e.g., "2026年1月20日（月）") */
    dateDisplay: z.ZodString;
    /** Total number of active habits */
    totalHabits: z.ZodNumber;
    /** Number of habits with progressRate >= 100 */
    completedHabits: z.ZodNumber;
    /** Percentage of completed habits (0-100) */
    completionRate: z.ZodNumber;
    /** List of habit progress items */
    habits: z.ZodArray<z.ZodObject<{
        /** Unique identifier for the habit */
        habitId: z.ZodString;
        /** Display name of the habit */
        habitName: z.ZodString;
        /** Name of the associated goal */
        goalName: z.ZodString;
        /** Sum of today's activity amounts */
        currentCount: z.ZodNumber;
        /** Target count (workloadTotal or must field) */
        totalCount: z.ZodNumber;
        /** Percentage of progress (currentCount / totalCount) * 100 */
        progressRate: z.ZodNumber;
        /** Unit of measurement (e.g., "回", "分", "ページ") */
        workloadUnit: z.ZodNullable<z.ZodString>;
        /** Amount added per increment (default: 1) */
        workloadPerCount: z.ZodNumber;
        /** Current streak count in days */
        streak: z.ZodNumber;
        /** True if progressRate >= 100 */
        completed: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        completed: boolean;
        streak: number;
        habitId: string;
        habitName: string;
        goalName: string;
        currentCount: number;
        totalCount: number;
        progressRate: number;
        workloadUnit: string | null;
        workloadPerCount: number;
    }, {
        completed: boolean;
        streak: number;
        habitId: string;
        habitName: string;
        goalName: string;
        currentCount: number;
        totalCount: number;
        progressRate: number;
        workloadUnit: string | null;
        workloadPerCount: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    date: string;
    habits: {
        completed: boolean;
        streak: number;
        habitId: string;
        habitName: string;
        goalName: string;
        currentCount: number;
        totalCount: number;
        progressRate: number;
        workloadUnit: string | null;
        workloadPerCount: number;
    }[];
    dateDisplay: string;
    totalHabits: number;
    completedHabits: number;
    completionRate: number;
}, {
    date: string;
    habits: {
        completed: boolean;
        streak: number;
        habitId: string;
        habitName: string;
        goalName: string;
        currentCount: number;
        totalCount: number;
        progressRate: number;
        workloadUnit: string | null;
        workloadPerCount: number;
    }[];
    dateDisplay: string;
    totalHabits: number;
    completedHabits: number;
    completionRate: number;
}>;
export type DailyProgressData = z.infer<typeof dailyProgressDataSchema>;
/**
 * Schema for TOP3 habit item.
 */
export declare const top3HabitSchema: z.ZodObject<{
    /** Unique identifier for the habit */
    habitId: z.ZodString;
    /** Display name of the habit */
    habitName: z.ZodString;
    /** Progress rate (0-100+) */
    progressRate: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    habitId: string;
    habitName: string;
    progressRate: number;
}, {
    habitId: string;
    habitName: string;
    progressRate: number;
}>;
export type Top3Habit = z.infer<typeof top3HabitSchema>;
/**
 * Schema for statistics summary data.
 * Requirements: 7.4 - StatisticsData schema with all required fields
 */
export declare const statisticsDataSchema: z.ZodObject<{
    /** Total number of active habits */
    totalActiveHabits: z.ZodNumber;
    /** Today's achievement rate (0-100) */
    todayAchievementRate: z.ZodNumber;
    /** Number of habits achieved today */
    todayAchieved: z.ZodNumber;
    /** Total habits counted for today */
    todayTotal: z.ZodNumber;
    /** Cumulative achievement rate (0-100) */
    cumulativeAchievementRate: z.ZodNumber;
    /** Number of habits achieved cumulatively */
    cumulativeAchieved: z.ZodNumber;
    /** Total habits counted cumulatively */
    cumulativeTotal: z.ZodNumber;
    /** TOP3 habits by progress rate */
    top3Habits: z.ZodArray<z.ZodObject<{
        /** Unique identifier for the habit */
        habitId: z.ZodString;
        /** Display name of the habit */
        habitName: z.ZodString;
        /** Progress rate (0-100+) */
        progressRate: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        habitId: string;
        habitName: string;
        progressRate: number;
    }, {
        habitId: string;
        habitName: string;
        progressRate: number;
    }>, "many">;
    /** Formatted date string */
    dateDisplay: z.ZodString;
}, "strip", z.ZodTypeAny, {
    dateDisplay: string;
    totalActiveHabits: number;
    todayAchievementRate: number;
    todayAchieved: number;
    todayTotal: number;
    cumulativeAchievementRate: number;
    cumulativeAchieved: number;
    cumulativeTotal: number;
    top3Habits: {
        habitId: string;
        habitName: string;
        progressRate: number;
    }[];
}, {
    dateDisplay: string;
    totalActiveHabits: number;
    todayAchievementRate: number;
    todayAchieved: number;
    todayTotal: number;
    cumulativeAchievementRate: number;
    cumulativeAchieved: number;
    cumulativeTotal: number;
    top3Habits: {
        habitId: string;
        habitName: string;
        progressRate: number;
    }[];
}>;
export type StatisticsData = z.infer<typeof statisticsDataSchema>;
/**
 * Schema for a single upcoming habit item.
 * Requirements: 7.5 - NextHabitsData schema with all required fields
 */
export declare const nextHabitItemSchema: z.ZodObject<{
    /** Unique identifier for the habit */
    habitId: z.ZodString;
    /** Display name of the habit */
    habitName: z.ZodString;
    /** Scheduled start time in ISO format */
    startTime: z.ZodString;
    /** Formatted start time (e.g., "14:30" or "明日 09:00") */
    startTimeDisplay: z.ZodString;
    /** Unit of measurement */
    workloadUnit: z.ZodNullable<z.ZodString>;
    /** Target amount per completion */
    targetAmount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    habitId: string;
    habitName: string;
    workloadUnit: string | null;
    startTime: string;
    startTimeDisplay: string;
    targetAmount: number;
}, {
    habitId: string;
    habitName: string;
    workloadUnit: string | null;
    startTime: string;
    startTimeDisplay: string;
    targetAmount: number;
}>;
export type NextHabitItem = z.infer<typeof nextHabitItemSchema>;
/**
 * Schema for the next habits response.
 * Requirements: 7.5 - NextHabitsData schema with all required fields
 */
export declare const nextHabitsDataSchema: z.ZodObject<{
    /** List of upcoming habit items */
    habits: z.ZodArray<z.ZodObject<{
        /** Unique identifier for the habit */
        habitId: z.ZodString;
        /** Display name of the habit */
        habitName: z.ZodString;
        /** Scheduled start time in ISO format */
        startTime: z.ZodString;
        /** Formatted start time (e.g., "14:30" or "明日 09:00") */
        startTimeDisplay: z.ZodString;
        /** Unit of measurement */
        workloadUnit: z.ZodNullable<z.ZodString>;
        /** Target amount per completion */
        targetAmount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        habitId: string;
        habitName: string;
        workloadUnit: string | null;
        startTime: string;
        startTimeDisplay: string;
        targetAmount: number;
    }, {
        habitId: string;
        habitName: string;
        workloadUnit: string | null;
        startTime: string;
        startTimeDisplay: string;
        targetAmount: number;
    }>, "many">;
    /** Total count of upcoming habits */
    count: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    habits: {
        habitId: string;
        habitName: string;
        workloadUnit: string | null;
        startTime: string;
        startTimeDisplay: string;
        targetAmount: number;
    }[];
    count: number;
}, {
    habits: {
        habitId: string;
        habitName: string;
        workloadUnit: string | null;
        startTime: string;
        startTimeDisplay: string;
        targetAmount: number;
    }[];
    count: number;
}>;
export type NextHabitsData = z.infer<typeof nextHabitsDataSchema>;
/**
 * Schema for a single sticky item.
 * Requirements: 7.6 - StickiesData schema with all required fields
 */
export declare const stickyItemSchema: z.ZodObject<{
    /** Unique identifier for the sticky */
    id: z.ZodString;
    /** Display name of the sticky */
    name: z.ZodString;
    /** Optional description */
    description: z.ZodNullable<z.ZodString>;
    /** Completion status */
    completed: z.ZodBoolean;
    /** Display order */
    displayOrder: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    description: string | null;
    completed: boolean;
    displayOrder: number;
}, {
    id: string;
    name: string;
    description: string | null;
    completed: boolean;
    displayOrder: number;
}>;
export type StickyItem = z.infer<typeof stickyItemSchema>;
/**
 * Schema for the stickies response.
 * Requirements: 7.6 - StickiesData schema with all required fields
 */
export declare const stickiesDataSchema: z.ZodObject<{
    /** List of sticky items */
    stickies: z.ZodArray<z.ZodObject<{
        /** Unique identifier for the sticky */
        id: z.ZodString;
        /** Display name of the sticky */
        name: z.ZodString;
        /** Optional description */
        description: z.ZodNullable<z.ZodString>;
        /** Completion status */
        completed: z.ZodBoolean;
        /** Display order */
        displayOrder: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        description: string | null;
        completed: boolean;
        displayOrder: number;
    }, {
        id: string;
        name: string;
        description: string | null;
        completed: boolean;
        displayOrder: number;
    }>, "many">;
    /** Count of incomplete stickies */
    incompleteCount: z.ZodNumber;
    /** Count of completed stickies */
    completedCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    stickies: {
        id: string;
        name: string;
        description: string | null;
        completed: boolean;
        displayOrder: number;
    }[];
    incompleteCount: number;
    completedCount: number;
}, {
    stickies: {
        id: string;
        name: string;
        description: string | null;
        completed: boolean;
        displayOrder: number;
    }[];
    incompleteCount: number;
    completedCount: number;
}>;
export type StickiesData = z.infer<typeof stickiesDataSchema>;
/**
 * Schema for sticky data from database.
 */
export declare const stickyDbSchema: z.ZodObject<{
    id: z.ZodString;
    owner_type: z.ZodDefault<z.ZodString>;
    owner_id: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    completed: z.ZodDefault<z.ZodBoolean>;
    completed_at: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    display_order: z.ZodDefault<z.ZodNumber>;
    created_at: z.ZodString;
    updated_at: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    created_at: string;
    id: string;
    name: string;
    owner_type: string;
    owner_id: string;
    completed: boolean;
    display_order: number;
    description?: string | null | undefined;
    updated_at?: string | null | undefined;
    completed_at?: string | null | undefined;
}, {
    created_at: string;
    id: string;
    name: string;
    owner_id: string;
    owner_type?: string | undefined;
    description?: string | null | undefined;
    updated_at?: string | null | undefined;
    completed?: boolean | undefined;
    completed_at?: string | null | undefined;
    display_order?: number | undefined;
}>;
export type StickyDb = z.infer<typeof stickyDbSchema>;
//# sourceMappingURL=dashboard.d.ts.map