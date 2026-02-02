"use client"

/**
 * Board Mindmap Layout Component
 *
 * Wrapper component that renders the Mindmap view within the Board section.
 * Reuses UnifiedRelationMap and EditableMindmap components from Section.Mindmap.
 */

import React, { useState } from 'react'
import { UnifiedRelationMap } from './Widget.UnifiedRelationMap'
import { EditableMindmapRefactored as EditableMindmap } from './Widget.EditableMindmap.Refactored'
import type { Goal, Habit } from '../types'

export interface MindmapLayoutProps {
  goals: Goal[];
  habits: Habit[];
  onRegisterAsHabit?: (data: any) => Promise<any>;
  onRegisterAsGoal?: (data: any) => Promise<any>;
  onDataChange?: () => void;
}

export default function MindmapLayout({
  goals,
  habits,
  onRegisterAsHabit,
  onRegisterAsGoal,
  onDataChange
}: MindmapLayoutProps) {
  const [showEditableMode, setShowEditableMode] = useState(false);

  const handleClose = () => {
    setShowEditableMode(false);
    if (onDataChange) {
      onDataChange();
    }
  };

  if (showEditableMode) {
    return (
      <EditableMindmap
        habits={habits}
        goals={goals}
        onClose={handleClose}
        onRegisterAsHabit={onRegisterAsHabit || (async () => {})}
        onRegisterAsGoal={onRegisterAsGoal || (async () => {})}
      />
    );
  }

  // Use the same structure as Section.Mindmap.tsx
  return (
    <div className="p-4 sm:p-6 pt-2 sm:pt-3">
      <div className="flex items-center justify-end mb-3">
        <button
          onClick={() => setShowEditableMode(true)}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Edit Mode
        </button>
      </div>

      <div className="h-[600px] sm:h-[700px] lg:h-[800px] -mx-4 sm:-mx-6 -mb-4 sm:-mb-6">
        <UnifiedRelationMap
          habits={habits}
          goals={goals}
          onClose={() => {}}
          embedded={true}
          onRegisterAsHabit={onRegisterAsHabit}
          onRegisterAsGoal={onRegisterAsGoal}
        />
      </div>
    </div>
  );
}
