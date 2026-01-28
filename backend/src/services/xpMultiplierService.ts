/**
 * XP Multiplier Service
 *
 * Calculates experience point multipliers based on behavioral science principles.
 * Implements a 6-tier system that rewards plan adherence (100-120%) with maximum
 * multiplier while discouraging both under-achievement and over-achievement.
 *
 * Behavioral Science Rationale:
 * - Implementation Intentions: Plan adherence (100-120%) gets maximum reward
 * - Sustainable Behavior: Over-achievement (>120%) is mildly discouraged to prevent burnout
 * - Partial Reinforcement: Partial completion still receives positive reinforcement
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9
 */

// =============================================================================
// Types
// =============================================================================

/**
 * XP Multiplier tiers based on behavioral science
 *
 * - minimal: 0-49% completion → 0.3x (recognize minimal effort)
 * - partial: 50-79% completion → 0.6x (partial reinforcement)
 * - near: 80-99% completion → 0.8x (near-completion recognition)
 * - optimal: 100-120% completion → 1.0x (plan adherence - maximum reward)
 * - mild_over: 121-150% completion → 0.9x (mild over-achievement)
 * - over: 151%+ completion → 0.7x (burnout prevention)
 */
export type XPMultiplierTier =
  | 'minimal' // 0-49%: 0.3x
  | 'partial' // 50-79%: 0.6x
  | 'near' // 80-99%: 0.8x
  | 'optimal' // 100-120%: 1.0x
  | 'mild_over' // 121-150%: 0.9x
  | 'over'; // 151%+: 0.7x

/**
 * Behavioral science rationale keys for multiplier tiers
 */
export type MultiplierRationaleKey =
  | 'minimal_effort'
  | 'partial_reinforcement'
  | 'near_completion'
  | 'plan_adherence'
  | 'mild_overachievement'
  | 'burnout_prevention';

/**
 * XP Multiplier result with rationale
 */
export interface XPMultiplierResult {
  /** The multiplier value (0.3 - 1.0) */
  multiplier: number;
  /** The tier classification */
  tier: XPMultiplierTier;
  /** The completion rate (0-500%) */
  completionRate: number;
  /** Human-readable rationale message */
  rationale: string;
  /** Rationale key for i18n */
  rationaleKey: MultiplierRationaleKey;
}

/**
 * Supported locales for rationale messages
 */
export type SupportedLocale = 'ja' | 'en';

// =============================================================================
// Constants
// =============================================================================

/** Multiplier values for each tier */
const MULTIPLIER_VALUES: Record<XPMultiplierTier, number> = {
  minimal: 0.3,
  partial: 0.6,
  near: 0.8,
  optimal: 1.0,
  mild_over: 0.9,
  over: 0.7,
};

/** Rationale keys for each tier */
const TIER_RATIONALE_KEYS: Record<XPMultiplierTier, MultiplierRationaleKey> = {
  minimal: 'minimal_effort',
  partial: 'partial_reinforcement',
  near: 'near_completion',
  optimal: 'plan_adherence',
  mild_over: 'mild_overachievement',
  over: 'burnout_prevention',
};

/** Localized rationale messages */
const RATIONALE_MESSAGES: Record<MultiplierRationaleKey, Record<SupportedLocale, string>> = {
  minimal_effort: {
    ja: '少しでも取り組んだことを認めます',
    en: 'Recognizing minimal effort',
  },
  partial_reinforcement: {
    ja: '部分的な達成も価値があります',
    en: 'Partial completion is still valuable',
  },
  near_completion: {
    ja: 'もう少しで達成です！',
    en: 'Almost there!',
  },
  plan_adherence: {
    ja: '計画通り達成！最大報酬です',
    en: 'Plan achieved! Maximum reward',
  },
  mild_overachievement: {
    ja: '頑張りすぎ注意！適度が大切です',
    en: 'Be careful not to overdo it!',
  },
  burnout_prevention: {
    ja: '燃え尽き防止のため、適度な達成を推奨します',
    en: 'Moderate achievement recommended to prevent burnout',
  },
};

/** Maximum completion rate to prevent overflow */
const MAX_COMPLETION_RATE = 500;

// =============================================================================
// Pure Calculation Functions
// =============================================================================

/**
 * Calculate completion rate from actual and target values.
 *
 * Formula: (actual / target) * 100
 *
 * Property 2: Completion Rate Calculation
 * Validates: Requirements 1.7, 1.8
 *
 * @param actualValue - Actual completed value (count or duration)
 * @param targetValue - Target value (count or duration)
 * @returns Completion rate as percentage (0-500, capped)
 */
export function calculateCompletionRate(actualValue: number, targetValue: number): number {
  // Handle edge cases
  if (targetValue <= 0) {
    return 0;
  }

  if (actualValue < 0) {
    return 0;
  }

  // Calculate rate and cap at maximum
  const rate = (actualValue / targetValue) * 100;
  return Math.min(rate, MAX_COMPLETION_RATE);
}

/**
 * Determine XP multiplier tier from completion rate.
 *
 * Tier boundaries:
 * - minimal: 0-49%
 * - partial: 50-79%
 * - near: 80-99%
 * - optimal: 100-120%
 * - mild_over: 121-150%
 * - over: 151%+
 *
 * Property 1: XP Multiplier Tier Mapping
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 *
 * @param completionRate - Completion rate as percentage
 * @returns XP multiplier tier
 */
export function determineMultiplierTier(completionRate: number): XPMultiplierTier {
  if (completionRate < 0) {
    return 'minimal';
  }

  if (completionRate < 50) {
    return 'minimal';
  }

  if (completionRate < 80) {
    return 'partial';
  }

  if (completionRate < 100) {
    return 'near';
  }

  if (completionRate <= 120) {
    return 'optimal';
  }

  if (completionRate <= 150) {
    return 'mild_over';
  }

  return 'over';
}

/**
 * Get multiplier value for a tier.
 *
 * @param tier - XP multiplier tier
 * @returns Multiplier value (0.3 - 1.0)
 */
export function getMultiplierValue(tier: XPMultiplierTier): number {
  return MULTIPLIER_VALUES[tier];
}

/**
 * Get rationale key for a tier.
 *
 * @param tier - XP multiplier tier
 * @returns Rationale key for i18n
 */
export function getRationaleKey(tier: XPMultiplierTier): MultiplierRationaleKey {
  return TIER_RATIONALE_KEYS[tier];
}

/**
 * Get localized rationale message for a tier.
 *
 * Validates: Requirements 1.9
 *
 * @param tier - XP multiplier tier
 * @param locale - Locale for message ('ja' or 'en')
 * @returns Localized rationale message
 */
export function getMultiplierRationale(tier: XPMultiplierTier, locale: SupportedLocale): string {
  const rationaleKey = TIER_RATIONALE_KEYS[tier];
  return RATIONALE_MESSAGES[rationaleKey][locale];
}

/**
 * Calculate XP multiplier based on completion rate.
 *
 * This is the main entry point for XP multiplier calculation.
 * It combines completion rate calculation, tier determination,
 * and rationale generation.
 *
 * Behavioral Science Rationale:
 * - Implementation Intentions: Plan adherence (100-120%) gets maximum reward
 * - Sustainable Behavior: Over-achievement (>120%) is mildly discouraged
 * - Partial Reinforcement: Partial completion still receives positive reinforcement
 *
 * Property 1: XP Multiplier Tier Mapping
 * Property 2: Completion Rate Calculation
 * Property 8: XP Multiplier Monotonicity in Optimal Range
 * Validates: Requirements 1.1-1.9
 *
 * @param actualValue - Actual completed value (count or duration)
 * @param targetValue - Target value (count or duration)
 * @param locale - Locale for rationale message (default: 'ja')
 * @returns XP multiplier result with tier and rationale
 */
export function calculateXPMultiplier(
  actualValue: number,
  targetValue: number,
  locale: SupportedLocale = 'ja'
): XPMultiplierResult {
  // Calculate completion rate
  const completionRate = calculateCompletionRate(actualValue, targetValue);

  // Determine tier
  const tier = determineMultiplierTier(completionRate);

  // Get multiplier value
  const multiplier = getMultiplierValue(tier);

  // Get rationale
  const rationaleKey = getRationaleKey(tier);
  const rationale = getMultiplierRationale(tier, locale);

  return {
    multiplier,
    tier,
    completionRate,
    rationale,
    rationaleKey,
  };
}

/**
 * Calculate XP multiplier from pre-calculated completion rate.
 *
 * Use this when you already have the completion rate calculated.
 *
 * @param completionRate - Pre-calculated completion rate (0-500%)
 * @param locale - Locale for rationale message (default: 'ja')
 * @returns XP multiplier result with tier and rationale
 */
export function calculateXPMultiplierFromRate(
  completionRate: number,
  locale: SupportedLocale = 'ja'
): XPMultiplierResult {
  // Clamp completion rate
  const clampedRate = Math.max(0, Math.min(completionRate, MAX_COMPLETION_RATE));

  // Determine tier
  const tier = determineMultiplierTier(clampedRate);

  // Get multiplier value
  const multiplier = getMultiplierValue(tier);

  // Get rationale
  const rationaleKey = getRationaleKey(tier);
  const rationale = getMultiplierRationale(tier, locale);

  return {
    multiplier,
    tier,
    completionRate: clampedRate,
    rationale,
    rationaleKey,
  };
}

// =============================================================================
// Display Helpers
// =============================================================================

/**
 * Get color code for toast notification based on tier.
 *
 * Validates: Requirements 6.2
 *
 * @param tier - XP multiplier tier
 * @returns Color code ('green', 'yellow', 'orange', 'red')
 */
export function getTierColor(tier: XPMultiplierTier): 'green' | 'yellow' | 'orange' | 'red' {
  switch (tier) {
    case 'optimal':
      return 'green'; // 100-120% - optimal
    case 'near':
    case 'mild_over':
      return 'yellow'; // 80-99% or 121-150% - good
    case 'partial':
    case 'over':
      return 'orange'; // 50-79% or 151%+ - acceptable
    case 'minimal':
      return 'red'; // 0-49% - minimal
    default:
      return 'yellow';
  }
}

/**
 * Format multiplier for display.
 *
 * @param multiplier - Multiplier value
 * @returns Formatted string (e.g., "×1.0", "×0.8")
 */
export function formatMultiplier(multiplier: number): string {
  return `×${multiplier.toFixed(1)}`;
}

/**
 * Format completion rate for display.
 *
 * @param completionRate - Completion rate percentage
 * @returns Formatted string (e.g., "100%", "85%")
 */
export function formatCompletionRate(completionRate: number): string {
  return `${Math.round(completionRate)}%`;
}

/**
 * Get short tooltip message for multiplier.
 *
 * Validates: Requirements 6.3
 *
 * @param tier - XP multiplier tier
 * @param locale - Locale for message
 * @returns Short tooltip message
 */
export function getMultiplierTooltip(tier: XPMultiplierTier, locale: SupportedLocale): string {
  const tooltips: Record<XPMultiplierTier, Record<SupportedLocale, string>> = {
    minimal: {
      ja: '少しでも取り組みました',
      en: 'Some effort made',
    },
    partial: {
      ja: '部分達成！',
      en: 'Partial completion!',
    },
    near: {
      ja: 'もう少し！',
      en: 'Almost there!',
    },
    optimal: {
      ja: '計画通り達成で最大報酬！',
      en: 'Plan achieved! Max reward!',
    },
    mild_over: {
      ja: '頑張りすぎ注意！',
      en: 'Be careful not to overdo it!',
    },
    over: {
      ja: '燃え尽き注意！適度が大切',
      en: 'Burnout warning! Moderation is key',
    },
  };

  return tooltips[tier][locale];
}
