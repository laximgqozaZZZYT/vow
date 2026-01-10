import { MetadataRoute } from 'next';
import { APP_CONFIG } from '../lib/seo.metadata';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = APP_CONFIG.url;
  
  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
    // 他の公開ページがあれば追加
    // プライベートページ（dashboard, login, test-auth）は含めない
  ];
}