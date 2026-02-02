/**
 * Agent Tools - Goal Tools
 *
 * Tools for goal management operations.
 * Used by AI agents to create, read, update, and analyze goals.
 */

import { z } from 'zod';
import type { AgentTool, ToolContext, ToolResult } from './types';

// ============================================================================
// Schemas
// ============================================================================

/**
 * Schema for creating a new goal.
 */
export const CreateGoalSchema = z.object({
  name: z.string().min(1, 'Goal name is required / 目標名は必須です').max(200, 'Name too long / 名前が長すぎます'),
  details: z.string().max(2000).optional().describe('Goal description or details'),
  dueDate: z.string().optional().describe('Due date in YYYY-MM-DD format'),
  parentId: z.string().uuid().optional().nullable().describe('Parent goal ID for sub-goals'),
  domainCodes: z.array(z.string()).optional().describe('Occupation domain codes for XP distribution'),
});

export type CreateGoalInput = z.infer<typeof CreateGoalSchema>;

/**
 * Schema for getting goals.
 */
export const GetGoalsSchema = z.object({
  includeCompleted: z.boolean().default(false).describe('Include completed goals'),
  parentId: z.string().uuid().optional().nullable().describe('Filter by parent goal ID'),
  search: z.string().optional().describe('Search query for goal name'),
});

export type GetGoalsInput = z.infer<typeof GetGoalsSchema>;

/**
 * Schema for updating a goal.
 */
export const UpdateGoalSchema = z.object({
  goalId: z.string().uuid().describe('Goal ID to update'),
  name: z.string().min(1).max(200).optional(),
  details: z.string().max(2000).optional().nullable(),
  dueDate: z.string().optional().nullable().describe('Due date in YYYY-MM-DD format'),
  parentId: z.string().uuid().optional().nullable(),
  isCompleted: z.boolean().optional().describe('Mark goal as completed'),
  domainCodes: z.array(z.string()).optional(),
});

export type UpdateGoalInput = z.infer<typeof UpdateGoalSchema>;

/**
 * Schema for calculating goal progress.
 */
export const CalculateProgressSchema = z.object({
  goalId: z.string().uuid().describe('Goal ID to calculate progress for'),
  includeSubGoals: z.boolean().default(true).describe('Include sub-goals in calculation'),
});

export type CalculateProgressInput = z.infer<typeof CalculateProgressSchema>;

/**
 * Schema for linking a habit to a goal.
 */
export const LinkHabitToGoalSchema = z.object({
  habitId: z.string().uuid().describe('Habit ID to link'),
  goalId: z.string().uuid().describe('Goal ID to link to'),
});

export type LinkHabitToGoalInput = z.infer<typeof LinkHabitToGoalSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface Goal {
  id: string;
  name: string;
  details?: string;
  dueDate?: string;
  parentId?: string | null;
  isCompleted: boolean;
  domainCodes?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GoalProgress {
  goalId: string;
  goalName: string;
  totalHabits: number;
  completedHabits: number;
  progressPercent: number;
  subGoalProgress?: GoalProgress[];
  overallProgress: number;
}

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Create a new goal for the user.
 */
export const createGoalTool: AgentTool<CreateGoalInput, ToolResult<Goal>> = {
  name: 'create_goal',
  description:
    'Create a new goal for the user. Goals can have sub-goals (via parentId) and can be linked to habits.',
  inputSchema: CreateGoalSchema,
  execute: async (input, context) => {
    try {
      const { userId, supabaseClient } = context;
      const client = supabaseClient as {
        from: (table: string) => {
          insert: (data: unknown) => {
            select: () => {
              single: () => Promise<{ data: Goal | null; error: Error | null }>;
            };
          };
        };
      };

      const { data, error } = await client
        .from('goals')
        .insert({
          owner_type: 'user',
          owner_id: userId,
          name: input.name,
          details: input.details,
          due_date: input.dueDate,
          parent_id: input.parentId,
          domain_codes: input.domainCodes ?? [],
          is_completed: false,
        })
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: {
            code: 'CREATE_GOAL_FAILED',
            message: error.message,
          },
        };
      }

      return {
        success: true,
        data: transformGoalFromDb(data),
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
 * Get goals for the current user.
 */
export const getGoalsTool: AgentTool<GetGoalsInput, ToolResult<Goal[]>> = {
  name: 'get_goals',
  description:
    'Get all goals for the current user. Can filter by completion status, parent goal, or search query.',
  inputSchema: GetGoalsSchema,
  execute: async (input, context) => {
    try {
      const { userId, supabaseClient } = context;
      // Chainable query type for Supabase-like client
      type ChainableQuery = {
        eq: (column: string, value: unknown) => ChainableQuery;
        ilike: (column: string, value: string) => ChainableQuery;
        is: (column: string, value: unknown) => ChainableQuery;
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

      let query: ChainableQuery = client.from('goals').select('*').eq('owner_id', userId);

      if (!input.includeCompleted) {
        query = query.eq('is_completed', false);
      }

      if (input.parentId !== undefined) {
        if (input.parentId === null) {
          query = query.is('parent_id', null);
        } else {
          query = query.eq('parent_id', input.parentId);
        }
      }

      if (input.search) {
        query = query.ilike('name', `%${input.search}%`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        return {
          success: false,
          error: {
            code: 'GET_GOALS_FAILED',
            message: error.message,
          },
        };
      }

      return {
        success: true,
        data: (data ?? []).map(transformGoalFromDb),
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
 * Update an existing goal.
 */
export const updateGoalTool: AgentTool<UpdateGoalInput, ToolResult<Goal>> = {
  name: 'update_goal',
  description: 'Update an existing goal. Only provided fields will be updated.',
  inputSchema: UpdateGoalSchema,
  execute: async (input, context) => {
    try {
      const { userId, supabaseClient } = context;
      const client = supabaseClient as {
        from: (table: string) => {
          update: (data: unknown) => {
            eq: (column: string, value: unknown) => {
              eq: (column: string, value: unknown) => {
                select: () => {
                  single: () => Promise<{ data: Goal | null; error: Error | null }>;
                };
              };
            };
          };
        };
      };

      const { goalId, ...updates } = input;

      // Convert camelCase to snake_case for DB
      const dbUpdates: Record<string, unknown> = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.details !== undefined) dbUpdates.details = updates.details;
      if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;
      if (updates.parentId !== undefined) dbUpdates.parent_id = updates.parentId;
      if (updates.isCompleted !== undefined) dbUpdates.is_completed = updates.isCompleted;
      if (updates.domainCodes !== undefined) dbUpdates.domain_codes = updates.domainCodes;
      dbUpdates.updated_at = new Date().toISOString();

      const { data, error } = await client
        .from('goals')
        .update(dbUpdates)
        .eq('id', goalId)
        .eq('owner_id', userId)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: {
            code: 'UPDATE_GOAL_FAILED',
            message: error.message,
          },
        };
      }

      return {
        success: true,
        data: transformGoalFromDb(data),
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
 * Calculate progress for a goal based on linked habits.
 */
export const calculateProgressTool: AgentTool<CalculateProgressInput, ToolResult<GoalProgress>> = {
  name: 'calculate_goal_progress',
  description:
    'Calculate the progress of a goal based on linked habit completions. Optionally includes sub-goal progress.',
  inputSchema: CalculateProgressSchema,
  execute: async (input, context) => {
    try {
      const { userId, supabaseClient } = context;
      // Query type for single result
      type SingleQuery = {
        single: () => Promise<{ data: unknown | null; error: Error | null }>;
      };

      // Query type for multiple results
      type MultiQuery = Promise<{ data: unknown[] | null; error: Error | null }> & {
        eq: (column: string, value: unknown) => MultiQuery;
      };

      const client = supabaseClient as {
        from: (table: string) => {
          select: (columns: string) => {
            eq: (column: string, value: unknown) => SingleQuery & MultiQuery;
          };
        };
      };

      // Get the goal
      const { data: goalData, error: goalError } = await client
        .from('goals')
        .select('*')
        .eq('id', input.goalId)
        .single();

      if (goalError || !goalData) {
        return {
          success: false,
          error: {
            code: 'GOAL_NOT_FOUND',
            message: 'Goal not found / 目標が見つかりません',
          },
        };
      }

      const goal = goalData as { id: string; name: string };

      // Get habits linked to this goal
      const { data: habits, error: habitsError } = await client
        .from('habits')
        .select('id, completed, active')
        .eq('goal_id', input.goalId);

      if (habitsError) {
        return {
          success: false,
          error: {
            code: 'GET_HABITS_FAILED',
            message: habitsError.message,
          },
        };
      }

      const habitList = (habits ?? []) as { id: string; completed: boolean; active: boolean }[];
      const activeHabits = habitList.filter((h) => h.active);
      const completedHabits = activeHabits.filter((h) => h.completed);
      const progressPercent =
        activeHabits.length > 0 ? Math.round((completedHabits.length / activeHabits.length) * 100) : 0;

      let subGoalProgress: GoalProgress[] | undefined;
      let overallProgress = progressPercent;

      if (input.includeSubGoals) {
        // Get sub-goals
        const { data: subGoals } = await client
          .from('goals')
          .select('id')
          .eq('parent_id', input.goalId);

        if (subGoals && subGoals.length > 0) {
          subGoalProgress = [];
          let totalProgress = progressPercent;
          let count = 1;

          for (const subGoal of subGoals as { id: string }[]) {
            const subResult = await calculateProgressTool.execute(
              { goalId: subGoal.id, includeSubGoals: true },
              context
            );
            if (subResult.success && subResult.data) {
              subGoalProgress.push(subResult.data);
              totalProgress += subResult.data.overallProgress;
              count++;
            }
          }

          overallProgress = Math.round(totalProgress / count);
        }
      }

      return {
        success: true,
        data: {
          goalId: goal.id,
          goalName: goal.name,
          totalHabits: activeHabits.length,
          completedHabits: completedHabits.length,
          progressPercent,
          subGoalProgress,
          overallProgress,
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
 * Link a habit to a goal.
 */
export const linkHabitToGoalTool: AgentTool<
  LinkHabitToGoalInput,
  ToolResult<{ linked: boolean; habitId: string; goalId: string }>
> = {
  name: 'link_habit_to_goal',
  description: 'Link an existing habit to a goal. Updates the habit goal_id reference.',
  inputSchema: LinkHabitToGoalSchema,
  execute: async (input, context) => {
    try {
      const { userId, supabaseClient } = context;
      const client = supabaseClient as {
        from: (table: string) => {
          update: (data: unknown) => {
            eq: (column: string, value: unknown) => {
              eq: (column: string, value: unknown) => {
                select: () => Promise<{ data: unknown[] | null; error: Error | null }>;
              };
            };
          };
          select: (columns: string) => {
            eq: (column: string, value: unknown) => {
              single: () => Promise<{ data: unknown | null; error: Error | null }>;
            };
          };
        };
      };

      // Verify goal exists and belongs to user
      const { data: goalData, error: goalError } = await client
        .from('goals')
        .select('id')
        .eq('id', input.goalId)
        .single();

      if (goalError || !goalData) {
        return {
          success: false,
          error: {
            code: 'GOAL_NOT_FOUND',
            message: 'Goal not found or access denied / 目標が見つからないか、アクセスが拒否されました',
          },
        };
      }

      // Update habit to link to goal
      const { error: updateError } = await client
        .from('habits')
        .update({
          goal_id: input.goalId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.habitId)
        .eq('owner_id', userId)
        .select();

      if (updateError) {
        return {
          success: false,
          error: {
            code: 'LINK_FAILED',
            message: updateError.message,
          },
        };
      }

      return {
        success: true,
        data: {
          linked: true,
          habitId: input.habitId,
          goalId: input.goalId,
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
 * Transform database row to Goal type.
 */
function transformGoalFromDb(row: unknown): Goal {
  const r = row as {
    id: string;
    name: string;
    details?: string;
    due_date?: string;
    parent_id?: string | null;
    is_completed: boolean;
    domain_codes?: string[];
    created_at: string;
    updated_at: string;
  };

  return {
    id: r.id,
    name: r.name,
    details: r.details,
    dueDate: r.due_date,
    parentId: r.parent_id,
    isCompleted: r.is_completed,
    domainCodes: r.domain_codes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ============================================================================
// Tool Collection Export
// ============================================================================

/**
 * All goal-related tools for agent registration.
 */
export const goalTools = {
  createGoal: createGoalTool,
  getGoals: getGoalsTool,
  updateGoal: updateGoalTool,
  calculateProgress: calculateProgressTool,
  linkHabitToGoal: linkHabitToGoalTool,
} as const;

/**
 * Array of all goal tools for registration.
 */
export const goalToolList = Object.values(goalTools);
