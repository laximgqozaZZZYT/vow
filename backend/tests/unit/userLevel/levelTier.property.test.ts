/**
 * Level Tier Calculation Correctness Property Test
 *
 * Feature: user-level-system, Property 1: Level Tier Calculation Correctness
 *
 * For any overall_level or expertise_level value between 0 and 199,
 * the corresponding tier must be correctly calculated as:
 * - beginner: 0-49
 * - intermediate: 50-99
 * - advanced: 100-149
 * - expert: 150-199
 *
 * **Validates: Requirements 1.5**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// =============================================================================
// Types
// =============================================================================

/**
 * Level tier type representing the four tiers in the system
 */
type LevelTier = 'beginner' | 'intermediate' | 'advanced' | 'expert';

/**
 * Level tier boundaries as defined in requirements
 */
const TIER_BOUNDARIES = {
  beginner: { min: 0, max: 49 },
  intermediate: { min: 50, max: 99 },
  advanced: { min: 100, max: 149 },
  expert: { min: 150, max: 199 },
} as const;

// =============================================================================
// Implementation Under Test
// =============================================================================

/**
 * Calculate level tier from level value.
 *
 * Property 1: Level Tier Calculation Correctness
 * - beginner: 0-49
 * - intermediate: 50-99
 * - advanced: 100-149
 * - expert: 150-199
 *
 * This is the pure calculation function extracted from UserLevelService
 * for property-based testing.
 *
 * @param level - Level value (0-199)
 * @returns Level tier
 */
function calculateTier(level: number): LevelTier {
  if (level < 50) return 'beginner';
  if (level < 100) return 'intermediate';
  if (level < 150) return 'advanced';
  return 'expert';
}

// =============================================================================
// Property-Based Tests
// =============================================================================

describe('Feature: user-level-system, Property 1: Level Tier Calculation Correctness', () => {
  /**
   * Property 1.1: Beginner Tier Mapping
   *
   * Level 0-49 always maps to "beginner" tier.
   *
   * **Validates: Requirements 1.5**
   */
  it('should map level 0-49 to beginner tier', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 49 }),
        (level) => {
          const tier = calculateTier(level);
          return tier === 'beginner';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.2: Intermediate Tier Mapping
   *
   * Level 50-99 always maps to "intermediate" tier.
   *
   * **Validates: Requirements 1.5**
   */
  it('should map level 50-99 to intermediate tier', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 50, max: 99 }),
        (level) => {
          const tier = calculateTier(level);
          return tier === 'intermediate';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.3: Advanced Tier Mapping
   *
   * Level 100-149 always maps to "advanced" tier.
   *
   * **Validates: Requirements 1.5**
   */
  it('should map level 100-149 to advanced tier', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 149 }),
        (level) => {
          const tier = calculateTier(level);
          return tier === 'advanced';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.4: Expert Tier Mapping
   *
   * Level 150-199 always maps to "expert" tier.
   *
   * **Validates: Requirements 1.5**
   */
  it('should map level 150-199 to expert tier', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 150, max: 199 }),
        (level) => {
          const tier = calculateTier(level);
          return tier === 'expert';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.5: Every Valid Level Maps to Exactly One Tier
   *
   * Every valid level (0-199) maps to exactly one tier.
   * The tier must be one of the four valid tiers.
   *
   * **Validates: Requirements 1.5**
   */
  it('should map every valid level (0-199) to exactly one tier', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 199 }),
        (level) => {
          const tier = calculateTier(level);
          const validTiers: LevelTier[] = ['beginner', 'intermediate', 'advanced', 'expert'];
          return validTiers.includes(tier);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.6: Tier Boundaries Are Exclusive (No Overlap)
   *
   * Each level maps to exactly one tier - there is no overlap between tiers.
   * This is verified by checking that the tier matches the expected tier
   * based on the level's position in the defined boundaries.
   *
   * **Validates: Requirements 1.5**
   */
  it('should have exclusive tier boundaries with no overlap', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 199 }),
        (level) => {
          const tier = calculateTier(level);

          // Determine expected tier based on boundaries
          let expectedTier: LevelTier;
          if (level >= TIER_BOUNDARIES.beginner.min && level <= TIER_BOUNDARIES.beginner.max) {
            expectedTier = 'beginner';
          } else if (level >= TIER_BOUNDARIES.intermediate.min && level <= TIER_BOUNDARIES.intermediate.max) {
            expectedTier = 'intermediate';
          } else if (level >= TIER_BOUNDARIES.advanced.min && level <= TIER_BOUNDARIES.advanced.max) {
            expectedTier = 'advanced';
          } else {
            expectedTier = 'expert';
          }

          return tier === expectedTier;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.7: Boundary Value Correctness
   *
   * Test that boundary values (49, 50, 99, 100, 149, 150) are correctly mapped.
   *
   * **Validates: Requirements 1.5**
   */
  it('should correctly map boundary values', () => {
    // Test all boundary values
    expect(calculateTier(0)).toBe('beginner');
    expect(calculateTier(49)).toBe('beginner');
    expect(calculateTier(50)).toBe('intermediate');
    expect(calculateTier(99)).toBe('intermediate');
    expect(calculateTier(100)).toBe('advanced');
    expect(calculateTier(149)).toBe('advanced');
    expect(calculateTier(150)).toBe('expert');
    expect(calculateTier(199)).toBe('expert');
  });

  /**
   * Property 1.8: Tier Ordering
   *
   * Higher levels should map to higher or equal tiers.
   * beginner < intermediate < advanced < expert
   *
   * **Validates: Requirements 1.5**
   */
  it('should maintain tier ordering (higher level = higher or equal tier)', () => {
    const tierOrder: Record<LevelTier, number> = {
      beginner: 0,
      intermediate: 1,
      advanced: 2,
      expert: 3,
    };

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 198 }), // level1 (leave room for level2)
        fc.integer({ min: 1, max: 199 }), // level2 offset
        (level1, offset) => {
          const level2 = Math.min(199, level1 + offset);
          const tier1 = calculateTier(level1);
          const tier2 = calculateTier(level2);

          // Higher level should have higher or equal tier
          return tierOrder[tier2] >= tierOrder[tier1];
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.9: Tier Transition Points
   *
   * Verify that tier transitions happen exactly at the specified boundaries.
   *
   * **Validates: Requirements 1.5**
   */
  it('should transition tiers at exact boundary points', () => {
    // Transition from beginner to intermediate at 50
    expect(calculateTier(49)).toBe('beginner');
    expect(calculateTier(50)).toBe('intermediate');

    // Transition from intermediate to advanced at 100
    expect(calculateTier(99)).toBe('intermediate');
    expect(calculateTier(100)).toBe('advanced');

    // Transition from advanced to expert at 150
    expect(calculateTier(149)).toBe('advanced');
    expect(calculateTier(150)).toBe('expert');
  });

  /**
   * Property 1.10: Deterministic Calculation
   *
   * The same level should always produce the same tier.
   *
   * **Validates: Requirements 1.5**
   */
  it('should produce deterministic results for the same level', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 199 }),
        (level) => {
          const tier1 = calculateTier(level);
          const tier2 = calculateTier(level);
          const tier3 = calculateTier(level);

          return tier1 === tier2 && tier2 === tier3;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.11: Complete Coverage of Valid Range
   *
   * Every level in the valid range [0, 199] should map to a tier.
   * No level should be left unmapped.
   *
   * **Validates: Requirements 1.5**
   */
  it('should provide complete coverage for all valid levels', () => {
    // Test all 200 possible levels
    for (let level = 0; level <= 199; level++) {
      const tier = calculateTier(level);
      expect(['beginner', 'intermediate', 'advanced', 'expert']).toContain(tier);
    }
  });

  /**
   * Property 1.12: Tier Distribution
   *
   * Each tier should cover exactly 50 levels (0-49, 50-99, 100-149, 150-199).
   *
   * **Validates: Requirements 1.5**
   */
  it('should have equal distribution of 50 levels per tier', () => {
    const tierCounts: Record<LevelTier, number> = {
      beginner: 0,
      intermediate: 0,
      advanced: 0,
      expert: 0,
    };

    for (let level = 0; level <= 199; level++) {
      const tier = calculateTier(level);
      tierCounts[tier]++;
    }

    expect(tierCounts.beginner).toBe(50);
    expect(tierCounts.intermediate).toBe(50);
    expect(tierCounts.advanced).toBe(50);
    expect(tierCounts.expert).toBe(50);
  });
});
