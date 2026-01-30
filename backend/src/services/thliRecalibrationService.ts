/**
 * THLI Recalibration Service
 *
 * THLI-24スコアリング基準の更新と習慣の再評価を管理するサービス。
 * 新しい13段階スコアセットを使用して、より細かい粒度でレベルを評価します。
 *
 * Requirements (level-system-rebalancing):
 * - 4.1: 新しいスコアセット（13段階）を使用
 * - 4.2: レベル正規化の更新
 * - 6.2, 6.3: 再評価フラグと再評価機能
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('thliRecalibrationService');

// =============================================================================
// Constants
// =============================================================================

/**
 * 旧スコアセット（7段階）
 * 
 * 従来のTHLI-24評価で使用されていたスコアセット
 */
export const OLD_SCORE_SET = [0.0, 1.4, 2.8, 4.1, 5.5, 6.9, 8.3];

/**
 * 新スコアセット（13段階）
 * 
 * より細かい粒度でレベルを評価するための新しいスコアセット
 * 
 * Property 4: THLI-24 Score Normalization
 * Validates: Requirements 4.1, 4.2
 */
export const NEW_SCORE_SET = [
  0.0,  // 最小
  0.7,  // 非常に低い
  1.4,  // 低い
  2.1,  // やや低い
  2.8,  // 中低
  3.5,  // 中
  4.1,  // 中高
  4.8,  // やや高い
  5.5,  // 高い
  6.2,  // かなり高い
  6.9,  // 非常に高い
  7.6,  // 極めて高い
  8.3,  // 最大
];

/**
 * スコアラベル（日本語）
 */
export const SCORE_LABELS_JA = [
  '最小',
  '非常に低い',
  '低い',
  'やや低い',
  '中低',
  '中',
  '中高',
  'やや高い',
  '高い',
  'かなり高い',
  '非常に高い',
  '極めて高い',
  '最大',
];

/**
 * スコアラベル（英語）
 */
export const SCORE_LABELS_EN = [
  'Minimum',
  'Very Low',
  'Low',
  'Slightly Low',
  'Below Average',
  'Average',
  'Above Average',
  'Slightly High',
  'High',
  'Very High',
  'Extremely High',
  'Outstanding',
  'Maximum',
];

/** THLI-24の変数数 */
const THLI_VARIABLE_COUNT = 24;

/** 最大可能スコア合計 */
const MAX_POSSIBLE_SUM = THLI_VARIABLE_COUNT * 8.3; // 199.2

/** 最大レベル（v2.0） */
const MAX_LEVEL = 9999;

// =============================================================================
// Types
// =============================================================================

/**
 * 再評価結果
 */
export interface RecalibrationResult {
  /** 習慣ID */
  habitId: string;
  /** 旧レベル */
  oldLevel: number | null;
  /** 新レベル */
  newLevel: number;
  /** 旧評価データ */
  oldAssessmentData: object | null;
  /** 新評価データ */
  newAssessmentData: object;
  /** 再評価日時 */
  recalibratedAt: Date;
}

/**
 * バッチ再評価結果
 */
export interface BatchRecalibrationResult {
  /** 総習慣数 */
  totalHabits: number;
  /** 再評価された習慣数 */
  recalibratedHabits: number;
  /** 失敗した習慣数 */
  failedHabits: number;
  /** 個別結果 */
  results: RecalibrationResult[];
  /** エラー */
  errors: { habitId: string; error: string }[];
}

/**
 * 習慣レコード（再評価用）
 */
interface HabitRecord {
  id: string;
  name: string;
  level: number | null;
  level_assessment_data: object | null;
  needs_recalibration: boolean;
  frequency?: string;
  workload_per_count?: number;
  workload_unit?: string | null;
  target_count?: number;
}

// =============================================================================
// Pure Calculation Functions
// =============================================================================

/**
 * 変数スコアの合計からレベルを正規化
 * 
 * Property 4: THLI-24 Score Normalization
 * Validates: Requirements 4.1, 4.2
 * 
 * @param variableSum - 24変数のスコア合計
 * @returns 正規化されたレベル（0-9999）
 */
export function normalizeToLevel(variableSum: number): number {
  if (variableSum <= 0) return 0;
  
  // 新しい正規化: floor((sum / maxSum) * 9999)
  const normalizedLevel = Math.floor((variableSum / MAX_POSSIBLE_SUM) * MAX_LEVEL);
  return Math.min(MAX_LEVEL, Math.max(0, normalizedLevel));
}

/**
 * 旧スコアセットから新スコアセットへの変換
 * 
 * 旧スコア（7段階）を新スコア（13段階）にマッピング
 * 
 * @param oldScore - 旧スコア値
 * @returns 新スコア値
 */
export function convertOldScoreToNew(oldScore: number): number {
  // 旧スコアセットのインデックスを見つける
  const oldIndex = OLD_SCORE_SET.findIndex(s => Math.abs(s - oldScore) < 0.01);
  
  if (oldIndex === -1) {
    // 見つからない場合は最も近いスコアを返す
    return findClosestScore(oldScore, NEW_SCORE_SET);
  }
  
  // 旧インデックスを新インデックスにマッピング
  // 0 -> 0, 1 -> 2, 2 -> 4, 3 -> 6, 4 -> 8, 5 -> 10, 6 -> 12
  const newIndex = oldIndex * 2;
  return NEW_SCORE_SET[newIndex] ?? oldScore;
}

/**
 * 最も近いスコアを見つける
 * 
 * @param value - 検索する値
 * @param scoreSet - スコアセット
 * @returns 最も近いスコア
 */
export function findClosestScore(value: number, scoreSet: number[]): number {
  let closest = scoreSet[0] ?? 0;
  let minDiff = Math.abs(value - closest);
  
  for (const score of scoreSet) {
    const diff = Math.abs(value - score);
    if (diff < minDiff) {
      minDiff = diff;
      closest = score;
    }
  }
  
  return closest;
}

/**
 * スコアインデックスからラベルを取得
 * 
 * @param scoreIndex - スコアインデックス（0-12）
 * @param locale - ロケール（'ja' or 'en'）
 * @returns スコアラベル
 */
export function getScoreLabel(scoreIndex: number, locale: 'ja' | 'en' = 'ja'): string {
  const labels = locale === 'ja' ? SCORE_LABELS_JA : SCORE_LABELS_EN;
  return labels[scoreIndex] ?? labels[0] ?? '';
}

/**
 * ワークロードからレベルを推定
 * 
 * 習慣のメタデータからレベルを推定（クイック評価用）
 * 
 * @param habit - 習慣データ
 * @returns 推定レベル
 */
export function estimateLevelFromWorkload(habit: {
  frequency?: string;
  workload_per_count?: number;
  workload_unit?: string | null;
  target_count?: number;
}): number {
  let baseLevel = 50; // 中間レベルから開始

  // 頻度による調整
  if (habit.frequency === 'daily') {
    baseLevel += 30;
  } else if (habit.frequency === 'weekly') {
    baseLevel += 15;
  } else if (habit.frequency === 'monthly') {
    baseLevel += 5;
  }

  // ワークロード時間による調整
  if (habit.workload_per_count) {
    if (habit.workload_per_count >= 60) {
      baseLevel += 40; // 60分以上
    } else if (habit.workload_per_count >= 30) {
      baseLevel += 25; // 30-59分
    } else if (habit.workload_per_count >= 15) {
      baseLevel += 10; // 15-29分
    } else if (habit.workload_per_count >= 5) {
      baseLevel += 5; // 5-14分
    }
  }

  // ターゲット回数による調整
  if (habit.target_count && habit.target_count > 1) {
    baseLevel += Math.min(20, habit.target_count * 5);
  }

  // 有効範囲にクランプ（0-199、旧システム互換）
  return Math.min(199, Math.max(0, baseLevel));
}

// =============================================================================
// THLIRecalibrationService Class
// =============================================================================

/**
 * THLI Recalibration Service
 * 
 * THLI-24スコアリング基準の更新と習慣の再評価を管理
 */
export class THLIRecalibrationService {
  private readonly supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * 新しいスコアセットを取得
   * 
   * Requirements: 4.1
   * 
   * @returns 13段階スコアセット
   */
  getExpandedScoreSet(): number[] {
    return [...NEW_SCORE_SET];
  }

  /**
   * 習慣を新しい基準で再評価
   * 
   * Requirements: 6.2, 6.3
   * 
   * @param habitId - 習慣ID
   * @returns 再評価結果
   */
  async recalibrateHabit(habitId: string): Promise<RecalibrationResult> {
    logger.info('Recalibrating habit', { habitId });

    // 習慣を取得
    const { data: habit, error } = await this.supabase
      .from('habits')
      .select('id, name, level, level_assessment_data, needs_recalibration, frequency, workload_per_count, workload_unit, target_count')
      .eq('id', habitId)
      .single();

    if (error || !habit) {
      throw new Error(`Habit not found: ${habitId}`);
    }

    const habitRecord = habit as HabitRecord;
    const oldLevel = habitRecord.level;
    const oldAssessmentData = habitRecord.level_assessment_data;

    // 新しいレベルを計算
    let newLevel: number;
    let newAssessmentData: object;

    if (oldAssessmentData && typeof oldAssessmentData === 'object') {
      // 既存の評価データがある場合、スコアを変換
      const assessmentData = oldAssessmentData as Record<string, unknown>;
      const variableScores = assessmentData['variableScores'] as number[] | undefined;
      
      if (variableScores && Array.isArray(variableScores)) {
        // 旧スコアを新スコアに変換
        const newVariableScores = variableScores.map(score => convertOldScoreToNew(score));
        const variableSum = newVariableScores.reduce((sum, score) => sum + score, 0);
        newLevel = normalizeToLevel(variableSum);
        
        newAssessmentData = {
          ...assessmentData,
          variableScores: newVariableScores,
          variableSum,
          level: newLevel,
          scoreSetVersion: 'v2.0',
          recalibratedAt: new Date().toISOString(),
          recalibratedFrom: oldLevel,
        };
      } else {
        // 変数スコアがない場合はワークロードから推定
        newLevel = estimateLevelFromWorkload(habitRecord);
        newAssessmentData = {
          assessmentType: 'workload_estimation',
          level: newLevel,
          scoreSetVersion: 'v2.0',
          recalibratedAt: new Date().toISOString(),
          recalibratedFrom: oldLevel,
        };
      }
    } else {
      // 評価データがない場合はワークロードから推定
      newLevel = estimateLevelFromWorkload(habitRecord);
      newAssessmentData = {
        assessmentType: 'workload_estimation',
        level: newLevel,
        scoreSetVersion: 'v2.0',
        recalibratedAt: new Date().toISOString(),
        recalibratedFrom: oldLevel,
      };
    }

    // ティアを計算
    let tier: string;
    if (newLevel < 50) tier = 'beginner';
    else if (newLevel < 100) tier = 'intermediate';
    else if (newLevel < 500) tier = 'advanced';
    else tier = 'expert';

    // 習慣を更新
    const now = new Date().toISOString();
    const { error: updateError } = await this.supabase
      .from('habits')
      .update({
        level: newLevel,
        level_tier: tier,
        level_assessment_data: newAssessmentData,
        old_level_assessment_data: oldAssessmentData,
        needs_recalibration: false,
        recalibrated_at: now,
        updated_at: now,
      })
      .eq('id', habitId);

    if (updateError) {
      throw new Error(`Failed to update habit: ${updateError.message}`);
    }

    // レベル履歴を記録
    await this.supabase.from('level_history').insert({
      entity_type: 'habit',
      entity_id: habitId,
      old_level: oldLevel,
      new_level: newLevel,
      reason: 'recalibration',
      workload_delta: {},
      assessed_at: now,
    });

    logger.info('Habit recalibrated', {
      habitId,
      oldLevel,
      newLevel,
      tier,
    });

    return {
      habitId,
      oldLevel,
      newLevel,
      oldAssessmentData,
      newAssessmentData,
      recalibratedAt: new Date(),
    };
  }

  /**
   * バッチ再評価を実行
   * 
   * Requirements: 6.5
   * 
   * @param userId - ユーザーID
   * @param habitIds - 習慣IDリスト（省略時は全ての再評価が必要な習慣）
   * @returns バッチ再評価結果
   */
  async batchRecalibrate(
    userId: string,
    habitIds?: string[]
  ): Promise<BatchRecalibrationResult> {
    logger.info('Starting batch recalibration', { userId, habitIds });

    // 再評価対象の習慣を取得
    let query = this.supabase
      .from('habits')
      .select('id')
      .eq('owner_id', userId)
      .eq('active', true);

    if (habitIds && habitIds.length > 0) {
      query = query.in('id', habitIds);
    } else {
      query = query.eq('needs_recalibration', true);
    }

    const { data: habits, error } = await query;

    if (error) {
      throw new Error(`Failed to get habits: ${error.message}`);
    }

    const result: BatchRecalibrationResult = {
      totalHabits: habits?.length ?? 0,
      recalibratedHabits: 0,
      failedHabits: 0,
      results: [],
      errors: [],
    };

    if (!habits || habits.length === 0) {
      return result;
    }

    // 各習慣を再評価
    for (const habit of habits) {
      try {
        const recalibrationResult = await this.recalibrateHabit(habit.id);
        result.results.push(recalibrationResult);
        result.recalibratedHabits++;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        result.errors.push({ habitId: habit.id, error: errorMessage });
        result.failedHabits++;
        logger.warning('Failed to recalibrate habit', { habitId: habit.id, error: errorMessage });
      }
    }

    logger.info('Batch recalibration completed', {
      userId,
      total: result.totalHabits,
      recalibrated: result.recalibratedHabits,
      failed: result.failedHabits,
    });

    return result;
  }

  /**
   * 再評価が必要な習慣を取得
   * 
   * @param userId - ユーザーID
   * @returns 再評価が必要な習慣リスト
   */
  async getHabitsNeedingRecalibration(userId: string): Promise<HabitRecord[]> {
    const { data, error } = await this.supabase
      .from('habits')
      .select('id, name, level, level_assessment_data, needs_recalibration, frequency, workload_per_count, workload_unit, target_count')
      .eq('owner_id', userId)
      .eq('active', true)
      .eq('needs_recalibration', true);

    if (error) {
      throw new Error(`Failed to get habits: ${error.message}`);
    }

    return (data ?? []) as HabitRecord[];
  }

  /**
   * 全ての習慣に再評価フラグを設定
   * 
   * 移行時に使用
   * 
   * @param userId - ユーザーID（省略時は全ユーザー）
   * @returns 更新された習慣数
   */
  async markAllHabitsForRecalibration(userId?: string): Promise<number> {
    let query = this.supabase
      .from('habits')
      .update({
        needs_recalibration: true,
        updated_at: new Date().toISOString(),
      })
      .eq('active', true)
      .is('needs_recalibration', false);

    if (userId) {
      query = query.eq('owner_id', userId);
    }

    const { data, error } = await query.select('id');

    if (error) {
      throw new Error(`Failed to mark habits: ${error.message}`);
    }

    return data?.length ?? 0;
  }
}
