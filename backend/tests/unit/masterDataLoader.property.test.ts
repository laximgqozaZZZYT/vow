/**
 * MasterDataLoader Property Tests
 *
 * マスターデータローダーのプロパティベーステスト
 *
 * **Validates: Requirements 5.1, 5.2, 5.4**
 * - 5.1: マスターデータに難易度レベルが含まれる
 * - 5.2: マスターデータに習慣スタッキングトリガーが含まれる
 * - 5.4: マスターデータのバリデーションとデフォルト値処理
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import path from 'path';
import {
  MasterDataLoader,
  DifficultyLevel,
  resetMasterDataLoader,
} from '../../src/services/masterDataLoader.js';

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

describe('MasterDataLoader Property Tests', () => {
  let loader: MasterDataLoader;

  beforeEach(() => {
    resetMasterDataLoader();
    loader = new MasterDataLoader(REAL_SUGGESTIONS_DIR);
  });

  afterEach(() => {
    resetMasterDataLoader();
  });

  /**
   * Property 12: Master Data Validation
   * 
   * すべての習慣提案は有効な難易度レベルを持つ
   * **Validates: Requirements 5.1, 5.4**
   */
  describe('Property 12: Master Data Validation', () => {
    it('should have valid difficultyLevel for all habits in all categories', async () => {
      const validLevels: DifficultyLevel[] = ['beginner', 'intermediate', 'advanced'];

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...REAL_CATEGORIES),
          async (category) => {
            const data = await loader.loadCategory(category);
            expect(data).not.toBeNull();
            
            for (const habit of data!.habits) {
              expect(validLevels).toContain(habit.difficultyLevel);
            }
          }
        ),
        { numRuns: REAL_CATEGORIES.length }
      );
    });

    it('should have habitStackingTriggers as array for all habits', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...REAL_CATEGORIES),
          async (category) => {
            const data = await loader.loadCategory(category);
            expect(data).not.toBeNull();
            
            for (const habit of data!.habits) {
              expect(Array.isArray(habit.habitStackingTriggers)).toBe(true);
            }
          }
        ),
        { numRuns: REAL_CATEGORIES.length }
      );
    });

    it('should have at least 10 habits per category', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...REAL_CATEGORIES),
          async (category) => {
            const data = await loader.loadCategory(category);
            expect(data).not.toBeNull();
            expect(data!.habits.length).toBeGreaterThanOrEqual(10);
          }
        ),
        { numRuns: REAL_CATEGORIES.length }
      );
    });
  });

  /**
   * Property: Difficulty Level Distribution
   * 
   * 各カテゴリに複数の難易度レベルの習慣が存在する
   * **Validates: Requirements 5.1**
   */
  describe('Difficulty Level Distribution', () => {
    it('should have habits of multiple difficulty levels per category', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...REAL_CATEGORIES),
          async (category) => {
            const data = await loader.loadCategory(category);
            expect(data).not.toBeNull();
            
            const levels = new Set(data!.habits.map(h => h.difficultyLevel));
            expect(levels.size).toBeGreaterThanOrEqual(2);
          }
        ),
        { numRuns: REAL_CATEGORIES.length }
      );
    });

    it('should have beginner habits in every category', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...REAL_CATEGORIES),
          async (category) => {
            const beginnerHabits = await loader.getHabitsByDifficulty(category, 'beginner');
            expect(beginnerHabits.length).toBeGreaterThanOrEqual(1);
          }
        ),
        { numRuns: REAL_CATEGORIES.length }
      );
    });
  });

  /**
   * Property: Habit Stacking Triggers
   * 
   * 習慣スタッキングトリガーが適切に設定されている
   * **Validates: Requirements 5.2**
   */
  describe('Habit Stacking Triggers', () => {
    it('should have non-empty triggers for most habits', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...REAL_CATEGORIES),
          async (category) => {
            const data = await loader.loadCategory(category);
            expect(data).not.toBeNull();
            
            const habitsWithTriggers = data!.habits.filter(
              h => h.habitStackingTriggers.length > 0
            );
            expect(habitsWithTriggers.length).toBeGreaterThanOrEqual(data!.habits.length * 0.5);
          }
        ),
        { numRuns: REAL_CATEGORIES.length }
      );
    });

    it('should have valid trigger strings (non-empty)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...REAL_CATEGORIES),
          async (category) => {
            const data = await loader.loadCategory(category);
            expect(data).not.toBeNull();
            
            for (const habit of data!.habits) {
              for (const trigger of habit.habitStackingTriggers) {
                expect(trigger.length).toBeGreaterThan(0);
                expect(trigger.trim()).toBe(trigger);
              }
            }
          }
        ),
        { numRuns: REAL_CATEGORIES.length }
      );
    });
  });

  /**
   * Property: Difficulty Level Filtering
   * 
   * 難易度レベルでのフィルタリングが正しく動作する
   * **Validates: Requirements 5.1**
   */
  describe('Difficulty Level Filtering', () => {
    it('should filter habits by exact difficulty level correctly', async () => {
      const levels: DifficultyLevel[] = ['beginner', 'intermediate', 'advanced'];

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...REAL_CATEGORIES),
          fc.constantFrom(...levels),
          async (category, level) => {
            const filteredHabits = await loader.getHabitsByDifficulty(category, level);
            
            for (const habit of filteredHabits) {
              expect(habit.difficultyLevel).toBe(level);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should filter habits by max difficulty level correctly', async () => {
      const levelOrder: Record<DifficultyLevel, number> = {
        beginner: 1,
        intermediate: 2,
        advanced: 3,
      };

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...REAL_CATEGORIES),
          fc.constantFrom('beginner', 'intermediate', 'advanced') as fc.Arbitrary<DifficultyLevel>,
          async (category, maxLevel) => {
            const filteredHabits = await loader.getHabitsByMaxDifficulty(category, maxLevel);
            const maxLevelValue = levelOrder[maxLevel];
            
            for (const habit of filteredHabits) {
              expect(levelOrder[habit.difficultyLevel]).toBeLessThanOrEqual(maxLevelValue);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should return more habits with higher max difficulty', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...REAL_CATEGORIES),
          async (category) => {
            const beginnerMax = await loader.getHabitsByMaxDifficulty(category, 'beginner');
            const intermediateMax = await loader.getHabitsByMaxDifficulty(category, 'intermediate');
            const advancedMax = await loader.getHabitsByMaxDifficulty(category, 'advanced');
            
            expect(beginnerMax.length).toBeLessThanOrEqual(intermediateMax.length);
            expect(intermediateMax.length).toBeLessThanOrEqual(advancedMax.length);
          }
        ),
        { numRuns: REAL_CATEGORIES.length }
      );
    });
  });

  /**
   * Property: Trigger Search
   * 
   * 習慣スタッキングトリガーでの検索が正しく動作する
   * **Validates: Requirements 5.2**
   */
  describe('Trigger Search', () => {
    it('should find habits by common trigger keywords', async () => {
      const commonTriggers = ['起床後', '朝食', '仕事', '就寝前', '夕食'];

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...commonTriggers),
          async (trigger) => {
            const results = await loader.searchHabitsByTrigger(trigger);
            
            expect(results.length).toBeGreaterThanOrEqual(1);
            
            for (const habit of results) {
              const hasMatchingTrigger = habit.habitStackingTriggers.some(
                t => t.toLowerCase().includes(trigger.toLowerCase())
              );
              expect(hasMatchingTrigger).toBe(true);
            }
          }
        ),
        { numRuns: commonTriggers.length }
      );
    });
  });

  /**
   * Property: Cache Behavior
   * 
   * キャッシュが正しく動作する
   */
  describe('Cache Behavior', () => {
    it('should cache loaded data and not re-read file', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...REAL_CATEGORIES),
          async (category) => {
            loader.clearCache();
            loader.resetFileReadCount();

            await loader.loadCategory(category);
            const firstReadCount = loader.getFileReadCount();
            expect(firstReadCount).toBe(1);

            await loader.loadCategory(category);
            expect(loader.getFileReadCount()).toBe(1);

            loader.clearCache();
            await loader.loadCategory(category);
            expect(loader.getFileReadCount()).toBe(2);
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  /**
   * Property: All Habits Have Required Fields
   * 
   * すべての習慣が必須フィールドを持つ
   */
  describe('All Habits Have Required Fields', () => {
    it('should ensure all habits have required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...REAL_CATEGORIES),
          async (category) => {
            const data = await loader.loadCategory(category);
            expect(data).not.toBeNull();

            for (const habit of data!.habits) {
              expect(habit.name).toBeDefined();
              expect(habit.name.length).toBeGreaterThan(0);
              expect(habit.type).toBeDefined();
              expect(['do', 'avoid']).toContain(habit.type);
              expect(habit.frequency).toBeDefined();
              expect(['daily', 'weekly', 'monthly']).toContain(habit.frequency);
              expect(habit.difficultyLevel).toBeDefined();
              expect(['beginner', 'intermediate', 'advanced']).toContain(habit.difficultyLevel);
              expect(habit.habitStackingTriggers).toBeDefined();
              expect(Array.isArray(habit.habitStackingTriggers)).toBe(true);
              expect(habit.reason).toBeDefined();
            }
          }
        ),
        { numRuns: REAL_CATEGORIES.length }
      );
    });
  });

  /**
   * Property: Stacking Candidates
   * 
   * アンカー習慣に基づくスタッキング候補の取得
   * **Validates: Requirements 5.2**
   */
  describe('Stacking Candidates', () => {
    it('should find stacking candidates for common anchor habits', async () => {
      const commonAnchors = ['朝食', '歯磨き', '起床', '仕事'];

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...commonAnchors),
          async (anchor) => {
            const candidates = await loader.getStackingCandidates(anchor);
            
            if (candidates.length > 0) {
              for (const candidate of candidates) {
                expect(candidate.category).toBeDefined();
                expect(candidate.category.length).toBeGreaterThan(0);
              }
            }
          }
        ),
        { numRuns: commonAnchors.length }
      );
    });
  });

  /**
   * Property: Category Data Consistency
   * 
   * カテゴリデータの一貫性
   */
  describe('Category Data Consistency', () => {
    it('should have consistent category metadata', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...REAL_CATEGORIES),
          async (category) => {
            const data = await loader.loadCategory(category);
            expect(data).not.toBeNull();
            
            expect(data!.category).toBe(category);
            expect(data!.categoryJa).toBeDefined();
            expect(data!.categoryJa.length).toBeGreaterThan(0);
            expect(Array.isArray(data!.subcategories)).toBe(true);
            expect(Array.isArray(data!.goals)).toBe(true);
          }
        ),
        { numRuns: REAL_CATEGORIES.length }
      );
    });
  });
});
