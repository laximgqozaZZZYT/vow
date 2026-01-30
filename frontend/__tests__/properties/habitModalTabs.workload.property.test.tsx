/**
 * Property-Based Tests for Habit Modal Tabs - Workload Tab
 * 
 * **Feature: habit-modal-tabs, Property 3: Auto load calculation**
 * **Validates: Requirements 4.7**
 * 
 * Tests that for any valid workloadTotal (positive number) and any list of timings
 * with durations, the sum of autoLoadPerSet values should equal workloadTotal
 * (within floating-point tolerance).
 * 
 * Uses fast-check for property-based testing with at least 100 iterations.
 */

import * as fc from 'fast-check';

// ============================================================================
// Types (matching the application types)
// ============================================================================

type TimingType = 'Date' | 'Daily' | 'Weekly' | 'Monthly';

interface Timing {
  id?: string;
  type: TimingType;
  date?: string;
  start?: string;
  end?: string;
  cron?: string;
}

// ============================================================================
// Pure Functions Under Test (extracted from Modal.Habit.tsx)
// ============================================================================

/**
 * Convert HH:MM time string to minutes since midnight
 * Extracted from Modal.Habit.tsx for testing
 */
function minutesFromHHMM(s?: string): number | null {
  if (!s) return null;
  const m = String(s).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  return h * 60 + min;
}

/**
 * Calculate timing durations in minutes
 * Extracted from Modal.Habit.tsx for testing
 */
function calculateTimingDurations(timings: Timing[]): number[] {
  return (timings ?? []).map((t) => {
    if (!t.start) return 0;
    const s = minutesFromHHMM(t.start);
    if (s === null) return 0;
    if (!t.end) return 0;
    const e = minutesFromHHMM(t.end);
    if (e === null) return 0;
    const d = e - s;
    return d > 0 ? d : 0;
  });
}

/**
 * Calculate auto load per set based on workloadTotal and timings
 * Extracted from Modal.Habit.tsx for testing
 * 
 * This is the core function being tested by Property 3.
 */
function calculateAutoLoadPerSet(
  workloadTotal: string,
  timings: Timing[]
): (number | null)[] {
  const dayTotalNum = Number(workloadTotal);
  const dayTotal = !isNaN(dayTotalNum) && dayTotalNum > 0 ? dayTotalNum : null;
  
  if (dayTotal === null || dayTotal <= 0) {
    return (timings ?? []).map(() => null as number | null);
  }
  
  const timingDurations = calculateTimingDurations(timings);
  
  if (!timingDurations.length) {
    return (timings ?? []).map(() => null as number | null);
  }

  const totalTimingMinutes = timingDurations.reduce((a, b) => a + b, 0);
  
  // If we can't compute durations (sum==0), fall back to equal split across timings.
  const denom = totalTimingMinutes > 0 ? totalTimingMinutes : timingDurations.length;

  return timingDurations.map((d) => {
    const w = totalTimingMinutes > 0 ? d : 1;
    const v = dayTotal * (w / denom);
    return Number.isFinite(v) ? v : null;
  });
}

// ============================================================================
// Generators
// ============================================================================

/**
 * Generator for valid HH:MM time strings
 */
const timeStringArb: fc.Arbitrary<string> = fc.tuple(
  fc.integer({ min: 0, max: 23 }),
  fc.integer({ min: 0, max: 59 })
).map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);

/**
 * Generator for a valid start/end time pair where end > start
 */
const validTimeRangeArb: fc.Arbitrary<{ start: string; end: string }> = fc.tuple(
  fc.integer({ min: 0, max: 22 }), // start hour (0-22 to allow room for end)
  fc.integer({ min: 0, max: 59 }), // start minute
  fc.integer({ min: 1, max: 180 }) // duration in minutes (1-180)
).map(([startHour, startMin, duration]) => {
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = Math.min(startMinutes + duration, 23 * 60 + 59); // Cap at 23:59
  
  const endHour = Math.floor(endMinutes / 60);
  const endMin = endMinutes % 60;
  
  return {
    start: `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`,
    end: `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`
  };
});

/**
 * Generator for TimingType
 */
const timingTypeArb: fc.Arbitrary<TimingType> = fc.constantFrom('Date', 'Daily', 'Weekly', 'Monthly');

/**
 * Generator for a Timing with valid start/end times (has duration)
 */
const timingWithDurationArb: fc.Arbitrary<Timing> = fc.tuple(
  timingTypeArb,
  validTimeRangeArb
).map(([type, { start, end }]) => ({
  type,
  start,
  end
}));

/**
 * Generator for a Timing without duration (no start/end or invalid)
 */
const timingWithoutDurationArb: fc.Arbitrary<Timing> = fc.record({
  type: timingTypeArb,
  date: fc.option(fc.constant('2024-06-15'), { nil: undefined }),
});

/**
 * Generator for positive workloadTotal values
 */
const positiveWorkloadTotalArb: fc.Arbitrary<number> = fc.double({
  min: 0.01,
  max: 1000,
  noNaN: true,
  noDefaultInfinity: true
});

/**
 * Generator for non-empty array of timings with durations
 */
const timingsWithDurationsArb: fc.Arbitrary<Timing[]> = fc.array(
  timingWithDurationArb,
  { minLength: 1, maxLength: 10 }
);

/**
 * Generator for non-empty array of timings without durations
 */
const timingsWithoutDurationsArb: fc.Arbitrary<Timing[]> = fc.array(
  timingWithoutDurationArb,
  { minLength: 1, maxLength: 10 }
);

// ============================================================================
// Property Tests
// ============================================================================

describe('Feature: habit-modal-tabs, Property 3: Auto load calculation', () => {
  /**
   * Property 3: Auto Load Calculation
   * 
   * *For any* valid workloadTotal (positive number) and any list of timings with durations,
   * the sum of autoLoadPerSet values should equal workloadTotal (within floating-point tolerance).
   * 
   * **Validates: Requirements 4.7**
   */
  describe('Property 3: Auto load calculation', () => {
    const TOLERANCE = 0.01;

    it('sum of autoLoadPerSet should equal workloadTotal for timings with durations', () => {
      fc.assert(
        fc.property(
          positiveWorkloadTotalArb,
          timingsWithDurationsArb,
          (workloadTotal, timings) => {
            const autoLoadPerSet = calculateAutoLoadPerSet(String(workloadTotal), timings);
            
            // Filter out null values and sum
            const validLoads = autoLoadPerSet.filter((v): v is number => v !== null);
            const sum = validLoads.reduce((a, b) => a + b, 0);
            
            // The sum should equal workloadTotal within tolerance
            expect(Math.abs(sum - workloadTotal)).toBeLessThan(TOLERANCE);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('sum of autoLoadPerSet should equal workloadTotal for timings without durations (equal split)', () => {
      fc.assert(
        fc.property(
          positiveWorkloadTotalArb,
          timingsWithoutDurationsArb,
          (workloadTotal, timings) => {
            const autoLoadPerSet = calculateAutoLoadPerSet(String(workloadTotal), timings);
            
            // Filter out null values and sum
            const validLoads = autoLoadPerSet.filter((v): v is number => v !== null);
            const sum = validLoads.reduce((a, b) => a + b, 0);
            
            // The sum should equal workloadTotal within tolerance
            expect(Math.abs(sum - workloadTotal)).toBeLessThan(TOLERANCE);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('each autoLoadPerSet value should be non-negative for positive workloadTotal', () => {
      fc.assert(
        fc.property(
          positiveWorkloadTotalArb,
          timingsWithDurationsArb,
          (workloadTotal, timings) => {
            const autoLoadPerSet = calculateAutoLoadPerSet(String(workloadTotal), timings);
            
            // All non-null values should be non-negative
            for (const load of autoLoadPerSet) {
              if (load !== null) {
                expect(load).toBeGreaterThanOrEqual(0);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('autoLoadPerSet length should match timings length', () => {
      fc.assert(
        fc.property(
          positiveWorkloadTotalArb,
          timingsWithDurationsArb,
          (workloadTotal, timings) => {
            const autoLoadPerSet = calculateAutoLoadPerSet(String(workloadTotal), timings);
            
            expect(autoLoadPerSet.length).toBe(timings.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('timings without durations should get equal load distribution', () => {
      fc.assert(
        fc.property(
          positiveWorkloadTotalArb,
          timingsWithoutDurationsArb,
          (workloadTotal, timings) => {
            const autoLoadPerSet = calculateAutoLoadPerSet(String(workloadTotal), timings);
            
            // All values should be equal (workloadTotal / timings.length)
            const expectedLoad = workloadTotal / timings.length;
            
            for (const load of autoLoadPerSet) {
              if (load !== null) {
                expect(Math.abs(load - expectedLoad)).toBeLessThan(TOLERANCE);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('load distribution should be proportional to timing durations', () => {
      fc.assert(
        fc.property(
          positiveWorkloadTotalArb,
          timingsWithDurationsArb,
          (workloadTotal, timings) => {
            const autoLoadPerSet = calculateAutoLoadPerSet(String(workloadTotal), timings);
            const durations = calculateTimingDurations(timings);
            const totalDuration = durations.reduce((a, b) => a + b, 0);
            
            if (totalDuration > 0) {
              // Each load should be proportional to its duration
              for (let i = 0; i < timings.length; i++) {
                const expectedLoad = workloadTotal * (durations[i] / totalDuration);
                const actualLoad = autoLoadPerSet[i];
                
                if (actualLoad !== null) {
                  expect(Math.abs(actualLoad - expectedLoad)).toBeLessThan(TOLERANCE);
                }
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('zero or negative workloadTotal should return all null values', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('0'),
            fc.constant('-1'),
            fc.constant('-100'),
            fc.constant(''),
            fc.constant('invalid')
          ),
          timingsWithDurationsArb,
          (workloadTotal, timings) => {
            const autoLoadPerSet = calculateAutoLoadPerSet(workloadTotal, timings);
            
            // All values should be null
            for (const load of autoLoadPerSet) {
              expect(load).toBeNull();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('empty timings array should return empty array', () => {
      fc.assert(
        fc.property(
          positiveWorkloadTotalArb,
          (workloadTotal) => {
            const autoLoadPerSet = calculateAutoLoadPerSet(String(workloadTotal), []);
            
            expect(autoLoadPerSet).toEqual([]);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('mixed timings (some with duration, some without) should distribute correctly', () => {
      fc.assert(
        fc.property(
          positiveWorkloadTotalArb,
          fc.tuple(timingsWithDurationsArb, timingsWithoutDurationsArb),
          (workloadTotal, [withDuration, withoutDuration]) => {
            // Mix timings: some with duration, some without
            const mixedTimings = [...withDuration, ...withoutDuration];
            const autoLoadPerSet = calculateAutoLoadPerSet(String(workloadTotal), mixedTimings);
            
            // Filter out null values and sum
            const validLoads = autoLoadPerSet.filter((v): v is number => v !== null);
            const sum = validLoads.reduce((a, b) => a + b, 0);
            
            // The sum should equal workloadTotal within tolerance
            expect(Math.abs(sum - workloadTotal)).toBeLessThan(TOLERANCE);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('single timing should receive full workloadTotal', () => {
      fc.assert(
        fc.property(
          positiveWorkloadTotalArb,
          timingWithDurationArb,
          (workloadTotal, timing) => {
            const autoLoadPerSet = calculateAutoLoadPerSet(String(workloadTotal), [timing]);
            
            expect(autoLoadPerSet.length).toBe(1);
            expect(autoLoadPerSet[0]).not.toBeNull();
            expect(Math.abs(autoLoadPerSet[0]! - workloadTotal)).toBeLessThan(TOLERANCE);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
