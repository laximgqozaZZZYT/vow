/**
 * Drilldown Types
 *
 * Type definitions for the category drilldown (Fukabori) feature.
 *
 * @module agents/mastra/drilldown/types
 */

/**
 * Drilldown step in the clarification flow
 */
export type DrilldownStep =
  | 'initial'
  | 'genre_selection'
  | 'purpose_selection'
  | 'response_type_selection'
  | 'complete';

/**
 * State of the drilldown process
 */
export interface DrilldownState {
  step: DrilldownStep;
  genre?: string | undefined;
  genreLabel?: string | undefined;
  purpose?: string | undefined;
  purposeLabel?: string | undefined;
  responseType?: string | undefined;
  responseTypeLabel?: string | undefined;
  customInput?: string | undefined;
}

/**
 * Quick reply option for drilldown
 */
export interface QuickReplyOption {
  id: string;
  label: string;
  value: string;
  icon?: string;
}

/**
 * Selection type for drilldown quick replies
 */
export type DrilldownSelectionType =
  | 'drilldown_genre'
  | 'drilldown_purpose'
  | 'drilldown_response_type';

/**
 * Drilldown selection message from user
 */
export interface DrilldownSelection {
  type: 'drilldown_selection';
  selectionType: DrilldownSelectionType;
  value: string;
  label: string;
}

/**
 * Conversation message for drilldown analysis
 */
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Result of drilldown analysis
 */
export interface DrilldownAnalysisResult {
  needsDrilldown: boolean;
  currentStep: DrilldownStep;
  drilldownState: DrilldownState;
  quickReplies: QuickReplyOption[];
  message: string;
  selectionType?: DrilldownSelectionType | undefined;
  targetAgent?: 'habit-coach' | 'goal-planner' | 'manager' | undefined;
}
