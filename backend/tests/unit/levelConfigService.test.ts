/**
 * LevelConfigService Unit Tests
 *
 * Tests for the Level Config Service that manages level calculation
 * configuration and feature flags for the Level System Rebalancing feature.
 *
 * **Validates: Requirements 1.7, 11.1, 11.2**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  LevelConfigService,
  createLevelConfigService,
  type LevelConfig,
  type ExpertiseLevelFormula,
  type BaseXPFormula,
  type StreakBonus,
  type XPMultiplierTiers,
  type DecaySettings,
  type TierBoundaries,
} from '@/services/levelConfigService';
import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// Mock Supabase Client Factory
// ============================================================================

interface MockQueryBuilder {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  not: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
}

function createMockSupabaseClient(): {
  client: SupabaseClient;
  mockFrom: ReturnType<typeof vi.fn>;
  mockQueryBuilder: MockQueryBuilder;
} {
  const mockQueryBuilder: MockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
  };

  const mockFrom = vi.fn().mockReturnValue(mockQueryBuilder);

  const client = {
    from: mockFrom,
  } as unknown as SupabaseClient;

  return { client, mockFrom, mockQueryBuilder };
}

// ============================================================================
// Test Fixtures
// ============================================================================

const DEFAULT_EXPERTISE_FORMULA: ExpertiseLevelFormula = {
  multiplier: 5,
  divisor: 1000,
  maxLevel: 9999,
};

const DEFAULT_BASE_XP_FORMULA: BaseXPFormula = {
  habitLevelMultiplier: 2,
  defaultHabitLevel: 25,
};

const DEFAULT_STREAK_BONUS: StreakBonus = {
  maxBonus: 30,
  multiplier: 1,
};

const DEFAULT_XP_MULTIPLIERS: XPMultiplierTiers = {
  tier0_49: 0.2,
  tier50_79: 0.5,
  tier80_99: 0.8,
  tier100_120: 1.0,
  tier121_150: 0.85,
  tier151_plus: 0.6,
};

const DEFAULT_DECAY_SETTINGS: DecaySettings = {
  gracePeriodDays: 21,
  decayPerWeek: 0.5,
  maxDecayPercent: 0.15,
  recoveryBonusMultiplier: 1.5,
  recoveryBonusDays: 7,
};

const DEFAULT_TIER_BOUNDARIES: TierBoundaries = {
  beginner: { min: 0, max: 49 },
  intermediate: { min: 50, max: 99 },
  advanced: { min: 100, max: 499 },
  expert: { min: 500, max: 9999 },
};

/**
 * Create mock level_config records
 */
function createMockConfigRecords() {
  const now = new Date().toISOString();
  return [
    {
      id: 'config-1',
      config_key: 'expertise_formula',
      config_value: { multiplier: 5, divisor: 1000, maxLevel: 9999 },
      version: 'v2.0',
      effective_from: now,
      effective_to: null,
      created_by: 'system',
      created_at: now,
      updated_at: now,
    },
    {
      id: 'config-2',
      config_key: 'xp_formula',
      config_value: {
        habitLevelMultiplier: 2,
        defaultHabitLevel: 25,
        streakMaxBonus: 30,
        streakMultiplier: 1,
        dailyCapPerHabit: 100,
      },
      version: 'v2.0',
      effective_from: now,
      effective_to: null,
      created_by: 'system',
      created_at: now,
      updated_at: now,
    },
    {
      id: 'config-3',
      config_key: 'xp_multipliers',
      config_value: DEFAULT_XP_MULTIPLIERS,
      version: 'v2.0',
      effective_from: now,
      effective_to: null,
      created_by: 'system',
      created_at: now,
      updated_at: now,
    },
    {
      id: 'config-4',
      config_key: 'decay_settings',
      config_value: DEFAULT_DECAY_SETTINGS,
      version: 'v2.0',
      effective_from: now,
      effective_to: null,
      created_by: 'system',
      created_at: now,
      updated_at: now,
    },
    {
      id: 'config-5',
      config_key: 'tier_boundaries',
      config_value: DEFAULT_TIER_BOUNDARIES,
      version: 'v2.0',
      effective_from: now,
      effective_to: null,
      created_by: 'system',
      created_at: now,
      updated_at: now,
    },
  ];
}

// ============================================================================
// LevelConfigService Tests
// ============================================================================

describe('LevelConfigService', () => {
  let service: LevelConfigService;
  let mockClient: SupabaseClient;
  let mockFrom: ReturnType<typeof vi.fn>;
  let mockQueryBuilder: MockQueryBuilder;

  beforeEach(() => {
    const mocks = createMockSupabaseClient();
    mockClient = mocks.client;
    mockFrom = mocks.mockFrom;
    mockQueryBuilder = mocks.mockQueryBuilder;
    service = new LevelConfigService(mockClient);
  });

  // ==========================================================================
  // Factory Function Tests
  // ==========================================================================

  describe('createLevelConfigService', () => {
    it('should create a LevelConfigService instance', () => {
      const instance = createLevelConfigService(mockClient);
      expect(instance).toBeInstanceOf(LevelConfigService);
    });
  });

  // ==========================================================================
  // getCurrentConfig Tests
  // Validates: Requirements 1.7, 11.1
  // ==========================================================================

  describe('getCurrentConfig', () => {
    /**
     * **Validates: Requirements 1.7, 11.1**
     * THE System SHALL store the formula version in a configuration table
     */
    it('should return configuration from database', async () => {
      const mockRecords = createMockConfigRecords();
      mockQueryBuilder.order.mockResolvedValue({ data: mockRecords, error: null });

      const config = await service.getCurrentConfig();

      expect(mockFrom).toHaveBeenCalledWith('level_config');
      expect(config.formulaVersion).toBe('v2.0');
      expect(config.expertiseLevelFormula).toEqual(DEFAULT_EXPERTISE_FORMULA);
      expect(config.baseXPFormula).toEqual(DEFAULT_BASE_XP_FORMULA);
      expect(config.streakBonus).toEqual(DEFAULT_STREAK_BONUS);
      expect(config.xpMultipliers).toEqual(DEFAULT_XP_MULTIPLIERS);
      expect(config.decaySettings).toEqual(DEFAULT_DECAY_SETTINGS);
      expect(config.tierBoundaries).toEqual(DEFAULT_TIER_BOUNDARIES);
    });

    it('should return default configuration when no records found', async () => {
      mockQueryBuilder.order.mockResolvedValue({ data: [], error: null });

      const config = await service.getCurrentConfig();

      expect(config.formulaVersion).toBe('v2.0');
      expect(config.expertiseLevelFormula).toEqual(DEFAULT_EXPERTISE_FORMULA);
    });

    it('should return default configuration on database error', async () => {
      mockQueryBuilder.order.mockResolvedValue({
        data: null,
        error: { code: 'PGRST000', message: 'Database error' },
      });

      const config = await service.getCurrentConfig();

      expect(config.formulaVersion).toBe('v2.0');
      expect(config.expertiseLevelFormula).toEqual(DEFAULT_EXPERTISE_FORMULA);
    });

    it('should parse expertise formula correctly', async () => {
      const mockRecords = [
        {
          id: 'config-1',
          config_key: 'expertise_formula',
          config_value: { multiplier: 10, divisor: 500, maxLevel: 5000 },
          version: 'v3.0',
          effective_from: new Date().toISOString(),
          effective_to: null,
          created_by: 'admin',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
      mockQueryBuilder.order.mockResolvedValue({ data: mockRecords, error: null });

      const config = await service.getCurrentConfig();

      expect(config.expertiseLevelFormula.multiplier).toBe(10);
      expect(config.expertiseLevelFormula.divisor).toBe(500);
      expect(config.expertiseLevelFormula.maxLevel).toBe(5000);
    });

    it('should use default values for missing config fields', async () => {
      const mockRecords = [
        {
          id: 'config-1',
          config_key: 'expertise_formula',
          config_value: { multiplier: 7 }, // Missing divisor and maxLevel
          version: 'v2.0',
          effective_from: new Date().toISOString(),
          effective_to: null,
          created_by: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
      mockQueryBuilder.order.mockResolvedValue({ data: mockRecords, error: null });

      const config = await service.getCurrentConfig();

      expect(config.expertiseLevelFormula.multiplier).toBe(7);
      expect(config.expertiseLevelFormula.divisor).toBe(1000); // Default
      expect(config.expertiseLevelFormula.maxLevel).toBe(9999); // Default
    });
  });

  // ==========================================================================
  // updateConfig Tests
  // Validates: Requirements 11.1, 11.5
  // ==========================================================================

  describe('updateConfig', () => {
    /**
     * **Validates: Requirements 11.1, 11.5**
     * THE System SHALL log all formula changes with timestamp and admin user
     */
    it('should update expertise formula configuration', async () => {
      // Mock the update and insert operations
      mockQueryBuilder.update.mockReturnThis();
      mockQueryBuilder.eq.mockReturnThis();
      mockQueryBuilder.is.mockResolvedValue({ error: null });
      mockQueryBuilder.insert.mockResolvedValue({ error: null });
      
      // Mock getCurrentConfig for the return value
      const mockRecords = createMockConfigRecords();
      mockQueryBuilder.order.mockResolvedValue({ data: mockRecords, error: null });

      const newFormula: ExpertiseLevelFormula = {
        multiplier: 6,
        divisor: 1200,
        maxLevel: 8000,
      };

      const config = await service.updateConfig(
        { expertiseLevelFormula: newFormula },
        'admin-user'
      );

      expect(mockFrom).toHaveBeenCalledWith('level_config');
      expect(config).toBeDefined();
    });

    it('should update XP multipliers configuration', async () => {
      mockQueryBuilder.update.mockReturnThis();
      mockQueryBuilder.eq.mockReturnThis();
      mockQueryBuilder.is.mockResolvedValue({ error: null });
      mockQueryBuilder.insert.mockResolvedValue({ error: null });
      
      const mockRecords = createMockConfigRecords();
      mockQueryBuilder.order.mockResolvedValue({ data: mockRecords, error: null });

      const newMultipliers: XPMultiplierTiers = {
        tier0_49: 0.3,
        tier50_79: 0.6,
        tier80_99: 0.9,
        tier100_120: 1.0,
        tier121_150: 0.9,
        tier151_plus: 0.7,
      };

      const config = await service.updateConfig(
        { xpMultipliers: newMultipliers },
        'admin-user'
      );

      expect(config).toBeDefined();
    });

    it('should throw error on insert failure', async () => {
      mockQueryBuilder.update.mockReturnThis();
      mockQueryBuilder.eq.mockReturnThis();
      mockQueryBuilder.is.mockResolvedValue({ error: null });
      mockQueryBuilder.insert.mockResolvedValue({
        error: { code: 'PGRST000', message: 'Insert failed' },
      });

      await expect(
        service.updateConfig({ expertiseLevelFormula: DEFAULT_EXPERTISE_FORMULA })
      ).rejects.toThrow('Failed to update config');
    });
  });

  // ==========================================================================
  // getFeatureFlag Tests
  // Validates: Requirements 11.2, 11.3
  // ==========================================================================

  describe('getFeatureFlag', () => {
    /**
     * **Validates: Requirements 11.2, 11.3**
     * THE System SHALL support feature flags for gradual rollout
     */
    it('should return true when flag is enabled', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: {
          flag_name: 'level_rebalancing_enabled',
          flag_value: true,
          rollout_percentage: 100,
        },
        error: null,
      });

      const result = await service.getFeatureFlag('level_rebalancing_enabled');

      expect(mockFrom).toHaveBeenCalledWith('feature_flags');
      expect(result).toBe(true);
    });

    it('should return false when flag is disabled', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: {
          flag_name: 'level_rebalancing_enabled',
          flag_value: false,
          rollout_percentage: 100,
        },
        error: null,
      });

      const result = await service.getFeatureFlag('level_rebalancing_enabled');

      expect(result).toBe(false);
    });

    it('should return false when flag not found', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });

      const result = await service.getFeatureFlag('non_existent_flag');

      expect(result).toBe(false);
    });

    it('should return false on database error', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST000', message: 'Database error' },
      });

      const result = await service.getFeatureFlag('level_rebalancing_enabled');

      expect(result).toBe(false);
    });

    it('should apply rollout percentage for partial rollout', async () => {
      // Mock Math.random to return a predictable value
      const mockRandom = vi.spyOn(Math, 'random');
      
      // Test case: rollout at 50%, random returns 0.3 (30%) - should enable
      mockRandom.mockReturnValue(0.3);
      mockQueryBuilder.single.mockResolvedValue({
        data: {
          flag_name: 'test_flag',
          flag_value: true,
          rollout_percentage: 50,
        },
        error: null,
      });

      const result1 = await service.getFeatureFlag('test_flag');
      expect(result1).toBe(true);

      // Test case: rollout at 50%, random returns 0.7 (70%) - should disable
      mockRandom.mockReturnValue(0.7);
      const result2 = await service.getFeatureFlag('test_flag');
      expect(result2).toBe(false);

      mockRandom.mockRestore();
    });
  });

  // ==========================================================================
  // setFeatureFlag Tests
  // Validates: Requirements 11.2, 11.5
  // ==========================================================================

  describe('setFeatureFlag', () => {
    /**
     * **Validates: Requirements 11.2, 11.5**
     * THE System SHALL support setting feature flags
     */
    it('should update feature flag value', async () => {
      mockQueryBuilder.eq.mockResolvedValue({ error: null });

      await service.setFeatureFlag('level_rebalancing_enabled', true, 'admin-user');

      expect(mockFrom).toHaveBeenCalledWith('feature_flags');
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          flag_value: true,
        })
      );
    });

    it('should throw error on update failure', async () => {
      mockQueryBuilder.eq.mockResolvedValue({
        error: { code: 'PGRST000', message: 'Update failed' },
      });

      await expect(
        service.setFeatureFlag('level_rebalancing_enabled', true)
      ).rejects.toThrow('Failed to set feature flag');
    });
  });

  // ==========================================================================
  // getAllFeatureFlags Tests
  // ==========================================================================

  describe('getAllFeatureFlags', () => {
    it('should return all feature flags as a map', async () => {
      mockQueryBuilder.select.mockResolvedValue({
        data: [
          { flag_name: 'level_rebalancing_enabled', flag_value: true },
          { flag_name: 'migration_in_progress', flag_value: false },
          { flag_name: 'new_xp_formula_enabled', flag_value: true },
        ],
        error: null,
      });

      const flags = await service.getAllFeatureFlags();

      expect(flags.get('level_rebalancing_enabled')).toBe(true);
      expect(flags.get('migration_in_progress')).toBe(false);
      expect(flags.get('new_xp_formula_enabled')).toBe(true);
      expect(flags.size).toBe(3);
    });

    it('should return empty map on error', async () => {
      mockQueryBuilder.select.mockResolvedValue({
        data: null,
        error: { code: 'PGRST000', message: 'Database error' },
      });

      const flags = await service.getAllFeatureFlags();

      expect(flags.size).toBe(0);
    });
  });

  // ==========================================================================
  // getConfigHistory Tests
  // Validates: Requirements 11.5
  // ==========================================================================

  describe('getConfigHistory', () => {
    /**
     * **Validates: Requirements 11.5**
     * THE System SHALL log all formula changes with timestamp
     */
    it('should return configuration history', async () => {
      const historicalRecords = [
        {
          id: 'history-1',
          config_key: 'expertise_formula',
          config_value: { multiplier: 10, divisor: 100 },
          version: 'v1.0',
          effective_from: '2024-01-01T00:00:00Z',
          effective_to: '2024-06-01T00:00:00Z',
          created_by: 'system',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];
      mockQueryBuilder.limit.mockResolvedValue({ data: historicalRecords, error: null });

      const history = await service.getConfigHistory();

      expect(mockFrom).toHaveBeenCalledWith('level_config');
      expect(history).toHaveLength(1);
      expect(history[0]?.configKey).toBe('expertise_formula');
    });

    it('should return empty array on error', async () => {
      mockQueryBuilder.limit.mockResolvedValue({
        data: null,
        error: { code: 'PGRST000', message: 'Database error' },
      });

      const history = await service.getConfigHistory();

      expect(history).toHaveLength(0);
    });

    it('should respect limit parameter', async () => {
      mockQueryBuilder.limit.mockResolvedValue({ data: [], error: null });

      await service.getConfigHistory(10);

      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(10);
    });
  });

  // ==========================================================================
  // Convenience Method Tests
  // ==========================================================================

  describe('isRebalancingEnabled', () => {
    it('should return feature flag value for level_rebalancing_enabled', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: {
          flag_name: 'level_rebalancing_enabled',
          flag_value: true,
          rollout_percentage: 100,
        },
        error: null,
      });

      const result = await service.isRebalancingEnabled();

      expect(result).toBe(true);
    });
  });

  describe('isMigrationInProgress', () => {
    it('should return feature flag value for migration_in_progress', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: {
          flag_name: 'migration_in_progress',
          flag_value: false,
          rollout_percentage: 100,
        },
        error: null,
      });

      const result = await service.isMigrationInProgress();

      expect(result).toBe(false);
    });
  });

  describe('isNewXPFormulaEnabled', () => {
    it('should return feature flag value for new_xp_formula_enabled', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: {
          flag_name: 'new_xp_formula_enabled',
          flag_value: true,
          rollout_percentage: 100,
        },
        error: null,
      });

      const result = await service.isNewXPFormulaEnabled();

      expect(result).toBe(true);
    });
  });
});
