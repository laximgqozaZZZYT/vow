/**
 * Property-based tests for structured data validity
 * Feature: seo-metadata-enhancement
 * Task: 2.2 構造化データ妥当性のプロパティテストを作成
 * Property 3: 構造化データの妥当性
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

import * as fc from 'fast-check';
import {
  createWebApplicationSchema,
  createBreadcrumbSchema,
} from '../lib/seo.metadata';

describe('Property-Based Tests: Structured Data Validity', () => {
  /**
   * Property 3: 構造化データの妥当性
   * For any 構造化データ、それはschema.orgの仕様に準拠し、必須フィールドが全て含まれる
   * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
   */
  describe('Property 3: Structured Data Validity', () => {
    /**
     * Property: WebApplication schema is always valid JSON-LD
     * For any execution, the schema must be serializable and parseable
     */
    test('WebApplication schema is always valid JSON-LD', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const schema = createWebApplicationSchema();
          
          // Property: Must be serializable to JSON without errors
          let jsonString: string;
          expect(() => {
            jsonString = JSON.stringify(schema);
          }).not.toThrow();
          
          // Property: Serialized JSON must be non-empty
          expect(jsonString!).toBeTruthy();
          expect(jsonString!.length).toBeGreaterThan(0);
          
          // Property: Must be parseable back to equivalent object
          const parsed = JSON.parse(jsonString!);
          expect(parsed).toEqual(schema);
          
          // Property: Must not contain script-breaking characters
          expect(jsonString!).not.toContain('</script>');
          expect(jsonString!).not.toContain('<script>');
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: WebApplication schema always contains required schema.org fields
     * For any execution, all mandatory fields must be present and valid
     */
    test('WebApplication schema always contains required schema.org fields', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const schema = createWebApplicationSchema();
          
          // Property: @context must be schema.org HTTPS URL
          expect(schema['@context']).toBe('https://schema.org');
          expect(schema['@context']).toMatch(/^https:\/\/schema\.org$/);
          
          // Property: @type must be exactly 'SoftwareApplication'
          expect(schema['@type']).toBe('SoftwareApplication');
          
          // Property: name must be a non-empty string
          expect(typeof schema.name).toBe('string');
          expect(schema.name.length).toBeGreaterThan(0);
          
          // Property: description must be a non-empty string
          expect(typeof schema.description).toBe('string');
          expect(schema.description.length).toBeGreaterThan(0);
          
          // Property: url must be a valid absolute URL
          expect(typeof schema.url).toBe('string');
          expect(schema.url).toMatch(/^https?:\/\/.+/);
          expect(() => new URL(schema.url)).not.toThrow();
          
          // Property: applicationCategory must be a non-empty string
          expect(typeof schema.applicationCategory).toBe('string');
          expect(schema.applicationCategory.length).toBeGreaterThan(0);
          
          // Property: operatingSystem must be a non-empty string
          expect(typeof schema.operatingSystem).toBe('string');
          expect(schema.operatingSystem.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Offers object is always properly structured
     * For any execution, the offers field must conform to schema.org Offer type
     */
    test('Offers object is always properly structured', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const schema = createWebApplicationSchema();
          
          // Property: offers must exist
          expect(schema.offers).toBeDefined();
          
          // Property: offers @type must be exactly 'Offer'
          expect(schema.offers['@type']).toBe('Offer');
          
          // Property: price must be a string (schema.org requirement)
          expect(typeof schema.offers.price).toBe('string');
          
          // Property: price must be parseable as a number
          const priceValue = parseFloat(schema.offers.price);
          expect(Number.isNaN(priceValue)).toBe(false);
          expect(priceValue).toBeGreaterThanOrEqual(0);
          
          // Property: priceCurrency must be a valid 3-letter ISO 4217 code
          expect(typeof schema.offers.priceCurrency).toBe('string');
          expect(schema.offers.priceCurrency).toMatch(/^[A-Z]{3}$/);
          expect(schema.offers.priceCurrency.length).toBe(3);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Author object is always properly structured
     * For any execution, the author field must conform to schema.org Organization type
     */
    test('Author object is always properly structured', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const schema = createWebApplicationSchema();
          
          // Property: author must exist
          expect(schema.author).toBeDefined();
          
          // Property: author @type must be exactly 'Organization'
          expect(schema.author['@type']).toBe('Organization');
          
          // Property: author name must be a non-empty string
          expect(typeof schema.author.name).toBe('string');
          expect(schema.author.name.length).toBeGreaterThan(0);
          
          // Property: author url must be a valid absolute URL
          expect(typeof schema.author.url).toBe('string');
          expect(schema.author.url).toMatch(/^https?:\/\/.+/);
          expect(() => new URL(schema.author.url)).not.toThrow();
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: AggregateRating object is always properly structured
     * For any execution, the aggregateRating field must conform to schema.org AggregateRating type
     */
    test('AggregateRating object is always properly structured', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const schema = createWebApplicationSchema();
          
          // Property: aggregateRating must exist
          expect(schema.aggregateRating).toBeDefined();
          
          // Property: aggregateRating @type must be exactly 'AggregateRating'
          expect(schema.aggregateRating['@type']).toBe('AggregateRating');
          
          // Property: ratingValue must be a string (schema.org requirement)
          expect(typeof schema.aggregateRating.ratingValue).toBe('string');
          
          // Property: ratingValue must be parseable as a number in valid range
          const ratingValue = parseFloat(schema.aggregateRating.ratingValue);
          expect(Number.isNaN(ratingValue)).toBe(false);
          expect(ratingValue).toBeGreaterThanOrEqual(0);
          expect(ratingValue).toBeLessThanOrEqual(5);
          
          // Property: ratingCount must be a string (schema.org requirement)
          expect(typeof schema.aggregateRating.ratingCount).toBe('string');
          
          // Property: ratingCount must be parseable as a positive integer
          const ratingCount = parseInt(schema.aggregateRating.ratingCount, 10);
          expect(Number.isNaN(ratingCount)).toBe(false);
          expect(ratingCount).toBeGreaterThan(0);
          expect(Number.isInteger(ratingCount)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: FeatureList is always properly structured
     * For any execution, the featureList must be a non-empty array of strings
     */
    test('FeatureList is always properly structured', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const schema = createWebApplicationSchema();
          
          // Property: featureList must exist and be an array
          expect(schema.featureList).toBeDefined();
          expect(Array.isArray(schema.featureList)).toBe(true);
          
          // Property: featureList must not be empty
          expect(schema.featureList.length).toBeGreaterThan(0);
          
          // Property: all features must be non-empty strings
          schema.featureList.forEach((feature, index) => {
            expect(typeof feature).toBe('string');
            expect(feature.length).toBeGreaterThan(0);
          });
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Schema contains no undefined or null values
     * For any execution, all fields must have defined, non-null values
     */
    test('Schema contains no undefined or null values', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const schema = createWebApplicationSchema();
          
          // Helper function to recursively check for undefined/null
          const checkForUndefinedOrNull = (obj: any, path = ''): void => {
            Object.entries(obj).forEach(([key, value]) => {
              const currentPath = path ? `${path}.${key}` : key;
              
              // Property: no field should be undefined or null
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
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Schema structure is consistent across executions
     * For any execution, the schema must have the same structure and field names
     */
    test('Schema structure is consistent across executions', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const schema1 = createWebApplicationSchema();
          const schema2 = createWebApplicationSchema();
          
          // Property: schemas must be deeply equal
          expect(schema1).toEqual(schema2);
          
          // Property: JSON representations must be identical
          expect(JSON.stringify(schema1)).toBe(JSON.stringify(schema2));
          
          // Property: must have exact same keys at top level
          expect(Object.keys(schema1).sort()).toEqual(Object.keys(schema2).sort());
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property: BreadcrumbList schema is always valid
   * For any valid breadcrumb items, the schema must conform to schema.org BreadcrumbList
   */
  describe('Property 3: BreadcrumbList Validity', () => {
    /**
     * Generator for valid breadcrumb items
     */
    const breadcrumbItemArbitrary = fc.record({
      name: fc.string({ minLength: 1, maxLength: 100 }),
      url: fc.webUrl(),
    });

    const breadcrumbItemsArbitrary = fc.array(breadcrumbItemArbitrary, {
      minLength: 1,
      maxLength: 10,
    });

    /**
     * Property: BreadcrumbList schema is always valid JSON-LD
     * For any breadcrumb items, the schema must be serializable and parseable
     */
    test('BreadcrumbList schema is always valid JSON-LD', () => {
      fc.assert(
        fc.property(breadcrumbItemsArbitrary, (items) => {
          const schema = createBreadcrumbSchema(items);
          
          // Property: Must be serializable to JSON without errors
          let jsonString: string;
          expect(() => {
            jsonString = JSON.stringify(schema);
          }).not.toThrow();
          
          // Property: Serialized JSON must be non-empty
          expect(jsonString!).toBeTruthy();
          expect(jsonString!.length).toBeGreaterThan(0);
          
          // Property: Must be parseable back to equivalent object
          const parsed = JSON.parse(jsonString!);
          expect(parsed).toEqual(schema);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: BreadcrumbList always has correct @context and @type
     * For any breadcrumb items, the schema must have correct schema.org identifiers
     */
    test('BreadcrumbList always has correct @context and @type', () => {
      fc.assert(
        fc.property(breadcrumbItemsArbitrary, (items) => {
          const schema = createBreadcrumbSchema(items);
          
          // Property: @context must be schema.org HTTPS URL
          expect(schema['@context']).toBe('https://schema.org');
          
          // Property: @type must be exactly 'BreadcrumbList'
          expect(schema['@type']).toBe('BreadcrumbList');
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: ListItem positions are always sequential starting from 1
     * For any breadcrumb items, positions must be 1, 2, 3, ... n
     */
    test('ListItem positions are always sequential starting from 1', () => {
      fc.assert(
        fc.property(breadcrumbItemsArbitrary, (items) => {
          const schema = createBreadcrumbSchema(items);
          
          // Property: itemListElement must have same length as input
          expect(schema.itemListElement.length).toBe(items.length);
          
          // Property: positions must be sequential starting from 1
          schema.itemListElement.forEach((item, index) => {
            expect(item.position).toBe(index + 1);
          });
          
          // Property: first position must be 1
          if (schema.itemListElement.length > 0) {
            expect(schema.itemListElement[0].position).toBe(1);
          }
          
          // Property: last position must equal array length
          if (schema.itemListElement.length > 0) {
            const lastIndex = schema.itemListElement.length - 1;
            expect(schema.itemListElement[lastIndex].position).toBe(items.length);
          }
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: All ListItems have correct @type and required fields
     * For any breadcrumb items, each ListItem must be properly structured
     */
    test('All ListItems have correct @type and required fields', () => {
      fc.assert(
        fc.property(breadcrumbItemsArbitrary, (items) => {
          const schema = createBreadcrumbSchema(items);
          
          schema.itemListElement.forEach((item, index) => {
            // Property: @type must be exactly 'ListItem'
            expect(item['@type']).toBe('ListItem');
            
            // Property: position must be a positive integer
            expect(typeof item.position).toBe('number');
            expect(Number.isInteger(item.position)).toBe(true);
            expect(item.position).toBeGreaterThan(0);
            
            // Property: name must be a non-empty string
            expect(typeof item.name).toBe('string');
            expect(item.name.length).toBeGreaterThan(0);
            
            // Property: item (URL) must be a non-empty string
            expect(typeof item.item).toBe('string');
            expect(item.item.length).toBeGreaterThan(0);
            
            // Property: name and item must match input
            expect(item.name).toBe(items[index].name);
            expect(item.item).toBe(items[index].url);
          });
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: BreadcrumbList preserves input order
     * For any breadcrumb items, the output order must match input order
     */
    test('BreadcrumbList preserves input order', () => {
      fc.assert(
        fc.property(breadcrumbItemsArbitrary, (items) => {
          const schema = createBreadcrumbSchema(items);
          
          // Property: each item must appear in same order as input
          items.forEach((inputItem, index) => {
            expect(schema.itemListElement[index].name).toBe(inputItem.name);
            expect(schema.itemListElement[index].item).toBe(inputItem.url);
          });
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: BreadcrumbList handles edge cases correctly
     * For any breadcrumb items including edge cases, schema must be valid
     */
    test('BreadcrumbList handles single item correctly', () => {
      fc.assert(
        fc.property(breadcrumbItemArbitrary, (item) => {
          const schema = createBreadcrumbSchema([item]);
          
          // Property: single item list must be valid
          expect(schema.itemListElement.length).toBe(1);
          expect(schema.itemListElement[0].position).toBe(1);
          expect(schema.itemListElement[0].name).toBe(item.name);
          expect(schema.itemListElement[0].item).toBe(item.url);
        }),
        { numRuns: 100 }
      );
    });
  });
});
