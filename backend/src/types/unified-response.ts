/**
 * Unified Chat Response Format Types
 *
 * すべてのAIエージェント応答をこの形式に統一することで、
 * フロントエンドでの一貫したUI表示を実現する。
 *
 * @module types/unified-response
 * @see /home/ubuntu/Downloads/vow/specs/unified-chat-response-format/requirements.md
 * @see /home/ubuntu/Downloads/vow/specs/unified-chat-response-format/design.md
 */

import { z } from 'zod';

// =============================================================================
// Enums
// =============================================================================

/**
 * Entity Type
 * 対象エンティティのタイプを表す
 */
export const UnifiedEntityTypeSchema = z.enum([
  'Habit',
  'Goal',
  "Sticky'n(MEMO)",
  'others',
]).nullable();

export type UnifiedEntityType = z.infer<typeof UnifiedEntityTypeSchema>;

/**
 * Operation Type
 * ユーザーの意図する操作を表す
 */
export const UnifiedOperationTypeSchema = z.enum([
  '見直し',
  '新規提案',
  '確認',
  'アドバイス',
  'others',
]).nullable();

export type UnifiedOperationType = z.infer<typeof UnifiedOperationTypeSchema>;

/**
 * Button Type
 * ボタンのタイプを表す
 */
export const UnifiedButtonTypeSchema = z.enum([
  'Habit',
  'Goal',
  "Sticky'n(MEMO)",
  'reply',
]);

export type UnifiedButtonType = z.infer<typeof UnifiedButtonTypeSchema>;

// =============================================================================
// User Info Context
// =============================================================================

/**
 * User Info Context
 * 会話コンテキストを追跡するためのメタデータ
 */
export const UnifiedUserInfoSchema = z.object({
  about_type: UnifiedEntityTypeSchema
    .describe('対象エンティティタイプ'),
  about_operation: UnifiedOperationTypeSchema
    .describe('ユーザーの意図する操作'),
  about_category: z.array(z.string())
    .describe('関連カテゴリ（空配列可）'),
});

export type UnifiedUserInfo = z.infer<typeof UnifiedUserInfoSchema>;

// =============================================================================
// Detail Objects
// =============================================================================

/**
 * Timing Schema (from shared.ts)
 * 習慣のスケジュール情報
 */
export const TimingSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['Date', 'Daily', 'Weekly', 'Monthly']),
  date: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  cron: z.string().optional(),
});

export type Timing = z.infer<typeof TimingSchema>;

/**
 * Habit Detail
 * 習慣提案の詳細情報
 * @see Habit interface in frontend/app/dashboard/types/index.ts
 * @see HabitSuggestionDataSchema in backend/src/schemas/suggestions.ts
 */
export const UnifiedHabitDetailSchema = z.object({
  // === type discriminator ===
  type: z.literal('Habit'),

  // === 必須フィールド (DB schema) ===
  name: z.string()
    .describe('習慣名'),

  // === DB schema フィールド (実際のHabitインターフェースに合わせる) ===
  /** "do" or "avoid" - 実際のDBスキーマに合わせてhabitTypeではなくtype */
  habitType: z.enum(['do', 'avoid']).optional()
    .describe('習慣のタイプ（実行 or 回避） - CreateHabitPayload.typeにマッピング'),
  /** 目標回数 (must フィールドにマッピング) */
  must: z.number().positive().optional()
    .describe('目標回数 (Habit.mustにマッピング)'),
  /** 所要時間 (分) */
  duration: z.number().optional()
    .describe('所要時間（分）'),
  /** 繰り返し設定 */
  repeat: z.string().optional()
    .describe('繰り返し設定（例: "daily", "weekly"）'),
  /** 開始時刻 */
  time: z.string().optional()
    .describe('開始時刻 (HH:MM形式)'),
  /** 終了時刻 */
  endTime: z.string().optional()
    .describe('終了時刻 (HH:MM形式)'),
  /** 期限 */
  dueDate: z.string().optional()
    .describe('期限 (YYYY-MM-DD形式)'),
  /** 終日フラグ */
  allDay: z.boolean().optional()
    .describe('終日フラグ'),
  /** メモ/ノート */
  notes: z.string().optional()
    .describe('メモ/ノート'),
  /** 負荷の単位 */
  workloadUnit: z.string().optional()
    .describe('負荷の単位（例: "分", "回", "ページ"）'),
  /** 負荷の総量 */
  workloadTotal: z.number().optional()
    .describe('負荷の総量'),
  /** 1回あたりの負荷 */
  workloadPerCount: z.number().optional()
    .describe('1回あたりの負荷'),
  /** タイミング情報 */
  timings: z.array(TimingSchema).optional()
    .describe('スケジュール情報'),

  // === 提案専用フィールド (AIからの提案時のみ使用) ===
  /** 頻度の説明 */
  frequency: z.string().optional()
    .describe('頻度の説明（例: "毎日", "週3回"）'),
  /** 推奨理由 */
  reason: z.string().optional()
    .describe('推奨理由（AI提案時）'),
  /** カテゴリ */
  category: z.string().optional()
    .describe('カテゴリ'),
  /** 難易度 */
  difficulty: z.enum(['easy', 'medium', 'hard']).optional()
    .describe('難易度'),
  /** トリガー時刻の説明 */
  triggerTime: z.string().optional()
    .describe('トリガー時刻の説明'),
  /** アンカー習慣 */
  anchorHabit: z.string().optional()
    .describe('アンカーとなる習慣'),
});

export type UnifiedHabitDetail = z.infer<typeof UnifiedHabitDetailSchema>;

/**
 * Goal Detail
 * 目標提案の詳細情報
 * @see Goal interface in frontend/app/dashboard/types/index.ts
 * @see GoalSuggestionDataSchema in backend/src/schemas/suggestions.ts
 */
export const UnifiedGoalDetailSchema = z.object({
  // === type discriminator ===
  type: z.literal('Goal'),

  // === 必須フィールド (DB schema) ===
  name: z.string()
    .describe('目標名'),

  // === DB schema フィールド (実際のGoalインターフェースに合わせる) ===
  /** 目標の詳細説明 (DBスキーマではdetails、descriptionではない) */
  details: z.string().optional()
    .describe('目標の詳細説明'),
  /** 期限 (DBスキーマではdueDate、deadlineではない) */
  dueDate: z.string().optional()
    .describe('期限（YYYY-MM-DD または ISO 8601形式）'),
  /** 親ゴールID */
  parentId: z.string().nullable().optional()
    .describe('親ゴールID'),
  /** 完了フラグ */
  isCompleted: z.boolean().optional()
    .describe('完了フラグ'),

  // === 提案専用フィールド (AIからの提案時のみ使用) ===
  /** カテゴリ */
  category: z.string().optional()
    .describe('カテゴリ'),
  /** 難易度 */
  difficulty: z.enum(['easy', 'medium', 'hard']).optional()
    .describe('難易度'),
  /** 推奨される習慣 */
  suggestedHabits: z.array(z.string()).optional()
    .describe('推奨される習慣'),
  /** 目標設定の根拠 */
  rationale: z.string().optional()
    .describe('目標設定の根拠（AI提案時）'),
  /** マイルストーン */
  milestones: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    targetDate: z.string().optional(),
  })).optional()
    .describe('マイルストーン'),
});

export type UnifiedGoalDetail = z.infer<typeof UnifiedGoalDetailSchema>;

/**
 * Sticky'n Detail
 * メモの詳細情報
 * @see Sticky interface in frontend/app/dashboard/types/index.ts
 * @see stickyDbSchema in backend/src/schemas/dashboard.ts
 */
export const UnifiedStickyDetailSchema = z.object({
  // === type discriminator ===
  type: z.literal("Sticky'n(MEMO)"),

  // === 必須フィールド (DB schema) ===
  name: z.string()
    .describe('メモタイトル'),

  // === DB schema フィールド (実際のStickyインターフェースに合わせる) ===
  /** メモの説明 */
  description: z.string().nullable().optional()
    .describe('メモの説明'),
  /** 完了状態 */
  completed: z.boolean().optional()
    .describe('完了状態'),
  /** 表示順序 (camelCase - DBスキーマに合わせる) */
  displayOrder: z.number().optional()
    .describe('表示順序'),
  /** 親Sticky'nのID */
  parentStickyId: z.string().nullable().optional()
    .describe('親Sticky\'nのID'),
  /** ネストの深さ (0-2) */
  depth: z.number().min(0).max(2).optional()
    .describe('ネストの深さ (0-2)'),
  /** 使いまわし設定 */
  isReusable: z.boolean().optional()
    .describe('使いまわし設定（繰り返しHabitでリセット）'),
});

export type UnifiedStickyDetail = z.infer<typeof UnifiedStickyDetailSchema>;

/**
 * Reply Detail
 * 返信ボタンの詳細情報（ナビゲーション/アクション用）
 */
export const UnifiedReplyDetailSchema = z.object({
  action: z.string()
    .describe('アクション名（例: "select_category", "select_choice", "easier", "harder"）'),
  category: z.string().optional()
    .describe('カテゴリ'),
  choiceId: z.string().optional()
    .describe('選択肢ID'),
  icon: z.string().optional()
    .describe('アイコン（絵文字など）'),
}).catchall(z.unknown())
  .describe('拡張可能な追加プロパティ');

export type UnifiedReplyDetail = z.infer<typeof UnifiedReplyDetailSchema>;

// =============================================================================
// Button Definition
// =============================================================================

/**
 * Unified Button
 * すべてのボタンを統一した形式で表現
 */
export const UnifiedButtonSchema = z.object({
  type: UnifiedButtonTypeSchema
    .describe('ボタンタイプ'),
  label: z.string()
    .describe('ボタンラベル（ユーザーに表示）'),
  comment: z.string().nullable().optional()
    .describe('補足説明'),
  detail: z.union([
    UnifiedHabitDetailSchema,
    UnifiedGoalDetailSchema,
    UnifiedStickyDetailSchema,
    UnifiedReplyDetailSchema,
  ]).optional()
    .describe('エンティティ詳細情報'),
});

export type UnifiedButton = z.infer<typeof UnifiedButtonSchema>;

// =============================================================================
// Full Response
// =============================================================================

/**
 * Unified Chat Response
 * AIエージェントの統一レスポンス形式
 */
export const UnifiedChatResponseSchema = z.object({
  message: z.string()
    .describe('AI応答の本文テキスト'),
  userInfo: UnifiedUserInfoSchema
    .describe('会話コンテキストメタデータ'),
  buttons: z.array(UnifiedButtonSchema)
    .describe('アクションボタン配列（空配列可）'),
});

export type UnifiedChatResponse = z.infer<typeof UnifiedChatResponseSchema>;

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if an object is a UnifiedChatResponse
 */
export function isUnifiedChatResponse(obj: unknown): obj is UnifiedChatResponse {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate['message'] === 'string' &&
    typeof candidate['userInfo'] === 'object' &&
    candidate['userInfo'] !== null &&
    Array.isArray(candidate['buttons'])
  );
}

/**
 * Check if a button detail is a HabitDetail
 */
export function isHabitDetail(detail: unknown): detail is UnifiedHabitDetail {
  return typeof detail === 'object' && detail !== null && (detail as { type?: string }).type === 'Habit';
}

/**
 * Check if a button detail is a GoalDetail
 */
export function isGoalDetail(detail: unknown): detail is UnifiedGoalDetail {
  return typeof detail === 'object' && detail !== null && (detail as { type?: string }).type === 'Goal';
}

/**
 * Check if a button detail is a StickyDetail
 */
export function isStickyDetail(detail: unknown): detail is UnifiedStickyDetail {
  return typeof detail === 'object' && detail !== null && (detail as { type?: string }).type === "Sticky'n(MEMO)";
}

/**
 * Check if a button detail is a ReplyDetail
 */
export function isReplyDetail(detail: unknown): detail is UnifiedReplyDetail {
  return (
    typeof detail === 'object' &&
    detail !== null &&
    'action' in detail &&
    typeof (detail as { action: unknown }).action === 'string'
  );
}

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validate and parse a UnifiedChatResponse
 * @throws {z.ZodError} If validation fails
 */
export function validateUnifiedResponse(data: unknown): UnifiedChatResponse {
  return UnifiedChatResponseSchema.parse(data);
}

/**
 * Safely validate a UnifiedChatResponse (returns null on error)
 */
export function safeValidateUnifiedResponse(data: unknown): UnifiedChatResponse | null {
  const result = UnifiedChatResponseSchema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Validate a UnifiedButton
 * @throws {z.ZodError} If validation fails
 */
export function validateUnifiedButton(data: unknown): UnifiedButton {
  return UnifiedButtonSchema.parse(data);
}

/**
 * Validate a UnifiedUserInfo
 * @throws {z.ZodError} If validation fails
 */
export function validateUnifiedUserInfo(data: unknown): UnifiedUserInfo {
  return UnifiedUserInfoSchema.parse(data);
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create an empty UnifiedChatResponse
 */
export function createEmptyUnifiedResponse(message: string = ''): UnifiedChatResponse {
  return {
    message,
    userInfo: {
      about_type: null,
      about_operation: null,
      about_category: [],
    },
    buttons: [],
  };
}

/**
 * Create a simple text-only UnifiedChatResponse
 */
export function createTextOnlyResponse(
  message: string,
  aboutType: UnifiedEntityType = null,
  aboutOperation: UnifiedOperationType = null
): UnifiedChatResponse {
  return {
    message,
    userInfo: {
      about_type: aboutType,
      about_operation: aboutOperation,
      about_category: [],
    },
    buttons: [],
  };
}

/**
 * Add a button to a UnifiedChatResponse
 */
export function addButton(
  response: UnifiedChatResponse,
  button: UnifiedButton
): UnifiedChatResponse {
  return {
    ...response,
    buttons: [...response.buttons, button],
  };
}

/**
 * Set user info for a UnifiedChatResponse
 */
export function setUserInfo(
  response: UnifiedChatResponse,
  userInfo: Partial<UnifiedUserInfo>
): UnifiedChatResponse {
  return {
    ...response,
    userInfo: {
      ...response.userInfo,
      ...userInfo,
    },
  };
}
