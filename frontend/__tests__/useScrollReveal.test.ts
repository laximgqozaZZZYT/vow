/**
 * Unit Tests for useScrollReveal hook
 * Feature: landing-page-conversion-optimization
 * Validates: Requirements 6.1, 6.4, 6.5
 */

import { renderHook } from '@testing-library/react';
import { useScrollReveal } from '@/hooks/useScrollReveal';

// Mock IntersectionObserver
class MockIntersectionObserver {
  constructor(
    private callback: IntersectionObserverCallback,
    private options?: IntersectionObserverInit
  ) {}

  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}

describe('useScrollReveal Hook', () => {
  let mockIntersectionObserver: typeof MockIntersectionObserver;
  let mockMatchMedia: jest.Mock;

  beforeEach(() => {
    // Mock IntersectionObserver
    mockIntersectionObserver = MockIntersectionObserver;
    global.IntersectionObserver = mockIntersectionObserver as any;

    // Mock matchMedia for prefers-reduced-motion
    mockMatchMedia = jest.fn().mockReturnValue({
      matches: false,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });
    global.matchMedia = mockMatchMedia;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should return ref and isVisible state', () => {
    const { result } = renderHook(() => useScrollReveal());

    expect(result.current).toHaveProperty('ref');
    expect(result.current).toHaveProperty('isVisible');
    expect(result.current.ref).toBeDefined();
    expect(typeof result.current.isVisible).toBe('boolean');
  });

  test('should use default options when none provided', () => {
    const { result } = renderHook(() => useScrollReveal());

    expect(result.current.ref).toBeDefined();
    expect(result.current.isVisible).toBe(false);
  });

  test('should accept custom threshold option', () => {
    const { result } = renderHook(() => 
      useScrollReveal({ threshold: 0.5 })
    );

    expect(result.current.ref).toBeDefined();
  });

  test('should accept custom rootMargin option', () => {
    const { result } = renderHook(() => 
      useScrollReveal({ rootMargin: '0px 0px -50px 0px' })
    );

    expect(result.current.ref).toBeDefined();
  });

  test('should accept custom triggerOnce option', () => {
    const { result } = renderHook(() => 
      useScrollReveal({ triggerOnce: false })
    );

    expect(result.current.ref).toBeDefined();
  });

  test('should respect prefers-reduced-motion by setting isVisible to true immediately', () => {
    // Mock prefers-reduced-motion: reduce
    mockMatchMedia.mockReturnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });

    const { result } = renderHook(() => useScrollReveal());

    // When reduced motion is preferred, isVisible should be true immediately
    expect(result.current.isVisible).toBe(true);
  });

  test('should start with isVisible false when reduced motion is not preferred', () => {
    // Mock prefers-reduced-motion: no-preference
    mockMatchMedia.mockReturnValue({
      matches: false,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });

    const { result } = renderHook(() => useScrollReveal());

    // When reduced motion is not preferred, isVisible should start as false
    expect(result.current.isVisible).toBe(false);
  });

  test('should handle server-side rendering gracefully', () => {
    // Temporarily remove window to simulate SSR
    const originalWindow = global.window;
    // @ts-ignore
    delete global.window;

    const { result } = renderHook(() => useScrollReveal());

    expect(result.current.ref).toBeDefined();
    expect(result.current.isVisible).toBe(false);

    // Restore window
    global.window = originalWindow;
  });

  test('should accept all options together', () => {
    const { result } = renderHook(() => 
      useScrollReveal({
        threshold: 0.3,
        rootMargin: '0px 0px -200px 0px',
        triggerOnce: false,
      })
    );

    expect(result.current.ref).toBeDefined();
    expect(result.current.isVisible).toBe(false);
  });
});
