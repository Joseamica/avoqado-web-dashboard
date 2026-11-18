/**
 * Tarjeta `hz:nube0000:na1d52b5` (17-nov-2026), Codex r2 #2: «Crear producto» desde «Nueva receta» da de alta por el asistente
 * (`POST /inventory/wizard/complete`), que ahora pide `menu:create` como el alta normal. Sin ese permiso no se ofrece: antes terminaba
 * en 403 para un rol personalizado con inventario pero sin alta de productos.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const permisos = vi.hoisted(() => ({ menuCreate: true }))
const buscador = vi.hoisted(() => ({ ofreceCrear: [] as boolean[] }))

vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => (p === 'menu:create' ? permisos.menuCreate : true) }) }))
vi.mock('@/components/search-combobox', () => ({
  SearchCombobox: (p: { onCreateNew?: unknown }) => {
    buscador.ofreceCrear.push(typeof p.onCreateNew === 'function')
    return null
  },
}))
vi.mock('../ProductWizardDialog', () => ({ ProductWizardDialog: () => null }))
vi.mock('../QuickCreateRawMaterialSheet', () => ({ QuickCreateRawMaterialSheet: () => null }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => undefined }) }))
vi.mock('@/hooks/useDebounce', () => ({ useDebounce: (v: unknown) => v }))
vi.mock('@/hooks/use-unit-translation', () => ({ useUnitTranslation: () => ({ formatUnit: (u: string) => u }) }))
vi.mock('@/api', () => ({ default: { get: vi.fn().mockResolvedValue({ data: { data: [] } }) } }))
vi.mock('@/services/inventory.service', () => ({
  recipesApi: { create: vi.fn() },
  rawMaterialsApi: { getAll: vi.fn().mockResolvedValue({ data: { data: [] } }) },
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }))

import { CreateRecipeWizard } from '../CreateRecipeWizard'

function pintar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <CreateRecipeWizard open onClose={() => undefined} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  permisos.menuCreate = true
  buscador.ofreceCrear = []
})

describe('Nueva receta · «Crear producto» según `menu:create`', () => {
  // NEW FEATURE TESTS
  it('sin `menu:create` el buscador no ofrece crear un producto', () => {
    permisos.menuCreate = false
    pintar()
    expect(buscador.ofreceCrear.length).toBeGreaterThan(0)
    expect(buscador.ofreceCrear.every(o => o === false)).toBe(true)
  })

  // REGRESSION TESTS
  it('con `menu:create` lo ofrece como siempre', () => {
    pintar()
    expect(buscador.ofreceCrear.length).toBeGreaterThan(0)
    expect(buscador.ofreceCrear.every(o => o === true)).toBe(true)
  })
})
