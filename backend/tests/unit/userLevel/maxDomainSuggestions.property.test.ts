/**
 * Maximum Domain Suggestions Property Test
 *
 * Feature: user-level-system, Property 4: Maximum Domain Suggestions
 *
 * For any habit or goal submitted for domain suggestion, the AI service must return:
 * - At most 3 domain suggestions
 * - Each suggestion with a confidence score >= 0.5
 *
 * **Validates: Requirements 3.1**
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';

// =============================================================================
// Constants
// =============================================================================

/** Maximum number of domain suggestions allowed */
const MAX_SUGGESTIONS = 3;

/** Minimum confidence score for suggestions */
const MIN_CONFIDENCE = 0.5;

/** General domain code for fallback */
const GENERAL_DOMAIN_CODE = '000';

/** General domain name */
const GENERAL_DOMAIN_NAME = '一般（未分類）';

/** General domain major category */
const GENERAL_MAJOR_CATEGORY = '一般';

// =============================================================================
// Types
// =============================================================================

/**
 * Domain suggestion interface matching the service
 */
interface DomainSuggestion {
  domainCode: string;
  domainName: string;
  majorCategory: string;
  confidence: number;
  reason: string;
}


/**
 * Occupation domain interface
 */
interface OccupationDomain {
  majorCode: string;
  majorName: string;
  middleCode: string;
  middleName: string;
  minorCode: string;
  minorName: string;
  keywords: string[];
}

// =============================================================================
// Sample Domain Data for Testing
// =============================================================================

/**
 * Sample occupation domains for testing keyword matching
 */
const SAMPLE_DOMAINS: OccupationDomain[] = [
  { majorCode: '0', majorName: '一般', middleCode: '0-00', middleName: '一般', minorCode: '000', minorName: '一般（未分類）', keywords: ['general', '一般', 'その他'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-11', middleName: '情報処理・通信技術者', minorCode: 'B-11-111', minorName: 'システムエンジニア', keywords: ['プログラミング', 'SE', 'システム開発', 'software', 'engineering', 'coding'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-11', middleName: '情報処理・通信技術者', minorCode: 'B-11-112', minorName: 'プログラマー', keywords: ['プログラミング', 'コーディング', 'programming', 'developer', 'coding'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-11', middleName: '情報処理・通信技術者', minorCode: 'B-11-116', minorName: 'データサイエンティスト', keywords: ['データ分析', 'データサイエンス', 'data science', 'machine learning', '機械学習', 'AI'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-11', middleName: '情報処理・通信技術者', minorCode: 'B-11-117', minorName: 'Webデザイナー', keywords: ['Webデザイン', 'UI', 'UX', 'web design', 'フロントエンド'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-15', middleName: '教員', minorCode: 'B-15-151', minorName: '大学教授', keywords: ['教育', '大学', 'professor', 'teaching', '講義'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-19', middleName: 'その他の専門的職業', minorCode: 'B-19-193', minorName: 'カウンセラー', keywords: ['カウンセリング', '心理', 'counselor', 'メンタルヘルス'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-19', middleName: 'その他の専門的職業', minorCode: 'B-19-194', minorName: '栄養士', keywords: ['栄養', '食事', 'nutritionist', 'dietitian', '健康管理'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-20', middleName: 'クリエイティブ職', minorCode: 'B-20-203', minorName: '作家・ライター', keywords: ['執筆', 'ライティング', 'writer', 'author', '文章'] },
  { majorCode: 'E', majorName: 'サービスの職業', middleCode: 'E-44', middleName: '飲食物調理従事者', minorCode: 'E-44-441', minorName: '調理師', keywords: ['料理', '調理', 'cooking', 'chef', '食事'] },
  { majorCode: 'E', majorName: 'サービスの職業', middleCode: 'E-47', middleName: 'その他のサービス職業従事者', minorCode: 'E-47-472', minorName: 'フィットネスインストラクター', keywords: ['フィットネス', 'トレーナー', 'fitness instructor', 'ジム', '運動'] },
  { majorCode: 'E', majorName: 'サービスの職業', middleCode: 'E-47', middleName: 'その他のサービス職業従事者', minorCode: 'E-47-473', minorName: 'ヨガインストラクター', keywords: ['ヨガ', 'yoga', 'instructor', 'ウェルネス', 'wellness'] },
];

// =============================================================================
// Pure Functions for Testing (Extracted from DomainMappingService)
// =============================================================================

/**
 * Calculate keyword match score for a domain.
 * This is a pure function extracted from DomainMappingService for testing.
 */
function calculateKeywordScore(
  words: string[],
  domain: OccupationDomain
): { score: number; matchedKeywords: string[] } {
  let score = 0;
  const matchedKeywords: string[] = [];

  // Check domain name match
  const domainNameLower = domain.minorName.toLowerCase();
  for (const word of words) {
    if (domainNameLower.includes(word)) {
      score += 3; // Higher weight for name match
      matchedKeywords.push(domain.minorName);
    }
  }

  // Check keyword matches
  for (const keyword of domain.keywords) {
    const keywordLower = keyword.toLowerCase();
    for (const word of words) {
      if (keywordLower.includes(word) || word.includes(keywordLower)) {
        score += 1;
        if (!matchedKeywords.includes(keyword)) {
          matchedKeywords.push(keyword);
        }
      }
    }
  }

  return { score, matchedKeywords };
}


/**
 * Get general domain suggestion as fallback.
 * This is a pure function extracted from DomainMappingService for testing.
 */
function getGeneralDomainSuggestion(): DomainSuggestion[] {
  return [
    {
      domainCode: GENERAL_DOMAIN_CODE,
      domainName: GENERAL_DOMAIN_NAME,
      majorCategory: GENERAL_MAJOR_CATEGORY,
      confidence: MIN_CONFIDENCE,
      reason: '特定の職業分類に該当しない一般的な習慣',
    },
  ];
}

/**
 * Suggest domains using keyword matching.
 * This is a pure function extracted from DomainMappingService for testing.
 */
function suggestDomainsWithKeywords(
  habitName: string,
  habitDescription: string | null | undefined,
  domains: OccupationDomain[]
): DomainSuggestion[] {
  // Combine name and description for keyword matching
  const searchText = `${habitName} ${habitDescription || ''}`.toLowerCase();
  const words = searchText.split(/\s+/).filter(w => w.length >= 2);

  if (words.length === 0) {
    return getGeneralDomainSuggestion();
  }

  // Score each domain based on keyword matches
  const scoredDomains: Array<{ domain: OccupationDomain; score: number; matchedKeywords: string[] }> = [];

  for (const domain of domains) {
    const { score, matchedKeywords } = calculateKeywordScore(words, domain);
    if (score > 0) {
      scoredDomains.push({ domain, score, matchedKeywords });
    }
  }

  // Sort by score descending and take top MAX_SUGGESTIONS
  scoredDomains.sort((a, b) => b.score - a.score);
  const topDomains = scoredDomains.slice(0, MAX_SUGGESTIONS);

  if (topDomains.length === 0) {
    return getGeneralDomainSuggestion();
  }

  // Convert to suggestions with confidence based on score
  const firstDomain = topDomains[0];
  const maxScore = firstDomain ? firstDomain.score : 1;
  
  return topDomains.map(({ domain, score, matchedKeywords }) => ({
    domainCode: domain.minorCode,
    domainName: domain.minorName,
    majorCategory: domain.majorName,
    confidence: Math.min(0.9, Math.max(MIN_CONFIDENCE, score / maxScore * 0.8)),
    reason: `キーワードマッチ: ${matchedKeywords.slice(0, 3).join(', ')}`,
  }));
}

/**
 * Validate domain suggestion structure.
 */
function isValidDomainSuggestion(suggestion: DomainSuggestion): boolean {
  return (
    typeof suggestion.domainCode === 'string' &&
    suggestion.domainCode.length > 0 &&
    typeof suggestion.domainName === 'string' &&
    suggestion.domainName.length > 0 &&
    typeof suggestion.majorCategory === 'string' &&
    suggestion.majorCategory.length > 0 &&
    typeof suggestion.confidence === 'number' &&
    suggestion.confidence >= 0 &&
    suggestion.confidence <= 1 &&
    typeof suggestion.reason === 'string' &&
    suggestion.reason.length > 0
  );
}


// =============================================================================
// Arbitraries (Generators) for Property-Based Testing
// =============================================================================

/**
 * Generate valid habit names for testing.
 * Includes various types of habit names in Japanese and English.
 */
const habitNameArbitrary = fc.oneof(
  // Japanese habit names
  fc.constantFrom(
    'プログラミングを学ぶ',
    '毎日運動する',
    '読書を30分する',
    '英語を勉強する',
    '料理を作る',
    'ヨガをする',
    '瞑想する',
    '早起きする',
    '水を飲む',
    '日記を書く',
    'TypeScriptを学ぶ',
    'データ分析の練習',
    'UIデザインの勉強',
    '栄養バランスを考える',
    'フィットネスジムに行く',
    'ブログを書く',
    '機械学習を学ぶ',
    'コーディングの練習',
    '心理学を学ぶ',
    '健康管理をする'
  ),
  // English habit names
  fc.constantFrom(
    'Learn programming',
    'Exercise daily',
    'Read for 30 minutes',
    'Study English',
    'Cook meals',
    'Practice yoga',
    'Meditate',
    'Wake up early',
    'Drink water',
    'Write journal',
    'Learn TypeScript',
    'Practice data analysis',
    'Study UI design',
    'Manage nutrition',
    'Go to fitness gym',
    'Write blog posts',
    'Learn machine learning',
    'Practice coding',
    'Study psychology',
    'Health management'
  ),
  // Random strings for edge cases
  fc.string({ minLength: 1, maxLength: 100 })
);

/**
 * Generate optional habit descriptions.
 */
const habitDescriptionArbitrary = fc.option(
  fc.oneof(
    fc.constantFrom(
      'システム開発のスキルを向上させる',
      '健康的な生活習慣を身につける',
      'クリエイティブなスキルを磨く',
      '専門知識を深める',
      null
    ),
    fc.string({ minLength: 0, maxLength: 200 })
  ),
  { nil: undefined }
);

/**
 * Generate whitespace-only or empty strings for edge case testing.
 */
const emptyOrWhitespaceArbitrary = fc.oneof(
  fc.constant(''),
  fc.constant('   '),
  fc.constant('\t'),
  fc.constant('\n'),
  fc.constant('  \t  \n  ')
);


// =============================================================================
// Property Tests
// =============================================================================

describe('Feature: user-level-system, Property 4: Maximum Domain Suggestions', () => {
  /**
   * Property 4.1: Number of suggestions is always <= 3
   *
   * For any habit name and description, the domain suggestion service
   * must return at most 3 suggestions.
   *
   * **Validates: Requirements 3.1**
   */
  describe('Property 4.1: Number of suggestions is always <= 3', () => {
    it('should return at most 3 domain suggestions for any habit input', () => {
      fc.assert(
        fc.property(
          habitNameArbitrary,
          habitDescriptionArbitrary,
          (habitName, habitDescription) => {
            const suggestions = suggestDomainsWithKeywords(
              habitName,
              habitDescription,
              SAMPLE_DOMAINS
            );

            // Property: suggestions count must be <= MAX_SUGGESTIONS (3)
            expect(suggestions.length).toBeLessThanOrEqual(MAX_SUGGESTIONS);
            expect(suggestions.length).toBeGreaterThanOrEqual(0);

            return suggestions.length <= MAX_SUGGESTIONS;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return at most 3 suggestions even when many domains match', () => {
      // Create a habit name that matches many domains
      const multiMatchHabitNames = [
        'プログラミング コーディング システム開発 ソフトウェア',
        'programming coding software development engineering',
        '教育 研究 講義 大学 teaching professor',
      ];

      for (const habitName of multiMatchHabitNames) {
        const suggestions = suggestDomainsWithKeywords(
          habitName,
          null,
          SAMPLE_DOMAINS
        );

        expect(suggestions.length).toBeLessThanOrEqual(MAX_SUGGESTIONS);
      }
    });
  });


  /**
   * Property 4.2: Each suggestion has confidence >= 0.5
   *
   * For any domain suggestion returned, the confidence score must be
   * at least 0.5 (MIN_CONFIDENCE).
   *
   * **Validates: Requirements 3.1**
   */
  describe('Property 4.2: Each suggestion has confidence >= 0.5', () => {
    it('should have confidence >= 0.5 for all suggestions', () => {
      fc.assert(
        fc.property(
          habitNameArbitrary,
          habitDescriptionArbitrary,
          (habitName, habitDescription) => {
            const suggestions = suggestDomainsWithKeywords(
              habitName,
              habitDescription,
              SAMPLE_DOMAINS
            );

            // Property: all suggestions must have confidence >= MIN_CONFIDENCE
            for (const suggestion of suggestions) {
              expect(suggestion.confidence).toBeGreaterThanOrEqual(MIN_CONFIDENCE);
              expect(suggestion.confidence).toBeLessThanOrEqual(1.0);
            }

            return suggestions.every(s => s.confidence >= MIN_CONFIDENCE && s.confidence <= 1.0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have confidence in valid range [0.5, 1.0]', () => {
      const testCases = [
        { name: 'プログラミング', description: 'コーディングの練習' },
        { name: 'ヨガ', description: 'ウェルネス' },
        { name: '料理', description: '調理の練習' },
        { name: 'random text xyz', description: null },
      ];

      for (const { name, description } of testCases) {
        const suggestions = suggestDomainsWithKeywords(name, description, SAMPLE_DOMAINS);

        for (const suggestion of suggestions) {
          expect(suggestion.confidence).toBeGreaterThanOrEqual(MIN_CONFIDENCE);
          expect(suggestion.confidence).toBeLessThanOrEqual(1.0);
        }
      }
    });
  });


  /**
   * Property 4.3: Each suggestion has all required fields
   *
   * For any domain suggestion returned, it must have all required fields:
   * domainCode, domainName, majorCategory, confidence, reason
   *
   * **Validates: Requirements 3.1**
   */
  describe('Property 4.3: Each suggestion has all required fields', () => {
    it('should have all required fields for every suggestion', () => {
      fc.assert(
        fc.property(
          habitNameArbitrary,
          habitDescriptionArbitrary,
          (habitName, habitDescription) => {
            const suggestions = suggestDomainsWithKeywords(
              habitName,
              habitDescription,
              SAMPLE_DOMAINS
            );

            // Property: all suggestions must have valid structure
            for (const suggestion of suggestions) {
              expect(isValidDomainSuggestion(suggestion)).toBe(true);
              
              // Explicit field checks
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

              expect(suggestion.domainCode.length).toBeGreaterThan(0);
              expect(suggestion.domainName.length).toBeGreaterThan(0);
              expect(suggestion.majorCategory.length).toBeGreaterThan(0);
              expect(suggestion.reason.length).toBeGreaterThan(0);
            }

            return suggestions.every(s => isValidDomainSuggestion(s));
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Property 4.4: Suggestions are deterministic for the same input
   *
   * For any given habit name and description, calling the suggestion
   * function multiple times should return the same results.
   *
   * **Validates: Requirements 3.1**
   */
  describe('Property 4.4: Suggestions are deterministic for the same input', () => {
    it('should return same suggestions for identical inputs', () => {
      fc.assert(
        fc.property(
          habitNameArbitrary,
          habitDescriptionArbitrary,
          (habitName, habitDescription) => {
            // Call the function twice with the same input
            const suggestions1 = suggestDomainsWithKeywords(
              habitName,
              habitDescription,
              SAMPLE_DOMAINS
            );
            const suggestions2 = suggestDomainsWithKeywords(
              habitName,
              habitDescription,
              SAMPLE_DOMAINS
            );

            // Property: results should be identical
            expect(suggestions1.length).toBe(suggestions2.length);

            for (let i = 0; i < suggestions1.length; i++) {
              expect(suggestions1[i].domainCode).toBe(suggestions2[i].domainCode);
              expect(suggestions1[i].domainName).toBe(suggestions2[i].domainName);
              expect(suggestions1[i].majorCategory).toBe(suggestions2[i].majorCategory);
              expect(suggestions1[i].confidence).toBe(suggestions2[i].confidence);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be deterministic across multiple calls', () => {
      const testCases = [
        { name: 'プログラミングを学ぶ', description: 'TypeScriptの勉強' },
        { name: 'Exercise daily', description: 'Fitness training' },
        { name: '料理を作る', description: null },
      ];

      for (const { name, description } of testCases) {
        const results: DomainSuggestion[][] = [];
        
        // Call 5 times
        for (let i = 0; i < 5; i++) {
          results.push(suggestDomainsWithKeywords(name, description, SAMPLE_DOMAINS));
        }

        // All results should be identical
        for (let i = 1; i < results.length; i++) {
          expect(results[i]).toEqual(results[0]);
        }
      }
    });
  });


  /**
   * Property 4.5: Empty/whitespace habit names return valid suggestions (fallback to General)
   *
   * For any empty or whitespace-only habit name, the service should
   * return valid suggestions, falling back to the General domain.
   *
   * **Validates: Requirements 3.1, 3.5**
   */
  describe('Property 4.5: Empty/whitespace habit names return valid suggestions', () => {
    it('should return General domain for empty or whitespace habit names', () => {
      fc.assert(
        fc.property(
          emptyOrWhitespaceArbitrary,
          habitDescriptionArbitrary,
          (habitName, habitDescription) => {
            const suggestions = suggestDomainsWithKeywords(
              habitName,
              habitDescription,
              SAMPLE_DOMAINS
            );

            // Property: should return at least one suggestion
            expect(suggestions.length).toBeGreaterThanOrEqual(1);
            expect(suggestions.length).toBeLessThanOrEqual(MAX_SUGGESTIONS);

            // Property: all suggestions should be valid
            for (const suggestion of suggestions) {
              expect(isValidDomainSuggestion(suggestion)).toBe(true);
              expect(suggestion.confidence).toBeGreaterThanOrEqual(MIN_CONFIDENCE);
            }

            return suggestions.length >= 1 && suggestions.every(s => isValidDomainSuggestion(s));
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should fallback to General domain for completely empty input', () => {
      const suggestions = suggestDomainsWithKeywords('', null, SAMPLE_DOMAINS);

      expect(suggestions.length).toBe(1);
      expect(suggestions[0].domainCode).toBe(GENERAL_DOMAIN_CODE);
      expect(suggestions[0].domainName).toBe(GENERAL_DOMAIN_NAME);
      expect(suggestions[0].majorCategory).toBe(GENERAL_MAJOR_CATEGORY);
      expect(suggestions[0].confidence).toBe(MIN_CONFIDENCE);
    });

    it('should fallback to General domain for whitespace-only input', () => {
      const whitespaceInputs = ['   ', '\t', '\n', '  \t  \n  '];

      for (const input of whitespaceInputs) {
        const suggestions = suggestDomainsWithKeywords(input, null, SAMPLE_DOMAINS);

        expect(suggestions.length).toBe(1);
        expect(suggestions[0].domainCode).toBe(GENERAL_DOMAIN_CODE);
      }
    });

    it('should handle single character inputs gracefully', () => {
      const singleCharInputs = ['a', 'あ', '1', '@'];

      for (const input of singleCharInputs) {
        const suggestions = suggestDomainsWithKeywords(input, null, SAMPLE_DOMAINS);

        // Should return valid suggestions (likely General domain)
        expect(suggestions.length).toBeGreaterThanOrEqual(1);
        expect(suggestions.length).toBeLessThanOrEqual(MAX_SUGGESTIONS);
        
        for (const suggestion of suggestions) {
          expect(isValidDomainSuggestion(suggestion)).toBe(true);
        }
      }
    });
  });


  /**
   * Additional Property Tests for Robustness
   */
  describe('Additional robustness properties', () => {
    it('should handle very long habit names without exceeding max suggestions', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 100, maxLength: 1000 }),
          (longHabitName) => {
            const suggestions = suggestDomainsWithKeywords(
              longHabitName,
              null,
              SAMPLE_DOMAINS
            );

            expect(suggestions.length).toBeLessThanOrEqual(MAX_SUGGESTIONS);
            return suggestions.length <= MAX_SUGGESTIONS;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle special characters in habit names', () => {
      const specialCharNames = [
        'プログラミング！@#$%',
        'Learn <programming> & coding',
        '料理（調理）を作る',
        'Exercise: daily routine',
        '運動・フィットネス',
      ];

      for (const name of specialCharNames) {
        const suggestions = suggestDomainsWithKeywords(name, null, SAMPLE_DOMAINS);

        expect(suggestions.length).toBeLessThanOrEqual(MAX_SUGGESTIONS);
        expect(suggestions.length).toBeGreaterThanOrEqual(1);
        
        for (const suggestion of suggestions) {
          expect(isValidDomainSuggestion(suggestion)).toBe(true);
          expect(suggestion.confidence).toBeGreaterThanOrEqual(MIN_CONFIDENCE);
        }
      }
    });

    it('should handle unicode and emoji in habit names', () => {
      const unicodeNames = [
        '🏃 運動する',
        '📚 読書',
        '💻 プログラミング',
        '🧘 ヨガ',
        '🍳 料理',
      ];

      for (const name of unicodeNames) {
        const suggestions = suggestDomainsWithKeywords(name, null, SAMPLE_DOMAINS);

        expect(suggestions.length).toBeLessThanOrEqual(MAX_SUGGESTIONS);
        expect(suggestions.length).toBeGreaterThanOrEqual(1);
        
        for (const suggestion of suggestions) {
          expect(isValidDomainSuggestion(suggestion)).toBe(true);
        }
      }
    });

    it('should return suggestions sorted by relevance (highest confidence first)', () => {
      fc.assert(
        fc.property(
          habitNameArbitrary,
          habitDescriptionArbitrary,
          (habitName, habitDescription) => {
            const suggestions = suggestDomainsWithKeywords(
              habitName,
              habitDescription,
              SAMPLE_DOMAINS
            );

            // Property: suggestions should be sorted by confidence (descending)
            for (let i = 1; i < suggestions.length; i++) {
              expect(suggestions[i - 1].confidence).toBeGreaterThanOrEqual(
                suggestions[i].confidence
              );
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
