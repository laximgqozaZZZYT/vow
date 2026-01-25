/**
 * SpecLoader Unit Tests
 *
 * Tests for the SpecLoader service that loads AI Coach specifications
 * from external markdown files.
 *
 * **Validates: Requirements 1.1, 1.2, 1.4**
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import {
  SpecLoader,
  getSpecLoader,
  resetSpecLoader,
  getDefaultSpecs,
  type SpecContent,
} from '../../src/services/specLoader';

// ============================================================================
// Test Fixtures
// ============================================================================

const TEST_SPEC_DIR = path.join(process.cwd(), 'tests/fixtures/specs/ai-coach');

const mockSpecContent: SpecContent = {
  role: '# Role\n\nTest role content',
  guardrails: '# Guardrails\n\nTest guardrails content',
  conversation: '# Conversation\n\nTest conversation content',
  habits: '# Habits\n\nTest habits content',
  responseFormat: '# Response Format\n\nTest response format content',
};

// ============================================================================
// Test Setup
// ============================================================================

describe('SpecLoader', () => {
  beforeEach(() => {
    resetSpecLoader();
  });

  afterEach(() => {
    resetSpecLoader();
  });

  // ==========================================================================
  // Constructor Tests
  // ==========================================================================

  describe('constructor', () => {
    it('should create instance with default spec directory', () => {
      const loader = new SpecLoader();
      expect(loader).toBeInstanceOf(SpecLoader);
    });

    it('should create instance with custom spec directory', () => {
      const loader = new SpecLoader('/custom/path');
      expect(loader).toBeInstanceOf(SpecLoader);
    });
  });

  // ==========================================================================
  // loadSpecs Tests
  // ==========================================================================

  describe('loadSpecs', () => {
    it('should load specs from actual spec directory', async () => {
      const specDir = path.join(process.cwd(), 'specs/ai-coach');
      const loader = new SpecLoader(specDir);

      const specs = await loader.loadSpecs();

      // Verify all spec sections are loaded
      expect(specs.role).toBeTruthy();
      expect(specs.guardrails).toBeTruthy();
      expect(specs.conversation).toBeTruthy();
      expect(specs.habits).toBeTruthy();
      expect(specs.responseFormat).toBeTruthy();

      // Verify content contains expected markers
      expect(specs.role).toContain('AI Coach');
      expect(specs.guardrails).toContain('Guardrails');
      expect(specs.conversation).toContain('Conversation');
      expect(specs.habits).toContain('Habit');
      expect(specs.responseFormat).toContain('Response');
    });

    it('should return default specs when directory does not exist', async () => {
      const loader = new SpecLoader('/non/existent/path');

      const specs = await loader.loadSpecs();
      const defaults = getDefaultSpecs();

      // Should return default values
      expect(specs.role).toBe(defaults.role);
      expect(specs.guardrails).toBe(defaults.guardrails);
      expect(specs.conversation).toBe(defaults.conversation);
      expect(specs.habits).toBe(defaults.habits);
      expect(specs.responseFormat).toBe(defaults.responseFormat);
    });

    it('should cache loaded specs', async () => {
      const specDir = path.join(process.cwd(), 'specs/ai-coach');
      const loader = new SpecLoader(specDir);

      // First load
      await loader.loadSpecs();
      const cached = loader.getCachedSpecs();

      expect(cached).not.toBeNull();
      expect(cached?.role).toBeTruthy();
    });

    it('should use custom specDir parameter when provided', async () => {
      const loader = new SpecLoader('/default/path');
      const customDir = path.join(process.cwd(), 'specs/ai-coach');

      const specs = await loader.loadSpecs(customDir);

      expect(specs.role).toContain('AI Coach');
    });
  });

  // ==========================================================================
  // buildSystemPrompt Tests
  // ==========================================================================

  describe('buildSystemPrompt', () => {
    it('should combine all spec sections into a single prompt', () => {
      const loader = new SpecLoader();

      const prompt = loader.buildSystemPrompt(mockSpecContent);

      // Verify all sections are included
      expect(prompt).toContain('# Role');
      expect(prompt).toContain('# Guardrails');
      expect(prompt).toContain('# Conversation');
      expect(prompt).toContain('# Habits');
      expect(prompt).toContain('# Response Format');
    });

    it('should separate sections with double newlines', () => {
      const loader = new SpecLoader();

      const prompt = loader.buildSystemPrompt(mockSpecContent);

      // Sections should be separated by double newlines
      expect(prompt).toContain('\n\n');
    });

    it('should filter out empty sections', () => {
      const loader = new SpecLoader();
      const specsWithEmpty: SpecContent = {
        ...mockSpecContent,
        habits: '',
        responseFormat: '   ',
      };

      const prompt = loader.buildSystemPrompt(specsWithEmpty);

      // Should not contain empty sections
      expect(prompt).toContain('# Role');
      expect(prompt).toContain('# Guardrails');
      expect(prompt).toContain('# Conversation');
      expect(prompt).not.toContain('# Habits');
      expect(prompt).not.toContain('# Response Format');
    });

    it('should produce correct prompt from actual spec files', async () => {
      const specDir = path.join(process.cwd(), 'specs/ai-coach');
      const loader = new SpecLoader(specDir);

      const specs = await loader.loadSpecs();
      const prompt = loader.buildSystemPrompt(specs);

      // Verify prompt contains content from all files
      expect(prompt.length).toBeGreaterThan(1000);
      expect(prompt).toContain('Vow');
      expect(prompt).toContain('習慣');
    });
  });

  // ==========================================================================
  // Cache Management Tests
  // ==========================================================================

  describe('cache management', () => {
    it('should return null when no specs are cached', () => {
      const loader = new SpecLoader();

      const cached = loader.getCachedSpecs();

      expect(cached).toBeNull();
    });

    it('should clear cache when clearCache is called', async () => {
      const specDir = path.join(process.cwd(), 'specs/ai-coach');
      const loader = new SpecLoader(specDir);

      await loader.loadSpecs();
      expect(loader.getCachedSpecs()).not.toBeNull();

      loader.clearCache();
      expect(loader.getCachedSpecs()).toBeNull();
    });
  });

  // ==========================================================================
  // Singleton Tests
  // ==========================================================================

  describe('singleton pattern', () => {
    it('should return same instance from getSpecLoader', () => {
      const loader1 = getSpecLoader();
      const loader2 = getSpecLoader();

      expect(loader1).toBe(loader2);
    });

    it('should reset singleton when resetSpecLoader is called', () => {
      const loader1 = getSpecLoader();
      resetSpecLoader();
      const loader2 = getSpecLoader();

      expect(loader1).not.toBe(loader2);
    });
  });

  // ==========================================================================
  // Default Specs Tests
  // ==========================================================================

  describe('getDefaultSpecs', () => {
    it('should return all required spec sections', () => {
      const defaults = getDefaultSpecs();

      expect(defaults.role).toBeTruthy();
      expect(defaults.guardrails).toBeTruthy();
      expect(defaults.conversation).toBeTruthy();
      expect(defaults.habits).toBeTruthy();
      expect(defaults.responseFormat).toBeTruthy();
    });

    it('should return a copy of defaults (not the original)', () => {
      const defaults1 = getDefaultSpecs();
      const defaults2 = getDefaultSpecs();

      defaults1.role = 'modified';

      expect(defaults2.role).not.toBe('modified');
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('error handling', () => {
    it('should handle missing individual files gracefully', async () => {
      // Create a temporary directory with only some files
      const tempDir = path.join(process.cwd(), 'tests/fixtures/partial-specs');

      try {
        await fs.mkdir(tempDir, { recursive: true });
        await fs.writeFile(path.join(tempDir, 'role.md'), '# Test Role');
        // Other files are missing

        const loader = new SpecLoader(tempDir);
        const specs = await loader.loadSpecs();

        // Should have loaded role.md
        expect(specs.role).toBe('# Test Role');

        // Should have defaults for missing files
        const defaults = getDefaultSpecs();
        expect(specs.guardrails).toBe(defaults.guardrails);
        expect(specs.conversation).toBe(defaults.conversation);
        expect(specs.habits).toBe(defaults.habits);
        expect(specs.responseFormat).toBe(defaults.responseFormat);
      } finally {
        // Cleanup
        try {
          await fs.rm(tempDir, { recursive: true });
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    it('should handle empty files by using defaults', async () => {
      const tempDir = path.join(process.cwd(), 'tests/fixtures/empty-specs');

      try {
        await fs.mkdir(tempDir, { recursive: true });
        await fs.writeFile(path.join(tempDir, 'role.md'), '');
        await fs.writeFile(path.join(tempDir, 'guardrails.md'), '   ');

        const loader = new SpecLoader(tempDir);
        const specs = await loader.loadSpecs();

        const defaults = getDefaultSpecs();
        expect(specs.role).toBe(defaults.role);
        expect(specs.guardrails).toBe(defaults.guardrails);
      } finally {
        try {
          await fs.rm(tempDir, { recursive: true });
        } catch {
          // Ignore cleanup errors
        }
      }
    });
  });
});
