/**
 * Unit tests for sitemap.xml generation
 * Validates: Requirements 7.4, 7.5, 7.6
 */

import sitemap from '../app/sitemap';
import { APP_CONFIG } from '../lib/seo.metadata';

describe('Sitemap Generation', () => {
  it('should generate a valid sitemap with all public pages', () => {
    const result = sitemap();

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should include homepage with correct properties', () => {
    const result = sitemap();
    const homepage = result.find(entry => entry.url === APP_CONFIG.url);

    expect(homepage).toBeDefined();
    expect(homepage?.lastModified).toBeInstanceOf(Date);
    expect(homepage?.changeFrequency).toBe('weekly');
    expect(homepage?.priority).toBe(1.0);
  });

  it('should include login page with correct properties', () => {
    const result = sitemap();
    const loginPage = result.find(entry => entry.url === `${APP_CONFIG.url}/login`);

    expect(loginPage).toBeDefined();
    expect(loginPage?.lastModified).toBeInstanceOf(Date);
    expect(loginPage?.changeFrequency).toBe('monthly');
    expect(loginPage?.priority).toBe(0.8);
  });

  it('should include multi-language alternates for all pages', () => {
    const result = sitemap();

    result.forEach(entry => {
      expect(entry.alternates).toBeDefined();
      expect(entry.alternates?.languages).toBeDefined();
      expect(entry.alternates?.languages?.en).toBeDefined();
      expect(entry.alternates?.languages?.ja).toBeDefined();
    });
  });

  it('should have correct language alternate URLs for homepage', () => {
    const result = sitemap();
    const homepage = result.find(entry => entry.url === APP_CONFIG.url);

    expect(homepage?.alternates?.languages?.en).toBe(`${APP_CONFIG.url}/`);
    expect(homepage?.alternates?.languages?.ja).toBe(`${APP_CONFIG.url}/ja`);
  });

  it('should have correct language alternate URLs for login page', () => {
    const result = sitemap();
    const loginPage = result.find(entry => entry.url === `${APP_CONFIG.url}/login`);

    expect(loginPage?.alternates?.languages?.en).toBe(`${APP_CONFIG.url}/login`);
    expect(loginPage?.alternates?.languages?.ja).toBe(`${APP_CONFIG.url}/ja/login`);
  });

  it('should not include private pages (dashboard, test-auth)', () => {
    const result = sitemap();
    const urls = result.map(entry => entry.url);

    expect(urls).not.toContain(`${APP_CONFIG.url}/dashboard`);
    expect(urls).not.toContain(`${APP_CONFIG.url}/test-auth`);
  });

  it('should not include API endpoints', () => {
    const result = sitemap();
    const urls = result.map(entry => entry.url);

    const hasApiEndpoint = urls.some(url => url.includes('/api/'));
    expect(hasApiEndpoint).toBe(false);
  });

  it('should have lastModified as a valid Date object for all entries', () => {
    const result = sitemap();

    result.forEach(entry => {
      expect(entry.lastModified).toBeInstanceOf(Date);
      expect(entry.lastModified.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  it('should have valid changeFrequency values', () => {
    const result = sitemap();
    const validFrequencies = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'];

    result.forEach(entry => {
      expect(validFrequencies).toContain(entry.changeFrequency);
    });
  });

  it('should have priority values between 0 and 1', () => {
    const result = sitemap();

    result.forEach(entry => {
      if (entry.priority !== undefined) {
        expect(entry.priority).toBeGreaterThanOrEqual(0);
        expect(entry.priority).toBeLessThanOrEqual(1);
      }
    });
  });
});
