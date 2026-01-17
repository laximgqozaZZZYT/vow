/**
 * SaveDialog Component
 * 
 * Confirmation dialog for saving changes before closing the mindmap.
 */

import React, { memo } from 'react';
import { Language } from '../types/mindmap.types';
import { getTranslation } from '../../../lib/mindmap.i18n';

/** Props for the SaveDialog component */
export interface SaveDialogProps {
  /** Whether the dialog is visible */
  isVisible: boolean;
  /** Current language */
  lang: Language;
  /** Callback when cancel is clicked */
  onCancel: () => void;
  /** Callback when "don't save" is clicked */
  onDontSave: () => void;
  /** Callback when "save and close" is clicked */
  onSaveAndClose: () => void;
}

/**
 * Save confirmation dialog component.
 */
function SaveDialogComponent({
  isVisible,
  lang,
  onCancel,
  onDontSave,
  onSaveAndClose,
}: SaveDialogProps): React.ReactElement | null {
  const t = getTranslation(lang);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md mx-4">
        {/* Title */}
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          {t('save_changes_title')}
        </h3>

        {/* Description */}
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {t('save_changes_desc')}
        </p>

        {/* Buttons */}
        <div className="flex justify-end gap-3">
          {/* Cancel Button */}
          <button
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t('cancel')}
          </button>

          {/* Don't Save Button */}
          <button
            onClick={onDontSave}
            className="inline-flex items-center justify-center rounded-md bg-destructive text-destructive-foreground px-4 py-2 text-sm font-medium transition-colors hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
          >
            {t('dont_save')}
          </button>

          {/* Save and Close Button */}
          <button
            onClick={onSaveAndClose}
            className="inline-flex items-center justify-center rounded-md bg-success text-success-foreground px-4 py-2 text-sm font-medium transition-colors hover:bg-success/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success"
          >
            {t('save_and_close')}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Memoized SaveDialog component.
 */
export const SaveDialog = memo(SaveDialogComponent);

export default SaveDialog;
