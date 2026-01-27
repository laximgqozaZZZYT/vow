"use client";

import { useState, useEffect } from "react";
import type { Metadata } from "next";
import ActivityModal from './components/Modal.Activity';
import api from '../../lib/api';
import { debug } from '../../lib/debug';
import { HabitModal } from "./components/Modal.Habit";
import { GoalModal } from "./components/Modal.Goal";
import { StickyModal } from "./components/Modal.Sticky";
import EditLayoutModal from './components/Modal.LayoutEditor';
import RecurringHabitConfirmModal from './components/Modal.RecurringHabitConfirm';
import ManageTagsModal from './components/Modal.ManageTags';
import StaticsSection from './components/Section.Statistics';
import DiarySection from './components/Section.Diary';
import StickiesSection from './components/Section.Stickies';
import MindmapSection from './components/Section.Mindmap';
import NoticeSection from './components/Section.Notice';
import CoachSection from './components/Section.Coach';

// Extracted components
import DashboardHeader from './components/Layout.Header';
import DashboardSidebar from './components/Layout.Sidebar';
import BoardSection from './components/Section.Board';
import ActivitySection from './components/Section.Activity';
import CalendarWidget from './components/Widget.Calendar';

// Tab navigation components
import { TabNavigation } from './components/Layout.TabNavigation';
import { TabContent } from './components/Layout.TabContent';
import { useTabNavigation } from './hooks/useTabNavigation';
import { getVisibleTabs, getTabById, normalizeTabId } from './constants/tabConfig';

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
import { LocaleProvider } from '@/contexts/LocaleContext';

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
              debug.log('[dashboard] Page load: Guest data detected, triggering migration');
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
  const { goals, setGoals, habits, setHabits, activities, setActivities, pageSections, setPageSections, isClient, isLoading, loadData, manualReset } = useDataManager();
  const [stickies, setStickies] = useState<any[]>([]);
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

  // Sticky'n state
  const [openStickyModal, setOpenStickyModal] = useState(false);
  const [editingStickyId, setEditingStickyId] = useState<string | null>(null);

  // Tags state
  const [tags, setTags] = useState<any[]>([]);
  const [openManageTags, setOpenManageTags] = useState(false);

  // Load tags on component mount
  useEffect(() => {
    const loadTags = async () => {
      try {
        const tagList = await api.getTags();
        
        // If no tags exist, create preset tags
        if (tagList.length === 0) {
          debug.log('[Dashboard] No tags found, creating preset tags...');
          
          // Create 'Habit' tag
          await api.createTag({ name: 'Habit', color: '#3b82f6' });
          
          // Create 'Goal' tag
          await api.createTag({ name: 'Goal', color: '#10b981' });
          
          // Reload tags
          const updatedTagList = await api.getTags();
          setTags(updatedTagList);
          debug.log('[Dashboard] Preset tags created successfully');
        } else {
          setTags(tagList);
        }
      } catch (error) {
        console.error('Failed to load tags:', error);
      }
    };

    if (isClient && !isLoading) {
      loadTags();
    }
  }, [isClient, isLoading]);

  // Load stickies on component mount
  useEffect(() => {
    const loadStickies = async () => {
      try {
        const stickyList = await api.getStickies();
        setStickies(stickyList);
      } catch (error) {
        console.error('Failed to load stickies:', error);
      }
    };

    if (isClient && !isLoading) {
      loadStickies();
    }
  }, [isClient, isLoading]);

  // Sticky'n データ再読み込み関数
  const reloadStickies = async () => {
    try {
      const stickyList = await api.getStickies();
      setStickies(stickyList);
    } catch (error) {
      console.error('Failed to reload stickies:', error);
    }
  };

  // Activity management hook
  const {
    starts,
    pausedLoads,
    openActivityModal,
    editingActivityId,
    handleComplete,
    handleStart,
    handlePause,
    handleReset,
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
  function handleHabitAction(habitId: string, action: 'start' | 'complete' | 'pause' | 'reset', amount?: number) {
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
      case 'reset':
        handleReset(habitId);
        break;
    }
  }

  // ドラッグ&ドロップハンドラー
  async function handleMoveGoal(goalId: string, newParentId: string | null) {
    try {
      const updatedGoal = await api.updateGoal(goalId, { parentId: newParentId });
      setGoals((prev: any[]) => prev.map(g => g.id === goalId ? updatedGoal : g));
      
      // 成功フィードバック（簡単な方法）
      debug.log('Goal moved successfully');
    } catch (error) {
      console.error('Failed to move goal:', error);
      // エラーフィードバック - 実際のアプリではトーストやアラートを表示
    }
  }

  async function handleMoveHabit(habitId: string, newGoalId: string) {
    try {
      const updatedHabit = await api.updateHabit(habitId, { goalId: newGoalId });
      setHabits((prev: any[]) => prev.map(h => h.id === habitId ? updatedHabit : h));
      
      // 成功フィードバック
      debug.log('Habit moved successfully');
    } catch (error) {
      console.error('Failed to move habit:', error);
      // エラーフィードバック
    }
  }

  // タグ管理ハンドラー
  const refreshTags = async () => {
    try {
      const tagList = await api.getTags();
      setTags(tagList);
    } catch (error) {
      console.error('Failed to refresh tags:', error);
    }
  };

  const handleCreateTag = async (payload: { name: string; color?: string; parentId?: string | null }) => {
    try {
      await api.createTag(payload);
      await refreshTags();
    } catch (error) {
      console.error('Failed to create tag:', error);
      throw error;
    }
  };

  const handleUpdateTag = async (id: string, payload: { name?: string; color?: string; parentId?: string | null }) => {
    try {
      await api.updateTag(id, payload);
      await refreshTags();
    } catch (error) {
      console.error('Failed to update tag:', error);
      throw error;
    }
  };

  const handleDeleteTag = async (id: string) => {
    try {
      await api.deleteTag(id);
      await refreshTags();
    } catch (error) {
      console.error('Failed to delete tag:', error);
      throw error;
    }
  };

  // Sticky'n ハンドラー
  const handleStickyCreate = async () => {
    try {
      const newSticky = await api.createSticky({ name: 'New Sticky\'n', displayOrder: stickies.length });
      setStickies(prev => [...prev, newSticky]);
      // 編集モーダルは開かない - 付箋を貼り付けるイメージ
      return newSticky; // 新規作成したStickyを返す（スクロール用）
    } catch (error) {
      console.error('Failed to create sticky:', error);
    }
  };

  const handleStickyEdit = (stickyId: string) => {
    setEditingStickyId(stickyId);
    setOpenStickyModal(true);
  };

  const handleStickyUpdate = async (updated: any) => {
    try {
      const updatedSticky = await api.updateSticky(updated.id, updated);
      setStickies(prev => prev.map(s => s.id === updated.id ? updatedSticky : s));
    } catch (error) {
      console.error('Failed to update sticky:', error);
      throw error;
    }
  };

  const handleStickyComplete = async (stickyId: string) => {
    try {
      const sticky = stickies.find(s => s.id === stickyId);
      if (!sticky) return;
      
      const updatedSticky = await api.updateSticky(stickyId, { completed: !sticky.completed });
      setStickies(prev => prev.map(s => s.id === stickyId ? updatedSticky : s));
    } catch (error) {
      console.error('Failed to complete sticky:', error);
    }
  };

  const handleStickyDelete = async (stickyId: string) => {
    try {
      await api.deleteSticky(stickyId);
      setStickies(prev => prev.filter(s => s.id !== stickyId));
    } catch (error) {
      console.error('Failed to delete sticky:', error);
    }
  };

  const handleStickyNameChange = async (stickyId: string, name: string) => {
    try {
      const updatedSticky = await api.updateSticky(stickyId, { name });
      setStickies(prev => prev.map(s => s.id === stickyId ? updatedSticky : s));
    } catch (error) {
      console.error('Failed to update sticky name:', error);
    }
  };

  const handleStickyTagsChange = async (stickyId: string, tagIds: string[]) => {
    try {
      const currentTags = await api.getStickyTags(stickyId);
      const currentTagIds = currentTags.map((t: any) => t.id);

      const toAdd = tagIds.filter(id => !currentTagIds.includes(id));
      const toRemove = currentTagIds.filter((id: string) => !tagIds.includes(id));

      for (const tagId of toAdd) {
        await api.addStickyTag(stickyId, tagId);
      }

      for (const tagId of toRemove) {
        await api.removeStickyTag(stickyId, tagId);
      }
    } catch (error) {
      console.error('Failed to update sticky tags:', error);
      throw error;
    }
  };

  // Habit/Goal タグ変更ハンドラー
  const handleHabitTagsChange = async (habitId: string, tagIds: string[]) => {
    try {
      // 現在のタグを取得
      const currentTags = await api.getHabitTags(habitId);
      const currentTagIds = currentTags.map((t: any) => t.id);

      // 追加するタグ
      const toAdd = tagIds.filter(id => !currentTagIds.includes(id));
      // 削除するタグ
      const toRemove = currentTagIds.filter((id: string) => !tagIds.includes(id));

      // タグを追加
      for (const tagId of toAdd) {
        await api.addHabitTag(habitId, tagId);
      }

      // タグを削除
      for (const tagId of toRemove) {
        await api.removeHabitTag(habitId, tagId);
      }
    } catch (error) {
      console.error('Failed to update habit tags:', error);
      throw error;
    }
  };

  const handleGoalTagsChange = async (goalId: string, tagIds: string[]) => {
    try {
      // 現在のタグを取得
      const currentTags = await api.getGoalTags(goalId);
      const currentTagIds = currentTags.map((t: any) => t.id);

      // 追加するタグ
      const toAdd = tagIds.filter(id => !currentTagIds.includes(id));
      // 削除するタグ
      const toRemove = currentTagIds.filter((id: string) => !tagIds.includes(id));

      // タグを追加
      for (const tagId of toAdd) {
        await api.addGoalTag(goalId, tagId);
      }

      // タグを削除
      for (const tagId of toRemove) {
        await api.removeGoalTag(goalId, tagId);
      }
    } catch (error) {
      console.error('Failed to update goal tags:', error);
      throw error;
    }
  };

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
    <LocaleProvider>
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
        stickies={stickies}
        setStickies={setStickies}
        reloadStickies={reloadStickies}
        openStickyModal={openStickyModal}
        setOpenStickyModal={setOpenStickyModal}
        editingStickyId={editingStickyId}
        setEditingStickyId={setEditingStickyId}
        handleStickyCreate={handleStickyCreate}
        handleStickyEdit={handleStickyEdit}
        handleStickyUpdate={handleStickyUpdate}
        handleStickyComplete={handleStickyComplete}
        handleStickyDelete={handleStickyDelete}
        handleStickyNameChange={handleStickyNameChange}
        handleStickyTagsChange={handleStickyTagsChange}
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
        tags={tags}
        setTags={setTags}
        openManageTags={openManageTags}
        setOpenManageTags={setOpenManageTags}
        handleCreateTag={handleCreateTag}
        handleUpdateTag={handleUpdateTag}
        handleDeleteTag={handleDeleteTag}
        handleGoalTagsChange={handleGoalTagsChange}
        handleHabitTagsChange={handleHabitTagsChange}
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
    </LocaleProvider>
  );
}

// Mobile Tab Icon Component
const MobileTabIcon = ({ type, isActive }: { type: string; isActive: boolean }) => {
  const iconProps = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: isActive ? 2 : 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (type) {
    case 'board':
      // Kanban board icon (3 columns)
      return (
        <svg {...iconProps}>
          <rect x="3" y="3" width="5" height="18" rx="1" />
          <rect x="10" y="3" width="5" height="12" rx="1" />
          <rect x="17" y="3" width="5" height="15" rx="1" />
        </svg>
      );
    case 'next':
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case 'activity':
      return (
        <svg {...iconProps}>
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...iconProps}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case 'statistics':
      return (
        <svg {...iconProps}>
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      );
    case 'diary':
      return (
        <svg {...iconProps}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      );
    case 'stickies':
      return (
        <svg {...iconProps}>
          <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8z" />
          <polyline points="16 3 16 8 21 8" />
        </svg>
      );
    case 'mindmap':
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="3" />
          <circle cx="19" cy="5" r="2" />
          <circle cx="5" cy="5" r="2" />
          <circle cx="19" cy="19" r="2" />
          <circle cx="5" cy="19" r="2" />
          <line x1="14.5" y1="9.5" x2="17.5" y2="6.5" />
          <line x1="9.5" y1="9.5" x2="6.5" y2="6.5" />
          <line x1="14.5" y1="14.5" x2="17.5" y2="17.5" />
          <line x1="9.5" y1="14.5" x2="6.5" y2="17.5" />
        </svg>
      );
    case 'notices':
      return (
        <svg {...iconProps}>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    case 'coach':
      return (
        <svg {...iconProps}>
          <path d="M12 2a3 3 0 0 0-3 3v4a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      );
    default:
      return null;
  }
};

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
    stickies,
    setStickies,
    reloadStickies,
    openStickyModal,
    setOpenStickyModal,
    editingStickyId,
    setEditingStickyId,
    handleStickyCreate,
    handleStickyEdit,
    handleStickyUpdate,
    handleStickyComplete,
    handleStickyDelete,
    handleStickyNameChange,
    handleStickyTagsChange,
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
    tags,
    setTags,
    openManageTags,
    setOpenManageTags,
    handleCreateTag,
    handleUpdateTag,
    handleDeleteTag,
    handleGoalTagsChange,
    handleHabitTagsChange,
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

  // Tab navigation state
  const visibleTabs = getVisibleTabs(pageSections);
  const { activeTab, setActiveTab, isFullView, toggleFullView, exitFullView, isCollapsed, toggleCollapse } = useTabNavigation(
    'board', // Always start with Board tab
    pageSections
  );
  const currentTabConfig = getTabById(activeTab);
  const supportsFullView = currentTabConfig?.supportsFullView ?? false;

  // Render section content based on active tab
  const renderSectionContent = () => {
    // Normalize tab ID for backward compatibility (next -> board)
    const normalizedTab = normalizeTabId(activeTab);
    
    switch (normalizedTab) {
      case 'board':
        return (
          <BoardSection 
            habits={habits}
            activities={activities}
            stickies={stickies}
            goals={goals}
            habitRelations={[]}
            onHabitAction={handleHabitAction}
            onHabitEdit={(habitId) => {
              setSelectedHabitId(habitId);
              setOpenHabitModal(true);
            }}
            onGoalEdit={(goalId) => {
              setEditingGoalId(goalId);
              setOpenGoalModal(true);
            }}
            onStickyComplete={handleStickyComplete}
            onStickyEdit={handleStickyEdit}
            onNewGoal={() => setOpenNewCategory(true)}
            onNewHabit={() => {
              setNewHabitInitial({ date: new Date().toISOString().slice(0, 10) });
              setOpenNewHabit(true);
            }}
            onNewSticky={handleStickyCreate}
            onManageTags={() => setOpenManageTags(true)}
          />
        );
      case 'activity':
        return (
          <ActivitySection 
            activities={activities} 
            onEditActivity={openEditActivity} 
            onDeleteActivity={handleDeleteActivity} 
            habits={habits}
          />
        );
      case 'calendar':
        return (
          <CalendarWidget
            habits={habits}
            goals={goals}
            activities={activities}
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
        );
      case 'statics':
        return <StaticsSection habits={habits as any} activities={activities as any} goals={goals as any} />;
      case 'diary':
        return (
          <DiarySection 
            goals={goals as any} 
            habits={habits as any}
            onManageTags={() => setOpenManageTags(true)}
          />
        );
      case 'stickies':
        return (
          <StickiesSection
            stickies={stickies}
            onStickyCreate={handleStickyCreate}
            onStickyEdit={handleStickyEdit}
            onStickyComplete={handleStickyComplete}
            onStickyDelete={handleStickyDelete}
            onStickyNameChange={handleStickyNameChange}
            onStickyUpdate={reloadStickies}
          />
        );
      case 'mindmap':
        return (
          <MindmapSection
            goals={goals as any}
            habits={habits as any}
            onRegisterAsHabit={async (data) => {
              const createdHabit = await createHabit(data);
              return createdHabit;
            }}
            onRegisterAsGoal={async (payload) => {
              const createdGoal = await createGoal(payload);
              return createdGoal;
            }}
            onDataChange={async () => {
              try {
                const gs = await api.getGoals();
                setGoals(gs || []);
                const hs = await api.getHabits();
                setHabits(hs || []);
              } catch (e) {
                console.error('Failed to reload data', e);
              }
            }}
          />
        );
      case 'notices':
        return (
          <NoticeSection
            habits={habits}
            activities={activities}
            onEditActivity={openEditActivity}
            onDeleteActivity={handleDeleteActivity}
            onActionClick={(notice) => {
              debug.log('[Dashboard] Notice action clicked:', notice);
              if (notice.actionType === 'rescue_proposal' || notice.actionType === 'recovery_proposal') {
                // Could open coaching modal or navigate to coaching page
              } else if (notice.actionType === 'subscription') {
                window.location.href = '/settings/subscription';
              } else if (notice.actionType === 'habit_suggestion' && notice.actionPayload?.goalId) {
                setEditingGoalId(notice.actionPayload.goalId);
                setOpenGoalModal(true);
              }
            }}
          />
        );
      case 'coach':
        return (
          <CoachSection
            goals={goals}
            onHabitCreated={async () => {
              try {
                const hs = await api.getHabits();
                setHabits(hs || []);
              } catch (e) {
                console.error('Failed to reload habits', e);
              }
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen md:min-h-screen bg-background text-foreground">
        <DashboardHeader
          onToggleSidebar={() => setShowLeftPane((s: boolean) => !s)}
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
        onManageTags={() => setOpenManageTags(true)}
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

  {/* Main content pane with left tab navigation */}
  <main className="flex-1 pt-16 pb-20 md:pb-0 flex flex-col md:flex-row">
        {/* Left Tab Navigation - Desktop */}
        <div className="hidden md:flex flex-col h-[calc(100vh-4rem)] sticky top-16">
          <TabNavigation
            tabs={visibleTabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            collapsed={isCollapsed}
            onToggleCollapse={toggleCollapse}
          />
        </div>

        {/* Tab Content */}
        <div className="flex-1 p-4 lg:p-6">
          <TabContent
            activeTab={activeTab}
            isFullView={isFullView}
            onToggleFullView={toggleFullView}
            onExitFullView={exitFullView}
            supportsFullView={supportsFullView}
          >
            {renderSectionContent()}
          </TabContent>
        </div>
      </main>

      {/* Mobile Tab Navigation - Bottom fixed, OUTSIDE of main */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[9999] bg-background border-t border-border shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
        <div 
          className="flex overflow-x-auto scrollbar-hide px-1 py-1.5 gap-0.5" 
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}
        >
          {visibleTabs.map((tab) => {
            // Normalize activeTab for comparison (e.g., 'next' -> 'board')
            const normalizedActiveTab = normalizeTabId(activeTab);
            const isActive = tab.id === normalizedActiveTab;
            const label = tab.labelJa;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex flex-col items-center justify-center flex-shrink-0
                  w-[56px] min-h-[52px]
                  py-1.5
                  rounded-lg
                  transition-all duration-150
                  ${isActive
                    ? 'text-primary bg-primary/5'
                    : 'text-muted-foreground'
                  }
                `}
              >
                <MobileTabIcon type={tab.iconType} isActive={isActive} />
                <span className={`text-[9px] mt-0.5 leading-tight ${isActive ? 'font-medium' : ''}`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <GoalModal
        open={openNewCategory}
        onClose={() => setOpenNewCategory(false)}
        goal={null}
        onCreate={(payload: CreateGoalPayload) => createGoal(payload)}
        goals={goals}
        tags={tags}
        onTagsChange={handleGoalTagsChange}
      />

      <EditLayoutModal
        open={editLayoutOpen}
        onClose={() => setEditLayoutOpen(false)}
        sections={pageSections}
        onChange={async (s: any) => {
          setPageSections(s);
          try { 
            await api.saveLayout(s); 
            debug.log('[Dashboard] Layout saved:', s);
          } catch (e) { 
            console.error('Failed to persist layout', e); 
          }
        }}
        onAdd={(id: any) => setPageSections((ps: any[]) => ps.includes(id) ? ps : [...ps, id])}
        onDelete={(id: any) => setPageSections((ps: any[]) => ps.filter(x => x !== id))}
      />

      <GoalModal
        open={openGoalModal}
        onClose={() => { setOpenGoalModal(false); setEditingGoalId(null); }}
        goal={editingGoal}
        onUpdate={(g) => updateGoal(g)}
        onDelete={(id) => deleteGoal(id)}
        onComplete={(id) => completeGoalCascade(id)}
        goals={goals}
        tags={tags}
        onTagsChange={handleGoalTagsChange}
      />

      <HabitModal
        key={selectedHabit?.id ?? 'none'}
        open={openHabitModal}
        onClose={() => { setOpenHabitModal(false); setSelectedHabitId(null); }}
        habit={selectedHabit as any}
        onUpdate={async (updated) => {
          try { 
            const u = await api.updateHabit(updated.id, updated); 
            setHabits((s: any[]) => s.map(h => h.id === updated.id ? u : h)); 
          } catch(e) { 
            console.error(e); 
          }
        }}
        onDelete={async (id) => { 
          try { 
            await api.deleteHabit(id); 
            setHabits((s: any[]) => s.filter(h => h.id !== id)); 
          } catch(e) { 
            console.error(e); 
          } 
        }}
        categories={goals}
        tags={tags}
        onTagsChange={handleHabitTagsChange}
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
        tags={tags}
        onTagsChange={handleHabitTagsChange}
      />

      <ActivityModal
        open={openActivityModal}
        onClose={() => { setOpenActivityModal(false); setEditingActivityId(null); }}
        initial={activities.find((a: any) => a.id === editingActivityId) as any ?? null}
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

      {/* Manage Tags Modal */}
      <ManageTagsModal
        isOpen={openManageTags}
        onClose={() => setOpenManageTags(false)}
        tags={tags}
        onCreateTag={handleCreateTag}
        onUpdateTag={handleUpdateTag}
        onDeleteTag={handleDeleteTag}
      />

      {/* Sticky Modal */}
      <StickyModal
        open={openStickyModal}
        onClose={() => {
          setOpenStickyModal(false);
          setEditingStickyId(null);
        }}
        sticky={editingStickyId ? stickies.find((s: any) => s.id === editingStickyId) || null : null}
        onCreate={handleStickyUpdate}
        onUpdate={handleStickyUpdate}
        onDelete={handleStickyDelete}
        goals={goals}
        habits={habits}
        tags={tags}
        onTagsChange={handleStickyTagsChange}
      />
    </div>
  );
}
