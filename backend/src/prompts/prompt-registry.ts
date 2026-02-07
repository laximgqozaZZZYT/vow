/**
 * Prompt Registry - Single Source of Truth for role-based system prompts
 *
 * Provides canonical prompts for each agent role. The canonical prompt
 * is the frontend MCP prompt (`ai-coach-prompt.ts`) stored here as the
 * backend source of truth.
 *
 * @see /home/ubuntu/Downloads/vow/specs/role-based-prompt-system/architecture.md Section 5.2
 */

import { createHash } from 'crypto';
import { getCanonicalCoachPrompt } from './roles/coach.js';
import {
  getBackendBaseExtensionLayer,
  getHearingFlowLayer,
  getEmotionalResponseLayer,
  getCategoryDetectionLayer,
  getCasualConversationLayer,
} from './enhancements/index.js';
import { getAgentConfig } from '../services/agent-config-service.js';
import type { SupabaseClient } from '@supabase/supabase-js';

export type AgentRole = 'AICoach' | 'coach' | 'manager' | 'default';
export type Locale = 'ja' | 'en';

export interface PromptResponse {
  systemPrompt: string;
  role: AgentRole;
  locale: Locale;
  version: string;
  hash: string;
}

const PROMPT_VERSION = '2.0.0';

function computeHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * Get the canonical (base) prompt for a given role and locale.
 *
 * For the 'coach' role, this returns the exact content of the frontend
 * MCP prompt (`ai-coach-prompt.ts`). No enhancement layers or UserContext
 * are included -- those are composed separately for the OpenAI API route.
 */
export function getCanonicalPrompt(role: AgentRole, locale: Locale = 'ja'): PromptResponse {
  // Resolve alias: 'coach' -> 'AICoach'
  const resolvedRole: AgentRole = role === 'coach' ? 'AICoach' : role;
  let systemPrompt: string;

  switch (resolvedRole) {
    case 'AICoach':
      systemPrompt = getCanonicalCoachPrompt(locale);
      break;
    case 'manager':
    case 'default':
    default:
      systemPrompt = getCanonicalCoachPrompt(locale);
      break;
  }

  return {
    systemPrompt,
    role: resolvedRole,
    locale,
    version: PROMPT_VERSION,
    hash: computeHash(systemPrompt),
  };
}

/**
 * Build the full system prompt for the backend OpenAI API route.
 *
 * Composes the canonical base prompt with all enhancement layers:
 *   1. Canonical Base Prompt (from coach.ts)
 *   2. Backend Base Extension (manager role, extended schemas)
 *   3. Hearing Flow (step-by-step category flow, fixed replies, examples)
 *   4. Category Detection (8 category keyword mappings)
 *   5. Casual Conversation (greetings, vague queries, advice patterns)
 *   6. Emotional Response (empathy rules, stress/fatigue handling)
 *
 * This does NOT include UserContext -- that is appended dynamically
 * by `generateSystemPrompt()` in `vow-coach-agent.ts`.
 *
 * @param role - The agent role (currently only 'coach' is supported)
 * @param locale - The locale ('ja' or 'en')
 * @returns The composed system prompt string
 */
export function buildFullPrompt(role: AgentRole, locale: Locale = 'ja'): string {
  // Resolve alias: 'coach' -> 'AICoach'
  const resolvedRole: AgentRole = role === 'coach' ? 'AICoach' : role;

  // Layer 1: Canonical base prompt (uses role for future role-specific prompts)
  const { systemPrompt: canonicalBase } = getCanonicalPrompt(resolvedRole, locale);

  // Layer 2-6: Enhancement layers (role extension, hearing flow, categories, casual, emotional)
  const layers = [
    getBackendBaseExtensionLayer(locale),
    getHearingFlowLayer(locale),
    getCategoryDetectionLayer(locale),
    getCasualConversationLayer(locale),
    getEmotionalResponseLayer(locale),
  ];

  // Compose all layers into the final prompt
  return canonicalBase + '\n' + layers.join('\n');
}

/**
 * Get prompt for a specific user, checking for user override first.
 * Falls back to canonical prompt if no user override exists.
 */
export async function getPromptForUser(
  role: AgentRole,
  locale: Locale,
  supabase: SupabaseClient,
  userId: string,
): Promise<PromptResponse> {
  // Resolve alias
  const resolvedRole: AgentRole = role === 'coach' ? 'AICoach' : role;

  try {
    // Check for user override in agent_configs
    const config = await getAgentConfig(supabase, userId, resolvedRole);
    if (config?.instructions && config.instructions.trim().length > 0) {
      return {
        systemPrompt: config.instructions,
        role: resolvedRole,
        locale,
        version: PROMPT_VERSION,
        hash: computeHash(config.instructions),
      };
    }
  } catch {
    // Fall through to canonical
  }

  // Fall back to canonical prompt
  return getCanonicalPrompt(resolvedRole, locale);
}
