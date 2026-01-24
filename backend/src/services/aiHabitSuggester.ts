/**
 * AI Habit Suggester Service
 *
 * Provides AI-powered habit suggestions for goals using OpenAI GPT-4o mini.
 * This is a Premium feature that consumes tokens.
 *
 * Requirements: 11.1, 11.2, 11.6
 */

import OpenAI from 'openai';
import { getSettings } from '../config.js';
import { getLogger } from '../utils/logger.js';
import { AI_CONFIG, AIErrorCode, AIServiceError } from '../schemas/ai.js';
import type { Goal, Habit } from '../schemas/habit.js';

const logger = getLogger('aiHabitSuggester');

/**
 * Habit suggestion from AI.
 */
export interface HabitSuggestion {
  /** Suggested habit name */
  name: string;
  /** Habit type: do or avoid */
  type: 'do' | 'avoid';
  /** Recommended frequency */
  frequency: 'daily' | 'weekly' | 'monthly';
  /** Suggested target count */
  suggestedTargetCount: number;
  /** Workload unit (e.g., "分", "回", "ページ") */
  workloadUnit: string | null;
  /** Reason for this suggestion */
  reason: string;
  /** Confidence score 0.0-1.0 */
  confidence: number;
}

/**
 * Result of habit suggestion generation.
 */
export interface HabitSuggestionResult {
  /** List of suggested habits */
  suggestions: HabitSuggestion[];
  /** Tokens used for this operation */
  tokensUsed: number;
  /** Raw AI response for debugging */
  rawResponse: string;
}

/**
 * Prompt template for habit suggestion.
 */
const HABIT_SUGGESTION_PROMPT = `あなたは習慣管理アプリのコーチです。
ユーザーのゴールを達成するために効果的な習慣を3つ提案してください。

ゴール情報:
- 名前: {goalName}
- 説明: {goalDescription}

既存の習慣（重複を避けてください）:
{existingHabits}

ユーザーの習慣達成パターン:
{achievementPattern}

以下のJSON形式のみで出力してください（説明文は不要）:
{
  "suggestions": [
    {
      "name": "習慣名（簡潔に、20文字以内）",
      "type": "do",
      "frequency": "daily",
      "suggestedTargetCount": 1,
      "workloadUnit": "回" または null,
      "reason": "この習慣がゴール達成に効果的な理由（50文字以内）",
      "confidence": 0.8
    }
  ]
}

注意:
- 既存の習慣と重複しない提案をする
- 実行可能で具体的な習慣を提案する
- ゴールとの関連性を明確にする
- 小さく始められる習慣を優先する
- 数量や時間が明確な場合はsuggestedTargetCountとworkloadUnitを設定`;

/**
 * AI Habit Suggester Service.
 *
 * Property 17: AI Habit Suggestion Uniqueness
 * For any AI-generated habit suggestion for a goal, the AI_Habit_Suggester
 * SHALL ensure the suggested habit name does not match any existing habit
 * name for the user (case-insensitive comparison).
 */
export class AIHabitSuggesterService {
  private readonly openai: OpenAI | null = null;
  private readonly model: string;
  private circuitBreakerOpen = false;
  private circuitBreakerResetTime = 0;
  private consecutiveFailures = 0;
  private readonly maxConsecutiveFailures = 5;
  private readonly circuitBreakerTimeout = 60000; // 1 minute

  constructor() {
    const settings = getSettings();
    this.model = settings.openaiModel || AI_CONFIG.model;

    if (settings.openaiApiKey) {
      this.openai = new OpenAI({
        apiKey: settings.openaiApiKey,
      });
    }
  }

  /**
   * Check if AI service is available.
   */
  isAvailable(): boolean {
    if (this.circuitBreakerOpen) {
      if (Date.now() > this.circuitBreakerResetTime) {
        this.circuitBreakerOpen = false;
        this.consecutiveFailures = 0;
        logger.info('Circuit breaker reset');
      } else {
        return false;
      }
    }
    return this.openai !== null;
  }

  /**
   * Suggest habits for a goal.
   *
   * Requirements: 11.1, 11.2
   *
   * @param goal - The goal to suggest habits for
   * @param existingHabits - User's existing habits to avoid duplicates
   * @param achievementPattern - Optional achievement pattern info
   * @returns Habit suggestions with token usage
   */
  async suggestHabitsForGoal(
    goal: Goal,
    existingHabits: Habit[],
    achievementPattern?: {
      averageCompletionRate: number;
      preferredFrequency: 'daily' | 'weekly' | 'monthly';
      averageTargetCount: number;
    }
  ): Promise<HabitSuggestionResult> {
    if (!this.isAvailable()) {
      throw new AIServiceError(
        'AIサービスが一時的に利用できません',
        AIErrorCode.PROVIDER_ERROR,
        Math.ceil((this.circuitBreakerResetTime - Date.now()) / 1000)
      );
    }

    if (!this.openai) {
      throw new AIServiceError('OpenAI API key not configured', AIErrorCode.PROVIDER_ERROR);
    }

    // Build existing habits context
    const existingHabitsContext = existingHabits.length > 0
      ? existingHabits.map(h => `- ${h.name}`).join('\n')
      : '（なし）';

    // Build achievement pattern context
    let achievementPatternContext = '（データなし）';
    if (achievementPattern) {
      achievementPatternContext = `
- 平均達成率: ${Math.round(achievementPattern.averageCompletionRate)}%
- よく使う頻度: ${achievementPattern.preferredFrequency}
- 平均目標数: ${achievementPattern.averageTargetCount}`;
    }

    const prompt = HABIT_SUGGESTION_PROMPT
      .replace('{goalName}', goal.name)
      .replace('{goalDescription}', goal.description || '（説明なし）')
      .replace('{existingHabits}', existingHabitsContext)
      .replace('{achievementPattern}', achievementPatternContext);

    try {
      const response = await this.callOpenAIWithRetry(prompt);
      const suggestions = this.parseSuggestionResponse(response.content, existingHabits);

      this.recordSuccess();

      return {
        suggestions,
        tokensUsed: response.tokensUsed,
        rawResponse: response.content,
      };
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Validate a suggestion against existing habits.
   *
   * Property 17: AI Habit Suggestion Uniqueness
   * Requirements: 11.6
   *
   * @param suggestion - The suggestion to validate
   * @param existingHabits - User's existing habits
   * @returns true if the suggestion is unique
   */
  validateSuggestion(suggestion: HabitSuggestion, existingHabits: Habit[]): boolean {
    const suggestionNameLower = suggestion.name.toLowerCase().trim();
    
    for (const habit of existingHabits) {
      const habitNameLower = habit.name.toLowerCase().trim();
      
      // Exact match check
      if (suggestionNameLower === habitNameLower) {
        return false;
      }
      
      // Partial match check (if one contains the other)
      if (suggestionNameLower.includes(habitNameLower) || habitNameLower.includes(suggestionNameLower)) {
        // Allow if the names are significantly different in length
        const lengthRatio = Math.min(suggestionNameLower.length, habitNameLower.length) /
                          Math.max(suggestionNameLower.length, habitNameLower.length);
        if (lengthRatio > 0.7) {
          return false;
        }
      }
    }
    
    return true;
  }

  /**
   * Call OpenAI API with exponential backoff retry.
   */
  private async callOpenAIWithRetry(
    prompt: string,
    retries = AI_CONFIG.maxRetries
  ): Promise<{ content: string; tokensUsed: number }> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const completion = await this.openai!.chat.completions.create({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'あなたは習慣管理アプリのコーチです。JSONのみで応答してください。',
            },
            { role: 'user', content: prompt },
          ],
          temperature: AI_CONFIG.temperature,
          max_tokens: AI_CONFIG.maxTokensPerRequest,
          response_format: { type: 'json_object' },
        });

        const content = completion.choices[0]?.message?.content || '';
        const tokensUsed = completion.usage?.total_tokens || 0;

        logger.debug('OpenAI API call successful', {
          model: this.model,
          tokensUsed,
          attempt,
        });

        return { content, tokensUsed };
      } catch (error) {
        lastError = error as Error;

        // Check for rate limiting
        if (error instanceof OpenAI.RateLimitError) {
          const retryAfter = 60;
          if (attempt < retries) {
            const delay = AI_CONFIG.retryDelayMs * Math.pow(2, attempt);
            logger.warning('Rate limited, retrying', { attempt, delay });
            await this.sleep(delay);
            continue;
          }
          throw new AIServiceError(
            'APIレート制限に達しました',
            AIErrorCode.RATE_LIMITED,
            retryAfter
          );
        }

        // Check for API errors
        if (error instanceof OpenAI.APIError) {
          if (attempt < retries && error.status && error.status >= 500) {
            const delay = AI_CONFIG.retryDelayMs * Math.pow(2, attempt);
            logger.warning('API error, retrying', { attempt, delay, status: error.status });
            await this.sleep(delay);
            continue;
          }
        }

        logger.error('OpenAI API call failed', undefined, { errMsg: lastError?.message, attempt });
        throw new AIServiceError(
          'AI処理中にエラーが発生しました',
          AIErrorCode.PROVIDER_ERROR
        );
      }
    }

    throw new AIServiceError(
      'AI処理中にエラーが発生しました',
      AIErrorCode.PROVIDER_ERROR
    );
  }

  /**
   * Parse suggestion response from AI.
   */
  private parseSuggestionResponse(content: string, existingHabits: Habit[]): HabitSuggestion[] {
    try {
      const json = JSON.parse(content) as { suggestions?: unknown[] };
      
      if (!json.suggestions || !Array.isArray(json.suggestions)) {
        logger.warning('Invalid suggestion response format', { content });
        return [];
      }

      const suggestions: HabitSuggestion[] = [];
      
      for (const item of json.suggestions) {
        const suggestion = item as Record<string, unknown>;
        
        const parsed: HabitSuggestion = {
          name: String(suggestion['name'] || '').slice(0, 100),
          type: suggestion['type'] === 'avoid' ? 'avoid' : 'do',
          frequency: this.parseFrequency(suggestion['frequency']),
          suggestedTargetCount: Math.max(1, Number(suggestion['suggestedTargetCount']) || 1),
          workloadUnit: suggestion['workloadUnit'] ? String(suggestion['workloadUnit']) : null,
          reason: String(suggestion['reason'] || '').slice(0, 200),
          confidence: Math.min(1, Math.max(0, Number(suggestion['confidence']) || 0.5)),
        };

        // Validate uniqueness (Property 17)
        if (parsed.name && this.validateSuggestion(parsed, existingHabits)) {
          suggestions.push(parsed);
        } else {
          logger.debug('Filtered out duplicate suggestion', { name: parsed.name });
        }
      }

      return suggestions.slice(0, 3); // Return max 3 suggestions
    } catch (err) {
      logger.error('Failed to parse suggestion response', err instanceof Error ? err : undefined, { content });
      throw new AIServiceError('AI応答の解析に失敗しました', AIErrorCode.INVALID_RESPONSE);
    }
  }

  /**
   * Parse frequency from AI response.
   */
  private parseFrequency(value: unknown): 'daily' | 'weekly' | 'monthly' {
    if (value === 'weekly') return 'weekly';
    if (value === 'monthly') return 'monthly';
    return 'daily';
  }

  /**
   * Record successful API call.
   */
  private recordSuccess(): void {
    this.consecutiveFailures = 0;
  }

  /**
   * Record failed API call and potentially open circuit breaker.
   */
  private recordFailure(): void {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      this.circuitBreakerOpen = true;
      this.circuitBreakerResetTime = Date.now() + this.circuitBreakerTimeout;
      logger.warning('Circuit breaker opened', {
        consecutiveFailures: this.consecutiveFailures,
        resetTime: new Date(this.circuitBreakerResetTime).toISOString(),
      });
    }
  }

  /**
   * Sleep for specified milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
let _aiHabitSuggester: AIHabitSuggesterService | null = null;

/**
 * Get or create the singleton AI habit suggester instance.
 */
export function getAIHabitSuggester(): AIHabitSuggesterService {
  if (_aiHabitSuggester === null) {
    _aiHabitSuggester = new AIHabitSuggesterService();
  }
  return _aiHabitSuggester;
}

/**
 * Reset the singleton instance (useful for testing).
 */
export function resetAIHabitSuggester(): void {
  _aiHabitSuggester = null;
}
