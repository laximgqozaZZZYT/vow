"use client";

import React, { useMemo, useState } from 'react';
import type { Habit, Activity } from '../types';

interface HeatmapWidgetProps {
  habits: Habit[];
  activities: Activity[];
  visibleHabitIds?: string[];
  range?: 'week' | 'month' | 'year';
  onHover?: (data: HeatmapCellData | null) => void;
}

interface HeatmapCellData {
  date: string;
  value: number;
  activities: Activity[];
  level: number; // 0-4 intensity level
}

interface HeatmapData {
  cells: HeatmapCellData[];
  maxValue: number;
  dateRange: { start: Date; end: Date };
}

function getDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getWeekStart(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  const diff = result.getDate() - day;
  result.setDate(diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getYearStart(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

function generateHeatmapData(
  habits: Habit[],
  activities: Activity[],
  visibleHabitIds: string[],
  range: 'week' | 'month' | 'year'
): HeatmapData {
  const now = new Date();
  const visibleHabitSet = new Set(visibleHabitIds);
  
  // Filter activities for visible habits
  const filteredActivities = activities.filter(
    activity => visibleHabitSet.has(activity.habitId) && 
    (activity.kind === 'complete' || activity.kind === 'pause')
  );

  // Determine date range
  let startDate: Date;
  let endDate: Date = new Date(now);
  
  switch (range) {
    case 'week':
      startDate = getWeekStart(addDays(now, -6 * 7)); // 7 weeks
      break;
    case 'month':
      startDate = getMonthStart(addDays(now, -11 * 30)); // 12 months
      break;
    case 'year':
      startDate = getYearStart(addDays(now, -2 * 365)); // 3 years
      break;
    default:
      startDate = getWeekStart(addDays(now, -6 * 7));
  }

  // Group activities by date
  const activityMap = new Map<string, Activity[]>();
  filteredActivities.forEach(activity => {
    const date = getDateString(new Date(activity.timestamp));
    if (!activityMap.has(date)) {
      activityMap.set(date, []);
    }
    activityMap.get(date)!.push(activity);
  });

  // Generate cells
  const cells: HeatmapCellData[] = [];
  let maxValue = 0;
  
  for (let date = new Date(startDate); date <= endDate; date = addDays(date, 1)) {
    const dateStr = getDateString(date);
    const dayActivities = activityMap.get(dateStr) || [];
    
    // Calculate value based on activity count and amounts
    const value = dayActivities.reduce((sum, activity) => {
      const amount = typeof activity.amount === 'number' ? activity.amount : 1;
      return sum + amount;
    }, 0);
    
    maxValue = Math.max(maxValue, value);
    
    // Determine intensity level (0-4)
    const level = value === 0 ? 0 : Math.min(4, Math.ceil((value / Math.max(1, maxValue)) * 4));
    
    cells.push({
      date: dateStr,
      value,
      activities: dayActivities,
      level
    });
  }

  // Recalculate levels with final maxValue
  cells.forEach(cell => {
    cell.level = cell.value === 0 ? 0 : Math.min(4, Math.ceil((cell.value / Math.max(1, maxValue)) * 4));
  });

  return {
    cells,
    maxValue,
    dateRange: { start: startDate, end: endDate }
  };
}

function HeatmapGrid({ 
  data, 
  range, 
  onHover 
}: { 
  data: HeatmapData; 
  range: 'week' | 'month' | 'year';
  onHover?: (data: HeatmapCellData | null) => void;
}) {
  const { cells } = data;
  
  // Color scheme for intensity levels
  const getColor = (level: number): string => {
    const colors = [
      'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700', // level 0
      'bg-green-200 dark:bg-green-900 border-green-300 dark:border-green-800', // level 1
      'bg-green-300 dark:bg-green-700 border-green-400 dark:border-green-600', // level 2
      'bg-green-400 dark:bg-green-600 border-green-500 dark:border-green-500', // level 3
      'bg-green-500 dark:bg-green-500 border-green-600 dark:border-green-400', // level 4
    ];
    return colors[level] || colors[0];
  };

  // Grid layout based on range
  const getGridLayout = () => {
    switch (range) {
      case 'week':
        return {
          cols: 7,
          cellSize: 'w-8 h-8 sm:w-10 sm:h-10',
          gap: 'gap-1'
        };
      case 'month':
        return {
          cols: Math.ceil(cells.length / 7),
          cellSize: 'w-3 h-3 sm:w-4 sm:h-4',
          gap: 'gap-0.5'
        };
      case 'year':
        return {
          cols: 53, // weeks in a year
          cellSize: 'w-2 h-2 sm:w-3 sm:h-3',
          gap: 'gap-0.5'
        };
      default:
        return {
          cols: 7,
          cellSize: 'w-8 h-8',
          gap: 'gap-1'
        };
    }
  };

  const layout = getGridLayout();

  // Add month labels for year view
  const getMonthLabels = () => {
    if (range !== 'year') return null;
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const labels = [];
    const currentYear = new Date().getFullYear();
    
    for (let i = 0; i < 12; i++) {
      labels.push(
        <div key={i} className="text-xs text-gray-500 dark:text-gray-400 text-center">
          {months[i]}
        </div>
      );
    }
    
    return (
      <div className="grid grid-cols-12 gap-1 mb-2 text-center">
        {labels}
      </div>
    );
  };

  // Add weekday labels
  const getWeekdayLabels = () => {
    if (range === 'year') return null;
    
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return (
      <div className="grid grid-cols-7 gap-1 mb-2 text-center">
        {weekdays.map(day => (
          <div key={day} className="text-xs text-gray-500 dark:text-gray-400">
            {day}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="w-full overflow-x-auto">
      {getMonthLabels()}
      {getWeekdayLabels()}
      <div className={`grid ${layout.gap} justify-center`} 
           style={{ gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))` }}>
        {cells.map((cell, index) => (
          <div
            key={cell.date}
            className={`${layout.cellSize} ${getColor(cell.level)} border rounded-sm cursor-pointer transition-all hover:scale-110 hover:shadow-md hover:z-10 relative`}
            title={`${cell.date}: ${cell.value} activities`}
            onMouseEnter={() => onHover?.(cell)}
            onMouseLeave={() => onHover?.(null)}
          />
        ))}
      </div>
    </div>
  );
}

function HeatmapLegend() {
  return (
    <div className="flex items-center justify-center gap-2 text-xs text-gray-600 dark:text-gray-400">
      <span>Less</span>
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map(level => (
          <div
            key={level}
            className={`w-3 h-3 border rounded-sm ${
              level === 0 ? 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700' :
              level === 1 ? 'bg-green-200 dark:bg-green-900 border-green-300 dark:border-green-800' :
              level === 2 ? 'bg-green-300 dark:bg-green-700 border-green-400 dark:border-green-600' :
              level === 3 ? 'bg-green-400 dark:bg-green-600 border-green-500 dark:border-green-500' :
              'bg-green-500 dark:bg-green-500 border-green-600 dark:border-green-400'
            }`}
          />
        ))}
      </div>
      <span>More</span>
    </div>
  );
}

export default function HeatmapWidget({ 
  habits, 
  activities, 
  visibleHabitIds = [], 
  range = 'month',
  onHover 
}: HeatmapWidgetProps) {
  const [selectedRange, setSelectedRange] = useState<'week' | 'month' | 'year'>(range);
  const [hoveredCell, setHoveredCell] = useState<HeatmapCellData | null>(null);

  const heatmapData = useMemo(() => {
    const habitIds = visibleHabitIds.length > 0 ? visibleHabitIds : habits.map(h => h.id);
    return generateHeatmapData(habits, activities, habitIds, selectedRange);
  }, [habits, activities, visibleHabitIds, selectedRange]);

  const handleHover = (cell: HeatmapCellData | null) => {
    setHoveredCell(cell);
    onHover?.(cell);
  };

  return (
    <div className="w-full">
      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Activity Heatmap
          </span>
        </div>
        
        <div className="flex gap-1">
          {(['week', 'month', 'year'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setSelectedRange(r)}
              className={`px-3 py-1 text-xs rounded border transition-colors ${
                selectedRange === r
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="mb-4">
        <HeatmapGrid 
          data={heatmapData} 
          range={selectedRange} 
          onHover={handleHover}
        />
      </div>

      {/* Legend */}
      <div className="mb-4 flex justify-center">
        <HeatmapLegend />
      </div>

      {/* Hover Info */}
      {hoveredCell && (
        <div className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">{hoveredCell.date}</span>
            <span className="text-gray-500 dark:text-gray-400">
              {hoveredCell.value} activities
            </span>
          </div>
          
          {hoveredCell.activities.length > 0 && (
            <div className="space-y-1">
              {hoveredCell.activities.slice(0, 5).map((activity, index) => {
                const habit = habits.find(h => h.id === activity.habitId);
                return (
                  <div key={index} className="flex items-center justify-between text-xs">
                    <span className="truncate">{habit?.name || 'Unknown Habit'}</span>
                    <span className="text-gray-500 dark:text-gray-400 ml-2">
                      {activity.kind === 'complete' ? '✓' : '⏸'}
                      {typeof activity.amount === 'number' ? ` (${activity.amount})` : ''}
                    </span>
                  </div>
                );
              })}
              {hoveredCell.activities.length > 5 && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  +{hoveredCell.activities.length - 5} more...
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Summary Stats */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div className="rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2">
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {heatmapData.cells.filter(c => c.value > 0).length}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Active Days</div>
        </div>
        
        <div className="rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2">
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {heatmapData.cells.reduce((sum, c) => sum + c.value, 0)}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Total Activities</div>
        </div>
        
        <div className="rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2">
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {heatmapData.maxValue}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Best Day</div>
        </div>
        
        <div className="rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2">
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {Math.round((heatmapData.cells.filter(c => c.value > 0).length / heatmapData.cells.length) * 100)}%
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Consistency</div>
        </div>
      </div>
    </div>
  );
}