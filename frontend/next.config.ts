import type { NextConfig } from "next";

// 環境に応じた設定の切り替え
const isVercelDeployment = process.env.VERCEL === '1';
const isStaticExport = process.env.NEXT_STATIC_EXPORT === 'true';
const isDockerBuild = process.env.DOCKER_BUILD === 'true';
const isDevelopment = process.env.NODE_ENV === 'development';

// Content-Security-Policy ヘッダー値の構築
// NOTE: Next.js はハイドレーション用のインラインスクリプト (<script> タグ) を生成するため、
// script-src に 'unsafe-inline' が必要です。本来は nonce ベースの CSP が望ましいですが、
// Next.js の App Router では middleware で nonce を注入する追加実装が必要になります。
// 将来的に nonce 方式への移行を検討してください。
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];

// 通常ページ用 CSP（iframe埋め込み禁止）
const cspHeader = [...cspDirectives, "frame-ancestors 'none'"].join('; ');

// /embed/* ページ用 CSP（iframe埋め込みを許可）
const cspHeaderEmbed = [...cspDirectives, "frame-ancestors *"].join('; ');

const nextConfig: NextConfig = {
  // 出力モードの設定:
  // - Docker/Amplify: standalone (最適化されたサーバー出力)
  // - 静的エクスポート: export
  // - Vercel: デフォルト (Vercelが最適化)
  ...(isDockerBuild ? { output: 'standalone' } : 
      isStaticExport && !isVercelDeployment ? { output: 'export' } : {}),
  
  // 静的エクスポート時のみ trailingSlash を有効化
  trailingSlash: isStaticExport && !isVercelDeployment,
  
  poweredByHeader: false,
  
  // 画像最適化: Vercel環境では有効、静的エクスポート時は無効
  images: {
    unoptimized: isStaticExport && !isVercelDeployment
  },
  
  // 環境変数を明示的に設定
  env: {
    NEXT_PUBLIC_USE_SUPABASE_API: process.env.NEXT_PUBLIC_USE_SUPABASE_API,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_USE_EDGE_FUNCTIONS: process.env.NEXT_PUBLIC_USE_EDGE_FUNCTIONS,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  },
  
  // .md ファイルを raw string としてインポートするための設定
  // Turbopack (Next.js 16 default, dev)
  turbopack: {
    rules: {
      '*.md': {
        loaders: ['raw-loader'],
        as: '*.js',
      },
    },
  },
  // Webpack (production build fallback)
  webpack(config) {
    config.module.rules.push({
      test: /\.md$/,
      type: 'asset/source',
    });
    return config;
  },

  // セキュリティヘッダー（Vercel環境で有効）
  async headers() {
    return [
      // Embed pages - allow iframe embedding from any origin (Requirement 7.3)
      {
        source: '/embed/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // Note: X-Frame-Options is intentionally omitted to allow embedding
          // CSP frame-ancestors * で埋め込みを許可しつつ他のディレクティブで保護
          {
            key: 'Content-Security-Policy',
            value: cspHeaderEmbed,
          },
        ],
      },
      // All other pages - deny iframe embedding
      {
        source: '/((?!embed).*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Content-Security-Policy',
            value: cspHeader,
          },
          // HSTS は本番環境のみで有効化（開発環境ではHTTPを使用するため除外）
          ...(isDevelopment ? [] : [{
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          }]),
        ],
      },
    ];
  },
};

export default nextConfig;