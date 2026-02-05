/**
 * Drilldown Tools
 *
 * Mastra tools for the category drilldown (Fukabori) feature.
 *
 * @module agents/mastra/drilldown/tools
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getDrilldownController } from './controller.js';
import type { ConversationMessage } from './types.js';

/**
 * Drilldown Analysis Tool
 *
 * Analyzes if a query needs category drilldown and generates appropriate quick replies.
 * Used by the Manager Agent to determine if clarification is needed before delegation.
 */
export const drilldownAnalysisTool = createTool({
  id: 'drilldown_analysis',
  description: `Analyze if a user query needs category drilldown (Fukabori) clarification.
Use this tool when:
- The user's question is vague or unclear
- The user says things like "I want to start something new" or "I want to improve myself"
- You need to clarify the genre, purpose, or desired response type

The tool will return quick reply buttons for the user to select from.`,
  inputSchema: z.object({
    query: z.string().describe('User query to analyze'),
    conversationHistory: z.array(z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    })).optional().describe('Previous conversation messages'),
    locale: z.enum(['ja', 'en']).default('ja').describe('Response language'),
  }),
  outputSchema: z.object({
    needsDrilldown: z.boolean().describe('Whether drilldown is needed'),
    currentStep: z.enum([
      'initial',
      'genre_selection',
      'purpose_selection',
      'response_type_selection',
      'complete',
    ]).describe('Current step in the drilldown flow'),
    drilldownState: z.object({
      step: z.string(),
      genre: z.string().optional(),
      genreLabel: z.string().optional(),
      purpose: z.string().optional(),
      purposeLabel: z.string().optional(),
      responseType: z.string().optional(),
      responseTypeLabel: z.string().optional(),
    }).describe('Current drilldown state'),
    quickReplies: z.array(z.object({
      id: z.string(),
      label: z.string(),
      value: z.string(),
      icon: z.string().optional(),
    })).describe('Quick reply buttons to display'),
    message: z.string().describe('Message to display to user'),
    selectionType: z.enum([
      'drilldown_genre',
      'drilldown_purpose',
      'drilldown_response_type',
    ]).optional().describe('Type of selection for quick replies'),
    targetAgent: z.enum(['habit-coach', 'goal-planner', 'manager']).optional()
      .describe('Target agent for delegation after drilldown is complete'),
  }),
  execute: async (input) => {
    const controller = getDrilldownController();
    const history: ConversationMessage[] = input.conversationHistory ?? [];
    const locale = input.locale ?? 'ja';

    const result = controller.analyze(input.query, history, locale);

    return {
      needsDrilldown: result.needsDrilldown,
      currentStep: result.currentStep,
      drilldownState: {
        step: result.drilldownState.step,
        genre: result.drilldownState.genre,
        genreLabel: result.drilldownState.genreLabel,
        purpose: result.drilldownState.purpose,
        purposeLabel: result.drilldownState.purposeLabel,
        responseType: result.drilldownState.responseType,
        responseTypeLabel: result.drilldownState.responseTypeLabel,
      },
      quickReplies: result.quickReplies,
      message: result.message,
      selectionType: result.selectionType,
      targetAgent: result.targetAgent,
    };
  },
});

/**
 * Genre Quick Replies Tool
 *
 * Generates quick reply buttons for genre selection.
 * Use this when you need to ask the user what area they're interested in.
 */
export const genreQuickRepliesTool = createTool({
  id: 'genre_quick_replies',
  description: `Generate quick reply buttons for genre/category selection.
Use this when you need to ask the user what area or domain they want to focus on.
Categories include: Health & Fitness, Career & Work, Learning & Skills, Hobbies, Relationships, Finance, Lifestyle, and Other.`,
  inputSchema: z.object({
    locale: z.enum(['ja', 'en']).default('ja').describe('Response language'),
  }),
  outputSchema: z.object({
    quickReplies: z.array(z.object({
      id: z.string(),
      label: z.string(),
      value: z.string(),
      icon: z.string().optional(),
    })).describe('Quick reply buttons for genre selection'),
    message: z.string().describe('Message to display with the buttons'),
    selectionType: z.literal('drilldown_genre'),
  }),
  execute: async (input) => {
    const controller = getDrilldownController();
    const locale = input.locale ?? 'ja';
    const quickReplies = controller.generateQuickReplies(
      'genre_selection',
      { step: 'genre_selection' },
      locale
    );
    const message = controller.generateMessage(
      'genre_selection',
      { step: 'genre_selection' },
      locale
    );

    return {
      quickReplies,
      message,
      selectionType: 'drilldown_genre' as const,
    };
  },
});

/**
 * Purpose Quick Replies Tool
 *
 * Generates quick reply buttons for purpose selection within a genre.
 */
export const purposeQuickRepliesTool = createTool({
  id: 'purpose_quick_replies',
  description: `Generate quick reply buttons for purpose selection within a specific genre.
Use this after the user has selected a genre to ask what they specifically want to achieve.`,
  inputSchema: z.object({
    genre: z.string().describe('Selected genre ID'),
    genreLabel: z.string().optional().describe('Selected genre label'),
    locale: z.enum(['ja', 'en']).default('ja').describe('Response language'),
  }),
  outputSchema: z.object({
    quickReplies: z.array(z.object({
      id: z.string(),
      label: z.string(),
      value: z.string(),
      icon: z.string().optional(),
    })).describe('Quick reply buttons for purpose selection'),
    message: z.string().describe('Message to display with the buttons'),
    selectionType: z.literal('drilldown_purpose'),
  }),
  execute: async (input) => {
    const controller = getDrilldownController();
    const locale = input.locale ?? 'ja';
    const state: import('./types.js').DrilldownState = {
      step: 'purpose_selection' as const,
      genre: input.genre,
      genreLabel: input.genreLabel ?? undefined,
    };
    const quickReplies = controller.generateQuickReplies(
      'purpose_selection',
      state,
      locale
    );
    const message = controller.generateMessage(
      'purpose_selection',
      state,
      locale
    );

    return {
      quickReplies,
      message,
      selectionType: 'drilldown_purpose' as const,
    };
  },
});

/**
 * Response Type Quick Replies Tool
 *
 * Generates quick reply buttons for response type selection.
 */
export const responseTypeQuickRepliesTool = createTool({
  id: 'response_type_quick_replies',
  description: `Generate quick reply buttons for response type selection.
Use this after the user has selected their purpose to ask what kind of support they need.
Options include: Suggest specific habits, Support goal setting, Want information first, Want advice.`,
  inputSchema: z.object({
    genre: z.string().describe('Selected genre ID'),
    genreLabel: z.string().optional().describe('Selected genre label'),
    purpose: z.string().describe('Selected purpose ID'),
    purposeLabel: z.string().optional().describe('Selected purpose label'),
    locale: z.enum(['ja', 'en']).default('ja').describe('Response language'),
  }),
  outputSchema: z.object({
    quickReplies: z.array(z.object({
      id: z.string(),
      label: z.string(),
      value: z.string(),
      icon: z.string().optional(),
    })).describe('Quick reply buttons for response type selection'),
    message: z.string().describe('Message to display with the buttons'),
    selectionType: z.literal('drilldown_response_type'),
  }),
  execute: async (input) => {
    const controller = getDrilldownController();
    const locale = input.locale ?? 'ja';
    const state: import('./types.js').DrilldownState = {
      step: 'response_type_selection' as const,
      genre: input.genre,
      genreLabel: input.genreLabel ?? undefined,
      purpose: input.purpose,
      purposeLabel: input.purposeLabel ?? undefined,
    };
    const quickReplies = controller.generateQuickReplies(
      'response_type_selection',
      state,
      locale
    );
    const message = controller.generateMessage(
      'response_type_selection',
      state,
      locale
    );

    return {
      quickReplies,
      message,
      selectionType: 'drilldown_response_type' as const,
    };
  },
});
