/**
 * MobileBottomMenu Component
 * 
 * Bottom sheet menu for mobile devices with node actions.
 * Provides edit, connect, register as habit/goal, and delete options.
 */

import React, { memo } from 'react';
import { Language } from '../types/mindmap.types';
import { getTranslation } from '../../../lib/mindmap.i18n';
import { NodeType } from '../../../lib/mindmap';

/** Menu action types */
export type MenuAction = 'edit' | 'connect' | 'habit' | 'goal' | 'delete';

/** Props for the MobileBottomMenu component */
export interface MobileBottomMenuProps {
  /** Whether the menu is visible */
  isVisible: boolean;
  /** ID of the selected node */
  nodeId: string;
  /** Name of the selected node */
  nodeName: string;
  /** Type of the selected node */
  nodeType: NodeType;
  /** Current language */
  lang: Language;
  /** Callback when an action is selected */
  onAction: (action: MenuAction) => void;
  /** Callback when menu is closed */
  onClose: () => void;
}

/** Menu button configuration */
interface MenuButton {
  action: MenuAction;
  icon: string;
  labelKey: string;
  altLabelKey?: string;
  colorClasses: string;
  showWhen?: (nodeType: NodeType) => boolean;
}

/** Menu button configurations */
const MENU_BUTTONS: MenuButton[] = [
  {
    action: 'edit',
    icon: '✏️',
    labelKey: 'edit_text',
    colorClasses: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400',
  },
  {
    action: 'connect',
    icon: '🔗',
    labelKey: 'connect',
    colorClasses: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400',
  },
  {
    action: 'habit',
    icon: '🔄',
    labelKey: 'as_habit',
    altLabelKey: 'edit_habit',
    colorClasses: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400',
  },
  {
    action: 'goal',
    icon: '🎯',
    labelKey: 'as_goal',
    altLabelKey: 'edit_goal',
    colorClasses: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400',
  },
];

/**
 * Gets the label for a menu button based on node type.
 */
function getButtonLabel(
  button: MenuButton,
  nodeType: NodeType,
  t: (key: string) => string
): string {
  if (button.altLabelKey) {
    // Use alternate label if node is already of that type
    if (button.action === 'habit' && nodeType === 'habit') {
      return t(button.altLabelKey);
    }
    if (button.action === 'goal' && nodeType === 'goal') {
      return t(button.altLabelKey);
    }
  }
  return t(button.labelKey);
}

/**
 * Mobile bottom menu component.
 * Displays action buttons for the selected node.
 */
function MobileBottomMenuComponent({
  isVisible,
  nodeId,
  nodeName,
  nodeType,
  lang,
  onAction,
  onClose,
}: MobileBottomMenuProps): React.ReactElement | null {
  const t = getTranslation(lang);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-50 safe-area-pb">
      <div className="p-4">
        {/* Node Name */}
        <div className="text-center text-sm text-gray-600 dark:text-gray-400 mb-4">
          {nodeName}
        </div>

        {/* Action Buttons Grid */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          {MENU_BUTTONS.map((button) => (
            <button
              key={button.action}
              onClick={() => onAction(button.action)}
              className={`flex flex-col items-center justify-center p-4 rounded-lg border ${button.colorClasses}`}
            >
              <span className="text-2xl mb-1">{button.icon}</span>
              <span className="text-sm">
                {getButtonLabel(button, nodeType, t)}
              </span>
            </button>
          ))}
        </div>

        {/* Delete Button */}
        <button
          onClick={() => onAction('delete')}
          className="w-full p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 mb-3"
        >
          <span className="text-xl mr-2">🗑️</span>
          {t('delete_node')}
        </button>

        {/* Cancel Button */}
        <button
          onClick={onClose}
          className="w-full p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400"
        >
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}

/**
 * Memoized MobileBottomMenu component.
 */
export const MobileBottomMenu = memo(MobileBottomMenuComponent);

export default MobileBottomMenu;
