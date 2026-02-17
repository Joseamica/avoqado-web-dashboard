import { test, expect, type Page } from '@playwright/test'
import {
  StaffRole,
  createMockVenue,
  createMockUser,
  createAuthStatusResponse,
  VENUE_ALPHA,
  VENUE_BETA,
} from '../../fixtures/mock-data'

// ─── Helpers ────────────────────────────────────────────────────

/** Close TanStack Query DevTools if open, then hide via CSS as fallback */
async function closeTanStackDevTools(page: Page) {
  // Try the close button by aria-label
  const closeBtn = page.locator('button[aria-label="Close tanstack query devtools"]')
  if (await closeBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await closeBtn.click()
    await page.waitForTimeout(300)
  }
  // Always hide the devtools container via CSS as a fallback
  await page.evaluate(() => {
    document.querySelectorAll('.tsqd-parent-container').forEach((el) => {
      ;(el as HTMLElement).style.display = 'none'
    })
  })
}

/**
 * Set up unauthenticated mocks for login page.
 * Auth status returns false initially, and switches to authenticated
 * after a successful login POST.
 */
async function setupLoginMocks(page: Page, options: {
  userRole?: StaffRole
  venues?: Array<{ id: string; name: string; slug: string }>
} = {}) {
  const { userRole = StaffRole.OWNER } = options
  let isAuthenticated = false

  const venues = (options.venues ?? [VENUE_ALPHA, VENUE_BETA]).map((v) => ({
    ...createMockVenue(v),
    role: userRole,
  }))
  const user = createMockUser(userRole, venues)
  const authResponse = createAuthStatusResponse(user)

  // Catch-all first (lowest LIFO priority)
  await page.route('**/api/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    }),
  )

  // White-label config
  await page.route('**/api/v1/dashboard/venues/*/white-label*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ enabled: false, features: [] }),
    }),
  )

  // User access
  await page.route('**/api/v1/me/access*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        userId: user.id,
        venueId: venues[0]?.id,
        organizationId: venues[0]?.organizationId,
        role: userRole,
        corePermissions: venues[0]?.permissions ?? [],
        whiteLabelEnabled: false,
        enabledFeatures: [],
        featureAccess: {},
      }),
    }),
  )

  // Auth status → dynamic based on login state
  await page.route('**/api/v1/dashboard/auth/status', (route) => {
    if (isAuthenticated) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(authResponse),
      })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ authenticated: false, user: null }),
    })
  })

  return {
    /** Mock successful login POST */
    mockLoginSuccess: async () => {
      await page.route('**/api/v1/dashboard/auth/login', (route) => {
        if (route.request().method() === 'POST') {
          isAuthenticated = true
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              message: 'Login successful',
              staff: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                emailVerified: true,
                photoUrl: null,
                venues: venues.map((v) => ({ id: v.id, name: v.name, slug: v.slug })),
              },
            }),
          })
        }
        return route.continue()
      })
    },

    /** Mock login with invalid credentials */
    mockLoginInvalidCredentials: async () => {
      await page.route('**/api/v1/dashboard/auth/login', (route) => {
        if (route.request().method() === 'POST') {
          return route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Invalid email or password' }),
          })
        }
        return route.continue()
      })
    },

    /** Mock login with unverified email */
    mockLoginEmailNotVerified: async () => {
      await page.route('**/api/v1/dashboard/auth/login', (route) => {
        if (route.request().method() === 'POST') {
          return route.fulfill({
            status: 403,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Email not verified. Please verify your email.' }),
          })
        }
        return route.continue()
      })
    },

    /** Mock login with locked account */
    mockLoginAccountLocked: async () => {
      await page.route('**/api/v1/dashboard/auth/login', (route) => {
        if (route.request().method() === 'POST') {
          return route.fulfill({
            status: 403,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Account locked. Try again in 15 minutes.' }),
          })
        }
        return route.continue()
      })
    },

    /** Mock server error */
    mockLoginServerError: async () => {
      await page.route('**/api/v1/dashboard/auth/login', (route) => {
        if (route.request().method() === 'POST') {
          return route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Internal server error' }),
          })
        }
        return route.continue()
      })
    },

    user,
    venues,
  }
}

/** Navigate to login and dismiss devtools */
async function gotoLogin(page: Page, searchParams = '') {
  await page.goto(`/login${searchParams}`)
  await page.locator('#email').waitFor({ state: 'visible', timeout: 10_000 })
  await closeTanStackDevTools(page)
}

// ─── Tests: Login Page ──────────────────────────────────────────

test.describe('Login Page', () => {
  test('renders login form with all expected elements', async ({ page }) => {
    await setupLoginMocks(page)
    await gotoLogin(page)

    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
    await expect(page.locator('#rememberMe')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
    await expect(page.getByRole('link', { name: /olvidaste.*contraseña|forgot.*password/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /google/i })).toBeVisible()
  })

  test('shows validation error for empty email on submit', async ({ page }) => {
    await setupLoginMocks(page)
    await gotoLogin(page)

    // Clear email field and fill only password
    await page.locator('#email').clear()
    await page.fill('#password', 'somepassword')
    await page.locator('button[type="submit"]').click()

    await expect(page.locator('#email-error')).toBeVisible()
  })

  test('prevents submission with invalid email format', async ({ page }) => {
    await setupLoginMocks(page)
    await gotoLogin(page)

    await page.locator('#email').clear()
    await page.fill('#email', 'not-an-email')
    await page.fill('#password', 'somepassword')
    await page.locator('button[type="submit"]').click()

    // Browser native email validation prevents form submission
    // We stay on the login page
    await page.waitForTimeout(500)
    expect(page.url()).toContain('/login')
  })

  test('shows validation error for empty password', async ({ page }) => {
    await setupLoginMocks(page)
    await gotoLogin(page)

    await page.locator('#email').clear()
    await page.fill('#email', 'test@example.com')
    await page.locator('#password').clear()
    await page.locator('button[type="submit"]').click()

    await expect(page.locator('#password-error')).toBeVisible()
  })

  test('successful login navigates to venue dashboard', async ({ page }) => {
    const { mockLoginSuccess } = await setupLoginMocks(page)
    await mockLoginSuccess()
    await gotoLogin(page)

    await page.locator('#email').clear()
    await page.fill('#email', 'owner@test.com')
    await page.fill('#password', 'ValidPass123')
    await page.locator('button[type="submit"]').click()

    // Should navigate away from /login to a venue dashboard
    await page.waitForURL(/\/(venues|superadmin|setup)/, { timeout: 15_000 })
    expect(page.url()).not.toContain('/login')
  })

  test('successful superadmin login navigates to /superadmin', async ({ page }) => {
    const { mockLoginSuccess } = await setupLoginMocks(page, {
      userRole: StaffRole.SUPERADMIN,
    })
    await mockLoginSuccess()
    await gotoLogin(page)

    await page.locator('#email').clear()
    await page.fill('#email', 'super@admin.com')
    await page.fill('#password', 'SuperPass123')
    await page.locator('button[type="submit"]').click()

    await page.waitForURL('**/superadmin**', { timeout: 15_000 })
    expect(page.url()).toContain('/superadmin')
  })

  test('login sends correct POST body', async ({ page }) => {
    let capturedBody: Record<string, unknown> | null = null

    const mocks = await setupLoginMocks(page)
    await page.route('**/api/v1/dashboard/auth/login', async (route) => {
      if (route.request().method() === 'POST') {
        capturedBody = route.request().postDataJSON()
        // Fulfill as success so the test completes
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Login successful',
            staff: {
              id: mocks.user.id,
              email: 'test@example.com',
              firstName: 'Test',
              lastName: 'User',
              emailVerified: true,
              photoUrl: null,
              venues: [],
            },
          }),
        })
      }
      return route.continue()
    })
    await gotoLogin(page)

    await page.locator('#email').clear()
    await page.fill('#email', 'test@example.com')
    await page.fill('#password', 'MyPassword123')

    // Check remember me
    await page.locator('#rememberMe').click()
    await page.locator('button[type="submit"]').click()

    // Wait for the request to fire
    await page.waitForTimeout(2_000)

    expect(capturedBody).not.toBeNull()
    expect(capturedBody!.email).toBe('test@example.com')
    expect(capturedBody!.password).toBe('MyPassword123')
    expect(capturedBody!.rememberMe).toBe(true)
  })

  test('shows inline error for invalid credentials', async ({ page }) => {
    const { mockLoginInvalidCredentials } = await setupLoginMocks(page)
    await mockLoginInvalidCredentials()
    await gotoLogin(page)

    await page.locator('#email').clear()
    await page.fill('#email', 'wrong@test.com')
    await page.fill('#password', 'wrongpassword')
    await page.locator('button[type="submit"]').click()

    // Login errors show as inline alert, not toast
    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 5_000 })
    expect(page.url()).toContain('/login')
  })

  test('redirects to verify-email when email not verified', async ({ page }) => {
    const { mockLoginEmailNotVerified } = await setupLoginMocks(page)
    await mockLoginEmailNotVerified()
    await gotoLogin(page)

    await page.locator('#email').clear()
    await page.fill('#email', 'unverified@test.com')
    await page.fill('#password', 'ValidPass123')
    await page.locator('button[type="submit"]').click()

    // Should redirect to verify-email
    await page.waitForURL('**/auth/verify-email**', { timeout: 10_000 })
    expect(page.url()).toContain('/auth/verify-email')
  })

  test('shows inline error for locked account', async ({ page }) => {
    const { mockLoginAccountLocked } = await setupLoginMocks(page)
    await mockLoginAccountLocked()
    await gotoLogin(page)

    await page.locator('#email').clear()
    await page.fill('#email', 'locked@test.com')
    await page.fill('#password', 'ValidPass123')
    await page.locator('button[type="submit"]').click()

    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText(/locked|bloqueada/i)).toBeVisible()
    expect(page.url()).toContain('/login')
  })

  test('shows error on server failure', async ({ page }) => {
    const { mockLoginServerError } = await setupLoginMocks(page)
    await mockLoginServerError()
    await gotoLogin(page)

    await page.locator('#email').clear()
    await page.fill('#email', 'test@test.com')
    await page.fill('#password', 'ValidPass123')
    await page.locator('button[type="submit"]').click()

    // Should show some error and stay on login page
    await page.waitForTimeout(2_000)
    expect(page.url()).toContain('/login')
  })

  test('password visibility toggle works', async ({ page }) => {
    await setupLoginMocks(page)
    await gotoLogin(page)

    const passwordInput = page.locator('#password')
    // The toggle button is next to the password input — find it by proximity
    const toggleBtn = page.locator('#password ~ button, #password + button').first()

    // Fallback: try by accessible name (bilingual)
    const toggleByName = page.getByRole('button', { name: /mostrar|show|ocultar|hide/i })
    const btn = await toggleBtn.isVisible().catch(() => false) ? toggleBtn : toggleByName

    // Initially type=password
    await expect(passwordInput).toHaveAttribute('type', 'password')

    // Click toggle → type=text
    await btn.click()
    await expect(passwordInput).toHaveAttribute('type', 'text')

    // Click again → type=password
    await btn.click()
    await expect(passwordInput).toHaveAttribute('type', 'password')
  })

  test('forgot password link navigates to /auth/forgot-password', async ({ page }) => {
    await setupLoginMocks(page)
    await gotoLogin(page)

    const forgotLink = page.getByRole('link', { name: /olvidaste.*contraseña|forgot.*password/i })
    await expect(forgotLink).toHaveAttribute('href', '/auth/forgot-password')
  })

  test('shows success toast when ?verified=true', async ({ page }) => {
    await setupLoginMocks(page)
    await gotoLogin(page, '?verified=true')

    // A success toast should appear with "verified" text
    await expect(
      page.getByText(/verificado|verified/i).first(),
    ).toBeVisible({ timeout: 5_000 })
  })

  test('respects returnTo param after successful login', async ({ page }) => {
    const { mockLoginSuccess } = await setupLoginMocks(page)
    await mockLoginSuccess()
    await gotoLogin(page, '?returnTo=/venues/my-venue/settings')

    await page.locator('#email').clear()
    await page.fill('#email', 'owner@test.com')
    await page.fill('#password', 'ValidPass123')
    await page.locator('button[type="submit"]').click()

    // Should navigate to the returnTo path
    await page.waitForURL('**/venues/my-venue/settings**', { timeout: 15_000 })
    expect(page.url()).toContain('/venues/my-venue/settings')
  })

  test('language switcher and theme toggle are visible', async ({ page }) => {
    await setupLoginMocks(page)
    await gotoLogin(page)

    await expect(page.getByRole('button', { name: /español|english/i }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /cambiar tema|toggle theme/i })).toBeVisible()
  })
})

// ─── Tests: Forgot Password ─────────────────────────────────────

test.describe('Forgot Password Page', () => {
  test.beforeEach(async ({ page }) => {
    // Minimal mocks for unauthenticated page
    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) }),
    )
    await page.route('**/api/v1/dashboard/auth/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ authenticated: false, user: null }),
      }),
    )
  })

  test('renders forgot password form', async ({ page }) => {
    await page.goto('/auth/forgot-password')
    await closeTanStackDevTools(page)

    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
    await expect(page.getByRole('link', { name: /volver.*login|back.*login/i })).toBeVisible()
  })

  test('shows validation error for empty email', async ({ page }) => {
    await page.goto('/auth/forgot-password')
    await page.locator('#email').waitFor({ state: 'visible', timeout: 10_000 })
    await closeTanStackDevTools(page)

    await page.locator('button[type="submit"]').click()

    await expect(page.locator('.text-destructive').first()).toBeVisible()
  })

  test('shows success state after sending reset email', async ({ page }) => {
    await page.route('**/api/v1/dashboard/auth/request-reset', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'Reset email sent' }),
        })
      }
      return route.continue()
    })

    await page.goto('/auth/forgot-password')
    await page.locator('#email').waitFor({ state: 'visible', timeout: 10_000 })
    await closeTanStackDevTools(page)

    await page.fill('#email', 'reset@example.com')
    await page.locator('button[type="submit"]').click()

    // Should show success state with the email
    await expect(page.getByText('reset@example.com')).toBeVisible({ timeout: 5_000 })
    // Back to login link should still be visible
    await expect(page.getByRole('link', { name: /volver.*login|back.*login/i })).toBeVisible()
  })

  test('back to login link navigates to /login', async ({ page }) => {
    await page.goto('/auth/forgot-password')
    await closeTanStackDevTools(page)

    const backLink = page.getByRole('link', { name: /volver.*login|back.*login/i })
    await expect(backLink).toHaveAttribute('href', '/login')
  })
})
