/**
 * useAIProvider Hook
 *
 * Manages AI provider selection across MCP servers and API providers (OpenAI, etc.).
 * Features:
 * - Lists available MCP server connections as providers
 * - Checks API provider credentials via backend
 * - Persists selected provider to localStorage
 * - Provides typed provider selection interface
 *
 * @module hooks/useAIProvider
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useMultiAgentServerContext } from '../contexts/MultiAgentServerContext';
import type { McpServer } from '../types/agent.types';

// =============================================================================
// Types
// =============================================================================

export type ProviderSource = 'mcp' | 'api';

export interface AIProviderOption {
  /** Unique identifier: 'mcp-{serverId}' or 'api-{provider}' */
  id: string;
  /** Provider source category */
  source: ProviderSource;
  /** Display name (English) */
  name: string;
  /** Display name (Japanese) */
  nameJa: string;
  /** Whether the provider is currently available/connected */
  isAvailable: boolean;
  /** Model identifier if known */
  model?: string;
  /** MCP server object (when source is 'mcp') */
  mcpServer?: McpServer;
  /** API provider identifier (when source is 'api') */
  apiProvider?: string;
}

export interface UseAIProviderReturn {
  /** All discovered provider options */
  availableProviders: AIProviderOption[];
  /** Currently selected provider (null if none selected) */
  selectedProvider: AIProviderOption | null;
  /** Switch to a different provider by ID */
  switchProvider: (id: string) => void;
  /** Whether the selected provider is an MCP server */
  isMcp: boolean;
  /** Whether the selected provider is an API provider */
  isApiProvider: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const STORAGE_KEY = 'vow_selected_provider';

const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || '';

/** API providers to check for credentials */
const API_PROVIDERS = [
  { key: 'openai', name: 'OpenAI', nameJa: 'OpenAI' },
  { key: 'anthropic', name: 'Anthropic', nameJa: 'Anthropic' },
  { key: 'gemini', name: 'Gemini', nameJa: 'Gemini' },
  { key: 'codex', name: 'Codex', nameJa: 'Codex' },
] as const;

// =============================================================================
// Helper: Check API credential existence
// =============================================================================

interface CredentialCheckResult {
  provider: string;
  exists: boolean;
  model?: string;
}

async function checkCredential(
  provider: string,
  authToken: string,
): Promise<CredentialCheckResult> {
  if (!BACKEND_API_URL) {
    return { provider, exists: false };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      `${BACKEND_API_URL}/api/credentials/${provider}`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { provider, exists: false };
    }

    const data = await response.json();
    return {
      provider,
      exists: !!data.exists,
      model: data.model,
    };
  } catch {
    return { provider, exists: false };
  }
}

// =============================================================================
// Hook
// =============================================================================

export function useAIProvider(authToken: string | null): UseAIProviderReturn {
  const { config, connections } = useMultiAgentServerContext();

  // State for API credential availability
  const [apiCredentials, setApiCredentials] = useState<CredentialCheckResult[]>(
    [],
  );
  // State for selected provider ID (loaded from localStorage)
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEY);
  });

  // -------------------------------------------------------------------------
  // Effect: Check API provider credentials when authToken changes
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!authToken || !BACKEND_API_URL) {
      setApiCredentials([]);
      return;
    }

    let cancelled = false;

    const checkAll = async () => {
      const results = await Promise.all(
        API_PROVIDERS.map((p) => checkCredential(p.key, authToken)),
      );
      if (!cancelled) {
        setApiCredentials(results);
      }
    };

    checkAll();

    return () => {
      cancelled = true;
    };
  }, [authToken]);

  // -------------------------------------------------------------------------
  // Build MCP provider options from server connections
  // -------------------------------------------------------------------------
  const mcpProviders: AIProviderOption[] = useMemo(() => {
    return config.servers
      .filter((server) => server.enabled)
      .map((server) => {
        const conn = connections.get(server.id);
        const isConnected = conn?.connectionState === 'connected';

        return {
          id: `mcp-${server.id}`,
          source: 'mcp' as ProviderSource,
          name: server.name,
          nameJa: server.name,
          isAvailable: isConnected,
          mcpServer: server,
        };
      });
  }, [config.servers, connections]);

  // -------------------------------------------------------------------------
  // Build API provider options from credential checks
  // -------------------------------------------------------------------------
  const apiProviderOptions: AIProviderOption[] = useMemo(() => {
    return apiCredentials
      .filter((cred) => cred.exists)
      .map((cred) => {
        const providerInfo = API_PROVIDERS.find((p) => p.key === cred.provider);
        return {
          id: `api-${cred.provider}`,
          source: 'api' as ProviderSource,
          name: providerInfo?.name ?? cred.provider,
          nameJa: providerInfo?.nameJa ?? cred.provider,
          isAvailable: true,
          model: cred.model,
          apiProvider: cred.provider,
        };
      });
  }, [apiCredentials]);

  // -------------------------------------------------------------------------
  // Combined provider list
  // -------------------------------------------------------------------------
  const availableProviders = useMemo(
    () => [...mcpProviders, ...apiProviderOptions],
    [mcpProviders, apiProviderOptions],
  );

  // -------------------------------------------------------------------------
  // Resolve selected provider
  // -------------------------------------------------------------------------
  const selectedProvider = useMemo((): AIProviderOption | null => {
    if (!selectedId) {
      // Prefer the first available provider over unavailable ones
      const firstAvailable = availableProviders.find((p) => p.isAvailable);
      return firstAvailable ?? availableProviders[0] ?? null;
    }
    const found = availableProviders.find((p) => p.id === selectedId);
    // Fall back to first available if saved selection no longer exists
    if (!found) {
      const firstAvailable = availableProviders.find((p) => p.isAvailable);
      return firstAvailable ?? availableProviders[0] ?? null;
    }
    return found;
  }, [selectedId, availableProviders]);

  // -------------------------------------------------------------------------
  // Switch provider
  // -------------------------------------------------------------------------
  const switchProvider = useCallback(
    (id: string) => {
      const exists = availableProviders.some((p) => p.id === id);
      if (!exists) return;

      setSelectedId(id);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, id);
      }
    },
    [availableProviders],
  );

  // -------------------------------------------------------------------------
  // Derived flags
  // -------------------------------------------------------------------------
  const isMcp = selectedProvider?.source === 'mcp';
  const isApiProvider = selectedProvider?.source === 'api';

  return {
    availableProviders,
    selectedProvider,
    switchProvider,
    isMcp,
    isApiProvider,
  };
}

export default useAIProvider;
