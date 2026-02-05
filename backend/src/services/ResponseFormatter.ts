/**
 * Response Formatter Service
 *
 * Service for formatting AI responses into unified candidate button format.
 * Ensures all responses include buttons and validates response structure.
 *
 * Requirements: MOC-CANDIDATE-BTN-001
 * Reference: /home/ubuntu/Downloads/vow/specs/moc-chat-candidate-buttons/
 *
 * @module services/ResponseFormatter
 */

import { z } from 'zod';
import {
  UnifiedChatResponseSchema,
  ensureButtonsPresent,
  safeValidateUnifiedResponse,
  type UnifiedChatResponse,
  type UnifiedButton,
  type HabitDetail,
  type GoalDetail,
  type StickyNDetail,
} from '../schemas/candidate-button.schema.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('ResponseFormatter');

// =============================================================================
// Response Formatter Class
// =============================================================================

/**
 * Response formatter for AI responses
 * Provides utilities to format, validate, and ensure candidate buttons
 */
export class ResponseFormatter {
  /**
   * Ensures the response has at least one button
   * If no buttons provided, adds a default continuation button
   *
   * @param response - Partial response object
   * @param locale - Language locale (default: 'ja')
   * @returns Complete unified response with at least one button
   */
  static ensureButtonsPresent(
    response: Partial<UnifiedChatResponse>,
    locale: 'ja' | 'en' = 'ja'
  ): UnifiedChatResponse {
    return ensureButtonsPresent(response, locale);
  }

  /**
   * Validates response against schema
   * Throws ZodError if validation fails
   *
   * @param response - Response object to validate
   * @returns Validated unified response
   * @throws ZodError if validation fails
   */
  static validate(response: unknown): UnifiedChatResponse {
    return UnifiedChatResponseSchema.parse(response);
  }

  /**
   * Safe validates response against schema
   * Returns result object instead of throwing
   *
   * @param response - Response object to validate
   * @returns Result object with success flag and data or error
   */
  static safeValidate(response: unknown): {
    success: boolean;
    data?: UnifiedChatResponse;
    error?: z.ZodError;
  } {
    return safeValidateUnifiedResponse(response);
  }

  /**
   * Parses JSON string into unified response
   * Validates and ensures buttons are present
   *
   * @param jsonString - JSON string to parse
   * @param locale - Language locale (default: 'ja')
   * @returns Unified response with validation
   * @throws Error if JSON parsing or validation fails
   */
  static parseJSON(jsonString: string, locale: 'ja' | 'en' = 'ja'): UnifiedChatResponse {
    try {
      const parsed = JSON.parse(jsonString);
      const validated = ResponseFormatter.validate(parsed);
      return ResponseFormatter.ensureButtonsPresent(validated, locale);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to parse JSON response', err);
      throw new Error(`Invalid JSON response: ${err.message}`);
    }
  }

  /**
   * Safely parses JSON string into unified response
   * Returns result object instead of throwing
   *
   * @param jsonString - JSON string to parse
   * @param locale - Language locale (default: 'ja')
   * @returns Result object with success flag and data or error
   */
  static safeParseJSON(jsonString: string, locale: 'ja' | 'en' = 'ja'): {
    success: boolean;
    data?: UnifiedChatResponse;
    error?: Error;
  } {
    try {
      const parsed = JSON.parse(jsonString);
      const result = ResponseFormatter.safeValidate(parsed);

      if (!result.success) {
        return {
          success: false,
          error: new Error(`Validation failed: ${result.error?.message}`),
        };
      }

      const ensured = ResponseFormatter.ensureButtonsPresent(result.data!, locale);
      return { success: true, data: ensured };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to safely parse JSON response', err);
      return {
        success: false,
        error: err,
      };
    }
  }

  /**
   * Formats habit suggestion into unified button
   *
   * @param habit - Habit suggestion data
   * @param locale - Language locale (default: 'ja')
   * @returns Unified button for habit suggestion
   */
  static formatHabitSuggestion(
    habit: {
      name: string;
      comment?: string;
      detail?: Partial<HabitDetail>;
    },
    _locale: 'ja' | 'en' = 'ja'
  ): UnifiedButton {
    return {
      type: 'Habit',
      label: habit.name,
      comment: habit.comment,
      detail: {
        type: 'Habit',
        name: habit.name,
        ...habit.detail,
      },
    };
  }

  /**
   * Formats goal suggestion into unified button
   *
   * @param goal - Goal suggestion data
   * @param locale - Language locale (default: 'ja')
   * @returns Unified button for goal suggestion
   */
  static formatGoalSuggestion(
    goal: {
      name: string;
      comment?: string;
      detail?: Partial<GoalDetail>;
    },
    _locale: 'ja' | 'en' = 'ja'
  ): UnifiedButton {
    return {
      type: 'Goal',
      label: goal.name,
      comment: goal.comment,
      detail: {
        type: 'Goal',
        name: goal.name,
        ...goal.detail,
      },
    };
  }

  /**
   * Formats sticky'n suggestion into unified button
   *
   * @param stickyn - Sticky'n suggestion data
   * @param locale - Language locale (default: 'ja')
   * @returns Unified button for sticky'n suggestion
   */
  static formatStickyNSuggestion(
    stickyn: {
      name: string;
      comment?: string;
      detail?: Partial<StickyNDetail>;
    },
    _locale: 'ja' | 'en' = 'ja'
  ): UnifiedButton {
    return {
      type: "Sticky'n(MEMO)",
      label: stickyn.name,
      comment: stickyn.comment,
      detail: {
        type: "Sticky'n(MEMO)",
        name: stickyn.name,
        ...stickyn.detail,
      },
    };
  }

  /**
   * Formats reply option into unified button
   *
   * @param reply - Reply option data
   * @returns Unified button for reply option
   */
  static formatReplyButton(reply: {
    label: string;
    action: string;
    comment?: string;
    category?: string;
    icon?: string;
  }): UnifiedButton {
    return {
      type: 'reply',
      label: reply.icon ? `${reply.icon} ${reply.label}` : reply.label,
      comment: reply.comment,
      detail: {
        action: reply.action,
        category: reply.category,
        icon: reply.icon,
      },
    };
  }

  /**
   * Creates a fallback response when AI response is invalid
   * Used as error recovery mechanism
   *
   * @param message - Error or fallback message
   * @param locale - Language locale (default: 'ja')
   * @returns Valid unified response with continuation button
   */
  static createFallbackResponse(
    message: string,
    locale: 'ja' | 'en' = 'ja'
  ): UnifiedChatResponse {
    const fallbackMessage =
      locale === 'ja'
        ? message || '申し訳ございません。もう一度お試しください。'
        : message || 'Sorry, please try again.';

    return {
      message: fallbackMessage,
      userInfo: {
        about_type: 'None',
        about_operation: 'None',
        about_category: [],
        about_detail: [],
      },
      buttons: [
        {
          type: 'reply',
          label: locale === 'ja' ? '続ける' : 'Continue',
          detail: { action: 'continue' },
        },
      ],
    };
  }

  /**
   * Extracts JSON from AI text response
   * Handles cases where JSON is embedded in markdown code blocks
   *
   * @param text - Text containing JSON
   * @returns Extracted JSON string or original text
   */
  static extractJSON(text: string): string {
    // Try to find JSON in markdown code blocks
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      return codeBlockMatch[1].trim();
    }

    // Try to find raw JSON object
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return jsonMatch[0];
    }

    return text;
  }

  /**
   * Parses AI response text that may contain JSON
   * Attempts to extract and parse JSON from various formats
   *
   * @param text - AI response text
   * @param locale - Language locale (default: 'ja')
   * @returns Unified response or fallback response on error
   */
  static parseAIResponse(text: string, locale: 'ja' | 'en' = 'ja'): UnifiedChatResponse {
    try {
      const jsonString = ResponseFormatter.extractJSON(text);
      const result = ResponseFormatter.safeParseJSON(jsonString, locale);

      if (result.success && result.data) {
        return result.data;
      }

      // If parsing failed, create fallback
      const err = result.error || new Error('Unknown error');
      logger.error('AI response parsing failed, using fallback', err);
      return ResponseFormatter.createFallbackResponse(
        locale === 'ja'
          ? '応答の解析に失敗しました。もう一度お試しください。'
          : 'Failed to parse response. Please try again.',
        locale
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Unexpected error in parseAIResponse', err);
      return ResponseFormatter.createFallbackResponse(
        locale === 'ja'
          ? 'エラーが発生しました。もう一度お試しください。'
          : 'An error occurred. Please try again.',
        locale
      );
    }
  }
}

// =============================================================================
// Export
// =============================================================================

/**
 * Get response formatter instance (singleton pattern)
 */
let _responseFormatterInstance: ResponseFormatter | null = null;

export function getResponseFormatter(): typeof ResponseFormatter {
  if (!_responseFormatterInstance) {
    _responseFormatterInstance = ResponseFormatter as unknown as ResponseFormatter;
  }
  return ResponseFormatter;
}
