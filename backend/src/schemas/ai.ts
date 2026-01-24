/**
 * AI Service Schemas
 *
 * Type definitions for AI-powered habit parsing and editing.
 *
 * Requirements: 9.1, 9.2
 */

import { z } from 'zod';

/**
 * AI Provider types.
 */
export type AIProvider = 'openai' | 'bedrock';

/**
 * AI Configuration.
 */
export const AI_CONFIG = {
  provider: 'openai' as AIProvider,
  model: 'gpt-4o-mini',
  pricing: {
    inputPerMillion: 0.15, // USD
    outputPerMillion: 0.60, // USD
  },
  maxTokensPerRequest: 4096,
  temperature: 0.7,
  maxRetries: 3,
  retryDelayMs: 1000,
} as const;

/**
 * Parsed habit data from natural language input.
 */
export const ParsedHabitDataSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['do', 'avoid']),
  frequency: z.enum(['daily', 'weekly', 'monthly']).nullable(),
  triggerTime: z.string().nullable(), // HH:MM format
  duration: z.number().nullable(), // minutes
  targetCount: z.number().nullable(),
  workloadUnit: z.string().nullable(),
  goalId: z.string().uuid().nullable(),
  confidence: z.number().min(0).max(1),
});

export type ParsedHabitData = z.infer<typeof ParsedHabitDataSchema>;

/**
 * Context for habit parsing.
 */
export interface ParseContext {
  existingHabits?: Array<{ id: string; name: string }>;
  existingGoals?: Array<{ id: string; name: string }>;
}

/**
 * AI parse result.
 */
export interface AIParseResult {
  parsed: ParsedHabitData;
  tokensUsed: number;
  rawResponse: string;
}

/**
 * Habit edit changes.
 */
export const HabitChangesSchema = z.object({
  name: z.string().optional(),
  type: z.enum(['do', 'avoid']).optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
  triggerTime: z.string().nullable().optional(),
  targetCount: z.number().optional(),
  workloadUnit: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export type HabitChanges = z.infer<typeof HabitChangesSchema>;

/**
 * AI edit result.
 */
export interface AIEditResult {
  targetHabitId: string | null;
  targetHabitName: string | null;
  candidates: Array<{ habitId: string; habitName: string; similarity: number }>;
  changes: HabitChanges;
  tokensUsed: number;
  confidence: number;
}

/**
 * Existing habit for edit context.
 */
export interface ExistingHabit {
  id: string;
  name: string;
  type: 'do' | 'avoid';
  frequency: 'daily' | 'weekly' | 'monthly';
  targetCount: number;
  workloadUnit: string | null;
}

/**
 * AI Service error codes.
 */
export enum AIErrorCode {
  PARSE_FAILED = 'PARSE_FAILED',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  INVALID_INPUT = 'INVALID_INPUT',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
}

/**
 * AI Service error.
 */
export class AIServiceError extends Error {
  readonly code: AIErrorCode;
  readonly retryAfter?: number | undefined;

  constructor(message: string, code: AIErrorCode, retryAfter?: number) {
    super(message);
    this.name = 'AIServiceError';
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

/**
 * Request schemas for AI Router.
 */
export const ParseHabitRequestSchema = z.object({
  text: z.string().min(1).max(500),
  context: z.object({
    existingHabits: z.array(z.object({
      id: z.string(),
      name: z.string(),
    })).optional(),
    existingGoals: z.array(z.object({
      id: z.string(),
      name: z.string(),
    })).optional(),
  }).optional(),
});

export type ParseHabitRequest = z.infer<typeof ParseHabitRequestSchema>;

export const EditHabitRequestSchema = z.object({
  text: z.string().min(1).max(500),
  habitId: z.string().uuid().optional(),
});

export type EditHabitRequest = z.infer<typeof EditHabitRequestSchema>;

/**
 * Response schemas for AI Router.
 */
export interface ParseHabitResponse {
  parsed: ParsedHabitData;
  tokensUsed: number;
  remainingTokens: number;
}

export interface EditHabitResponse {
  targetHabitId: string | null;
  targetHabitName: string | null;
  candidates: Array<{ habitId: string; habitName: string; similarity: number }>;
  changes: HabitChanges;
  tokensUsed: number;
  remainingTokens: number;
  confidence: number;
}
