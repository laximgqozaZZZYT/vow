import { useState } from 'react';
import GoalTree from './Widget.GoalTree';
import TagView from './Widget.TagView';
import type { DashboardSidebarProps, Goal, Habit, Activity } from '../types';
import { useHandedness } from '../contexts/HandednessContext';

type ViewMode = 'folder' | 'tag';

interface DashboardSidebarExtendedProps extends DashboardSidebarProps {
  goals: Goal[];
  habits: Habit[];
  activities: Activity[]; // 追加
  selectedGoal: string | null;
  onGoalSelect: (goalId: string | null) => void;
  onGoalEdit: (goalId: string) => void;
  onHabitEdit: (habitId: string) => void;
  onHabitAction: (habitId: string, action: 'start' | 'complete' | 'pause') => void;
  onMoveGoal: (goalId: string, newParentId: string | null) => void;
  onMoveHabit: (habitId: string, newGoalId: string) => void;
  onNewMindmap: () => void;
  onManageTags: () => void;
  mindmaps?: any[];
  selectedMindmap?: any;
  onMindmapSelect?: (mindmap: any) => void;
  onMindmapDelete?: (mindmapId: string) => void;
}

export default function DashboardSidebar({ 
  isVisible, 
  onClose, 
  onNewGoal, 
  onNewHabit,
  goals,
  habits,
  activities, // 追加
  selectedGoal,
  onGoalSelect,
  onGoalEdit,
  onHabitEdit,
  onHabitAction,
  onMoveGoal,
  onMoveHabit,
  onNewMindmap,
  onManageTags,
  mindmaps = [],
  selectedMindmap,
  onMindmapSelect,
  onMindmapDelete
}: DashboardSidebarExtendedProps) {
  const { isLeftHanded, handedness, setHandedness } = useHandedness();
  const [viewMode, setViewMode] = useState<ViewMode>('folder');
  
  if (!isVisible) return null;

  const sidePosition = isLeftHanded ? 'right-0' : 'left-0';
  const borderSide = isLeftHanded ? 'border-l' : 'border-r';

  return (
    <>
      {/* Mobile overlay */}
      <div 
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 lg:hidden"
        onClick={onClose}
      />
      
      <aside className={`fixed ${sidePosition} top-14 w-80 max-w-[85vw] h-[calc(100vh-3.5rem)] ${borderSide} border-border bg-card z-40 lg:w-80 flex flex-col`}>
        <div className="flex-shrink-0 p-3">
          <div className="mb-3 flex items-center justify-between">
            <div className={`flex items-center gap-2 ${isLeftHanded ? 'flex-row-reverse' : ''}`}>
              <button onClick={onClose} className="inline-flex items-center justify-center text-sm text-muted-foreground transition-colors hover:text-foreground lg:hidden min-w-[44px] min-h-[44px]">✕</button>
            </div>
          </div>

          {/* View Mode Toggle - Linear/shadcn style */}
          <div className="mb-4">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 block">
              View Mode
            </label>
            <div className="inline-flex items-center rounded-lg border border-border bg-muted/50 p-1 w-full">
              <button
                onClick={() => setViewMode('folder')}
                className={`flex-1 inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                  viewMode === 'folder'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <span>Folder</span>
              </button>
              <button
                onClick={() => setViewMode('tag')}
                className={`flex-1 inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                  viewMode === 'tag'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <span>Tag</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-3">
          {viewMode === 'folder' ? (
            <GoalTree
              goals={goals}
              habits={habits}
              activities={activities}
              selectedGoal={selectedGoal}
              onGoalSelect={onGoalSelect}
              onGoalEdit={onGoalEdit}
              onHabitEdit={onHabitEdit}
              onHabitAction={onHabitAction}
              onMoveGoal={onMoveGoal}
              onMoveHabit={onMoveHabit}
            />
          ) : (
            <TagView
              habits={habits}
              activities={activities}
              onHabitEdit={onHabitEdit}
              onHabitAction={onHabitAction}
            />
          )}

          {/* Mindmaps Section */}
          {mindmaps.length > 0 && (
            <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                🧠 Saved Mindmaps
              </h3>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {mindmaps.map((mindmap) => (
                  <div
                    key={mindmap.id}
                    className={`group flex items-center justify-between p-2 rounded text-sm cursor-pointer transition-colors ${
                      selectedMindmap?.id === mindmap.id
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <div
                      className="flex-1 truncate"
                      onClick={() => onMindmapSelect?.(mindmap)}
                      title={mindmap.name}
                    >
                      {mindmap.name}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete mindmap "${mindmap.name}"?`)) {
                          onMindmapDelete?.(mindmap.id);
                        }
                      }}
                      className="ml-2 inline-flex items-center justify-center text-destructive hover:text-destructive/80 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                      title="Delete mindmap"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 flex flex-col gap-2 p-3 pt-4 border-t border-border">
          <button
            className={`inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isLeftHanded ? 'text-left' : ''}`}
            onClick={onNewGoal}
          >
            + New Goal
          </button>
          <button
            className={`inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isLeftHanded ? 'text-left' : ''}`}
            onClick={() => {
              const today = new Date().toISOString().slice(0, 10);
              onNewHabit({ date: today });
            }}
          >
            + New Habit
          </button>
          <button
            className={`inline-flex items-center justify-center rounded-md bg-success text-success-foreground px-3 py-2 text-sm font-medium transition-colors hover:bg-success/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success ${isLeftHanded ? 'text-left' : ''}`}
            onClick={onNewMindmap}
          >
            + New Map
          </button>
          <button
            className={`inline-flex items-center justify-center rounded-md bg-secondary text-secondary-foreground px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary ${isLeftHanded ? 'text-left' : ''}`}
            onClick={onManageTags}
          >
            Manage Tags
          </button>
        </div>
      </aside>
    </>
  );
}