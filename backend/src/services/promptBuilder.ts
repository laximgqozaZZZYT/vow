/**
 * Prompt Builder
 *
 * ユーザーコンテキストを含む最適化されたシステムプロンプトを構築する
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

import { getLogger } from '../utils/logger.js';
import type { UserContext, TimeSlot, IPromptBuilder } from '../types/personalization.js';

const logger = getLogger('promptBuilder');

/**
 * ユーザーレベルの説明
 */
const LEVEL_DESCRIPTIONS = {
  beginner: '初心者（習慣数が少ない、または達成率が低め）',
  intermediate: '中級者（習慣を継続できている）',
  advanced: '上級者（多くの習慣を高い達成率で継続）',
} as const;

/**
 * 頻度の日本語表記
 */
const FREQUENCY_LABELS = {
  daily: '毎日',
  weekly: '毎週',
  monthly: '毎月',
} as const;

/**
 * PromptBuilder実装クラス
 */
export class PromptBuilder implements IPromptBuilder {
  /**
   * システムプロンプトを構築する
   * Requirements: 6.1, 6.2, 6.3, 6.4
   *
   * @param userContext ユーザーコンテキスト
   * @param basePrompt ベースプロンプト
   * @returns 構築されたシステムプロンプト
   */
  buildSystemPrompt(userContext: UserContext, basePrompt: string): string {
    const contextSummary = this.buildContextSummary(userContext);
    const guidelines = this.buildSuggestionGuidelines(userContext);

    // トークン使用量を最小化するため、必要な情報のみを含める（Requirements: 6.4）
    const contextSection = `
## ユーザーコンテキスト
${contextSummary}

## 提案時の注意事項
${guidelines}`;

    logger.debug('System prompt built', {
      userId: userContext.userId,
      contextLength: contextSection.length,
    });

    return `${basePrompt}${contextSection}`;
  }

  /**
   * コンテキストサマリーを構築する
   * Requirements: 6.1
   *
   * @param userContext ユーザーコンテキスト
   * @returns コンテキストサマリー文字列
   */
  buildContextSummary(userContext: UserContext): string {
    const lines: string[] = [];

    // アクティブな習慣数（Requirements: 6.1）
    lines.push(`- アクティブな習慣数: ${userContext.activeHabitCount}`);

    // 平均達成率（Requirements: 6.1）
    lines.push(
      `- 平均達成率: ${Math.round(userContext.averageCompletionRate * 100)}%`
    );

    // ユーザーレベル（Requirements: 6.1）
    lines.push(
      `- ユーザーレベル: ${LEVEL_DESCRIPTIONS[userContext.userLevel]}`
    );

    // 好みの頻度
    lines.push(
      `- 好みの頻度: ${FREQUENCY_LABELS[userContext.preferredFrequency]}`
    );

    // 好みの時間帯（Requirements: 6.3）
    const timeSlotStr = this.formatTimeSlots(userContext.preferredTimeSlots);
    lines.push(`- 好みの時間帯: ${timeSlotStr}`);

    // アンカー習慣
    const anchorStr = this.formatAnchorHabits(userContext);
    lines.push(`- アンカー習慣: ${anchorStr}`);

    // THLI-24 レベルコンテキスト（Requirements: 10.1, 10.2）
    if (userContext.levelDistribution) {
      const levelStr = this.formatLevelDistribution(userContext);
      lines.push(`- 習慣レベル分布: ${levelStr}`);
    }

    if (userContext.averageHabitLevel !== undefined) {
      lines.push(`- 平均習慣レベル: ${userContext.averageHabitLevel}`);
    }

    if (userContext.highestLevelHabit) {
      lines.push(
        `- 最高レベル習慣: ${userContext.highestLevelHabit.habitName}（Lv.${userContext.highestLevelHabit.level}）`
      );
    }

    return lines.join('\n');
  }

  /**
   * 提案ガイドラインを構築する
   *
   * @param userContext ユーザーコンテキスト
   * @returns ガイドライン文字列
   */
  private buildSuggestionGuidelines(userContext: UserContext): string {
    const guidelines: string[] = [];

    // ユーザーレベルに基づくガイドライン
    switch (userContext.userLevel) {
      case 'beginner':
        guidelines.push(
          '- 初心者向け: 毎日の頻度で、15分以内の短い習慣を提案してください'
        );
        guidelines.push('- 2分ルールを適用し、小さく始められる習慣を優先してください');
        break;
      case 'intermediate':
        guidelines.push(
          '- 中級者向け: 週単位の習慣も含め、30分以内の習慣を提案できます'
        );
        guidelines.push('- 習慣スタッキングを活用した提案を検討してください');
        break;
      case 'advanced':
        guidelines.push(
          '- 上級者向け: 頻度や時間の制限なく、チャレンジングな習慣も提案できます'
        );
        guidelines.push('- 既存の習慣を発展させる提案も検討してください');
        break;
    }

    // 既存習慣との重複回避（Requirements: 6.2）
    if (userContext.existingHabitNames.length > 0) {
      const habitList = userContext.existingHabitNames.slice(0, 10).join('、');
      guidelines.push(`- 以下の既存習慣と重複しない提案をしてください: ${habitList}`);
      if (userContext.existingHabitNames.length > 10) {
        guidelines.push(`  （他${userContext.existingHabitNames.length - 10}件）`);
      }
    }

    // 好みの時間帯を考慮（Requirements: 6.3）
    if (userContext.preferredTimeSlots.length > 0) {
      const firstSlot = userContext.preferredTimeSlots[0];
      if (firstSlot) {
        const preferredHour = firstSlot.hour;
        guidelines.push(
          `- ユーザーは${preferredHour}時頃に習慣を実行することが多いです。この時間帯を考慮してください`
        );
      }
    }

    // アンカー習慣を活用
    if (userContext.anchorHabits.length > 0) {
      const anchorNames = userContext.anchorHabits
        .slice(0, 3)
        .map((a) => a.habitName)
        .join('、');
      guidelines.push(
        `- 習慣スタッキングの起点として使える習慣: ${anchorNames}`
      );
    }

    return guidelines.join('\n');
  }

  /**
   * 時間帯を整形する
   *
   * @param slots 時間帯リスト
   * @returns 整形された文字列
   */
  private formatTimeSlots(slots: TimeSlot[]): string {
    if (slots.length === 0) {
      return '特になし';
    }

    return slots
      .slice(0, 3)
      .map((s) => `${s.hour}:00頃`)
      .join('、');
  }

  /**
   * アンカー習慣を整形する
   *
   * @param userContext ユーザーコンテキスト
   * @returns 整形された文字列
   */
  private formatAnchorHabits(userContext: UserContext): string {
    if (userContext.anchorHabits.length === 0) {
      return 'なし';
    }

    return userContext.anchorHabits
      .slice(0, 3)
      .map((a) => `${a.habitName}（達成率${Math.round(a.completionRate * 100)}%）`)
      .join('、');
  }

  /**
   * レベル分布を整形する
   * Requirements: 10.1, 10.2
   *
   * @param userContext ユーザーコンテキスト
   * @returns 整形された文字列
   */
  private formatLevelDistribution(userContext: UserContext): string {
    if (!userContext.levelDistribution) {
      return '未評価';
    }

    const { beginner, intermediate, advanced, expert, unassessed } = userContext.levelDistribution;
    const parts: string[] = [];

    if (beginner > 0) parts.push(`初級${beginner}`);
    if (intermediate > 0) parts.push(`中級${intermediate}`);
    if (advanced > 0) parts.push(`上級${advanced}`);
    if (expert > 0) parts.push(`エキスパート${expert}`);
    if (unassessed > 0) parts.push(`未評価${unassessed}`);

    return parts.length > 0 ? parts.join('、') : '未評価';
  }
}

// シングルトンインスタンス
let promptBuilderInstance: PromptBuilder | null = null;

/**
 * PromptBuilderのシングルトンインスタンスを取得する
 */
export function getPromptBuilder(): PromptBuilder {
  if (!promptBuilderInstance) {
    promptBuilderInstance = new PromptBuilder();
  }
  return promptBuilderInstance;
}

/**
 * PromptBuilderインスタンスをリセットする（テスト用）
 */
export function resetPromptBuilder(): void {
  promptBuilderInstance = null;
}
