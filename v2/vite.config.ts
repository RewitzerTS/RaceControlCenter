import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
    target: 'es2022',
  },
  test: {
    // Bound jsdom memory/CPU on developer machines; retain every assertion.
    maxWorkers: 1,
    testTimeout: 20000,
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
});
