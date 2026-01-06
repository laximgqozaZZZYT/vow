"use client";

import { useState } from "react";
import ActivityModal from './components/Modal.Activity';
import api from '../../lib/api';
import { HabitModal } from "./components/Modal.Habit";
import { GoalModal } from "./components/Modal.Goal";
import EditLayoutModal from './components/Modal.LayoutEditor';
import RecurringHabitConfirmModal from './components/Modal.RecurringHabitConfirm';
import StaticsSection from './components/Section.Statistics';
import DiarySection from './components/Section.Diary';

// Extracted components
import DashboardHeader from './components/Layout.Header';
import DashboardSidebar from './components/Layout.Sidebar';
import NextSection from './components/Section.Next';
import ActivitySection from './components/Section.Activity';
import CalendarWidget from './components/Widget.Calendar';

// Hooks
import { useActivityManager } from './hooks/useActivityManager';
import { useGoalManager } from './hooks/useGoalManager';
import { useDataManager } from './hooks/useDataManager';
import { useEventHandlers } from './hooks/useEventHandlers';
import { useModalManager } from './hooks/useModalManager';

// Types
import type { CreateGoalPayload } from './types';

export default function DashboardPage() {
  const [showLeftPane, setShowLeftPane] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);

  // Custom hooks for data and state management
  const { goals, setGoals, habits, setHabits, activities, setActivities, pageSections, setPageSections, isClient } = useDataManager();
  const { 
    recurringRequest, 
    setRecurringRequest, 
    selectedHabitId, 
    setSelectedHabitId, 
    newHabitInitial, 
    setNewHabitInitial, 
    newHabitInitialType, 
    setNewHabitInitialType, 
    selectedHabit, 
    handleEventChange, 
    createHabit,
    recurringConfirmation,
    handleRecurringConfirmation,
    cancelRecurringConfirmation,
    handleRecurringHabitRequest
  } = useEventHandlers({ habits, setHabits, goals, activities, setActivities });
  
  const {
    openNewCategory,
    setOpenNewCategory,
    openNewHabit,
    setOpenNewHabit,
    openHabitModal,
    setOpenHabitModal,
    editLayoutOpen,
    setEditLayoutOpen,
    openGoalModal,
    setOpenGoalModal,
    editingGoalId,
    setEditingGoalId
  } = useModalManager();

  // Activity management hook
  const {
    starts,
    pausedLoads,
    openActivityModal,
    editingActivityId,
    handleComplete,
    handleStart,
    handlePause,
    openEditActivity,
    propagateActivityChanges,
    handleDeleteActivity,
    setEditingActivityId,
    setOpenActivityModal
  } = useActivityManager({
    habits,
    setHabits,
    activities,
    setActivities
  });

  // Goal management hook
  const {
    goalsById,
    editingGoal,
    createGoal,
    updateGoal,
    deleteGoal,
    completeGoalCascade,
    setGoalParent,
    mergeGoals,
    collectGoalSubtreeIds
  } = useGoalManager({
    goals,
    setGoals,
    habits,
    setHabits,
    selectedGoal,
    setSelectedGoal,
    editingGoalId,
    setEditingGoalId
  });

  // Unified habit action handler for extracted components
  function handleHabitAction(habitId: string, action: 'start' | 'complete' | 'pause') {
    switch (action) {
      case 'start':
        handleStart(habitId);
        break;
      case 'complete':
        handleComplete(habitId);
        break;
      case 'pause':
        handlePause(habitId);
        break;
    }
  }

  // Prevent hydration mismatch by not rendering until client-side
  if (!isClient) {
    return <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black text-black dark:text-zinc-50">
      <div className="text-lg">Loading...</div>
    </div>
  }

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-black text-black dark:text-zinc-50">
      <DashboardHeader
        onToggleSidebar={() => setShowLeftPane((s) => !s)}
        showSidebar={showLeftPane}
        onEditLayout={() => setEditLayoutOpen(true)}
      />

      <DashboardSidebar
        isVisible={showLeftPane}
        onClose={() => setShowLeftPane(false)}
        onNewGoal={() => setOpenNewCategory(true)}
        onNewHabit={(initial?: any) => {
          setNewHabitInitial(initial || { date: new Date().toISOString().slice(0, 10) });
          setOpenNewHabit(true);
        }}
        goals={goals}
        habits={habits}
        selectedGoal={selectedGoal}
        onGoalSelect={setSelectedGoal}
        onGoalEdit={(goalId) => {
          setEditingGoalId(goalId);
          setOpenGoalModal(true);
        }}
        onHabitEdit={(habitId) => {
          setSelectedHabitId(habitId);
          setOpenHabitModal(true);
        }}
        onHabitAction={handleHabitAction}
      />

  {/* Right pane */}
  <main className={`flex-1 pt-20 p-8 ${showLeftPane ? 'ml-80' : ''}`}>

        <div className="mt-6 grid grid-cols-1 gap-4">
          {pageSections.map(sec => (
            sec === 'next' ? (
              <NextSection 
                key="next" 
                habits={habits} 
                onHabitAction={handleHabitAction} 
              />
            ) : sec === 'activity' ? (
              <ActivitySection 
                key="activity" 
                activities={activities} 
                onEditActivity={openEditActivity} 
                onDeleteActivity={handleDeleteActivity} 
              />
            ) : sec === 'calendar' ? (
              <CalendarWidget
                key="calendar"
                habits={habits}
                goals={goals}
                onEventClick={(id: string) => { setSelectedHabitId(id); setOpenHabitModal(true); }}
                onSlotSelect={(isoDate: string, time?: string, endTime?: string) => {
                  const dateOnly = (isoDate || '').slice(0, 10);
                  setNewHabitInitial({ date: dateOnly, time, endTime });
                  setOpenNewHabit(true);
                }}
                onEventChange={(id: string, updated) => handleEventChange(id, updated)}
                onRecurringAttempt={(habitId: string, updated) => { setRecurringRequest({ habitId, start: updated.start, end: updated.end }); }}
                onRecurringHabitRequest={handleRecurringHabitRequest}
              />
            ) : sec === 'statics' ? (
              <StaticsSection key="statics" habits={habits as any} activities={activities as any} goals={goals as any} />
            ) : sec === 'diary' ? (
              <DiarySection key="diary" goals={goals as any} habits={habits as any} />
            ) : null
          ))}
        </div>
        
      </main>

      <GoalModal
        open={openNewCategory}
        onClose={() => setOpenNewCategory(false)}
        goal={null}
        onCreate={(payload: CreateGoalPayload) => createGoal(payload)}
        goals={goals}
      />

      <EditLayoutModal
        open={editLayoutOpen}
        onClose={() => setEditLayoutOpen(false)}
        sections={pageSections}
        onChange={async (s: any) => {
          setPageSections(s);
          try { await (api as any).setLayout?.(s); } catch (e) { console.error('Failed to persist layout', e); }
        }}
        onAdd={(id: any) => setPageSections(ps => ps.includes(id) ? ps : [...ps, id])}
        onDelete={(id: any) => setPageSections(ps => ps.filter(x => x !== id))}
      />

      <GoalModal
        open={openGoalModal}
        onClose={() => { setOpenGoalModal(false); setEditingGoalId(null); }}
        goal={editingGoal}
        onUpdate={(g) => updateGoal(g)}
        onDelete={(id) => deleteGoal(id)}
        onComplete={(id) => completeGoalCascade(id)}
        goals={goals}
      />

      <HabitModal
        key={selectedHabit?.id ?? 'none'}
        open={openHabitModal}
        onClose={() => { setOpenHabitModal(false); setSelectedHabitId(null); }}
        habit={selectedHabit as any}
        onUpdate={async (updated) => {
          try { 
            const u = await api.updateHabit(updated.id, updated); 
            setHabits((s) => s.map(h => h.id === updated.id ? u : h)); 
          } catch(e) { 
            console.error(e); 
          }
        }}
        onDelete={async (id) => { 
          try { 
            await api.deleteHabit(id); 
            setHabits((s) => s.filter(h => h.id !== id)); 
          } catch(e) { 
            console.error(e); 
          } 
        }}
        categories={goals}
      />

      <HabitModal
        open={openNewHabit}
        onClose={() => { setOpenNewHabit(false); setNewHabitInitial(null); setNewHabitInitialType(undefined); }}
        habit={null}
        initial={{ date: newHabitInitial?.date, time: newHabitInitial?.time, endTime: newHabitInitial?.endTime, type: newHabitInitialType }}
        onCreate={(payload) => {
          createHabit(payload as any);
        }}
        categories={goals}
      />

      <ActivityModal
        open={openActivityModal}
        onClose={() => { setOpenActivityModal(false); setEditingActivityId(null); }}
        initial={activities.find(a => a.id === editingActivityId) as any ?? null}
        onSave={(updated) => {
          propagateActivityChanges(updated as any);
          setOpenActivityModal(false);
          setEditingActivityId(null);
        }}
      />

      <RecurringHabitConfirmModal
        open={!!recurringConfirmation}
        habitName={recurringConfirmation?.habitName || ''}
        originalTime={recurringConfirmation?.originalTime || ''}
        newTime={recurringConfirmation?.newTime || ''}
        date={recurringConfirmation?.date || ''}
        onConfirm={handleRecurringConfirmation}
        onCancel={cancelRecurringConfirmation}
      />
    </div>
  );
}
