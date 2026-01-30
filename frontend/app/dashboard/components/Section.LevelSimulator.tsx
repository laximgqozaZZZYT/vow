'use client';

/**
 * Section.LevelSimulator Component
 * 
 * レベル進行シミュレーター
 * 
 * Features:
 * - シミュレーションパラメータ入力
 * - 進行予測チャート
 * - プリセットシナリオ
 * 
 * @module Section.LevelSimulator
 * 
 * Validates: Requirements 7.3, 7.4, 7.5 (level-system-rebalancing)
 */

import React, { useState, useCallback } from 'react';
import { calculateTier, getTierColors } from './LevelBadge';

export interface SimulationParams {
  currentXP: number;
  dailyHabits: number;
  averageHabitLevel: number;
  streakDays: number;
  completionRate: number;
}

export interface SimulationResult {
  currentLevel: number;
  projections: {
    oneWeek: number;
    oneMonth: number;
    threeMonths: number;
    sixMonths: number;
    oneYear: number;
    twoYears: number;
  };
  tierMilestones: {
    intermediate: { xpRequired: number; estimatedDays: number };
    advanced: { xpRequired: number; estimatedDays: number };
    expert: { xpRequired: number; estimatedDays: number };
  };
}

export interface LevelSimulatorProps {
  /** 初期パラメータ */
  initialParams?: Partial<SimulationParams>;
  /** シミュレーション実行ハンドラ */
  onSimulate?: (params: SimulationParams) => Promise<SimulationResult>;
  /** 追加のCSSクラス */
  className?: string;
}

/**
 * プリセットシナリオ
 */
const PRESETS = [
  {
    name: 'カジュアル',
    description: '週3-4日、軽めの習慣',
    params: { dailyHabits: 2, averageHabitLevel: 25, streakDays: 0, completionRate: 80 },
  },
  {
    name: 'スタンダード',
    description: '毎日、中程度の習慣',
    params: { dailyHabits: 3, averageHabitLevel: 50, streakDays: 7, completionRate: 100 },
  },
  {
    name: 'ハードコア',
    description: '毎日、高難度の習慣',
    params: { dailyHabits: 5, averageHabitLevel: 100, streakDays: 30, completionRate: 100 },
  },
];

/**
 * ローカルでシミュレーションを実行
 */
function simulateLocally(params: SimulationParams): SimulationResult {
  const { currentXP, dailyHabits, averageHabitLevel, streakDays, completionRate } = params;

  // 1日あたりのXPを計算
  const baseXP = Math.floor(averageHabitLevel * 2);
  const streakBonus = Math.min(streakDays, 30);
  const multiplier = completionRate >= 100 ? 1.0 : completionRate >= 80 ? 0.8 : completionRate >= 50 ? 0.5 : 0.2;
  const dailyXP = Math.floor((baseXP + streakBonus) * multiplier * dailyHabits);

  // レベル計算関数
  const calculateLevel = (xp: number): number => {
    if (xp <= 0) return 0;
    return Math.min(9999, Math.floor(5 * Math.log2(xp / 1000 + 1)));
  };

  // XPからレベルを計算（逆算）
  const calculateXPForLevel = (level: number): number => {
    if (level <= 0) return 0;
    return Math.floor(1000 * (Math.pow(2, level / 5) - 1));
  };

  const currentLevel = calculateLevel(currentXP);

  // 予測を計算
  const projections = {
    oneWeek: calculateLevel(currentXP + dailyXP * 7),
    oneMonth: calculateLevel(currentXP + dailyXP * 30),
    threeMonths: calculateLevel(currentXP + dailyXP * 90),
    sixMonths: calculateLevel(currentXP + dailyXP * 180),
    oneYear: calculateLevel(currentXP + dailyXP * 365),
    twoYears: calculateLevel(currentXP + dailyXP * 730),
  };

  // マイルストーンを計算
  const calculateMilestone = (targetLevel: number) => {
    const xpRequired = calculateXPForLevel(targetLevel);
    const remainingXP = Math.max(0, xpRequired - currentXP);
    const estimatedDays = dailyXP > 0 ? Math.ceil(remainingXP / dailyXP) : Infinity;
    return { xpRequired, estimatedDays };
  };

  return {
    currentLevel,
    projections,
    tierMilestones: {
      intermediate: calculateMilestone(50),
      advanced: calculateMilestone(100),
      expert: calculateMilestone(500),
    },
  };
}

/**
 * Section.LevelSimulator コンポーネント
 */
export default function SectionLevelSimulator({
  initialParams,
  onSimulate,
  className = '',
}: LevelSimulatorProps) {
  const [params, setParams] = useState<SimulationParams>({
    currentXP: initialParams?.currentXP ?? 0,
    dailyHabits: initialParams?.dailyHabits ?? 3,
    averageHabitLevel: initialParams?.averageHabitLevel ?? 25,
    streakDays: initialParams?.streakDays ?? 0,
    completionRate: initialParams?.completionRate ?? 100,
  });

  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSimulate = useCallback(async () => {
    setIsLoading(true);
    try {
      if (onSimulate) {
        const res = await onSimulate(params);
        setResult(res);
      } else {
        // ローカルシミュレーション
        const res = simulateLocally(params);
        setResult(res);
      }
    } finally {
      setIsLoading(false);
    }
  }, [params, onSimulate]);

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setParams(prev => ({ ...prev, ...preset.params }));
  };

  return (
    <div className={`p-4 bg-card border border-border rounded-lg ${className}`}>
      <h3 className="text-lg font-semibold mb-4">レベル進行シミュレーター</h3>

      {/* プリセット */}
      <div className="mb-4">
        <div className="text-sm text-muted-foreground mb-2">プリセット</div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => applyPreset(preset)}
              className="px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 rounded-md transition-colors"
              title={preset.description}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* パラメータ入力 */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm text-muted-foreground mb-1">現在のXP</label>
          <input
            type="number"
            value={params.currentXP}
            onChange={(e) => setParams(p => ({ ...p, currentXP: parseInt(e.target.value) || 0 }))}
            className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm"
            min={0}
          />
        </div>
        <div>
          <label className="block text-sm text-muted-foreground mb-1">1日の習慣数</label>
          <input
            type="number"
            value={params.dailyHabits}
            onChange={(e) => setParams(p => ({ ...p, dailyHabits: parseInt(e.target.value) || 1 }))}
            className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm"
            min={1}
            max={20}
          />
        </div>
        <div>
          <label className="block text-sm text-muted-foreground mb-1">平均習慣レベル</label>
          <input
            type="number"
            value={params.averageHabitLevel}
            onChange={(e) => setParams(p => ({ ...p, averageHabitLevel: parseInt(e.target.value) || 25 }))}
            className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm"
            min={1}
            max={199}
          />
        </div>
        <div>
          <label className="block text-sm text-muted-foreground mb-1">ストリーク日数</label>
          <input
            type="number"
            value={params.streakDays}
            onChange={(e) => setParams(p => ({ ...p, streakDays: parseInt(e.target.value) || 0 }))}
            className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm"
            min={0}
            max={365}
          />
        </div>
        <div className="col-span-2">
          <label className="block text-sm text-muted-foreground mb-1">達成率: {params.completionRate}%</label>
          <input
            type="range"
            value={params.completionRate}
            onChange={(e) => setParams(p => ({ ...p, completionRate: parseInt(e.target.value) }))}
            className="w-full"
            min={0}
            max={150}
          />
        </div>
      </div>

      {/* シミュレーション実行ボタン */}
      <button
        onClick={handleSimulate}
        disabled={isLoading}
        className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 mb-4"
      >
        {isLoading ? 'シミュレーション中...' : 'シミュレーション実行'}
      </button>

      {/* 結果表示 */}
      {result && (
        <div className="space-y-4">
          {/* 現在のレベル */}
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground">現在のレベル</div>
            <div className="text-2xl font-bold">Lv. {result.currentLevel.toLocaleString()}</div>
          </div>

          {/* 予測 */}
          <div>
            <div className="text-sm text-muted-foreground mb-2">レベル予測</div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: '1週間後', value: result.projections.oneWeek },
                { label: '1ヶ月後', value: result.projections.oneMonth },
                { label: '3ヶ月後', value: result.projections.threeMonths },
                { label: '6ヶ月後', value: result.projections.sixMonths },
                { label: '1年後', value: result.projections.oneYear },
                { label: '2年後', value: result.projections.twoYears },
              ].map(({ label, value }) => {
                const tier = calculateTier(value);
                const colors = getTierColors(tier);
                return (
                  <div key={label} className={`p-2 rounded ${colors.bg} ${colors.text}`}>
                    <div className="text-xs opacity-80">{label}</div>
                    <div className="font-semibold">Lv. {value.toLocaleString()}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* マイルストーン */}
          <div>
            <div className="text-sm text-muted-foreground mb-2">ティア到達予測</div>
            <div className="space-y-2">
              {[
                { tier: 'intermediate', label: '中級 (Lv.50)', data: result.tierMilestones.intermediate },
                { tier: 'advanced', label: '上級 (Lv.100)', data: result.tierMilestones.advanced },
                { tier: 'expert', label: '達人 (Lv.500)', data: result.tierMilestones.expert },
              ].map(({ tier, label, data }) => {
                const colors = getTierColors(tier as 'intermediate' | 'advanced' | 'expert');
                const isReached = result.currentLevel >= (tier === 'intermediate' ? 50 : tier === 'advanced' ? 100 : 500);
                return (
                  <div key={tier} className={`flex items-center justify-between p-2 rounded ${isReached ? colors.bg : 'bg-muted'}`}>
                    <span className={isReached ? colors.text : 'text-muted-foreground'}>{label}</span>
                    <span className={`text-sm ${isReached ? colors.text : 'text-muted-foreground'}`}>
                      {isReached ? '達成済み ✓' : data.estimatedDays === Infinity ? '—' : `約${data.estimatedDays}日`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
