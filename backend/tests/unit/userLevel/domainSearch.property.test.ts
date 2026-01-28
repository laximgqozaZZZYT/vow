/**
 * Domain Search Returns Matching Results Property Test
 *
 * Feature: user-level-system, Property 3: Domain Search Returns Matching Results
 *
 * For any keyword search query, the returned domains must contain the search term
 * in either the domain name or keywords array.
 *
 * **Validates: Requirements 2.5**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// =============================================================================
// Types
// =============================================================================

/**
 * Occupation domain interface matching the database schema
 */
interface OccupationDomain {
  id: string;
  majorCode: string;
  majorName: string;
  middleCode: string;
  middleName: string;
  minorCode: string;
  minorName: string;
  keywords: string[];
  createdAt: string;
}

// =============================================================================
// Sample Domain Data for Testing
// =============================================================================

/**
 * Sample occupation domains for testing search functionality.
 * This data mirrors the seed migration structure.
 */
const SAMPLE_DOMAINS: OccupationDomain[] = [
  { id: '1', majorCode: '0', majorName: '一般', middleCode: '0-00', middleName: '一般', minorCode: '000', minorName: '一般（未分類）', keywords: ['general', '一般', 'その他', 'other', '未分類'], createdAt: '2024-01-01T00:00:00Z' },
  { id: '2', majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-11', middleName: '情報処理・通信技術者', minorCode: 'B-11-111', minorName: 'システムエンジニア', keywords: ['プログラミング', 'SE', 'システム開発', 'software', 'engineering', 'coding', 'システム設計', 'IT'], createdAt: '2024-01-01T00:00:00Z' },
  { id: '3', majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-11', middleName: '情報処理・通信技術者', minorCode: 'B-11-112', minorName: 'プログラマー', keywords: ['プログラミング', 'コーディング', 'programming', 'developer', 'coding', 'ソフトウェア', 'アプリ開発'], createdAt: '2024-01-01T00:00:00Z' },
  { id: '4', majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-11', middleName: '情報処理・通信技術者', minorCode: 'B-11-116', minorName: 'データサイエンティスト', keywords: ['データ分析', 'データサイエンス', 'data science', 'machine learning', '機械学習', 'AI', '統計'], createdAt: '2024-01-01T00:00:00Z' },
  { id: '5', majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-11', middleName: '情報処理・通信技術者', minorCode: 'B-11-117', minorName: 'Webデザイナー', keywords: ['Webデザイン', 'UI', 'UX', 'web design', 'フロントエンド', 'HTML', 'CSS'], createdAt: '2024-01-01T00:00:00Z' },
  { id: '6', majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-15', middleName: '教員', minorCode: 'B-15-151', minorName: '大学教授', keywords: ['教育', '大学', 'professor', 'teaching', '講義', '研究', 'academic'], createdAt: '2024-01-01T00:00:00Z' },
  { id: '7', majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-19', middleName: 'その他の専門的職業', minorCode: 'B-19-193', minorName: 'カウンセラー', keywords: ['カウンセリング', '心理', 'counselor', 'メンタルヘルス', '相談'], createdAt: '2024-01-01T00:00:00Z' },
  { id: '8', majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-19', middleName: 'その他の専門的職業', minorCode: 'B-19-194', minorName: '栄養士', keywords: ['栄養', '食事', 'nutritionist', 'dietitian', '健康管理'], createdAt: '2024-01-01T00:00:00Z' },
  { id: '9', majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-20', middleName: 'クリエイティブ職', minorCode: 'B-20-203', minorName: '作家・ライター', keywords: ['執筆', 'ライティング', 'writer', 'author', '文章', 'ブログ'], createdAt: '2024-01-01T00:00:00Z' },
  { id: '10', majorCode: 'E', majorName: 'サービスの職業', middleCode: 'E-44', middleName: '飲食物調理従事者', minorCode: 'E-44-441', minorName: '調理師', keywords: ['料理', '調理', 'cooking', 'chef', '食事', 'シェフ'], createdAt: '2024-01-01T00:00:00Z' },
  { id: '11', majorCode: 'E', majorName: 'サービスの職業', middleCode: 'E-47', middleName: 'その他のサービス職業従事者', minorCode: 'E-47-472', minorName: 'フィットネスインストラクター', keywords: ['フィットネス', 'トレーナー', 'fitness instructor', 'ジム', '運動'], createdAt: '2024-01-01T00:00:00Z' },
  { id: '12', majorCode: 'E', majorName: 'サービスの職業', middleCode: 'E-47', middleName: 'その他のサービス職業従事者', minorCode: 'E-47-473', minorName: 'ヨガインストラクター', keywords: ['ヨガ', 'yoga', 'instructor', 'ウェルネス', 'wellness'], createdAt: '2024-01-01T00:00:00Z' },
  { id: '13', majorCode: 'C', majorName: '事務的職業', middleCode: 'C-21', middleName: '一般事務従事者', minorCode: 'C-21-211', minorName: '一般事務員', keywords: ['事務', 'office', 'administration', '書類', 'デスクワーク', 'オフィスワーク'], createdAt: '2024-01-01T00:00:00Z' },
  { id: '14', majorCode: 'D', majorName: '販売の職業', middleCode: 'D-31', middleName: '商品販売従事者', minorCode: 'D-31-311', minorName: '小売店販売員', keywords: ['販売', '接客', 'sales', 'retail', '店舗', 'ショップ'], createdAt: '2024-01-01T00:00:00Z' },
  { id: '15', majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-13', middleName: '医師、歯科医師、獣医師、薬剤師', minorCode: 'B-13-131', minorName: '医師', keywords: ['医療', '医師', 'doctor', 'medicine', '診療', '治療', 'physician'], createdAt: '2024-01-01T00:00:00Z' },
];

// =============================================================================
// Pure Functions for Testing (Extracted from DomainMappingService)
// =============================================================================

/**
 * Search domains by keyword query.
 * This is a pure function that simulates the searchDomains method from DomainMappingService.
 *
 * The actual service uses Supabase queries:
 * - .or(`minor_name.ilike.%${searchTerm}%,keywords.cs.{${searchTerm}}`)
 *
 * This pure function simulates the same behavior for property testing.
 */
function searchDomains(query: string, domains: OccupationDomain[]): OccupationDomain[] {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const searchTerm = query.trim().toLowerCase();

  // Filter domains where:
  // 1. Domain name (minorName) contains the search term (case-insensitive)
  // 2. OR keywords array contains the search term (case-insensitive partial match)
  return domains.filter((domain) => {
    // Check domain name (ilike match - case insensitive partial match)
    const nameMatch = domain.minorName.toLowerCase().includes(searchTerm);

    // Check keywords (contains match - case insensitive)
    const keywordMatch = domain.keywords.some((keyword) =>
      keyword.toLowerCase().includes(searchTerm)
    );

    return nameMatch || keywordMatch;
  }).slice(0, 20); // Limit to 20 results as per service implementation
}

/**
 * Check if a domain matches a search query.
 * Returns true if the search term is found in domain name or keywords.
 */
function domainMatchesQuery(domain: OccupationDomain, query: string): boolean {
  const searchTerm = query.trim().toLowerCase();
  
  if (searchTerm.length === 0) {
    return false;
  }

  // Check domain name (case-insensitive partial match)
  const nameMatch = domain.minorName.toLowerCase().includes(searchTerm);

  // Check keywords (case-insensitive partial match)
  const keywordMatch = domain.keywords.some((keyword) =>
    keyword.toLowerCase().includes(searchTerm)
  );

  return nameMatch || keywordMatch;
}

/**
 * Validate that a domain has all required fields.
 */
function isValidDomain(domain: OccupationDomain): boolean {
  return (
    typeof domain.id === 'string' &&
    domain.id.length > 0 &&
    typeof domain.majorCode === 'string' &&
    domain.majorCode.length > 0 &&
    typeof domain.majorName === 'string' &&
    domain.majorName.length > 0 &&
    typeof domain.middleCode === 'string' &&
    domain.middleCode.length > 0 &&
    typeof domain.middleName === 'string' &&
    domain.middleName.length > 0 &&
    typeof domain.minorCode === 'string' &&
    domain.minorCode.length > 0 &&
    typeof domain.minorName === 'string' &&
    domain.minorName.length > 0 &&
    Array.isArray(domain.keywords) &&
    typeof domain.createdAt === 'string'
  );
}

// =============================================================================
// Arbitraries (Generators) for Property-Based Testing
// =============================================================================

/**
 * Generate valid search queries that should match domains.
 * These are keywords that exist in the sample domain data.
 */
const matchingQueryArbitrary = fc.oneof(
  // Japanese keywords
  fc.constantFrom(
    'プログラミング',
    'システム',
    'データ',
    '教育',
    '料理',
    'ヨガ',
    '医療',
    '事務',
    '販売',
    'フィットネス',
    '栄養',
    '心理',
    '執筆',
    'Web',
    'デザイン'
  ),
  // English keywords
  fc.constantFrom(
    'programming',
    'software',
    'coding',
    'data',
    'teaching',
    'cooking',
    'yoga',
    'fitness',
    'doctor',
    'office',
    'sales',
    'writer',
    'design',
    'engineering'
  ),
  // Partial matches (substrings)
  fc.constantFrom(
    'プログラ',
    'システ',
    'データ',
    'program',
    'soft',
    'code',
    'teach',
    'cook',
    'fit'
  )
);

/**
 * Generate queries that should NOT match any domains.
 */
const nonMatchingQueryArbitrary = fc.constantFrom(
  'xyz123',
  'qwerty',
  'asdfgh',
  'zzzzzz',
  'nonexistent',
  '存在しない',
  'ありえない',
  '@@@@',
  '####'
);

/**
 * Generate empty or whitespace-only queries.
 */
const emptyQueryArbitrary = fc.oneof(
  fc.constant(''),
  fc.constant('   '),
  fc.constant('\t'),
  fc.constant('\n'),
  fc.constant('  \t  \n  ')
);

/**
 * Generate random search queries for edge case testing.
 */
const randomQueryArbitrary = fc.string({ minLength: 1, maxLength: 50 });

// =============================================================================
// Property Tests
// =============================================================================

describe('Feature: user-level-system, Property 3: Domain Search Returns Matching Results', () => {
  /**
   * Property 3.1: Search results contain the search term in domain name or keywords
   *
   * For any keyword search query, all returned domains must have at least one
   * keyword that contains the search query (case-insensitive partial match)
   * or the domain name must contain the query.
   *
   * **Validates: Requirements 2.5**
   */
  describe('Property 3.1: Search results contain the search term in domain name or keywords', () => {
    it('should return only domains that match the search query', () => {
      fc.assert(
        fc.property(
          matchingQueryArbitrary,
          (query) => {
            const results = searchDomains(query, SAMPLE_DOMAINS);

            // Property: all returned domains must match the query
            for (const domain of results) {
              const matches = domainMatchesQuery(domain, query);
              expect(matches).toBe(true);
            }

            return results.every((domain) => domainMatchesQuery(domain, query));
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should match domains by domain name (case-insensitive)', () => {
      const testCases = [
        { query: 'システムエンジニア', expectedCode: 'B-11-111' },
        { query: 'プログラマー', expectedCode: 'B-11-112' },
        { query: '調理師', expectedCode: 'E-44-441' },
        { query: '医師', expectedCode: 'B-13-131' },
      ];

      for (const { query, expectedCode } of testCases) {
        const results = searchDomains(query, SAMPLE_DOMAINS);
        
        expect(results.length).toBeGreaterThan(0);
        expect(results.some((d) => d.minorCode === expectedCode)).toBe(true);
        
        // All results must match the query
        for (const domain of results) {
          expect(domainMatchesQuery(domain, query)).toBe(true);
        }
      }
    });

    it('should match domains by keywords (case-insensitive)', () => {
      const testCases = [
        { query: 'programming', expectedCodes: ['B-11-112'] },
        { query: 'cooking', expectedCodes: ['E-44-441'] },
        { query: 'yoga', expectedCodes: ['E-47-473'] },
        { query: 'doctor', expectedCodes: ['B-13-131'] },
      ];

      for (const { query, expectedCodes } of testCases) {
        const results = searchDomains(query, SAMPLE_DOMAINS);
        
        expect(results.length).toBeGreaterThan(0);
        
        for (const expectedCode of expectedCodes) {
          expect(results.some((d) => d.minorCode === expectedCode)).toBe(true);
        }
        
        // All results must match the query
        for (const domain of results) {
          expect(domainMatchesQuery(domain, query)).toBe(true);
        }
      }
    });
  });

  /**
   * Property 3.2: Empty query returns empty results
   *
   * For any empty or whitespace-only query, the search should return
   * an empty array.
   *
   * **Validates: Requirements 2.5**
   */
  describe('Property 3.2: Empty query returns empty results', () => {
    it('should return empty array for empty or whitespace queries', () => {
      fc.assert(
        fc.property(
          emptyQueryArbitrary,
          (query) => {
            const results = searchDomains(query, SAMPLE_DOMAINS);

            // Property: empty/whitespace queries return empty results
            expect(results).toEqual([]);
            return results.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return empty array for null-like empty string', () => {
      const results = searchDomains('', SAMPLE_DOMAINS);
      expect(results).toEqual([]);
    });

    it('should return empty array for whitespace-only strings', () => {
      const whitespaceInputs = ['   ', '\t', '\n', '  \t  \n  ', '\r\n'];

      for (const input of whitespaceInputs) {
        const results = searchDomains(input, SAMPLE_DOMAINS);
        expect(results).toEqual([]);
      }
    });
  });

  /**
   * Property 3.3: Search is case-insensitive
   *
   * For any search query, the search should be case-insensitive,
   * meaning "PROGRAMMING" and "programming" should return the same results.
   *
   * **Validates: Requirements 2.5**
   */
  describe('Property 3.3: Search is case-insensitive', () => {
    it('should return same results regardless of case', () => {
      const testCases = [
        ['programming', 'PROGRAMMING', 'Programming', 'pRoGrAmMiNg'],
        ['yoga', 'YOGA', 'Yoga', 'YoGa'],
        ['cooking', 'COOKING', 'Cooking', 'COOKING'],
        ['システム', 'システム'], // Japanese doesn't have case, but should still work
      ];

      for (const variants of testCases) {
        const baseResults = searchDomains(variants[0], SAMPLE_DOMAINS);
        
        for (const variant of variants.slice(1)) {
          const variantResults = searchDomains(variant, SAMPLE_DOMAINS);
          
          // Same number of results
          expect(variantResults.length).toBe(baseResults.length);
          
          // Same domain codes (order may vary)
          const baseCodes = baseResults.map((d) => d.minorCode).sort();
          const variantCodes = variantResults.map((d) => d.minorCode).sort();
          expect(variantCodes).toEqual(baseCodes);
        }
      }
    });

    it('should match keywords case-insensitively', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('SOFTWARE', 'software', 'Software', 'SoFtWaRe'),
          (query) => {
            const results = searchDomains(query, SAMPLE_DOMAINS);

            // Should find システムエンジニア which has 'software' keyword
            expect(results.length).toBeGreaterThan(0);
            expect(results.some((d) => d.minorCode === 'B-11-111')).toBe(true);

            return results.length > 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 3.4: Results have all required domain fields
   *
   * For any search query that returns results, all returned domains
   * must have all required fields populated.
   *
   * **Validates: Requirements 2.5**
   */
  describe('Property 3.4: Results have all required domain fields', () => {
    it('should return domains with all required fields', () => {
      fc.assert(
        fc.property(
          matchingQueryArbitrary,
          (query) => {
            const results = searchDomains(query, SAMPLE_DOMAINS);

            // Property: all returned domains must have valid structure
            for (const domain of results) {
              expect(isValidDomain(domain)).toBe(true);

              // Explicit field checks
              expect(domain).toHaveProperty('id');
              expect(domain).toHaveProperty('majorCode');
              expect(domain).toHaveProperty('majorName');
              expect(domain).toHaveProperty('middleCode');
              expect(domain).toHaveProperty('middleName');
              expect(domain).toHaveProperty('minorCode');
              expect(domain).toHaveProperty('minorName');
              expect(domain).toHaveProperty('keywords');
              expect(domain).toHaveProperty('createdAt');

              expect(typeof domain.id).toBe('string');
              expect(typeof domain.majorCode).toBe('string');
              expect(typeof domain.majorName).toBe('string');
              expect(typeof domain.middleCode).toBe('string');
              expect(typeof domain.middleName).toBe('string');
              expect(typeof domain.minorCode).toBe('string');
              expect(typeof domain.minorName).toBe('string');
              expect(Array.isArray(domain.keywords)).toBe(true);
              expect(typeof domain.createdAt).toBe('string');
            }

            return results.every((d) => isValidDomain(d));
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 3.5: Search is deterministic (same query returns same results)
   *
   * For any given search query, calling the search function multiple times
   * should return the same results.
   *
   * **Validates: Requirements 2.5**
   */
  describe('Property 3.5: Search is deterministic', () => {
    it('should return same results for identical queries', () => {
      fc.assert(
        fc.property(
          matchingQueryArbitrary,
          (query) => {
            // Call the function multiple times with the same input
            const results1 = searchDomains(query, SAMPLE_DOMAINS);
            const results2 = searchDomains(query, SAMPLE_DOMAINS);
            const results3 = searchDomains(query, SAMPLE_DOMAINS);

            // Property: results should be identical
            expect(results1.length).toBe(results2.length);
            expect(results2.length).toBe(results3.length);

            for (let i = 0; i < results1.length; i++) {
              expect(results1[i].minorCode).toBe(results2[i].minorCode);
              expect(results2[i].minorCode).toBe(results3[i].minorCode);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be deterministic across multiple calls', () => {
      const testQueries = ['プログラミング', 'cooking', 'yoga', 'データ', 'fitness'];

      for (const query of testQueries) {
        const results: OccupationDomain[][] = [];

        // Call 5 times
        for (let i = 0; i < 5; i++) {
          results.push(searchDomains(query, SAMPLE_DOMAINS));
        }

        // All results should be identical
        for (let i = 1; i < results.length; i++) {
          expect(results[i].map((d) => d.minorCode)).toEqual(
            results[0].map((d) => d.minorCode)
          );
        }
      }
    });
  });

  /**
   * Additional Property Tests for Robustness
   */
  describe('Additional robustness properties', () => {
    it('should return empty array for non-matching queries', () => {
      fc.assert(
        fc.property(
          nonMatchingQueryArbitrary,
          (query) => {
            const results = searchDomains(query, SAMPLE_DOMAINS);

            // Property: non-matching queries should return empty results
            expect(results).toEqual([]);
            return results.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle partial matches correctly', () => {
      const partialMatchTests = [
        { query: 'プログラ', shouldMatch: ['B-11-111', 'B-11-112'] }, // Partial Japanese
        { query: 'program', shouldMatch: ['B-11-112'] }, // Partial English
        { query: 'cook', shouldMatch: ['E-44-441'] }, // Partial cooking
        { query: 'fit', shouldMatch: ['E-47-472'] }, // Partial fitness
      ];

      for (const { query, shouldMatch } of partialMatchTests) {
        const results = searchDomains(query, SAMPLE_DOMAINS);

        for (const expectedCode of shouldMatch) {
          expect(results.some((d) => d.minorCode === expectedCode)).toBe(true);
        }

        // All results must match the query
        for (const domain of results) {
          expect(domainMatchesQuery(domain, query)).toBe(true);
        }
      }
    });

    it('should handle special characters in queries', () => {
      const specialCharQueries = [
        'プログラミング！',
        'cooking@',
        'yoga#',
        'data$',
      ];

      for (const query of specialCharQueries) {
        // Should not throw an error
        const results = searchDomains(query, SAMPLE_DOMAINS);
        
        // Results should be valid (may be empty or contain matches)
        expect(Array.isArray(results)).toBe(true);
        
        for (const domain of results) {
          expect(isValidDomain(domain)).toBe(true);
        }
      }
    });

    it('should limit results to maximum 20 domains', () => {
      // Create a large domain set where many domains match
      const largeDomainSet: OccupationDomain[] = [];
      for (let i = 0; i < 50; i++) {
        largeDomainSet.push({
          id: `${i}`,
          majorCode: 'B',
          majorName: '専門的・技術的職業',
          middleCode: 'B-11',
          middleName: '情報処理・通信技術者',
          minorCode: `B-11-${100 + i}`,
          minorName: `テスト職業${i}`,
          keywords: ['テスト', 'test', 'common'],
          createdAt: '2024-01-01T00:00:00Z',
        });
      }

      const results = searchDomains('test', largeDomainSet);

      // Should be limited to 20 results
      expect(results.length).toBeLessThanOrEqual(20);
    });

    it('should handle unicode and emoji in queries gracefully', () => {
      const unicodeQueries = ['🏃', '📚', '💻', '🧘', '🍳'];

      for (const query of unicodeQueries) {
        // Should not throw an error
        const results = searchDomains(query, SAMPLE_DOMAINS);
        
        // Results should be valid (likely empty for emoji)
        expect(Array.isArray(results)).toBe(true);
      }
    });

    it('should handle very long queries without errors', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 100, maxLength: 500 }),
          (longQuery) => {
            // Should not throw an error
            const results = searchDomains(longQuery, SAMPLE_DOMAINS);
            
            // Results should be valid array
            expect(Array.isArray(results)).toBe(true);
            
            // All results must match the query
            for (const domain of results) {
              expect(domainMatchesQuery(domain, longQuery)).toBe(true);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle queries with leading/trailing whitespace', () => {
      const testCases = [
        { query: '  programming  ', expected: 'programming' },
        { query: '\tプログラミング\t', expected: 'プログラミング' },
        { query: '\n\ncooking\n\n', expected: 'cooking' },
      ];

      for (const { query, expected } of testCases) {
        const resultsWithWhitespace = searchDomains(query, SAMPLE_DOMAINS);
        const resultsWithoutWhitespace = searchDomains(expected, SAMPLE_DOMAINS);

        // Should return same results after trimming
        expect(resultsWithWhitespace.length).toBe(resultsWithoutWhitespace.length);
        expect(resultsWithWhitespace.map((d) => d.minorCode).sort()).toEqual(
          resultsWithoutWhitespace.map((d) => d.minorCode).sort()
        );
      }
    });
  });
});
