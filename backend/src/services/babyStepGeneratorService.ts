/**
 * Baby Step Generator Service
 *
 * 習慣を簡略化するためのベビーステッププランを生成するサービス。
 * THLI-24フレームワークに基づいて、Lv.50（半分の負荷）と
 * Lv.10（最小限の習慣）のプランを生成する。
 *
 * Requirements:
 * - 6.2: Lv.50とLv.10のベビーステッププラン生成
 * - 6.3: 変数削減によるレベル調整
 * - 6.4: 最小限の習慣（2分ルール）
 * - 16.1: Lv.50目標レベル計算
 * - 16.2: 変数削減優先順位
 * - 16.3: 頻度削減変換
 * - 16.4: 所要時間削減変換
 * - 16.5: 最小限の習慣構造
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getLogger } from '../utils/logger.js';
import { HabitRepository } from '../repositories/habitRepository.js';
import type { Habit } from '../schemas/habit.js';
import type {
  THLIVariable,
  LevelEstimate,
  BabyStepPlan,
  BabyStepPlans,
  VariableReduction,
  MinimalHabit,
  WorkloadChanges,
  VariableId,
  DiscreteScore,
} from '../types/thli.js';
import {
  VARIABLE_REDUCTION_PRIORITY,
  FREQUENCY_REDUCTION_RULES,
  DURATION_REDUCTION_RULES,
  calculateLv50Target,
  calculateLv10Target,
  sumVariableScores,
} from '../types/thli.js';

const logger = getLogger('babyStepGeneratorService');

// =============================================================================
// Constants
// =============================================================================

/**
 * 変数名の日本語マッピング
 */
const VARIABLE_NAME_JA: Record<VariableId, string> = {
  '①': 'アクション複雑性',
  '②': '意思決定負荷',
  '③': 'スキル要件',
  '④': '注意力要求',
  '⑤': '記憶負荷',
  '⑥': '計画要件',
  '⑦': '身体的努力',
  '⑧': '場所依存性',
  '⑨': 'ツール要件',
  '⑩': '移動距離',
  '⑪': '準備/片付け',
  '⑫': '環境制御',
  '⑬': '所要時間',
  '⑭': '時間枠の厳格さ',
  '⑮': 'スケジュール複雑性',
  '⑯': '中断リスク',
  '⑰': '回復時間',
  '⑱': '頻度',
  '⑲': '社会的可視性',
  '⑳': '説明責任',
  '㉑': '社会的調整',
  '㉒': '外部依存性',
  '㉓': '回避トリガー',
  '㉔': 'アイデンティティ整合性',
};

/**
 * 頻度の日本語マッピング
 */
const FREQUENCY_JA: Record<string, string> = {
  daily: '毎日',
  '3x/week': '週3回',
  weekly: '週1回',
  biweekly: '隔週',
  monthly: '月1回',
};

/**
 * 離散スコアセット
 */
const DISCRETE_SCORE_SET: DiscreteScore[] = [0.0, 1.4, 2.8, 4.1, 5.5, 6.9, 8.3];

// =============================================================================
// BabyStepGeneratorService Class
// =============================================================================

/**
 * ベビーステップ生成サービス
 *
 * 習慣の難易度を下げるためのベビーステッププランを生成する。
 * THLI-24フレームワークに基づいて、変数を優先順位に従って削減し、
 * 目標レベルに到達するプランを作成する。
 */
export class BabyStepGeneratorService {
  private habitRepo: HabitRepository;

  /**
   * BabyStepGeneratorServiceを初期化する
   *
   * @param supabase - Supabaseクライアント
   */
  constructor(supabase: SupabaseClient) {
    this.habitRepo = new HabitRepository(supabase);
  }

  // ===========================================================================
  // 6.4: generateBabySteps - Lv.50とLv.10のプラン生成
  // ===========================================================================

  /**
   * ベビーステッププランを生成する
   *
   * Requirements: 6.2, 6.3, 16.1
   *
   * @param habitId - 習慣ID
   * @param currentAssessment - 現在のTHLI-24評価結果
   * @returns Lv.50とLv.10のベビーステッププラン
   */
  async generateBabySteps(
    habitId: string,
    currentAssessment: LevelEstimate
  ): Promise<BabyStepPlans> {
    logger.info('Generating baby steps', { habitId });

    // 1. 習慣情報を取得
    const habit = await this.habitRepo.getById(habitId);
    if (!habit) {
      throw new Error(`Habit not found: ${habitId}`);
    }

    // 2. 現在のレベルを取得（期待値の中央値を使用）
    const currentLevel = Math.round(
      (currentAssessment.expected.min + currentAssessment.expected.max) / 2
    );

    // 3. Lv.50プランを生成
    const lv50Target = calculateLv50Target(currentLevel);
    const lv50Plan = await this.generatePlanForTargetLevel(
      habit,
      currentAssessment.variables,
      currentLevel,
      lv50Target,
      'lv50'
    );

    // 4. Lv.10プランを生成
    const lv10Target = calculateLv10Target(currentLevel);
    const lv10Plan = await this.generatePlanForTargetLevel(
      habit,
      currentAssessment.variables,
      currentLevel,
      lv10Target,
      'lv10'
    );

    logger.info('Baby steps generated', {
      habitId,
      currentLevel,
      lv50Target,
      lv10Target,
    });

    return {
      lv50: lv50Plan,
      lv10: lv10Plan,
    };
  }

  /**
   * 目標レベルに対するプランを生成
   */
  private async generatePlanForTargetLevel(
    habit: Habit,
    currentVariables: THLIVariable[],
    currentLevel: number,
    targetLevel: number,
    planType: 'lv50' | 'lv10'
  ): Promise<BabyStepPlan> {
    // 1. 変数削減を計算
    const reductions = await this.calculateVariableReductions(
      currentVariables,
      targetLevel
    );

    // 2. ワークロード変更を計算
    const workloadChanges = this.calculateWorkloadChanges(habit, reductions);

    // 3. 簡略化された習慣名を生成
    const simplifiedName = this.generateSimplifiedName(habit.name, reductions, planType);

    // 4. 説明を生成
    const explanation = this.generateExplanation(reductions, planType);

    // 5. 推定難易度を計算
    const estimatedDifficulty = this.calculateEstimatedDifficulty(
      currentLevel,
      targetLevel
    );

    return {
      targetLevel,
      name: simplifiedName,
      changes: reductions,
      workloadChanges,
      explanation,
      estimatedDifficulty,
    };
  }

  // ===========================================================================
  // 6.1: calculateVariableReductions - 変数削減計算
  // ===========================================================================

  /**
   * 目標レベルに到達するための変数削減を計算する
   *
   * Requirements: 16.2
   *
   * @param currentVariables - 現在のTHLI-24変数
   * @param targetLevel - 目標レベル
   * @returns 変数削減リスト
   */
  async calculateVariableReductions(
    currentVariables: THLIVariable[],
    targetLevel: number
  ): Promise<VariableReduction[]> {
    // 1. 現在のレベルを計算
    const currentLevel = sumVariableScores(currentVariables);

    // 2. 削減が必要なポイントを計算
    const pointsToReduce = Math.max(0, currentLevel - targetLevel);

    logger.debug('Calculating variable reductions', {
      currentLevel,
      targetLevel,
      pointsToReduce,
    });

    if (pointsToReduce <= 0) {
      return [];
    }

    // 3. 優先順位に従って変数を削減
    const reductions: VariableReduction[] = [];
    let remainingPoints = pointsToReduce;

    for (const varId of VARIABLE_REDUCTION_PRIORITY) {
      if (remainingPoints <= 0) break;

      const variable = currentVariables.find((v) => v.id === varId);
      if (!variable || variable.score === 0) continue;

      // この変数で削減可能な最大ポイント
      const maxReduction = variable.score;

      // 実際に削減するポイント（必要量と最大量の小さい方）
      const reduction = Math.min(maxReduction, remainingPoints);

      // 削減後の値を計算
      const newScore = this.roundToDiscreteScore(variable.score - reduction);
      const actualReduction = variable.score - newScore;

      if (actualReduction > 0) {
        const variableReduction = this.createVariableReduction(
          variable,
          newScore,
          actualReduction
        );
        reductions.push(variableReduction);
        remainingPoints -= actualReduction;
      }
    }

    return reductions;
  }

  /**
   * 変数削減オブジェクトを作成
   */
  private createVariableReduction(
    variable: THLIVariable,
    newScore: DiscreteScore,
    pointsReduced: number
  ): VariableReduction {
    const currentValue = this.getVariableValueDescription(variable.id, variable.score);
    const newValue = this.getVariableValueDescription(variable.id, newScore);
    const rationale = this.generateReductionRationale(variable.id, pointsReduced);

    return {
      variableId: variable.id,
      variableName: VARIABLE_NAME_JA[variable.id] || variable.name,
      currentValue,
      newValue,
      pointsReduced,
      rationale,
    };
  }

  // ===========================================================================
  // 6.2: Frequency Reduction Transformations
  // ===========================================================================

  /**
   * 頻度削減変換を適用する
   *
   * Requirements: 16.3
   *
   * @param currentFrequency - 現在の頻度
   * @param targetReduction - 目標削減ポイント
   * @returns 変換結果（新しい頻度と削減ポイント）
   */
  applyFrequencyReduction(
    currentFrequency: string,
    targetReduction: number
  ): { newFrequency: string; pointsReduced: number } {
    const normalizedFrequency = this.normalizeFrequency(currentFrequency);
    let newFrequency = normalizedFrequency;
    let totalReduced = 0;

    // daily → 3x/week (2.8 points)
    if (normalizedFrequency === 'daily' && targetReduction >= 2.8) {
      newFrequency = '3x/week';
      totalReduced += FREQUENCY_REDUCTION_RULES.daily_to_3x_week.pointsReduced;
    }

    // 3x/week → weekly (1.4 points)
    if (
      (normalizedFrequency === '3x/week' || newFrequency === '3x/week') &&
      targetReduction - totalReduced >= 1.4
    ) {
      newFrequency = 'weekly';
      totalReduced += FREQUENCY_REDUCTION_RULES['3x_week_to_weekly'].pointsReduced;
    }

    // weekly → biweekly (1.4 points)
    if (
      (normalizedFrequency === 'weekly' || newFrequency === 'weekly') &&
      targetReduction - totalReduced >= 1.4
    ) {
      newFrequency = 'biweekly';
      totalReduced += FREQUENCY_REDUCTION_RULES.weekly_to_biweekly.pointsReduced;
    }

    return {
      newFrequency,
      pointsReduced: totalReduced,
    };
  }

  /**
   * 頻度文字列を正規化
   */
  private normalizeFrequency(frequency: string): string {
    const lower = frequency.toLowerCase();
    if (lower.includes('daily') || lower.includes('毎日')) return 'daily';
    if (lower.includes('3x') || lower.includes('週3')) return '3x/week';
    if (lower.includes('weekly') || lower.includes('週1')) return 'weekly';
    if (lower.includes('biweekly') || lower.includes('隔週')) return 'biweekly';
    if (lower.includes('monthly') || lower.includes('月1')) return 'monthly';
    return frequency;
  }

  // ===========================================================================
  // 6.3: Duration Reduction Transformations
  // ===========================================================================

  /**
   * 所要時間削減変換を適用する
   *
   * Requirements: 16.4
   *
   * @param currentDuration - 現在の所要時間（分）
   * @param targetReduction - 目標削減ポイント
   * @returns 変換結果（新しい所要時間と削減ポイント）
   */
  applyDurationReduction(
    currentDuration: number,
    targetReduction: number
  ): { newDuration: number; pointsReduced: number } {
    let newDuration = currentDuration;
    let totalReduced = 0;

    // >60min → 30min (2.8 points)
    if (currentDuration > 60 && targetReduction >= 2.8) {
      newDuration = 30;
      totalReduced += DURATION_REDUCTION_RULES['60_to_30'].pointsReduced;
    } else if (currentDuration >= 30 && currentDuration <= 60 && targetReduction >= 2.8) {
      newDuration = 30;
      // 60分以下から30分への削減は2.8ポイント未満
      totalReduced += Math.min(2.8, (currentDuration - 30) / 30 * 2.8);
    }

    // 30min → 15min (1.4 points)
    if (
      (currentDuration >= 30 || newDuration === 30) &&
      newDuration >= 30 &&
      targetReduction - totalReduced >= 1.4
    ) {
      newDuration = 15;
      totalReduced += DURATION_REDUCTION_RULES['30_to_15'].pointsReduced;
    }

    // 15min → 5min (1.4 points)
    if (
      (currentDuration >= 15 || newDuration === 15) &&
      newDuration >= 15 &&
      targetReduction - totalReduced >= 1.4
    ) {
      newDuration = 5;
      totalReduced += DURATION_REDUCTION_RULES['15_to_5'].pointsReduced;
    }

    return {
      newDuration,
      pointsReduced: totalReduced,
    };
  }

  // ===========================================================================
  // 6.5: generateMinimalHabit - Lv.10最小限の習慣生成
  // ===========================================================================

  /**
   * 最小限の習慣（Lv.10）を生成する
   *
   * Requirements: 6.4, 16.5
   *
   * @param habit - 元の習慣
   * @returns 最小限の習慣（キュー、アクション、停止条件、フォールバック）
   */
  async generateMinimalHabit(habit: Habit): Promise<MinimalHabit> {
    logger.info('Generating minimal habit', { habitId: habit.id, habitName: habit.name });

    // 習慣のコアアイデンティティを保持しながら最小化
    const coreAction = this.extractCoreAction(habit.name);
    const cue = this.generateCue(habit);
    const action = this.generateMinimalAction(coreAction);
    const stopCondition = this.generateStopCondition(action);
    const fallback = this.generateFallback(coreAction);

    return {
      cue,
      action,
      stopCondition,
      fallback,
      estimatedDuration: 2, // 2分ルール
    };
  }

  /**
   * 習慣名からコアアクションを抽出
   */
  private extractCoreAction(habitName: string): string {
    // 時間や頻度の情報を除去してコアアクションを抽出
    const patterns = [
      /(\d+)分/g,
      /(\d+)時間/g,
      /毎日/g,
      /週(\d+)回/g,
      /(\d+)km/g,
      /(\d+)回/g,
    ];

    let core = habitName;
    for (const pattern of patterns) {
      core = core.replace(pattern, '').trim();
    }

    return core || habitName;
  }

  /**
   * キューを生成
   */
  private generateCue(habit: Habit): string {
    // 習慣の頻度に基づいてキューを生成
    const frequency = habit.frequency || 'daily';

    const cueTemplates: Record<string, string[]> = {
      daily: [
        '朝起きたら',
        '朝食後に',
        '仕事を始める前に',
        '昼食後に',
        '帰宅したら',
        '夕食後に',
        '寝る前に',
      ],
      weekly: [
        '週末の朝に',
        '日曜日の午後に',
        '土曜日の朝に',
      ],
      monthly: [
        '月初めに',
        '給料日に',
        '月末に',
      ],
    };

    const templates = cueTemplates[frequency] ?? cueTemplates['daily'] ?? [];
    // ランダムではなく、習慣名のハッシュに基づいて選択
    const index = templates.length > 0 ? this.simpleHash(habit.name) % templates.length : 0;
    return templates[index] ?? '朝起きたら';
  }

  /**
   * 最小限のアクションを生成（2分ルール）
   */
  private generateMinimalAction(coreAction: string): string {
    // コアアクションを2分以内で完了できる形に変換
    const minimalActions: Record<string, string> = {
      'ジョギング': '玄関で靴を履く',
      'ランニング': '玄関で靴を履く',
      '走る': '玄関で靴を履く',
      '運動': 'ストレッチを1回する',
      '筋トレ': '腕立て伏せを1回する',
      '読書': '本を開いて1ページ読む',
      '本を読む': '本を開いて1ページ読む',
      '勉強': 'テキストを開く',
      '学習': 'テキストを開く',
      '瞑想': '目を閉じて深呼吸を1回する',
      'メディテーション': '目を閉じて深呼吸を1回する',
      '日記': 'ノートを開いて1行書く',
      '書く': 'ペンを持って1文字書く',
      '掃除': '1つのものを片付ける',
      '片付け': '1つのものを元の場所に戻す',
      '料理': '冷蔵庫を開ける',
      '水を飲む': 'コップを手に取る',
      'ストレッチ': '腕を1回伸ばす',
      'ヨガ': 'マットを敷く',
      '散歩': '玄関のドアを開ける',
      'ウォーキング': '玄関のドアを開ける',
    };

    // コアアクションに一致するものを探す
    for (const [key, minimal] of Object.entries(minimalActions)) {
      if (coreAction.includes(key)) {
        return minimal;
      }
    }

    // 一致しない場合は汎用的な最小アクション
    return `${coreAction}の準備をする`;
  }

  /**
   * 停止条件を生成
   */
  private generateStopCondition(action: string): string {
    return `${action}したら終わり`;
  }

  /**
   * フォールバックを生成
   */
  private generateFallback(coreAction: string): string {
    return `${coreAction}ができなかったら、関連するものを見るだけでもOK`;
  }

  /**
   * 簡単なハッシュ関数
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * 離散スコアセットに丸める
   */
  private roundToDiscreteScore(rawScore: number): DiscreteScore {
    let closest: DiscreteScore = 0.0;
    let minDiff = Infinity;

    for (const score of DISCRETE_SCORE_SET) {
      const diff = Math.abs(rawScore - score);
      if (diff < minDiff) {
        minDiff = diff;
        closest = score;
      }
    }

    return closest;
  }

  /**
   * 変数の値の説明を取得
   */
  private getVariableValueDescription(
    variableId: VariableId,
    score: DiscreteScore
  ): string {
    // 頻度（⑱）の場合
    if (variableId === '⑱') {
      if (score >= 8.3) return '毎日';
      if (score >= 6.9) return '週3回';
      if (score >= 4.1) return '週1回';
      if (score >= 2.8) return '隔週';
      return '月1回';
    }

    // 所要時間（⑬）の場合
    if (variableId === '⑬') {
      if (score >= 8.3) return '60分以上';
      if (score >= 6.9) return '45分';
      if (score >= 5.5) return '30分';
      if (score >= 4.1) return '15分';
      if (score >= 2.8) return '10分';
      if (score >= 1.4) return '5分';
      return '2分以下';
    }

    // その他の変数
    if (score >= 6.9) return '高';
    if (score >= 4.1) return '中';
    if (score >= 1.4) return '低';
    return 'なし';
  }

  /**
   * 削減の根拠を生成
   */
  private generateReductionRationale(
    variableId: VariableId,
    pointsReduced: number
  ): string {
    const variableName = VARIABLE_NAME_JA[variableId];
    return `${variableName}を削減することで、${pointsReduced.toFixed(1)}ポイント軽減`;
  }

  /**
   * ワークロード変更を計算
   */
  private calculateWorkloadChanges(
    habit: Habit,
    reductions: VariableReduction[]
  ): WorkloadChanges {
    const changes: WorkloadChanges = {};

    for (const reduction of reductions) {
      // 頻度の変更
      if (reduction.variableId === '⑱') {
        changes.frequency = {
          old: FREQUENCY_JA[habit.frequency || 'daily'] || habit.frequency || 'daily',
          new: reduction.newValue,
        };
      }

      // 所要時間の変更（workload_per_countを使用）
      if (reduction.variableId === '⑬' && habit.workload_per_count) {
        const oldDuration = habit.workload_per_count;
        const newDuration = this.estimateDurationFromScore(reduction.newValue);
        changes.duration = {
          old: oldDuration,
          new: newDuration,
        };
      }
    }

    return changes;
  }

  /**
   * スコアから所要時間を推定
   */
  private estimateDurationFromScore(scoreDescription: string): number {
    const durationMap: Record<string, number> = {
      '60分以上': 60,
      '45分': 45,
      '30分': 30,
      '15分': 15,
      '10分': 10,
      '5分': 5,
      '2分以下': 2,
    };
    return durationMap[scoreDescription] || 15;
  }

  /**
   * 簡略化された習慣名を生成
   */
  private generateSimplifiedName(
    originalName: string,
    reductions: VariableReduction[],
    planType: 'lv50' | 'lv10'
  ): string {
    if (planType === 'lv10') {
      // Lv.10は最小限の習慣名
      const coreAction = this.extractCoreAction(originalName);
      return `${coreAction}（最小版）`;
    }

    // Lv.50は変更を反映した名前
    let newName = originalName;

    for (const reduction of reductions) {
      if (reduction.variableId === '⑱') {
        // 頻度の変更を反映
        newName = newName.replace(/毎日|週\d+回|daily/gi, reduction.newValue);
      }
      if (reduction.variableId === '⑬') {
        // 所要時間の変更を反映
        newName = newName.replace(/\d+分/g, reduction.newValue);
      }
    }

    // 変更がない場合は「（軽量版）」を追加
    if (newName === originalName) {
      newName = `${originalName}（軽量版）`;
    }

    return newName;
  }

  /**
   * 説明を生成
   */
  private generateExplanation(
    reductions: VariableReduction[],
    planType: 'lv50' | 'lv10'
  ): string {
    if (planType === 'lv10') {
      return '2分ルールに基づいた最小限の習慣です。まずはこの小さな一歩から始めて、習慣の土台を作りましょう。';
    }

    if (reductions.length === 0) {
      return '現在の習慣は既に適切なレベルです。';
    }

    const changeDescriptions = reductions.map(
      (r) => `${r.variableName}: ${r.currentValue} → ${r.newValue}`
    );

    return `以下の変更により、習慣の負荷を半分に軽減します：\n${changeDescriptions.join('\n')}`;
  }

  /**
   * 推定難易度を計算
   */
  private calculateEstimatedDifficulty(
    currentLevel: number,
    targetLevel: number
  ): string {
    const ratio = targetLevel / currentLevel;

    if (ratio <= 0.1) return '最小限の負荷';
    if (ratio <= 0.3) return '大幅に軽減';
    if (ratio <= 0.5) return '半分の負荷';
    if (ratio <= 0.7) return 'やや軽減';
    return '現状維持';
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * BabyStepGeneratorServiceのインスタンスを作成
 *
 * @param supabase - Supabaseクライアント
 * @returns BabyStepGeneratorServiceインスタンス
 */
export function createBabyStepGeneratorService(
  supabase: SupabaseClient
): BabyStepGeneratorService {
  return new BabyStepGeneratorService(supabase);
}
