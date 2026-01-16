import { useState, useEffect } from 'react';
import type { Goal, Habit, Tag, Sticky } from '../types/index';
import api from '../../../lib/api';

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
    
    if (!confirm('Are you sure you want to delete this Sticky\'n?')) {
      return;
    }

    setLoading(true);
    try {
      await onDelete?.(sticky.id);
      onClose();
    } catch (error) {
      console.error('Failed to delete sticky:', error);
      alert('Failed to delete. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const toggleGoal = (goalId: string) => {
    setSelectedGoals(prev =>
      prev.includes(goalId)
        ? prev.filter(id => id !== goalId)
        : [...prev, goalId]
    );
  };

  const toggleHabit = (habitId: string) => {
    setSelectedHabits(prev =>
      prev.includes(habitId)
        ? prev.filter(id => id !== habitId)
        : [...prev, habitId]
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">
            {sticky ? 'Edit Sticky\'n' : 'New Sticky\'n'}
          </h2>

          {/* Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter name..."
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-800"
            />
          </div>

          {/* Description */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter description..."
              rows={3}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-800"
            />
          </div>

          {/* Tags */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Tags</label>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    selectedTags.includes(tag.id)
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200'
                  }`}
                  style={
                    selectedTags.includes(tag.id) && tag.color
                      ? { backgroundColor: tag.color }
                      : {}
                  }
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>

          {/* Related Goals */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Related Goals</label>
            <div className="flex flex-wrap gap-2">
              {goals.length === 0 ? (
                <div className="text-sm text-zinc-500">No goals available</div>
              ) : (
                goals.map(goal => (
                  <button
                    key={goal.id}
                    onClick={() => toggleGoal(goal.id)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      selectedGoals.includes(goal.id)
                        ? 'bg-green-600 text-white'
                        : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200'
                    }`}
                  >
                    {goal.name}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Related Habits */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Related Habits</label>
            <div className="flex flex-wrap gap-2">
              {habits.length === 0 ? (
                <div className="text-sm text-zinc-500">No habits available</div>
              ) : (
                habits.map(habit => (
                  <button
                    key={habit.id}
                    onClick={() => toggleHabit(habit.id)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      selectedHabits.includes(habit.id)
                        ? 'bg-blue-600 text-white'
                        : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200'
                    }`}
                  >
                    {habit.name}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between gap-2">
            <div>
              {sticky && (
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  Delete
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
