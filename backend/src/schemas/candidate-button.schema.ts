/**
 * Candidate Button Schemas
 *
 * Zod schemas for MOC section chat candidate buttons feature.
 * These schemas define AI response format with mandatory button display.
 *
 * Requirements: MOC-CANDIDATE-BTN-001
 * Reference: /home/ubuntu/Downloads/vow/specs/moc-chat-candidate-buttons/
 *
 * @module schemas/candidate-button
 */

import { z } from 'zod';

// =============================================================================
// Enums and Constants
// =============================================================================

/**
 * Button type enumeration
 * - Habit: Habit suggestion with [Accept][Reject][Detail] buttons
 * - Goal: Goal suggestion with [Accept][Reject][Detail] buttons
 * - Sticky'n(MEMO): Memo suggestion with [Accept][Reject][Detail] buttons
 * - reply: Selection/reply button (sends as user message when clicked)
 */
export const ButtonTypeEnum = z.enum(['Habit', 'Goal', "Sticky'n(MEMO)", 'reply']);
export type ButtonType = z.infer<typeof ButtonTypeEnum>;

/**
 * About type enumeration for conversation context
 */
export const AboutTypeEnum = z.enum(['None', 'Habit', 'Goal', "Sticky'n(MEMO)", 'others']);
export type AboutType = z.infer<typeof AboutTypeEnum>;

/**
 * About operation enumeration for conversation context
 */
export const AboutOperationEnum = z.enum([
  'None',
  '見直し',
  '新規提案',
  '確認',
  'アドバイス',
  'others',
]);
export type AboutOperation = z.infer<typeof AboutOperationEnum>;

/**
 * Difficulty level enumeration
 */
export const DifficultyEnum = z.enum(['easy', 'medium', 'hard']);
export type Difficulty = z.infer<typeof DifficultyEnum>;

/**
 * Habit type enumeration
 */
export const HabitTypeEnum = z.enum(['do', 'avoid']);
export type HabitType = z.infer<typeof HabitTypeEnum>;

// =============================================================================
// UserInfo Schema
// =============================================================================

/**
 * User info context for conversation tracking
 * Maintains state about what the user is asking for across multiple turns
 */
export const UserInfoSchema = z.object({
  about_type: AboutTypeEnum.describe('対話の対象: 何について話しているか'),
  about_operation: AboutOperationEnum.describe('意図する操作: どんな操作をしたいか'),
  about_category: z
    .array(z.string())
    .default([])
    .describe('選択されたカテゴリ（複数可）'),
  about_detail: z
    .array(z.string())
    .default([])
    .describe('選択されたサブカテゴリ（複数可）'),
});

export type UserInfo = z.infer<typeof UserInfoSchema>;

// =============================================================================
// Detail Object Schemas
// =============================================================================

/**
 * Timing schema for habit schedule
 */
export const TimingSchema = z.object({
  day: z.string().optional().describe('曜日 (Monday, Tuesday, etc.)'),
  time: z.string().optional().describe('時刻 (HH:MM)'),
  endTime: z.string().optional().describe('終了時刻 (HH:MM)'),
});

export type Timing = z.infer<typeof TimingSchema>;

/**
 * Habit detail schema
 * Detailed information for Habit type button
 */
export const HabitDetailSchema = z.object({
  type: z.literal('Habit'),
  name: z.string().min(1).describe('習慣名 (必須)'),
  habitType: HabitTypeEnum.optional().describe('実行/回避'),
  must: z.number().int().positive().optional().describe('目標回数'),
  duration: z.number().int().positive().optional().describe('所要時間（分）'),
  repeat: z.string().optional().describe('繰り返し設定'),
  time: z.string().optional().describe('開始時刻 (HH:MM)'),
  endTime: z.string().optional().describe('終了時刻 (HH:MM)'),
  notes: z.string().optional().describe('メモ'),
  workloadUnit: z.string().optional().describe('負荷の単位'),
  workloadPerCount: z.number().positive().optional().describe('1回あたりの負荷'),
  timings: z.array(TimingSchema).optional().describe('スケジュール情報'),
  frequency: z.string().optional().describe('頻度の説明'),
  reason: z.string().optional().describe('推奨理由'),
  category: z.string().optional().describe('カテゴリ'),
  difficulty: DifficultyEnum.optional().describe('難易度'),
});

export type HabitDetail = z.infer<typeof HabitDetailSchema>;

/**
 * Goal detail schema
 * Detailed information for Goal type button
 */
export const GoalDetailSchema = z.object({
  type: z.literal('Goal'),
  name: z.string().min(1).describe('目標名 (必須)'),
  details: z.string().optional().describe('詳細説明'),
  dueDate: z.string().optional().describe('期限 (YYYY-MM-DD)'),
  parentId: z.string().uuid().nullable().optional().describe('親ゴールID'),
  category: z.string().optional().describe('カテゴリ'),
  difficulty: DifficultyEnum.optional().describe('難易度'),
  suggestedHabits: z.array(z.string()).optional().describe('推奨される習慣名'),
  rationale: z.string().optional().describe('目標設定の根拠'),
});

export type GoalDetail = z.infer<typeof GoalDetailSchema>;

/**
 * Sticky'n(MEMO) detail schema
 * Detailed information for Sticky'n(MEMO) type button
 */
export const StickyNDetailSchema = z.object({
  type: z.literal("Sticky'n(MEMO)"),
  name: z.string().min(1).describe('メモ名 (必須)'),
  description: z.string().nullable().optional().describe('説明文'),
  parentStickyId: z.string().uuid().nullable().optional().describe('親Sticky\'nのID'),
  isReusable: z.boolean().optional().describe('使いまわし設定'),
});

export type StickyNDetail = z.infer<typeof StickyNDetailSchema>;

/**
 * Reply detail schema
 * Detailed information for reply type button (selection buttons)
 */
export const ReplyDetailSchema = z.object({
  action: z.string().describe('アクションID'),
  category: z.string().optional().describe('カテゴリ（カテゴリ選択時）'),
  subCategory: z.string().optional().describe('サブカテゴリ（サブカテゴリ選択時）'),
  existingItemId: z.string().uuid().optional().describe('既存アイテムID（見直し選択時）'),
  icon: z.string().optional().describe('アイコン'),
});

export type ReplyDetail = z.infer<typeof ReplyDetailSchema>;

/**
 * Union of all detail schemas
 */
export const ButtonDetailSchema = z.union([
  HabitDetailSchema,
  GoalDetailSchema,
  StickyNDetailSchema,
  ReplyDetailSchema,
]);

export type ButtonDetail = z.infer<typeof ButtonDetailSchema>;

// =============================================================================
// Button Schema
// =============================================================================

/**
 * Unified button schema
 * Represents a single candidate button in AI response
 */
export const UnifiedButtonSchema = z.object({
  type: ButtonTypeEnum.describe('ボタンタイプ'),
  label: z.string().min(1).describe('ボタンラベル（必須）'),
  comment: z.string().optional().describe('説明文（任意）'),
  detail: ButtonDetailSchema.optional().describe('詳細情報（任意）'),
});

export type UnifiedButton = z.infer<typeof UnifiedButtonSchema>;

// =============================================================================
// Unified Response Schema
// =============================================================================

/**
 * Unified chat response schema
 * AI response format with mandatory buttons
 *
 * Requirements:
 * - FR-001: At least 1 button is required
 * - FR-007: JSON response format
 * - FR-008: userInfo conversation context tracking
 */
export const UnifiedChatResponseSchema = z.object({
  message: z.string().describe('候補ラベル以外の文章'),
  userInfo: UserInfoSchema.describe('会話コンテキスト追跡情報'),
  buttons: z
    .array(UnifiedButtonSchema)
    .min(1)
    .describe('候補ボタン配列（最低1つ必須）'),
});

export type UnifiedChatResponse = z.infer<typeof UnifiedChatResponseSchema>;

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validate unified response
 * Returns validated response or throws ZodError
 */
export function validateUnifiedResponse(data: unknown): UnifiedChatResponse {
  return UnifiedChatResponseSchema.parse(data);
}

/**
 * Safe validate unified response
 * Returns result object with success flag
 */
export function safeValidateUnifiedResponse(data: unknown): {
  success: boolean;
  data?: UnifiedChatResponse;
  error?: z.ZodError;
} {
  const result = UnifiedChatResponseSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error };
  }
}

/**
 * Check if data is a unified response
 * Type guard function
 */
export function isUnifiedResponse(data: unknown): data is UnifiedChatResponse {
  return UnifiedChatResponseSchema.safeParse(data).success;
}

/**
 * Ensure buttons are present
 * If no buttons, adds default continuation button
 */
export function ensureButtonsPresent(
  response: Partial<UnifiedChatResponse>,
  locale: 'ja' | 'en' = 'ja'
): UnifiedChatResponse {
  const buttons = response.buttons || [];

  if (buttons.length === 0) {
    // Add default continuation button
    buttons.push({
      type: 'reply',
      label: locale === 'ja' ? '続ける' : 'Continue',
      comment: undefined,
      detail: { action: 'continue' },
    });
  }

  return {
    message: response.message || '',
    userInfo: response.userInfo || {
      about_type: 'None',
      about_operation: 'None',
      about_category: [],
      about_detail: [],
    },
    buttons,
  };
}
