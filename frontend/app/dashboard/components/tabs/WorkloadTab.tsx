'use client';

/**
 * WorkloadTab Component
 * 
 * 負荷タブ - Habitモーダルの3番目のタブ
 * 
 * Contains:
 * - Level assessment controls for existing habits (Requirement 4.1)
 * - Workload Unit input (Requirement 4.2)
 * - Load per Count input (Requirement 4.3)
 * - Load Total (Day) input (Requirement 4.4)
 * - Load Total (End) input (Requirement 4.5)
 * - Estimated days calculation (Requirement 4.6)
 * - Auto Load per Set based on Timings (Requirement 4.7)
 * 
 * All inputs have minimum height of 44px for touch targets (Requirement 6.2)
 * 
 * @module WorkloadTab
 */

import React from 'react';
import LevelAssessmentSliders, { type LevelVariables } from '../Widget.LevelAssessmentSliders';
import type { Timing, Habit } from './BasicTab';

// ============================================================================
// Types
// ============================================================================

export interface WorkloadTabProps {
  /** Whether this tab panel is currently active/visible */
  isActive: boolean;
  /** Current workload unit value */
  workloadUnit: string;
  /** Callback when workload unit changes */
  onWorkloadUnitChange: (value: string) => void;
  /** Current load per count value */
  workloadPerCount: string;
  /** Callback when load per count changes */
  onWorkloadPerCountChange: (value: string) => void;
  /** Current load total (day) value */
  workloadTotal: string;
  /** Callback when load total (day) changes */
  onWorkloadTotalChange: (value: string) => void;
  /** Current load total (end) value */
  workloadTotalEnd: string;
  /** Callback when load total (end) changes */
  onWorkloadTotalEndChange: (value: string) => void;
  /** Timings array for auto load calculation */
  timings: Timing[];
  /** Auto load per set values calculated from timings */
  autoLoadPerSet: (number | null)[];
  /** The habit being edited (null for new habits) */
  habit: Habit | null;
  /** Callback when level assessment is triggered */
  onLevelAssessment: (habitId: string, variables: LevelVariables, level: number) => void;
  /** ID prefix for ARIA associations */
  idPrefix?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate estimated days to reach Load Total (End) based on Load Total (Day)
 */
function calculateEstimatedDays(workloadTotal: string, workloadTotalEnd: string): number | null {
  const dayTotalNum = Number(workloadTotal);
  const endTotalNum = Number(workloadTotalEnd);
  
  const dayTotal = !isNaN(dayTotalNum) && dayTotalNum > 0 ? dayTotalNum : null;
  const endTotal = !isNaN(endTotalNum) && endTotalNum > 0 ? endTotalNum : null;
  
  if (endTotal === null || endTotal <= 0) return null;
  if (dayTotal === null || dayTotal <= 0) return null;
  
  return Math.ceil(endTotal / dayTotal);
}

// ============================================================================
// Component
// ============================================================================

/**
 * WorkloadTab Component
 * 
 * The third tab in the Habit Modal containing:
 * - Level assessment controls (for existing habits)
 * - Workload Unit input
 * - Load per Count input
 * - Load Total (Day) input
 * - Load Total (End) input
 * - Estimated days calculation
 * - Auto Load per Set display based on Timings
 */
export function WorkloadTab({
  isActive,
  workloadUnit,
  onWorkloadUnitChange,
  workloadPerCount,
  onWorkloadPerCountChange,
  workloadTotal,
  onWorkloadTotalChange,
  workloadTotalEnd,
  onWorkloadTotalEndChange,
  timings,
  autoLoadPerSet,
  habit,
  onLevelAssessment,
  idPrefix = 'habit-modal',
}: WorkloadTabProps) {
  const [showLevelAssessment, setShowLevelAssessment] = React.useState(false);
  const [levelAssessmentLoading, setLevelAssessmentLoading] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);

  // Focus management: focus the panel when it becomes active (Requirement 11.6)
  React.useEffect(() => {
    if (isActive && panelRef.current) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        panelRef.current?.focus({ preventScroll: true });
      });
    }
  }, [isActive]);

  // Calculate estimated days - Requirement 4.6
  const estimatedDays = React.useMemo(
    () => calculateEstimatedDays(workloadTotal, workloadTotalEnd),
    [workloadTotal, workloadTotalEnd]
  );

  // Handle level assessment submission
  const handleLevelAssessmentSubmit = React.useCallback(
    async (habitId: string, variables: LevelVariables, level: number) => {
      setLevelAssessmentLoading(true);
      try {
        await onLevelAssessment(habitId, variables, level);
        setShowLevelAssessment(false);
      } finally {
        setLevelAssessmentLoading(false);
      }
    },
    [onLevelAssessment]
  );

  const panelId = `${idPrefix}-tabpanel-workload`;
  const tabId = `${idPrefix}-tab-workload`;

  return (
    <div
      ref={panelRef}
      id={panelId}
      role="tabpanel"
      aria-labelledby={tabId}
      tabIndex={isActive ? 0 : -1}
      hidden={!isActive}
      className={`
        space-y-6 outline-none
        /* Smooth opacity transition for tab content switching (Requirement 12.4) */
        transition-opacity duration-200 ease-out
        /* Respect prefers-reduced-motion (Requirement 12.4) */
        motion-reduce:transition-none
        ${isActive ? 'opacity-100' : 'opacity-0 hidden'}
      `}
    >
      {/* Level Assessment Section - Requirement 4.1 (only for existing habits) */}
      {habit && (
        <div>
          <h3 className="text-base sm:text-lg font-medium mb-2 text-foreground">Level</h3>
          {showLevelAssessment ? (
            <LevelAssessmentSliders
              habitId={habit.id}
              habitName={habit.name}
              initialValues={habit.levelAssessmentRaw?.variables}
              onSubmit={handleLevelAssessmentSubmit}
              onCancel={() => setShowLevelAssessment(false)}
              isLoading={levelAssessmentLoading}
            />
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted border border-border min-h-[44px]">
              <span className="text-sm font-medium text-foreground">
                {habit.level !== null && habit.level !== undefined
                  ? `Lv. ${habit.level}`
                  : 'Lv. ???'}
              </span>
              {habit.levelTier && (
                <span className="text-xs text-muted-foreground">
                  ({habit.levelTier === 'beginner'
                    ? '初級'
                    : habit.levelTier === 'intermediate'
                    ? '中級'
                    : habit.levelTier === 'advanced'
                    ? '上級'
                    : habit.levelTier === 'expert'
                    ? '達人'
                    : ''})
                </span>
              )}
              <button
                onClick={() => setShowLevelAssessment(true)}
                className="ml-auto text-xs text-primary hover:underline min-h-[44px] px-2 flex items-center"
              >
                手動で設定
              </button>
            </div>
          )}
        </div>
      )}

      {/* Workload Section Header */}
      <div>
        <h3 className="text-base sm:text-lg font-medium text-foreground">Workload</h3>
        <p className="text-sm text-muted-foreground mt-1">
          習慣の負荷量を設定します。日々の目標と最終目標を設定することで、進捗を追跡できます。
        </p>
      </div>

      {/* Estimated Days Display - Requirement 4.6 */}
      {estimatedDays !== null && (
        <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
          <div className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="text-sm text-foreground">
              Load Total(End)に到達するまでの推定日数:{' '}
              <span className="font-semibold text-primary">{estimatedDays}日</span>
            </span>
          </div>
        </div>
      )}

      {/* Workload Inputs Grid - Requirements 4.2, 4.3, 4.4, 9.2, 9.4 */}
      {/* Mobile: single-column layout (Requirement 9.2) */}
      {/* Desktop: multi-column layout (Requirement 9.4) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Workload Unit - Requirement 4.2 */}
        <div>
          <label htmlFor="workload-unit" className="block text-sm text-muted-foreground mb-2">
            Unit
          </label>
          <input
            id="workload-unit"
            type="text"
            value={workloadUnit}
            onChange={(e) => onWorkloadUnitChange(e.target.value)}
            placeholder="e.g. hrs, pages"
            className="
              flex w-full rounded-md border border-input bg-background 
              px-3 py-2 text-sm 
              placeholder:text-muted-foreground 
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary 
              disabled:cursor-not-allowed disabled:opacity-50
              min-h-[44px]
            "
          />
        </div>

        {/* Load per Count - Requirement 4.3 */}
        <div>
          <label htmlFor="workload-per-count" className="block text-sm text-muted-foreground mb-2">
            Load per Count
          </label>
          <input
            id="workload-per-count"
            type="number"
            min={1}
            value={workloadPerCount}
            onChange={(e) => onWorkloadPerCountChange(e.target.value)}
            className="
              flex w-full rounded-md border border-input bg-background 
              px-3 py-2 text-sm 
              placeholder:text-muted-foreground 
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary 
              disabled:cursor-not-allowed disabled:opacity-50
              min-h-[44px]
              [appearance:textfield] 
              [&::-webkit-outer-spin-button]:appearance-none 
              [&::-webkit-inner-spin-button]:appearance-none
            "
          />
        </div>

        {/* Load Total (Day) - Requirement 4.4 */}
        <div>
          <label htmlFor="workload-total-day" className="block text-sm text-muted-foreground mb-2">
            Load Total(Day)
          </label>
          <input
            id="workload-total-day"
            type="number"
            min={0}
            value={workloadTotal}
            onChange={(e) => onWorkloadTotalChange(e.target.value)}
            className="
              flex w-full rounded-md border border-input bg-background 
              px-3 py-2 text-sm 
              placeholder:text-muted-foreground 
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary 
              disabled:cursor-not-allowed disabled:opacity-50
              min-h-[44px]
              [appearance:textfield] 
              [&::-webkit-outer-spin-button]:appearance-none 
              [&::-webkit-inner-spin-button]:appearance-none
            "
          />
        </div>
      </div>

      {/* Load Total (End) Section - Requirement 4.5, 9.2, 9.4 */}
      {/* Mobile: single-column layout (Requirement 9.2) */}
      {/* Desktop: multi-column layout (Requirement 9.4) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        <div>
          <label htmlFor="workload-total-end" className="block text-sm text-muted-foreground mb-2">
            Load Total(End) (optional)
          </label>
          <input
            id="workload-total-end"
            type="number"
            min={0}
            value={workloadTotalEnd}
            onChange={(e) => onWorkloadTotalEndChange(e.target.value)}
            className="
              flex w-full rounded-md border border-input bg-background 
              px-3 py-2 text-sm 
              placeholder:text-muted-foreground 
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary 
              disabled:cursor-not-allowed disabled:opacity-50
              min-h-[44px]
              [appearance:textfield] 
              [&::-webkit-outer-spin-button]:appearance-none 
              [&::-webkit-inner-spin-button]:appearance-none
            "
          />
        </div>
        <div className="md:col-span-2 text-sm text-muted-foreground md:pt-8">
          Load Total(Day)に基づいて、Load Total(End)に到達するまでの日数を推定します。
        </div>
      </div>

      {/* Auto Load per Set Section - Requirement 4.7 */}
      {timings.length > 0 && (
        <div>
          <h4 className="text-base font-medium text-foreground mb-3">
            Auto Load per Set
          </h4>
          <p className="text-sm text-muted-foreground mb-4">
            Timingsの設定に基づいて、各セットあたりの負荷量を自動計算します。
          </p>
          <div className="space-y-2">
            {timings.map((timing, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between px-4 py-3 rounded-lg bg-muted border border-border min-h-[44px]"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground">
                    Set {idx + 1}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({timing.type === 'Date' ? 'A Day' : timing.type}
                    {timing.start && ` ${timing.start}`}
                    {timing.end && ` - ${timing.end}`})
                  </span>
                </div>
                <div className="text-sm font-medium text-foreground">
                  {autoLoadPerSet[idx] === null || autoLoadPerSet[idx] === undefined ? (
                    <span className="text-muted-foreground">-</span>
                  ) : (
                    <span>
                      {autoLoadPerSet[idx]!.toFixed(2)} {workloadUnit || ''}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {autoLoadPerSet.every(v => v === null) && (
            <p className="text-xs text-muted-foreground mt-2">
              Load Total(Day)を設定すると、各セットの負荷量が自動計算されます。
            </p>
          )}
        </div>
      )}

      {/* Help Text */}
      <div className="p-4 rounded-lg bg-muted/50 border border-border">
        <h4 className="text-sm font-medium text-foreground mb-2">
          Workload設定の説明
        </h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li><strong>Unit:</strong> 負荷の単位（例: 時間、ページ、回数）</li>
          <li><strong>Load per Count:</strong> 1カウントあたりの負荷量</li>
          <li><strong>Load Total(Day):</strong> 1日あたりの目標負荷量</li>
          <li><strong>Load Total(End):</strong> 最終的な目標負荷量（オプション）</li>
        </ul>
      </div>
    </div>
  );
}

export default WorkloadTab;
