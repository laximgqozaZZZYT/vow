import { useState, useEffect, useRef } from 'react';
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
  const previousIsGuestRef = useRef<boolean>(false);
  const migrationInProgressRef = useRef<boolean>(false);

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

  // ゲストから認証ユーザーへの変化を監視してゲストデータをクリア
  useEffect(() => {
    const handleGuestToUserTransition = async () => {
      console.log('[auth] Transition check:', { 
        previousIsGuest: previousIsGuestRef.current, 
        currentIsGuest: isGuest, 
        isAuthed, 
        migrationInProgress: migrationInProgressRef.current 
      });
      
      // 認証ユーザーになった場合、ゲストデータをクリア
      if (!isGuest && isAuthed && !migrationInProgressRef.current) {
        console.log('[auth] Authenticated user detected, clearing guest data');
        
        // 移行中フラグを設定
        migrationInProgressRef.current = true;
        
        try {
          // ゲストデータが存在するかチェック
          const guestKeys = ['guest-goals', 'guest-habits', 'guest-activities', 'guest-diary-cards', 'guest-diary-tags'];
          const hasGuestData = guestKeys.some(key => localStorage.getItem(key));
          
          if (hasGuestData) {
            console.log('[auth] Guest data found, clearing localStorage');
            
            // LocalStorageからゲストデータをクリア
            guestKeys.forEach(key => {
              const data = localStorage.getItem(key);
              if (data) {
                console.log(`[auth] Clearing ${key}:`, JSON.parse(data).length, 'items');
                localStorage.removeItem(key);
              }
            });
            
            console.log('[auth] Guest data cleared successfully');
            setAuthError('Previous guest data has been cleared. Starting fresh as authenticated user.');
            
            // 成功メッセージを3秒後にクリア
            setTimeout(() => setAuthError(null), 3000);
          } else {
            console.log('[auth] No guest data to clear');
          }
        } catch (error) {
          console.error('[auth] Error clearing guest data:', error);
          setAuthError(`Error clearing guest data: ${(error as any)?.message || error}`);
        } finally {
          // 移行中フラグをクリア
          migrationInProgressRef.current = false;
        }
      }
      
      // 現在の状態を記録
      previousIsGuestRef.current = isGuest;
    };

    // 少し遅延させて実行（認証状態が安定してから）
    const timeoutId = setTimeout(handleGuestToUserTransition, 500);
    return () => clearTimeout(timeoutId);
  }, [isGuest, isAuthed]);

  // Supabase統合版: 認証状態の監視
  useEffect(() => {
    const initAuth = async () => {
      const { supabase } = await import('../../../lib/supabaseClient');
      if (!supabase) return;
      
      console.log('[auth] Setting up Supabase auth listener');
      
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
        const token = session?.access_token ?? null;
        const wasGuest = isGuest;
        
        console.log('[auth] Auth state change:', { event, hasToken: !!token, wasGuest });
        
        setIsAuthed(!!token);
        
        // 認証状態が変わった場合、ゲスト状態もリセット
        if (token) {
          setIsGuest(false);
        }
        
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