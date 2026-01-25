"use client";

import { useLocale } from '@/contexts/LocaleContext';
import { getTabById } from '../constants/tabConfig';
import type { TabConfig } from '../constants/tabConfig';

interface TabContentProps {
  activeTab: string;
  isFullView: boolean;
  onToggleFullView: () => void;
  onExitFullView: () => void;
  supportsFullView: boolean;
  children: React.ReactNode;
}

// Tab Icon for full view header
const TabIcon = ({ type }: { type: TabConfig['iconType'] }) => {
  const iconProps = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (type) {
    case 'next':
      return <svg {...iconProps}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
    case 'activity':
      return <svg {...iconProps}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>;
    case 'calendar':
      return <svg {...iconProps}><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
    case 'statistics':
      return <svg {...iconProps}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>;
    case 'diary':
      return <svg {...iconProps}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>;
    case 'stickies':
      return <svg {...iconProps}><path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8z" /><polyline points="16 3 16 8 21 8" /></svg>;
    case 'mindmap':
      return <svg {...iconProps}><circle cx="12" cy="12" r="3" /><circle cx="19" cy="5" r="2" /><circle cx="5" cy="5" r="2" /><circle cx="19" cy="19" r="2" /><circle cx="5" cy="19" r="2" /><line x1="14.5" y1="9.5" x2="17.5" y2="6.5" /><line x1="9.5" y1="9.5" x2="6.5" y2="6.5" /><line x1="14.5" y1="14.5" x2="17.5" y2="17.5" /><line x1="9.5" y1="14.5" x2="6.5" y2="17.5" /></svg>;
    case 'notices':
      return <svg {...iconProps}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>;
    case 'coach':
      return <svg {...iconProps}><path d="M12 2a3 3 0 0 0-3 3v4a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" /></svg>;
    default:
      return null;
  }
};

/**
 * Tab content wrapper with full view mode support
 */
export function TabContent({
  activeTab,
  isFullView,
  onToggleFullView,
  onExitFullView,
  supportsFullView,
  children,
}: TabContentProps) {
  const { locale } = useLocale();
  const tabConfig = getTabById(activeTab);
  const tabLabel = tabConfig 
    ? (locale === 'ja' ? tabConfig.labelJa : tabConfig.label)
    : activeTab;

  // Full view overlay
  if (isFullView) {
    return (
      <div
        className="fixed inset-0 z-50 bg-background"
        role="dialog"
        aria-modal="true"
        aria-label={`${tabLabel} full view`}
      >
        {/* Full view header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-background/95 backdrop-blur-md">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {tabConfig && <TabIcon type={tabConfig.iconType} />}
            {tabLabel}
          </h2>
          <button
            onClick={onExitFullView}
            className="
              flex items-center justify-center
              w-10 h-10
              rounded-lg
              text-muted-foreground
              hover:bg-muted/50 hover:text-foreground
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
              transition-all duration-150
            "
            aria-label={locale === 'ja' ? 'フルビューを閉じる' : 'Close full view'}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        {/* Full view content */}
        <div className="h-[calc(100vh-57px)] overflow-auto">
          {children}
        </div>
      </div>
    );
  }

  // Normal view
  return (
    <div
      id={`tabpanel-${activeTab}`}
      role="tabpanel"
      aria-labelledby={`tab-${activeTab}`}
      className="relative"
    >
      {/* Full view toggle button */}
      {supportsFullView && (
        <button
          onClick={onToggleFullView}
          className="
            absolute top-2 right-2 z-10
            flex items-center justify-center
            w-8 h-8
            rounded-lg
            bg-background/80 backdrop-blur-sm
            border border-border/50
            text-muted-foreground
            hover:bg-muted/50 hover:text-foreground
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
            transition-all duration-150
          "
          aria-label={locale === 'ja' ? 'フルビューで表示' : 'View in full screen'}
          title={locale === 'ja' ? 'フルビューで表示' : 'View in full screen'}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 3H5a2 2 0 0 0-2 2v3" />
            <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
            <path d="M3 16v3a2 2 0 0 0 2 2h3" />
            <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
        </button>
      )}
      {children}
    </div>
  );
}

export default TabContent;
