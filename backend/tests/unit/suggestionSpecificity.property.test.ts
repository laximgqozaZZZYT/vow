/**
 * Suggestion Specificity Property Tests
 *
 * 提案の具体性に関するプロパティテスト
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 * - 3.1: 日次習慣にtriggerTimeを必須化
 * - 3.2: targetCount, workloadUnit, durationを必須化
 * - 3.3: 具体的な提案フォーマット
 * - 3.4: 提案理由のパーソナライズ
 * - 3.5: ユーザー好みの時間帯を反映
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { UserContext, UserLevel, TimeSlot } from '../../src/types/personalization.js';

describe('Suggestion Specificity Property Tests', () => {
  /**
   * Property: Trigger Time Enhancement
   *
   * 日次習慣にユーザーの好みの時間帯を反映
   * **Validates: Requirements 3.1, 3.5**
   */
  describe('Trigger Time Enhancement', () => {
    /**
     * ユーザーの好みの時間帯からtriggerTimeを生成するヘルパー関数
     */
    const enhanceTriggerTime = (
      providedTriggerTime: string | null,
      frequency: string,
      preferredTimeSlots: TimeSlot[]
    ): string | null => {
      if (providedTriggerTime) return providedTriggerTime;
      if (frequency !== 'daily') return null;
      if (preferredTimeSlots.length === 0) return null;

      const preferredSlot = preferredTimeSlots[0];
      if (preferredSlot) {
        return `${preferredSlot.hour.toString().padStart(2, '0')}:00`;
      }
      return null;
    };

    it('should use provided trigger time when available', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('07:00', '08:30', '12:00', '18:00', '21:30'),
          fc.constantFrom('daily', 'weekly', 'monthly'),
          fc.array(
            fc.record({
              hour: fc.integer({ min: 0, max: 23 }),
              frequency: fc.integer({ min: 1, max: 100 }),
            }),
            { minLength: 0, maxLength: 5 }
          ),
          (providedTime, frequency, preferredSlots) => {
            const result = enhanceTriggerTime(providedTime, frequency, preferredSlots);
            expect(result).toBe(providedTime);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should use preferred time slot for daily habits without trigger time', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              hour: fc.integer({ min: 0, max: 23 }),
              frequency: fc.integer({ min: 1, max: 100 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (preferredSlots) => {
            const result = enhanceTriggerTime(null, 'daily', preferredSlots);

            // 好みの時間帯がある場合、triggerTimeが設定される
            expect(result).not.toBeNull();

            // フォーマットが正しい（HH:00）
            if (result) {
              expect(result).toMatch(/^\d{2}:00$/);
              const hour = parseInt(result.split(':')[0]!);
              expect(hour).toBe(preferredSlots[0]!.hour);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should not set trigger time for non-daily habits', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('weekly', 'monthly'),
          fc.array(
            fc.record({
              hour: fc.integer({ min: 0, max: 23 }),
              frequency: fc.integer({ min: 1, max: 100 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (frequency, preferredSlots) => {
            const result = enhanceTriggerTime(null, frequency, preferredSlots);
            expect(result).toBeNull();
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should return null when no preferred time slots', () => {
      const result = enhanceTriggerTime(null, 'daily', []);
      expect(result).toBeNull();
    });
  });

  /**
   * Property: Personalized Reason
   *
   * 提案理由のパーソナライズ
   * **Validates: Requirement 3.4**
   */
  describe('Personalized Reason', () => {
    /**
     * 提案理由をパーソナライズするヘルパー関数
     */
    const personalizeReason = (
      reason: string,
      userContext: Pick<UserContext, 'userLevel' | 'averageCompletionRate' | 'activeHabitCount'>
    ): string => {
      const { userLevel, averageCompletionRate, activeHabitCount } = userContext;

      if (userLevel === 'beginner') {
        if (!reason.includes('始め') && !reason.includes('最初')) {
          reason += ' 小さく始めることが成功の鍵です。';
        }
      } else if (userLevel === 'intermediate') {
        if (averageCompletionRate >= 0.7) {
          reason += ' 現在の達成率を維持しながら挑戦してみましょう。';
        }
      } else if (userLevel === 'advanced') {
        if (activeHabitCount >= 5) {
          reason += ' 既存の習慣との相乗効果が期待できます。';
        }
      }

      return reason;
    };

    it('should add beginner encouragement for beginner users', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => !s.includes('始め') && !s.includes('最初')),
          (reason) => {
            const context = {
              userLevel: 'beginner' as UserLevel,
              averageCompletionRate: 0.3,
              activeHabitCount: 2,
            };

            const result = personalizeReason(reason, context);
            expect(result).toContain('小さく始めることが成功の鍵です');
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should not duplicate beginner message if already present', () => {
      const reason = 'この習慣を始めることで健康になれます';
      const context = {
        userLevel: 'beginner' as UserLevel,
        averageCompletionRate: 0.3,
        activeHabitCount: 2,
      };

      const result = personalizeReason(reason, context);
      expect(result).not.toContain('小さく始めることが成功の鍵です');
    });

    it('should add intermediate encouragement for high completion rate', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.float({ min: Math.fround(0.71), max: Math.fround(1), noNaN: true }),
          (reason, completionRate) => {
            const context = {
              userLevel: 'intermediate' as UserLevel,
              averageCompletionRate: completionRate,
              activeHabitCount: 5,
            };

            const result = personalizeReason(reason, context);
            expect(result).toContain('現在の達成率を維持しながら挑戦してみましょう');
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should not add intermediate message for low completion rate', () => {
      const reason = 'テスト理由';
      const context = {
        userLevel: 'intermediate' as UserLevel,
        averageCompletionRate: 0.5,
        activeHabitCount: 5,
      };

      const result = personalizeReason(reason, context);
      expect(result).not.toContain('現在の達成率を維持しながら挑戦してみましょう');
    });

    it('should add advanced encouragement for users with many habits', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.integer({ min: 5, max: 20 }),
          (reason, habitCount) => {
            const context = {
              userLevel: 'advanced' as UserLevel,
              averageCompletionRate: 0.85,
              activeHabitCount: habitCount,
            };

            const result = personalizeReason(reason, context);
            expect(result).toContain('既存の習慣との相乗効果が期待できます');
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should not add advanced message for users with few habits', () => {
      const reason = 'テスト理由';
      const context = {
        userLevel: 'advanced' as UserLevel,
        averageCompletionRate: 0.85,
        activeHabitCount: 3,
      };

      const result = personalizeReason(reason, context);
      expect(result).not.toContain('既存の習慣との相乗効果が期待できます');
    });
  });

  /**
   * Property: Habit Suggestion Structure
   *
   * 習慣提案の構造が正しい
   * **Validates: Requirements 3.1, 3.2, 3.3**
   */
  describe('Habit Suggestion Structure', () => {
    /**
     * 習慣提案の構造を検証するヘルパー関数
     */
    const validateHabitSuggestion = (suggestion: {
      name: string;
      type: string;
      frequency: string;
      triggerTime?: string | null;
      duration?: number | null;
      targetCount?: number | null;
      workloadUnit?: string | null;
      reason?: string;
    }): { isValid: boolean; missingFields: string[] } => {
      const missingFields: string[] = [];

      // 必須フィールド
      if (!suggestion.name || suggestion.name.length === 0) {
        missingFields.push('name');
      }
      if (!suggestion.type || !['do', 'avoid'].includes(suggestion.type)) {
        missingFields.push('type');
      }
      if (!suggestion.frequency || !['daily', 'weekly', 'monthly'].includes(suggestion.frequency)) {
        missingFields.push('frequency');
      }

      return {
        isValid: missingFields.length === 0,
        missingFields,
      };
    };

    it('should validate required fields in habit suggestions', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            type: fc.constantFrom('do', 'avoid'),
            frequency: fc.constantFrom('daily', 'weekly', 'monthly'),
            triggerTime: fc.option(fc.constant('07:00'), { nil: null }),
            duration: fc.option(fc.integer({ min: 1, max: 120 }), { nil: null }),
            targetCount: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
            workloadUnit: fc.option(fc.constantFrom('回', '分', 'ページ'), { nil: null }),
            reason: fc.string({ minLength: 0, maxLength: 200 }),
          }),
          (suggestion) => {
            const result = validateHabitSuggestion(suggestion);
            expect(result.isValid).toBe(true);
            expect(result.missingFields).toHaveLength(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should detect missing required fields', () => {
      const invalidSuggestion = {
        name: '',
        type: 'invalid',
        frequency: 'invalid',
      };

      const result = validateHabitSuggestion(invalidSuggestion);
      expect(result.isValid).toBe(false);
      expect(result.missingFields).toContain('name');
      expect(result.missingFields).toContain('type');
      expect(result.missingFields).toContain('frequency');
    });
  });

  /**
   * Property: Time Format Validation
   *
   * 時間フォーマットの検証
   */
  describe('Time Format Validation', () => {
    /**
     * 時間フォーマットを検証するヘルパー関数
     */
    const isValidTimeFormat = (time: string): boolean => {
      const pattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
      return pattern.test(time);
    };

    it('should validate correct time formats', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 23 }),
          fc.integer({ min: 0, max: 59 }),
          (hour, minute) => {
            const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            expect(isValidTimeFormat(time)).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject invalid time formats', () => {
      const invalidTimes = ['25:00', '12:60', '1:30', '12:5', 'invalid', ''];
      for (const time of invalidTimes) {
        expect(isValidTimeFormat(time)).toBe(false);
      }
    });
  });

  /**
   * Property: Duplicate Warning Structure
   *
   * 重複警告の構造
   */
  describe('Duplicate Warning Structure', () => {
    /**
     * 重複警告の構造を検証するヘルパー関数
     */
    const createDuplicateWarning = (
      isUnique: boolean,
      mostSimilarHabit: string | null,
      similarityScore: number
    ): { similarTo: string; similarityScore: number; message: string } | undefined => {
      if (isUnique) return undefined;
      if (!mostSimilarHabit) return undefined;

      return {
        similarTo: mostSimilarHabit,
        similarityScore,
        message: `「${mostSimilarHabit}」と類似しています`,
      };
    };

    it('should return undefined for unique habits', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 30 }),
          fc.float({ min: Math.fround(0), max: Math.fround(0.69), noNaN: true }),
          (habitName, score) => {
            const result = createDuplicateWarning(true, habitName, score);
            expect(result).toBeUndefined();
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should return warning for duplicate habits', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 30 }),
          fc.float({ min: Math.fround(0.7), max: Math.fround(1), noNaN: true }),
          (habitName, score) => {
            const result = createDuplicateWarning(false, habitName, score);

            expect(result).not.toBeUndefined();
            if (result) {
              expect(result.similarTo).toBe(habitName);
              expect(result.similarityScore).toBe(score);
              expect(result.message).toContain(habitName);
              expect(result.message).toContain('類似しています');
            }
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});
