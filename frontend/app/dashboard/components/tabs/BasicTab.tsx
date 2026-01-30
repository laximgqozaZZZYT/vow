'use client';

/**
 * BasicTab Component
 * 
 * 基本タブ - Habitモーダルの最初のタブ
 * 
 * Contains:
 * - Name input field (Requirement 2.1)
 * - Type selection (Good/Bad) (Requirement 2.2)
 * - Timings section with repeat settings (Requirement 2.3)
 * - Description textarea (Requirement 2.4)
 * - Level indicator for existing habits (Requirement 2.5)
 * 
 * All inputs have minimum height of 44px for touch targets (Requirement 6.2)
 * 
 * @module BasicTab
 */

import React from 'react';
import { Popover } from '@headlessui/react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import LevelAssessmentSliders, { type LevelVariables } from '../Widget.LevelAssessmentSliders';

// ============================================================================
// Types
// ============================================================================

export type TimingType = 'Date' | 'Daily' | 'Weekly' | 'Monthly';

export interface Timing {
  id?: string;
  type: TimingType;
  date?: string;
  start?: string;
  end?: string;
  cron?: string;
}

export interface Habit {
  id: string;
  goalId: string;
  name: string;
  active: boolean;
  type: 'do' | 'avoid';
  count: number;
  must?: number;
  duration?: number;
  reminders?: ({ kind: 'absolute'; time: string; weekdays: string[] } | { kind: 'relative'; minutesBefore: number })[];
  dueDate?: string;
  time?: string;
  endTime?: string;
  repeat?: string;
  allDay?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  workloadUnit?: string;
  workloadTotal?: number;
  workloadTotalEnd?: number;
  workloadPerCount?: number;
  level?: number | null;
  levelTier?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  levelAssessmentRaw?: {
    assessmentType: string;
    variables: LevelVariables;
    level: number;
    assessedAt: string;
  };
}

export interface HabitFormState {
  name: string;
  type: 'do' | 'avoid';
  timings: Timing[];
  notes: string;
  outdates: Timing[];
  workloadUnit: string;
  workloadTotal: string;
  workloadTotalEnd: string;
  workloadPerCount: string;
  goalId: string | undefined;
  selectedTagIds: string[];
}

export interface BasicTabProps {
  /** Whether this tab panel is currently active/visible */
  isActive: boolean;
  /** Current form state */
  formState: HabitFormState;
  /** Callback to update a form field */
  onFieldChange: (field: string, value: any) => void;
  /** The habit being edited (null for new habits) */
  habit: Habit | null;
  /** Callback when level assessment is triggered */
  onLevelAssessment: (habitId: string, variables: LevelVariables, level: number) => void;
  /** Auto load per set values calculated from timings */
  autoLoadPerSetByTiming?: (number | null)[];
  /** Workload unit for display */
  workloadUnit?: string;
  /** ID prefix for ARIA associations */
  idPrefix?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format a Date to local YYYY-MM-DD (avoid toISOString which uses UTC)
 */
function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Parse a YYYY-MM-DD string into a local Date (midnight local)
 */
function parseYMD(s?: string | Date | null): Date | undefined {
  if (!s) return undefined;
  if (s instanceof Date) return s;
  const parts = (s || '').split('-').map(x => Number(x));
  if (parts.length >= 3 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1]) && !Number.isNaN(parts[2])) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  const d = new Date(s as string);
  return isNaN(d.getTime()) ? undefined : d;
}

/**
 * Build a list of time options (15-minute increments)
 */
function buildTimeOptions(): { label: string; value: string }[] {
  const opts: { label: string; value: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const d = new Date();
      d.setHours(h, m, 0, 0);
      const label = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const value = d.toTimeString().slice(0, 5);
      opts.push({ label, value });
    }
  }
  return opts;
}

// ============================================================================
// Component
// ============================================================================

/**
 * BasicTab Component
 * 
 * The first tab in the Habit Modal containing:
 * - Name input
 * - Type selection (Good/Bad)
 * - Timings section
 * - Description textarea
 * - Level indicator (for existing habits)
 */
export function BasicTab({
  isActive,
  formState,
  onFieldChange,
  habit,
  onLevelAssessment,
  autoLoadPerSetByTiming = [],
  workloadUnit = '',
  idPrefix = 'habit-modal',
}: BasicTabProps) {
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

  // Update timings array
  const updateTiming = React.useCallback(
    (index: number, updates: Partial<Timing>) => {
      const newTimings = formState.timings.map((t, i) =>
        i === index ? { ...t, ...updates } : t
      );
      onFieldChange('timings', newTimings);
    },
    [formState.timings, onFieldChange]
  );

  // Add a new timing row
  const addTiming = React.useCallback(() => {
    const firstTiming = formState.timings[0];
    const newTiming: Timing = {
      type: firstTiming?.type ?? 'Daily',
      date: firstTiming?.date ?? undefined,
      start: firstTiming?.start ?? undefined,
      end: firstTiming?.end ?? undefined,
    };
    onFieldChange('timings', [...formState.timings, newTiming]);
  }, [formState.timings, onFieldChange]);

  // Remove a timing row
  const removeTiming = React.useCallback(
    (index: number) => {
      const newTimings = formState.timings.filter((_, i) => i !== index);
      onFieldChange('timings', newTimings);
    },
    [formState.timings, onFieldChange]
  );

  const panelId = `${idPrefix}-tabpanel-basic`;
  const tabId = `${idPrefix}-tab-basic`;

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
      {/* Name Input - Requirement 2.1 */}
      <div>
        <label htmlFor="habit-name" className="block text-base sm:text-lg font-medium mb-2 text-foreground">
          名前
        </label>
        <input
          id="habit-name"
          type="text"
          value={formState.name}
          onChange={(e) => onFieldChange('name', e.target.value)}
          placeholder="習慣の名前を入力"
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

      {/* Level Indicator - Requirement 2.5 (only for existing habits) */}
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

      {/* Type Selection - Requirement 2.2 */}
      <div>
        <h3 className="text-base sm:text-lg font-medium mb-2 text-foreground">Type</h3>
        <div className="flex flex-col gap-4">
          <div className="flex gap-6">
            <label className="inline-flex items-center gap-3 cursor-pointer min-h-[44px]">
              <input
                type="radio"
                name="habit-type"
                value="do"
                checked={formState.type === 'do'}
                onChange={() => onFieldChange('type', 'do')}
                className="form-radio w-5 h-5 text-primary focus:ring-primary"
              />
              <span className="text-base text-foreground">Good</span>
            </label>

            <label className="inline-flex items-center gap-3 cursor-pointer min-h-[44px]">
              <input
                type="radio"
                name="habit-type"
                value="avoid"
                checked={formState.type === 'avoid'}
                onChange={() => onFieldChange('type', 'avoid')}
                className="form-radio w-5 h-5 text-primary focus:ring-primary"
              />
              <span className="text-base text-foreground">Bad</span>
            </label>
          </div>
          <p className="text-sm text-muted-foreground">
            Good = カレンダーに表示。Bad = 追跡するがカレンダーには非表示。
          </p>
        </div>
      </div>

      {/* Timings Section - Requirement 2.3 */}
      <div>
        <h3 className="text-base sm:text-lg font-medium mb-2 text-foreground">Timings</h3>
        <div className="space-y-4">
          {formState.timings.map((timing, idx) => (
            <div
              key={idx}
              className="
                /* Mobile: full-width single-column layout (Requirement 9.2) */
                flex flex-col gap-3 
                /* Desktop: multi-column layout (Requirement 9.4) */
                md:flex-row md:items-end md:flex-wrap
                rounded px-3 py-3 border-b border-border
              "
            >
              {/* Timing Type */}
              <div className="w-full md:w-32">
                <div className="text-sm text-muted-foreground mb-2">Timing</div>
                <div className="rounded border border-input bg-background">
                  <Popover className="relative">
                    <Popover.Button className="w-full text-left px-3 py-3 text-base min-h-[44px] text-foreground">
                      {timing.type === 'Date' ? 'A Day' : timing.type}
                    </Popover.Button>
                    <Popover.Panel className="absolute z-[10002] mt-2 left-0 w-36">
                      <div className="rounded bg-card p-2 shadow-lg border border-border">
                        {(['Date', 'Daily', 'Weekly', 'Monthly'] as TimingType[]).map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => updateTiming(idx, { type })}
                            className={`
                              w-full text-left px-3 py-2 rounded
                              hover:bg-muted transition-colors
                              min-h-[44px]
                              ${timing.type === type ? 'bg-primary text-primary-foreground' : 'text-foreground'}
                            `}
                          >
                            {type === 'Date' ? 'A Day' : type}
                          </button>
                        ))}
                      </div>
                    </Popover.Panel>
                  </Popover>
                </div>
              </div>

              {/* Date Picker */}
              <div className="w-full md:w-32">
                <div className="text-sm text-muted-foreground mb-2">Date</div>
                <div className="rounded border border-input bg-background">
                  <Popover className="relative">
                    <Popover.Button className="w-full text-left px-3 py-3 text-base min-h-[44px] text-foreground">
                      {timing.date
                        ? parseYMD(timing.date)?.toLocaleDateString() ?? 'Select date'
                        : 'Select date'}
                    </Popover.Button>
                    <Popover.Panel className="absolute z-[10002] mt-2 left-0 w-[min(380px,90vw)]">
                      <div className="rounded bg-card p-4 shadow-lg border border-border">
                        <DayPicker
                          mode="single"
                          selected={timing.date ? parseYMD(timing.date) : undefined}
                          onSelect={(d) =>
                            updateTiming(idx, { date: d ? formatLocalDate(d) : undefined })
                          }
                        />
                      </div>
                    </Popover.Panel>
                  </Popover>
                </div>
              </div>

              {/* Start and End Time - side by side on mobile for better UX */}
              <div className="flex gap-3 w-full md:w-auto">
                {/* Start Time */}
                <div className="flex-1 md:w-32 md:flex-none">
                  <div className="text-sm text-muted-foreground mb-2">Start</div>
                  <div className="rounded border border-input bg-background">
                    <Popover className="relative">
                      <Popover.Button className="w-full text-left px-3 py-3 text-base min-h-[44px] text-foreground">
                        {timing.start ?? '--:--'}
                      </Popover.Button>
                      <Popover.Panel className="absolute z-[10002] mt-2 left-0 w-40">
                        <div className="rounded bg-card p-3 shadow-lg border border-border max-h-56 overflow-auto">
                          {buildTimeOptions().map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => updateTiming(idx, { start: opt.value })}
                              className={`
                                w-full text-left px-3 py-2 rounded
                                hover:bg-muted transition-colors
                                min-h-[44px]
                                ${timing.start === opt.value ? 'bg-primary text-primary-foreground' : 'text-foreground'}
                              `}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </Popover.Panel>
                    </Popover>
                  </div>
                </div>

                {/* End Time */}
                <div className="flex-1 md:w-32 md:flex-none">
                  <div className="text-sm text-muted-foreground mb-2">End</div>
                  <div className="rounded border border-input bg-background">
                    <Popover className="relative">
                      <Popover.Button className="w-full text-left px-3 py-3 text-base min-h-[44px] text-foreground">
                        {timing.end ?? '--:--'}
                      </Popover.Button>
                      <Popover.Panel className="absolute z-[10002] mt-2 left-0 w-40">
                        <div className="rounded bg-card p-3 shadow-lg border border-border max-h-56 overflow-auto">
                          {buildTimeOptions().map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => updateTiming(idx, { end: opt.value })}
                              className={`
                                w-full text-left px-3 py-2 rounded
                                hover:bg-muted transition-colors
                                min-h-[44px]
                                ${timing.end === opt.value ? 'bg-primary text-primary-foreground' : 'text-foreground'}
                              `}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </Popover.Panel>
                    </Popover>
                  </div>
                </div>
              </div>

              {/* Auto Load per Set (read-only display) */}
              <div className="w-full md:w-44">
                <div className="text-sm text-muted-foreground mb-2">Auto Load / Set</div>
                <div className="w-full rounded border border-input px-3 py-3 bg-muted text-foreground text-base min-h-[44px]">
                  {autoLoadPerSetByTiming[idx] === null || autoLoadPerSetByTiming[idx] === undefined ? (
                    <span className="text-muted-foreground">-</span>
                  ) : (
                    <span className="font-medium">
                      {autoLoadPerSetByTiming[idx]!.toFixed(2)} {workloadUnit || ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Add/Remove Buttons */}
              <div className="flex items-center gap-3 md:ml-auto">
                {idx === 0 ? (
                  <button
                    type="button"
                    onClick={addTiming}
                    className="
                      rounded bg-muted p-2 
                      min-w-[44px] min-h-[44px] 
                      flex items-center justify-center
                      hover:bg-muted/80 transition-colors
                    "
                    aria-label="Add row"
                    title="Add row"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6 text-foreground"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => removeTiming(idx)}
                    className="
                      p-2 text-destructive 
                      min-w-[44px] min-h-[44px] 
                      flex items-center justify-center
                      hover:bg-destructive/10 rounded transition-colors
                    "
                    aria-label="Remove row"
                    title="Remove row"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M6 2a1 1 0 011-1h6a1 1 0 011 1v1h3a1 1 0 110 2h-1v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5H3a1 1 0 110-2h3V2zm2 5a1 1 0 10-2 0v7a1 1 0 102 0V7zm4 0a1 1 0 10-2 0v7a1 1 0 102 0V7z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Description Textarea - Requirement 2.4 */}
      <div>
        <label htmlFor="habit-description" className="block text-base sm:text-lg font-medium mb-2 text-foreground">
          Description
        </label>
        <textarea
          id="habit-description"
          value={formState.notes}
          onChange={(e) => onFieldChange('notes', e.target.value)}
          placeholder="説明を追加"
          className="
            flex w-full rounded-md border border-input bg-background 
            px-3 py-2 text-sm 
            placeholder:text-muted-foreground 
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary 
            disabled:cursor-not-allowed disabled:opacity-50
            min-h-[100px]
          "
        />
      </div>
    </div>
  );
}

export default BasicTab;
