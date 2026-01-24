/**
 * AI Service
 *
 * Provides AI-powered natural language parsing for habits using OpenAI GPT-4o mini.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

import OpenAI from 'openai';
import { getSettings } from '../config.js';
import { getLogger } from '../utils/logger.js';
import {
  AI_CONFIG,
  AIErrorCode,
  AIServiceError,
  ParsedHabitDataSchema,
  type AIParseResult,
  type AIEditResult,
  type ParseContext,
  type ParsedHabitData,
  type HabitChanges,
  type ExistingHabit,
  type AIProvider,
} from '../schemas/ai.js';

const logger = getLogger('aiService');

/**
 * Prompt templates for AI operations.
 */
const PROMPTS = {
  habitParse: `あなたは習慣管理アプリのアシスタントです。
ユーザーの自然言語入力から習慣データを抽出してください。

入力: {userInput}

{goalsContext}

以下のJSON形式のみで出力してください（説明文は不要）:
{
  "name": "習慣名（簡潔に）",
  "type": "do" または "avoid",
  "frequency": "daily", "weekly", または "monthly",
  "triggerTime": "HH:MM形式（該当する場合、なければnull）",
  "duration": 分単位の数値（該当する場合、なければnull）,
  "targetCount": 目標回数や数量（該当する場合、なければnull）,
  "workloadUnit": "回", "分", "ページ"など単位（該当する場合、なければnull）,
  "goalId": "関連するゴールID（該当する場合、なければnull）",
  "confidence": 0.0-1.0の信頼度
}

注意:
- 時刻が明示されていない場合はtriggerTimeをnullに
- 頻度が明示されていない場合はdailyをデフォルトに
- 「やめる」「しない」「控える」などの表現はtype: "avoid"に
- 数量が明示されている場合はtargetCountとworkloadUnitを設定`,

  habitEdit: `あなたは習慣管理アプリのアシスタントです。
ユーザーの編集コマンドから、対象の習慣と変更内容を特定してください。

入力: {userInput}

既存の習慣:
{existingHabits}

以下のJSON形式のみで出力してください（説明文は不要）:
{
  "targetHabitId": "対象の習慣ID（特定できない場合はnull）",
  "targetHabitName": "対象の習慣名（特定できない場合はnull）",
  "candidates": [
    {"habitId": "ID", "habitName": "名前", "similarity": 0.0-1.0}
  ],
  "changes": {
    "name": "新しい名前（変更する場合）",
    "frequency": "daily/weekly/monthly（変更する場合）",
    "triggerTime": "HH:MM（変更する場合）",
    "targetCount": 数値（変更する場合）,
    "workloadUnit": "単位（変更する場合）",
    "isActive": true/false（変更する場合）
  },
  "confidence": 0.0-1.0の信頼度
}

注意:
- 対象が特定できない場合はtargetHabitIdをnullに
- 複数の候補がある場合はcandidatesに類似度順で列挙
- changesには変更するフィールドのみ含める
- 「やめる」「停止」などはisActive: falseに`,
};

/**
 * AI Service for natural language habit parsing.
 */
export class AIService {
  private readonly openai: OpenAI | null = null;
  private readonly provider: AIProvider;
  private readonly model: string;
  private circuitBreakerOpen = false;
  private circuitBreakerResetTime = 0;
  private consecutiveFailures = 0;
  private readonly maxConsecutiveFailures = 5;
  private readonly circuitBreakerTimeout = 60000; // 1 minute

  constructor() {
    const settings = getSettings();
    this.provider = AI_CONFIG.provider;
    this.model = settings.openaiModel || AI_CONFIG.model;

    if (settings.openaiApiKey) {
      this.openai = new OpenAI({
        apiKey: settings.openaiApiKey,
      });
    }
  }

  /**
   * Get the current AI provider.
   */
  getProvider(): AIProvider {
    return this.provider;
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
   * Parse habit from natural language text.
   *
   * Requirements: 9.1, 9.2, 9.3
   */
  async parseHabitFromText(text: string, context?: ParseContext): Promise<AIParseResult> {
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

    // Build goals context
    let goalsContext = '';
    if (context?.existingGoals && context.existingGoals.length > 0) {
      goalsContext = `既存のゴール:\n${context.existingGoals.map(g => `- ${g.id}: ${g.name}`).join('\n')}`;
    }

    const prompt = PROMPTS.habitParse
      .replace('{userInput}', text)
      .replace('{goalsContext}', goalsContext);

    try {
      const response = await this.callOpenAIWithRetry(prompt);
      const parsed = this.parseHabitResponse(response.content);

      this.recordSuccess();

      return {
        parsed,
        tokensUsed: response.tokensUsed,
        rawResponse: response.content,
      };
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Parse edit command from natural language text.
   *
   * Requirements: 9.1, 9.2
   */
  async parseEditCommand(text: string, existingHabits: ExistingHabit[]): Promise<AIEditResult> {
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

    // Build habits context
    const habitsContext = existingHabits
      .map(h => `- ${h.id}: ${h.name} (${h.type}, ${h.frequency}, ${h.targetCount}${h.workloadUnit || '回'})`)
      .join('\n');

    const prompt = PROMPTS.habitEdit
      .replace('{userInput}', text)
      .replace('{existingHabits}', habitsContext || '（なし）');

    try {
      const response = await this.callOpenAIWithRetry(prompt);
      const result = this.parseEditResponse(response.content);

      this.recordSuccess();

      return {
        ...result,
        tokensUsed: response.tokensUsed,
      };
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Call OpenAI API with exponential backoff retry.
   *
   * Requirements: 9.4
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
              content: 'あなたは習慣管理アプリのアシスタントです。JSONのみで応答してください。',
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
          const retryAfter = 60; // Default to 60 seconds
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
   * Parse habit response from AI.
   */
  private parseHabitResponse(content: string): ParsedHabitData {
    try {
      const json = JSON.parse(content) as Record<string, unknown>;
      const result = ParsedHabitDataSchema.safeParse(json);

      if (!result.success) {
        logger.warning('Invalid habit parse response', { errors: result.error.errors });
        // Return with defaults for missing fields
        return {
          name: (json['name'] as string) || '新しい習慣',
          type: json['type'] === 'avoid' ? 'avoid' : 'do',
          frequency: (json['frequency'] as 'daily' | 'weekly' | 'monthly' | null) ?? 'daily',
          triggerTime: (json['triggerTime'] as string | null) || null,
          duration: (json['duration'] as number | null) || null,
          targetCount: (json['targetCount'] as number | null) || null,
          workloadUnit: (json['workloadUnit'] as string | null) || null,
          goalId: (json['goalId'] as string | null) || null,
          confidence: typeof json['confidence'] === 'number' ? json['confidence'] : 0.5,
        };
      }

      return result.data;
    } catch (err) {
      logger.error('Failed to parse habit response', err instanceof Error ? err : undefined, { content });
      throw new AIServiceError('AI応答の解析に失敗しました', AIErrorCode.INVALID_RESPONSE);
    }
  }

  /**
   * Parse edit response from AI.
   */
  private parseEditResponse(content: string): Omit<AIEditResult, 'tokensUsed'> {
    try {
      const json = JSON.parse(content) as Record<string, unknown>;
      const jsonChanges = json['changes'] as Record<string, unknown> | undefined;

      const changes: HabitChanges = {};
      if (jsonChanges) {
        if (jsonChanges['name']) changes.name = jsonChanges['name'] as string;
        if (jsonChanges['type']) changes.type = jsonChanges['type'] as 'do' | 'avoid';
        if (jsonChanges['frequency']) changes.frequency = jsonChanges['frequency'] as 'daily' | 'weekly' | 'monthly';
        if (jsonChanges['triggerTime'] !== undefined) changes.triggerTime = jsonChanges['triggerTime'] as string | null;
        if (jsonChanges['targetCount'] !== undefined) changes.targetCount = jsonChanges['targetCount'] as number;
        if (jsonChanges['workloadUnit'] !== undefined) changes.workloadUnit = jsonChanges['workloadUnit'] as string | null;
        if (jsonChanges['isActive'] !== undefined) changes.isActive = jsonChanges['isActive'] as boolean;
      }

      return {
        targetHabitId: (json['targetHabitId'] as string | null) || null,
        targetHabitName: (json['targetHabitName'] as string | null) || null,
        candidates: Array.isArray(json['candidates']) ? json['candidates'] as Array<{ habitId: string; habitName: string; similarity: number }> : [],
        changes,
        confidence: typeof json['confidence'] === 'number' ? json['confidence'] : 0.5,
      };
    } catch (err) {
      logger.error('Failed to parse edit response', err instanceof Error ? err : undefined, { content });
      throw new AIServiceError('AI応答の解析に失敗しました', AIErrorCode.INVALID_RESPONSE);
    }
  }

  /**
   * Record successful API call.
   */
  private recordSuccess(): void {
    this.consecutiveFailures = 0;
  }

  /**
   * Record failed API call and potentially open circuit breaker.
   *
   * Requirements: 9.5
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
let _aiService: AIService | null = null;

/**
 * Get or create the singleton AI service instance.
 */
export function getAIService(): AIService {
  if (_aiService === null) {
    _aiService = new AIService();
  }
  return _aiService;
}

/**
 * Reset the singleton instance (useful for testing).
 */
export function resetAIService(): void {
  _aiService = null;
}
