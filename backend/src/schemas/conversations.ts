/**
 * Conversations Schemas
 *
 * Zod schemas and TypeScript types for the conversations API.
 *
 * @module schemas/conversations
 */

import { z } from 'zod';

// =============================================================================
// Message Schemas
// =============================================================================

/**
 * Message role enum
 */
export const MessageRoleEnum = z.enum(['user', 'assistant', 'system']);
export type MessageRole = z.infer<typeof MessageRoleEnum>;

/**
 * Tool call result schema
 */
export const ToolCallResultSchema = z.object({
  toolName: z.string(),
  input: z.unknown(),
  output: z.unknown(),
  success: z.boolean(),
  durationMs: z.number(),
});

export type ToolCallResult = z.infer<typeof ToolCallResultSchema>;

/**
 * Conversation message schema
 */
export const ConversationMessageSchema = z.object({
  role: MessageRoleEnum,
  content: z.string(),
  timestamp: z.string().datetime(),
  toolCalls: z.array(ToolCallResultSchema).optional(),
});

export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;

// =============================================================================
// Query Schemas
// =============================================================================

/**
 * List conversations query schema
 */
export const ListConversationsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(50).default(20),
});

export type ListConversationsQuery = z.infer<typeof ListConversationsQuerySchema>;

/**
 * Get messages query schema
 */
export const GetMessagesQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export type GetMessagesQuery = z.infer<typeof GetMessagesQuerySchema>;

// =============================================================================
// Response Schemas
// =============================================================================

/**
 * Conversation preview schema (for list view)
 */
export const ConversationPreviewSchema = z.object({
  firstMessage: z.string().nullable(),
  lastMessage: z.string().nullable(),
});

/**
 * Conversation summary schema (for list view)
 */
export const ConversationSummarySchema = z.object({
  id: z.string(),
  messageCount: z.number(),
  quotaUsed: z.number(),
  createdAt: z.string().datetime(),
  lastActivityAt: z.string().datetime(),
  preview: ConversationPreviewSchema,
});

export type ConversationSummary = z.infer<typeof ConversationSummarySchema>;

/**
 * Full conversation schema
 */
export const ConversationSchema = z.object({
  id: z.string(),
  messages: z.array(ConversationMessageSchema),
  quotaUsed: z.number(),
  createdAt: z.string().datetime(),
  lastActivityAt: z.string().datetime(),
});

export type Conversation = z.infer<typeof ConversationSchema>;

/**
 * Conversation stats schema
 */
export const ConversationStatsSchema = z.object({
  totalConversations: z.number(),
  totalMessages: z.number(),
  totalQuotaUsed: z.number(),
  averageMessagesPerConversation: z.number(),
  lastConversationAt: z.string().datetime().nullable(),
});

export type ConversationStats = z.infer<typeof ConversationStatsSchema>;

// =============================================================================
// API Response Schemas
// =============================================================================

/**
 * List conversations response
 */
export const ListConversationsResponseSchema = z.object({
  conversations: z.array(ConversationSummarySchema),
  count: z.number(),
  limit: z.number(),
});

/**
 * Get conversation response
 */
export const GetConversationResponseSchema = z.object({
  conversation: ConversationSchema,
});

/**
 * Get messages response
 */
export const GetMessagesResponseSchema = z.object({
  messages: z.array(ConversationMessageSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
  hasMore: z.boolean(),
});

/**
 * Conversation stats response
 */
export const ConversationStatsResponseSchema = z.object({
  stats: ConversationStatsSchema,
});

/**
 * Delete conversation response
 */
export const DeleteConversationResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
