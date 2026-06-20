import { test, expect } from '@playwright/test'

test.describe('Repository Page Tests', () => {
  test.describe('Unauthenticated Access', () => {
    test('should redirect to login when accessing repo page without auth', async ({ page }) => {
      await page.goto('/repo/test-repo-123')
      await expect(page).toHaveURL(/\/login/)
    })
  })

  test.describe('Page Structure', () => {
    test.beforeEach(async ({ page, context }) => {
      await context.addCookies([{ name: 'mock-session', value: 'true', domain: 'localhost', path: '/' }]);
      await page.goto('/repo/test-repo-123');
    })

    test('should have navigation elements visible', async ({ page }) => {
      const nav = page.locator('nav')
      await expect(nav.first()).toBeVisible()
    })

    test('should render the GitVerse branding', async ({ page }) => {
      const brandLogo = page.locator('text=GitVerse')
      await expect(brandLogo.first()).toBeVisible()
    })
  })
})

test.describe('Repository URL Validation', () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([{ name: 'mock-session', value: 'true', domain: 'localhost', path: '/' }]);
  })

  test('should accept valid repo ID format', async ({ page }) => {
    const validIds = ['abc-123', 'my_repo', 'test-repo-456']
    for (const id of validIds) {
      await page.goto(`/repo/${id}`)
      await expect(page).not.toHaveURL(/error/)
    }
  })

  test('should handle special characters in repo names', async ({ page }) => {
    await page.goto('/repo/test-name_with-dashes')
    await expect(page).toHaveURL(/test-name_with-dashes/)
  })
})

test.describe('Page Meta Information', () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([{ name: 'mock-session', value: 'true', domain: 'localhost', path: '/' }]);
  })

  test('should set correct page title for repo page', async ({ page }) => {
    await page.goto('/repo/my-test-repo')
    await expect(page).toHaveTitle(/My Test Repo/)
  })
})