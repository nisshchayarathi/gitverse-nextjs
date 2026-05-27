import { defineConfig, devices } from '@playwright/test'

const isCI = !!process.env.CI

export default defineConfig({
  testDir: './tests/e2e',
  // Run sequentially locally - parallel mode causes browser context exhaustion
  // when one slow test blocks the shared timeout budget
  fullyParallel: isCI,
  forbidOnly: isCI,
  retries: isCI ? 2 : 1,
  workers: isCI ? 1 : 1,
  reporter: isCI ? 'github' : 'html',
  timeout: 90000,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    // Enforce desktop viewport so md:flex nav links are always visible
    viewport: { width: 1280, height: 720 },
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  projects: [
    // Always run Chromium (uses full Chrome binary, not headless-shell)
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Use the bundled chromium browser explicitly (avoids headless-shell path issues on Windows)
        browserName: 'chromium',
      },
    },
    // Firefox and WebKit only in CI where browsers are pre-installed with --with-deps
    ...(isCI
      ? [
          {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
          },
          {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
          },
        ]
      : []),
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !isCI,
    timeout: 120000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      // Provide safe fallbacks so the dev server starts without crashing in CI
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://ci:ci@localhost:5432/ci',
      JWT_SECRET: process.env.JWT_SECRET ?? 'ci-jwt-secret-placeholder',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? 'ci-nextauth-secret-placeholder',
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? 'http://localhost:3000',
      GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? 'ci-gemini-key-placeholder',
      NODE_ENV: 'development',
    },
  },
})

