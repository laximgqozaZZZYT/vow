/**
 * Board Gantt Layout Component
 *
 * Main container for the Gantt chart view in the Board section.
 * Integrates all Gantt sub-components and manages state.
 *
 * Features:
 * - Horizontal scroll navigation with arrow buttons
 * - Touch/swipe support for mobile
 * - Fixed header with controls
 *
 * @module Board.GanttLayout
 *
 * Validates: Requirements 1.2, 8.6
 */

"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { Goal, Habit, Activity } from '../types';
import type { HabitRelation } from '../types/shared';
import { useGanttData } from '../hooks/useGanttData';
import { useGanttTimeline } from '../hooks/useGanttTimeline';
import { calculateLightningPoints } from '../utils/lightningLineUtils';
import { GanttRow } from './Gantt.Row';
import { GanttBar } from './Gantt.Bar';
import { GanttDependency } from './Gantt.Dependency';
import { GanttTimelineHeader } from './Gantt.TimelineHeader';
import { GanttLightningLine } from './Gantt.LightningLine';
import { GanttTooltip } from './Gantt.Tooltip';
import type { GanttRowData } from '../utils/ganttDataUtils';

// ============================================================================
// Navigation Arrow Component
// ============================================================================

interface ScrollArrowProps {
  direction: 'left' | 'right';
  visible: boolean;
  onClick: () => void;
}

function ScrollArrow({ direction, visible, onClick }: ScrollArrowProps) {
  if (!visible) return null;

  return (
    <button
      onClick={onClick}
      className={`
        absolute top-1/2 -translate-y-1/2 z-30
        w-10 h-20
        flex items-center justify-center
        bg-gradient-to-${direction === 'left' ? 'r' : 'l'}
        from-card/90 via-card/70 to-transparent
        text-muted-foreground hover:text-foreground
        transition-all duration-200
        hover:from-card hover:via-card/80
        ${direction === 'left' ? 'left-0 pl-1' : 'right-0 pr-1'}
      `}
      aria-label={direction === 'left' ? '左へスクロール' : '右へスクロール'}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="drop-shadow-sm"
      >
        {direction === 'left' ? (
          <polyline points="15 18 9 12 15 6" />
        ) : (
          <polyline points="9 6 15 12 9 18" />
        )}
      </svg>
    </button>
  );
}

// ============================================================================
// Interfaces
// ============================================================================

export interface GanttLayoutProps {
  /** All Goals */
  goals: Goal[];
  /** All Habits */
  habits: Habit[];
  /** All Activities */
  activities: Activity[];
  /** All HabitRelations */
  habitRelations: HabitRelation[];
  /** Callback when a Goal is clicked for editing */
  onGoalEdit: (goalId: string) => void;
  /** Callback when a Habit is clicked for editing */
  onHabitEdit: (habitId: string) => void;
}

// ============================================================================
// Constants
// ============================================================================

const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 24; // Reduced - controls moved to toolbar
const ROW_NAMES_WIDTH_DESKTOP = 180;
const ROW_NAMES_WIDTH_MOBILE = 120;
const BAR_HEIGHT = 20;
const BAR_PADDING = (ROW_HEIGHT - BAR_HEIGHT) / 2;

// Minimum chart width to ensure scrollability (in pixels)
const MIN_CHART_WIDTH = 800;
const MIN_CHART_WIDTH_MOBILE = 600;

// ============================================================================
// Component
// ============================================================================

/**
 * Board Gantt Layout Component
 */
export default function GanttLayout({
  goals,
  habits,
  activities,
  habitRelations,
  onGoalEdit,
  onHabitEdit
}: GanttLayoutProps) {
  // Detect mobile viewport
  const [isMobile, setIsMobile] = useState(false);

  // Refs for scroll synchronization
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const rowNamesRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);

  // Scroll arrow visibility state
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const rowNamesWidth = isMobile ? ROW_NAMES_WIDTH_MOBILE : ROW_NAMES_WIDTH_DESKTOP;
  const minChartWidth = isMobile ? MIN_CHART_WIDTH_MOBILE : MIN_CHART_WIDTH;

  // Update scroll arrow visibility
  const updateScrollArrows = useCallback(() => {
    const container = mainScrollRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  }, []);

  // Scroll by a fixed amount
  const scrollByAmount = useCallback((direction: 'left' | 'right') => {
    const container = mainScrollRef.current;
    if (!container) return;

    const scrollAmount = container.clientWidth * 0.6;
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  }, []);

  // Update arrows on resize
  useEffect(() => {
    updateScrollArrows();
    window.addEventListener('resize', updateScrollArrows);
    return () => window.removeEventListener('resize', updateScrollArrows);
  }, [updateScrollArrows]);

  // State for tooltip
  const [tooltipData, setTooltipData] = useState<{
    row: GanttRowData | null;
    x: number;
    y: number;
  }>({ row: null, x: 0, y: 0 });

  // State for highlighted dependency
  const [highlightedDependency, setHighlightedDependency] = useState<string | null>(null);

  // State for lightning line visibility
  const [showLightningLine, setShowLightningLine] = useState(true);

  // State for view mode (managed separately to avoid circular dependency)
  const [currentViewMode, setCurrentViewMode] = useState<'day' | 'week' | 'month'>('week');

  // Use Gantt data hook with viewMode
  const {
    rows,
    dependencies,
    toggleExpand,
    expandAll,
    collapseAll
  } = useGanttData({
    goals,
    habits,
    activities,
    habitRelations,
    viewMode: currentViewMode
  });

  // Use Gantt timeline hook
  const {
    viewMode,
    setViewMode,
    startDate,
    cells,
    todayPosition,
    scrollToToday,
    dayWidth,
    totalWidth,
    scrollContainerRef
  } = useGanttTimeline({
    rows,
    initialViewMode: currentViewMode
  });

  // Sync viewMode between timeline and data hooks
  const handleViewModeChange = useCallback((mode: 'day' | 'week' | 'month') => {
    setCurrentViewMode(mode);
    setViewMode(mode);
  }, [setViewMode]);

  // Sync scroll between all panels and update arrow visibility
  useEffect(() => {
    const mainScroll = mainScrollRef.current;
    const rowNames = rowNamesRef.current;
    const headerScroll = headerScrollRef.current;

    if (!mainScroll) return;

    const handleMainScroll = () => {
      // Sync vertical scroll to row names
      if (rowNames) {
        rowNames.scrollTop = mainScroll.scrollTop;
      }
      // Sync horizontal scroll to header
      if (headerScroll) {
        headerScroll.scrollLeft = mainScroll.scrollLeft;
      }
      // Update scroll arrows visibility
      updateScrollArrows();
    };

    mainScroll.addEventListener('scroll', handleMainScroll);
    // Initial check for arrows
    updateScrollArrows();
    return () => mainScroll.removeEventListener('scroll', handleMainScroll);
  }, [updateScrollArrows]);

  // Calculate actual chart width (ensures minimum width for scrollability)
  const chartWidth = useMemo(() => {
    return Math.max(totalWidth, minChartWidth);
  }, [totalWidth, minChartWidth]);

  // Update arrows when chart dimensions change
  useEffect(() => {
    // Small delay to let the DOM update
    const timer = setTimeout(updateScrollArrows, 100);
    return () => clearTimeout(timer);
  }, [chartWidth, rows.length, updateScrollArrows]);

  // Calculate lightning line points
  const lightningPoints = useMemo(() => {
    return calculateLightningPoints(rows, new Date(), dayWidth);
  }, [rows, dayWidth]);

  // Calculate bar position for a row
  const getBarPosition = useCallback((row: GanttRowData) => {
    if (!row.startDate || !row.endDate) return null;

    const startDays = Math.floor(
      (row.startDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)
    );
    const endDays = Math.floor(
      (row.endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)
    );

    const x = startDays * dayWidth;
    const width = (endDays - startDays) * dayWidth;

    return { x, width };
  }, [startDate, dayWidth]);

  // Handle row click
  const handleRowClick = useCallback((row: GanttRowData) => {
    if (row.type === 'goal') {
      onGoalEdit(row.id);
    } else {
      onHabitEdit(row.id);
    }
  }, [onGoalEdit, onHabitEdit]);

  // Handle bar hover
  const handleBarHover = useCallback((row: GanttRowData | null, event?: React.MouseEvent) => {
    if (row && event) {
      setTooltipData({
        row,
        x: event.clientX,
        y: event.clientY
      });
    } else {
      setTooltipData({ row: null, x: 0, y: 0 });
    }
  }, []);

  // Get row index for dependency positioning
  const getRowIndex = useCallback((rowId: string) => {
    return rows.findIndex(r => r.id === rowId);
  }, [rows]);

  return (
    <div className="flex flex-col h-full min-h-0 min-w-0 max-h-[calc(100vh-200px)] overflow-hidden">
      {/* Toolbar - Fixed position controls */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-border bg-muted/30 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            すべて展開
          </button>
          <button
            onClick={collapseAll}
            className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            すべて折りたたむ
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode controls - Fixed position */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => handleViewModeChange('day')}
              className={`
                px-1.5 py-0.5 text-[10px] font-medium rounded
                transition-colors
                focus-visible:outline-2 focus-visible:outline-primary
                ${viewMode === 'day'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }
              `}
              aria-pressed={viewMode === 'day'}
            >
              日
            </button>
            <button
              onClick={() => handleViewModeChange('week')}
              className={`
                px-1.5 py-0.5 text-[10px] font-medium rounded
                transition-colors
                focus-visible:outline-2 focus-visible:outline-primary
                ${viewMode === 'week'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }
              `}
              aria-pressed={viewMode === 'week'}
            >
              週
            </button>
            <button
              onClick={() => handleViewModeChange('month')}
              className={`
                px-1.5 py-0.5 text-[10px] font-medium rounded
                transition-colors
                focus-visible:outline-2 focus-visible:outline-primary
                ${viewMode === 'month'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }
              `}
              aria-pressed={viewMode === 'month'}
            >
              月
            </button>
          </div>

          <button
            onClick={scrollToToday}
            className="
              px-1.5 py-0.5 text-[10px] font-medium
              bg-primary/10 text-primary
              rounded hover:bg-primary/20
              transition-colors
              focus-visible:outline-2 focus-visible:outline-primary
            "
          >
            今日
          </button>

          <div className="w-px h-4 bg-border" />

          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={showLightningLine}
              onChange={(e) => setShowLightningLine(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-border"
            />
            稲妻線
          </label>
        </div>
      </div>

      {/* Header Row (Fixed) */}
      <div className="flex border-b border-border flex-shrink-0 min-w-0 overflow-hidden">
        {/* Task column header */}
        <div
          className="flex-shrink-0 border-r border-border bg-card flex items-center justify-center text-sm font-medium text-muted-foreground"
          style={{ width: rowNamesWidth, height: HEADER_HEIGHT }}
        >
          タスク
        </div>
        
        {/* Timeline header (horizontal scroll synced) */}
        <div
          ref={headerScrollRef}
          className="flex-1 overflow-hidden min-w-0"
        >
          <div style={{ minWidth: chartWidth, width: 'max-content' }}>
            <GanttTimelineHeader
              cells={cells}
              viewMode={viewMode}
              headerHeight={HEADER_HEIGHT}
              todayPosition={todayPosition}
              showControls={false}
            />
          </div>
        </div>
      </div>

      {/* Main Content - Synchronized scrolling */}
      <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden relative">
        {/* Row Names Panel (Vertical scroll synced, no scrollbar) */}
        <div
          ref={rowNamesRef}
          className="flex-shrink-0 border-r border-border bg-card overflow-hidden z-10"
          style={{ width: rowNamesWidth }}
        >
          {rows.map((row) => (
            <GanttRow
              key={row.id}
              row={row}
              rowHeight={ROW_HEIGHT}
              onToggleExpand={toggleExpand}
              onClick={() => handleRowClick(row)}
            />
          ))}
        </div>

        {/* Chart Area Container with Navigation Arrows */}
        <div className="flex-1 min-w-0 relative overflow-hidden">
          {/* Left Arrow */}
          <ScrollArrow
            direction="left"
            visible={canScrollLeft}
            onClick={() => scrollByAmount('left')}
          />

          {/* Right Arrow */}
          <ScrollArrow
            direction="right"
            visible={canScrollRight}
            onClick={() => scrollByAmount('right')}
          />

          {/* Chart Area (Both horizontal and vertical scroll with scrollbars) */}
          <div
            ref={mainScrollRef}
            className="absolute inset-0 overflow-auto overscroll-x-contain modern-scrollbar"
            style={{
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-x pan-y'
            }}
          >
          <div style={{ minWidth: chartWidth, width: 'max-content' }}>
            {/* Chart Body */}
            <svg
              width={chartWidth}
              height={rows.length * ROW_HEIGHT}
              className="block"
            >
              {/* Grid lines */}
              <g className="pointer-events-none">
                {/* Horizontal lines */}
                {rows.map((_, index) => (
                  <line
                    key={`h-${index}`}
                    x1={0}
                    y1={(index + 1) * ROW_HEIGHT}
                    x2={chartWidth}
                    y2={(index + 1) * ROW_HEIGHT}
                    stroke="#374151"
                    strokeWidth={1}
                    opacity={0.3}
                  />
                ))}
                
                {/* Vertical lines (cell boundaries) */}
                {cells.map((cell, index) => {
                  let x = 0;
                  for (let i = 0; i <= index; i++) {
                    x += cells[i].width;
                  }
                  return (
                    <line
                      key={`v-${index}`}
                      x1={x}
                      y1={0}
                      x2={x}
                      y2={rows.length * ROW_HEIGHT}
                      stroke="#374151"
                      strokeWidth={1}
                      opacity={0.2}
                    />
                  );
                })}
              </g>

              {/* Today line */}
              <line
                x1={todayPosition}
                y1={0}
                x2={todayPosition}
                y2={rows.length * ROW_HEIGHT}
                stroke="#ef4444"
                strokeWidth={2}
              />

              {/* Bars */}
              {rows.map((row, index) => {
                const pos = getBarPosition(row);
                if (!pos) return null;

                return (
                  <GanttBar
                    key={row.id}
                    x={pos.x}
                    width={pos.width}
                    y={index * ROW_HEIGHT + BAR_PADDING}
                    height={BAR_HEIGHT}
                    progress={row.progress}
                    isCompleted={row.isCompleted}
                    isGoal={row.type === 'goal'}
                    onMouseEnter={() => handleBarHover(row, undefined)}
                    onMouseLeave={() => handleBarHover(null)}
                  />
                );
              })}

              {/* Dependencies */}
              {dependencies.map((dep) => {
                const fromIndex = getRowIndex(dep.fromRowId);
                const toIndex = getRowIndex(dep.toRowId);
                if (fromIndex === -1 || toIndex === -1) return null;

                const fromRow = rows[fromIndex];
                const toRow = rows[toIndex];
                const fromPos = getBarPosition(fromRow);
                const toPos = getBarPosition(toRow);
                if (!fromPos || !toPos) return null;

                return (
                  <GanttDependency
                    key={dep.id}
                    fromX={fromPos.x + fromPos.width}
                    fromY={fromIndex * ROW_HEIGHT + ROW_HEIGHT / 2}
                    toX={toPos.x}
                    toY={toIndex * ROW_HEIGHT + ROW_HEIGHT / 2}
                    isHighlighted={highlightedDependency === dep.id}
                    onMouseEnter={() => setHighlightedDependency(dep.id)}
                    onMouseLeave={() => setHighlightedDependency(null)}
                  />
                );
              })}

              {/* Lightning Line */}
              <GanttLightningLine
                points={lightningPoints}
                todayX={todayPosition}
                rowHeight={ROW_HEIGHT}
                headerHeight={0}
                visible={showLightningLine}
              />
            </svg>
          </div>
        </div>
        {/* End of Chart Area Container */}
        </div>
      </div>

      {/* Tooltip */}
      <GanttTooltip
        row={tooltipData.row}
        x={tooltipData.x}
        y={tooltipData.y}
        visible={tooltipData.row !== null}
      />
    </div>
  );
}
