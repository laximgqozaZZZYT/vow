import type { NextConfig } from "next";

// 環境に応じた設定の切り替え
const isVercelDeployment = process.env.VERCEL === '1';
const isStaticExport = process.env.NEXT_STATIC_EXPORT === 'true';

const nextConfig: NextConfig = {
  // Vercel環境では通常のビルド、静的エクスポート環境では export
  ...(isStaticExport && !isVercelDeployment ? { output: 'export' } : {}),
  
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
  
  // セキュリティヘッダー（Vercel環境で有効）
  async headers() {
    return [
      {
        source: '/(.*)',
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
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ];
  },
};

export default nextConfig;