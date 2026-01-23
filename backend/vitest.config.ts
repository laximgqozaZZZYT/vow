import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/index.ts', 'src/lambda.ts'],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/middleware': path.resolve(__dirname, './src/middleware'),
      '@/routers': path.resolve(__dirname, './src/routers'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/repositories': path.resolve(__dirname, './src/repositories'),
      '@/schemas': path.resolve(__dirname, './src/schemas'),
      '@/errors': path.resolve(__dirname, './src/errors'),
      '@/utils': path.resolve(__dirname, './src/utils'),
    },
  },
});
