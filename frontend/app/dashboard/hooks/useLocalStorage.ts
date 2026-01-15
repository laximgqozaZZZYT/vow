/**
 * Local Storage Hook
 * 
 * Consolidated localStorage management extracted from Widget.Mindmap.tsx and 
 * other components to eliminate code duplication and provide consistent 
 * storage handling across the application.
 */

import { useState, useEffect, useCallback } from 'react';
import { debug } from '../../../lib/debug';

/**
 * Options for localStorage hook
 */
export interface UseLocalStorageOptions<T> {
  /** Default value if key doesn't exist */
  defaultValue?: T;
  /** Custom serializer function */
  serializer?: {
    parse: (value: string) => T;
    stringify: (value: T) => string;
  };
  /** Whether to sync across tabs/windows */
  syncAcrossTabs?: boolean;
}

/**
 * Return type for useLocalStorage hook
 */
export interface UseLocalStorageReturn<T> {
  /** Current value */
  value: T;
  /** Set new value */
  setValue: (value: T | ((prev: T) => T)) => void;
  /** Remove value from storage */
  removeValue: () => void;
  /** Check if value exists in storage */
  hasValue: boolean;
  /** Loading state (true during SSR) */
  loading: boolean;
  /** Error state */
  error: string | null;
}

/**
 * Custom hook for managing localStorage with React state synchronization
 * Provides type-safe localStorage operations with SSR support
 * 
 * @param key - Storage key
 * @param options - Configuration options
 * @returns Storage management object
 */
export function useLocalStorage<T>(
  key: string,
  options: UseLocalStorageOptions<T> = {}
): UseLocalStorageReturn<T> {
  const {
    defaultValue,
    serializer = {
      parse: JSON.parse,
      stringify: JSON.stringify
    },
    syncAcrossTabs = false
  } = options;

  // State for the stored value
  const [storedValue, setStoredValue] = useState<T>(() => {
    // Return default value during SSR
    if (typeof window === 'undefined') {
      return defaultValue as T;
    }

    try {
      const item = window.localStorage.getItem(key);
      if (item === null) {
        return defaultValue as T;
      }
      
      // Handle primitive values (strings, numbers, booleans)
      if (typeof defaultValue === 'string' && item) {
        return item as T;
      }
      if (typeof defaultValue === 'number') {
        const parsed = Number(item);
        return (isNaN(parsed) ? defaultValue : parsed) as T;
      }
      if (typeof defaultValue === 'boolean') {
        return (item === 'true') as T;
      }
      
      // Handle complex objects
      return serializer.parse(item);
    } catch (error) {
      debug.warn(`[useLocalStorage] Error reading localStorage key "${key}":`, error);
      return defaultValue as T;
    }
  });

  const [loading, setLoading] = useState(typeof window === 'undefined');
  const [error, setError] = useState<string | null>(null);
  const [hasValue, setHasValue] = useState(false);

  // Initialize on client side
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const item = window.localStorage.getItem(key);
      setHasValue(item !== null);
      
      if (item !== null) {
        let parsed: T;
        
        // Handle primitive values
        if (typeof defaultValue === 'string' && item) {
          parsed = item as T;
        } else if (typeof defaultValue === 'number') {
          const num = Number(item);
          parsed = (isNaN(num) ? defaultValue : num) as T;
        } else if (typeof defaultValue === 'boolean') {
          parsed = (item === 'true') as T;
        } else {
          parsed = serializer.parse(item);
        }
        
        setStoredValue(parsed);
      }
      
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to read from localStorage';
      setError(errorMessage);
      debug.warn(`[useLocalStorage] Error initializing key "${key}":`, err);
    } finally {
      setLoading(false);
    }
  }, [key, defaultValue, serializer]);

  // Listen for storage changes across tabs
  useEffect(() => {
    if (!syncAcrossTabs || typeof window === 'undefined') return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          let parsed: T;
          
          // Handle primitive values
          if (typeof defaultValue === 'string') {
            parsed = e.newValue as T;
          } else if (typeof defaultValue === 'number') {
            const num = Number(e.newValue);
            parsed = (isNaN(num) ? defaultValue : num) as T;
          } else if (typeof defaultValue === 'boolean') {
            parsed = (e.newValue === 'true') as T;
          } else {
            parsed = serializer.parse(e.newValue);
          }
          
          setStoredValue(parsed);
          setHasValue(true);
          setError(null);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to parse storage event';
          setError(errorMessage);
          debug.warn(`[useLocalStorage] Error parsing storage event for key "${key}":`, err);
        }
      } else if (e.key === key && e.newValue === null) {
        setStoredValue(defaultValue as T);
        setHasValue(false);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, defaultValue, serializer, syncAcrossTabs]);

  /**
   * Set value in localStorage and update state
   */
  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    try {
      // Allow value to be a function so we have the same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      setStoredValue(valueToStore);
      
      if (typeof window !== 'undefined') {
        let stringValue: string;
        
        // Handle primitive values
        if (typeof valueToStore === 'string') {
          stringValue = valueToStore;
        } else if (typeof valueToStore === 'number' || typeof valueToStore === 'boolean') {
          stringValue = String(valueToStore);
        } else {
          stringValue = serializer.stringify(valueToStore);
        }
        
        window.localStorage.setItem(key, stringValue);
        setHasValue(true);
        setError(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to write to localStorage';
      setError(errorMessage);
      debug.warn(`[useLocalStorage] Error setting localStorage key "${key}":`, err);
    }
  }, [key, storedValue, serializer]);

  /**
   * Remove value from localStorage
   */
  const removeValue = useCallback(() => {
    try {
      setStoredValue(defaultValue as T);
      setHasValue(false);
      
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
        setError(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove from localStorage';
      setError(errorMessage);
      debug.warn(`[useLocalStorage] Error removing localStorage key "${key}":`, err);
    }
  }, [key, defaultValue]);

  return {
    value: storedValue,
    setValue,
    removeValue,
    hasValue,
    loading,
    error
  };
}

/**
 * Simple localStorage hook for string values (backward compatibility)
 * Matches the pattern used in Widget.Mindmap.tsx
 */
export function useLocalStorageString(key: string, defaultValue: string = '') {
  return useLocalStorage(key, { defaultValue });
}

/**
 * Simple localStorage hook for boolean flags
 * Useful for UI state like "seen" flags, preferences, etc.
 */
export function useLocalStorageFlag(key: string, defaultValue: boolean = false) {
  return useLocalStorage(key, { defaultValue });
}

/**
 * Hook for managing localStorage with automatic JSON serialization
 * Useful for complex objects
 */
export function useLocalStorageObject<T extends object>(
  key: string, 
  defaultValue: T
) {
  return useLocalStorage(key, { 
    defaultValue,
    serializer: {
      parse: JSON.parse,
      stringify: JSON.stringify
    }
  });
}

/**
 * Hook for managing localStorage with cross-tab synchronization
 * Useful for user preferences that should sync across browser tabs
 */
export function useLocalStorageSync<T>(
  key: string,
  options: UseLocalStorageOptions<T> = {}
) {
  return useLocalStorage(key, { ...options, syncAcrossTabs: true });
}

/**
 * Utility function to safely access localStorage (for non-hook usage)
 */
export const localStorageUtils = {
  /**
   * Get item from localStorage with error handling
   */
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      debug.warn(`[localStorageUtils] Error getting item "${key}":`, error);
      return null;
    }
  },

  /**
   * Set item in localStorage with error handling
   */
  setItem: (key: string, value: string): boolean => {
    if (typeof window === 'undefined') return false;
    
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (error) {
      debug.warn(`[localStorageUtils] Error setting item "${key}":`, error);
      return false;
    }
  },

  /**
   * Remove item from localStorage with error handling
   */
  removeItem: (key: string): boolean => {
    if (typeof window === 'undefined') return false;
    
    try {
      window.localStorage.removeItem(key);
      return true;
    } catch (error) {
      debug.warn(`[localStorageUtils] Error removing item "${key}":`, error);
      return false;
    }
  },

  /**
   * Check if localStorage is available
   */
  isAvailable: (): boolean => {
    if (typeof window === 'undefined') return false;
    
    try {
      const testKey = '__localStorage_test__';
      window.localStorage.setItem(testKey, 'test');
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }
};