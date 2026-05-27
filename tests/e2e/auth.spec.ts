import { test, expect } from '@playwright/test'

test.describe('Authentication Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the login page before each test
    await page.goto('/login')
    // Wait for DOM to be ready - do NOT use networkidle; Next.js dev keeps a
    // WebSocket hot-reload connection open which prevents networkidle from firing
    await page.waitForLoadState('domcontentloaded')
  })

  test('should render the login form correctly', async ({ page }) => {
    // Verify the page heading is visible
    const heading = page.locator('h1, h2')
    await expect(heading.first()).toBeVisible()

    // Verify presence of critical login inputs
    const emailInput = page.locator('input[type="email"]')
    const passwordInput = page.locator('input[type="password"]')
    await expect(emailInput).toBeVisible()
    await expect(passwordInput).toBeVisible()

    // Verify presence of submit button
    const signInButton = page.locator('button[type="submit"]')
    await expect(signInButton).toBeVisible()
  })

  test('should navigate to the sign-up page', async ({ page }) => {
    // The login page has a "Sign up" link with href="/signup"
    // Match by href to be resilient to text changes
    const signUpLink = page.locator('a[href="/signup"]')
    await expect(signUpLink.first()).toBeVisible()

    // Click the signup link and assert navigation
    await signUpLink.first().click()
    await expect(page).toHaveURL(/\/signup/)
  })
})
