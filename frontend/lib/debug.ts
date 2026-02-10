// Debug utility to control console.log output
// In CI/test environments, logs are suppressed unless DEBUG is explicitly enabled

const isDebugEnabled = () => {
  // In production, always disable debug logs (no override possible)
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
    return false;
  }

  // Check if we're in a test environment
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
    return process.env.DEBUG === 'true';
  }

  // Check if we're in CI
  if (typeof process !== 'undefined' && process.env.CI === 'true') {
    return process.env.DEBUG === 'true';
  }

  // In development, always enable
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
    return true;
  }

  // In browser (non-production), check localStorage
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    return localStorage.getItem('DEBUG') === 'true';
  }

  return false;
};

export const debug = {
  log: (...args: any[]) => {
    if (isDebugEnabled()) {
      console.log(...args);
    }
  },
  warn: (...args: any[]) => {
    if (isDebugEnabled()) {
      console.warn(...args);
    }
  },
  error: (...args: any[]) => {
    // Always log errors
    console.error(...args);
  },
};
