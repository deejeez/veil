import { test, expect } from '@playwright/test'

const TEST_PASSWORD = 'testpassword123'

function testEmail() {
  return `veil-test-${Date.now()}@example.com`
}

test.describe('Veil — auth and onboarding', () => {
  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL('/login', { timeout: 5000 })
  })

  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText('Veil')).toBeVisible()
    await expect(page.getByText('Sign in to your account')).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible()
  })

  test('signup page renders correctly', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.getByText('Veil')).toBeVisible()
    await expect(page.getByText('Plan your wedding, your way')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible()
  })

  test('sign up navigates to onboarding step 1', async ({ page }) => {
    await page.goto('/signup')
    await page.fill('input[type="email"]', testEmail())
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/onboarding/1', { timeout: 10000 })
    await expect(page.getByText('Step 1 of 3')).toBeVisible()
    await expect(page.getByText('The basics')).toBeVisible()
  })

  test('onboarding step 1 saves and navigates to paywall', async ({ page }) => {
    await page.goto('/signup')
    await page.fill('input[type="email"]', testEmail())
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL('/onboarding/1')

    await page.fill('input[type="date"]', '2027-06-15')
    await page.fill('input[placeholder="New York"]', 'Brooklyn')
    await page.fill('input[placeholder="NY"]', 'NY')
    await page.fill('input[placeholder="150000"]', '200000')
    await page.click('button[type="submit"]')

    await expect(page).toHaveURL('/paywall', { timeout: 8000 })
    await expect(page.getByText('$149')).toBeVisible()
    await expect(page.getByText('One-time. Yours forever.')).toBeVisible()
  })

  test('paywall shows pricing, CTA, and promo code notice', async ({ page }) => {
    await page.goto('/signup')
    await page.fill('input[type="email"]', testEmail())
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL('/onboarding/1')
    await page.goto('/paywall')

    await expect(page.getByText('$149')).toBeVisible()
    await expect(page.getByText('Get Started — $149')).toBeVisible()
    await expect(page.getByText('Have a promo code?')).toBeVisible()
  })
})
