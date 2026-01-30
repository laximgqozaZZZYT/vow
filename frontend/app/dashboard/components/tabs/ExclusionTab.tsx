'use client';

/**
 * ExclusionTab Component
 * 
 * 除外日時タブ - Habitモーダルの2番目のタブ
 * 
 * Contains:
 * - Outdates configuration section (Requirement 3.1)
 * - Support for adding multiple exclusion periods (Requirement 3.2)
 * - Support for Date, Daily, Weekly, Monthly exclusion types (Requirement 3.3)
 * - Clear explanation of what exclusions do (Requirement 3.4)
 * - Empty state with guidance when no exclusions (Requirement 3.5)
 * 
 * All inputs have minimum height of 44px for touch targets (Requirement 6.2)
 * 
 * @module ExclusionTab
 */

import React from 'react';
import { Popover } from '@headlessui/react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import type { Timing, TimingType } from './BasicTab';

// ============================================================================
// Types
// ============================================================================

export interface ExclusionTabProps {
  /** Whether this tab panel is currently active/visible */
  isActive: boolean;
  /** Current outdates (exclusion periods) */
  outdates: Timing[];
  /** Callback when outdates change */
  onOutdatesChange: (outdates: Timing[]) => void;
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

/**
 * Get display label for timing type
 */
function getTimingTypeLabel(type: TimingType): string {
  switch (type) {
    case 'Date':
      return '特定の日';
    case 'Daily':
      return '毎日';
    case 'Weekly':
      return '毎週';
    case 'Monthly':
      return '毎月';
    default:
      return type;
  }
}

// ============================================================================
// Component
// ============================================================================

/**
 * ExclusionTab Component
 * 
 * The second tab in the Habit Modal containing:
 * - Outdates (exclusion periods) configuration
 * - Empty state with guidance when no exclusions
 * - Support for Date, Daily, Weekly, Monthly exclusion types
 */
export function ExclusionTab({
  isActive,
  outdates,
  onOutdatesChange,
  idPrefix = 'habit-modal',
}: ExclusionTabProps) {
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

  // Update a single outdate entry
  const updateOutdate = React.useCallback(
    (index: number, updates: Partial<Timing>) => {
      const newOutdates = outdates.map((t, i) =>
        i === index ? { ...t, ...updates } : t
      );
      onOutdatesChange(newOutdates);
    },
    [outdates, onOutdatesChange]
  );

  // Add a new outdate row
  const addOutdate = React.useCallback(() => {
    const firstOutdate = outdates[0];
    const newOutdate: Timing = {
      type: firstOutdate?.type ?? 'Date',
      date: undefined,
      start: undefined,
      end: undefined,
    };
    onOutdatesChange([...outdates, newOutdate]);
  }, [outdates, onOutdatesChange]);

  // Remove an outdate row
  const removeOutdate = React.useCallback(
    (index: number) => {
      const newOutdates = outdates.filter((_, i) => i !== index);
      onOutdatesChange(newOutdates);
    },
    [outdates, onOutdatesChange]
  );

  const panelId = `${idPrefix}-tabpanel-exclusion`;
  const tabId = `${idPrefix}-tab-exclusion`;

  // Check if outdates is effectively empty (no meaningful data)
  const hasNoExclusions = outdates.length === 0 || 
    (outdates.length === 1 && !outdates[0].date && !outdates[0].start && !outdates[0].end);

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
      {/* Explanatory Text - Requirement 3.4 */}
      <div className="p-4 rounded-lg bg-muted border border-border">
        <h3 className="text-base font-medium text-foreground mb-2">
          除外日時について
        </h3>
        <p className="text-sm text-muted-foreground">
          除外日時を設定すると、特定の日や時間帯にこの習慣を実行しなくても良くなります。
          祝日、休暇、特別なイベントなど、習慣を一時的にスキップしたい期間を設定できます。
        </p>
      </div>

      {/* Outdates Section Header - Requirement 3.1 */}
      <div className="flex items-center justify-between">
        <h3 className="text-base sm:text-lg font-medium text-foreground">
          除外期間
        </h3>
        <button
          type="button"
          onClick={addOutdate}
          className="
            rounded bg-muted p-2 
            min-w-[44px] min-h-[44px] 
            flex items-center justify-center gap-2
            hover:bg-muted/80 transition-colors
            text-sm text-foreground
          "
          aria-label="除外期間を追加"
          title="除外期間を追加"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden sm:inline">追加</span>
        </button>
      </div>

      {/* Empty State - Requirement 3.5 */}
      {hasNoExclusions && outdates.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 px-4 rounded-lg border-2 border-dashed border-border bg-muted/30">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-12 w-12 text-muted-foreground mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <h4 className="text-base font-medium text-foreground mb-2">
            除外期間が設定されていません
          </h4>
          <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
            「追加」ボタンをクリックして、習慣をスキップしたい日や時間帯を設定してください。
            祝日や休暇など、特別な日を除外できます。
          </p>
          <button
            type="button"
            onClick={addOutdate}
            className="
              px-4 py-2 
              bg-primary text-primary-foreground 
              rounded-md shadow-sm
              hover:opacity-90 
              focus-visible:outline-2 focus-visible:outline-primary
              transition-opacity
              min-h-[44px]
            "
          >
            最初の除外期間を追加
          </button>
        </div>
      )}

      {/* Outdates List - Requirements 3.2, 3.3, 9.2, 9.4 */}
      {outdates.length > 0 && (
        <div className="space-y-4">
          {outdates.map((outdate, idx) => (
            <div
              key={idx}
              className="
                /* Mobile: full-width single-column layout (Requirement 9.2) */
                flex flex-col gap-3 
                /* Desktop: multi-column layout (Requirement 9.4) */
                md:flex-row md:items-end md:flex-wrap
                rounded-lg px-3 py-3 border border-border bg-card
              "
            >
              {/* Exclusion Type - Requirement 3.3 */}
              <div className="w-full md:w-36">
                <div className="text-sm text-muted-foreground mb-2">タイプ</div>
                <div className="rounded border border-input bg-background">
                  <Popover className="relative">
                    <Popover.Button className="w-full text-left px-3 py-3 text-base min-h-[44px] text-foreground">
                      {getTimingTypeLabel(outdate.type)}
                    </Popover.Button>
                    <Popover.Panel className="absolute z-[10002] mt-2 left-0 w-40">
                      <div className="rounded bg-card p-2 shadow-lg border border-border">
                        {(['Date', 'Daily', 'Weekly', 'Monthly'] as TimingType[]).map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => updateOutdate(idx, { type })}
                            className={`
                              w-full text-left px-3 py-2 rounded
                              hover:bg-muted transition-colors
                              min-h-[44px]
                              ${outdate.type === type ? 'bg-primary text-primary-foreground' : 'text-foreground'}
                            `}
                          >
                            {getTimingTypeLabel(type)}
                          </button>
                        ))}
                      </div>
                    </Popover.Panel>
                  </Popover>
                </div>
              </div>

              {/* Date Picker */}
              <div className="w-full md:w-36">
                <div className="text-sm text-muted-foreground mb-2">日付</div>
                <div className="rounded border border-input bg-background">
                  <Popover className="relative">
                    <Popover.Button className="w-full text-left px-3 py-3 text-base min-h-[44px] text-foreground">
                      {outdate.date
                        ? parseYMD(outdate.date)?.toLocaleDateString('ja-JP') ?? '日付を選択'
                        : '日付を選択'}
                    </Popover.Button>
                    <Popover.Panel className="absolute z-[10002] mt-2 left-0 w-[min(380px,90vw)]">
                      <div className="rounded bg-card p-4 shadow-lg border border-border">
                        <DayPicker
                          mode="single"
                          selected={outdate.date ? parseYMD(outdate.date) : undefined}
                          onSelect={(d) =>
                            updateOutdate(idx, { date: d ? formatLocalDate(d) : undefined })
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
                <div className="flex-1 md:w-28 md:flex-none">
                  <div className="text-sm text-muted-foreground mb-2">開始</div>
                  <div className="rounded border border-input bg-background">
                    <Popover className="relative">
                      <Popover.Button className="w-full text-left px-3 py-3 text-base min-h-[44px] text-foreground">
                        {outdate.start ?? '--:--'}
                      </Popover.Button>
                      <Popover.Panel className="absolute z-[10002] mt-2 left-0 w-40">
                        <div className="rounded bg-card p-3 shadow-lg border border-border max-h-56 overflow-auto">
                          {buildTimeOptions().map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => updateOutdate(idx, { start: opt.value })}
                              className={`
                                w-full text-left px-3 py-2 rounded
                                hover:bg-muted transition-colors
                                min-h-[44px]
                                ${outdate.start === opt.value ? 'bg-primary text-primary-foreground' : 'text-foreground'}
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
                <div className="flex-1 md:w-28 md:flex-none">
                  <div className="text-sm text-muted-foreground mb-2">終了</div>
                  <div className="rounded border border-input bg-background">
                    <Popover className="relative">
                      <Popover.Button className="w-full text-left px-3 py-3 text-base min-h-[44px] text-foreground">
                        {outdate.end ?? '--:--'}
                      </Popover.Button>
                      <Popover.Panel className="absolute z-[10002] mt-2 left-0 w-40">
                        <div className="rounded bg-card p-3 shadow-lg border border-border max-h-56 overflow-auto">
                          {buildTimeOptions().map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => updateOutdate(idx, { end: opt.value })}
                              className={`
                                w-full text-left px-3 py-2 rounded
                                hover:bg-muted transition-colors
                                min-h-[44px]
                                ${outdate.end === opt.value ? 'bg-primary text-primary-foreground' : 'text-foreground'}
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

              {/* Remove Button */}
              <div className="flex items-center md:ml-auto">
                <button
                  type="button"
                  onClick={() => removeOutdate(idx)}
                  className="
                    p-2 text-destructive 
                    min-w-[44px] min-h-[44px] 
                    flex items-center justify-center
                    hover:bg-destructive/10 rounded transition-colors
                  "
                  aria-label="除外期間を削除"
                  title="除外期間を削除"
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
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Help Text for Exclusion Types */}
      {outdates.length > 0 && (
        <div className="p-4 rounded-lg bg-muted/50 border border-border">
          <h4 className="text-sm font-medium text-foreground mb-2">
            除外タイプの説明
          </h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li><strong>特定の日:</strong> 特定の日付を除外します（例: 2024年1月1日）</li>
            <li><strong>毎日:</strong> 毎日の特定の時間帯を除外します</li>
            <li><strong>毎週:</strong> 毎週の特定の曜日・時間帯を除外します</li>
            <li><strong>毎月:</strong> 毎月の特定の日・時間帯を除外します</li>
          </ul>
        </div>
      )}
    </div>
  );
}

export default ExclusionTab;
