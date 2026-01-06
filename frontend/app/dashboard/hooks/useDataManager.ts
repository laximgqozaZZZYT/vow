"use client";

import { useState, useEffect } from 'react';
import api from '../../../lib/api';
import type { Goal, Habit, Activity, SectionId } from '../types';

export function useDataManager() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [pageSections, setPageSections] = useState<SectionId[]>(['next','activity','calendar','statics','diary']);
  const [isClient, setIsClient] = useState(false);

  // Load initial data from API
  useEffect(() => {
    (async () => {
      try {
        console.log('[dashboard] Loading goals...');
        const gs = await api.getGoals();
        console.log('[dashboard] Goals loaded:', gs);
        setGoals(gs || []);
        
        console.log('[dashboard] Loading habits...');
        const hs = await api.getHabits();
        console.log('[dashboard] Habits loaded:', hs);
        setHabits(hs || []);
        
        console.log('[dashboard] Loading activities...');
        const acts = await api.getActivities();
        console.log('[dashboard] Activities loaded:', acts);
        setActivities(acts || []);
        
        console.log('[dashboard] Loading layout...');
        const layout = await api.getLayout();
        console.log('[dashboard] Layout loaded:', layout);
        if (layout && Array.isArray(layout.sections)) {
          setPageSections(layout.sections as any);
        }
      } catch (e) {
        console.error('Failed to load initial data', e);
      }
    })();
  }, []);

  // Hydration safety: only read localStorage after mount
  useEffect(() => {
    setIsClient(true);
    try {
      const raw = window.localStorage.getItem('pageSections');
      if (raw) setPageSections(JSON.parse(raw) as SectionId[]);
    } catch {}
  }, []);

  useEffect(() => { 
    try { 
      window.localStorage.setItem('pageSections', JSON.stringify(pageSections)); 
    } catch(e){} 
  }, [pageSections]);

  return {
    goals,
    setGoals,
    habits,
    setHabits,
    activities,
    setActivities,
    pageSections,
    setPageSections,
    isClient
  };
}