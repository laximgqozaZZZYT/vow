"use client";

import { useLocale } from '@/contexts/LocaleContext';
import { getTabById } from '../constants/tabConfig';

interface TabContentProps {
  activeTab: string;
  isFullView: boolean;
  onToggleFullView: () => void;
  onExitFullView: () => void;
  supportsFullView: boolean;
  children: React.ReactNode;
}

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
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {tabConfig && <span aria-hidden="true">{tabConfig.icon}</span>}
            {tabLabel}
          </h2>
          <button
            onClick={onExitFullView}
            className="
              flex items-center justify-center
              w-10 h-10
              rounded-md
              text-muted-foreground
              hover:bg-muted hover:text-foreground
              focus-visible:outline-2 focus-visible:outline-primary
              transition-colors
            "
            aria-label={locale === 'ja' ? 'フルビューを閉じる' : 'Close full view'}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
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
            rounded-md
            bg-card/80 backdrop-blur-sm
            border border-border
            text-muted-foreground
            hover:bg-muted hover:text-foreground
            focus-visible:outline-2 focus-visible:outline-primary
            transition-colors
          "
          aria-label={locale === 'ja' ? 'フルビューで表示' : 'View in full screen'}
          title={locale === 'ja' ? 'フルビューで表示' : 'View in full screen'}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
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
