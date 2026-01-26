import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// 開発環境で許可されるメールアドレス
const ADMIN_EMAIL = 'k6285620@gmail.com';

// 認証不要のパス（静的ファイル、API、ログインページなど）
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/api',
  '/_next',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/sw.js',
  '/file.svg',
  '/globe.svg',
  '/next.svg',
  '/vercel.svg',
  '/window.svg',
  '/oauth',
  '/embed',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 環境変数チェック - 開発環境でない場合はスキップ
  const isDev = process.env.NEXT_PUBLIC_ENV === 'development';
  if (!isDev) {
    return NextResponse.next();
  }
  
  // 公開パスはスキップ
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }
  
  // Supabase環境変数チェック
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    // Supabase未設定の場合はアクセス拒否
    return new NextResponse('Service Unavailable', { status: 503 });
  }
  
  // レスポンスを作成（クッキー操作用）
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });
  
  // Supabaseクライアントを作成（SSR用）
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });
  
  // セッションを取得
  const { data: { user }, error } = await supabase.auth.getUser();
  
  // 未ログインまたはエラーの場合
  if (error || !user) {
    // ログインページにリダイレクト
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    loginUrl.searchParams.set('dev_restricted', 'true');
    return NextResponse.redirect(loginUrl);
  }
  
  // メールアドレスチェック
  const userEmail = user.email?.toLowerCase();
  if (userEmail !== ADMIN_EMAIL.toLowerCase()) {
    // 管理者以外はアクセス拒否
    return new NextResponse(
      `<html>
        <head>
          <title>Access Denied</title>
          <style>
            body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f4f4f5; }
            .container { text-align: center; padding: 2rem; background: white; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); max-width: 400px; }
            h1 { color: #ef4444; margin-bottom: 1rem; }
            p { color: #71717a; margin-bottom: 1.5rem; }
            a { color: #3b82f6; text-decoration: none; }
            a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🚫 Access Denied</h1>
            <p>この開発環境へのアクセスは管理者のみに制限されています。</p>
            <p>ログイン中: ${userEmail}</p>
            <p><a href="/login">別のアカウントでログイン</a></p>
          </div>
        </body>
      </html>`,
      {
        status: 403,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      }
    );
  }
  
  // 管理者の場合はアクセス許可
  return response;
}

// Middlewareを適用するパスを設定
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     * - login page (for OAuth flow)
     * - api routes
     */
    '/((?!_next/static|_next/image|favicon.ico|login|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
