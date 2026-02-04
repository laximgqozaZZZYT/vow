/**
 * useCredentials Hook
 *
 * React hook for managing user API credentials (OpenAI, etc.)
 * Communicates with backend for encrypted storage.
 *
 * @module hooks/useCredentials
 */

import { useState, useCallback, useEffect } from 'react';

export type CredentialType = 'openai' | 'anthropic' | 'gemini' | 'codex' | 'custom';

/**
 * AI Provider configuration for UI
 */
export interface AIProviderConfig {
  id: CredentialType;
  name: string;
  nameJa: string;
  defaultModel: string;
  models: string[];
  description: string;
  descriptionJa: string;
}

/**
 * Available AI providers configuration
 */
export const AI_PROVIDERS: Record<CredentialType, AIProviderConfig> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    nameJa: 'OpenAI',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
    description: 'GPT-4 and GPT-3.5 models for general AI tasks',
    descriptionJa: '汎用AIタスク向けGPT-4/GPT-3.5モデル',
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    nameJa: 'Anthropic Claude',
    defaultModel: 'claude-sonnet-4-20250514',
    models: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
    description: 'Claude models - great for analysis and coding',
    descriptionJa: 'Claude モデル - 分析とコーディングに最適',
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    nameJa: 'Google Gemini',
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    description: 'Google Gemini models with multimodal capabilities',
    descriptionJa: 'マルチモーダル対応のGoogle Geminiモデル',
  },
  codex: {
    id: 'codex',
    name: 'OpenAI Codex/o-series',
    nameJa: 'OpenAI Codex/oシリーズ',
    defaultModel: 'codex-mini-latest',
    models: ['codex-mini-latest', 'o3-mini', 'o1-mini', 'o1'],
    description: 'OpenAI reasoning models (o1, o3) and Codex',
    descriptionJa: 'OpenAI推論モデル（o1、o3）とCodex',
  },
  custom: {
    id: 'custom',
    name: 'Custom Provider',
    nameJa: 'カスタムプロバイダー',
    defaultModel: '',
    models: [],
    description: 'Custom OpenAI-compatible API endpoint',
    descriptionJa: 'OpenAI互換カスタムAPIエンドポイント',
  },
};

export interface CredentialInfo {
  exists: boolean;
  type: CredentialType;
  model?: string;
  endpoint?: string;
  maskedKey?: string;
  updatedAt?: string;
}

export interface SaveCredentialInput {
  apiKey: string;
  model?: string;
  endpoint?: string;
}

export interface UseCredentialsReturn {
  credential: CredentialInfo | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  checkCredential: (type: CredentialType) => Promise<CredentialInfo | null>;
  saveCredential: (type: CredentialType, input: SaveCredentialInput) => Promise<boolean>;
  deleteCredential: (type: CredentialType) => Promise<boolean>;
  clearError: () => void;
}

export function useCredentials(authToken?: string | null): UseCredentialsReturn {
  const [credential, setCredential] = useState<CredentialInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || '';

  const checkCredential = useCallback(async (type: CredentialType): Promise<CredentialInfo | null> => {
    if (!authToken) {
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${backendUrl}/api/credentials/${type}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to check credential: ${errorText}`);
      }

      const data = await response.json();
      const info: CredentialInfo = {
        exists: data.exists,
        type: data.type,
        model: data.model,
        endpoint: data.endpoint,
        maskedKey: data.maskedKey,
        updatedAt: data.updatedAt,
      };

      setCredential(info);
      return info;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to check credential';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [authToken, backendUrl]);

  const saveCredential = useCallback(async (
    type: CredentialType,
    input: SaveCredentialInput
  ): Promise<boolean> => {
    if (!authToken) {
      setError('認証が必要です');
      return false;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`${backendUrl}/api/credentials/${type}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to save credential: ${errorText}`);
      }

      const data = await response.json();

      setCredential({
        exists: true,
        type: data.type,
        model: input.model,
        endpoint: input.endpoint,
        maskedKey: data.maskedKey,
      });

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save credential';
      setError(message);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [authToken, backendUrl]);

  const deleteCredential = useCallback(async (type: CredentialType): Promise<boolean> => {
    if (!authToken) {
      setError('認証が必要です');
      return false;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`${backendUrl}/api/credentials/${type}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete credential: ${errorText}`);
      }

      setCredential({
        exists: false,
        type,
      });

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete credential';
      setError(message);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [authToken, backendUrl]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    credential,
    isLoading,
    isSaving,
    error,
    checkCredential,
    saveCredential,
    deleteCredential,
    clearError,
  };
}

export default useCredentials;
