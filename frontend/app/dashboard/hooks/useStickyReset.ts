/**
 * useStickyReset Hook
 *
 * Manages automatic reset of reusable Sticky'n items when
 * linked recurring habits enter a new period.
 */

import { useEffect, useCallback, useRef } from 'react';
import type { Habit, Sticky } from '../types';
import { getStickiesToReset, isRecurringHabit } from '../utils/stickyResetUtils';

interface UseStickyResetOptions {
  habits: Habit[];
  stickies: Sticky[];
  onResetSticky: (stickyId: string) => Promise<void>;
  enabled?: boolean;
}

export function useStickyReset({
  habits,
  stickies,
  onResetSticky,
  enabled = true
}: UseStickyResetOptions) {
  const hasRunRef = useRef(false);

  const checkAndResetStickies = useCallback(async () => {
    if (!enabled || habits.length === 0 || stickies.length === 0) return;

    // Only run once per session
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    const resetPromises: Promise<void>[] = [];
    const processedIds = new Set<string>();

    for (const habit of habits) {
      if (!isRecurringHabit(habit)) continue;

      const toReset = getStickiesToReset(stickies, habit);

      for (const sticky of toReset) {
        // Avoid duplicate resets if sticky is linked to multiple habits
        if (processedIds.has(sticky.id)) continue;
        processedIds.add(sticky.id);

        console.log(`[useStickyReset] Resetting sticky "${sticky.name}" for habit "${habit.name}"`);
        resetPromises.push(onResetSticky(sticky.id));
      }
    }

    if (resetPromises.length > 0) {
      await Promise.all(resetPromises);
      console.log(`[useStickyReset] Reset ${resetPromises.length} stickies`);
    }
  }, [habits, stickies, onResetSticky, enabled]);

  // Run on mount and when data changes
  useEffect(() => {
    checkAndResetStickies();
  }, [checkAndResetStickies]);

  return { checkAndResetStickies };
}
