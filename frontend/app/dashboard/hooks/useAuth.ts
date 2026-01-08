import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api';
import { supabase } from '../../../lib/supabaseClient';
import type { AuthContext } from '../types';

export function useAuth(): AuthContext {
  const router = useRouter();
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [actorLabel, setActorLabel] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(false);

  // Initial authentication check
  useEffect(() => {
    (async () => {
      try {
        // Supabase統合版: 認証状態の確認
        let hasSupabaseSession = false;
        try {
          const { supabase } = await import('../../../lib/supabaseClient');
          if (supabase) {
            const { data: { session } } = await supabase.auth.getSession();
            const accessToken = session?.access_token ?? null;
            hasSupabaseSession = !!accessToken;
            
            console.log('[auth] Supabase session check:', { hasSession: hasSupabaseSession, userId: session?.user?.id });
            
            // APIライブラリにトークンを設定（互換性のため）
            ;(api as any).setBearerToken?.(accessToken);
          }
        } catch (error) {
          console.error('[auth] Session check failed:', error);
        }

        // バックエンドの認証状態も確認
        try {
          console.log('[auth] Calling api.me()...');
          const me = await api.me();
          console.log('[dashboard] me() result:', me);
          const a = (me as any)?.actor;
          console.log('[auth] Actor extracted:', a);
          
          if (a?.type === 'user') {
            console.log('[auth] User actor detected');
            setActorLabel(`user:${a.id}`);
            setIsAuthed(true);
            setIsGuest(false);
          } else if (a?.type === 'guest') {
            console.log('[auth] Guest actor detected');
            setActorLabel(`guest:${a.id}`);
            // ゲストユーザーも認証済みとして扱い、ローカル機能を有効化
            console.log('[auth] Guest user detected, enabling local features');
            console.log('[auth] Setting isAuthed to true for guest user');
            setIsAuthed(true);
            setIsGuest(true);
          } else {
            console.log('[auth] No valid actor found');
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
            console.log('[auth] Fallback: Using Supabase session for auth');
            setIsAuthed(true);
          } else {
            console.log('[auth] No fallback available, setting isAuthed to false');
            setIsAuthed(false);
          }
        }
      } catch (e) {
        console.error('Failed to initialize auth', e);
        setIsAuthed(false);
      }
    })();
  }, []);

  // Supabase統合版: 認証状態の監視
  useEffect(() => {
    const initAuth = async () => {
      const { supabase } = await import('../../../lib/supabaseClient');
      if (!supabase) return;
      
      console.log('[auth] Setting up Supabase auth listener');
      
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: any, session: any) => {
        const token = session?.access_token ?? null;
        setIsAuthed(!!token);
        
        try {
          ;(api as any).setBearerToken?.(token);
        } catch (error) {
          console.error('[auth] Failed to set bearer token:', error);
        }
      });

      return () => {
        subscription?.unsubscribe();
      };
    };

    initAuth();
  }, []);

  const handleLogout = async () => {
    try {
      // 本番環境のみSupabaseログアウトを無効化（CORS回避）
      if (process.env.NODE_ENV === 'production') {
        console.log('[auth] Supabase logout disabled in production to avoid CORS issues');
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
    isGuest
  };
}