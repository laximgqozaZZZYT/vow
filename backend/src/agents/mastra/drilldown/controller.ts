/**
 * Drilldown Controller
 *
 * Controls the category drilldown (Fukabori) flow.
 * Analyzes queries, manages state, and generates quick replies.
 *
 * @module agents/mastra/drilldown/controller
 */

import {
  type DrilldownStep,
  type DrilldownState,
  type QuickReplyOption,
  type DrilldownSelectionType,
  type ConversationMessage,
  type DrilldownAnalysisResult,
  type DrilldownSelection,
} from './types.js';
import {
  GENRE_CATEGORIES,
  RESPONSE_TYPE_OPTIONS,
  getGenreById,
  getPurposesForGenre,
  getResponseTypeById,
} from './categories.js';

/**
 * Patterns that indicate a vague query needing drilldown
 */
const VAGUE_PATTERNS_JA = [
  /何か.*始め/,
  /新しい.*始め/,
  /自分.*変え/,
  /良い.*生活/,
  /もっと.*なりたい/,
  /改善.*したい/,
  /何か.*やりたい/,
  /何.*すれば/,
  /どう.*すれば/,
  /おすすめ.*教え/,
  /何がいい/,
  /アドバイス/,
  /相談/,
];

const VAGUE_PATTERNS_EN = [
  /want to start something/i,
  /want to change/i,
  /want to improve/i,
  /what should I/i,
  /any suggestions/i,
  /recommend/i,
  /advice/i,
];

/**
 * Patterns that indicate a specific query (NOT needing drilldown)
 */
const SPECIFIC_PATTERNS_JA = [
  /習慣.*作りたい/,
  /目標.*設定/,
  /毎日.*する/,
  /週.*回/,
  /分.*運動/,
  /kg.*痩せ/,
  /資格.*取/,
  /TOEIC|英検|簿記/i,
];

const SPECIFIC_PATTERNS_EN = [
  /create.*habit/i,
  /set.*goal/i,
  /every day/i,
  /times.*week/i,
  /minutes.*exercise/i,
  /lose.*kg|pounds/i,
];

/**
 * DrilldownController manages the drilldown flow
 */
export class DrilldownController {
  /**
   * Check if a query needs drilldown clarification
   */
  needsDrilldown(query: string, conversationHistory: ConversationMessage[] = []): boolean {
    // If already in drilldown flow, continue it
    const state = this.getDrilldownState(conversationHistory);
    if (state.step !== 'initial' && state.step !== 'complete') {
      return true;
    }

    // Check for specific patterns first (these don't need drilldown)
    const specificPatterns = [...SPECIFIC_PATTERNS_JA, ...SPECIFIC_PATTERNS_EN];
    for (const pattern of specificPatterns) {
      if (pattern.test(query)) {
        return false;
      }
    }

    // Check for vague patterns
    const vaguePatterns = [...VAGUE_PATTERNS_JA, ...VAGUE_PATTERNS_EN];
    for (const pattern of vaguePatterns) {
      if (pattern.test(query)) {
        return true;
      }
    }

    // Short queries without specific keywords might need drilldown
    if (query.length < 20 && !query.includes('習慣') && !query.includes('目標')) {
      return true;
    }

    return false;
  }

  /**
   * Get the current drilldown step from conversation history
   */
  getCurrentStep(conversationHistory: ConversationMessage[]): DrilldownStep {
    const state = this.getDrilldownState(conversationHistory);
    return state.step;
  }

  /**
   * Extract drilldown state from conversation history
   */
  getDrilldownState(conversationHistory: ConversationMessage[]): DrilldownState {
    const state: DrilldownState = { step: 'initial' };

    for (const msg of conversationHistory) {
      if (msg.role === 'user') {
        // Try to parse drilldown selection from message
        const selection = this.parseSelectionFromMessage(msg.content);
        if (selection) {
          this.updateStateWithSelection(state, selection);
        }
      }
    }

    // Determine current step based on what's been selected
    if (state.responseType) {
      state.step = 'complete';
    } else if (state.purpose) {
      state.step = 'response_type_selection';
    } else if (state.genre) {
      state.step = 'purpose_selection';
    } else {
      // Check if we should start drilldown
      const lastUserMsg = [...conversationHistory].reverse().find(m => m.role === 'user');
      if (lastUserMsg && this.needsDrilldown(lastUserMsg.content, [])) {
        state.step = 'genre_selection';
      }
    }

    return state;
  }

  /**
   * Parse a drilldown selection from a message
   */
  private parseSelectionFromMessage(content: string): DrilldownSelection | null {
    // Try to parse JSON selection
    try {
      const parsed = JSON.parse(content);
      if (parsed.type === 'drilldown_selection') {
        return parsed as DrilldownSelection;
      }
    } catch {
      // Not JSON, try to match against known labels
    }

    // Try to match against genre labels
    for (const genre of GENRE_CATEGORIES) {
      if (content === genre.labelJa || content === genre.labelEn || content === `${genre.icon} ${genre.labelJa}`) {
        return {
          type: 'drilldown_selection',
          selectionType: 'drilldown_genre',
          value: genre.id,
          label: genre.labelJa,
        };
      }

      // Try to match purpose labels for this genre
      for (const purpose of genre.purposes) {
        if (content === purpose.labelJa || content === purpose.labelEn) {
          return {
            type: 'drilldown_selection',
            selectionType: 'drilldown_purpose',
            value: purpose.id,
            label: purpose.labelJa,
          };
        }
      }
    }

    // Try to match response type labels
    for (const responseType of RESPONSE_TYPE_OPTIONS) {
      if (content === responseType.labelJa || content === responseType.labelEn) {
        return {
          type: 'drilldown_selection',
          selectionType: 'drilldown_response_type',
          value: responseType.id,
          label: responseType.labelJa,
        };
      }
    }

    return null;
  }

  /**
   * Update state with a selection
   */
  private updateStateWithSelection(state: DrilldownState, selection: DrilldownSelection): void {
    switch (selection.selectionType) {
      case 'drilldown_genre':
        state.genre = selection.value;
        state.genreLabel = selection.label;
        break;
      case 'drilldown_purpose':
        state.purpose = selection.value;
        state.purposeLabel = selection.label;
        break;
      case 'drilldown_response_type':
        state.responseType = selection.value;
        state.responseTypeLabel = selection.label;
        break;
    }
  }

  /**
   * Generate quick replies for the current drilldown step
   */
  generateQuickReplies(
    step: DrilldownStep,
    state: DrilldownState,
    locale: 'ja' | 'en'
  ): QuickReplyOption[] {
    switch (step) {
      case 'genre_selection':
        return this.generateGenreQuickReplies(locale);
      case 'purpose_selection':
        return this.generatePurposeQuickReplies(state.genre!, locale);
      case 'response_type_selection':
        return this.generateResponseTypeQuickReplies(locale);
      default:
        return [];
    }
  }

  /**
   * Generate genre selection quick replies
   */
  private generateGenreQuickReplies(locale: 'ja' | 'en'): QuickReplyOption[] {
    return GENRE_CATEGORIES.map(genre => ({
      id: `genre_${genre.id}`,
      label: locale === 'ja' ? `${genre.icon} ${genre.labelJa}` : `${genre.icon} ${genre.labelEn}`,
      value: genre.id,
      icon: genre.icon,
    }));
  }

  /**
   * Generate purpose selection quick replies for a genre
   */
  private generatePurposeQuickReplies(genreId: string, locale: 'ja' | 'en'): QuickReplyOption[] {
    const purposes = getPurposesForGenre(genreId);
    return purposes.map(purpose => ({
      id: `purpose_${purpose.id}`,
      label: locale === 'ja' ? purpose.labelJa : purpose.labelEn,
      value: purpose.id,
    }));
  }

  /**
   * Generate response type quick replies
   */
  private generateResponseTypeQuickReplies(locale: 'ja' | 'en'): QuickReplyOption[] {
    return RESPONSE_TYPE_OPTIONS.map(rt => ({
      id: `response_type_${rt.id}`,
      label: locale === 'ja' ? rt.labelJa : rt.labelEn,
      value: rt.id,
    }));
  }

  /**
   * Get the selection type for the current step
   */
  getSelectionType(step: DrilldownStep): DrilldownSelectionType | undefined {
    switch (step) {
      case 'genre_selection':
        return 'drilldown_genre';
      case 'purpose_selection':
        return 'drilldown_purpose';
      case 'response_type_selection':
        return 'drilldown_response_type';
      default:
        return undefined;
    }
  }

  /**
   * Generate a message for the current drilldown step
   */
  generateMessage(step: DrilldownStep, state: DrilldownState, locale: 'ja' | 'en'): string {
    if (locale === 'ja') {
      switch (step) {
        case 'genre_selection':
          return '素晴らしいですね！どんな分野に興味がありますか？';
        case 'purpose_selection':
          const genre = getGenreById(state.genre!);
          return `${genre?.labelJa}に興味があるんですね！具体的にはどうなりたいですか？`;
        case 'response_type_selection':
          return 'どのようなサポートが必要ですか？';
        case 'complete':
          return this.generateDelegationPrompt(state, locale);
        default:
          return '';
      }
    } else {
      switch (step) {
        case 'genre_selection':
          return "That's great! What area are you interested in?";
        case 'purpose_selection':
          const genre = getGenreById(state.genre!);
          return `So you're interested in ${genre?.labelEn}! What specifically do you want to achieve?`;
        case 'response_type_selection':
          return 'What kind of support do you need?';
        case 'complete':
          return this.generateDelegationPrompt(state, locale);
        default:
          return '';
      }
    }
  }

  /**
   * Generate a delegation prompt after drilldown is complete
   */
  generateDelegationPrompt(state: DrilldownState, locale: 'ja' | 'en'): string {
    const genre = getGenreById(state.genre!);
    const responseType = getResponseTypeById(state.responseType!);

    if (locale === 'ja') {
      const genreLabel = genre?.labelJa ?? state.genreLabel ?? '選択した分野';
      const purposeLabel = state.purposeLabel ?? '目標';

      switch (responseType?.targetAgent) {
        case 'habit-coach':
          return `${genreLabel}の${purposeLabel}のために、具体的な習慣を提案しますね！`;
        case 'goal-planner':
          return `${genreLabel}の${purposeLabel}を達成するための目標設定をサポートしますね！`;
        default:
          return `${genreLabel}の${purposeLabel}について、情報をお伝えしますね。`;
      }
    } else {
      const genreLabel = genre?.labelEn ?? state.genreLabel ?? 'your selected area';
      const purposeLabel = state.purposeLabel ?? 'your goal';

      switch (responseType?.targetAgent) {
        case 'habit-coach':
          return `Let me suggest some specific habits for ${purposeLabel} in ${genreLabel}!`;
        case 'goal-planner':
          return `Let me help you set goals to achieve ${purposeLabel} in ${genreLabel}!`;
        default:
          return `Let me share some information about ${purposeLabel} in ${genreLabel}.`;
      }
    }
  }

  /**
   * Get the target agent for delegation after drilldown is complete
   */
  getTargetAgent(state: DrilldownState): 'habit-coach' | 'goal-planner' | 'manager' {
    if (!state.responseType) {
      return 'manager';
    }

    const responseType = getResponseTypeById(state.responseType);
    return responseType?.targetAgent ?? 'manager';
  }

  /**
   * Perform full drilldown analysis
   */
  analyze(
    query: string,
    conversationHistory: ConversationMessage[],
    locale: 'ja' | 'en'
  ): DrilldownAnalysisResult {
    const needsDrilldown = this.needsDrilldown(query, conversationHistory);

    if (!needsDrilldown) {
      return {
        needsDrilldown: false,
        currentStep: 'initial',
        drilldownState: { step: 'initial' },
        quickReplies: [],
        message: '',
        targetAgent: undefined,
      };
    }

    const state = this.getDrilldownState(conversationHistory);
    const step = state.step;
    const quickReplies = this.generateQuickReplies(step, state, locale);
    const message = this.generateMessage(step, state, locale);
    const selectionType = this.getSelectionType(step);

    return {
      needsDrilldown: true,
      currentStep: step,
      drilldownState: state,
      quickReplies,
      message,
      selectionType,
      targetAgent: step === 'complete' ? this.getTargetAgent(state) : undefined,
    };
  }
}

/**
 * Singleton instance of DrilldownController
 */
let controllerInstance: DrilldownController | null = null;

/**
 * Get the singleton DrilldownController instance
 */
export function getDrilldownController(): DrilldownController {
  if (!controllerInstance) {
    controllerInstance = new DrilldownController();
  }
  return controllerInstance;
}
