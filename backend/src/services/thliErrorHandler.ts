/**
 * THLI Assessment Error Handler Service
 *
 * Handles error recovery, state saving, and assessment resumption
 * for THLI-24 assessments.
 *
 * Requirements:
 * - 18.1: Retry OpenAI API calls up to 3 times with exponential backoff (2s, 4s, 8s)
 * - 18.2: Save conversation state to failed_assessments table
 * - 18.3: Firewall is not treated as error (status "needs_more_data")
 * - 18.4: Complete current assessment even if quota exhausted mid-assessment
 * - 18.6: Store THLI assessment even if cross-framework gate fails
 * - 18.7: Resume assessment from last question
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { getLogger } from '../utils/logger.js';
import {
  withTHLIRetry,
  shouldSaveForResumption,
  type THLIRetryConfig,
  type THLIRetryResult,
} from '../utils/thliRetry.js';
import {
  wrapOpenAIError,
  getOpenAIUserFriendlyMessage,
  type OpenAIAPIError,
} from '../errors/openaiErrors.js';
import type {
  AssessmentSession,
  HabitFacts,
  AssessmentStepType,
  LevelEstimate,
  CrossFrameworkValidation,
} from '../types/thli.js';

const logger = getLogger('thliErrorHandler');

// =============================================================================
// Types
// =============================================================================

/**
 * Failed assessment record for database storage
 */
export interface FailedAssessmentRecord {
  id?: string;
  user_id: string;
  habit_id: string;
  conversation_id: string;
  session_id: string;
  gathered_facts: Partial<HabitFacts>;
  current_step: AssessmentStepType;
  conversation_history: ChatCompletionMessageParam[];
  error_message: string;
  error_code: string;
  retry_count: number;
  resumption_token: string;
  status: 'failed' | 'resumed' | 'completed' | 'expired';
  failed_at: string;
  resumed_at?: string;
  expires_at: string;
}

/**
 * Result of saving a failed assessment
 */
export interface SaveFailedAssessmentResult {
  success: boolean;
  resumptionToken?: string;
  userMessage: string;
  canResume: boolean;
}

/**
 * Result of loading a failed assessment for resumption
 */
export interface LoadFailedAssessmentResult {
  success: boolean;
  session?: Partial<AssessmentSession>;
  conversationHistory?: ChatCompletionMessageParam[];
  gatheredFacts?: Partial<HabitFacts>;
  error?: string;
}

/**
 * Assessment result with partial success handling
 */
export interface AssessmentResultWithWarnings {
  levelEstimate: LevelEstimate;
  crossFramework?: CrossFrameworkValidation;
  warnings: string[];
  gateStatus: 'pass' | 'fail' | 'skipped';
}

// =============================================================================
// THLI Error Handler Service
// =============================================================================

/**
 * THLI Assessment Error Handler Service
 *
 * Provides error handling, state saving, and resumption capabilities
 * for THLI-24 assessments.
 */
export class THLIErrorHandler {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  // ===========================================================================
  // 16.1: Retry Logic with Exponential Backoff
  // ===========================================================================

  /**
   * Execute an OpenAI API call with THLI-specific retry logic.
   *
   * Requirements: 18.1
   * - Retry up to 3 times
   * - Use delays: 2s, 4s, 8s
   * - Only retry on retryable errors (429, 5xx)
   *
   * @param fn - The async function to execute
   * @param config - Optional retry configuration
   * @returns Result with success status and retry info
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    config?: Partial<THLIRetryConfig>
  ): Promise<THLIRetryResult<T>> {
    return withTHLIRetry(fn, {
      maxRetries: 3,
      baseDelayMs: 2000, // 2s, 4s, 8s
      ...config,
      onRetry: (attempt, delay, error) => {
        logger.warning('THLI API retry', {
          attempt,
          delayMs: delay,
          errorType: error.name,
          errorMessage: error.message,
        });
      },
      onExhausted: (error, attempts) => {
        logger.error('THLI API retries exhausted', error, {
          totalAttempts: attempts,
        });
      },
    });
  }

  // ===========================================================================
  // 16.2: Conversation State Saving on Failure
  // ===========================================================================

  /**
   * Save conversation state when assessment fails after retries.
   *
   * Requirements: 18.2
   * - Save to failed_assessments table
   * - Return resumption token
   * - Display user-friendly message
   *
   * @param session - The assessment session
   * @param conversationHistory - The conversation history
   * @param error - The error that caused the failure
   * @param retryCount - Number of retry attempts
   * @returns Result with resumption token and user message
   */
  async saveFailedAssessment(
    session: AssessmentSession,
    conversationHistory: ChatCompletionMessageParam[],
    error: unknown,
    retryCount: number
  ): Promise<SaveFailedAssessmentResult> {
    logger.info('Saving failed assessment', {
      sessionId: session.sessionId,
      habitId: session.habitId,
      userId: session.userId,
      retryCount,
    });

    // Check if we should save for resumption
    if (!shouldSaveForResumption(error)) {
      const wrappedError = wrapOpenAIError(error);
      return {
        success: false,
        userMessage: getOpenAIUserFriendlyMessage(wrappedError),
        canResume: false,
      };
    }

    try {
      // Generate resumption token
      const resumptionToken = this.generateResumptionToken();

      // Calculate expiration (7 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const wrappedError = wrapOpenAIError(error);

      const record: FailedAssessmentRecord = {
        user_id: session.userId,
        habit_id: session.habitId,
        conversation_id: session.conversationId,
        session_id: session.sessionId,
        gathered_facts: session.gatheredFacts,
        current_step: session.currentStep,
        conversation_history: conversationHistory,
        error_message: getOpenAIUserFriendlyMessage(wrappedError),
        error_code: wrappedError.code || 'UNKNOWN_ERROR',
        retry_count: retryCount,
        resumption_token: resumptionToken,
        status: 'failed',
        failed_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      };

      const { error: insertError } = await this.supabase
        .from('failed_assessments')
        .insert(record);

      if (insertError) {
        logger.error('Failed to save failed assessment', insertError as Error, {
          sessionId: session.sessionId,
        });
        return {
          success: false,
          userMessage: '評価の保存に失敗しました。再度お試しください。',
          canResume: false,
        };
      }

      logger.info('Failed assessment saved successfully', {
        sessionId: session.sessionId,
        resumptionToken,
        expiresAt: expiresAt.toISOString(),
      });

      return {
        success: true,
        resumptionToken,
        userMessage: '評価を一時保存しました。後で続きから再開できます。',
        canResume: true,
      };
    } catch (err) {
      logger.error('Error saving failed assessment', err as Error, {
        sessionId: session.sessionId,
      });
      return {
        success: false,
        userMessage: '予期しないエラーが発生しました。',
        canResume: false,
      };
    }
  }

  // ===========================================================================
  // 16.3: Assessment Resumption
  // ===========================================================================

  /**
   * Load a failed assessment for resumption.
   *
   * Requirements: 18.7
   * - Load state from resumption token
   * - Continue conversation from last question
   *
   * @param resumptionToken - The resumption token
   * @param userId - The user ID (for authorization)
   * @returns The loaded assessment state
   */
  async loadFailedAssessment(
    resumptionToken: string,
    userId: string
  ): Promise<LoadFailedAssessmentResult> {
    logger.info('Loading failed assessment for resumption', {
      resumptionToken,
      userId,
    });

    try {
      const { data, error } = await this.supabase
        .from('failed_assessments')
        .select('*')
        .eq('resumption_token', resumptionToken)
        .eq('user_id', userId)
        .eq('status', 'failed')
        .single();

      if (error || !data) {
        logger.warning('Failed assessment not found', {
          resumptionToken,
          userId,
          error: error?.message,
        });
        return {
          success: false,
          error: '再開可能な評価が見つかりません。',
        };
      }

      // Check if expired
      if (new Date(data.expires_at) < new Date()) {
        logger.warning('Failed assessment expired', {
          resumptionToken,
          expiresAt: data.expires_at,
        });

        // Mark as expired
        await this.supabase
          .from('failed_assessments')
          .update({ status: 'expired' })
          .eq('id', data.id);

        return {
          success: false,
          error: '評価の有効期限が切れました。新しい評価を開始してください。',
        };
      }

      // Mark as resumed
      await this.supabase
        .from('failed_assessments')
        .update({
          status: 'resumed',
          resumed_at: new Date().toISOString(),
        })
        .eq('id', data.id);

      logger.info('Failed assessment loaded successfully', {
        resumptionToken,
        sessionId: data.session_id,
        currentStep: data.current_step,
      });

      return {
        success: true,
        session: {
          sessionId: data.session_id,
          habitId: data.habit_id,
          userId: data.user_id,
          conversationId: data.conversation_id,
          currentStep: data.current_step,
          gatheredFacts: data.gathered_facts,
          status: 'in_progress',
        },
        conversationHistory: data.conversation_history,
        gatheredFacts: data.gathered_facts,
      };
    } catch (err) {
      logger.error('Error loading failed assessment', err as Error, {
        resumptionToken,
      });
      return {
        success: false,
        error: '評価の読み込みに失敗しました。',
      };
    }
  }

  /**
   * Mark a resumed assessment as completed.
   *
   * @param resumptionToken - The resumption token
   */
  async markAssessmentCompleted(resumptionToken: string): Promise<void> {
    try {
      await this.supabase
        .from('failed_assessments')
        .update({ status: 'completed' })
        .eq('resumption_token', resumptionToken);

      logger.info('Resumed assessment marked as completed', { resumptionToken });
    } catch (err) {
      logger.warning('Failed to mark assessment as completed', {
        resumptionToken,
        error: (err as Error).message,
      });
    }
  }

  /**
   * Get pending failed assessments for a user.
   *
   * @param userId - The user ID
   * @returns List of pending failed assessments
   */
  async getPendingFailedAssessments(
    userId: string
  ): Promise<{ habitId: string; habitName: string; resumptionToken: string; failedAt: string }[]> {
    try {
      const { data, error } = await this.supabase
        .from('failed_assessments')
        .select(`
          habit_id,
          resumption_token,
          failed_at,
          habits!inner(name)
        `)
        .eq('user_id', userId)
        .eq('status', 'failed')
        .gt('expires_at', new Date().toISOString())
        .order('failed_at', { ascending: false });

      if (error || !data) {
        return [];
      }

      // Handle the joined data - habits is an array from the join
      return data.map((item: { habit_id: string; resumption_token: string; failed_at: string; habits: { name: string }[] }) => ({
        habitId: item.habit_id,
        habitName: item.habits[0]?.name || 'Unknown',
        resumptionToken: item.resumption_token,
        failedAt: item.failed_at,
      }));
    } catch (err) {
      logger.warning('Failed to get pending failed assessments', {
        userId,
        error: (err as Error).message,
      });
      return [];
    }
  }

  // ===========================================================================
  // 16.4: Firewall Non-Error Classification
  // ===========================================================================

  /**
   * Handle Missingness Firewall trigger.
   *
   * Requirements: 18.3
   * - Return status "needs_more_data" not "failed"
   * - Generate VOI questions
   *
   * @param session - The assessment session
   * @param voiQuestions - Generated VOI questions
   * @returns Assessment result with needs_more_data status
   */
  handleFirewallTrigger(
    session: AssessmentSession,
    voiQuestions: { factId: string; question: string; priority: number }[]
  ): {
    status: 'needs_more_data';
    message: string;
    voiQuestions: typeof voiQuestions;
    canContinue: boolean;
  } {
    logger.info('Firewall triggered - not an error', {
      sessionId: session.sessionId,
      habitId: session.habitId,
      voiQuestionCount: voiQuestions.length,
    });

    return {
      status: 'needs_more_data',
      message: 'より正確な評価のために追加情報が必要です。',
      voiQuestions,
      canContinue: true,
    };
  }

  // ===========================================================================
  // 16.5: Graceful Quota Exhaustion Handling
  // ===========================================================================

  /**
   * Check if assessment should continue despite quota exhaustion.
   *
   * Requirements: 18.4
   * - Complete current assessment even if quota exhausted mid-assessment
   * - Block only subsequent attempts
   *
   * @param userId - The user ID
   * @param isAssessmentInProgress - Whether an assessment is currently in progress
   * @returns Whether to allow the operation
   */
  async shouldAllowDespiteQuotaExhaustion(
    userId: string,
    isAssessmentInProgress: boolean
  ): Promise<{
    allowed: boolean;
    reason: string;
    showUpgradePrompt: boolean;
  }> {
    if (isAssessmentInProgress) {
      logger.info('Allowing assessment to complete despite quota exhaustion', {
        userId,
      });
      return {
        allowed: true,
        reason: '進行中の評価を完了します。',
        showUpgradePrompt: true, // Show after completion
      };
    }

    return {
      allowed: false,
      reason: '今月のTHLI-24評価回数の上限に達しました。',
      showUpgradePrompt: true,
    };
  }

  // ===========================================================================
  // 16.6: Partial Success for Cross-Framework Failures
  // ===========================================================================

  /**
   * Handle cross-framework validation failure with partial success.
   *
   * Requirements: 18.6
   * - Store THLI assessment even if gate fails
   * - Add warning flag
   * - Update habit level
   *
   * @param levelEstimate - The THLI-24 level estimate
   * @param crossFramework - The cross-framework validation result
   * @returns Assessment result with warnings
   */
  handleCrossFrameworkFailure(
    levelEstimate: LevelEstimate,
    crossFramework: CrossFrameworkValidation
  ): AssessmentResultWithWarnings {
    const warnings: string[] = [];

    if (crossFramework.gateStatus === 'fail') {
      logger.warning('Cross-framework validation failed - storing with warning', {
        thliLevel: levelEstimate.expected.min,
        tlxScore: crossFramework.tlxScore,
        srbaiScore: crossFramework.srbaiScore,
        combScore: crossFramework.combScore,
      });

      warnings.push(
        'クロスフレームワーク検証で不一致が検出されました。再評価をお勧めします。'
      );
    }

    return {
      levelEstimate,
      crossFramework,
      warnings,
      gateStatus: crossFramework.gateStatus,
    };
  }

  /**
   * Store assessment with warning flag when cross-framework fails.
   *
   * @param habitId - The habit ID
   * @param assessmentData - The assessment data to store
   * @param hasWarning - Whether to add warning flag
   */
  async storeAssessmentWithWarning(
    habitId: string,
    assessmentData: Record<string, unknown>,
    hasWarning: boolean
  ): Promise<void> {
    const dataWithWarning = {
      ...assessmentData,
      hasWarning,
      warningReason: hasWarning ? 'cross_framework_gate_fail' : null,
    };

    const { error } = await this.supabase
      .from('habits')
      .update({
        level_assessment_data: dataWithWarning,
        updated_at: new Date().toISOString(),
      })
      .eq('id', habitId);

    if (error) {
      logger.error('Failed to store assessment with warning', error as Error, {
        habitId,
        hasWarning,
      });
      throw error;
    }

    logger.info('Assessment stored with warning flag', {
      habitId,
      hasWarning,
    });
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Generate a unique resumption token.
   */
  private generateResumptionToken(): string {
    const randomBytes = new Uint8Array(16);
    crypto.getRandomValues(randomBytes);
    const hex = Array.from(randomBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return `fa_${hex}`;
  }

  /**
   * Wrap an error with user-friendly message.
   */
  wrapError(error: unknown): {
    error: OpenAIAPIError;
    userMessage: string;
    isRetryable: boolean;
  } {
    const wrappedError = wrapOpenAIError(error);
    return {
      error: wrappedError,
      userMessage: getOpenAIUserFriendlyMessage(wrappedError),
      isRetryable: wrappedError.isRetryable,
    };
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let thliErrorHandlerInstance: THLIErrorHandler | null = null;

/**
 * Get the THLI Error Handler singleton instance.
 */
export function getTHLIErrorHandler(supabase: SupabaseClient): THLIErrorHandler {
  if (!thliErrorHandlerInstance) {
    thliErrorHandlerInstance = new THLIErrorHandler(supabase);
  }
  return thliErrorHandlerInstance;
}

/**
 * Reset the THLI Error Handler instance (for testing).
 */
export function resetTHLIErrorHandler(): void {
  thliErrorHandlerInstance = null;
}
