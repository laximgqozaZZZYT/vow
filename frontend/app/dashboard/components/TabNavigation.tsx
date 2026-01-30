"use client";

import React, { useCallback, useRef } from 'react';

/**
 * Tab configuration interface
 */
export interface TabConfig {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

/**
 * TabNavigation component props
 */
export interface TabNavigationProps {
  tabs: TabConfig[];
  activeTab: number;
  onTabChange: (index: number) => void;
  hasErrors?: Record<string, boolean>; // タブごとのエラー状態
  className?: string;
  /** ID prefix for ARIA associations (defaults to 'habit-modal') */
  idPrefix?: string;
}

/**
 * Default tabs for the Habit Modal
 * 基本 → 除外日時 → 負荷 → 詳細
 */
export const HABIT_MODAL_TABS: TabConfig[] = [
  { id: 'basic', label: '基本' },
  { id: 'exclusion', label: '除外日時' },
  { id: 'workload', label: '負荷' },
  { id: 'detail', label: '詳細' },
];

/**
 * TabNavigation Component
 * 
 * A horizontal tab navigation component with:
 * - 44px minimum touch targets (Requirement 6.1)
 * - Active tab visual indicator using primary color (Requirements 1.4, 12.2)
 * - ARIA roles (tablist, tab) and aria-selected (Requirements 11.2, 11.4)
 * - Keyboard navigation with ArrowLeft, ArrowRight, Enter, Space (Requirements 11.1, 11.3)
 * - Error indicator support for validation errors (Requirement 8.4)
 * - Design system color tokens (Requirement 12.1)
 */
export function TabNavigation({
  tabs,
  activeTab,
  onTabChange,
  hasErrors,
  className = '',
  idPrefix = 'habit-modal',
}: TabNavigationProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  /**
   * Handle keyboard navigation
   * - ArrowLeft/ArrowRight: Move focus between tabs
   * - Enter/Space: Activate the focused tab
   */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
      let newIndex: number | null = null;

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          // Move focus to previous tab (wrap to last if at first)
          newIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
          break;
        case 'ArrowRight':
          event.preventDefault();
          // Move focus to next tab (wrap to first if at last)
          newIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          // Activate the currently focused tab
          onTabChange(currentIndex);
          return;
        case 'Home':
          event.preventDefault();
          newIndex = 0;
          break;
        case 'End':
          event.preventDefault();
          newIndex = tabs.length - 1;
          break;
        default:
          return;
      }

      // Move focus to the new tab
      if (newIndex !== null && tabRefs.current[newIndex]) {
        tabRefs.current[newIndex]?.focus();
      }
    },
    [tabs.length, onTabChange]
  );

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div
      role="tablist"
      aria-label="Habit modal sections"
      className={`
        flex
        w-full
        border-b border-border
        bg-card
        /* Mobile: horizontally scrollable tabs (Requirement 9.1) */
        overflow-x-auto
        scrollbar-hide
        -webkit-overflow-scrolling-touch
        /* Desktop: all tabs visible without scrolling (Requirement 9.3) */
        md:overflow-x-visible
        md:justify-start
        ${className}
      `}
    >
      {tabs.map((tab, index) => {
        const isActive = index === activeTab;
        const hasError = hasErrors?.[tab.id] ?? false;
        const tabId = `${idPrefix}-tab-${tab.id}`;
        const panelId = `${idPrefix}-tabpanel-${tab.id}`;

        return (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            role="tab"
            id={tabId}
            aria-selected={isActive}
            aria-controls={panelId}
            aria-invalid={hasError}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onTabChange(index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`
              relative
              flex items-center justify-center
              /* Mobile: ensure minimum touch target and allow scrolling (Requirement 6.1, 9.1) */
              min-w-[44px] min-h-[44px]
              px-3 py-3
              /* Desktop: slightly more padding for better spacing */
              md:px-4
              text-sm font-medium
              whitespace-nowrap
              /* Smooth transitions with reduced-motion support (Requirement 12.4) */
              transition-colors duration-150
              motion-reduce:transition-none
              focus-visible:outline-none
              focus-visible:ring-2
              focus-visible:ring-primary
              focus-visible:ring-inset
              /* Mobile: flex-shrink to allow scrolling */
              flex-shrink-0
              /* Desktop: allow tabs to take natural width */
              md:flex-shrink-0
              ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }
            `}
          >
            {/* Tab icon (if provided) */}
            {tab.icon && <span className="mr-2">{tab.icon}</span>}
            
            {/* Tab label */}
            <span>{tab.label}</span>

            {/* Error indicator dot */}
            {hasError && (
              <span
                className="
                  absolute top-2 right-2
                  w-2 h-2
                  bg-destructive
                  rounded-full
                "
                aria-label="このタブにエラーがあります"
              />
            )}

            {/* Active tab indicator (bottom border) with smooth transition */}
            <span
              className={`
                absolute bottom-0 left-0 right-0
                h-0.5
                bg-primary
                /* Smooth opacity transition with reduced-motion support (Requirement 12.4) */
                transition-opacity duration-200
                motion-reduce:transition-none
                ${isActive ? 'opacity-100' : 'opacity-0'}
              `}
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>
  );
}

export default TabNavigation;
