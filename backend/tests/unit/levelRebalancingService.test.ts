/**
 * LevelRebalancingService Unit Tests
 *
 * Tests for the Level Rebalancing Service that implements new level calculation
 * formulas for the Level System Rebalancing feature.
 *
 * **Validates: Requirements 1.1, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1-3.6**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  LevelRebalancingService,
  createLevelRebalancingService,
  calculateExpertiseLevel,
  calculateBaseXP,
  getXPMultiplier,
  calculateTier,
  calculateXPForLevel,
  calculateDailyXP,
  simulateProgression,
  type XPMultiplierResult,
  type SimulationParams,
  type LevelTier,
} from '@/services/levelRebalancingService';
import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// Mock Supabase Client Factory
// ============================================================================

function createMockSupabaseClient(): SupabaseClient {
  const mockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
  };

  mockQueryBuilder.order.mockResolvedValue({ data: [], error: null });
  mockQueryBuilder.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

  return {
    from: vi.fn().mockReturnValue(mockQueryBuilder),
  } as unknown as SupabaseClient;
}


// ============================================================================
// calculateExpertiseLevel Tests
// Validates: Requirements 1.1, 1.6
// ============================================================================

describe('calculateExpertiseLevel', () => {
  /**
   * **Validates: Requirement 1.1**
   * New formula: min(9999, floor(5 * log2(xp/1000 + 1)))
   */
  describe('basic calculations', () => {
    it('should return 0 for 0 XP', () => {
      expect(calculateExpertiseLevel(0)).toBe(0);
    });

    it('should return 0 for negative XP', () => {
      expect(calculateExpertiseLevel(-100)).toBe(0);
      expect(calculateExpertiseLevel(-1)).toBe(0);
    });

    it('should return 0 for very small XP values', () => {
      // log2(1/1000 + 1) ≈ 0.00144, floor(5 * 0.00144) = 0
      expect(calculateExpertiseLevel(1)).toBe(0);
      expect(calculateExpertiseLevel(100)).toBe(0);
    });

    it('should calculate level correctly for 1000 XP', () => {
      // log2(1000/1000 + 1) = log2(2) = 1, floor(5 * 1) = 5
      expect(calculateExpertiseLevel(1000)).toBe(5);
    });

    it('should calculate level correctly for 3000 XP', () => {
      // log2(3000/1000 + 1) = log2(4) = 2, floor(5 * 2) = 10
      expect(calculateExpertiseLevel(3000)).toBe(10);
    });

    it('should calculate level correctly for 7000 XP', () => {
      // log2(7000/1000 + 1) = log2(8) = 3, floor(5 * 3) = 15
      expect(calculateExpertiseLevel(7000)).toBe(15);
    });

    it('should calculate level correctly for 15000 XP', () => {
      // log2(15000/1000 + 1) = log2(16) = 4, floor(5 * 4) = 20
      expect(calculateExpertiseLevel(15000)).toBe(20);
    });
  });

  describe('tier boundary levels', () => {
    it('should reach intermediate tier (50) at appropriate XP', () => {
      // Level 50 requires: 1000 * (2^(50/5) - 1) = 1000 * (2^10 - 1) = 1,023,000 XP
      const xpForLevel50 = calculateXPForLevel(50);
      expect(calculateExpertiseLevel(xpForLevel50)).toBe(50);
    });

    it('should reach advanced tier (100) at appropriate XP', () => {
      // Level 100 requires: 1000 * (2^(100/5) - 1) = 1000 * (2^20 - 1) ≈ 1,048,575,000 XP
      const xpForLevel100 = calculateXPForLevel(100);
      expect(calculateExpertiseLevel(xpForLevel100)).toBe(100);
    });
  });

  describe('maximum level cap', () => {
    it('should cap at 9999 for extremely large XP', () => {
      // Calculate XP needed for level 9999: 1000 * (2^(9999/5) - 1)
      // This is astronomically large, so we test with a value that would exceed 9999
      // For practical purposes, test that the cap works
      const xpForMax = calculateXPForLevel(9999);
      expect(calculateExpertiseLevel(xpForMax)).toBe(9999);
      // Any XP beyond this should still be capped at 9999
      expect(calculateExpertiseLevel(xpForMax * 2)).toBe(9999);
    });

    it('should not exceed 9999', () => {
      // Even with very large XP, level should be capped
      const level = calculateExpertiseLevel(Number.MAX_SAFE_INTEGER);
      expect(level).toBeLessThanOrEqual(9999);
    });

    it('should handle large but realistic XP values', () => {
      // Test with large but realistic values
      const level = calculateExpertiseLevel(1_000_000_000); // 1 billion XP
      expect(level).toBeGreaterThan(0);
      expect(level).toBeLessThanOrEqual(9999);
    });
  });
});


// ============================================================================
// calculateBaseXP Tests
// Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
// ============================================================================

describe('calculateBaseXP', () => {
  /**
   * **Validates: Requirement 2.1**
   * Base XP = floor(habit_level * 2)
   */
  describe('base XP calculation', () => {
    it('should calculate base XP as habit_level * 2', () => {
      expect(calculateBaseXP(50, 0)).toBe(100); // 50 * 2 = 100
      expect(calculateBaseXP(25, 0)).toBe(50);  // 25 * 2 = 50
      expect(calculateBaseXP(100, 0)).toBe(100); // 100 * 2 = 200, but capped at 100
    });

    it('should floor the result', () => {
      expect(calculateBaseXP(33, 0)).toBe(66); // 33 * 2 = 66
      expect(calculateBaseXP(17, 0)).toBe(34); // 17 * 2 = 34
    });
  });

  /**
   * **Validates: Requirement 2.2**
   * Streak bonus = min(streak_days, 30)
   */
  describe('streak bonus calculation', () => {
    it('should add streak days as bonus (up to 30)', () => {
      expect(calculateBaseXP(25, 10)).toBe(60); // 50 + 10 = 60
      expect(calculateBaseXP(25, 20)).toBe(70); // 50 + 20 = 70
      expect(calculateBaseXP(25, 30)).toBe(80); // 50 + 30 = 80
    });

    it('should cap streak bonus at 30', () => {
      expect(calculateBaseXP(25, 50)).toBe(80);  // 50 + 30 (capped) = 80
      expect(calculateBaseXP(25, 100)).toBe(80); // 50 + 30 (capped) = 80
    });

    it('should handle 0 streak days', () => {
      expect(calculateBaseXP(50, 0)).toBe(100); // 100 + 0 = 100
    });

    it('should handle negative streak days as 0', () => {
      expect(calculateBaseXP(25, -5)).toBe(50); // 50 + 0 = 50
    });
  });

  /**
   * **Validates: Requirement 2.3**
   * Default habit level = 25 when NULL
   */
  describe('default habit level', () => {
    it('should use default level 25 when habit_level is null', () => {
      expect(calculateBaseXP(null, 0)).toBe(50);  // 25 * 2 = 50
      expect(calculateBaseXP(null, 10)).toBe(60); // 50 + 10 = 60
    });
  });

  /**
   * **Validates: Requirement 2.5**
   * Daily XP cap per habit = 100
   */
  describe('daily XP cap', () => {
    it('should cap total XP at 100 per habit', () => {
      // High level habit: 100 * 2 = 200, but capped at 100
      expect(calculateBaseXP(100, 0)).toBe(100);
      // High level + streak: 100 * 2 + 30 = 230, but capped at 100
      expect(calculateBaseXP(100, 30)).toBe(100);
      // Level 50 + streak 30: 100 + 30 = 130, but capped at 100
      expect(calculateBaseXP(50, 30)).toBe(100);
    });

    it('should not cap when under 100', () => {
      expect(calculateBaseXP(25, 0)).toBe(50);  // 50 < 100
      expect(calculateBaseXP(30, 10)).toBe(70); // 60 + 10 = 70 < 100
    });
  });
});


// ============================================================================
// getXPMultiplier Tests
// Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
// ============================================================================

describe('getXPMultiplier', () => {
  /**
   * **Validates: Requirement 3.1**
   * 0-49% completion → 0.2x multiplier
   */
  describe('minimal tier (0-49%)', () => {
    it('should return 0.2x for 0% completion', () => {
      const result = getXPMultiplier(0);
      expect(result.multiplier).toBe(0.2);
      expect(result.tier).toBe('minimal');
      expect(result.reason).toBe('completion_under_50');
    });

    it('should return 0.2x for 25% completion', () => {
      const result = getXPMultiplier(25);
      expect(result.multiplier).toBe(0.2);
      expect(result.tier).toBe('minimal');
    });

    it('should return 0.2x for 49% completion', () => {
      const result = getXPMultiplier(49);
      expect(result.multiplier).toBe(0.2);
      expect(result.tier).toBe('minimal');
    });

    it('should return 0.2x for negative completion', () => {
      const result = getXPMultiplier(-10);
      expect(result.multiplier).toBe(0.2);
      expect(result.tier).toBe('minimal');
    });
  });

  /**
   * **Validates: Requirement 3.2**
   * 50-79% completion → 0.5x multiplier
   */
  describe('partial tier (50-79%)', () => {
    it('should return 0.5x for 50% completion', () => {
      const result = getXPMultiplier(50);
      expect(result.multiplier).toBe(0.5);
      expect(result.tier).toBe('partial');
      expect(result.reason).toBe('completion_50_79');
    });

    it('should return 0.5x for 65% completion', () => {
      const result = getXPMultiplier(65);
      expect(result.multiplier).toBe(0.5);
      expect(result.tier).toBe('partial');
    });

    it('should return 0.5x for 79% completion', () => {
      const result = getXPMultiplier(79);
      expect(result.multiplier).toBe(0.5);
      expect(result.tier).toBe('partial');
    });
  });

  /**
   * **Validates: Requirement 3.3**
   * 80-99% completion → 0.8x multiplier
   */
  describe('near_complete tier (80-99%)', () => {
    it('should return 0.8x for 80% completion', () => {
      const result = getXPMultiplier(80);
      expect(result.multiplier).toBe(0.8);
      expect(result.tier).toBe('near_complete');
      expect(result.reason).toBe('completion_80_99');
    });

    it('should return 0.8x for 90% completion', () => {
      const result = getXPMultiplier(90);
      expect(result.multiplier).toBe(0.8);
      expect(result.tier).toBe('near_complete');
    });

    it('should return 0.8x for 99% completion', () => {
      const result = getXPMultiplier(99);
      expect(result.multiplier).toBe(0.8);
      expect(result.tier).toBe('near_complete');
    });
  });

  /**
   * **Validates: Requirement 3.4**
   * 100-120% completion → 1.0x multiplier (optimal)
   */
  describe('optimal tier (100-120%)', () => {
    it('should return 1.0x for 100% completion', () => {
      const result = getXPMultiplier(100);
      expect(result.multiplier).toBe(1.0);
      expect(result.tier).toBe('optimal');
      expect(result.reason).toBe('completion_100_120');
    });

    it('should return 1.0x for 110% completion', () => {
      const result = getXPMultiplier(110);
      expect(result.multiplier).toBe(1.0);
      expect(result.tier).toBe('optimal');
    });

    it('should return 1.0x for 120% completion', () => {
      const result = getXPMultiplier(120);
      expect(result.multiplier).toBe(1.0);
      expect(result.tier).toBe('optimal');
    });
  });

  /**
   * **Validates: Requirement 3.5**
   * 121-150% completion → 0.85x multiplier
   */
  describe('over_achieve tier (121-150%)', () => {
    it('should return 0.85x for 121% completion', () => {
      const result = getXPMultiplier(121);
      expect(result.multiplier).toBe(0.85);
      expect(result.tier).toBe('over_achieve');
      expect(result.reason).toBe('completion_121_150');
    });

    it('should return 0.85x for 135% completion', () => {
      const result = getXPMultiplier(135);
      expect(result.multiplier).toBe(0.85);
      expect(result.tier).toBe('over_achieve');
    });

    it('should return 0.85x for 150% completion', () => {
      const result = getXPMultiplier(150);
      expect(result.multiplier).toBe(0.85);
      expect(result.tier).toBe('over_achieve');
    });
  });

  /**
   * **Validates: Requirement 3.6**
   * 151%+ completion → 0.6x multiplier
   */
  describe('burnout_risk tier (151%+)', () => {
    it('should return 0.6x for 151% completion', () => {
      const result = getXPMultiplier(151);
      expect(result.multiplier).toBe(0.6);
      expect(result.tier).toBe('burnout_risk');
      expect(result.reason).toBe('completion_over_150');
    });

    it('should return 0.6x for 200% completion', () => {
      const result = getXPMultiplier(200);
      expect(result.multiplier).toBe(0.6);
      expect(result.tier).toBe('burnout_risk');
    });

    it('should return 0.6x for 500% completion', () => {
      const result = getXPMultiplier(500);
      expect(result.multiplier).toBe(0.6);
      expect(result.tier).toBe('burnout_risk');
    });
  });
});


// ============================================================================
// calculateTier Tests
// Validates: Requirement 1.6
// ============================================================================

describe('calculateTier', () => {
  /**
   * **Validates: Requirement 1.6**
   * New tier boundaries: beginner (0-49), intermediate (50-99),
   * advanced (100-499), expert (500-9999)
   */
  describe('tier boundaries', () => {
    it('should return beginner for levels 0-49', () => {
      expect(calculateTier(0)).toBe('beginner');
      expect(calculateTier(25)).toBe('beginner');
      expect(calculateTier(49)).toBe('beginner');
    });

    it('should return intermediate for levels 50-99', () => {
      expect(calculateTier(50)).toBe('intermediate');
      expect(calculateTier(75)).toBe('intermediate');
      expect(calculateTier(99)).toBe('intermediate');
    });

    it('should return advanced for levels 100-499', () => {
      expect(calculateTier(100)).toBe('advanced');
      expect(calculateTier(250)).toBe('advanced');
      expect(calculateTier(499)).toBe('advanced');
    });

    it('should return expert for levels 500-9999', () => {
      expect(calculateTier(500)).toBe('expert');
      expect(calculateTier(1000)).toBe('expert');
      expect(calculateTier(9999)).toBe('expert');
    });
  });
});

// ============================================================================
// calculateXPForLevel Tests
// ============================================================================

describe('calculateXPForLevel', () => {
  it('should return 0 for level 0', () => {
    expect(calculateXPForLevel(0)).toBe(0);
  });

  it('should return 0 for negative levels', () => {
    expect(calculateXPForLevel(-5)).toBe(0);
  });

  it('should calculate XP correctly for level 5', () => {
    // XP = 1000 * (2^(5/5) - 1) = 1000 * (2 - 1) = 1000
    expect(calculateXPForLevel(5)).toBe(1000);
  });

  it('should calculate XP correctly for level 10', () => {
    // XP = 1000 * (2^(10/5) - 1) = 1000 * (4 - 1) = 3000
    expect(calculateXPForLevel(10)).toBe(3000);
  });

  it('should calculate XP correctly for level 15', () => {
    // XP = 1000 * (2^(15/5) - 1) = 1000 * (8 - 1) = 7000
    expect(calculateXPForLevel(15)).toBe(7000);
  });

  it('should be inverse of calculateExpertiseLevel', () => {
    // For exact power-of-2 levels, the functions should be inverses
    const xpFor10 = calculateXPForLevel(10);
    expect(calculateExpertiseLevel(xpFor10)).toBe(10);

    const xpFor20 = calculateXPForLevel(20);
    expect(calculateExpertiseLevel(xpFor20)).toBe(20);
  });
});


// ============================================================================
// calculateDailyXP Tests
// ============================================================================

describe('calculateDailyXP', () => {
  it('should calculate daily XP based on habits and multiplier', () => {
    const params: SimulationParams = {
      currentXP: 0,
      dailyHabits: 3,
      averageHabitLevel: 50,
      streakDays: 0,
      completionRate: 100, // optimal multiplier = 1.0
    };

    // Base XP per habit: 50 * 2 = 100 (capped at 100)
    // Multiplier: 1.0
    // Daily XP: 100 * 1.0 * 3 = 300
    expect(calculateDailyXP(params)).toBe(300);
  });

  it('should apply multiplier correctly', () => {
    const params: SimulationParams = {
      currentXP: 0,
      dailyHabits: 2,
      averageHabitLevel: 25,
      streakDays: 0,
      completionRate: 50, // partial multiplier = 0.5
    };

    // Base XP per habit: 25 * 2 = 50
    // Multiplier: 0.5
    // Daily XP: floor(50 * 0.5) * 2 = 25 * 2 = 50
    expect(calculateDailyXP(params)).toBe(50);
  });

  it('should include streak bonus', () => {
    const params: SimulationParams = {
      currentXP: 0,
      dailyHabits: 1,
      averageHabitLevel: 25,
      streakDays: 20,
      completionRate: 100,
    };

    // Base XP: 25 * 2 + 20 = 70
    // Multiplier: 1.0
    // Daily XP: 70 * 1.0 * 1 = 70
    expect(calculateDailyXP(params)).toBe(70);
  });
});

// ============================================================================
// simulateProgression Tests
// Validates: Requirement 7.2
// ============================================================================

describe('simulateProgression', () => {
  /**
   * **Validates: Requirement 7.2**
   * Simulate level progression at various time points
   */
  it('should calculate current level from currentXP', () => {
    const params: SimulationParams = {
      currentXP: 3000, // Level 10
      dailyHabits: 1,
      averageHabitLevel: 25,
      streakDays: 0,
      completionRate: 100,
    };

    const result = simulateProgression(params);
    expect(result.currentLevel).toBe(10);
  });

  it('should project increasing levels over time', () => {
    const params: SimulationParams = {
      currentXP: 0,
      dailyHabits: 3,
      averageHabitLevel: 50,
      streakDays: 0,
      completionRate: 100,
    };

    const result = simulateProgression(params);

    // Projections should be monotonically increasing
    expect(result.projections.oneWeek).toBeGreaterThanOrEqual(result.currentLevel);
    expect(result.projections.oneMonth).toBeGreaterThanOrEqual(result.projections.oneWeek);
    expect(result.projections.threeMonths).toBeGreaterThanOrEqual(result.projections.oneMonth);
    expect(result.projections.sixMonths).toBeGreaterThanOrEqual(result.projections.threeMonths);
    expect(result.projections.oneYear).toBeGreaterThanOrEqual(result.projections.sixMonths);
    expect(result.projections.twoYears).toBeGreaterThanOrEqual(result.projections.oneYear);
  });

  it('should calculate tier milestones', () => {
    const params: SimulationParams = {
      currentXP: 0,
      dailyHabits: 3,
      averageHabitLevel: 50,
      streakDays: 0,
      completionRate: 100,
    };

    const result = simulateProgression(params);

    // Milestones should have XP requirements
    expect(result.tierMilestones.intermediate.xpRequired).toBeGreaterThan(0);
    expect(result.tierMilestones.advanced.xpRequired).toBeGreaterThan(result.tierMilestones.intermediate.xpRequired);
    expect(result.tierMilestones.expert.xpRequired).toBeGreaterThan(result.tierMilestones.advanced.xpRequired);

    // Estimated days should be positive
    expect(result.tierMilestones.intermediate.estimatedDays).toBeGreaterThan(0);
    expect(result.tierMilestones.advanced.estimatedDays).toBeGreaterThan(result.tierMilestones.intermediate.estimatedDays);
  });

  it('should return 0 estimated days for already reached tiers', () => {
    const params: SimulationParams = {
      currentXP: calculateXPForLevel(100), // Already at advanced tier
      dailyHabits: 1,
      averageHabitLevel: 25,
      streakDays: 0,
      completionRate: 100,
    };

    const result = simulateProgression(params);

    expect(result.tierMilestones.intermediate.estimatedDays).toBe(0);
    expect(result.tierMilestones.advanced.estimatedDays).toBe(0);
  });
});


// ============================================================================
// LevelRebalancingService Class Tests
// ============================================================================

describe('LevelRebalancingService', () => {
  let service: LevelRebalancingService;
  let mockClient: SupabaseClient;

  beforeEach(() => {
    mockClient = createMockSupabaseClient();
    service = new LevelRebalancingService(mockClient);
  });

  describe('createLevelRebalancingService', () => {
    it('should create a LevelRebalancingService instance', () => {
      const instance = createLevelRebalancingService(mockClient);
      expect(instance).toBeInstanceOf(LevelRebalancingService);
    });
  });

  describe('calculateExpertiseLevel', () => {
    it('should delegate to pure function', () => {
      expect(service.calculateExpertiseLevel(1000)).toBe(5);
      expect(service.calculateExpertiseLevel(0)).toBe(0);
    });
  });

  describe('calculateBaseXP', () => {
    it('should delegate to pure function', () => {
      expect(service.calculateBaseXP(50, 0)).toBe(100);
      expect(service.calculateBaseXP(null, 10)).toBe(60);
    });
  });

  describe('getXPMultiplier', () => {
    it('should delegate to pure function', () => {
      const result = service.getXPMultiplier(100);
      expect(result.multiplier).toBe(1.0);
      expect(result.tier).toBe('optimal');
    });
  });

  describe('calculateTier', () => {
    it('should delegate to pure function', () => {
      expect(service.calculateTier(25)).toBe('beginner');
      expect(service.calculateTier(75)).toBe('intermediate');
      expect(service.calculateTier(250)).toBe('advanced');
      expect(service.calculateTier(750)).toBe('expert');
    });
  });

  describe('calculateTotalXP', () => {
    it('should combine base XP with multiplier', () => {
      const result = service.calculateTotalXP(50, 0, 100);
      
      expect(result.baseXP).toBe(100);
      expect(result.multiplier).toBe(1.0);
      expect(result.totalXP).toBe(100);
      expect(result.tier).toBe('optimal');
    });

    it('should apply partial multiplier correctly', () => {
      const result = service.calculateTotalXP(25, 0, 50);
      
      expect(result.baseXP).toBe(50);
      expect(result.multiplier).toBe(0.5);
      expect(result.totalXP).toBe(25); // floor(50 * 0.5)
      expect(result.tier).toBe('partial');
    });

    it('should handle null habit level', () => {
      const result = service.calculateTotalXP(null, 10, 100);
      
      expect(result.baseXP).toBe(60); // 25 * 2 + 10
      expect(result.totalXP).toBe(60);
    });
  });

  describe('getXPForLevel', () => {
    it('should return XP required for target level', () => {
      expect(service.getXPForLevel(5)).toBe(1000);
      expect(service.getXPForLevel(10)).toBe(3000);
    });
  });

  describe('getTierBoundaries', () => {
    it('should return tier boundaries configuration', () => {
      const boundaries = service.getTierBoundaries();
      
      expect(boundaries.beginner).toEqual({ min: 0, max: 49 });
      expect(boundaries.intermediate).toEqual({ min: 50, max: 99 });
      expect(boundaries.advanced).toEqual({ min: 100, max: 499 });
      expect(boundaries.expert).toEqual({ min: 500, max: 9999 });
    });
  });

  describe('simulateProgression', () => {
    it('should delegate to pure function', () => {
      const params: SimulationParams = {
        currentXP: 0,
        dailyHabits: 1,
        averageHabitLevel: 25,
        streakDays: 0,
        completionRate: 100,
      };

      const result = service.simulateProgression(params);
      
      expect(result.currentLevel).toBe(0);
      expect(result.projections).toBeDefined();
      expect(result.tierMilestones).toBeDefined();
    });
  });
});
