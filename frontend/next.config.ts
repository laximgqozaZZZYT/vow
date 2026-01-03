import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel deployment (server-side rendering enabled)
  // output: 'export', // Remove for Vercel SSR
  trailingSlash: false, // Vercel handles this better
  images: { unoptimized: false }, // Enable Next.js image optimization
  
  // Environment variables validation
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
};

export default nextConfig;
