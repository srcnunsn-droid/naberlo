import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/standalone',
  workers: 1,
  timeout: 60000,
  use: {
    headless: true,
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
      args: ['--no-sandbox'],
    },
    screenshot: 'only-on-failure',
  },
  reporter: 'list',
});
