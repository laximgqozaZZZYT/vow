import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Important: Next.js may evaluate modules during prerender.
// We must NOT throw on the server. Create the client only in the browser.
export const supabase = (() => {
  if (typeof window === 'undefined') return null as any
  
  // 本番環境では認証のみに完全制限（データベース操作は絶対に禁止）
  if (process.env.NODE_ENV === 'production') {
    console.log('[supabase] Production mode - AUTHENTICATION ONLY client to prevent CORS issues');
    
    if (!url || !anonKey) {
      console.warn('[supabase] Missing environment variables in production');
      return null as any;
    }
    
    // 認証専用クライアント
    const authOnlyClient = createClient(url, anonKey, {
      auth: {
        persistSession: false, // セッション永続化を無効化
        autoRefreshToken: false, // 自動リフレッシュを無効化
        detectSessionInUrl: false, // URL からのセッション検出を無効化
      },
      db: {
        schema: 'public'
      },
      global: {
        headers: {
          'X-Client-Info': 'supabase-js-web-auth-only-production'
        }
      }
    });
    
    // データベース操作メソッドを完全に無効化
    const originalFrom = authOnlyClient.from;
    authOnlyClient.from = (table: string) => {
      const error = new Error(`❌ BLOCKED: Database operation '${table}' attempted in production! Use Next.js API Routes (/api/${table}) instead to prevent CORS issues.`);
      console.error(error.message);
      throw error;
    };
    
    // その他のデータベース操作も無効化
    const originalRpc = authOnlyClient.rpc;
    authOnlyClient.rpc = (fn: string, ...args: any[]) => {
      const error = new Error(`❌ BLOCKED: RPC function '${fn}' attempted in production! Use Next.js API Routes instead.`);
      console.error(error.message);
      throw error;
    };
    
    console.log('[supabase] Production client created - DATABASE OPERATIONS BLOCKED');
    return authOnlyClient;
  }
  
  if (!url || !anonKey) {
    // eslint-disable-next-line no-console
    console.warn('[supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
    console.warn('[supabase] URL:', url ? 'SET' : 'NOT SET')
    console.warn('[supabase] ANON_KEY:', anonKey ? 'SET' : 'NOT SET')
    return null as any
  }
  
  const client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        'X-Client-Info': 'supabase-js-web-development'
      }
    }
  })
  
  // デバッグ用：グローバルに公開
  if (typeof window !== 'undefined') {
    (window as any).supabase = client;
    console.log('[supabase] Development client created and attached to window.supabase');
  }
  
  return client
})()

export default supabase