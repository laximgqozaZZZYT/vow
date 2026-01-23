/**
 * Property-based tests for Demo Data Completeness
 *
 * **Feature: landing-page-demo, Property 1: Demo Data Completeness**
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.6**
 *
 * Tests that the demo data module exports complete and valid data:
 * - At least 3 habits with Japanese names (containing Japanese characters)
 * - At least 2 goals with Japanese names
 * - Activities covering the past 7 days
 * - At least 2 stickies
 * - Valid timing data (HH:MM format) for all habits
 */

import * as fc from 'fast-check';
import {
  demoGoals,
  demoHabits,
  demoActivities,
  demoStickies,
  demoData,
  generatePastActivities,
  getTodayString,
  getDateStringDaysAgo,
} from '../app/demo/data/demoData';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a string contains Japanese characters (Hiragana, Katakana, or Kanji)
 */
function containsJapanese(str: string): boolean {
  // Unicode ranges for Japanese characters:
  // Hiragana: \u3040-\u309F
  // Katakana: \u30A0-\u30FF
  // Kanji: \u4E00-\u9FAF
  const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
  return japanesePattern.test(str);
}

/**
 * Check if a string is a valid HH:MM time format
 */
function isValidTimeFormat(time: string | undefined | null): boolean {
  if (!time) return false;
  const timePattern = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
  return timePattern.test(time);
}

/**
 * Parse a date string (YYYY-MM-DD) to a Date object
 */
function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Get the number of days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((date1.getTime() - date2.getTime()) / oneDay));
}

// ============================================================================
// Property Tests
// ============================================================================

describe('Demo Data Property Tests', () => {
  /**
   * **Property 1: Demo Data Completeness**
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.6**
   */
  describe('Property 1: Demo Data Completeness', () => {
    describe('Requirement 1.1: At least 3 habits with Japanese names', () => {
      test('demoHabits should contain at least 3 habits', () => {
        expect(demoHabits.length).toBeGreaterThanOrEqual(3);
      });

      test('all habit names should contain Japanese characters', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 0, max: demoHabits.length - 1 }),
            (index) => {
              const habit = demoHabits[index];
              expect(containsJapanese(habit.name)).toBe(true);
            }
          ),
          { numRuns: 100 }
        );
      });

      test('each habit should have required fields', () => {
        for (const habit of demoHabits) {
          expect(habit.id).toBeDefined();
          expect(habit.name).toBeDefined();
          expect(habit.goalId).toBeDefined();
          expect(habit.type).toBeDefined();
          expect(habit.active).toBeDefined();
        }
      });
    });

    describe('Requirement 1.2: At least 2 goals with Japanese names', () => {
      test('demoGoals should contain at least 2 goals', () => {
        expect(demoGoals.length).toBeGreaterThanOrEqual(2);
      });

      test('all goal names should contain Japanese characters', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 0, max: demoGoals.length - 1 }),
            (index) => {
              const goal = demoGoals[index];
              expect(containsJapanese(goal.name)).toBe(true);
            }
          ),
          { numRuns: 100 }
        );
      });

      test('each goal should have required fields', () => {
        for (const goal of demoGoals) {
          expect(goal.id).toBeDefined();
          expect(goal.name).toBeDefined();
          expect(typeof goal.isCompleted).toBe('boolean');
        }
      });
    });

    describe('Requirement 1.3: Activities covering the past 7 days', () => {
      test('demoActivities should not be empty', () => {
        expect(demoActivities.length).toBeGreaterThan(0);
      });

      test('activities should cover at least 7 days', () => {
        // Extract unique dates from activities
        const activityDates = new Set<string>();
        
        for (const activity of demoActivities) {
          const date = activity.timestamp.split('T')[0];
          activityDates.add(date);
        }

        // Should have activities for at least 7 different days
        expect(activityDates.size).toBeGreaterThanOrEqual(7);
      });

      test('activities should include recent dates (within past 7 days)', () => {
        const today = new Date();
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(today.getDate() - 7);

        const hasRecentActivity = demoActivities.some((activity) => {
          const activityDate = new Date(activity.timestamp);
          return activityDate >= sevenDaysAgo && activityDate <= today;
        });

        expect(hasRecentActivity).toBe(true);
      });

      test('each activity should have required fields', () => {
        for (const activity of demoActivities) {
          expect(activity.id).toBeDefined();
          expect(activity.habitId).toBeDefined();
          expect(activity.habitName).toBeDefined();
          expect(activity.timestamp).toBeDefined();
          expect(activity.kind).toBeDefined();
          expect(['start', 'complete', 'skip', 'pause', 'resume']).toContain(activity.kind);
        }
      });

      test('activities should reference existing habits', () => {
        const habitIds = new Set(demoHabits.map((h) => h.id));
        
        for (const activity of demoActivities) {
          expect(habitIds.has(activity.habitId)).toBe(true);
        }
      });
    });

    describe('Requirement 1.4: At least 2 stickies', () => {
      test('demoStickies should contain at least 2 stickies', () => {
        expect(demoStickies.length).toBeGreaterThanOrEqual(2);
      });

      test('all sticky names should contain Japanese characters', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 0, max: demoStickies.length - 1 }),
            (index) => {
              const sticky = demoStickies[index];
              expect(containsJapanese(sticky.name)).toBe(true);
            }
          ),
          { numRuns: 100 }
        );
      });

      test('each sticky should have required fields', () => {
        for (const sticky of demoStickies) {
          expect(sticky.id).toBeDefined();
          expect(sticky.name).toBeDefined();
          expect(typeof sticky.completed).toBe('boolean');
          expect(typeof sticky.displayOrder).toBe('number');
        }
      });
    });

    describe('Requirement 1.6: Valid timing data (HH:MM format) for all habits', () => {
      test('all habits should have valid time format', () => {
        for (const habit of demoHabits) {
          expect(isValidTimeFormat(habit.time)).toBe(true);
        }
      });

      test('all habits should have valid endTime format', () => {
        for (const habit of demoHabits) {
          expect(isValidTimeFormat(habit.endTime)).toBe(true);
        }
      });

      test('all habit timings should have valid start and end times', () => {
        for (const habit of demoHabits) {
          if (habit.timings && habit.timings.length > 0) {
            for (const timing of habit.timings) {
              expect(isValidTimeFormat(timing.start)).toBe(true);
              expect(isValidTimeFormat(timing.end)).toBe(true);
            }
          }
        }
      });

      test('habit time should be before or equal to endTime', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 0, max: demoHabits.length - 1 }),
            (index) => {
              const habit = demoHabits[index];
              if (habit.time && habit.endTime) {
                const [startHour, startMin] = habit.time.split(':').map(Number);
                const [endHour, endMin] = habit.endTime.split(':').map(Number);
                const startMinutes = startHour * 60 + startMin;
                const endMinutes = endHour * 60 + endMin;
                expect(startMinutes).toBeLessThanOrEqual(endMinutes);
              }
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Data consistency and integrity', () => {
      test('all habits should reference existing goals', () => {
        const goalIds = new Set(demoGoals.map((g) => g.id));
        
        for (const habit of demoHabits) {
          expect(goalIds.has(habit.goalId)).toBe(true);
        }
      });

      test('demoData export should contain all data arrays', () => {
        expect(demoData.goals).toBe(demoGoals);
        expect(demoData.habits).toBe(demoHabits);
        expect(demoData.activities).toBe(demoActivities);
        expect(demoData.stickies).toBe(demoStickies);
      });

      test('all IDs should be unique within their respective arrays', () => {
        const goalIds = demoGoals.map((g) => g.id);
        const habitIds = demoHabits.map((h) => h.id);
        const activityIds = demoActivities.map((a) => a.id);
        const stickyIds = demoStickies.map((s) => s.id);

        expect(new Set(goalIds).size).toBe(goalIds.length);
        expect(new Set(habitIds).size).toBe(habitIds.length);
        expect(new Set(activityIds).size).toBe(activityIds.length);
        expect(new Set(stickyIds).size).toBe(stickyIds.length);
      });
    });

    describe('Helper functions', () => {
      test('getTodayString should return valid YYYY-MM-DD format', () => {
        fc.assert(
          fc.property(fc.constant(null), () => {
            const result = getTodayString();
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          }),
          { numRuns: 100 }
        );
      });

      test('getDateStringDaysAgo should return valid YYYY-MM-DD format', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 0, max: 365 }),
            (daysAgo) => {
              const result = getDateStringDaysAgo(daysAgo);
              expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            }
          ),
          { numRuns: 100 }
        );
      });

      test('getDateStringDaysAgo should return correct date offset', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 0, max: 30 }),
            (daysAgo) => {
              const result = getDateStringDaysAgo(daysAgo);
              const resultDate = parseDate(result);
              
              // Use UTC-based comparison since getDateStringDaysAgo uses toISOString (UTC)
              const now = new Date();
              const expectedDate = new Date(Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate() - daysAgo
              ));
              
              // Compare year, month, day in UTC
              expect(resultDate.getFullYear()).toBe(expectedDate.getUTCFullYear());
              expect(resultDate.getMonth()).toBe(expectedDate.getUTCMonth());
              expect(resultDate.getDate()).toBe(expectedDate.getUTCDate());
            }
          ),
          { numRuns: 100 }
        );
      });

      test('generatePastActivities should generate activities for specified days', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 1, max: 14 }),
            (days) => {
              const activities = generatePastActivities(demoHabits, days);
              
              // Should generate some activities
              expect(activities.length).toBeGreaterThan(0);
              
              // Extract unique dates
              const activityDates = new Set<string>();
              for (const activity of activities) {
                const date = activity.timestamp.split('T')[0];
                activityDates.add(date);
              }
              
              // Should have activities for multiple days (at least some due to completion rates)
              expect(activityDates.size).toBeGreaterThanOrEqual(1);
            }
          ),
          { numRuns: 100 }
        );
      });
    });
  });
});
