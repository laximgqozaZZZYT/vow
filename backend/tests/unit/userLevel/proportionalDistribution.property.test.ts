/**
 * Proportional Experience Distribution Property Test
 *
 * Feature: user-level-system, Property 6: Proportional Experience Distribution
 *
 * When a habit is mapped to multiple domains, experience points are distributed proportionally:
 * - If habit has N domains, each domain receives total_xp / N points
 * - Remainder points go to the first domain to ensure all points are distributed
 *
 * **Validates: Requirements 3.6, 6.4**
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
// Test Helpers
// =============================================================================

/**
 * Generate a valid domain code for testing.
 * Format: X-YY-ZZZ where X is A-K, YY is 01-99, ZZZ is 001-999
 */
const domainCodeArb = fc.tuple(
  fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'),
  fc.integer({ min: 1, max: 99 }),
  fc.integer({ min: 1, max: 999 })
).map(([major, middle, minor]) => 
  `${major}-${String(middle).padStart(2, '0')}-${String(minor).padStart(3, '0')}`
);

/**
 * Generate a unique array of domain codes.
 */
const uniqueDomainCodesArb = (minLength: number, maxLength: number) =>
  fc.uniqueArray(domainCodeArb, { minLength, maxLength });

// =============================================================================
// Property-Based Tests
// =============================================================================

describe('Feature: user-level-system, Property 6: Proportional Experience Distribution', () => {
  /**
   * Property 6.1: Sum of Distributed Points Equals Total Points
   *
   * For any total points and any number of domains, the sum of distributed
   * points must equal the total points (no points lost).
   *
   * **Validates: Requirements 3.6, 6.4**
   */
  it('should distribute all points without loss (sum equals total)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }), // total points
        uniqueDomainCodesArb(1, 10), // 1-10 unique domain codes
        (totalPoints, domainCodes) => {
          const distribution = distributeExperiencePoints(totalPoints, domainCodes);
          const sumOfPoints = distribution.reduce((sum, d) => sum + d.points, 0);
          return sumOfPoints === totalPoints;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.2: Each Domain Receives Approximately Equal Share
   *
   * For any distribution, each domain should receive approximately 1/N of the
   * total points, with a maximum difference of 1 point due to integer rounding.
   *
   * **Validates: Requirements 3.6, 6.4**
   */
  it('should distribute points approximately equally (within 1 point due to rounding)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }), // total points
        uniqueDomainCodesArb(2, 10), // 2-10 unique domain codes (need at least 2 for comparison)
        (totalPoints, domainCodes) => {
          const distribution = distributeExperiencePoints(totalPoints, domainCodes);
          const expectedPointsPerDomain = Math.floor(totalPoints / domainCodes.length);
          
          // All domains except possibly the first should have exactly expectedPointsPerDomain
          // The first domain may have up to (domainCodes.length - 1) extra points (remainder)
          for (let i = 0; i < distribution.length; i++) {
            const points = distribution[i].points;
            if (i === 0) {
              // First domain gets remainder, so it can have up to (N-1) extra points
              const maxRemainder = domainCodes.length - 1;
              if (points < expectedPointsPerDomain || points > expectedPointsPerDomain + maxRemainder) {
                return false;
              }
            } else {
              // Other domains should have exactly expectedPointsPerDomain
              if (points !== expectedPointsPerDomain) {
                return false;
              }
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.3: Single Domain Receives All Points
   *
   * When there is only one domain, it should receive all the points.
   *
   * **Validates: Requirements 3.6, 6.4**
   */
  it('should give all points to single domain', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }), // total points
        domainCodeArb, // single domain code
        (totalPoints, domainCode) => {
          const distribution = distributeExperiencePoints(totalPoints, [domainCode]);
          return (
            distribution.length === 1 &&
            distribution[0].points === totalPoints &&
            distribution[0].domainCode === domainCode &&
            distribution[0].proportion === 1.0
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.4: Empty Domain Array Falls Back to General Domain
   *
   * When the domain array is empty, all points should go to the General domain ("000").
   *
   * **Validates: Requirements 3.5, 6.4**
   */
  it('should fall back to General domain when domain array is empty', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }), // total points
        (totalPoints) => {
          const distribution = distributeExperiencePoints(totalPoints, []);
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
   * Property 6.5: Distribution Is Deterministic
   *
   * The same inputs should always produce the same output.
   *
   * **Validates: Requirements 3.6, 6.4**
   */
  it('should produce deterministic results for the same inputs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }), // total points
        uniqueDomainCodesArb(1, 10), // 1-10 unique domain codes
        (totalPoints, domainCodes) => {
          const distribution1 = distributeExperiencePoints(totalPoints, domainCodes);
          const distribution2 = distributeExperiencePoints(totalPoints, domainCodes);
          const distribution3 = distributeExperiencePoints(totalPoints, domainCodes);
          
          // Check that all distributions are identical
          if (distribution1.length !== distribution2.length || distribution2.length !== distribution3.length) {
            return false;
          }
          
          for (let i = 0; i < distribution1.length; i++) {
            if (
              distribution1[i].domainCode !== distribution2[i].domainCode ||
              distribution2[i].domainCode !== distribution3[i].domainCode ||
              distribution1[i].points !== distribution2[i].points ||
              distribution2[i].points !== distribution3[i].points ||
              distribution1[i].proportion !== distribution2[i].proportion ||
              distribution2[i].proportion !== distribution3[i].proportion
            ) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.6: Proportions Sum to 1.0
   *
   * The sum of all proportions should equal 1.0 (within floating point tolerance).
   *
   * **Validates: Requirements 3.6, 6.4**
   */
  it('should have proportions that sum to 1.0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }), // total points
        uniqueDomainCodesArb(1, 10), // 1-10 unique domain codes
        (totalPoints, domainCodes) => {
          const distribution = distributeExperiencePoints(totalPoints, domainCodes);
          const sumOfProportions = distribution.reduce((sum, d) => sum + d.proportion, 0);
          // Allow for floating point tolerance
          return Math.abs(sumOfProportions - 1.0) < 0.0001;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.7: Each Proportion Equals 1/N
   *
   * For N domains, each domain should have a proportion of exactly 1/N.
   *
   * **Validates: Requirements 3.6, 6.4**
   */
  it('should assign proportion of 1/N to each domain', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }), // total points
        uniqueDomainCodesArb(1, 10), // 1-10 unique domain codes
        (totalPoints, domainCodes) => {
          const distribution = distributeExperiencePoints(totalPoints, domainCodes);
          const expectedProportion = 1.0 / domainCodes.length;
          
          for (const d of distribution) {
            if (Math.abs(d.proportion - expectedProportion) > 0.0001) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.8: Domain Codes Are Preserved
   *
   * All input domain codes should appear in the output distribution.
   *
   * **Validates: Requirements 3.6, 6.4**
   */
  it('should preserve all input domain codes in output', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }), // total points
        uniqueDomainCodesArb(1, 10), // 1-10 unique domain codes
        (totalPoints, domainCodes) => {
          const distribution = distributeExperiencePoints(totalPoints, domainCodes);
          const outputCodes = new Set(distribution.map(d => d.domainCode));
          
          // Check that all input codes are in output
          for (const code of domainCodes) {
            if (!outputCodes.has(code)) {
              return false;
            }
          }
          
          // Check that output has same number of codes as input
          return distribution.length === domainCodes.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.9: Points Are Non-Negative Integers
   *
   * All distributed points should be non-negative integers.
   *
   * **Validates: Requirements 3.6, 6.4**
   */
  it('should distribute non-negative integer points', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }), // total points (including 0)
        uniqueDomainCodesArb(1, 10), // 1-10 unique domain codes
        (totalPoints, domainCodes) => {
          const distribution = distributeExperiencePoints(totalPoints, domainCodes);
          
          for (const d of distribution) {
            if (!Number.isInteger(d.points) || d.points < 0) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.10: Remainder Goes to First Domain
   *
   * When total points don't divide evenly, the remainder should go to the first domain.
   *
   * **Validates: Requirements 3.6, 6.4**
   */
  it('should give remainder points to the first domain', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }), // total points
        uniqueDomainCodesArb(2, 10), // 2-10 unique domain codes (need at least 2 for remainder)
        (totalPoints, domainCodes) => {
          const distribution = distributeExperiencePoints(totalPoints, domainCodes);
          const expectedPointsPerDomain = Math.floor(totalPoints / domainCodes.length);
          const expectedRemainder = totalPoints % domainCodes.length;
          
          // First domain should have base points + remainder
          const firstDomainPoints = distribution[0].points;
          const expectedFirstDomainPoints = expectedPointsPerDomain + expectedRemainder;
          
          return firstDomainPoints === expectedFirstDomainPoints;
        }
      ),
      { numRuns: 100 }
    );
  });

  // ===========================================================================
  // Edge Case Tests (Unit Tests)
  // ===========================================================================

  /**
   * Edge Case: Zero Total Points
   *
   * When total points is 0, all domains should receive 0 points.
   */
  it('should handle zero total points correctly', () => {
    const distribution = distributeExperiencePoints(0, ['A-01-001', 'B-02-002']);
    expect(distribution.length).toBe(2);
    expect(distribution[0].points).toBe(0);
    expect(distribution[1].points).toBe(0);
    expect(distribution.reduce((sum, d) => sum + d.points, 0)).toBe(0);
  });

  /**
   * Edge Case: Null Domain Codes Array
   *
   * When domain codes is null/undefined, should fall back to General domain.
   */
  it('should handle null domain codes array', () => {
    // @ts-expect-error Testing null input
    const distribution = distributeExperiencePoints(100, null);
    expect(distribution.length).toBe(1);
    expect(distribution[0].domainCode).toBe(GENERAL_DOMAIN_CODE);
    expect(distribution[0].points).toBe(100);
  });

  /**
   * Edge Case: Undefined Domain Codes Array
   *
   * When domain codes is undefined, should fall back to General domain.
   */
  it('should handle undefined domain codes array', () => {
    // @ts-expect-error Testing undefined input
    const distribution = distributeExperiencePoints(100, undefined);
    expect(distribution.length).toBe(1);
    expect(distribution[0].domainCode).toBe(GENERAL_DOMAIN_CODE);
    expect(distribution[0].points).toBe(100);
  });

  /**
   * Edge Case: Large Number of Domains
   *
   * Test distribution with many domains.
   */
  it('should handle large number of domains correctly', () => {
    const domainCodes = Array.from({ length: 50 }, (_, i) => 
      `B-${String(i + 1).padStart(2, '0')}-001`
    );
    const totalPoints = 1000;
    const distribution = distributeExperiencePoints(totalPoints, domainCodes);
    
    expect(distribution.length).toBe(50);
    expect(distribution.reduce((sum, d) => sum + d.points, 0)).toBe(totalPoints);
    
    // Each domain should get 20 points (1000 / 50 = 20, no remainder)
    for (const d of distribution) {
      expect(d.points).toBe(20);
    }
  });

  /**
   * Edge Case: Points Less Than Number of Domains
   *
   * When total points is less than number of domains, some domains get 0.
   */
  it('should handle points less than number of domains', () => {
    const domainCodes = ['A-01-001', 'B-02-002', 'C-03-003', 'D-04-004', 'E-05-005'];
    const totalPoints = 3;
    const distribution = distributeExperiencePoints(totalPoints, domainCodes);
    
    expect(distribution.length).toBe(5);
    expect(distribution.reduce((sum, d) => sum + d.points, 0)).toBe(totalPoints);
    
    // First domain gets all 3 points (0 + 3 remainder), others get 0
    expect(distribution[0].points).toBe(3);
    expect(distribution[1].points).toBe(0);
    expect(distribution[2].points).toBe(0);
    expect(distribution[3].points).toBe(0);
    expect(distribution[4].points).toBe(0);
  });

  /**
   * Edge Case: Exact Division
   *
   * When points divide evenly, all domains should get equal points.
   */
  it('should distribute evenly when points divide exactly', () => {
    const domainCodes = ['A-01-001', 'B-02-002', 'C-03-003'];
    const totalPoints = 300;
    const distribution = distributeExperiencePoints(totalPoints, domainCodes);
    
    expect(distribution.length).toBe(3);
    expect(distribution[0].points).toBe(100);
    expect(distribution[1].points).toBe(100);
    expect(distribution[2].points).toBe(100);
  });

  /**
   * Edge Case: Domain Names Map
   *
   * Test that domain names are correctly applied from the map.
   */
  it('should use domain names from provided map', () => {
    const domainCodes = ['A-01-001', 'B-02-002'];
    const domainNames = new Map([
      ['A-01-001', 'テストドメイン1'],
      ['B-02-002', 'テストドメイン2'],
    ]);
    const distribution = distributeExperiencePoints(100, domainCodes, domainNames);
    
    expect(distribution[0].domainName).toBe('テストドメイン1');
    expect(distribution[1].domainName).toBe('テストドメイン2');
  });

  /**
   * Edge Case: Missing Domain Names in Map
   *
   * When domain name is not in map, should use domain code as fallback.
   */
  it('should use domain code as fallback when name not in map', () => {
    const domainCodes = ['A-01-001', 'B-02-002'];
    const domainNames = new Map([
      ['A-01-001', 'テストドメイン1'],
      // B-02-002 is not in the map
    ]);
    const distribution = distributeExperiencePoints(100, domainCodes, domainNames);
    
    expect(distribution[0].domainName).toBe('テストドメイン1');
    expect(distribution[1].domainName).toBe('B-02-002'); // Falls back to code
  });
});
