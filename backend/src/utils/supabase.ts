/**
 * Supabase Client Utility
 *
 * Provides a singleton Supabase client instance for database operations.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSettings } from '../config.js';

let _supabaseClient: SupabaseClient | null = null;

/**
 * Get or create the singleton Supabase client instance.
 * Uses service role key for backend operations.
 */
export function getSupabaseClient(): SupabaseClient {
  if (_supabaseClient === null) {
    const settings = getSettings();

    if (!settings.supabaseUrl || !settings.supabaseServiceRoleKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
    }

    _supabaseClient = createClient(settings.supabaseUrl, settings.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return _supabaseClient;
}

/**
 * Create a Supabase client with a specific user's JWT token.
 * Used for operations that need to respect RLS policies.
 */
export function getSupabaseClientWithAuth(accessToken: string): SupabaseClient {
  const settings = getSettings();

  if (!settings.supabaseUrl || !settings.supabaseAnonKey) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required');
  }

  return createClient(settings.supabaseUrl, settings.supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Reset the singleton instance (useful for testing).
 */
export function resetSupabaseClient(): void {
  _supabaseClient = null;
}
