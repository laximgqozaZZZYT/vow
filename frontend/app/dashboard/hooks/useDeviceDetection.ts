/**
 * Device Detection Hook
 * 
 * Consolidated device detection logic extracted from Widget.Calendar.tsx and 
 * Widget.Mindmap.tsx to eliminate code duplication and provide consistent 
 * device detection across the application.
 */

import { useState, useEffect } from 'react';

export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  screenWidth: number;
  screenHeight: number;
  isTouchDevice: boolean;
}

/**
 * Custom hook for device detection and screen size monitoring
 * Provides reactive device information that updates on window resize
 * 
 * @returns DeviceInfo object with current device characteristics
 */
export function useDeviceDetection(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(() => {
    // Server-side rendering safe defaults
    if (typeof window === 'undefined') {
      return {
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        screenWidth: 1024,
        screenHeight: 768,
        isTouchDevice: false,
      };
    }

    // Initial client-side detection
    return detectDevice();
  });

  useEffect(() => {
    // Skip if running on server
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setDeviceInfo(detectDevice());
    };

    // Set initial values
    handleResize();

    // Listen for resize events
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return deviceInfo;
}

/**
 * Detect current device characteristics
 * Combines multiple detection methods for accurate device classification
 * 
 * @returns DeviceInfo object with current device characteristics
 */
function detectDevice(): DeviceInfo {
  if (typeof window === 'undefined') {
    return {
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      screenWidth: 1024,
      screenHeight: 768,
      isTouchDevice: false,
    };
  }

  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  
  // Touch device detection
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // User agent based detection for more accurate mobile/tablet distinction
  const userAgent = navigator.userAgent;
  const isMobileUserAgent = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isTabletUserAgent = /iPad|Android(?!.*Mobile)/i.test(userAgent);
  
  // Screen size based detection (fallback and primary method)
  const isMobileScreen = screenWidth < 768;
  const isTabletScreen = screenWidth >= 768 && screenWidth < 1024;
  const isDesktopScreen = screenWidth >= 1024;
  
  // Combine detection methods for final classification
  // Priority: User agent detection > Screen size detection
  let isMobile = isMobileUserAgent || (isMobileScreen && isTouchDevice);
  let isTablet = isTabletUserAgent || (isTabletScreen && isTouchDevice && !isMobileUserAgent);
  let isDesktop = !isMobile && !isTablet;
  
  // Handle edge cases where user agent detection might be unreliable
  if (!isMobile && !isTablet && !isDesktop) {
    // Fallback to screen size only
    isMobile = isMobileScreen;
    isTablet = isTabletScreen;
    isDesktop = isDesktopScreen;
  }

  return {
    isMobile,
    isTablet,
    isDesktop,
    screenWidth,
    screenHeight,
    isTouchDevice,
  };
}

/**
 * Simple mobile detection function for backward compatibility
 * Matches the logic used in Widget.Calendar.tsx
 * 
 * @returns true if device is considered mobile
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  
  return window.innerWidth < 768 || 'ontouchstart' in window;
}

/**
 * Comprehensive mobile detection function for backward compatibility
 * Matches the logic used in Widget.Mindmap.tsx
 * 
 * @returns true if device is considered mobile
 */
export function isMobileDeviceComprehensive(): boolean {
  if (typeof window === 'undefined') return false;
  
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         (window.innerWidth <= 768) ||
         ('ontouchstart' in window);
}