/**
 * Level Config Service
 *
 * Manages level calculation configuration and feature flags for the
 * Level System Rebalancing feature.
 *
 * This service provides:
 * - Reading and updating level configuration from the level_config table
 * - Managing feature flags for gradual rollout
 * - Configuration history tracking for audit purposes
 *
 * Requirements: 1.7, 11.1, 11.2
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('levelConfigService');

// =============================================================================
// Types
// =============================================================================

/**
 * Expertise level formula configuration
 */
export interface ExpertiseLevelFormula {
  multiplier: number; // 5 (was 10)
  divisor: number; // 1000 (was 100)
  maxLevel: number; // 9999 (was 199)
}

/**
 * Base XP formula configuration
 */
export interface BaseXPFormula {
  habitLevelMultiplier: number; // 2 (was 10)
  defaultHabitLevel: number; // 25 (was 50)
}

/**
 * Streak bonus configuration
 */
export interface StreakBonus {
  maxBonus: number; // 30 (was 50)
  multiplier: number; // 1 (was 2)
}

/**
 * XP multiplier tiers based on completion rate
 */
export interface XPMultiplierTiers {
  tier0_49: number; // 0.2
  tier50_79: number; // 0.5
  tier80_99: number; // 0.8
  tier100_120: number; // 1.0
  tier121_150: number; // 0.85
  tier151_plus: number; // 0.6
}

/**
 * Level decay settings
 */
export interface DecaySettings {
  gracePeriodDays: number; // 21
  decayPerWeek: number; // 0.5
  maxDecayPercent: number; // 0.15
  recoveryBonusMultiplier: number; // 1.5
  recoveryBonusDays: number; // 7
}

/**
 * Tier boundary definition
 */
export interface TierBoundary {
  min: number;
  max: number;
}

/**
 * Tier boundaries configuration
 */
export interface TierBoundaries {
  beginner: TierBoundary;
  intermediate: TierBoundary;
  advanced: TierBoundary;
  expert: TierBoundary;
}

/**
 * Complete level configuration
 */
export interface LevelConfig {
  formulaVersion: string;
  expertiseLevelFormula: ExpertiseLevelFormula;
  baseXPFormula: BaseXPFormula;
  streakBonus: StreakBonus;
  xpMultipliers: XPMultiplierTiers;
  decaySettings: DecaySettings;
  tierBoundaries: TierBoundaries;
  effectiveFrom: Date;
}

/**
 * Configuration history entry
 */
export interface LevelConfigHistory {
  id: string;
  configKey: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  changedAt: Date;
}

/**
 * Database record for level_config table
 */
interface LevelConfigRecord {
  id: string;
  config_key: string;
  config_value: Record<string, unknown>;
  version: string;
  effective_from: string;
  effective_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Database record for feature_flags table
 */
interface FeatureFlagRecord {
  id: string;
  flag_name: string;
  flag_value: boolean;
  description: string | null;
  rollout_percentage: number;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Constants - Default Configuration Values
// =============================================================================

/**
 * Default v2.0 expertise level formula
 */
const DEFAULT_EXPERTISE_FORMULA: ExpertiseLevelFormula = {
  multiplier: 5,
  divisor: 1000,
  maxLevel: 9999,
};

/**
 * Default v2.0 base XP formula
 */
const DEFAULT_BASE_XP_FORMULA: BaseXPFormula = {
  habitLevelMultiplier: 2,
  defaultHabitLevel: 25,
};

/**
 * Default v2.0 streak bonus settings
 */
const DEFAULT_STREAK_BONUS: StreakBonus = {
  maxBonus: 30,
  multiplier: 1,
};

/**
 * Default v2.0 XP multiplier tiers
 */
const DEFAULT_XP_MULTIPLIERS: XPMultiplierTiers = {
  tier0_49: 0.2,
  tier50_79: 0.5,
  tier80_99: 0.8,
  tier100_120: 1.0,
  tier121_150: 0.85,
  tier151_plus: 0.6,
};

/**
 * Default v2.0 decay settings
 */
const DEFAULT_DECAY_SETTINGS: DecaySettings = {
  gracePeriodDays: 21,
  decayPerWeek: 0.5,
  maxDecayPercent: 0.15,
  recoveryBonusMultiplier: 1.5,
  recoveryBonusDays: 7,
};

/**
 * Default v2.0 tier boundaries
 */
const DEFAULT_TIER_BOUNDARIES: TierBoundaries = {
  beginner: { min: 0, max: 49 },
  intermediate: { min: 50, max: 99 },
  advanced: { min: 100, max: 499 },
  expert: { min: 500, max: 9999 },
};

/**
 * Default formula version
 */
const DEFAULT_FORMULA_VERSION = 'v2.0';

/**
 * Configuration keys used in the level_config table
 */
const CONFIG_KEYS = {
  EXPERTISE_FORMULA: 'expertise_formula',
  XP_FORMULA: 'xp_formula',
  XP_MULTIPLIERS: 'xp_multipliers',
  DECAY_SETTINGS: 'decay_settings',
  TIER_BOUNDARIES: 'tier_boundaries',
} as const;

// =============================================================================
// LevelConfigService Class
// =============================================================================

/**
 * Level Config Service
 *
 * Manages level calculation configuration and feature flags.
 */
export class LevelConfigService {
  private readonly supabase: SupabaseClient;

  /**
   * Initialize the LevelConfigService.
   *
   * @param supabase - Supabase client instance
   */
  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  // ===========================================================================
  // Public Methods - Configuration
  // ===========================================================================

  /**
   * Get the current active level configuration.
   *
   * Reads configuration from the level_config table and assembles
   * a complete LevelConfig object. Falls back to defaults if
   * configuration is not found.
   *
   * Requirements: 1.7, 11.1
   *
   * @returns Current level configuration
   */
  async getCurrentConfig(): Promise<LevelConfig> {
    logger.info('Getting current level configuration');

    try {
      // Fetch all active configuration records
      const { data, error } = await this.supabase
        .from('level_config')
        .select('*')
        .is('effective_to', null)
        .order('effective_from', { ascending: false });

      if (error) {
        logger.error('Failed to fetch level configuration', error, {
          errorCode: error.code,
        });
        // Return defaults on error
        return this.getDefaultConfig();
      }

      if (!data || data.length === 0) {
        logger.warning('No level configuration found, using defaults');
        return this.getDefaultConfig();
      }

      // Build configuration from records
      const config = this.buildConfigFromRecords(data as LevelConfigRecord[]);

      logger.info('Level configuration retrieved', {
        formulaVersion: config.formulaVersion,
        effectiveFrom: config.effectiveFrom.toISOString(),
      });

      return config;
    } catch (error) {
      logger.error('Exception getting level configuration', error as Error);
      return this.getDefaultConfig();
    }
  }

  /**
   * Update level configuration.
   *
   * Updates specified configuration values in the level_config table.
   * Creates history records for audit purposes.
   *
   * Requirements: 11.1, 11.5
   *
   * @param config - Partial configuration to update
   * @param changedBy - User ID or system identifier making the change
   * @returns Updated complete configuration
   */
  async updateConfig(
    config: Partial<LevelConfig>,
    changedBy?: string
  ): Promise<LevelConfig> {
    logger.info('Updating level configuration', {
      changedBy,
      configKeys: Object.keys(config),
    });

    try {
      const now = new Date().toISOString();
      const version = config.formulaVersion ?? DEFAULT_FORMULA_VERSION;

      // Update expertise formula if provided
      if (config.expertiseLevelFormula) {
        await this.updateConfigRecord(
          CONFIG_KEYS.EXPERTISE_FORMULA,
          { ...config.expertiseLevelFormula } as Record<string, unknown>,
          version,
          changedBy,
          now
        );
      }

      // Update base XP formula if provided
      if (config.baseXPFormula || config.streakBonus) {
        const xpFormula: Record<string, unknown> = {
          habitLevelMultiplier: config.baseXPFormula?.habitLevelMultiplier ?? DEFAULT_BASE_XP_FORMULA.habitLevelMultiplier,
          defaultHabitLevel: config.baseXPFormula?.defaultHabitLevel ?? DEFAULT_BASE_XP_FORMULA.defaultHabitLevel,
          streakMaxBonus: config.streakBonus?.maxBonus ?? DEFAULT_STREAK_BONUS.maxBonus,
          streakMultiplier: config.streakBonus?.multiplier ?? DEFAULT_STREAK_BONUS.multiplier,
          dailyCapPerHabit: 100,
        };
        await this.updateConfigRecord(
          CONFIG_KEYS.XP_FORMULA,
          xpFormula,
          version,
          changedBy,
          now
        );
      }

      // Update XP multipliers if provided
      if (config.xpMultipliers) {
        await this.updateConfigRecord(
          CONFIG_KEYS.XP_MULTIPLIERS,
          { ...config.xpMultipliers } as Record<string, unknown>,
          version,
          changedBy,
          now
        );
      }

      // Update decay settings if provided
      if (config.decaySettings) {
        await this.updateConfigRecord(
          CONFIG_KEYS.DECAY_SETTINGS,
          { ...config.decaySettings } as Record<string, unknown>,
          version,
          changedBy,
          now
        );
      }

      // Update tier boundaries if provided
      if (config.tierBoundaries) {
        await this.updateConfigRecord(
          CONFIG_KEYS.TIER_BOUNDARIES,
          { ...config.tierBoundaries } as Record<string, unknown>,
          version,
          changedBy,
          now
        );
      }

      logger.info('Level configuration updated successfully', {
        changedBy,
        version,
      });

      // Return the updated configuration
      return this.getCurrentConfig();
    } catch (error) {
      logger.error('Failed to update level configuration', error as Error, {
        changedBy,
      });
      throw error;
    }
  }

  // ===========================================================================
  // Public Methods - Feature Flags
  // ===========================================================================

  /**
   * Get a feature flag value.
   *
   * Requirements: 11.2, 11.3
   *
   * @param flagName - Name of the feature flag
   * @returns Feature flag value (true/false), defaults to false if not found
   */
  async getFeatureFlag(flagName: string): Promise<boolean> {
    logger.debug('Getting feature flag', { flagName });

    try {
      const { data, error } = await this.supabase
        .from('feature_flags')
        .select('flag_value, rollout_percentage')
        .eq('flag_name', flagName)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found
          logger.debug('Feature flag not found, returning false', { flagName });
          return false;
        }
        logger.error('Failed to get feature flag', error, { flagName });
        return false;
      }

      const record = data as FeatureFlagRecord;

      // If rollout percentage is less than 100, apply probabilistic check
      if (record.rollout_percentage < 100) {
        const shouldEnable = Math.random() * 100 < record.rollout_percentage;
        logger.debug('Feature flag with rollout percentage', {
          flagName,
          flagValue: record.flag_value,
          rolloutPercentage: record.rollout_percentage,
          shouldEnable,
        });
        return record.flag_value && shouldEnable;
      }

      logger.debug('Feature flag retrieved', {
        flagName,
        flagValue: record.flag_value,
      });

      return record.flag_value;
    } catch (error) {
      logger.error('Exception getting feature flag', error as Error, { flagName });
      return false;
    }
  }

  /**
   * Set a feature flag value.
   *
   * Requirements: 11.2, 11.5
   *
   * @param flagName - Name of the feature flag
   * @param value - New value for the flag
   * @param changedBy - User ID or system identifier making the change
   */
  async setFeatureFlag(
    flagName: string,
    value: boolean,
    changedBy?: string
  ): Promise<void> {
    logger.info('Setting feature flag', { flagName, value, changedBy });

    try {
      const { error } = await this.supabase
        .from('feature_flags')
        .update({
          flag_value: value,
          updated_at: new Date().toISOString(),
        })
        .eq('flag_name', flagName);

      if (error) {
        logger.error('Failed to set feature flag', error, { flagName, value });
        throw new Error(`Failed to set feature flag ${flagName}: ${error.message}`);
      }

      logger.info('Feature flag set successfully', {
        flagName,
        value,
        changedBy,
      });
    } catch (error) {
      logger.error('Exception setting feature flag', error as Error, {
        flagName,
        value,
      });
      throw error;
    }
  }

  /**
   * Get all feature flags.
   *
   * @returns Map of flag names to their values
   */
  async getAllFeatureFlags(): Promise<Map<string, boolean>> {
    logger.debug('Getting all feature flags');

    try {
      const { data, error } = await this.supabase
        .from('feature_flags')
        .select('flag_name, flag_value');

      if (error) {
        logger.error('Failed to get all feature flags', error);
        return new Map();
      }

      const flags = new Map<string, boolean>();
      for (const record of (data as FeatureFlagRecord[]) ?? []) {
        flags.set(record.flag_name, record.flag_value);
      }

      logger.debug('All feature flags retrieved', {
        count: flags.size,
      });

      return flags;
    } catch (error) {
      logger.error('Exception getting all feature flags', error as Error);
      return new Map();
    }
  }

  // ===========================================================================
  // Public Methods - Configuration History
  // ===========================================================================

  /**
   * Get configuration change history.
   *
   * Requirements: 11.5
   *
   * @param limit - Maximum number of history entries to return
   * @returns Array of configuration history entries
   */
  async getConfigHistory(limit = 50): Promise<LevelConfigHistory[]> {
    logger.debug('Getting configuration history', { limit });

    try {
      // Query level_config table for historical records
      // Records with effective_to set are historical
      const { data, error } = await this.supabase
        .from('level_config')
        .select('*')
        .not('effective_to', 'is', null)
        .order('effective_to', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Failed to get configuration history', error);
        return [];
      }

      const history: LevelConfigHistory[] = (data as LevelConfigRecord[] ?? []).map(record => ({
        id: record.id,
        configKey: record.config_key,
        oldValue: JSON.stringify(record.config_value),
        newValue: '', // Would need to join with the replacing record
        changedBy: record.created_by ?? 'system',
        changedAt: new Date(record.effective_to!),
      }));

      logger.debug('Configuration history retrieved', {
        count: history.length,
      });

      return history;
    } catch (error) {
      logger.error('Exception getting configuration history', error as Error);
      return [];
    }
  }

  // ===========================================================================
  // Public Methods - Utility
  // ===========================================================================

  /**
   * Check if level rebalancing is enabled.
   *
   * Convenience method to check the main feature flag.
   *
   * @returns True if level rebalancing is enabled
   */
  async isRebalancingEnabled(): Promise<boolean> {
    return this.getFeatureFlag('level_rebalancing_enabled');
  }

  /**
   * Check if migration is in progress.
   *
   * @returns True if migration is currently running
   */
  async isMigrationInProgress(): Promise<boolean> {
    return this.getFeatureFlag('migration_in_progress');
  }

  /**
   * Check if new XP formula is enabled.
   *
   * @returns True if new XP formula should be used
   */
  async isNewXPFormulaEnabled(): Promise<boolean> {
    return this.getFeatureFlag('new_xp_formula_enabled');
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Get default configuration values.
   *
   * @returns Default level configuration
   */
  private getDefaultConfig(): LevelConfig {
    return {
      formulaVersion: DEFAULT_FORMULA_VERSION,
      expertiseLevelFormula: { ...DEFAULT_EXPERTISE_FORMULA },
      baseXPFormula: { ...DEFAULT_BASE_XP_FORMULA },
      streakBonus: { ...DEFAULT_STREAK_BONUS },
      xpMultipliers: { ...DEFAULT_XP_MULTIPLIERS },
      decaySettings: { ...DEFAULT_DECAY_SETTINGS },
      tierBoundaries: { ...DEFAULT_TIER_BOUNDARIES },
      effectiveFrom: new Date(),
    };
  }

  /**
   * Build configuration from database records.
   *
   * @param records - Array of level_config records
   * @returns Assembled level configuration
   */
  private buildConfigFromRecords(records: LevelConfigRecord[]): LevelConfig {
    const config = this.getDefaultConfig();

    // Find the most recent effective_from date
    let latestEffectiveFrom = new Date(0);
    let latestVersion = DEFAULT_FORMULA_VERSION;

    for (const record of records) {
      const effectiveFrom = new Date(record.effective_from);
      if (effectiveFrom > latestEffectiveFrom) {
        latestEffectiveFrom = effectiveFrom;
        latestVersion = record.version;
      }

      switch (record.config_key) {
        case CONFIG_KEYS.EXPERTISE_FORMULA:
          config.expertiseLevelFormula = this.parseExpertiseFormula(record.config_value);
          break;

        case CONFIG_KEYS.XP_FORMULA:
          const xpConfig = this.parseXPFormula(record.config_value);
          config.baseXPFormula = xpConfig.baseXPFormula;
          config.streakBonus = xpConfig.streakBonus;
          break;

        case CONFIG_KEYS.XP_MULTIPLIERS:
          config.xpMultipliers = this.parseXPMultipliers(record.config_value);
          break;

        case CONFIG_KEYS.DECAY_SETTINGS:
          config.decaySettings = this.parseDecaySettings(record.config_value);
          break;

        case CONFIG_KEYS.TIER_BOUNDARIES:
          config.tierBoundaries = this.parseTierBoundaries(record.config_value);
          break;
      }
    }

    config.formulaVersion = latestVersion;
    config.effectiveFrom = latestEffectiveFrom;

    return config;
  }

  /**
   * Parse expertise formula from config value.
   */
  private parseExpertiseFormula(value: Record<string, unknown>): ExpertiseLevelFormula {
    return {
      multiplier: typeof value['multiplier'] === 'number' ? value['multiplier'] : DEFAULT_EXPERTISE_FORMULA.multiplier,
      divisor: typeof value['divisor'] === 'number' ? value['divisor'] : DEFAULT_EXPERTISE_FORMULA.divisor,
      maxLevel: typeof value['maxLevel'] === 'number' ? value['maxLevel'] : DEFAULT_EXPERTISE_FORMULA.maxLevel,
    };
  }

  /**
   * Parse XP formula from config value.
   */
  private parseXPFormula(value: Record<string, unknown>): {
    baseXPFormula: BaseXPFormula;
    streakBonus: StreakBonus;
  } {
    return {
      baseXPFormula: {
        habitLevelMultiplier: typeof value['habitLevelMultiplier'] === 'number'
          ? value['habitLevelMultiplier']
          : DEFAULT_BASE_XP_FORMULA.habitLevelMultiplier,
        defaultHabitLevel: typeof value['defaultHabitLevel'] === 'number'
          ? value['defaultHabitLevel']
          : DEFAULT_BASE_XP_FORMULA.defaultHabitLevel,
      },
      streakBonus: {
        maxBonus: typeof value['streakMaxBonus'] === 'number'
          ? value['streakMaxBonus']
          : DEFAULT_STREAK_BONUS.maxBonus,
        multiplier: typeof value['streakMultiplier'] === 'number'
          ? value['streakMultiplier']
          : DEFAULT_STREAK_BONUS.multiplier,
      },
    };
  }

  /**
   * Parse XP multipliers from config value.
   */
  private parseXPMultipliers(value: Record<string, unknown>): XPMultiplierTiers {
    return {
      tier0_49: typeof value['tier0_49'] === 'number' ? value['tier0_49'] : DEFAULT_XP_MULTIPLIERS.tier0_49,
      tier50_79: typeof value['tier50_79'] === 'number' ? value['tier50_79'] : DEFAULT_XP_MULTIPLIERS.tier50_79,
      tier80_99: typeof value['tier80_99'] === 'number' ? value['tier80_99'] : DEFAULT_XP_MULTIPLIERS.tier80_99,
      tier100_120: typeof value['tier100_120'] === 'number' ? value['tier100_120'] : DEFAULT_XP_MULTIPLIERS.tier100_120,
      tier121_150: typeof value['tier121_150'] === 'number' ? value['tier121_150'] : DEFAULT_XP_MULTIPLIERS.tier121_150,
      tier151_plus: typeof value['tier151_plus'] === 'number' ? value['tier151_plus'] : DEFAULT_XP_MULTIPLIERS.tier151_plus,
    };
  }

  /**
   * Parse decay settings from config value.
   */
  private parseDecaySettings(value: Record<string, unknown>): DecaySettings {
    return {
      gracePeriodDays: typeof value['gracePeriodDays'] === 'number'
        ? value['gracePeriodDays']
        : DEFAULT_DECAY_SETTINGS.gracePeriodDays,
      decayPerWeek: typeof value['decayPerWeek'] === 'number'
        ? value['decayPerWeek']
        : DEFAULT_DECAY_SETTINGS.decayPerWeek,
      maxDecayPercent: typeof value['maxDecayPercent'] === 'number'
        ? value['maxDecayPercent']
        : DEFAULT_DECAY_SETTINGS.maxDecayPercent,
      recoveryBonusMultiplier: typeof value['recoveryBonusMultiplier'] === 'number'
        ? value['recoveryBonusMultiplier']
        : DEFAULT_DECAY_SETTINGS.recoveryBonusMultiplier,
      recoveryBonusDays: typeof value['recoveryBonusDays'] === 'number'
        ? value['recoveryBonusDays']
        : DEFAULT_DECAY_SETTINGS.recoveryBonusDays,
    };
  }

  /**
   * Parse tier boundaries from config value.
   */
  private parseTierBoundaries(value: Record<string, unknown>): TierBoundaries {
    const parseBoundary = (
      tier: unknown,
      defaultBoundary: TierBoundary
    ): TierBoundary => {
      if (typeof tier === 'object' && tier !== null) {
        const t = tier as Record<string, unknown>;
        return {
          min: typeof t['min'] === 'number' ? t['min'] : defaultBoundary.min,
          max: typeof t['max'] === 'number' ? t['max'] : defaultBoundary.max,
        };
      }
      return defaultBoundary;
    };

    return {
      beginner: parseBoundary(value['beginner'], DEFAULT_TIER_BOUNDARIES.beginner),
      intermediate: parseBoundary(value['intermediate'], DEFAULT_TIER_BOUNDARIES.intermediate),
      advanced: parseBoundary(value['advanced'], DEFAULT_TIER_BOUNDARIES.advanced),
      expert: parseBoundary(value['expert'], DEFAULT_TIER_BOUNDARIES.expert),
    };
  }

  /**
   * Update a configuration record in the database.
   *
   * This method:
   * 1. Sets effective_to on the current record (if exists)
   * 2. Inserts a new record with the updated value
   *
   * @param configKey - Configuration key
   * @param configValue - New configuration value
   * @param version - Formula version
   * @param changedBy - User making the change
   * @param timestamp - Timestamp of the change
   */
  private async updateConfigRecord(
    configKey: string,
    configValue: Record<string, unknown>,
    version: string,
    changedBy: string | undefined,
    timestamp: string
  ): Promise<void> {
    // First, set effective_to on the current active record
    const { error: updateError } = await this.supabase
      .from('level_config')
      .update({ effective_to: timestamp })
      .eq('config_key', configKey)
      .is('effective_to', null);

    if (updateError) {
      logger.warning('Failed to update existing config record', {
        configKey,
        error: updateError.message,
      });
      // Continue anyway - the record might not exist
    }

    // Insert new record
    const { error: insertError } = await this.supabase
      .from('level_config')
      .insert({
        config_key: configKey,
        config_value: configValue,
        version,
        effective_from: timestamp,
        effective_to: null,
        created_by: changedBy ?? null,
      });

    if (insertError) {
      logger.error('Failed to insert new config record', insertError, {
        configKey,
      });
      throw new Error(`Failed to update config ${configKey}: ${insertError.message}`);
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new LevelConfigService instance.
 *
 * @param supabase - Supabase client instance
 * @returns LevelConfigService instance
 */
export function createLevelConfigService(supabase: SupabaseClient): LevelConfigService {
  return new LevelConfigService(supabase);
}
