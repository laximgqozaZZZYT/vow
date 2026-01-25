/**
 * Tab configuration for dashboard navigation
 */

export interface TabConfig {
  id: string;
  label: string;
  labelJa: string;
  iconType: 'next' | 'activity' | 'calendar' | 'statistics' | 'diary' | 'stickies' | 'mindmap' | 'notices' | 'coach';
  supportsFullView?: boolean;
}

export const TAB_CONFIGS: TabConfig[] = [
  { id: 'next', label: 'Next', labelJa: '次へ', iconType: 'next' },
  { id: 'activity', label: 'Activity', labelJa: '活動', iconType: 'activity' },
  { id: 'calendar', label: 'Calendar', labelJa: '予定', iconType: 'calendar', supportsFullView: true },
  { id: 'statics', label: 'Stats', labelJa: '統計', iconType: 'statistics' },
  { id: 'diary', label: 'Diary', labelJa: '日記', iconType: 'diary' },
  { id: 'stickies', label: 'Notes', labelJa: 'メモ', iconType: 'stickies' },
  { id: 'mindmap', label: 'Map', labelJa: 'マップ', iconType: 'mindmap', supportsFullView: true },
  { id: 'notices', label: 'Alerts', labelJa: '通知', iconType: 'notices' },
  { id: 'coach', label: 'Coach', labelJa: 'コーチ', iconType: 'coach' },
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
