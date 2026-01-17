/**
 * MindmapControls Component
 * 
 * Control panel for the mindmap with action buttons and legend.
 * Includes add node, clear connections, delete selected, and edge color legend.
 */

import React, { memo } from 'react';
import { Language } from '../types/mindmap.types';
import { getTranslation } from '../../../lib/mindmap.i18n';

/** Props for the MindmapControls component */
export interface MindmapControlsProps {
  /** Whether edit mode is active */
  isEditMode: boolean;
  /** Number of selected nodes */
  selectedNodesCount: number;
  /** Whether the device is mobile */
  isMobile: boolean;
  /** Current language */
  lang: Language;
  /** Callback when add node is clicked */
  onAddNode: () => void;
  /** Callback when clear connections is clicked */
  onClearConnections: () => void;
  /** Callback when delete selected is clicked */
  onDeleteSelected: () => void;
}

/**
 * Action buttons panel for the mindmap.
 */
function ActionButtons({
  isEditMode,
  selectedNodesCount,
  isMobile,
  lang,
  onAddNode,
  onClearConnections,
  onDeleteSelected,
}: MindmapControlsProps): React.ReactElement | null {
  const t = getTranslation(lang);

  if (!isEditMode) {
    return null;
  }

  const buttonSize = isMobile ? 'w-14 h-14' : 'w-12 h-12';

  return (
    <div className="flex flex-col gap-2 mt-2">
      {/* Add Node Button */}
      <button
        onClick={onAddNode}
        className={`${buttonSize} bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center text-xl font-bold transition-colors`}
        title={t('add_node')}
        aria-label={t('add_node')}
      >
        ＋
      </button>

      {/* Clear Connections Button */}
      <button
        onClick={onClearConnections}
        className={`${buttonSize} bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg flex items-center justify-center text-lg transition-colors`}
        title={t('clear_connections')}
        aria-label={t('clear_connections')}
      >
        ✂
      </button>

      {/* Delete Selected Button (only shown when nodes are selected) */}
      {selectedNodesCount > 0 && (
        <button
          onClick={onDeleteSelected}
          className={`${buttonSize} bg-orange-600 hover:bg-orange-700 text-white rounded-full shadow-lg flex items-center justify-center text-lg transition-colors`}
          title={t('delete_node')}
          aria-label={t('delete_node')}
        >
          🗑️
        </button>
      )}
    </div>
  );
}

/** Props for the EdgeLegend component */
export interface EdgeLegendProps {
  /** Current language */
  lang: Language;
}

/**
 * Edge color legend component.
 */
function EdgeLegendComponent({ lang }: EdgeLegendProps): React.ReactElement {
  const t = getTranslation(lang);

  return (
    <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-lg shadow-lg p-4 border border-gray-200/50 dark:border-gray-800/50">
      <div className="text-xs font-semibold mb-2 text-gray-700 dark:text-gray-300">
        {t('edge_colors')}
      </div>
      <div className="flex flex-col gap-1.5">
        {/* Default Edge */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5 bg-blue-500" />
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {t('default')}
          </span>
        </div>

        {/* Habit Edge */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5 bg-green-500" />
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {t('habit')}
          </span>
        </div>

        {/* Goal Edge */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5 bg-purple-500" />
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {t('goal')}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Memoized EdgeLegend component.
 */
export const EdgeLegend = memo(EdgeLegendComponent);

/**
 * Memoized MindmapControls component.
 */
export const MindmapControls = memo(ActionButtons);

export default MindmapControls;
