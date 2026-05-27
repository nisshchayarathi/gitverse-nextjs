import { test, expect } from '@playwright/test'

test.describe('Navigation Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the main home page
    await page.goto('/')
  })

  test('should render the landing page with branding logo', async ({ page }) => {
    // Verify core brand logo exists
    const brandLogo = page.locator('text=GitVerse')
    await expect(brandLogo.first()).toBeVisible()
  })

  test('should verify navbar anchors exist', async ({ page }) => {
    // Verify features link is present
    const featuresAnchor = page.locator('a[href="#features"]')
    await expect(featuresAnchor.first()).toBeVisible()

    // Verify pricing link is present
    const pricingAnchor = page.locator('a[href="#pricing"]')
    await expect(pricingAnchor.first()).toBeVisible()
  })
})
