import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standard Vercel deployment configuration
  trailingSlash: false,
  poweredByHeader: false,
  
  // 環境変数を明示的に設定
  env: {
    NEXT_PUBLIC_USE_SUPABASE_API: process.env.NEXT_PUBLIC_USE_SUPABASE_API,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  
  // Security headers (moved from vercel.json)
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