import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Supabase統合版: 開発・本番環境ともに完全なSupabaseクライアントを使用
export const supabase = (() => {
  if (typeof window === 'undefined') return null as any
  
  if (!url || !anonKey) {
    console.warn('[supabase] Missing environment variables');
    return null as any;
  }
  
  console.log('[supabase] Initializing full Supabase client for integrated architecture');
  
  // 完全なSupabaseクライアント（制限なし）
  const client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        'X-Client-Info': 'supabase-js-web-integrated'
      }
    }
  });
  
  return client;
})()

// 開発環境用の互換性関数
export const createSupabaseClient = () => supabase