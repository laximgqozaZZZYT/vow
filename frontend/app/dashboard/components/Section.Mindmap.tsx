"use client"

import React from 'react'
import { UnifiedRelationMap } from './Widget.UnifiedRelationMap'
// MindmapDesignWrapper removed to avoid duplicate legend rendering
import DashboardShell from './Dashboard.Shell'
import type { Goal, Habit } from '../types'

interface MindmapSectionProps {
  goals: Goal[];
  habits: Habit[];
  onRegisterAsHabit?: (data: any) => void;
  onRegisterAsGoal?: (data: any) => void;
}

export default function MindmapSection({ goals, habits, onRegisterAsHabit, onRegisterAsGoal }: MindmapSectionProps) {
  return (
    <DashboardShell nav={null}>
      <section className="rounded-lg border border-border bg-card text-card-foreground shadow-sm p-4 sm:p-6">
        <h2 className="mb-3 text-lg font-semibold">Mind Map</h2>

        {/* Legend moved to the UnifiedRelationMap header to avoid duplication */}

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
