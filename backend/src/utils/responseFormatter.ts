/**
 * Response Formatter Utility
 *
 * AIコーチの応答フォーマットをチェック・整形するユーティリティ。
 * 絵文字カウント、質問カウント、応答長チェックを提供する。
 *
 * Requirements:
 * - 5.1: WHEN responding to simple confirmations, keep response under 200 characters
 * - 5.5: WHEN presenting options, use numbered lists with icons
 */

/**
 * 応答フォーマットチェックの結果
 */
export interface FormatCheckResult {
  /** フォーマットが適切かどうか */
  valid: boolean;
  /** 問題点のリスト */
  issues: string[];
  /** 統計情報 */
  stats: ResponseStats;
}

/**
 * 応答の統計情報
 */
export interface ResponseStats {
  /** 文字数 */
  characterCount: number;
  /** 絵文字の数 */
  emojiCount: number;
  /** 質問の数 */
  questionCount: number;
  /** 箇条書きの数 */
  bulletCount: number;
  /** 番号付きリストの数 */
  numberedListCount: number;
}

/**
 * 応答タイプ
 */
export type ResponseType = 'confirmation' | 'answer' | 'analysis' | 'options' | 'general';

/**
 * 応答タイプごとの文字数制限
 */
const CHARACTER_LIMITS: Record<ResponseType, number> = {
  confirmation: 200,
  answer: 300,
  analysis: 400,
  options: 500,
  general: 400,
};

/**
 * 絵文字の推奨数
 */
const EMOJI_LIMITS = {
  min: 0,
  max: 2,
  recommended: 1,
};

/**
 * 質問の推奨数
 */
const QUESTION_LIMITS = {
  min: 0,
  max: 2,
  recommended: 1,
};

/**
 * 絵文字を検出する正規表現
 * Unicode絵文字の範囲をカバー
 */
const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2300}-\u{23FF}]|[\u{2B50}]|[\u{2B55}]|[\u{2934}-\u{2935}]|[\u{25AA}-\u{25AB}]|[\u{25B6}]|[\u{25C0}]|[\u{25FB}-\u{25FE}]|[\u{2600}-\u{2604}]|[\u{260E}]|[\u{2611}]|[\u{2614}-\u{2615}]|[\u{2618}]|[\u{261D}]|[\u{2620}]|[\u{2622}-\u{2623}]|[\u{2626}]|[\u{262A}]|[\u{262E}-\u{262F}]|[\u{2638}-\u{263A}]|[\u{2640}]|[\u{2642}]|[\u{2648}-\u{2653}]|[\u{265F}-\u{2660}]|[\u{2663}]|[\u{2665}-\u{2666}]|[\u{2668}]|[\u{267B}]|[\u{267E}-\u{267F}]|[\u{2692}-\u{2697}]|[\u{2699}]|[\u{269B}-\u{269C}]|[\u{26A0}-\u{26A1}]|[\u{26A7}]|[\u{26AA}-\u{26AB}]|[\u{26B0}-\u{26B1}]|[\u{26BD}-\u{26BE}]|[\u{26C4}-\u{26C5}]|[\u{26C8}]|[\u{26CE}]|[\u{26CF}]|[\u{26D1}]|[\u{26D3}-\u{26D4}]|[\u{26E9}-\u{26EA}]|[\u{26F0}-\u{26F5}]|[\u{26F7}-\u{26FA}]|[\u{26FD}]/gu;

/**
 * 質問を検出する正規表現
 */
const QUESTION_REGEX = /[？?]|ですか|ますか|でしょうか|ませんか|しますか|しましょうか/g;

/**
 * 箇条書きを検出する正規表現
 */
const BULLET_REGEX = /^[\s]*[・•\-\*][\s]/gm;

/**
 * 番号付きリストを検出する正規表現
 */
const NUMBERED_LIST_REGEX = /^[\s]*\d+[.．)）][\s]/gm;

/**
 * 応答の絵文字数をカウントする
 *
 * @param response - 応答テキスト
 * @returns 絵文字の数
 */
export function countEmojis(response: string): number {
  const matches = response.match(EMOJI_REGEX);
  return matches ? matches.length : 0;
}

/**
 * 応答の質問数をカウントする
 *
 * @param response - 応答テキスト
 * @returns 質問の数
 */
export function countQuestions(response: string): number {
  const matches = response.match(QUESTION_REGEX);
  return matches ? matches.length : 0;
}

/**
 * 応答の箇条書き数をカウントする
 *
 * @param response - 応答テキスト
 * @returns 箇条書きの数
 */
export function countBullets(response: string): number {
  const matches = response.match(BULLET_REGEX);
  return matches ? matches.length : 0;
}

/**
 * 応答の番号付きリスト数をカウントする
 *
 * @param response - 応答テキスト
 * @returns 番号付きリストの数
 */
export function countNumberedLists(response: string): number {
  const matches = response.match(NUMBERED_LIST_REGEX);
  return matches ? matches.length : 0;
}

/**
 * 応答の統計情報を取得する
 *
 * @param response - 応答テキスト
 * @returns 統計情報
 */
export function getResponseStats(response: string): ResponseStats {
  return {
    characterCount: response.length,
    emojiCount: countEmojis(response),
    questionCount: countQuestions(response),
    bulletCount: countBullets(response),
    numberedListCount: countNumberedLists(response),
  };
}

/**
 * 応答タイプを推定する
 *
 * @param response - 応答テキスト
 * @returns 推定された応答タイプ
 */
export function inferResponseType(response: string): ResponseType {
  const stats = getResponseStats(response);

  // 番号付きリストがある場合はoptions
  if (stats.numberedListCount >= 2) {
    return 'options';
  }

  // 分析結果のキーワードがある場合
  if (/📊|分析|達成率|↑|↓|→/.test(response)) {
    return 'analysis';
  }

  // 短い応答は確認
  if (stats.characterCount <= 100) {
    return 'confirmation';
  }

  // 質問への回答パターン
  if (/について|とは|です。|ます。/.test(response) && stats.characterCount <= 300) {
    return 'answer';
  }

  return 'general';
}

/**
 * 応答フォーマットをチェックする
 *
 * @param response - 応答テキスト
 * @param expectedType - 期待される応答タイプ（オプション）
 * @returns フォーマットチェック結果
 */
export function checkResponseFormat(
  response: string,
  expectedType?: ResponseType
): FormatCheckResult {
  const stats = getResponseStats(response);
  const responseType = expectedType || inferResponseType(response);
  const issues: string[] = [];

  // 文字数チェック
  const charLimit = CHARACTER_LIMITS[responseType];
  if (stats.characterCount > charLimit) {
    issues.push(
      `文字数が制限を超えています（${stats.characterCount}/${charLimit}文字）`
    );
  }

  // 絵文字数チェック
  if (stats.emojiCount > EMOJI_LIMITS.max) {
    issues.push(
      `絵文字が多すぎます（${stats.emojiCount}個、推奨: ${EMOJI_LIMITS.max}個以下）`
    );
  }

  // 質問数チェック
  if (stats.questionCount > QUESTION_LIMITS.max) {
    issues.push(
      `質問が多すぎます（${stats.questionCount}個、推奨: ${QUESTION_LIMITS.max}個以下）`
    );
  }

  // 選択肢の場合は番号付きリストを推奨
  if (responseType === 'options' && stats.numberedListCount === 0) {
    issues.push('選択肢は番号付きリストで表示することを推奨します');
  }

  // 3項目以上の列挙がある場合は箇条書きを推奨
  const hasMultipleItems = /、.*、.*、/.test(response);
  if (hasMultipleItems && stats.bulletCount === 0 && stats.numberedListCount === 0) {
    issues.push('3項目以上の列挙は箇条書きを使用することを推奨します');
  }

  return {
    valid: issues.length === 0,
    issues,
    stats,
  };
}

/**
 * 応答が文字数制限内かチェックする
 *
 * @param response - 応答テキスト
 * @param type - 応答タイプ
 * @returns 制限内の場合はtrue
 */
export function isWithinCharacterLimit(response: string, type: ResponseType): boolean {
  return response.length <= CHARACTER_LIMITS[type];
}

/**
 * 応答の絵文字数が適切かチェックする
 *
 * @param response - 応答テキスト
 * @returns 適切な場合はtrue
 */
export function hasAppropriateEmojiCount(response: string): boolean {
  const count = countEmojis(response);
  return count >= EMOJI_LIMITS.min && count <= EMOJI_LIMITS.max;
}

/**
 * 応答の質問数が適切かチェックする
 *
 * @param response - 応答テキスト
 * @returns 適切な場合はtrue
 */
export function hasAppropriateQuestionCount(response: string): boolean {
  const count = countQuestions(response);
  return count >= QUESTION_LIMITS.min && count <= QUESTION_LIMITS.max;
}

/**
 * Call-to-Actionが含まれているかチェックする
 *
 * @param response - 応答テキスト
 * @returns CTAが含まれている場合はtrue
 */
export function hasCallToAction(response: string): boolean {
  const ctaPatterns = [
    /ですか[？?]/,
    /ますか[？?]/,
    /ましょうか[？?]/,
    /しましょう[！!]?/,
    /始めて/,
    /試して/,
    /お知らせください/,
    /教えてください/,
    /どうぞ/,
  ];

  return ctaPatterns.some(pattern => pattern.test(response));
}

/**
 * 応答を整形する（長すぎる場合は切り詰め）
 *
 * @param response - 応答テキスト
 * @param type - 応答タイプ
 * @returns 整形された応答
 */
export function formatResponse(response: string, type: ResponseType): string {
  const limit = CHARACTER_LIMITS[type];

  if (response.length <= limit) {
    return response;
  }

  // 文末で切り詰める
  const truncated = response.substring(0, limit - 3);
  const lastPeriod = Math.max(
    truncated.lastIndexOf('。'),
    truncated.lastIndexOf('！'),
    truncated.lastIndexOf('？')
  );

  if (lastPeriod > limit * 0.7) {
    return truncated.substring(0, lastPeriod + 1);
  }

  return truncated + '...';
}
