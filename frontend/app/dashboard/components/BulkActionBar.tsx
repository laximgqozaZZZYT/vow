/**
 * BulkActionBar Component
 *
 * Action bar for bulk operations on selected suggestions.
 * Displays selection count and action buttons.
 *
 * @module components/BulkActionBar
 */

'use client';

import React from 'react';

export interface BulkActionBarProps {
  /** Number of selected items */
  selectedCount: number;
  /** Total number of items */
  totalCount: number;
  /** Whether all items are selected */
  allSelected: boolean;
  /** Whether some (but not all) items are selected */
  someSelected: boolean;
  /** Callback for select all toggle */
  onToggleAll: () => void;
  /** Callback for accepting selected items */
  onAcceptSelected: () => void;
  /** Callback for dismissing selected items */
  onDismissSelected: () => void;
  /** Callback for snoozing selected items */
  onSnoozeSelected: () => void;
  /** Callback for clearing selection */
  onClearSelection: () => void;
  /** Whether actions are currently processing */
  isProcessing?: boolean;
  /** Additional className */
  className?: string;
  /** Locale for labels */
  locale?: 'ja' | 'en';
}

const LABELS = {
  en: {
    selected: 'selected',
    selectAll: 'Select All',
    deselectAll: 'Deselect All',
    accept: 'Accept',
    acceptAll: 'Accept All',
    dismiss: 'Dismiss',
    dismissAll: 'Dismiss All',
    snooze: 'Snooze',
    snoozeAll: 'Snooze All',
    clear: 'Clear',
    processing: 'Processing...',
  },
  ja: {
    selected: '???',
    selectAll: '???',
    deselectAll: '???',
    accept: '??',
    acceptAll: '???',
    dismiss: '??',
    dismissAll: '???',
    snooze: '??',
    snoozeAll: '???',
    clear: '???',
    processing: '???...',
  },
};

/**
 * Bulk action bar component
 */
export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount,
  totalCount,
  allSelected,
  someSelected,
  onToggleAll,
  onAcceptSelected,
  onDismissSelected,
  onSnoozeSelected,
  onClearSelection,
  isProcessing = false,
  className = '',
  locale = 'en',
}) => {
  const labels = LABELS[locale];

  if (selectedCount === 0) {
    return null;
  }

  const buttonBaseClasses =
    'px-3 py-1.5 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div
      className={`
        flex flex-wrap items-center justify-between gap-3
        p-3 bg-blue-50 dark:bg-blue-900/20
        border border-blue-200 dark:border-blue-800
        rounded-lg shadow-sm
        ${className}
      `}
      role="toolbar"
      aria-label="Bulk actions"
    >
      {/* Selection info */}
      <div className="flex items-center gap-3">
        {/* Select all checkbox */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(input) => {
              if (input) {
                input.indeterminate = someSelected;
              }
            }}
            onChange={onToggleAll}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            disabled={isProcessing}
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {allSelected ? labels.deselectAll : labels.selectAll}
          </span>
        </label>

        {/* Selection count */}
        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
          {selectedCount} / {totalCount} {labels.selected}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        {/* Accept button */}
        <button
          onClick={onAcceptSelected}
          disabled={isProcessing}
          className={`
            ${buttonBaseClasses}
            bg-green-500 hover:bg-green-600 text-white
          `}
          aria-label={`${labels.accept} ${selectedCount} items`}
        >
          {isProcessing ? labels.processing : `${labels.accept} (${selectedCount})`}
        </button>

        {/* Snooze button */}
        <button
          onClick={onSnoozeSelected}
          disabled={isProcessing}
          className={`
            ${buttonBaseClasses}
            bg-yellow-500 hover:bg-yellow-600 text-white
          `}
          aria-label={`${labels.snooze} ${selectedCount} items`}
        >
          {labels.snooze}
        </button>

        {/* Dismiss button */}
        <button
          onClick={onDismissSelected}
          disabled={isProcessing}
          className={`
            ${buttonBaseClasses}
            bg-gray-500 hover:bg-gray-600 text-white
          `}
          aria-label={`${labels.dismiss} ${selectedCount} items`}
        >
          {labels.dismiss}
        </button>

        {/* Clear selection button */}
        <button
          onClick={onClearSelection}
          disabled={isProcessing}
          className={`
            ${buttonBaseClasses}
            text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200
          `}
          aria-label="Clear selection"
        >
          {labels.clear}
        </button>
      </div>
    </div>
  );
};

/**
 * Compact version for inline use
 */
export const BulkActionBarCompact: React.FC<
  Omit<BulkActionBarProps, 'onToggleAll' | 'allSelected' | 'someSelected'>
> = ({
  selectedCount,
  totalCount,
  onAcceptSelected,
  onDismissSelected,
  onSnoozeSelected,
  onClearSelection,
  isProcessing = false,
  className = '',
  locale = 'en',
}) => {
  const labels = LABELS[locale];

  if (selectedCount === 0) {
    return null;
  }

  return (
    <div
      className={`
        flex items-center gap-2 px-2 py-1
        bg-blue-100 dark:bg-blue-900/30 rounded
        ${className}
      `}
      role="toolbar"
      aria-label="Bulk actions"
    >
      <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">
        {selectedCount} {labels.selected}
      </span>

      <div className="flex items-center gap-1">
        <button
          onClick={onAcceptSelected}
          disabled={isProcessing}
          className="p-1 text-green-600 hover:text-green-700 disabled:opacity-50"
          title={labels.accept}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </button>

        <button
          onClick={onSnoozeSelected}
          disabled={isProcessing}
          className="p-1 text-yellow-600 hover:text-yellow-700 disabled:opacity-50"
          title={labels.snooze}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </button>

        <button
          onClick={onDismissSelected}
          disabled={isProcessing}
          className="p-1 text-gray-600 hover:text-gray-700 disabled:opacity-50"
          title={labels.dismiss}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <button
          onClick={onClearSelection}
          disabled={isProcessing}
          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 ml-1"
          title={labels.clear}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default BulkActionBar;
