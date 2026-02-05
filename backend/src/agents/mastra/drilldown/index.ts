/**
 * Drilldown Module
 *
 * Category drilldown (Fukabori) feature for clarifying vague user queries.
 *
 * @module agents/mastra/drilldown
 */

// Types
export type {
  DrilldownStep,
  DrilldownState,
  QuickReplyOption,
  DrilldownSelectionType,
  DrilldownSelection,
  ConversationMessage,
  DrilldownAnalysisResult,
} from './types.js';

// Categories
export {
  GENRE_CATEGORIES,
  RESPONSE_TYPE_OPTIONS,
  getGenreById,
  getPurposesForGenre,
  getResponseTypeById,
  type GenreCategory,
  type PurposeOption,
  type ResponseTypeOption,
} from './categories.js';

// Controller
export {
  DrilldownController,
  getDrilldownController,
} from './controller.js';

// Tools
export {
  drilldownAnalysisTool,
  genreQuickRepliesTool,
  purposeQuickRepliesTool,
  responseTypeQuickRepliesTool,
} from './tools.js';
