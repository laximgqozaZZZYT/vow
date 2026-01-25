/**
 * Emotion Detector Utility
 *
 * ユーザーメッセージから感情、挨拶、曖昧なヘルプリクエストを検出する。
 *
 * Requirements:
 * - 2.1: WHEN a user sends a greeting message, THE AI_Coach SHALL respond warmly
 * - 2.2: WHEN a user expresses frustration, THE AI_Coach SHALL acknowledge emotions
 * - 2.3: WHEN a user asks for help without specifics, THE AI_Coach SHALL offer options
 */

import type { UserEmotion } from '../types/conversation.js';

/**
 * 感情検出の結果
 */
export interface EmotionDetectionResult {
  /** 検出された感情 */
  emotion: UserEmotion;
  /** 感情の強度（0-1） */
  intensity: number;
  /** マッチしたキーワード */
  matchedKeywords: string[];
}

/**
 * 挨拶検出の結果
 */
export interface GreetingDetectionResult {
  /** 挨拶かどうか */
  isGreeting: boolean;
  /** 挨拶の種類 */
  type?: 'morning' | 'afternoon' | 'evening' | 'casual' | 'general';
  /** マッチしたパターン */
  matchedPattern?: string;
}

/**
 * ヘルプリクエスト検出の結果
 */
export interface HelpRequestResult {
  /** ヘルプリクエストかどうか */
  isHelpRequest: boolean;
  /** 具体的な内容があるか */
  hasSpecifics: boolean;
  /** 検出されたカテゴリ */
  category?: 'habit_creation' | 'progress_check' | 'advice' | 'general';
}

/**
 * フラストレーション検出パターン
 */
const FRUSTRATION_PATTERNS = {
  strong: [
    /できない/,
    /無理/,
    /挫折/,
    /諦め/,
    /やめたい/,
    /もうダメ/,
    /限界/,
  ],
  moderate: [
    /難しい/,
    /続かない/,
    /失敗/,
    /うまくいかない/,
    /つらい/,
    /しんどい/,
  ],
  mild: [
    /ちょっと大変/,
    /なかなか/,
    /思うように/,
    /いまいち/,
  ],
};

/**
 * ポジティブ感情検出パターン
 */
const POSITIVE_PATTERNS = [
  /できた/,
  /達成/,
  /やった/,
  /成功/,
  /続いて/,
  /連続/,
  /ストリーク/,
  /嬉しい/,
  /良かった/,
  /増えた/,
  /上がった/,
  /良くなった/,
];

/**
 * 困惑検出パターン
 */
const CONFUSION_PATTERNS = [
  /わからない/,
  /どうすれば/,
  /迷って/,
  /どっち/,
  /何を/,
  /どれ/,
  /教えて/,
];

/**
 * 挨拶検出パターン
 */
const GREETING_PATTERNS = {
  morning: [
    /^おはよう/i,
    /^good\s*morning/i,
  ],
  afternoon: [
    /^こんにちは/i,
    /^こんにちわ/i,
  ],
  evening: [
    /^こんばんは/i,
    /^こんばんわ/i,
    /^good\s*evening/i,
  ],
  casual: [
    /^やあ/i,
    /^ども/i,
    /^よう/i,
    /^hey/i,
    /^yo/i,
  ],
  general: [
    /^hi$/i,
    /^hello/i,
    /^ハロー/i,
    /^お疲れ/i,
  ],
};

/**
 * 曖昧なヘルプリクエストパターン
 */
const VAGUE_HELP_PATTERNS = [
  /^助けて/,
  /^手伝って/,
  /^help/i,
  /^何か.*したい$/,
  /^どうしたらいい/,
  /^何をすれば/,
];

/**
 * 具体的なリクエストパターン
 */
const SPECIFIC_REQUEST_PATTERNS = {
  habit_creation: [
    /習慣.*作/,
    /習慣.*始/,
    /〜したい/,
    /〜を始めたい/,
    /新しい習慣/,
  ],
  progress_check: [
    /進捗/,
    /達成率/,
    /どのくらい/,
    /確認/,
    /分析/,
  ],
  advice: [
    /アドバイス/,
    /コツ/,
    /おすすめ/,
    /提案/,
  ],
};

/**
 * ユーザーメッセージから感情を検出する
 *
 * @param message - ユーザーメッセージ
 * @returns 感情検出結果
 */
export function detectEmotion(message: string): EmotionDetectionResult {
  const normalizedMessage = message.toLowerCase().trim();
  const matchedKeywords: string[] = [];

  // フラストレーション（強）をチェック
  for (const pattern of FRUSTRATION_PATTERNS.strong) {
    if (pattern.test(normalizedMessage)) {
      matchedKeywords.push(pattern.source);
      return {
        emotion: 'frustrated',
        intensity: 1.0,
        matchedKeywords,
      };
    }
  }

  // フラストレーション（中）をチェック
  for (const pattern of FRUSTRATION_PATTERNS.moderate) {
    if (pattern.test(normalizedMessage)) {
      matchedKeywords.push(pattern.source);
      return {
        emotion: 'frustrated',
        intensity: 0.7,
        matchedKeywords,
      };
    }
  }

  // フラストレーション（軽）をチェック
  for (const pattern of FRUSTRATION_PATTERNS.mild) {
    if (pattern.test(normalizedMessage)) {
      matchedKeywords.push(pattern.source);
      return {
        emotion: 'frustrated',
        intensity: 0.4,
        matchedKeywords,
      };
    }
  }

  // ポジティブをチェック
  for (const pattern of POSITIVE_PATTERNS) {
    if (pattern.test(normalizedMessage)) {
      matchedKeywords.push(pattern.source);
      return {
        emotion: 'positive',
        intensity: 0.8,
        matchedKeywords,
      };
    }
  }

  // 困惑をチェック
  for (const pattern of CONFUSION_PATTERNS) {
    if (pattern.test(normalizedMessage)) {
      matchedKeywords.push(pattern.source);
      return {
        emotion: 'confused',
        intensity: 0.6,
        matchedKeywords,
      };
    }
  }

  // デフォルトは中立
  return {
    emotion: 'neutral',
    intensity: 0.5,
    matchedKeywords: [],
  };
}

/**
 * ユーザーメッセージが挨拶かどうかを検出する
 *
 * @param message - ユーザーメッセージ
 * @returns 挨拶検出結果
 */
export function detectGreeting(message: string): GreetingDetectionResult {
  const normalizedMessage = message.trim();

  for (const [type, patterns] of Object.entries(GREETING_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(normalizedMessage)) {
        const greetingType = type as 'morning' | 'afternoon' | 'evening' | 'casual' | 'general';
        return {
          isGreeting: true,
          type: greetingType,
          matchedPattern: pattern.source,
        };
      }
    }
  }

  return {
    isGreeting: false,
  };
}

/**
 * ユーザーメッセージが曖昧なヘルプリクエストかどうかを検出する
 *
 * @param message - ユーザーメッセージ
 * @returns ヘルプリクエスト検出結果
 */
export function detectHelpRequest(message: string): HelpRequestResult {
  const normalizedMessage = message.trim();

  // 具体的なリクエストかチェック
  for (const [category, patterns] of Object.entries(SPECIFIC_REQUEST_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(normalizedMessage)) {
        const requestCategory = category as 'habit_creation' | 'progress_check' | 'advice';
        return {
          isHelpRequest: true,
          hasSpecifics: true,
          category: requestCategory,
        };
      }
    }
  }

  // 曖昧なヘルプリクエストかチェック
  for (const pattern of VAGUE_HELP_PATTERNS) {
    if (pattern.test(normalizedMessage)) {
      return {
        isHelpRequest: true,
        hasSpecifics: false,
        category: 'general',
      };
    }
  }

  return {
    isHelpRequest: false,
    hasSpecifics: false,
  };
}

/**
 * メッセージがフラストレーションを表しているかチェック
 *
 * @param message - ユーザーメッセージ
 * @returns フラストレーションを表している場合はtrue
 */
export function isFrustrated(message: string): boolean {
  const result = detectEmotion(message);
  return result.emotion === 'frustrated';
}

/**
 * メッセージがポジティブな感情を表しているかチェック
 *
 * @param message - ユーザーメッセージ
 * @returns ポジティブな感情を表している場合はtrue
 */
export function isPositive(message: string): boolean {
  const result = detectEmotion(message);
  return result.emotion === 'positive';
}

/**
 * メッセージが挨拶かどうかチェック
 *
 * @param message - ユーザーメッセージ
 * @returns 挨拶の場合はtrue
 */
export function isGreeting(message: string): boolean {
  return detectGreeting(message).isGreeting;
}

/**
 * メッセージが曖昧なヘルプリクエストかどうかチェック
 *
 * @param message - ユーザーメッセージ
 * @returns 曖昧なヘルプリクエストの場合はtrue
 */
export function isVagueHelpRequest(message: string): boolean {
  const result = detectHelpRequest(message);
  return result.isHelpRequest && !result.hasSpecifics;
}
