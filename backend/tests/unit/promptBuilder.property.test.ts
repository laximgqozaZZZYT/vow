/**
 * PromptBuilder Property Tests
 *
 * Feature: ai-coach-quality-improvement
 * Property 8: Prompt Context Completeness
 *
 * Validates: Requirements 6.1, 6.2, 6.3
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { PromptBuilder } from '../../src/services/promptBuilder.js';
import type { UserContext, UserLevel, HabitFrequency } from '../../src/types/personalization.js';

// PromptBuilderのインスタンスを作成
const builder = new PromptBuilder();

// プロパティテストの設定
const propertyConfig = { numRuns: 100 };

// UserContextのArbitrary
const userContextArb = fc.record({
  userId: fc.uuid(),
  activeHabitCount: fc.integer({ min: 0, max: 20 }),
  averageCompletionRate: fc.float({ min: 0, max: 1, noNaN: true }),
  userLevel: fc.constantFrom<UserLevel>('beginner', 'intermediate', 'advanced'),
  preferredFrequency: fc.constantFrom<HabitFrequency>('daily', 'weekly', 'monthly'),
  preferredTimeSlots: fc.array(
    fc.record({
      hour: fc.integer({ min: 0, max: 23 }),
      frequency: fc.integer({ min: 1, max: 100 }),
    }),
    { minLength: 0, maxLength: 5 }
  ),
  existingHabitNames: fc.array(fc.string({ minLength: 1, maxLength: 30 }), {
    minLength: 0,
    maxLength: 15,
  }),
  anchorHabits: fc.array(
    fc.record({
      habitId: fc.uuid(),
      habitName: fc.string({ minLength: 1, maxLength: 30 }),
      completionRate: fc.float({ min: Math.fround(0.8), max: Math.fround(1), noNaN: true }),
      triggerTime: fc.option(fc.constantFrom('07:00', '12:00', '18:00', '22:00'), { nil: null }),
    }),
    { minLength: 0, maxLength: 5 }
  ),
});

describe('Feature: ai-coach-quality-improvement', () => {
  describe('Property 8: Prompt Context Completeness', () => {
    /**
     * Validates: Requirements 6.1, 6.2, 6.3
     *
     * For any UserContext, the built system prompt SHALL contain:
     * - The user's active habit count
     * - The user's average completion rate
     * - The user's level description
     * - The list of existing habit names (if any)
     * - The user's preferred time slots (if any)
     */
    it('should contain active habit count', () => {
      fc.assert(
        fc.property(userContextArb, (context) => {
          const prompt = builder.buildSystemPrompt(context, 'Base prompt');
          return prompt.includes(`アクティブな習慣数: ${context.activeHabitCount}`);
        }),
        propertyConfig
      );
    });

    it('should contain average completion rate as percentage', () => {
      fc.assert(
        fc.property(userContextArb, (context) => {
          const prompt = builder.buildSystemPrompt(context, 'Base prompt');
          const expectedRate = Math.round(context.averageCompletionRate * 100);
          return prompt.includes(`平均達成率: ${expectedRate}%`);
        }),
        propertyConfig
      );
    });

    it('should contain user level description', () => {
      fc.assert(
        fc.property(userContextArb, (context) => {
          const prompt = builder.buildSystemPrompt(context, 'Base prompt');
          const levelDescriptions = {
            beginner: '初心者',
            intermediate: '中級者',
            advanced: '上級者',
          };
          return prompt.includes(levelDescriptions[context.userLevel]);
        }),
        propertyConfig
      );
    });

    it('should contain existing habit names when present', () => {
      fc.assert(
        fc.property(
          userContextArb.filter((ctx) => ctx.existingHabitNames.length > 0),
          (context) => {
            const prompt = builder.buildSystemPrompt(context, 'Base prompt');
            // 少なくとも最初の習慣名が含まれていることを確認
            const firstHabit = context.existingHabitNames[0];
            return prompt.includes(firstHabit) || prompt.includes('既存習慣と重複しない');
          }
        ),
        propertyConfig
      );
    });

    it('should contain preferred time slots when present', () => {
      fc.assert(
        fc.property(
          userContextArb.filter((ctx) => ctx.preferredTimeSlots.length > 0),
          (context) => {
            const prompt = builder.buildSystemPrompt(context, 'Base prompt');
            const firstSlot = context.preferredTimeSlots[0];
            return (
              prompt.includes(`${firstSlot.hour}:00頃`) ||
              prompt.includes('好みの時間帯')
            );
          }
        ),
        propertyConfig
      );
    });

    it('should include base prompt', () => {
      fc.assert(
        fc.property(
          userContextArb,
          fc.string({ minLength: 1, maxLength: 100 }),
          (context, basePrompt) => {
            const prompt = builder.buildSystemPrompt(context, basePrompt);
            return prompt.includes(basePrompt);
          }
        ),
        propertyConfig
      );
    });
  });

  describe('Context Summary', () => {
    it('should build a valid context summary', () => {
      fc.assert(
        fc.property(userContextArb, (context) => {
          const summary = builder.buildContextSummary(context);

          // 必須項目が含まれていることを確認
          const hasHabitCount = summary.includes('アクティブな習慣数');
          const hasCompletionRate = summary.includes('平均達成率');
          const hasUserLevel = summary.includes('ユーザーレベル');
          const hasFrequency = summary.includes('好みの頻度');
          const hasTimeSlots = summary.includes('好みの時間帯');
          const hasAnchorHabits = summary.includes('アンカー習慣');

          return (
            hasHabitCount &&
            hasCompletionRate &&
            hasUserLevel &&
            hasFrequency &&
            hasTimeSlots &&
            hasAnchorHabits
          );
        }),
        propertyConfig
      );
    });
  });

  describe('Level-based Guidelines', () => {
    it('should include beginner guidelines for beginner users', () => {
      const beginnerContext: UserContext = {
        userId: 'test-user',
        activeHabitCount: 1,
        averageCompletionRate: 0.3,
        userLevel: 'beginner',
        preferredFrequency: 'daily',
        preferredTimeSlots: [],
        existingHabitNames: [],
        anchorHabits: [],
      };

      const prompt = builder.buildSystemPrompt(beginnerContext, 'Base');
      expect(prompt).toContain('初心者向け');
      expect(prompt).toContain('15分以内');
    });

    it('should include intermediate guidelines for intermediate users', () => {
      const intermediateContext: UserContext = {
        userId: 'test-user',
        activeHabitCount: 5,
        averageCompletionRate: 0.6,
        userLevel: 'intermediate',
        preferredFrequency: 'daily',
        preferredTimeSlots: [],
        existingHabitNames: [],
        anchorHabits: [],
      };

      const prompt = builder.buildSystemPrompt(intermediateContext, 'Base');
      expect(prompt).toContain('中級者向け');
      expect(prompt).toContain('30分以内');
    });

    it('should include advanced guidelines for advanced users', () => {
      const advancedContext: UserContext = {
        userId: 'test-user',
        activeHabitCount: 10,
        averageCompletionRate: 0.85,
        userLevel: 'advanced',
        preferredFrequency: 'daily',
        preferredTimeSlots: [],
        existingHabitNames: [],
        anchorHabits: [],
      };

      const prompt = builder.buildSystemPrompt(advancedContext, 'Base');
      expect(prompt).toContain('上級者向け');
      expect(prompt).toContain('チャレンジング');
    });
  });

  describe('Anchor Habits', () => {
    it('should include anchor habits in prompt when present', () => {
      const contextWithAnchors: UserContext = {
        userId: 'test-user',
        activeHabitCount: 5,
        averageCompletionRate: 0.7,
        userLevel: 'intermediate',
        preferredFrequency: 'daily',
        preferredTimeSlots: [],
        existingHabitNames: [],
        anchorHabits: [
          {
            habitId: '1',
            habitName: '朝のストレッチ',
            completionRate: 0.9,
            triggerTime: '07:00',
          },
        ],
      };

      const prompt = builder.buildSystemPrompt(contextWithAnchors, 'Base');
      expect(prompt).toContain('朝のストレッチ');
      expect(prompt).toContain('90%');
    });

    it('should show "なし" when no anchor habits', () => {
      const contextWithoutAnchors: UserContext = {
        userId: 'test-user',
        activeHabitCount: 2,
        averageCompletionRate: 0.5,
        userLevel: 'beginner',
        preferredFrequency: 'daily',
        preferredTimeSlots: [],
        existingHabitNames: [],
        anchorHabits: [],
      };

      const summary = builder.buildContextSummary(contextWithoutAnchors);
      expect(summary).toContain('アンカー習慣: なし');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty context gracefully', () => {
      const emptyContext: UserContext = {
        userId: 'test-user',
        activeHabitCount: 0,
        averageCompletionRate: 0,
        userLevel: 'beginner',
        preferredFrequency: 'daily',
        preferredTimeSlots: [],
        existingHabitNames: [],
        anchorHabits: [],
      };

      const prompt = builder.buildSystemPrompt(emptyContext, 'Base');
      expect(prompt).toBeDefined();
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('should limit existing habit names to 10', () => {
      const manyHabitsContext: UserContext = {
        userId: 'test-user',
        activeHabitCount: 15,
        averageCompletionRate: 0.7,
        userLevel: 'advanced',
        preferredFrequency: 'daily',
        preferredTimeSlots: [],
        existingHabitNames: Array.from({ length: 15 }, (_, i) => `習慣${i + 1}`),
        anchorHabits: [],
      };

      const prompt = builder.buildSystemPrompt(manyHabitsContext, 'Base');
      // 「他5件」のような表記があることを確認
      expect(prompt).toContain('他');
    });

    it('should limit time slots to 3', () => {
      const manyTimeSlotsContext: UserContext = {
        userId: 'test-user',
        activeHabitCount: 5,
        averageCompletionRate: 0.6,
        userLevel: 'intermediate',
        preferredFrequency: 'daily',
        preferredTimeSlots: [
          { hour: 7, frequency: 10 },
          { hour: 12, frequency: 8 },
          { hour: 18, frequency: 6 },
          { hour: 22, frequency: 4 },
          { hour: 9, frequency: 2 },
        ],
        existingHabitNames: [],
        anchorHabits: [],
      };

      const summary = builder.buildContextSummary(manyTimeSlotsContext);
      // 最初の3つの時間帯のみが含まれることを確認
      expect(summary).toContain('7:00頃');
      expect(summary).toContain('12:00頃');
      expect(summary).toContain('18:00頃');
      expect(summary).not.toContain('22:00頃');
    });
  });
});
