/**
 * Board Gantt Layout Component
 * 
 * Main container for the Gantt chart view in the Board section.
 * Integrates all Gantt sub-components and manages state.
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
const HEADER_HEIGHT = 48;
const ROW_NAMES_WIDTH_DESKTOP = 180;
const ROW_NAMES_WIDTH_MOBILE = 120;
const BAR_HEIGHT = 20;
const BAR_PADDING = (ROW_HEIGHT - BAR_HEIGHT) / 2;

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
  const [containerWidth, setContainerWidth] = useState(0);
  
  // Refs for scroll synchronization
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const rowNamesRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Track container width for minimum chart width
  useEffect(() => {
    const updateContainerWidth = () => {
      if (mainScrollRef.current) {
        setContainerWidth(mainScrollRef.current.clientWidth);
      }
    };
    updateContainerWidth();
    window.addEventListener('resize', updateContainerWidth);
    return () => window.removeEventListener('resize', updateContainerWidth);
  }, []);

  const rowNamesWidth = isMobile ? ROW_NAMES_WIDTH_MOBILE : ROW_NAMES_WIDTH_DESKTOP;

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

  // Use Gantt data hook
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
    habitRelations
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
    rows
  });

  // Sync scroll between all panels
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
    };
    
    mainScroll.addEventListener('scroll', handleMainScroll);
    return () => mainScroll.removeEventListener('scroll', handleMainScroll);
  }, []);

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
    <div className="flex flex-col h-full min-h-0 max-h-[calc(100vh-200px)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-border bg-muted/30">
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
      <div className="flex border-b border-border flex-shrink-0">
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
          className="flex-1 overflow-hidden"
        >
          <div style={{ width: Math.max(totalWidth, containerWidth), minWidth: '100%' }}>
            <GanttTimelineHeader
              cells={cells}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              headerHeight={HEADER_HEIGHT}
              todayPosition={todayPosition}
              onScrollToToday={scrollToToday}
            />
          </div>
        </div>
      </div>

      {/* Main Content - Synchronized scrolling */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Row Names Panel (Vertical scroll synced, no scrollbar) */}
        <div
          ref={rowNamesRef}
          className="flex-shrink-0 border-r border-border bg-card overflow-hidden"
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

        {/* Chart Area (Both horizontal and vertical scroll with scrollbars) */}
        <div
          ref={mainScrollRef}
          className="flex-1 overflow-auto touch-pan-x touch-pan-y"
          style={{
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <div style={{ width: Math.max(totalWidth, containerWidth), minWidth: '100%' }}>
            {/* Chart Body */}
            <svg
              width="100%"
              height={rows.length * ROW_HEIGHT}
              className="block"
              style={{ minWidth: totalWidth }}
            >
              {/* Grid lines */}
              <g className="pointer-events-none">
                {/* Horizontal lines */}
                {rows.map((_, index) => (
                  <line
                    key={`h-${index}`}
                    x1={0}
                    y1={(index + 1) * ROW_HEIGHT}
                    x2={totalWidth}
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
