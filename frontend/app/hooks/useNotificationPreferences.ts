"use client";

import { useState, useEffect, useCallback } from 'react';
import api from '../../lib/api';
import { debug } from '../../lib/debug';

/**
 * Notification preferences structure
 */
export interface NotificationPreferences {
  inApp: {
    workloadCoaching: boolean;
    tokenWarning: boolean;
    weeklyReport: boolean;
  };
  slack: {
    enabled: boolean;
    workloadCoaching: boolean;
    tokenWarning: boolean;
    weeklyReport: boolean;
    notificationTime: string;
  };
  webPush: {
    enabled: boolean;
    dailyReminder: boolean;
    dailyReminderTime: string;
    workloadCoaching: boolean;
  };
}

/**
 * Default notification preferences
 */
const DEFAULT_PREFERENCES: NotificationPreferences = {
  inApp: {
    workloadCoaching: true,
    tokenWarning: true,
    weeklyReport: true,
  },
  slack: {
    enabled: false,
    workloadCoaching: false,
    tokenWarning: true,
    weeklyReport: true,
    notificationTime: '09:00',
  },
  webPush: {
    enabled: false,
    dailyReminder: false,
    dailyReminderTime: '08:00',
    workloadCoaching: false,
  },
};

/**
 * Hook state
 */
interface NotificationPreferencesState {
  preferences: NotificationPreferences;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
}

/**
 * Hook for managing notification preferences
 * 
 * Requirements: 12.4 - Notification preferences management
 */
export function useNotificationPreferences() {
  const [state, setState] = useState<NotificationPreferencesState>({
    preferences: DEFAULT_PREFERENCES,
    isLoading: true,
    isSaving: false,
    error: null,
  });

  // Fetch preferences on mount
  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const response = await api.get('/api/notifications/preferences');
        if (response && response.preferences) {
          setState(prev => ({
            ...prev,
            preferences: response.preferences,
            isLoading: false,
            error: null,
          }));
        }
      } catch (err) {
        debug.log('[useNotificationPreferences] Error fetching preferences:', err);
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Failed to load notification preferences',
        }));
      }
    };

    fetchPreferences();
  }, []);

  /**
   * Update preferences
   */
  const updatePreferences = useCallback(async (
    updates: Partial<NotificationPreferences>
  ): Promise<boolean> => {
    setState(prev => ({ ...prev, isSaving: true, error: null }));

    try {
      const response = await api.put('/api/notifications/preferences', updates);
      
      if (response && response.preferences) {
        setState(prev => ({
          ...prev,
          preferences: response.preferences,
          isSaving: false,
          error: null,
        }));
      } else {
        // Optimistically update local state
        setState(prev => ({
          ...prev,
          preferences: {
            ...prev.preferences,
            ...updates,
            inApp: { ...prev.preferences.inApp, ...updates.inApp },
            slack: { ...prev.preferences.slack, ...updates.slack },
            webPush: { ...prev.preferences.webPush, ...updates.webPush },
          },
          isSaving: false,
          error: null,
        }));
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update preferences';
      debug.log('[useNotificationPreferences] Error updating preferences:', err);
      
      setState(prev => ({
        ...prev,
        isSaving: false,
        error: message,
      }));
      return false;
    }
  }, []);

  /**
   * Update a single in-app preference
   */
  const updateInAppPreference = useCallback(async (
    key: keyof NotificationPreferences['inApp'],
    value: boolean
  ): Promise<boolean> => {
    return updatePreferences({
      inApp: { ...state.preferences.inApp, [key]: value },
    });
  }, [state.preferences.inApp, updatePreferences]);

  /**
   * Update a single Slack preference
   */
  const updateSlackPreference = useCallback(async (
    key: keyof NotificationPreferences['slack'],
    value: boolean | string
  ): Promise<boolean> => {
    return updatePreferences({
      slack: { ...state.preferences.slack, [key]: value },
    });
  }, [state.preferences.slack, updatePreferences]);

  /**
   * Update a single Web Push preference
   */
  const updateWebPushPreference = useCallback(async (
    key: keyof NotificationPreferences['webPush'],
    value: boolean | string
  ): Promise<boolean> => {
    return updatePreferences({
      webPush: { ...state.preferences.webPush, [key]: value },
    });
  }, [state.preferences.webPush, updatePreferences]);

  return {
    ...state,
    updatePreferences,
    updateInAppPreference,
    updateSlackPreference,
    updateWebPushPreference,
  };
}

export default useNotificationPreferences;
