import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api';
import { supabase } from '../../../lib/supabaseClient';
import { GuestDataMigration, type GuestDataMigrationResult } from '../../../lib/guest-data-migration';
import { debug } from '../../../lib/debug';
import type { AuthContext } from '../types';

export function useAuth(): AuthContext {
  const router = useRouter();
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [actorLabel, setActorLabel] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(false);
  const previousIsGuestRef = useRef<boolean>(false);
  const migrationInProgressRef = useRef<boolean>(false);
  
  // Migration state
  const [migrationStatus, setMigrationStatus] = useState<'idle' | 'checking' | 'migrating' | 'success' | 'error'>('idle');
  const [migrationResult, setMigrationResult] = useState<GuestDataMigrationResult | null>(null);
  const [migrationError, setMigrationError] = useState<string | null>(null);

  // Helper function to extract user ID from Supabase session
  const getUserIdFromSession = async (): Promise<string | null> => {
    try {
      const { supabase } = await import('../../../lib/supabaseClient');
      if (!supabase) return null;
      
      const { data: { session } } = await supabase.auth.getSession();
      return session?.user?.id || null;
    } catch (error) {
      console.error('[auth] Failed to get user ID:', error);
      return null;
    }
  };

  // Migration execution function
  const performMigration = async (userId: string) => {
    setMigrationStatus('migrating');
    setMigrationError(null);
    migrationInProgressRef.current = true;
    
    try {
      debug.log('[auth] Starting guest data migration for user:', userId);
      
      const result = await GuestDataMigration.migrateGuestDataToSupabase(userId);
      
      if (result.success) {
        setMigrationStatus('success');
        setMigrationResult(result);
        const successMessage = `Successfully migrated ${result.migratedGoals} goals, ${result.migratedHabits} habits, and ${result.migratedActivities} activities`;
        setAuthError(successMessage);
        debug.log('[auth] Migration completed successfully:', result);
        
        // Dispatch event to trigger data reload
        window.dispatchEvent(new CustomEvent('guestDataMigrated'));
        
        // Clear success message after 5 seconds
        setTimeout(() => {
          setAuthError(null);
          setMigrationStatus('idle');
          setMigrationResult(null);
        }, 5000);
      } else {
        setMigrationStatus('error');
        setMigrationError(result.errors.join(', '));
        setAuthError(`Migration completed with errors: ${result.errors.join(', ')}`);
        debug.warn('[auth] Migration completed with errors:', result);
      }
    } catch (error) {
      setMigrationStatus('error');
      const errorMessage = (error as any)?.message || String(error);
      setMigrationError(errorMessage);
      setAuthError(`Migration failed: ${errorMessage}`);
      console.error('[auth] Migration failed:', error);
    } finally {
      migrationInProgressRef.current = false;
    }
  };

  // Retry migration function
  const retryMigration = async () => {
    if (migrationStatus === 'error' && isAuthed && !isGuest) {
      debug.log('[auth] Retrying guest data migration');
      const userId = await getUserIdFromSession();
      if (userId) {
        await performMigration(userId);
      } else {
        setMigrationError('Unable to get user ID for retry');
      }
    }
  };

  // Initial authentication check
  useEffect(() => {
    (async () => {
      try {
        // Supabase統合版: 認証状態の確認
        let hasSupabaseSession = false;
        let sessionUserId: string | null = null;
        try {
          const { supabase } = await import('../../../lib/supabaseClient');
          if (supabase) {
            const { data: { session } } = await supabase.auth.getSession();
            const accessToken = session?.access_token ?? null;
            hasSupabaseSession = !!accessToken;
            sessionUserId = session?.user?.id || null;
            
            debug.log('[auth] Supabase session check:', { hasSession: hasSupabaseSession, userId: sessionUserId });
            
            // APIライブラリにトークンを設定（互換性のため）
            ;(api as any).setBearerToken?.(accessToken);
          }
        } catch (error) {
          console.error('[auth] Session check failed:', error);
        }

        // バックエンドの認証状態も確認
        try {
          debug.log('[auth] Calling api.me()...');
          const me = await api.me();
          debug.log('[dashboard] me() result:', me);
          const a = (me as any)?.actor;
          debug.log('[auth] Actor extracted:', a);
          
          if (a?.type === 'user') {
            debug.log('[auth] User actor detected');
            setActorLabel(`user:${a.id}`);
            setIsAuthed(true);
            setIsGuest(false);
            
            // Check for guest data migration immediately after detecting authenticated user
            if (sessionUserId && GuestDataMigration.hasGuestData() && migrationStatus === 'idle') {
              debug.log('[auth] Initial load: Guest data found for authenticated user, starting migration');
              await performMigration(sessionUserId);
            }
          } else if (a?.type === 'guest') {
            debug.log('[auth] Guest actor detected');
            setActorLabel(`guest:${a.id}`);
            // ゲストユーザーも認証済みとして扱い、ローカル機能を有効化
            debug.log('[auth] Guest user detected, enabling local features');
            debug.log('[auth] Setting isAuthed to true for guest user');
            setIsAuthed(true);
            setIsGuest(true);
          } else {
            debug.log('[auth] No valid actor found');
            setActorLabel('');
            setIsAuthed(false);
            setIsGuest(false);
          }
        } catch (error) {
          console.error('[dashboard] me() failed:', error);
          console.error('[dashboard] Error details:', {
            name: (error as any)?.name,
            message: (error as any)?.message,
            stack: (error as any)?.stack
          });
          // Supabaseセッションがある場合は認証済みとして扱う
          if (hasSupabaseSession) {
            debug.log('[auth] Fallback: Using Supabase session for auth');
            setIsAuthed(true);
            setIsGuest(false);
            
            // Check for guest data migration in fallback case too
            if (sessionUserId && GuestDataMigration.hasGuestData() && migrationStatus === 'idle') {
              debug.log('[auth] Fallback: Guest data found for authenticated user, starting migration');
              await performMigration(sessionUserId);
            }
          } else {
            debug.log('[auth] No fallback available, setting isAuthed to false');
            setIsAuthed(false);
          }
        }
      } catch (e) {
        console.error('Failed to initialize auth', e);
        setIsAuthed(false);
      }
    })();
  }, []);

  // ゲストから認証ユーザーへの変化を監視してゲストデータを移行
  useEffect(() => {
    const handleGuestToUserTransition = async () => {
      debug.log('[auth] Transition check:', { 
        previousIsGuest: previousIsGuestRef.current, 
        currentIsGuest: isGuest, 
        isAuthed, 
        migrationInProgress: migrationInProgressRef.current,
        migrationStatus
      });
      
      // Trigger migration when transitioning from guest to authenticated user
      if (!isGuest && isAuthed && !migrationInProgressRef.current && migrationStatus === 'idle') {
        debug.log('[auth] Authenticated user detected, checking for guest data migration');
        
        const userId = await getUserIdFromSession();
        if (!userId) {
          debug.warn('[auth] No user ID available for migration');
          return;
        }
        
        // Check if guest data exists
        if (GuestDataMigration.hasGuestData()) {
          debug.log('[auth] Guest data found, starting migration');
          await performMigration(userId);
        } else {
          debug.log('[auth] No guest data to migrate');
        }
      }
      
      // Update previous state
      previousIsGuestRef.current = isGuest;
    };

    // 少し遅延させて実行（認証状態が安定してから）
    const timeoutId = setTimeout(handleGuestToUserTransition, 500);
    return () => clearTimeout(timeoutId);
  }, [isGuest, isAuthed, migrationStatus]);

  // Supabase統合版: 認証状態の監視
  useEffect(() => {
    let subscription: any = null;
    
    const initAuth = async () => {
      const { supabase } = await import('../../../lib/supabaseClient');
      if (!supabase) return;
      
      debug.log('[auth] Setting up Supabase auth listener');
      
      const { data } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
        const token = session?.access_token ?? null;
        const userId = session?.user?.id ?? null;
        const wasGuest = isGuest;
        
        debug.log('[auth] Auth state change:', { event, hasToken: !!token, userId, wasGuest });
        
        setIsAuthed(!!token);
        
        // 認証状態が変わった場合、ゲスト状態もリセット
        if (token) {
          setIsGuest(false);
          
          // Check for guest data migration on auth state change
          if (userId && GuestDataMigration.hasGuestData() && migrationStatus === 'idle' && !migrationInProgressRef.current) {
            debug.log('[auth] Auth state change: Guest data found for authenticated user, starting migration');
            await performMigration(userId);
          }
        }
        
        try {
          ;(api as any).setBearerToken?.(token);
        } catch (error) {
          console.error('[auth] Failed to set bearer token:', error);
        }
      });
      
      subscription = data.subscription;
    };

    initAuth();
    
    return () => {
      subscription?.unsubscribe();
    };
  }, [migrationStatus]);

  const handleLogout = async () => {
    try {
      // 本番環境のみSupabaseログアウトを無効化（CORS回避）
      if (process.env.NODE_ENV === 'production') {
        debug.log('[auth] Supabase logout disabled in production to avoid CORS issues');
      } else if (supabase) {
        await supabase.auth.signOut()
      }
    } catch {}
    try {
      ;(api as any).setBearerToken?.(null)
    } catch {}
    setIsAuthed(false)

    // Move user to login after logout
    try {
      router.push('/login')
    } catch {}

    // Best-effort refresh of actor label
    try {
      const me = await api.me();
      const a = (me as any)?.actor;
      if (a?.type === 'user') setActorLabel(`user:${a.id}`)
      else if (a?.type === 'guest') setActorLabel(`guest:${a.id}`)
      else setActorLabel('')
    } catch {}
  };

  return {
    user: null, // TODO: implement user object
    signOut: handleLogout,
    isAuthed,
    actorLabel,
    authError,
    handleLogout,
    isGuest,
    // Migration state
    migrationStatus,
    migrationResult,
    migrationError,
    retryMigration
  };
}