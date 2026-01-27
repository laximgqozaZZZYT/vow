/**
 * Tab configuration for dashboard navigation
 */

// Feature flag for AI Coach - explicitly check for 'true' value
// Default to false if not set (safer for production)
const ENABLE_AI_COACH = process.env.NEXT_PUBLIC_ENABLE_AI_COACH === 'true';

export interface TabConfig {
  id: string;
  label: string;
  labelJa: string;
  iconType: 'board' | 'next' | 'activity' | 'calendar' | 'statistics' | 'diary' | 'stickies' | 'mindmap' | 'notices' | 'coach';
  supportsFullView?: boolean;
  /** Alias IDs that should be treated as equivalent to this tab (for backward compatibility) */
  aliases?: string[];
  /** Whether this tab is enabled (controlled by feature flags) */
  enabled?: boolean;
}

// All tabs available in all environments
const ALL_TAB_CONFIGS: TabConfig[] = [
  { id: 'board', label: 'Board', labelJa: 'ボード', iconType: 'board', aliases: ['next'], enabled: true },
  { id: 'activity', label: 'Activity', labelJa: '活動', iconType: 'activity', enabled: true },
  { id: 'calendar', label: 'Calendar', labelJa: '予定', iconType: 'calendar', supportsFullView: true, enabled: true },
  { id: 'statics', label: 'Stats', labelJa: '統計', iconType: 'statistics', enabled: true },
  { id: 'diary', label: 'Diary', labelJa: '日記', iconType: 'diary', enabled: true },
  { id: 'stickies', label: 'Notes', labelJa: 'メモ', iconType: 'stickies', enabled: true },
  { id: 'mindmap', label: 'Map', labelJa: 'マップ', iconType: 'mindmap', supportsFullView: true, enabled: true },
  { id: 'notices', label: 'Alerts', labelJa: '通知', iconType: 'notices', enabled: true },
  { id: 'coach', label: 'Coach', labelJa: 'コーチ', iconType: 'coach', enabled: ENABLE_AI_COACH },
];

// Filter tabs based on feature flags
export const TAB_CONFIGS: TabConfig[] = ALL_TAB_CONFIGS.filter(tab => tab.enabled !== false);

export const DEFAULT_TAB = 'board';

/**
 * Normalize tab ID for backward compatibility
 * Converts legacy 'next' ID to 'board'
 */
export function normalizeTabId(id: string): string {
  // Check if this ID is an alias for another tab
  const tab = TAB_CONFIGS.find(t => t.aliases?.includes(id));
  if (tab) {
    return tab.id;
  }
  return id;
}

/**
 * Get visible tabs based on pageSections array
 * Handles backward compatibility for 'next' -> 'board' migration
 */
export function getVisibleTabs(pageSections: string[]): TabConfig[] {
  // Normalize section IDs for backward compatibility
  const normalizedSections = pageSections.map(normalizeTabId);
  return TAB_CONFIGS.filter(tab => normalizedSections.includes(tab.id));
}

/**
 * Get tab config by id
 * Handles backward compatibility for 'next' -> 'board' migration
 */
export function getTabById(id: string): TabConfig | undefined {
  const normalizedId = normalizeTabId(id);
  return TAB_CONFIGS.find(tab => tab.id === normalizedId);
}
