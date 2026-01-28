"use client";

/**
 * Widget.WorkloadLevelConsistency Component
 * 
 * Displays workload-level consistency indicator for a habit.
 * Shows warning when workload settings don't match the assessed level.
 * 
 * @module Widget.WorkloadLevelConsistency
 * 
 * Validates: Requirements 5.5, 5.6
 */

import React from 'react';

export interface WorkloadLevelConsistencyResult {
  habitId: string;
  isConsistent: boolean;
  assessedLevel: number | null;
  estimatedLevelFromWorkload: number;
  levelDifference: number;
  recommendation: 'consistent' | 'reassess_level' | 'adjust_workload';
}

export interface WorkloadLevelConsistencyProps {
  /** Consistency check result */
  result: WorkloadLevelConsistencyResult;
  /** Callback when user wants to reassess level */
  onReassessLevel?: () => void;
  /** Callback when user wants to adjust workload */
  onAdjustWorkload?: () => void;
  /** Compact mode for inline display */
  compact?: boolean;
}

/**
 * Get recommendation-specific styling and messaging
 */
function getRecommendationConfig(recommendation: WorkloadLevelConsistencyResult['recommendation']): {
  icon: string;
  title: string;
  description: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
} {
  switch (recommendation) {
    case 'reassess_level':
      return {
        icon: '📊',
        title: 'レベル再評価を推奨',
        description: 'Workload設定から推定されるレベルが、現在の評価レベルより高いです。レベルを再評価することをお勧めします。',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-500/30',
        textColor: 'text-blue-700 dark:text-blue-400',
      };
    case 'adjust_workload':
      return {
        icon: '⚙️',
        title: 'Workload調整を推奨',
        description: 'Workload設定から推定されるレベルが、現在の評価レベルより低いです。Workload設定を見直すことをお勧めします。',
        bgColor: 'bg-orange-500/10',
        borderColor: 'border-orange-500/30',
        textColor: 'text-orange-700 dark:text-orange-400',
      };
    case 'consistent':
    default:
      return {
        icon: '✓',
        title: '整合性OK',
        description: 'Workload設定と評価レベルは整合しています。',
        bgColor: 'bg-green-500/10',
        borderColor: 'border-green-500/30',
        textColor: 'text-green-700 dark:text-green-400',
      };
  }
}

/**
 * Compact indicator for inline display
 */
function CompactIndicator({
  result,
  onReassessLevel,
  onAdjustWorkload,
}: {
  result: WorkloadLevelConsistencyResult;
  onReassessLevel?: () => void;
  onAdjustWorkload?: () => void;
}) {
  const config = getRecommendationConfig(result.recommendation);

  if (result.isConsistent) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs ${config.textColor}`}>
        <span>{config.icon}</span>
        <span>整合性OK</span>
      </span>
    );
  }

  return (
    <button
      onClick={result.recommendation === 'reassess_level' ? onReassessLevel : onAdjustWorkload}
      className={`
        inline-flex items-center gap-1 px-2 py-1 rounded text-xs
        ${config.bgColor} ${config.borderColor} border ${config.textColor}
        hover:opacity-80 transition-opacity
      `}
      title={config.description}
    >
      <span>{config.icon}</span>
      <span>
        {result.recommendation === 'reassess_level' ? 'レベル再評価' : 'Workload調整'}
      </span>
    </button>
  );
}

/**
 * Full indicator with details
 */
function FullIndicator({
  result,
  onReassessLevel,
  onAdjustWorkload,
}: {
  result: WorkloadLevelConsistencyResult;
  onReassessLevel?: () => void;
  onAdjustWorkload?: () => void;
}) {
  const config = getRecommendationConfig(result.recommendation);

  return (
    <div className={`rounded-lg border p-3 ${config.bgColor} ${config.borderColor}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{config.icon}</span>
        <span className={`font-medium ${config.textColor}`}>{config.title}</span>
      </div>

      {/* Level comparison */}
      <div className="flex items-center gap-4 mb-2 text-sm">
        <div>
          <span className="text-muted-foreground">評価レベル: </span>
          <span className="font-medium">
            {result.assessedLevel !== null ? `Lv.${result.assessedLevel}` : '未評価'}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">推定レベル: </span>
          <span className="font-medium">Lv.{result.estimatedLevelFromWorkload}</span>
        </div>
        {!result.isConsistent && (
          <div className={config.textColor}>
            <span>差: </span>
            <span className="font-medium">{result.levelDifference}pt</span>
          </div>
        )}
      </div>

      {/* Description */}
      {!result.isConsistent && (
        <p className="text-xs text-muted-foreground mb-3">
          {config.description}
        </p>
      )}

      {/* Action buttons */}
      {!result.isConsistent && (
        <div className="flex gap-2">
          {result.recommendation === 'reassess_level' && onReassessLevel && (
            <button
              onClick={onReassessLevel}
              className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity min-h-[32px]"
            >
              レベルを再評価
            </button>
          )}
          {result.recommendation === 'adjust_workload' && onAdjustWorkload && (
            <button
              onClick={onAdjustWorkload}
              className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity min-h-[32px]"
            >
              Workloadを調整
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Widget.WorkloadLevelConsistency component
 */
export default function WorkloadLevelConsistency({
  result,
  onReassessLevel,
  onAdjustWorkload,
  compact = false,
}: WorkloadLevelConsistencyProps) {
  if (compact) {
    return (
      <CompactIndicator
        result={result}
        onReassessLevel={onReassessLevel}
        onAdjustWorkload={onAdjustWorkload}
      />
    );
  }

  return (
    <FullIndicator
      result={result}
      onReassessLevel={onReassessLevel}
      onAdjustWorkload={onAdjustWorkload}
    />
  );
}

/**
 * Hook to check workload-level consistency
 */
export function useWorkloadLevelConsistency() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<WorkloadLevelConsistencyResult | null>(null);

  const checkConsistency = React.useCallback(async (habitId: string) => {
    setIsLoading(true);
    try {
      const { supabase } = await import('../../../lib/supabaseClient');
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        // Guest mode - estimate locally
        const guestHabits = JSON.parse(localStorage.getItem('guest-habits') || '[]');
        const habit = guestHabits.find((h: any) => h.id === habitId);
        
        if (!habit) {
          return null;
        }

        // Simple local estimation
        const assessedLevel = habit.level ?? null;
        const estimatedLevel = estimateLevelFromWorkload(habit);
        const levelDifference = assessedLevel !== null ? Math.abs(assessedLevel - estimatedLevel) : 0;
        const isConsistent = assessedLevel === null || levelDifference <= 20;

        const localResult: WorkloadLevelConsistencyResult = {
          habitId,
          isConsistent,
          assessedLevel,
          estimatedLevelFromWorkload: estimatedLevel,
          levelDifference,
          recommendation: isConsistent ? 'consistent' : 
            (estimatedLevel > (assessedLevel ?? 0) ? 'reassess_level' : 'adjust_workload'),
        };

        setResult(localResult);
        return localResult;
      }

      // Authenticated - call backend API
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
      if (!backendUrl) {
        throw new Error('Backend API URL not configured');
      }

      const response = await fetch(
        `${backendUrl}/api/habits/${habitId}/workload-level-consistency`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
      return data;
    } catch (error) {
      console.error('[useWorkloadLevelConsistency] Error:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { checkConsistency, isLoading, result };
}

/**
 * Local estimation of level from workload (for guest mode)
 */
function estimateLevelFromWorkload(habit: any): number {
  let level = 0;

  // Frequency contribution
  const frequency = habit.frequency || habit.repeat || 'Daily';
  switch (frequency.toLowerCase()) {
    case 'daily':
      level += 30;
      break;
    case 'weekly':
      level += 15;
      break;
    case 'monthly':
      level += 5;
      break;
    default:
      level += 20;
  }

  // Workload per count contribution
  const workloadPerCount = habit.workloadPerCount ?? habit.workload_per_count ?? 1;
  if (workloadPerCount <= 5) level += 5;
  else if (workloadPerCount <= 15) level += 15;
  else if (workloadPerCount <= 30) level += 25;
  else if (workloadPerCount <= 60) level += 40;
  else level += 60;

  // Target count contribution
  const targetCount = habit.workloadTotal ?? habit.target_count ?? 1;
  if (targetCount <= 1) level += 5;
  else if (targetCount <= 3) level += 15;
  else if (targetCount <= 5) level += 25;
  else if (targetCount <= 10) level += 40;
  else level += 60;

  return Math.min(199, Math.max(0, level));
}
