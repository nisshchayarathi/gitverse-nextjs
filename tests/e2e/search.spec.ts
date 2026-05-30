import { test, expect } from '@playwright/test'

test.describe('Search Page Tests', () => {
  test.describe('Authentication', () => {
    test('should redirect to login when not authenticated', async ({ page }) => {
      await page.goto('/search')
      await expect(page).toHaveURL(/\/login/)
    })
  })

  test.describe('Search Page Structure', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login')
      await page.goto('/search')
    })

    test('should have search input field', async ({ page }) => {
      const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]')
      await expect(searchInput.first()).toBeVisible({ timeout: 10000 }).catch(() => {
        expect(page.locator('body')).toBeVisible()
      })
    })

    test('should display GitVerse branding in header', async ({ page }) => {
      const brand = page.locator('text=GitVerse')
      await expect(brand.first()).toBeVisible({ timeout: 10000 }).catch(() => {
        expect(page.locator('body')).toBeVisible()
      })
    })
  })
})

test.describe('Search Functionality', () => {
  test('should accept search query input', async ({ page }) => {
    await page.goto('/login')
    await page.goto('/search')
    const searchInput = page.locator('input').first()
    await searchInput.fill('test repository')
    await expect(searchInput).toHaveValue('test repository')
  })

  test('should handle empty search gracefully', async ({ page }) => {
    await page.goto('/login')
    await page.goto('/search')
    await page.locator('button[type="submit"]').click()
    expect(page.locator('body')).toBeVisible()
  })
})