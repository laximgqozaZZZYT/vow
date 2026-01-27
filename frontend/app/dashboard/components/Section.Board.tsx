"use client";

/**
 * BoardSection Component
 * 
 * Main container for the Board section that replaces the original "Next" section.
 * Provides three layout modes:
 * - Detailed Layout (default): Kanban board with 3 columns (予定, 進行中, 完了(日次))
 * - Simple Layout: List view similar to the original NextSection
 * - Gantt Layout: Gantt chart view with timeline
 * 
 * Features:
 * - Layout mode toggle button in the header
 * - Persists layout preference to local storage
 * - Conditional rendering based on layout mode
 * 
 * @module Section.Board
 * 
 * Validates: Requirements 1.1, 1.2, 1.3
 * - 1.1: Board_Section SHALL display the Detailed_Layout (Kanban_Board) by default
 * - 1.2: Board_Section SHALL provide a toggle button to switch between layouts
 * - 1.3: Clicking the layout toggle SHALL switch to the other Layout_Mode without page reload
 */

import { useBoardLayout, type LayoutMode } from '../hooks/useBoardLayout';
import type { Habit, Activity, HabitAction, Goal } from '../types';
import type { HabitRelation } from '../types/shared';
import KanbanLayout from './Board.KanbanLayout';
import GanttLayout from './Board.GanttLayout';
import { useHandedness } from '../contexts/HandednessContext';
import { useState, useRef, useEffect } from 'react';
import { formatTime24, formatDateTime24 } from '../../../lib/format';
import { isHabitCumulativelyCompleted } from '../utils/habitCompletionUtils';
import './Board.css';
import './HabitNameScroll.css';

/**
 * Props for BoardSection component
 */
export interface BoardSectionProps {
  /** All habits to display */
  habits: Habit[];
  /** All activities (used for status determination) */
  activities: Activity[];
  /** All stickies to display */
  stickies?: any[];
  /** All goals (for Gantt view) */
  goals?: Goal[];
  /** All habit relations (for Gantt view) */
  habitRelations?: HabitRelation[];
  /** Callback when a habit action is triggered (start, complete, pause) */
  onHabitAction: (habitId: string, action: HabitAction, amount?: number) => void;
  /** Callback when habit edit is requested */
  onHabitEdit: (habitId: string) => void;
  /** Callback when goal edit is requested */
  onGoalEdit?: (goalId: string) => void;
  /** Callback when sticky is completed/uncompleted */
  onStickyComplete?: (stickyId: string) => void;
  /** Callback when sticky edit is requested */
  onStickyEdit?: (stickyId: string) => void;
  /** Callback when new goal is requested */
  onNewGoal?: () => void;
  /** Callback when new habit is requested */
  onNewHabit?: () => void;
  /** Callback when new sticky is requested */
  onNewSticky?: () => void;
  /** Callback when manage tags is requested */
  onManageTags?: () => void;
}

/**
 * Layout Toggle Button Component
 * 
 * Displays current mode and allows cycling between layouts
 */
function LayoutToggleButton({
  layoutMode,
  onToggle,
  loading
}: {
  layoutMode: LayoutMode;
  onToggle: () => void;
  loading: boolean;
}) {
  const getIcon = () => {
    switch (layoutMode) {
      case 'detailed':
        // Kanban icon (grid)
        return (
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="14" 
            height="14" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="7" height="18" rx="1" />
            <rect x="14" y="3" width="7" height="12" rx="1" />
          </svg>
        );
      case 'simple':
        // List icon
        return (
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="14" 
            height="14" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        );
      case 'gantt':
        // Gantt chart icon
        return (
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="14" 
            height="14" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="12" height="4" rx="1" />
            <rect x="7" y="10" width="10" height="4" rx="1" />
            <rect x="5" y="16" width="14" height="4" rx="1" />
          </svg>
        );
    }
  };

  const getLabel = () => {
    switch (layoutMode) {
      case 'detailed': return 'カンバン';
      case 'simple': return 'リスト';
      case 'gantt': return 'ガント';
    }
  };

  return (
    <button
      onClick={onToggle}
      disabled={loading}
      aria-label={`Switch layout (current: ${getLabel()})`}
      className="
        flex items-center gap-1.5
        px-2.5 py-1.5
        text-xs font-medium
        bg-muted hover:bg-muted/80
        text-muted-foreground hover:text-foreground
        border border-border
        rounded-md
        transition-colors
        focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        min-h-[32px]
      "
    >
      {getIcon()}
      <span className="hidden sm:inline">
        {getLabel()}
      </span>
    </button>
  );
}

/**
 * BoardSection Component
 * 
 * Main container that renders KanbanLayout, SimpleLayout, or GanttLayout
 * based on user preference stored in local storage.
 */
/**
 * Add Button Component for Board Header
 * Provides quick access to create Goal, Habit, or manage Tags
 */
function AddButton({
  onNewGoal,
  onNewHabit,
  onManageTags
}: {
  onNewGoal?: () => void;
  onNewHabit?: () => void;
  onManageTags?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleAction = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Add new item"
        aria-expanded={isOpen}
        className="
          flex items-center justify-center
          w-8 h-8
          text-primary-foreground
          bg-primary hover:bg-primary/90
          border border-primary
          rounded-md
          transition-colors
          focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2
          shadow-sm
        "
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {isOpen && (
        <div className="
          absolute right-0 top-full mt-1
          w-36
          bg-card
          border border-border
          rounded-md shadow-lg
          z-50
          py-1
        ">
          {onNewGoal && (
            <button
              onClick={() => handleAction(onNewGoal)}
              className="
                w-full px-3 py-2
                text-sm text-left
                hover:bg-muted
                transition-colors
                flex items-center gap-2
              "
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-green-600"
              >
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" />
              </svg>
              Goal
            </button>
          )}
          {onNewHabit && (
            <button
              onClick={() => handleAction(onNewHabit)}
              className="
                w-full px-3 py-2
                text-sm text-left
                hover:bg-muted
                transition-colors
                flex items-center gap-2
              "
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-blue-600"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              Habit
            </button>
          )}
          {onManageTags && (
            <button
              onClick={() => handleAction(onManageTags)}
              className="
                w-full px-3 py-2
                text-sm text-left
                hover:bg-muted
                transition-colors
                flex items-center gap-2
              "
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-purple-600"
              >
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                <line x1="7" y1="7" x2="7.01" y2="7" />
              </svg>
              Tags
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function BoardSection({
  habits,
  activities,
  stickies = [],
  goals = [],
  habitRelations = [],
  onHabitAction,
  onHabitEdit,
  onGoalEdit,
  onStickyComplete,
  onStickyEdit,
  onNewGoal,
  onNewHabit,
  onNewSticky,
  onManageTags
}: BoardSectionProps) {
  const { 
    layoutMode, 
    toggleLayoutMode, 
    isDetailedMode,
    isGanttMode,
    loading 
  } = useBoardLayout();
  
  const { isLeftHanded } = useHandedness();

  // Check if any add actions are available
  const hasAddActions = onNewGoal || onNewHabit || onManageTags;

  return (
    <section className="rounded-lg border border-border bg-card text-card-foreground shadow-sm flex flex-col min-h-0">
      {/* Header with title, add button, and layout toggle */}
      <div className={`sticky top-0 z-20 flex items-center justify-between p-4 sm:p-6 pb-2 sm:pb-3 bg-card border-b border-border ${isLeftHanded ? 'flex-row-reverse' : ''}`}>
        <h2 className="text-lg font-semibold">Board</h2>
        <div className={`flex items-center gap-2 ${isLeftHanded ? 'flex-row-reverse' : ''}`}>
          {hasAddActions && (
            <AddButton
              onNewGoal={onNewGoal}
              onNewHabit={onNewHabit}
              onManageTags={onManageTags}
            />
          )}
          <LayoutToggleButton
            layoutMode={layoutMode}
            onToggle={toggleLayoutMode}
            loading={loading}
          />
        </div>
      </div>
      
      {/* Content area - conditional rendering based on layout mode */}
      <div className={`flex-1 min-h-0 ${isGanttMode ? 'overflow-hidden' : 'overflow-visible'}`}>
        {isDetailedMode ? (
          <KanbanLayout
            habits={habits}
            activities={activities}
            stickies={stickies}
            onHabitAction={onHabitAction}
            onHabitEdit={onHabitEdit}
            onStickyComplete={onStickyComplete || (() => {})}
            onStickyEdit={onStickyEdit || (() => {})}
            onNewHabit={onNewHabit}
            onNewSticky={onNewSticky}
          />
        ) : isGanttMode ? (
          <GanttLayout
            goals={goals}
            habits={habits}
            activities={activities}
            habitRelations={habitRelations}
            onGoalEdit={onGoalEdit || (() => {})}
            onHabitEdit={onHabitEdit}
          />
        ) : (
          <SimpleLayout
            habits={habits}
            activities={activities}
            onHabitAction={onHabitAction}
            onHabitEdit={onHabitEdit}
          />
        )}
      </div>
    </section>
  );
}

/**
 * SimpleLayout Component
 * 
 * List view layout similar to the original NextSection.
 * Shows habits scheduled for the next 24 hours in a vertical list.
 * 
 * Validates: Requirements 6.1, 6.2, 6.3
 * - 6.1: Simple_Layout SHALL display habits in a vertical list format identical to the original NextSection
 * - 6.2: Simple_Layout SHALL maintain all existing functionality
 * - 6.3: Simple_Layout SHALL display the same habits that would appear in the Kanban_Board
 */

interface SimpleLayoutProps {
  habits: Habit[];
  activities: Activity[];
  onHabitAction: (habitId: string, action: HabitAction, amount?: number) => void;
  onHabitEdit: (habitId: string) => void;
}

function SimpleLayout({
  habits,
  activities,
  onHabitAction,
  onHabitEdit
}: SimpleLayoutProps) {
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const { isLeftHanded } = useHandedness();
  
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const candidates: Array<{ h: Habit; start: Date }> = [];

  for (const h of habits) {
    if (h.completed) continue;
    if (h.type === 'avoid') continue;
    
    // 累積完了チェック
    if (isHabitCumulativelyCompleted(h, activities)) continue;
    
    const timings = (h as any).timings ?? [];
    let found: Date | null = null;

    // check explicit timings first
    if (timings && timings.length) {
      for (const t of timings) {
        try {
          if (t.start) {
            const baseDate = t.date ?? h.dueDate ?? now.toISOString().slice(0,10);
            let dt = new Date(`${baseDate}T${t.start}:00`);
            
            // If the datetime is in the past, shift to today or tomorrow
            if (dt < now) {
              const todayStr = now.toISOString().slice(0,10);
              dt = new Date(`${todayStr}T${t.start}:00`);
              
              // If still in the past (earlier today), try tomorrow
              if (dt < now) {
                dt = new Date(dt.getTime() + 24*60*60*1000);
              }
            }
            
            if (dt >= now && dt <= windowEnd) { found = dt; break }
          }
        } catch (e) { /* ignore malformed */ }
      }
    }

    // fallback: use h.time / dueDate
    if (!found && h.time) {
      try {
        const baseDate = h.dueDate ?? now.toISOString().slice(0,10);
        let dt = new Date(`${baseDate}T${h.time}:00`);
        if (dt < now) dt = new Date(dt.getTime() + 24*60*60*1000);
        if (dt >= now && dt <= windowEnd) found = dt;
      } catch (e) { /* ignore malformed */ }
    }

    if (found) candidates.push({ h, start: found });
  }

  candidates.sort((a,b) => a.start.getTime() - b.start.getTime());
  const pick = candidates.slice(0,5);

  const getInputValue = (habitId: string) => {
    if (inputValues[habitId] !== undefined) {
      return inputValues[habitId];
    }
    const habit = habits.find(h => h.id === habitId);
    const workloadPerCount = (habit as any)?.workloadPerCount ?? 1;
    return String(workloadPerCount);
  };

  const setInputValue = (habitId: string, value: string) => {
    setInputValues(prev => ({ ...prev, [habitId]: value }));
  };

  const handleCompleteWithAmount = (habitId: string) => {
    const amount = parseFloat(getInputValue(habitId)) || 1;
    onHabitAction(habitId, 'complete', amount);
  };

  if (pick.length === 0) {
    return (
      <div className="p-4 sm:p-6 pt-2 sm:pt-3">
        <div className="text-sm text-muted-foreground">No habits starting in the next 24 hours</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 pt-2 sm:pt-3">
      <ul className="flex flex-col">
        {pick.map((c, idx) => (
          <li key={c.h.id} className={`flex items-center gap-2 sm:gap-3 py-2.5 sm:py-2 ${isLeftHanded ? 'flex-row-reverse' : ''} ${idx > 0 ? 'mt-2 border-t border-zinc-100 dark:border-zinc-800 pt-3' : ''}`}>
            <div className={`flex shrink-0 items-center gap-1.5 sm:gap-2 ${isLeftHanded ? 'flex-row-reverse' : ''}`}>
              <button
                title="Complete"
                onClick={(e) => { e.stopPropagation(); handleCompleteWithAmount(c.h.id) }}
                className="bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded px-2 py-1 text-xs font-medium transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
              >
                ✓
              </button>
              <span className={`text-xs text-zinc-500 hidden sm:inline w-16 truncate ${isLeftHanded ? 'text-right' : 'text-left'}`} title={(c.h as any)?.workloadUnit || 'units'}>
                {(c.h as any)?.workloadUnit || 'units'}
              </span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={getInputValue(c.h.id)}
                onChange={(e) => setInputValue(c.h.id, e.target.value)}
                className="w-10 sm:w-12 text-xs text-center bg-zinc-100 dark:bg-zinc-800 border-0 rounded px-1 sm:px-2 py-1 focus:ring-1 focus:ring-blue-500 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className={`flex min-w-0 items-center gap-2 sm:gap-3 flex-1 ${isLeftHanded ? 'flex-row-reverse' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="habit-name-scroll min-w-0 overflow-hidden">
                  <button
                    onClick={(e) => { e.stopPropagation(); onHabitEdit(c.h.id); }}
                    className={`habit-name-text inline-block whitespace-nowrap text-sm text-left hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer ${c.h.completed ? 'line-through text-zinc-400' : 'text-zinc-800 dark:text-zinc-100'}`}
                  >
                    {c.h.name}
                  </button>
                </div>
                {(c.h as any)?.workloadUnit && (
                  <div className="text-xs text-zinc-500 mt-0.5 truncate">
                    Target: {(c.h as any)?.workloadPerCount || 1} {(c.h as any)?.workloadUnit}
                  </div>
                )}
              </div>
              <div className="w-2 h-2 shrink-0 rounded-full bg-sky-500" />
              <div className="w-12 sm:w-16 shrink-0 text-xs text-zinc-500 tabular-nums">
                {(() => {
                  const d = c.start;
                  const todayStr = new Date().toISOString().slice(0,10);
                  if (d.toISOString().slice(0,10) === todayStr) return formatTime24(d, { hour: '2-digit', minute: '2-digit' });
                  return formatDateTime24(d);
                })()}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
