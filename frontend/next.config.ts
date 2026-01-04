import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standard Vercel deployment configuration
  trailingSlash: false,
  poweredByHeader: false,
  
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