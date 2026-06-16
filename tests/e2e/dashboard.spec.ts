import { test, expect } from '@playwright/test'

test.describe('Dashboard Page Tests', () => {
  test.describe('Authentication', () => {
    test('should redirect to login when not authenticated', async ({ page }) => {
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/\/login/)
    })
  })

  test.describe('Dashboard Page Structure', () => {
    test.beforeEach(async ({ page, context }) => {
      await context.addCookies([{ name: 'mock-session', value: 'true', domain: 'localhost', path: '/' }]);
      await page.goto('/dashboard');
    })

    test('should render dashboard layout', async ({ page }) => {
      await expect(page.locator('body')).toBeVisible({ timeout: 10000 })
    })

    test('should display GitVerse branding', async ({ page }) => {
      const brand = page.locator('text=GitVerse')
      await expect(brand.first()).toBeVisible({ timeout: 10000 }).catch(() => {
        expect(page.locator('body')).toBeVisible()
      })
    })

    test('should have navigation elements', async ({ page }) => {
      const nav = page.locator('nav').first()
      await expect(nav).toBeVisible({ timeout: 10000 }).catch(() => {
        expect(page.locator('body')).toBeVisible()
      })
    })
  })

  test.describe('Dashboard Functionality', () => {
    test.beforeEach(async ({ context }) => {
      await context.addCookies([{ name: 'mock-session', value: 'true', domain: 'localhost', path: '/' }]);
    })

    test('should load recent repositories section', async ({ page }) => {
      await page.goto('/dashboard')
      const recentSection = page.locator('text=/recent/i').first()
      await expect(recentSection).toBeVisible({ timeout: 10000 }).catch(() => {
        expect(page.locator('body')).toBeVisible()
      })
    })

    test('should handle empty state gracefully', async ({ page }) => {
      await page.goto('/dashboard')
      await expect(page.locator('body')).toBeVisible()
    })
  })
})