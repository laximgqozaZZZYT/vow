/**
 * Error Handler Utility for AI Coach
 *
 * AIコーチのエラーハンドリングを提供するユーティリティ。
 * フォールバック応答、技術的エラーのサニタイズ、レート制限メッセージを提供する。
 *
 * Requirements:
 * - 7.1: WHEN an API error occurs, provide a friendly fallback response
 * - 7.2: WHEN a tool fails, continue conversation with alternative response
 * - 7.3: SHALL NOT expose technical error messages to users
 * - 7.4: WHEN rate limited, explain politely and suggest waiting
 * - 7.5: WHEN context is lost, gracefully restart conversation
 */

/**
 * エラーの種類
 */
export type ErrorType =
  | 'api_error'
  | 'tool_failure'
  | 'rate_limit'
  | 'context_lost'
  | 'timeout'
  | 'unknown';

/**
 * エラーハンドリング結果
 */
export interface ErrorHandlingResult {
  /** ユーザーに表示するメッセージ */
  userMessage: string;
  /** 会話を続行できるか */
  canContinue: boolean;
  /** 推奨されるアクション */
  suggestedAction?: string;
  /** ログ用の詳細情報 */
  logDetails?: string;
}

/**
 * フォールバック応答のテンプレート
 */
const FALLBACK_RESPONSES = {
  api_error: {
    messages: [
      '申し訳ありません、一時的に応答できませんでした 🙇\nもう一度お試しいただけますか？',
      'すみません、少し問題が発生しました。\n少し待ってからもう一度お話しいただけますか？',
      '一時的なエラーが発生しました。\n恐れ入りますが、もう一度メッセージを送っていただけますか？',
    ],
    canContinue: true,
    suggestedAction: 'メッセージを再送信してください',
  },
  tool_failure: {
    messages: [
      'データの取得に少し問題がありました。\n別の方法でお手伝いしますね！',
      '情報の取得がうまくいきませんでした。\n直接お話しいただければ、アドバイスできます 😊',
      '分析ツールが一時的に使えませんが、\n一般的なアドバイスならお伝えできます！',
    ],
    canContinue: true,
    suggestedAction: '質問を言い換えてみてください',
  },
  rate_limit: {
    messages: [
      '少しお話しすぎたようです 😅\n5分ほど休憩してから、また話しましょう！',
      'リクエストが多くなっています。\n少し時間を置いてからお試しください。',
      '一時的に利用制限がかかっています。\n数分後にまたお話しできます！',
    ],
    canContinue: false,
    suggestedAction: '5分後に再度お試しください',
  },
  context_lost: {
    messages: [
      'すみません、会話の流れを見失ってしまいました 🙇\nもう一度、何についてお話ししていたか教えていただけますか？',
      '申し訳ありません、前の話題を忘れてしまいました。\n改めてお聞かせいただけますか？',
    ],
    canContinue: true,
    suggestedAction: '話題を再度お伝えください',
  },
  timeout: {
    messages: [
      '応答に時間がかかりすぎました 🙇\nもう一度お試しいただけますか？',
      '処理がタイムアウトしました。\n少し待ってから再度お試しください。',
    ],
    canContinue: true,
    suggestedAction: 'もう一度お試しください',
  },
  unknown: {
    messages: [
      '予期しないエラーが発生しました 🙇\nもう一度お試しいただけますか？',
      '何か問題が発生しました。\n恐れ入りますが、もう一度お試しください。',
    ],
    canContinue: true,
    suggestedAction: 'もう一度お試しください',
  },
};

/**
 * ツール失敗時の代替応答
 */
const TOOL_FALLBACK_RESPONSES: Record<string, string> = {
  analyze_habits:
    '習慣の分析データを取得できませんでしたが、\n一般的なアドバイスをお伝えしますね。\n\n習慣を続けるコツは：\n・小さく始める\n・毎日同じ時間に行う\n・達成を記録する\n\n具体的な習慣について教えていただければ、\nより詳しいアドバイスができます！',
  get_workload_summary:
    'ワークロードデータを取得できませんでしたが、\n一般的な目安をお伝えしますね。\n\n1日の習慣は合計60-90分程度が理想的です。\nそれ以上だと負担が大きくなりがちです。\n\n今の習慣の数や時間を教えていただければ、\nアドバイスできます！',
  get_habit_details:
    '習慣の詳細を取得できませんでした。\n習慣の名前や内容を教えていただければ、\n直接アドバイスできます！',
  get_goal_progress:
    'ゴールの進捗を取得できませんでした。\nゴールの内容を教えていただければ、\n達成に向けたアドバイスができます！',
  suggest_habit_adjustments:
    '調整案を自動生成できませんでしたが、\n一般的なアドバイスをお伝えしますね。\n\n達成率が低い習慣は：\n・頻度を減らす\n・目標を小さくする\n・時間帯を変える\n\nなどを試してみてください！',
};

/**
 * エラーの種類を判定する
 *
 * @param error - エラーオブジェクト
 * @returns エラーの種類
 */
export function classifyError(error: unknown): ErrorType {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Rate limit errors
    if (
      message.includes('rate limit') ||
      message.includes('too many requests') ||
      message.includes('429')
    ) {
      return 'rate_limit';
    }

    // Timeout errors
    if (
      message.includes('timeout') ||
      message.includes('timed out') ||
      message.includes('etimedout')
    ) {
      return 'timeout';
    }

    // API errors
    if (
      message.includes('api') ||
      message.includes('openai') ||
      message.includes('network') ||
      message.includes('fetch')
    ) {
      return 'api_error';
    }

    // Context errors
    if (
      message.includes('context') ||
      message.includes('token') ||
      message.includes('length')
    ) {
      return 'context_lost';
    }
  }

  return 'unknown';
}

/**
 * エラーをハンドリングしてユーザーフレンドリーな応答を生成する
 *
 * @param error - エラーオブジェクト
 * @param errorType - エラーの種類（オプション、自動判定される）
 * @returns エラーハンドリング結果
 */
export function handleError(
  error: unknown,
  errorType?: ErrorType
): ErrorHandlingResult {
  const type = errorType || classifyError(error);
  const fallback = FALLBACK_RESPONSES[type];

  // ランダムにメッセージを選択
  const messageIndex = Math.floor(Math.random() * fallback.messages.length);
  const userMessage = fallback.messages[messageIndex] || fallback.messages[0];

  // ログ用の詳細情報を生成（技術的な詳細はユーザーには見せない）
  let logDetails = `Error type: ${type}`;
  if (error instanceof Error) {
    logDetails += `, Message: ${error.message}`;
    if (error.stack) {
      logDetails += `, Stack: ${error.stack.split('\n')[0]}`;
    }
  }

  return {
    userMessage: userMessage || '予期しないエラーが発生しました。',
    canContinue: fallback.canContinue,
    suggestedAction: fallback.suggestedAction,
    logDetails,
  };
}

/**
 * ツール失敗時の代替応答を取得する
 *
 * @param toolName - 失敗したツールの名前
 * @returns 代替応答メッセージ
 */
export function getToolFallbackResponse(toolName: string): string {
  return (
    TOOL_FALLBACK_RESPONSES[toolName] ||
    '情報の取得に問題がありましたが、\n直接お話しいただければアドバイスできます！'
  );
}

/**
 * 技術的なエラーメッセージをサニタイズする
 *
 * @param message - エラーメッセージ
 * @returns サニタイズされたメッセージ
 */
export function sanitizeErrorMessage(message: string): string {
  // 技術的な詳細を含むパターンを除去
  const technicalPatterns = [
    /error code:?\s*\d+/gi,
    /stack trace:?.*/gi,
    /at\s+\w+\s+\(.+\)/g,
    /\b(api|key|token|secret|password)\b/gi,
    /https?:\/\/[^\s]+/g,
    /\b[a-f0-9]{32,}\b/gi, // ハッシュやトークンのような文字列
    /\{[\s\S]*\}/g, // JSONオブジェクト
  ];

  let sanitized = message;
  for (const pattern of technicalPatterns) {
    sanitized = sanitized.replace(pattern, '');
  }

  // 空白の正規化
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  // サニタイズ後に空になった場合はデフォルトメッセージ
  if (!sanitized || sanitized.length < 10) {
    return '一時的なエラーが発生しました';
  }

  return sanitized;
}

/**
 * レート制限エラーかどうかを判定する
 *
 * @param error - エラーオブジェクト
 * @returns レート制限エラーの場合はtrue
 */
export function isRateLimitError(error: unknown): boolean {
  return classifyError(error) === 'rate_limit';
}

/**
 * 会話を続行できるエラーかどうかを判定する
 *
 * @param error - エラーオブジェクト
 * @returns 続行可能な場合はtrue
 */
export function canContinueAfterError(error: unknown): boolean {
  const type = classifyError(error);
  return FALLBACK_RESPONSES[type].canContinue;
}

/**
 * エラー発生時のログメッセージを生成する
 *
 * @param error - エラーオブジェクト
 * @param context - 追加のコンテキスト情報
 * @returns ログメッセージ
 */
export function createErrorLogMessage(
  error: unknown,
  context?: Record<string, unknown>
): string {
  const type = classifyError(error);
  let message = `[AICoach Error] Type: ${type}`;

  if (error instanceof Error) {
    message += `, Error: ${error.message}`;
  }

  if (context) {
    message += `, Context: ${JSON.stringify(context)}`;
  }

  return message;
}
