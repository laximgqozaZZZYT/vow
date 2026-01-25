/**
 * Reference Resolver Utility
 *
 * ユーザーメッセージ内の参照（「それ」「あれ」「that one」など）を解決する。
 * 会話コンテキストから適切な対象を特定する。
 *
 * Requirements:
 * - 6.3: WHEN a user refers to a previously mentioned habit, resolve the reference correctly
 * - 6.4: WHEN a reference is ambiguous, ask for clarification
 */

import type { ConversationContext, HabitSuggestionContext } from '../types/conversation.js';

/**
 * 参照解決の結果
 */
export interface ReferenceResolutionResult {
  /** 解決できたかどうか */
  resolved: boolean;
  /** 解決された対象の種類 */
  type?: 'habit' | 'goal' | 'suggestion' | undefined;
  /** 解決された対象のID */
  targetId?: string | undefined;
  /** 解決された対象の名前 */
  targetName?: string | undefined;
  /** 曖昧な場合の候補 */
  candidates?: Array<{ id?: string | undefined; name: string; type: string }> | undefined;
  /** 明確化のための質問 */
  clarificationQuestion?: string | undefined;
}

/**
 * 参照パターン（日本語）
 */
const JAPANESE_REFERENCE_PATTERNS = [
  /それ/,
  /あれ/,
  /これ/,
  /その習慣/,
  /あの習慣/,
  /この習慣/,
  /そのゴール/,
  /あのゴール/,
  /このゴール/,
  /さっきの/,
  /前の/,
  /最初の/,
  /最後の/,
  /1つ目/,
  /2つ目/,
  /3つ目/,
  /一つ目/,
  /二つ目/,
  /三つ目/,
];

/**
 * 参照パターン（英語）
 */
const ENGLISH_REFERENCE_PATTERNS = [
  /\bthat\b/i,
  /\bthis\b/i,
  /\bit\b/i,
  /\bthe one\b/i,
  /\bthat one\b/i,
  /\bthis one\b/i,
  /\bthe habit\b/i,
  /\bthe goal\b/i,
  /\bthe first\b/i,
  /\bthe second\b/i,
  /\bthe third\b/i,
  /\bthe last\b/i,
  /\bprevious\b/i,
];

/**
 * 順序参照パターン
 */
const ORDER_PATTERNS = {
  first: [/最初/, /1つ目/, /一つ目/, /\bfirst\b/i],
  second: [/2つ目/, /二つ目/, /\bsecond\b/i],
  third: [/3つ目/, /三つ目/, /\bthird\b/i],
  last: [/最後/, /\blast\b/i],
};

/**
 * メッセージに参照が含まれているかチェックする
 *
 * @param message - ユーザーメッセージ
 * @returns 参照が含まれている場合はtrue
 */
export function containsReference(message: string): boolean {
  const allPatterns = [...JAPANESE_REFERENCE_PATTERNS, ...ENGLISH_REFERENCE_PATTERNS];
  return allPatterns.some(pattern => pattern.test(message));
}

/**
 * 参照を解決する
 *
 * @param message - ユーザーメッセージ
 * @param context - 会話コンテキスト
 * @returns 参照解決結果
 */
export function resolveReference(
  message: string,
  context: ConversationContext
): ReferenceResolutionResult {
  // 参照が含まれていない場合
  if (!containsReference(message)) {
    return { resolved: true };
  }

  // 最近言及されたアイテムを取得
  const recentItems = getRecentMentions(context);

  // 順序参照をチェック
  const orderResult = resolveOrderReference(message, recentItems);
  if (orderResult.resolved) {
    return orderResult;
  }

  // 候補が1つだけの場合は解決
  if (recentItems.length === 1) {
    const item = recentItems[0];
    if (item) {
      return {
        resolved: true,
        type: item.type as 'habit' | 'goal' | 'suggestion',
        targetId: item.id,
        targetName: item.name,
      };
    }
  }

  // 候補が複数ある場合は曖昧
  if (recentItems.length > 1) {
    return {
      resolved: false,
      candidates: recentItems,
      clarificationQuestion: generateClarificationQuestion(recentItems),
    };
  }

  // 候補がない場合
  return {
    resolved: false,
    clarificationQuestion: '何について話していますか？具体的に教えていただけますか？',
  };
}

/**
 * 順序参照を解決する
 */
function resolveOrderReference(
  message: string,
  recentItems: Array<{ id?: string | undefined; name: string; type: string }>
): ReferenceResolutionResult {
  // 「最初の」「1つ目」などをチェック
  for (const pattern of ORDER_PATTERNS.first) {
    if (pattern.test(message) && recentItems.length >= 1) {
      const item = recentItems[0];
      if (item) {
        return {
          resolved: true,
          type: item.type as 'habit' | 'goal' | 'suggestion',
          targetId: item.id,
          targetName: item.name,
        };
      }
    }
  }

  // 「2つ目」などをチェック
  for (const pattern of ORDER_PATTERNS.second) {
    if (pattern.test(message) && recentItems.length >= 2) {
      const item = recentItems[1];
      if (item) {
        return {
          resolved: true,
          type: item.type as 'habit' | 'goal' | 'suggestion',
          targetId: item.id,
          targetName: item.name,
        };
      }
    }
  }

  // 「3つ目」などをチェック
  for (const pattern of ORDER_PATTERNS.third) {
    if (pattern.test(message) && recentItems.length >= 3) {
      const item = recentItems[2];
      if (item) {
        return {
          resolved: true,
          type: item.type as 'habit' | 'goal' | 'suggestion',
          targetId: item.id,
          targetName: item.name,
        };
      }
    }
  }

  // 「最後の」をチェック
  for (const pattern of ORDER_PATTERNS.last) {
    if (pattern.test(message) && recentItems.length >= 1) {
      const item = recentItems[recentItems.length - 1];
      if (item) {
        return {
          resolved: true,
          type: item.type as 'habit' | 'goal' | 'suggestion',
          targetId: item.id,
          targetName: item.name,
        };
      }
    }
  }

  return { resolved: false };
}

/**
 * 最近言及されたアイテムを取得する
 */
function getRecentMentions(
  context: ConversationContext
): Array<{ id?: string | undefined; name: string; type: string }> {
  const items: Array<{ id?: string | undefined; name: string; type: string }> = [];

  // 習慣を追加（名前とIDを組み合わせ）
  for (let i = 0; i < context.mentionedHabitNames.length; i++) {
    const name = context.mentionedHabitNames[i];
    const id = context.mentionedHabitIds[i];
    if (name) {
      items.push({
        id: id || undefined,
        name,
        type: 'habit',
      });
    }
  }

  // ゴールを追加（名前とIDを組み合わせ）
  for (let i = 0; i < context.mentionedGoalNames.length; i++) {
    const name = context.mentionedGoalNames[i];
    const id = context.mentionedGoalIds[i];
    if (name) {
      items.push({
        id: id || undefined,
        name,
        type: 'goal',
      });
    }
  }

  // 提案を追加
  if (context.lastSuggestion) {
    const suggestions = Array.isArray(context.lastSuggestion)
      ? context.lastSuggestion
      : [context.lastSuggestion];

    for (const suggestion of suggestions) {
      items.push({
        name: suggestion.name,
        type: 'suggestion',
      });
    }
  }

  // 最近の5件を返す（逆順で最新が先）
  return items.slice(-5).reverse();
}

/**
 * 明確化のための質問を生成する
 */
function generateClarificationQuestion(
  candidates: Array<{ id?: string | undefined; name: string; type: string }>
): string {
  if (candidates.length === 0) {
    return '何について話していますか？具体的に教えていただけますか？';
  }

  const typeLabels: Record<string, string> = {
    habit: '習慣',
    goal: 'ゴール',
    suggestion: '提案',
  };

  const options = candidates
    .map((c, i) => `${i + 1}. ${c.name}（${typeLabels[c.type] || c.type}）`)
    .join('\n');

  return `どれについてお話しですか？\n\n${options}\n\n番号か名前で教えてください。`;
}

/**
 * 曖昧な参照かどうかをチェックする
 *
 * @param message - ユーザーメッセージ
 * @param context - 会話コンテキスト
 * @returns 曖昧な場合はtrue
 */
export function isAmbiguousReference(
  message: string,
  context: ConversationContext
): boolean {
  if (!containsReference(message)) {
    return false;
  }

  const result = resolveReference(message, context);
  return !result.resolved && (result.candidates?.length ?? 0) > 1;
}

/**
 * 参照解決のためのコンテキストを更新する（習慣）
 *
 * @param context - 会話コンテキスト
 * @param habit - 言及された習慣
 * @returns 更新されたコンテキスト
 */
export function addHabitToContext(
  context: ConversationContext,
  habit: { id?: string; name: string }
): ConversationContext {
  const mentionedHabitNames = context.mentionedHabitNames.includes(habit.name)
    ? context.mentionedHabitNames
    : [...context.mentionedHabitNames, habit.name];

  const mentionedHabitIds =
    habit.id && !context.mentionedHabitIds.includes(habit.id)
      ? [...context.mentionedHabitIds, habit.id]
      : context.mentionedHabitIds;

  return {
    ...context,
    mentionedHabitNames,
    mentionedHabitIds,
    updatedAt: new Date(),
  };
}

/**
 * 参照解決のためのコンテキストを更新する（ゴール）
 *
 * @param context - 会話コンテキスト
 * @param goal - 言及されたゴール
 * @returns 更新されたコンテキスト
 */
export function addGoalToContext(
  context: ConversationContext,
  goal: { id?: string; name: string }
): ConversationContext {
  const mentionedGoalNames = context.mentionedGoalNames.includes(goal.name)
    ? context.mentionedGoalNames
    : [...context.mentionedGoalNames, goal.name];

  const mentionedGoalIds =
    goal.id && !context.mentionedGoalIds.includes(goal.id)
      ? [...context.mentionedGoalIds, goal.id]
      : context.mentionedGoalIds;

  return {
    ...context,
    mentionedGoalNames,
    mentionedGoalIds,
    updatedAt: new Date(),
  };
}

/**
 * 提案を記録する
 *
 * @param context - 会話コンテキスト
 * @param suggestion - 提案された習慣
 * @returns 更新されたコンテキスト
 */
export function recordSuggestionToContext(
  context: ConversationContext,
  suggestion: HabitSuggestionContext | HabitSuggestionContext[]
): ConversationContext {
  return {
    ...context,
    lastSuggestion: suggestion,
    updatedAt: new Date(),
  };
}
