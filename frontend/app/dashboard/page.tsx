"use client";

import { useState, useEffect } from "react";
import type { Metadata } from "next";
import ActivityModal from './components/Modal.Activity';
import api from '../../lib/api';
import { HabitModal } from "./components/Modal.Habit";
import { GoalModal } from "./components/Modal.Goal";
import WidgetMindmap from "./components/Widget.Mindmap";
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

import { useAuth } from './hooks/useAuth';
import { HandednessProvider, useHandedness } from './contexts/HandednessContext';

export default function DashboardPage() {
  const [showLeftPane, setShowLeftPane] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  
  // 認証状態を取得
  const { isAuthed, isGuest, migrationStatus } = useAuth();

  // Check for guest data migration on page load
  useEffect(() => {
    const checkMigration = async () => {
      // Only check if user is authenticated and not a guest
      if (isAuthed && !isGuest && migrationStatus === 'idle') {
        const { supabase } = await import('../../lib/supabaseClient');
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          const userId = session?.user?.id;
          
          if (userId) {
            const { GuestDataMigration } = await import('../../lib/guest-data-migration');
            if (GuestDataMigration.hasGuestData()) {
              console.log('[dashboard] Page load: Guest data detected, triggering migration');
              // Force a page reload to trigger migration
              window.location.reload();
            }
          }
        }
      }
    };
    
    // Delay the check to ensure auth state is stable
    const timeoutId = setTimeout(checkMigration, 2000);
    return () => clearTimeout(timeoutId);
  }, [isAuthed, isGuest, migrationStatus]);

  // Custom hooks for data and state management
  const { goals, setGoals, habits, setHabits, activities, setActivities, pageSections, setPageSections, isClient, isLoading, manualReset } = useDataManager();
  const [mindmaps, setMindmaps] = useState<any[]>([]);
  const [selectedMindmap, setSelectedMindmap] = useState<any>(null);
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

  // Mindmap state
  const [openMindmap, setOpenMindmap] = useState(false);

  // Load mindmaps on component mount
  useEffect(() => {
    const loadMindmaps = async () => {
      try {
        const mindmapList = await api.getMindmaps();
        setMindmaps(mindmapList);
      } catch (error) {
        console.error('Failed to load mindmaps:', error);
      }
    };

    if (isClient && !isLoading) {
      loadMindmaps();
    }
  }, [isClient, isLoading]);

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
  function handleHabitAction(habitId: string, action: 'start' | 'complete' | 'pause', amount?: number) {
    switch (action) {
      case 'start':
        handleStart(habitId);
        break;
      case 'complete':
        handleComplete(habitId, amount);
        break;
      case 'pause':
        handlePause(habitId);
        break;
    }
  }

  // ドラッグ&ドロップハンドラー
  async function handleMoveGoal(goalId: string, newParentId: string | null) {
    try {
      const updatedGoal = await api.updateGoal(goalId, { parentId: newParentId });
      setGoals(prev => prev.map(g => g.id === goalId ? updatedGoal : g));
      
      // 成功フィードバック（簡単な方法）
      console.log('Goal moved successfully');
    } catch (error) {
      console.error('Failed to move goal:', error);
      // エラーフィードバック - 実際のアプリではトーストやアラートを表示
    }
  }

  async function handleMoveHabit(habitId: string, newGoalId: string) {
    try {
      const updatedHabit = await api.updateHabit(habitId, { goalId: newGoalId });
      setHabits(prev => prev.map(h => h.id === habitId ? updatedHabit : h));
      
      // 成功フィードバック
      console.log('Habit moved successfully');
    } catch (error) {
      console.error('Failed to move habit:', error);
      // エラーフィードバック
    }
  }

  // Prevent hydration mismatch by not rendering until client-side
  if (!isClient) {
    return <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black text-black dark:text-zinc-50 p-4">
      <div className="text-base sm:text-lg">Loading...</div>
    </div>
  }

  // Show loading state during data migration
  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black text-black dark:text-zinc-50 p-4">
      <div className="text-base sm:text-lg">Loading your data...</div>
    </div>
  }

  return (
    <HandednessProvider>
      <DashboardLayout
        showLeftPane={showLeftPane}
        setShowLeftPane={setShowLeftPane}
        selectedGoal={selectedGoal}
        setSelectedGoal={setSelectedGoal}
        goals={goals}
        setGoals={setGoals}
        habits={habits}
        setHabits={setHabits}
        activities={activities}
        setActivities={setActivities}
        pageSections={pageSections}
        setPageSections={setPageSections}
        mindmaps={mindmaps}
        setMindmaps={setMindmaps}
        selectedMindmap={selectedMindmap}
        setSelectedMindmap={setSelectedMindmap}
        recurringRequest={recurringRequest}
        setRecurringRequest={setRecurringRequest}
        selectedHabitId={selectedHabitId}
        setSelectedHabitId={setSelectedHabitId}
        newHabitInitial={newHabitInitial}
        setNewHabitInitial={setNewHabitInitial}
        newHabitInitialType={newHabitInitialType}
        setNewHabitInitialType={setNewHabitInitialType}
        selectedHabit={selectedHabit}
        handleEventChange={handleEventChange}
        createHabit={createHabit}
        recurringConfirmation={recurringConfirmation}
        handleRecurringConfirmation={handleRecurringConfirmation}
        cancelRecurringConfirmation={cancelRecurringConfirmation}
        handleRecurringHabitRequest={handleRecurringHabitRequest}
        openNewCategory={openNewCategory}
        setOpenNewCategory={setOpenNewCategory}
        openNewHabit={openNewHabit}
        setOpenNewHabit={setOpenNewHabit}
        openHabitModal={openHabitModal}
        setOpenHabitModal={setOpenHabitModal}
        editLayoutOpen={editLayoutOpen}
        setEditLayoutOpen={setEditLayoutOpen}
        openGoalModal={openGoalModal}
        setOpenGoalModal={setOpenGoalModal}
        editingGoalId={editingGoalId}
        setEditingGoalId={setEditingGoalId}
        openMindmap={openMindmap}
        setOpenMindmap={setOpenMindmap}
        starts={starts}
        pausedLoads={pausedLoads}
        openActivityModal={openActivityModal}
        editingActivityId={editingActivityId}
        handleComplete={handleComplete}
        handleStart={handleStart}
        handlePause={handlePause}
        openEditActivity={openEditActivity}
        propagateActivityChanges={propagateActivityChanges}
        handleDeleteActivity={handleDeleteActivity}
        setEditingActivityId={setEditingActivityId}
        setOpenActivityModal={setOpenActivityModal}
        goalsById={goalsById}
        editingGoal={editingGoal}
        createGoal={createGoal}
        updateGoal={updateGoal}
        deleteGoal={deleteGoal}
        completeGoalCascade={completeGoalCascade}
        setGoalParent={setGoalParent}
        mergeGoals={mergeGoals}
        collectGoalSubtreeIds={collectGoalSubtreeIds}
        handleHabitAction={handleHabitAction}
        handleMoveGoal={handleMoveGoal}
        handleMoveHabit={handleMoveHabit}
      />
    </HandednessProvider>
  );
}

function DashboardLayout(props: any) {
  const { isLeftHanded } = useHandedness();
  const {
    showLeftPane,
    setShowLeftPane,
    selectedGoal,
    setSelectedGoal,
    goals,
    setGoals,
    habits,
    setHabits,
    activities,
    setActivities,
    pageSections,
    setPageSections,
    mindmaps,
    setMindmaps,
    selectedMindmap,
    setSelectedMindmap,
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
    handleRecurringHabitRequest,
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
    setEditingGoalId,
    openMindmap,
    setOpenMindmap,
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
    setOpenActivityModal,
    goalsById,
    editingGoal,
    createGoal,
    updateGoal,
    deleteGoal,
    completeGoalCascade,
    setGoalParent,
    mergeGoals,
    collectGoalSubtreeIds,
    handleHabitAction,
    handleMoveGoal,
    handleMoveHabit,
  } = props;

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
        onNewMindmap={() => {
          setSelectedMindmap(null);
          setOpenMindmap(true);
        }}
        mindmaps={mindmaps}
        selectedMindmap={selectedMindmap}
        onMindmapSelect={(mindmap) => {
          console.log('[Dashboard] Selected mindmap:', mindmap);
          setSelectedMindmap(mindmap);
          setOpenMindmap(true);
        }}
        onMindmapDelete={async (mindmapId) => {
          try {
            await api.deleteMindmap(mindmapId);
            setMindmaps(prev => prev.filter(m => m.id !== mindmapId));
            console.log('Mindmap deleted successfully');
          } catch (error) {
            console.error('Failed to delete mindmap:', error);
          }
        }}
        goals={goals}
        habits={habits}
        activities={activities}
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
        onMoveGoal={handleMoveGoal}
        onMoveHabit={handleMoveHabit}
      />

  {/* Main content pane */}
  <main className={`flex-1 pt-20 p-4 sm:p-6 lg:p-8 ${showLeftPane ? (isLeftHanded ? 'lg:mr-80' : 'lg:ml-80') : ''}`}>

        <div className="mt-6 grid grid-cols-1 gap-4 max-w-full overflow-hidden">
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
                habits={habits}
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

      {/* Mindmap Widget */}
      {openMindmap && (
        <WidgetMindmap
          onClose={() => {
            setOpenMindmap(false);
            setSelectedMindmap(null);
          }}
          goals={goals}
          mindmap={selectedMindmap}
          onSave={async (mindmapData) => {
            try {
              console.log('[Dashboard] Saving mindmap:', mindmapData);
              
              if (mindmapData.id) {
                // Update existing mindmap
                console.log('[Dashboard] Updating existing mindmap:', mindmapData.id);
                const updatedMindmap = await api.updateMindmap(mindmapData.id, {
                  name: mindmapData.name,
                  nodes: mindmapData.nodes,
                  edges: mindmapData.edges
                });
                setMindmaps(prev => prev.map(m => m.id === mindmapData.id ? updatedMindmap : m));
                console.log('[Dashboard] Mindmap updated successfully:', updatedMindmap);
              } else {
                // Create new mindmap
                console.log('[Dashboard] Creating new mindmap');
                const newMindmap = await api.createMindmap({
                  name: mindmapData.name,
                  nodes: mindmapData.nodes,
                  edges: mindmapData.edges
                });
                setMindmaps(prev => [...prev, newMindmap]);
                setSelectedMindmap(newMindmap);
                console.log('[Dashboard] Mindmap created successfully:', newMindmap);
              }
            } catch (error) {
              console.error('[Dashboard] Failed to save mindmap:', {
                message: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
                error: error
              });
              throw error;
            }
          }}
          onRegisterAsHabit={async (data: any) => {
            try {
              const newHabit = await api.createHabit({
                name: data.name || data,
                type: 'simple',
                must: 1,
                goalId: selectedGoal || undefined,
                description: data.description,
                category: data.category,
                priority: data.priority,
                frequency: data.frequency
              });
              setHabits(prev => [...prev, newHabit]);
              console.log('Habit created from mindmap:', newHabit);
            } catch (error) {
              console.error('Failed to create habit from mindmap:', error);
            }
          }}
          onRegisterAsGoal={async (data: any) => {
            try {
              const newGoal = await api.createGoal({
                name: data.name || data,
                parentId: selectedGoal || null,
                description: data.description,
                category: data.category,
                priority: data.priority,
                targetDate: data.targetDate
              });
              setGoals(prev => [...prev, newGoal]);
              console.log('Goal created from mindmap:', newGoal);
            } catch (error) {
              console.error('Failed to create goal from mindmap:', error);
            }
          }}
        />
      )}
    </div>
  );
}
