"use client";

/**
 * HabitCard Component for Kanban Board
 * 
 * Displays a habit card with:
 * - Habit name (prominently displayed)
 * - Scheduled time (if available)
 * - Progress information (count/must) for habits with targets
 * - Workload information (workloadPerCount, workloadUnit) if configured
 * - Elapsed time display (for in_progress status)
 * - Complete button with amount input
 * - Drag handle for drag-and-drop
 * 
 * @module Board.HabitCard
 * 
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 5.5
 */

import { useState, useEffect, useCallback } from 'react';
import type { Habit, Activity } from '../types';
import type { HabitStatus } from '../utils/habitStatusUtils';
import { formatTime24 } from '../../../lib/format';
import { useHandedness } from '../contexts/HandednessContext';
import './HabitNameScroll.css';

export interface HabitCardProps {
  habit: Habit;
  activities: Activity[];
  status: HabitStatus;
  onComplete: (amount?: number) => void;
  onEdit: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  isDragging: boolean;
}

/**
 * Calculate elapsed time since the start activity
 * 
 * @param activities - Today's activities for this habit
 * @returns Elapsed time in seconds, or null if no start activity
 */
function getElapsedSeconds(activities: Activity[]): number | null {
  // Find the most recent start activity
  const startActivities = activities
    .filter(a => a.kind === 'start')
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  if (startActivities.length === 0) {
    return null;
  }
  
  const startTime = new Date(startActivities[0].timestamp).getTime();
  const now = Date.now();
  return Math.floor((now - startTime) / 1000);
}

/**
 * Format elapsed time as HH:MM:SS or MM:SS
 * 
 * @param seconds - Elapsed time in seconds
 * @returns Formatted time string
 */
function formatElapsedTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Get the scheduled time for display
 * 
 * @param habit - The habit to get time from
 * @returns Formatted time string or null
 */
function getScheduledTime(habit: Habit): string | null {
  // Check timings first
  const timings = habit.timings ?? [];
  if (timings.length > 0 && timings[0].start) {
    return timings[0].start;
  }
  
  // Fallback to habit.time
  if (habit.time) {
    return habit.time;
  }
  
  return null;
}

/**
 * HabitCard component for Kanban board
 * 
 * Displays habit information in a compact card format suitable for
 * Kanban columns. Supports drag-and-drop and touch interactions.
 */
export default function HabitCard({
  habit,
  activities,
  status,
  onComplete,
  onEdit,
  onDragStart,
  onDragEnd,
  isDragging
}: HabitCardProps) {
  const [inputValue, setInputValue] = useState<string>(
    String(habit.workloadPerCount ?? 1)
  );
  const [elapsedSeconds, setElapsedSeconds] = useState<number | null>(null);
  const { isLeftHanded } = useHandedness();
  
  // Filter activities for today
  const today = new Date().toISOString().slice(0, 10);
  const todayActivities = activities.filter(
    a => a.habitId === habit.id && a.timestamp.slice(0, 10) === today
  );
  
  // Update elapsed time every second for in_progress habits
  useEffect(() => {
    if (status !== 'in_progress') {
      setElapsedSeconds(null);
      return;
    }
    
    // Initial calculation
    setElapsedSeconds(getElapsedSeconds(todayActivities));
    
    // Update every second
    const interval = setInterval(() => {
      setElapsedSeconds(getElapsedSeconds(todayActivities));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [status, todayActivities]);
  
  const handleComplete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const amount = parseFloat(inputValue) || 1;
    onComplete(amount);
  }, [inputValue, onComplete]);
  
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);
  
  const handleInputClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);
  
  const handleEditClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit();
  }, [onEdit]);
  
  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', habit.id);
    onDragStart();
  }, [habit.id, onDragStart]);
  
  const handleDragEnd = useCallback(() => {
    onDragEnd();
  }, [onDragEnd]);
  
  const scheduledTime = getScheduledTime(habit);
  const hasProgress = habit.must > 0;
  const hasWorkload = habit.workloadUnit && habit.workloadPerCount;
  
  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`
        p-3 
        bg-card 
        border border-border 
        rounded-lg 
        shadow-sm
        cursor-grab
        active:cursor-grabbing
        transition-all
        duration-200
        ${isDragging ? 'opacity-50 scale-95 shadow-lg ring-2 ring-primary' : 'hover:shadow-md'}
        ${isLeftHanded ? 'text-right' : 'text-left'}
      `}
      style={{ 
        // Allow vertical pan (scroll) but prevent horizontal pan during drag
        // This enables normal vertical scrolling while allowing long-press drag
        touchAction: 'pan-y'
      }}
    >
      {/* Header: Habit name and time */}
      <div className={`flex items-start gap-2 mb-2 ${isLeftHanded ? 'flex-row-reverse' : ''}`}>
        {/* Drag handle indicator */}
        <div className="flex-shrink-0 w-1 h-6 bg-muted rounded-full opacity-50" />
        
        <div className="flex-1 min-w-0">
          {/* Habit name - Requirement 3.1 */}
          <div className="habit-name-scroll min-w-0 overflow-hidden">
            <button
              onClick={handleEditClick}
              className={`
                habit-name-text 
                inline-block 
                whitespace-nowrap 
                text-sm 
                font-medium
                hover:text-primary 
                transition-colors 
                cursor-pointer
                min-h-[44px]
                min-w-[44px]
                flex
                items-center
                ${habit.completed ? 'line-through text-muted-foreground' : 'text-foreground'}
              `}
            >
              {habit.name}
            </button>
          </div>
          
          {/* Scheduled time - Requirement 3.2 */}
          {scheduledTime && (
            <div className="text-xs text-muted-foreground mt-0.5">
              🕐 {scheduledTime}
            </div>
          )}
        </div>
      </div>
      
      {/* Progress and workload info */}
      <div className={`flex flex-wrap gap-2 text-xs text-muted-foreground mb-2 ${isLeftHanded ? 'justify-end' : 'justify-start'}`}>
        {/* Progress info - Requirement 3.3 */}
        {hasProgress && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-muted rounded">
            📊 {habit.count}/{habit.must}
          </span>
        )}
        
        {/* Workload info - Requirement 3.4 */}
        {hasWorkload && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-muted rounded">
            ⚡ {habit.workloadPerCount} {habit.workloadUnit}
          </span>
        )}
        
        {/* Elapsed time for in_progress - Requirement 3.5 */}
        {status === 'in_progress' && elapsedSeconds !== null && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-primary/10 text-primary rounded font-mono">
            ⏱️ {formatElapsedTime(elapsedSeconds)}
          </span>
        )}
      </div>
      
      {/* Progress bar - Daily Progress visualization */}
      {hasProgress && (
        <div className="mb-2">
          <div className="w-full bg-muted rounded-full h-1.5">
            <div 
              className={`h-1.5 rounded-full transition-all duration-300 ${
                habit.count >= habit.must 
                  ? 'bg-green-500' 
                  : (habit.count / habit.must) >= 0.75 
                    ? 'bg-blue-500' 
                    : (habit.count / habit.must) >= 0.5 
                      ? 'bg-yellow-500' 
                      : 'bg-red-400'
              }`}
              style={{ width: `${Math.min((habit.count / habit.must) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}
      
      {/* Complete button and amount input - Requirement 3.6 */}
      <div className={`flex items-center gap-2 ${isLeftHanded ? 'flex-row-reverse' : ''}`}>
        <button
          title="Complete"
          onClick={handleComplete}
          className="
            bg-green-600 
            hover:bg-green-700 
            active:bg-green-800 
            text-white 
            rounded 
            px-3 
            py-1.5 
            text-xs 
            font-medium 
            transition-colors
            min-w-[44px]
            min-h-[44px]
            flex
            items-center
            justify-center
            focus-visible:outline-2 
            focus-visible:outline-primary
          "
        >
          ✓
        </button>
        
        {hasWorkload && (
          <>
            <input
              type="number"
              min="0"
              step="0.1"
              value={inputValue}
              onChange={handleInputChange}
              onClick={handleInputClick}
              className="
                w-14 
                text-xs 
                text-center 
                bg-input 
                border-0 
                rounded 
                px-2 
                py-1.5
                min-h-[44px]
                focus:ring-1 
                focus:ring-primary 
                outline-none 
                [appearance:textfield] 
                [&::-webkit-outer-spin-button]:appearance-none 
                [&::-webkit-inner-spin-button]:appearance-none
              "
            />
            <span className="text-xs text-muted-foreground truncate max-w-[60px]" title={habit.workloadUnit}>
              {habit.workloadUnit}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
