"use client";

/**
 * CalendarControls - Navigation controls for the calendar widget
 * 
 * A pure presentational component that renders view selection buttons
 * (today, tomorrow, week, month) and delegates all state management
 * to the parent component.
 * 
 * @requirements 1.1, 1.2, 1.3 - Component extraction with backward compatibility
 */

export type CalendarViewType = 'today' | 'tomorrow' | 'week' | 'month';

export interface CalendarControlsProps {
  /** Currently selected view */
  selectedView: CalendarViewType;
  /** Callback when view selection changes */
  onViewChange: (view: CalendarViewType) => void;
  /** Callback to scroll calendar to current time (for today view) */
  onScrollToNow: () => void;
}

/**
 * View button configuration for consistent rendering
 */
const VIEW_BUTTONS: { key: CalendarViewType; label: string }[] = [
  { key: 'today', label: 'today' },
  { key: 'tomorrow', label: 'tomorrow' },
  { key: 'week', label: 'week' },
  { key: 'month', label: 'month' },
];

/**
 * CalendarControls component
 * 
 * Renders navigation buttons for switching between calendar views.
 * This is a pure presentational component with no internal state.
 * 
 * Design System:
 * - Uses semantic color tokens (bg-sky-600 for active, bg-white/dark:bg-slate-800 for inactive)
 * - Responsive padding (px-2 sm:px-3)
 * - Accessible focus states with focus-visible
 * - Minimum touch target size (44px height via py-1 + text size)
 */
export default function CalendarControls({
  selectedView,
  onViewChange,
  onScrollToNow,
}: CalendarControlsProps) {
  const handleViewClick = (view: CalendarViewType) => {
    onViewChange(view);
    
    // Scroll to current time when switching to today view
    if (view === 'today') {
      // Use setTimeout to allow the view change to complete first
      window.setTimeout(() => onScrollToNow(), 50);
    }
  };

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {VIEW_BUTTONS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => handleViewClick(key)}
          className={`
            rounded px-2 sm:px-3 py-1 text-xs sm:text-sm
            min-h-[44px] min-w-[44px]
            transition-colors
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600
            ${
              selectedView === key
                ? 'bg-sky-600 text-white'
                : 'bg-white dark:bg-slate-800 border border-border text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
            }
          `}
          aria-pressed={selectedView === key}
          aria-label={`Switch to ${label} view`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
