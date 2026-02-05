/**
 * useBulkSelection Hook
 *
 * Generic hook for managing multi-select functionality.
 * Features:
 * - Toggle individual items
 * - Select/deselect all
 * - Shift+click range selection
 * - Get selected items
 *
 * @module hooks/useBulkSelection
 */

import { useState, useCallback, useMemo, useRef } from 'react';

/**
 * Item that can be selected (must have an id property)
 */
export interface Selectable {
  id: string;
}

/**
 * Return type for useBulkSelection hook
 */
export interface UseBulkSelectionReturn<T extends Selectable> {
  /** Set of selected item IDs */
  selectedIds: Set<string>;
  /** Number of selected items */
  selectedCount: number;
  /** Check if an item is selected */
  isSelected: (id: string) => boolean;
  /** Toggle selection of a single item */
  toggle: (id: string) => void;
  /** Handle click with shift-key support for range selection */
  handleClick: (id: string, event?: { shiftKey?: boolean }) => void;
  /** Select specific items by ID */
  select: (ids: string[]) => void;
  /** Deselect specific items by ID */
  deselect: (ids: string[]) => void;
  /** Select all items */
  selectAll: () => void;
  /** Clear all selections */
  clearSelection: () => void;
  /** Toggle all items */
  toggleAll: () => void;
  /** Get the selected items */
  selectedItems: T[];
  /** Whether all items are selected */
  allSelected: boolean;
  /** Whether some (but not all) items are selected */
  someSelected: boolean;
}

/**
 * Hook for managing bulk selection of items
 *
 * @param items - Array of items that can be selected
 * @returns Bulk selection management object
 */
export function useBulkSelection<T extends Selectable>(
  items: T[]
): UseBulkSelectionReturn<T> {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastSelectedRef = useRef<string | null>(null);

  /**
   * Check if an item is selected
   */
  const isSelected = useCallback(
    (id: string): boolean => selectedIds.has(id),
    [selectedIds]
  );

  /**
   * Toggle selection of a single item
   */
  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    lastSelectedRef.current = id;
  }, []);

  /**
   * Handle click with shift-key support for range selection
   */
  const handleClick = useCallback(
    (id: string, event?: { shiftKey?: boolean }) => {
      if (event?.shiftKey && lastSelectedRef.current) {
        // Range selection
        const startIndex = items.findIndex((item) => item.id === lastSelectedRef.current);
        const endIndex = items.findIndex((item) => item.id === id);

        if (startIndex !== -1 && endIndex !== -1) {
          const start = Math.min(startIndex, endIndex);
          const end = Math.max(startIndex, endIndex);
          const rangeIds = items.slice(start, end + 1).map((item) => item.id);

          setSelectedIds((prev) => {
            const next = new Set(prev);
            rangeIds.forEach((rangeId) => next.add(rangeId));
            return next;
          });
        }
      } else {
        toggle(id);
      }
    },
    [items, toggle]
  );

  /**
   * Select specific items by ID
   */
  const select = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    if (ids.length > 0) {
      lastSelectedRef.current = ids[ids.length - 1];
    }
  }, []);

  /**
   * Deselect specific items by ID
   */
  const deselect = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  /**
   * Select all items
   */
  const selectAll = useCallback(() => {
    const allIds = items.map((item) => item.id);
    setSelectedIds(new Set(allIds));
    if (allIds.length > 0) {
      lastSelectedRef.current = allIds[allIds.length - 1];
    }
  }, [items]);

  /**
   * Clear all selections
   */
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    lastSelectedRef.current = null;
  }, []);

  /**
   * Toggle all items
   */
  const toggleAll = useCallback(() => {
    const allIds = items.map((item) => item.id);
    setSelectedIds((prev) => {
      if (prev.size === allIds.length) {
        // All selected, clear all
        return new Set();
      } else {
        // Not all selected, select all
        return new Set(allIds);
      }
    });
  }, [items]);

  /**
   * Get the selected items
   */
  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds]
  );

  /**
   * Whether all items are selected
   */
  const allSelected = useMemo(
    () => items.length > 0 && selectedIds.size === items.length,
    [items, selectedIds]
  );

  /**
   * Whether some (but not all) items are selected
   */
  const someSelected = useMemo(
    () => selectedIds.size > 0 && selectedIds.size < items.length,
    [items, selectedIds]
  );

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    isSelected,
    toggle,
    handleClick,
    select,
    deselect,
    selectAll,
    clearSelection,
    toggleAll,
    selectedItems,
    allSelected,
    someSelected,
  };
}

/**
 * Lightweight version without items tracking
 * Useful when you just need ID management
 */
export function useBulkSelectionIds(): Omit<
  UseBulkSelectionReturn<Selectable>,
  'selectedItems' | 'allSelected' | 'someSelected' | 'selectAll' | 'toggleAll'
> & {
  addAll: (ids: string[]) => void;
} {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastSelectedRef = useRef<string | null>(null);

  const isSelected = useCallback(
    (id: string): boolean => selectedIds.has(id),
    [selectedIds]
  );

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    lastSelectedRef.current = id;
  }, []);

  const handleClick = useCallback(
    (id: string, event?: { shiftKey?: boolean }) => {
      // Without items array, we can only do simple toggle
      toggle(id);
    },
    [toggle]
  );

  const select = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  const deselect = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  const addAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    lastSelectedRef.current = null;
  }, []);

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    isSelected,
    toggle,
    handleClick,
    select,
    deselect,
    clearSelection,
    addAll,
  };
}
