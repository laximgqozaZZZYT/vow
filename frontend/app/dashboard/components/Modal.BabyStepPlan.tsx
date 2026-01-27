"use client";

/**
 * Modal.BabyStepPlan Component
 * 
 * Displays Lv.50 and Lv.10 baby step plans side-by-side for a struggling habit.
 * Shows comparison table of variable changes and allows user to select and accept a plan.
 * 
 * @module Modal.BabyStepPlan
 * 
 * Validates: Requirements 6.5, 16.7
 */

import React, { useState } from 'react';
import LevelBadge, { calculateTier, getTierColors } from './LevelBadge';

// Variable reduction interface
export interface VariableReduction {
  variableId: string; // e.g., "⑱"
  variableName: string; // e.g., "Frequency"
  variableNameJa: string; // e.g., "頻度"
  currentValue: string;
  newValue: string;
  pointsReduced: number;
}

// Workload changes interface
export interface WorkloadChanges {
  workloadPerCount?: { old: number; new: number; changePercent: number };
  frequency?: { old: string; new: string };
  duration?: { old: number; new: number };
  targetCount?: { old: number; new: number };
}

// Baby step plan interface
export interface BabyStepPlan {
  targetLevel: number;
  name: string; // Simplified habit name
  changes: VariableReduction[];
  workloadChanges: WorkloadChanges;
  explanation: string;
  estimatedDifficulty: string; // e.g., "半分の負荷"
}

// Minimal habit for Lv.10
export interface MinimalHabit {
  cue: string;
  action: string;
  stopCondition: string;
  fallback: string;
  estimatedDuration: number; // minutes
}

export interface BabyStepPlanModalProps {
  open: boolean;
  onClose: () => void;
  habitName: string;
  currentLevel: number;
  lv50Plan: BabyStepPlan;
  lv10Plan: BabyStepPlan & { minimalHabit?: MinimalHabit };
  onAcceptPlan: (planType: 'lv50' | 'lv10') => void;
}

/**
 * Plan card component
 */
function PlanCard({
  plan,
  planType,
  isSelected,
  onSelect,
  minimalHabit,
}: {
  plan: BabyStepPlan;
  planType: 'lv50' | 'lv10';
  isSelected: boolean;
  onSelect: () => void;
  minimalHabit?: MinimalHabit;
}) {
  const tier = calculateTier(plan.targetLevel);
  const tierColors = getTierColors(tier);
  
  return (
    <button
      onClick={onSelect}
      className={`
        w-full text-left p-4 rounded-xl border-2 transition-all
        ${isSelected 
          ? `${tierColors.border} ${tierColors.bg} ring-2 ring-primary` 
          : 'border-border bg-card hover:border-primary/50'
        }
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs text-muted-foreground mb-1">
            {planType === 'lv50' ? '半分プラン' : '最小プラン'}
          </div>
          <div className="font-semibold">{plan.name}</div>
        </div>
        <LevelBadge level={plan.targetLevel} tier={tier} size="sm" />
      </div>

      {/* Estimated difficulty */}
      <div className={`text-sm ${tierColors.text} mb-3`}>
        {plan.estimatedDifficulty}
      </div>

      {/* Explanation */}
      <p className="text-sm text-muted-foreground mb-3">
        {plan.explanation}
      </p>

      {/* Variable changes */}
      {plan.changes.length > 0 && (
        <div className="space-y-1 mb-3">
          <div className="text-xs font-medium text-muted-foreground">変更内容:</div>
          {plan.changes.slice(0, 3).map((change, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">{change.variableId}</span>
              <span className="text-muted-foreground">{change.variableNameJa}:</span>
              <span className="line-through text-muted-foreground">{change.currentValue}</span>
              <span>→</span>
              <span className="font-medium text-green-600 dark:text-green-400">{change.newValue}</span>
              <span className="text-xs text-green-600 dark:text-green-400">
                (-{change.pointsReduced.toFixed(1)})
              </span>
            </div>
          ))}
          {plan.changes.length > 3 && (
            <div className="text-xs text-muted-foreground">
              他 {plan.changes.length - 3} 件の変更...
            </div>
          )}
        </div>
      )}

      {/* Minimal habit details for Lv.10 */}
      {planType === 'lv10' && minimalHabit && (
        <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-xs">
          <div className="font-medium">2分ルール習慣:</div>
          <div>
            <span className="text-muted-foreground">きっかけ: </span>
            <span>{minimalHabit.cue}</span>
          </div>
          <div>
            <span className="text-muted-foreground">行動: </span>
            <span>{minimalHabit.action}</span>
          </div>
          <div>
            <span className="text-muted-foreground">終了条件: </span>
            <span>{minimalHabit.stopCondition}</span>
          </div>
          <div>
            <span className="text-muted-foreground">代替案: </span>
            <span>{minimalHabit.fallback}</span>
          </div>
        </div>
      )}

      {/* Selection indicator */}
      <div className={`
        mt-3 pt-3 border-t border-border/50 text-center text-sm
        ${isSelected ? 'text-primary font-medium' : 'text-muted-foreground'}
      `}>
        {isSelected ? '✓ 選択中' : 'クリックして選択'}
      </div>
    </button>
  );
}

/**
 * Comparison table component
 */
function ComparisonTable({
  currentLevel,
  lv50Plan,
  lv10Plan,
}: {
  currentLevel: number;
  lv50Plan: BabyStepPlan;
  lv10Plan: BabyStepPlan;
}) {
  // Collect all unique variables from both plans
  const allVariables = new Map<string, {
    id: string;
    nameJa: string;
    current: string;
    lv50: string;
    lv10: string;
  }>();

  lv50Plan.changes.forEach(change => {
    allVariables.set(change.variableId, {
      id: change.variableId,
      nameJa: change.variableNameJa,
      current: change.currentValue,
      lv50: change.newValue,
      lv10: change.currentValue, // Will be updated if in lv10 plan
    });
  });

  lv10Plan.changes.forEach(change => {
    const existing = allVariables.get(change.variableId);
    if (existing) {
      existing.lv10 = change.newValue;
    } else {
      allVariables.set(change.variableId, {
        id: change.variableId,
        nameJa: change.variableNameJa,
        current: change.currentValue,
        lv50: change.currentValue, // Not changed in lv50
        lv10: change.newValue,
      });
    }
  });

  if (allVariables.size === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 px-2 text-muted-foreground font-medium">変数</th>
            <th className="text-center py-2 px-2 text-muted-foreground font-medium">現在</th>
            <th className="text-center py-2 px-2 text-blue-600 dark:text-blue-400 font-medium">Lv.50</th>
            <th className="text-center py-2 px-2 text-green-600 dark:text-green-400 font-medium">Lv.10</th>
          </tr>
        </thead>
        <tbody>
          {Array.from(allVariables.values()).map(row => (
            <tr key={row.id} className="border-b border-border/50">
              <td className="py-2 px-2">
                <span className="text-muted-foreground mr-1">{row.id}</span>
                {row.nameJa}
              </td>
              <td className="text-center py-2 px-2 text-muted-foreground">{row.current}</td>
              <td className="text-center py-2 px-2">
                {row.lv50 !== row.current ? (
                  <span className="text-blue-600 dark:text-blue-400 font-medium">{row.lv50}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="text-center py-2 px-2">
                {row.lv10 !== row.current ? (
                  <span className="text-green-600 dark:text-green-400 font-medium">{row.lv10}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-medium">
            <td className="py-2 px-2">目標レベル</td>
            <td className="text-center py-2 px-2">{currentLevel}</td>
            <td className="text-center py-2 px-2 text-blue-600 dark:text-blue-400">{lv50Plan.targetLevel}</td>
            <td className="text-center py-2 px-2 text-green-600 dark:text-green-400">{lv10Plan.targetLevel}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/**
 * Modal.BabyStepPlan component
 */
export default function BabyStepPlanModal({
  open,
  onClose,
  habitName,
  currentLevel,
  lv50Plan,
  lv10Plan,
  onAcceptPlan,
}: BabyStepPlanModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<'lv50' | 'lv10' | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  if (!open) return null;

  const handleAccept = () => {
    if (selectedPlan) {
      onAcceptPlan(selectedPlan);
    }
  };

  return (
    <div className="fixed inset-0 z-[10001] flex items-start justify-center pt-4 sm:pt-8 bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl rounded-xl border border-border bg-card shadow-lg text-card-foreground flex flex-col max-h-[95vh] sm:max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold">ベビーステップ提案</h2>
            <p className="text-sm text-muted-foreground mt-1">
              習慣を簡単にして、再スタートしましょう
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xl p-2 min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Current habit info */}
          <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
            <div>
              <div className="text-sm text-muted-foreground">現在の習慣</div>
              <div className="font-medium">{habitName}</div>
            </div>
            <LevelBadge level={currentLevel} size="md" />
          </div>

          {/* Struggling message */}
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 text-sm text-orange-700 dark:text-orange-400">
            <span className="mr-2">💪</span>
            この習慣の達成率が低下しています。より簡単なバージョンから始めてみませんか？
          </div>

          {/* Plan cards - side by side on desktop, stacked on mobile */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PlanCard
              plan={lv50Plan}
              planType="lv50"
              isSelected={selectedPlan === 'lv50'}
              onSelect={() => setSelectedPlan('lv50')}
            />
            <PlanCard
              plan={lv10Plan}
              planType="lv10"
              isSelected={selectedPlan === 'lv10'}
              onSelect={() => setSelectedPlan('lv10')}
              minimalHabit={lv10Plan.minimalHabit}
            />
          </div>

          {/* Comparison toggle */}
          <button
            onClick={() => setShowComparison(!showComparison)}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2 flex items-center justify-center gap-2"
          >
            <span>{showComparison ? '▼' : '▶'}</span>
            <span>詳細比較表を{showComparison ? '隠す' : '表示'}</span>
          </button>

          {/* Comparison table */}
          {showComparison && (
            <div className="bg-muted/30 rounded-lg p-4">
              <ComparisonTable
                currentLevel={currentLevel}
                lv50Plan={lv50Plan}
                lv10Plan={lv10Plan}
              />
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between p-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
          >
            後で決める
          </button>
          <button
            onClick={handleAccept}
            disabled={!selectedPlan}
            className={`
              px-6 py-2 text-sm rounded-md transition-all min-h-[44px]
              ${selectedPlan
                ? 'bg-primary text-primary-foreground hover:opacity-90'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
              }
            `}
          >
            {selectedPlan 
              ? `${selectedPlan === 'lv50' ? 'Lv.50' : 'Lv.10'}プランを適用`
              : 'プランを選択してください'
            }
          </button>
        </div>
      </div>
    </div>
  );
}
