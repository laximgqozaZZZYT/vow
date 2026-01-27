'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Goal, Habit, Tag, Sticky } from '../types/index';
import api from '../../../lib/api';
import SmartSelector, { SmartSelectorItem } from './Widget.SmartSelector';
import StickyFooter from './Widget.StickyFooter';

/**
 * StickyModal - Sticky'n編集モーダル
 * 
 * UI/UX改善:
 * - SmartSelectorによる検索式マルチセレクト
 * - StickyFooterによる固定フッター
 * - 折りたたみセクションによる情報整理
 * 
 * @validates Requirements 1.1-1.5, 2.5, 4.1-4.4, 5.1-5.5
 */

interface StickyModalProps {
  open: boolean;
  onClose: () => void;
  sticky: Sticky | null;
  onCreate?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (id: string) => void;
  goals: Goal[];
  habits: Habit[];
  tags: Tag[];
  onTagsChange?: (stickyId: string, tagIds: string[]) => void;
}

// 折りたたみセクションコンポーネント
function CollapsibleSection({ 
  title, 
  isExpanded, 
  onToggle, 
  children,
  badge
}: { 
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  badge?: number;
}) {
  const sectionId = `section-${title.toLowerCase().replace(/\s+/g, '-')}`;
  
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="
          flex items-center justify-between w-full
          px-4 py-3 text-left
          bg-muted/30 hover:bg-muted/50
          transition-colors
          min-h-[44px]
        "
        aria-expanded={isExpanded}
        aria-controls={sectionId}
      >
        <div className="flex items-center gap-2">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-medium text-sm">{title}</span>
        </div>
        {badge !== undefined && badge > 0 && (
          <span className="px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-full">
            {badge}
          </span>
        )}
      </button>
      {isExpanded && (
        <div id={sectionId} className="p-4 border-t border-border animate-fadeIn">
          {children}
        </div>
      )}
    </div>
  );
}

export function StickyModal({
  open,
  onClose,
  sticky,
  onCreate,
  onUpdate,
  onDelete,
  goals,
  habits,
  tags,
  onTagsChange
}: StickyModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [selectedHabits, setSelectedHabits] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 折りたたみセクションの状態
  const [expandedSections, setExpandedSections] = useState({
    tags: true,
    goals: false,
    habits: false
  });

  useEffect(() => {
    if (open && sticky) {
      setName(sticky.name || '');
      setDescription(sticky.description || '');
      loadRelations();
    } else if (open && !sticky) {
      setName('');
      setDescription('');
      setSelectedTags([]);
      setSelectedGoals([]);
      setSelectedHabits([]);
    }
  }, [open, sticky]);

  const loadRelations = async () => {
    if (!sticky) return;
    
    try {
      const [tagsData, goalsData, habitsData] = await Promise.all([
        api.getStickyTags(sticky.id),
        api.getStickyGoals(sticky.id),
        api.getStickyHabits(sticky.id)
      ]);
      
      setSelectedTags(tagsData.map((t: any) => t.id));
      setSelectedGoals(goalsData.map((g: any) => g.id));
      setSelectedHabits(habitsData.map((h: any) => h.id));
    } catch (error) {
      console.error('Failed to load relations:', error);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Please enter a name');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim()
      };

      if (sticky) {
        // Update existing sticky
        await onUpdate?.({ ...sticky, ...payload });
        
        // Update relations
        await updateRelations(sticky.id);
      } else {
        // Create new sticky
        const newSticky = await onCreate?.(payload) as Sticky | undefined;
        
        if (newSticky?.id) {
          await updateRelations(newSticky.id);
        }
      }

      onClose();
    } catch (error) {
      console.error('Failed to save sticky:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateRelations = async (stickyId: string) => {
    try {
      // Update tags
      if (onTagsChange) {
        await onTagsChange(stickyId, selectedTags);
      }

      // Update goals
      const currentGoals = await api.getStickyGoals(stickyId);
      const currentGoalIds = currentGoals.map((g: any) => g.id);
      
      const goalsToAdd = selectedGoals.filter(id => !currentGoalIds.includes(id));
      const goalsToRemove = currentGoalIds.filter((id: string) => !selectedGoals.includes(id));
      
      for (const goalId of goalsToAdd) {
        await api.addStickyGoal(stickyId, goalId);
      }
      for (const goalId of goalsToRemove) {
        await api.removeStickyGoal(stickyId, goalId);
      }

      // Update habits
      const currentHabits = await api.getStickyHabits(stickyId);
      const currentHabitIds = currentHabits.map((h: any) => h.id);
      
      const habitsToAdd = selectedHabits.filter(id => !currentHabitIds.includes(id));
      const habitsToRemove = currentHabitIds.filter((id: string) => !selectedHabits.includes(id));
      
      for (const habitId of habitsToAdd) {
        await api.addStickyHabit(stickyId, habitId);
      }
      for (const habitId of habitsToRemove) {
        await api.removeStickyHabit(stickyId, habitId);
      }
    } catch (error) {
      console.error('Failed to update relations:', error);
      throw error;
    }
  };

  const handleDelete = async () => {
    if (!sticky) return;
    await onDelete?.(sticky.id);
  };

  // SmartSelector用のアイテム変換
  const tagItems: SmartSelectorItem[] = useMemo(() => 
    tags.map(tag => ({
      id: tag.id,
      name: tag.name,
      color: tag.color
    })),
    [tags]
  );

  const goalItems: SmartSelectorItem[] = useMemo(() => 
    goals.map(goal => ({
      id: goal.id,
      name: goal.name,
      color: '#22c55e' // green for goals
    })),
    [goals]
  );

  const habitItems: SmartSelectorItem[] = useMemo(() => 
    habits.map(habit => ({
      id: habit.id,
      name: habit.name,
      color: habit.type === 'avoid' ? '#ef4444' : '#3b82f6',
      variant: habit.type as 'do' | 'avoid'
    })),
    [habits]
  );

  // セクション展開トグル
  const toggleSection = useCallback((section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  }, []);

  // タグ選択ハンドラ
  const handleTagSelect = useCallback((id: string) => {
    setSelectedTags(prev => [...prev, id]);
  }, []);

  const handleTagDeselect = useCallback((id: string) => {
    setSelectedTags(prev => prev.filter(tagId => tagId !== id));
  }, []);

  // Goal選択ハンドラ
  const handleGoalSelect = useCallback((id: string) => {
    setSelectedGoals(prev => [...prev, id]);
  }, []);

  const handleGoalDeselect = useCallback((id: string) => {
    setSelectedGoals(prev => prev.filter(goalId => goalId !== id));
  }, []);

  // Habit選択ハンドラ
  const handleHabitSelect = useCallback((id: string) => {
    setSelectedHabits(prev => [...prev, id]);
  }, []);

  const handleHabitDeselect = useCallback((id: string) => {
    setSelectedHabits(prev => prev.filter(habitId => habitId !== id));
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-4 sm:pt-12 bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-card shadow-lg text-card-foreground flex flex-col max-h-[95vh] sm:max-h-[90vh]">
        {/* ヘッダー - 固定 */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-xl font-semibold">
            {sticky ? 'Edit Sticky\'n' : 'New Sticky\'n'}
          </h2>
          <button 
            onClick={onClose} 
            className="text-muted-foreground hover:text-foreground p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md transition-colors"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* スクロール可能なコンテンツ - フッター分の余白を確保 */}
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(-10px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .animate-fadeIn {
              animation: fadeIn 0.2s ease-in-out;
            }
          `}</style>

          {/* Name - 主要項目 */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter name..."
              className="
                flex h-10 w-full rounded-md border border-input bg-background 
                px-3 py-2 text-sm placeholder:text-muted-foreground 
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
              "
            />
          </div>

          {/* Description - 主要項目 */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter description..."
              rows={3}
              className="
                flex min-h-[80px] w-full rounded-md border border-input bg-background 
                px-3 py-2 text-sm placeholder:text-muted-foreground 
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                resize-none
              "
            />
          </div>

          {/* Tags - SmartSelector */}
          <div className="mb-4">
            <SmartSelector
              items={tagItems}
              selectedIds={selectedTags}
              onSelect={handleTagSelect}
              onDeselect={handleTagDeselect}
              label="Tags"
              placeholder="Search and add tags..."
              emptyMessage="No tags available"
            />
          </div>

          {/* Related Goals - 折りたたみセクション */}
          <div className="mb-4">
            <CollapsibleSection
              title="Related Goals"
              isExpanded={expandedSections.goals}
              onToggle={() => toggleSection('goals')}
              badge={selectedGoals.length}
            >
              <SmartSelector
                items={goalItems}
                selectedIds={selectedGoals}
                onSelect={handleGoalSelect}
                onDeselect={handleGoalDeselect}
                placeholder="Search and add goals..."
                emptyMessage="No goals available"
              />
            </CollapsibleSection>
          </div>

          {/* Related Habits - 折りたたみセクション */}
          <div className="mb-4">
            <CollapsibleSection
              title="Related Habits"
              isExpanded={expandedSections.habits}
              onToggle={() => toggleSection('habits')}
              badge={selectedHabits.length}
            >
              <SmartSelector
                items={habitItems}
                selectedIds={selectedHabits}
                onSelect={handleHabitSelect}
                onDeselect={handleHabitDeselect}
                placeholder="Search and add habits..."
                emptyMessage="No habits available"
              />
            </CollapsibleSection>
          </div>
        </div>

        {/* 固定フッター */}
        <StickyFooter
          onSave={handleSave}
          onCancel={onClose}
          onDelete={sticky ? handleDelete : undefined}
          isLoading={loading}
          saveDisabled={!name.trim()}
          deleteConfirmMessage="Are you sure you want to delete this Sticky'n?"
        />
      </div>
    </div>
  );
}
