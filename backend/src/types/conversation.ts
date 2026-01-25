/**
 * Conversation Types for AI Coach
 *
 * セッション内の会話コンテキストを管理するための型定義。
 * 習慣・ゴールの追跡、感情状態、リダイレクト回数などを管理する。
 *
 * Requirements:
 * - 6.1: WHEN a user references a previous topic, THE AI_Coach SHALL recall relevant context
 * - 6.2: THE AI_Coach SHALL remember user preferences mentioned in the current session
 * - 6.5: THE AI_Coach SHALL maintain awareness of habits and goals discussed in the session
 */

/**
 * 会話メッセージの型
 */
export interface ConversationMessage {
  /** メッセージの役割 */
  role: 'user' | 'assistant';
  /** メッセージ内容 */
  content: string;
  /** タイムスタンプ */
  timestamp?: Date;
  /** メタデータ */
  metadata?: ConversationMessageMetadata;
}

/**
 * メッセージのメタデータ
 */
export interface ConversationMessageMetadata {
  /** 検出された感情 */
  emotion?: UserEmotion;
  /** 検出された意図 */
  intent?: UserIntent;
  /** 言及された習慣ID */
  mentionedHabitIds?: string[];
  /** 言及されたゴールID */
  mentionedGoalIds?: string[];
  /** ツール呼び出しがあったか */
  hadToolCalls?: boolean;
}

/**
 * ユーザーの感情状態
 */
export type UserEmotion = 'positive' | 'neutral' | 'frustrated' | 'confused';

/**
 * ユーザーの意図
 */
export type UserIntent =
  | 'create_habit'
  | 'modify_habit'
  | 'delete_habit'
  | 'get_advice'
  | 'analyze'
  | 'greeting'
  | 'confirmation'
  | 'general';

/**
 * 会話コンテキスト
 *
 * セッション内の会話状態を追跡する
 */
export interface ConversationContext {
  /** セッションID */
  sessionId: string;

  /** ユーザーID */
  userId: string;

  /** 会話履歴（最新N件） */
  messages: ConversationMessage[];

  /** セッション内で言及された習慣ID */
  mentionedHabitIds: string[];

  /** セッション内で言及された習慣名（ID解決用） */
  mentionedHabitNames: string[];

  /** セッション内で言及されたゴールID */
  mentionedGoalIds: string[];

  /** セッション内で言及されたゴール名（ID解決用） */
  mentionedGoalNames: string[];

  /** ユーザーの現在の感情状態 */
  userEmotion: UserEmotion;

  /** スコープ外リダイレクト回数 */
  redirectCount: number;

  /** 最後に提案した習慣 */
  lastSuggestion?: HabitSuggestionContext | HabitSuggestionContext[];

  /** セッション開始時刻 */
  startedAt: Date;

  /** 最終更新時刻 */
  updatedAt: Date;
}

/**
 * 習慣提案のコンテキスト
 */
export interface HabitSuggestionContext {
  /** 提案された習慣名 */
  name: string;
  /** 習慣タイプ */
  type: 'do' | 'avoid';
  /** 頻度 */
  frequency: 'daily' | 'weekly' | 'monthly';
  /** 提案理由 */
  reason?: string;
  /** 提案時刻 */
  suggestedAt: Date;
  /** ユーザーが確認したか */
  confirmed?: boolean;
}

/**
 * ConversationContextの初期値を生成
 */
export function createConversationContext(
  sessionId: string,
  userId: string
): ConversationContext {
  const now = new Date();
  return {
    sessionId,
    userId,
    messages: [],
    mentionedHabitIds: [],
    mentionedHabitNames: [],
    mentionedGoalIds: [],
    mentionedGoalNames: [],
    userEmotion: 'neutral',
    redirectCount: 0,
    startedAt: now,
    updatedAt: now,
  };
}

/**
 * 会話コンテキストにメッセージを追加
 *
 * @param context - 現在のコンテキスト
 * @param message - 追加するメッセージ
 * @param maxMessages - 保持する最大メッセージ数（デフォルト: 20）
 * @returns 更新されたコンテキスト
 */
export function addMessageToContext(
  context: ConversationContext,
  message: ConversationMessage,
  maxMessages: number = 20
): ConversationContext {
  const messages = [...context.messages, message];

  // 最大数を超えた場合は古いメッセージを削除
  const trimmedMessages =
    messages.length > maxMessages ? messages.slice(-maxMessages) : messages;

  // メタデータから習慣・ゴールの言及を抽出
  const mentionedHabitIds = message.metadata?.mentionedHabitIds
    ? [...new Set([...context.mentionedHabitIds, ...message.metadata.mentionedHabitIds])]
    : context.mentionedHabitIds;

  const mentionedGoalIds = message.metadata?.mentionedGoalIds
    ? [...new Set([...context.mentionedGoalIds, ...message.metadata.mentionedGoalIds])]
    : context.mentionedGoalIds;

  // 感情状態を更新（ユーザーメッセージの場合のみ）
  const userEmotion =
    message.role === 'user' && message.metadata?.emotion
      ? message.metadata.emotion
      : context.userEmotion;

  return {
    ...context,
    messages: trimmedMessages,
    mentionedHabitIds,
    mentionedGoalIds,
    userEmotion,
    updatedAt: new Date(),
  };
}

/**
 * リダイレクト回数をインクリメント
 *
 * @param context - 現在のコンテキスト
 * @returns 更新されたコンテキスト
 */
export function incrementRedirectCount(
  context: ConversationContext
): ConversationContext {
  return {
    ...context,
    redirectCount: context.redirectCount + 1,
    updatedAt: new Date(),
  };
}

/**
 * リダイレクト制限に達したかチェック
 *
 * @param context - 現在のコンテキスト
 * @param maxRedirects - 最大リダイレクト回数（デフォルト: 2）
 * @returns 制限に達した場合はtrue
 */
export function hasReachedRedirectLimit(
  context: ConversationContext,
  maxRedirects: number = 2
): boolean {
  return context.redirectCount >= maxRedirects;
}

/**
 * 最後の提案を設定
 *
 * @param context - 現在のコンテキスト
 * @param suggestion - 習慣提案
 * @returns 更新されたコンテキスト
 */
export function setLastSuggestion(
  context: ConversationContext,
  suggestion: HabitSuggestionContext | HabitSuggestionContext[]
): ConversationContext {
  return {
    ...context,
    lastSuggestion: suggestion,
    updatedAt: new Date(),
  };
}

/**
 * 習慣名をコンテキストに追加
 *
 * @param context - 現在のコンテキスト
 * @param habitName - 習慣名
 * @param habitId - 習慣ID（オプション）
 * @returns 更新されたコンテキスト
 */
export function addMentionedHabit(
  context: ConversationContext,
  habitName: string,
  habitId?: string
): ConversationContext {
  const mentionedHabitNames = context.mentionedHabitNames.includes(habitName)
    ? context.mentionedHabitNames
    : [...context.mentionedHabitNames, habitName];

  const mentionedHabitIds =
    habitId && !context.mentionedHabitIds.includes(habitId)
      ? [...context.mentionedHabitIds, habitId]
      : context.mentionedHabitIds;

  return {
    ...context,
    mentionedHabitNames,
    mentionedHabitIds,
    updatedAt: new Date(),
  };
}

/**
 * ゴール名をコンテキストに追加
 *
 * @param context - 現在のコンテキスト
 * @param goalName - ゴール名
 * @param goalId - ゴールID（オプション）
 * @returns 更新されたコンテキスト
 */
export function addMentionedGoal(
  context: ConversationContext,
  goalName: string,
  goalId?: string
): ConversationContext {
  const mentionedGoalNames = context.mentionedGoalNames.includes(goalName)
    ? context.mentionedGoalNames
    : [...context.mentionedGoalNames, goalName];

  const mentionedGoalIds =
    goalId && !context.mentionedGoalIds.includes(goalId)
      ? [...context.mentionedGoalIds, goalId]
      : context.mentionedGoalIds;

  return {
    ...context,
    mentionedGoalNames,
    mentionedGoalIds,
    updatedAt: new Date(),
  };
}

/**
 * コンテキストから最近言及された習慣を取得
 *
 * @param context - 現在のコンテキスト
 * @returns 最近言及された習慣名（最新のもの）
 */
export function getLastMentionedHabit(
  context: ConversationContext
): string | undefined {
  return context.mentionedHabitNames[context.mentionedHabitNames.length - 1];
}

/**
 * コンテキストから最近言及されたゴールを取得
 *
 * @param context - 現在のコンテキスト
 * @returns 最近言及されたゴール名（最新のもの）
 */
export function getLastMentionedGoal(
  context: ConversationContext
): string | undefined {
  return context.mentionedGoalNames[context.mentionedGoalNames.length - 1];
}
