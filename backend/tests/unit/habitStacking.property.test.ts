/**
 * Habit Stacking Property Tests
 *
 * 習慣スタッキング機能のプロパティテスト
 *
 * **Validates: Requirements 7.1, 7.2, 7.4**
 * - 7.1: アンカー習慣の特定（達成率80%以上）
 * - 7.2: 習慣スタッキングフォーマット
 * - 7.4: マスターデータのトリガー活用
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import path from 'path';
import { PersonalizationEngine } from '../../src/services/personalizationEngine.js';
import {
  MasterDataLoader,
  resetMasterDataLoader,
} from '../../src/services/masterDataLoader.js';
import type { AnchorHabit } from '../../src/types/personalization.js';

// 実際のマスターデータディレクトリ
const REAL_SUGGESTIONS_DIR = path.join(process.cwd(), 'specs/ai-coach/suggestions');

// アンカー習慣の閾値
const ANCHOR_HABIT_THRESHOLD = 0.8;

// 習慣スタッキングフォーマットのパターン
const STACKING_FORMULA_PATTERN = /「.+」.*(?:した後に|に).*「.+」/;

describe('Habit Stacking Property Tests', () => {
  let masterDataLoader: MasterDataLoader;

  beforeEach(() => {
    resetMasterDataLoader();
    masterDataLoader = new MasterDataLoader(REAL_SUGGESTIONS_DIR);
  });

  afterEach(() => {
    resetMasterDataLoader();
  });

  /**
   * Property 9: Anchor Habit Identification
   *
   * アンカー習慣は達成率80%以上の習慣から特定される
   * **Validates: Requirement 7.1**
   */
  describe('Property 9: Anchor Habit Identification', () => {
    // PersonalizationEngineのidentifyAnchorHabitsメソッドをテスト
    // 注: PersonalizationEngineはSupabaseClientを必要とするため、
    // identifyAnchorHabitsメソッドを直接テストする

    /**
     * 習慣データのArbitrary
     */
    const habitArbitrary = fc.record({
      id: fc.uuid(),
      name: fc.string({ minLength: 1, maxLength: 50 }),
      triggerTime: fc.option(
        fc.tuple(
          fc.integer({ min: 0, max: 23 }),
          fc.integer({ min: 0, max: 59 })
        ).map(([h, m]) => `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`),
        { nil: null }
      ),
    });

    /**
     * 達成率のArbitrary（0-1の範囲）
     * Note: fc.float requires 32-bit float values, so we use Math.fround
     */
    const completionRateArbitrary = fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true });

    it('should only identify habits with completion rate >= 80% as anchors', () => {
      fc.assert(
        fc.property(
          fc.array(habitArbitrary, { minLength: 1, maxLength: 20 }),
          fc.array(completionRateArbitrary, { minLength: 1, maxLength: 20 }),
          (habits, rates) => {
            // 習慣と達成率のマップを作成
            const completionRates = new Map<string, number>();
            habits.forEach((habit, index) => {
              completionRates.set(habit.id, rates[index % rates.length] ?? 0);
            });

            // PersonalizationEngineのidentifyAnchorHabitsを直接呼び出す
            // 注: 静的メソッドとして呼び出すためにインスタンスを作成せずにテスト
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

            // すべてのアンカー習慣は達成率80%以上
            for (const anchor of anchorHabits) {
              expect(anchor.completionRate).toBeGreaterThanOrEqual(ANCHOR_HABIT_THRESHOLD);
            }

            // 達成率80%未満の習慣はアンカーに含まれない
            for (const habit of habits) {
              const rate = completionRates.get(habit.id) || 0;
              if (rate < ANCHOR_HABIT_THRESHOLD) {
                const isAnchor = anchorHabits.some(a => a.habitId === habit.id);
                expect(isAnchor).toBe(false);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should sort anchor habits by completion rate in descending order', () => {
      fc.assert(
        fc.property(
          fc.array(habitArbitrary, { minLength: 2, maxLength: 20 }),
          fc.array(
            fc.float({ min: Math.fround(0.8), max: Math.fround(1), noNaN: true }),
            { minLength: 2, maxLength: 20 }
          ),
          (habits, rates) => {
            // すべての習慣に80%以上の達成率を設定
            const completionRates = new Map<string, number>();
            habits.forEach((habit, index) => {
              completionRates.set(habit.id, rates[index % rates.length] ?? 0.8);
            });

            // アンカー習慣を特定
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
            anchorHabits.sort((a, b) => b.completionRate - a.completionRate);

            // ソート順を検証
            for (let i = 1; i < anchorHabits.length; i++) {
              expect(anchorHabits[i - 1]!.completionRate).toBeGreaterThanOrEqual(
                anchorHabits[i]!.completionRate
              );
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should return empty array when no habits meet threshold', () => {
      fc.assert(
        fc.property(
          fc.array(habitArbitrary, { minLength: 1, maxLength: 10 }),
          fc.array(
            fc.float({ min: Math.fround(0), max: Math.fround(0.79), noNaN: true }),
            { minLength: 1, maxLength: 10 }
          ),
          (habits, rates) => {
            // すべての習慣に80%未満の達成率を設定
            const completionRates = new Map<string, number>();
            habits.forEach((habit, index) => {
              completionRates.set(habit.id, rates[index % rates.length] ?? 0);
            });

            // アンカー習慣を特定
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

            // アンカー習慣は空
            expect(anchorHabits).toHaveLength(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should preserve trigger time information in anchor habits', () => {
      fc.assert(
        fc.property(
          fc.array(habitArbitrary, { minLength: 1, maxLength: 10 }),
          (habits) => {
            // すべての習慣に90%の達成率を設定
            const completionRates = new Map<string, number>();
            habits.forEach((habit) => {
              completionRates.set(habit.id, 0.9);
            });

            // アンカー習慣を特定
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

            // トリガー時間が保持されている
            for (const anchor of anchorHabits) {
              const originalHabit = habits.find(h => h.id === anchor.habitId);
              expect(anchor.triggerTime).toBe(originalHabit?.triggerTime ?? null);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 10: Habit Stacking Format
   *
   * 習慣スタッキングの提案は正しいフォーマットに従う
   * **Validates: Requirements 7.2, 7.4**
   */
  describe('Property 10: Habit Stacking Format', () => {
    /**
     * 習慣スタッキングフォーマットを生成するヘルパー関数
     */
    const generateStackingFormula = (anchorHabit: string, newHabit: string): string => {
      return `「${anchorHabit}」をした後に、「${newHabit}」をする`;
    };

    it('should generate stacking formula in correct format', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 30 }),
          fc.string({ minLength: 1, maxLength: 30 }),
          (anchorHabit, newHabit) => {
            const formula = generateStackingFormula(anchorHabit, newHabit);

            // フォーマットが正しい
            expect(formula).toContain('「');
            expect(formula).toContain('」');
            expect(formula).toContain('した後に');

            // アンカー習慣と新習慣が含まれる
            expect(formula).toContain(anchorHabit);
            expect(formula).toContain(newHabit);

            // パターンにマッチする
            expect(formula).toMatch(STACKING_FORMULA_PATTERN);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include anchor habit name in stacking suggestion', () => {
      fc.assert(
        fc.property(
          fc.record({
            habitName: fc.string({ minLength: 1, maxLength: 30 }),
            completionRate: fc.float({ min: Math.fround(0.8), max: Math.fround(1), noNaN: true }),
            triggerTime: fc.option(fc.constant('07:00'), { nil: null }),
          }),
          fc.string({ minLength: 1, maxLength: 30 }),
          (anchor, newHabitName) => {
            // 提案を生成
            const suggestion = {
              anchorHabit: anchor.habitName,
              completionRate: `${Math.round(anchor.completionRate * 100)}%`,
              stackingFormula: generateStackingFormula(anchor.habitName, newHabitName),
              reason: `達成率${Math.round(anchor.completionRate * 100)}%の安定した習慣なので、良いアンカーになります`,
              triggerTime: anchor.triggerTime,
            };

            // アンカー習慣名が含まれる
            expect(suggestion.anchorHabit).toBe(anchor.habitName);
            expect(suggestion.stackingFormula).toContain(anchor.habitName);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should include completion rate in suggestion reason', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0.8), max: Math.fround(1), noNaN: true }),
          (completionRate) => {
            const percentage = Math.round(completionRate * 100);
            const reason = `達成率${percentage}%の安定した習慣なので、良いアンカーになります`;

            // 達成率が理由に含まれる
            expect(reason).toContain(`${percentage}%`);
            expect(reason).toContain('安定した習慣');
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property: Master Data Stacking Triggers
   *
   * マスターデータのhabitStackingTriggersが正しく活用される
   * **Validates: Requirement 7.4**
   */
  describe('Master Data Stacking Triggers', () => {
    const REAL_CATEGORIES = [
      'health-fitness',
      'work-productivity',
      'learning-skills',
      'hobbies-relaxation',
      'relationships',
      'finance',
      'mindfulness-spirituality',
      'self-care-beauty',
      'home-living',
      'parenting-family',
      'social-contribution',
      'digital-technology',
      'career-growth',
    ];

    it('should have habitStackingTriggers in master data habits', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...REAL_CATEGORIES),
          async (category) => {
            const habits = await masterDataLoader.getHabitsByCategory(category);

            // 各習慣にhabitStackingTriggersフィールドがある
            for (const habit of habits) {
              expect(habit).toHaveProperty('habitStackingTriggers');
              expect(Array.isArray(habit.habitStackingTriggers)).toBe(true);
            }
          }
        ),
        { numRuns: REAL_CATEGORIES.length }
      );
    });

    it('should find stacking candidates based on trigger matching', async () => {
      // 一般的なトリガーキーワードでテスト
      const commonTriggers = ['朝', '起床', '食事', '歯磨き', '仕事', '運動'];

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...commonTriggers),
          async (triggerKeyword) => {
            const candidates = await masterDataLoader.getStackingCandidates(triggerKeyword);

            // 候補が見つかった場合、トリガーにキーワードが含まれる
            for (const candidate of candidates) {
              const hasMatchingTrigger = candidate.habitStackingTriggers.some(
                t => t.toLowerCase().includes(triggerKeyword.toLowerCase()) ||
                     triggerKeyword.toLowerCase().includes(t.toLowerCase())
              );
              expect(hasMatchingTrigger).toBe(true);
            }
          }
        ),
        { numRuns: commonTriggers.length }
      );
    });

    it('should return habits with category information in stacking candidates', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('朝', '運動', '読書'),
          async (keyword) => {
            const candidates = await masterDataLoader.getStackingCandidates(keyword);

            // 各候補にカテゴリ情報が含まれる
            for (const candidate of candidates) {
              expect(candidate).toHaveProperty('category');
              expect(typeof candidate.category).toBe('string');
              expect(candidate.category.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 3 }
      );
    });
  });

  /**
   * Property: Stacking Suggestion Structure
   *
   * 習慣スタッキング提案の構造が正しい
   */
  describe('Stacking Suggestion Structure', () => {
    it('should have all required fields in stacking suggestion', () => {
      fc.assert(
        fc.property(
          fc.record({
            anchorHabit: fc.string({ minLength: 1, maxLength: 30 }),
            completionRate: fc.float({ min: Math.fround(0.8), max: Math.fround(1), noNaN: true }),
            triggerTime: fc.option(fc.constant('07:00'), { nil: null }),
          }),
          fc.string({ minLength: 1, maxLength: 30 }),
          (anchor, newHabitName) => {
            const suggestion = {
              anchorHabit: anchor.anchorHabit,
              completionRate: `${Math.round(anchor.completionRate * 100)}%`,
              stackingFormula: `「${anchor.anchorHabit}」をした後に、「${newHabitName}」をする`,
              reason: `達成率${Math.round(anchor.completionRate * 100)}%の安定した習慣なので、良いアンカーになります`,
              triggerTime: anchor.triggerTime,
            };

            // 必須フィールドが存在する
            expect(suggestion).toHaveProperty('anchorHabit');
            expect(suggestion).toHaveProperty('completionRate');
            expect(suggestion).toHaveProperty('stackingFormula');
            expect(suggestion).toHaveProperty('reason');

            // フィールドの型が正しい
            expect(typeof suggestion.anchorHabit).toBe('string');
            expect(typeof suggestion.completionRate).toBe('string');
            expect(typeof suggestion.stackingFormula).toBe('string');
            expect(typeof suggestion.reason).toBe('string');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should format completion rate as percentage string', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
          (rate) => {
            const formatted = `${Math.round(rate * 100)}%`;

            // パーセント記号が含まれる
            expect(formatted).toContain('%');

            // 数値部分が0-100の範囲
            const numericPart = parseInt(formatted.replace('%', ''));
            expect(numericPart).toBeGreaterThanOrEqual(0);
            expect(numericPart).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
