/**
 * usePromptTemplate Hook
 *
 * Fetches a prompt template from the backend prompt-templates API.
 * Templates are cached in localStorage with a 24h TTL.
 *
 * @module hooks/usePromptTemplate
 */

'use client';

import { useState, useCallback, useRef } from 'react';

const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || '';
const CACHE_PREFIX = 'vow_prompt_template_';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedTemplate {
  content: string;
  version: string;
  cachedAt: number;
}

interface UsePromptTemplateReturn {
  /** Fetch and return the template content (with caching) */
  getTemplate: (key: string, locale?: string) => Promise<string | null>;
  /** Whether a fetch is in progress */
  isLoading: boolean;
}

export function usePromptTemplate(authToken: string | null): UsePromptTemplateReturn {
  const [isLoading, setIsLoading] = useState(false);
  const cacheRef = useRef<Map<string, string>>(new Map());

  const getTemplate = useCallback(async (key: string, locale: string = 'ja'): Promise<string | null> => {
    const cacheKey = `${key}_${locale}`;

    // Check in-memory cache first
    if (cacheRef.current.has(cacheKey)) {
      return cacheRef.current.get(cacheKey)!;
    }

    // Check localStorage cache
    try {
      const cached = localStorage.getItem(`${CACHE_PREFIX}${cacheKey}`);
      if (cached) {
        const parsed: CachedTemplate = JSON.parse(cached);
        if (Date.now() - parsed.cachedAt < CACHE_TTL_MS) {
          cacheRef.current.set(cacheKey, parsed.content);
          return parsed.content;
        }
      }
    } catch { /* ignore cache errors */ }

    // Fetch from backend
    if (!authToken || !BACKEND_API_URL) return null;

    setIsLoading(true);
    try {
      const response = await fetch(
        `${BACKEND_API_URL}/api/prompt-templates/${encodeURIComponent(key)}?locale=${locale}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      if (!response.ok) return null;

      const data = await response.json();
      const content = data.content as string;

      // Cache in memory and localStorage
      cacheRef.current.set(cacheKey, content);
      try {
        localStorage.setItem(`${CACHE_PREFIX}${cacheKey}`, JSON.stringify({
          content,
          version: data.version || '1.0.0',
          cachedAt: Date.now(),
        }));
      } catch { /* ignore storage errors */ }

      return content;
    } catch {
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [authToken]);

  return { getTemplate, isLoading };
}

export default usePromptTemplate;
