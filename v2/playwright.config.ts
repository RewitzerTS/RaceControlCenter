import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  expect: { timeout: 25000 },
  workers: 2,
  retries: 0,
  reporter: 'list',
  use: { baseURL: process.env.RACEVORA_SMOKE_URL || 'http://127.0.0.1:8789', locale: 'de-DE', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1280, height: 900 } } },
    { name: 'mobile', use: { browserName: 'chromium', viewport: { width: 390, height: 844 } } },
  ],
  webServer: process.env.RACEVORA_SMOKE_URL ? undefined : {
    command: 'node node_modules/wrangler/bin/wrangler.js dev --local --config wrangler.jsonc --port 8789',
    url: 'http://127.0.0.1:8789/login',
    reuseExistingServer: false,
    timeout: 60000,
    env: { WRANGLER_LOG_PATH: '.wrangler/logs' },
  },
});
