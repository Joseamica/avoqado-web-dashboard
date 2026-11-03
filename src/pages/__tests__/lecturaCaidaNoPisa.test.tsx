/**
 * Un formulario que se llena desde una lectura no se puede guardar si esa lectura no llegó: el SERVIDOR reemplaza lo real
 * con lo que reciba, sean ceros (ISR), valores de fábrica (Lealtad, Referidos) o una tabla de un solo tramo (Comisiones).
 * Codex r0 del D4. Corre con TanStack de verdad: sólo se finge la red.
 */
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { configure, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import LoyaltySettings from '../Loyalty/LoyaltySettings'
import ReferralsSettings from '../Referrals/ReferralsSettings'
import { PerdidasCard, RetencionCard } from '../Reports/Isr'
import ComisionesPage from '../playtelecom/Comisiones/ComisionesPage'
import OrgComisionesPage from '../playtelecom/Organization/OrgComisionesPage'

const m = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  t: (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k,
}))
vi.mock('@/api', () => ({ default: { get: m.get, put: m.put, post: m.post, patch: m.patch, delete: vi.fn() } }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/hooks/use-current-organization', () => ({ useCurrentOrganization: () => ({ organization: { name: 'Org' } }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/components/billing/FeatureGate', () => ({ FeatureGate: ({ children }: { children: ReactElement }) => children }))
vi.mock('@/components/PermissionGate', () => ({ PermissionGate: ({ children }: { children: ReactElement }) => children }))
vi.mock('@/components/PageTitleWithInfo', () => ({ PageTitleWithInfo: () => null }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: m.t, i18n: { language: 'es' } }), Trans: () => null }))

vi.setConfig({ testTimeout: 30_000 })
configure({ asyncUtilTimeout: 10_000 })

const LECTURAS: [RegExp, unknown][] = [
  [/sales-retention/, { hasEntry: true, isrRetenidoCents: 12_300, ivaRetenidoCents: 4_500, note: null }],
  [/fiscal-loss/, { hasEntry: true, pendingCents: 99_900, note: null }],
  [/loyalty\/config/, { active: true, pointsPerDollar: 7, pointsPerVisit: 2, redemptionRate: 0.5, minPointsRedeem: 300, pointsExpireDays: null }],
  [/referrals\/config/, { active: false }],
  [/commission-rates/, { data: [{ saleType: 'NUEVA', minCount: 1, maxCount: null, amount: 20 }] }],
  [/active-days/, { data: ['2026-11-02'] }],
  [/withdrawals/, { data: [] }],
]
function lecturaSana(url: string) {
  const hit = LECTURAS.find(([re]) => re.test(url))
  return hit ? Promise.resolve({ data: hit[1] }) : Promise.resolve({ data: {} })
}

let client: QueryClient
function montar(ui: ReactElement) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/o/org1']}>
        <Routes>
          <Route path="/o/:orgId" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
const botonesDeGuardar = () =>
  screen.queryAllByRole('button').filter(b => /save|guardar|activate\.|agregar|addtier/i.test(b.textContent ?? ''))
const nadaEscribio = () => {
  expect(m.put).not.toHaveBeenCalled()
  expect(m.post).not.toHaveBeenCalled()
  expect(m.patch).not.toHaveBeenCalled()
}
/** Toca todo lo que se deje tocar: si algo escribe, la prueba truena. */
function intentaGuardar() {
  for (const b of botonesDeGuardar()) if (!(b as HTMLButtonElement).disabled) fireEvent.click(b)
}

beforeEach(() => {
  vi.clearAllMocks()
  m.get.mockImplementation(lecturaSana)
  onlineManager.setOnline(true)
})
afterEach(() => {
  client?.clear()
  onlineManager.setOnline(true)
})

describe('ISR: retenciones y pérdidas', () => {
  const casos: [string, ReactElement, RegExp][] = [
    ['retenciones', <RetencionCard period="2026-10" enabled />, /sales-retention/],
    ['pérdidas', <PerdidasCard enabled />, /fiscal-loss/],
  ]
  it.each(casos)('%s: con la lectura caída avisa y no deja guardar ceros', async (_n, ui) => {
    m.get.mockRejectedValue(new Error('500'))
    montar(ui)
    await screen.findByRole('alert')
    for (const input of screen.getAllByRole('spinbutton')) expect(input).toBeDisabled()
    for (const b of botonesDeGuardar()) expect(b).toBeDisabled()
    intentaGuardar()
    nadaEscribio()
    expect(screen.queryByText(/notCaptured/)).toBeNull()
  })
  it.each(casos)('%s: mientras la lectura no llega tampoco deja guardar', async (_n, ui) => {
    m.get.mockReturnValue(new Promise(() => {}))
    montar(ui)
    for (const b of botonesDeGuardar()) expect(b).toBeDisabled()
    expect(screen.queryByRole('alert')).toBeNull()
  })
  it.each(casos)('%s: sin internet avisa y no deja guardar', async (_n, ui) => {
    onlineManager.setOnline(false)
    montar(ui)
    await screen.findByRole('alert')
    for (const b of botonesDeGuardar()) expect(b).toBeDisabled()
  })
  it.each(casos)('%s: con la lectura sana llena el formulario y deja guardar', async (_n, ui) => {
    montar(ui)
    await waitFor(() => expect(screen.getAllByRole('spinbutton')[0]).not.toHaveValue(null))
    for (const b of botonesDeGuardar()) expect(b).toBeEnabled()
    expect(screen.queryByRole('alert')).toBeNull()
  })
  it('retenciones: si falla la recarga con datos reales, los conserva, avisa y deja guardar', async () => {
    montar(<RetencionCard period="2026-10" enabled />)
    await waitFor(() => expect(screen.getAllByRole('spinbutton')[0]).toHaveValue(123))
    m.get.mockRejectedValue(new Error('500'))
    await client.refetchQueries()
    await screen.findByRole('alert')
    expect(screen.getAllByRole('spinbutton')[0]).toHaveValue(123)
    for (const b of botonesDeGuardar()) expect(b).toBeEnabled()
  })
})

describe('Lealtad y Referidos', () => {
  const casos: [string, ReactElement][] = [
    ['Lealtad', <LoyaltySettings />],
    ['Referidos', <ReferralsSettings />],
  ]
  it.each(casos)('%s: con la lectura caída no ofrece el formulario con valores de fábrica', async (_n, ui) => {
    m.get.mockRejectedValue(new Error('500'))
    montar(ui)
    await screen.findByRole('alert')
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0)
    intentaGuardar()
    nadaEscribio()
  })
  it.each(casos)('%s: sin internet tampoco', async (_n, ui) => {
    onlineManager.setOnline(false)
    montar(ui)
    await screen.findByRole('alert')
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0)
  })
  it.each(casos)('%s: con la lectura sana sale el formulario, sin aviso', async (_n, ui) => {
    montar(ui)
    await waitFor(() => expect(screen.queryAllByRole('spinbutton').length).toBeGreaterThan(0))
    expect(screen.queryByRole('alert')).toBeNull()
  })
  it('Lealtad: un 403 no ofrece reintentar', async () => {
    m.get.mockRejectedValue(Object.assign(new Error('403'), { response: { status: 403 } }))
    montar(<LoyaltySettings />)
    await screen.findByRole('alert')
    expect(screen.queryByRole('button', { name: 'retry' })).toBeNull()
  })
})

describe('Comisiones: tarifas y días', () => {
  const casos: [string, ReactElement][] = [
    ['del negocio', <ComisionesPage />],
    ['de la organización', <OrgComisionesPage />],
  ]
  it.each(casos)('%s: con las tarifas caídas no deja armar una tabla nueva', async (_n, ui) => {
    m.get.mockImplementation((url: string) => (/commission-rates/.test(url) ? Promise.reject(new Error('500')) : lecturaSana(url)))
    montar(ui)
    await screen.findByRole('alert')
    expect(screen.queryByRole('button', { name: /Agregar tramo/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Agregar día/ })).toBeEnabled()
    intentaGuardar()
    expect(m.put).not.toHaveBeenCalled()
  })
  it.each(casos)('%s: con los días caídos no dice «Sin días activos» ni deja agregar', async (_n, ui) => {
    m.get.mockImplementation((url: string) => (/active-days/.test(url) ? Promise.reject(new Error('500')) : lecturaSana(url)))
    montar(ui)
    await screen.findByRole('alert')
    expect(screen.queryByText('Sin días activos')).toBeNull()
    expect(screen.getByRole('button', { name: /Agregar día/ })).toBeDisabled()
  })
  it.each(casos)('%s: con los retiros caídos no dice «Aún no hay retiros»', async (_n, ui) => {
    m.get.mockImplementation((url: string) => (/withdrawals/.test(url) ? Promise.reject(new Error('500')) : lecturaSana(url)))
    montar(ui)
    await screen.findByRole('alert')
    expect(screen.queryByText('Aún no hay retiros.')).toBeNull()
  })
  it.each(casos)('%s: con todo sano edita normal', async (_n, ui) => {
    montar(ui)
    await screen.findAllByRole('button', { name: /Agregar tramo/ })
    expect(screen.getByRole('button', { name: /Agregar día/ })).toBeEnabled()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
