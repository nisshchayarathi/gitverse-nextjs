import { test, expect } from '@playwright/test'

test.describe('Navigation Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the main home page
    await page.goto('/')
  })

  test('should render the landing page with branding logo', async ({ page }) => {
    // Verify core brand logo exists (text appears in navbar + page body)
    const brandLogo = page.locator('text=GitVerse')
    await expect(brandLogo.first()).toBeVisible()
  })

  test('should verify navbar anchors exist', async ({ page }) => {
    // Anchors are inside md:flex — ensure desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 })

    // Verify features anchor is present in the DOM and visible at desktop width
    const featuresAnchor = page.locator('a[href="#features"]')
    await expect(featuresAnchor.first()).toBeAttached()
    await expect(featuresAnchor.first()).toBeVisible()

    // Verify pricing anchor is present in the DOM and visible at desktop width
    const pricingAnchor = page.locator('a[href="#pricing"]')
    await expect(pricingAnchor.first()).toBeAttached()
    await expect(pricingAnchor.first()).toBeVisible()
  })
})
