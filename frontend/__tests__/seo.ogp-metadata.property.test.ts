/**
 * Property-Based Tests for OGP Metadata Completeness
 * Feature: seo-metadata-enhancement, Property 2: OGPメタデータの完全性
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

import * as fc from 'fast-check';
import { createPageMetadata, APP_CONFIG } from '../lib/seo.metadata';

describe('SEO OGP Metadata Property-Based Tests', () => {
  /**
   * Property 2: OGPメタデータの完全性
   * For any public page, OGP metadata (og:title, og:description, og:image, og:url) all exist and have valid values
   * 
   * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
   * Feature: seo-metadata-enhancement, Property 2: OGPメタデータの完全性
   */
  describe('Property 2: OGP Metadata Completeness', () => {
    test('should generate complete OGP metadata for any page configuration', () => {
      fc.assert(
        fc.property(
          fc.record({
            title: fc.string({ minLength: 5, maxLength: 100 }),
            description: fc.string({ minLength: 10, maxLength: 200 }),
            path: fc.oneof(
              fc.constant('/'),
              fc.constant('/dashboard'),
              fc.constant('/login'),
              fc.webPath()
            ),
            locale: fc.constantFrom('en' as const, 'ja' as const),
            noIndex: fc.boolean(),
            keywords: fc.array(fc.string({ minLength: 3, maxLength: 30 }), { maxLength: 5 }),
          }),
          (config) => {
            const metadata = createPageMetadata(config);

            // Property: All required OGP fields must exist
            expect(metadata.openGraph).toBeDefined();
            expect(metadata.openGraph?.title).toBeDefined();
            expect(metadata.openGraph?.description).toBeDefined();
            expect(metadata.openGraph?.url).toBeDefined();
            expect(metadata.openGraph?.images).toBeDefined();

            // Property: OGP fields must have valid, non-empty values
            expect(metadata.openGraph?.title).not.toBe('');
            expect(metadata.openGraph?.description).not.toBe('');
            expect(metadata.openGraph?.url).not.toBe('');
            
            // Property: OGP images must be an array with at least one image
            expect(Array.isArray(metadata.openGraph?.images)).toBe(true);
            const images = metadata.openGraph?.images as any[];
            expect(images.length).toBeGreaterThan(0);

            // Property: OGP title and description should match the page metadata
            expect(metadata.openGraph?.title).toBe(config.title);
            expect(metadata.openGraph?.description).toBe(config.description);

            // Property: OGP URL should contain the path
            expect(metadata.openGraph?.url).toContain(config.path);

            // Property: OGP type should always be 'website'
            expect(metadata.openGraph?.type).toBe('website');

            // Property: OGP siteName should always be set
            expect(metadata.openGraph?.siteName).toBe(APP_CONFIG.name);

            // Property: OGP locale should match the requested locale
            const expectedLocale = config.locale === 'ja' ? 'ja_JP' : 'en_US';
            expect(metadata.openGraph?.locale).toBe(expectedLocale);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should generate valid OGP image metadata with correct dimensions', () => {
      fc.assert(
        fc.property(
          fc.record({
            title: fc.string({ minLength: 5, maxLength: 100 }),
            description: fc.string({ minLength: 10, maxLength: 200 }),
            path: fc.webPath(),
            locale: fc.constantFrom('en' as const, 'ja' as const),
            ogImage: fc.option(fc.webUrl(), { nil: undefined }),
          }),
          (config) => {
            const metadata = createPageMetadata(config);

            // Property: OGP images must exist and be properly formatted
            expect(metadata.openGraph?.images).toBeDefined();
            expect(Array.isArray(metadata.openGraph?.images)).toBe(true);
            
            const images = metadata.openGraph?.images as any[];
            expect(images.length).toBeGreaterThan(0);

            const firstImage = images[0];

            // Property: Image must have required fields
            expect(firstImage.url).toBeDefined();
            expect(firstImage.width).toBeDefined();
            expect(firstImage.height).toBeDefined();
            expect(firstImage.alt).toBeDefined();

            // Property: Image dimensions must be 1200x630 (OGP standard)
            // Validates: Requirement 2.4
            expect(firstImage.width).toBe(1200);
            expect(firstImage.height).toBe(630);

            // Property: Image URL should be valid (not empty)
            expect(firstImage.url).not.toBe('');

            // Property: Image alt text should include the title
            expect(firstImage.alt).toContain(config.title);
            expect(firstImage.alt).toContain(APP_CONFIG.name);

            // Property: If custom ogImage provided, it should be used
            if (config.ogImage) {
              expect(firstImage.url).toBe(config.ogImage);
            } else {
              expect(firstImage.url).toBe(APP_CONFIG.ogImage);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should generate complete Twitter Card metadata for any page', () => {
      fc.assert(
        fc.property(
          fc.record({
            title: fc.string({ minLength: 5, maxLength: 100 }),
            description: fc.string({ minLength: 10, maxLength: 200 }),
            path: fc.webPath(),
            locale: fc.constantFrom('en' as const, 'ja' as const),
          }),
          (config) => {
            const metadata = createPageMetadata(config);

            // Property: All required Twitter Card fields must exist
            // Validates: Requirements 2.1, 2.2, 2.3, 2.5
            expect(metadata.twitter).toBeDefined();
            expect(metadata.twitter?.card).toBeDefined();
            expect(metadata.twitter?.site).toBeDefined();
            expect(metadata.twitter?.creator).toBeDefined();
            expect(metadata.twitter?.title).toBeDefined();
            expect(metadata.twitter?.description).toBeDefined();
            expect(metadata.twitter?.images).toBeDefined();

            // Property: Twitter Card type must be 'summary_large_image'
            // Validates: Requirement 2.5
            expect(metadata.twitter?.card).toBe('summary_large_image');

            // Property: Twitter Card fields must have valid, non-empty values
            expect(metadata.twitter?.site).not.toBe('');
            expect(metadata.twitter?.creator).not.toBe('');
            expect(metadata.twitter?.title).not.toBe('');
            expect(metadata.twitter?.description).not.toBe('');

            // Property: Twitter Card title and description should match page metadata
            expect(metadata.twitter?.title).toBe(config.title);
            expect(metadata.twitter?.description).toBe(config.description);

            // Property: Twitter Card site and creator should be set to app handle
            expect(metadata.twitter?.site).toBe(APP_CONFIG.twitterHandle);
            expect(metadata.twitter?.creator).toBe(APP_CONFIG.twitterHandle);

            // Property: Twitter Card images must be an array with at least one image
            expect(Array.isArray(metadata.twitter?.images)).toBe(true);
            expect((metadata.twitter?.images as string[]).length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should generate page-specific OGP metadata for different pages', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              title: fc.string({ minLength: 5, maxLength: 100 }),
              description: fc.string({ minLength: 10, maxLength: 200 }),
              path: fc.oneof(
                fc.constant('/'),
                fc.constant('/dashboard'),
                fc.constant('/login'),
                fc.webPath()
              ),
              locale: fc.constantFrom('en' as const, 'ja' as const),
            }),
            { minLength: 2, maxLength: 10 }
          ),
          (pageConfigs) => {
            // Generate metadata for each page
            const metadataList = pageConfigs.map(config => ({
              config,
              metadata: createPageMetadata(config)
            }));

            // Property: Each page should have complete OGP metadata
            // Validates: Requirement 2.6
            metadataList.forEach(({ metadata, config }) => {
              // All required OGP fields must exist
              expect(metadata.openGraph).toBeDefined();
              expect(metadata.openGraph?.title).toBeDefined();
              expect(metadata.openGraph?.description).toBeDefined();
              expect(metadata.openGraph?.url).toBeDefined();
              expect(metadata.openGraph?.images).toBeDefined();

              // OGP metadata should be page-specific
              expect(metadata.openGraph?.title).toBe(config.title);
              expect(metadata.openGraph?.description).toBe(config.description);
              expect(metadata.openGraph?.url).toContain(config.path);
            });

            // Property: Different pages should have different OGP URLs
            const ogUrls = metadataList.map(m => m.metadata.openGraph?.url);
            const uniquePaths = new Set(pageConfigs.map(c => c.path));
            const uniqueOgUrls = new Set(ogUrls);
            
            expect(uniqueOgUrls.size).toBe(uniquePaths.size);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should maintain OGP metadata completeness across different locales', () => {
      fc.assert(
        fc.property(
          fc.record({
            title: fc.string({ minLength: 5, maxLength: 100 }),
            description: fc.string({ minLength: 10, maxLength: 200 }),
            path: fc.webPath(),
          }),
          (baseConfig) => {
            // Generate metadata for both locales
            const enMetadata = createPageMetadata({ ...baseConfig, locale: 'en' });
            const jaMetadata = createPageMetadata({ ...baseConfig, locale: 'ja' });

            // Property: Both locales should have complete OGP metadata
            // Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
            [enMetadata, jaMetadata].forEach((metadata, index) => {
              const locale = index === 0 ? 'en' : 'ja';
              
              // All required OGP fields must exist
              expect(metadata.openGraph).toBeDefined();
              expect(metadata.openGraph?.title).toBeDefined();
              expect(metadata.openGraph?.description).toBeDefined();
              expect(metadata.openGraph?.url).toBeDefined();
              expect(metadata.openGraph?.images).toBeDefined();
              expect(metadata.openGraph?.locale).toBeDefined();

              // OGP locale should match the requested locale
              const expectedLocale = locale === 'ja' ? 'ja_JP' : 'en_US';
              expect(metadata.openGraph?.locale).toBe(expectedLocale);

              // Twitter Card metadata should also be complete
              expect(metadata.twitter).toBeDefined();
              expect(metadata.twitter?.card).toBe('summary_large_image');
              expect(metadata.twitter?.title).toBeDefined();
              expect(metadata.twitter?.description).toBeDefined();
              expect(metadata.twitter?.images).toBeDefined();
            });

            // Property: OGP metadata structure should be consistent across locales
            expect(enMetadata.openGraph?.type).toBe(jaMetadata.openGraph?.type);
            expect(enMetadata.openGraph?.siteName).toBe(jaMetadata.openGraph?.siteName);
            expect(enMetadata.twitter?.card).toBe(jaMetadata.twitter?.card);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should generate valid OGP URLs for all page paths', () => {
      fc.assert(
        fc.property(
          fc.record({
            title: fc.string({ minLength: 5, maxLength: 100 }),
            description: fc.string({ minLength: 10, maxLength: 200 }),
            path: fc.oneof(
              fc.constant(''),
              fc.constant('/'),
              fc.constant('/dashboard'),
              fc.constant('/login'),
              fc.webPath()
            ),
            locale: fc.constantFrom('en' as const, 'ja' as const),
          }),
          (config) => {
            const metadata = createPageMetadata(config);

            // Property: OGP URL must be a valid, complete URL
            expect(metadata.openGraph?.url).toBeDefined();
            const ogUrl = metadata.openGraph?.url as string;
            
            // URL should start with the base URL
            expect(ogUrl).toContain(APP_CONFIG.url);
            
            // URL should be a valid URL format
            expect(() => new URL(ogUrl)).not.toThrow();
            
            // URL should contain the path (if not empty)
            if (config.path && config.path !== '') {
              expect(ogUrl).toContain(config.path);
            }

            // Property: Canonical URL should match OGP URL
            expect(metadata.alternates?.canonical).toBe(ogUrl);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should handle custom OGP images while maintaining completeness', () => {
      fc.assert(
        fc.property(
          fc.record({
            title: fc.string({ minLength: 5, maxLength: 100 }),
            description: fc.string({ minLength: 10, maxLength: 200 }),
            path: fc.webPath(),
            locale: fc.constantFrom('en' as const, 'ja' as const),
            ogImage: fc.oneof(
              fc.constant('/custom-image.png'),
              fc.constant('/og-special.jpg'),
              fc.webUrl()
            ),
          }),
          (config) => {
            const metadata = createPageMetadata(config);

            // Property: Custom OGP image should be used
            expect(metadata.openGraph?.images).toBeDefined();
            const images = metadata.openGraph?.images as any[];
            expect(images[0].url).toBe(config.ogImage);

            // Property: Image metadata should still be complete
            expect(images[0].width).toBe(1200);
            expect(images[0].height).toBe(630);
            expect(images[0].alt).toBeDefined();
            expect(images[0].alt).toContain(config.title);

            // Property: Twitter Card should also use the custom image
            expect(metadata.twitter?.images).toEqual([config.ogImage]);

            // Property: All other OGP fields should still be present
            expect(metadata.openGraph?.title).toBeDefined();
            expect(metadata.openGraph?.description).toBeDefined();
            expect(metadata.openGraph?.url).toBeDefined();
            expect(metadata.openGraph?.type).toBe('website');
            expect(metadata.openGraph?.siteName).toBe(APP_CONFIG.name);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should maintain OGP completeness regardless of noIndex setting', () => {
      fc.assert(
        fc.property(
          fc.record({
            title: fc.string({ minLength: 5, maxLength: 100 }),
            description: fc.string({ minLength: 10, maxLength: 200 }),
            path: fc.webPath(),
            locale: fc.constantFrom('en' as const, 'ja' as const),
            noIndex: fc.boolean(),
          }),
          (config) => {
            const metadata = createPageMetadata(config);

            // Property: OGP metadata should be complete regardless of noIndex setting
            // Even private pages should have proper OGP for when URLs are shared
            expect(metadata.openGraph).toBeDefined();
            expect(metadata.openGraph?.title).toBeDefined();
            expect(metadata.openGraph?.description).toBeDefined();
            expect(metadata.openGraph?.url).toBeDefined();
            expect(metadata.openGraph?.images).toBeDefined();
            expect(metadata.openGraph?.type).toBe('website');

            // Property: Twitter Card should also be complete
            expect(metadata.twitter).toBeDefined();
            expect(metadata.twitter?.card).toBe('summary_large_image');
            expect(metadata.twitter?.title).toBeDefined();
            expect(metadata.twitter?.description).toBeDefined();
            expect(metadata.twitter?.images).toBeDefined();

            // Property: robots setting should not affect OGP completeness
            const hasCompleteOGP = 
              metadata.openGraph?.title &&
              metadata.openGraph?.description &&
              metadata.openGraph?.url &&
              metadata.openGraph?.images &&
              metadata.twitter?.card &&
              metadata.twitter?.title &&
              metadata.twitter?.description &&
              metadata.twitter?.images;
            
            expect(hasCompleteOGP).toBeTruthy();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
