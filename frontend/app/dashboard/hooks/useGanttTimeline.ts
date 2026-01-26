/**
 * useGanttTimeline Hook
 * 
 * Manages the timeline state and calculations for the Gantt chart.
 * Handles view mode switching, date range calculation, and cell generation.
 * 
 * @module useGanttTimeline
 * 
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.7
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { GanttRowData } from '../utils/ganttDataUtils';

// ============================================================================
// Types
// ============================================================================

/**
 * View mode for the timeline
 */
export type ViewMode = 'day' | 'week' | 'month';

/**
 * A single cell in the timeline header
 */
export interface TimelineCell {
  /** Start date of this cell */
  date: Date;
  /** Display label */
  label: string;
  /** Whether this cell contains today */
  isToday: boolean;
  /** Whether this is a weekend (for day view) */
  isWeekend: boolean;
  /** Width of this cell in pixels */
  width: number;
}

export interface UseGanttTimelineProps {
  /** Visible rows to calculate date range from */
  rows: GanttRowData[];
  /** Initial view mode */
  initialViewMode?: ViewMode;
}

export interface UseGanttTimelineReturn {
  /** Current view mode */
  viewMode: ViewMode;
  /** Set view mode */
  setViewMode: (mode: ViewMode) => void;
  /** Start date of the visible timeline */
  startDate: Date;
  /** End date of the visible timeline */
  endDate: Date;
  /** Timeline cells for the header */
  cells: TimelineCell[];
  /** X position of today in pixels */
  todayPosition: number;
  /** Scroll to today's position */
  scrollToToday: () => void;
  /** Pixels per day */
  dayWidth: number;
  /** Total width of the timeline in pixels */
  totalWidth: number;
  /** Ref for the scrollable container */
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

// ============================================================================
// Constants
// ============================================================================

/** Pixels per day for each view mode */
const DAY_WIDTH: Record<ViewMode, number> = {
  day: 40,
  week: 20,
  month: 6
};

/** Visible range in days for each view mode (centered on today) */
const VISIBLE_RANGE: Record<ViewMode, { before: number; after: number }> = {
  day: { before: 7, after: 21 },      // +7 days (total 4 weeks)
  week: { before: 14, after: 42 },    // +2 weeks (total 8 weeks)
  month: { before: 30, after: 150 }   // +3 months (total 6 months)
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the start of a day (midnight)
 */
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the start of a week (Monday)
 */
function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the start of a month
 */
function startOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Add days to a date
 */
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Add months to a date
 */
function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Get days in a month
 */
function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * Check if two dates are the same day
 */
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}

/**
 * Check if a date is a weekend
 */
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Format date for day view label
 */
function formatDayLabel(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * Format date for week view label
 */
function formatWeekLabel(date: Date): string {
  const endOfWeek = addDays(date, 6);
  return `${date.getMonth() + 1}/${date.getDate()}-${endOfWeek.getDate()}`;
}

/**
 * Format date for month view label
 */
function formatMonthLabel(date: Date): string {
  const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  return months[date.getMonth()];
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Custom hook for managing Gantt chart timeline
 * 
 * @param props - Rows and initial view mode
 * @returns Timeline state and controls
 */
export function useGanttTimeline({
  rows,
  initialViewMode = 'week'
}: UseGanttTimelineProps): UseGanttTimelineReturn {
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const dayWidth = DAY_WIDTH[viewMode];

  /**
   * Calculate the date range based on view mode (centered on today)
   */
  const { startDate, endDate } = useMemo(() => {
    const today = startOfDay(new Date());
    const range = VISIBLE_RANGE[viewMode];
    
    // Calculate range centered on today
    const paddedStart = addDays(today, -range.before);
    const paddedEnd = addDays(today, range.after);

    // Align to view mode boundaries
    let alignedStart: Date;
    let alignedEnd: Date;

    switch (viewMode) {
      case 'day':
        alignedStart = startOfDay(paddedStart);
        alignedEnd = startOfDay(paddedEnd);
        break;
      case 'week':
        alignedStart = startOfWeek(paddedStart);
        alignedEnd = addDays(startOfWeek(paddedEnd), 7);
        break;
      case 'month':
        alignedStart = startOfMonth(paddedStart);
        alignedEnd = addMonths(startOfMonth(paddedEnd), 1);
        break;
    }

    return { startDate: alignedStart, endDate: alignedEnd };
  }, [viewMode]);

  /**
   * Generate timeline cells
   * Validates: Requirements 8.3, 8.4, 8.5
   */
  const cells = useMemo(() => {
    const result: TimelineCell[] = [];
    const today = startOfDay(new Date());
    let current = new Date(startDate);

    while (current < endDate) {
      let cellWidth: number;
      let label: string;
      let cellIsToday: boolean;
      let cellIsWeekend: boolean;

      switch (viewMode) {
        case 'day':
          cellWidth = dayWidth;
          label = formatDayLabel(current);
          cellIsToday = isSameDay(current, today);
          cellIsWeekend = isWeekend(current);
          result.push({
            date: new Date(current),
            label,
            isToday: cellIsToday,
            isWeekend: cellIsWeekend,
            width: cellWidth
          });
          current = addDays(current, 1);
          break;

        case 'week':
          cellWidth = dayWidth * 7;
          label = formatWeekLabel(current);
          cellIsToday = today >= current && today < addDays(current, 7);
          cellIsWeekend = false;
          result.push({
            date: new Date(current),
            label,
            isToday: cellIsToday,
            isWeekend: cellIsWeekend,
            width: cellWidth
          });
          current = addDays(current, 7);
          break;

        case 'month':
          const daysInMonth = getDaysInMonth(current);
          cellWidth = dayWidth * daysInMonth;
          label = formatMonthLabel(current);
          cellIsToday = today.getFullYear() === current.getFullYear() &&
                        today.getMonth() === current.getMonth();
          cellIsWeekend = false;
          result.push({
            date: new Date(current),
            label,
            isToday: cellIsToday,
            isWeekend: cellIsWeekend,
            width: cellWidth
          });
          current = addMonths(current, 1);
          break;
      }
    }

    return result;
  }, [startDate, endDate, viewMode, dayWidth]);

  /**
   * Calculate today's X position
   * Validates: Requirement 8.7
   */
  const todayPosition = useMemo(() => {
    const today = startOfDay(new Date());
    const daysDiff = Math.floor(
      (today.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)
    );
    return daysDiff * dayWidth;
  }, [startDate, dayWidth]);

  /**
   * Total width of the timeline
   */
  const totalWidth = useMemo(() => {
    return cells.reduce((sum, cell) => sum + cell.width, 0);
  }, [cells]);

  /**
   * Scroll to today's position
   */
  const scrollToToday = useCallback(() => {
    if (scrollContainerRef.current) {
      const containerWidth = scrollContainerRef.current.clientWidth;
      const scrollLeft = Math.max(0, todayPosition - containerWidth / 2);
      scrollContainerRef.current.scrollTo({
        left: scrollLeft,
        behavior: 'smooth'
      });
    }
  }, [todayPosition]);

  // Auto-scroll to today on mount
  useEffect(() => {
    // Small delay to ensure the container is rendered
    const timer = setTimeout(scrollToToday, 100);
    return () => clearTimeout(timer);
  }, [scrollToToday]);

  return {
    viewMode,
    setViewMode,
    startDate,
    endDate,
    cells,
    todayPosition,
    scrollToToday,
    dayWidth,
    totalWidth,
    scrollContainerRef
  };
}

export default useGanttTimeline;
