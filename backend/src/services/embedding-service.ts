/**
 * Embedding Service
 *
 * Provides vector embedding generation and similarity search using OpenAI Embeddings API
 * and Supabase pgvector extension.
 *
 * Features:
 * - Generate embeddings for habits, goals, diary entries, and activities
 * - Content hash-based change detection to prevent redundant API calls
 * - Vector similarity search using cosine distance
 * - Batch update for all user entities
 */

import OpenAI from 'openai';
import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getLogger } from '../utils/logger.js';
import { getSettings } from '../config.js';

const logger = getLogger('embeddingService');

const EMBEDDING_MODEL = process.env['OPENAI_EMBEDDING_MODEL'] || 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = parseInt(process.env['EMBEDDING_DIMENSIONS'] || '1536', 10);

/**
 * Entity types that can have embeddings.
 */
export type EmbeddingEntityType = 'habit' | 'goal' | 'diary' | 'activity';

/**
 * Input entity for embedding generation.
 */
export interface EmbeddingEntity {
  type: EmbeddingEntityType;
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
}

/**
 * Options for similarity search.
 */
export interface SearchOptions {
  entityTypes?: EmbeddingEntityType[];
  limit?: number;
  threshold?: number;
}

/**
 * Result from similarity search.
 */
export interface SearchResult {
  entityType: string;
  entityId: string;
  similarity: number;
  metadata: Record<string, unknown>;
}

/**
 * Result from batch update operation.
 */
export interface BatchUpdateResult {
  updated: number;
  errors: number;
}

/**
 * EmbeddingService - Generates and manages vector embeddings for user entities.
 *
 * Uses OpenAI text-embedding-3-small model (1536 dimensions) and stores
 * embeddings in Supabase using pgvector extension.
 */
export class EmbeddingService {
  private openai: OpenAI;

  /**
   * Creates a new EmbeddingService instance.
   *
   * @param supabase - Supabase client for database operations
   * @param openaiApiKey - Optional OpenAI API key (defaults to OPENAI_API_KEY env var)
   */
  constructor(
    private supabase: SupabaseClient,
    openaiApiKey?: string
  ) {
    this.openai = new OpenAI({
      apiKey: openaiApiKey || getSettings().openaiApiKey,
    });

    logger.info('EmbeddingService initialized', {
      model: EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
    });
  }

  /**
   * Generate embedding for a single entity.
   *
   * Uses content hashing to detect changes and skip redundant API calls.
   * Upserts the embedding into the database using the unique constraint
   * on (user_id, entity_type, entity_id).
   *
   * @param userId - User ID who owns the entity
   * @param entity - Entity to generate embedding for
   */
  async generateEmbedding(userId: string, entity: EmbeddingEntity): Promise<void> {
    const contentHash = this.hashContent(entity.content);

    // Check if embedding already exists with same content
    const { data: existing, error: selectError } = await this.supabase
      .from('embeddings')
      .select('content_hash')
      .eq('user_id', userId)
      .eq('entity_type', entity.type)
      .eq('entity_id', entity.id)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      // PGRST116 is "not found" which is expected for new entities
      logger.error('Failed to check existing embedding', selectError, {
        entityType: entity.type,
        entityId: entity.id,
      });
      throw selectError;
    }

    if (existing?.content_hash === contentHash) {
      logger.debug('Embedding already up to date', {
        entityType: entity.type,
        entityId: entity.id,
      });
      return;
    }

    // Generate embedding via OpenAI
    const startTime = Date.now();
    let embedding: number[];

    try {
      const response = await this.openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: entity.content,
        dimensions: EMBEDDING_DIMENSIONS,
      });

      const firstData = response.data[0];
      if (!firstData) {
        throw new Error('OpenAI returned empty embedding data');
      }
      embedding = firstData.embedding;

      logger.debug('OpenAI embedding generated', {
        entityType: entity.type,
        entityId: entity.id,
        latencyMs: Date.now() - startTime,
        tokensUsed: response.usage?.total_tokens,
      });
    } catch (error) {
      logger.error('OpenAI embedding generation failed', error as Error, {
        entityType: entity.type,
        entityId: entity.id,
        latencyMs: Date.now() - startTime,
      });
      throw error;
    }

    // Upsert embedding
    const { error: upsertError } = await this.supabase
      .from('embeddings')
      .upsert(
        {
          user_id: userId,
          entity_type: entity.type,
          entity_id: entity.id,
          embedding: embedding,
          content_hash: contentHash,
          metadata: entity.metadata || {},
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,entity_type,entity_id',
        }
      );

    if (upsertError) {
      logger.error('Failed to upsert embedding', upsertError, {
        entityType: entity.type,
        entityId: entity.id,
      });
      throw upsertError;
    }

    logger.info('Embedding generated', {
      entityType: entity.type,
      entityId: entity.id,
      contentLength: entity.content.length,
    });
  }

  /**
   * Search similar content using vector similarity.
   *
   * Generates an embedding for the query and uses the search_embeddings
   * Postgres function to find similar entities.
   *
   * @param userId - User ID to search within
   * @param query - Natural language query
   * @param options - Search options (entity types, limit, threshold)
   * @returns Array of search results sorted by similarity
   */
  async searchSimilar(
    userId: string,
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const { entityTypes, limit = 10, threshold = 0.7 } = options;

    // Generate query embedding
    const startTime = Date.now();
    let queryEmbedding: number[];

    try {
      const response = await this.openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: query,
        dimensions: EMBEDDING_DIMENSIONS,
      });

      const firstData = response.data[0];
      if (!firstData) {
        throw new Error('OpenAI returned empty query embedding data');
      }
      queryEmbedding = firstData.embedding;

      logger.debug('Query embedding generated', {
        queryLength: query.length,
        latencyMs: Date.now() - startTime,
      });
    } catch (error) {
      logger.error('Query embedding generation failed', error as Error, {
        queryLength: query.length,
        latencyMs: Date.now() - startTime,
      });
      throw error;
    }

    // Call search function
    const { data, error } = await this.supabase.rpc('search_embeddings', {
      query_embedding: queryEmbedding,
      target_user_id: userId,
      target_entity_types: entityTypes || null,
      match_count: limit,
      similarity_threshold: threshold,
    });

    if (error) {
      logger.error('Similarity search failed', error, {
        userId,
        entityTypes,
        limit,
        threshold,
      });
      throw error;
    }

    const results = (data || []).map((row: {
      entity_type: string;
      entity_id: string;
      similarity: number;
      metadata: Record<string, unknown>;
    }) => ({
      entityType: row.entity_type,
      entityId: row.entity_id,
      similarity: row.similarity,
      metadata: row.metadata,
    }));

    logger.info('Similarity search completed', {
      userId,
      queryLength: query.length,
      resultsCount: results.length,
      entityTypes,
      threshold,
    });

    return results;
  }

  /**
   * Batch update embeddings for all user entities.
   *
   * Fetches all habits and goals for the user and generates/updates
   * their embeddings. Uses content hashing to skip unchanged entities.
   *
   * @param userId - User ID to update embeddings for
   * @returns Count of updated and errored entities
   */
  async updateUserEmbeddings(userId: string): Promise<BatchUpdateResult> {
    let updated = 0;
    let errors = 0;

    logger.info('Starting batch embedding update', { userId });

    // Get habits
    const { data: habits, error: habitsError } = await this.supabase
      .from('habits')
      .select('id, name, description')
      .eq('owner_id', userId)
      .eq('active', true);

    if (habitsError) {
      logger.error('Failed to fetch habits for embedding update', habitsError, { userId });
    }

    for (const habit of habits || []) {
      try {
        await this.generateEmbedding(userId, {
          type: 'habit',
          id: habit.id,
          content: `${habit.name}${habit.description ? ': ' + habit.description : ''}`,
          metadata: { name: habit.name },
        });
        updated++;
      } catch (e) {
        logger.error('Failed to update habit embedding', e as Error, {
          habitId: habit.id,
          habitName: habit.name,
        });
        errors++;
      }
    }

    // Get goals
    const { data: goals, error: goalsError } = await this.supabase
      .from('goals')
      .select('id, name, description')
      .eq('owner_id', userId);

    if (goalsError) {
      logger.error('Failed to fetch goals for embedding update', goalsError, { userId });
    }

    for (const goal of goals || []) {
      try {
        await this.generateEmbedding(userId, {
          type: 'goal',
          id: goal.id,
          content: `${goal.name}${goal.description ? ': ' + goal.description : ''}`,
          metadata: { name: goal.name },
        });
        updated++;
      } catch (e) {
        logger.error('Failed to update goal embedding', e as Error, {
          goalId: goal.id,
          goalName: goal.name,
        });
        errors++;
      }
    }

    logger.info('Batch embedding update completed', {
      userId,
      updated,
      errors,
      habitsProcessed: habits?.length || 0,
      goalsProcessed: goals?.length || 0,
    });

    return { updated, errors };
  }

  /**
   * Delete embedding for a specific entity.
   *
   * @param userId - User ID who owns the entity
   * @param entityType - Type of entity
   * @param entityId - ID of entity
   */
  async deleteEmbedding(
    userId: string,
    entityType: EmbeddingEntityType,
    entityId: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('embeddings')
      .delete()
      .eq('user_id', userId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId);

    if (error) {
      logger.error('Failed to delete embedding', error, {
        entityType,
        entityId,
      });
      throw error;
    }

    logger.info('Embedding deleted', { entityType, entityId });
  }

  /**
   * Delete all embeddings for a user.
   *
   * @param userId - User ID to delete embeddings for
   */
  async deleteUserEmbeddings(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('embeddings')
      .delete()
      .eq('user_id', userId);

    if (error) {
      logger.error('Failed to delete user embeddings', error, { userId });
      throw error;
    }

    logger.info('All user embeddings deleted', { userId });
  }

  /**
   * Get embedding statistics for a user.
   *
   * @param userId - User ID to get stats for
   * @returns Statistics about user's embeddings
   */
  async getEmbeddingStats(userId: string): Promise<{
    total: number;
    byType: Record<string, number>;
  }> {
    const { data, error } = await this.supabase
      .from('embeddings')
      .select('entity_type')
      .eq('user_id', userId);

    if (error) {
      logger.error('Failed to get embedding stats', error, { userId });
      throw error;
    }

    const byType: Record<string, number> = {};
    for (const row of data || []) {
      byType[row.entity_type] = (byType[row.entity_type] || 0) + 1;
    }

    return {
      total: data?.length || 0,
      byType,
    };
  }

  /**
   * Hash content for change detection.
   *
   * @param content - Content to hash
   * @returns SHA-256 hash of the content
   */
  private hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }
}

/**
 * Factory function to create EmbeddingService instance.
 *
 * @param supabase - Supabase client
 * @param openaiApiKey - Optional OpenAI API key
 * @returns EmbeddingService instance
 */
export function createEmbeddingService(
  supabase: SupabaseClient,
  openaiApiKey?: string
): EmbeddingService {
  return new EmbeddingService(supabase, openaiApiKey);
}
