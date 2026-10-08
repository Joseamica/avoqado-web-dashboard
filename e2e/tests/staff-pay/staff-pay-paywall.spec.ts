/**
 * E6a-fix F7 (QA H2): sin el plan, el cartel «Included in Pro» de Pago al personal salía cortado. FeatureGate ponía el cartel
 * `absolute` encima de una tarjeta de 78 px y `overflow-hidden` dejaba fuera el precio y «Upgrade to Pro»: el dueño sin plan
 * se quedaba sin salida. jsdom no tiene diseño; esto se mide en el navegador, a 1280 y a 390: lo que hay en el centro del
 * botón y del precio ES el botón y el precio (no otro elemento ni nada).
 */
import { test, expect, type Locator, type Page } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { StaffRole, createMockVenue } from '../../fixtures/mock-data'

test.setTimeout(45_000)

const VENUE = createMockVenue({
  id: 'venue-alpha',
  slug: 'venue-alpha',
  permissions: ['home:read', 'staffpay:read', 'billing:read', 'billing:subscriptions:read', 'billing:subscriptions:manage'],
})

async function sinDevtools(page: Page) {
  await page.addInitScript(() => {
    const ocultar = () => {
      const style = document.createElement('style')
      style.textContent = '.tsqd-parent-container { display: none !important; }'
      document.head.appendChild(style)
    }
    if (document.head) ocultar()
    else document.addEventListener('DOMContentLoaded', ocultar)
  })
}

/**
 * Lo que el usuario ve en el centro del elemento es ese elemento, y ningún contenedor que RECORTA (overflow hidden/clip) lo
 * deja fuera. Se lleva a la vista moviendo SÓLO los contenedores con barra (auto/scroll): `scrollIntoView` también movería un
 * contenedor `overflow-hidden` y escondería justo el recorte que se mide.
 */
async function seVeEntero(el: Locator) {
  return el.evaluate(nodo => {
    for (let p = nodo.parentElement; p; p = p.parentElement) {
      const y = getComputedStyle(p).overflowY
      if (y === 'auto' || y === 'scroll') {
        const r = nodo.getBoundingClientRect()
        const c = p.getBoundingClientRect()
        p.scrollTop += r.top - c.top - c.height / 2
      }
    }
    window.scrollBy(0, nodo.getBoundingClientRect().top - window.innerHeight / 2)
    const r = nodo.getBoundingClientRect()
    let recortado = false
    for (let p = nodo.parentElement; p; p = p.parentElement) {
      const e = getComputedStyle(p)
      if (!['hidden', 'clip'].includes(e.overflowY) && !['hidden', 'clip'].includes(e.overflow)) continue
      const c = p.getBoundingClientRect()
      if (r.top < c.top - 1 || r.bottom > c.bottom + 1 || r.left < c.left - 1 || r.right > c.right + 1) recortado = true
    }
    const golpe = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return !!golpe && (golpe === nodo || nodo.contains(golpe)) && !recortado
  })
}

for (const pantalla of [
  { nombre: 'escritorio', width: 1280, height: 800 },
  { nombre: 'celular', width: 390, height: 844 },
]) {
  test(`sin el plan, el cartel de Pago al personal se ve entero con su precio y su botón (${pantalla.nombre})`, async ({ page }) => {
    await page.setViewportSize({ width: pantalla.width, height: pantalla.height })
    await setupApiMocks(page, {
      userRole: StaffRole.OWNER,
      venues: [VENUE],
      planState: { hasPlan: false, state: 'none', planTier: 'GRATIS', grandfathered: false },
    })
    // Sin el plan: la página dice que está apagado, dentro del cartel de planes (E3a).
    await page.route('**/api/v1/dashboard/venues/*/staff-pay/access', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enabled: false, activado: false, startDate: null, propinasEncendidas: false }),
      }),
    )
    await sinDevtools(page)
    await page.goto('/venues/venue-alpha/servicio-pago')

    const boton = page.getByRole('button', { name: /upgrade to pro/i })
    await expect(boton).toBeVisible({ timeout: 15_000 })
    const precio = page.getByText(/The Pro plan is \$999\/mo \+ VAT/)
    await expect(precio).toBeVisible()
    expect(await seVeEntero(boton), 'el botón «Upgrade to Pro» no debe quedar recortado').toBe(true)
    expect(await seVeEntero(precio), 'el precio del plan no debe quedar recortado').toBe(true)
  })
}
