/**
 * OpenAI Chat Provider
 *
 * Implements the AIChatProvider interface for OpenAI models.
 * Retrieves the API key from the user's credential store with
 * environment variable fallback, and uses the OpenAI SDK with
 * streaming enabled.
 *
 * @module providers/openai-provider
 */

import OpenAI from 'openai';
import { getOpenAIApiKey } from '../services/credentials-store.js';
import { getLogger } from '../utils/logger.js';
import type {
  AIChatProvider,
  ChatChunk,
  ChatMessage,
  ChatOptions,
  ProviderInfo,
} from './types.js';

const logger = getLogger('openai-provider');

/** Default model when none is specified */
const DEFAULT_MODEL = 'gpt-4o';

/** Models supported by this provider */
const SUPPORTED_MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'];

/**
 * OpenAI implementation of the AIChatProvider interface.
 *
 * Streams chat completions using the OpenAI SDK and yields
 * ChatChunk objects suitable for SSE delivery.
 */
export class OpenAIChatProvider implements AIChatProvider {
  private readonly userId: string;
  private readonly model: string;

  constructor(userId: string, model?: string) {
    this.userId = userId;
    this.model = model ?? DEFAULT_MODEL;
  }

  /**
   * Return metadata about this provider.
   */
  getProviderInfo(): ProviderInfo {
    return {
      id: 'openai',
      name: 'OpenAI',
      nameJa: 'OpenAI',
      isAvailable: false, // checked asynchronously via isAvailable()
      currentModel: this.model,
      supportedModels: [...SUPPORTED_MODELS],
    };
  }

  /**
   * Check whether an API key is configured for the current user.
   */
  async isAvailable(): Promise<boolean> {
    try {
      const apiKey = await getOpenAIApiKey(this.userId);
      return apiKey !== null && apiKey.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Stream a chat completion from OpenAI.
   *
   * Yields chunks in the order: session -> token* -> complete (or error).
   */
  async *chat(
    messages: ChatMessage[],
    systemPrompt: string,
    options?: ChatOptions,
  ): AsyncGenerator<ChatChunk, void, unknown> {
    const sessionId = options?.sessionId ?? `openai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Emit session chunk first
    yield { type: 'session', sessionId };

    // Retrieve API key
    const apiKey = await getOpenAIApiKey(this.userId);
    if (!apiKey) {
      yield {
        type: 'error',
        error: 'OpenAI API key is not configured. Please set your API key in settings.',
        sessionId,
      };
      return;
    }

    // Build OpenAI client
    const client = new OpenAI({ apiKey });

    // Assemble messages with system prompt
    const openaiMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    const model = options?.model ?? this.model;

    logger.info('Starting OpenAI streaming chat', {
      userId: this.userId,
      model,
      messageCount: messages.length,
      sessionId,
    });

    let fullContent = '';

    try {
      const stream = await client.chat.completions.create({
        model,
        messages: openaiMessages,
        stream: true,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 4096,
      });

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (!choice) continue;

        const delta = choice.delta;
        if (delta?.content) {
          fullContent += delta.content;
          yield { type: 'token', token: delta.content };
        }
      }

      // Emit complete chunk with full accumulated content
      yield {
        type: 'complete',
        content: fullContent,
        sessionId,
      };

      logger.info('OpenAI streaming chat completed', {
        userId: this.userId,
        model,
        sessionId,
        contentLength: fullContent.length,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown OpenAI error';
      logger.error('OpenAI streaming chat error', err instanceof Error ? err : undefined, {
        userId: this.userId,
        model,
        sessionId,
      });

      yield {
        type: 'error',
        error: message,
        sessionId,
      };
    }
  }
}
