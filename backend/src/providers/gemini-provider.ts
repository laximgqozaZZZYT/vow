/**
 * Gemini Chat Provider
 *
 * Implements the AIChatProvider interface for Google Gemini models.
 * Retrieves the API key from the user's credential store with
 * environment variable fallback, and uses the Google Generative AI SDK
 * with streaming enabled.
 *
 * @module providers/gemini-provider
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getGeminiApiKey } from '../services/credentials-store.js';
import { getLogger } from '../utils/logger.js';
import type {
  AIChatProvider,
  ChatChunk,
  ChatMessage,
  ChatOptions,
  ProviderInfo,
} from './types.js';

const logger = getLogger('gemini-provider');

/** Default model when none is specified */
const DEFAULT_MODEL = 'gemini-2.0-flash';

/** Models supported by this provider */
const SUPPORTED_MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro', 'gemini-1.5-flash'];

/**
 * Google Gemini implementation of the AIChatProvider interface.
 *
 * Streams chat completions using the Google Generative AI SDK and yields
 * ChatChunk objects suitable for SSE delivery.
 */
export class GeminiChatProvider implements AIChatProvider {
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
      id: 'gemini',
      name: 'Google Gemini',
      nameJa: 'Google Gemini',
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
      const apiKey = await getGeminiApiKey(this.userId);
      return apiKey !== null && apiKey.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Stream a chat completion from Google Gemini.
   *
   * Yields chunks in the order: session -> token* -> complete (or error).
   */
  async *chat(
    messages: ChatMessage[],
    systemPrompt: string,
    options?: ChatOptions,
  ): AsyncGenerator<ChatChunk, void, unknown> {
    const sessionId = options?.sessionId ?? `gemini-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Emit session chunk first
    yield { type: 'session', sessionId };

    // Retrieve API key
    const apiKey = await getGeminiApiKey(this.userId);
    if (!apiKey) {
      yield {
        type: 'error',
        error: 'Gemini API key is not configured. Please set your API key in settings.',
        sessionId,
      };
      return;
    }

    // Build Gemini client
    const genAI = new GoogleGenerativeAI(apiKey);

    const model = options?.model ?? this.model;

    const generativeModel = genAI.getGenerativeModel({
      model,
      systemInstruction: systemPrompt,
    });

    // Convert ChatMessage[] to Gemini Content[] format.
    // Gemini uses 'user' and 'model' roles (not 'assistant').
    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) {
      yield { type: 'error', error: 'No message to send', sessionId };
      return;
    }

    logger.info('Starting Gemini streaming chat', {
      userId: this.userId,
      model,
      messageCount: messages.length,
      sessionId,
    });

    let fullContent = '';

    try {
      const chat = generativeModel.startChat({
        history,
        generationConfig: {
          temperature: options?.temperature ?? 0.7,
          maxOutputTokens: options?.maxTokens ?? 4096,
        },
      });

      const result = await chat.sendMessageStream(lastMessage.content);

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          fullContent += text;
          yield { type: 'token', token: text };
        }
      }

      // Emit complete chunk with full accumulated content
      yield {
        type: 'complete',
        content: fullContent,
        sessionId,
      };

      logger.info('Gemini streaming chat completed', {
        userId: this.userId,
        model,
        sessionId,
        contentLength: fullContent.length,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Gemini error';
      logger.error('Gemini streaming chat error', err instanceof Error ? err : undefined, {
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
