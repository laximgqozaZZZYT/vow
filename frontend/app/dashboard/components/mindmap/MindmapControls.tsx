"use client";

/**
 * MindmapControls - Toolbar controls for the mindmap widget
 * 
 * A pure presentational component that renders action buttons for
 * mindmap operations (add node, clear connections, zoom controls).
 * Delegates all state management to the parent component.
 * 
 * @requirements 1.1, 1.2, 1.3 - Component extraction with backward compatibility
 */

import React, { memo } from 'react';

export interface MindmapControlsProps {
  /** Callback when add node button is clicked */
  onAddNode: () => void;
  /** Callback when clear connections button is clicked */
  onClearConnections: () => void;
  /** Callback when zoom in button is clicked */
  onZoomIn: () => void;
  /** Callback when zoom out button is clicked */
  onZoomOut: () => void;
  /** Callback when fit view button is clicked */
  onFitView: () => void;
  /** Whether edit mode is active (optional, defaults to true) */
  isEditMode?: boolean;
  /** Whether the device is mobile (optional, defaults to false) */
  isMobile?: boolean;
  /** Current language for accessibility labels (optional, defaults to 'ja') */
  lang?: 'ja' | 'en';
}

/**
 * Translations for button labels and titles
 */
const translations = {
  ja: {
    addNode: 'ノードを追加',
    clearConnections: '接続をクリア',
    zoomIn: 'ズームイン',
    zoomOut: 'ズームアウト',
    fitView: '全体表示',
  },
  en: {
    addNode: 'Add Node',
    clearConnections: 'Clear Connections',
    zoomIn: 'Zoom In',
    zoomOut: 'Zoom Out',
    fitView: 'Fit View',
  },
};

/**
 * MindmapControls component
 * 
 * Renders toolbar buttons for mindmap operations including:
 * - Add node
 * - Clear all connections
 * - Zoom in/out
 * - Fit view
 * 
 * Design System:
 * - Uses semantic color tokens (bg-primary for actions, bg-destructive for clear)
 * - Responsive sizing (larger touch targets on mobile)
 * - Accessible focus states with focus-visible
 * - Minimum touch target size (44px)
 * - Consistent shadow and transition effects
 */
function MindmapControlsComponent(props: MindmapControlsProps): React.ReactElement | null {
  const {
    onAddNode,
    onClearConnections,
    onZoomIn,
    onZoomOut,
    onFitView,
    isEditMode = true,
    isMobile = false,
    lang = 'ja',
  } = props;
  const t = translations[lang];
  
  // Button size based on device type - ensures minimum 44px touch target
  const buttonSize = isMobile ? 'w-14 h-14' : 'w-12 h-12';
  const smallButtonSize = isMobile ? 'w-12 h-12' : 'w-10 h-10';

  // Common button styles following design system
  const baseButtonStyles = `
    rounded-full shadow-md
    flex items-center justify-center
    transition-colors
    focus-visible:outline-2 focus-visible:outline-offset-2
    min-w-[44px] min-h-[44px]
  `;

  return (
    <div className="flex flex-col gap-2">
      {/* Edit Mode Actions */}
      {isEditMode && (
        <>
          {/* Add Node Button */}
          <button
            type="button"
            onClick={onAddNode}
            className={`
              ${buttonSize}
              ${baseButtonStyles}
              bg-primary text-primary-foreground
              hover:opacity-90
              focus-visible:outline-primary
            `}
            title={t.addNode}
            aria-label={t.addNode}
          >
            <span className="text-xl font-bold">＋</span>
          </button>

          {/* Clear Connections Button */}
          <button
            type="button"
            onClick={onClearConnections}
            className={`
              ${buttonSize}
              ${baseButtonStyles}
              bg-destructive text-destructive-foreground
              hover:opacity-90
              focus-visible:outline-destructive
            `}
            title={t.clearConnections}
            aria-label={t.clearConnections}
          >
            <span className="text-lg">✂</span>
          </button>
        </>
      )}

      {/* Zoom Controls - Always visible */}
      <div className="flex flex-col gap-1 mt-2">
        {/* Zoom In Button */}
        <button
          type="button"
          onClick={onZoomIn}
          className={`
            ${smallButtonSize}
            ${baseButtonStyles}
            bg-card text-foreground
            border border-border
            hover:bg-muted
            focus-visible:outline-primary
          `}
          title={t.zoomIn}
          aria-label={t.zoomIn}
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
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="11" y1="8" x2="11" y2="14" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </button>

        {/* Zoom Out Button */}
        <button
          type="button"
          onClick={onZoomOut}
          className={`
            ${smallButtonSize}
            ${baseButtonStyles}
            bg-card text-foreground
            border border-border
            hover:bg-muted
            focus-visible:outline-primary
          `}
          title={t.zoomOut}
          aria-label={t.zoomOut}
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
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </button>

        {/* Fit View Button */}
        <button
          type="button"
          onClick={onFitView}
          className={`
            ${smallButtonSize}
            ${baseButtonStyles}
            bg-card text-foreground
            border border-border
            hover:bg-muted
            focus-visible:outline-primary
          `}
          title={t.fitView}
          aria-label={t.fitView}
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
            aria-hidden="true"
          >
            <path d="M8 3H5a2 2 0 0 0-2 2v3" />
            <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
            <path d="M3 16v3a2 2 0 0 0 2 2h3" />
            <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/**
 * Memoized MindmapControls component for performance optimization.
 * Prevents unnecessary re-renders when parent component updates.
 */
export const MindmapControls = memo(MindmapControlsComponent);

export default MindmapControls;
