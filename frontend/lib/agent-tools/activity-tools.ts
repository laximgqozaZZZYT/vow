/**
 * Agent Tools - Activity Tools
 *
 * Tools for activity and statistics operations.
 * Used by AI agents to log, retrieve, and analyze user activities.
 */

import { z } from 'zod';
import type { AgentTool, ToolContext, ToolResult } from './types';

// ============================================================================
// Schemas
// ============================================================================

/**
 * Schema for logging an activity.
 */
export const LogActivitySchema = z.object({
  habitId: z.string().uuid().describe('Habit ID for this activity'),
  kind: z.enum(['start', 'complete', 'skip', 'pause']).describe('Type of activity'),
  amount: z.number().int().nonnegative().optional().describe('Workload increment'),
  durationSeconds: z.number().int().nonnegative().optional().describe('Duration in seconds'),
  memo: z.string().max(1000).optional().describe('Activity notes'),
  timestamp: z.string().optional().describe('Activity timestamp in ISO format (defaults to now)'),
});

export type LogActivityInput = z.infer<typeof LogActivitySchema>;

/**
 * Schema for getting activities.
 */
export const GetActivitiesSchema = z.object({
  habitId: z.string().uuid().optional().describe('Filter by habit ID'),
  kind: z.enum(['start', 'complete', 'skip', 'pause']).optional().describe('Filter by activity kind'),
  startDate: z.string().optional().describe('Start date in YYYY-MM-DD format'),
  endDate: z.string().optional().describe('End date in YYYY-MM-DD format'),
  limit: z.number().int().positive().max(100).default(50).describe('Maximum number of activities to return'),
  offset: z.number().int().nonnegative().default(0).describe('Pagination offset'),
});

export type GetActivitiesInput = z.infer<typeof GetActivitiesSchema>;

/**
 * Schema for getting statistics.
 */
export const GetStatsSchema = z.object({
  period: z.enum(['day', 'week', 'month', 'year']).default('week').describe('Statistics period'),
  habitId: z.string().uuid().optional().describe('Filter by habit ID'),
  date: z.string().optional().describe('Reference date in YYYY-MM-DD format (defaults to today)'),
});

export type GetStatsInput = z.infer<typeof GetStatsSchema>;

/**
 * Schema for updating workload.
 */
export const UpdateWorkloadSchema = z.object({
  habitId: z.string().uuid().describe('Habit ID to update workload for'),
  date: z.string().describe('Date in YYYY-MM-DD format'),
  workload: z.number().nonnegative().describe('New workload value'),
  mode: z.enum(['set', 'add']).default('set').describe('Set absolute value or add to existing'),
});

export type UpdateWorkloadInput = z.infer<typeof UpdateWorkloadSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface Activity {
  id: string;
  kind: 'start' | 'complete' | 'skip' | 'pause';
  habitId: string;
  habitName?: string;
  timestamp: string;
  amount?: number;
  prevCount?: number;
  newCount?: number;
  cumulativeWorkload?: number;
  durationSeconds?: number;
  memo?: string;
}

export interface ActivityStats {
  period: 'day' | 'week' | 'month' | 'year';
  startDate: string;
  endDate: string;
  totalActivities: number;
  completions: number;
  skips: number;
  totalWorkload: number;
  averageDailyWorkload: number;
  streakDays: number;
  byHabit: {
    habitId: string;
    habitName: string;
    completions: number;
    totalWorkload: number;
  }[];
}

export interface DailyWorkload {
  habitId: string;
  date: string;
  workload: number;
}

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Log a new activity.
 */
export const logActivityTool: AgentTool<LogActivityInput, ToolResult<Activity>> = {
  name: 'log_activity',
  description:
    'Log a new activity for a habit. Supports start, complete, skip, and pause actions with optional workload tracking.',
  inputSchema: LogActivitySchema,
  execute: async (input, context) => {
    try {
      const { userId, supabaseClient } = context;
      const client = supabaseClient as {
        from: (table: string) => {
          insert: (data: unknown) => {
            select: () => {
              single: () => Promise<{ data: Activity | null; error: Error | null }>;
            };
          };
          select: (columns: string) => {
            eq: (column: string, value: unknown) => {
              single: () => Promise<{ data: unknown | null; error: Error | null }>;
            };
          };
        };
      };

      // Get habit name for the activity record
      const { data: habitData, error: habitError } = await client
        .from('habits')
        .select('name, count')
        .eq('id', input.habitId)
        .single();

      if (habitError || !habitData) {
        return {
          success: false,
          error: {
            code: 'HABIT_NOT_FOUND',
            message: 'Habit not found / 習慣が見つかりません',
          },
        };
      }

      const habit = habitData as { name: string; count: number };
      const timestamp = input.timestamp ?? new Date().toISOString();
      const prevCount = habit.count;
      const newCount = input.kind === 'complete' ? prevCount + (input.amount ?? 1) : prevCount;

      const { data, error } = await client
        .from('activities')
        .insert({
          owner_type: 'user',
          owner_id: userId,
          habit_id: input.habitId,
          habit_name: habit.name,
          kind: input.kind,
          timestamp,
          amount: input.amount,
          prev_count: prevCount,
          new_count: newCount,
          duration_seconds: input.durationSeconds,
          memo: input.memo,
        })
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: {
            code: 'LOG_ACTIVITY_FAILED',
            message: error.message,
          },
        };
      }

      return {
        success: true,
        data: transformActivityFromDb(data),
      };
    } catch (err) {
      return {
        success: false,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: err instanceof Error ? err.message : 'Unknown error / 不明なエラー',
        },
      };
    }
  },
};

/**
 * Get activities for the current user.
 */
export const getActivitiesTool: AgentTool<GetActivitiesInput, ToolResult<Activity[]>> = {
  name: 'get_activities',
  description:
    'Get activities for the current user. Can filter by habit, kind, and date range.',
  inputSchema: GetActivitiesSchema,
  execute: async (input, context) => {
    try {
      const { userId, supabaseClient } = context;
      // Chainable query type for Supabase-like client
      type ChainableQuery = {
        eq: (column: string, value: unknown) => ChainableQuery;
        gte: (column: string, value: string) => ChainableQuery;
        lte: (column: string, value: string) => ChainableQuery;
        order: (column: string, options: { ascending: boolean }) => {
          range: (start: number, end: number) => Promise<{ data: unknown[] | null; error: Error | null }>;
        };
      };

      const client = supabaseClient as {
        from: (table: string) => {
          select: (columns: string) => ChainableQuery;
        };
      };

      let query: ChainableQuery = client.from('activities').select('*').eq('owner_id', userId);

      if (input.habitId) {
        query = query.eq('habit_id', input.habitId);
      }

      if (input.kind) {
        query = query.eq('kind', input.kind);
      }

      if (input.startDate) {
        query = query.gte('timestamp', `${input.startDate}T00:00:00Z`);
      }

      if (input.endDate) {
        query = query.lte('timestamp', `${input.endDate}T23:59:59Z`);
      }

      const { data, error } = await query
        .order('timestamp', { ascending: false })
        .range(input.offset, input.offset + input.limit - 1);

      if (error) {
        return {
          success: false,
          error: {
            code: 'GET_ACTIVITIES_FAILED',
            message: error.message,
          },
        };
      }

      return {
        success: true,
        data: (data ?? []).map(transformActivityFromDb),
      };
    } catch (err) {
      return {
        success: false,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: err instanceof Error ? err.message : 'Unknown error / 不明なエラー',
        },
      };
    }
  },
};

/**
 * Get statistics for activities.
 */
export const getStatsTool: AgentTool<GetStatsInput, ToolResult<ActivityStats>> = {
  name: 'get_activity_stats',
  description:
    'Get activity statistics for a specified period. Includes completion counts, workload totals, and streaks.',
  inputSchema: GetStatsSchema,
  execute: async (input, context) => {
    try {
      const { userId, supabaseClient } = context;
      const client = supabaseClient as {
        from: (table: string) => {
          select: (columns: string) => {
            eq: (column: string, value: unknown) => {
              gte: (column: string, value: string) => {
                lte: (column: string, value: string) => Promise<{ data: unknown[] | null; error: Error | null }>;
              };
            };
          };
        };
      };

      // Calculate date range
      const refDate = input.date ? new Date(input.date) : new Date();
      const { startDate, endDate, days } = getDateRange(input.period, refDate);

      const baseQuery = client
        .from('activities')
        .select('*, habits!inner(name)')
        .eq('owner_id', userId)
        .gte('timestamp', startDate)
        .lte('timestamp', endDate);

      // Note: The habitId filter would need a more complex type definition
      // For simplicity, we execute the base query and filter in-memory if needed
      const { data, error } = await baseQuery;

      // Filter by habitId if specified
      const filteredData = input.habitId
        ? (data ?? []).filter((a: unknown) => (a as { habit_id: string }).habit_id === input.habitId)
        : (data ?? []);

      if (error) {
        return {
          success: false,
          error: {
            code: 'GET_STATS_FAILED',
            message: error.message,
          },
        };
      }

      const activities = filteredData;
      const completions = activities.filter((a: unknown) => (a as { kind: string }).kind === 'complete');
      const skips = activities.filter((a: unknown) => (a as { kind: string }).kind === 'skip');

      // Calculate totals
      const totalWorkload = completions.reduce<number>(
        (sum, a) => sum + ((a as { amount?: number }).amount ?? 1),
        0
      );

      // Group by habit
      const habitMap = new Map<string, { habitId: string; habitName: string; completions: number; totalWorkload: number }>();
      for (const activity of completions) {
        const a = activity as { habit_id: string; habit_name?: string; amount?: number };
        const existing = habitMap.get(a.habit_id);
        if (existing) {
          existing.completions++;
          existing.totalWorkload += a.amount ?? 1;
        } else {
          habitMap.set(a.habit_id, {
            habitId: a.habit_id,
            habitName: a.habit_name ?? 'Unknown',
            completions: 1,
            totalWorkload: a.amount ?? 1,
          });
        }
      }

      // Calculate streak (consecutive days with at least one completion)
      const streakDays = calculateStreak(
        completions.map((a: unknown) => (a as { timestamp: string }).timestamp),
        refDate
      );

      return {
        success: true,
        data: {
          period: input.period,
          startDate: startDate.split('T')[0],
          endDate: endDate.split('T')[0],
          totalActivities: activities.length,
          completions: completions.length,
          skips: skips.length,
          totalWorkload,
          averageDailyWorkload: Math.round((totalWorkload / days) * 100) / 100,
          streakDays,
          byHabit: Array.from(habitMap.values()),
        },
      };
    } catch (err) {
      return {
        success: false,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: err instanceof Error ? err.message : 'Unknown error / 不明なエラー',
        },
      };
    }
  },
};

/**
 * Update workload for a habit on a specific date.
 */
export const updateWorkloadTool: AgentTool<UpdateWorkloadInput, ToolResult<DailyWorkload>> = {
  name: 'update_workload',
  description:
    'Update the daily workload for a habit. Can set an absolute value or add to the existing workload.',
  inputSchema: UpdateWorkloadSchema,
  execute: async (input, context) => {
    try {
      const { userId, supabaseClient } = context;
      const client = supabaseClient as {
        from: (table: string) => {
          upsert: (data: unknown, options: { onConflict: string }) => {
            select: () => {
              single: () => Promise<{ data: unknown | null; error: Error | null }>;
            };
          };
          select: (columns: string) => {
            eq: (column: string, value: unknown) => {
              eq: (column: string, value: unknown) => {
                single: () => Promise<{ data: unknown | null; error: Error | null }>;
              };
            };
          };
        };
      };

      let newWorkload = input.workload;

      // If adding to existing, get current workload first
      if (input.mode === 'add') {
        const { data: existing } = await client
          .from('habit_daily_workloads')
          .select('workload')
          .eq('habit_id', input.habitId)
          .eq('date', input.date)
          .single();

        if (existing) {
          newWorkload = ((existing as { workload: number }).workload ?? 0) + input.workload;
        }
      }

      const { data, error } = await client
        .from('habit_daily_workloads')
        .upsert(
          {
            habit_id: input.habitId,
            date: input.date,
            workload: newWorkload,
            owner_type: 'user',
            owner_id: userId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'habit_id,date' }
        )
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: {
            code: 'UPDATE_WORKLOAD_FAILED',
            message: error.message,
          },
        };
      }

      const result = data as { habit_id: string; date: string; workload: number };

      return {
        success: true,
        data: {
          habitId: result.habit_id,
          date: result.date,
          workload: result.workload,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: err instanceof Error ? err.message : 'Unknown error / 不明なエラー',
        },
      };
    }
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Transform database row to Activity type.
 */
function transformActivityFromDb(row: unknown): Activity {
  const r = row as {
    id: string;
    kind: 'start' | 'complete' | 'skip' | 'pause';
    habit_id: string;
    habit_name?: string;
    timestamp: string;
    amount?: number;
    prev_count?: number;
    new_count?: number;
    cumulative_workload?: number;
    duration_seconds?: number;
    memo?: string;
  };

  return {
    id: r.id,
    kind: r.kind,
    habitId: r.habit_id,
    habitName: r.habit_name,
    timestamp: r.timestamp,
    amount: r.amount,
    prevCount: r.prev_count,
    newCount: r.new_count,
    cumulativeWorkload: r.cumulative_workload,
    durationSeconds: r.duration_seconds,
    memo: r.memo,
  };
}

/**
 * Get date range for a period.
 */
function getDateRange(
  period: 'day' | 'week' | 'month' | 'year',
  refDate: Date
): { startDate: string; endDate: string; days: number } {
  const end = new Date(refDate);
  end.setHours(23, 59, 59, 999);

  const start = new Date(refDate);
  start.setHours(0, 0, 0, 0);

  let days = 1;

  switch (period) {
    case 'day':
      days = 1;
      break;
    case 'week':
      start.setDate(start.getDate() - 6);
      days = 7;
      break;
    case 'month':
      start.setDate(start.getDate() - 29);
      days = 30;
      break;
    case 'year':
      start.setFullYear(start.getFullYear() - 1);
      start.setDate(start.getDate() + 1);
      days = 365;
      break;
  }

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    days,
  };
}

/**
 * Calculate consecutive days streak from activity timestamps.
 */
function calculateStreak(timestamps: string[], refDate: Date): number {
  if (timestamps.length === 0) return 0;

  // Get unique dates
  const uniqueDates = new Set(
    timestamps.map((ts) => new Date(ts).toISOString().split('T')[0])
  );

  const sortedDates = Array.from(uniqueDates).sort().reverse();
  const today = refDate.toISOString().split('T')[0];

  // If no activity today, start from yesterday
  let checkDate = new Date(refDate);
  if (!uniqueDates.has(today)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const dateStr = checkDate.toISOString().split('T')[0];
    if (uniqueDates.has(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

// ============================================================================
// Tool Collection Export
// ============================================================================

/**
 * All activity-related tools for agent registration.
 */
export const activityTools = {
  logActivity: logActivityTool,
  getActivities: getActivitiesTool,
  getStats: getStatsTool,
  updateWorkload: updateWorkloadTool,
} as const;

/**
 * Array of all activity tools for registration.
 */
export const activityToolList = Object.values(activityTools);
