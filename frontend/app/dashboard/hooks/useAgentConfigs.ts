/**
 * useAgentConfigs - Backend API integration for agent configurations
 *
 * Fetches built-in + custom agent configs from the backend API.
 * Falls back to BUILTIN_AGENTS constant if API is unavailable.
 * Handles localStorage → backend migration on first load.
 *
 * @module hooks/useAgentConfigs
 */

'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import api from '../../../lib/api';
import { BUILTIN_AGENTS, type AgentConfig } from '../components/Modal.AgentDetail';

const LOCALSTORAGE_KEY = 'vow_custom_agents';

interface UseAgentConfigsReturn {
  /** All configs (built-in + custom) */
  configs: AgentConfig[];
  /** Custom agents only */
  customConfigs: AgentConfig[];
  /** Built-in agents only */
  builtInConfigs: AgentConfig[];
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Create a new custom agent */
  createAgent: (config: Partial<AgentConfig>) => Promise<AgentConfig | null>;
  /** Update an existing agent */
  updateAgent: (agentId: string, updates: Partial<AgentConfig>) => Promise<AgentConfig | null>;
  /** Delete a custom agent */
  deleteAgent: (agentId: string) => Promise<boolean>;
  /** Force refresh from API */
  refresh: () => void;
}

/**
 * Get fallback configs from BUILTIN_AGENTS constant
 */
function getFallbackConfigs(): AgentConfig[] {
  return Object.values(BUILTIN_AGENTS);
}

export function useAgentConfigs(): UseAgentConfigsReturn {
  const [configs, setConfigs] = useState<AgentConfig[]>(getFallbackConfigs);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const migrationDoneRef = useRef(false);

  const refresh = useCallback(() => {
    setFetchTrigger(prev => prev + 1);
  }, []);

  // Fetch configs from API
  useEffect(() => {
    let cancelled = false;

    async function fetchConfigs() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await api.get('/api/agent-configs');
        if (cancelled) return;

        const apiConfigs: AgentConfig[] = (response.configs || []).map((c: Record<string, unknown>) => ({
          id: c.id as string,
          name: c.name as string,
          role: (c.role as string) || 'custom',
          description: (c.description as string) || '',
          icon: (c.icon as string) || '🤖',
          systemPrompt: (c.systemPrompt as string) || '',
          capabilities: (c.capabilities as string[]) || [],
          isBuiltIn: (c.isBuiltIn as boolean) || false,
        }));

        if (apiConfigs.length > 0) {
          setConfigs(apiConfigs);
        } else {
          // API returned empty - use fallback
          setConfigs(getFallbackConfigs());
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to fetch agent configs';
        setError(message);
        // Keep fallback configs
        setConfigs(prev => prev.length > 0 ? prev : getFallbackConfigs());
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchConfigs();
    return () => { cancelled = true; };
  }, [fetchTrigger]);

  // localStorage migration (once after initial fetch)
  useEffect(() => {
    if (isLoading || migrationDoneRef.current) return;
    if (typeof window === 'undefined') return;

    const stored = localStorage.getItem(LOCALSTORAGE_KEY);
    if (!stored) {
      migrationDoneRef.current = true;
      return;
    }

    let localAgents: AgentConfig[];
    try {
      localAgents = JSON.parse(stored);
    } catch {
      // Invalid data, remove it
      localStorage.removeItem(LOCALSTORAGE_KEY);
      migrationDoneRef.current = true;
      return;
    }

    if (!Array.isArray(localAgents) || localAgents.length === 0) {
      localStorage.removeItem(LOCALSTORAGE_KEY);
      migrationDoneRef.current = true;
      return;
    }

    // Migrate to backend
    migrationDoneRef.current = true;

    api.post('/api/agent-configs/migrate', { agents: localAgents })
      .then(() => {
        localStorage.removeItem(LOCALSTORAGE_KEY);
        // Refresh to get migrated configs
        setFetchTrigger(prev => prev + 1);
      })
      .catch(() => {
        // Migration failed - keep localStorage for next attempt
        // but still show local agents in the meantime
        setConfigs(prev => {
          const existingIds = new Set(prev.map(c => c.id));
          const newFromLocal = localAgents.filter(a => !existingIds.has(a.id));
          return [...prev, ...newFromLocal];
        });
      });
  }, [isLoading]);

  // Create a new custom agent
  const createAgent = useCallback(async (config: Partial<AgentConfig>): Promise<AgentConfig | null> => {
    try {
      const response = await api.post('/api/agent-configs', {
        name: config.name,
        description: config.description,
        icon: config.icon,
        systemPrompt: config.systemPrompt,
        role: config.role || 'custom',
        capabilities: config.capabilities || [],
      });

      const newAgent: AgentConfig = {
        id: response.id,
        name: response.name,
        role: response.role || 'custom',
        description: response.description || '',
        icon: response.icon || '🤖',
        systemPrompt: response.systemPrompt || '',
        capabilities: response.capabilities || [],
        isBuiltIn: false,
      };

      // Optimistic update
      setConfigs(prev => [...prev, newAgent]);
      return newAgent;
    } catch (err) {
      // Fallback: create locally with generated ID
      const fallbackAgent: AgentConfig = {
        id: `custom-${Date.now()}`,
        name: config.name || 'New Agent',
        role: config.role || 'custom',
        description: config.description || '',
        icon: config.icon || '🤖',
        systemPrompt: config.systemPrompt || '',
        capabilities: config.capabilities || [],
        isBuiltIn: false,
      };
      setConfigs(prev => [...prev, fallbackAgent]);
      return fallbackAgent;
    }
  }, []);

  // Update an existing agent
  const updateAgent = useCallback(async (agentId: string, updates: Partial<AgentConfig>): Promise<AgentConfig | null> => {
    // Optimistic update
    const prevConfigs = configs;
    setConfigs(prev =>
      prev.map(c => c.id === agentId ? { ...c, ...updates } : c)
    );

    try {
      const response = await api.put(`/api/agent-configs/${agentId}`, {
        name: updates.name,
        description: updates.description,
        icon: updates.icon,
        systemPrompt: updates.systemPrompt,
        role: updates.role,
        capabilities: updates.capabilities,
      });

      const updatedAgent: AgentConfig = {
        id: response.id,
        name: response.name,
        role: response.role || 'custom',
        description: response.description || '',
        icon: response.icon || '🤖',
        systemPrompt: response.systemPrompt || '',
        capabilities: response.capabilities || [],
        isBuiltIn: response.isBuiltIn || false,
      };

      // Replace with authoritative server response
      setConfigs(prev =>
        prev.map(c => c.id === agentId ? updatedAgent : c)
      );

      return updatedAgent;
    } catch {
      // Revert on failure
      setConfigs(prevConfigs);
      return null;
    }
  }, [configs]);

  // Delete a custom agent
  const deleteAgent = useCallback(async (agentId: string): Promise<boolean> => {
    // Optimistic update
    const prevConfigs = configs;
    setConfigs(prev => prev.filter(c => c.id !== agentId));

    try {
      await api.delete(`/api/agent-configs/${agentId}`);
      return true;
    } catch {
      // Revert on failure
      setConfigs(prevConfigs);
      return false;
    }
  }, [configs]);

  // Derived values
  const customConfigs = useMemo(() => configs.filter(c => !c.isBuiltIn), [configs]);
  const builtInConfigs = useMemo(() => configs.filter(c => c.isBuiltIn), [configs]);

  return {
    configs,
    customConfigs,
    builtInConfigs,
    isLoading,
    error,
    createAgent,
    updateAgent,
    deleteAgent,
    refresh,
  };
}
