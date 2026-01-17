"use client"

import React, { useState } from 'react'
import { UnifiedRelationMap } from './Widget.UnifiedRelationMap'
import { EditableMindmap } from './Widget.EditableMindmap'
import DashboardShell from './Dashboard.Shell'
import type { Goal, Habit } from '../types'

interface MindmapSectionProps {
  goals: Goal[];
  habits: Habit[];
  onRegisterAsHabit?: (data: any) => Promise<any>;
  onRegisterAsGoal?: (data: any) => Promise<any>;
}

export default function MindmapSection({ goals, habits, onRegisterAsHabit, onRegisterAsGoal }: MindmapSectionProps) {
  const [showEditableMode, setShowEditableMode] = useState(false);

  if (showEditableMode) {
    return (
      <EditableMindmap
        habits={habits}
        goals={goals}
        onClose={() => setShowEditableMode(false)}
        onRegisterAsHabit={onRegisterAsHabit || (async () => {})}
        onRegisterAsGoal={onRegisterAsGoal || (async () => {})}
      />
    );
  }

  return (
    <DashboardShell nav={null}>
      <section className="rounded-lg border border-border bg-card text-card-foreground shadow-sm p-4 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Mind Map</h2>
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
      </section>
    </DashboardShell>
  );
}
