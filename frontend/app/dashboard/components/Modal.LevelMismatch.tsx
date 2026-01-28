"use client";

/**
 * Modal.LevelMismatch Component
 * 
 * Displays a warning when user attempts to create a habit with a level
 * significantly higher than their current user level.
 * Offers three choices: proceed anyway, get baby step suggestions, or cancel.
 * 
 * @module Modal.LevelMismatch
 * 
 * Validates: Requirements 3.2, 3.3
 */

import React from 'react';
import LevelBadge, { calculateTier } from './LevelBadge';

export type MismatchSeverity = 'none' | 'mild' | 'moderate' | 'severe';

export interface LevelMismatchResult {
  isMismatch: boolean;
  userLevel: number;
  habitLevel: number;
  levelGap: number;
  severity: MismatchSeverity;
  recommendation: 'proceed' | 'suggest_baby_steps' | 'strongly_suggest_baby_steps';
}

export interface LevelMismatchModalProps {
  open: boolean;
  onClose: () => void;
  habitName: string;
  mismatch: LevelMismatchResult;
  /** Called when user chooses to proceed with the original habit */
  onProceed: () => void;
  /** Called when user wants baby step suggestions */
  onRequestBabySteps: () => void;
  /** Called when user cancels habit creation */
  onCancel: () => void;
}

/**
 * Get severity-specific styling and messaging
 */
function getSeverityConfig(severity: MismatchSeverity): {
  icon: string;
  title: string;
  description: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  warningLevel: string;
} {
  switch (severity) {
    case 'severe':
      return {
        icon: '🚨',
        title: '大きなレベル差があります',
        description: 'この習慣はあなたの現在のレベルよりかなり難しいです。挫折のリスクが高いため、より簡単なバージョンから始めることを強くお勧めします。',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/30',
        textColor: 'text-red-700 dark:text-red-400',
        warningLevel: '高リスク',
      };
    case 'moderate':
      return {
        icon: '⚠️',
        title: 'レベル差に注意',
        description: 'この習慣はあなたの現在のレベルより難しいです。継続が難しくなる可能性があります。',
        bgColor: 'bg-orange-500/10',
        borderColor: 'border-orange-500/30',
        textColor: 'text-orange-700 dark:text-orange-400',
        warningLevel: '中リスク',
      };
    case 'mild':
    default:
      return {
        icon: '💡',
        title: 'ちょっとしたチャレンジ',
        description: 'この習慣はあなたの現在のレベルより少し難しいです。挑戦として取り組むか、より簡単なバージョンを検討してください。',
        bgColor: 'bg-yellow-500/10',
        borderColor: 'border-yellow-500/30',
        textColor: 'text-yellow-700 dark:text-yellow-400',
        warningLevel: '低リスク',
      };
  }
}

/**
 * Level comparison visualization
 */
function LevelComparison({
  userLevel,
  habitLevel,
  levelGap,
}: {
  userLevel: number;
  habitLevel: number;
  levelGap: number;
}) {
  const userTier = calculateTier(userLevel);
  const habitTier = calculateTier(habitLevel);

  return (
    <div className="flex items-center justify-center gap-4 py-4">
      {/* User Level */}
      <div className="text-center">
        <div className="text-xs text-muted-foreground mb-1">あなたのレベル</div>
        <LevelBadge level={userLevel} tier={userTier} size="md" />
      </div>

      {/* Gap indicator */}
      <div className="flex flex-col items-center">
        <div className="text-2xl">→</div>
        <div className="text-xs text-muted-foreground">
          +{levelGap}
        </div>
      </div>

      {/* Habit Level */}
      <div className="text-center">
        <div className="text-xs text-muted-foreground mb-1">習慣のレベル</div>
        <LevelBadge level={habitLevel} tier={habitTier} size="md" />
      </div>
    </div>
  );
}

/**
 * Action button component
 */
function ActionButton({
  onClick,
  variant,
  children,
  description,
}: {
  onClick: () => void;
  variant: 'primary' | 'secondary' | 'ghost';
  children: React.ReactNode;
  description?: string;
}) {
  const baseClasses = "w-full px-4 py-3 rounded-lg text-left transition-all min-h-[44px]";
  const variantClasses = {
    primary: "bg-primary text-primary-foreground hover:opacity-90",
    secondary: "bg-muted hover:bg-muted/80 border border-border",
    ghost: "hover:bg-muted/50 text-muted-foreground",
  };

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${variantClasses[variant]}`}
    >
      <div className="font-medium">{children}</div>
      {description && (
        <div className="text-xs opacity-70 mt-1">{description}</div>
      )}
    </button>
  );
}

/**
 * Modal.LevelMismatch component
 */
export default function LevelMismatchModal({
  open,
  onClose,
  habitName,
  mismatch,
  onProceed,
  onRequestBabySteps,
  onCancel,
}: LevelMismatchModalProps) {
  if (!open) return null;

  const config = getSeverityConfig(mismatch.severity);

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-lg text-card-foreground">
        {/* Header */}
        <div className={`p-4 rounded-t-xl ${config.bgColor} border-b ${config.borderColor}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{config.icon}</span>
              <div>
                <h2 className={`text-lg font-semibold ${config.textColor}`}>
                  {config.title}
                </h2>
                <span className={`text-xs ${config.textColor} opacity-70`}>
                  {config.warningLevel}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground p-2 min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors"
              aria-label="閉じる"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Habit name */}
          <div className="text-center">
            <div className="text-sm text-muted-foreground">作成しようとしている習慣</div>
            <div className="font-semibold text-lg mt-1">{habitName}</div>
          </div>

          {/* Level comparison */}
          <LevelComparison
            userLevel={mismatch.userLevel}
            habitLevel={mismatch.habitLevel}
            levelGap={mismatch.levelGap}
          />

          {/* Description */}
          <p className="text-sm text-muted-foreground text-center">
            {config.description}
          </p>

          {/* Action buttons */}
          <div className="space-y-2 pt-2">
            {/* Baby steps - recommended for moderate/severe */}
            <ActionButton
              onClick={onRequestBabySteps}
              variant={mismatch.severity === 'mild' ? 'secondary' : 'primary'}
              description="Lv.50とLv.10のベビーステップを提案します"
            >
              🪜 ベビーステップを見る
            </ActionButton>

            {/* Proceed anyway */}
            <ActionButton
              onClick={onProceed}
              variant={mismatch.severity === 'mild' ? 'primary' : 'secondary'}
              description="このレベルで習慣を作成します"
            >
              💪 このまま作成する
            </ActionButton>

            {/* Cancel */}
            <ActionButton
              onClick={onCancel}
              variant="ghost"
            >
              キャンセル
            </ActionButton>
          </div>

          {/* Tip for severe mismatch */}
          {mismatch.severity === 'severe' && (
            <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
              <span className="font-medium">💡 ヒント:</span> 習慣形成の研究によると、
              小さく始めて徐々にレベルアップする方が、長期的な成功率が高くなります。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
