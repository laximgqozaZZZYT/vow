/**
 * CoachMark Component
 * 
 * First-time user onboarding tooltip for the mindmap.
 */

import React, { memo } from 'react';
import { Language } from '../types/mindmap.types';
import { getTranslation } from '../../../lib/mindmap.i18n';

/** Local storage key for coach mark seen state */
const COACH_MARK_SEEN_KEY = 'mindmap_coach_seen';

/** Props for the CoachMark component */
export interface CoachMarkProps {
  /** Whether the coach mark is visible */
  isVisible: boolean;
  /** Current language */
  lang: Language;
  /** Callback when dismissed */
  onDismiss: () => void;
}

/**
 * Checks if the coach mark has been seen before.
 */
export function hasSeenCoachMark(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return !!window.localStorage.getItem(COACH_MARK_SEEN_KEY);
  } catch {
    return true;
  }
}

/**
 * Marks the coach mark as seen.
 */
export function markCoachMarkSeen(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(COACH_MARK_SEEN_KEY, '1');
  } catch {
    // Ignore storage errors
  }
}

/**
 * Coach mark component for first-time users.
 */
function CoachMarkComponent({
  isVisible,
  lang,
  onDismiss,
}: CoachMarkProps): React.ReactElement | null {
  const t = getTranslation(lang);

  if (!isVisible) {
    return null;
  }

  const handleDismiss = () => {
    markCoachMarkSeen();
    onDismiss();
  };

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-md mx-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-lg">
      {/* Title */}
      <div className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
        {t('coach_title')}
      </div>

      {/* Description */}
      <div className="text-sm text-gray-700 dark:text-gray-300 mb-3">
        {t('coach_desc')}
      </div>

      {/* Dismiss Button */}
      <div className="flex justify-end">
        <button
          onClick={handleDismiss}
          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          {t('got_it')}
        </button>
      </div>
    </div>
  );
}

/**
 * Memoized CoachMark component.
 */
export const CoachMark = memo(CoachMarkComponent);

export default CoachMark;
