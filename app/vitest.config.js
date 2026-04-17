import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

/**
 * Vitest Configuration - SGQ ISO 9001:2015
 * 
 * Standard: ISO 9001:2015 punto 9.1 (Monitoring & Measurement)
 * Target Coverage: ≥80% (lines, functions, branches)
 * 
 * @see https://vitest.dev/config/
 */
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      strict: true,
      allow: [process.cwd(), fs.realpathSync.native(process.cwd())],
    },
  },
  resolve: {
    // Evita che Vitest risolva il symlink sul path reale K:\...
    preserveSymlinks: true,
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  
  test: {
    // Environment: jsdom for React component testing
    environment: 'jsdom',
    
    // Setup file: global test utilities
    setupFiles: ['./src/tests/setup.js'],
    
    // Coverage configuration (ISO 9001 compliance)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: [
        'src/utils/**/*.{js,jsx}',
        'src/services/**/*.{js,jsx}',
        'src/contexts/**/*.{js,jsx}',
        'src/components/**/*.{js,jsx}',
      ],
      exclude: [
        'src/tests/**',
        'src/**/*.test.{js,jsx}',
        'src/**/*.spec.{js,jsx}',
        'src/data/mockAudits.js',
        'src/main.jsx',
      ],
      // ISO 9001:2015 punto 9.1.3 - Coverage thresholds
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
    
    // Global test configuration
    globals: true,
    
    // Test file patterns (tutti sotto src/, inclusi test integrazione con mock in src/tests/integration/)
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    
    // Enable JSX in test files
    esbuild: {
      jsxInject: `import React from 'react'`,
    },
    
    // Timeout for slow tests (e.g., Word export)
    testTimeout: 10000,
    
    // Parallel execution (faster CI)
    pool: 'threads',
    
    // Mock reset between tests
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,
  },
});
