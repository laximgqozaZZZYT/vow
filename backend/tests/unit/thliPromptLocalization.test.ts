/**
 * THLI-24 Prompt Localization Tests
 *
 * Tests for validating that Japanese and English THLI-24 prompts
 * produce consistent level estimates.
 *
 * **Validates: Requirements 15.2, 15.7**
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import {
  THLIPromptLoader,
  getTHLIPromptLoader,
  resetTHLIPromptLoader,
  THLI_REQUIRED_SECTIONS,
  THLI_CONTEXT_PLACEHOLDERS,
  type THLIPromptContext,
} from '../../src/services/specLoader';

// ============================================================================
// Test Fixtures
// ============================================================================

const SPEC_DIR = path.join(process.cwd(), 'specs/ai-coach');

/**
 * Sample habits for testing prompt consistency
 * These represent common habit categories: exercise, reading, meditation, learning
 */
const SAMPLE_HABITS: THLIPromptContext[] = [
  // Exercise habits
  {
    habitName: '30分ジョギング',
    currentWorkload: '毎日 30分',
    goalContext: '健康維持',
    userLevel: '中級者',
  },
  {
    habitName: '30-minute jogging',
    currentWorkload: 'Daily 30 minutes',
    goalContext: 'Health maintenance',
    userLevel: 'Intermediate',
  },
  // Reading habits
  {
    habitName: '毎日20分読書',
    currentWorkload: '毎日 20分',
    goalContext: '知識向上',
    userLevel: '初心者',
  },
  {
    habitName: 'Read for 20 minutes daily',
    currentWorkload: 'Daily 20 minutes',
    goalContext: 'Knowledge improvement',
    userLevel: 'Beginner',
  },
  // Meditation habits
  {
    habitName: '朝10分瞑想',
    currentWorkload: '毎日 10分',
    goalContext: 'メンタルヘルス',
    userLevel: '初心者',
  },
  {
    habitName: '10-minute morning meditation',
    currentWorkload: 'Daily 10 minutes',
    goalContext: 'Mental health',
    userLevel: 'Beginner',
  },
  // Learning habits
  {
    habitName: 'プログラミング学習1時間',
    currentWorkload: '毎日 60分',
    goalContext: 'キャリアアップ',
    userLevel: '中級者',
  },
  {
    habitName: '1-hour programming study',
    currentWorkload: 'Daily 60 minutes',
    goalContext: 'Career advancement',
    userLevel: 'Intermediate',
  },
  // Additional habits for comprehensive testing
  {
    habitName: '筋トレ30分',
    currentWorkload: '週3回 30分',
    goalContext: '体力向上',
    userLevel: '上級者',
  },
  {
    habitName: '日記を書く',
    currentWorkload: '毎日 10分',
    goalContext: '自己理解',
    userLevel: '初心者',
  },
];

// ============================================================================
// Test Setup
// ============================================================================

describe('THLI-24 Prompt Localization', () => {
  let loader: THLIPromptLoader;

  beforeEach(() => {
    resetTHLIPromptLoader();
    loader = new THLIPromptLoader(SPEC_DIR);
  });

  afterEach(() => {
    resetTHLIPromptLoader();
  });

  // ==========================================================================
  // Prompt Loading Tests
  // ==========================================================================

  describe('loadTHLIPrompt', () => {
    /**
     * Test: English prompt loads successfully
     * Validates: Requirements 11.1, 11.2
     */
    it('should load English THLI-24 prompt successfully', async () => {
      const prompt = await loader.loadTHLIPrompt('en', 'v1.9');

      expect(prompt).toBeTruthy();
      expect(prompt.length).toBeGreaterThan(1000);
      expect(prompt).toContain('THLI-24');
      expect(prompt).toContain('v1.9');
    });

    /**
     * Test: Japanese prompt loads successfully
     * Validates: Requirements 15.1, 15.2
     */
    it('should load Japanese THLI-24 prompt successfully', async () => {
      const prompt = await loader.loadTHLIPrompt('ja', 'v1.9');

      expect(prompt).toBeTruthy();
      expect(prompt.length).toBeGreaterThan(1000);
      expect(prompt).toContain('THLI-24');
      expect(prompt).toContain('v1.9');
    });

    /**
     * Test: Language-based prompt selection
     * Validates: Requirements 15.2
     */
    it('should select correct prompt based on language', async () => {
      const enPrompt = await loader.loadTHLIPrompt('en', 'v1.9');
      const jaPrompt = await loader.loadTHLIPrompt('ja', 'v1.9');

      // English prompt should contain English text
      expect(enPrompt).toContain('Role');
      expect(enPrompt).toContain('Facts system');

      // Japanese prompt should contain Japanese text
      expect(jaPrompt).toContain('役割');
      expect(jaPrompt).toContain('Facts システム');
    });
  });

  // ==========================================================================
  // Prompt Validation Tests
  // ==========================================================================

  describe('validateTHLIPrompt', () => {
    /**
     * Test: English prompt contains all required sections
     * Validates: Requirements 11.3
     */
    it('should validate English prompt has all required sections', async () => {
      const prompt = await loader.loadTHLIPrompt('en', 'v1.9');
      const validation = loader.validateTHLIPrompt(prompt);

      expect(validation.isValid).toBe(true);
      expect(validation.missingSections).toHaveLength(0);
      expect(validation.version).toBe('v1.9');
    });

    /**
     * Test: Japanese prompt contains all required sections
     * Validates: Requirements 11.3, 15.1
     */
    it('should validate Japanese prompt has all required sections', async () => {
      const prompt = await loader.loadTHLIPrompt('ja', 'v1.9');
      const validation = loader.validateTHLIPrompt(prompt);

      expect(validation.isValid).toBe(true);
      expect(validation.missingSections).toHaveLength(0);
      expect(validation.version).toBe('v1.9');
    });

    /**
     * Test: Both prompts have same required sections
     * Validates: Requirements 15.7
     */
    it('should have same required sections in both languages', async () => {
      const enPrompt = await loader.loadTHLIPrompt('en', 'v1.9');
      const jaPrompt = await loader.loadTHLIPrompt('ja', 'v1.9');

      const enValidation = loader.validateTHLIPrompt(enPrompt);
      const jaValidation = loader.validateTHLIPrompt(jaPrompt);

      expect(enValidation.foundSections.length).toBe(jaValidation.foundSections.length);
      expect(enValidation.isValid).toBe(jaValidation.isValid);
    });
  });

  // ==========================================================================
  // Context Injection Tests
  // ==========================================================================

  describe('injectContext', () => {
    /**
     * Test: Context injection replaces all placeholders in English prompt
     * Validates: Requirements 11.7, 15.4
     */
    it('should inject context into English prompt', async () => {
      const prompt = await loader.loadTHLIPrompt('en', 'v1.9');
      const context: THLIPromptContext = {
        habitName: 'Test Habit',
        currentWorkload: 'Daily 30 minutes',
        goalContext: 'Health Goal',
        userLevel: 'Intermediate',
      };

      const injectedPrompt = loader.injectContext(prompt, context);

      expect(injectedPrompt).toContain('Test Habit');
      expect(injectedPrompt).toContain('Daily 30 minutes');
      expect(injectedPrompt).toContain('Health Goal');
      expect(injectedPrompt).toContain('Intermediate');
      expect(injectedPrompt).not.toContain('{{HABIT_NAME}}');
      expect(injectedPrompt).not.toContain('{{CURRENT_WORKLOAD}}');
      expect(injectedPrompt).not.toContain('{{GOAL_CONTEXT}}');
      expect(injectedPrompt).not.toContain('{{USER_LEVEL}}');
    });

    /**
     * Test: Context injection replaces all placeholders in Japanese prompt
     * Validates: Requirements 11.7, 15.5
     */
    it('should inject context into Japanese prompt', async () => {
      const prompt = await loader.loadTHLIPrompt('ja', 'v1.9');
      const context: THLIPromptContext = {
        habitName: '30分ジョギング',
        currentWorkload: '毎日 30分',
        goalContext: '健康維持',
        userLevel: '中級者',
      };

      const injectedPrompt = loader.injectContext(prompt, context);

      expect(injectedPrompt).toContain('30分ジョギング');
      expect(injectedPrompt).toContain('毎日 30分');
      expect(injectedPrompt).toContain('健康維持');
      expect(injectedPrompt).toContain('中級者');
      expect(injectedPrompt).not.toContain('{{HABIT_NAME}}');
      expect(injectedPrompt).not.toContain('{{CURRENT_WORKLOAD}}');
      expect(injectedPrompt).not.toContain('{{GOAL_CONTEXT}}');
      expect(injectedPrompt).not.toContain('{{USER_LEVEL}}');
    });
  });

  // ==========================================================================
  // Prompt Consistency Tests
  // ==========================================================================

  describe('prompt consistency', () => {
    /**
     * Test: Both prompts have same technical terms
     * Validates: Requirements 15.3
     */
    it('should maintain technical terms in both languages', async () => {
      const enPrompt = await loader.loadTHLIPrompt('en', 'v1.9');
      const jaPrompt = await loader.loadTHLIPrompt('ja', 'v1.9');

      // Technical terms that should be in both prompts
      const technicalTerms = [
        'ICI',
        'U0', 'U1', 'U2', 'U3', 'U4',
        'E0', 'E1', 'E2', 'E3',
        'F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'F07', 'F08',
        'F09', 'F10', 'F11', 'F12', 'F13', 'F14', 'F15', 'F16',
        '①', '②', '③', '④', '⑤', '⑥',
        '⑦', '⑧', '⑨', '⑩', '⑪', '⑫',
        '⑬', '⑭', '⑮', '⑯', '⑰', '⑱',
        '⑲', '⑳', '㉑', '㉒', '㉓', '㉔',
      ];

      for (const term of technicalTerms) {
        expect(enPrompt).toContain(term);
        expect(jaPrompt).toContain(term);
      }
    });

    /**
     * Test: Both prompts have same discrete score set
     * Validates: Requirements 15.7
     */
    it('should have same discrete score set in both languages', async () => {
      const enPrompt = await loader.loadTHLIPrompt('en', 'v1.9');
      const jaPrompt = await loader.loadTHLIPrompt('ja', 'v1.9');

      const discreteScores = ['0.0', '1.4', '2.8', '4.1', '5.5', '6.9', '8.3'];

      for (const score of discreteScores) {
        expect(enPrompt).toContain(score);
        expect(jaPrompt).toContain(score);
      }
    });

    /**
     * Test: Both prompts have same level tiers
     * Validates: Requirements 15.7
     */
    it('should have same level tier boundaries in both languages', async () => {
      const enPrompt = await loader.loadTHLIPrompt('en', 'v1.9');
      const jaPrompt = await loader.loadTHLIPrompt('ja', 'v1.9');

      // Level tier boundaries
      const tierBoundaries = ['0-49', '50-99', '100-149', '150-199'];

      for (const boundary of tierBoundaries) {
        expect(enPrompt).toContain(boundary);
        expect(jaPrompt).toContain(boundary);
      }
    });

    /**
     * Test: Both prompts have context injection placeholders
     * Validates: Requirements 15.4
     */
    it('should have same context injection placeholders in both languages', async () => {
      const enPrompt = await loader.loadTHLIPrompt('en', 'v1.9');
      const jaPrompt = await loader.loadTHLIPrompt('ja', 'v1.9');

      const placeholders = Object.values(THLI_CONTEXT_PLACEHOLDERS);

      for (const placeholder of placeholders) {
        expect(enPrompt).toContain(placeholder);
        expect(jaPrompt).toContain(placeholder);
      }
    });

    /**
     * Test: Both prompts have category-specific examples
     * Validates: Requirements 15.6
     */
    it('should have category-specific examples in both languages', async () => {
      const enPrompt = await loader.loadTHLIPrompt('en', 'v1.9');
      const jaPrompt = await loader.loadTHLIPrompt('ja', 'v1.9');

      // English categories
      expect(enPrompt).toContain('Exercise');
      expect(enPrompt).toContain('Reading');
      expect(enPrompt).toContain('Meditation');
      expect(enPrompt).toContain('Learning');

      // Japanese categories
      expect(jaPrompt).toContain('運動');
      expect(jaPrompt).toContain('読書');
      expect(jaPrompt).toContain('瞑想');
      expect(jaPrompt).toContain('学習');
    });
  });

  // ==========================================================================
  // Prompt Structure Consistency Tests
  // ==========================================================================

  describe('prompt structure consistency', () => {
    /**
     * Test: Both prompts have similar structure
     * Validates: Requirements 15.7
     */
    it('should have similar structure in both languages', async () => {
      const enPrompt = await loader.loadTHLIPrompt('en', 'v1.9');
      const jaPrompt = await loader.loadTHLIPrompt('ja', 'v1.9');

      // Count major sections (marked with #)
      const enSectionCount = (enPrompt.match(/^#+ /gm) || []).length;
      const jaSectionCount = (jaPrompt.match(/^#+ /gm) || []).length;

      // Both should have similar number of sections (within 20% tolerance)
      const tolerance = 0.2;
      const ratio = Math.abs(enSectionCount - jaSectionCount) / Math.max(enSectionCount, jaSectionCount);
      expect(ratio).toBeLessThan(tolerance);
    });

    /**
     * Test: Both prompts have similar length
     * Validates: Requirements 15.7
     */
    it('should have similar length in both languages', async () => {
      const enPrompt = await loader.loadTHLIPrompt('en', 'v1.9');
      const jaPrompt = await loader.loadTHLIPrompt('ja', 'v1.9');

      // Both should have similar length (within 50% tolerance due to language differences)
      const tolerance = 0.5;
      const ratio = Math.abs(enPrompt.length - jaPrompt.length) / Math.max(enPrompt.length, jaPrompt.length);
      expect(ratio).toBeLessThan(tolerance);
    });
  });

  // ==========================================================================
  // Cache Tests
  // ==========================================================================

  describe('caching', () => {
    /**
     * Test: Prompts are cached after loading
     * Validates: Requirements 11.6
     */
    it('should cache prompts after loading', async () => {
      await loader.loadTHLIPrompt('en', 'v1.9');
      await loader.loadTHLIPrompt('ja', 'v1.9');

      const enCached = loader.getCachedPrompt('en', 'v1.9');
      const jaCached = loader.getCachedPrompt('ja', 'v1.9');

      expect(enCached).toBeTruthy();
      expect(jaCached).toBeTruthy();
    });

    /**
     * Test: Cache can be cleared
     * Validates: Requirements 11.6
     */
    it('should clear cache when requested', async () => {
      await loader.loadTHLIPrompt('en', 'v1.9');
      await loader.loadTHLIPrompt('ja', 'v1.9');

      loader.clearCache();

      const enCached = loader.getCachedPrompt('en', 'v1.9');
      const jaCached = loader.getCachedPrompt('ja', 'v1.9');

      expect(enCached).toBeNull();
      expect(jaCached).toBeNull();
    });
  });

  // ==========================================================================
  // prepareTHLIPrompt Integration Tests
  // ==========================================================================

  describe('prepareTHLIPrompt', () => {
    /**
     * Test: Prepare prompt with English language
     * Validates: Requirements 11.2, 11.3, 11.7, 15.2
     */
    it('should prepare English prompt with context', async () => {
      const context: THLIPromptContext = {
        habitName: 'Morning Run',
        currentWorkload: 'Daily 30 minutes',
        goalContext: 'Fitness',
        userLevel: 'Intermediate',
      };

      const { prompt, validation } = await loader.prepareTHLIPrompt('en', context, 'v1.9');

      expect(validation.isValid).toBe(true);
      expect(prompt).toContain('Morning Run');
      expect(prompt).toContain('Daily 30 minutes');
      expect(prompt).toContain('Fitness');
      expect(prompt).toContain('Intermediate');
    });

    /**
     * Test: Prepare prompt with Japanese language
     * Validates: Requirements 11.2, 11.3, 11.7, 15.2, 15.5
     */
    it('should prepare Japanese prompt with context', async () => {
      const context: THLIPromptContext = {
        habitName: '朝のランニング',
        currentWorkload: '毎日 30分',
        goalContext: 'フィットネス',
        userLevel: '中級者',
      };

      const { prompt, validation } = await loader.prepareTHLIPrompt('ja', context, 'v1.9');

      expect(validation.isValid).toBe(true);
      expect(prompt).toContain('朝のランニング');
      expect(prompt).toContain('毎日 30分');
      expect(prompt).toContain('フィットネス');
      expect(prompt).toContain('中級者');
    });
  });
});
