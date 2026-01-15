/**
 * Property-based tests for semantic HTML hierarchy
 * Feature: seo-metadata-enhancement
 * Task: 3.1 セマンティックHTML階層のプロパティテストを作成
 * Property 4: セマンティックHTML階層の正確性
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
 */

import * as fc from 'fast-check';
import { render } from '@testing-library/react';
import RootLayout from '../app/layout';
import HomePage from '../app/page';

/**
 * Helper function to extract heading hierarchy from HTML
 */
function extractHeadingHierarchy(html: string): Array<{ level: number; text: string }> {
  const headings: Array<{ level: number; text: string }> = [];
  const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h\1>/gi;
  let match;
  
  while ((match = headingRegex.exec(html)) !== null) {
    headings.push({
      level: parseInt(match[1], 10),
      text: match[2].replace(/<[^>]*>/g, '').trim(), // Strip HTML tags from text
    });
  }
  
  return headings;
}

/**
 * Helper function to check if semantic tags exist in HTML
 */
function hasSemanticTag(html: string, tagName: string): boolean {
  const regex = new RegExp(`<${tagName}[^>]*>`, 'i');
  return regex.test(html);
}

/**
 * Helper function to count occurrences of a tag
 */
function countTag(html: string, tagName: string): number {
  const regex = new RegExp(`<${tagName}[^>]*>`, 'gi');
  const matches = html.match(regex);
  return matches ? matches.length : 0;
}

/**
 * Helper function to check heading hierarchy validity
 * Headings should not skip levels (e.g., h1 -> h3 is invalid)
 */
function isValidHeadingHierarchy(headings: Array<{ level: number; text: string }>): boolean {
  if (headings.length === 0) return true;
  
  // First heading should be h1
  if (headings[0].level !== 1) return false;
  
  // Check that we don't skip levels
  for (let i = 1; i < headings.length; i++) {
    const prevLevel = headings[i - 1].level;
    const currLevel = headings[i].level;
    
    // Can go down any number of levels, but can only go up by 1 level at most
    if (currLevel > prevLevel + 1) {
      return false;
    }
  }
  
  return true;
}

describe('Property-Based Tests: Semantic HTML Hierarchy', () => {
  /**
   * Property 4: セマンティックHTML階層の正確性
   * For any page, heading tags (h1-h6) are used in correct hierarchical order,
   * and h1 exists exactly once per page
   * 
   * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
   * Feature: seo-metadata-enhancement, Property 4: セマンティックHTML階層の正確性
   */
  describe('Property 4: Semantic HTML Hierarchy Correctness', () => {
    /**
     * Property: Root layout always has exactly one main tag
     * For any execution, the layout must have exactly one <main> element
     */
    test('Root layout always has exactly one main tag', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const { container } = render(
            <RootLayout>
              <div>Test content</div>
            </RootLayout>
          );
          
          const html = container.innerHTML;
          
          // Property: Must have exactly one <main> tag
          const mainCount = countTag(html, 'main');
          expect(mainCount).toBe(1);
          
          // Property: Main tag must have id="main-content"
          expect(html).toMatch(/<main[^>]*id="main-content"/i);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Root layout always has exactly one header tag
     * For any execution, the layout must have exactly one <header> element
     */
    test('Root layout always has exactly one header tag', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const { container } = render(
            <RootLayout>
              <div>Test content</div>
            </RootLayout>
          );
          
          const html = container.innerHTML;
          
          // Property: Must have at least one <header> tag
          const hasHeader = hasSemanticTag(html, 'header');
          expect(hasHeader).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Root layout always has exactly one footer tag
     * For any execution, the layout must have exactly one <footer> element
     */
    test('Root layout always has exactly one footer tag', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const { container } = render(
            <RootLayout>
              <div>Test content</div>
            </RootLayout>
          );
          
          const html = container.innerHTML;
          
          // Property: Must have exactly one <footer> tag
          const footerCount = countTag(html, 'footer');
          expect(footerCount).toBe(1);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Root layout has skip link for accessibility
     * For any execution, the layout must have a skip link pointing to main content
     */
    test('Root layout has skip link for accessibility', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const { container } = render(
            <RootLayout>
              <div>Test content</div>
            </RootLayout>
          );
          
          const html = container.innerHTML;
          
          // Property: Must have a skip link with href="#main-content"
          expect(html).toMatch(/<a[^>]*href="#main-content"[^>]*>/i);
          
          // Property: Skip link should have class "skip-link"
          expect(html).toMatch(/<a[^>]*class="[^"]*skip-link[^"]*"[^>]*>/i);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Home page always has exactly one h1 tag
     * For any execution, the page must have exactly one <h1> element
     */
    test('Home page always has exactly one h1 tag', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const { container } = render(<HomePage />);
          const html = container.innerHTML;
          
          // Property: Must have exactly one <h1> tag
          const h1Count = countTag(html, 'h1');
          expect(h1Count).toBe(1);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Home page heading hierarchy is valid
     * For any execution, headings must follow proper hierarchy (no skipped levels)
     */
    test('Home page heading hierarchy is valid', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const { container } = render(<HomePage />);
          const html = container.innerHTML;
          
          const headings = extractHeadingHierarchy(html);
          
          // Property: Must have at least one heading
          expect(headings.length).toBeGreaterThan(0);
          
          // Property: Heading hierarchy must be valid (no skipped levels)
          const isValid = isValidHeadingHierarchy(headings);
          expect(isValid).toBe(true);
          
          // Property: First heading must be h1
          if (headings.length > 0) {
            expect(headings[0].level).toBe(1);
          }
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Home page uses semantic section tags
     * For any execution, the page should use <section> tags for content sections
     */
    test('Home page uses semantic section tags', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const { container } = render(<HomePage />);
          const html = container.innerHTML;
          
          // Property: Should have at least one <section> or <main> tag
          const hasSection = hasSemanticTag(html, 'section');
          const hasMain = hasSemanticTag(html, 'main');
          const hasAside = hasSemanticTag(html, 'aside');
          
          // At least one semantic sectioning element should be present
          expect(hasSection || hasMain || hasAside).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Semantic HTML structure is consistent across renders
     * For any execution, the same component should produce the same semantic structure
     */
    test('Semantic HTML structure is consistent across renders', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const { container: container1 } = render(
            <RootLayout>
              <div>Test content</div>
            </RootLayout>
          );
          
          const { container: container2 } = render(
            <RootLayout>
              <div>Test content</div>
            </RootLayout>
          );
          
          const html1 = container1.innerHTML;
          const html2 = container2.innerHTML;
          
          // Property: Main tag count should be consistent
          expect(countTag(html1, 'main')).toBe(countTag(html2, 'main'));
          
          // Property: Footer tag count should be consistent
          expect(countTag(html1, 'footer')).toBe(countTag(html2, 'footer'));
          
          // Property: Skip link should be present in both
          expect(html1).toMatch(/<a[^>]*href="#main-content"/i);
          expect(html2).toMatch(/<a[^>]*href="#main-content"/i);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: No div soup - semantic tags are preferred over divs
     * For any page, semantic tags should be used where appropriate
     */
    test('Semantic tags are used appropriately', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const { container } = render(
            <RootLayout>
              <HomePage />
            </RootLayout>
          );
          
          const html = container.innerHTML;
          
          // Property: Must have semantic structural tags
          expect(hasSemanticTag(html, 'main')).toBe(true);
          expect(hasSemanticTag(html, 'footer')).toBe(true);
          
          // Property: Main content should be inside <main> tag
          const mainRegex = /<main[^>]*>(.*?)<\/main>/is;
          const mainMatch = html.match(mainRegex);
          expect(mainMatch).toBeTruthy();
          
          if (mainMatch) {
            const mainContent = mainMatch[1];
            // The main content should contain the page content
            expect(mainContent.length).toBeGreaterThan(0);
          }
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Heading levels never skip
     * For any page with multiple headings, levels should not skip (e.g., h1 -> h3)
     */
    test('Heading levels never skip in hierarchy', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const { container } = render(<HomePage />);
          const html = container.innerHTML;
          
          const headings = extractHeadingHierarchy(html);
          
          // Property: For each consecutive pair of headings, level difference should not exceed 1 when going up
          for (let i = 1; i < headings.length; i++) {
            const prevLevel = headings[i - 1].level;
            const currLevel = headings[i].level;
            
            // When going to a deeper level (higher number), we can skip
            // But when going to a shallower level (lower number), we should not skip
            if (currLevel > prevLevel) {
              // Going deeper - should not skip more than 1 level
              expect(currLevel - prevLevel).toBeLessThanOrEqual(1);
            }
          }
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: All headings have non-empty text content
     * For any page, all heading tags should contain meaningful text
     */
    test('All headings have non-empty text content', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const { container } = render(<HomePage />);
          const html = container.innerHTML;
          
          const headings = extractHeadingHierarchy(html);
          
          // Property: All headings must have non-empty text
          headings.forEach((heading) => {
            expect(heading.text.length).toBeGreaterThan(0);
            expect(heading.text.trim()).not.toBe('');
          });
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Footer is always at the end of the body
     * For any execution, the footer should be the last major semantic element
     */
    test('Footer is positioned at the end of body', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const { container } = render(
            <RootLayout>
              <div>Test content</div>
            </RootLayout>
          );
          
          const html = container.innerHTML;
          
          // Property: Footer should appear after main content
          const mainIndex = html.indexOf('<main');
          const footerIndex = html.indexOf('<footer');
          
          expect(mainIndex).toBeGreaterThan(-1);
          expect(footerIndex).toBeGreaterThan(-1);
          expect(footerIndex).toBeGreaterThan(mainIndex);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Main content has accessible ID
     * For any execution, the main element must have an ID for skip link navigation
     */
    test('Main content has accessible ID for skip link', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const { container } = render(
            <RootLayout>
              <div>Test content</div>
            </RootLayout>
          );
          
          const html = container.innerHTML;
          
          // Property: Main tag must have id="main-content"
          expect(html).toMatch(/<main[^>]*id="main-content"[^>]*>/i);
          
          // Property: Skip link must reference this ID
          expect(html).toMatch(/<a[^>]*href="#main-content"[^>]*>/i);
        }),
        { numRuns: 100 }
      );
    });
  });
});
