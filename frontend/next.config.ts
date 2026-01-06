import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Supabase静的ホスティング用設定
  output: 'export',
  trailingSlash: true,
  poweredByHeader: false,
  
  // 静的サイト用画像最適化無効化
  images: {
    unoptimized: true
  },
  
  // 環境変数を明示的に設定
  env: {
    NEXT_PUBLIC_USE_SUPABASE_API: process.env.NEXT_PUBLIC_USE_SUPABASE_API,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_USE_EDGE_FUNCTIONS: process.env.NEXT_PUBLIC_USE_EDGE_FUNCTIONS,
  },
  
  // Security headers (Static Export では無効だが設定保持)
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
        ],
      },
    ];
  },
};

export default nextConfig;