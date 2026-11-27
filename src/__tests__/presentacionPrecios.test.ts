import { describe, expect, it } from 'vitest'
import { cargarPagina, espera } from './presentacionHelper'

const feature = {
  id: 'reservas', name: 'Reservas', kind: 'SUELTA', category: 'a', categoryLabel: 'Ventas', description: 'd', requirement: null,
  price: 199, requires: [], includedIn: ['PRO', 'PREMIUM'],
}
const lista = (plans: unknown[], extra = {}) => ({ success: true, data: { plans, features: [feature], ...extra } })
const v1 = [{ tier: 'PRO', name: 'Pro', price: 999 }, { tier: 'PREMIUM', name: 'Premium', price: 1699 }]
const v2 = [
  { tier: 'PRO', name: 'Pro', price: 799, displayName: 'Plus', onSale: true },
  { tier: 'PREMIUM', name: 'Premium', price: 1699, displayName: 'Premium', onSale: true },
]
const incluida = (d: Document) => [...d.querySelectorAll('.meta span')].map(s => s.textContent).find(t => t?.startsWith('Incluida en'))

describe('precios.html: etiquetas «Incluida en»', () => {
  it('sin versión del editor dice «Incluida en Pro y Premium», como hoy', async () => {
    const { document: d } = cargarPagina('precios.html', () => ({ status: 200, body: lista(v1) }))
    await espera()
    expect(incluida(d)).toBe('Incluida en Pro y Premium')
  })
  it('con la v2 usa el nombre vigente: «Incluida en Plus y Premium»', async () => {
    const { document: d } = cargarPagina('precios.html', () => ({ status: 200, body: lista(v2, { offerVersion: 2 }) }))
    await espera()
    expect(incluida(d)).toBe('Incluida en Plus y Premium')
  })
})
