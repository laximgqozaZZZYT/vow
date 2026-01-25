/**
 * Guardrail Checker Service
 *
 * AIコーチのガードレールチェックを行うサービス。
 * スコープ判定、リダイレクト判定、習慣の安全性チェックを提供する。
 *
 * Requirements:
 * - 3.1: WHEN a user asks about wellness topics related to habits, provide helpful responses
 * - 3.2: SHALL NOT reject messages that mention out-of-scope topics incidentally
 * - 3.3: WHEN a user asks about borderline topics, redirect gently
 * - 3.4: Allow discussion of habit-related health topics without medical advice
 * - 3.5: IF a user persists with out-of-scope requests, politely decline after 2 redirects
 */

import type { ConversationContext } from '../types/conversation.js';

/**
 * スコープチェックの結果
 */
export interface ScopeCheckResult {
  /** スコープ内かどうか */
  inScope: boolean;
  /** カテゴリ */
  category: 'habit' | 'wellness' | 'borderline' | 'out_of_scope';
  /** 推奨されるリダイレクトメッセージ */
  suggestedRedirect?: string;
  /** 付随的な言及かどうか */
  isIncidental?: boolean;
}

/**
 * 習慣の安全性チェック結果
 */
export interface SafetyCheckResult {
  /** 安全かどうか */
  safe: boolean;
  /** 懸念事項 */
  concerns: string[];
  /** 代替案 */
  alternatives?: string[] | undefined;
}

/**
 * リダイレクト判定結果
 */
export interface RedirectResult {
  /** リダイレクトが必要かどうか */
  needed: boolean;
  /** リダイレクト回数 */
  redirectCount: number;
  /** 丁寧に拒否すべきかどうか */
  shouldDecline: boolean;
  /** 推奨メッセージ */
  message?: string;
}

/**
 * 習慣関連のキーワード
 */
const HABIT_KEYWORDS = [
  /習慣/,
  /ゴール/,
  /目標/,
  /達成/,
  /続け/,
  /毎日/,
  /毎週/,
  /ルーティン/,
  /トラッキング/,
  /記録/,
  /分析/,
  /ワークロード/,
  /habit/i,
  /goal/i,
  /routine/i,
];

/**
 * ウェルネス関連のキーワード（習慣に関連する場合は許可）
 */
const WELLNESS_KEYWORDS = [
  /睡眠/,
  /運動/,
  /食事/,
  /ストレス/,
  /瞑想/,
  /リラックス/,
  /健康/,
  /体調/,
  /集中/,
  /学習/,
  /読書/,
  /sleep/i,
  /exercise/i,
  /meditation/i,
  /health/i,
];

/**
 * ボーダーライン（習慣に関連付けられる可能性がある）
 */
const BORDERLINE_KEYWORDS = [
  /仕事/,
  /忙しい/,
  /時間がない/,
  /疲れ/,
  /やる気/,
  /モチベーション/,
  /work/i,
  /busy/i,
  /tired/i,
];

/**
 * 完全にスコープ外のキーワード
 */
const OUT_OF_SCOPE_KEYWORDS = [
  /天気/,
  /ニュース/,
  /株価/,
  /投資/,
  /政治/,
  /宗教/,
  /恋愛相談/,
  /占い/,
  /ゲーム.*攻略/,
  /レシピ/,
  /翻訳して/,
  /プログラム.*書いて/,
  /コード.*書いて/,
  /weather/i,
  /news/i,
  /stock/i,
  /politic/i,
  /religion/i,
];

/**
 * 危険な習慣のパターン
 */
const UNSAFE_HABIT_PATTERNS = [
  { pattern: /断食.*24時間|24時間.*断食/, concern: '24時間以上の断食は健康リスクがあります' },
  { pattern: /毎日.*2時間.*運動|2時間.*毎日.*運動/, concern: '初心者には過度な運動量です' },
  { pattern: /睡眠.*削|削.*睡眠|4時間.*睡眠|睡眠.*4時間/, concern: '睡眠を削ることは健康に悪影響です' },
  { pattern: /ギャンブル/, concern: 'ギャンブル関連の習慣は推奨できません' },
  { pattern: /アルコール.*増|酒.*増/, concern: 'アルコール摂取を増やす習慣は推奨できません' },
  { pattern: /タバコ/, concern: '喫煙関連の習慣は推奨できません' },
];

/**
 * リダイレクトメッセージのテンプレート
 */
const REDIRECT_MESSAGES = {
  first: `習慣管理に関することでお手伝いできます 😊
何か習慣について相談したいことはありますか？

例えば：
・新しい習慣を作りたい
・習慣の達成率を確認したい
・習慣を続けるコツを知りたい`,

  second: `申し訳ありませんが、その話題についてはお手伝いできません。
私は習慣管理の専門コーチなので、習慣や目標について何かお手伝いできることはありますか？`,

  decline: `私は習慣管理の専門コーチです。
その話題についてはお答えできませんが、習慣形成についてはいつでもお手伝いします。
習慣に関することでしたら、お気軽にどうぞ！`,

  medical: `健康に関するご質問ですね。
私は医療の専門家ではないので、具体的な医療アドバイスはできません。
ただ、健康的な習慣づくりのお手伝いはできます！
例えば、運動習慣や睡眠習慣について一緒に考えましょうか？`,

  financial: `投資や金融に関するご質問ですね。
私は習慣管理の専門なので、金融アドバイスはできません。
ただ、「毎月の貯金」を習慣化するお手伝いならできますよ！`,
};

/**
 * メッセージがスコープ内かどうかをチェックする
 *
 * @param message - ユーザーメッセージ
 * @returns スコープチェック結果
 */
export function isWithinScope(message: string): ScopeCheckResult {
  const normalizedMessage = message.toLowerCase();

  // 習慣関連のキーワードがあるかチェック
  const hasHabitKeyword = HABIT_KEYWORDS.some(pattern => pattern.test(normalizedMessage));

  // ウェルネス関連のキーワードがあるかチェック
  const hasWellnessKeyword = WELLNESS_KEYWORDS.some(pattern => pattern.test(normalizedMessage));

  // ボーダーラインのキーワードがあるかチェック
  const hasBorderlineKeyword = BORDERLINE_KEYWORDS.some(pattern => pattern.test(normalizedMessage));

  // スコープ外のキーワードがあるかチェック
  const hasOutOfScopeKeyword = OUT_OF_SCOPE_KEYWORDS.some(pattern => pattern.test(normalizedMessage));

  // 習慣関連のキーワードがある場合は常にスコープ内
  if (hasHabitKeyword) {
    return {
      inScope: true,
      category: 'habit',
    };
  }

  // ウェルネス関連のキーワードがある場合
  if (hasWellnessKeyword) {
    // スコープ外のキーワードも含む場合は付随的な言及として扱う
    if (hasOutOfScopeKeyword) {
      return {
        inScope: true,
        category: 'wellness',
        isIncidental: true,
      };
    }
    return {
      inScope: true,
      category: 'wellness',
    };
  }

  // ボーダーラインのキーワードがある場合
  if (hasBorderlineKeyword) {
    // スコープ外のキーワードも含む場合は付随的な言及として扱う
    if (hasOutOfScopeKeyword) {
      return {
        inScope: false,
        category: 'borderline',
        isIncidental: true,
        suggestedRedirect: REDIRECT_MESSAGES.first,
      };
    }
    return {
      inScope: true,
      category: 'borderline',
      isIncidental: true,
    };
  }

  // スコープ外のキーワードがある場合
  if (hasOutOfScopeKeyword) {
    // 医療関連かチェック
    if (/病気|診断|薬|治療|症状/.test(normalizedMessage)) {
      return {
        inScope: false,
        category: 'out_of_scope',
        suggestedRedirect: REDIRECT_MESSAGES.medical,
      };
    }

    // 金融関連かチェック
    if (/投資|株|金融|ローン/.test(normalizedMessage)) {
      return {
        inScope: false,
        category: 'out_of_scope',
        suggestedRedirect: REDIRECT_MESSAGES.financial,
      };
    }

    return {
      inScope: false,
      category: 'out_of_scope',
      suggestedRedirect: REDIRECT_MESSAGES.first,
    };
  }

  // キーワードがない場合はデフォルトでスコープ内（一般的な会話）
  return {
    inScope: true,
    category: 'habit',
  };
}

/**
 * 習慣提案が安全かどうかをチェックする
 *
 * @param habitName - 習慣名
 * @param habitDescription - 習慣の説明（オプション）
 * @returns 安全性チェック結果
 */
export function isHabitSafe(habitName: string, habitDescription?: string): SafetyCheckResult {
  const textToCheck = `${habitName} ${habitDescription || ''}`.toLowerCase();
  const concerns: string[] = [];
  const alternatives: string[] = [];

  for (const { pattern, concern } of UNSAFE_HABIT_PATTERNS) {
    if (pattern.test(textToCheck)) {
      concerns.push(concern);
    }
  }

  // 代替案を提案
  if (concerns.length > 0) {
    if (textToCheck.includes('断食')) {
      alternatives.push('16時間の間欠的断食（8時間の食事ウィンドウ）から始めることをお勧めします');
    }
    if (textToCheck.includes('運動') && textToCheck.includes('2時間')) {
      alternatives.push('まずは週3回、30分の運動から始めることをお勧めします');
    }
    if (textToCheck.includes('睡眠') && textToCheck.includes('削')) {
      alternatives.push('睡眠時間を確保しながら、朝の時間を有効活用する習慣を考えましょう');
    }
  }

  return {
    safe: concerns.length === 0,
    concerns,
    alternatives: alternatives.length > 0 ? alternatives : undefined,
  };
}

/**
 * リダイレクトが必要かどうかを判定する
 *
 * @param message - ユーザーメッセージ
 * @param context - 会話コンテキスト
 * @returns リダイレクト判定結果
 */
export function needsRedirect(
  message: string,
  context: ConversationContext
): RedirectResult {
  const scopeCheck = isWithinScope(message);

  // スコープ内の場合はリダイレクト不要
  if (scopeCheck.inScope) {
    return {
      needed: false,
      redirectCount: context.redirectCount,
      shouldDecline: false,
    };
  }

  // 付随的な言及の場合はリダイレクト不要
  if (scopeCheck.isIncidental) {
    return {
      needed: false,
      redirectCount: context.redirectCount,
      shouldDecline: false,
    };
  }

  // リダイレクト回数に応じてメッセージを選択
  const newRedirectCount = context.redirectCount + 1;

  if (newRedirectCount === 1) {
    return {
      needed: true,
      redirectCount: newRedirectCount,
      shouldDecline: false,
      message: scopeCheck.suggestedRedirect || REDIRECT_MESSAGES.first,
    };
  }

  if (newRedirectCount === 2) {
    return {
      needed: true,
      redirectCount: newRedirectCount,
      shouldDecline: false,
      message: REDIRECT_MESSAGES.second,
    };
  }

  // 3回目以降は丁寧に拒否
  return {
    needed: true,
    redirectCount: newRedirectCount,
    shouldDecline: true,
    message: REDIRECT_MESSAGES.decline,
  };
}

/**
 * メッセージが完全にスコープ外かどうかをチェック（簡易版）
 *
 * @param message - ユーザーメッセージ
 * @returns スコープ外の場合はtrue
 */
export function isOutOfScope(message: string): boolean {
  const result = isWithinScope(message);
  return !result.inScope && !result.isIncidental;
}

/**
 * メッセージがウェルネス関連かどうかをチェック
 *
 * @param message - ユーザーメッセージ
 * @returns ウェルネス関連の場合はtrue
 */
export function isWellnessRelated(message: string): boolean {
  const result = isWithinScope(message);
  return result.category === 'wellness';
}

/**
 * メッセージがボーダーラインかどうかをチェック
 *
 * @param message - ユーザーメッセージ
 * @returns ボーダーラインの場合はtrue
 */
export function isBorderline(message: string): boolean {
  const result = isWithinScope(message);
  return result.category === 'borderline';
}
