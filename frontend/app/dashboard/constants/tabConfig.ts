/**
 * Tab configuration for dashboard navigation
 */

// Feature flag for AI Coach - explicitly check for 'true' value
// Default to false if not set (safer for production)
const ENABLE_AI_COACH = process.env.NEXT_PUBLIC_ENABLE_AI_COACH === 'true';

// Feature flag for Multi-Agent Dashboard
const ENABLE_MULTI_AGENT = process.env.NEXT_PUBLIC_ENABLE_MULTI_AGENT === 'true';

// Feature flag for MOC (Multi-agent Orchestration Center)
const ENABLE_MOC = process.env.NEXT_PUBLIC_ENABLE_MOC === 'true';

export interface TabConfig {
  id: string;
  label: string;
  labelJa: string;
  iconType: 'board' | 'next' | 'activity' | 'calendar' | 'statistics' | 'diary' | 'stickies' | 'mindmap' | 'notices' | 'coach' | 'agents' | 'moc';
  supportsFullView?: boolean;
  /** Alias IDs that should be treated as equivalent to this tab (for backward compatibility) */
  aliases?: string[];
  /** Whether this tab is enabled (controlled by feature flags) */
  enabled?: boolean;
  /** Whether this tab requires premium subscription */
  requiresPremium?: boolean;
  /** Whether this tab is admin-only */
  adminOnly?: boolean;
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
  // AI Coach and Agents tabs are temporarily hidden (use MOC instead)
  // Source code is preserved for future use
  { id: 'coach', label: 'Coach', labelJa: 'コーチ', iconType: 'coach', enabled: false /* ENABLE_AI_COACH - temporarily disabled */ },
  { id: 'agents', label: 'Agents', labelJa: 'エージェント', iconType: 'agents', enabled: false /* ENABLE_MULTI_AGENT - temporarily disabled */, requiresPremium: true, adminOnly: true },
  // MOC tab is always enabled - access is controlled by requiresPremium (admins can access)
  { id: 'moc', label: 'MOC', labelJa: 'MOC', iconType: 'moc', enabled: true, requiresPremium: true },
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

/** User context for tab visibility */
export interface TabUserContext {
  isPremium?: boolean;
  isAdmin?: boolean;
}

/**
 * Get visible tabs based on pageSections array and user context
 * Handles backward compatibility for 'next' -> 'board' migration
 * Note: 'agents' tab is always included when enabled, regardless of saved layout
 */
export function getVisibleTabs(pageSections: string[], userContext?: TabUserContext): TabConfig[] {
  // Normalize section IDs for backward compatibility
  const normalizedSections = pageSections.map(normalizeTabId);
  return TAB_CONFIGS.filter(tab => {
    // Check admin-only restriction
    if (tab.adminOnly && !userContext?.isAdmin) {
      return false;
    }
    // Check premium requirement
    if (tab.requiresPremium && !userContext?.isPremium && !userContext?.isAdmin) {
      return false;
    }
    // Always include agents tab if it's enabled (feature flag) and user has access
    if (tab.id === 'agents' && tab.enabled) {
      return true;
    }
    // Always include moc tab if it's enabled (feature flag) and user has access
    // Note: premium check is already done above, so if we reach here, user has access
    if (tab.id === 'moc' && tab.enabled) {
      return true;
    }
    return normalizedSections.includes(tab.id);
  });
}

/**
 * Check if a specific tab is accessible by the user
 */
export function isTabAccessible(tabId: string, userContext?: TabUserContext): boolean {
  const tab = getTabById(tabId);
  if (!tab) return false;
  if (tab.adminOnly && !userContext?.isAdmin) return false;
  if (tab.requiresPremium && !userContext?.isPremium && !userContext?.isAdmin) return false;
  return tab.enabled !== false;
}

/**
 * Get tab config by id
 * Handles backward compatibility for 'next' -> 'board' migration
 */
export function getTabById(id: string): TabConfig | undefined {
  const normalizedId = normalizeTabId(id);
  return TAB_CONFIGS.find(tab => tab.id === normalizedId);
}
