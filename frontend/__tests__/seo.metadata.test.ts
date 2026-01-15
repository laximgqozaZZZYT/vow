/**
 * Unit tests for SEO metadata generation functions
 * Feature: seo-metadata-enhancement
 * Requirements: 1.1, 5.4
 */

import {
  APP_CONFIG,
  createPageMetadata,
  createWebApplicationSchema,
  createBreadcrumbSchema,
} from '../lib/seo.metadata';

describe('SEO Metadata Generation', () => {
  describe('createPageMetadata', () => {
    /**
     * Test: createPageMetadata returns correct Metadata object
     * Validates: Requirements 1.1
     */
    test('should return a valid Metadata object with all required fields', () => {
      const options = {
        title: 'Test Page',
        description: 'Test description',
        path: '/test',
        locale: 'en' as const,
      };

      const metadata = createPageMetadata(options);

      // Verify basic metadata
      expect(metadata.title).toBe('Test Page');
      expect(metadata.description).toBe('Test description');
      expect(metadata.keywords).toBeDefined();
      expect(Array.isArray(metadata.keywords)).toBe(true);

      // Verify OpenGraph metadata
      expect(metadata.openGraph).toBeDefined();
      expect(metadata.openGraph?.title).toBe('Test Page');
      expect(metadata.openGraph?.description).toBe('Test description');
      expect(metadata.openGraph?.url).toBe(`${APP_CONFIG.url}/test`);
      expect(metadata.openGraph?.locale).toBe('en_US');
      expect(metadata.openGraph?.type).toBe('website');
      expect(metadata.openGraph?.siteName).toBe(APP_CONFIG.name);

      // Verify OpenGraph images
      expect(metadata.openGraph?.images).toBeDefined();
      expect(Array.isArray(metadata.openGraph?.images)).toBe(true);
      const images = metadata.openGraph?.images as any[];
      expect(images.length).toBeGreaterThan(0);
      expect(images[0]).toMatchObject({
        url: APP_CONFIG.ogImage,
        width: 1200,
        height: 630,
        alt: `Test Page | ${APP_CONFIG.name}`,
      });

      // Verify Twitter metadata
      expect(metadata.twitter).toBeDefined();
      expect(metadata.twitter?.card).toBe('summary_large_image');
      expect(metadata.twitter?.site).toBe(APP_CONFIG.twitterHandle);
      expect(metadata.twitter?.creator).toBe(APP_CONFIG.twitterHandle);
      expect(metadata.twitter?.title).toBe('Test Page');
      expect(metadata.twitter?.description).toBe('Test description');
      expect(metadata.twitter?.images).toEqual([APP_CONFIG.ogImage]);

      // Verify alternates
      expect(metadata.alternates).toBeDefined();
      expect(metadata.alternates?.canonical).toBe(`${APP_CONFIG.url}/test`);
      expect(metadata.alternates?.languages).toBeDefined();
      expect(metadata.alternates?.languages?.en).toBe(`${APP_CONFIG.url}/test`);
      expect(metadata.alternates?.languages?.ja).toBe(`${APP_CONFIG.url}/ja/test`);
      expect(metadata.alternates?.languages?.['x-default']).toBe(`${APP_CONFIG.url}/test`);

      // Verify robots (default: indexable)
      expect(metadata.robots).toBeDefined();
      const robots = metadata.robots as any;
      expect(robots.index).toBe(true);
      expect(robots.follow).toBe(true);
      expect(robots.googleBot).toBeDefined();
      expect(robots.googleBot.index).toBe(true);
      expect(robots.googleBot.follow).toBe(true);
    });

    /**
     * Test: English locale includes appropriate keywords
     * Validates: Requirements 5.4
     */
    test('should include English keywords when locale is "en"', () => {
      const options = {
        title: 'English Page',
        description: 'English description',
        locale: 'en' as const,
      };

      const metadata = createPageMetadata(options);

      expect(metadata.keywords).toBeDefined();
      const keywords = metadata.keywords as string[];
      
      // Verify English keywords are included
      expect(keywords).toContain('habit tracking');
      expect(keywords).toContain('goal setting');
      expect(keywords).toContain('productivity');
      expect(keywords).toContain('todo app');
      expect(keywords).toContain('task management');
      expect(keywords).toContain('free browser app');
      expect(keywords).toContain('AI-driven task management');
      
      // Verify keywords array contains all English keywords from APP_CONFIG
      APP_CONFIG.keywords.en.forEach(keyword => {
        expect(keywords).toContain(keyword);
      });
    });

    /**
     * Test: Japanese locale includes appropriate keywords
     * Validates: Requirements 5.4
     */
    test('should include Japanese keywords when locale is "ja"', () => {
      const options = {
        title: '日本語ページ',
        description: '日本語の説明',
        locale: 'ja' as const,
      };

      const metadata = createPageMetadata(options);

      expect(metadata.keywords).toBeDefined();
      const keywords = metadata.keywords as string[];
      
      // Verify Japanese keywords are included
      expect(keywords).toContain('シンプル TODOアプリ');
      expect(keywords).toContain('タスク管理 無料 ブラウザ');
      expect(keywords).toContain('AI駆動 タスク管理');
      expect(keywords).toContain('習慣管理');
      expect(keywords).toContain('目標設定');
      expect(keywords).toContain('生産性向上');
      expect(keywords).toContain('習慣トラッカー');
      expect(keywords).toContain('目標管理アプリ');
      
      // Verify keywords array contains all Japanese keywords from APP_CONFIG
      APP_CONFIG.keywords.ja.forEach(keyword => {
        expect(keywords).toContain(keyword);
      });
    });

    /**
     * Test: Custom keywords are merged with locale keywords
     * Validates: Requirements 5.4
     */
    test('should merge custom keywords with locale keywords', () => {
      const customKeywords = ['custom1', 'custom2', 'custom3'];
      const options = {
        title: 'Test Page',
        description: 'Test description',
        locale: 'en' as const,
        keywords: customKeywords,
      };

      const metadata = createPageMetadata(options);

      expect(metadata.keywords).toBeDefined();
      const keywords = metadata.keywords as string[];
      
      // Verify custom keywords are included
      customKeywords.forEach(keyword => {
        expect(keywords).toContain(keyword);
      });
      
      // Verify locale keywords are still included
      APP_CONFIG.keywords.en.forEach(keyword => {
        expect(keywords).toContain(keyword);
      });
    });

    /**
     * Test: noIndex option is correctly reflected
     * Validates: Requirements 1.1
     */
    test('should set robots to noindex when noIndex is true', () => {
      const options = {
        title: 'Private Page',
        description: 'Private description',
        noIndex: true,
      };

      const metadata = createPageMetadata(options);

      expect(metadata.robots).toBeDefined();
      const robots = metadata.robots as any;
      expect(robots.index).toBe(false);
      expect(robots.follow).toBe(false);
    });

    /**
     * Test: robots allows indexing when noIndex is false
     * Validates: Requirements 1.1
     */
    test('should allow indexing when noIndex is false or undefined', () => {
      const options1 = {
        title: 'Public Page',
        description: 'Public description',
        noIndex: false,
      };

      const metadata1 = createPageMetadata(options1);
      const robots1 = metadata1.robots as any;
      expect(robots1.index).toBe(true);
      expect(robots1.follow).toBe(true);

      // Test with noIndex undefined (default)
      const options2 = {
        title: 'Public Page 2',
        description: 'Public description 2',
      };

      const metadata2 = createPageMetadata(options2);
      const robots2 = metadata2.robots as any;
      expect(robots2.index).toBe(true);
      expect(robots2.follow).toBe(true);
    });

    /**
     * Test: Default values are applied correctly
     * Validates: Requirements 1.1
     */
    test('should apply default values when optional parameters are not provided', () => {
      const options = {
        title: 'Minimal Page',
        description: 'Minimal description',
      };

      const metadata = createPageMetadata(options);

      // Verify defaults
      expect(metadata.openGraph?.url).toBe(APP_CONFIG.url); // path defaults to ''
      expect(metadata.openGraph?.locale).toBe('en_US'); // locale defaults to 'en'
      expect(metadata.openGraph?.images?.[0]).toMatchObject({
        url: APP_CONFIG.ogImage, // ogImage defaults to APP_CONFIG.ogImage
      });
      
      const robots = metadata.robots as any;
      expect(robots.index).toBe(true); // noIndex defaults to false
    });

    /**
     * Test: Custom OG image is used when provided
     * Validates: Requirements 1.1
     */
    test('should use custom OG image when provided', () => {
      const customImage = '/custom-og-image.png';
      const options = {
        title: 'Custom Image Page',
        description: 'Page with custom image',
        ogImage: customImage,
      };

      const metadata = createPageMetadata(options);

      expect(metadata.openGraph?.images?.[0]).toMatchObject({
        url: customImage,
        width: 1200,
        height: 630,
      });
      expect(metadata.twitter?.images).toEqual([customImage]);
    });

    /**
     * Test: Japanese locale sets correct OG locale
     * Validates: Requirements 5.4
     */
    test('should set OpenGraph locale to ja_JP when locale is "ja"', () => {
      const options = {
        title: '日本語ページ',
        description: '日本語の説明',
        locale: 'ja' as const,
      };

      const metadata = createPageMetadata(options);

      expect(metadata.openGraph?.locale).toBe('ja_JP');
    });

    /**
     * Test: Path is correctly appended to URL
     * Validates: Requirements 1.1
     */
    test('should correctly append path to base URL', () => {
      const testCases = [
        { path: '/', expected: `${APP_CONFIG.url}/` },
        { path: '/dashboard', expected: `${APP_CONFIG.url}/dashboard` },
        { path: '/login', expected: `${APP_CONFIG.url}/login` },
        { path: '', expected: APP_CONFIG.url },
      ];

      testCases.forEach(({ path, expected }) => {
        const options = {
          title: 'Test',
          description: 'Test',
          path,
        };

        const metadata = createPageMetadata(options);
        expect(metadata.openGraph?.url).toBe(expected);
        expect(metadata.alternates?.canonical).toBe(expected);
      });
    });
  });

  describe('createWebApplicationSchema', () => {
    /**
     * Test: Schema contains all required fields
     * Validates: Requirements 1.1
     */
    test('should return a valid SoftwareApplication schema with all required fields', () => {
      const schema = createWebApplicationSchema();

      expect(schema['@context']).toBe('https://schema.org');
      expect(schema['@type']).toBe('SoftwareApplication');
      expect(schema.name).toBe(APP_CONFIG.name);
      expect(schema.description).toBe(APP_CONFIG.description);
      expect(schema.url).toBe(APP_CONFIG.url);
      expect(schema.applicationCategory).toBe('ProductivityApplication');
      expect(schema.operatingSystem).toBe('Web Browser');
      
      // Verify offers
      expect(schema.offers).toBeDefined();
      expect(schema.offers['@type']).toBe('Offer');
      expect(schema.offers.price).toBe('0');
      expect(schema.offers.priceCurrency).toBe('USD');
      
      // Verify author
      expect(schema.author).toBeDefined();
      expect(schema.author['@type']).toBe('Organization');
      expect(schema.author.name).toBe('VOW Team');
      expect(schema.author.url).toBe(APP_CONFIG.url);
      
      // Verify aggregateRating
      expect(schema.aggregateRating).toBeDefined();
      expect(schema.aggregateRating['@type']).toBe('AggregateRating');
      expect(schema.aggregateRating.ratingValue).toBe('4.8');
      expect(schema.aggregateRating.ratingCount).toBe('100');
      
      // Verify featureList
      expect(schema.featureList).toBeDefined();
      expect(Array.isArray(schema.featureList)).toBe(true);
      expect(schema.featureList.length).toBeGreaterThan(0);
      expect(schema.featureList).toContain('Habit tracking');
      expect(schema.featureList).toContain('Goal setting');
      expect(schema.featureList).toContain('Progress visualization');
    });

    /**
     * Test: Schema is valid JSON-LD
     * Validates: Requirements 1.1
     */
    test('should be serializable to valid JSON-LD', () => {
      const schema = createWebApplicationSchema();
      
      // Should not throw when stringifying
      expect(() => JSON.stringify(schema)).not.toThrow();
      
      // Should be parseable back
      const jsonString = JSON.stringify(schema);
      const parsed = JSON.parse(jsonString);
      
      expect(parsed).toEqual(schema);
    });
  });

  describe('createBreadcrumbSchema', () => {
    /**
     * Test: Breadcrumb schema is correctly generated
     * Validates: Requirements 1.1
     */
    test('should return a valid BreadcrumbList schema', () => {
      const items = [
        { name: 'Home', url: 'https://example.com' },
        { name: 'Category', url: 'https://example.com/category' },
        { name: 'Page', url: 'https://example.com/category/page' },
      ];

      const schema = createBreadcrumbSchema(items);

      expect(schema['@context']).toBe('https://schema.org');
      expect(schema['@type']).toBe('BreadcrumbList');
      expect(schema.itemListElement).toBeDefined();
      expect(Array.isArray(schema.itemListElement)).toBe(true);
      expect(schema.itemListElement.length).toBe(3);

      // Verify each item
      schema.itemListElement.forEach((item, index) => {
        expect(item['@type']).toBe('ListItem');
        expect(item.position).toBe(index + 1);
        expect(item.name).toBe(items[index].name);
        expect(item.item).toBe(items[index].url);
      });
    });

    /**
     * Test: Empty breadcrumb list
     * Validates: Requirements 1.1
     */
    test('should handle empty breadcrumb list', () => {
      const schema = createBreadcrumbSchema([]);

      expect(schema.itemListElement).toEqual([]);
    });

    /**
     * Test: Single breadcrumb item
     * Validates: Requirements 1.1
     */
    test('should handle single breadcrumb item', () => {
      const items = [{ name: 'Home', url: 'https://example.com' }];
      const schema = createBreadcrumbSchema(items);

      expect(schema.itemListElement.length).toBe(1);
      expect(schema.itemListElement[0]).toMatchObject({
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://example.com',
      });
    });

    /**
     * Test: Breadcrumb schema is valid JSON-LD
     * Validates: Requirements 1.1
     */
    test('should be serializable to valid JSON-LD', () => {
      const items = [
        { name: 'Home', url: 'https://example.com' },
        { name: 'Page', url: 'https://example.com/page' },
      ];
      const schema = createBreadcrumbSchema(items);
      
      // Should not throw when stringifying
      expect(() => JSON.stringify(schema)).not.toThrow();
      
      // Should be parseable back
      const jsonString = JSON.stringify(schema);
      const parsed = JSON.parse(jsonString);
      
      expect(parsed).toEqual(schema);
    });
  });
});
