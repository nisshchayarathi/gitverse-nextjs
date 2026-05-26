import { test, expect } from '@playwright/test'

test.describe('Authentication Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the login page before each test
    await page.goto('/login')
  })

  test('should render the login form correctly', async ({ page }) => {
    // Verify the page title or core heading
    const heading = page.locator('h1, h2')
    await expect(heading.first()).toBeVisible()

    // Verify presence of critical login inputs
    const emailInput = page.locator('input[type="email"]')
    const passwordInput = page.locator('input[type="password"]')
    await expect(emailInput).toBeVisible()
    await expect(passwordInput).toBeVisible()

    // Verify presence of CTA actions
    const signInButton = page.locator('button[type="submit"]')
    await expect(signInButton).toBeVisible()
  })

  test('should navigate to the sign-up page', async ({ page }) => {
    // Locate the link to create a new account
    const signUpLink = page.locator('a[href="/signup"]')
    await expect(signUpLink).toBeVisible()
    
    // Click the signup link and assert navigation
    await signUpLink.click()
    await expect(page).toHaveURL(/\/signup/)
  })
})
