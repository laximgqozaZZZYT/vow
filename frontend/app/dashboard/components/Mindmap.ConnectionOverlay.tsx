/**
 * ConnectionModeOverlay Component
 * 
 * Overlay displayed when connection mode is active on mobile devices.
 * Shows the source node and instructions for completing the connection.
 */

import React, { memo } from 'react';
import { Language } from '../types/mindmap.types';
import { getTranslation } from '../../../lib/mindmap.i18n';

/** Props for the ConnectionModeOverlay component */
export interface ConnectionModeOverlayProps {
  /** Whether connection mode is active */
  isActive: boolean;
  /** Name of the source node */
  sourceNodeName: string;
  /** Current language */
  lang: Language;
  /** Callback when cancel is clicked */
  onCancel: () => void;
}

/**
 * Overlay component for connection mode on mobile.
 * Displays instructions and cancel button.
 */
function ConnectionModeOverlayComponent({
  isActive,
  sourceNodeName,
  lang,
  onCancel,
}: ConnectionModeOverlayProps): React.ReactElement | null {
  const t = getTranslation(lang);

  if (!isActive) {
    return null;
  }

  return (
    <div className="fixed top-16 left-2 right-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-xl shadow-lg z-40 border border-blue-500">
      <div className="text-center">
        {/* Title */}
        <div className="text-lg font-bold mb-2 flex items-center justify-center">
          <span className="text-2xl mr-2">🔗</span>
          {t('connection_mode_title')}
        </div>

        {/* Source Node */}
        <div className="text-sm mb-2 opacity-90">
          {t('connection_mode_source')}: {sourceNodeName || 'Unknown'}
        </div>

        {/* Instructions */}
        <div className="text-sm mb-2 opacity-90 font-semibold">
          {t('connection_mode_desc')}
        </div>

        {/* Tip */}
        <div className="text-xs mb-4 opacity-80 bg-white/10 rounded-lg p-2">
          💡 空白領域をタップして新規ノードを作成・結線
        </div>

        {/* Cancel Button */}
        <div className="flex justify-center gap-3">
          <button
            onClick={onCancel}
            className="px-6 py-2 bg-white/20 text-white rounded-lg font-medium border border-white/30 hover:bg-white/30 transition-colors"
          >
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Memoized ConnectionModeOverlay component.
 */
export const ConnectionModeOverlay = memo(ConnectionModeOverlayComponent);

export default ConnectionModeOverlay;
