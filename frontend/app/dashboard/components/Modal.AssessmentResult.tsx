"use client";

/**
 * Modal.AssessmentResult Component
 * 
 * Displays the results of a THLI-24 assessment including:
 * - O/E/C level estimates
 * - Recommended starting workload
 * - Explanation of what the level means
 * 
 * @module Modal.AssessmentResult
 * 
 * Validates: Requirements 4.3
 */

import React from 'react';
import LevelBadge, { calculateTier, getTierColors, type LevelTier } from './LevelBadge';

export interface AssessmentResultData {
  /** Optimistic level estimate */
  oLevel: number;
  /** Expected level range */
  eLevelRange: { min: number; max: number };
  /** Conservative level estimate */
  cLevel: number;
  /** Calculated tier based on expected level */
  tier: LevelTier;
  /** Recommended starting workload */
  recommendedWorkload?: {
    frequency?: string;
    duration?: number;
    unit?: string;
    perCount?: number;
  };
  /** Whether the Missingness Firewall was triggered */
  firewallTriggered?: boolean;
  /** ICI score */
  ici?: number;
}

export interface AssessmentResultModalProps {
  open: boolean;
  onClose: () => void;
  habitName: string;
  result: AssessmentResultData;
  onAccept?: () => void;
  onViewDetails?: () => void;
}

/**
 * Get level explanation based on tier
 */
function getLevelExplanation(tier: LevelTier, level: number): {
  title: string;
  description: string;
  example: string;
} {
  switch (tier) {
    case 'beginner':
      return {
        title: '初級レベル',
        description: 'この習慣は比較的取り組みやすい難易度です。日常に無理なく組み込めるでしょう。',
        example: level < 25 
          ? '例: 毎朝コップ1杯の水を飲む、1日1回深呼吸をする'
          : '例: 毎日10分の読書、週3回の軽いストレッチ',
      };
    case 'intermediate':
      return {
        title: '中級レベル',
        description: 'この習慣はある程度の努力と計画が必要です。継続には意識的な取り組みが求められます。',
        example: level < 75
          ? '例: 週3回30分のジョギング、毎日30分の語学学習'
          : '例: 週5回の筋トレ、毎日1時間の資格勉強',
      };
    case 'advanced':
      return {
        title: '上級レベル',
        description: 'この習慣は高い難易度です。強い意志と環境整備が必要になります。',
        example: level < 125
          ? '例: 毎日1時間のランニング、週5回の早朝瞑想'
          : '例: 毎日2時間の専門スキル練習、厳格な食事管理',
      };
    case 'expert':
      return {
        title: '達人レベル',
        description: 'この習慣は非常に高い難易度です。生活の大幅な調整と強いコミットメントが必要です。',
        example: '例: プロアスリートレベルのトレーニング、複数の高難度習慣の同時実行',
      };
  }
}

/**
 * Workload recommendation display
 */
function WorkloadRecommendation({ 
  workload, 
  tier 
}: { 
  workload?: AssessmentResultData['recommendedWorkload'];
  tier: LevelTier;
}) {
  if (!workload) {
    // Default recommendations based on tier
    const defaults: Record<LevelTier, { frequency: string; duration: string }> = {
      beginner: { frequency: '毎日', duration: '5-10分' },
      intermediate: { frequency: '週3-5回', duration: '20-30分' },
      advanced: { frequency: '週5-7回', duration: '45-60分' },
      expert: { frequency: '毎日', duration: '60分以上' },
    };
    
    return (
      <div className="bg-muted/50 rounded-lg p-4">
        <h4 className="text-sm font-medium mb-2">推奨ワークロード</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">頻度: </span>
            <span className="font-medium">{defaults[tier].frequency}</span>
          </div>
          <div>
            <span className="text-muted-foreground">時間: </span>
            <span className="font-medium">{defaults[tier].duration}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-muted/50 rounded-lg p-4">
      <h4 className="text-sm font-medium mb-2">推奨ワークロード</h4>
      <div className="grid grid-cols-2 gap-4 text-sm">
        {workload.frequency && (
          <div>
            <span className="text-muted-foreground">頻度: </span>
            <span className="font-medium">{workload.frequency}</span>
          </div>
        )}
        {workload.duration && (
          <div>
            <span className="text-muted-foreground">時間: </span>
            <span className="font-medium">{workload.duration}分</span>
          </div>
        )}
        {workload.perCount && workload.unit && (
          <div>
            <span className="text-muted-foreground">1回あたり: </span>
            <span className="font-medium">{workload.perCount} {workload.unit}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Modal.AssessmentResult component
 */
export default function AssessmentResultModal({
  open,
  onClose,
  habitName,
  result,
  onAccept,
  onViewDetails,
}: AssessmentResultModalProps) {
  if (!open) return null;

  const tierColors = getTierColors(result.tier);
  const explanation = getLevelExplanation(result.tier, result.eLevelRange.min);
  const expectedLevel = Math.round((result.eLevelRange.min + result.eLevelRange.max) / 2);

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-lg text-card-foreground">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">レベル評価結果</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xl p-2 min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Habit name */}
          <div className="text-center">
            <div className="text-sm text-muted-foreground mb-1">習慣</div>
            <div className="text-lg font-medium">{habitName}</div>
          </div>

          {/* Level display */}
          <div className={`${tierColors.bg} border ${tierColors.border} rounded-xl p-6 text-center`}>
            <div className="text-sm text-muted-foreground mb-2">推定レベル</div>
            <div className={`text-4xl font-bold ${tierColors.text} mb-2`}>
              Lv.{result.eLevelRange.min}-{result.eLevelRange.max}
            </div>
            <LevelBadge level={expectedLevel} tier={result.tier} size="lg" />
          </div>

          {/* O/E/C breakdown */}
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="bg-green-500/10 rounded-lg p-2">
              <div className="text-xs text-green-700 dark:text-green-400">楽観的</div>
              <div className="font-bold text-green-700 dark:text-green-400">{result.oLevel}</div>
            </div>
            <div className="bg-blue-500/10 rounded-lg p-2">
              <div className="text-xs text-blue-700 dark:text-blue-400">期待値</div>
              <div className="font-bold text-blue-700 dark:text-blue-400">
                {result.eLevelRange.min}-{result.eLevelRange.max}
              </div>
            </div>
            <div className="bg-orange-500/10 rounded-lg p-2">
              <div className="text-xs text-orange-700 dark:text-orange-400">保守的</div>
              <div className="font-bold text-orange-700 dark:text-orange-400">{result.cLevel}</div>
            </div>
          </div>

          {/* Firewall warning */}
          {result.firewallTriggered && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-sm">
              <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                <span>⚠️</span>
                <span>情報が不足しているため、暫定的な評価です。</span>
              </div>
              {result.ici !== undefined && (
                <div className="text-xs text-muted-foreground mt-1">
                  情報完全性指数 (ICI): {(result.ici * 100).toFixed(0)}%
                </div>
              )}
            </div>
          )}

          {/* Level explanation */}
          <div className="space-y-2">
            <h4 className={`font-medium ${tierColors.text}`}>{explanation.title}</h4>
            <p className="text-sm text-muted-foreground">{explanation.description}</p>
            <p className="text-xs text-muted-foreground italic">{explanation.example}</p>
          </div>

          {/* Workload recommendation */}
          <WorkloadRecommendation workload={result.recommendedWorkload} tier={result.tier} />
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between p-4 border-t border-border">
          {onViewDetails && (
            <button
              onClick={onViewDetails}
              className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
            >
              詳細を見る
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-muted hover:bg-muted/80 rounded-md transition-colors min-h-[44px]"
            >
              閉じる
            </button>
            {onAccept && (
              <button
                onClick={onAccept}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity min-h-[44px]"
              >
                この習慣を作成
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
