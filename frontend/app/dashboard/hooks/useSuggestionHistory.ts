/**
 * useSuggestionHistory Hook
 *
 * Manages suggestion history with localStorage persistence.
 * Features:
 * - Track accepted, dismissed, and snoozed suggestions
 * - Filter by type, status, and category
 * - Automatic cleanup of old items
 *
 * @module hooks/useSuggestionHistory
 */

import { useCallback, useMemo } from 'react';
import { useLocalStorageObject } from './useLocalStorage';
import { debug } from '../../../lib/debug';

/**
 * Status of a suggestion in history
 */
export type SuggestionHistoryStatus = 'accepted' | 'snoozed' | 'dismissed';

/**
 * A suggestion history item
 */
export interface SuggestionHistoryItem {
  id: string;
  suggestionId: string;
  messageId?: string;
  type: 'habit' | 'goal';
  name: string;
  description?: string;
  category?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  data: Record<string, unknown>;
  status: SuggestionHistoryStatus;
  createdAt: string; // ISO date string - when suggestion was shown
  statusChangedAt: string; // ISO date string - when status was last changed
  snoozeUntil?: string; // ISO date string - for snoozed items
}

/**
 * Filter options for suggestion history
 */
export interface SuggestionHistoryFilter {
  type?: 'all' | 'habit' | 'goal';
  status?: 'all' | SuggestionHistoryStatus;
  category?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  search?: string;
}

/**
 * Input data for adding to history
 */
export interface SuggestionForHistory {
  id: string;
  type: 'habit' | 'goal';
  name?: string;
  description?: string;
  category?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  data: Record<string, unknown>;
  messageId?: string;
  createdAt?: string;
}

/**
 * Return type for useSuggestionHistory hook
 */
export interface UseSuggestionHistoryReturn {
  /** Full history list */
  history: SuggestionHistoryItem[];
  /** Add or update a suggestion in history */
  addToHistory: (suggestion: SuggestionForHistory, status: SuggestionHistoryStatus) => void;
  /** Update status of an existing history item */
  updateStatus: (id: string, status: SuggestionHistoryStatus) => void;
  /** Filter history by criteria */
  filter: (filter: SuggestionHistoryFilter) => SuggestionHistoryItem[];
  /** Get a single history item by ID */
  getById: (id: string) => SuggestionHistoryItem | undefined;
  /** Get items by suggestion ID */
  getBySuggestionId: (suggestionId: string) => SuggestionHistoryItem | undefined;
  /** Remove an item from history */
  remove: (id: string) => void;
  /** Clear all history */
  clear: () => void;
  /** Get history stats */
  stats: {
    total: number;
    accepted: number;
    dismissed: number;
    snoozed: number;
    habits: number;
    goals: number;
  };
}

const STORAGE_KEY = 'vow_suggestion_history';
const MAX_HISTORY_ITEMS = 100;

/**
 * Hook for managing suggestion history
 *
 * @returns Suggestion history management object
 */
export function useSuggestionHistory(): UseSuggestionHistoryReturn {
  const { value: history, setValue: setHistory } = useLocalStorageObject<SuggestionHistoryItem[]>(
    STORAGE_KEY,
    []
  );

  /**
   * Add or update a suggestion in history
   */
  const addToHistory = useCallback(
    (suggestion: SuggestionForHistory, status: SuggestionHistoryStatus) => {
      const now = new Date().toISOString();

      setHistory((prev: SuggestionHistoryItem[]) => {
        // Check if suggestion already exists
        const existingIndex = prev.findIndex((h: SuggestionHistoryItem) => h.suggestionId === suggestion.id);

        const newItem: SuggestionHistoryItem = {
          id: existingIndex >= 0 ? prev[existingIndex].id : `history-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          suggestionId: suggestion.id,
          messageId: suggestion.messageId,
          type: suggestion.type,
          name: suggestion.name || (suggestion.data.name as string) || 'Unnamed suggestion',
          description: suggestion.description || (suggestion.data.description as string),
          category: suggestion.category || (suggestion.data.category as string),
          difficulty: suggestion.difficulty || (suggestion.data.difficulty as 'beginner' | 'intermediate' | 'advanced'),
          data: suggestion.data,
          status,
          createdAt: existingIndex >= 0 ? prev[existingIndex].createdAt : (suggestion.createdAt || now),
          statusChangedAt: now,
        };

        let updated: SuggestionHistoryItem[];

        if (existingIndex >= 0) {
          // Update existing item
          updated = [...prev];
          updated[existingIndex] = newItem;
        } else {
          // Add new item at the beginning
          updated = [newItem, ...prev];
        }

        // Trim to max items
        if (updated.length > MAX_HISTORY_ITEMS) {
          updated = updated.slice(0, MAX_HISTORY_ITEMS);
        }

        return updated;
      });

      debug.log('[useSuggestionHistory] Added/updated suggestion:', {
        suggestionId: suggestion.id,
        status,
      });
    },
    [setHistory]
  );

  /**
   * Update status of an existing history item
   */
  const updateStatus = useCallback(
    (id: string, status: SuggestionHistoryStatus) => {
      setHistory((prev: SuggestionHistoryItem[]) => {
        const index = prev.findIndex((h: SuggestionHistoryItem) => h.id === id);
        if (index === -1) return prev;

        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          status,
          statusChangedAt: new Date().toISOString(),
        };

        return updated;
      });

      debug.log('[useSuggestionHistory] Updated status:', { id, status });
    },
    [setHistory]
  );

  /**
   * Filter history by criteria
   */
  const filterHistory = useCallback(
    (filter: SuggestionHistoryFilter): SuggestionHistoryItem[] => {
      return history.filter((item: SuggestionHistoryItem) => {
        // Type filter
        if (filter.type && filter.type !== 'all' && item.type !== filter.type) {
          return false;
        }

        // Status filter
        if (filter.status && filter.status !== 'all' && item.status !== filter.status) {
          return false;
        }

        // Category filter
        if (filter.category && item.category !== filter.category) {
          return false;
        }

        // Difficulty filter
        if (filter.difficulty && item.difficulty !== filter.difficulty) {
          return false;
        }

        // Search filter
        if (filter.search) {
          const searchLower = filter.search.toLowerCase();
          const nameMatch = item.name?.toLowerCase().includes(searchLower);
          const descMatch = item.description?.toLowerCase().includes(searchLower);
          if (!nameMatch && !descMatch) {
            return false;
          }
        }

        return true;
      });
    },
    [history]
  );

  /**
   * Get a single history item by ID
   */
  const getById = useCallback(
    (id: string): SuggestionHistoryItem | undefined => {
      return history.find((h: SuggestionHistoryItem) => h.id === id);
    },
    [history]
  );

  /**
   * Get items by suggestion ID
   */
  const getBySuggestionId = useCallback(
    (suggestionId: string): SuggestionHistoryItem | undefined => {
      return history.find((h: SuggestionHistoryItem) => h.suggestionId === suggestionId);
    },
    [history]
  );

  /**
   * Remove an item from history
   */
  const remove = useCallback(
    (id: string) => {
      setHistory((prev: SuggestionHistoryItem[]) => prev.filter((h: SuggestionHistoryItem) => h.id !== id));
      debug.log('[useSuggestionHistory] Removed item:', id);
    },
    [setHistory]
  );

  /**
   * Clear all history
   */
  const clear = useCallback(() => {
    setHistory([]);
    debug.log('[useSuggestionHistory] Cleared all history');
  }, [setHistory]);

  /**
   * Calculate stats
   */
  const stats = useMemo(() => {
    return {
      total: history.length,
      accepted: history.filter((h: SuggestionHistoryItem) => h.status === 'accepted').length,
      dismissed: history.filter((h: SuggestionHistoryItem) => h.status === 'dismissed').length,
      snoozed: history.filter((h: SuggestionHistoryItem) => h.status === 'snoozed').length,
      habits: history.filter((h: SuggestionHistoryItem) => h.type === 'habit').length,
      goals: history.filter((h: SuggestionHistoryItem) => h.type === 'goal').length,
    };
  }, [history]);

  // Filter out items with invalid data
  const validHistory = useMemo(
    () => history.filter((h: SuggestionHistoryItem) => h.id && h.suggestionId && h.type && h.status),
    [history]
  );

  return {
    history: validHistory,
    addToHistory,
    updateStatus,
    filter: filterHistory,
    getById,
    getBySuggestionId,
    remove,
    clear,
    stats,
  };
}

/**
 * Format date for display
 */
export function formatHistoryDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
}

/**
 * Get status label in Japanese
 */
export function getStatusLabel(status: SuggestionHistoryStatus): string {
  const labels: Record<SuggestionHistoryStatus, string> = {
    accepted: 'Accepted',
    dismissed: 'Dismissed',
    snoozed: 'Snoozed',
  };
  return labels[status];
}

/**
 * Get status label in Japanese
 */
export function getStatusLabelJa(status: SuggestionHistoryStatus): string {
  const labels: Record<SuggestionHistoryStatus, string> = {
    accepted: '受諾',
    dismissed: '却下',
    snoozed: 'スヌーズ中',
  };
  return labels[status];
}
