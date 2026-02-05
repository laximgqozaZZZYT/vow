/**
 * Chat.CandidateLabel - Candidate Label Component
 *
 * エージェントからの候補ラベルを表示するコンポーネント
 * Habit, Goal, Reply の3種類をサポート
 *
 * @module components/Chat.CandidateLabel
 */

'use client';

import React from 'react';
import type {
  CandidateLabel,
  HabitCandidateLabel,
  GoalCandidateLabel,
  ReplyCandidateLabel,
} from '../types/candidate-label.types';
import {
  isHabitCandidate,
  isGoalCandidate,
  isReplyCandidate,
} from '../types/candidate-label.types';

// ============================================================================
// Props Interface
// ============================================================================

export interface CandidateLabelButtonProps {
  /** 候補ラベルデータ */
  candidate: CandidateLabel;
  /** ロケール */
  locale: 'ja' | 'en';
  /** クリック時のコールバック */
  onClick: (candidate: CandidateLabel) => void;
  /** 無効状態 */
  disabled?: boolean;
}

export interface CandidateLabelListProps {
  /** 候補ラベル配列 */
  candidates: CandidateLabel[];
  /** ロケール */
  locale: 'ja' | 'en';
  /** クリック時のコールバック */
  onCandidateClick: (candidate: CandidateLabel) => void;
  /** 無効状態 */
  disabled?: boolean;
}

// ============================================================================
// Type Configuration
// ============================================================================

const typeConfig = {
  Habit: {
    icon: '📝',
    color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    hoverColor: 'hover:bg-blue-200 dark:hover:bg-blue-900/50',
  },
  Goal: {
    icon: '🎯',
    color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    hoverColor: 'hover:bg-purple-200 dark:hover:bg-purple-900/50',
  },
  Reply: {
    icon: '💬',
    color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
    hoverColor: 'hover:bg-green-200 dark:hover:bg-green-900/50',
  },
};

// ============================================================================
// Single Candidate Button Component
// ============================================================================

export function CandidateLabelButton({
  candidate,
  locale,
  onClick,
  disabled = false,
}: CandidateLabelButtonProps) {
  const config = typeConfig[candidate.type];

  // Extract additional info based on type
  const getSubtext = (): string | null => {
    if (isHabitCandidate(candidate)) {
      const habit = candidate.data;
      const parts: string[] = [];
      if (habit.repeat) parts.push(habit.repeat);
      if (habit.duration) parts.push(`${habit.duration}${locale === 'ja' ? '分' : 'min'}`);
      return parts.length > 0 ? parts.join(' / ') : null;
    }

    if (isGoalCandidate(candidate)) {
      const goal = candidate.data;
      if (goal.dueDate) {
        return `${locale === 'ja' ? '期限' : 'Due'}: ${goal.dueDate}`;
      }
      return null;
    }

    if (isReplyCandidate(candidate)) {
      return candidate.comment || null;
    }

    return null;
  };

  const subtext = getSubtext();

  return (
    <button
      type="button"
      onClick={() => onClick(candidate)}
      disabled={disabled}
      className={`
        flex items-start gap-2 px-3 py-2 rounded-lg border transition-colors
        ${config.color} ${config.hoverColor}
        disabled:opacity-50 disabled:cursor-not-allowed
        text-left w-full
      `}
    >
      <span className="text-lg flex-shrink-0">{config.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{candidate.label}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/50 dark:bg-black/20 flex-shrink-0">
            {candidate.type}
          </span>
        </div>
        {subtext && (
          <p className="text-xs opacity-80 mt-0.5 truncate">{subtext}</p>
        )}
      </div>
      <svg
        className="w-4 h-4 flex-shrink-0 opacity-50 mt-1"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

// ============================================================================
// Candidate List Component
// ============================================================================

export function CandidateLabelList({
  candidates,
  locale,
  onCandidateClick,
  disabled = false,
}: CandidateLabelListProps) {
  if (!candidates || candidates.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 mt-3">
      {candidates.map((candidate, index) => (
        <CandidateLabelButton
          key={`candidate-${index}-${candidate.label}`}
          candidate={candidate}
          locale={locale}
          onClick={onCandidateClick}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default CandidateLabelButton;
