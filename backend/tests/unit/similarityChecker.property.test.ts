/**
 * SimilarityChecker Property Tests
 *
 * Feature: ai-coach-quality-improvement
 * Property 6: Similarity Score Calculation
 * Property 7: High Similarity Rejection
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { SimilarityChecker } from '../../src/services/similarityChecker.js';

// SimilarityCheckerのインスタンスを作成
const checker = new SimilarityChecker();

// プロパティテストの設定
const propertyConfig = { numRuns: 100 };

describe('Feature: ai-coach-quality-improvement', () => {
  describe('Property 6: Similarity Score Calculation', () => {
    /**
     * Validates: Requirements 4.1, 4.3, 4.4
     *
     * For any two habit names, the similarity score SHALL:
     * - Return 1.0 for exact matches (after normalization)
     * - Return a value between 0 and 1
     * - Be symmetric (similarity(a, b) == similarity(b, a))
     * - Treat normalized names as equivalent
     */
    it('should return 1.0 for exact matches after normalization', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          (name) => {
            const normalized = checker.normalizeHabitName(name);
            if (normalized === '') return true; // 空文字列になる場合はスキップ

            const score = checker.calculateSimilarityScore(normalized, normalized);
            return score === 1.0;
          }
        ),
        propertyConfig
      );
    });

    it('should return a value between 0 and 1', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 50 }),
          fc.string({ minLength: 0, maxLength: 50 }),
          (name1, name2) => {
            const score = checker.calculateSimilarityScore(name1, name2);
            return score >= 0 && score <= 1;
          }
        ),
        propertyConfig
      );
    });

    it('should be symmetric', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (name1, name2) => {
            const score1 = checker.calculateSimilarityScore(name1, name2);
            const score2 = checker.calculateSimilarityScore(name2, name1);
            // 浮動小数点の誤差を考慮
            return Math.abs(score1 - score2) < 0.0001;
          }
        ),
        propertyConfig
      );
    });

    it('should treat normalized names as equivalent', () => {
      // 日本語の習慣名でテスト
      const testCases = [
        ['朝 ストレッチ', '朝ストレッチ'],
        ['毎日　読書', '毎日読書'],
        ['ジョギング（朝）', 'ジョギング朝'],
        ['１０分瞑想', '10分瞑想'],
      ];

      for (const [name1, name2] of testCases) {
        const normalized1 = checker.normalizeHabitName(name1);
        const normalized2 = checker.normalizeHabitName(name2);
        expect(normalized1).toBe(normalized2);
      }
    });

    it('should return 0 for empty strings', () => {
      expect(checker.calculateSimilarityScore('', '')).toBe(0);
      expect(checker.calculateSimilarityScore('test', '')).toBe(0);
      expect(checker.calculateSimilarityScore('', 'test')).toBe(0);
    });
  });

  describe('Property 7: High Similarity Rejection', () => {
    /**
     * Validates: Requirements 4.2
     *
     * For any habit suggestion with similarity score > 0.7 to an existing habit,
     * the suggestion SHALL be rejected and marked as duplicate.
     */
    it('should reject suggestions with similarity score > 0.7', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 3, maxLength: 30 }),
          (baseName) => {
            const normalized = checker.normalizeHabitName(baseName);
            if (normalized.length < 3) return true; // 短すぎる場合はスキップ

            // 同じ名前でチェック（類似度1.0）
            const result = checker.checkSimilarity(baseName, [baseName]);
            return result.isUnique === false && result.similarityScore >= 0.7;
          }
        ),
        propertyConfig
      );
    });

    it('should accept suggestions with similarity score <= 0.7', () => {
      // 明らかに異なる習慣名
      const result = checker.checkSimilarity('朝のジョギング', ['夜の読書', '瞑想']);
      expect(result.isUnique).toBe(true);
      expect(result.similarityScore).toBeLessThanOrEqual(0.7);
    });

    it('should detect similar habit names', () => {
      const testCases = [
        { new: '朝のジョギング', existing: ['朝ジョギング'], shouldReject: true },
        { new: '毎日読書30分', existing: ['毎日読書'], shouldReject: true },
        { new: '朝ストレッチ', existing: ['朝のストレッチ'], shouldReject: true },
        { new: '瞑想', existing: ['ジョギング', '読書'], shouldReject: false },
      ];

      for (const testCase of testCases) {
        const result = checker.checkSimilarity(testCase.new, testCase.existing);
        if (testCase.shouldReject) {
          expect(result.isUnique).toBe(false);
        } else {
          expect(result.isUnique).toBe(true);
        }
      }
    });

    it('should return the most similar habit', () => {
      const result = checker.checkSimilarity('朝のジョギング', [
        '夜の読書',
        '朝ジョギング',
        '瞑想',
      ]);

      expect(result.mostSimilarHabit).toBe('朝ジョギング');
    });
  });

  describe('Normalization', () => {
    /**
     * Validates: Requirements 4.4
     */
    it('should normalize whitespace correctly', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 5 }),
          (parts) => {
            // スペースで結合
            const withSpaces = parts.join(' ');
            // スペースなしで結合
            const withoutSpaces = parts.join('');

            const normalized1 = checker.normalizeHabitName(withSpaces);
            const normalized2 = checker.normalizeHabitName(withoutSpaces);

            // 正規化後は同じになるはず
            return normalized1 === normalized2;
          }
        ),
        propertyConfig
      );
    });

    it('should convert to lowercase', () => {
      const result = checker.normalizeHabitName('Morning Jog');
      expect(result).toBe('morningjog');
    });

    it('should remove Japanese punctuation', () => {
      const result = checker.normalizeHabitName('朝・ストレッチ（10分）');
      expect(result).toBe('朝ストレッチ10分');
    });

    it('should convert full-width numbers to half-width', () => {
      const result = checker.normalizeHabitName('１０分瞑想');
      expect(result).toBe('10分瞑想');
    });

    it('should handle empty and whitespace-only strings', () => {
      expect(checker.normalizeHabitName('')).toBe('');
      expect(checker.normalizeHabitName('   ')).toBe('');
      expect(checker.normalizeHabitName('　　　')).toBe('');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty existing habits list', () => {
      const result = checker.checkSimilarity('新しい習慣', []);
      expect(result.isUnique).toBe(true);
      expect(result.mostSimilarHabit).toBeNull();
      expect(result.similarityScore).toBe(0);
    });

    it('should handle empty new habit name', () => {
      const result = checker.checkSimilarity('', ['既存の習慣']);
      expect(result.isUnique).toBe(true);
      expect(result.similarityScore).toBe(0);
    });

    it('should handle very long habit names', () => {
      const longName = 'あ'.repeat(100);
      const result = checker.checkSimilarity(longName, [longName]);
      expect(result.isUnique).toBe(false);
      expect(result.similarityScore).toBe(1.0);
    });

    it('should handle special characters', () => {
      const result = checker.checkSimilarity('習慣①②③', ['習慣123']);
      // 特殊文字は削除されないので異なる
      expect(result.similarityScore).toBeLessThan(1.0);
    });
  });
});
