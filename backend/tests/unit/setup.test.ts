/**
 * Basic test to verify the test infrastructure is working.
 * This file can be removed once actual tests are added.
 */

import { describe, it, expect } from 'vitest';

describe('Test Infrastructure', () => {
  it('should run tests successfully', () => {
    expect(true).toBe(true);
  });

  it('should support TypeScript', () => {
    const value: string = 'hello';
    expect(value).toBe('hello');
  });
});
