/**
 * RAG (Retrieval-Augmented Generation) Router
 *
 * API endpoint for semantic search using embeddings.
 * Provides RAG search functionality for habits, goals, diary entries, and activities.
 *
 * Requirements: C-003 - RAG Search API
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { getSupabaseClient } from '../utils/supabase.js';
import { createEmbeddingService, type EmbeddingEntityType } from '../services/embedding-service.js';
import type { AuthContext } from '../middleware/auth.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('ragRouter');

// Create router
const ragRouter = new Hono<{ Variables: AuthContext }>();

/**
 * Request schema for RAG search.
 */
const RAGSearchRequestSchema = z.object({
  query: z.string().min(1).max(1000),
  entityTypes: z
    .array(z.enum(['habit', 'goal', 'diary', 'activity']))
    .optional()
    .default([]),
  limit: z.number().int().min(1).max(100).optional().default(10),
  threshold: z.number().min(0).max(1).optional().default(0.7),
});

export type RAGSearchRequest = z.infer<typeof RAGSearchRequestSchema>;

/**
 * Response schema for RAG search.
 */
export interface RAGSearchResponse {
  results: Array<{
    entityType: string;
    entityId: string;
    similarity: number;
    metadata: Record<string, unknown>;
  }>;
  query: string;
  totalResults: number;
  searchTimeMs: number;
}

/**
 * Error response schema.
 */
export interface RAGErrorResponse {
  error: string;
  message: string;
}

/**
 * POST /api/rag/search
 * Perform semantic search using embeddings.
 *
 * Uses EmbeddingService to generate query embedding and search
 * for similar entities in the user's data.
 *
 * Features:
 * - User data isolation (only searches authenticated user's data)
 * - Configurable entity type filtering
 * - Adjustable similarity threshold
 * - Performance logging for monitoring
 *
 * Requirements: C-003
 */
ragRouter.post(
  '/search',
  zValidator('json', RAGSearchRequestSchema),
  async (c: Context<{ Variables: AuthContext }>) => {
    const user = c.get('user');
    if (!user) {
      return c.json<RAGErrorResponse>({ error: 'UNAUTHORIZED', message: 'Authentication required' }, 401);
    }

    const userId = user.sub;
    const body = await c.req.json();
    const { query, entityTypes, limit, threshold } = body as RAGSearchRequest;

    // Performance tracking
    const startTime = Date.now();

    // Log query for performance monitoring
    logger.info('RAG search initiated', {
      userId,
      queryLength: query.length,
      entityTypes: entityTypes?.length ? entityTypes : 'all',
      limit,
      threshold,
    });

    try {
      const supabase = getSupabaseClient();
      const embeddingService = createEmbeddingService(supabase);

      // Execute semantic search
      // Build search options - only include entityTypes if provided and non-empty
      const searchOptions: {
        entityTypes?: EmbeddingEntityType[];
        limit: number;
        threshold: number;
      } = {
        limit,
        threshold,
      };

      // Only set entityTypes if we have a non-empty array
      if (entityTypes && entityTypes.length > 0) {
        searchOptions.entityTypes = entityTypes;
      }

      const results = await embeddingService.searchSimilar(userId, query, searchOptions);

      const searchTimeMs = Date.now() - startTime;

      // Log search performance
      logger.info('RAG search completed', {
        userId,
        queryLength: query.length,
        resultsCount: results.length,
        searchTimeMs,
        entityTypes: searchOptions.entityTypes || 'all',
        threshold,
      });

      // Log performance metrics for monitoring
      if (searchTimeMs > 1000) {
        logger.warning('RAG search slow response', {
          userId,
          searchTimeMs,
          queryLength: query.length,
          resultsCount: results.length,
        });
      }

      return c.json<RAGSearchResponse>({
        results: results.map((r) => ({
          entityType: r.entityType,
          entityId: r.entityId,
          similarity: r.similarity,
          metadata: r.metadata,
        })),
        query,
        totalResults: results.length,
        searchTimeMs,
      });
    } catch (error) {
      const searchTimeMs = Date.now() - startTime;

      // Log error with context
      logger.error('RAG search failed', error as Error, {
        userId,
        queryLength: query.length,
        entityTypes,
        limit,
        threshold,
        searchTimeMs,
      });

      // Handle specific error types
      if (error instanceof Error) {
        // OpenAI API errors
        if (error.message.includes('OpenAI')) {
          return c.json<RAGErrorResponse>(
            {
              error: 'EMBEDDING_SERVICE_ERROR',
              message: 'Failed to generate query embedding. Please try again later.',
            },
            503
          );
        }

        // Database errors
        if (error.message.includes('PGRST') || error.message.includes('supabase')) {
          return c.json<RAGErrorResponse>(
            {
              error: 'DATABASE_ERROR',
              message: 'Failed to execute search query. Please try again later.',
            },
            503
          );
        }
      }

      // Generic error response
      return c.json<RAGErrorResponse>(
        {
          error: 'SEARCH_FAILED',
          message: 'An error occurred while performing the search.',
        },
        500
      );
    }
  }
);

/**
 * Factory function to create RAG router.
 *
 * @returns Configured Hono router instance
 */
export function createRagRouter(): Hono<{ Variables: AuthContext }> {
  return ragRouter;
}

export { ragRouter };
