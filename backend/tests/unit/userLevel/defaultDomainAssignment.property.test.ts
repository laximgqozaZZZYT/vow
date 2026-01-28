/**
 * Default Domain Assignment Property Test
 *
 * Feature: user-level-system, Property 5: Default Domain Assignment
 *
 * For any habit or goal with an empty domain_codes array, when experience points
 * are awarded, they must be assigned to the "General" domain (code: "000").
 *
 * **Validates: Requirements 3.5, 13.6**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { distributeExperiencePoints } from '../../../src/services/experienceCalculatorService.js';

// =============================================================================
// Constants
// =============================================================================

/** General domain code for unclassified habits */
const GENERAL_DOMAIN_CODE = '000';

/** General domain name */
const GENERAL_DOMAIN_NAME = '一般（未分類）';

// =============================================================================
// Property-Based Tests
// =============================================================================

describe('Feature: user-level-system, Property 5: Default Domain Assignment', () => {
  /**
   * Property 5.1: Empty Array Assigns to General Domain
   *
   * When domain_codes is an empty array, all experience points must be
   * assigned to the General domain (code: "000").
   *
   * **Validates: Requirements 3.5, 13.6**
   */
  it('should assign all points to General domain when domain_codes is empty array', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }), // any positive experience points
        (totalPoints) => {
          const distribution = distributeExperiencePoints(totalPoints, []);

          // Must return exactly one domain
          if (distribution.length !== 1) {
            return false;
          }

          const result = distribution[0];

          // Must be the General domain
          if (result.domainCode !== GENERAL_DOMAIN_CODE) {
            return false;
          }

          // Must have the correct domain name
          if (result.domainName !== GENERAL_DOMAIN_NAME) {
            return false;
          }

          // Must receive all points
          if (result.points !== totalPoints) {
            return false;
          }

          // Must have proportion of 1.0
          if (result.proportion !== 1.0) {
            return false;
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.2: Null Domain Codes Assigns to General Domain
   *
   * When domain_codes is null, all experience points must be assigned
   * to the General domain.
   *
   * **Validates: Requirements 3.5, 13.6**
   */
  it('should assign all points to General domain when domain_codes is null', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }), // any positive experience points
        (totalPoints) => {
          // @ts-expect-error Testing null input
          const distribution = distributeExperiencePoints(totalPoints, null);

          return (
            distribution.length === 1 &&
            distribution[0].domainCode === GENERAL_DOMAIN_CODE &&
            distribution[0].domainName === GENERAL_DOMAIN_NAME &&
            distribution[0].points === totalPoints &&
            distribution[0].proportion === 1.0
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.3: Undefined Domain Codes Assigns to General Domain
   *
   * When domain_codes is undefined, all experience points must be assigned
   * to the General domain.
   *
   * **Validates: Requirements 3.5, 13.6**
   */
  it('should assign all points to General domain when domain_codes is undefined', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }), // any positive experience points
        (totalPoints) => {
          // @ts-expect-error Testing undefined input
          const distribution = distributeExperiencePoints(totalPoints, undefined);

          return (
            distribution.length === 1 &&
            distribution[0].domainCode === GENERAL_DOMAIN_CODE &&
            distribution[0].domainName === GENERAL_DOMAIN_NAME &&
            distribution[0].points === totalPoints &&
            distribution[0].proportion === 1.0
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.4: Zero Points Still Assigns to General Domain
   *
   * Even when experience points is 0, the General domain should be assigned.
   *
   * **Validates: Requirements 3.5, 13.6**
   */
  it('should assign to General domain even with zero points', () => {
    const distribution = distributeExperiencePoints(0, []);

    expect(distribution.length).toBe(1);
    expect(distribution[0].domainCode).toBe(GENERAL_DOMAIN_CODE);
    expect(distribution[0].domainName).toBe(GENERAL_DOMAIN_NAME);
    expect(distribution[0].points).toBe(0);
    expect(distribution[0].proportion).toBe(1.0);
  });

  /**
   * Property 5.5: Non-Empty Domain Codes Does NOT Assign to General
   *
   * When domain_codes has at least one domain, the General domain should
   * NOT be used (unless explicitly included in the array).
   *
   * **Validates: Requirements 3.5, 13.6**
   */
  it('should NOT assign to General domain when domain_codes is non-empty', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }), // any positive experience points
        fc.array(
          fc.tuple(
            fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'),
            fc.integer({ min: 1, max: 99 }),
            fc.integer({ min: 1, max: 999 })
          ).map(([major, middle, minor]) =>
            `${major}-${String(middle).padStart(2, '0')}-${String(minor).padStart(3, '0')}`
          ),
          { minLength: 1, maxLength: 5 }
        ),
        (totalPoints, domainCodes) => {
          // Ensure unique domain codes
          const uniqueCodes = [...new Set(domainCodes)];
          if (uniqueCodes.length === 0) {
            return true; // Skip if no unique codes
          }

          const distribution = distributeExperiencePoints(totalPoints, uniqueCodes);

          // General domain should NOT appear in the distribution
          const hasGeneralDomain = distribution.some(
            (d) => d.domainCode === GENERAL_DOMAIN_CODE
          );

          return !hasGeneralDomain;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.6: General Domain Code Is Exactly "000"
   *
   * The General domain code must be exactly "000", not any other value.
   *
   * **Validates: Requirements 3.5, 13.6**
   */
  it('should use exactly "000" as the General domain code', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        (totalPoints) => {
          const distribution = distributeExperiencePoints(totalPoints, []);
          return distribution[0].domainCode === '000';
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 5.7: General Domain Name Is Correct
   *
   * The General domain name must be "一般（未分類）".
   *
   * **Validates: Requirements 3.5, 13.6**
   */
  it('should use correct General domain name', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        (totalPoints) => {
          const distribution = distributeExperiencePoints(totalPoints, []);
          return distribution[0].domainName === '一般（未分類）';
        }
      ),
      { numRuns: 50 }
    );
  });

  // ===========================================================================
  // Edge Case Tests (Unit Tests)
  // ===========================================================================

  /**
   * Edge Case: Very Large Experience Points
   *
   * Test that large experience point values are correctly assigned to General.
   */
  it('should handle very large experience points', () => {
    const largePoints = 999999999;
    const distribution = distributeExperiencePoints(largePoints, []);

    expect(distribution.length).toBe(1);
    expect(distribution[0].domainCode).toBe(GENERAL_DOMAIN_CODE);
    expect(distribution[0].points).toBe(largePoints);
  });

  /**
   * Edge Case: Negative Experience Points
   *
   * Test behavior with negative points (should still assign to General).
   */
  it('should handle negative experience points', () => {
    const negativePoints = -100;
    const distribution = distributeExperiencePoints(negativePoints, []);

    expect(distribution.length).toBe(1);
    expect(distribution[0].domainCode).toBe(GENERAL_DOMAIN_CODE);
    expect(distribution[0].points).toBe(negativePoints);
  });

  /**
   * Edge Case: Fractional Experience Points
   *
   * Test behavior with fractional points (should be handled correctly).
   */
  it('should handle fractional experience points', () => {
    const fractionalPoints = 100.5;
    const distribution = distributeExperiencePoints(fractionalPoints, []);

    expect(distribution.length).toBe(1);
    expect(distribution[0].domainCode).toBe(GENERAL_DOMAIN_CODE);
    // Points should be the same as input (no rounding in this case)
    expect(distribution[0].points).toBe(fractionalPoints);
  });

  /**
   * Edge Case: Empty String in Domain Codes Array
   *
   * Test that empty strings in domain codes are treated as valid domains,
   * not triggering the General domain fallback.
   */
  it('should NOT fall back to General when domain codes contains empty string', () => {
    const distribution = distributeExperiencePoints(100, ['']);

    // Empty string is a valid domain code (even if unusual)
    expect(distribution.length).toBe(1);
    expect(distribution[0].domainCode).toBe('');
    expect(distribution[0].domainCode).not.toBe(GENERAL_DOMAIN_CODE);
  });

  /**
   * Edge Case: Consistency Across Multiple Calls
   *
   * Test that the same empty domain codes always produces the same result.
   */
  it('should be consistent across multiple calls', () => {
    const points = 500;

    const result1 = distributeExperiencePoints(points, []);
    const result2 = distributeExperiencePoints(points, []);
    const result3 = distributeExperiencePoints(points, []);

    expect(result1).toEqual(result2);
    expect(result2).toEqual(result3);
  });
});
