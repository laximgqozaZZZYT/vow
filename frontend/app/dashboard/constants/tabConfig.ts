/**
 * Tab configuration for dashboard navigation
 */

export interface TabConfig {
  id: string;
  label: string;
  labelJa: string;
  icon: string;
  supportsFullView?: boolean;
}

export const TAB_CONFIGS: TabConfig[] = [
  { id: 'next', label: 'Next', labelJa: '次のアクション', icon: '⏰' },
  { id: 'activity', label: 'Activity', labelJa: 'アクティビティ', icon: '📊' },
  { id: 'calendar', label: 'Calendar', labelJa: 'カレンダー', icon: '📅', supportsFullView: true },
  { id: 'statics', label: 'Statistics', labelJa: '統計', icon: '📈' },
  { id: 'diary', label: 'Diary', labelJa: '日記', icon: '📝' },
  { id: 'stickies', label: 'Stickies', labelJa: '付箋', icon: '📌' },
  { id: 'mindmap', label: 'Mindmap', labelJa: 'マインドマップ', icon: '🗺️', supportsFullView: true },
  { id: 'notices', label: 'Notices', labelJa: '通知', icon: '🔔' },
  { id: 'coach', label: 'Coach', labelJa: 'コーチ', icon: '🤖' },
];

export const DEFAULT_TAB = 'next';

/**
 * Get visible tabs based on pageSections array
 */
export function getVisibleTabs(pageSections: string[]): TabConfig[] {
  return TAB_CONFIGS.filter(tab => pageSections.includes(tab.id));
}

/**
 * Get tab config by id
 */
export function getTabById(id: string): TabConfig | undefined {
  return TAB_CONFIGS.find(tab => tab.id === id);
}
