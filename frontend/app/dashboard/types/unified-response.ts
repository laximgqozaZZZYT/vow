/**
 * Unified Response Format for MOC Chat
 *
 * すべてのAIエージェント応答をこの形式に統一
 * バックエンドのツール出力（suggest_habits, suggest_goals, etc.）を共通フォーマットで扱う
 *
 * @see /home/ubuntu/Downloads/vow/specs/unified-chat-response-format/requirements.md
 */

import type { Timing } from './shared';

// ============================================================================
// Entity Types
// ============================================================================

/**
 * エンティティタイプ - 会話の対象となるエンティティの種類
 */
export type UnifiedEntityType = 'Habit' | 'Goal' | "Sticky'n(MEMO)" | 'others' | null;

/**
 * 操作タイプ - ユーザーが意図する操作の種類
 */
export type UnifiedOperationType = '見直し' | '新規提案' | '確認' | 'アドバイス' | 'others' | null;

/**
 * ボタンタイプ - UIに表示されるボタンの種類
 */
export type UnifiedButtonType = 'Habit' | 'Goal' | "Sticky'n(MEMO)" | 'reply';

// ============================================================================
// User Info Context
// ============================================================================

/**
 * 会話コンテキストメタデータ
 * AIエージェントが現在の会話の文脈を示すために使用
 */
export interface UnifiedUserInfo {
  /** 対象エンティティタイプ */
  about_type: UnifiedEntityType;
  /** ユーザーの意図する操作 */
  about_operation: UnifiedOperationType;
  /** 関連カテゴリ（空配列可） */
  about_category: string[];
}

// ============================================================================
// Detail Objects (Entity-specific data)
// ============================================================================

/**
 * Habit詳細情報
 * HabitModalで使用される習慣の詳細データ
 * @see Habit interface in frontend/app/dashboard/types/index.ts
 * @see HabitSuggestionDataSchema in backend/src/schemas/suggestions.ts
 */
export interface UnifiedHabitDetail {
  // === type discriminator ===
  type: 'Habit';

  // === 必須フィールド (DB schema) ===
  /** 習慣名 */
  name: string;

  // === DB schema フィールド (実際のHabitインターフェースに合わせる) ===
  /** "do" or "avoid" - CreateHabitPayload.typeにマッピング */
  habitType?: 'do' | 'avoid';
  /** 目標回数 (Habit.mustにマッピング) */
  must?: number;
  /** 所要時間（分） */
  duration?: number;
  /** 繰り返し設定（例: "daily", "weekly"） */
  repeat?: string;
  /** 開始時刻 (HH:MM形式) */
  time?: string;
  /** 終了時刻 (HH:MM形式) */
  endTime?: string;
  /** 期限 (YYYY-MM-DD形式) */
  dueDate?: string;
  /** 終日フラグ */
  allDay?: boolean;
  /** メモ/ノート */
  notes?: string;
  /** 負荷の単位（例: "分", "回", "ページ"） */
  workloadUnit?: string;
  /** 負荷の総量 */
  workloadTotal?: number;
  /** 1回あたりの負荷 */
  workloadPerCount?: number;
  /** スケジュール情報 */
  timings?: Timing[];

  // === 提案専用フィールド (AIからの提案時のみ使用) ===
  /** 頻度の説明（例: "毎日", "週3回"） */
  frequency?: string;
  /** 推奨理由（AI提案時） */
  reason?: string;
  /** カテゴリ */
  category?: string;
  /** 難易度 */
  difficulty?: 'easy' | 'medium' | 'hard';
  /** トリガー時刻の説明 */
  triggerTime?: string;
  /** アンカーとなる習慣 */
  anchorHabit?: string;
}

/**
 * Goal詳細情報
 * GoalModalで使用される目標の詳細データ
 * @see Goal interface in frontend/app/dashboard/types/index.ts
 * @see GoalSuggestionDataSchema in backend/src/schemas/suggestions.ts
 */
export interface UnifiedGoalDetail {
  // === type discriminator ===
  type: 'Goal';

  // === 必須フィールド (DB schema) ===
  /** 目標名 */
  name: string;

  // === DB schema フィールド (実際のGoalインターフェースに合わせる) ===
  /** 目標の詳細説明 (DBスキーマではdetails) */
  details?: string;
  /** 期限 (DBスキーマではdueDate) - YYYY-MM-DD または ISO 8601形式 */
  dueDate?: string;
  /** 親ゴールID */
  parentId?: string | null;
  /** 完了フラグ */
  isCompleted?: boolean;

  // === 提案専用フィールド (AIからの提案時のみ使用) ===
  /** カテゴリ */
  category?: string;
  /** 難易度 */
  difficulty?: 'easy' | 'medium' | 'hard';
  /** 推奨される習慣リスト */
  suggestedHabits?: string[];
  /** 目標設定の根拠（AI提案時） */
  rationale?: string;
  /** マイルストーン */
  milestones?: Array<{
    name: string;
    description?: string;
    targetDate?: string;
  }>;
}

/**
 * Sticky'n (MEMO) 詳細情報
 * StickyModalで使用されるメモの詳細データ
 * @see Sticky interface in frontend/app/dashboard/types/index.ts
 * @see stickyDbSchema in backend/src/schemas/dashboard.ts
 */
export interface UnifiedStickyDetail {
  // === type discriminator ===
  type: "Sticky'n(MEMO)";

  // === 必須フィールド (DB schema) ===
  /** メモ名 */
  name: string;

  // === DB schema フィールド (実際のStickyインターフェースに合わせる) ===
  /** 説明文 */
  description?: string | null;
  /** 完了状態 */
  completed?: boolean;
  /** 表示順序 (camelCase - DBスキーマに合わせる) */
  displayOrder?: number;
  /** 親Sticky'nのID */
  parentStickyId?: string | null;
  /** ネストの深さ (0-2) */
  depth?: number;
  /** 使いまわし設定（繰り返しHabitでリセット） */
  isReusable?: boolean;
}

/**
 * Reply詳細情報
 * ナビゲーション・アクション用のボタンデータ
 */
export interface UnifiedReplyDetail {
  /** アクション種別 */
  action: string;
  /** カテゴリ (select_category時に使用) */
  category?: string;
  /** 選択肢ID (select_choice時に使用) */
  choiceId?: string;
  /** アイコン */
  icon?: string;
  /** 拡張可能なその他のプロパティ */
  [key: string]: unknown;
}

// ============================================================================
// Button Definition
// ============================================================================

/**
 * 統一ボタン定義
 * UIに表示されるすべてのボタンの共通構造
 */
export interface UnifiedButton {
  /** ボタンタイプ */
  type: UnifiedButtonType;
  /** ボタンラベル（ユーザーに表示される文字列） */
  label: string;
  /** 補足説明（オプション） */
  comment?: string | null;
  /** エンティティ詳細情報（ボタンタイプに応じて異なる） */
  detail?: UnifiedHabitDetail | UnifiedGoalDetail | UnifiedStickyDetail | UnifiedReplyDetail;
}

// ============================================================================
// Full Response
// ============================================================================

/**
 * 統一レスポンスフォーマット
 * すべてのAIエージェント（OpenAI Mastra / MCP Claude）の出力形式
 */
export interface UnifiedChatResponse {
  /** AI応答の本文テキスト（候補ラベル以外の文章） */
  message: string;
  /** 会話コンテキストメタデータ */
  userInfo: UnifiedUserInfo;
  /** アクションボタン配列（空配列可） */
  buttons: UnifiedButton[];
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * UnifiedChatResponseの型ガード関数
 * オブジェクトが統一レスポンス形式に準拠しているかをチェック
 *
 * @param obj - チェック対象のオブジェクト
 * @returns UnifiedChatResponse型であればtrue
 *
 * @example
 * ```typescript
 * const response = JSON.parse(messageContent);
 * if (isUnifiedResponse(response)) {
 *   // TypeScriptがresponseをUnifiedChatResponse型として扱う
 *   console.log(response.message);
 *   console.log(response.userInfo.about_type);
 * }
 * ```
 */
export function isUnifiedResponse(obj: unknown): obj is UnifiedChatResponse {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  // 必須フィールドのチェック
  if (typeof candidate.message !== 'string') {
    return false;
  }

  // userInfoのチェック
  if (typeof candidate.userInfo !== 'object' || candidate.userInfo === null) {
    return false;
  }

  const userInfo = candidate.userInfo as Record<string, unknown>;
  if (
    !isValidEntityType(userInfo.about_type) ||
    !isValidOperationType(userInfo.about_operation) ||
    !Array.isArray(userInfo.about_category) ||
    !userInfo.about_category.every((c) => typeof c === 'string')
  ) {
    return false;
  }

  // buttonsのチェック
  if (!Array.isArray(candidate.buttons)) {
    return false;
  }

  // すべてのボタンが有効な形式かチェック
  return candidate.buttons.every(isValidButton);
}

/**
 * UnifiedEntityTypeの型ガード
 */
function isValidEntityType(value: unknown): value is UnifiedEntityType {
  return (
    value === null ||
    value === 'Habit' ||
    value === 'Goal' ||
    value === "Sticky'n(MEMO)" ||
    value === 'others'
  );
}

/**
 * UnifiedOperationTypeの型ガード
 */
function isValidOperationType(value: unknown): value is UnifiedOperationType {
  return (
    value === null ||
    value === '見直し' ||
    value === '新規提案' ||
    value === '確認' ||
    value === 'アドバイス' ||
    value === 'others'
  );
}

/**
 * UnifiedButtonの型ガード
 */
function isValidButton(value: unknown): value is UnifiedButton {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const button = value as Record<string, unknown>;

  // 必須フィールドのチェック
  if (typeof button.label !== 'string') {
    return false;
  }

  // typeフィールドのチェック
  if (
    button.type !== 'Habit' &&
    button.type !== 'Goal' &&
    button.type !== "Sticky'n(MEMO)" &&
    button.type !== 'reply'
  ) {
    return false;
  }

  // commentは存在する場合はstring or null
  if (button.comment !== undefined && button.comment !== null && typeof button.comment !== 'string') {
    return false;
  }

  // detailは任意なので、存在する場合のみチェック
  if (button.detail !== undefined && (typeof button.detail !== 'object' || button.detail === null)) {
    return false;
  }

  return true;
}

/**
 * HabitDetailの型ガード
 */
export function isHabitDetail(detail: unknown): detail is UnifiedHabitDetail {
  if (typeof detail !== 'object' || detail === null) {
    return false;
  }

  const d = detail as Record<string, unknown>;
  return d.type === 'Habit' && typeof d.name === 'string';
}

/**
 * GoalDetailの型ガード
 */
export function isGoalDetail(detail: unknown): detail is UnifiedGoalDetail {
  if (typeof detail !== 'object' || detail === null) {
    return false;
  }

  const d = detail as Record<string, unknown>;
  return d.type === 'Goal' && typeof d.name === 'string';
}

/**
 * StickyDetailの型ガード
 */
export function isStickyDetail(detail: unknown): detail is UnifiedStickyDetail {
  if (typeof detail !== 'object' || detail === null) {
    return false;
  }

  const d = detail as Record<string, unknown>;
  return d.type === "Sticky'n(MEMO)" && typeof d.name === 'string';
}

/**
 * ReplyDetailの型ガード
 */
export function isReplyDetail(detail: unknown): detail is UnifiedReplyDetail {
  if (typeof detail !== 'object' || detail === null) {
    return false;
  }

  const d = detail as Record<string, unknown>;
  return typeof d.action === 'string';
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * JSONコードブロックから統一レスポンスを抽出
 * MCPからのレスポンスで使用されることを想定
 *
 * @param content - メッセージコンテンツ（Markdownコードブロックを含む可能性）
 * @returns 統一レスポンス、または抽出失敗時はnull
 *
 * @example
 * ```typescript
 * const mcpMessage = "以下の提案があります:\n```json\n{\"message\":\"...\",\"userInfo\":{...}}\n```";
 * const response = extractUnifiedResponseFromMarkdown(mcpMessage);
 * if (response) {
 *   console.log(response.buttons);
 * }
 * ```
 */
export function extractUnifiedResponseFromMarkdown(content: string): UnifiedChatResponse | null {
  // JSONコードブロックを探す
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (!jsonMatch) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonMatch[1]);
    if (isUnifiedResponse(parsed)) {
      return parsed;
    }
  } catch {
    // JSON parse失敗
    return null;
  }

  return null;
}

/**
 * ボタンタイプに基づいてdetailを安全にキャスト
 *
 * @param button - 統一ボタン
 * @returns 型安全なdetailオブジェクト
 */
export function getTypedDetail(button: UnifiedButton) {
  if (!button.detail) {
    return null;
  }

  switch (button.type) {
    case 'Habit':
      return isHabitDetail(button.detail) ? button.detail : null;
    case 'Goal':
      return isGoalDetail(button.detail) ? button.detail : null;
    case "Sticky'n(MEMO)":
      return isStickyDetail(button.detail) ? button.detail : null;
    case 'reply':
      return isReplyDetail(button.detail) ? button.detail : null;
    default:
      return null;
  }
}
