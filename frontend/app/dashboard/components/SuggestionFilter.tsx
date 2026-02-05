/**
 * SuggestionFilter Component
 *
 * Filter UI for suggestions by type, category, difficulty, and status.
 * Used in both chat view and history tab.
 *
 * @module components/SuggestionFilter
 */

'use client';

import React, { useCallback } from 'react';

/**
 * Filter state for suggestions
 */
export interface SuggestionFilterState {
  type: 'all' | 'habit' | 'goal';
  category: string;
  difficulty: '' | 'beginner' | 'intermediate' | 'advanced';
  status?: 'all' | 'pending' | 'accepted' | 'snoozed' | 'dismissed';
}

export interface SuggestionFilterProps {
  /** Current filter state */
  filter: SuggestionFilterState;
  /** Callback when filter changes */
  onChange: (filter: SuggestionFilterState) => void;
  /** Available categories */
  categories?: string[];
  /** Whether to show status filter */
  showStatusFilter?: boolean;
  /** Compact mode for inline display */
  compact?: boolean;
  /** Additional className */
  className?: string;
  /** Locale for labels */
  locale?: 'ja' | 'en';
}

// Default categories
const DEFAULT_CATEGORIES = [
  'Health',
  'Learning',
  'Work',
  'Hobby',
  'Mindfulness',
  'Finance',
  'Relationship',
  'Other',
];

const DEFAULT_CATEGORIES_JA = [
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
];

// Labels
const LABELS = {
  en: {
    type: {
      all: 'All Types',
      habit: 'Habits',
      goal: 'Goals',
    },
    category: {
      all: 'All Categories',
    },
    difficulty: {
      all: 'All Levels',
      beginner: 'Beginner',
      intermediate: 'Intermediate',
      advanced: 'Advanced',
    },
    status: {
      all: 'All Status',
      pending: 'Pending',
      accepted: 'Accepted',
      snoozed: 'Snoozed',
      dismissed: 'Dismissed',
    },
    clear: 'Clear Filters',
  },
  ja: {
    type: {
      all: 'All',
      habit: 'Habit',
      goal: 'Goal',
    },
    category: {
      all: 'All',
    },
    difficulty: {
      all: 'All',
      beginner: 'Beginner',
      intermediate: 'Intermediate',
      advanced: 'Advanced',
    },
    status: {
      all: 'All',
      pending: 'Pending',
      accepted: 'Accepted',
      snoozed: 'Snoozed',
      dismissed: 'Dismissed',
    },
    clear: 'Clear',
  },
};

/**
 * Suggestion filter component
 */
export const SuggestionFilter: React.FC<SuggestionFilterProps> = ({
  filter,
  onChange,
  categories = DEFAULT_CATEGORIES,
  showStatusFilter = false,
  compact = false,
  className = '',
  locale = 'en',
}) => {
  const labels = LABELS[locale];

  const handleTypeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange({ ...filter, type: e.target.value as SuggestionFilterState['type'] });
    },
    [filter, onChange]
  );

  const handleCategoryChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange({ ...filter, category: e.target.value });
    },
    [filter, onChange]
  );

  const handleDifficultyChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange({
        ...filter,
        difficulty: e.target.value as SuggestionFilterState['difficulty'],
      });
    },
    [filter, onChange]
  );

  const handleStatusChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange({
        ...filter,
        status: e.target.value as SuggestionFilterState['status'],
      });
    },
    [filter, onChange]
  );

  const handleClearFilters = useCallback(() => {
    onChange({
      type: 'all',
      category: '',
      difficulty: '',
      status: 'all',
    });
  }, [onChange]);

  const hasActiveFilters =
    filter.type !== 'all' ||
    filter.category !== '' ||
    filter.difficulty !== '' ||
    (showStatusFilter && filter.status !== 'all');

  const selectClasses = compact
    ? 'px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500'
    : 'px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

  const containerClasses = compact
    ? `flex flex-wrap items-center gap-2 ${className}`
    : `flex flex-wrap items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg ${className}`;

  return (
    <div className={containerClasses} role="group" aria-label="Suggestion filters">
      {/* Type filter */}
      <select
        value={filter.type}
        onChange={handleTypeChange}
        className={selectClasses}
        aria-label="Filter by type"
      >
        <option value="all">{labels.type.all}</option>
        <option value="habit">{labels.type.habit}</option>
        <option value="goal">{labels.type.goal}</option>
      </select>

      {/* Category filter */}
      <select
        value={filter.category}
        onChange={handleCategoryChange}
        className={selectClasses}
        aria-label="Filter by category"
      >
        <option value="">{labels.category.all}</option>
        {categories.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </select>

      {/* Difficulty filter */}
      <select
        value={filter.difficulty}
        onChange={handleDifficultyChange}
        className={selectClasses}
        aria-label="Filter by difficulty"
      >
        <option value="">{labels.difficulty.all}</option>
        <option value="beginner">{labels.difficulty.beginner}</option>
        <option value="intermediate">{labels.difficulty.intermediate}</option>
        <option value="advanced">{labels.difficulty.advanced}</option>
      </select>

      {/* Status filter (optional) */}
      {showStatusFilter && (
        <select
          value={filter.status || 'all'}
          onChange={handleStatusChange}
          className={selectClasses}
          aria-label="Filter by status"
        >
          <option value="all">{labels.status.all}</option>
          <option value="pending">{labels.status.pending}</option>
          <option value="accepted">{labels.status.accepted}</option>
          <option value="snoozed">{labels.status.snoozed}</option>
          <option value="dismissed">{labels.status.dismissed}</option>
        </select>
      )}

      {/* Clear filters button */}
      {hasActiveFilters && (
        <button
          onClick={handleClearFilters}
          className={`${
            compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'
          } text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors`}
          aria-label="Clear all filters"
        >
          {labels.clear}
        </button>
      )}
    </div>
  );
};

/**
 * Pill-style filter for quick toggles
 */
export const SuggestionFilterPills: React.FC<{
  filter: SuggestionFilterState;
  onChange: (filter: SuggestionFilterState) => void;
  className?: string;
}> = ({ filter, onChange, className = '' }) => {
  const types: Array<{ value: 'all' | 'habit' | 'goal'; label: string; icon: string }> = [
    { value: 'all', label: 'All', icon: '' },
    { value: 'habit', label: 'Habits', icon: '' },
    { value: 'goal', label: 'Goals', icon: '' },
  ];

  return (
    <div className={`flex gap-1 ${className}`} role="group" aria-label="Quick filters">
      {types.map(({ value, label, icon }) => (
        <button
          key={value}
          onClick={() => onChange({ ...filter, type: value })}
          className={`
            px-3 py-1 text-sm rounded-full transition-colors
            ${
              filter.type === value
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }
          `}
          aria-pressed={filter.type === value}
        >
          {icon} {label}
        </button>
      ))}
    </div>
  );
};

export default SuggestionFilter;
