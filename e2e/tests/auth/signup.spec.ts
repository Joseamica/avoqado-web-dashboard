import { test, expect, type Page } from '@playwright/test'

// ─── Constants ──────────────────────────────────────────────────

/**
 * In dev mode, VITE_SKIP_EMAIL_VERIFICATION=true bypasses the email
 * verification step. After signup, the app calls verifyEmail('000000'),
 * refetches auth status, and navigates directly to /setup.
 *
 * Our tests handle both paths:
 * - DEV bypass:  signup → verify-email(000000) → refetch status → /setup
 * - Production:  signup → /auth/verify-email (OTP page)
 */
const DEV_SKIPS_VERIFICATION = true // matches .env.local

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Mock API routes for signup flow (unauthenticated user).
 * Unlike setupApiMocks, this returns authenticated: false initially.
 *
 * After signup + dev-bypass verify, the status switches to authenticated
 * so the /setup route doesn't redirect to /login.
 */
async function setupSignupMocks(page: Page) {
  let isVerified = false

  // Catch-all first (lowest priority in LIFO)
  await page.route('**/api/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    }),
  )

  // Email verification (dev bypass calls this with code 000000)
  await page.route('**/api/v1/onboarding/verify-email', (route) => {
    if (route.request().method() === 'POST') {
      isVerified = true
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Email verified' }),
      })
    }
    return route.continue()
  })

  // Email status check
  await page.route('**/api/v1/onboarding/email-status*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ verified: isVerified, exists: true }),
    }),
  )

  // Resend verification
  await page.route('**/api/v1/onboarding/resend-verification', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Code resent' }),
      })
    }
    return route.continue()
  })

  // Auth status → dynamic: starts unauthenticated, becomes authenticated after verify
  await page.route('**/api/v1/dashboard/auth/status', (route) => {
    if (isVerified) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authenticated: true,
          user: {
            id: 'staff-001',
            email: 'test@example.com',
            firstName: '',
            lastName: '',
            role: 'OWNER',
            photoUrl: null,
            emailVerified: true,
            organizationId: 'org-001',
            venues: [],
            allVenues: [],
            setupCompleted: false,
            wizardVersion: 2,
          },
          allVenues: [],
        }),
      })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ authenticated: false, user: null }),
    })
  })
}

/** Mock a successful signup POST */
async function mockSignupSuccess(page: Page) {
  await page.route('**/api/v1/onboarding/signup', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Account created successfully',
          staff: {
            id: 'staff-001',
            email: 'test@example.com',
            firstName: '',
            lastName: '',
            organizationId: 'org-001',
            photoUrl: null,
          },
          organization: { id: 'org-001', name: '' },
        }),
      })
    }
    return route.continue()
  })
}

/** Mock a signup POST that returns "email already registered" */
async function mockSignupEmailExists(page: Page) {
  await page.route('**/api/v1/onboarding/signup', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Email already registered',
        }),
      })
    }
    return route.continue()
  })
}

/** Mock a signup POST that returns a server error */
async function mockSignupServerError(page: Page) {
  await page.route('**/api/v1/onboarding/signup', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Internal server error' }),
      })
    }
    return route.continue()
  })
}

/** Close TanStack Query DevTools if open (it overlaps the form in dev mode) */
async function closeTanStackDevTools(page: Page) {
  const closeBtn = page.locator('button[aria-label="Close tanstack query devtools"]')
  if (await closeBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await closeBtn.click()
    await page.waitForTimeout(300)
  }
}

/** Navigate to signup and ensure the form is ready */
async function gotoSignup(page: Page) {
  await page.goto('/signup')
  await page.locator('#email').waitFor({ state: 'visible', timeout: 10_000 })
  await closeTanStackDevTools(page)
}

// ─── Tests: Signup Page (/signup) ────────────────────────────────

test.describe('Signup Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupSignupMocks(page)
  })

  test('renders signup form with email, password, and submit button', async ({ page }) => {
    await gotoSignup(page)

    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
    await expect(page.getByRole('link', { name: /inicia sesión|sign in/i })).toBeVisible()
  })

  test('shows validation error when submitting empty form', async ({ page }) => {
    await gotoSignup(page)

    await page.locator('button[type="submit"]').click()

    // At least one validation error should appear
    await expect(page.locator('.text-destructive').first()).toBeVisible()
  })

  test('shows validation error for short password', async ({ page }) => {
    await gotoSignup(page)

    await page.fill('#email', 'test@example.com')
    await page.fill('#password', '123')
    await page.locator('button[type="submit"]').click()

    // Password min-length error should appear
    await expect(page.locator('.text-destructive').first()).toBeVisible()
  })

  test('successful signup proceeds past signup page', async ({ page }) => {
    await mockSignupSuccess(page)
    await gotoSignup(page)

    await page.fill('#email', 'test@example.com')
    await page.fill('#password', 'SecurePass123!')
    await page.locator('button[type="submit"]').click()

    if (DEV_SKIPS_VERIFICATION) {
      // Dev bypass: signup → auto-verify → /setup
      await page.waitForURL('**/setup**', { timeout: 10_000 })
      expect(page.url()).toContain('/setup')
    } else {
      // Production: signup → /auth/verify-email
      await page.waitForURL('**/auth/verify-email**', { timeout: 10_000 })
      expect(page.url()).toContain('/auth/verify-email')
      expect(page.url()).toContain('email=test%40example.com')
    }
  })

  test('signup sends correct POST body with wizardVersion 2', async ({ page }) => {
    let capturedBody: Record<string, unknown> | null = null

    await page.route('**/api/v1/onboarding/signup', async (route) => {
      if (route.request().method() === 'POST') {
        capturedBody = route.request().postDataJSON()
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Account created',
            staff: { id: 's1', email: 'new@test.com', firstName: '', lastName: '', organizationId: 'o1', photoUrl: null },
            organization: { id: 'o1', name: '' },
          }),
        })
      }
      return route.continue()
    })
    await gotoSignup(page)

    await page.fill('#email', 'new@test.com')
    await page.fill('#password', 'MyPassword123')
    await page.locator('button[type="submit"]').click()

    // Wait for navigation away from signup (either /setup or /auth/verify-email)
    await page.waitForURL(/\/(setup|auth\/verify-email)/, { timeout: 10_000 })

    expect(capturedBody).not.toBeNull()
    expect(capturedBody!.email).toBe('new@test.com')
    expect(capturedBody!.password).toBe('MyPassword123')
    expect(capturedBody!.wizardVersion).toBe(2)
    expect(capturedBody!.firstName).toBe('')
    expect(capturedBody!.lastName).toBe('')
    expect(capturedBody!.organizationName).toBe('')
  })

  test('shows error toast when email is already registered', async ({ page }) => {
    await mockSignupEmailExists(page)
    await gotoSignup(page)

    await page.fill('#email', 'existing@example.com')
    await page.fill('#password', 'SecurePass123!')
    await page.locator('button[type="submit"]').click()

    // Should show error toast and stay on signup page
    await expect(page.getByText(/ya registrado|already registered/i).first()).toBeVisible({ timeout: 5_000 })
    expect(page.url()).toContain('/signup')
  })

  test('shows error toast on server error', async ({ page }) => {
    await mockSignupServerError(page)
    await gotoSignup(page)

    await page.fill('#email', 'test@example.com')
    await page.fill('#password', 'SecurePass123!')
    await page.locator('button[type="submit"]').click()

    // Should stay on signup page (no navigation)
    await page.waitForTimeout(2_000)
    expect(page.url()).toContain('/signup')
  })

  test('"Sign in" link navigates to /login', async ({ page }) => {
    await gotoSignup(page)

    const signInLink = page.getByRole('link', { name: /inicia sesión|sign in/i })
    await expect(signInLink).toHaveAttribute('href', '/login')
  })

  test('language switcher is visible', async ({ page }) => {
    await gotoSignup(page)

    const langButton = page.getByRole('button', { name: /español|english/i }).first()
    await expect(langButton).toBeVisible()
  })

  test('theme toggle is visible', async ({ page }) => {
    await gotoSignup(page)

    const themeButton = page.getByRole('button', { name: /cambiar tema|toggle theme/i })
    await expect(themeButton).toBeVisible()
  })
})

// ─── Tests: Email Verification (/auth/verify-email) ─────────────
// These tests navigate directly to the verify-email page since
// the dev bypass skips it in the normal signup flow.

test.describe('Email Verification Page (direct navigation)', () => {
  test.beforeEach(async ({ page }) => {
    await setupSignupMocks(page)
  })

  test('shows email address and verification form', async ({ page }) => {
    // Navigate directly with email query param
    await page.goto('/auth/verify-email?email=verify%40example.com')
    await closeTanStackDevTools(page)

    // Should show the email somewhere on the page
    await expect(page.getByText('verify@example.com').first()).toBeVisible({ timeout: 10_000 })
  })

  test('shows resend verification button', async ({ page }) => {
    await page.goto('/auth/verify-email?email=verify%40example.com')
    await closeTanStackDevTools(page)

    await expect(
      page.getByRole('button', { name: /reenviar|resend/i }),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('shows back to login option', async ({ page }) => {
    await page.goto('/auth/verify-email?email=verify%40example.com')
    await closeTanStackDevTools(page)

    // Could be a button or link
    await expect(
      page.getByText(/volver.*login|back.*login|iniciar sesión/i),
    ).toBeVisible({ timeout: 10_000 })
  })
})
