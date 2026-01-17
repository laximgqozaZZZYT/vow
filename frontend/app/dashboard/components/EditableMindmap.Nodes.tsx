/**
 * EditableMindmap Node Components
 * 
 * Custom node components for the EditableMindmap.
 * Includes EditableGoalNode and EditableHabitNode.
 */

import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { NodeProps, useReactFlow } from 'reactflow';
import { GoalNodeHandles, HabitNodeHandles } from './Mindmap.Handle';
import type { Goal, Habit } from '../types';

/** Check if device is mobile */
const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         (window.innerWidth <= 768);
};

/** Get progress bar color based on percentage */
const getProgressColor = (percentage: number): string => {
  if (percentage >= 100) return 'bg-green-500';
  if (percentage >= 75) return 'bg-blue-500';
  if (percentage >= 50) return 'bg-yellow-500';
  return 'bg-gray-400';
};

/** Node data for Goal nodes */
export interface GoalNodeData {
  goal: Goal;
  habitCount: number;
  completedHabitCount: number;
  isEditing?: boolean;
  label: string;
}

/** Node data for Habit nodes */
export interface HabitNodeData {
  habit: Habit;
  goal?: Goal;
  progressPercentage: number;
  isEditing?: boolean;
  label: string;
}

/**
 * Editable Goal Node Component
 * 
 * Displays a goal with progress indicator and inline editing.
 */
export const EditableGoalNode = memo(function EditableGoalNode({ 
  id, 
  data 
}: NodeProps<GoalNodeData>) {
  const { goal, habitCount, completedHabitCount, isEditing, label } = data;
  const [text, setText] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setNodes } = useReactFlow();
  const completionPercentage = habitCount > 0 ? (completedHabitCount / habitCount) * 100 : 0;
  const isMobile = isMobileDevice();

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSubmit = useCallback(() => {
    const newText = text.trim() || goal.name;
    setNodes((nds) =>
      nds.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, label: newText, isEditing: false } }
          : node
      )
    );
  }, [text, id, goal.name, setNodes]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      setText(label);
      setNodes((nds) =>
        nds.map((node) =>
          node.id === id
            ? { ...node, data: { ...node.data, isEditing: false } }
            : node
        )
      );
    }
  }, [handleSubmit, label, id, setNodes]);

  return (
    <div className="relative">
      <GoalNodeHandles isMobile={isMobile} />
      
      <div className="min-w-[220px] max-w-[280px] bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 rounded-lg shadow-xl border-2 border-purple-400 dark:border-purple-600 overflow-hidden">
        {/* Progress bar */}
        <div className="relative h-2 bg-purple-200 dark:bg-purple-900">
          <div 
            className={`absolute left-0 top-0 h-full ${getProgressColor(completionPercentage)} opacity-70 transition-all duration-300`}
            style={{ width: `${Math.min(completionPercentage, 100)}%` }}
          />
        </div>
        
        <div className="p-3">
          {/* Header with icon and label */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">🎯</span>
            {isEditing ? (
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleSubmit}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 text-sm font-bold bg-white dark:bg-slate-700 text-purple-900 dark:text-purple-100 border border-purple-400 rounded px-1"
              />
            ) : (
              <div className="text-sm font-bold text-purple-900 dark:text-purple-100 truncate">
                {label}
              </div>
            )}
          </div>
          
          {/* Goal details */}
          {goal.details && (
            <div className="text-xs text-purple-700 dark:text-purple-300 mb-2 line-clamp-2">
              {goal.details}
            </div>
          )}
          
          {/* Progress stats */}
          <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-purple-300 dark:border-purple-700">
            <span className="text-purple-600 dark:text-purple-300">
              {completedHabitCount} / {habitCount}
            </span>
            <span className="font-semibold text-purple-700 dark:text-purple-200">
              {completionPercentage.toFixed(0)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

/**
 * Editable Habit Node Component
 * 
 * Displays a habit with progress indicator and inline editing.
 */
export const EditableHabitNode = memo(function EditableHabitNode({ 
  id, 
  data 
}: NodeProps<HabitNodeData>) {
  const { habit, progressPercentage, isEditing, label } = data;
  const [text, setText] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setNodes } = useReactFlow();
  const isMobile = isMobileDevice();

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSubmit = useCallback(() => {
    const newText = text.trim() || habit.name;
    setNodes((nds) =>
      nds.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, label: newText, isEditing: false } }
          : node
      )
    );
  }, [text, id, habit.name, setNodes]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      setText(label);
      setNodes((nds) =>
        nds.map((node) =>
          node.id === id
            ? { ...node, data: { ...node.data, isEditing: false } }
            : node
        )
      );
    }
  }, [handleSubmit, label, id, setNodes]);

  return (
    <div className="relative">
      <HabitNodeHandles isMobile={isMobile} />
      
      <div className="min-w-[180px] max-w-[220px] bg-white dark:bg-slate-800 rounded-lg shadow-lg border-2 border-slate-300 dark:border-slate-600 overflow-hidden">
        {/* Progress bar */}
        <div className="relative h-2 bg-slate-200 dark:bg-slate-700">
          <div 
            className={`absolute left-0 top-0 h-full ${getProgressColor(progressPercentage)} opacity-60 transition-all duration-300`}
            style={{ width: `${Math.min(progressPercentage, 100)}%` }}
          />
        </div>
        
        <div className="p-2.5">
          {/* Label with editing */}
          {isEditing ? (
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSubmit}
              onClick={(e) => e.stopPropagation()}
              className="w-full text-xs font-semibold bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border border-blue-400 rounded px-1"
            />
          ) : (
            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 mb-1 truncate">
              {label}
            </div>
          )}
          
          {/* Progress stats */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-300">
              {habit.count || 0}/{(habit as any).workloadTotal || habit.must || '∞'}
            </span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {progressPercentage.toFixed(0)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

/** Node types for ReactFlow */
export const editableNodeTypes = {
  habitNode: EditableHabitNode,
  goalNode: EditableGoalNode,
};
