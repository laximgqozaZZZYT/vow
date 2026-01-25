/**
 * Intent Detector Utility
 *
 * ユーザーメッセージから意図を検出する。
 * 習慣作成、修正、確認などの意図を識別する。
 *
 * Requirements:
 * - 4.1: WHEN a user expresses intent to create a habit, use tool within 2 turns
 * - 4.2: WHEN suggesting multiple habits for a goal, use multiple suggestions tool
 * - 4.4: WHEN a user modifies a suggested habit, update using the tool
 * - 4.5: WHEN a user confirms a habit suggestion, acknowledge and offer next steps
 */

import type { UserIntent } from '../types/conversation.js';

/**
 * 意図検出の結果
 */
export interface IntentDetectionResult {
  /** 検出された意図 */
  intent: UserIntent;
  /** 確信度（0-1） */
  confidence: number;
  /** マッチしたパターン */
  matchedPattern?: string | undefined;
  /** 抽出された情報 */
  extractedInfo?: ExtractedInfo | undefined;
}

/**
 * 抽出された情報
 */
export interface ExtractedInfo {
  /** 習慣名（検出された場合） */
  habitName?: string;
  /** 頻度（検出された場合） */
  frequency?: 'daily' | 'weekly' | 'monthly';
  /** 時間（検出された場合） */
  time?: string;
  /** 複数の習慣が求められているか */
  isMultiple?: boolean;
  /** 修正内容（検出された場合） */
  modification?: string;
}

/**
 * 習慣作成意図のパターン
 */
const HABIT_CREATION_PATTERNS = [
  { pattern: /(.+)したい/, extract: 'habitName' },
  { pattern: /(.+)を始めたい/, extract: 'habitName' },
  { pattern: /(.+)を習慣にしたい/, extract: 'habitName' },
  { pattern: /習慣.*作/, extract: null },
  { pattern: /(.+)を続けたい/, extract: 'habitName' },
  { pattern: /新しい習慣/, extract: null },
  { pattern: /習慣.*提案/, extract: null },
  { pattern: /おすすめ.*習慣/, extract: null },
  { pattern: /何かいい.*習慣/, extract: null },
  { pattern: /習慣.*おすすめ/, extract: null },
];

/**
 * 複数習慣リクエストのパターン
 */
const MULTIPLE_HABIT_PATTERNS = [
  /(\d+)つ.*提案/,
  /(\d+)個.*提案/,
  /いくつか.*提案/,
  /複数.*提案/,
  /習慣.*リスト/,
  /ゴール.*達成.*習慣/,
  /目標.*達成.*習慣/,
];

/**
 * 修正意図のパターン
 */
const MODIFICATION_PATTERNS = [
  { pattern: /(.+)に変更/, extract: 'modification' },
  { pattern: /(.+)にして/, extract: 'modification' },
  { pattern: /(.+)に修正/, extract: 'modification' },
  { pattern: /やっぱり(.+)/, extract: 'modification' },
  { pattern: /(.+)の方がいい/, extract: 'modification' },
  { pattern: /頻度.*変え/, extract: null },
  { pattern: /時間.*変え/, extract: null },
  { pattern: /調整/, extract: null },
];

/**
 * 確認意図のパターン
 */
const CONFIRMATION_PATTERNS = [
  /^(はい|うん|ok|おk|オッケー|いいよ|いいです)$/i,
  /それでいい/,
  /それで進めて/,
  /それでお願い/,
  /大丈夫/,
  /問題ない/,
  /作って/,
  /登録して/,
];

/**
 * 挨拶パターン
 */
const GREETING_PATTERNS = [
  /^(こんにちは|おはよう|こんばんは|やあ|ども|hi|hello|hey)/i,
];

/**
 * 分析リクエストのパターン
 */
const ANALYSIS_PATTERNS = [
  /分析/,
  /達成率/,
  /進捗/,
  /どのくらい/,
  /確認/,
  /状況/,
  /ワークロード/,
];

/**
 * アドバイスリクエストのパターン
 */
const ADVICE_PATTERNS = [
  /アドバイス/,
  /コツ/,
  /どうすれば/,
  /どうしたら/,
  /続ける.*方法/,
  /改善/,
];

/**
 * 頻度の検出パターン
 */
const FREQUENCY_PATTERNS = {
  daily: [/毎日/, /daily/i, /毎朝/, /毎晩/],
  weekly: [/毎週/, /週\d/, /weekly/i],
  monthly: [/毎月/, /月\d/, /monthly/i],
};

/**
 * 時間の検出パターン
 */
const TIME_PATTERN = /(\d{1,2})[時:：](\d{2})?/;

/**
 * ユーザーメッセージから意図を検出する
 *
 * @param message - ユーザーメッセージ
 * @returns 意図検出結果
 */
export function detectIntent(message: string): IntentDetectionResult {
  const normalizedMessage = message.trim();

  // 挨拶をチェック
  for (const pattern of GREETING_PATTERNS) {
    if (pattern.test(normalizedMessage)) {
      return {
        intent: 'greeting',
        confidence: 0.9,
        matchedPattern: pattern.source,
      };
    }
  }

  // 確認をチェック
  for (const pattern of CONFIRMATION_PATTERNS) {
    if (pattern.test(normalizedMessage)) {
      return {
        intent: 'confirmation',
        confidence: 0.95,
        matchedPattern: pattern.source,
      };
    }
  }

  // 修正意図をチェック
  for (const { pattern, extract } of MODIFICATION_PATTERNS) {
    const match = normalizedMessage.match(pattern);
    if (match) {
      const extractedInfo: ExtractedInfo = {};
      if (extract === 'modification' && match[1]) {
        extractedInfo.modification = match[1];
      }
      return {
        intent: 'modify_habit',
        confidence: 0.85,
        matchedPattern: pattern.source,
        extractedInfo: Object.keys(extractedInfo).length > 0 ? extractedInfo : undefined,
      };
    }
  }

  // 複数習慣リクエストをチェック
  for (const pattern of MULTIPLE_HABIT_PATTERNS) {
    if (pattern.test(normalizedMessage)) {
      return {
        intent: 'create_habit',
        confidence: 0.9,
        matchedPattern: pattern.source,
        extractedInfo: { isMultiple: true },
      };
    }
  }

  // 習慣作成意図をチェック
  for (const { pattern, extract } of HABIT_CREATION_PATTERNS) {
    const match = normalizedMessage.match(pattern);
    if (match) {
      const extractedInfo = extractHabitInfo(normalizedMessage, match, extract);
      return {
        intent: 'create_habit',
        confidence: 0.85,
        matchedPattern: pattern.source,
        extractedInfo,
      };
    }
  }

  // 分析リクエストをチェック
  for (const pattern of ANALYSIS_PATTERNS) {
    if (pattern.test(normalizedMessage)) {
      return {
        intent: 'analyze',
        confidence: 0.8,
        matchedPattern: pattern.source,
      };
    }
  }

  // アドバイスリクエストをチェック
  for (const pattern of ADVICE_PATTERNS) {
    if (pattern.test(normalizedMessage)) {
      return {
        intent: 'get_advice',
        confidence: 0.8,
        matchedPattern: pattern.source,
      };
    }
  }

  // デフォルトは一般的な意図
  return {
    intent: 'general',
    confidence: 0.5,
  };
}

/**
 * 習慣関連の情報を抽出する
 */
function extractHabitInfo(
  message: string,
  match: RegExpMatchArray,
  extractType: string | null
): ExtractedInfo | undefined {
  const info: ExtractedInfo = {};

  // 習慣名を抽出
  if (extractType === 'habitName' && match[1]) {
    info.habitName = match[1].trim();
  }

  // 頻度を抽出
  for (const [freq, patterns] of Object.entries(FREQUENCY_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        info.frequency = freq as 'daily' | 'weekly' | 'monthly';
        break;
      }
    }
    if (info.frequency) break;
  }

  // 時間を抽出
  const timeMatch = message.match(TIME_PATTERN);
  if (timeMatch && timeMatch[1]) {
    const hour = timeMatch[1];
    const minute = timeMatch[2] || '00';
    info.time = `${hour.padStart(2, '0')}:${minute}`;
  }

  return Object.keys(info).length > 0 ? info : undefined;
}

/**
 * メッセージが習慣作成の意図を持っているかチェック
 *
 * @param message - ユーザーメッセージ
 * @returns 習慣作成の意図がある場合はtrue
 */
export function hasHabitCreationIntent(message: string): boolean {
  const result = detectIntent(message);
  return result.intent === 'create_habit';
}

/**
 * メッセージが複数習慣のリクエストかチェック
 *
 * @param message - ユーザーメッセージ
 * @returns 複数習慣のリクエストの場合はtrue
 */
export function isMultipleHabitRequest(message: string): boolean {
  const result = detectIntent(message);
  return result.intent === 'create_habit' && result.extractedInfo?.isMultiple === true;
}

/**
 * メッセージが修正の意図を持っているかチェック
 *
 * @param message - ユーザーメッセージ
 * @returns 修正の意図がある場合はtrue
 */
export function hasModificationIntent(message: string): boolean {
  const result = detectIntent(message);
  return result.intent === 'modify_habit';
}

/**
 * メッセージが確認の意図を持っているかチェック
 *
 * @param message - ユーザーメッセージ
 * @returns 確認の意図がある場合はtrue
 */
export function hasConfirmationIntent(message: string): boolean {
  const result = detectIntent(message);
  return result.intent === 'confirmation';
}

/**
 * メッセージが分析リクエストかチェック
 *
 * @param message - ユーザーメッセージ
 * @returns 分析リクエストの場合はtrue
 */
export function isAnalysisRequest(message: string): boolean {
  const result = detectIntent(message);
  return result.intent === 'analyze';
}

/**
 * メッセージがアドバイスリクエストかチェック
 *
 * @param message - ユーザーメッセージ
 * @returns アドバイスリクエストの場合はtrue
 */
export function isAdviceRequest(message: string): boolean {
  const result = detectIntent(message);
  return result.intent === 'get_advice';
}
