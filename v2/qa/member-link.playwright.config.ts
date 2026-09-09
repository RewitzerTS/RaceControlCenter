import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  testDir: '.', testMatch: 'member-link.browser.spec.ts', workers: 1,
  use: { baseURL: 'http://127.0.0.1:4174' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 320, height: 844 } } },
  ],
  webServer: { cwd: fileURLToPath(new URL('..', import.meta.url)), command: 'node node_modules/vite/bin/vite.js --config qa/member-link-vite.config.ts', url: 'http://127.0.0.1:4174/qa/member-link.html', reuseExistingServer: false },
});
