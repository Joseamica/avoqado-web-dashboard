/**
 * E2E — Home: the card that replaced the legacy chatbot.
 *
 * The in-dashboard assistant (`ChatBubble`) has been unmounted since
 * 2026-06-18, so the old Home input dispatched `chatbot:openWithMessage` into
 * the void: type, Enter, nothing. The card is now the permanent entry point to
 * the "Connect your AI" guide (Claude / Codex tabs), the same dialog the
 * "what's new" banner opens. App E2E locale is English.
 *
 * Set E2E_SCREENSHOT_DIR to also capture light + dark screenshots (visual QA).
 */
import { test, expect, type Page } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { StaffRole, createMockVenue } from '../../fixtures/mock-data'

test.setTimeout(45_000)
test.use({ viewport: { width: 1280, height: 900 } })

const HOME_VENUE = createMockVenue({
  id: 'venue-alpha',
  name: 'Restaurante Alpha',
  slug: 'venue-alpha',
  permissions: ['home:read', 'venues:read', 'settings:read'],
})

const DIALOG_TITLE = 'Connect your AI to Avoqado'
const CARD = '[data-tour="home-chatbot-overview"]'

async function hideDevTools(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll('.tsqd-parent-container').forEach(el => {
      ;(el as HTMLElement).style.display = 'none'
    })
  })
}

async function captureIfRequested(page: Page, name: string) {
  const dir = process.env.E2E_SCREENSHOT_DIR
  if (!dir) return
  await hideDevTools(page)
  // The card sits below the setup checklist; bring it into the viewport first.
  await page.locator(CARD).scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: false })
}

test.describe('Home · Connect your AI card', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [HOME_VENUE] })
    await page.goto('/venues/venue-alpha')
    await expect(page.locator(CARD)).toBeVisible({ timeout: 15_000 })
  })

  test('the card is a button, not a text field, and opens the Claude / Codex guide', async ({ page }) => {
    const card = page.locator(CARD)
    await expect(card).toHaveAttribute('role', 'button')
    await expect(card.locator('input, textarea')).toHaveCount(0)
    await expect(card).toContainText('Connect your AI')
    await captureIfRequested(page, 'home-card-light')

    await card.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText(DIALOG_TITLE)
    await expect(dialog.locator('[data-tour="mcp-tab-claude"]')).toBeVisible()
    await expect(dialog.locator('[data-tour="mcp-tab-codex"]')).toBeVisible()
    await captureIfRequested(page, 'home-dialog-light')

    // Codex tab shows the two commands the guide asks you to paste.
    await dialog.locator('[data-tour="mcp-tab-codex"]').click()
    await expect(dialog).toContainText('codex mcp add avoqado')
    await expect(dialog).toContainText('codex mcp login avoqado')

    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
  })

  test('keyboard: focus the card and press Enter', async ({ page }) => {
    await page.locator(CARD).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog')).toContainText(DIALOG_TITLE)
  })

  test('dark mode renders the card and the dialog (visual QA capture)', async ({ page }) => {
    // Same path a user takes: the ThemeProvider reads `vite-ui-theme` on boot.
    await page.evaluate(() => localStorage.setItem('vite-ui-theme', 'dark'))
    await page.reload()
    await expect(page.locator(CARD)).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('html')).toHaveClass(/dark/)
    await captureIfRequested(page, 'home-card-dark')
    await page.locator(CARD).click()
    await expect(page.getByRole('dialog')).toContainText(DIALOG_TITLE)
    await captureIfRequested(page, 'home-dialog-dark')
  })
})
