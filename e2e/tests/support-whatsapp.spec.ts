import { test, expect, type Page } from '@playwright/test'
import { setupApiMocks } from '../fixtures/api-mocks'
import { StaffRole, createMockUser, createAuthStatusResponse, createMockVenue } from '../fixtures/mock-data'

test.beforeEach(async ({ context, page }) => {
  await context.route(/^https?:\/\//, route => {
    const url = new URL(route.request().url())
    return ['127.0.0.1', 'localhost'].includes(url.hostname) ? route.continue() : route.abort()
  })
  await page.addInitScript(() => {
    localStorage.setItem('lang', 'es')
    localStorage.setItem('avoqado_session_hint', 'true')
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style')
      style.textContent = '.tsqd-parent-container { display: none !important; }'
      document.head.appendChild(style)
    })
  })
})
const DATA_VENUE = { id: 'c123456789012345678901235', name: 'Flautas Coyoacán', organizationId: 'org-fixture' }
/** `withData`: already linked, with data on WhatsApp switched on. Returns the bodies of the permission POSTs. */
async function supportApi(page: Page, enabled = true, withData = false) {
  let linked = withData
  let unlocked = false
  const grants: unknown[] = []
  await page.route('**/api/v1/me/support-whatsapp/**', async route => {
    expect(route.request().headers()['x-support-staff-id']).toBeTruthy()
    const action = new URL(route.request().url()).pathname.split('/').pop()
    if (action === 'verify') linked = true
    if (action === 'unlink') linked = false
    if (action === 'data-access' && route.request().method() === 'POST') {
      grants.push(route.request().postDataJSON())
      unlocked = true
    }
    const data =
      action === 'status'
        ? { enabled, linked, phone: linked ? '***2222' : null, expiresAt: null, dataEnabled: withData }
        : action === 'challenge'
          ? { challengeId: 'c123456789012345678901234', expiresAt: new Date(Date.now() + 600000).toISOString() }
          : action === 'venues'
            ? { items: [DATA_VENUE], total: 1, nextCursor: null }
            : action === 'data-access'
              ? { accepted: unlocked, unlocked, venueName: DATA_VENUE.name, notice: { text: 'AVISO DE PRUEBA', hash: 'a'.repeat(64) } }
              : { linked }
    await route.fulfill({ json: data })
  })
  return grants
}
for (const whiteLabel of [false, true])
  test(`profile entry preserves its ${whiteLabel ? 'WL' : 'regular'} return path`, async ({ page }) => {
    const venue = createMockVenue({
      slug: 'support-fixture',
      modules: whiteLabel ? [{ module: { id: 'wl-fixture', code: 'WHITE_LABEL_DASHBOARD', name: 'White label' }, enabled: true }] : [],
    })
    await setupApiMocks(page, { userRole: StaffRole.VIEWER, venues: [venue] })
    await page.route('**/api/v1/me/access*', route =>
      route.fulfill({
        json: {
          userId: 'user-001',
          venueId: venue.id,
          organizationId: venue.organizationId,
          role: StaffRole.VIEWER,
          corePermissions: ['settings:read'],
          whiteLabelEnabled: whiteLabel,
          enabledFeatures: [],
          featureAccess: {},
        },
      }),
    )
    await supportApi(page)
    const profile = `${whiteLabel ? '/wl' : ''}/venues/${venue.slug}/settings/profile`
    await page.goto(profile)
    await page.locator('[data-tour="settings-profile-support-whatsapp"]').click()
    await expect(page).toHaveURL(/\/support\/whatsapp$/)
    await expect(page.getByRole('link', { name: 'Volver a mi perfil' })).toHaveAttribute('href', profile)
    await expect(page.getByRole('button', { name: 'Pedir código' })).toBeVisible()
  })
test('with support off, the profile does not show the support entry', async ({ page }) => {
  const venue = createMockVenue({ slug: 'support-fixture' })
  await setupApiMocks(page, { userRole: StaffRole.VIEWER, venues: [venue] })
  await supportApi(page, false)
  await page.goto(`/venues/${venue.slug}/settings/profile`)
  await expect(page.getByRole('heading').first()).toBeVisible()
  await expect(page.locator('[data-tour="settings-profile-support-whatsapp"]')).toHaveCount(0)
})
for (const role of [StaffRole.VIEWER, StaffRole.WAITER, StaffRole.MANAGER, StaffRole.OWNER]) {
  for (const venueCount of [0, 1]) {
    test(`${role} remains on personal support with ${venueCount} venues`, async ({ page }) => {
      await setupApiMocks(page, { userRole: role, venueCount })
      await supportApi(page)
      await page.goto('/support/whatsapp')
      await expect(page.getByRole('button', { name: 'Pedir código' })).toBeVisible()
      await expect(page).toHaveURL(/\/support\/whatsapp$/)
      await expect(page.getByText('Si el teléfono es compartido', { exact: false })).toBeVisible()
    })
  }
}
test('login returns to support without a venue and sends only the fixed support purpose', async ({ page }) => {
  await setupApiMocks(page, { userRole: StaffRole.VIEWER, venueCount: 0 })
  await supportApi(page)
  let authenticated = false
  const user = createMockUser(StaffRole.VIEWER, [])
  await page.route('**/api/v1/dashboard/auth/status', route =>
    route.fulfill({ json: authenticated ? createAuthStatusResponse(user) : { authenticated: false, user: null } }),
  )
  await page.route('**/api/v1/dashboard/auth/login', async route => {
    expect(route.request().postDataJSON()).toMatchObject({ purpose: 'support-whatsapp' })
    authenticated = true
    await route.fulfill({ json: { staff: user } })
  })
  await page.goto('/support/whatsapp')
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fsupport%2Fwhatsapp/)
  await page.locator('input[type="email"]').fill('support-fixture@test.local')
  await page.locator('input[type="password"]').fill('fixture-not-a-real-password')
  await page.locator('button[type="submit"]').click()
  await expect(page.getByRole('button', { name: 'Pedir código' })).toBeVisible()
  await expect(page).toHaveURL(/\/support\/whatsapp$/)
})
test('link and unlink update the displayed state without a reload', async ({ page }) => {
  await setupApiMocks(page, { userRole: StaffRole.VIEWER, venueCount: 0 })
  await supportApi(page)
  await page.goto('/support/whatsapp')
  await page.getByLabel('Tu WhatsApp personal').fill('5511112222')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Pedir código' }).click()
  await page.getByLabel('Código de seis dígitos').fill('123456')
  await page.getByRole('button', { name: 'Confirmar código' }).click()
  await expect(page.getByText('***2222', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Desvincular WhatsApp' }).click()
  await page.getByRole('button', { name: 'Sí, desvincular' }).click()
  await expect(page.getByRole('button', { name: 'Pedir código' })).toBeVisible()
  await expect(page.getByText('***2222', { exact: true })).toHaveCount(0)
})
test('two immediate clicks send once, show loading and preserve the form and operation after rejection', async ({ page }) => {
  await setupApiMocks(page, { userRole: StaffRole.VIEWER, venueCount: 0 })
  await supportApi(page)
  const bodies: Array<{ phone: string; operationKey: string }> = []
  let release!: () => void
  const held = new Promise<void>(resolve => {
    release = resolve
  })
  await page.route('**/api/v1/me/support-whatsapp/challenge', async route => {
    bodies.push(route.request().postDataJSON())
    if (bodies.length === 1) {
      await held
      await route.fulfill({ status: 400, json: { message: 'Primero envía AYUDA desde este número.' } })
    } else
      await route.fulfill({ json: { challengeId: 'c123456789012345678901234', expiresAt: new Date(Date.now() + 600000).toISOString() } })
  })
  await page.goto('/support/whatsapp')
  await page.getByRole('button', { name: 'Pedir código' }).click()
  await expect(page.getByText('Escribe un teléfono válido con lada.')).toBeVisible()
  await page.getByLabel('Tu WhatsApp personal').fill('5511112222')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Pedir código' }).evaluate(button => {
    ;(button as HTMLButtonElement).click()
    ;(button as HTMLButtonElement).click()
  })
  await expect(page.getByRole('button', { name: 'Procesando…' })).toBeDisabled()
  expect(bodies).toHaveLength(1)
  release()
  await expect(page.getByRole('alert')).toContainText('Primero envía AYUDA desde este número.')
  expect((await page.getByLabel('Tu WhatsApp personal').inputValue()).replace(/\D/g, '')).toContain('5511112222')
  await expect(page.getByRole('checkbox')).toBeChecked()
  await page.getByRole('button', { name: 'Pedir código' }).click()
  await expect(page.getByLabel('Código de seis dígitos')).toBeVisible()
  expect(bodies).toHaveLength(2)
  expect(bodies[1]).toEqual(bodies[0])
})
test('linked user unlocks data for today', async ({ page }) => {
  await setupApiMocks(page, { userRole: StaffRole.VIEWER, venueCount: 0 })
  const grants = await supportApi(page, true, true)
  await page.goto('/support/whatsapp')
  await expect(page.getByText('Hoy todavía no.')).toBeVisible()
  await expect(page.getByLabel('Sucursal')).toHaveValue(DATA_VENUE.id)
  await page.getByRole('button', { name: 'Consultar datos por WhatsApp hoy' }).click()
  await expect(page.getByText('AVISO DE PRUEBA')).toBeVisible()
  expect(grants).toHaveLength(0)
  await page.getByRole('button', { name: 'Aceptar y consultar hoy' }).click()
  await expect(page.getByText('Hoy el asistente puede darte datos de Flautas Coyoacán hasta las 23:59.')).toBeVisible()
  expect(grants).toEqual([{ venueId: DATA_VENUE.id, noticeHash: 'a'.repeat(64), language: 'es', acceptNotice: true }])
})
for (const width of [375, 768, 1280])
  for (const theme of ['light', 'dark']) {
    test(`support at ${width}px ${theme} has no overflow and a visible disabled state`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 })
      await page.addInitScript(value => localStorage.setItem('vite-ui-theme', value), theme)
      await setupApiMocks(page, { venueCount: 0 })
      await supportApi(page, false)
      await page.goto('/support/whatsapp')
      await expect(page.getByText('El soporte por WhatsApp todavía no está activado.')).toBeVisible()
      if (theme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/)
      else await expect(page.locator('html')).not.toHaveClass(/dark/)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await expect(page.getByRole('link', { name: 'Consultar guías' })).toBeVisible()
      await page.screenshot({ path: info.outputPath(`support-${width}-${theme}.png`), fullPage: true })
    })
  }
test('a stored session hint cannot show the form before authenticated status is confirmed', async ({ page }) => {
  await setupApiMocks(page, { venueCount: 0 })
  await supportApi(page)
  let release!: () => void
  const held = new Promise<void>(resolve => {
    release = resolve
  })
  await page.route('**/api/v1/dashboard/auth/status', async route => {
    await held
    await route.fulfill({ json: { authenticated: false, user: null } })
  })
  await page.goto('/support/whatsapp')
  await expect(page.getByRole('button', { name: 'Pedir código' })).toHaveCount(0)
  release()
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fsupport%2Fwhatsapp/)
})
