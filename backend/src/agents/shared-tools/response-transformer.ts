/**
 * Response Transformer
 *
 * Transforms existing tool outputs into the unified chat response format.
 * This module provides transformation functions for each tool type.
 *
 * @module agents/shared-tools/response-transformer
 * @see /home/ubuntu/Downloads/vow/specs/unified-chat-response-format/design.md
 * @see /home/ubuntu/Downloads/vow/backend/src/types/unified-response.ts
 */

import type {
  UnifiedChatResponse,
  UnifiedButton,
  UnifiedHabitDetail,
  UnifiedGoalDetail,
  UnifiedStickyDetail,
  UnifiedReplyDetail,
} from '../../types/unified-response.js';
import type {
  CategorySelectionResult,
  HabitSuggestionResult,
  GoalSuggestionResult,
  StickyNSuggestionResult,
  ChoiceButtonsResult,
} from './coach-tools.js';

// =============================================================================
// Category Selection Transformer
// =============================================================================

/**
 * Transform show_category_selection result to unified format
 *
 * @param result - Category selection tool result
 * @returns Unified chat response with category selection buttons
 */
export function transformCategorySelectionResult(
  result: CategorySelectionResult
): UnifiedChatResponse {
  const isGoal = result.selectionType === 'goal_category';
  const buttons: UnifiedButton[] = [];

  for (const qr of result.quickReplies) {
    buttons.push({
      type: 'reply',
      label: qr.label,
      comment: null,
      detail: {
        action: 'select_category',
        category: qr.value,
        icon: qr.icon,
      } satisfies UnifiedReplyDetail,
    });
  }

  return {
    message: result.message,
    userInfo: {
      about_type: isGoal ? 'Goal' : 'Habit',
      about_operation: '新規提案',
      about_category: [],
    },
    buttons,
  };
}

// =============================================================================
// Habit Suggestion Transformer
// =============================================================================

/**
 * Transform suggest_habits result to unified format
 *
 * @param result - Habit suggestion tool result
 * @param message - Optional custom message (defaults to AI's message)
 * @param category - Optional category for userInfo context
 * @returns Unified chat response with habit suggestion buttons
 */
export function transformHabitSuggestionResult(
  result: HabitSuggestionResult,
  message?: string,
  category?: string
): UnifiedChatResponse {
  const buttons: UnifiedButton[] = [];

  // Add habit suggestion buttons
  for (const suggestion of result.suggestions) {
    // Map difficulty level: beginner->easy, intermediate->medium, advanced->hard, expert->hard
    const difficulty = suggestion.difficulty === 'beginner' ? 'easy' as const :
                       suggestion.difficulty === 'intermediate' ? 'medium' as const :
                       'hard' as const;

    buttons.push({
      type: 'Habit',
      label: suggestion.name,
      comment: suggestion.description,
      detail: {
        type: 'Habit',
        name: suggestion.name,
        // DB schema fields
        habitType: suggestion.type,
        must: suggestion.targetCount, // targetCount -> must mapping
        workloadUnit: suggestion.workloadUnit,
        // Suggestion-specific fields
        frequency: suggestion.frequency,
        reason: suggestion.reason,
        category: suggestion.category,
        difficulty,
        triggerTime: suggestion.triggerTime,
        anchorHabit: suggestion.anchorHabit,
      } satisfies UnifiedHabitDetail,
    });
  }

  // Add follow-up action buttons
  if (result.followUpActions) {
    for (const action of result.followUpActions) {
      buttons.push({
        type: 'reply',
        label: action.label,
        comment: null,
        detail: {
          action: action.action,
          category: action.category,
        } satisfies UnifiedReplyDetail,
      });
    }
  }

  return {
    message: message || '習慣を提案します。',
    userInfo: {
      about_type: 'Habit',
      about_operation: '新規提案',
      about_category: category ? [category] : [],
    },
    buttons,
  };
}

// =============================================================================
// Goal Suggestion Transformer
// =============================================================================

/**
 * Transform suggest_goals result to unified format
 *
 * @param result - Goal suggestion tool result
 * @param message - Optional custom message (defaults to AI's message)
 * @param category - Optional category for userInfo context
 * @returns Unified chat response with goal suggestion buttons
 */
export function transformGoalSuggestionResult(
  result: GoalSuggestionResult,
  message?: string,
  category?: string
): UnifiedChatResponse {
  const buttons: UnifiedButton[] = [];

  // Add goal suggestion buttons
  for (const suggestion of result.suggestions) {
    // Map difficulty level: beginner->easy, intermediate->medium, advanced->hard, expert->hard
    const difficulty = suggestion.difficulty === 'beginner' ? 'easy' as const :
                       suggestion.difficulty === 'intermediate' ? 'medium' as const :
                       'hard' as const;

    buttons.push({
      type: 'Goal',
      label: suggestion.name,
      comment: suggestion.description,
      detail: {
        type: 'Goal',
        name: suggestion.name,
        // DB schema fields (description -> details, deadline -> dueDate mapping)
        details: suggestion.description,
        dueDate: suggestion.deadline,
        // Suggestion-specific fields
        category: suggestion.category,
        difficulty,
        suggestedHabits: suggestion.suggestedHabits,
        rationale: suggestion.rationale,
        milestones: suggestion.milestones,
      } satisfies UnifiedGoalDetail,
    });
  }

  // Add follow-up action buttons
  if (result.followUpActions) {
    for (const action of result.followUpActions) {
      buttons.push({
        type: 'reply',
        label: action.label,
        comment: null,
        detail: {
          action: action.action,
          category: action.category,
        } satisfies UnifiedReplyDetail,
      });
    }
  }

  return {
    message: message || '目標を提案します。',
    userInfo: {
      about_type: 'Goal',
      about_operation: '新規提案',
      about_category: category ? [category] : [],
    },
    buttons,
  };
}

// =============================================================================
// Sticky'n Suggestion Transformer
// =============================================================================

/**
 * Transform suggest_stickyn result to unified format
 *
 * @param result - Sticky'n suggestion tool result
 * @param message - Optional custom message (defaults to AI's message)
 * @param category - Optional category for userInfo context
 * @returns Unified chat response with sticky'n suggestion buttons
 */
export function transformStickyNSuggestionResult(
  result: StickyNSuggestionResult,
  message?: string,
  category?: string
): UnifiedChatResponse {
  const buttons: UnifiedButton[] = [];

  // Add sticky'n suggestion buttons
  for (const suggestion of result.suggestions) {
    buttons.push({
      type: "Sticky'n(MEMO)",
      label: suggestion.name,
      comment: suggestion.content,
      detail: {
        type: "Sticky'n(MEMO)",
        name: suggestion.name,
        // DB schema fields (camelCase)
        description: suggestion.content,
        completed: false,
        displayOrder: 0,
      } satisfies UnifiedStickyDetail,
    });
  }

  // Add follow-up action buttons
  if (result.followUpActions) {
    for (const action of result.followUpActions) {
      buttons.push({
        type: 'reply',
        label: action.label,
        comment: null,
        detail: {
          action: action.action,
          category: action.category,
        } satisfies UnifiedReplyDetail,
      });
    }
  }

  return {
    message: message || 'メモを提案します。',
    userInfo: {
      about_type: "Sticky'n(MEMO)",
      about_operation: '新規提案',
      about_category: category ? [category] : [],
    },
    buttons,
  };
}

// =============================================================================
// Choice Buttons Transformer
// =============================================================================

/**
 * Transform show_choice_buttons result to unified format
 *
 * @param result - Choice buttons tool result
 * @returns Unified chat response with choice buttons
 */
export function transformChoiceButtonsResult(
  result: ChoiceButtonsResult
): UnifiedChatResponse {
  const buttons: UnifiedButton[] = [];

  for (const choice of result.data.choices) {
    // Determine button type based on choice metadata
    // Default to 'reply' if type is not specified
    const buttonType =
      // If the choice has a type property, map it appropriately
      // Otherwise default to 'reply'
      'reply' as const;

    buttons.push({
      type: buttonType,
      label: choice.label,
      comment: choice.description || null,
      detail: {
        action: 'select_choice',
        choiceId: choice.id,
        icon: choice.icon,
      } satisfies UnifiedReplyDetail,
    });
  }

  return {
    message: result.data.title,
    userInfo: {
      about_type: null,
      about_operation: null,
      about_category: [],
    },
    buttons,
  };
}

// =============================================================================
// Generic Tool Output Transformer
// =============================================================================

/**
 * Auto-detect tool type and transform to unified format
 *
 * This is the main entry point for transforming tool outputs.
 * It dispatches to the appropriate transformer based on tool name.
 *
 * @param toolName - Name of the tool that produced the output
 * @param output - Tool output to transform
 * @param message - Optional custom message to override default
 * @returns Unified chat response, or null if tool is not supported
 */
export function transformToolOutput(
  toolName: string,
  output: unknown,
  message?: string
): UnifiedChatResponse | null {
  switch (toolName) {
    case 'suggest_habits':
    case 'refine_suggestions':
      return transformHabitSuggestionResult(
        output as HabitSuggestionResult,
        message
      );

    case 'suggest_goals':
      return transformGoalSuggestionResult(
        output as GoalSuggestionResult,
        message
      );

    case 'suggest_stickyn':
      return transformStickyNSuggestionResult(
        output as StickyNSuggestionResult,
        message
      );

    case 'show_category_selection':
      return transformCategorySelectionResult(
        output as CategorySelectionResult
      );

    case 'show_choice_buttons':
      return transformChoiceButtonsResult(
        output as ChoiceButtonsResult
      );

    default:
      // Tool not supported for transformation
      return null;
  }
}
