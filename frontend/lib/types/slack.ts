/**
 * Slack Integration Types
 * 
 * TypeScript interfaces for Slack OAuth, connections, and preferences.
 */

/**
 * Slack connection information (excludes sensitive tokens)
 */
export interface SlackConnection {
  id: string;
  slackUserId: string;
  slackTeamId: string;
  slackTeamName: string | null;
  slackUserName: string | null;
  connectedAt: string;
  isValid: boolean;
}

/**
 * Slack notification preferences
 */
export interface SlackPreferences {
  slackNotificationsEnabled: boolean;
  weeklySlackReportEnabled: boolean;
  weeklyReportDay: number;  // 0-6, Sunday = 0
  weeklyReportTime: string; // HH:MM format
}

/**
 * Combined Slack connection status
 */
export interface SlackConnectionStatus {
  connected: boolean;
  connection?: SlackConnection;
  preferences?: SlackPreferences;
}

/**
 * Slack preferences update request
 */
export interface SlackPreferencesUpdate {
  slackNotificationsEnabled?: boolean;
  weeklySlackReportEnabled?: boolean;
  weeklyReportDay?: number;
  weeklyReportTime?: string;
}

/**
 * Day of week options for weekly report
 */
export const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
] as const;

/**
 * Time options for weekly report (hourly)
 */
export const TIME_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: `${i.toString().padStart(2, '0')}:00`,
  label: `${i.toString().padStart(2, '0')}:00`,
}));
