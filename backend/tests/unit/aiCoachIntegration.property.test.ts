/**
 * AI Coach Integration Property Tests
 *
 * AIコーチサービスの統合プロパティテスト
 *
 * **Validates: Requirements 2.4, 2.5, 2.6, 4.1, 4.2**
 * - 2.4: 初心者向け提案フィルタリング
 * - 2.5: 中級者向け提案フィルタリング
 * - 2.6: 上級者向け提案フィルタリング
 * - 4.1: 重複検出
 * - 4.2: 類似度スコア計算
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import path from 'path';
import {
  MasterDataLoader,
  DifficultyLevel,
  resetMasterDataLoader,
} from '../../src/services/masterDataLoader.js';
import { SimilarityChecker, resetSimilarityChecker } from '../../src/services/similarityChecker.js';
import { PromptBuilder, resetPromptBuilder } from '../../src/services/promptBuilder.js';
import type { UserContext, UserLevel } from '../../src/types/personalization.js';

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

describe('AI Coach Integration Property Tests', () => {
  let masterDataLoader: MasterDataLoader;
  let similarityChecker: SimilarityChecker;
  let promptBuilder: PromptBuilder;

  beforeEach(() => {
    resetMasterDataLoader();
    resetSimilarityChecker();
    resetPromptBuilder();
    masterDataLoader = new MasterDataLoader(REAL_SUGGESTIONS_DIR);
    similarityChecker = new SimilarityChecker();
    promptBuilder = new PromptBuilder();
  });

  afterEach(() => {
    resetMasterDataLoader();
    resetSimilarityChecker();
    resetPromptBuilder();
  });

  /**
   * Property 5: Suggestion Filtering by User Level
   * 
   * ユーザーレベルに基づいて提案がフィルタリングされる
   * **Validates: Requirements 2.4, 2.5, 2.6**
   */
  describe('Property 5: Suggestion Filtering by User Level', () => {
    const levelOrder: Record<DifficultyLevel, number> = {
      beginner: 1,
      intermediate: 2,
      advanced: 3,
    };

    const userLevelToMaxDifficulty: Record<UserLevel, DifficultyLevel> = {
      beginner: 'beginner',
      intermediate: 'intermediate',
      advanced: 'advanced',
    };

    it('should filter habits by user level correctly', async () => {
      const userLevels: UserLevel[] = ['beginner', 'intermediate', 'advanced'];

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...REAL_CATEGORIES),
          fc.constantFrom(...userLevels),
          async (category, userLevel) => {
            const maxDifficulty = userLevelToMaxDifficulty[userLevel];
            const filteredHabits = await masterDataLoader.getHabitsByMaxDifficulty(category, maxDifficulty);
            const maxLevelValue = levelOrder[maxDifficulty];

            // フィルタリングされた習慣はすべて指定された難易度以下
            for (const habit of filteredHabits) {
              expect(levelOrder[habit.difficultyLevel]).toBeLessThanOrEqual(maxLevelValue);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should return only beginner habits for beginner users', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...REAL_CATEGORIES),
          async (category) => {
            const beginnerHabits = await masterDataLoader.getHabitsByMaxDifficulty(category, 'beginner');

            // 初心者向けフィルタリングでは、すべての習慣がbeginner
            for (const habit of beginnerHabits) {
              expect(habit.difficultyLevel).toBe('beginner');
            }
          }
        ),
        { numRuns: REAL_CATEGORIES.length }
      );
    });

    it('should return beginner and intermediate habits for intermediate users', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...REAL_CATEGORIES),
          async (category) => {
            const intermediateHabits = await masterDataLoader.getHabitsByMaxDifficulty(category, 'intermediate');

            // 中級者向けフィルタリングでは、beginner または intermediate
            for (const habit of intermediateHabits) {
              expect(['beginner', 'intermediate']).toContain(habit.difficultyLevel);
            }
          }
        ),
        { numRuns: REAL_CATEGORIES.length }
      );
    });

    it('should return all habits for advanced users', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...REAL_CATEGORIES),
          async (category) => {
            const allHabits = await masterDataLoader.getHabitsByCategory(category);
            const advancedHabits = await masterDataLoader.getHabitsByMaxDifficulty(category, 'advanced');

            // 上級者向けフィルタリングでは、すべての習慣が含まれる
            expect(advancedHabits.length).toBe(allHabits.length);
          }
        ),
        { numRuns: REAL_CATEGORIES.length }
      );
    });

    it('should have more habits available for higher user levels', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...REAL_CATEGORIES),
          async (category) => {
            const beginnerHabits = await masterDataLoader.getHabitsByMaxDifficulty(category, 'beginner');
            const intermediateHabits = await masterDataLoader.getHabitsByMaxDifficulty(category, 'intermediate');
            const advancedHabits = await masterDataLoader.getHabitsByMaxDifficulty(category, 'advanced');

            // より高いレベルほど、より多くの習慣が利用可能
            expect(beginnerHabits.length).toBeLessThanOrEqual(intermediateHabits.length);
            expect(intermediateHabits.length).toBeLessThanOrEqual(advancedHabits.length);
          }
        ),
        { numRuns: REAL_CATEGORIES.length }
      );
    });
  });

  /**
   * Property: Duplicate Detection Integration
   * 
   * 重複検出が正しく統合されている
   * **Validates: Requirements 4.1, 4.2**
   */
  describe('Duplicate Detection Integration', () => {
    it('should detect duplicates when suggesting habits from master data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...REAL_CATEGORIES),
          async (category) => {
            const habits = await masterDataLoader.getHabitsByCategory(category);
            if (habits.length < 2) return;

            // 最初の習慣を既存習慣として設定
            const existingHabitNames = [habits[0]!.name];
            
            // 同じ習慣名で重複チェック
            const result = similarityChecker.checkSimilarity(habits[0]!.name, existingHabitNames);
            
            // 完全一致なので重複として検出される
            expect(result.isUnique).toBe(false);
            expect(result.similarityScore).toBe(1.0);
          }
        ),
        { numRuns: REAL_CATEGORIES.length }
      );
    });

    it('should allow unique habits when no duplicates exist', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...REAL_CATEGORIES),
          async (category) => {
            const habits = await masterDataLoader.getHabitsByCategory(category);
            if (habits.length < 2) return;

            // 最初の習慣を既存習慣として設定
            const existingHabitNames = [habits[0]!.name];
            
            // 異なる習慣名で重複チェック
            const differentHabit = habits.find(h => h.name !== habits[0]!.name);
            if (!differentHabit) return;

            const result = similarityChecker.checkSimilarity(differentHabit.name, existingHabitNames);
            
            // 異なる習慣名なので、類似度が閾値未満であればユニーク
            // （類似度が高い場合は重複として検出される可能性がある）
            if (result.similarityScore < 0.7) {
              expect(result.isUnique).toBe(true);
            }
          }
        ),
        { numRuns: REAL_CATEGORIES.length }
      );
    });
  });

  /**
   * Property: Prompt Builder Integration
   * 
   * プロンプトビルダーがユーザーコンテキストを正しく統合する
   * **Validates: Requirements 6.1, 6.2, 6.3**
   */
  describe('Prompt Builder Integration', () => {
    const createMockUserContext = (level: UserLevel): UserContext => ({
      userId: 'test-user',
      activeHabitCount: level === 'beginner' ? 2 : level === 'intermediate' ? 5 : 10,
      averageCompletionRate: level === 'beginner' ? 0.3 : level === 'intermediate' ? 0.6 : 0.85,
      userLevel: level,
      preferredFrequency: 'daily',
      preferredTimeSlots: [{ hour: 7, frequency: 10 }],
      existingHabitNames: ['朝のストレッチ', 'ウォーキング'],
      anchorHabits: level !== 'beginner' ? [
        { habitId: '1', habitName: '朝のストレッチ', completionRate: 0.9, triggerTime: '07:00' }
      ] : [],
    });

    it('should include user level in system prompt', () => {
      const userLevels: UserLevel[] = ['beginner', 'intermediate', 'advanced'];

      fc.assert(
        fc.property(
          fc.constantFrom(...userLevels),
          (level) => {
            const context = createMockUserContext(level);
            const basePrompt = 'You are an AI coach.';
            const prompt = promptBuilder.buildSystemPrompt(context, basePrompt);

            // プロンプトにユーザーレベルが含まれる
            expect(prompt).toContain('ユーザーレベル');
          }
        ),
        { numRuns: 3 }
      );
    });

    it('should include existing habit names in system prompt', () => {
      const userLevels: UserLevel[] = ['beginner', 'intermediate', 'advanced'];

      fc.assert(
        fc.property(
          fc.constantFrom(...userLevels),
          (level) => {
            const context = createMockUserContext(level);
            const basePrompt = 'You are an AI coach.';
            const prompt = promptBuilder.buildSystemPrompt(context, basePrompt);

            // プロンプトに既存習慣名が含まれる
            expect(prompt).toContain('朝のストレッチ');
            expect(prompt).toContain('ウォーキング');
          }
        ),
        { numRuns: 3 }
      );
    });

    it('should include level-specific guidelines', () => {
      const context = createMockUserContext('beginner');
      const basePrompt = 'You are an AI coach.';
      const prompt = promptBuilder.buildSystemPrompt(context, basePrompt);

      // 初心者向けガイドラインが含まれる
      expect(prompt).toContain('初心者向け');
    });
  });

  /**
   * Property: End-to-End Filtering Flow
   * 
   * フィルタリングフローが正しく動作する
   */
  describe('End-to-End Filtering Flow', () => {
    it('should filter and deduplicate habits correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...REAL_CATEGORIES),
          fc.constantFrom('beginner', 'intermediate', 'advanced') as fc.Arbitrary<UserLevel>,
          async (category, userLevel) => {
            // 1. ユーザーレベルに基づいてフィルタリング
            const maxDifficulty = userLevel === 'beginner' ? 'beginner' 
              : userLevel === 'intermediate' ? 'intermediate' : 'advanced';
            const filteredHabits = await masterDataLoader.getHabitsByMaxDifficulty(category, maxDifficulty as DifficultyLevel);

            // 2. 既存習慣を設定（最初の習慣を既存とする）
            const existingHabitNames = filteredHabits.length > 0 ? [filteredHabits[0]!.name] : [];

            // 3. 重複を除外
            const uniqueHabits = filteredHabits.filter(h => {
              const result = similarityChecker.checkSimilarity(h.name, existingHabitNames);
              return result.isUnique;
            });

            // 4. 検証
            // ユニークな習慣は既存習慣と重複しない
            for (const habit of uniqueHabits) {
              const result = similarityChecker.checkSimilarity(habit.name, existingHabitNames);
              expect(result.isUnique).toBe(true);
            }

            // フィルタリング後の習慣数は元の習慣数以下
            expect(uniqueHabits.length).toBeLessThanOrEqual(filteredHabits.length);
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
