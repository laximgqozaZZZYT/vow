import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://vow-app.vercel.app';
  
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard/',
          '/test-auth/',
          '/_next/',
          '/*.json',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
