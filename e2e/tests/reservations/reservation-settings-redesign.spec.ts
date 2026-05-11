import { test, expect, type Page } from '@playwright/test'

/**
 * Hits the REAL backend at localhost:3000 (no mocks). Verifies the
 * ReservationSettings redesign end-to-end against live data.
 *
 * Requires:
 *  - Backend running on http://localhost:3000
 *  - Frontend dev server on http://localhost:5173
 *  - Superadmin credentials valid in dev DB
 */

// Configurable so the same spec runs locally (defaults) and in CI (env vars).
// CI sets E2E_API_URL/E2E_BASE_URL to point at the demo backend + a preview
// server of the just-built dashboard bundle.
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000'
const SUPERADMIN_EMAIL = process.env.E2E_SUPERADMIN_EMAIL ?? 'superadmin@superadmin.com'
const SUPERADMIN_PASSWORD = process.env.E2E_SUPERADMIN_PASSWORD ?? 'superadmin'
const VENUE_SLUG = process.env.E2E_VENUE_SLUG ?? 'avoqado-full'

async function loginAsSuperadmin(page: Page) {
	// page.request shares the browser context's cookie jar, so the HttpOnly
	// accessToken/refreshToken cookies the backend sets land where the
	// subsequent page navigation can use them.
	const response = await page.request.post(`${API_URL}/api/v1/dashboard/auth/login`, {
		data: { email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD },
		headers: { Origin: 'http://localhost:5173' },
	})
	expect(response.ok()).toBeTruthy()
	// AuthContext fast-path + force Spanish so our text assertions match.
	// (Playwright Chrome defaults to en-US; the detector picks `en` without
	// this, and every heading/badge renders in English.)
	await page.addInitScript(() => {
		try {
			window.localStorage.setItem('avoqado_session_hint', 'true')
			window.localStorage.setItem('lang', 'es')
		} catch (e) {
			/* sandboxed contexts */
		}
	})
}

test.describe('ReservationSettings — redesign smoke (real backend)', () => {
	test.beforeEach(async ({ page }) => {
		await loginAsSuperadmin(page)
		await page.goto(`/venues/${VENUE_SLUG}/reservations/settings`)
		// The form hydrates from a real API call; wait for the heading to render.
		await expect(page.getByRole('heading', { name: /Configuración de Reservaciones/i })).toBeVisible({
			timeout: 15_000,
		})
	})

	test('sticky header exposes Save + Tour buttons', async ({ page }) => {
		await expect(page.getByRole('button', { name: /Guardar Cambios/i })).toBeVisible()
		await expect(page.getByRole('button', { name: /Ver tour/i })).toBeVisible()
	})

	test('every section renders as flat-row card (Programación → Recordatorios)', async ({ page }) => {
		for (const heading of [
			'Programación',
			'Ritmo',
			'Depósitos',
			'Pagos por tipo',
			'Reservaciones Online',
			'Cancelación',
			'Reembolso de créditos al cancelar',
			'Lista de Espera',
			'Recordatorios',
		]) {
			// Long page with sticky header — toBeAttached covers headings
			// scrolled below the fold without needing per-section scroll plumbing.
			await expect(page.getByRole('heading', { name: heading, exact: true })).toBeAttached()
		}
	})

	test('citas-only fields show "Citas" badge', async ({ page }) => {
		// "Intervalo de slots" is appointments-only — should have a CITAS badge.
		const row = page.locator('text=Intervalo de slots').locator('xpath=..')
		await expect(row.getByText('Citas', { exact: true })).toBeVisible()
	})

	test('clases-only fields show "Clases" badge', async ({ page }) => {
		// "Política de reembolso" in credit-refund section is classes-only.
		const row = page.locator('text=Política de reembolso').locator('xpath=..')
		await expect(row.getByText('Clases', { exact: true })).toBeVisible()
	})

	test('Programación section uses dropdowns (no free numeric inputs)', async ({ page }) => {
		const section = page.locator('[data-tour="reservation-settings-scheduling"]')
		// All numeric inputs in this section should be Select triggers, not <input type="number">.
		await expect(section.locator('input[type="number"]')).toHaveCount(0)
		await expect(section.getByRole('combobox')).toHaveCount(5) // slot, duration, advance, notice, no-show grace
	})

	test('Pagos por tipo exposes two dropdowns for appointment vs class upfront', async ({ page }) => {
		const section = page.locator('[data-tour="reservation-settings-payments"]')
		await expect(section.locator('text=Cobro por adelantado en citas')).toBeVisible()
		await expect(section.locator('text=Cobro por adelantado en clases')).toBeVisible()
		await expect(section.getByRole('combobox')).toHaveCount(2)
	})

	test('Recordatorios section reveals channel + offset pills when enabled', async ({ page }) => {
		const section = page.locator('[data-tour="reservation-settings-reminders"]')
		await expect(section.locator('text=Enviar recordatorios')).toBeVisible()
		// Channel + offset rows only appear when the toggle is on. The dev venue
		// has reminders ON by default, so the rows should be visible.
		await expect(section.locator('text=Canales')).toBeVisible()
		await expect(section.locator('text=Cuándo enviar')).toBeVisible()
		// At least the 3 channel pills.
		await expect(section.getByRole('button', { name: 'Email' })).toBeVisible()
		await expect(section.getByRole('button', { name: 'SMS' })).toBeVisible()
		await expect(section.getByRole('button', { name: 'WhatsApp' })).toBeVisible()
	})

	test('Tour button opens driver.js popover with translated title (not raw key)', async ({ page }) => {
		await page.getByRole('button', { name: /Ver tour/i }).click()
		// driver.js renders into a popover at document root with class avoqado-tour-popover
		const popover = page.locator('.avoqado-tour-popover, .driver-popover').first()
		await expect(popover).toBeVisible({ timeout: 5_000 })
		// The translated welcome step title — NOT the raw key.
		await expect(popover).toContainText('Configuración de Reservaciones')
		await expect(popover).not.toContainText('settings.settingsTour')
	})

	test('Tooltips render translated content, not raw keys', async ({ page }) => {
		// First Info icon in the Programación section.
		const section = page.locator('[data-tour="reservation-settings-scheduling"]')
		const firstInfo = section.locator('button[aria-label="Más información"]').first()
		await firstInfo.scrollIntoViewIfNeeded()
		// Radix Tooltip opens on focus as well as hover; focus is the reliable
		// path in CI because pointer events can be flaky over scrolled content.
		await firstInfo.focus()
		await firstInfo.hover({ force: true })
		const tip = page.getByRole('tooltip').first()
		await expect(tip).toBeVisible({ timeout: 5_000 })
		// Tooltip content should contain Spanish words, not the raw key path.
		await expect(tip).not.toContainText('settings.scheduling')
	})
})

test.describe('OnlineBookingPage — venue row + brand identity modal', () => {
	test.beforeEach(async ({ page }) => {
		await loginAsSuperadmin(page)
		await page.goto(`/venues/${VENUE_SLUG}/reservations/online-booking`)
		await expect(page.getByRole('heading', { name: /Canales de reserva online/i })).toBeVisible({
			timeout: 15_000,
		})
	})

	test('venue identity row exposes kebab menu → Editar identidad de marca', async ({ page }) => {
		await expect(page.locator('text=Páginas de reserva públicas')).toBeVisible()
		// Find the kebab button in the venue-name row.
		const kebab = page.getByRole('button', { name: /Más acciones/i }).first()
		await kebab.click()
		await expect(page.getByRole('menuitem', { name: /Editar identidad de marca/i })).toBeVisible()
	})

	test('Brand identity modal opens step 1 with logo + color cards', async ({ page }) => {
		const kebab = page.getByRole('button', { name: /Más acciones/i }).first()
		await kebab.click()
		await page.getByRole('menuitem', { name: /Editar identidad de marca/i }).click()
		// Step 1 heading (h2 in dialog header; sr-only description duplicates the text)
		await expect(
			page.getByRole('heading', { name: 'Aplica el diseño de tu marca' }),
		).toBeVisible({ timeout: 5_000 })
		await expect(page.getByText('Logotipo completo')).toBeVisible()
		await expect(page.getByText('Logotipo pequeño')).toBeVisible()
		// Color row label
		await expect(page.getByText(/^Color$/).first()).toBeVisible()
		// Step navigation: Omitir + Siguiente in header
		await expect(page.getByRole('button', { name: /Omitir/i })).toBeVisible()
		await expect(page.getByRole('button', { name: /Siguiente/i })).toBeVisible()
	})

	test('Step 2 has preview on the right with Citas/Clases tabs and Completar button', async ({ page }) => {
		const kebab = page.getByRole('button', { name: /Más acciones/i }).first()
		await kebab.click()
		await page.getByRole('menuitem', { name: /Editar identidad de marca/i }).click()
		await page.getByRole('button', { name: /Siguiente/i }).click()
		// Step 2 button
		await expect(page.getByRole('button', { name: /Completar/i })).toBeVisible({ timeout: 5_000 })
		// Preview pane tabs
		await expect(page.getByRole('button', { name: /^Citas$/ })).toBeVisible()
		await expect(page.getByRole('button', { name: /^Clases$/ })).toBeVisible()
	})
})

test.describe('Public booking pages list — flat rows with kebab', () => {
	test.beforeEach(async ({ page }) => {
		await loginAsSuperadmin(page)
		await page.goto(`/venues/${VENUE_SLUG}/reservations/online-booking`)
	})

	test('citas + clases rows expose Edit / Show / Copy URL actions', async ({ page }) => {
		await expect(page.locator('text=Página de reserva de citas')).toBeVisible()
		await expect(page.locator('text=Página de reserva de clases')).toBeVisible()
		// Each row has the show + copy + edit affordance.
		await expect(page.getByRole('link', { name: /Edita visualización del servicio/i })).toBeVisible()
		await expect(page.getByRole('link', { name: /Ver calendario/i })).toBeVisible()
		await expect(page.getByRole('link', { name: /Mostrar/i }).first()).toBeVisible()
	})
})
