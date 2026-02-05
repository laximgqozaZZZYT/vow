/**
 * useSnoozedSuggestions Hook
 *
 * Manages snoozed suggestions with localStorage persistence.
 * Features:
 * - Snooze/unsnooze suggestions
 * - Check for expired snoozes
 * - Auto-cleanup of expired items
 *
 * @module hooks/useSnoozedSuggestions
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useLocalStorageObject } from './useLocalStorage';
import { debug } from '../../../lib/debug';

/**
 * A snoozed suggestion item
 */
export interface SnoozedSuggestion {
  id: string;
  suggestionId: string;
  messageId?: string;
  type: 'habit' | 'goal';
  data: Record<string, unknown>;
  snoozedAt: string; // ISO date string
  snoozeUntil: string; // ISO date string
}

/**
 * Input data for snoozing a suggestion
 */
export interface SuggestionToSnooze {
  id: string;
  type: 'habit' | 'goal';
  data: Record<string, unknown>;
  messageId?: string;
}

/**
 * Return type for useSnoozedSuggestions hook
 */
export interface UseSnoozedSuggestionsReturn {
  /** List of snoozed suggestions */
  snoozedSuggestions: SnoozedSuggestion[];
  /** Snooze a suggestion */
  snooze: (suggestion: SuggestionToSnooze, durationHours?: number) => void;
  /** Unsnooze (restore) a suggestion */
  unsnooze: (id: string) => SnoozedSuggestion | undefined;
  /** Get all expired snoozes */
  getExpired: () => SnoozedSuggestion[];
  /** Clear all expired snoozes */
  clearExpired: () => SnoozedSuggestion[];
  /** Check if a suggestion is snoozed */
  isSnoozed: (suggestionId: string) => boolean;
  /** Get remaining snooze time in milliseconds */
  getRemaining: (id: string) => number | null;
  /** Clear all snoozed suggestions */
  clearAll: () => void;
}

const STORAGE_KEY = 'vow_snoozed_suggestions';
const DEFAULT_SNOOZE_HOURS = 24;

/**
 * Hook for managing snoozed suggestions
 *
 * @returns Snoozed suggestions management object
 */
export function useSnoozedSuggestions(): UseSnoozedSuggestionsReturn {
  const { value: snoozed, setValue: setSnoozed } = useLocalStorageObject<SnoozedSuggestion[]>(
    STORAGE_KEY,
    []
  );

  // Auto-check for expired items on mount and periodically
  useEffect(() => {
    const checkInterval = setInterval(() => {
      const now = new Date();
      const hasExpired = snoozed.some((s: SnoozedSuggestion) => new Date(s.snoozeUntil) <= now);
      if (hasExpired) {
        debug.log('[useSnoozedSuggestions] Found expired snoozes');
      }
    }, 60000); // Check every minute

    return () => clearInterval(checkInterval);
  }, [snoozed]);

  /**
   * Snooze a suggestion for a specified duration
   */
  const snooze = useCallback(
    (suggestion: SuggestionToSnooze, durationHours: number = DEFAULT_SNOOZE_HOURS) => {
      const now = new Date();
      const snoozeUntil = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

      const newSnoozed: SnoozedSuggestion = {
        id: `snooze-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        suggestionId: suggestion.id,
        messageId: suggestion.messageId,
        type: suggestion.type,
        data: suggestion.data,
        snoozedAt: now.toISOString(),
        snoozeUntil: snoozeUntil.toISOString(),
      };

      setSnoozed((prev: SnoozedSuggestion[]) => {
        // Remove any existing snooze for the same suggestion
        const filtered = prev.filter((s: SnoozedSuggestion) => s.suggestionId !== suggestion.id);
        return [...filtered, newSnoozed];
      });

      debug.log('[useSnoozedSuggestions] Snoozed suggestion:', {
        suggestionId: suggestion.id,
        until: snoozeUntil.toISOString(),
      });
    },
    [setSnoozed]
  );

  /**
   * Unsnooze (restore) a suggestion by ID
   */
  const unsnooze = useCallback(
    (id: string): SnoozedSuggestion | undefined => {
      let removed: SnoozedSuggestion | undefined;

      setSnoozed((prev: SnoozedSuggestion[]) => {
        const index = prev.findIndex((s: SnoozedSuggestion) => s.id === id);
        if (index === -1) return prev;

        removed = prev[index];
        const next = [...prev];
        next.splice(index, 1);
        return next;
      });

      if (removed) {
        debug.log('[useSnoozedSuggestions] Unsnoozed suggestion:', removed.suggestionId);
      }

      return removed;
    },
    [setSnoozed]
  );

  /**
   * Get all expired snoozes (past their snoozeUntil time)
   */
  const getExpired = useCallback((): SnoozedSuggestion[] => {
    const now = new Date();
    return snoozed.filter((s: SnoozedSuggestion) => new Date(s.snoozeUntil) <= now);
  }, [snoozed]);

  /**
   * Clear all expired snoozes and return them
   */
  const clearExpired = useCallback((): SnoozedSuggestion[] => {
    const now = new Date();
    const expired: SnoozedSuggestion[] = [];

    setSnoozed((prev: SnoozedSuggestion[]) => {
      const active: SnoozedSuggestion[] = [];

      prev.forEach((s: SnoozedSuggestion) => {
        if (new Date(s.snoozeUntil) <= now) {
          expired.push(s);
        } else {
          active.push(s);
        }
      });

      return active;
    });

    if (expired.length > 0) {
      debug.log('[useSnoozedSuggestions] Cleared expired snoozes:', expired.length);
    }

    return expired;
  }, [setSnoozed]);

  /**
   * Check if a suggestion is currently snoozed
   */
  const isSnoozed = useCallback(
    (suggestionId: string): boolean => {
      const now = new Date();
      return snoozed.some(
        (s: SnoozedSuggestion) => s.suggestionId === suggestionId && new Date(s.snoozeUntil) > now
      );
    },
    [snoozed]
  );

  /**
   * Get remaining snooze time in milliseconds
   */
  const getRemaining = useCallback(
    (id: string): number | null => {
      const item = snoozed.find((s: SnoozedSuggestion) => s.id === id);
      if (!item) return null;

      const remaining = new Date(item.snoozeUntil).getTime() - Date.now();
      return remaining > 0 ? remaining : 0;
    },
    [snoozed]
  );

  /**
   * Clear all snoozed suggestions
   */
  const clearAll = useCallback(() => {
    setSnoozed([]);
    debug.log('[useSnoozedSuggestions] Cleared all snoozed suggestions');
  }, [setSnoozed]);

  // Filter out items that would have invalid data
  const validSnoozed = useMemo(
    () => snoozed.filter((s: SnoozedSuggestion) => s.id && s.suggestionId && s.type && s.snoozeUntil),
    [snoozed]
  );

  return {
    snoozedSuggestions: validSnoozed,
    snooze,
    unsnooze,
    getExpired,
    clearExpired,
    isSnoozed,
    getRemaining,
    clearAll,
  };
}

/**
 * Format remaining time for display
 */
export function formatRemainingTime(remainingMs: number): string {
  if (remainingMs <= 0) return 'Expired';

  const hours = Math.floor(remainingMs / (1000 * 60 * 60));
  const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} remaining`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  }

  return `${minutes}m remaining`;
}
