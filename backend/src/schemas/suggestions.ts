/**
 * Suggestions Schemas
 *
 * Zod schemas and TypeScript types for the suggestions API.
 *
 * @module schemas/suggestions
 */

import { z } from 'zod';

// =============================================================================
// Enums
// =============================================================================

/**
 * Suggestion type enum
 */
export const SuggestionTypeEnum = z.enum(['habit', 'goal']);
export type SuggestionType = z.infer<typeof SuggestionTypeEnum>;

/**
 * Suggestion source enum
 */
export const SuggestionSourceEnum = z.enum(['coach', 'manager', 'analysis', 'manual']);
export type SuggestionSource = z.infer<typeof SuggestionSourceEnum>;

/**
 * Suggestion status enum
 */
export const SuggestionStatusEnum = z.enum(['pending', 'accepted', 'dismissed', 'snoozed']);
export type SuggestionStatus = z.infer<typeof SuggestionStatusEnum>;

/**
 * Suggestion priority enum
 */
export const SuggestionPriorityEnum = z.enum(['low', 'medium', 'high']);
export type SuggestionPriority = z.infer<typeof SuggestionPriorityEnum>;

// =============================================================================
// Data Schemas
// =============================================================================

/**
 * Habit suggestion data schema
 */
export const HabitSuggestionDataSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['do', 'avoid']).optional(),
  frequency: z.string().optional(),
  reason: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  targetCount: z.number().positive().optional(),
  workloadUnit: z.string().optional(),
  triggerTime: z.string().optional(),
  anchorHabit: z.string().optional(),
});

/**
 * Goal suggestion data schema
 */
export const GoalSuggestionDataSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  suggestedHabits: z.array(z.string()).optional(),
  rationale: z.string().optional(),
  deadline: z.string().datetime().optional(),
  milestones: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    targetDate: z.string().datetime().optional(),
  })).optional(),
});

/**
 * Generic suggestion data schema (union of habit and goal)
 */
export const SuggestionDataSchema = z.union([
  HabitSuggestionDataSchema,
  GoalSuggestionDataSchema,
]).and(z.record(z.unknown())); // Allow additional properties

// =============================================================================
// Request Schemas
// =============================================================================

/**
 * Create suggestion request schema
 */
export const CreateSuggestionRequestSchema = z.object({
  suggestionType: SuggestionTypeEnum,
  suggestionData: SuggestionDataSchema,
  source: SuggestionSourceEnum.default('coach'),
  goalId: z.string().uuid().optional().nullable(),
  priority: SuggestionPriorityEnum.default('medium'),
  expiresAt: z.string().datetime().optional().nullable(),
});

export type CreateSuggestionRequest = z.infer<typeof CreateSuggestionRequestSchema>;

/**
 * Update suggestion request schema
 */
export const UpdateSuggestionRequestSchema = z.object({
  status: SuggestionStatusEnum.optional(),
  snoozeUntil: z.string().datetime().optional().nullable(),
  acceptedEntityId: z.string().uuid().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export type UpdateSuggestionRequest = z.infer<typeof UpdateSuggestionRequestSchema>;

/**
 * List suggestions query schema
 */
export const ListSuggestionsQuerySchema = z.object({
  type: SuggestionTypeEnum.optional(),
  status: z.enum(['pending', 'accepted', 'dismissed', 'snoozed', 'all']).optional(),
  source: z.enum(['coach', 'manager', 'analysis', 'manual', 'all']).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  includeExpired: z.coerce.boolean().default(false),
});

export type ListSuggestionsQuery = z.infer<typeof ListSuggestionsQuerySchema>;

/**
 * Snooze suggestion request schema
 */
export const SnoozeSuggestionRequestSchema = z.object({
  hours: z.coerce.number().min(1).max(168).default(24), // Max 1 week
});

export type SnoozeSuggestionRequest = z.infer<typeof SnoozeSuggestionRequestSchema>;

// =============================================================================
// Response Schemas
// =============================================================================

/**
 * Saved suggestion schema (database record)
 */
export const SavedSuggestionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  suggestionType: SuggestionTypeEnum,
  suggestionData: z.record(z.unknown()),
  source: SuggestionSourceEnum,
  status: SuggestionStatusEnum,
  goalId: z.string().uuid().nullable().optional(),
  acceptedEntityId: z.string().uuid().nullable().optional(),
  priority: SuggestionPriorityEnum,
  snoozeUntil: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type SavedSuggestion = z.infer<typeof SavedSuggestionSchema>;

/**
 * Suggestion stats schema
 */
export const SuggestionStatsSchema = z.object({
  total: z.number(),
  byStatus: z.object({
    pending: z.number(),
    accepted: z.number(),
    dismissed: z.number(),
    snoozed: z.number(),
  }),
  byType: z.object({
    habit: z.number(),
    goal: z.number(),
  }),
});

export type SuggestionStats = z.infer<typeof SuggestionStatsSchema>;

// =============================================================================
// API Response Schemas
// =============================================================================

/**
 * Single suggestion response
 */
export const SuggestionResponseSchema = z.object({
  suggestion: SavedSuggestionSchema,
});

/**
 * List suggestions response
 */
export const ListSuggestionsResponseSchema = z.object({
  suggestions: z.array(SavedSuggestionSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});

/**
 * Suggestion stats response
 */
export const SuggestionStatsResponseSchema = z.object({
  stats: SuggestionStatsSchema,
});

/**
 * Snooze suggestion response
 */
export const SnoozeSuggestionResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  snoozeUntil: z.string().datetime(),
});
