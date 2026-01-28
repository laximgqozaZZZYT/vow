/**
 * XP Multiplier Property Tests
 *
 * Feature: gamification-xp-balance
 * Property 1: XP Multiplier Tier Mapping
 * Property 2: Completion Rate Calculation
 * Property 8: XP Multiplier Monotonicity in Optimal Range
 *
 * Tests the behavioral science-based XP multiplier system that rewards
 * plan adherence (100-120%) with maximum multiplier while discouraging
 * both under-achievement and over-achievement.
 *
 * **Validates: Requirements 1.1-1.9**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  calculateCompletionRate,
  determineMultiplierTier,
  getMultiplierValue,
  getRationaleKey,
  getMultiplierRationale,
  calculateXPMultiplier,
  calculateXPMultiplierFromRate,
  getTierColor,
  formatMultiplier,
  formatCompletionRate,
  getMultiplierTooltip,
  type XPMultiplierTier,
  type XPMultiplierResult,
} from '../../../src/services/xpMultiplierService.js';

// =============================================================================
// Constants for Testing
// =============================================================================

const TIER_BOUNDARIES = {
  minimal: { min: 0, max: 49 },
  partial: { min: 50, max: 79 },
  near: { min: 80, max: 99 },
  optimal: { min: 100, max: 120 },
  mild_over: { min: 121, max: 150 },
  over: { min: 151, max: 500 },
};

const EXPECTED_MULTIPLIERS: Record<XPMultiplierTier, number> = {
  minimal: 0.3,
  partial: 0.6,
  near: 0.8,
  optimal: 1.0,
  mild_over: 0.9,
  over: 0.7,
};

// =============================================================================
// Arbitraries
// =============================================================================

/** Arbitrary for completion rate in minimal tier (0-49%) */
const minimalRateArb = fc.integer({ min: 0, max: 49 }).map(n => n + Math.random() * 0.99);

/** Arbitrary for completion rate in partial tier (50-79%) */
const partialRateArb = fc.integer({ min: 50, max: 79 }).map(n => n + Math.random() * 0.99);

/** Arbitrary for completion rate in near tier (80-99%) */
const nearRateArb = fc.integer({ min: 80, max: 99 }).map(n => n + Math.random() * 0.99);

/** Arbitrary for completion rate in optimal tier (100-120%) */
const optimalRateArb = fc.integer({ min: 100, max: 120 });

/** Arbitrary for completion rate in mild_over tier (121-150%) */
const mildOverRateArb = fc.integer({ min: 121, max: 150 });

/** Arbitrary for completion rate in over tier (151%+) */
const overRateArb = fc.integer({ min: 151, max: 500 });

/** Arbitrary for any valid completion rate */
const anyCompletionRateArb = fc.integer({ min: 0, max: 500 });

/** Arbitrary for positive target value */
const positiveTargetArb = fc.integer({ min: 1, max: 1000 });

/** Arbitrary for non-negative actual value */
const nonNegativeActualArb = fc.integer({ min: 0, max: 5000 });

/** Arbitrary for locale */
const localeArb = fc.constantFrom('ja' as const, 'en' as const);

// =============================================================================
// Property-Based Tests
// =============================================================================

describe('Feature: gamification-xp-balance, Property 1: XP Multiplier Tier Mapping', () => {
  /**
   * Property 1.1: Minimal Tier (0-49%)
   *
   * For any completion rate between 0% and 49%, the system shall return
   * a multiplier of 0.3 (minimal tier).
   *
   * **Validates: Requirements 1.1**
   */
  it('should return 0.3x multiplier for completion rate 0-49%', () => {
    fc.assert(
      fc.property(minimalRateArb, (completionRate) => {
        const tier = determineMultiplierTier(completionRate);
        const multiplier = getMultiplierValue(tier);

        return tier === 'minimal' && Math.abs(multiplier - 0.3) < 0.001;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.2: Partial Tier (50-79%)
   *
   * For any completion rate between 50% and 79%, the system shall return
   * a multiplier of 0.6 (partial tier).
   *
   * **Validates: Requirements 1.2**
   */
  it('should return 0.6x multiplier for completion rate 50-79%', () => {
    fc.assert(
      fc.property(partialRateArb, (completionRate) => {
        const tier = determineMultiplierTier(completionRate);
        const multiplier = getMultiplierValue(tier);

        return tier === 'partial' && Math.abs(multiplier - 0.6) < 0.001;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.3: Near Tier (80-99%)
   *
   * For any completion rate between 80% and 99%, the system shall return
   * a multiplier of 0.8 (near tier).
   *
   * **Validates: Requirements 1.3**
   */
  it('should return 0.8x multiplier for completion rate 80-99%', () => {
    fc.assert(
      fc.property(nearRateArb, (completionRate) => {
        const tier = determineMultiplierTier(completionRate);
        const multiplier = getMultiplierValue(tier);

        return tier === 'near' && Math.abs(multiplier - 0.8) < 0.001;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.4: Optimal Tier (100-120%)
   *
   * For any completion rate between 100% and 120%, the system shall return
   * a multiplier of 1.0 (optimal tier - maximum reward for plan adherence).
   *
   * **Validates: Requirements 1.4**
   */
  it('should return 1.0x multiplier for completion rate 100-120%', () => {
    fc.assert(
      fc.property(optimalRateArb, (completionRate) => {
        const tier = determineMultiplierTier(completionRate);
        const multiplier = getMultiplierValue(tier);

        return tier === 'optimal' && Math.abs(multiplier - 1.0) < 0.001;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.5: Mild Over Tier (121-150%)
   *
   * For any completion rate between 121% and 150%, the system shall return
   * a multiplier of 0.9 (mild_over tier).
   *
   * **Validates: Requirements 1.5**
   */
  it('should return 0.9x multiplier for completion rate 121-150%', () => {
    fc.assert(
      fc.property(mildOverRateArb, (completionRate) => {
        const tier = determineMultiplierTier(completionRate);
        const multiplier = getMultiplierValue(tier);

        return tier === 'mild_over' && Math.abs(multiplier - 0.9) < 0.001;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.6: Over Tier (151%+)
   *
   * For any completion rate above 150%, the system shall return
   * a multiplier of 0.7 (over tier - burnout prevention).
   *
   * **Validates: Requirements 1.6**
   */
  it('should return 0.7x multiplier for completion rate above 150%', () => {
    fc.assert(
      fc.property(overRateArb, (completionRate) => {
        const tier = determineMultiplierTier(completionRate);
        const multiplier = getMultiplierValue(tier);

        return tier === 'over' && Math.abs(multiplier - 0.7) < 0.001;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.7: Tier Mapping Completeness
   *
   * For any valid completion rate (0-500%), the system shall return
   * a valid tier and multiplier.
   *
   * **Validates: Requirements 1.1-1.6**
   */
  it('should return valid tier and multiplier for any completion rate', () => {
    fc.assert(
      fc.property(anyCompletionRateArb, (completionRate) => {
        const tier = determineMultiplierTier(completionRate);
        const multiplier = getMultiplierValue(tier);

        // Tier must be one of the valid tiers
        const validTiers: XPMultiplierTier[] = [
          'minimal',
          'partial',
          'near',
          'optimal',
          'mild_over',
          'over',
        ];
        const isValidTier = validTiers.includes(tier);

        // Multiplier must be in valid range
        const isValidMultiplier = multiplier >= 0.3 && multiplier <= 1.0;

        return isValidTier && isValidMultiplier;
      }),
      { numRuns: 100 }
    );
  });
});

describe('Feature: gamification-xp-balance, Property 2: Completion Rate Calculation', () => {
  /**
   * Property 2.1: Completion Rate Formula
   *
   * For any habit with actual and target values, the completion rate
   * shall be calculated as (actual / target) * 100.
   *
   * **Validates: Requirements 1.7, 1.8**
   */
  it('should calculate completion rate as (actual / target) * 100', () => {
    fc.assert(
      fc.property(nonNegativeActualArb, positiveTargetArb, (actual, target) => {
        const rate = calculateCompletionRate(actual, target);
        const expectedRate = Math.min((actual / target) * 100, 500);

        return Math.abs(rate - expectedRate) < 0.01;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2.2: Non-Negative Result
   *
   * The completion rate shall always be a non-negative number.
   *
   * **Validates: Requirements 1.7, 1.8**
   */
  it('should return non-negative completion rate', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: 1000 }),
        fc.integer({ min: -100, max: 1000 }),
        (actual, target) => {
          const rate = calculateCompletionRate(actual, target);
          return rate >= 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2.3: Zero Target Handling
   *
   * When target is zero or negative, the completion rate shall be 0.
   *
   * **Validates: Requirements 1.7, 1.8**
   */
  it('should return 0 when target is zero or negative', () => {
    fc.assert(
      fc.property(
        nonNegativeActualArb,
        fc.integer({ min: -100, max: 0 }),
        (actual, target) => {
          const rate = calculateCompletionRate(actual, target);
          return rate === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2.4: Negative Actual Handling
   *
   * When actual is negative, the completion rate shall be 0.
   *
   * **Validates: Requirements 1.7, 1.8**
   */
  it('should return 0 when actual is negative', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: -1 }),
        positiveTargetArb,
        (actual, target) => {
          const rate = calculateCompletionRate(actual, target);
          return rate === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2.5: Maximum Rate Cap
   *
   * The completion rate shall be capped at 500% to prevent overflow.
   *
   * **Validates: Requirements 1.7, 1.8**
   */
  it('should cap completion rate at 500%', () => {
    fc.assert(
      fc.property(nonNegativeActualArb, positiveTargetArb, (actual, target) => {
        const rate = calculateCompletionRate(actual, target);
        return rate <= 500;
      }),
      { numRuns: 100 }
    );
  });
});

describe('Feature: gamification-xp-balance, Property 8: XP Multiplier Monotonicity in Optimal Range', () => {
  /**
   * Property 8.1: Optimal Range Consistency
   *
   * For any two completion rates r1 and r2 where both are in the optimal
   * range [100%, 120%], the applied multiplier shall be equal (both 1.0x).
   *
   * **Validates: Requirements 1.4**
   */
  it('should return equal multiplier for any rates in optimal range', () => {
    fc.assert(
      fc.property(optimalRateArb, optimalRateArb, (rate1, rate2) => {
        const result1 = calculateXPMultiplierFromRate(rate1);
        const result2 = calculateXPMultiplierFromRate(rate2);

        return (
          result1.tier === 'optimal' &&
          result2.tier === 'optimal' &&
          Math.abs(result1.multiplier - result2.multiplier) < 0.001 &&
          Math.abs(result1.multiplier - 1.0) < 0.001
        );
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.2: Plan Adherence Maximum Reward
   *
   * The optimal tier (100-120%) shall have the highest multiplier (1.0x).
   *
   * **Validates: Requirements 1.4**
   */
  it('should have optimal tier as maximum multiplier', () => {
    fc.assert(
      fc.property(anyCompletionRateArb, (completionRate) => {
        const tier = determineMultiplierTier(completionRate);
        const multiplier = getMultiplierValue(tier);
        const optimalMultiplier = getMultiplierValue('optimal');

        return multiplier <= optimalMultiplier;
      }),
      { numRuns: 100 }
    );
  });
});

describe('XP Multiplier Result Structure', () => {
  /**
   * Property: Result Structure Completeness
   *
   * For any call to calculateXPMultiplier(), the returned object shall
   * contain all required fields with valid values.
   */
  it('should return complete result structure', () => {
    fc.assert(
      fc.property(nonNegativeActualArb, positiveTargetArb, localeArb, (actual, target, locale) => {
        const result = calculateXPMultiplier(actual, target, locale);

        // Check all required fields exist
        const hasMultiplier = typeof result.multiplier === 'number';
        const hasTier = typeof result.tier === 'string';
        const hasCompletionRate = typeof result.completionRate === 'number';
        const hasRationale = typeof result.rationale === 'string';
        const hasRationaleKey = typeof result.rationaleKey === 'string';

        // Check values are valid
        const validMultiplier = result.multiplier >= 0.3 && result.multiplier <= 1.0;
        const validCompletionRate = result.completionRate >= 0 && result.completionRate <= 500;
        const validRationale = result.rationale.length > 0;

        return (
          hasMultiplier &&
          hasTier &&
          hasCompletionRate &&
          hasRationale &&
          hasRationaleKey &&
          validMultiplier &&
          validCompletionRate &&
          validRationale
        );
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Rationale Localization
   *
   * The rationale message shall be localized based on the provided locale.
   */
  it('should return localized rationale message', () => {
    fc.assert(
      fc.property(anyCompletionRateArb, (completionRate) => {
        const resultJa = calculateXPMultiplierFromRate(completionRate, 'ja');
        const resultEn = calculateXPMultiplierFromRate(completionRate, 'en');

        // Same tier should have same multiplier
        const sameTier = resultJa.tier === resultEn.tier;
        const sameMultiplier = Math.abs(resultJa.multiplier - resultEn.multiplier) < 0.001;

        // Rationale should be different for different locales (unless empty)
        const differentRationale =
          resultJa.rationale !== resultEn.rationale || resultJa.rationale.length === 0;

        return sameTier && sameMultiplier && differentRationale;
      }),
      { numRuns: 100 }
    );
  });
});

describe('Display Helpers', () => {
  /**
   * Property: Tier Color Mapping
   *
   * Each tier shall map to a valid color code.
   */
  it('should return valid color for each tier', () => {
    const tiers: XPMultiplierTier[] = ['minimal', 'partial', 'near', 'optimal', 'mild_over', 'over'];
    const validColors = ['green', 'yellow', 'orange', 'red'];

    for (const tier of tiers) {
      const color = getTierColor(tier);
      expect(validColors).toContain(color);
    }
  });

  /**
   * Property: Optimal Tier is Green
   *
   * The optimal tier (100-120%) shall be displayed in green.
   */
  it('should return green for optimal tier', () => {
    expect(getTierColor('optimal')).toBe('green');
  });

  /**
   * Property: Minimal Tier is Red
   *
   * The minimal tier (0-49%) shall be displayed in red.
   */
  it('should return red for minimal tier', () => {
    expect(getTierColor('minimal')).toBe('red');
  });

  /**
   * Property: Format Multiplier
   *
   * Multiplier formatting shall produce valid string format.
   */
  it('should format multiplier correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 30, max: 100 }).map(n => n / 100),
        (multiplier) => {
          const formatted = formatMultiplier(multiplier);
          return formatted.startsWith('×') && formatted.length > 1;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Format Completion Rate
   *
   * Completion rate formatting shall produce valid percentage string.
   */
  it('should format completion rate correctly', () => {
    fc.assert(
      fc.property(anyCompletionRateArb, (rate) => {
        const formatted = formatCompletionRate(rate);
        return formatted.endsWith('%') && formatted.length > 1;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Tooltip Localization
   *
   * Tooltips shall be localized based on locale.
   */
  it('should return localized tooltips', () => {
    const tiers: XPMultiplierTier[] = ['minimal', 'partial', 'near', 'optimal', 'mild_over', 'over'];

    for (const tier of tiers) {
      const tooltipJa = getMultiplierTooltip(tier, 'ja');
      const tooltipEn = getMultiplierTooltip(tier, 'en');

      expect(tooltipJa.length).toBeGreaterThan(0);
      expect(tooltipEn.length).toBeGreaterThan(0);
      expect(tooltipJa).not.toBe(tooltipEn);
    }
  });
});

// =============================================================================
// Edge Case Tests (Unit Tests)
// =============================================================================

describe('Edge Cases', () => {
  /**
   * Edge Case: Exact Boundary Values
   *
   * Test exact boundary values between tiers.
   */
  it('should handle exact boundary at 50%', () => {
    const result = calculateXPMultiplierFromRate(50);
    expect(result.tier).toBe('partial');
    expect(result.multiplier).toBe(0.6);
  });

  it('should handle exact boundary at 80%', () => {
    const result = calculateXPMultiplierFromRate(80);
    expect(result.tier).toBe('near');
    expect(result.multiplier).toBe(0.8);
  });

  it('should handle exact boundary at 100%', () => {
    const result = calculateXPMultiplierFromRate(100);
    expect(result.tier).toBe('optimal');
    expect(result.multiplier).toBe(1.0);
  });

  it('should handle exact boundary at 120%', () => {
    const result = calculateXPMultiplierFromRate(120);
    expect(result.tier).toBe('optimal');
    expect(result.multiplier).toBe(1.0);
  });

  it('should handle exact boundary at 121%', () => {
    const result = calculateXPMultiplierFromRate(121);
    expect(result.tier).toBe('mild_over');
    expect(result.multiplier).toBe(0.9);
  });

  it('should handle exact boundary at 150%', () => {
    const result = calculateXPMultiplierFromRate(150);
    expect(result.tier).toBe('mild_over');
    expect(result.multiplier).toBe(0.9);
  });

  it('should handle exact boundary at 151%', () => {
    const result = calculateXPMultiplierFromRate(151);
    expect(result.tier).toBe('over');
    expect(result.multiplier).toBe(0.7);
  });

  /**
   * Edge Case: Zero Values
   */
  it('should handle zero actual value', () => {
    const result = calculateXPMultiplier(0, 100);
    expect(result.completionRate).toBe(0);
    expect(result.tier).toBe('minimal');
    expect(result.multiplier).toBe(0.3);
  });

  it('should handle zero target value', () => {
    const result = calculateXPMultiplier(100, 0);
    expect(result.completionRate).toBe(0);
    expect(result.tier).toBe('minimal');
    expect(result.multiplier).toBe(0.3);
  });

  /**
   * Edge Case: Negative Values
   */
  it('should handle negative actual value', () => {
    const result = calculateXPMultiplier(-10, 100);
    expect(result.completionRate).toBe(0);
    expect(result.tier).toBe('minimal');
  });

  it('should handle negative target value', () => {
    const result = calculateXPMultiplier(100, -10);
    expect(result.completionRate).toBe(0);
    expect(result.tier).toBe('minimal');
  });

  /**
   * Edge Case: Very Large Values
   */
  it('should cap completion rate at 500%', () => {
    const result = calculateXPMultiplier(1000, 100);
    expect(result.completionRate).toBe(500);
    expect(result.tier).toBe('over');
  });

  /**
   * Edge Case: Decimal Values
   */
  it('should handle decimal actual and target values', () => {
    const result = calculateXPMultiplier(1.5, 1.5);
    expect(result.completionRate).toBe(100);
    expect(result.tier).toBe('optimal');
    expect(result.multiplier).toBe(1.0);
  });

  /**
   * Edge Case: Duration-based Habits
   */
  it('should work for duration-based habits (minutes)', () => {
    // 30 minutes actual, 30 minutes target = 100%
    const result = calculateXPMultiplier(30, 30);
    expect(result.completionRate).toBe(100);
    expect(result.tier).toBe('optimal');
  });

  it('should work for duration-based habits (partial)', () => {
    // 15 minutes actual, 30 minutes target = 50%
    const result = calculateXPMultiplier(15, 30);
    expect(result.completionRate).toBe(50);
    expect(result.tier).toBe('partial');
  });

  /**
   * Edge Case: Count-based Habits
   */
  it('should work for count-based habits', () => {
    // 10 reps actual, 10 reps target = 100%
    const result = calculateXPMultiplier(10, 10);
    expect(result.completionRate).toBe(100);
    expect(result.tier).toBe('optimal');
  });

  it('should work for count-based habits (over)', () => {
    // 20 reps actual, 10 reps target = 200%
    const result = calculateXPMultiplier(20, 10);
    expect(result.completionRate).toBe(200);
    expect(result.tier).toBe('over');
  });
});
