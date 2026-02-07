/**
 * Provider Chat Router
 *
 * SSE streaming endpoint for AI chat using the provider abstraction layer.
 * Clients send a POST with a message, provider, and optional conversation
 * history, and receive an SSE stream of ChatChunk events.
 *
 * SSE event format (compatible with MCP server):
 *   event: session\ndata: {"type":"session","sessionId":"openai-xxx"}\n\n
 *   event: token\ndata: {"type":"token","token":"Hello"}\n\n
 *   event: complete\ndata: {"type":"complete","content":"Hello world","sessionId":"openai-xxx"}\n\n
 *   data: [DONE]\n\n
 *
 * @module routers/providerChat
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { streamSSE } from 'hono/streaming';
import type { AuthContext } from '../middleware/auth.js';
import { getLogger } from '../utils/logger.js';
import { createProvider } from '../providers/provider-factory.js';
import type { ChatMessage } from '../providers/types.js';

const logger = getLogger('providerChatRouter');

// =============================================================================
// Request Schema
// =============================================================================

/**
 * Validation schema for the provider chat request body.
 */
const ProviderChatSchema = z.object({
  message: z.string().min(1).max(10000),
  systemPrompt: z.string().min(1),
  provider: z.enum(['openai', 'anthropic', 'gemini', 'codex']),
  model: z.string().optional(),
  sessionId: z.string().optional(),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      }),
    )
    .optional(),
});

// =============================================================================
// Router
// =============================================================================

const providerChatRouter = new Hono<{ Variables: AuthContext }>();

/**
 * POST /provider-chat
 *
 * Stream an AI response via SSE using the specified provider.
 * Requires JWT authentication.
 */
providerChatRouter.post(
  '/',
  zValidator('json', ProviderChatSchema),
  async (c: Context<{ Variables: AuthContext }>) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userId = user.sub;
    const body = c.req.valid('json' as never) as z.infer<typeof ProviderChatSchema>;

    const {
      message,
      systemPrompt,
      provider: providerType,
      model,
      sessionId,
      conversationHistory,
    } = body;

    logger.info('Provider chat request', {
      userId,
      provider: providerType,
      model: model ?? 'default',
      historyLength: conversationHistory?.length ?? 0,
    });

    // Build the provider
    let providerInstance;
    try {
      providerInstance = createProvider(userId, providerType, model);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to create provider';
      logger.error('Provider creation failed', err instanceof Error ? err : undefined, {
        userId,
        provider: providerType,
      });
      return c.json({ error: errMsg }, 400);
    }

    // Check provider availability
    const available = await providerInstance.isAvailable();
    if (!available) {
      return c.json(
        {
          error: 'PROVIDER_NOT_AVAILABLE',
          message: `${providerType} provider is not available. Please check your API key settings.`,
        },
        400,
      );
    }

    // Assemble messages array: history + current message
    const messages: ChatMessage[] = [
      ...(conversationHistory ?? []).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: message },
    ];

    // Environment detection: use non-streaming JSON in Lambda, SSE otherwise
    const isLambda = !!process.env['AWS_LAMBDA_FUNCTION_NAME'];
    const acceptsSSE = c.req.header('Accept')?.includes('text/event-stream');

    if (!isLambda && acceptsSSE) {
      // SSE streaming response (local development / non-Lambda environments)
      return streamSSE(c, async (stream) => {
        try {
          const generator = providerInstance.chat(messages, systemPrompt, {
            model,
            sessionId,
            userId,
          });

          for await (const chunk of generator) {
            await stream.writeSSE({
              event: chunk.type,
              data: JSON.stringify(chunk),
            });
          }

          // Send final [DONE] marker
          await stream.writeSSE({
            data: '[DONE]',
          });
        } catch (err) {
          logger.error('Provider chat stream error', err instanceof Error ? err : undefined, {
            userId,
            provider: providerType,
          });

          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify({
              type: 'error',
              error: err instanceof Error ? err.message : 'Stream error',
            }),
          });

          await stream.writeSSE({
            data: '[DONE]',
          });
        }
      });
    } else {
      // Non-streaming JSON response (Lambda environment fallback)
      logger.info('Using non-streaming JSON response', {
        userId,
        provider: providerType,
        isLambda,
        acceptsSSE,
      });

      let responseSessionId = '';
      let fullContent = '';
      let error: string | null = null;

      try {
        for await (const chunk of providerInstance.chat(messages, systemPrompt, {
          model,
          sessionId,
          userId,
        })) {
          if (chunk.type === 'session') responseSessionId = chunk.sessionId ?? '';
          else if (chunk.type === 'token') fullContent += chunk.token ?? '';
          else if (chunk.type === 'complete') fullContent = chunk.content ?? fullContent;
          else if (chunk.type === 'error') error = chunk.error ?? 'Unknown error';
        }
      } catch (err) {
        logger.error('Provider chat error', err instanceof Error ? err : undefined, {
          userId,
          provider: providerType,
        });
        error = err instanceof Error ? err.message : 'Chat error';
      }

      if (error) {
        return c.json({ error, sessionId: responseSessionId }, 500);
      }

      return c.json({ sessionId: responseSessionId, content: fullContent, type: 'complete' });
    }
  },
);

// =============================================================================
// Exports
// =============================================================================

export { providerChatRouter };
