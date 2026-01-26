"use client";

import { useState, useEffect } from 'react';
import api from '../../../lib/api';
import { debug } from '../../../lib/debug';
import type { Goal, Habit, Activity, SectionId } from '../types/index';

export function useDataManager() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [pageSections, setPageSections] = useState<SectionId[]>(['next','calendar','statics','stickies']);
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastResetDate, setLastResetDate] = useState<string>('');

  // Daily reset function for habits (JST timezone aware)
  const resetDailyHabits = () => {
    // JST (UTC+9) での現在時刻を取得
    const now = new Date();
    // JST時刻を正確に計算
    const jstTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
    const today = jstTime.toISOString().split('T')[0]; // YYYY-MM-DD format in JST
    
    debug.log('[useDataManager] Current JST time:', jstTime.toISOString(), 'Today:', today, 'Last reset:', lastResetDate);
    
    if (lastResetDate === today) {
      debug.log('[useDataManager] Already reset today, skipping');
      return; // Already reset today
    }
    
    debug.log('[useDataManager] Performing daily reset for JST date:', today);
    
    setHabits(prevHabits => {
      const updatedHabits = prevHabits.map(habit => {
        // Check if this is a Daily habit that should be reset
        const isDaily = habit.repeat === 'Daily' || 
                       (!habit.repeat || habit.repeat === 'Does not repeat') && !habit.dueDate;
        
        // Also check timings for Daily type
        const hasDaily = habit.timings?.some((t) => t.type === 'Daily');
        
        const shouldReset = isDaily || hasDaily;
        
        if (shouldReset && (habit.completed || (habit.count && habit.count > 0))) {
          debug.log('[useDataManager] Resetting habit:', habit.name, {
            repeat: habit.repeat,
            dueDate: habit.dueDate,
            timings: habit.timings,
            shouldReset,
            currentJSTTime: jstTime.toISOString(),
            previousCount: habit.count,
            previousCompleted: habit.completed
          });
          return {
            ...habit,
            completed: false,
            count: 0, // Reset count for daily habits
            updatedAt: new Date().toISOString()
          };
        }
        
        return habit;
      });
      
      debug.log('[useDataManager] Reset completed, updated habits count:', updatedHabits.filter(h => h.count === 0).length);
      return updatedHabits;
    });
    
    setLastResetDate(today);
    
    // Store last reset date in localStorage
    try {
      localStorage.setItem('lastHabitResetDate', today);
      debug.log('[useDataManager] Stored reset date in localStorage:', today);
    } catch (e) {
      console.error('Failed to store reset date:', e);
    }
  };

  // Check for daily reset on component mount and periodically
  useEffect(() => {
    if (!isClient) return;
    
    // Load last reset date from localStorage
    try {
      const storedResetDate = localStorage.getItem('lastHabitResetDate');
      debug.log('[useDataManager] Loaded stored reset date:', storedResetDate);
      if (storedResetDate) {
        setLastResetDate(storedResetDate);
      }
    } catch (e) {
      console.error('Failed to load reset date:', e);
    }
    
    // Perform initial reset check immediately
    debug.log('[useDataManager] Performing initial reset check');
    resetDailyHabits();
    
    // Set up interval to check for daily reset every 1 minute for debugging
    const interval = setInterval(() => {
      debug.log('[useDataManager] Periodic reset check');
      resetDailyHabits();
    }, 1 * 60 * 1000); // Check every 1 minute for debugging
    
    return () => clearInterval(interval);
  }, [isClient, lastResetDate]);

  // Load data function
  const loadData = async () => {
    try {
      setIsLoading(true);
      debug.log('[dashboard] Loading goals...');
      const gs = await api.getGoals();
      debug.log('[dashboard] Goals loaded:', gs);
      setGoals(gs || []);
      
      debug.log('[dashboard] Loading habits...');
      const hs = await api.getHabits();
      debug.log('[dashboard] Habits loaded:', hs);
      setHabits(hs || []);
      
      debug.log('[dashboard] Loading activities...');
      const acts = await api.getActivities();
      debug.log('[dashboard] Activities loaded:', acts);
      setActivities(acts || []);
      
      debug.log('[dashboard] Loading layout...');
      const layout = await api.getLayout();
      debug.log('[dashboard] Layout loaded:', layout);
      if (layout && Array.isArray(layout.sections) && layout.sections.length > 0) {
        debug.log('[dashboard] Using layout from API:', layout.sections);
        setPageSections(layout.sections as any);
      } else {
        debug.log('[dashboard] No layout from API, using default');
        // デフォルト値を保存
        try {
          await api.saveLayout(['next','calendar','statics','stickies']);
        } catch (e) {
          console.error('Failed to save default layout', e);
        }
      }
    } catch (e) {
      console.error('Failed to load data', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Load initial data from API
  useEffect(() => {
    loadData();
  }, []);

  // Listen for guest data migration completion
  useEffect(() => {
    const handleMigrationComplete = () => {
      debug.log('[dashboard] Guest data migration completed, reloading data');
      loadData();
    };

    window.addEventListener('guestDataMigrated', handleMigrationComplete);
    return () => {
      window.removeEventListener('guestDataMigrated', handleMigrationComplete);
    };
  }, []);

  // Hydration safety: only set client flag after mount
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Manual reset function for debugging
  const manualReset = () => {
    debug.log('[useDataManager] Manual reset triggered');
    debug.log('[useDataManager] Current localStorage lastHabitResetDate:', localStorage.getItem('lastHabitResetDate'));
    debug.log('[useDataManager] Current habits before reset:', habits.map(h => ({ name: h.name, count: h.count, completed: h.completed })));
    setLastResetDate(''); // Force reset by clearing last reset date
    resetDailyHabits();
  };

  return {
    goals,
    setGoals,
    habits,
    setHabits,
    activities,
    setActivities,
    pageSections,
    setPageSections,
    isClient,
    isLoading,
    loadData, // Export loadData for manual refresh
    manualReset // Export manual reset for debugging
  };
}