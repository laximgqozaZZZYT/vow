/**
 * Slack Integration Hook
 * 
 * Provides functions for managing Slack OAuth and preferences.
 */

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type {
  SlackConnectionStatus,
  SlackPreferences,
  SlackPreferencesUpdate,
} from '@/lib/types/slack';

// Slack API endpoint (AWS Lambda)
const SLACK_API_URL = process.env.NEXT_PUBLIC_SLACK_API_URL || '';

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
   * Get authentication headers with Supabase JWT token
   */
  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  }, []);

  /**
   * Fetch current Slack connection status
   */
  const refreshStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const headers = await getAuthHeaders();
      const response = await fetch(`${SLACK_API_URL}/api/slack/status`, {
        headers,
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
  }, [getAuthHeaders]);

  /**
   * Initiate Slack OAuth flow
   * Token is passed via query parameter since redirect cannot use Authorization header
   */
  const connectSlack = useCallback(async () => {
    try {
      if (!SLACK_API_URL) {
        setError('Slack API URL is not configured');
        return;
      }
      
      if (!supabase) {
        setError('Supabase client not initialized');
        return;
      }
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Please log in to connect Slack');
        return;
      }
      
      const redirectUri = encodeURIComponent(window.location.origin + '/settings');
      const token = encodeURIComponent(session.access_token);
      
      // Token is passed via query parameter since redirect cannot use Authorization header
      window.location.href = `${SLACK_API_URL}/api/slack/connect?redirect_uri=${redirectUri}&token=${token}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate Slack connection');
    }
  }, []);

  /**
   * Disconnect Slack integration
   */
  const disconnectSlack = useCallback(async (): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      
      const headers = await getAuthHeaders();
      const response = await fetch(`${SLACK_API_URL}/api/slack/disconnect`, {
        method: 'POST',
        headers,
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
  }, [getAuthHeaders]);

  /**
   * Update Slack notification preferences
   */
  const updatePreferences = useCallback(async (
    prefs: SlackPreferencesUpdate
  ): Promise<boolean> => {
    try {
      setError(null);
      
      const headers = await getAuthHeaders();
      const response = await fetch(`${SLACK_API_URL}/api/slack/preferences`, {
        method: 'PUT',
        headers,
        credentials: 'include',
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
  }, [getAuthHeaders]);

  /**
   * Send a test message to verify connection
   */
  const testConnection = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      
      const headers = await getAuthHeaders();
      const response = await fetch(`${SLACK_API_URL}/api/slack/test`, {
        method: 'POST',
        headers,
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
  }, [getAuthHeaders]);

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
