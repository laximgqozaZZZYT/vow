"use client";

import { useLocale } from '@/contexts/LocaleContext';
import type { TabConfig } from '../constants/tabConfig';

interface TabNavigationProps {
  tabs: TabConfig[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

/**
 * Vertical tab navigation component for dashboard sections
 * Positioned on the left side of the main content
 * Follows design system: CSS variables, 8px spacing, rounded-md
 */
export function TabNavigation({
  tabs,
  activeTab,
  onTabChange,
  className = '',
  collapsed = false,
  onToggleCollapse,
}: TabNavigationProps) {
  const { locale } = useLocale();

  if (tabs.length === 0) {
    return null;
  }

  return (
    <nav
      className={`
        flex flex-col
        h-full
        bg-card/50 backdrop-blur-sm
        border-r border-border
        transition-all duration-200 ease-in-out
        ${collapsed ? 'w-14' : 'w-48'}
        ${className}
      `}
      role="tablist"
      aria-label="Dashboard sections"
      aria-orientation="vertical"
    >
      {/* Tab list */}
      <div className="flex-1 py-2 overflow-y-auto scrollbar-hide">
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
              title={collapsed ? label : undefined}
              className={`
                flex items-center gap-3
                w-full
                px-3 py-2.5
                min-h-[44px]
                text-sm font-medium
                transition-all duration-150
                focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-[-2px]
                ${collapsed ? 'justify-center' : 'justify-start'}
                ${isActive
                  ? 'bg-primary/10 text-primary border-l-2 border-primary'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground border-l-2 border-transparent'
                }
              `}
            >
              <span className={`text-lg flex-shrink-0 ${isActive ? 'scale-110' : ''} transition-transform`} aria-hidden="true">
                {tab.icon}
              </span>
              {!collapsed && (
                <span className="truncate">{label}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Collapse toggle button */}
      {onToggleCollapse && (
        <div className="border-t border-border p-2">
          <button
            onClick={onToggleCollapse}
            className="
              flex items-center justify-center
              w-full
              p-2
              rounded-md
              text-muted-foreground
              hover:bg-muted hover:text-foreground
              transition-colors
            "
            aria-label={collapsed ? (locale === 'ja' ? 'メニューを展開' : 'Expand menu') : (locale === 'ja' ? 'メニューを折りたたむ' : 'Collapse menu')}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
            >
              <path d="m11 17-5-5 5-5" />
              <path d="m18 17-5-5 5-5" />
            </svg>
          </button>
        </div>
      )}
    </nav>
  );
}

export default TabNavigation;
