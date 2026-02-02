/**
 * Agent Tools - Habit Tools
 *
 * Tools for habit management operations.
 * Used by AI agents to create, read, and analyze habits.
 */

import { z } from 'zod';
import type { AgentTool, ToolContext, ToolResult } from './types';

// ============================================================================
// Schemas
// ============================================================================

/**
 * Schema for creating a new habit.
 */
export const CreateHabitSchema = z.object({
  name: z.string().min(1, 'Habit name is required').max(100, 'Name too long'),
  type: z.enum(['do', 'avoid']).describe('Whether to do or avoid this habit'),
  frequency: z.enum(['daily', 'weekly', 'monthly']).describe('How often to track'),
  goalId: z.string().uuid().optional().describe('Associated goal ID'),
  triggerTime: z.string().optional().describe('Reminder time in HH:MM format'),
  targetCount: z.number().int().positive().default(1).describe('Daily target count'),
  workloadUnit: z.string().optional().describe('Unit of measurement (e.g., "minutes", "pages")'),
});

export type CreateHabitInput = z.infer<typeof CreateHabitSchema>;

/**
 * Schema for getting habits.
 */
export const GetHabitsSchema = z.object({
  activeOnly: z.boolean().default(true).describe('Only return active habits'),
  goalId: z.string().uuid().optional().describe('Filter by goal ID'),
  type: z.enum(['do', 'avoid']).optional().describe('Filter by habit type'),
});

export type GetHabitsInput = z.infer<typeof GetHabitsSchema>;

/**
 * Schema for analyzing habits.
 */
export const AnalyzeHabitsSchema = z.object({
  period: z
    .enum(['week', 'month', 'quarter'])
    .default('month')
    .describe('Analysis time period'),
  habitIds: z
    .array(z.string().uuid())
    .optional()
    .describe('Specific habits to analyze (all if omitted)'),
});

export type AnalyzeHabitsInput = z.infer<typeof AnalyzeHabitsSchema>;

/**
 * Schema for updating a habit.
 */
export const UpdateHabitSchema = z.object({
  habitId: z.string().uuid().describe('Habit ID to update'),
  name: z.string().min(1).max(100).optional(),
  type: z.enum(['do', 'avoid']).optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
  triggerTime: z.string().optional(),
  targetCount: z.number().int().positive().optional(),
  workloadUnit: z.string().optional(),
  isActive: z.boolean().optional().describe('Set habit active/inactive'),
});

export type UpdateHabitInput = z.infer<typeof UpdateHabitSchema>;

/**
 * Schema for completing/logging a habit.
 */
export const LogHabitCompletionSchema = z.object({
  habitId: z.string().uuid().describe('Habit ID to log'),
  date: z.string().optional().describe('Date in YYYY-MM-DD format (defaults to today)'),
  count: z.number().int().positive().default(1).describe('Completion count'),
  notes: z.string().max(500).optional().describe('Optional notes'),
});

export type LogHabitCompletionInput = z.infer<typeof LogHabitCompletionSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface Habit {
  id: string;
  name: string;
  type: 'do' | 'avoid';
  frequency: 'daily' | 'weekly' | 'monthly';
  goalId?: string;
  triggerTime?: string;
  targetCount: number;
  workloadUnit?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HabitAnalysis {
  habitId: string;
  habitName: string;
  period: 'week' | 'month' | 'quarter';
  completionRate: number;
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  insights: string[];
}

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Create a new habit for the user.
 */
export const createHabitTool: AgentTool<CreateHabitInput, ToolResult<Habit>> = {
  name: 'create_habit',
  description:
    'Create a new habit for the user. Supports both "do" habits (things to do regularly) and "avoid" habits (things to stop doing).',
  inputSchema: CreateHabitSchema,
  execute: async (input, context) => {
    try {
      const { userId, supabaseClient } = context;
      const client = supabaseClient as {
        from: (table: string) => {
          insert: (data: unknown) => {
            select: () => {
              single: () => Promise<{ data: Habit | null; error: Error | null }>;
            };
          };
        };
      };

      const { data, error } = await client
        .from('habits')
        .insert({
          user_id: userId,
          name: input.name,
          type: input.type,
          frequency: input.frequency,
          goal_id: input.goalId,
          trigger_time: input.triggerTime,
          target_count: input.targetCount,
          workload_unit: input.workloadUnit,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: {
            code: 'CREATE_HABIT_FAILED',
            message: error.message,
          },
        };
      }

      return {
        success: true,
        data: transformHabitFromDb(data),
      };
    } catch (err) {
      return {
        success: false,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: err instanceof Error ? err.message : 'Unknown error',
        },
      };
    }
  },
};

/**
 * Get habits for the current user.
 */
export const getHabitsTool: AgentTool<GetHabitsInput, ToolResult<Habit[]>> = {
  name: 'get_habits',
  description:
    'Get all habits for the current user. Can filter by active status, goal, or type.',
  inputSchema: GetHabitsSchema,
  execute: async (input, context) => {
    try {
      const { userId, supabaseClient } = context;
      // Chainable query type for Supabase-like client
      type ChainableQuery = {
        eq: (column: string, value: unknown) => ChainableQuery;
        order: (
          column: string,
          options: { ascending: boolean }
        ) => Promise<{ data: unknown[] | null; error: Error | null }>;
      };

      const client = supabaseClient as {
        from: (table: string) => {
          select: (columns: string) => ChainableQuery;
        };
      };

      let query: ChainableQuery = client.from('habits').select('*').eq('user_id', userId);

      if (input.activeOnly) {
        query = query.eq('is_active', true);
      }

      if (input.goalId) {
        query = query.eq('goal_id', input.goalId);
      }

      if (input.type) {
        query = query.eq('type', input.type);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        return {
          success: false,
          error: {
            code: 'GET_HABITS_FAILED',
            message: error.message,
          },
        };
      }

      return {
        success: true,
        data: (data ?? []).map(transformHabitFromDb),
      };
    } catch (err) {
      return {
        success: false,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: err instanceof Error ? err.message : 'Unknown error',
        },
      };
    }
  },
};

/**
 * Analyze habit completion patterns for insights.
 */
export const analyzeHabitsTool: AgentTool<AnalyzeHabitsInput, ToolResult<HabitAnalysis[]>> = {
  name: 'analyze_habits',
  description:
    'Analyze habit completion patterns over a specified period. Provides completion rates, streaks, and actionable insights.',
  inputSchema: AnalyzeHabitsSchema,
  execute: async (input, context) => {
    try {
      const { userId, supabaseClient } = context;
      const client = supabaseClient as {
        rpc: (
          fn: string,
          params: unknown
        ) => Promise<{ data: unknown[] | null; error: Error | null }>;
      };

      // Calculate date range based on period
      const now = new Date();
      const startDate = new Date();

      switch (input.period) {
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'quarter':
          startDate.setMonth(now.getMonth() - 3);
          break;
      }

      // Call stored procedure for habit analysis
      const { data, error } = await client.rpc('analyze_habits', {
        p_user_id: userId,
        p_start_date: startDate.toISOString().split('T')[0],
        p_end_date: now.toISOString().split('T')[0],
        p_habit_ids: input.habitIds ?? null,
      });

      if (error) {
        return {
          success: false,
          error: {
            code: 'ANALYZE_HABITS_FAILED',
            message: error.message,
          },
        };
      }

      const analyses: HabitAnalysis[] = (data ?? []).map((row: unknown) => {
        const r = row as {
          habit_id: string;
          habit_name: string;
          completion_rate: number;
          current_streak: number;
          longest_streak: number;
          total_completions: number;
        };
        return {
          habitId: r.habit_id,
          habitName: r.habit_name,
          period: input.period,
          completionRate: r.completion_rate,
          currentStreak: r.current_streak,
          longestStreak: r.longest_streak,
          totalCompletions: r.total_completions,
          insights: generateInsights(r),
        };
      });

      return {
        success: true,
        data: analyses,
      };
    } catch (err) {
      return {
        success: false,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: err instanceof Error ? err.message : 'Unknown error',
        },
      };
    }
  },
};

/**
 * Update an existing habit.
 */
export const updateHabitTool: AgentTool<UpdateHabitInput, ToolResult<Habit>> = {
  name: 'update_habit',
  description: 'Update an existing habit. Only provided fields will be updated.',
  inputSchema: UpdateHabitSchema,
  execute: async (input, context) => {
    try {
      const { userId, supabaseClient } = context;
      const client = supabaseClient as {
        from: (table: string) => {
          update: (data: unknown) => {
            eq: (column: string, value: unknown) => {
              eq: (column: string, value: unknown) => {
                select: () => {
                  single: () => Promise<{ data: Habit | null; error: Error | null }>;
                };
              };
            };
          };
        };
      };

      const { habitId, ...updates } = input;

      // Convert camelCase to snake_case for DB
      const dbUpdates: Record<string, unknown> = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.type !== undefined) dbUpdates.type = updates.type;
      if (updates.frequency !== undefined) dbUpdates.frequency = updates.frequency;
      if (updates.triggerTime !== undefined) dbUpdates.trigger_time = updates.triggerTime;
      if (updates.targetCount !== undefined) dbUpdates.target_count = updates.targetCount;
      if (updates.workloadUnit !== undefined) dbUpdates.workload_unit = updates.workloadUnit;
      if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
      dbUpdates.updated_at = new Date().toISOString();

      const { data, error } = await client
        .from('habits')
        .update(dbUpdates)
        .eq('id', habitId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: {
            code: 'UPDATE_HABIT_FAILED',
            message: error.message,
          },
        };
      }

      return {
        success: true,
        data: transformHabitFromDb(data),
      };
    } catch (err) {
      return {
        success: false,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: err instanceof Error ? err.message : 'Unknown error',
        },
      };
    }
  },
};

/**
 * Log a habit completion.
 */
export const logHabitCompletionTool: AgentTool<
  LogHabitCompletionInput,
  ToolResult<{ logged: boolean; newStreak: number }>
> = {
  name: 'log_habit_completion',
  description:
    'Log a habit completion for a specific date. Updates streak and progress tracking.',
  inputSchema: LogHabitCompletionSchema,
  execute: async (input, context) => {
    try {
      const { userId, supabaseClient } = context;
      const client = supabaseClient as {
        rpc: (
          fn: string,
          params: unknown
        ) => Promise<{ data: { logged: boolean; new_streak: number } | null; error: Error | null }>;
      };

      const date = input.date ?? new Date().toISOString().split('T')[0];

      const { data, error } = await client.rpc('log_habit_completion', {
        p_user_id: userId,
        p_habit_id: input.habitId,
        p_date: date,
        p_count: input.count,
        p_notes: input.notes ?? null,
      });

      if (error) {
        return {
          success: false,
          error: {
            code: 'LOG_COMPLETION_FAILED',
            message: error.message,
          },
        };
      }

      return {
        success: true,
        data: {
          logged: data?.logged ?? true,
          newStreak: data?.new_streak ?? 1,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: err instanceof Error ? err.message : 'Unknown error',
        },
      };
    }
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Transform database row to Habit type.
 */
function transformHabitFromDb(row: unknown): Habit {
  const r = row as {
    id: string;
    name: string;
    type: 'do' | 'avoid';
    frequency: 'daily' | 'weekly' | 'monthly';
    goal_id?: string;
    trigger_time?: string;
    target_count: number;
    workload_unit?: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  };

  return {
    id: r.id,
    name: r.name,
    type: r.type,
    frequency: r.frequency,
    goalId: r.goal_id,
    triggerTime: r.trigger_time,
    targetCount: r.target_count,
    workloadUnit: r.workload_unit,
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * Generate insights from habit analysis data.
 */
function generateInsights(data: {
  completion_rate: number;
  current_streak: number;
  longest_streak: number;
  total_completions: number;
}): string[] {
  const insights: string[] = [];

  // Completion rate insights
  if (data.completion_rate >= 90) {
    insights.push('Excellent consistency! You are mastering this habit.');
  } else if (data.completion_rate >= 70) {
    insights.push('Good progress! A few more consistent days will build momentum.');
  } else if (data.completion_rate >= 50) {
    insights.push('Moderate consistency. Consider setting a reminder or reducing the target.');
  } else if (data.completion_rate > 0) {
    insights.push('This habit needs attention. Try pairing it with an existing routine.');
  }

  // Streak insights
  if (data.current_streak > 0 && data.current_streak === data.longest_streak) {
    insights.push(`You are on your longest streak ever (${data.current_streak} days)! Keep going!`);
  } else if (data.longest_streak > data.current_streak * 2) {
    insights.push(
      `Your best streak was ${data.longest_streak} days. You can reach that again!`
    );
  }

  // Low completion insights
  if (data.total_completions === 0) {
    insights.push('No completions yet. Start with just one today!');
  }

  return insights;
}

// ============================================================================
// Tool Collection Export
// ============================================================================

/**
 * All habit-related tools for agent registration.
 */
export const habitTools = {
  createHabit: createHabitTool,
  getHabits: getHabitsTool,
  analyzeHabits: analyzeHabitsTool,
  updateHabit: updateHabitTool,
  logHabitCompletion: logHabitCompletionTool,
} as const;

/**
 * Array of all habit tools for registration.
 */
export const habitToolList = Object.values(habitTools);
