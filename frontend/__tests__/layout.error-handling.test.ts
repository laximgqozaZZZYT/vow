/**
 * Test for JSON-LD error handling in RootLayout
 * Feature: seo-metadata-enhancement
 * Validates: Requirements 3.4, 3.5
 */

import { createWebApplicationSchema } from '../lib/seo.metadata';

describe('RootLayout JSON-LD Error Handling', () => {
  /**
   * Test: createWebApplicationSchema returns valid JSON-LD
   * Validates: Requirements 3.1, 3.2, 3.3
   */
  test('should generate valid JSON-LD that can be stringified', () => {
    const schema = createWebApplicationSchema();
    
    // Should not throw when stringifying
    expect(() => JSON.stringify(schema)).not.toThrow();
    
    // Should produce valid JSON string
    const jsonString = JSON.stringify(schema);
    expect(jsonString).toBeTruthy();
    expect(jsonString.length).toBeGreaterThan(0);
    
    // Should be parseable back
    const parsed = JSON.parse(jsonString);
    expect(parsed).toEqual(schema);
  });

  /**
   * Test: Schema contains all required fields for error recovery
   * Validates: Requirements 3.4, 3.5
   */
  test('should have minimal required fields for fallback schema', () => {
    const schema = createWebApplicationSchema();
    
    // Verify minimal required fields that would be used in fallback
    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('SoftwareApplication');
    expect(schema.name).toBeDefined();
    expect(schema.url).toBeDefined();
    
    // These fields should be present in the full schema
    expect(schema.description).toBeDefined();
    expect(schema.applicationCategory).toBeDefined();
    expect(schema.operatingSystem).toBeDefined();
    expect(schema.offers).toBeDefined();
    expect(schema.author).toBeDefined();
    expect(schema.aggregateRating).toBeDefined();
    expect(schema.featureList).toBeDefined();
  });

  /**
   * Test: Schema structure is consistent
   * Validates: Requirements 3.1, 3.2, 3.3
   */
  test('should maintain consistent schema structure', () => {
    const schema1 = createWebApplicationSchema();
    const schema2 = createWebApplicationSchema();
    
    // Multiple calls should produce identical schemas
    expect(schema1).toEqual(schema2);
    
    // Stringified versions should be identical
    expect(JSON.stringify(schema1)).toBe(JSON.stringify(schema2));
  });

  /**
   * Test: Schema does not contain circular references
   * Validates: Requirements 3.4, 3.5
   */
  test('should not contain circular references that would break JSON.stringify', () => {
    const schema = createWebApplicationSchema();
    
    // This would throw if there were circular references
    expect(() => JSON.stringify(schema)).not.toThrow();
    
    // Verify no circular references by checking all nested objects
    const checkForCircular = (obj: any, seen = new WeakSet()): boolean => {
      if (obj === null || typeof obj !== 'object') {
        return false;
      }
      
      if (seen.has(obj)) {
        return true;
      }
      
      seen.add(obj);
      
      for (const key in obj) {
        if (checkForCircular(obj[key], seen)) {
          return true;
        }
      }
      
      return false;
    };
    
    expect(checkForCircular(schema)).toBe(false);
  });

  /**
   * Test: Schema can be safely embedded in HTML
   * Validates: Requirements 3.5
   */
  test('should produce JSON-LD safe for HTML embedding', () => {
    const schema = createWebApplicationSchema();
    const jsonString = JSON.stringify(schema);
    
    // Should not contain script-breaking characters
    expect(jsonString).not.toContain('</script>');
    expect(jsonString).not.toContain('<script>');
    
    // Should be valid JSON
    expect(() => JSON.parse(jsonString)).not.toThrow();
  });
});
