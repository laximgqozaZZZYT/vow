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
 *
 * 重要: 曖昧なリクエストには必ず確認質問を行い、いきなり提案を表示しない
 */
export function needsClarification(userMessage: string): { needed: boolean; questions: string[]; isAmbiguous: boolean } {
  const questions: string[] = [];
  let isAmbiguous = false;

  // Check for greeting - no clarification needed
  if (isGreeting(userMessage)) {
    return { needed: false, questions: [], isAmbiguous: false };
  }

  // Check for vague help request
  if (isVagueHelpRequest(userMessage)) {
    questions.push('どんなことでお手伝いしましょうか？（習慣作成、分析、アドバイスなど）');
    return { needed: true, questions, isAmbiguous: true };
  }

  // Use intent detector to understand user's goal
  const intent = detectIntent(userMessage);

  // 運動習慣の曖昧なリクエストを検出（重要: 目的と種類を確認）
  if (/運動|エクササイズ|体を動かす|トレーニング/.test(userMessage)) {
    // 具体的な運動の種類が指定されていない場合
    if (!/ジョギング|筋トレ|ストレッチ|ウォーキング|ヨガ|ランニング|スクワット|腕立て|プランク/.test(userMessage)) {
      questions.push('どんな運動に興味がありますか？（例: ストレッチ、ウォーキング、筋トレ、ヨガなど）');
      isAmbiguous = true;
    }
    // 運動の目的が指定されていない場合
    if (!/ダイエット|痩せ|体重|健康維持|体力向上|筋力|ストレス解消|リラックス/.test(userMessage)) {
      questions.push('運動の目的は何ですか？（例: ダイエット、健康維持、体力向上、ストレス解消など）');
      isAmbiguous = true;
    }
  }

  // ダイエットの曖昧なリクエストを検出
  if (/ダイエット|痩せたい|体重.*減/.test(userMessage)) {
    // 具体的な方法が指定されていない場合
    if (!/運動|食事|カロリー|断食|糖質制限/.test(userMessage)) {
      questions.push('どのような方法に興味がありますか？（例: 運動中心、食事管理、両方など）');
      isAmbiguous = true;
    }
  }

  // 勉強・学習の曖昧なリクエストを検出
  if (/勉強|学習|学び/.test(userMessage) && !/英語|プログラミング|資格|読書|語学|数学|歴史/.test(userMessage)) {
    questions.push('何を学びたいですか？（例: 語学、プログラミング、資格試験など）');
    isAmbiguous = true;
  }

  // テストの曖昧なリクエストを検出（学校のテスト？資格試験？健康診断？）
  if (/テスト.*点|テスト.*良い|試験.*合格/.test(userMessage)) {
    if (!/学校|大学|資格|TOEIC|英検|健康診断/.test(userMessage)) {
      questions.push('どのようなテストですか？（例: 学校の定期試験、資格試験、語学テストなど）');
      isAmbiguous = true;
    }
  }

  // 健康の曖昧なリクエストを検出
  if (/健康.*なりたい|健康.*生活|健康的/.test(userMessage)) {
    if (!/運動|食事|睡眠|ストレス/.test(userMessage)) {
      questions.push('特にどの面を改善したいですか？（例: 運動、食事、睡眠、ストレス管理など）');
      isAmbiguous = true;
    }
  }

  // Check for missing frequency (only for habit creation intent)
  if (intent.intent === 'create_habit' && !/毎日|毎週|週\d|月\d|daily|weekly/.test(userMessage)) {
    // 頻度は優先度が低いため、他の質問がない場合のみ追加
    if (questions.length === 0) {
      questions.push('どのくらいの頻度で行いますか？（毎日、週3回など）');
    }
  }

  // Limit to 2 questions max
  return {
    needed: questions.length > 0 || isAmbiguous,
    questions: questions.slice(0, 2),
    isAmbiguous,
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
