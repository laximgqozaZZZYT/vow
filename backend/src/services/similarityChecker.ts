/**
 * Similarity Checker
 *
 * 習慣名の類似度を計算し、重複を検出するコンポーネント
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { getLogger } from '../utils/logger.js';
import type { SimilarityResult, ISimilarityChecker } from '../types/personalization.js';

const logger = getLogger('similarityChecker');

/** 類似度の閾値（これを超えると重複とみなす） */
const SIMILARITY_THRESHOLD = 0.7;

/**
 * SimilarityChecker実装クラス
 */
export class SimilarityChecker implements ISimilarityChecker {
  private readonly threshold: number;

  constructor(threshold: number = SIMILARITY_THRESHOLD) {
    this.threshold = threshold;
  }

  /**
   * 類似度をチェックする
   * Requirements: 4.1, 4.2
   *
   * @param newHabitName 新しい習慣名
   * @param existingHabitNames 既存の習慣名リスト
   * @returns 類似度チェック結果
   */
  checkSimilarity(newHabitName: string, existingHabitNames: string[]): SimilarityResult {
    if (!newHabitName || newHabitName.trim() === '') {
      return {
        isUnique: true,
        mostSimilarHabit: null,
        similarityScore: 0,
      };
    }

    const normalizedNew = this.normalizeHabitName(newHabitName);
    let maxScore = 0;
    let mostSimilar: string | null = null;

    for (const existing of existingHabitNames) {
      if (!existing || existing.trim() === '') {
        continue;
      }

      const normalizedExisting = this.normalizeHabitName(existing);
      const score = this.calculateSimilarityScore(normalizedNew, normalizedExisting);

      if (score > maxScore) {
        maxScore = score;
        mostSimilar = existing;
      }
    }

    const result: SimilarityResult = {
      isUnique: maxScore < this.threshold,
      mostSimilarHabit: mostSimilar,
      similarityScore: maxScore,
    };

    // 重複検出時のログ出力（Requirements: 4.5）
    if (!result.isUnique) {
      logger.debug('Duplicate habit detected', {
        newHabitName,
        mostSimilarHabit: mostSimilar,
        similarityScore: maxScore,
      });
    }

    return result;
  }

  /**
   * 類似度スコアを計算する
   * Requirements: 4.3
   *
   * @param name1 習慣名1（正規化済み）
   * @param name2 習慣名2（正規化済み）
   * @returns 類似度スコア（0-1）
   */
  calculateSimilarityScore(name1: string, name2: string): number {
    // 空文字列の場合は0を返す
    if (!name1 || !name2) {
      return 0;
    }

    // 完全一致チェック
    if (name1 === name2) {
      return 1.0;
    }

    // 包含チェック（一方が他方を含む場合）
    if (name1.includes(name2) || name2.includes(name1)) {
      const lengthRatio =
        Math.min(name1.length, name2.length) / Math.max(name1.length, name2.length);
      // 長さの比率が高い場合は高い類似度を返す
      if (lengthRatio > 0.7) {
        return 0.9;
      }
      // 長さの比率が低い場合でも、包含関係があれば中程度の類似度
      return 0.6 + lengthRatio * 0.2;
    }

    // Levenshtein距離ベースの類似度
    const distance = this.levenshteinDistance(name1, name2);
    const maxLength = Math.max(name1.length, name2.length);

    return 1 - distance / maxLength;
  }

  /**
   * 習慣名を正規化する
   * Requirements: 4.4
   *
   * @param name 習慣名
   * @returns 正規化された習慣名
   */
  normalizeHabitName(name: string): string {
    if (!name) {
      return '';
    }

    return name
      .toLowerCase()
      // 全角スペースを半角に変換
      .replace(/　/g, ' ')
      // 連続するスペースを1つに
      .replace(/\s+/g, ' ')
      // 前後のスペースを削除
      .trim()
      // スペースを削除（比較用）
      .replace(/\s/g, '')
      // 日本語の句読点を削除
      .replace(/[・、。「」『』【】（）()]/g, '')
      // 数字の全角を半角に変換
      .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));
  }

  /**
   * Levenshtein距離を計算する
   *
   * @param s1 文字列1
   * @param s2 文字列2
   * @returns 編集距離
   */
  private levenshteinDistance(s1: string, s2: string): number {
    const m = s1.length;
    const n = s2.length;

    // 空文字列の場合
    if (m === 0) return n;
    if (n === 0) return m;

    // DPテーブルを作成
    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0) as number[]);

    // 初期化
    for (let i = 0; i <= m; i++) {
      dp[i]![0] = i;
    }
    for (let j = 0; j <= n; j++) {
      dp[0]![j] = j;
    }

    // DPで計算
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          dp[i]![j] = dp[i - 1]![j - 1]!;
        } else {
          dp[i]![j] = 1 + Math.min(
            dp[i - 1]![j]!,     // 削除
            dp[i]![j - 1]!,     // 挿入
            dp[i - 1]![j - 1]!  // 置換
          );
        }
      }
    }

    return dp[m]![n]!;
  }
}

// シングルトンインスタンス
let similarityCheckerInstance: SimilarityChecker | null = null;

/**
 * SimilarityCheckerのシングルトンインスタンスを取得する
 */
export function getSimilarityChecker(): SimilarityChecker {
  if (!similarityCheckerInstance) {
    similarityCheckerInstance = new SimilarityChecker();
  }
  return similarityCheckerInstance;
}

/**
 * SimilarityCheckerインスタンスをリセットする（テスト用）
 */
export function resetSimilarityChecker(): void {
  similarityCheckerInstance = null;
}
