/**
 * AI Coach Specification Helpers
 *
 * This file provides helper functions for the AI Coach.
 * The actual specifications are loaded from external files via SpecLoader.
 *
 * Note: The embedded specifications have been moved to:
 * - backend/specs/ai-coach/role.md
 * - backend/specs/ai-coach/guardrails.md
 * - backend/specs/ai-coach/conversation.md
 * - backend/specs/ai-coach/habits.md
 * - backend/specs/ai-coach/response-format.md
 */

import { isWithinScope as guardrailIsWithinScope } from './guardrailChecker.js';
import { detectIntent } from '../utils/intentDetector.js';
import { detectEmotion, isGreeting, isVagueHelpRequest } from '../utils/emotionDetector.js';

/**
 * Check if user wants to proceed without clarification
 */
export function shouldProceedWithoutClarification(userMessage: string): boolean {
  const proceedPatterns = [
    /^(はい|うん|ok|おk|オッケー|いいよ|いいです|それで|それでいい|それで進めて|進めて|作って|お願い)$/i,
    /とりあえず/,
    /細かいこと.*後/,
    /詳細.*気にしない/,
    /そのまま/,
    /大丈夫/,
  ];

  const lowerMessage = userMessage.toLowerCase().trim();
  return proceedPatterns.some(pattern => pattern.test(lowerMessage));
}

/**
 * Check if the topic is within scope
 * Delegates to GuardrailChecker for comprehensive scope checking
 */
export function isWithinScope(userMessage: string): boolean {
  const result = guardrailIsWithinScope(userMessage);
  return result.inScope;
}

/**
 * Detect if clarification is needed
 * Uses IntentDetector and EmotionDetector for comprehensive analysis
 */
export function needsClarification(userMessage: string): { needed: boolean; questions: string[] } {
  const questions: string[] = [];

  // Check for greeting - no clarification needed
  if (isGreeting(userMessage)) {
    return { needed: false, questions: [] };
  }

  // Check for vague help request
  if (isVagueHelpRequest(userMessage)) {
    questions.push('どんなことでお手伝いしましょうか？（習慣作成、分析、アドバイスなど）');
    return { needed: true, questions };
  }

  // Use intent detector to understand user's goal
  const intent = detectIntent(userMessage);

  // If intent is clear with high confidence, no clarification needed
  if (intent.confidence >= 0.85) {
    return { needed: false, questions: [] };
  }

  // Check for vague habit descriptions
  if (/運動|エクササイズ/.test(userMessage) && !/ジョギング|筋トレ|ストレッチ|ウォーキング|ヨガ/.test(userMessage)) {
    questions.push('どんな運動をしますか？（例: ジョギング、筋トレ、ストレッチ）');
  }

  if (/勉強|学習/.test(userMessage) && !/英語|プログラミング|資格|読書/.test(userMessage)) {
    questions.push('何を学びますか？');
  }

  // Check for missing frequency (only for habit creation intent)
  if (intent.intent === 'create_habit' && !/毎日|毎週|週\d|月\d|daily|weekly/.test(userMessage)) {
    questions.push('どのくらいの頻度で行いますか？（毎日、週3回など）');
  }

  // Limit to 2 questions max
  return {
    needed: questions.length > 0,
    questions: questions.slice(0, 2),
  };
}

/**
 * Analyze user message for emotional state and intent
 * Combines emotion detection and intent detection
 */
export function analyzeUserMessage(userMessage: string): {
  emotion: ReturnType<typeof detectEmotion>;
  intent: ReturnType<typeof detectIntent>;
  isGreeting: boolean;
  needsClarification: boolean;
  clarificationQuestions: string[];
} {
  const emotion = detectEmotion(userMessage);
  const intent = detectIntent(userMessage);
  const greeting = isGreeting(userMessage);
  const clarification = needsClarification(userMessage);

  return {
    emotion,
    intent,
    isGreeting: greeting,
    needsClarification: clarification.needed,
    clarificationQuestions: clarification.questions,
  };
}
