/**
 * Domain Mapping Service
 *
 * Provides AI-powered domain suggestion and keyword-based domain search
 * for mapping habits/tasks to JSCO occupation domains.
 *
 * Requirements: 2.4, 2.5, 3.1, 3.7
 */

import OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSettings } from '../config.js';
import { getLogger } from '../utils/logger.js';
import { AI_CONFIG, AIErrorCode, AIServiceError } from '../schemas/ai.js';

const logger = getLogger('domainMappingService');

// =============================================================================
// Constants
// =============================================================================

/** Maximum number of domain suggestions to return */
const MAX_SUGGESTIONS = 3;

/** Minimum confidence score for AI suggestions */
const MIN_CONFIDENCE = 0.5;

/** General domain code for unclassified habits */
const GENERAL_DOMAIN_CODE = '000';

/** General domain name */
const GENERAL_DOMAIN_NAME = '一般（未分類）';

/** General domain major category */
const GENERAL_MAJOR_CATEGORY = '一般';

// =============================================================================
// Types
// =============================================================================

/**
 * Domain suggestion from AI analysis
 */
export interface DomainSuggestion {
  domainCode: string;
  domainName: string;
  majorCategory: string;
  confidence: number; // 0.0 - 1.0
  reason: string;
}


/**
 * Occupation domain record from database
 */
export interface OccupationDomain {
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

/**
 * Pagination options for domain listing
 */
export interface PaginationOptions {
  page?: number;
  pageSize?: number;
}

/**
 * Paginated domain result
 */
export interface PaginatedDomains {
  domains: OccupationDomain[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * AI response format for domain suggestions
 */
interface AIDomainSuggestionResponse {
  suggestions: Array<{
    domainCode: string;
    domainName: string;
    confidence: number;
    reason: string;
  }>;
}

// =============================================================================
// Prompt Template
// =============================================================================

/**
 * AI Prompt for domain suggestion
 * Analyzes habit name and description to suggest relevant JSCO domains
 */
const DOMAIN_SUGGESTION_PROMPT = `あなたは習慣/タスクを厚生労働省編職業分類（JSCO）のドメインにマッピングする専門家です。

以下の習慣について、最も関連性の高い職業分類ドメインを最大3つ提案してください。

習慣名: {{HABIT_NAME}}
詳細: {{HABIT_DESCRIPTION}}

利用可能なドメイン（一部）:
- B-11-111: システムエンジニア（プログラミング、システム開発）
- B-11-112: プログラマー（コーディング、ソフトウェア開発）
- B-11-116: データサイエンティスト（データ分析、機械学習）
- B-11-117: Webデザイナー（UI/UX、フロントエンド）
- B-15-151: 大学教授（教育、研究、講義）
- B-19-193: カウンセラー（心理、メンタルヘルス）
- B-19-194: 栄養士（栄養、食事管理）
- B-20-203: 作家・ライター（執筆、文章）
- E-44-441: 調理師（料理、調理）
- E-47-472: フィットネスインストラクター（運動、トレーニング）
- E-47-473: ヨガインストラクター（ヨガ、ウェルネス）
- 000: 一般（未分類）- 特定の職業に関連しない一般的な習慣

回答形式（JSON）:
{
  "suggestions": [
    {
      "domainCode": "B-11-111",
      "domainName": "システムエンジニア",
      "confidence": 0.85,
      "reason": "プログラミングに関連する習慣のため"
    }
  ]
}

注意:
- 関連性が低い場合は提案数を減らしてください
- confidence は 0.5 以上のもののみ提案してください
- 一般的すぎる習慣（例：「水を飲む」「早起きする」）は "000" (一般) を提案してください
- 最大3つまでの提案に限定してください`;


// =============================================================================
// DomainMappingService Class
// =============================================================================

/**
 * Domain Mapping Service
 *
 * Provides AI-powered domain suggestion and keyword-based domain search
 * for mapping habits/tasks to JSCO occupation domains.
 *
 * Property 4: Maximum Domain Suggestions
 * For any habit or goal submitted for domain suggestion, the AI service
 * must return at most 3 domain suggestions, each with a confidence score >= 0.5.
 */
export class DomainMappingService {
  private readonly supabase: SupabaseClient;
  private readonly openai: OpenAI | null = null;
  private readonly model: string;
  private circuitBreakerOpen = false;
  private circuitBreakerResetTime = 0;
  private consecutiveFailures = 0;
  private readonly maxConsecutiveFailures = 5;
  private readonly circuitBreakerTimeout = 60000; // 1 minute

  /**
   * Initialize the DomainMappingService.
   *
   * @param supabase - Supabase client instance
   */
  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    const settings = getSettings();
    this.model = settings.openaiModel || AI_CONFIG.model;

    if (settings.openaiApiKey) {
      this.openai = new OpenAI({
        apiKey: settings.openaiApiKey,
      });
    }
  }

  // ===========================================================================
  // Public Methods
  // ===========================================================================

  /**
   * Check if AI service is available.
   */
  isAIAvailable(): boolean {
    if (this.circuitBreakerOpen) {
      if (Date.now() > this.circuitBreakerResetTime) {
        this.circuitBreakerOpen = false;
        this.consecutiveFailures = 0;
        logger.info('Circuit breaker reset');
      } else {
        return false;
      }
    }
    return this.openai !== null;
  }


  /**
   * Suggest domains for a habit using AI analysis.
   *
   * Property 4: Maximum Domain Suggestions
   * Returns at most 3 domain suggestions, each with confidence >= 0.5.
   *
   * Requirements: 3.1
   *
   * @param habitName - The name of the habit
   * @param habitDescription - Optional description/notes for the habit
   * @returns Array of domain suggestions (max 3)
   */
  async suggestDomains(
    habitName: string,
    habitDescription?: string | null
  ): Promise<DomainSuggestion[]> {
    logger.info('Suggesting domains for habit', { habitName, hasDescription: !!habitDescription });

    // Try AI-based suggestion first
    if (this.isAIAvailable()) {
      try {
        const suggestions = await this.suggestDomainsWithAI(habitName, habitDescription);
        if (suggestions.length > 0) {
          return suggestions;
        }
      } catch (error) {
        logger.warning('AI domain suggestion failed, falling back to keyword matching', {
          error: String(error),
          habitName,
        });
      }
    }

    // Fallback to keyword-based matching
    return this.suggestDomainsWithKeywords(habitName, habitDescription);
  }

  /**
   * Search domains by keyword query.
   *
   * Requirements: 2.5
   *
   * @param query - Search query string
   * @returns Array of matching domains
   */
  async searchDomains(query: string): Promise<OccupationDomain[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const searchTerm = query.trim().toLowerCase();

    logger.debug('Searching domains', { query: searchTerm });

    try {
      // Search by domain name or keywords
      const { data, error } = await this.supabase
        .from('occupation_domains')
        .select('*')
        .or(`minor_name.ilike.%${searchTerm}%,keywords.cs.{${searchTerm}}`)
        .limit(20);

      if (error) {
        logger.error('Domain search failed', new Error(error.message), { query: searchTerm });
        return [];
      }

      return this.mapDomainRecords(data || []);
    } catch (error) {
      logger.error('Domain search exception', error as Error, { query: searchTerm });
      return [];
    }
  }


  /**
   * Get all domains with pagination.
   *
   * Requirements: 2.4
   *
   * @param options - Pagination options
   * @returns Paginated domain result
   */
  async getAllDomains(options: PaginationOptions = {}): Promise<PaginatedDomains> {
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize || 20));
    const offset = (page - 1) * pageSize;

    logger.debug('Getting all domains', { page, pageSize });

    try {
      // Get total count
      const { count, error: countError } = await this.supabase
        .from('occupation_domains')
        .select('*', { count: 'exact', head: true });

      if (countError) {
        logger.error('Domain count failed', new Error(countError.message));
        return { domains: [], total: 0, page, pageSize, hasMore: false };
      }

      // Get paginated data
      const { data, error } = await this.supabase
        .from('occupation_domains')
        .select('*')
        .order('major_code', { ascending: true })
        .order('minor_code', { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (error) {
        logger.error('Domain fetch failed', new Error(error.message));
        return { domains: [], total: 0, page, pageSize, hasMore: false };
      }

      const total = count || 0;
      const domains = this.mapDomainRecords(data || []);

      return {
        domains,
        total,
        page,
        pageSize,
        hasMore: offset + domains.length < total,
      };
    } catch (error) {
      logger.error('Get all domains exception', error as Error);
      return { domains: [], total: 0, page, pageSize, hasMore: false };
    }
  }

  /**
   * Get domain by code.
   *
   * @param code - Domain minor code
   * @returns Domain if found, null otherwise
   */
  async getDomainByCode(code: string): Promise<OccupationDomain | null> {
    if (!code) {
      return null;
    }

    logger.debug('Getting domain by code', { code });

    try {
      const { data, error } = await this.supabase
        .from('occupation_domains')
        .select('*')
        .eq('minor_code', code)
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapDomainRecord(data);
    } catch (error) {
      logger.error('Get domain by code exception', error as Error, { code });
      return null;
    }
  }


  // ===========================================================================
  // Private Methods - AI Suggestion
  // ===========================================================================

  /**
   * Suggest domains using OpenAI API.
   *
   * @param habitName - The habit name
   * @param habitDescription - Optional habit description
   * @returns Array of domain suggestions
   */
  private async suggestDomainsWithAI(
    habitName: string,
    habitDescription?: string | null
  ): Promise<DomainSuggestion[]> {
    if (!this.openai) {
      throw new AIServiceError('OpenAI API key not configured', AIErrorCode.PROVIDER_ERROR);
    }

    const prompt = DOMAIN_SUGGESTION_PROMPT
      .replace('{{HABIT_NAME}}', habitName)
      .replace('{{HABIT_DESCRIPTION}}', habitDescription || '（説明なし）');

    try {
      const response = await this.callOpenAIWithRetry(prompt);
      const suggestions = this.parseAISuggestions(response.content);

      this.recordSuccess();

      // Validate and enrich suggestions with database data
      return this.validateAndEnrichSuggestions(suggestions);
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Call OpenAI API with exponential backoff retry.
   *
   * @param prompt - The prompt to send
   * @param retries - Number of retries
   * @returns API response content and token usage
   */
  private async callOpenAIWithRetry(
    prompt: string,
    retries = AI_CONFIG.maxRetries
  ): Promise<{ content: string; tokensUsed: number }> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const completion = await this.openai!.chat.completions.create({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'あなたは習慣を職業分類ドメインにマッピングする専門家です。JSONのみで応答してください。',
            },
            { role: 'user', content: prompt },
          ],
          temperature: AI_CONFIG.temperature,
          max_tokens: AI_CONFIG.maxTokensPerRequest,
          response_format: { type: 'json_object' },
        });

        const content = completion.choices[0]?.message?.content || '';
        const tokensUsed = completion.usage?.total_tokens || 0;

        logger.debug('OpenAI API call successful', {
          model: this.model,
          tokensUsed,
          attempt,
        });

        return { content, tokensUsed };
      } catch (error) {
        lastError = error as Error;

        // Check for rate limiting
        if (error instanceof OpenAI.RateLimitError) {
          const retryAfter = 60;
          if (attempt < retries) {
            const delay = AI_CONFIG.retryDelayMs * Math.pow(2, attempt);
            logger.warning('Rate limited, retrying', { attempt, delay });
            await this.sleep(delay);
            continue;
          }
          throw new AIServiceError(
            'APIレート制限に達しました',
            AIErrorCode.RATE_LIMITED,
            retryAfter
          );
        }

        // Check for API errors
        if (error instanceof OpenAI.APIError) {
          if (attempt < retries && error.status && error.status >= 500) {
            const delay = AI_CONFIG.retryDelayMs * Math.pow(2, attempt);
            logger.warning('API error, retrying', { attempt, delay, status: error.status });
            await this.sleep(delay);
            continue;
          }
        }

        logger.error('OpenAI API call failed', undefined, { errMsg: lastError?.message, attempt });
        throw new AIServiceError(
          'AI処理中にエラーが発生しました',
          AIErrorCode.PROVIDER_ERROR
        );
      }
    }

    throw new AIServiceError(
      'AI処理中にエラーが発生しました',
      AIErrorCode.PROVIDER_ERROR
    );
  }


  /**
   * Parse AI response into domain suggestions.
   *
   * @param content - Raw AI response content
   * @returns Parsed domain suggestions
   */
  private parseAISuggestions(content: string): DomainSuggestion[] {
    try {
      const json = JSON.parse(content) as AIDomainSuggestionResponse;

      if (!json.suggestions || !Array.isArray(json.suggestions)) {
        logger.warning('Invalid AI suggestion response format', { content });
        return [];
      }

      const suggestions: DomainSuggestion[] = [];

      for (const item of json.suggestions) {
        // Validate confidence threshold (Property 4)
        const confidence = Math.min(1, Math.max(0, Number(item.confidence) || 0));
        if (confidence < MIN_CONFIDENCE) {
          logger.debug('Skipping low confidence suggestion', {
            domainCode: item.domainCode,
            confidence,
          });
          continue;
        }

        suggestions.push({
          domainCode: String(item.domainCode || ''),
          domainName: String(item.domainName || ''),
          majorCategory: '', // Will be enriched from database
          confidence,
          reason: String(item.reason || '').slice(0, 200),
        });

        // Enforce max suggestions limit (Property 4)
        if (suggestions.length >= MAX_SUGGESTIONS) {
          break;
        }
      }

      return suggestions;
    } catch (err) {
      logger.error('Failed to parse AI suggestions', err instanceof Error ? err : undefined, { content });
      throw new AIServiceError('AI応答の解析に失敗しました', AIErrorCode.INVALID_RESPONSE);
    }
  }

  /**
   * Validate suggestions against database and enrich with full domain data.
   *
   * @param suggestions - Raw suggestions from AI
   * @returns Validated and enriched suggestions
   */
  private async validateAndEnrichSuggestions(
    suggestions: DomainSuggestion[]
  ): Promise<DomainSuggestion[]> {
    if (suggestions.length === 0) {
      return [];
    }

    const domainCodes = suggestions.map(s => s.domainCode);

    try {
      const { data, error } = await this.supabase
        .from('occupation_domains')
        .select('minor_code, minor_name, major_name')
        .in('minor_code', domainCodes);

      if (error || !data) {
        logger.warning('Failed to validate domain codes', { error: error?.message, domainCodes });
        return suggestions;
      }

      // Create lookup map
      const domainMap = new Map<string, { minorName: string; majorName: string }>();
      for (const domain of data) {
        domainMap.set(domain.minor_code, {
          minorName: domain.minor_name,
          majorName: domain.major_name,
        });
      }

      // Enrich and filter valid suggestions
      const enrichedSuggestions: DomainSuggestion[] = [];
      for (const suggestion of suggestions) {
        const domainData = domainMap.get(suggestion.domainCode);
        if (domainData) {
          enrichedSuggestions.push({
            ...suggestion,
            domainName: domainData.minorName,
            majorCategory: domainData.majorName,
          });
        } else {
          logger.debug('Invalid domain code from AI, skipping', { domainCode: suggestion.domainCode });
        }
      }

      return enrichedSuggestions.slice(0, MAX_SUGGESTIONS);
    } catch (error) {
      logger.error('Failed to enrich suggestions', error as Error);
      return suggestions.slice(0, MAX_SUGGESTIONS);
    }
  }


  // ===========================================================================
  // Private Methods - Keyword-based Fallback
  // ===========================================================================

  /**
   * Suggest domains using keyword matching as fallback.
   *
   * This method is used when AI is unavailable or fails.
   *
   * @param habitName - The habit name
   * @param habitDescription - Optional habit description
   * @returns Array of domain suggestions based on keyword matching
   */
  private async suggestDomainsWithKeywords(
    habitName: string,
    habitDescription?: string | null
  ): Promise<DomainSuggestion[]> {
    logger.debug('Using keyword-based domain suggestion', { habitName });

    // Combine name and description for keyword matching
    const searchText = `${habitName} ${habitDescription || ''}`.toLowerCase();
    const words = searchText.split(/\s+/).filter(w => w.length >= 2);

    if (words.length === 0) {
      return this.getGeneralDomainSuggestion();
    }

    try {
      // Get all domains with keywords
      const { data, error } = await this.supabase
        .from('occupation_domains')
        .select('*');

      if (error || !data || data.length === 0) {
        logger.warning('Failed to fetch domains for keyword matching', { error: error?.message });
        return this.getGeneralDomainSuggestion();
      }

      // Score each domain based on keyword matches
      const scoredDomains: Array<{ domain: OccupationDomain; score: number; matchedKeywords: string[] }> = [];

      for (const record of data) {
        const domain = this.mapDomainRecord(record);
        const { score, matchedKeywords } = this.calculateKeywordScore(words, domain);

        if (score > 0) {
          scoredDomains.push({ domain, score, matchedKeywords });
        }
      }

      // Sort by score descending and take top 3
      scoredDomains.sort((a, b) => b.score - a.score);
      const topDomains = scoredDomains.slice(0, MAX_SUGGESTIONS);

      if (topDomains.length === 0) {
        return this.getGeneralDomainSuggestion();
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
    } catch (error) {
      logger.error('Keyword-based suggestion failed', error as Error);
      return this.getGeneralDomainSuggestion();
    }
  }

  /**
   * Calculate keyword match score for a domain.
   *
   * @param words - Words from habit name/description
   * @param domain - Domain to score
   * @returns Score and matched keywords
   */
  private calculateKeywordScore(
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
   *
   * @returns Array with single general domain suggestion
   */
  private getGeneralDomainSuggestion(): DomainSuggestion[] {
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


  // ===========================================================================
  // Private Methods - Helpers
  // ===========================================================================

  /**
   * Map database record to OccupationDomain interface.
   *
   * @param record - Database record
   * @returns Mapped domain object
   */
  private mapDomainRecord(record: Record<string, unknown>): OccupationDomain {
    return {
      id: String(record['id'] || ''),
      majorCode: String(record['major_code'] || ''),
      majorName: String(record['major_name'] || ''),
      middleCode: String(record['middle_code'] || ''),
      middleName: String(record['middle_name'] || ''),
      minorCode: String(record['minor_code'] || ''),
      minorName: String(record['minor_name'] || ''),
      keywords: Array.isArray(record['keywords']) ? record['keywords'] as string[] : [],
      createdAt: String(record['created_at'] || ''),
    };
  }

  /**
   * Map multiple database records to OccupationDomain array.
   *
   * @param records - Database records
   * @returns Array of mapped domain objects
   */
  private mapDomainRecords(records: Array<Record<string, unknown>>): OccupationDomain[] {
    return records.map(record => this.mapDomainRecord(record));
  }

  /**
   * Record successful API call.
   */
  private recordSuccess(): void {
    this.consecutiveFailures = 0;
  }

  /**
   * Record failed API call and potentially open circuit breaker.
   */
  private recordFailure(): void {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      this.circuitBreakerOpen = true;
      this.circuitBreakerResetTime = Date.now() + this.circuitBreakerTimeout;
      logger.warning('Circuit breaker opened', {
        consecutiveFailures: this.consecutiveFailures,
        resetTime: new Date(this.circuitBreakerResetTime).toISOString(),
      });
    }
  }

  /**
   * Sleep for specified milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let _domainMappingService: DomainMappingService | null = null;

/**
 * Get or create the singleton DomainMappingService instance.
 *
 * @param supabase - Supabase client instance (required on first call)
 * @returns DomainMappingService instance
 */
export function getDomainMappingService(supabase?: SupabaseClient): DomainMappingService {
  if (_domainMappingService === null) {
    if (!supabase) {
      throw new Error('Supabase client required for first initialization');
    }
    _domainMappingService = new DomainMappingService(supabase);
  }
  return _domainMappingService;
}

/**
 * Reset the singleton instance (useful for testing).
 */
export function resetDomainMappingService(): void {
  _domainMappingService = null;
}
