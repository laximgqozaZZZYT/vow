/**
 * Property-Based Tests for SEO metadata generation
 * Feature: seo-metadata-enhancement, Property 1: 全ページにユニークなメタデータが存在する
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4
 */

import * as fc from 'fast-check';
import { createPageMetadata } from '../lib/seo.metadata';
import type { Metadata } from 'next';

describe('SEO Metadata Property-Based Tests', () => {
  /**
   * Property 1: 全ページにユニークなメタデータが存在する
   * For any public page, that page has unique title and description meta tags that do not duplicate other pages
   * 
   * Validates: Requirements 1.1, 1.2, 1.3, 1.4
   * Feature: seo-metadata-enhancement, Property 1: 全ページにユニークなメタデータが存在する
   */
  describe('Property 1: Metadata Uniqueness', () => {
    test('should generate unique title and description for different pages', () => {
      fc.assert(
        fc.property(
          // Generate an array of page configurations
          fc.array(
            fc.record({
              // Generate non-whitespace strings
              title: fc.string({ minLength: 5, maxLength: 100 }).filter(s => s.trim().length >= 5),
              description: fc.string({ minLength: 10, maxLength: 200 }).filter(s => s.trim().length >= 10),
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

            // Check that all titles are unique
            const titles = metadataList.map(m => m.metadata.title);
            const uniqueTitles = new Set(titles);
            
            // Check that all descriptions are unique
            const descriptions = metadataList.map(m => m.metadata.description);
            const uniqueDescriptions = new Set(descriptions);

            // Property: If we have different page configurations, we should have unique metadata
            // We allow duplicates only if the input configurations are identical
            const uniqueConfigs = new Set(
              pageConfigs.map(c => JSON.stringify({ title: c.title.trim(), description: c.description.trim() }))
            );

            // The number of unique titles should match the number of unique input title configs
            expect(uniqueTitles.size).toBe(uniqueConfigs.size);
            
            // The number of unique descriptions should match the number of unique input description configs
            expect(uniqueDescriptions.size).toBe(uniqueConfigs.size);

            // Each metadata object should have both title and description defined
            metadataList.forEach(({ metadata }) => {
              expect(metadata.title).toBeDefined();
              expect(metadata.title).not.toBe('');
              expect(metadata.description).toBeDefined();
              expect(metadata.description).not.toBe('');
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should generate unique OpenGraph metadata for different pages', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              title: fc.string({ minLength: 5, maxLength: 100 }).filter(s => s.trim().length >= 5),
              description: fc.string({ minLength: 10, maxLength: 200 }).filter(s => s.trim().length >= 10),
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

            // Check that all OG titles are unique
            const ogTitles = metadataList.map(m => m.metadata.openGraph?.title);
            const uniqueOgTitles = new Set(ogTitles);
            
            // Check that all OG descriptions are unique
            const ogDescriptions = metadataList.map(m => m.metadata.openGraph?.description);
            const uniqueOgDescriptions = new Set(ogDescriptions);

            // Check that all OG URLs are unique (based on path)
            const ogUrls = metadataList.map(m => m.metadata.openGraph?.url);
            const uniqueOgUrls = new Set(ogUrls);

            // Property: If we have different page configurations, we should have unique OG metadata
            const uniqueConfigs = new Set(
              pageConfigs.map(c => JSON.stringify({ title: c.title.trim(), description: c.description.trim() }))
            );
            const uniquePaths = new Set(pageConfigs.map(c => c.path));

            // The number of unique OG titles should match the number of unique input title configs
            expect(uniqueOgTitles.size).toBe(uniqueConfigs.size);
            
            // The number of unique OG descriptions should match the number of unique input description configs
            expect(uniqueOgDescriptions.size).toBe(uniqueConfigs.size);

            // The number of unique OG URLs should match the number of unique paths
            expect(uniqueOgUrls.size).toBe(uniquePaths.size);

            // Each metadata object should have complete OpenGraph data
            metadataList.forEach(({ metadata }) => {
              expect(metadata.openGraph).toBeDefined();
              expect(metadata.openGraph?.title).toBeDefined();
              expect(metadata.openGraph?.description).toBeDefined();
              expect(metadata.openGraph?.url).toBeDefined();
              expect(metadata.openGraph?.type).toBe('website');
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should generate unique Twitter Card metadata for different pages', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              title: fc.string({ minLength: 5, maxLength: 100 }).filter(s => s.trim().length >= 5),
              description: fc.string({ minLength: 10, maxLength: 200 }).filter(s => s.trim().length >= 10),
              path: fc.webPath(),
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

            // Check that all Twitter titles are unique
            const twitterTitles = metadataList.map(m => m.metadata.twitter?.title);
            const uniqueTwitterTitles = new Set(twitterTitles);
            
            // Check that all Twitter descriptions are unique
            const twitterDescriptions = metadataList.map(m => m.metadata.twitter?.description);
            const uniqueTwitterDescriptions = new Set(twitterDescriptions);

            // Property: If we have different page configurations, we should have unique Twitter metadata
            const uniqueConfigs = new Set(
              pageConfigs.map(c => JSON.stringify({ title: c.title.trim(), description: c.description.trim() }))
            );

            // The number of unique Twitter titles should match the number of unique input title configs
            expect(uniqueTwitterTitles.size).toBe(uniqueConfigs.size);
            
            // The number of unique Twitter descriptions should match the number of unique input description configs
            expect(uniqueTwitterDescriptions.size).toBe(uniqueConfigs.size);

            // Each metadata object should have complete Twitter Card data
            metadataList.forEach(({ metadata }) => {
              expect(metadata.twitter).toBeDefined();
              expect(metadata.twitter?.card).toBe('summary_large_image');
              expect(metadata.twitter?.title).toBeDefined();
              expect(metadata.twitter?.description).toBeDefined();
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should generate unique canonical URLs for different paths', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              title: fc.string({ minLength: 5, maxLength: 100 }).filter(s => s.trim().length >= 5),
              description: fc.string({ minLength: 10, maxLength: 200 }).filter(s => s.trim().length >= 10),
              path: fc.webPath(),
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

            // Check that all canonical URLs are unique (based on path)
            const canonicalUrls = metadataList.map(m => m.metadata.alternates?.canonical);
            const uniqueCanonicalUrls = new Set(canonicalUrls);

            // Property: The number of unique canonical URLs should match the number of unique paths
            const uniquePaths = new Set(pageConfigs.map(c => c.path));
            expect(uniqueCanonicalUrls.size).toBe(uniquePaths.size);

            // Each metadata object should have a canonical URL
            metadataList.forEach(({ metadata, config }) => {
              expect(metadata.alternates?.canonical).toBeDefined();
              expect(metadata.alternates?.canonical).toContain(config.path);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should maintain metadata uniqueness across different locales', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              title: fc.string({ minLength: 5, maxLength: 100 }).filter(s => s.trim().length >= 5),
              description: fc.string({ minLength: 10, maxLength: 200 }).filter(s => s.trim().length >= 10),
              path: fc.webPath(),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          (baseConfigs) => {
            // Generate metadata for each page in both locales
            const metadataList: Array<{ config: any; metadata: Metadata }> = [];
            
            baseConfigs.forEach(baseConfig => {
              ['en' as const, 'ja' as const].forEach(locale => {
                const config = { ...baseConfig, locale };
                metadataList.push({
                  config,
                  metadata: createPageMetadata(config)
                });
              });
            });

            // Check that all titles are unique (considering locale)
            const titles = metadataList.map(m => m.metadata.title);
            const uniqueTitles = new Set(titles);
            
            // Check that all descriptions are unique (considering locale)
            const descriptions = metadataList.map(m => m.metadata.description);
            const uniqueDescriptions = new Set(descriptions);

            // Property: Each unique (title, description) pair should produce unique metadata
            const uniqueConfigs = new Set(
              metadataList.map(m => JSON.stringify({ 
                title: m.config.title.trim(), 
                description: m.config.description.trim() 
              }))
            );

            expect(uniqueTitles.size).toBe(uniqueConfigs.size);
            expect(uniqueDescriptions.size).toBe(uniqueConfigs.size);

            // Each metadata should have appropriate locale-specific keywords
            metadataList.forEach(({ metadata, config }) => {
              expect(metadata.keywords).toBeDefined();
              expect(Array.isArray(metadata.keywords)).toBe(true);
              expect((metadata.keywords as string[]).length).toBeGreaterThan(0);
              
              // Verify OpenGraph locale is set correctly
              if (config.locale === 'ja') {
                expect(metadata.openGraph?.locale).toBe('ja_JP');
              } else {
                expect(metadata.openGraph?.locale).toBe('en_US');
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
