/**
 * Level Rebalancing Service
 *
 * Implements the new level calculation formulas for the Level System Rebalancing feature.
 * This service provides:
 * - New expertise level calculation: min(9999, floor(5 * log2(xp/1000 + 1)))
 * - New base XP calculation: floor(habit_level * 2) + min(streak, 30)
 * - New XP multiplier tiers based on completion rate
 * - Level progression simulation
 *
 * Requirements: 1.1, 2.1, 2.2, 3.1-3.6
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getLogger } from '../utils/logger.js';
import {
  LevelConfigService,
  type LevelConfig,
  type TierBoundaries,
} from './levelConfigService.js';

const logger = getLogger('levelRebalancingService');

// =============================================================================
// Types
// =============================================================================

/**
 * XP Multiplier tier names
 */
export type XPMultiplierTier =
  | 'minimal'
  | 'partial'
  | 'near_complete'
  | 'optimal'
  | 'over_achieve'
  | 'burnout_risk';

/**
 * XP Multiplier result with tier information
 */
export interface XPMultiplierResult {
  /** The multiplier value (0.2 - 1.0) */
  multiplier: number;
  /** The tier classification */
  tier: XPMultiplierTier;
  /** Reason key for the multiplier */
  reason: string;
}

/**
 * Level tier names
 */
export type LevelTier = 'beginner' | 'intermediate' | 'advanced' | 'expert';

/**
 * Simulation parameters
 */
export interface SimulationParams {
  /** Current total experience points */
  currentXP: number;
  /** Number of habits completed daily */
  dailyHabits: number;
  /** Average habit difficulty level (0-199) */
  averageHabitLevel: number;
  /** Current streak in days */
  streakDays: number;
  /** Completion rate percentage (0-500) */
  completionRate: number;
}

/**
 * Tier milestone information
 */
export interface TierMilestone {
  /** XP required to reach this tier */
  xpRequired: number;
  /** Estimated days to reach this tier */
  estimatedDays: number;
}

/**
 * Simulation result
 */
export interface SimulationResult {
  /** Current level based on currentXP */
  currentLevel: number;
  /** Projected levels at various time points */
  projections: {
    oneWeek: number;
    oneMonth: number;
    threeMonths: number;
    sixMonths: number;
    oneYear: number;
    twoYears: number;
  };
  /** Milestones for each tier */
  tierMilestones: {
    intermediate: TierMilestone;
    advanced: TierMilestone;
    expert: TierMilestone;
    max: TierMilestone;
  };
}

// =============================================================================
// Constants - Default Values
// =============================================================================

/** Default habit level when not assessed (THLI-24) */
const DEFAULT_HABIT_LEVEL = 25;

/** Multiplier for base XP calculation (new: 2, was: 10) */
const BASE_XP_MULTIPLIER = 2;

/** Maximum streak bonus (new: 30, was: 50) */
const MAX_STREAK_BONUS = 30;

/** Daily XP cap per habit */
const DAILY_XP_CAP_PER_HABIT = 100;

/** Divisor for expertise level calculation (new: 1000, was: 100) */
const EXPERTISE_LEVEL_DIVISOR = 1000;

/** Multiplier for expertise level calculation (new: 5, was: 10) */
const EXPERTISE_LEVEL_MULTIPLIER = 5;

/** Maximum expertise level (new: 9999, was: 199) */
const MAX_EXPERTISE_LEVEL = 9999;

/** Default tier boundaries */
const DEFAULT_TIER_BOUNDARIES: TierBoundaries = {
  beginner: { min: 0, max: 49 },
  intermediate: { min: 50, max: 99 },
  advanced: { min: 100, max: 499 },
  expert: { min: 500, max: 9999 },
};

// =============================================================================
// Pure Calculation Functions (Exported for Testing)
// =============================================================================

/**
 * Calculate expertise level from experience points using the new formula.
 *
 * New Formula: min(9999, floor(5 * log2(xp / 1000 + 1)))
 * Old Formula: min(199, floor(10 * log2(xp / 100 + 1)))
 *
 * Property 1: Level Calculation Correctness
 * Validates: Requirements 1.1, 1.6
 *
 * @param experiencePoints - Total accumulated experience points
 * @returns Expertise level (0-9999)
 */
export function calculateExpertiseLevel(experiencePoints: number): number {
  if (experiencePoints <= 0) {
    return 0;
  }

  // New formula: min(9999, floor(5 * log2(xp / 1000 + 1)))
  const rawLevel = Math.floor(
    EXPERTISE_LEVEL_MULTIPLIER * Math.log2(experiencePoints / EXPERTISE_LEVEL_DIVISOR + 1)
  );

  // Clamp to valid range [0, 9999]
  return Math.min(MAX_EXPERTISE_LEVEL, Math.max(0, rawLevel));
}

/**
 * Calculate base XP from habit completion using the new formula.
 *
 * New Formula: floor(habit_level * 2) + min(streak_days, 30)
 * Old Formula: (habit_level * 10) + min(streak_days * 2, 50)
 *
 * Property 2: XP Calculation Correctness
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4
 *
 * @param habitLevel - Habit difficulty level (THLI-24), null uses default 25
 * @param streakDays - Current streak in days
 * @returns Base XP before multiplier (capped at 100 per habit)
 */
export function calculateBaseXP(
  habitLevel: number | null,
  streakDays: number
): number {
  // Use default level if not assessed (Requirement 2.3)
  const level = habitLevel ?? DEFAULT_HABIT_LEVEL;

  // Calculate base XP: floor(habit_level * 2) (Requirement 2.1)
  const baseXP = Math.floor(level * BASE_XP_MULTIPLIER);

  // Calculate streak bonus: min(streak_days, 30) (Requirement 2.2)
  const streakBonus = Math.min(Math.max(0, streakDays), MAX_STREAK_BONUS);

  // Total XP = base_xp + streak_bonus (Requirement 2.4)
  const totalXP = baseXP + streakBonus;

  // Cap daily XP per habit at 100 (Requirement 2.5)
  return Math.min(totalXP, DAILY_XP_CAP_PER_HABIT);
}

/**
 * Get XP multiplier based on completion rate.
 *
 * New Multiplier Tiers:
 * - 0-49%: 0.2x (minimal) - reduced from 0.3x
 * - 50-79%: 0.5x (partial) - reduced from 0.6x
 * - 80-99%: 0.8x (near_complete) - unchanged
 * - 100-120%: 1.0x (optimal) - unchanged
 * - 121-150%: 0.85x (over_achieve) - reduced from 0.9x
 * - 151%+: 0.6x (burnout_risk) - reduced from 0.7x
 *
 * Property 3: XP Multiplier Correctness
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 *
 * @param completionRate - Completion rate as percentage (0-500+)
 * @returns XP multiplier result with tier and reason
 */
export function getXPMultiplier(completionRate: number): XPMultiplierResult {
  // Handle negative completion rates
  if (completionRate < 0) {
    return {
      multiplier: 0.2,
      tier: 'minimal',
      reason: 'completion_under_50',
    };
  }

  // Requirement 3.1: 0-49% → 0.2x
  if (completionRate < 50) {
    return {
      multiplier: 0.2,
      tier: 'minimal',
      reason: 'completion_under_50',
    };
  }

  // Requirement 3.2: 50-79% → 0.5x
  if (completionRate < 80) {
    return {
      multiplier: 0.5,
      tier: 'partial',
      reason: 'completion_50_79',
    };
  }

  // Requirement 3.3: 80-99% → 0.8x
  if (completionRate < 100) {
    return {
      multiplier: 0.8,
      tier: 'near_complete',
      reason: 'completion_80_99',
    };
  }

  // Requirement 3.4: 100-120% → 1.0x (optimal)
  if (completionRate <= 120) {
    return {
      multiplier: 1.0,
      tier: 'optimal',
      reason: 'completion_100_120',
    };
  }

  // Requirement 3.5: 121-150% → 0.85x
  if (completionRate <= 150) {
    return {
      multiplier: 0.85,
      tier: 'over_achieve',
      reason: 'completion_121_150',
    };
  }

  // Requirement 3.6: 151%+ → 0.6x
  return {
    multiplier: 0.6,
    tier: 'burnout_risk',
    reason: 'completion_over_150',
  };
}

/**
 * Calculate tier from level using new tier boundaries.
 *
 * New Tier Boundaries:
 * - beginner: 0-49
 * - intermediate: 50-99
 * - advanced: 100-499
 * - expert: 500-9999
 *
 * Validates: Requirement 1.6
 *
 * @param level - Expertise level (0-9999)
 * @param tierBoundaries - Optional custom tier boundaries
 * @returns Level tier
 */
export function calculateTier(
  level: number,
  tierBoundaries: TierBoundaries = DEFAULT_TIER_BOUNDARIES
): LevelTier {
  if (level >= tierBoundaries.expert.min) {
    return 'expert';
  }
  if (level >= tierBoundaries.advanced.min) {
    return 'advanced';
  }
  if (level >= tierBoundaries.intermediate.min) {
    return 'intermediate';
  }
  return 'beginner';
}

/**
 * Calculate XP required to reach a specific level.
 *
 * Inverse of the level formula:
 * level = floor(5 * log2(xp / 1000 + 1))
 * xp = 1000 * (2^(level/5) - 1)
 *
 * @param targetLevel - Target level to reach
 * @returns XP required to reach the target level
 */
export function calculateXPForLevel(targetLevel: number): number {
  if (targetLevel <= 0) {
    return 0;
  }

  // Inverse formula: xp = 1000 * (2^(level/5) - 1)
  return Math.ceil(EXPERTISE_LEVEL_DIVISOR * (Math.pow(2, targetLevel / EXPERTISE_LEVEL_MULTIPLIER) - 1));
}

/**
 * Calculate daily XP based on simulation parameters.
 *
 * @param params - Simulation parameters
 * @returns Estimated daily XP
 */
export function calculateDailyXP(params: SimulationParams): number {
  // Calculate base XP per habit
  const baseXPPerHabit = calculateBaseXP(params.averageHabitLevel, params.streakDays);

  // Get multiplier based on completion rate
  const multiplierResult = getXPMultiplier(params.completionRate);

  // Calculate XP per habit with multiplier
  const xpPerHabit = Math.floor(baseXPPerHabit * multiplierResult.multiplier);

  // Total daily XP = XP per habit * number of habits
  return xpPerHabit * params.dailyHabits;
}

/**
 * Simulate level progression over time.
 *
 * Property 8: Level Simulation Projections
 * Validates: Requirements 7.2
 *
 * @param params - Simulation parameters
 * @returns Simulation result with projections and milestones
 */
export function simulateProgression(params: SimulationParams): SimulationResult {
  const dailyXP = calculateDailyXP(params);
  const currentLevel = calculateExpertiseLevel(params.currentXP);

  // Calculate projections at various time points
  const projections = {
    oneWeek: calculateExpertiseLevel(params.currentXP + dailyXP * 7),
    oneMonth: calculateExpertiseLevel(params.currentXP + dailyXP * 30),
    threeMonths: calculateExpertiseLevel(params.currentXP + dailyXP * 90),
    sixMonths: calculateExpertiseLevel(params.currentXP + dailyXP * 180),
    oneYear: calculateExpertiseLevel(params.currentXP + dailyXP * 365),
    twoYears: calculateExpertiseLevel(params.currentXP + dailyXP * 730),
  };

  // Calculate tier milestones
  const tierMilestones = calculateTierMilestones(params.currentXP, dailyXP);

  return {
    currentLevel,
    projections,
    tierMilestones,
  };
}

/**
 * Calculate tier milestones (XP required and estimated days).
 *
 * @param currentXP - Current XP
 * @param dailyXP - Estimated daily XP gain
 * @returns Tier milestones
 */
function calculateTierMilestones(
  currentXP: number,
  dailyXP: number
): SimulationResult['tierMilestones'] {
  // XP required for each tier boundary
  const intermediateXP = calculateXPForLevel(DEFAULT_TIER_BOUNDARIES.intermediate.min);
  const advancedXP = calculateXPForLevel(DEFAULT_TIER_BOUNDARIES.advanced.min);
  const expertXP = calculateXPForLevel(DEFAULT_TIER_BOUNDARIES.expert.min);
  const maxXP = calculateXPForLevel(MAX_EXPERTISE_LEVEL);

  // Calculate estimated days to reach each tier
  const calculateDays = (targetXP: number): number => {
    if (currentXP >= targetXP) return 0;
    if (dailyXP <= 0) return Infinity;
    return Math.ceil((targetXP - currentXP) / dailyXP);
  };

  return {
    intermediate: {
      xpRequired: intermediateXP,
      estimatedDays: calculateDays(intermediateXP),
    },
    advanced: {
      xpRequired: advancedXP,
      estimatedDays: calculateDays(advancedXP),
    },
    expert: {
      xpRequired: expertXP,
      estimatedDays: calculateDays(expertXP),
    },
    max: {
      xpRequired: maxXP,
      estimatedDays: calculateDays(maxXP),
    },
  };
}

// =============================================================================
// LevelRebalancingService Class
// =============================================================================

/**
 * Level Rebalancing Service
 *
 * Manages level calculations using the new rebalanced formulas.
 * Uses LevelConfigService to get configuration values.
 */
export class LevelRebalancingService {
  private readonly configService: LevelConfigService;

  /**
   * Initialize the LevelRebalancingService.
   *
   * @param supabase - Supabase client instance
   */
  constructor(supabase: SupabaseClient) {
    this.configService = new LevelConfigService(supabase);
  }

  // ===========================================================================
  // Public Methods
  // ===========================================================================

  /**
   * Calculate expertise level from experience points.
   *
   * Uses the new formula: min(9999, floor(5 * log2(xp/1000 + 1)))
   *
   * Requirements: 1.1
   *
   * @param experiencePoints - Total accumulated experience points
   * @returns Expertise level (0-9999)
   */
  calculateExpertiseLevel(experiencePoints: number): number {
    return calculateExpertiseLevel(experiencePoints);
  }

  /**
   * Calculate base XP from habit completion.
   *
   * Uses the new formula: floor(habit_level * 2) + min(streak, 30)
   *
   * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
   *
   * @param habitLevel - Habit difficulty level (THLI-24), null uses default 25
   * @param streakDays - Current streak in days
   * @returns Base XP (capped at 100 per habit)
   */
  calculateBaseXP(habitLevel: number | null, streakDays: number): number {
    return calculateBaseXP(habitLevel, streakDays);
  }

  /**
   * Get XP multiplier based on completion rate.
   *
   * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
   *
   * @param completionRate - Completion rate as percentage
   * @returns XP multiplier result with tier and reason
   */
  getXPMultiplier(completionRate: number): XPMultiplierResult {
    return getXPMultiplier(completionRate);
  }

  /**
   * Calculate tier from level.
   *
   * Requirement: 1.6
   *
   * @param level - Expertise level
   * @returns Level tier
   */
  calculateTier(level: number): LevelTier {
    return calculateTier(level);
  }

  /**
   * Simulate level progression over time.
   *
   * Requirements: 7.2
   *
   * @param params - Simulation parameters
   * @returns Simulation result with projections and milestones
   */
  simulateProgression(params: SimulationParams): SimulationResult {
    return simulateProgression(params);
  }

  /**
   * Get current level configuration.
   *
   * @returns Current level configuration from database
   */
  async getLevelConfig(): Promise<LevelConfig> {
    logger.debug('Getting level configuration');
    return this.configService.getCurrentConfig();
  }

  /**
   * Check if level rebalancing is enabled.
   *
   * @returns True if rebalancing feature is enabled
   */
  async isRebalancingEnabled(): Promise<boolean> {
    return this.configService.isRebalancingEnabled();
  }

  /**
   * Calculate total XP with multiplier applied.
   *
   * Combines base XP calculation with completion rate multiplier.
   *
   * @param habitLevel - Habit difficulty level
   * @param streakDays - Current streak in days
   * @param completionRate - Completion rate percentage
   * @returns Total XP after multiplier
   */
  calculateTotalXP(
    habitLevel: number | null,
    streakDays: number,
    completionRate: number
  ): { baseXP: number; multiplier: number; totalXP: number; tier: XPMultiplierTier } {
    const baseXP = this.calculateBaseXP(habitLevel, streakDays);
    const multiplierResult = this.getXPMultiplier(completionRate);
    const totalXP = Math.floor(baseXP * multiplierResult.multiplier);

    logger.debug('Calculated total XP', {
      habitLevel,
      streakDays,
      completionRate,
      baseXP,
      multiplier: multiplierResult.multiplier,
      tier: multiplierResult.tier,
      totalXP,
    });

    return {
      baseXP,
      multiplier: multiplierResult.multiplier,
      totalXP,
      tier: multiplierResult.tier,
    };
  }

  /**
   * Get XP required to reach a specific level.
   *
   * @param targetLevel - Target level
   * @returns XP required
   */
  getXPForLevel(targetLevel: number): number {
    return calculateXPForLevel(targetLevel);
  }

  /**
   * Get tier boundaries.
   *
   * @returns Tier boundaries configuration
   */
  getTierBoundaries(): TierBoundaries {
    return { ...DEFAULT_TIER_BOUNDARIES };
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new LevelRebalancingService instance.
 *
 * @param supabase - Supabase client instance
 * @returns LevelRebalancingService instance
 */
export function createLevelRebalancingService(supabase: SupabaseClient): LevelRebalancingService {
  return new LevelRebalancingService(supabase);
}
