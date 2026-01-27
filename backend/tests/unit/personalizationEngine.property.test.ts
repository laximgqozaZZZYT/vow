/**
 * PersonalizationEngine Property Tests
 *
 * Feature: ai-coach-quality-improvement
 * Property 2: Average Completion Rate Calculation
 * Property 3: Preferred Frequency Identification
 * Property 4: User Level Classification
 *
 * Validates: Requirements 1.2, 1.3, 2.1, 2.2, 2.3
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { PersonalizationEngine } from '../../src/services/personalizationEngine.js';
import type { UserLevel, HabitFrequency, TimeSlot } from '../../src/types/personalization.js';

// テスト用のモックSupabaseクライアント
const mockSupabase = {} as any;

// PersonalizationEngineのインスタンスを作成（テスト用メソッドにアクセスするため）
const engine = new PersonalizationEngine(mockSupabase);

// プロパティテストの設定
const propertyConfig = { numRuns: 100 };

describe('Feature: ai-coach-quality-improvement', () => {
  describe('Property 2: Average Completion Rate Calculation', () => {
    /**
     * Validates: Requirements 1.2
     *
     * For any set of habits with completion data, the calculated average completion rate
     * SHALL equal the sum of individual completion rates divided by the number of habits.
     */
    it('should calculate average as sum of rates divided by count', () => {
      fc.assert(
        fc.property(
          fc.array(fc.float({ min: 0, max: 1, noNaN: true }), { minLength: 1, maxLength: 20 }),
          (rates) => {
            // 期待される平均を計算
            const expectedAverage = rates.reduce((sum, r) => sum + r, 0) / rates.length;

            // Map形式でデータを準備
            const completionRates = new Map<string, number>();
            rates.forEach((rate, index) => {
              completionRates.set(`habit-${index}`, rate);
            });

            // 内部メソッドをテスト（プライベートメソッドなのでany経由でアクセス）
            const actualAverage = (engine as any).calculateAverageCompletionRate(completionRates);

            // 浮動小数点の誤差を考慮して比較
            return Math.abs(actualAverage - expectedAverage) < 0.0001;
          }
        ),
        propertyConfig
      );
    });

    it('should return 0 for empty completion rates', () => {
      const emptyRates = new Map<string, number>();
      const average = (engine as any).calculateAverageCompletionRate(emptyRates);
      expect(average).toBe(0);
    });
  });

  describe('Property 3: Preferred Frequency Identification', () => {
    /**
     * Validates: Requirements 1.3
     *
     * For any set of habits with different frequencies, the identified preferred frequency
     * SHALL be the frequency that appears most often among active habits.
     */
    it('should identify the most common frequency', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.constantFrom('daily', 'weekly', 'monthly'),
            { minLength: 1, maxLength: 20 }
          ),
          (frequencies) => {
            // 各頻度のカウントを計算
            const counts = new Map<string, number>();
            for (const freq of frequencies) {
              counts.set(freq, (counts.get(freq) || 0) + 1);
            }

            // 最も多い頻度を特定
            let maxCount = 0;
            let expectedFrequency = 'daily';
            for (const [freq, count] of counts.entries()) {
              if (count > maxCount) {
                maxCount = count;
                expectedFrequency = freq;
              }
            }

            // 習慣配列を作成
            const habits = frequencies.map(freq => ({ frequency: freq }));

            // 内部メソッドをテスト
            const actualFrequency = (engine as any).identifyPreferredFrequency(habits);

            return actualFrequency === expectedFrequency;
          }
        ),
        propertyConfig
      );
    });

    it('should return daily for empty habits', () => {
      const frequency = (engine as any).identifyPreferredFrequency([]);
      expect(frequency).toBe('daily');
    });
  });

  describe('Property 4: User Level Classification', () => {
    /**
     * Validates: Requirements 2.1, 2.2, 2.3
     *
     * For any combination of active habit count and average completion rate:
     * - If habitCount < 3 OR completionRate < 0.4, level SHALL be 'beginner'
     * - If habitCount > 7 AND completionRate > 0.7, level SHALL be 'advanced'
     * - Otherwise, level SHALL be 'intermediate'
     */
    it('should classify users correctly based on habit count and completion rate', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 20 }),
          fc.float({ min: 0, max: 1, noNaN: true }),
          (habitCount, completionRate) => {
            const level = engine.determineUserLevel({
              activeHabitCount: habitCount,
              averageCompletionRate: completionRate,
            });

            // beginner条件: 習慣数 < 3 または 達成率 < 40%
            if (habitCount < 3 || completionRate < 0.4) {
              return level === 'beginner';
            }

            // advanced条件: 習慣数 > 7 かつ 達成率 > 70%
            if (habitCount > 7 && completionRate > 0.7) {
              return level === 'advanced';
            }

            // それ以外はintermediate
            return level === 'intermediate';
          }
        ),
        propertyConfig
      );
    });

    it('should return beginner for zero habits', () => {
      const level = engine.determineUserLevel({
        activeHabitCount: 0,
        averageCompletionRate: 0.5,
      });
      expect(level).toBe('beginner');
    });

    it('should return beginner for low completion rate', () => {
      const level = engine.determineUserLevel({
        activeHabitCount: 10,
        averageCompletionRate: 0.3,
      });
      expect(level).toBe('beginner');
    });

    it('should return advanced for high habit count and completion rate', () => {
      const level = engine.determineUserLevel({
        activeHabitCount: 10,
        averageCompletionRate: 0.85,
      });
      expect(level).toBe('advanced');
    });

    it('should return intermediate for boundary conditions', () => {
      const level = engine.determineUserLevel({
        activeHabitCount: 5,
        averageCompletionRate: 0.6,
      });
      expect(level).toBe('intermediate');
    });
  });

  describe('Time Slot Identification', () => {
    /**
     * Validates: Requirements 1.4
     */
    it('should identify time slots sorted by frequency', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.integer({ min: 0, max: 23 }),
            { minLength: 1, maxLength: 100 }
          ),
          (hours) => {
            // アクティビティを作成
            const activities = hours.map(hour => {
              const date = new Date();
              date.setHours(hour, 0, 0, 0);
              return { completedAt: date };
            });

            const timeSlots = engine.identifyPreferredTimeSlots(activities);

            // 結果が頻度順にソートされていることを確認
            for (let i = 1; i < timeSlots.length; i++) {
              if (timeSlots[i].frequency > timeSlots[i - 1].frequency) {
                return false;
              }
            }

            return true;
          }
        ),
        propertyConfig
      );
    });

    it('should return empty array for no activities', () => {
      const timeSlots = engine.identifyPreferredTimeSlots([]);
      expect(timeSlots).toEqual([]);
    });
  });

  describe('Anchor Habit Identification', () => {
    /**
     * Validates: Requirements 7.1
     *
     * Property 9: Anchor Habit Identification
     * For any set of habits with completion rates, habits with completion rate > 0.8
     * SHALL be identified as anchor habits.
     */
    it('should identify habits with completion rate >= 0.8 as anchor habits', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 50 }),
              triggerTime: fc.option(fc.constantFrom('07:00', '12:00', '18:00', '22:00'), { nil: null }),
              completionRate: fc.float({ min: 0, max: 1, noNaN: true }),
            }),
            { minLength: 0, maxLength: 20 }
          ),
          (habitsWithRates) => {
            const habits = habitsWithRates.map(h => ({
              id: h.id,
              name: h.name,
              triggerTime: h.triggerTime,
            }));

            const completionRates = new Map<string, number>();
            habitsWithRates.forEach(h => {
              completionRates.set(h.id, h.completionRate);
            });

            const anchorHabits = engine.identifyAnchorHabits(habits, completionRates);

            // すべてのアンカー習慣が達成率80%以上であることを確認
            for (const anchor of anchorHabits) {
              if (anchor.completionRate < 0.8) {
                return false;
              }
            }

            // 達成率80%以上の習慣がすべてアンカーに含まれていることを確認
            const anchorIds = new Set(anchorHabits.map(a => a.habitId));
            for (const h of habitsWithRates) {
              if (h.completionRate >= 0.8 && !anchorIds.has(h.id)) {
                return false;
              }
            }

            return true;
          }
        ),
        propertyConfig
      );
    });

    it('should sort anchor habits by completion rate descending', () => {
      const habits = [
        { id: '1', name: 'Habit 1', triggerTime: '07:00' },
        { id: '2', name: 'Habit 2', triggerTime: '08:00' },
        { id: '3', name: 'Habit 3', triggerTime: '09:00' },
      ];

      const completionRates = new Map([
        ['1', 0.85],
        ['2', 0.95],
        ['3', 0.90],
      ]);

      const anchorHabits = engine.identifyAnchorHabits(habits, completionRates);

      expect(anchorHabits.length).toBe(3);
      expect(anchorHabits[0].habitId).toBe('2'); // 95%
      expect(anchorHabits[1].habitId).toBe('3'); // 90%
      expect(anchorHabits[2].habitId).toBe('1'); // 85%
    });
  });
});
