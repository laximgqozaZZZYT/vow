'use client';

/**
 * DetailTab Component
 * 
 * 詳細タブ - Habitモーダルの4番目のタブ
 * 
 * Contains:
 * - Goal selector (Requirement 5.1)
 * - Tags selector using SmartSelector (Requirement 5.2)
 * - Related Habits section (Requirement 5.3)
 * - Add/remove habit relations functionality (Requirement 5.4)
 * - Support for Main, Sub, Next relation types (Requirement 5.5)
 * 
 * All inputs have minimum height of 44px for touch targets (Requirement 6.2)
 * 
 * @module DetailTab
 */

import React from 'react';
import SmartSelector, { SmartSelectorItem } from '../Widget.SmartSelector';
import type { Habit, HabitFormState } from './BasicTab';

// ============================================================================
// Types
// ============================================================================

export type RelationType = 'main' | 'sub' | 'next';

export interface HabitRelation {
  id: string;
  habitId: string;
  relatedHabitId: string;
  relation: RelationType;
  createdAt?: string;
  updatedAt?: string;
}

export interface Goal {
  id: string;
  name: string;
}

export interface Tag extends SmartSelectorItem {
  id: string;
  name: string;
  color?: string;
}

export interface DetailTabProps {
  /** Whether this tab panel is currently active/visible */
  isActive: boolean;
  /** Current form state */
  formState: HabitFormState;
  /** Callback to update a form field */
  onFieldChange: (field: string, value: any) => void;
  /** Available goals for selection */
  goals: Goal[];
  /** Available tags for selection */
  tags: Tag[];
  /** All habits for relation selection */
  allHabits: Habit[];
  /** Current habit relations */
  relations: HabitRelation[];
  /** Callback when a relation is added */
  onRelationAdd: (relation: Omit<HabitRelation, 'id' | 'createdAt' | 'updatedAt'>) => void;
  /** Callback when a relation is deleted */
  onRelationDelete: (id: string) => void;
  /** Callback when tags change */
  onTagsChange: (tagIds: string[]) => void;
  /** The habit being edited (null for new habits) */
  habit: Habit | null;
  /** Whether relations are loading */
  loadingRelations?: boolean;
  /** ID prefix for ARIA associations */
  idPrefix?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * DetailTab Component
 * 
 * The fourth tab in the Habit Modal containing:
 * - Goal selector dropdown
 * - Tags selector (SmartSelector)
 * - Related Habits section with add/remove functionality
 * - Support for Main, Sub, Next relation types
 */
export function DetailTab({
  isActive,
  formState,
  onFieldChange,
  goals,
  tags,
  allHabits,
  relations,
  onRelationAdd,
  onRelationDelete,
  onTagsChange,
  habit,
  loadingRelations = false,
  idPrefix = 'habit-modal',
}: DetailTabProps) {
  // Local state for relation selection
  const [selectedRelatedHabitId, setSelectedRelatedHabitId] = React.useState<string>('');
  const [selectedRelationType, setSelectedRelationType] = React.useState<RelationType>('main');
  const panelRef = React.useRef<HTMLDivElement>(null);

  // Focus management: focus the panel when it becomes active (Requirement 11.6)
  React.useEffect(() => {
    if (isActive && panelRef.current) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        panelRef.current?.focus({ preventScroll: true });
      });
    }
  }, [isActive]);

  // Handle adding a new relation
  const handleAddRelation = React.useCallback(() => {
    if (!selectedRelatedHabitId) return;
    
    onRelationAdd({
      habitId: habit?.id ?? '',
      relatedHabitId: selectedRelatedHabitId,
      relation: selectedRelationType,
    });
    
    // Reset selection
    setSelectedRelatedHabitId('');
  }, [habit?.id, selectedRelatedHabitId, selectedRelationType, onRelationAdd]);

  // Handle tag selection
  const handleTagSelect = React.useCallback((tagId: string) => {
    const newTagIds = [...formState.selectedTagIds, tagId];
    onTagsChange(newTagIds);
    onFieldChange('selectedTagIds', newTagIds);
  }, [formState.selectedTagIds, onTagsChange, onFieldChange]);

  // Handle tag deselection
  const handleTagDeselect = React.useCallback((tagId: string) => {
    const newTagIds = formState.selectedTagIds.filter(id => id !== tagId);
    onTagsChange(newTagIds);
    onFieldChange('selectedTagIds', newTagIds);
  }, [formState.selectedTagIds, onTagsChange, onFieldChange]);

  // Filter out habits that are already related or the current habit
  const availableHabitsForRelation = React.useMemo(() => {
    const relatedIds = new Set(relations.map(r => r.relatedHabitId));
    return allHabits.filter(h => 
      h.id !== habit?.id && !relatedIds.has(h.id)
    );
  }, [allHabits, habit?.id, relations]);

  const panelId = `${idPrefix}-tabpanel-detail`;
  const tabId = `${idPrefix}-tab-detail`;

  return (
    <div
      ref={panelRef}
      id={panelId}
      role="tabpanel"
      aria-labelledby={tabId}
      tabIndex={isActive ? 0 : -1}
      hidden={!isActive}
      className={`
        space-y-6 outline-none
        /* Smooth opacity transition for tab content switching (Requirement 12.4) */
        transition-opacity duration-200 ease-out
        /* Respect prefers-reduced-motion (Requirement 12.4) */
        motion-reduce:transition-none
        ${isActive ? 'opacity-100' : 'opacity-0 hidden'}
      `}
    >
      {/* Goal Selector - Requirement 5.1 */}
      <div>
        <label 
          htmlFor="habit-goal" 
          className="block text-base sm:text-lg font-medium mb-2 text-foreground"
        >
          Goal
        </label>
        <select
          id="habit-goal"
          value={formState.goalId ?? ''}
          onChange={(e) => onFieldChange('goalId', e.target.value || undefined)}
          className="
            w-full rounded-md border border-input bg-background 
            px-3 py-2 text-sm text-foreground
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
            disabled:cursor-not-allowed disabled:opacity-50
            min-h-[44px]
          "
        >
          <option value="">Select a goal...</option>
          {goals.map((goal) => (
            <option key={goal.id} value={goal.id}>
              {goal.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-sm text-muted-foreground">
          この習慣を関連付けるゴールを選択してください。
        </p>
      </div>

      {/* Tags Selector - Requirement 5.2 */}
      <div>
        <SmartSelector
          items={tags}
          selectedIds={formState.selectedTagIds}
          onSelect={handleTagSelect}
          onDeselect={handleTagDeselect}
          label="Tags"
          placeholder="タグを検索して追加..."
          emptyMessage="利用可能なタグがありません"
        />
        <p className="mt-1 text-sm text-muted-foreground">
          習慣を整理するためのタグを追加できます。
        </p>
      </div>

      {/* Related Habits Section - Requirements 5.3, 5.4, 5.5 */}
      <div>
        <h3 className="text-base sm:text-lg font-medium mb-2 text-foreground">
          Related Habits
        </h3>
        
        <div className="space-y-3">
          {/* Loading state */}
          {loadingRelations && (
            <div className="text-sm text-muted-foreground py-2">
              Loading...
            </div>
          )}

          {/* Empty state */}
          {!loadingRelations && relations.length === 0 && (
            <div className="text-sm text-muted-foreground py-2 px-3 rounded-md bg-muted/50 border border-border">
              関連する習慣がありません。下のフォームから追加できます。
            </div>
          )}

          {/* Relations list */}
          {relations.map((relation) => {
            const relatedHabit = allHabits.find(h => h.id === relation.relatedHabitId);
            const habitName = relatedHabit?.name ?? relation.relatedHabitId;
            
            return (
              <div
                key={relation.id}
                className="
                  flex items-center justify-between 
                  rounded-md px-3 py-2 
                  border border-border bg-card
                  min-h-[44px]
                "
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {habitName}
                  </span>
                  <span className={`
                    text-xs px-2 py-0.5 rounded-full
                    ${relation.relation === 'main' 
                      ? 'bg-primary/20 text-primary' 
                      : relation.relation === 'sub'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-green-500/20 text-green-400'
                    }
                  `}>
                    {relation.relation === 'main' ? 'Main' : 
                     relation.relation === 'sub' ? 'Sub' : 'Next'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onRelationDelete(relation.id)}
                  className="
                    p-2 text-destructive 
                    min-w-[44px] min-h-[44px] 
                    flex items-center justify-center
                    hover:bg-destructive/10 rounded transition-colors
                  "
                  aria-label={`Remove relation with ${habitName}`}
                  title="Delete relation"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M6 2a1 1 0 011-1h6a1 1 0 011 1v1h3a1 1 0 110 2h-1v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5H3a1 1 0 110-2h3V2zm2 5a1 1 0 10-2 0v7a1 1 0 102 0V7zm4 0a1 1 0 10-2 0v7a1 1 0 102 0V7z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            );
          })}

          {/* Add relation form - Responsive layout (Requirements 9.2, 9.4) */}
          {/* Mobile: single-column stacked layout (Requirement 9.2) */}
          {/* Desktop: multi-column row layout (Requirement 9.4) */}
          <div className="flex flex-col gap-2 md:flex-row md:items-center pt-2">
            {/* Habit selector */}
            <select
              value={selectedRelatedHabitId}
              onChange={(e) => setSelectedRelatedHabitId(e.target.value)}
              className="
                flex-1 rounded-md border border-input bg-background 
                px-3 py-2 text-sm text-foreground
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                disabled:cursor-not-allowed disabled:opacity-50
                min-h-[44px]
              "
              aria-label="Select habit to relate"
            >
              <option value="">習慣を選択...</option>
              {availableHabitsForRelation.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>

            {/* Relation type selector - Requirement 5.5, 9.2, 9.4 */}
            <select
              value={selectedRelationType}
              onChange={(e) => setSelectedRelationType(e.target.value as RelationType)}
              className="
                w-full md:w-28 rounded-md border border-input bg-background 
                px-3 py-2 text-sm text-foreground
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                disabled:cursor-not-allowed disabled:opacity-50
                min-h-[44px]
              "
              aria-label="Select relation type"
            >
              <option value="main">Main</option>
              <option value="sub">Sub</option>
              <option value="next">Next</option>
            </select>

            {/* Add button */}
            <button
              type="button"
              onClick={handleAddRelation}
              disabled={!selectedRelatedHabitId || !habit}
              className="
                rounded-md bg-muted p-2 
                min-w-[44px] min-h-[44px] 
                flex items-center justify-center
                hover:bg-muted/80 transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
              "
              aria-label="Add relation"
              title="Add relation"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          {/* Help text for new habits */}
          {!habit && (
            <p className="text-xs text-muted-foreground">
              習慣を保存してから関連を追加できます。
            </p>
          )}

          {/* Relation type explanation */}
          <div className="mt-4 p-3 rounded-md bg-muted/30 border border-border">
            <h4 className="text-sm font-medium text-foreground mb-2">関連タイプの説明</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>
                <span className="font-medium text-primary">Main</span>: この習慣のメインとなる親習慣
              </li>
              <li>
                <span className="font-medium text-blue-400">Sub</span>: この習慣のサブタスクとなる子習慣
              </li>
              <li>
                <span className="font-medium text-green-400">Next</span>: この習慣の次に行う習慣
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DetailTab;
