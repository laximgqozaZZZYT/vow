/**
 * Candidate Label Type Definitions
 *
 * エージェントが出力するJSON形式の候補ラベル定義
 * 3種類: Habit, Goal, Reply
 *
 * @module types/candidate-label.types
 */

import type { Timing } from './shared';

// ============================================================================
// Common Types
// ============================================================================

/** 候補ラベルの種類 */
export type CandidateLabelType = 'Habit' | 'Goal' | 'Reply';

// ============================================================================
// Habit Candidate (Habitスキーマ準拠)
// ============================================================================

/**
 * Habit候補ラベルのデータ構造
 * @see Habit interface in types/index.ts
 */
export interface HabitCandidateData {
  /** 習慣名 (必須) */
  name: string;
  /** 習慣タイプ: do=する習慣, avoid=避ける習慣 */
  type?: 'do' | 'avoid';
  /** 目標回数 */
  must?: number;
  /** 所要時間（分） */
  duration?: number;
  /** 繰り返し設定 (daily, weekly, monthly, etc.) */
  repeat?: string;
  /** 開始時刻 (HH:MM) */
  time?: string;
  /** 終了時刻 (HH:MM) */
  endTime?: string;
  /** 期限 (YYYY-MM-DD) */
  dueDate?: string;
  /** 終日フラグ */
  allDay?: boolean;
  /** メモ */
  notes?: string;
  /** 負荷の単位 (分, 回, ページ, etc.) */
  workloadUnit?: string;
  /** 負荷の総量 */
  workloadTotal?: number;
  /** 1回あたりの負荷 */
  workloadPerCount?: number;
  /** スケジュール情報 */
  timings?: Timing[];
  /** 紐づけるGoalのID */
  goalId?: string;
}

/**
 * Habit候補ラベル
 */
export interface HabitCandidateLabel {
  type: 'Habit';
  /** ボタンラベル（ユーザーに表示） */
  label: string;
  /** 補足コメント */
  comment?: string | null;
  /** Habitデータ */
  data: HabitCandidateData;
}

// ============================================================================
// Goal Candidate (Goalスキーマ準拠)
// ============================================================================

/**
 * Goal候補ラベルのデータ構造
 * @see Goal interface in types/index.ts
 */
export interface GoalCandidateData {
  /** 目標名 (必須) */
  name: string;
  /** 目標の詳細説明 */
  details?: string;
  /** 期限 (YYYY-MM-DD または ISO 8601) */
  dueDate?: string;
  /** 親ゴールID */
  parentId?: string | null;
}

/**
 * Goal候補ラベル
 */
export interface GoalCandidateLabel {
  type: 'Goal';
  /** ボタンラベル（ユーザーに表示） */
  label: string;
  /** 補足コメント */
  comment?: string | null;
  /** Goalデータ */
  data: GoalCandidateData;
}

// ============================================================================
// Reply Candidate (アクション用)
// ============================================================================

/**
 * Reply候補ラベルのデータ構造
 */
export interface ReplyCandidateData {
  /** アクション種別 (select_category, send_message, etc.) */
  action: string;
  /** 送信するメッセージ内容 */
  message?: string;
  /** カテゴリ (select_category時) */
  category?: string;
  /** 選択肢ID */
  choiceId?: string;
  /** アイコン */
  icon?: string;
}

/**
 * Reply候補ラベル
 */
export interface ReplyCandidateLabel {
  type: 'Reply';
  /** ボタンラベル（ユーザーに表示） */
  label: string;
  /** 補足コメント */
  comment?: string | null;
  /** Replyデータ */
  data: ReplyCandidateData;
}

// ============================================================================
// Union Type
// ============================================================================

/** 候補ラベル (3種類のUnion) */
export type CandidateLabel = HabitCandidateLabel | GoalCandidateLabel | ReplyCandidateLabel;

// ============================================================================
// Agent Response Format (エージェント出力JSON形式)
// ============================================================================

/**
 * エージェントからの応答形式
 * エージェントはこの形式でJSONを出力する
 */
export interface AgentCandidateResponse {
  /** AI応答の本文テキスト */
  message: string;
  /** 候補ラベル配列 (空配列可) */
  candidates: CandidateLabel[];
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * HabitCandidateLabelの型ガード
 */
export function isHabitCandidate(label: CandidateLabel): label is HabitCandidateLabel {
  return label.type === 'Habit' && typeof label.data?.name === 'string';
}

/**
 * GoalCandidateLabelの型ガード
 */
export function isGoalCandidate(label: CandidateLabel): label is GoalCandidateLabel {
  return label.type === 'Goal' && typeof label.data?.name === 'string';
}

/**
 * ReplyCandidateLabelの型ガード
 */
export function isReplyCandidate(label: CandidateLabel): label is ReplyCandidateLabel {
  return label.type === 'Reply' && typeof label.data?.action === 'string';
}

/**
 * AgentCandidateResponseの型ガード
 */
export function isAgentCandidateResponse(obj: unknown): obj is AgentCandidateResponse {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  if (typeof candidate.message !== 'string') {
    return false;
  }

  if (!Array.isArray(candidate.candidates)) {
    return false;
  }

  return candidate.candidates.every((c: unknown) => {
    if (typeof c !== 'object' || c === null) return false;
    const label = c as Record<string, unknown>;
    return (
      (label.type === 'Habit' || label.type === 'Goal' || label.type === 'Reply') &&
      typeof label.label === 'string' &&
      typeof label.data === 'object' &&
      label.data !== null
    );
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * JSONコードブロックからAgentCandidateResponseを抽出
 */
export function extractCandidatesFromMarkdown(content: string): AgentCandidateResponse | null {
  // JSONコードブロックを探す
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (!jsonMatch) {
    // JSONブロックがない場合、純粋なJSONとして試行
    try {
      const parsed = JSON.parse(content);
      if (isAgentCandidateResponse(parsed)) {
        return parsed;
      }
    } catch {
      // パース失敗
    }
    return null;
  }

  try {
    const parsed = JSON.parse(jsonMatch[1]);
    if (isAgentCandidateResponse(parsed)) {
      return parsed;
    }
  } catch {
    // JSON parse失敗
  }

  return null;
}

/**
 * CandidateLabelの配列を検証
 */
export function validateCandidates(candidates: unknown[]): CandidateLabel[] {
  return candidates.filter((c): c is CandidateLabel => {
    if (typeof c !== 'object' || c === null) return false;
    const label = c as Record<string, unknown>;

    if (typeof label.label !== 'string') return false;
    if (typeof label.data !== 'object' || label.data === null) return false;

    const data = label.data as Record<string, unknown>;

    switch (label.type) {
      case 'Habit':
        return typeof data.name === 'string';
      case 'Goal':
        return typeof data.name === 'string';
      case 'Reply':
        return typeof data.action === 'string';
      default:
        return false;
    }
  });
}
