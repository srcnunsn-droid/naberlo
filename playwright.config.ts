import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 40000,
  use: {
    baseURL: 'http://127.0.0.1:4179',
    headless: true,
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
      args: ['--no-sandbox'],
    },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm start',
    url: 'http://127.0.0.1:4179/api/health',
    reuseExistingServer: false,
    env: {
      PORT: '4179',
      HOST: '127.0.0.1',
      STADIUM_DATA_DIR: '/tmp/naberlo-e2e-data',
      STADIUM_OPENAI_API_KEY: '',
      OPENAI_API_KEY: '',
      STADIUM_ACCESS_TOKEN: '',
    },
    timeout: 30000,
  },
  reporter: [['list'], ['html', { open: 'never' }]],
});
