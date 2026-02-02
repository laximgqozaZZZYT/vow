/**
 * useCredentials Hook
 *
 * React hook for managing user API credentials (OpenAI, etc.)
 * Communicates with backend for encrypted storage.
 *
 * @module hooks/useCredentials
 */

import { useState, useCallback, useEffect } from 'react';

export type CredentialType = 'openai' | 'anthropic' | 'custom';

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
