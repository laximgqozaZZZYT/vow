/**
 * useRolePrompt - Fetches canonical system prompts from the backend API
 *
 * Implements the SWR (Stale-While-Revalidate) pattern:
 * 1. Returns cached prompt from localStorage immediately
 * 2. Revalidates from backend API in the background
 * 3. Falls back to local ai-coach-prompt.ts if both cache and API fail
 *
 * @see /home/ubuntu/Downloads/vow/specs/role-based-prompt-system/architecture.md Section 5.5
 * @see /home/ubuntu/Downloads/vow/specs/role-based-prompt-system/migration-plan.md Phase 1 Step 1.2
 *
 * @module hooks/useRolePrompt
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { AgentRole } from '../constants/role-prompts';
import { getRoleSystemPrompt } from '../constants/role-prompts';

type Locale = 'ja' | 'en';

interface CachedPrompt {
  systemPrompt: string;
  role: AgentRole;
  locale: Locale;
  version: string;
  hash: string;
  cachedAt: number;
}

interface UseRolePromptOptions {
  /** Auth token for API requests */
  authToken?: string | null;
  /** Whether to enable background revalidation (default: true) */
  revalidate?: boolean;
}

interface UseRolePromptResult {
  /** The system prompt string */
  prompt: string;
  /** Whether the prompt is being fetched from the API */
  isLoading: boolean;
  /** The source of the current prompt */
  source: 'api' | 'cache' | 'local';
  /** Prompt version from the API */
  version: string | null;
  /** Force a re-fetch from the API */
  refresh: () => void;
}

const CACHE_KEY_PREFIX = 'vow_prompt_';
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

function getCacheKey(role: AgentRole, locale: Locale): string {
  return `${CACHE_KEY_PREFIX}${role}_${locale}`;
}

function getFromCache(role: AgentRole, locale: Locale): CachedPrompt | null {
  try {
    const raw = localStorage.getItem(getCacheKey(role, locale));
    if (!raw) return null;
    const cached: CachedPrompt = JSON.parse(raw);
    // Check staleness (24h max)
    if (Date.now() - cached.cachedAt > CACHE_MAX_AGE_MS) return null;
    return cached;
  } catch {
    return null;
  }
}

function saveToCache(data: CachedPrompt): void {
  try {
    localStorage.setItem(getCacheKey(data.role, data.locale), JSON.stringify(data));
  } catch {
    // localStorage full or unavailable - silently ignore
  }
}

/**
 * Hook to fetch a canonical system prompt for a given role.
 *
 * Uses a 3-tier fallback chain:
 * 1. Backend API (`GET /api/prompts/:role?locale=xx`)
 * 2. localStorage cache (if API fails)
 * 3. Local file fallback (`role-prompts.ts` -> `ai-coach-prompt.ts`)
 */
export function useRolePrompt(
  role: AgentRole,
  locale: Locale = 'ja',
  options: UseRolePromptOptions = {},
): UseRolePromptResult {
  const { authToken, revalidate = true } = options;

  // Local fallback prompt (always available synchronously)
  const localPrompt = getRoleSystemPrompt(role, locale);

  // Try to get cached prompt
  const cachedRef = useRef(getFromCache(role, locale));
  const cached = cachedRef.current;

  const [prompt, setPrompt] = useState<string>(cached?.systemPrompt ?? localPrompt);
  const [source, setSource] = useState<'api' | 'cache' | 'local'>(cached ? 'cache' : 'local');
  const [isLoading, setIsLoading] = useState(false);
  const [version, setVersion] = useState<string | null>(cached?.version ?? null);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const refresh = useCallback(() => {
    setFetchTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    if (!revalidate) return;
    if (!authToken) return;

    let cancelled = false;
    setIsLoading(true);

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || '';
    const url = `${backendUrl}/api/prompts/${role}?locale=${locale}`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${authToken}`,
    };

    // Include ETag for conditional request if we have a cached hash
    const currentCached = getFromCache(role, locale);
    if (currentCached?.hash) {
      headers['If-None-Match'] = `"${currentCached.hash}"`;
    }

    fetch(url, { headers })
      .then(async (res) => {
        if (cancelled) return;

        if (res.status === 304) {
          // Not modified - cache is still valid
          if (currentCached) {
            setPrompt(currentCached.systemPrompt);
            setSource('cache');
            setVersion(currentCached.version);
          }
          return;
        }

        if (!res.ok) {
          throw new Error(`Prompt API returned ${res.status}`);
        }

        const data = await res.json();
        if (cancelled) return;

        const cacheEntry: CachedPrompt = {
          systemPrompt: data.systemPrompt,
          role: data.role,
          locale: data.locale,
          version: data.version,
          hash: data.hash,
          cachedAt: Date.now(),
        };

        saveToCache(cacheEntry);
        cachedRef.current = cacheEntry;
        setPrompt(data.systemPrompt);
        setSource('api');
        setVersion(data.version);
      })
      .catch(() => {
        if (cancelled) return;
        // API failed - keep using cached or local fallback
        if (currentCached) {
          setPrompt(currentCached.systemPrompt);
          setSource('cache');
          setVersion(currentCached.version);
        } else {
          setPrompt(localPrompt);
          setSource('local');
          setVersion(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [role, locale, authToken, revalidate, localPrompt, fetchTrigger]);

  return { prompt, isLoading, source, version, refresh };
}
