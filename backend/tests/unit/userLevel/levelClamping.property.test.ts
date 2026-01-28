/**
 * Level Value Clamping Property Test
 *
 * Feature: user-level-system, Property 12: Level Value Clamping
 *
 * All level values (overall_level, expertise_level) must be clamped to the valid range [0, 199]:
 * - Values below 0 are clamped to 0
 * - Values above 199 are clamped to 199
 * - Values are floored to integers
 *
 * **Validates: Requirements 7.6**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { clampLevel } from '../../../src/services/userLevelService.js';

// =============================================================================
// Constants
// =============================================================================

/** Minimum valid level value */
const MIN_LEVEL = 0;

/** Maximum valid level value */
const MAX_LEVEL = 199;

// =============================================================================
// Property-Based Tests
// =============================================================================

describe('Feature: user-level-system, Property 12: Level Value Clamping', () => {
  /**
   * Property 12.1: Result is Always in Range [0, 199]
   *
   * For any input value, the clamped result must always be within [0, 199].
   *
   * **Validates: Requirements 7.6**
   */
  it('should always return a value in range [0, 199]', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 1000 }),
        (rawLevel) => {
          const clamped = clampLevel(rawLevel);
          return clamped >= MIN_LEVEL && clamped <= MAX_LEVEL;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12.2: Values Below 0 Are Clamped to 0
   *
   * Any negative input value must be clamped to 0.
   *
   * **Validates: Requirements 7.6**
   */
  it('should clamp values below 0 to 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10000, max: -1 }),
        (negativeLevel) => {
          const clamped = clampLevel(negativeLevel);
          return clamped === MIN_LEVEL;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12.3: Values Above 199 Are Clamped to 199
   *
   * Any input value above 199 must be clamped to 199.
   *
   * **Validates: Requirements 7.6**
   */
  it('should clamp values above 199 to 199', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 200, max: 10000 }),
        (highLevel) => {
          const clamped = clampLevel(highLevel);
          return clamped === MAX_LEVEL;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12.4: Values Within Range Are Preserved (After Flooring)
   *
   * Integer values within [0, 199] should be preserved exactly.
   *
   * **Validates: Requirements 7.6**
   */
  it('should preserve integer values within range [0, 199]', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MIN_LEVEL, max: MAX_LEVEL }),
        (validLevel) => {
          const clamped = clampLevel(validLevel);
          return clamped === validLevel;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12.5: Result is Always an Integer (Floored)
   *
   * The clamped result must always be an integer (floored from any decimal input).
   *
   * **Validates: Requirements 7.6**
   */
  it('should always return an integer (floored)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -100, max: 300, noNaN: true }),
        (decimalLevel) => {
          const clamped = clampLevel(decimalLevel);
          return Number.isInteger(clamped);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12.6: Clamping is Idempotent
   *
   * Clamping a value twice should give the same result as clamping once.
   * clamp(clamp(x)) === clamp(x)
   *
   * **Validates: Requirements 7.6**
   */
  it('should be idempotent (clamping twice gives same result)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 1000 }),
        (rawLevel) => {
          const clampedOnce = clampLevel(rawLevel);
          const clampedTwice = clampLevel(clampedOnce);
          return clampedOnce === clampedTwice;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12.7: Decimal Values Within Range Are Floored
   *
   * Decimal values within the valid range should be floored to the nearest integer.
   *
   * **Validates: Requirements 7.6**
   */
  it('should floor decimal values within range', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 199.99, noNaN: true }),
        (decimalLevel) => {
          const clamped = clampLevel(decimalLevel);
          const expected = Math.floor(decimalLevel);
          return clamped === expected;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12.8: Boundary Value Correctness
   *
   * Test that boundary values are correctly handled.
   *
   * **Validates: Requirements 7.6**
   */
  it('should correctly handle boundary values', () => {
    // Minimum boundary
    expect(clampLevel(0)).toBe(0);
    expect(clampLevel(-1)).toBe(0);
    expect(clampLevel(-100)).toBe(0);

    // Maximum boundary
    expect(clampLevel(199)).toBe(199);
    expect(clampLevel(200)).toBe(199);
    expect(clampLevel(1000)).toBe(199);

    // Values just inside boundaries
    expect(clampLevel(1)).toBe(1);
    expect(clampLevel(198)).toBe(198);
  });

  /**
   * Property 12.9: Decimal Boundary Values
   *
   * Test that decimal values near boundaries are correctly handled.
   *
   * **Validates: Requirements 7.6**
   */
  it('should correctly handle decimal boundary values', () => {
    // Near minimum
    expect(clampLevel(-0.1)).toBe(0);
    expect(clampLevel(0.1)).toBe(0);
    expect(clampLevel(0.9)).toBe(0);

    // Near maximum
    expect(clampLevel(198.9)).toBe(198);
    expect(clampLevel(199.0)).toBe(199);
    expect(clampLevel(199.1)).toBe(199);
    expect(clampLevel(199.9)).toBe(199);
  });

  /**
   * Property 12.10: Deterministic Calculation
   *
   * The same input should always produce the same clamped result.
   *
   * **Validates: Requirements 7.6**
   */
  it('should produce deterministic results for the same input', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 1000 }),
        (rawLevel) => {
          const result1 = clampLevel(rawLevel);
          const result2 = clampLevel(rawLevel);
          const result3 = clampLevel(rawLevel);
          return result1 === result2 && result2 === result3;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12.11: Monotonicity
   *
   * If a <= b, then clamp(a) <= clamp(b).
   * The clamping function should preserve ordering.
   *
   * **Validates: Requirements 7.6**
   */
  it('should preserve ordering (monotonicity)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -500, max: 500 }),
        fc.integer({ min: 0, max: 500 }),
        (a, offset) => {
          const b = a + offset;
          const clampedA = clampLevel(a);
          const clampedB = clampLevel(b);
          return clampedA <= clampedB;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12.12: Extreme Values
   *
   * Test that extreme values are correctly clamped.
   *
   * **Validates: Requirements 7.6**
   */
  it('should correctly handle extreme values', () => {
    // Very large positive values
    expect(clampLevel(Number.MAX_SAFE_INTEGER)).toBe(199);
    expect(clampLevel(1000000)).toBe(199);

    // Very large negative values
    expect(clampLevel(Number.MIN_SAFE_INTEGER)).toBe(0);
    expect(clampLevel(-1000000)).toBe(0);
  });

  /**
   * Property 12.13: All Valid Levels Are Fixed Points
   *
   * For any integer in [0, 199], clamping should return the same value.
   * These are "fixed points" of the clamping function.
   *
   * **Validates: Requirements 7.6**
   */
  it('should have all valid levels as fixed points', () => {
    // Test all 200 possible valid levels
    for (let level = 0; level <= 199; level++) {
      expect(clampLevel(level)).toBe(level);
    }
  });
});
