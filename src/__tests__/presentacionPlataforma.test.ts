import { describe, expect, it } from 'vitest'
import { cargarPagina, espera, visible, type Respuesta } from './presentacionHelper'

const bruto = (n: number) => Math.round(n * 1.16)
const plan = (displayName: string, netM: number, netA: number, extra = {}) => ({
  displayName,
  onSale: true,
  requiresCard: true,
  trialDays: 30,
  monthly: { netCents: netM, grossCents: bruto(netM) },
  annual: { netCents: netA, grossCents: bruto(netA) },
  ...extra,
})
const v1 = { offerVersion: null, FREE: { displayName: 'FREE' }, PRO: plan('PRO', 99900, 999000), PREMIUM: plan('PREMIUM', 169900, 1699000) }
const v2 = { ...v1, offerVersion: 2, FREE: { displayName: 'Gratis' }, PRO: { ...plan('Plus', 79900, 850000), annual: { netCents: 850000, grossCents: 986000 }, monthly: { netCents: 79900, grossCents: 92684 } } }
const v3 = { ...v2, offerVersion: 3, PREMIUM: plan('Premium', 169900, 1699000, { onSale: false }) }

const ok = (data: unknown): Respuesta => ({ status: 200, body: { success: true, data } })
const norm = (s: string | null | undefined) => (s || '').replace(/\s+/g, ' ').trim()
const SECCION = '#seccion-26'
const cargar = (r: Respuesta | ((u: string) => Respuesta)) => cargarPagina('avoqado-plataforma.html', typeof r === 'function' ? r : () => r)
const tarjeta = (d: Document, p: string) => d.querySelector(`[data-plan-card="${p}"]`)

describe('presentación de la plataforma: lee la oferta vigente', () => {
  it('con la v1 el texto sale igual que el escrito de antes', async () => {
    const { document: d, llamadas } = cargar(ok(v1))
    await espera()
    expect(llamadas[0]).toBe('http://localhost:3000/api/v1/public/plan-offer')
    expect(norm(tarjeta(d, 'PRO')!.textContent)).toContain('PRO')
    expect(norm(tarjeta(d, 'PRO')!.textContent)).toContain('$999 +IVA/mes')
    expect(norm(tarjeta(d, 'PREMIUM')!.textContent)).toContain('PREMIUM')
    expect(norm(tarjeta(d, 'PREMIUM')!.textContent)).toContain('$1,699 +IVA/mes')
    expect(norm(d.querySelector('[data-plan-annual]')!.textContent)).toBe(
      'Precios + IVA, facturación mensual. Con pago anual: 2 meses gratis (Pro $9,990/año · Premium $16,990/año). Esquema de comisiones para socios disponible aparte.',
    )
    expect(visible(d.querySelector(SECCION + ' .grid4'))).toBe(true)
  })

  it('con la v2 «Plus» muestra nombre, mensual, anual y ahorro con IVA', async () => {
    const { document: d } = cargar(ok(v2))
    await espera()
    const t = norm(tarjeta(d, 'PRO')!.textContent)
    expect(t).toContain('Plus')
    expect(t).toContain('$799 + IVA/mes')
    const anual = norm(d.querySelector('[data-plan-annual]')!.textContent)
    expect(anual).toContain('Plus $8,500/año')
    expect(anual).toContain('ahorras $1,262.08 al año, IVA incluido')
    expect(norm(d.querySelector(SECCION)!.textContent)).toContain('Gratis')
  })

  it('D8: «Todo lo de PRO» usa el nombre del editor con la v2 y «PRO» con la v1', async () => {
    const a = cargar(ok(v2))
    await espera()
    expect(norm(tarjeta(a.document, 'PREMIUM')!.textContent)).toContain('Todo lo de Plus + facturación')
    const b = cargar(ok(v1))
    await espera()
    expect(norm(tarjeta(b.document, 'PREMIUM')!.textContent)).toContain('Todo lo de PRO + facturación')
  })

  it('con la v3 la tarjeta de Premium y su anual no se ven', async () => {
    const { document: d } = cargar(ok(v3))
    await espera()
    expect(visible(tarjeta(d, 'PREMIUM'))).toBe(false)
    expect(visible(tarjeta(d, 'PRO'))).toBe(true)
    const anual = norm(d.querySelector('[data-plan-annual]')!.textContent)
    expect(anual).not.toContain('Premium')
    expect(anual).not.toContain('16,990')
  })

  it('mientras no contesta no hay montos ni tarjetas', async () => {
    const { document: d } = cargar('colgada')
    await espera()
    const sec = d.querySelector(SECCION)!
    expect(norm(d.querySelector('[data-plan-status]')!.textContent)).toBe('Cargando precios…')
    expect(visible(d.querySelector('[data-plan-status]'))).toBe(true)
    expect(visible(sec.querySelector('.grid4'))).toBe(false)
    expect(visible(d.querySelector('[data-plan-annual]'))).toBe(false)
    expect(visible(sec.querySelector('[data-plan-card="PRO"]'))).toBe(false)
    expect(visible(sec.querySelector('[data-plan-card="PREMIUM"]'))).toBe(false)
    expect(visible(sec.querySelector('[data-plan-callout]'))).toBe(false)
  })

  for (const status of [404, 500, 503]) {
    it(`con un ${status} avisa y deja reintentar`, async () => {
      let n = 0
      const { document: d, llamadas } = cargar(() => (n++ === 0 ? { status } : ok(v1)))
      await espera()
      const est = d.querySelector('[data-plan-status]')!
      expect(norm(est.textContent)).toContain('No pudimos cargar los precios')
      expect(norm(est.textContent)).not.toContain('Tu plan')
      expect(visible(d.querySelector(SECCION + ' .grid4'))).toBe(false)
      const boton = [...est.querySelectorAll('button')].find(b => b.textContent === 'Reintentar')!
      expect(boton).toBeTruthy()
      boton.click()
      await espera()
      expect(llamadas).toHaveLength(2)
      expect(visible(d.querySelector(SECCION + ' .grid4'))).toBe(true)
    })
  }

  const dañadas: Array<[string, unknown]> = [
    ['success:false', { success: false, data: {} }],
    ['sin PRO', { success: true, data: { ...v1, PRO: undefined } }],
    ['sin PREMIUM', { success: true, data: { ...v1, PREMIUM: undefined } }],
    ['montos como texto', { success: true, data: { ...v1, PRO: { ...v1.PRO, monthly: { netCents: '99900', grossCents: '115884' } } } }],
    ['onSale que no es booleano', { success: true, data: { ...v1, PRO: { ...v1.PRO, onSale: 'si' } } }],
    ['v2 sin displayName', { success: true, data: { ...v2, PRO: { ...v2.PRO, displayName: '' } } }],
    ['monto negativo', { success: true, data: { ...v1, PRO: { ...v1.PRO, annual: { netCents: -1, grossCents: 5 } } } }],
    ['monto en cero', { success: true, data: { ...v1, PREMIUM: { ...v1.PREMIUM, monthly: { netCents: 0, grossCents: 0 } } } }],
    ['v2 sin FREE.displayName', { success: true, data: { ...v2, FREE: {} } }],
  ]
  for (const [nombre, body] of dañadas) {
    it(`una oferta dañada (${nombre}) cae en «No pudimos cargar»`, async () => {
      const { document: d } = cargar({ status: 200, body })
      await espera()
      const est = d.querySelector('[data-plan-status]')!
      expect(visible(est)).toBe(true)
      expect(norm(est.textContent)).toContain('No pudimos cargar los precios')
      expect([...est.querySelectorAll('button')].some(b => b.textContent === 'Reintentar')).toBe(true)
      expect(visible(d.querySelector(SECCION + ' .grid4'))).toBe(false)
      expect(visible(d.querySelector('[data-plan-callout]'))).toBe(false)
    })
  }

  it('con error de red avisa igual', async () => {
    const { document: d } = cargar('red')
    await espera()
    expect(norm(d.querySelector('[data-plan-status]')!.textContent)).toContain('No pudimos cargar los precios')
    expect(visible(d.querySelector(SECCION + ' .grid4'))).toBe(false)
  })

  it('ya no quedan montos de planes escritos en el HTML', async () => {
    const { readFileSync } = await import('node:fs')
    const html = readFileSync('public/presentacion/avoqado-plataforma.html', 'utf8')
    expect(html).not.toMatch(/\$999\b|\$1,699|\$9,990|\$16,990/)
  })
})
