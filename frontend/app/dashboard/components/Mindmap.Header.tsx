/**
 * MindmapHeader Component
 * 
 * Header component for the mindmap view with name editing,
 * save/close buttons, and language toggle.
 */

import React, { memo, useState, useCallback } from 'react';
import { Language } from '../types/mindmap.types';
import { getTranslation } from '../../../lib/mindmap.i18n';

/** Props for the MindmapHeader component */
export interface MindmapHeaderProps {
  /** Current mindmap name */
  mindmapName: string;
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Current language */
  lang: Language;
  /** Original mindmap name (for reset on escape) */
  originalName?: string;
  /** Callback when name changes */
  onNameChange: (name: string) => void;
  /** Callback when save is clicked */
  onSave: () => void;
  /** Callback when close is clicked */
  onClose: () => void;
  /** Callback when language is toggled */
  onLanguageToggle: () => void;
  /** Callback when changes are made (for unsaved indicator) */
  onChangesMade?: () => void;
}

/**
 * Header component for the mindmap.
 * Displays the mindmap name (editable), save/close buttons, and language toggle.
 */
function MindmapHeaderComponent({
  mindmapName,
  hasUnsavedChanges,
  lang,
  originalName = 'Untitled Mindmap',
  onNameChange,
  onSave,
  onClose,
  onLanguageToggle,
  onChangesMade,
}: MindmapHeaderProps): React.ReactElement {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(mindmapName);
  const t = getTranslation(lang);

  /**
   * Handles starting name edit mode.
   */
  const handleStartEdit = useCallback(() => {
    setEditValue(mindmapName);
    setIsEditing(true);
  }, [mindmapName]);

  /**
   * Handles finishing name edit.
   */
  const handleFinishEdit = useCallback(() => {
    const trimmedValue = editValue.trim();
    if (trimmedValue && trimmedValue !== mindmapName) {
      onNameChange(trimmedValue);
      onChangesMade?.();
    }
    setIsEditing(false);
  }, [editValue, mindmapName, onNameChange, onChangesMade]);

  /**
   * Handles canceling name edit.
   */
  const handleCancelEdit = useCallback(() => {
    setEditValue(mindmapName);
    setIsEditing(false);
  }, [mindmapName]);

  /**
   * Handles key down in name input.
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleFinishEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  }, [handleFinishEdit, handleCancelEdit]);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2 sm:p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      {/* Name Section */}
      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
        {isEditing ? (
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleFinishEdit}
            onKeyDown={handleKeyDown}
            className="text-lg sm:text-xl font-semibold bg-transparent border-b-2 border-blue-500 focus:outline-none text-gray-900 dark:text-white flex-1 min-w-0"
            autoFocus
          />
        ) : (
          <h1
            className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 truncate flex-1 min-w-0"
            onClick={handleStartEdit}
            title={t('click_to_edit_name')}
          >
            {mindmapName}
            {hasUnsavedChanges && (
              <span className="text-orange-500 ml-1">*</span>
            )}
          </h1>
        )}
      </div>

      {/* Actions Section */}
      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 mt-2 sm:mt-0">
        {/* Save Button */}
        <button
          onClick={onSave}
          title={t('save')}
          aria-label={t('save')}
          className="px-2 py-1 sm:px-4 sm:py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm sm:text-base whitespace-nowrap transition-colors"
        >
          {t('save')}
        </button>

        {/* Close Button */}
        <button
          onClick={onClose}
          title={t('close')}
          aria-label={t('close')}
          className="px-2 py-1 sm:px-4 sm:py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm sm:text-base whitespace-nowrap transition-colors"
        >
          {t('close')}
        </button>

        {/* Language Toggle */}
        <div className="ml-2 flex items-center gap-1">
          <button
            onClick={onLanguageToggle}
            title="Toggle language"
            aria-label="Toggle language"
            className="px-2 py-1 bg-transparent text-sm text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-800 whitespace-nowrap transition-colors"
          >
            {lang === 'ja' ? 'EN' : '日本語'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Memoized MindmapHeader component.
 * Only re-renders when props change.
 */
export const MindmapHeader = memo(MindmapHeaderComponent);

export default MindmapHeader;
