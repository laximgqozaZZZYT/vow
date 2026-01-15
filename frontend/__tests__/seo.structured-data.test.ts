/**
 * Unit tests for structured data generation (JSON-LD)
 * Feature: seo-metadata-enhancement
 * Task: 2.1 構造化データ生成のユニットテストを作成
 * Requirements: 3.1, 3.2, 3.3
 */

import {
  APP_CONFIG,
  createWebApplicationSchema,
  createBreadcrumbSchema,
} from '../lib/seo.metadata';

describe('Structured Data Generation (JSON-LD)', () => {
  describe('createWebApplicationSchema - Valid JSON-LD Generation', () => {
    /**
     * Test: Schema generates valid JSON-LD that can be stringified
     * Validates: Requirements 3.1
     */
    test('should generate valid JSON-LD without errors', () => {
      const schema = createWebApplicationSchema();
      
      // Should not throw when stringifying
      expect(() => JSON.stringify(schema)).not.toThrow();
      
      // Should produce valid JSON string
      const jsonString = JSON.stringify(schema);
      expect(jsonString).toBeTruthy();
      expect(jsonString.length).toBeGreaterThan(0);
      
      // Should be parseable back to object
      const parsed = JSON.parse(jsonString);
      expect(parsed).toEqual(schema);
    });

    /**
     * Test: JSON-LD can be embedded in HTML script tag
     * Validates: Requirements 3.1
     */
    test('should be safely embeddable in HTML script tag', () => {
      const schema = createWebApplicationSchema();
      const jsonString = JSON.stringify(schema);
      
      // Should not contain script-breaking characters
      expect(jsonString).not.toContain('</script>');
      expect(jsonString).not.toContain('<script>');
      
      // Should be valid when embedded
      const htmlEmbed = `<script type="application/ld+json">${jsonString}</script>`;
      expect(htmlEmbed).toContain('"@context"');
      expect(htmlEmbed).toContain('"@type"');
    });

    /**
     * Test: Schema produces consistent output
     * Validates: Requirements 3.1
     */
    test('should produce consistent output across multiple calls', () => {
      const schema1 = createWebApplicationSchema();
      const schema2 = createWebApplicationSchema();
      
      expect(schema1).toEqual(schema2);
      expect(JSON.stringify(schema1)).toBe(JSON.stringify(schema2));
    });
  });

  describe('createWebApplicationSchema - Required Fields', () => {
    /**
     * Test: All mandatory schema.org fields are present
     * Validates: Requirements 3.2
     */
    test('should include all mandatory SoftwareApplication fields', () => {
      const schema = createWebApplicationSchema();
      
      // Core mandatory fields for SoftwareApplication
      expect(schema['@context']).toBe('https://schema.org');
      expect(schema['@type']).toBe('SoftwareApplication');
      expect(schema.name).toBeDefined();
      expect(schema.name).toBe(APP_CONFIG.name);
      
      // Additional required fields
      expect(schema.description).toBeDefined();
      expect(schema.description).toBe(APP_CONFIG.description);
      expect(schema.url).toBeDefined();
      expect(schema.url).toBe(APP_CONFIG.url);
      expect(schema.applicationCategory).toBeDefined();
      expect(schema.applicationCategory).toBe('ProductivityApplication');
      expect(schema.operatingSystem).toBeDefined();
      expect(schema.operatingSystem).toBe('Web Browser');
    });

    /**
     * Test: Offers field is properly structured
     * Validates: Requirements 3.2, 3.4
     */
    test('should include properly structured Offer object', () => {
      const schema = createWebApplicationSchema();
      
      expect(schema.offers).toBeDefined();
      expect(schema.offers['@type']).toBe('Offer');
      expect(schema.offers.price).toBeDefined();
      expect(schema.offers.price).toBe('0');
      expect(schema.offers.priceCurrency).toBeDefined();
      expect(schema.offers.priceCurrency).toBe('USD');
      
      // Verify price is a string (schema.org requirement)
      expect(typeof schema.offers.price).toBe('string');
    });

    /**
     * Test: Author field is properly structured
     * Validates: Requirements 3.2
     */
    test('should include properly structured Organization author', () => {
      const schema = createWebApplicationSchema();
      
      expect(schema.author).toBeDefined();
      expect(schema.author['@type']).toBe('Organization');
      expect(schema.author.name).toBeDefined();
      expect(schema.author.name).toBe('VOW Team');
      expect(schema.author.url).toBeDefined();
      expect(schema.author.url).toBe(APP_CONFIG.url);
    });

    /**
     * Test: AggregateRating field is properly structured
     * Validates: Requirements 3.2
     */
    test('should include properly structured AggregateRating', () => {
      const schema = createWebApplicationSchema();
      
      expect(schema.aggregateRating).toBeDefined();
      expect(schema.aggregateRating['@type']).toBe('AggregateRating');
      expect(schema.aggregateRating.ratingValue).toBeDefined();
      expect(schema.aggregateRating.ratingValue).toBe('4.8');
      expect(schema.aggregateRating.ratingCount).toBeDefined();
      expect(schema.aggregateRating.ratingCount).toBe('100');
      
      // Verify values are strings (schema.org requirement)
      expect(typeof schema.aggregateRating.ratingValue).toBe('string');
      expect(typeof schema.aggregateRating.ratingCount).toBe('string');
    });

    /**
     * Test: FeatureList is properly structured
     * Validates: Requirements 3.2
     */
    test('should include properly structured featureList array', () => {
      const schema = createWebApplicationSchema();
      
      expect(schema.featureList).toBeDefined();
      expect(Array.isArray(schema.featureList)).toBe(true);
      expect(schema.featureList.length).toBeGreaterThan(0);
      
      // Verify all features are strings
      schema.featureList.forEach(feature => {
        expect(typeof feature).toBe('string');
        expect(feature.length).toBeGreaterThan(0);
      });
      
      // Verify expected features are present
      expect(schema.featureList).toContain('Habit tracking');
      expect(schema.featureList).toContain('Goal setting');
      expect(schema.featureList).toContain('Progress visualization');
      expect(schema.featureList).toContain('Daily reminders');
      expect(schema.featureList).toContain('Multi-language support');
    });
  });

  describe('createWebApplicationSchema - Schema.org Compliance', () => {
    /**
     * Test: @context uses correct schema.org URL
     * Validates: Requirements 3.3
     */
    test('should use correct schema.org context URL', () => {
      const schema = createWebApplicationSchema();
      
      expect(schema['@context']).toBe('https://schema.org');
      // Verify it's HTTPS (required by schema.org)
      expect(schema['@context']).toMatch(/^https:\/\//);
    });

    /**
     * Test: @type is valid SoftwareApplication
     * Validates: Requirements 3.3
     */
    test('should use valid SoftwareApplication type', () => {
      const schema = createWebApplicationSchema();
      
      expect(schema['@type']).toBe('SoftwareApplication');
      // Verify exact case (schema.org is case-sensitive)
      expect(schema['@type']).not.toBe('softwareApplication');
      expect(schema['@type']).not.toBe('SOFTWAREAPPLICATION');
    });

    /**
     * Test: applicationCategory uses valid schema.org value
     * Validates: Requirements 3.3
     */
    test('should use valid applicationCategory value', () => {
      const schema = createWebApplicationSchema();
      
      // ProductivityApplication is a valid schema.org category
      expect(schema.applicationCategory).toBe('ProductivityApplication');
      
      // Verify it's one of the valid categories
      const validCategories = [
        'GameApplication',
        'SocialNetworkingApplication',
        'TravelApplication',
        'ShoppingApplication',
        'SportsApplication',
        'LifestyleApplication',
        'BusinessApplication',
        'DesignApplication',
        'DeveloperApplication',
        'DriverApplication',
        'EducationalApplication',
        'HealthApplication',
        'FinanceApplication',
        'SecurityApplication',
        'BrowserApplication',
        'CommunicationApplication',
        'DesktopEnhancementApplication',
        'EntertainmentApplication',
        'MultimediaApplication',
        'HomeApplication',
        'UtilitiesApplication',
        'ReferenceApplication',
        'ProductivityApplication', // Our category
      ];
      
      expect(validCategories).toContain(schema.applicationCategory);
    });

    /**
     * Test: URL fields use valid absolute URLs
     * Validates: Requirements 3.3
     */
    test('should use valid absolute URLs for all URL fields', () => {
      const schema = createWebApplicationSchema();
      
      // Main URL
      expect(schema.url).toMatch(/^https?:\/\/.+/);
      
      // Author URL
      expect(schema.author.url).toMatch(/^https?:\/\/.+/);
      
      // URLs should be well-formed
      expect(() => new URL(schema.url)).not.toThrow();
      expect(() => new URL(schema.author.url)).not.toThrow();
    });

    /**
     * Test: Nested @type fields are correctly set
     * Validates: Requirements 3.3
     */
    test('should correctly set @type for all nested objects', () => {
      const schema = createWebApplicationSchema();
      
      // Verify all nested objects have correct @type
      expect(schema.offers['@type']).toBe('Offer');
      expect(schema.author['@type']).toBe('Organization');
      expect(schema.aggregateRating['@type']).toBe('AggregateRating');
      
      // Verify @type values are exact (case-sensitive)
      expect(schema.offers['@type']).not.toBe('offer');
      expect(schema.author['@type']).not.toBe('organization');
      expect(schema.aggregateRating['@type']).not.toBe('aggregateRating');
    });

    /**
     * Test: Price currency uses valid ISO 4217 code
     * Validates: Requirements 3.3
     */
    test('should use valid ISO 4217 currency code', () => {
      const schema = createWebApplicationSchema();
      
      // USD is a valid ISO 4217 code
      expect(schema.offers.priceCurrency).toBe('USD');
      expect(schema.offers.priceCurrency).toHaveLength(3);
      expect(schema.offers.priceCurrency).toMatch(/^[A-Z]{3}$/);
    });

    /**
     * Test: Rating values are within valid ranges
     * Validates: Requirements 3.3
     */
    test('should use valid rating values', () => {
      const schema = createWebApplicationSchema();
      
      const ratingValue = parseFloat(schema.aggregateRating.ratingValue);
      const ratingCount = parseInt(schema.aggregateRating.ratingCount, 10);
      
      // Rating value should be between 0 and 5 (typical range)
      expect(ratingValue).toBeGreaterThanOrEqual(0);
      expect(ratingValue).toBeLessThanOrEqual(5);
      
      // Rating count should be positive
      expect(ratingCount).toBeGreaterThan(0);
      expect(Number.isInteger(ratingCount)).toBe(true);
    });

    /**
     * Test: Schema contains no undefined or null values
     * Validates: Requirements 3.3
     */
    test('should not contain undefined or null values', () => {
      const schema = createWebApplicationSchema();
      const jsonString = JSON.stringify(schema);
      
      // JSON.stringify removes undefined, so check the object directly
      const checkForUndefinedOrNull = (obj: any, path = ''): void => {
        Object.entries(obj).forEach(([key, value]) => {
          const currentPath = path ? `${path}.${key}` : key;
          
          expect(value).not.toBeUndefined();
          expect(value).not.toBeNull();
          
          if (typeof value === 'object' && !Array.isArray(value)) {
            checkForUndefinedOrNull(value, currentPath);
          } else if (Array.isArray(value)) {
            value.forEach((item, index) => {
              if (typeof item === 'object') {
                checkForUndefinedOrNull(item, `${currentPath}[${index}]`);
              } else {
                expect(item).not.toBeUndefined();
                expect(item).not.toBeNull();
              }
            });
          }
        });
      };
      
      checkForUndefinedOrNull(schema);
    });

    /**
     * Test: Schema structure matches schema.org SoftwareApplication specification
     * Validates: Requirements 3.3
     */
    test('should match schema.org SoftwareApplication structure', () => {
      const schema = createWebApplicationSchema();
      
      // Verify top-level structure
      expect(Object.keys(schema)).toContain('@context');
      expect(Object.keys(schema)).toContain('@type');
      expect(Object.keys(schema)).toContain('name');
      expect(Object.keys(schema)).toContain('description');
      expect(Object.keys(schema)).toContain('url');
      expect(Object.keys(schema)).toContain('applicationCategory');
      expect(Object.keys(schema)).toContain('operatingSystem');
      expect(Object.keys(schema)).toContain('offers');
      expect(Object.keys(schema)).toContain('author');
      expect(Object.keys(schema)).toContain('aggregateRating');
      expect(Object.keys(schema)).toContain('featureList');
      
      // Verify no unexpected top-level fields
      const expectedKeys = [
        '@context',
        '@type',
        'name',
        'description',
        'url',
        'applicationCategory',
        'operatingSystem',
        'offers',
        'author',
        'aggregateRating',
        'featureList',
      ];
      
      Object.keys(schema).forEach(key => {
        expect(expectedKeys).toContain(key);
      });
    });
  });

  describe('createBreadcrumbSchema - Schema.org Compliance', () => {
    /**
     * Test: Breadcrumb schema uses correct @context and @type
     * Validates: Requirements 3.3
     */
    test('should use correct schema.org context and type for BreadcrumbList', () => {
      const items = [
        { name: 'Home', url: 'https://example.com' },
        { name: 'Page', url: 'https://example.com/page' },
      ];
      const schema = createBreadcrumbSchema(items);
      
      expect(schema['@context']).toBe('https://schema.org');
      expect(schema['@type']).toBe('BreadcrumbList');
    });

    /**
     * Test: ListItem positions start at 1 and are sequential
     * Validates: Requirements 3.3
     */
    test('should use correct position numbering (starting at 1)', () => {
      const items = [
        { name: 'Home', url: 'https://example.com' },
        { name: 'Category', url: 'https://example.com/category' },
        { name: 'Page', url: 'https://example.com/category/page' },
      ];
      const schema = createBreadcrumbSchema(items);
      
      schema.itemListElement.forEach((item, index) => {
        // Positions should start at 1, not 0
        expect(item.position).toBe(index + 1);
      });
      
      // Verify sequential numbering
      expect(schema.itemListElement[0].position).toBe(1);
      expect(schema.itemListElement[1].position).toBe(2);
      expect(schema.itemListElement[2].position).toBe(3);
    });

    /**
     * Test: All ListItems have correct @type
     * Validates: Requirements 3.3
     */
    test('should set correct @type for all ListItem elements', () => {
      const items = [
        { name: 'Home', url: 'https://example.com' },
        { name: 'Page', url: 'https://example.com/page' },
      ];
      const schema = createBreadcrumbSchema(items);
      
      schema.itemListElement.forEach(item => {
        expect(item['@type']).toBe('ListItem');
      });
    });

    /**
     * Test: Breadcrumb URLs are valid absolute URLs
     * Validates: Requirements 3.3
     */
    test('should use valid absolute URLs for breadcrumb items', () => {
      const items = [
        { name: 'Home', url: 'https://example.com' },
        { name: 'Page', url: 'https://example.com/page' },
      ];
      const schema = createBreadcrumbSchema(items);
      
      schema.itemListElement.forEach(item => {
        expect(item.item).toMatch(/^https?:\/\/.+/);
        expect(() => new URL(item.item)).not.toThrow();
      });
    });

    /**
     * Test: Breadcrumb schema is valid JSON-LD
     * Validates: Requirements 3.1, 3.3
     */
    test('should generate valid JSON-LD for breadcrumbs', () => {
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
