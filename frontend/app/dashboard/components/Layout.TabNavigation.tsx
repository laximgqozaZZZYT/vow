"use client";

import { useLocale } from '@/contexts/LocaleContext';
import type { TabConfig } from '../constants/tabConfig';

interface TabNavigationProps {
  tabs: TabConfig[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

/**
 * Tab navigation component for dashboard sections
 * Follows design system: CSS variables, 8px spacing, rounded-md
 */
export function TabNavigation({
  tabs,
  activeTab,
  onTabChange,
  className = '',
}: TabNavigationProps) {
  const { locale } = useLocale();

  if (tabs.length === 0) {
    return null;
  }

  return (
    <nav
      className={`
        flex items-center gap-1
        overflow-x-auto scrollbar-hide
        bg-card border-b border-border
        px-2 py-1
        ${className}
      `}
      role="tablist"
      aria-label="Dashboard sections"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        const label = locale === 'ja' ? tab.labelJa : tab.label;

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
            className={`
              flex items-center gap-1.5
              px-3 py-2
              min-w-[44px] min-h-[44px]
              text-sm font-medium
              rounded-md
              whitespace-nowrap
              transition-colors duration-150
              focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2
              ${isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }
            `}
          >
            <span className="text-base" aria-hidden="true">
              {tab.icon}
            </span>
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default TabNavigation;
