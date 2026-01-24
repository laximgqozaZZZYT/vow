/**
 * Natural Language Habit Parser Service
 *
 * Parses natural language input to extract habit data using AI and rule-based methods.
 *
 * Requirements: 3.1, 3.2, 4.1, 4.2
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getAIService } from './aiService.js';
import { getTokenManager } from './tokenManager.js';
import { getLogger } from '../utils/logger.js';
import {
  AIServiceError,
  AIErrorCode,
  type ParsedHabitData,
  type AIEditResult,
  type ExistingHabit,
  type ParseContext,
} from '../schemas/ai.js';

const logger = getLogger('nlHabitParser');

/**
 * Time pattern regex for extracting trigger times.
 */
const TIME_PATTERNS = [
  // Japanese patterns
  /(?:毎朝|朝)(\d{1,2})時(?:(\d{1,2})分)?/,
  /(?:毎晩|夜|晩)(\d{1,2})時(?:(\d{1,2})分)?/,
  /(\d{1,2})時(?:(\d{1,2})分)?(?:に|から)/,
  // English patterns
  /(\d{1,2}):(\d{2})\s*(?:am|pm)?/i,
  /(\d{1,2})\s*(?:am|pm)/i,
];

/**
 * Frequency pattern regex for extracting frequency.
 */
const FREQUENCY_PATTERNS = {
  daily: [
    /毎日/,
    /毎朝/,
    /毎晩/,
    /毎夜/,
    /日課/,
    /daily/i,
    /every\s*day/i,
  ],
  weekly: [
    /毎週/,
    /週に/,
    /週間/,
    /weekly/i,
    /every\s*week/i,
  ],
  monthly: [
    /毎月/,
    /月に/,
    /monthly/i,
    /every\s*month/i,
  ],
};

/**
 * Avoid type patterns.
 */
const AVOID_PATTERNS = [
  /やめる/,
  /しない/,
  /控える/,
  /減らす/,
  /禁止/,
  /断つ/,
  /avoid/i,
  /stop/i,
  /quit/i,
  /don't/i,
  /no\s+more/i,
];

/**
 * NL Habit Parser Service.
 */
export class NLHabitParserService {
  private readonly aiService: ReturnType<typeof getAIService>;
  private readonly tokenManager: ReturnType<typeof getTokenManager>;
  private readonly supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.aiService = getAIService();
    this.tokenManager = getTokenManager(supabase);
    this.supabase = supabase;
  }

  /**
   * Parse natural language text to habit data.
   *
   * Requirements: 3.1, 3.2
   */
  async parse(
    userId: string,
    text: string,
    context?: ParseContext
  ): Promise<{ parsed: ParsedHabitData; tokensUsed: number; remainingTokens: number }> {
    // Check quota before calling AI
    const quotaCheck = await this.tokenManager.checkQuota(userId, 1000); // Estimate 1000 tokens
    if (!quotaCheck.allowed) {
      throw new AIServiceError(
        '今月のトークン上限に達しました',
        AIErrorCode.QUOTA_EXCEEDED
      );
    }

    // Call AI service
    const result = await this.aiService.parseHabitFromText(text, context);

    // Record token usage
    await this.tokenManager.recordUsage(userId, 'habit_parse', result.tokensUsed);

    // Get updated remaining tokens
    const usage = await this.tokenManager.getUsage(userId);
    const remainingTokens = Math.max(0, usage.monthlyQuota - usage.usedQuota);

    logger.info('Parsed habit from text', {
      userId,
      tokensUsed: result.tokensUsed,
      confidence: result.parsed.confidence,
    });

    return {
      parsed: result.parsed,
      tokensUsed: result.tokensUsed,
      remainingTokens,
    };
  }

  /**
   * Parse edit command from natural language text.
   *
   * Requirements: 4.1, 4.2
   */
  async parseEdit(
    userId: string,
    text: string,
    existingHabits: ExistingHabit[]
  ): Promise<AIEditResult & { remainingTokens: number }> {
    // Check quota before calling AI
    const quotaCheck = await this.tokenManager.checkQuota(userId, 1000);
    if (!quotaCheck.allowed) {
      throw new AIServiceError(
        '今月のトークン上限に達しました',
        AIErrorCode.QUOTA_EXCEEDED
      );
    }

    // Call AI service
    const result = await this.aiService.parseEditCommand(text, existingHabits);

    // Record token usage
    await this.tokenManager.recordUsage(userId, 'habit_edit', result.tokensUsed);

    // Get updated remaining tokens
    const usage = await this.tokenManager.getUsage(userId);
    const remainingTokens = Math.max(0, usage.monthlyQuota - usage.usedQuota);

    logger.info('Parsed edit command', {
      userId,
      tokensUsed: result.tokensUsed,
      targetHabitId: result.targetHabitId,
      confidence: result.confidence,
    });

    return {
      ...result,
      remainingTokens,
    };
  }

  /**
   * Extract frequency from text using rule-based patterns.
   */
  extractFrequency(text: string): 'daily' | 'weekly' | 'monthly' | null {
    for (const [frequency, patterns] of Object.entries(FREQUENCY_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          return frequency as 'daily' | 'weekly' | 'monthly';
        }
      }
    }
    return null;
  }

  /**
   * Extract time from text using rule-based patterns.
   */
  extractTime(text: string): string | null {
    for (const pattern of TIME_PATTERNS) {
      const match = text.match(pattern);
      if (match && match[1]) {
        let hours = parseInt(match[1], 10);
        const minutes = match[2] ? parseInt(match[2], 10) : 0;

        // Handle PM for English patterns
        if (/pm/i.test(text) && hours < 12) {
          hours += 12;
        }
        // Handle AM for English patterns
        if (/am/i.test(text) && hours === 12) {
          hours = 0;
        }

        // Validate hours and minutes
        if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
          return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }
      }
    }
    return null;
  }

  /**
   * Detect if text indicates an "avoid" type habit.
   */
  isAvoidType(text: string): boolean {
    return AVOID_PATTERNS.some(pattern => pattern.test(text));
  }

  /**
   * Match text to existing habits using similarity.
   */
  matchExistingHabit(
    text: string,
    habits: ExistingHabit[]
  ): { habit: ExistingHabit; similarity: number } | null {
    if (habits.length === 0) {
      return null;
    }

    const normalizedText = this.normalizeText(text);
    let bestMatch: { habit: ExistingHabit; similarity: number } | null = null;

    for (const habit of habits) {
      const normalizedName = this.normalizeText(habit.name);
      const similarity = this.calculateSimilarity(normalizedText, normalizedName);

      if (similarity > 0.5 && (!bestMatch || similarity > bestMatch.similarity)) {
        bestMatch = { habit, similarity };
      }
    }

    return bestMatch;
  }

  /**
   * Get user's existing habits for context.
   */
  async getUserHabits(userId: string): Promise<ExistingHabit[]> {
    const { data, error } = await this.supabase
      .from('habits')
      .select('id, name, type, frequency, target_count, workload_unit')
      .eq('owner_id', userId)
      .eq('is_active', true);

    if (error) {
      logger.error('Failed to get user habits', undefined, { userId });
      return [];
    }

    return (data || []).map((h: Record<string, unknown>) => ({
      id: h['id'] as string,
      name: h['name'] as string,
      type: h['type'] as 'do' | 'avoid',
      frequency: h['frequency'] as 'daily' | 'weekly' | 'monthly',
      targetCount: (h['target_count'] as number) || 1,
      workloadUnit: h['workload_unit'] as string | null,
    }));
  }

  /**
   * Get user's existing goals for context.
   */
  async getUserGoals(userId: string): Promise<Array<{ id: string; name: string }>> {
    const { data, error } = await this.supabase
      .from('goals')
      .select('id, name')
      .eq('owner_id', userId)
      .eq('is_active', true);

    if (error) {
      logger.error('Failed to get user goals', undefined, { userId });
      return [];
    }

    return (data || []).map((g: Record<string, unknown>) => ({
      id: g['id'] as string,
      name: g['name'] as string,
    }));
  }

  /**
   * Normalize text for comparison.
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[\s\u3000]+/g, '') // Remove whitespace
      .replace(/[。、！？!?,\.]/g, ''); // Remove punctuation
  }

  /**
   * Calculate similarity between two strings using Levenshtein distance.
   */
  private calculateSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length === 0 || b.length === 0) return 0;

    // Check if one contains the other
    if (a.includes(b) || b.includes(a)) {
      return Math.min(a.length, b.length) / Math.max(a.length, b.length);
    }

    // Levenshtein distance
    const matrix: (number | undefined)[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    const firstRow = matrix[0];
    if (firstRow) {
      for (let j = 0; j <= a.length; j++) {
        firstRow[j] = j;
      }
    }

    for (let i = 1; i <= b.length; i++) {
      const currentRow = matrix[i];
      const prevRow = matrix[i - 1];
      if (!currentRow || !prevRow) continue;
      
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          currentRow[j] = prevRow[j - 1] ?? 0;
        } else {
          currentRow[j] = Math.min(
            (prevRow[j - 1] ?? 0) + 1, // substitution
            (currentRow[j - 1] ?? 0) + 1, // insertion
            (prevRow[j] ?? 0) + 1 // deletion
          );
        }
      }
    }

    const lastRow = matrix[b.length];
    const distance = lastRow?.[a.length] ?? 0;
    const maxLength = Math.max(a.length, b.length);
    return 1 - distance / maxLength;
  }
}

// Singleton instance
let _nlHabitParser: NLHabitParserService | null = null;

/**
 * Get or create the singleton NL Habit Parser service instance.
 */
export function getNLHabitParser(supabase: SupabaseClient): NLHabitParserService {
  if (_nlHabitParser === null) {
    _nlHabitParser = new NLHabitParserService(supabase);
  }
  return _nlHabitParser;
}

/**
 * Reset the singleton instance (useful for testing).
 */
export function resetNLHabitParser(): void {
  _nlHabitParser = null;
}
