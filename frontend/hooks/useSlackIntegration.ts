/**
 * Slack Integration Hook
 * 
 * Provides functions for managing Slack OAuth and preferences.
 */

import { useState, useCallback, useEffect } from 'react';
import type {
  SlackConnectionStatus,
  SlackPreferences,
  SlackPreferencesUpdate,
} from '@/lib/types/slack';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

interface UseSlackIntegrationReturn {
  // State
  status: SlackConnectionStatus | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  connectSlack: () => void;
  disconnectSlack: () => Promise<boolean>;
  updatePreferences: (prefs: SlackPreferencesUpdate) => Promise<boolean>;
  testConnection: () => Promise<boolean>;
  refreshStatus: () => Promise<void>;
}

export function useSlackIntegration(): UseSlackIntegrationReturn {
  const [status, setStatus] = useState<SlackConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch current Slack connection status
   */
  const refreshStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_BASE}/api/slack/status`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          setStatus({ connected: false });
          return;
        }
        throw new Error('Failed to fetch Slack status');
      }
      
      const data = await response.json();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Initiate Slack OAuth flow
   */
  const connectSlack = useCallback(() => {
    const redirectUri = encodeURIComponent(window.location.origin + '/settings');
    window.location.href = `${API_BASE}/api/slack/connect?redirect_uri=${redirectUri}`;
  }, []);

  /**
   * Disconnect Slack integration
   */
  const disconnectSlack = useCallback(async (): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_BASE}/api/slack/disconnect`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to disconnect Slack');
      }
      
      setStatus({ connected: false });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Update Slack notification preferences
   */
  const updatePreferences = useCallback(async (
    prefs: SlackPreferencesUpdate
  ): Promise<boolean> => {
    try {
      setError(null);
      
      const response = await fetch(`${API_BASE}/api/slack/preferences`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(prefs),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to update preferences');
      }
      
      const updatedPrefs = await response.json();
      
      // Update local state
      setStatus(prev => prev ? {
        ...prev,
        preferences: updatedPrefs,
      } : null);
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, []);

  /**
   * Send a test message to verify connection
   */
  const testConnection = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      
      const response = await fetch(`${API_BASE}/api/slack/test`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to send test message');
      }
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, []);

  // Fetch status on mount
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Check for OAuth callback params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    if (params.get('slack_connected') === 'true') {
      // Clear URL params
      window.history.replaceState({}, '', window.location.pathname);
      // Refresh status
      refreshStatus();
    }
    
    const errorParam = params.get('error');
    if (errorParam) {
      const message = params.get('message') || 'Slack connection failed';
      setError(decodeURIComponent(message));
      // Clear URL params
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [refreshStatus]);

  return {
    status,
    loading,
    error,
    connectSlack,
    disconnectSlack,
    updatePreferences,
    testConnection,
    refreshStatus,
  };
}

export default useSlackIntegration;
