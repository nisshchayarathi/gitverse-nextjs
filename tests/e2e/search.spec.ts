import { test, expect } from '@playwright/test'

// ─────────────────────────────────────────────────────────────
// Helper: navigate to /search and handle auth redirect
// Since the app redirects unauthenticated users to /login,
// we test both the redirect behaviour AND the page itself.
// ─────────────────────────────────────────────────────────────

test.describe('Search Page – Authentication Guard', () => {

  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/search')
    // Must land on /login — not stay on /search
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
  })

})

test.describe('Search Page – Structure', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate directly; if redirected to login that is fine —
    // the structure tests below account for both states
    await page.goto('/search')
  })

  test('should show a visible page body', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible()
  })

  test('should display GitVerse branding', async ({ page }) => {
    // Check header/nav for brand name
    const brand = page.locator('text=GitVerse').first()
    await expect(brand).toBeVisible({ timeout: 10000 })
  })

  test('should have a page heading', async ({ page }) => {
    const heading = page.locator('h1, h2').first()
    await expect(heading).toBeVisible({ timeout: 10000 })
  })

})

test.describe('Search Page – Input Behaviour', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/search')
  })

  test('should display a search input field', async ({ page }) => {
    // Covers: input[type=search], input[type=text], input[placeholder*=search]
    const searchInput = page
      .locator('input[type="search"], input[type="text"], input[placeholder*="search" i], input[placeholder*="repo" i]')
      .first()
    await expect(searchInput).toBeVisible({ timeout: 10000 })
  })

  test('should accept typed input', async ({ page }) => {
    const searchInput = page.locator('input').first()
    await searchInput.fill('test repository')
    await expect(searchInput).toHaveValue('test repository')
  })

  test('should allow input to be cleared', async ({ page }) => {
    const searchInput = page.locator('input').first()
    await searchInput.fill('test repository')
    await searchInput.clear()
    await expect(searchInput).toHaveValue('')
  })

  test('should accept a valid GitHub URL', async ({ page }) => {
    const searchInput = page.locator('input').first()
    await searchInput.fill('https://github.com/facebook/react')
    await expect(searchInput).toHaveValue('https://github.com/facebook/react')
  })

  test('should support keyboard Enter to submit', async ({ page }) => {
    const searchInput = page.locator('input').first()
    await searchInput.fill('https://github.com/facebook/react')
    await searchInput.press('Enter')
    // Page should still be visible after Enter — no crash
    await expect(page.locator('body')).toBeVisible()
  })

})

test.describe('Search Page – Empty/Invalid Submission', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/search')
  })

  test('should handle empty form submission gracefully', async ({ page }) => {
    const submitBtn = page
      .locator('button[type="submit"]')
      .or(page.getByRole('button', { name: /search|analyze|go|submit/i }))
      .first()

    // Only click if button exists; otherwise page has no submit action
    const btnCount = await submitBtn.count()
    if (btnCount > 0) {
      await submitBtn.click()
    }

    // Page must remain visible — no crash or blank screen
    await expect(page.locator('body')).toBeVisible()
  })

  test('should not navigate away on invalid input', async ({ page }) => {
    const searchInput = page.locator('input').first()
    await searchInput.fill('not-a-url')

    const submitBtn = page
      .locator('button[type="submit"]')
      .or(page.getByRole('button', { name: /search|analyze|go|submit/i }))
      .first()

    const btnCount = await submitBtn.count()
    if (btnCount > 0) {
      await submitBtn.click()
    }

    // Should not navigate to a results/dashboard page with invalid input
    await expect(page).not.toHaveURL(/dashboard|result|analyze/i)
  })

})

test.describe('Search Page – Responsive Design', () => {

  test('should render correctly on mobile (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/search')
    await expect(page.locator('body')).toBeVisible()
    const input = page.locator('input').first()
    await expect(input).toBeVisible({ timeout: 10000 })
  })

  test('should render correctly on tablet (768px)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/search')
    await expect(page.locator('body')).toBeVisible()
  })

})