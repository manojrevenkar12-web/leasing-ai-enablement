import { defineConfig, devices } from '@playwright/test';

// End to end against the real stack: the Laravel API on a freshly seeded SQLite database, and the
// production build of the web app (its /api rewrite points at the API, see next.config.ts).
const API = 'http://127.0.0.1:8000';
const WEB = 'http://127.0.0.1:3100';
const db = new URL('../api/database/e2e.sqlite', import.meta.url).pathname;

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: { baseURL: WEB, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1360, height: 900 } } },
    { name: 'phone', use: { ...devices['Pixel 7'] }, testMatch: /responsive/ },
  ],
  webServer: [
    {
      command: `touch ${db} && php artisan migrate:fresh --seed --force && php artisan serve --host 127.0.0.1 --port 8000`,
      cwd: '../api',
      url: `${API}/up`,
      env: { DB_CONNECTION: 'sqlite', DB_DATABASE: db, CACHE_STORE: 'array', TELEMETRY_LOG: '/dev/null' },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    { command: 'npx next start --port 3100', url: WEB, reuseExistingServer: false, timeout: 120_000, env: { NEXT_TELEMETRY_DISABLED: '1' } },
  ],
});
