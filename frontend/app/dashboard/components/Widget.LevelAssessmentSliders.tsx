'use client';

/**
 * Widget.LevelAssessmentSliders Component
 * 
 * THLI-24レベル推定のための各観点（変数）入力スライダーUI
 * 
 * 変数ドメイン:
 * - Frequency (F): 頻度 (0-10)
 * - Duration (D): 継続時間 (0-10)
 * - Intensity (I): 強度 (0-10)
 * - Complexity (C): 複雑さ (0-10)
 * - Consistency (Co): 一貫性 (0-10)
 * 
 * レベル計算: L = (F + D + I + C + Co) * 4 - 1 (0-199)
 */

import React, { useState, useCallback, useMemo } from 'react';

export interface LevelVariables {
  frequency: number;      // 頻度 (0-10)
  duration: number;       // 継続時間 (0-10)
  intensity: number;      // 強度 (0-10)
  complexity: number;     // 複雑さ (0-10)
  consistency: number;    // 一貫性 (0-10)
}

export interface LevelAssessmentSlidersProps {
  /** 習慣名 */
  habitName: string;
  /** 習慣ID */
  habitId: string;
  /** 初期値 */
  initialValues?: Partial<LevelVariables>;
  /** 送信時のコールバック */
  onSubmit: (habitId: string, variables: LevelVariables, calculatedLevel: number) => void;
  /** キャンセル時のコールバック */
  onCancel?: () => void;
  /** ローディング状態 */
  isLoading?: boolean;
}

const VARIABLE_CONFIG = [
  {
    key: 'frequency' as const,
    label: '頻度',
    labelEn: 'Frequency',
    description: 'どのくらいの頻度で行いますか？',
    lowLabel: '稀に',
    highLabel: '毎日',
    // 0-10の各値に対応する定性的評価
    qualitativeLabels: [
      'ほぼ行わない',    // 0
      '年に数回',        // 1
      '月に1回程度',     // 2
      '月に2-3回',       // 3
      '週に1回',         // 4
      '週に2回',         // 5
      '週に3-4回',       // 6
      '2日に1回',        // 7
      'ほぼ毎日',        // 8
      '毎日1回',         // 9
      '毎日複数回',      // 10
    ],
  },
  {
    key: 'duration' as const,
    label: '継続時間',
    labelEn: 'Duration',
    description: '1回あたりどのくらいの時間をかけますか？',
    lowLabel: '短い',
    highLabel: '長い',
    qualitativeLabels: [
      '1分未満',         // 0
      '1-5分',           // 1
      '5-10分',          // 2
      '10-15分',         // 3
      '15-30分',         // 4
      '30分-1時間',      // 5
      '1-2時間',         // 6
      '2-3時間',         // 7
      '3-4時間',         // 8
      '4時間以上',       // 9
      '半日以上',        // 10
    ],
  },
  {
    key: 'intensity' as const,
    label: '強度',
    labelEn: 'Intensity',
    description: 'どのくらいの集中力・努力が必要ですか？',
    lowLabel: '軽い',
    highLabel: '激しい',
    qualitativeLabels: [
      'ほぼ無意識',      // 0
      'とても軽い',      // 1
      '軽い',            // 2
      'やや軽い',        // 3
      '普通',            // 4
      'やや集中',        // 5
      '集中が必要',      // 6
      'かなり集中',      // 7
      '高い集中力',      // 8
      '非常に激しい',    // 9
      '限界レベル',      // 10
    ],
  },
  {
    key: 'complexity' as const,
    label: '複雑さ',
    labelEn: 'Complexity',
    description: 'どのくらい複雑な作業ですか？',
    lowLabel: '単純',
    highLabel: '複雑',
    qualitativeLabels: [
      '超シンプル',      // 0
      'とても単純',      // 1
      '単純',            // 2
      'やや単純',        // 3
      '普通',            // 4
      'やや複雑',        // 5
      '複雑',            // 6
      'かなり複雑',      // 7
      '非常に複雑',      // 8
      '高度な専門性',    // 9
      '極めて複雑',      // 10
    ],
  },
  {
    key: 'consistency' as const,
    label: '一貫性',
    labelEn: 'Consistency',
    description: 'どのくらい安定して続けられていますか？',
    lowLabel: 'ばらつき',
    highLabel: '安定',
    qualitativeLabels: [
      'まったく不安定',  // 0
      '非常にばらつき',  // 1
      'ばらつきあり',    // 2
      'やや不安定',      // 3
      '時々できる',      // 4
      '半分くらい',      // 5
      'まあまあ安定',    // 6
      '比較的安定',      // 7
      'かなり安定',      // 8
      'ほぼ完璧',        // 9
      '完全に習慣化',    // 10
    ],
  },
];

/**
 * レベルを計算する関数
 * L = (F + D + I + C + Co) * 4 - 1 (0-199)
 */
export function calculateLevel(variables: LevelVariables): number {
  const sum = variables.frequency + variables.duration + variables.intensity + 
              variables.complexity + variables.consistency;
  // 合計は0-50、これを0-199にマッピング
  const level = Math.round((sum / 50) * 199);
  return Math.max(0, Math.min(199, level));
}

/**
 * レベルからティアを計算
 */
export function calculateTier(level: number): 'beginner' | 'intermediate' | 'advanced' | 'expert' {
  if (level < 50) return 'beginner';
  if (level < 100) return 'intermediate';
  if (level < 150) return 'advanced';
  return 'expert';
}

/**
 * ティアの日本語ラベル
 */
const TIER_LABELS: Record<string, { label: string; color: string }> = {
  beginner: { label: '初級', color: 'text-green-600 bg-green-500/20' },
  intermediate: { label: '中級', color: 'text-blue-600 bg-blue-500/20' },
  advanced: { label: '上級', color: 'text-orange-600 bg-orange-500/20' },
  expert: { label: '達人', color: 'text-red-600 bg-red-500/20' },
};

export default function LevelAssessmentSliders({
  habitName,
  habitId,
  initialValues,
  onSubmit,
  onCancel,
  isLoading = false,
}: LevelAssessmentSlidersProps) {
  const [values, setValues] = useState<LevelVariables>({
    frequency: initialValues?.frequency ?? 5,
    duration: initialValues?.duration ?? 5,
    intensity: initialValues?.intensity ?? 5,
    complexity: initialValues?.complexity ?? 5,
    consistency: initialValues?.consistency ?? 5,
  });

  // Track which slider is being interacted with (for tooltip)
  const [activeSlider, setActiveSlider] = useState<keyof LevelVariables | null>(null);

  const calculatedLevel = useMemo(() => calculateLevel(values), [values]);
  const tier = useMemo(() => calculateTier(calculatedLevel), [calculatedLevel]);
  const tierInfo = TIER_LABELS[tier];

  const handleSliderChange = useCallback((key: keyof LevelVariables, value: number) => {
    setValues(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleSubmit = useCallback(() => {
    onSubmit(habitId, values, calculatedLevel);
  }, [habitId, values, calculatedLevel, onSubmit]);

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">{habitName}</h3>
          <p className="text-sm text-muted-foreground">各観点を評価してください</p>
        </div>
        <div className={`px-3 py-1.5 rounded-md font-medium ${tierInfo.color}`}>
          Lv. {calculatedLevel} ({tierInfo.label})
        </div>
      </div>

      {/* Sliders */}
      <div className="space-y-5">
        {VARIABLE_CONFIG.map(config => (
          <div key={config.key} className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">
                {config.label}
                <span className="text-xs text-muted-foreground ml-1">({config.labelEn})</span>
              </label>
              <span className="text-sm font-mono font-semibold text-primary">
                {values[config.key]}/10
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{config.description}</p>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-12">{config.lowLabel}</span>
              {/* Custom slider with fill */}
              <div className="flex-1 relative h-6 flex items-center">
                {/* Track background */}
                <div className="absolute inset-x-0 h-2 bg-muted rounded-full" />
                {/* Fill (colored portion) */}
                <div 
                  className="absolute left-0 h-2 bg-primary rounded-full transition-all duration-150"
                  style={{ width: `${(values[config.key] / 10) * 100}%` }}
                />
                {/* Tick marks */}
                <div className="absolute inset-x-0 h-2 flex justify-between px-0.5">
                  {[...Array(11)].map((_, i) => (
                    <div 
                      key={i} 
                      className={`w-0.5 h-full ${i <= values[config.key] ? 'bg-primary-foreground/30' : 'bg-muted-foreground/20'}`}
                    />
                  ))}
                </div>
                {/* Native input for interaction */}
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  value={values[config.key]}
                  onChange={(e) => handleSliderChange(config.key, parseInt(e.target.value))}
                  onMouseDown={() => setActiveSlider(config.key)}
                  onMouseUp={() => setActiveSlider(null)}
                  onMouseLeave={() => setActiveSlider(null)}
                  onTouchStart={() => setActiveSlider(config.key)}
                  onTouchEnd={() => setActiveSlider(null)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                {/* Custom thumb with tooltip */}
                <div 
                  className="absolute w-5 h-5 bg-primary rounded-full shadow-md border-2 border-background
                    transform -translate-x-1/2 transition-all duration-150
                    ring-2 ring-primary/30"
                  style={{ left: `${(values[config.key] / 10) * 100}%` }}
                >
                  {/* Inner dot */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-primary-foreground rounded-full" />
                  </div>
                  {/* Tooltip - shows when slider is active */}
                  {activeSlider === config.key && (
                    <div 
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 
                        bg-foreground text-background text-xs font-medium rounded shadow-lg
                        whitespace-nowrap z-20 animate-in fade-in zoom-in-95 duration-150"
                    >
                      {config.qualitativeLabels[values[config.key]]}
                      {/* Tooltip arrow */}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 
                        border-4 border-transparent border-t-foreground" />
                    </div>
                  )}
                </div>
              </div>
              <span className="text-xs text-muted-foreground w-12 text-right">{config.highLabel}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Level Preview Bar */}
      <div className="pt-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>Lv. 0</span>
          <span>Lv. 199</span>
        </div>
        <div className="w-full bg-muted rounded-full h-3 relative overflow-hidden">
          {/* Tier sections */}
          <div className="absolute inset-0 flex">
            <div className="w-1/4 bg-green-500/30" />
            <div className="w-1/4 bg-blue-500/30" />
            <div className="w-1/4 bg-orange-500/30" />
            <div className="w-1/4 bg-red-500/30" />
          </div>
          {/* Current level indicator */}
          <div 
            className="absolute top-0 bottom-0 w-1 bg-foreground transition-all duration-200"
            style={{ left: `${(calculatedLevel / 199) * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>初級</span>
          <span>中級</span>
          <span>上級</span>
          <span>達人</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-sm font-medium rounded-md
              border border-border bg-background hover:bg-muted
              transition-colors disabled:opacity-50"
          >
            キャンセル
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className="flex-1 px-4 py-2 text-sm font-medium rounded-md
            bg-primary text-primary-foreground hover:opacity-90
            transition-opacity disabled:opacity-50"
        >
          {isLoading ? '保存中...' : 'レベルを設定'}
        </button>
      </div>
    </div>
  );
}

/**
 * 複数の習慣のレベル設定用コンポーネント
 */
export interface MultiHabitLevelAssessmentProps {
  habits: Array<{
    id: string;
    name: string;
    level?: number | null;
  }>;
  onSubmitAll: (assessments: Array<{ habitId: string; variables: LevelVariables; level: number }>) => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function MultiHabitLevelAssessment({
  habits,
  onSubmitAll,
  onCancel,
  isLoading = false,
}: MultiHabitLevelAssessmentProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [assessments, setAssessments] = useState<Array<{ habitId: string; variables: LevelVariables; level: number }>>([]);

  const currentHabit = habits[currentIndex];
  const isLast = currentIndex === habits.length - 1;

  const handleSubmit = useCallback((habitId: string, variables: LevelVariables, level: number) => {
    const newAssessments = [...assessments, { habitId, variables, level }];
    setAssessments(newAssessments);

    if (isLast) {
      onSubmitAll(newAssessments);
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  }, [assessments, isLast, onSubmitAll]);

  const handleSkip = useCallback(() => {
    if (isLast) {
      onSubmitAll(assessments);
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  }, [assessments, isLast, onSubmitAll]);

  if (!currentHabit) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Progress indicator */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{currentIndex + 1} / {habits.length} 件</span>
        <button
          onClick={handleSkip}
          className="text-primary hover:underline"
        >
          スキップ
        </button>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-muted rounded-full h-1.5">
        <div 
          className="bg-primary h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / habits.length) * 100}%` }}
        />
      </div>

      {/* Current habit slider */}
      <LevelAssessmentSliders
        habitId={currentHabit.id}
        habitName={currentHabit.name}
        onSubmit={handleSubmit}
        onCancel={onCancel}
        isLoading={isLoading}
      />
    </div>
  );
}
