/**
 * Agent Tools - Calendar Tools
 *
 * Tools for calendar and scheduling operations.
 * Used by AI agents to manage events and reminders based on habits.
 *
 * Note: This application uses habits with time/repeat fields as the primary
 * calendar event source. These tools work with habit-based scheduling.
 */

import { z } from 'zod';
import type { AgentTool, ToolContext, ToolResult } from './types';

// ============================================================================
// Schemas
// ============================================================================

/**
 * Schema for getting calendar events.
 */
export const GetEventsSchema = z.object({
  startDate: z.string().describe('Start date in YYYY-MM-DD format'),
  endDate: z.string().describe('End date in YYYY-MM-DD format'),
  goalId: z.string().uuid().optional().describe('Filter by goal ID'),
  includeCompleted: z.boolean().default(false).describe('Include completed habits'),
  includeAllDay: z.boolean().default(true).describe('Include all-day events'),
});

export type GetEventsInput = z.infer<typeof GetEventsSchema>;

/**
 * Schema for creating a calendar event (creates a scheduled habit).
 */
export const CreateEventSchema = z.object({
  name: z.string().min(1, 'Event name is required / イベント名は必須です').max(200),
  goalId: z.string().uuid().optional().describe('Associated goal ID'),
  date: z.string().describe('Event date in YYYY-MM-DD format'),
  time: z.string().optional().describe('Start time in HH:MM format'),
  endTime: z.string().optional().describe('End time in HH:MM format'),
  allDay: z.boolean().default(false).describe('Whether this is an all-day event'),
  repeat: z
    .enum(['none', 'daily', 'weekly', 'monthly', 'yearly'])
    .default('none')
    .describe('Recurrence pattern'),
  notes: z.string().max(2000).optional().describe('Event notes'),
  type: z.enum(['do', 'avoid']).default('do').describe('Habit type'),
});

export type CreateEventInput = z.infer<typeof CreateEventSchema>;

/**
 * Schema for creating a reminder.
 */
export const CreateReminderSchema = z.object({
  habitId: z.string().uuid().describe('Habit ID to add reminder to'),
  reminderType: z
    .enum(['absolute', 'relative'])
    .default('absolute')
    .describe('Type of reminder'),
  time: z.string().optional().describe('Reminder time in HH:MM format (for absolute)'),
  weekdays: z
    .array(z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']))
    .optional()
    .describe('Days for absolute reminder'),
  minutesBefore: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Minutes before event (for relative)'),
});

export type CreateReminderInput = z.infer<typeof CreateReminderSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface CalendarEvent {
  id: string;
  title: string;
  habitId: string;
  goalId?: string;
  goalName?: string;
  start: string;
  end?: string;
  allDay: boolean;
  repeat?: string;
  completed: boolean;
  notes?: string;
  type: 'do' | 'avoid';
}

export interface Reminder {
  kind: 'absolute' | 'relative';
  time?: string;
  weekdays?: string[];
  minutesBefore?: number;
}

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Get calendar events (habits with time) for a date range.
 */
export const getEventsTool: AgentTool<GetEventsInput, ToolResult<CalendarEvent[]>> = {
  name: 'get_calendar_events',
  description:
    'Get calendar events for a specified date range. Events are derived from habits with scheduled times.',
  inputSchema: GetEventsSchema,
  execute: async (input, context) => {
    try {
      const { userId, supabaseClient } = context;
      const client = supabaseClient as {
        from: (table: string) => {
          select: (columns: string) => {
            eq: (column: string, value: unknown) => {
              eq: (column: string, value: unknown) => {
                order: (
                  column: string,
                  options: { ascending: boolean }
                ) => Promise<{ data: unknown[] | null; error: Error | null }>;
              };
              order: (
                column: string,
                options: { ascending: boolean }
              ) => Promise<{ data: unknown[] | null; error: Error | null }>;
            };
          };
        };
      };

      // Query habits - simpler query, filter in memory for flexibility
      const { data, error } = await client
        .from('habits')
        .select('*, goals(name)')
        .eq('owner_id', userId)
        .order('time', { ascending: true });

      if (error) {
        return {
          success: false,
          error: {
            code: 'GET_EVENTS_FAILED',
            message: error.message,
          },
        };
      }

      // Apply filters in memory for type safety
      let filteredHabits = data ?? [];

      // Filter by active status
      if (!input.includeCompleted) {
        filteredHabits = filteredHabits.filter((h: unknown) => (h as { active: boolean }).active);
      }

      // Filter by goal if specified
      if (input.goalId) {
        filteredHabits = filteredHabits.filter((h: unknown) => (h as { goal_id?: string }).goal_id === input.goalId);
      }

      // Filter out habits without time unless allDay is included
      if (!input.includeAllDay) {
        filteredHabits = filteredHabits.filter((h: unknown) => (h as { time?: string }).time != null);
      }

      // Transform habits to calendar events
      const events: CalendarEvent[] = [];
      const startDate = new Date(input.startDate);
      const endDate = new Date(input.endDate);

      for (const habit of filteredHabits) {
        const h = habit as {
          id: string;
          name: string;
          goal_id?: string;
          goals?: { name: string };
          time?: string;
          end_time?: string;
          all_day?: boolean;
          repeat?: string;
          completed?: boolean;
          notes?: string;
          type: 'do' | 'avoid';
          due_date?: string;
          timings?: { time?: string; endTime?: string; weekday?: string }[];
        };

        // Generate events based on repeat pattern
        const eventDates = generateEventDates(
          h,
          startDate,
          endDate
        );

        for (const eventDate of eventDates) {
          const startStr = h.time
            ? `${eventDate}T${h.time}:00`
            : `${eventDate}T00:00:00`;
          const endStr = h.end_time
            ? `${eventDate}T${h.end_time}:00`
            : h.time
            ? `${eventDate}T${h.time}:00`
            : undefined;

          events.push({
            id: `${h.id}-${eventDate}`,
            title: h.name,
            habitId: h.id,
            goalId: h.goal_id,
            goalName: h.goals?.name,
            start: startStr,
            end: endStr,
            allDay: h.all_day ?? !h.time,
            repeat: h.repeat,
            completed: h.completed ?? false,
            notes: h.notes,
            type: h.type,
          });
        }
      }

      // Sort by start time
      events.sort((a, b) => a.start.localeCompare(b.start));

      return {
        success: true,
        data: events,
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
 * Create a new calendar event (as a scheduled habit).
 */
export const createEventTool: AgentTool<CreateEventInput, ToolResult<CalendarEvent>> = {
  name: 'create_calendar_event',
  description:
    'Create a new calendar event. Events are stored as habits with time information.',
  inputSchema: CreateEventSchema,
  execute: async (input, context) => {
    try {
      const { userId, supabaseClient } = context;
      const client = supabaseClient as {
        from: (table: string) => {
          insert: (data: unknown) => {
            select: (columns: string) => {
              single: () => Promise<{ data: unknown | null; error: Error | null }>;
            };
          };
          select: (columns: string) => {
            eq: (column: string, value: unknown) => {
              single: () => Promise<{ data: unknown | null; error: Error | null }>;
            };
          };
        };
      };

      // If no goalId provided, we need a default goal or create one
      let goalId = input.goalId;
      if (!goalId) {
        // Look for a "Calendar Events" goal or create one
        const { data: existingGoal } = await client
          .from('goals')
          .select('id')
          .eq('name', 'Calendar Events')
          .single();

        if (existingGoal) {
          goalId = (existingGoal as { id: string }).id;
        } else {
          // Create a default goal for calendar events
          const { data: newGoal, error: goalError } = await client
            .from('goals')
            .insert({
              owner_type: 'user',
              owner_id: userId,
              name: 'Calendar Events',
              details: 'Default goal for standalone calendar events / カレンダーイベント用デフォルト目標',
              is_completed: false,
            })
            .select('id')
            .single();

          if (goalError || !newGoal) {
            return {
              success: false,
              error: {
                code: 'CREATE_DEFAULT_GOAL_FAILED',
                message: 'Failed to create default goal for event / イベント用デフォルト目標の作成に失敗しました',
              },
            };
          }
          goalId = (newGoal as { id: string }).id;
        }
      }

      // Create the habit as a calendar event
      const { data, error } = await client
        .from('habits')
        .insert({
          owner_type: 'user',
          owner_id: userId,
          goal_id: goalId,
          name: input.name,
          type: input.type,
          active: true,
          count: 0,
          due_date: input.date,
          time: input.time,
          end_time: input.endTime,
          all_day: input.allDay,
          repeat: input.repeat === 'none' ? null : input.repeat,
          notes: input.notes,
          completed: false,
        })
        .select('*, goals(name)')
        .single();

      if (error) {
        return {
          success: false,
          error: {
            code: 'CREATE_EVENT_FAILED',
            message: error.message,
          },
        };
      }

      const h = data as {
        id: string;
        name: string;
        goal_id?: string;
        goals?: { name: string };
        time?: string;
        end_time?: string;
        all_day?: boolean;
        repeat?: string;
        completed?: boolean;
        notes?: string;
        type: 'do' | 'avoid';
        due_date?: string;
      };

      const startStr = h.time
        ? `${input.date}T${h.time}:00`
        : `${input.date}T00:00:00`;
      const endStr = h.end_time
        ? `${input.date}T${h.end_time}:00`
        : undefined;

      return {
        success: true,
        data: {
          id: `${h.id}-${input.date}`,
          title: h.name,
          habitId: h.id,
          goalId: h.goal_id,
          goalName: h.goals?.name,
          start: startStr,
          end: endStr,
          allDay: h.all_day ?? !h.time,
          repeat: h.repeat,
          completed: h.completed ?? false,
          notes: h.notes,
          type: h.type,
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
 * Add a reminder to an existing habit/event.
 */
export const createReminderTool: AgentTool<
  CreateReminderInput,
  ToolResult<{ habitId: string; reminders: Reminder[] }>
> = {
  name: 'create_reminder',
  description:
    'Add a reminder to an existing habit or calendar event. Supports absolute (specific time) and relative (before event) reminders.',
  inputSchema: CreateReminderSchema,
  execute: async (input, context) => {
    try {
      const { userId, supabaseClient } = context;
      const client = supabaseClient as {
        from: (table: string) => {
          select: (columns: string) => {
            eq: (column: string, value: unknown) => {
              eq: (column: string, value: unknown) => {
                single: () => Promise<{ data: unknown | null; error: Error | null }>;
              };
            };
          };
          update: (data: unknown) => {
            eq: (column: string, value: unknown) => {
              eq: (column: string, value: unknown) => {
                select: () => {
                  single: () => Promise<{ data: unknown | null; error: Error | null }>;
                };
              };
            };
          };
        };
      };

      // Validate input based on reminder type
      if (input.reminderType === 'absolute' && !input.time) {
        return {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Time is required for absolute reminders / 絶対リマインダーには時刻が必要です',
          },
        };
      }

      if (input.reminderType === 'relative' && !input.minutesBefore) {
        return {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message:
              'Minutes before is required for relative reminders / 相対リマインダーには分数が必要です',
          },
        };
      }

      // Get current reminders for the habit
      const { data: habitData, error: getError } = await client
        .from('habits')
        .select('reminders')
        .eq('id', input.habitId)
        .eq('owner_id', userId)
        .single();

      if (getError || !habitData) {
        return {
          success: false,
          error: {
            code: 'HABIT_NOT_FOUND',
            message: 'Habit not found or access denied / 習慣が見つからないか、アクセスが拒否されました',
          },
        };
      }

      const existingReminders = ((habitData as { reminders?: Reminder[] }).reminders ?? []) as Reminder[];

      // Create the new reminder
      const newReminder: Reminder =
        input.reminderType === 'absolute'
          ? {
              kind: 'absolute',
              time: input.time,
              weekdays: input.weekdays ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            }
          : {
              kind: 'relative',
              minutesBefore: input.minutesBefore,
            };

      const updatedReminders = [...existingReminders, newReminder];

      // Update the habit with new reminders
      const { error: updateError } = await client
        .from('habits')
        .update({
          reminders: updatedReminders,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.habitId)
        .eq('owner_id', userId)
        .select()
        .single();

      if (updateError) {
        return {
          success: false,
          error: {
            code: 'UPDATE_REMINDERS_FAILED',
            message: updateError.message,
          },
        };
      }

      return {
        success: true,
        data: {
          habitId: input.habitId,
          reminders: updatedReminders,
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
 * Generate event dates based on habit repeat pattern.
 */
function generateEventDates(
  habit: {
    due_date?: string;
    repeat?: string;
    timings?: { weekday?: string }[];
  },
  startDate: Date,
  endDate: Date
): string[] {
  const dates: string[] = [];
  const dueDate = habit.due_date ? new Date(habit.due_date) : null;

  // If no repeat, just check if due date is in range
  if (!habit.repeat || habit.repeat === 'none') {
    if (dueDate) {
      const dueDateStr = dueDate.toISOString().split('T')[0];
      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];
      if (dueDateStr >= startStr && dueDateStr <= endStr) {
        dates.push(dueDateStr);
      }
    }
    return dates;
  }

  // For repeating events, generate dates in range
  const baseDate = dueDate ?? startDate;
  const current = new Date(startDate);

  while (current <= endDate) {
    const currentStr = current.toISOString().split('T')[0];
    let include = false;

    switch (habit.repeat) {
      case 'daily':
        // Include every day from base date onwards
        include = current >= baseDate;
        break;

      case 'weekly':
        // Include if same day of week as base
        if (habit.timings && habit.timings.length > 0) {
          // Use timings weekdays
          const dayName = getDayName(current.getDay());
          include = habit.timings.some((t) => t.weekday === dayName);
        } else {
          // Use base date's day of week
          include = current.getDay() === baseDate.getDay() && current >= baseDate;
        }
        break;

      case 'monthly':
        // Include if same day of month as base
        include = current.getDate() === baseDate.getDate() && current >= baseDate;
        break;

      case 'yearly':
        // Include if same month and day as base
        include =
          current.getMonth() === baseDate.getMonth() &&
          current.getDate() === baseDate.getDate() &&
          current >= baseDate;
        break;
    }

    if (include) {
      dates.push(currentStr);
    }

    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Get day name from day number (0 = Sunday).
 */
function getDayName(dayNum: number): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[dayNum];
}

// ============================================================================
// Tool Collection Export
// ============================================================================

/**
 * All calendar-related tools for agent registration.
 */
export const calendarTools = {
  getEvents: getEventsTool,
  createEvent: createEventTool,
  createReminder: createReminderTool,
} as const;

/**
 * Array of all calendar tools for registration.
 */
export const calendarToolList = Object.values(calendarTools);
