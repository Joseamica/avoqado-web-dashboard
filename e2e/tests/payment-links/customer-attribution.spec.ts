import { expect, test, type Page } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { createMockVenue, StaffRole } from '../../fixtures/mock-data'

const venueId = 'c111111111111111111111111'
const alice = {
  id: 'c222222222222222222222222',
  firstName: 'Alicia',
  lastName: 'Prueba',
  email: 'alicia@example.test',
  phone: '+525512345678',
  active: true,
}
const bob = { ...alice, id: 'c333333333333333333333333', firstName: 'Bruno', email: 'bruno@example.test' }

async function fixture(page: Page, theme = 'light') {
  await page.addInitScript(value => {
    localStorage.setItem('lang', 'es')
    localStorage.setItem('vite-ui-theme', value)
  }, theme)
  await setupApiMocks(page, {
    userRole: StaffRole.OWNER,
    venues: [createMockVenue({ id: venueId, slug: 'links-test', name: 'Boutique de prueba', permissions: ['*:*'] })],
  })
  await page.route('**/api/v1/dashboard/venues/*/ecommerce-merchants*', route =>
    route.fulfill({
      json: {
        success: true,
        data: {
          merchants: [{ id: 'c444444444444444444444444', active: true, chargesEnabled: true, provider: { code: 'STRIPE_CONNECT' } }],
        },
      },
    }),
  )
  const state = {
    creates: 0,
    sends: 0,
    failSend: false,
    failSearch: false,
    links: [] as Record<string, unknown>[],
    keys: [] as string[],
    bodies: [] as Record<string, unknown>[],
    searches: [] as string[],
    customerCreates: 0,
  }
  await page.route('**/api/v1/dashboard/venues/*/payment-links**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname.endsWith('/settings')) return route.fulfill({ json: { success: true, data: {} } })
    if (url.pathname.endsWith('/share-whatsapp')) {
      state.sends++
      expect(request.postDataJSON()).toEqual({ phone: alice.phone })
      return route.fulfill({
        status: state.failSend && state.sends === 1 ? 503 : 200,
        json: state.failSend && state.sends === 1 ? { error: 'Provider unavailable' } : { success: true, data: { sent: true } },
      })
    }
    if (request.method() === 'POST') {
      state.creates++
      state.keys.push(request.headers()['idempotency-key'])
      state.bodies.push(request.postDataJSON())
      const link = {
        ...request.postDataJSON(),
        id: 'c555555555555555555555555',
        shortCode: 'test-link',
        venueId,
        customer: alice,
        status: 'ACTIVE',
        currency: 'MXN',
        paymentCount: 0,
        totalCollected: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      state.links.push(link)
      return route.fulfill({ json: { success: true, data: link } })
    }
    return route.fulfill({ json: { success: true, data: { paymentLinks: state.links, total: state.links.length } } })
  })
  await page.route('**/api/v1/dashboard/venues/*/customers?*', async route => {
    const url = new URL(route.request().url())
    expect(url.searchParams.get('pageSize')).toBe('20')
    const search = url.searchParams.get('search') || ''
    const currentPage = Number(url.searchParams.get('page') || 1)
    state.searches.push(search)
    if (state.failSearch) return route.fulfill({ status: 503, json: { error: 'Unavailable' } })
    const data = search ? [] : currentPage === 1 ? [alice] : [bob]
    return route.fulfill({
      json: {
        data,
        meta: {
          totalCount: search ? 0 : 21,
          currentPage,
          pageSize: 20,
          totalPages: search ? 0 : 2,
          hasNextPage: !search && currentPage === 1,
          hasPrevPage: currentPage > 1,
        },
      },
    })
  })
  await page.route('**/api/v1/dashboard/venues/*/customers', route => {
    state.customerCreates++
    return route.fulfill({ json: { message: 'Created', customer: { ...alice, ...route.request().postDataJSON() } } })
  })
  await page.goto('/venues/links-test/payment-links?new=1')
  await page.getByRole('button', { name: 'Aceptar un pago', exact: true }).click()
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await page.getByLabel('Título', { exact: true }).fill('Servicio de prueba')
  await page.getByLabel('Monto (MXN)', { exact: true }).fill('100')
  await expect(page.getByRole('button', { name: /Alicia Prueba/ })).toBeVisible()
  return state
}

for (const theme of ['light', 'dark']) {
  test(`customer selection survives pagination and search; create updates the list (${theme})`, async ({ page }) => {
    const state = await fixture(page, theme)
    await page.getByRole('button', { name: /Alicia Prueba/ }).click()
    await page.getByRole('button', { name: 'Siguiente', exact: true }).click()
    await expect(page.getByRole('button', { name: /Bruno/ })).toBeVisible()
    await expect(page.getByTestId('selected-customer')).toContainText('Alicia')
    const search = page.getByLabel('Buscar por nombre, correo o teléfono')
    await search.fill('no-coincide')
    await expect(page.getByText('No hay clientes que coincidan con tu búsqueda.')).toBeVisible()
    await expect(search).toBeFocused()
    await expect(search).toHaveValue('no-coincide')
    await expect(page.getByTestId('selected-customer')).toContainText('Alicia')
    await page.locator('[data-tour="payment-link-save"]').click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('row', { name: /Servicio de prueba/ })).toBeVisible()
    expect(state.creates).toBe(1)
    expect(state.keys[0]).toBeTruthy()
    expect(state.bodies[0].customerId).toBe(alice.id)
    expect(state.sends).toBe(0)
  })
}

test('send failure preserves the created link and retries only the send', async ({ page }) => {
  const state = await fixture(page)
  state.failSend = true
  await page.getByRole('button', { name: /Alicia Prueba/ }).click()
  await page.locator('[data-tour="payment-link-create-send"]').click()
  await expect(page.getByText(/La liga ya está creada/)).toBeVisible()
  expect(state.creates).toBe(1)
  await page.getByRole('button', { name: 'Reintentar envío', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('row', { name: /Servicio de prueba/ })).toBeVisible()
  expect(state.creates).toBe(1)
  expect(state.sends).toBe(2)
})

test('lookup failure differs from no matches and preserves search focus', async ({ page }) => {
  const state = await fixture(page)
  state.failSearch = true
  const search = page.getByLabel('Buscar por nombre, correo o teléfono')
  await search.fill('fallo')
  await expect(page.getByText('No se pudieron cargar los clientes. Revisa la conexión y reintenta.')).toBeVisible()
  await expect(search).toBeFocused()
  state.failSearch = false
  await search.fill('sin-coincidencias')
  await expect(page.getByText('No hay clientes que coincidan con tu búsqueda.')).toBeVisible()
  await expect(search).toBeFocused()
})

test('quick create never manufactures a destination from unknown prefixes or text', async ({ page }) => {
  const state = await fixture(page)
  await page.getByRole('button', { name: 'Nuevo cliente', exact: true }).click()
  const phone = page.getByLabel('Teléfono', { exact: true })
  for (const raw of ['+0445512345678', '+0455512345678', '+0525512345678', '+999123456789', '+52abc5512345678', '991234567890']) {
    await phone.fill(raw)
    await page.getByRole('button', { name: 'Guardar cliente', exact: true }).click()
    await expect(page.getByText(/Escribe un correo válido o un teléfono válido/)).toBeVisible()
    expect(state.customerCreates).toBe(0)
    await expect(page.locator('[data-tour="payment-link-create-send"]')).toHaveCount(0)
  }
  await phone.fill('525512345678')
  await expect(phone).toHaveValue('525512345678')
  await page.getByRole('button', { name: 'Guardar cliente', exact: true }).click()
  await expect(page.getByTestId('selected-customer')).toContainText('+525512345678')
  await page.locator('[data-tour="payment-link-create-send"]').click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(state.customerCreates).toBe(1)
  expect(state.creates).toBe(1)
  expect(state.sends).toBe(1)
})

test('typing and backspace preserve raw phone digits until the complete draft is validated', async ({ page }) => {
  const state = await fixture(page)
  await page.getByRole('button', { name: 'Nuevo cliente', exact: true }).click()
  const phone = page.getByLabel('Teléfono', { exact: true })
  await phone.pressSequentially('+52525512345678')
  await expect(phone).toHaveValue('+52525512345678')
  await page.getByRole('button', { name: 'Guardar cliente', exact: true }).click()
  await expect(page.getByText(/Escribe un correo válido o un teléfono válido/)).toBeVisible()
  expect(state.customerCreates).toBe(0)
  expect(state.sends).toBe(0)
  await phone.press('ControlOrMeta+A')
  await phone.press('ArrowRight')
  expect(await phone.evaluate((input: HTMLInputElement) => [input.selectionStart, input.selectionEnd])).toEqual([
    '+52525512345678'.length,
    '+52525512345678'.length,
  ])
  await phone.press('Backspace')
  await phone.press('Backspace')
  await expect(phone).toHaveValue('+525255123456')
  const request = page.waitForRequest(req => req.method() === 'POST' && req.url().endsWith('/customers'))
  await page.getByRole('button', { name: 'Guardar cliente', exact: true }).click()
  expect((await request).postDataJSON()).toEqual({ phone: '+525255123456' })
  await expect(page.getByTestId('selected-customer')).toContainText('+525255123456')
  expect(state.customerCreates).toBe(1)
})
