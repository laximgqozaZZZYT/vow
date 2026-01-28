/**
 * Personalization Engine
 *
 * ユーザーコンテキストを分析し、パーソナライズされた提案を生成するエンジン
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 7.1
 */

import { getLogger } from '../utils/logger.js';
import { HabitRepository } from '../repositories/habitRepository.js';
import { ActivityRepository } from '../repositories/activityRepository.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  UserContext,
  UserLevel,
  HabitFrequency,
  TimeSlot,
  AnchorHabit,
  IPersonalizationEngine,
} from '../types/personalization.js';

const logger = getLogger('personalizationEngine');

/** アンカー習慣の達成率閾値 */
const ANCHOR_HABIT_THRESHOLD = 0.8;

/** 分析対象の日数 */
const ANALYSIS_PERIOD_DAYS = 30;

/**
 * PersonalizationEngine実装クラス
 */
export class PersonalizationEngine implements IPersonalizationEngine {
  private habitRepo: HabitRepository;
  private activityRepo: ActivityRepository;

  constructor(supabase: SupabaseClient) {
    this.habitRepo = new HabitRepository(supabase);
    this.activityRepo = new ActivityRepository(supabase);
  }

  /**
   * ユーザーコンテキストを分析する
   * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
   */
  async analyzeUserContext(userId: string): Promise<UserContext> {
    try {
      // アクティブな習慣を取得
      const habits = await this.habitRepo.getByOwner('user', userId, true);
      const activeHabits = habits.filter(h => h.active);

      // 習慣がない場合はデフォルトのビギナーコンテキストを返す
      if (activeHabits.length === 0) {
        logger.debug('No active habits found, returning default beginner context', { userId });
        return this.createDefaultContext(userId);
      }

      // 過去30日間のアクティビティを取得
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - ANALYSIS_PERIOD_DAYS);
      const now = new Date();

      const activities = await this.activityRepo.getActivitiesByOwnerInRange(
        'user',
        userId,
        thirtyDaysAgo,
        now
      );

      // 各習慣の達成率を計算
      const completionRates = this.calculateCompletionRates(activeHabits, activities);

      // 平均達成率を計算
      const averageCompletionRate = this.calculateAverageCompletionRate(completionRates);

      // ユーザーレベルを判定
      const userLevel = this.determineUserLevel({
        activeHabitCount: activeHabits.length,
        averageCompletionRate,
      });

      // 好みの頻度を特定
      const preferredFrequency = this.identifyPreferredFrequency(activeHabits);

      // 好みの時間帯を特定
      const preferredTimeSlots = this.identifyPreferredTimeSlots(
        activities.map(a => ({ completedAt: new Date(a.timestamp) }))
      );

      // アンカー習慣を特定
      const anchorHabits = this.identifyAnchorHabits(
        activeHabits.map(h => ({
          id: h.id,
          name: h.name,
          triggerTime: (h as { trigger_time?: string | null }).trigger_time || null,
        })),
        completionRates
      );

      const context: UserContext = {
        userId,
        activeHabitCount: activeHabits.length,
        averageCompletionRate,
        userLevel,
        preferredFrequency,
        preferredTimeSlots,
        existingHabitNames: activeHabits.map(h => h.name),
        anchorHabits,
        // THLI-24 レベルコンテキストを追加
        ...this.analyzeLevelContext(activeHabits),
      };

      logger.debug('User context analyzed', {
        userId,
        activeHabitCount: context.activeHabitCount,
        averageCompletionRate: Math.round(context.averageCompletionRate * 100),
        userLevel: context.userLevel,
      });

      return context;
    } catch (error) {
      logger.error('Failed to analyze user context', error as Error, { userId });
      // エラー時はデフォルトコンテキストを返す
      return this.createDefaultContext(userId);
    }
  }

  /**
   * ユーザーレベルを判定する
   * Requirements: 2.1, 2.2, 2.3
   *
   * - beginner: 習慣数 < 3 または 達成率 < 40%
   * - intermediate: 3 <= 習慣数 <= 7 かつ 40% <= 達成率 <= 70%
   * - advanced: 習慣数 > 7 かつ 達成率 > 70%
   */
  determineUserLevel(context: Partial<UserContext>): UserLevel {
    const { activeHabitCount = 0, averageCompletionRate = 0 } = context;

    // beginner条件: 習慣数 < 3 または 達成率 < 40%
    if (activeHabitCount < 3 || averageCompletionRate < 0.4) {
      return 'beginner';
    }

    // advanced条件: 習慣数 > 7 かつ 達成率 > 70%
    if (activeHabitCount > 7 && averageCompletionRate > 0.7) {
      return 'advanced';
    }

    // それ以外はintermediate
    return 'intermediate';
  }

  /**
   * 好みの時間帯を特定する
   * Requirements: 1.4
   */
  identifyPreferredTimeSlots(activities: Array<{ completedAt: Date }>): TimeSlot[] {
    if (activities.length === 0) {
      return [];
    }

    // 時間帯ごとの頻度をカウント
    const hourCounts = new Map<number, number>();

    for (const activity of activities) {
      const hour = activity.completedAt.getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    }

    // 頻度順にソートしてTimeSlot配列を作成
    const timeSlots: TimeSlot[] = Array.from(hourCounts.entries())
      .map(([hour, frequency]) => ({ hour, frequency }))
      .sort((a, b) => b.frequency - a.frequency);

    return timeSlots;
  }

  /**
   * アンカー習慣を特定する
   * Requirements: 7.1
   *
   * 達成率80%以上の習慣をアンカー習慣として特定
   */
  identifyAnchorHabits(
    habits: Array<{ id: string; name: string; triggerTime: string | null }>,
    completionRates: Map<string, number>
  ): AnchorHabit[] {
    const anchorHabits: AnchorHabit[] = [];

    for (const habit of habits) {
      const completionRate = completionRates.get(habit.id) || 0;

      if (completionRate >= ANCHOR_HABIT_THRESHOLD) {
        anchorHabits.push({
          habitId: habit.id,
          habitName: habit.name,
          completionRate,
          triggerTime: habit.triggerTime,
        });
      }
    }

    // 達成率順にソート
    return anchorHabits.sort((a, b) => b.completionRate - a.completionRate);
  }

  /**
   * 好みの頻度を特定する
   * Requirements: 1.3
   */
  private identifyPreferredFrequency(
    habits: Array<{ frequency: string }>
  ): HabitFrequency {
    if (habits.length === 0) {
      return 'daily';
    }

    const frequencyCounts = new Map<string, number>();

    for (const habit of habits) {
      const freq = habit.frequency || 'daily';
      frequencyCounts.set(freq, (frequencyCounts.get(freq) || 0) + 1);
    }

    // 最も多い頻度を返す
    let maxCount = 0;
    let preferredFrequency: HabitFrequency = 'daily';

    for (const [freq, count] of frequencyCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        preferredFrequency = freq as HabitFrequency;
      }
    }

    return preferredFrequency;
  }

  /**
   * 各習慣の達成率を計算する
   */
  private calculateCompletionRates(
    habits: Array<{ id: string; frequency: string }>,
    activities: Array<{ habit_id: string; timestamp: string }>
  ): Map<string, number> {
    const completionRates = new Map<string, number>();

    for (const habit of habits) {
      // この習慣のアクティビティをカウント
      const habitActivities = activities.filter(a => a.habit_id === habit.id);
      const completedCount = habitActivities.length;

      // 期待される完了数を計算（30日間）
      let expectedCount: number;
      switch (habit.frequency) {
        case 'daily':
          expectedCount = ANALYSIS_PERIOD_DAYS;
          break;
        case 'weekly':
          expectedCount = Math.floor(ANALYSIS_PERIOD_DAYS / 7);
          break;
        case 'monthly':
          expectedCount = 1;
          break;
        default:
          expectedCount = ANALYSIS_PERIOD_DAYS;
      }

      // 達成率を計算（0-1の範囲に制限）
      const rate = expectedCount > 0 ? Math.min(completedCount / expectedCount, 1) : 0;
      completionRates.set(habit.id, rate);
    }

    return completionRates;
  }

  /**
   * 平均達成率を計算する
   * Requirements: 1.2
   */
  private calculateAverageCompletionRate(completionRates: Map<string, number>): number {
    if (completionRates.size === 0) {
      return 0;
    }

    let sum = 0;
    for (const rate of completionRates.values()) {
      sum += rate;
    }

    return sum / completionRates.size;
  }

  /**
   * デフォルトのビギナーコンテキストを作成する
   * Requirements: 1.5
   */
  private createDefaultContext(userId: string): UserContext {
    return {
      userId,
      activeHabitCount: 0,
      averageCompletionRate: 0,
      userLevel: 'beginner',
      preferredFrequency: 'daily',
      preferredTimeSlots: [],
      existingHabitNames: [],
      anchorHabits: [],
    };
  }

  /**
   * THLI-24レベルコンテキストを分析する
   * Requirements: 10.1 (AI Coach Integration - level context)
   */
  private analyzeLevelContext(
    habits: Array<{ id: string; name: string; level?: number | null | undefined; level_tier?: string | null | undefined }>
  ): Partial<UserContext> {
    // レベル分布を計算
    const levelDistribution = {
      beginner: 0,
      intermediate: 0,
      advanced: 0,
      expert: 0,
      unassessed: 0,
    };

    const assessedHabits: Array<{ id: string; name: string; level: number; tier: string }> = [];

    for (const habit of habits) {
      if (habit.level === null || habit.level === undefined) {
        levelDistribution.unassessed++;
      } else {
        const tier = habit.level_tier || this.calculateTier(habit.level);
        switch (tier) {
          case 'beginner':
            levelDistribution.beginner++;
            break;
          case 'intermediate':
            levelDistribution.intermediate++;
            break;
          case 'advanced':
            levelDistribution.advanced++;
            break;
          case 'expert':
            levelDistribution.expert++;
            break;
        }
        assessedHabits.push({
          id: habit.id,
          name: habit.name,
          level: habit.level,
          tier,
        });
      }
    }

    // 評価済み習慣がない場合
    if (assessedHabits.length === 0) {
      return { levelDistribution };
    }

    // 平均レベルを計算
    const totalLevel = assessedHabits.reduce((sum, h) => sum + h.level, 0);
    const averageHabitLevel = Math.round(totalLevel / assessedHabits.length);

    // 最高・最低レベルの習慣を特定
    const sortedByLevel = [...assessedHabits].sort((a, b) => b.level - a.level);
    const highestLevelHabit = sortedByLevel[0] ? {
      habitId: sortedByLevel[0].id,
      habitName: sortedByLevel[0].name,
      level: sortedByLevel[0].level,
      tier: sortedByLevel[0].tier,
    } : undefined;

    const lowestLevelHabit = sortedByLevel[sortedByLevel.length - 1] ? {
      habitId: sortedByLevel[sortedByLevel.length - 1]!.id,
      habitName: sortedByLevel[sortedByLevel.length - 1]!.name,
      level: sortedByLevel[sortedByLevel.length - 1]!.level,
      tier: sortedByLevel[sortedByLevel.length - 1]!.tier,
    } : undefined;

    return {
      levelDistribution,
      averageHabitLevel,
      highestLevelHabit: highestLevelHabit ?? undefined,
      lowestLevelHabit: lowestLevelHabit ?? undefined,
    } as Partial<UserContext>;
  }

  /**
   * レベルからティアを計算する
   */
  private calculateTier(level: number): string {
    if (level < 50) return 'beginner';
    if (level < 100) return 'intermediate';
    if (level < 150) return 'advanced';
    return 'expert';
  }
}

// シングルトンインスタンス管理
let personalizationEngineInstance: PersonalizationEngine | null = null;

/**
 * PersonalizationEngineのシングルトンインスタンスを取得する
 */
export function getPersonalizationEngine(supabase: SupabaseClient): PersonalizationEngine {
  if (!personalizationEngineInstance) {
    personalizationEngineInstance = new PersonalizationEngine(supabase);
  }
  return personalizationEngineInstance;
}

/**
 * PersonalizationEngineインスタンスをリセットする（テスト用）
 */
export function resetPersonalizationEngine(): void {
  personalizationEngineInstance = null;
}
