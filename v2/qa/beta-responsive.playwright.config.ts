import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  testDir: '.', testMatch: 'beta-responsive.browser.spec.ts', workers: 1,
  use: { baseURL: 'http://127.0.0.1:4175', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 900 } } },
    { name: 'tablet', use: { viewport: { width: 820, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 320, height: 844 } } },
  ],
  webServer: { cwd: fileURLToPath(new URL('..', import.meta.url)), command: 'node node_modules/vite/bin/vite.js --config qa/beta-responsive-vite.config.ts', url: 'http://127.0.0.1:4175/qa/beta-responsive.html', reuseExistingServer: process.env.RACEVORA_REUSE_QA_SERVER === '1' },
});
