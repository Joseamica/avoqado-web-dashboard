import { test, expect, type Page } from '@playwright/test'
import { StaffRole, createMockVenue, createMockUser, createAuthStatusResponse, VENUE_ALPHA } from '../../fixtures/mock-data'

// Regression: invitations with requirePin sent to an EXISTING account (user
// already has a password) must show a PIN field on the password-verification
// screen and include the PIN in the accept payload. Previously the screen only
// collected the password, so the backend rejected with 400
// "El PIN es requerido para esta invitación" and the flow dead-ended.

const TOKEN = 'cmr6pcyzt002hop2a4wtt2cgr'

/** Hide TanStack Query DevTools — its floating panel intercepts pointer events */
async function hideTanStackDevTools(page: Page) {
  await page.addStyleTag({ content: '.tsqd-parent-container { display: none !important; }' }).catch(() => {})
  await page.evaluate(() => {
    document.querySelectorAll('.tsqd-parent-container').forEach(el => {
      ;(el as HTMLElement).style.display = 'none'
    })
  })
}

function invitationResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: 'invitation-1',
    email: 'existing@avoqado.io',
    role: 'ADMIN',
    roleDisplayName: 'Administrador',
    organizationName: 'Dona Simona',
    venueName: 'Doña Simona',
    inviterName: 'Super Admin',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'PENDING',
    firstName: 'Jose',
    lastName: 'Amieva',
    userAlreadyHasPassword: true,
    existsInDifferentOrg: false,
    requirePin: false,
    ...overrides,
  }
}

async function setupInviteMocks(page: Page, options: { requirePin: boolean }) {
  let isAuthenticated = false
  let acceptBody: Record<string, unknown> | null = null

  const venue = { ...createMockVenue(VENUE_ALPHA), role: StaffRole.ADMIN }
  const user = createMockUser(StaffRole.ADMIN, [venue])
  const authResponse = createAuthStatusResponse(user)

  // Catch-all first (lowest LIFO priority)
  await page.route('**/api/v1/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) }),
  )

  await page.route('**/api/v1/dashboard/auth/status', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(isAuthenticated ? authResponse : { authenticated: false, user: null }),
    }),
  )

  await page.route(`**/api/v1/invitations/${TOKEN}`, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(invitationResponse({ requirePin: options.requirePin })),
    }),
  )

  await page.route(`**/api/v1/invitations/${TOKEN}/accept`, route => {
    acceptBody = route.request().postDataJSON()
    isAuthenticated = true
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Invitación aceptada' }),
    })
  })

  return { getAcceptBody: () => acceptBody }
}

test.describe('Invite accept — existing account with required PIN', () => {
  test('shows PIN field and sends pin in the accept payload when requirePin is true', async ({ page }) => {
    const mocks = await setupInviteMocks(page, { requirePin: true })

    await page.goto(`/invite/${TOKEN}`)

    // Existing-account verification screen loads
    const passwordInput = page.locator('#verify-password')
    await expect(passwordInput).toBeVisible()
    await hideTanStackDevTools(page)

    // PIN field must be present for requirePin invitations
    const pinInput = page.locator('#verify-pin')
    await expect(pinInput).toBeVisible()

    // Submit stays disabled until password AND a valid PIN are provided
    const submitButton = page.locator('button[type="submit"]')
    await passwordInput.fill('MyExistingPassword1')
    await expect(submitButton).toBeDisabled()

    await pinInput.fill('123') // too short → still disabled
    await expect(submitButton).toBeDisabled()

    await pinInput.fill('1234')
    await expect(submitButton).toBeEnabled()

    await submitButton.click()

    await expect.poll(() => mocks.getAcceptBody()).not.toBeNull()
    expect(mocks.getAcceptBody()).toMatchObject({
      password: 'MyExistingPassword1',
      pin: '1234',
    })
  })

  test('keeps the password-only flow when requirePin is false', async ({ page }) => {
    const mocks = await setupInviteMocks(page, { requirePin: false })

    await page.goto(`/invite/${TOKEN}`)

    const passwordInput = page.locator('#verify-password')
    await expect(passwordInput).toBeVisible()
    await hideTanStackDevTools(page)

    // No PIN field for invitations that don't require it
    await expect(page.locator('#verify-pin')).toHaveCount(0)

    await passwordInput.fill('MyExistingPassword1')
    const submitButton = page.locator('button[type="submit"]')
    await expect(submitButton).toBeEnabled()
    await submitButton.click()

    await expect.poll(() => mocks.getAcceptBody()).not.toBeNull()
    expect(mocks.getAcceptBody()).toMatchObject({
      password: 'MyExistingPassword1',
      pin: null,
    })
  })
})
