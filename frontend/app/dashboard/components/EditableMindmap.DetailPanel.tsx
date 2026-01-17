/**
 * EditableMindmap Detail Panel Component
 * 
 * Bottom panel for viewing and editing selected node details.
 */

import React, { memo } from 'react';
import { Node } from 'reactflow';
import { HabitForm } from './Form.Habit';
import { GoalForm } from './Form.Goal';
import type { Goal } from '../types';
import type { GoalNodeData, HabitNodeData } from './EditableMindmap.Nodes';

/** Props for DetailPanel component */
interface DetailPanelProps {
  /** Currently selected node */
  selectedNode: Node | null;
  /** Whether in editing mode */
  isEditing: boolean;
  /** View mode for forms */
  detailViewMode: 'normal' | 'detail';
  /** All goals for form dropdowns */
  goals: Goal[];
  /** All tags for form dropdowns */
  tags: any[];
  /** Callback to close panel */
  onClose: () => void;
  /** Callback to enter edit mode */
  onEdit: () => void;
  /** Callback to delete node */
  onDelete: () => void;
  /** Callback to save habit changes */
  onHabitSave: (data: any) => void;
  /** Callback to save goal changes */
  onGoalSave: (data: any) => void;
  /** Callback to change view mode */
  onViewModeChange: (mode: 'normal' | 'detail') => void;
}

/**
 * Detail Panel Component
 * 
 * Shows selected node details with edit/delete actions.
 */
export const DetailPanel = memo(function DetailPanel({
  selectedNode,
  isEditing,
  detailViewMode,
  goals,
  tags,
  onClose,
  onEdit,
  onDelete,
  onHabitSave,
  onGoalSave,
  onViewModeChange,
}: DetailPanelProps) {
  if (!selectedNode) return null;

  const isGoalNode = selectedNode.type === 'goalNode';
  const nodeName = isGoalNode
    ? (selectedNode.data as GoalNodeData).goal.name
    : (selectedNode.data as HabitNodeData).habit.name;

  return (
    <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg max-h-[50vh] overflow-y-auto">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {nodeName}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            aria-label="Close panel"
          >
            ✕ Close
          </button>
        </div>

        {!isEditing ? (
          // Action buttons
          <div className="flex gap-3 justify-center">
            <button
              onClick={onEdit}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Edit
            </button>
            <button
              onClick={onDelete}
              className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Delete
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-slate-300 dark:bg-slate-600 text-slate-900 dark:text-white rounded hover:bg-slate-400 dark:hover:bg-slate-500 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          // Edit form
          <>
            {isGoalNode ? (
              <GoalForm
                goal={(selectedNode.data as GoalNodeData).goal}
                goals={goals}
                tags={tags}
                viewMode={detailViewMode}
                onViewModeChange={onViewModeChange}
                onSave={onGoalSave}
              />
            ) : (
              <HabitForm
                habit={(selectedNode.data as HabitNodeData).habit}
                goals={goals}
                tags={tags}
                viewMode={detailViewMode}
                onViewModeChange={onViewModeChange}
                onSave={onHabitSave}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
});
