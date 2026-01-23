/**
 * Habit and Activity Schemas
 *
 * Zod schemas for habits, activities, and progress tracking.
 *
 * Requirements: 9.3
 */
import { z } from 'zod';
// ============================================================================
// Habit Schemas
// ============================================================================
/**
 * Schema for habit data from database.
 */
export const habitSchema = z.object({
    id: z.string().uuid(),
    owner_type: z.string().default('user'),
    owner_id: z.string().uuid(),
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    goal_id: z.string().uuid().nullable().optional(),
    active: z.boolean().default(true),
    frequency: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
    target_count: z.number().int().positive().default(1),
    workload_unit: z.string().nullable().optional(),
    workload_per_count: z.number().positive().default(1),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime().nullable().optional(),
});
/**
 * Schema for creating a new habit.
 */
export const habitCreateSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    goal_id: z.string().uuid().optional(),
    frequency: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
    target_count: z.number().int().positive().default(1),
    workload_unit: z.string().max(50).optional(),
    workload_per_count: z.number().positive().default(1),
});
/**
 * Schema for updating a habit.
 */
export const habitUpdateSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).nullable().optional(),
    goal_id: z.string().uuid().nullable().optional(),
    active: z.boolean().optional(),
    frequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
    target_count: z.number().int().positive().optional(),
    workload_unit: z.string().max(50).nullable().optional(),
    workload_per_count: z.number().positive().optional(),
});
// ============================================================================
// Activity Schemas
// ============================================================================
/**
 * Schema for activity data from database.
 */
export const activitySchema = z.object({
    id: z.string().uuid(),
    owner_type: z.string().default('user'),
    owner_id: z.string().uuid(),
    habit_id: z.string().uuid(),
    habit_name: z.string().nullable().optional(),
    kind: z.enum(['complete', 'skip', 'partial']).default('complete'),
    timestamp: z.string().datetime(),
    amount: z.number().positive().default(1),
    memo: z.string().nullable().optional(),
    created_at: z.string().datetime().optional(),
});
/**
 * Schema for creating a new activity.
 */
export const activityCreateSchema = z.object({
    habit_id: z.string().uuid(),
    habit_name: z.string().optional(),
    kind: z.enum(['complete', 'skip', 'partial']).default('complete'),
    timestamp: z.string().datetime().optional(),
    amount: z.number().positive().default(1),
    memo: z.string().max(500).optional(),
});
// ============================================================================
// Progress Schemas
// ============================================================================
/**
 * Schema for habit progress data.
 */
export const habitProgressSchema = z.object({
    habit_id: z.string().uuid(),
    habit_name: z.string(),
    goal_id: z.string().uuid().nullable().optional(),
    goal_name: z.string().nullable().optional(),
    target_count: z.number().int().positive(),
    current_count: z.number().int().min(0),
    workload_unit: z.string().nullable().optional(),
    workload_per_count: z.number().positive(),
    total_workload: z.number().min(0),
    target_workload: z.number().positive(),
    completed: z.boolean(),
    streak: z.number().int().min(0),
});
/**
 * Schema for daily progress summary.
 */
export const dailyProgressSummarySchema = z.object({
    date: z.string(), // YYYY-MM-DD format
    total_habits: z.number().int().min(0),
    completed_habits: z.number().int().min(0),
    completion_rate: z.number().min(0).max(100),
    habits: z.array(habitProgressSchema),
});
/**
 * Schema for dashboard summary.
 */
export const dashboardSummarySchema = z.object({
    total_habits: z.number().int().min(0),
    completed_habits: z.number().int().min(0),
    completion_rate: z.number().min(0).max(100),
    date_display: z.string(),
});
// ============================================================================
// Goal Schemas
// ============================================================================
/**
 * Schema for goal data from database.
 */
export const goalSchema = z.object({
    id: z.string().uuid(),
    owner_type: z.string().default('user'),
    owner_id: z.string().uuid(),
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    parent_id: z.string().uuid().nullable().optional(),
    status: z.enum(['active', 'completed', 'archived']).default('active'),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime().nullable().optional(),
});
/**
 * Schema for creating a new goal.
 */
export const goalCreateSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    parent_id: z.string().uuid().optional(),
});
/**
 * Schema for updating a goal.
 */
export const goalUpdateSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).nullable().optional(),
    parent_id: z.string().uuid().nullable().optional(),
    status: z.enum(['active', 'completed', 'archived']).optional(),
});
//# sourceMappingURL=habit.js.map