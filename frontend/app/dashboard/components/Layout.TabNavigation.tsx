"use client";

import { useLocale } from '@/contexts/LocaleContext';
import type { TabConfig } from '../constants/tabConfig';
import { normalizeTabId } from '../constants/tabConfig';

interface TabNavigationProps {
  tabs: TabConfig[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

// SVG Icons - Linear/Vercel style (thin strokes, minimal)
const TabIcon = ({ type, className = '' }: { type: TabConfig['iconType']; className?: string }) => {
  const iconProps = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
  };

  switch (type) {
    case 'board':
      // Kanban board icon (3 columns)
      return (
        <svg {...iconProps}>
          <rect x="3" y="3" width="5" height="18" rx="1" />
          <rect x="10" y="3" width="5" height="12" rx="1" />
          <rect x="17" y="3" width="5" height="15" rx="1" />
        </svg>
      );
    case 'next':
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case 'activity':
      return (
        <svg {...iconProps}>
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...iconProps}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case 'statistics':
      return (
        <svg {...iconProps}>
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      );
    case 'diary':
      return (
        <svg {...iconProps}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      );
    case 'stickies':
      return (
        <svg {...iconProps}>
          <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8z" />
          <polyline points="16 3 16 8 21 8" />
        </svg>
      );
    case 'mindmap':
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="3" />
          <circle cx="19" cy="5" r="2" />
          <circle cx="5" cy="5" r="2" />
          <circle cx="19" cy="19" r="2" />
          <circle cx="5" cy="19" r="2" />
          <line x1="14.5" y1="9.5" x2="17.5" y2="6.5" />
          <line x1="9.5" y1="9.5" x2="6.5" y2="6.5" />
          <line x1="14.5" y1="14.5" x2="17.5" y2="17.5" />
          <line x1="9.5" y1="14.5" x2="6.5" y2="17.5" />
        </svg>
      );
    case 'notices':
      return (
        <svg {...iconProps}>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    case 'coach':
      return (
        <svg {...iconProps}>
          <path d="M12 2a3 3 0 0 0-3 3v4a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      );
    default:
      return null;
  }
};

/**
 * Vertical tab navigation component for dashboard sections
 * Linear/Vercel style - minimal, clean, dark mode optimized
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
        bg-background/80 backdrop-blur-md
        border-r border-border/50
        transition-all duration-200 ease-out
        ${collapsed ? 'w-[52px]' : 'w-[72px]'}
        ${className}
      `}
      role="tablist"
      aria-label="Dashboard sections"
      aria-orientation="vertical"
    >
      {/* Tab list */}
      <div className="flex-1 py-3 overflow-y-auto scrollbar-hide">
        <div className="flex flex-col items-center gap-1">
          {tabs.map((tab) => {
            // Normalize activeTab for comparison (e.g., 'next' -> 'board')
            const normalizedActiveTab = normalizeTabId(activeTab);
            const isActive = tab.id === normalizedActiveTab;
            const label = locale === 'ja' ? tab.labelJa : tab.label;

            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${tab.id}`}
                id={`tab-${tab.id}`}
                onClick={() => onTabChange(tab.id)}
                title={label}
                className={`
                  group
                  flex flex-col items-center justify-center
                  w-[48px] h-[56px]
                  rounded-lg
                  transition-all duration-150 ease-out
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
                  ${isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }
                `}
              >
                <TabIcon 
                  type={tab.iconType} 
                  className={`
                    transition-transform duration-150
                    ${isActive ? 'scale-105' : 'group-hover:scale-105'}
                  `}
                />
                {!collapsed && (
                  <span 
                    className={`
                      mt-1 text-[10px] font-medium tracking-tight
                      transition-opacity duration-150
                      ${isActive ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}
                    `}
                    style={{ writingMode: 'horizontal-tb' }}
                  >
                    {label}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>


    </nav>
  );
}

export default TabNavigation;
