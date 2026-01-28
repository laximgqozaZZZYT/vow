/**
 * Habit and Activity Schemas
 *
 * Zod schemas for habits, activities, and progress tracking.
 *
 * Requirements: 9.3
 */
import { z } from 'zod';
/**
 * Schema for habit data from database.
 */
export declare const habitSchema: z.ZodObject<{
    id: z.ZodString;
    owner_type: z.ZodDefault<z.ZodString>;
    owner_id: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    goal_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    active: z.ZodDefault<z.ZodBoolean>;
    frequency: z.ZodDefault<z.ZodEnum<["daily", "weekly", "monthly"]>>;
    target_count: z.ZodDefault<z.ZodNumber>;
    workload_unit: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    workload_per_count: z.ZodDefault<z.ZodNumber>;
    level: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    level_tier: z.ZodOptional<z.ZodNullable<z.ZodEnum<["beginner", "intermediate", "advanced", "expert"]>>>;
    level_assessment_data: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    level_last_assessed_at: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    domain_codes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    created_at: z.ZodString;
    updated_at: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    created_at: string;
    id: string;
    name: string;
    owner_type: string;
    owner_id: string;
    active: boolean;
    frequency: "daily" | "weekly" | "monthly";
    target_count: number;
    workload_per_count: number;
    domain_codes: string[];
    description?: string | null | undefined;
    goal_id?: string | null | undefined;
    workload_unit?: string | null | undefined;
    level?: number | null | undefined;
    level_tier?: "beginner" | "intermediate" | "advanced" | "expert" | null | undefined;
    level_assessment_data?: Record<string, unknown> | null | undefined;
    level_last_assessed_at?: string | null | undefined;
    updated_at?: string | null | undefined;
}, {
    created_at: string;
    id: string;
    name: string;
    owner_id: string;
    owner_type?: string | undefined;
    description?: string | null | undefined;
    goal_id?: string | null | undefined;
    active?: boolean | undefined;
    frequency?: "daily" | "weekly" | "monthly" | undefined;
    target_count?: number | undefined;
    workload_unit?: string | null | undefined;
    workload_per_count?: number | undefined;
    level?: number | null | undefined;
    level_tier?: "beginner" | "intermediate" | "advanced" | "expert" | null | undefined;
    level_assessment_data?: Record<string, unknown> | null | undefined;
    level_last_assessed_at?: string | null | undefined;
    domain_codes?: string[] | undefined;
    updated_at?: string | null | undefined;
}>;
export type Habit = z.infer<typeof habitSchema>;
/**
 * Schema for creating a new habit.
 */
export declare const habitCreateSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    goal_id: z.ZodOptional<z.ZodString>;
    frequency: z.ZodDefault<z.ZodEnum<["daily", "weekly", "monthly"]>>;
    target_count: z.ZodDefault<z.ZodNumber>;
    workload_unit: z.ZodOptional<z.ZodString>;
    workload_per_count: z.ZodDefault<z.ZodNumber>;
    domain_codes: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString, "many">>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    frequency: "daily" | "weekly" | "monthly";
    target_count: number;
    workload_per_count: number;
    description?: string | undefined;
    goal_id?: string | undefined;
    workload_unit?: string | undefined;
    domain_codes?: string[] | undefined;
}, {
    name: string;
    description?: string | undefined;
    goal_id?: string | undefined;
    frequency?: "daily" | "weekly" | "monthly" | undefined;
    target_count?: number | undefined;
    workload_unit?: string | undefined;
    workload_per_count?: number | undefined;
    domain_codes?: string[] | undefined;
}>;
export type HabitCreate = z.infer<typeof habitCreateSchema>;
/**
 * Schema for updating a habit.
 */
export declare const habitUpdateSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    goal_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    active: z.ZodOptional<z.ZodBoolean>;
    frequency: z.ZodOptional<z.ZodEnum<["daily", "weekly", "monthly"]>>;
    target_count: z.ZodOptional<z.ZodNumber>;
    workload_unit: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    workload_per_count: z.ZodOptional<z.ZodNumber>;
    domain_codes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | null | undefined;
    goal_id?: string | null | undefined;
    active?: boolean | undefined;
    frequency?: "daily" | "weekly" | "monthly" | undefined;
    target_count?: number | undefined;
    workload_unit?: string | null | undefined;
    workload_per_count?: number | undefined;
    domain_codes?: string[] | undefined;
}, {
    name?: string | undefined;
    description?: string | null | undefined;
    goal_id?: string | null | undefined;
    active?: boolean | undefined;
    frequency?: "daily" | "weekly" | "monthly" | undefined;
    target_count?: number | undefined;
    workload_unit?: string | null | undefined;
    workload_per_count?: number | undefined;
    domain_codes?: string[] | undefined;
}>;
export type HabitUpdate = z.infer<typeof habitUpdateSchema>;
/**
 * Schema for activity data from database.
 */
export declare const activitySchema: z.ZodObject<{
    id: z.ZodString;
    owner_type: z.ZodDefault<z.ZodString>;
    owner_id: z.ZodString;
    habit_id: z.ZodString;
    habit_name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    kind: z.ZodDefault<z.ZodEnum<["complete", "skip", "partial"]>>;
    timestamp: z.ZodString;
    amount: z.ZodDefault<z.ZodNumber>;
    memo: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    created_at: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    timestamp: string;
    owner_type: string;
    owner_id: string;
    habit_id: string;
    kind: "complete" | "skip" | "partial";
    amount: number;
    created_at?: string | undefined;
    habit_name?: string | null | undefined;
    memo?: string | null | undefined;
}, {
    id: string;
    timestamp: string;
    owner_id: string;
    habit_id: string;
    created_at?: string | undefined;
    owner_type?: string | undefined;
    habit_name?: string | null | undefined;
    kind?: "complete" | "skip" | "partial" | undefined;
    amount?: number | undefined;
    memo?: string | null | undefined;
}>;
export type Activity = z.infer<typeof activitySchema>;
/**
 * Schema for creating a new activity.
 */
export declare const activityCreateSchema: z.ZodObject<{
    habit_id: z.ZodString;
    habit_name: z.ZodOptional<z.ZodString>;
    kind: z.ZodDefault<z.ZodEnum<["complete", "skip", "partial"]>>;
    timestamp: z.ZodOptional<z.ZodString>;
    amount: z.ZodDefault<z.ZodNumber>;
    memo: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    habit_id: string;
    kind: "complete" | "skip" | "partial";
    amount: number;
    timestamp?: string | undefined;
    habit_name?: string | undefined;
    memo?: string | undefined;
}, {
    habit_id: string;
    timestamp?: string | undefined;
    habit_name?: string | undefined;
    kind?: "complete" | "skip" | "partial" | undefined;
    amount?: number | undefined;
    memo?: string | undefined;
}>;
export type ActivityCreate = z.infer<typeof activityCreateSchema>;
/**
 * Schema for habit progress data.
 */
export declare const habitProgressSchema: z.ZodObject<{
    habit_id: z.ZodString;
    habit_name: z.ZodString;
    goal_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    goal_name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    target_count: z.ZodNumber;
    current_count: z.ZodNumber;
    workload_unit: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    workload_per_count: z.ZodNumber;
    total_workload: z.ZodNumber;
    target_workload: z.ZodNumber;
    completed: z.ZodBoolean;
    streak: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    habit_id: string;
    target_count: number;
    workload_per_count: number;
    habit_name: string;
    current_count: number;
    total_workload: number;
    target_workload: number;
    completed: boolean;
    streak: number;
    goal_id?: string | null | undefined;
    workload_unit?: string | null | undefined;
    goal_name?: string | null | undefined;
}, {
    habit_id: string;
    target_count: number;
    workload_per_count: number;
    habit_name: string;
    current_count: number;
    total_workload: number;
    target_workload: number;
    completed: boolean;
    streak: number;
    goal_id?: string | null | undefined;
    workload_unit?: string | null | undefined;
    goal_name?: string | null | undefined;
}>;
export type HabitProgress = z.infer<typeof habitProgressSchema>;
/**
 * Schema for daily progress summary.
 */
export declare const dailyProgressSummarySchema: z.ZodObject<{
    date: z.ZodString;
    total_habits: z.ZodNumber;
    completed_habits: z.ZodNumber;
    completion_rate: z.ZodNumber;
    habits: z.ZodArray<z.ZodObject<{
        habit_id: z.ZodString;
        habit_name: z.ZodString;
        goal_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        goal_name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        target_count: z.ZodNumber;
        current_count: z.ZodNumber;
        workload_unit: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        workload_per_count: z.ZodNumber;
        total_workload: z.ZodNumber;
        target_workload: z.ZodNumber;
        completed: z.ZodBoolean;
        streak: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        habit_id: string;
        target_count: number;
        workload_per_count: number;
        habit_name: string;
        current_count: number;
        total_workload: number;
        target_workload: number;
        completed: boolean;
        streak: number;
        goal_id?: string | null | undefined;
        workload_unit?: string | null | undefined;
        goal_name?: string | null | undefined;
    }, {
        habit_id: string;
        target_count: number;
        workload_per_count: number;
        habit_name: string;
        current_count: number;
        total_workload: number;
        target_workload: number;
        completed: boolean;
        streak: number;
        goal_id?: string | null | undefined;
        workload_unit?: string | null | undefined;
        goal_name?: string | null | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    date: string;
    habits: {
        habit_id: string;
        target_count: number;
        workload_per_count: number;
        habit_name: string;
        current_count: number;
        total_workload: number;
        target_workload: number;
        completed: boolean;
        streak: number;
        goal_id?: string | null | undefined;
        workload_unit?: string | null | undefined;
        goal_name?: string | null | undefined;
    }[];
    total_habits: number;
    completed_habits: number;
    completion_rate: number;
}, {
    date: string;
    habits: {
        habit_id: string;
        target_count: number;
        workload_per_count: number;
        habit_name: string;
        current_count: number;
        total_workload: number;
        target_workload: number;
        completed: boolean;
        streak: number;
        goal_id?: string | null | undefined;
        workload_unit?: string | null | undefined;
        goal_name?: string | null | undefined;
    }[];
    total_habits: number;
    completed_habits: number;
    completion_rate: number;
}>;
export type DailyProgressSummary = z.infer<typeof dailyProgressSummarySchema>;
/**
 * Schema for dashboard summary.
 */
export declare const dashboardSummarySchema: z.ZodObject<{
    total_habits: z.ZodNumber;
    completed_habits: z.ZodNumber;
    completion_rate: z.ZodNumber;
    date_display: z.ZodString;
}, "strip", z.ZodTypeAny, {
    total_habits: number;
    completed_habits: number;
    completion_rate: number;
    date_display: string;
}, {
    total_habits: number;
    completed_habits: number;
    completion_rate: number;
    date_display: string;
}>;
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;
/**
 * Schema for goal data from database.
 */
export declare const goalSchema: z.ZodObject<{
    id: z.ZodString;
    owner_type: z.ZodDefault<z.ZodString>;
    owner_id: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    parent_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodDefault<z.ZodEnum<["active", "completed", "archived"]>>;
    level: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    level_tier: z.ZodOptional<z.ZodNullable<z.ZodEnum<["beginner", "intermediate", "advanced", "expert"]>>>;
    level_last_assessed_at: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    domain_codes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    created_at: z.ZodString;
    updated_at: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "completed" | "archived";
    created_at: string;
    id: string;
    name: string;
    owner_type: string;
    owner_id: string;
    domain_codes: string[];
    description?: string | null | undefined;
    level?: number | null | undefined;
    level_tier?: "beginner" | "intermediate" | "advanced" | "expert" | null | undefined;
    level_last_assessed_at?: string | null | undefined;
    updated_at?: string | null | undefined;
    parent_id?: string | null | undefined;
}, {
    created_at: string;
    id: string;
    name: string;
    owner_id: string;
    status?: "active" | "completed" | "archived" | undefined;
    owner_type?: string | undefined;
    description?: string | null | undefined;
    level?: number | null | undefined;
    level_tier?: "beginner" | "intermediate" | "advanced" | "expert" | null | undefined;
    level_last_assessed_at?: string | null | undefined;
    domain_codes?: string[] | undefined;
    updated_at?: string | null | undefined;
    parent_id?: string | null | undefined;
}>;
export type Goal = z.infer<typeof goalSchema>;
/**
 * Schema for creating a new goal.
 */
export declare const goalCreateSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    parent_id: z.ZodOptional<z.ZodString>;
    domain_codes: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString, "many">>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description?: string | undefined;
    domain_codes?: string[] | undefined;
    parent_id?: string | undefined;
}, {
    name: string;
    description?: string | undefined;
    domain_codes?: string[] | undefined;
    parent_id?: string | undefined;
}>;
export type GoalCreate = z.infer<typeof goalCreateSchema>;
/**
 * Schema for updating a goal.
 */
export declare const goalUpdateSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    parent_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodOptional<z.ZodEnum<["active", "completed", "archived"]>>;
    domain_codes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    status?: "active" | "completed" | "archived" | undefined;
    name?: string | undefined;
    description?: string | null | undefined;
    domain_codes?: string[] | undefined;
    parent_id?: string | null | undefined;
}, {
    status?: "active" | "completed" | "archived" | undefined;
    name?: string | undefined;
    description?: string | null | undefined;
    domain_codes?: string[] | undefined;
    parent_id?: string | null | undefined;
}>;
export type GoalUpdate = z.infer<typeof goalUpdateSchema>;
//# sourceMappingURL=habit.d.ts.map