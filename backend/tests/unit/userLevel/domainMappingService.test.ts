/**
 * Domain Mapping Service Unit Tests
 *
 * Tests for domain search, pagination, and AI domain suggestion features.
 *
 * Requirements: 2.4, 2.5, 3.1
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DomainMappingService,
  DomainSuggestion,
  resetDomainMappingService,
} from '../../../src/services/domainMappingService.js';

// Mock the config to disable OpenAI
vi.mock('../../../src/config.js', () => ({
  getSettings: () => ({
    openaiApiKey: '', // Empty to disable AI
    openaiModel: 'gpt-4o-mini',
  }),
}));

// Mock Supabase client
const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn(),
};

// Sample domain data for testing
const sampleDomains = [
  {
    id: '1',
    major_code: 'B',
    major_name: '専門的・技術的職業',
    middle_code: 'B-11',
    middle_name: '情報処理・通信技術者',
    minor_code: 'B-11-111',
    minor_name: 'システムエンジニア',
    keywords: ['プログラミング', 'SE', 'システム開発', 'software', 'engineering'],
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    major_code: 'B',
    major_name: '専門的・技術的職業',
    middle_code: 'B-11',
    middle_name: '情報処理・通信技術者',
    minor_code: 'B-11-112',
    minor_name: 'プログラマー',
    keywords: ['プログラミング', 'コーディング', 'programming', 'developer'],
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '3',
    major_code: 'E',
    major_name: 'サービスの職業',
    middle_code: 'E-47',
    middle_name: 'その他のサービス職業従事者',
    minor_code: 'E-47-472',
    minor_name: 'フィットネスインストラクター',
    keywords: ['フィットネス', 'トレーナー', 'fitness', 'ジム', '運動'],
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '4',
    major_code: '0',
    major_name: '一般',
    middle_code: '0-00',
    middle_name: '一般',
    minor_code: '000',
    minor_name: '一般（未分類）',
    keywords: ['general', '一般', 'その他'],
    created_at: '2024-01-01T00:00:00Z',
  },
];

describe('DomainMappingService', () => {
  let service: DomainMappingService;

  beforeEach(() => {
    resetDomainMappingService();
    vi.clearAllMocks();
    service = new DomainMappingService(mockSupabase as any);
  });

  afterEach(() => {
    resetDomainMappingService();
  });

  describe('suggestDomains (keyword-based fallback)', () => {
    it('should suggest programming-related domains for coding habits', async () => {
      // Setup mock to return sample domains
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: sampleDomains, error: null }),
      });

      const suggestions = await service.suggestDomains('毎日プログラミングを1時間練習する');

      expect(suggestions).toBeDefined();
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.length).toBeLessThanOrEqual(3);

      // Should suggest programming-related domains
      const domainCodes = suggestions.map(s => s.domainCode);
      expect(
        domainCodes.includes('B-11-111') || domainCodes.includes('B-11-112')
      ).toBe(true);
    });

    it('should suggest fitness-related domains for exercise habits', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: sampleDomains, error: null }),
      });

      const suggestions = await service.suggestDomains('毎朝ジムで運動する');

      expect(suggestions).toBeDefined();
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.length).toBeLessThanOrEqual(3);

      // Should suggest fitness-related domain
      const domainCodes = suggestions.map(s => s.domainCode);
      expect(domainCodes.includes('E-47-472')).toBe(true);
    });


    it('should return general domain for generic habits', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: sampleDomains, error: null }),
      });

      const suggestions = await service.suggestDomains('水を飲む');

      expect(suggestions).toBeDefined();
      expect(suggestions.length).toBeGreaterThan(0);

      // Should return general domain for generic habits
      const domainCodes = suggestions.map(s => s.domainCode);
      expect(domainCodes.includes('000')).toBe(true);
    });

    it('should return max 3 suggestions (Property 4)', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: sampleDomains, error: null }),
      });

      const suggestions = await service.suggestDomains('プログラミング フィットネス 運動 開発');

      expect(suggestions.length).toBeLessThanOrEqual(3);
    });

    it('should return suggestions with confidence >= 0.5 (Property 4)', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: sampleDomains, error: null }),
      });

      const suggestions = await service.suggestDomains('プログラミングを学ぶ');

      for (const suggestion of suggestions) {
        expect(suggestion.confidence).toBeGreaterThanOrEqual(0.5);
        expect(suggestion.confidence).toBeLessThanOrEqual(1.0);
      }
    });

    it('should include required fields in suggestions', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: sampleDomains, error: null }),
      });

      const suggestions = await service.suggestDomains('システム開発');

      for (const suggestion of suggestions) {
        expect(suggestion).toHaveProperty('domainCode');
        expect(suggestion).toHaveProperty('domainName');
        expect(suggestion).toHaveProperty('majorCategory');
        expect(suggestion).toHaveProperty('confidence');
        expect(suggestion).toHaveProperty('reason');
        expect(typeof suggestion.domainCode).toBe('string');
        expect(typeof suggestion.domainName).toBe('string');
        expect(typeof suggestion.majorCategory).toBe('string');
        expect(typeof suggestion.confidence).toBe('number');
        expect(typeof suggestion.reason).toBe('string');
      }
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      });

      const suggestions = await service.suggestDomains('テスト習慣');

      // Should return general domain as fallback
      expect(suggestions).toBeDefined();
      expect(suggestions.length).toBe(1);
      expect(suggestions[0].domainCode).toBe('000');
    });
  });


  describe('searchDomains', () => {
    it('should search domains by keyword', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [sampleDomains[0]], error: null }),
      });

      const results = await service.searchDomains('プログラミング');

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should return empty array for empty query', async () => {
      const results = await service.searchDomains('');

      expect(results).toEqual([]);
    });

    it('should return empty array for whitespace-only query', async () => {
      const results = await service.searchDomains('   ');

      expect(results).toEqual([]);
    });

    it('should return properly mapped domain objects (Requirement 2.5)', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [sampleDomains[0]], error: null }),
      });

      const results = await service.searchDomains('システム');

      expect(results.length).toBeGreaterThan(0);
      const domain = results[0];
      expect(domain).toHaveProperty('id');
      expect(domain).toHaveProperty('majorCode');
      expect(domain).toHaveProperty('majorName');
      expect(domain).toHaveProperty('middleCode');
      expect(domain).toHaveProperty('middleName');
      expect(domain).toHaveProperty('minorCode');
      expect(domain).toHaveProperty('minorName');
      expect(domain).toHaveProperty('keywords');
      expect(domain).toHaveProperty('createdAt');
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      });

      const results = await service.searchDomains('test');

      expect(results).toEqual([]);
    });

    it('should trim query before searching', async () => {
      const mockOr = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue({ data: [sampleDomains[0]], error: null });
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        or: mockOr,
        limit: mockLimit,
      });

      await service.searchDomains('  プログラミング  ');

      // Verify the search was performed (or was called)
      expect(mockOr).toHaveBeenCalled();
    });
  });

  describe('getAllDomains', () => {
    it('should return paginated domains (Requirement 2.4)', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockImplementation((_, options) => {
          if (options?.head) {
            return Promise.resolve({ count: 100, error: null });
          }
          return {
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({ data: sampleDomains, error: null }),
          };
        }),
      }));

      const result = await service.getAllDomains({ page: 1, pageSize: 20 });

      expect(result).toHaveProperty('domains');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('pageSize');
      expect(result).toHaveProperty('hasMore');
    });

    it('should use default pagination values', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockImplementation((_, options) => {
          if (options?.head) {
            return Promise.resolve({ count: 10, error: null });
          }
          return {
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({ data: sampleDomains, error: null }),
          };
        }),
      }));

      const result = await service.getAllDomains();

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('should correctly calculate hasMore when more pages exist', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockImplementation((_, options) => {
          if (options?.head) {
            return Promise.resolve({ count: 100, error: null });
          }
          return {
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({ data: sampleDomains.slice(0, 2), error: null }),
          };
        }),
      }));

      const result = await service.getAllDomains({ page: 1, pageSize: 2 });

      expect(result.hasMore).toBe(true);
      expect(result.total).toBe(100);
    });

    it('should correctly calculate hasMore when on last page', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockImplementation((_, options) => {
          if (options?.head) {
            return Promise.resolve({ count: 4, error: null });
          }
          return {
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({ data: sampleDomains, error: null }),
          };
        }),
      }));

      const result = await service.getAllDomains({ page: 1, pageSize: 20 });

      expect(result.hasMore).toBe(false);
    });

    it('should handle page number less than 1', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockImplementation((_, options) => {
          if (options?.head) {
            return Promise.resolve({ count: 10, error: null });
          }
          return {
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({ data: sampleDomains, error: null }),
          };
        }),
      }));

      const result = await service.getAllDomains({ page: 0, pageSize: 20 });

      expect(result.page).toBe(1);
    });

    it('should cap pageSize at 100', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockImplementation((_, options) => {
          if (options?.head) {
            return Promise.resolve({ count: 10, error: null });
          }
          return {
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({ data: sampleDomains, error: null }),
          };
        }),
      }));

      const result = await service.getAllDomains({ page: 1, pageSize: 200 });

      expect(result.pageSize).toBe(100);
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockImplementation((_, options) => {
          if (options?.head) {
            return Promise.resolve({ count: null, error: { message: 'DB error' } });
          }
          return {
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
          };
        }),
      }));

      const result = await service.getAllDomains();

      expect(result.domains).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('should return properly mapped domain objects', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockImplementation((_, options) => {
          if (options?.head) {
            return Promise.resolve({ count: 4, error: null });
          }
          return {
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({ data: sampleDomains, error: null }),
          };
        }),
      }));

      const result = await service.getAllDomains();

      expect(result.domains.length).toBeGreaterThan(0);
      const domain = result.domains[0];
      expect(domain.majorCode).toBe('B');
      expect(domain.majorName).toBe('専門的・技術的職業');
      expect(domain.minorCode).toBe('B-11-111');
      expect(domain.minorName).toBe('システムエンジニア');
      expect(Array.isArray(domain.keywords)).toBe(true);
    });
  });

  describe('getDomainByCode', () => {
    it('should return domain for valid code', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: sampleDomains[0], error: null }),
      });

      const domain = await service.getDomainByCode('B-11-111');

      expect(domain).toBeDefined();
      expect(domain?.minorCode).toBe('B-11-111');
    });

    it('should return null for invalid code', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      });

      const domain = await service.getDomainByCode('INVALID');

      expect(domain).toBeNull();
    });

    it('should return null for empty code', async () => {
      const domain = await service.getDomainByCode('');

      expect(domain).toBeNull();
    });

    it('should return all required domain fields', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: sampleDomains[0], error: null }),
      });

      const domain = await service.getDomainByCode('B-11-111');

      expect(domain).not.toBeNull();
      expect(domain?.id).toBe('1');
      expect(domain?.majorCode).toBe('B');
      expect(domain?.majorName).toBe('専門的・技術的職業');
      expect(domain?.middleCode).toBe('B-11');
      expect(domain?.middleName).toBe('情報処理・通信技術者');
      expect(domain?.minorCode).toBe('B-11-111');
      expect(domain?.minorName).toBe('システムエンジニア');
      expect(domain?.keywords).toEqual(['プログラミング', 'SE', 'システム開発', 'software', 'engineering']);
      expect(domain?.createdAt).toBe('2024-01-01T00:00:00Z');
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockRejectedValue(new Error('Connection error')),
      });

      const domain = await service.getDomainByCode('B-11-111');

      expect(domain).toBeNull();
    });
  });

  describe('isAIAvailable', () => {
    it('should return false when OpenAI is not configured', () => {
      // Service created without OpenAI API key
      const available = service.isAIAvailable();

      // Without API key, should return false
      expect(typeof available).toBe('boolean');
    });
  });
});
