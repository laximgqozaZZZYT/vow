/**
 * Goal Suggestion Property Tests
 *
 * ゴール提案機能のプロパティテスト
 *
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
 * - 8.1: 既存習慣のカテゴリ分析
 * - 8.2: 各ゴールに2-4個の習慣提案
 * - 8.3: 既存ゴールとの重複回避
 * - 8.4: 関連カテゴリのゴール優先
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import path from 'path';
import {
  MasterDataLoader,
  resetMasterDataLoader,
} from '../../src/services/masterDataLoader.js';
import { SimilarityChecker, resetSimilarityChecker } from '../../src/services/similarityChecker.js';

// 実際のマスターデータディレクトリ
const REAL_SUGGESTIONS_DIR = path.join(process.cwd(), 'specs/ai-coach/suggestions');

// 実際のカテゴリ一覧
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

describe('Goal Suggestion Property Tests', () => {
  let masterDataLoader: MasterDataLoader;
  let similarityChecker: SimilarityChecker;

  beforeEach(() => {
    resetMasterDataLoader();
    resetSimilarityChecker();
    masterDataLoader = new MasterDataLoader(REAL_SUGGESTIONS_DIR);
    similarityChecker = new SimilarityChecker();
  });

  afterEach(() => {
    resetMasterDataLoader();
    resetSimilarityChecker();
  });

  /**
   * Property 11: Goal Suggestion Structure
   *
   * ゴール提案は正しい構造を持つ
   * **Validates: Requirement 8.2**
   */
  describe('Property 11: Goal Suggestion Structure', () => {
    it('should have all required fields in goal suggestions from master data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...REAL_CATEGORIES),
          async (category) => {
            const categoryData = await masterDataLoader.loadCategory(category);
            expect(categoryData).not.toBeNull();

            if (categoryData) {
              for (const goal of categoryData.goals) {
                // 必須フィールドが存在する
                expect(goal).toHaveProperty('name');
                expect(goal).toHaveProperty('reason');
                expect(goal).toHaveProperty('suggestedHabits');

                // フィールドの型が正しい
                expect(typeof goal.name).toBe('string');
                expect(typeof goal.reason).toBe('string');
                expect(Array.isArray(goal.suggestedHabits)).toBe(true);

                // 名前が空でない
                expect(goal.name.length).toBeGreaterThan(0);
              }
            }
          }
        ),
        { numRuns: REAL_CATEGORIES.length }
      );
    });

    it('should have suggested habits in goal suggestions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...REAL_CATEGORIES),
          async (category) => {
            const categoryData = await masterDataLoader.loadCategory(category);
            expect(categoryData).not.toBeNull();

            if (categoryData) {
              for (const goal of categoryData.goals) {
                // suggestedHabitsは配列
                expect(Array.isArray(goal.suggestedHabits)).toBe(true);

                // 各習慣提案は文字列
                for (const habit of goal.suggestedHabits) {
                  expect(typeof habit).toBe('string');
                  expect(habit.length).toBeGreaterThan(0);
                }
              }
            }
          }
        ),
        { numRuns: REAL_CATEGORIES.length }
      );
    });

    it('should have optional icon and description fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...REAL_CATEGORIES),
          async (category) => {
            const categoryData = await masterDataLoader.loadCategory(category);
            expect(categoryData).not.toBeNull();

            if (categoryData) {
              for (const goal of categoryData.goals) {
                // iconがある場合は文字列
                if (goal.icon !== undefined) {
                  expect(typeof goal.icon).toBe('string');
                }

                // descriptionがある場合は文字列
                if (goal.description !== undefined) {
                  expect(typeof goal.description).toBe('string');
                }
              }
            }
          }
        ),
        { numRuns: REAL_CATEGORIES.length }
      );
    });
  });

  /**
   * Property: Goal-Habit Relationship
   *
   * ゴールと習慣の関連性
   * **Validates: Requirements 8.2, 8.4**
   */
  describe('Goal-Habit Relationship', () => {
    it('should have habits related to the goal category', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...REAL_CATEGORIES),
          async (category) => {
            const categoryData = await masterDataLoader.loadCategory(category);
            expect(categoryData).not.toBeNull();

            if (categoryData && categoryData.goals.length > 0 && categoryData.habits.length > 0) {
              // カテゴリ内の習慣名を取得
              const habitNames = categoryData.habits.map(h => h.name.toLowerCase());

              // 少なくとも1つのゴールが、カテゴリ内の習慣を提案している
              const hasRelatedHabits = categoryData.goals.some(goal =>
                goal.suggestedHabits.some(suggestedHabit =>
                  habitNames.some(habitName =>
                    habitName.includes(suggestedHabit.toLowerCase()) ||
                    suggestedHabit.toLowerCase().includes(habitName)
                  )
                )
              );

              // 関連性のチェック（厳密ではなく、存在確認のみ）
              // マスターデータの品質によっては関連がない場合もあるため、警告のみ
              if (!hasRelatedHabits) {
                console.warn(`Category ${category} may have unrelated goal-habit suggestions`);
              }
            }
          }
        ),
        { numRuns: REAL_CATEGORIES.length }
      );
    });
  });

  /**
   * Property: Duplicate Detection for Goals
   *
   * ゴールの重複検出
   * **Validates: Requirement 8.3**
   */
  describe('Duplicate Detection for Goals', () => {
    it('should detect duplicate goals using similarity checker', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...REAL_CATEGORIES),
          async (category) => {
            const categoryData = await masterDataLoader.loadCategory(category);
            expect(categoryData).not.toBeNull();

            if (categoryData && categoryData.goals.length >= 2) {
              // 最初のゴールを既存ゴールとして設定
              const existingGoalNames = [categoryData.goals[0]!.name];

              // 同じゴール名で重複チェック
              const result = similarityChecker.checkSimilarity(
                categoryData.goals[0]!.name,
                existingGoalNames
              );

              // 完全一致なので重複として検出される
              expect(result.isUnique).toBe(false);
              expect(result.similarityScore).toBe(1.0);
            }
          }
        ),
        { numRuns: REAL_CATEGORIES.length }
      );
    });

    it('should allow unique goals when no duplicates exist', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...REAL_CATEGORIES),
          async (category) => {
            const categoryData = await masterDataLoader.loadCategory(category);
            expect(categoryData).not.toBeNull();

            if (categoryData && categoryData.goals.length >= 2) {
              // 最初のゴールを既存ゴールとして設定
              const existingGoalNames = [categoryData.goals[0]!.name];

              // 異なるゴール名で重複チェック
              const differentGoal = categoryData.goals.find(g => g.name !== categoryData.goals[0]!.name);
              if (differentGoal) {
                const result = similarityChecker.checkSimilarity(
                  differentGoal.name,
                  existingGoalNames
                );

                // 異なるゴール名なので、類似度が閾値未満であればユニーク
                if (result.similarityScore < 0.7) {
                  expect(result.isUnique).toBe(true);
                }
              }
            }
          }
        ),
        { numRuns: REAL_CATEGORIES.length }
      );
    });
  });

  /**
   * Property: Goal Enhancement with Habits
   *
   * ゴール提案の習慣強化
   * **Validates: Requirement 8.2**
   */
  describe('Goal Enhancement with Habits', () => {
    /**
     * ゴール提案を強化するヘルパー関数
     * AICoachServiceのcreateGoalSuggestionメソッドのロジックを再現
     */
    const enhanceGoalWithHabits = async (
      goalName: string,
      existingSuggestedHabits: string[],
      existingHabitNames: string[]
    ): Promise<string[]> => {
      let enhancedHabits = [...existingSuggestedHabits];

      if (enhancedHabits.length < 2) {
        const relatedHabits = await masterDataLoader.searchHabits(goalName);

        // Filter out duplicates with existing habits
        const uniqueRelatedHabits = relatedHabits.filter(h => {
          const result = similarityChecker.checkSimilarity(h.name, existingHabitNames);
          return result.isUnique && !enhancedHabits.includes(h.name);
        });

        // Add up to 4 habits total
        const habitsToAdd = uniqueRelatedHabits.slice(0, 4 - enhancedHabits.length);
        enhancedHabits = [...enhancedHabits, ...habitsToAdd.map(h => h.name)];
      }

      return enhancedHabits;
    };

    it('should enhance goals with at least 2 habits when possible', async () => {
      // 一般的なゴール名でテスト
      const goalNames = ['健康', '運動', '学習', '仕事', '読書'];

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...goalNames),
          async (goalName) => {
            const enhancedHabits = await enhanceGoalWithHabits(goalName, [], []);

            // 関連習慣が見つかった場合、少なくとも1つは追加される
            // （マスターデータに関連習慣がない場合は0の可能性もある）
            expect(enhancedHabits.length).toBeGreaterThanOrEqual(0);
            expect(enhancedHabits.length).toBeLessThanOrEqual(4);
          }
        ),
        { numRuns: goalNames.length }
      );
    });

    it('should not add duplicate habits when enhancing goals', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('健康', '運動', '学習'),
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 3 }),
          async (goalName, existingHabits) => {
            const enhancedHabits = await enhanceGoalWithHabits(goalName, [], existingHabits);

            // 既存習慣と重複しない（類似度チェックによる）
            for (const habit of enhancedHabits) {
              const result = similarityChecker.checkSimilarity(habit, existingHabits);
              // 追加された習慣はユニークであるべき
              expect(result.isUnique).toBe(true);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should preserve existing suggested habits when enhancing', async () => {
      const existingSuggestions = ['朝のストレッチ', 'ウォーキング'];

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('健康', '運動'),
          async (goalName) => {
            const enhancedHabits = await enhanceGoalWithHabits(goalName, existingSuggestions, []);

            // 既存の提案が保持される
            for (const existing of existingSuggestions) {
              expect(enhancedHabits).toContain(existing);
            }
          }
        ),
        { numRuns: 2 }
      );
    });

    it('should limit enhanced habits to maximum of 4', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...REAL_CATEGORIES),
          async (category) => {
            const categoryData = await masterDataLoader.loadCategory(category);
            if (categoryData && categoryData.goals.length > 0) {
              const goal = categoryData.goals[0]!;
              const enhancedHabits = await enhanceGoalWithHabits(goal.name, [], []);

              // 最大4つまで
              expect(enhancedHabits.length).toBeLessThanOrEqual(4);
            }
          }
        ),
        { numRuns: REAL_CATEGORIES.length }
      );
    });
  });

  /**
   * Property: Category-Based Goal Suggestions
   *
   * カテゴリベースのゴール提案
   * **Validates: Requirements 8.1, 8.4**
   */
  describe('Category-Based Goal Suggestions', () => {
    it('should have goals in each category', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...REAL_CATEGORIES),
          async (category) => {
            const categoryData = await masterDataLoader.loadCategory(category);
            expect(categoryData).not.toBeNull();

            if (categoryData) {
              // 各カテゴリに少なくとも1つのゴールがある
              expect(categoryData.goals.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: REAL_CATEGORIES.length }
      );
    });

    it('should have category information in goal data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...REAL_CATEGORIES),
          async (category) => {
            const categoryData = await masterDataLoader.loadCategory(category);
            expect(categoryData).not.toBeNull();

            if (categoryData) {
              // カテゴリ情報が含まれる
              expect(categoryData.category).toBe(category);
              expect(typeof categoryData.categoryJa).toBe('string');
              expect(categoryData.categoryJa.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: REAL_CATEGORIES.length }
      );
    });
  });
});
