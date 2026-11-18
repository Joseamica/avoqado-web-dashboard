import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '@/i18n'
import type { PermissionSet } from '@/services/permissionSet.service'

/**
 * Ajustes → Roles y permisos → conjuntos de permisos: «Verificación de ventas» es de PlayTelecom
 * (founder, 2-nov), así que sólo aparece en tiendas con SERIALIZED_INVENTORY. Esconderla no le
 * quita nada al conjunto: lo que ya tenía se guarda igual.
 */
const ESPERA = { timeout: 15000 }
vi.setConfig({ testTimeout: 60000 })

const h = vi.hoisted(() => ({ modules: new Set<string>(), update: vi.fn(), create: vi.fn() }))

const auth = { checkModuleAccess: (code: string) => h.modules.has(code) }
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => {} }) }))
vi.mock('@/services/permissionSet.service', () => ({
  default: { update: (...a: unknown[]) => h.update(...a), create: (...a: unknown[]) => h.create(...a) },
}))

import PermissionSetEditorModal from '../components/PermissionSetEditorModal'

const conjunto: PermissionSet = {
  id: 'ps-1',
  venueId: 'v-1',
  name: 'Back-office',
  description: null,
  permissions: ['home:read', 'sale-verifications:review'],
  color: null,
  createdBy: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  _count: { staffVenues: 0 },
}

function renderEditor(permissionSet: PermissionSet | null = conjunto) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <PermissionSetEditorModal open onClose={() => {}} permissionSet={permissionSet} venueId="v-1" />
    </QueryClientProvider>,
  )
}

beforeAll(async () => {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.releasePointerCapture = () => {}
  await i18n.changeLanguage('es')
})

beforeEach(() => {
  h.modules = new Set()
  h.update.mockReset()
  h.update.mockResolvedValue({ success: true, data: conjunto })
  h.create.mockReset()
  h.create.mockResolvedValue({ success: true, data: conjunto })
})

describe('Conjuntos de permisos — «Verificación de ventas»', () => {
  it('no aparece en una tienda sin SERIALIZED_INVENTORY, y guardar conserva lo que el conjunto ya tenía', async () => {
    renderEditor()
    await screen.findAllByRole('checkbox', {}, ESPERA)
    expect(screen.queryByText('Verificación de ventas')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }))
    await waitFor(() => expect(h.update).toHaveBeenCalled(), ESPERA)
    expect(h.update.mock.calls[0][2].permissions).toContain('sale-verifications:review')
  })

  it('aparece en una tienda con SERIALIZED_INVENTORY', async () => {
    h.modules = new Set(['SERIALIZED_INVENTORY'])
    renderEditor()
    expect(await screen.findByText('Verificación de ventas', {}, ESPERA)).toBeInTheDocument()
  })
})

/**
 * 🔴 F1 (founder, 17-nov): «no se cobró» lo firma SIEMPRE un gerente con su PIN. El cajero ya no trae de fábrica
 * `payments:reconcile-uncharged`, y un conjunto NUEVO nace de la plantilla del cajero («Estándar»): si la plantilla lo
 * conservara, cada conjunto creado desde hoy se lo volvería a dar a un cajero.
 */
describe('Conjuntos de permisos — plantilla del cajero (F1)', () => {
  it('un conjunto nuevo con el nivel «Estándar» NO trae «no se cobró», y sí lo de cobrar', async () => {
    renderEditor(null)
    await userEvent.type(await screen.findByPlaceholderText('Ej: Líder de Barra', {}, ESPERA), 'Caja de la tarde')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(h.create).toHaveBeenCalled(), ESPERA)
    const permisos: string[] = h.create.mock.calls[0][1].permissions
    expect(permisos).not.toContain('payments:reconcile-uncharged')
    expect(permisos).toContain('payments:create')
  })
})
