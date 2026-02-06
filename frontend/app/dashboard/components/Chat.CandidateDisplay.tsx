/**
 * Chat.CandidateDisplay - AI Candidate Display Component
 *
 * AIコーチからの候補（Goal/Habit/Sticky'n/Reply）を表示するコンポーネント
 * - エンティティ候補には [採用]/[不採用] トグルスイッチ
 * - トグルクリックで対応するEditモーダルを開く
 * - Replyボタンは常に最下部に表示
 *
 * @module Chat.CandidateDisplay
 * @see /home/ubuntu/Downloads/vow/specs/ai-coach-hearing-flow/unified-candidate-format.md
 */

'use client';

import React, { useState, useCallback } from 'react';
import type {
  AICandidateResponse,
  GoalCandidate,
  HabitCandidate,
  StickyCandidate,
  ReplyCandidate,
  AnyCandidate,
} from '../types/ai-candidate-response';
import {
  isGoalCandidate,
  isHabitCandidate,
  isStickyCandidate,
  isReplyCandidate,
} from '../types/ai-candidate-response';

// ============================================================================
// Props Interfaces
// ============================================================================

export interface CandidateDisplayProps {
  /** AI候補レスポンス */
  response: AICandidateResponse;
  /** ロケール */
  locale: 'ja' | 'en';
  /** Goal候補を採用した時のコールバック */
  onGoalAdopt?: (candidate: GoalCandidate) => void;
  /** Habit候補を採用した時のコールバック */
  onHabitAdopt?: (candidate: HabitCandidate) => void;
  /** Sticky候補を採用した時のコールバック */
  onStickyAdopt?: (candidate: StickyCandidate) => void;
  /** Reply選択時のコールバック */
  onReplySelect?: (candidate: ReplyCandidate) => void;
  /** 無効状態 */
  disabled?: boolean;
}

export interface EntityCandidateCardProps {
  /** 候補データ */
  candidate: GoalCandidate | HabitCandidate | StickyCandidate;
  /** ロケール */
  locale: 'ja' | 'en';
  /** 採用時のコールバック */
  onAdopt: () => void;
  /** 無効状態 */
  disabled?: boolean;
}

export interface ReplyCandidateButtonProps {
  /** Reply候補データ */
  candidate: ReplyCandidate;
  /** クリック時のコールバック */
  onClick: () => void;
  /** 無効状態 */
  disabled?: boolean;
}

// ============================================================================
// Type Configuration
// ============================================================================

const typeConfig = {
  Goal: {
    icon: '🎯',
    label: { ja: '目標', en: 'Goal' },
    color: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
    textColor: 'text-purple-700 dark:text-purple-300',
    adoptColor: 'bg-purple-500 hover:bg-purple-600 text-white',
    rejectColor: 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300',
  },
  Habit: {
    icon: '📝',
    label: { ja: '習慣', en: 'Habit' },
    color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    textColor: 'text-blue-700 dark:text-blue-300',
    adoptColor: 'bg-blue-500 hover:bg-blue-600 text-white',
    rejectColor: 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300',
  },
  "Sticky'n": {
    icon: '📌',
    label: { ja: 'メモ', en: 'Memo' },
    color: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    textColor: 'text-amber-700 dark:text-amber-300',
    adoptColor: 'bg-amber-500 hover:bg-amber-600 text-white',
    rejectColor: 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300',
  },
};

// ============================================================================
// Entity Candidate Card Component
// ============================================================================

function EntityCandidateCard({
  candidate,
  locale,
  onAdopt,
  disabled = false,
}: EntityCandidateCardProps) {
  const [adoptionState, setAdoptionState] = useState<'pending' | 'adopted' | 'rejected'>('pending');

  const config = typeConfig[candidate.type];

  // カードクリックで編集モーダルを開く
  const handleCardClick = useCallback(() => {
    if (disabled) return;
    onAdopt();
  }, [disabled, onAdopt]);

  // 詳細情報を取得
  const getSubtext = (): string | null => {
    if (candidate.type === 'Habit') {
      const detail = candidate.detail;
      const parts: string[] = [];
      if (detail.frequency) parts.push(detail.frequency);
      else if (detail.repeat) parts.push(detail.repeat);
      if (detail.duration) parts.push(`${detail.duration}${locale === 'ja' ? '分' : 'min'}`);
      if (detail.difficulty) {
        const diffLabels = { easy: locale === 'ja' ? '簡単' : 'Easy', medium: locale === 'ja' ? '普通' : 'Medium', hard: locale === 'ja' ? '難しい' : 'Hard' };
        parts.push(diffLabels[detail.difficulty]);
      }
      return parts.length > 0 ? parts.join(' / ') : null;
    }

    if (candidate.type === 'Goal') {
      const detail = candidate.detail;
      const parts: string[] = [];
      if (detail.dueDate) {
        parts.push(`${locale === 'ja' ? '期限' : 'Due'}: ${detail.dueDate}`);
      }
      if (detail.difficulty) {
        const diffLabels = { easy: locale === 'ja' ? '簡単' : 'Easy', medium: locale === 'ja' ? '普通' : 'Medium', hard: locale === 'ja' ? '難しい' : 'Hard' };
        parts.push(diffLabels[detail.difficulty]);
      }
      return parts.length > 0 ? parts.join(' / ') : null;
    }

    if (candidate.type === "Sticky'n") {
      const detail = candidate.detail;
      if (detail.description) {
        return detail.description;
      }
      return null;
    }

    return null;
  };

  // 推奨理由を取得
  const getReason = (): string | null => {
    if (candidate.type === 'Habit' && candidate.detail.reason) {
      return candidate.detail.reason;
    }
    if (candidate.type === 'Goal' && candidate.detail.rationale) {
      return candidate.detail.rationale;
    }
    return null;
  };

  // 採用ボタン - 状態のみ変更（モーダルは開かない）
  const handleAdopt = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // カードクリックイベントを防止
    setAdoptionState('adopted');
  }, []);

  // 不採用ボタン - 状態のみ変更
  const handleReject = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // カードクリックイベントを防止
    setAdoptionState('rejected');
  }, []);

  const subtext = getSubtext();
  const reason = getReason();

  return (
    <div
      onClick={handleCardClick}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
      className={`
        relative rounded-xl border-2 p-4 transition-all duration-200
        ${config.color}
        ${adoptionState === 'adopted' ? 'ring-2 ring-green-500 dark:ring-green-400' : ''}
        ${adoptionState === 'rejected' ? 'opacity-50' : ''}
        ${disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:shadow-md'}
      `}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">{config.icon}</span>
        <div className="flex-1 min-w-0">
          {/* Type badge + Label */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${config.textColor} bg-white/50 dark:bg-black/20`}>
              {config.label[locale]}
            </span>
            {candidate.confidence && candidate.confidence >= 0.8 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                {locale === 'ja' ? 'おすすめ' : 'Recommended'}
              </span>
            )}
          </div>

          {/* Main label */}
          <h4 className={`font-semibold text-base mt-1 ${config.textColor}`}>
            {candidate.label}
          </h4>

          {/* Subtext */}
          {subtext && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {subtext}
            </p>
          )}

          {/* Reason */}
          {reason && (
            <p className="text-xs italic text-gray-500 dark:text-gray-400 mt-2 border-l-2 border-gray-300 dark:border-gray-600 pl-2">
              {reason}
            </p>
          )}

          {/* Comment */}
          {candidate.comment && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {candidate.comment}
            </p>
          )}
        </div>
      </div>

      {/* Adoption Toggle - Bottom Right */}
      <div className="flex justify-end gap-2 mt-4">
        {adoptionState === 'pending' ? (
          <>
            <button
              type="button"
              onClick={handleReject}
              disabled={disabled}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${config.rejectColor}
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {locale === 'ja' ? '不採用' : 'Reject'}
            </button>
            <button
              type="button"
              onClick={handleAdopt}
              disabled={disabled}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${config.adoptColor}
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {locale === 'ja' ? '採用' : 'Adopt'}
            </button>
          </>
        ) : adoptionState === 'adopted' ? (
          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500 text-white">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {locale === 'ja' ? '採用済み' : 'Adopted'}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-400 text-white">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            {locale === 'ja' ? '不採用' : 'Rejected'}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Reply Candidate Button Component
// ============================================================================

function ReplyCandidateButton({
  candidate,
  onClick,
  disabled = false,
}: ReplyCandidateButtonProps) {
  const icon = candidate.detail.icon || '💬';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center gap-2 px-4 py-2 rounded-full
        bg-gray-100 dark:bg-gray-800
        hover:bg-gray-200 dark:hover:bg-gray-700
        text-gray-700 dark:text-gray-300
        text-sm font-medium
        transition-colors
        disabled:opacity-50 disabled:cursor-not-allowed
        border border-gray-200 dark:border-gray-700
      `}
    >
      <span>{icon}</span>
      <span>{candidate.label}</span>
    </button>
  );
}

// ============================================================================
// Main Candidate Display Component
// ============================================================================

export function CandidateDisplay({
  response,
  locale,
  onGoalAdopt,
  onHabitAdopt,
  onStickyAdopt,
  onReplySelect,
  disabled = false,
}: CandidateDisplayProps) {
  const { candidateTypes, goals, habits, stickies, replies } = response;

  // エンティティ候補が存在するかチェック
  const hasEntityCandidates =
    (candidateTypes.showGoals && goals && goals.length > 0) ||
    (candidateTypes.showHabits && habits && habits.length > 0) ||
    (candidateTypes.showStickies && stickies && stickies.length > 0);

  // 候補がひとつもなければ表示しない
  if (!hasEntityCandidates && (!candidateTypes.showReplies || !replies || replies.length === 0)) {
    return null;
  }

  return (
    <div className="mt-4 space-y-4">
      {/* Goal Candidates */}
      {candidateTypes.showGoals && goals && goals.length > 0 && (
        <div className="space-y-3">
          <h5 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {locale === 'ja' ? '🎯 目標候補' : '🎯 Goal Candidates'}
          </h5>
          <div className="space-y-3">
            {goals.map((goal, index) => (
              <EntityCandidateCard
                key={`goal-${index}-${goal.label}`}
                candidate={goal}
                locale={locale}
                onAdopt={() => onGoalAdopt?.(goal)}
                disabled={disabled}
              />
            ))}
          </div>
        </div>
      )}

      {/* Habit Candidates */}
      {candidateTypes.showHabits && habits && habits.length > 0 && (
        <div className="space-y-3">
          <h5 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {locale === 'ja' ? '📝 習慣候補' : '📝 Habit Candidates'}
          </h5>
          <div className="space-y-3">
            {habits.map((habit, index) => (
              <EntityCandidateCard
                key={`habit-${index}-${habit.label}`}
                candidate={habit}
                locale={locale}
                onAdopt={() => onHabitAdopt?.(habit)}
                disabled={disabled}
              />
            ))}
          </div>
        </div>
      )}

      {/* Sticky Candidates */}
      {candidateTypes.showStickies && stickies && stickies.length > 0 && (
        <div className="space-y-3">
          <h5 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {locale === 'ja' ? '📌 メモ候補' : '📌 Memo Candidates'}
          </h5>
          <div className="space-y-3">
            {stickies.map((sticky, index) => (
              <EntityCandidateCard
                key={`sticky-${index}-${sticky.label}`}
                candidate={sticky}
                locale={locale}
                onAdopt={() => onStickyAdopt?.(sticky)}
                disabled={disabled}
              />
            ))}
          </div>
        </div>
      )}

      {/* Reply Candidates - Always at bottom when entity candidates exist */}
      {candidateTypes.showReplies && replies && replies.length > 0 && (
        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap gap-2">
            {replies.map((reply, index) => (
              <ReplyCandidateButton
                key={`reply-${index}-${reply.label}`}
                candidate={reply}
                onClick={() => onReplySelect?.(reply)}
                disabled={disabled}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default CandidateDisplay;
