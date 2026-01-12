/**
 * API with Loading Hook
 * 
 * Consolidated API call pattern extracted from useActivityManager.ts and various 
 * components to eliminate code duplication and provide consistent API state 
 * management across the application.
 */

import { useState, useCallback } from 'react';
import type { ApiState, AsyncStatus } from '../types/shared';

/**
 * Configuration options for the API hook
 */
export interface UseApiOptions<T> {
  /** Initial data value */
  initialData?: T;
  /** Whether to automatically reset error state on new requests */
  autoResetError?: boolean;
  /** Custom error handler */
  onError?: (error: Error) => void;
  /** Custom success handler */
  onSuccess?: (data: T) => void;
}

/**
 * Return type for the useApiWithLoading hook
 */
export interface UseApiReturn<T> {
  /** Current loading state */
  loading: boolean;
  /** Current error state */
  error: string | null;
  /** Current data */
  data: T | null;
  /** Current async status */
  status: AsyncStatus;
  /** Execute an API call */
  execute: <Args extends any[]>(apiCall: (...args: Args) => Promise<T>, ...args: Args) => Promise<T | null>;
  /** Reset all state to initial values */
  reset: () => void;
  /** Clear only the error state */
  clearError: () => void;
  /** Set data manually */
  setData: (data: T | null) => void;
}

/**
 * Custom hook for managing API calls with loading and error states
 * Provides a consistent pattern for handling async operations
 * 
 * @param options - Configuration options
 * @returns API state management object
 */
export function useApiWithLoading<T = any>(
  options: UseApiOptions<T> = {}
): UseApiReturn<T> {
  const {
    initialData = null,
    autoResetError = true,
    onError,
    onSuccess
  } = options;

  const [state, setState] = useState<ApiState<T>>({
    loading: false,
    error: null,
    data: initialData
  });

  const [status, setStatus] = useState<AsyncStatus>('idle');

  /**
   * Execute an API call with automatic loading and error handling
   */
  const execute = useCallback(async <Args extends any[]>(
    apiCall: (...args: Args) => Promise<T>,
    ...args: Args
  ): Promise<T | null> => {
    try {
      // Reset error if auto-reset is enabled
      if (autoResetError && state.error) {
        setState(prev => ({ ...prev, error: null }));
      }

      // Set loading state
      setState(prev => ({ ...prev, loading: true }));
      setStatus('loading');

      // Execute the API call
      const result = await apiCall(...args);

      // Update state with success
      setState({
        loading: false,
        error: null,
        data: result
      });
      setStatus('success');

      // Call success handler if provided
      if (onSuccess) {
        onSuccess(result);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      
      // Update state with error
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }));
      setStatus('error');

      // Call error handler if provided
      if (onError && error instanceof Error) {
        onError(error);
      }

      // Log error for debugging
      console.error('[useApiWithLoading] API call failed:', error);

      return null;
    }
  }, [autoResetError, state.error, onError, onSuccess]);

  /**
   * Reset all state to initial values
   */
  const reset = useCallback(() => {
    setState({
      loading: false,
      error: null,
      data: initialData
    });
    setStatus('idle');
  }, [initialData]);

  /**
   * Clear only the error state
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
    if (status === 'error') {
      setStatus('idle');
    }
  }, [status]);

  /**
   * Set data manually (useful for optimistic updates)
   */
  const setData = useCallback((data: T | null) => {
    setState(prev => ({ ...prev, data }));
  }, []);

  return {
    loading: state.loading,
    error: state.error,
    data: state.data,
    status,
    execute,
    reset,
    clearError,
    setData
  };
}

/**
 * Specialized hook for API calls that don't return data
 * Useful for delete operations, updates, etc.
 */
export function useApiAction(options: Omit<UseApiOptions<void>, 'initialData'> = {}) {
  return useApiWithLoading<void>({ ...options, initialData: undefined });
}

/**
 * Hook for managing multiple related API calls
 * Useful when you need to track loading state for multiple operations
 */
export function useMultipleApi<T extends Record<string, any>>() {
  const [states, setStates] = useState<Record<keyof T, ApiState>>({} as Record<keyof T, ApiState>);

  const execute = useCallback(async <K extends keyof T>(
    key: K,
    apiCall: () => Promise<T[K]>
  ): Promise<T[K] | null> => {
    try {
      // Set loading state for this key
      setStates(prev => ({
        ...prev,
        [key]: { ...prev[key], loading: true, error: null }
      }));

      const result = await apiCall();

      // Update state with success
      setStates(prev => ({
        ...prev,
        [key]: { loading: false, error: null, data: result }
      }));

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      
      // Update state with error
      setStates(prev => ({
        ...prev,
        [key]: { ...prev[key], loading: false, error: errorMessage }
      }));

      console.error(`[useMultipleApi] API call failed for ${String(key)}:`, error);
      return null;
    }
  }, []);

  const reset = useCallback((key?: keyof T) => {
    if (key) {
      setStates(prev => ({
        ...prev,
        [key]: { loading: false, error: null, data: null }
      }));
    } else {
      setStates({} as Record<keyof T, ApiState>);
    }
  }, []);

  const getState = useCallback((key: keyof T): ApiState => {
    return states[key] || { loading: false, error: null, data: null };
  }, [states]);

  return {
    execute,
    reset,
    getState,
    states
  };
}

/**
 * Hook for API calls with automatic retry functionality
 */
export function useApiWithRetry<T = any>(
  maxRetries: number = 3,
  retryDelay: number = 1000,
  options: UseApiOptions<T> = {}
) {
  const api = useApiWithLoading<T>(options);
  const [retryCount, setRetryCount] = useState(0);

  const executeWithRetry = useCallback(async <Args extends any[]>(
    apiCall: (...args: Args) => Promise<T>,
    ...args: Args
  ): Promise<T | null> => {
    let currentRetry = 0;
    
    while (currentRetry <= maxRetries) {
      setRetryCount(currentRetry);
      
      const result = await api.execute(apiCall, ...args);
      
      if (result !== null || currentRetry === maxRetries) {
        setRetryCount(0);
        return result;
      }
      
      // Wait before retrying
      if (currentRetry < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, currentRetry)));
      }
      
      currentRetry++;
    }
    
    setRetryCount(0);
    return null;
  }, [api, maxRetries, retryDelay]);

  return {
    ...api,
    execute: executeWithRetry,
    retryCount,
    isRetrying: retryCount > 0
  };
}