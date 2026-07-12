/**
 * E2E tests for the consolidated modifier-group editor.
 *
 * UX: clicking a group row (or "Editar grupo" in the row menu) opens ONE
 * full-screen editor with three sections: group settings, the modifiers inside
 * it (edit / delete / add, by id), and the products that use the group.
 * The 5-step wizard is creation-only.
 *
 * Navigation path: /venues/venue-alpha/menumaker/modifier-groups
 */

import { test, expect, Page } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { StaffRole, createMockVenue } from '../../fixtures/mock-data'

test.setTimeout(45_000)
test.use({ viewport: { width: 1280, height: 900 } })

const VENUE = createMockVenue({
  id: 'venue-alpha',
  name: 'Venue Alpha',
  slug: 'venue-alpha',
  permissions: ['menu:read', 'menu:create', 'menu:update', 'menu:delete', 'teams:read', 'settings:read', 'reports:read'],
})

const MOCK_GROUP = {
  id: 'grp-1',
  venueId: 'venue-alpha',
  name: 'Agregar Gel',
  description: 'Extras de gel',
  required: false,
  allowMultiple: true,
  minSelections: 0,
  maxSelections: 2,
  active: true,
  displayOrder: 0,
  modifiers: [
    { id: 'mod-1', groupId: 'grp-1', name: 'Gel', price: 50, active: true },
    { id: 'mod-2', groupId: 'grp-1', name: 'Gel premium', price: 80, active: false },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

interface Capture {
  modifierPuts: any[]
  groupPuts: any[]
  deleted: string[]
}

async function setupModifierMocks(page: Page, capture: Capture): Promise<void> {
  // Single modifier update/delete
  await page.route(
    url => url.pathname.includes('/modifier-groups/grp-1/modifiers/'),
    route => {
      const method = route.request().method()
      if (method === 'PUT') {
        capture.modifierPuts.push(route.request().postDataJSON())
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'mod-1' }) })
      }
      if (method === 'DELETE') {
        capture.deleted.push(route.request().url().split('/').pop() as string)
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
      }
      return route.fallback()
    },
  )

  // Group detail GET + group settings PUT
  await page.route(
    url => /\/modifier-groups\/grp-1$/.test(url.pathname),
    route => {
      if (route.request().method() === 'PUT') {
        capture.groupPuts.push(route.request().postDataJSON())
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_GROUP) })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_GROUP) })
    },
  )

  // Groups list
  await page.route(
    url => /\/venues\/[^/]+\/modifier-groups$/.test(url.pathname),
    route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_GROUP]) }),
  )

  // Products (queried for the assignment section)
  await page.route(
    url => url.pathname.includes('/api/') && url.pathname.includes('/products'),
    route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
  )
}

async function openEditorViaRowClick(page: Page): Promise<void> {
  await page.goto('/venues/venue-alpha/menumaker/modifier-groups')
  await page.getByRole('cell', { name: 'Agregar Gel' }).first().click()
}

function newCapture(): Capture {
  return { modifierPuts: [], groupPuts: [], deleted: [] }
}

test.describe('Consolidated modifier group editor', () => {
  test('row click opens the editor with group settings, modifiers and products sections', async ({ page }) => {
    const capture = newCapture()
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE] })
    await setupModifierMocks(page, capture)

    await openEditorViaRowClick(page)

    // Group settings section prefilled
    const groupSection = page.locator('[data-tour="modifier-editor-group"]')
    await expect(groupSection).toBeVisible({ timeout: 15_000 })
    await expect(groupSection.locator('input').first()).toHaveValue('Agregar Gel')

    // Modifiers section lists both, with price and inactive badge
    const list = page.locator('[data-tour="modifier-editor-list"]')
    await expect(list).toContainText('Gel')
    await expect(list).toContainText('Gel premium')
    await expect(list).toContainText('50')
    await expect(list).toContainText(/Inactivo|Inactive/)
    await expect(page.locator('[data-tour="modifier-editor-add"]')).toBeVisible()

    // Products section present
    await expect(page.locator('[data-tour="modifier-editor-products"]')).toBeVisible()
  })

  test('renaming the group saves via PUT to the group endpoint', async ({ page }) => {
    const capture = newCapture()
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE] })
    await setupModifierMocks(page, capture)

    await openEditorViaRowClick(page)

    const groupSection = page.locator('[data-tour="modifier-editor-group"]')
    await expect(groupSection).toBeVisible({ timeout: 15_000 })

    const nameInput = groupSection.locator('input').first()
    await expect(nameInput).toHaveValue('Agregar Gel')
    await nameInput.fill('Agregar Gel Pro')

    await page.locator('[data-tour="modifier-editor-save"]').click()

    await expect.poll(() => capture.groupPuts.length, { timeout: 10_000 }).toBeGreaterThan(0)
    expect(capture.groupPuts[0]).toMatchObject({ name: 'Agregar Gel Pro', required: false, minSelections: 0, maxSelections: 2 })
  })

  test('editing a modifier opens the edit form and PUTs the change by id', async ({ page }) => {
    const capture = newCapture()
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE] })
    await setupModifierMocks(page, capture)

    await openEditorViaRowClick(page)

    const list = page.locator('[data-tour="modifier-editor-list"]')
    await expect(list).toBeVisible({ timeout: 15_000 })
    await list.locator('[role="button"]', { hasText: /^Gel/ }).first().click()

    const nameInput = page.locator('input[name="name"], input#name').first()
    await expect(nameInput).toHaveValue('Gel', { timeout: 10_000 })

    const priceInput = page.locator('input[name="price"], input#price').first()
    await priceInput.fill('65')
    await page.getByRole('button', { name: /Guardar|Save/i }).first().click()

    await expect.poll(() => capture.modifierPuts.length, { timeout: 10_000 }).toBeGreaterThan(0)
    expect(capture.modifierPuts[0]).toMatchObject({ name: 'Gel', price: 65 })
  })

  test('deleting a modifier asks for confirmation and calls DELETE', async ({ page }) => {
    const capture = newCapture()
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE] })
    await setupModifierMocks(page, capture)

    await openEditorViaRowClick(page)

    const list = page.locator('[data-tour="modifier-editor-list"]')
    await expect(list).toBeVisible({ timeout: 15_000 })

    await list.locator('button[aria-label*="liminar"], button[aria-label*="elete"]').first().click()

    await expect(page.getByRole('alertdialog')).toBeVisible()
    await page.getByRole('alertdialog').getByRole('button', { name: /Eliminar|Delete/ }).click()

    await expect.poll(() => capture.deleted.length, { timeout: 10_000 }).toBeGreaterThan(0)
    expect(capture.deleted[0]).toBe('mod-1')
  })

  test('row menu has a single "Editar grupo" action (wizard is creation-only)', async ({ page }) => {
    const capture = newCapture()
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE] })
    await setupModifierMocks(page, capture)

    await page.goto('/venues/venue-alpha/menumaker/modifier-groups')
    await page.getByRole('cell', { name: 'Agregar Gel' }).first().waitFor({ timeout: 15_000 })

    await page.locator('.dropdown-menu-trigger').first().click()
    await expect(page.getByRole('menuitem', { name: /Editar grupo|Edit group/ })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: /Editar modificadores|Edit modifiers/ })).toHaveCount(0)
    // Old "assign" sheet action is gone
    await expect(page.getByRole('menuitem', { name: /Asignar modificadores/ })).toHaveCount(0)
  })
})
