/**
 * AI Coach Candidate Response Types v2
 *
 * AIコーチの候補表示機能のための統一型定義
 * すべてのAIレスポンスはこのフォーマットに準拠する
 *
 * @see /home/ubuntu/Downloads/vow/specs/ai-coach-hearing-flow/unified-candidate-format.md
 */

// ============================================================================
// Common Types
// ============================================================================

/**
 * エンティティタイプ
 */
export type CandidateEntityType = 'Habit' | 'Goal' | "Sticky'n" | 'others' | null;

/**
 * 操作タイプ
 */
export type CandidateOperationType = '見直し' | '新規提案' | '確認' | 'アドバイス' | 'others' | null;

/**
 * 候補タイプ
 */
export type CandidateType = 'Goal' | 'Habit' | "Sticky'n" | 'reply';

/**
 * 難易度レベル
 */
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

/**
 * UserReplyアクションタイプ
 */
export type ReplyActionType =
  | 'adjust_harder'      // もっと難しく
  | 'adjust_easier'      // もっとやさしく
  | 'more_specific'      // もっと具体的に
  | 'show_alternatives'  // 他には
  | 'confirm'            // これでOK
  | 'cancel'             // やめる
  | 'custom';            // カスタム

// ============================================================================
// Context & Requirements
// ============================================================================

/**
 * 会話コンテキスト
 */
export interface CandidateContext {
  /** 対象エンティティタイプ */
  aboutType: CandidateEntityType;
  /** 意図された操作 */
  aboutOperation: CandidateOperationType;
  /** 関連カテゴリ */
  categories: string[];
}

/**
 * 収集済みユーザー要件
 */
export interface GatheredRequirements {
  /** 明示的に収集した情報 */
  explicit: Record<string, unknown>;
  /** 推論した情報 */
  inferred: Record<string, unknown>;
  /** 収集完了率 (0.0 - 1.0) */
  completeness: number;
}

/**
 * 候補タイプフラグ
 */
export interface CandidateTypeFlags {
  showGoals: boolean;
  showHabits: boolean;
  showStickies: boolean;
  showReplies: boolean;
}

// ============================================================================
// Candidate Base
// ============================================================================

/**
 * 候補共通ベースインターフェース
 */
export interface CandidateBase {
  /** 表示ラベル（ボタンに表示） */
  label: string;
  /** 補足コメント（オプション） */
  comment?: string;
  /** 既存エンティティへの参照（見直し時） */
  existingId?: string;
  /** 信頼度 (0.0 - 1.0) */
  confidence?: number;
}

// ============================================================================
// Goal Candidate
// ============================================================================

/**
 * Goal詳細情報
 */
export interface GoalCandidateDetail {
  // === 必須 ===
  name: string;

  // === 任意（AI提案時に入力） ===
  details?: string;
  dueDate?: string;
  parentId?: string | null;

  // === AI提案専用 ===
  category?: string;
  difficulty?: DifficultyLevel;
  rationale?: string;
  suggestedHabits?: string[];
  milestones?: Array<{
    name: string;
    description?: string;
    targetDate?: string;
  }>;
}

/**
 * Goal候補
 */
export interface GoalCandidate extends CandidateBase {
  type: 'Goal';
  /** Goal候補の一意ID（Habit紐付け用、例: "goal-1", "goal-2"） */
  id?: string;
  detail: GoalCandidateDetail;
}

// ============================================================================
// Habit Candidate
// ============================================================================

/**
 * Habit詳細情報
 */
export interface HabitCandidateDetail {
  // === 必須 ===
  name: string;

  // === 基本設定 ===
  habitType?: 'do' | 'avoid';
  must?: number;
  duration?: number;
  repeat?: string;

  // === タイミング ===
  time?: string;
  endTime?: string;
  dueDate?: string;
  allDay?: boolean;

  // === 負荷設定 ===
  workloadUnit?: string;
  workloadTotal?: number;
  workloadPerCount?: number;

  // === AI提案専用 ===
  category?: string;
  difficulty?: DifficultyLevel;
  frequency?: string;
  reason?: string;
  triggerTime?: string;
  anchorHabit?: string;

  // === 関連付け ===
  goalId?: string;
  notes?: string;
}

/**
 * Habit候補
 */
export interface HabitCandidate extends CandidateBase {
  type: 'Habit';
  /** 紐付け先GoalのID（Goal候補のidに対応、例: "goal-1"） */
  parentGoalId?: string;
  detail: HabitCandidateDetail;
}

// ============================================================================
// Sticky Candidate
// ============================================================================

/**
 * Sticky詳細情報
 */
export interface StickyCandidateDetail {
  // === 必須 ===
  name: string;

  // === 任意 ===
  description?: string | null;
  completed?: boolean;
  displayOrder?: number;
  parentStickyId?: string | null;
  depth?: number;
  isReusable?: boolean;
}

/**
 * Sticky'n候補
 */
export interface StickyCandidate extends CandidateBase {
  type: "Sticky'n";
  detail: StickyCandidateDetail;
}

// ============================================================================
// Reply Candidate
// ============================================================================

/**
 * Reply詳細情報
 */
export interface ReplyCandidateDetail {
  /** アクション識別子 */
  action: ReplyActionType;
  /** カテゴリ指定 */
  category?: string;
  /** アイコン */
  icon?: string;
  /** 追加データ */
  [key: string]: unknown;
}

/**
 * UserReply候補
 */
export interface ReplyCandidate extends CandidateBase {
  type: 'reply';
  detail: ReplyCandidateDetail;
}

// ============================================================================
// Union Type
// ============================================================================

/**
 * すべての候補タイプのユニオン
 */
export type AnyCandidate = GoalCandidate | HabitCandidate | StickyCandidate | ReplyCandidate;

// ============================================================================
// Full Response
// ============================================================================

/**
 * AIコーチ統一レスポンスフォーマット v2
 */
export interface AICandidateResponse {
  // ========================================
  // 共通部 (Common Part)
  // ========================================

  /** AI応答メッセージ */
  message: string;

  /** 会話コンテキスト */
  context: CandidateContext;

  /** 収集済みユーザー要件 */
  gatheredRequirements: GatheredRequirements;

  /** 表示する候補タイプのフラグ */
  candidateTypes: CandidateTypeFlags;

  // ========================================
  // 候補部 (Candidates Part)
  // ========================================

  /** Goal候補リスト */
  goals?: GoalCandidate[];

  /** Habit候補リスト */
  habits?: HabitCandidate[];

  /** Sticky'n候補リスト */
  stickies?: StickyCandidate[];

  /** UserReply候補リスト（常に含む） */
  replies: ReplyCandidate[];
}

// ============================================================================
// Fixed Adjustment Replies
// ============================================================================

/**
 * 固定調整オプション
 * エンティティ候補表示時に必ず含める
 */
export const FIXED_ADJUSTMENT_REPLIES: ReplyCandidate[] = [
  {
    type: 'reply',
    label: 'もっと難しく',
    comment: '目標をより挑戦的に',
    detail: { action: 'adjust_harder', icon: '💪' },
  },
  {
    type: 'reply',
    label: 'もっとやさしく',
    comment: '負担を軽減',
    detail: { action: 'adjust_easier', icon: '🌱' },
  },
  {
    type: 'reply',
    label: 'もっと具体的に',
    comment: '詳細を追加',
    detail: { action: 'more_specific', icon: '🎯' },
  },
  {
    type: 'reply',
    label: '他には',
    comment: '別の候補を表示',
    detail: { action: 'show_alternatives', icon: '🔄' },
  },
];

// ============================================================================
// Type Guards
// ============================================================================

/**
 * AICandidateResponseの型ガード
 */
export function isAICandidateResponse(obj: unknown): obj is AICandidateResponse {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  // 必須フィールドのチェック
  if (typeof candidate.message !== 'string') {
    return false;
  }

  // contextのチェック
  if (!isValidContext(candidate.context)) {
    return false;
  }

  // gatheredRequirementsのチェック
  if (!isValidGatheredRequirements(candidate.gatheredRequirements)) {
    return false;
  }

  // candidateTypesのチェック
  if (!isValidCandidateTypeFlags(candidate.candidateTypes)) {
    return false;
  }

  // repliesのチェック（必須）
  if (!Array.isArray(candidate.replies)) {
    return false;
  }

  return true;
}

/**
 * Contextの型ガード
 */
function isValidContext(value: unknown): value is CandidateContext {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const ctx = value as Record<string, unknown>;

  // aboutType
  if (
    ctx.aboutType !== null &&
    ctx.aboutType !== 'Habit' &&
    ctx.aboutType !== 'Goal' &&
    ctx.aboutType !== "Sticky'n" &&
    ctx.aboutType !== 'others'
  ) {
    return false;
  }

  // aboutOperation
  if (
    ctx.aboutOperation !== null &&
    ctx.aboutOperation !== '見直し' &&
    ctx.aboutOperation !== '新規提案' &&
    ctx.aboutOperation !== '確認' &&
    ctx.aboutOperation !== 'アドバイス' &&
    ctx.aboutOperation !== 'others'
  ) {
    return false;
  }

  // categories
  if (!Array.isArray(ctx.categories)) {
    return false;
  }

  return true;
}

/**
 * GatheredRequirementsの型ガード
 */
function isValidGatheredRequirements(value: unknown): value is GatheredRequirements {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const req = value as Record<string, unknown>;

  if (typeof req.explicit !== 'object' || req.explicit === null) {
    return false;
  }

  if (typeof req.inferred !== 'object' || req.inferred === null) {
    return false;
  }

  if (typeof req.completeness !== 'number') {
    return false;
  }

  return true;
}

/**
 * CandidateTypeFlagsの型ガード
 */
function isValidCandidateTypeFlags(value: unknown): value is CandidateTypeFlags {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const flags = value as Record<string, unknown>;

  return (
    typeof flags.showGoals === 'boolean' &&
    typeof flags.showHabits === 'boolean' &&
    typeof flags.showStickies === 'boolean' &&
    typeof flags.showReplies === 'boolean'
  );
}

/**
 * GoalCandidateの型ガード
 */
export function isGoalCandidate(candidate: AnyCandidate): candidate is GoalCandidate {
  return candidate.type === 'Goal';
}

/**
 * HabitCandidateの型ガード
 */
export function isHabitCandidate(candidate: AnyCandidate): candidate is HabitCandidate {
  return candidate.type === 'Habit';
}

/**
 * StickyCandidateの型ガード
 */
export function isStickyCandidate(candidate: AnyCandidate): candidate is StickyCandidate {
  return candidate.type === "Sticky'n";
}

/**
 * ReplyCandidateの型ガード
 */
export function isReplyCandidate(candidate: AnyCandidate): candidate is ReplyCandidate {
  return candidate.type === 'reply';
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * JSONコードブロックからAICandidateResponseを抽出
 */
export function extractAICandidateResponse(content: string): AICandidateResponse | null {
  // JSONコードブロックを探す
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (!jsonMatch) {
    // コードブロックなしの場合、直接JSONとしてパースを試みる
    try {
      const parsed = JSON.parse(content);
      if (isAICandidateResponse(parsed)) {
        return parsed;
      }
    } catch {
      return null;
    }
    return null;
  }

  try {
    const parsed = JSON.parse(jsonMatch[1]);
    if (isAICandidateResponse(parsed)) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * エンティティ候補が存在するかチェック
 */
export function hasEntityCandidates(response: AICandidateResponse): boolean {
  return (
    (response.goals && response.goals.length > 0) ||
    (response.habits && response.habits.length > 0) ||
    (response.stickies && response.stickies.length > 0) ||
    false
  );
}

/**
 * 固定調整オプションを追加
 * エンティティ候補がある場合に使用
 */
export function ensureAdjustmentReplies(response: AICandidateResponse): AICandidateResponse {
  if (!hasEntityCandidates(response)) {
    return response;
  }

  // 既存のrepliesに固定オプションがなければ追加
  const existingActions = new Set(response.replies.map((r) => r.detail.action));
  const missingReplies = FIXED_ADJUSTMENT_REPLIES.filter(
    (r) => !existingActions.has(r.detail.action)
  );

  return {
    ...response,
    replies: [...response.replies, ...missingReplies],
  };
}

/**
 * デバッグモードのレスポンスを生成
 */
export function createDebugModeResponse(): AICandidateResponse {
  return {
    message: 'デバッグモード: すべての候補タイプを表示します。',
    context: {
      aboutType: 'others',
      aboutOperation: '確認',
      categories: ['debug', 'test'],
    },
    gatheredRequirements: {
      explicit: { debugMode: true },
      inferred: {},
      completeness: 1.0,
    },
    candidateTypes: {
      showGoals: true,
      showHabits: true,
      showStickies: true,
      showReplies: true,
    },
    goals: [
      {
        type: 'Goal',
        label: 'テスト目標: 健康的な生活を送る',
        comment: 'デバッグ用サンプル',
        confidence: 0.9,
        detail: {
          name: '健康的な生活を送る',
          details: '運動と食事改善で健康を維持',
          dueDate: '2026-06-30',
          category: '健康',
          difficulty: 'medium',
          rationale: 'デバッグ表示テスト用',
          suggestedHabits: ['毎朝のストレッチ', '野菜を多く食べる'],
        },
      },
    ],
    habits: [
      {
        type: 'Habit',
        label: 'テスト習慣: 毎朝10分ストレッチ',
        comment: 'デバッグ用サンプル',
        confidence: 0.85,
        detail: {
          name: '毎朝10分ストレッチ',
          habitType: 'do',
          must: 1,
          duration: 10,
          repeat: 'daily',
          time: '07:00',
          category: '運動',
          difficulty: 'easy',
          frequency: '毎日',
          reason: '柔軟性向上と目覚めの改善',
        },
      },
    ],
    stickies: [
      {
        type: "Sticky'n",
        label: 'テストメモ: 買い物リスト',
        comment: 'デバッグ用サンプル',
        detail: {
          name: '買い物リスト',
          description: '野菜、果物、プロテイン',
          completed: false,
          isReusable: true,
        },
      },
    ],
    replies: FIXED_ADJUSTMENT_REPLIES,
  };
}
