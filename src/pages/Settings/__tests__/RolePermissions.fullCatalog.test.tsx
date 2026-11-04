import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '@/i18n'
import { StaffRole } from '@/types'
import { DEFAULT_PERMISSIONS } from '@/lib/permissions/defaultPermissions'
import { PERMISSION_CATEGORIES } from '@/lib/permissions/roleHierarchy'

/**
 * Ajustes → Roles y permisos: marcar la ÚLTIMA casilla que falta del catálogo no lo convierte en `*:*`.
 * La lista se queda literal (lo que el admin vio marcado); sólo «Acceso total» significa comodín.
 */
const APPROVE = 'sale-verifications:approve'
/** El editor pinta cientos de casillas; en una Mac cargada tarda más que el segundo de Testing Library. */
const ESPERA = { timeout: 15000 }
vi.setConfig({ testTimeout: 60000 })

const h = vi.hoisted(() => ({
  modules: new Set<string>(),
  getAll: vi.fn(),
  update: vi.fn(),
  // Referencias estables: un `configs: []` nuevo en cada render reinicia el editor sin fin.
  roleConfig: {
    getDisplayName: (r: string) => r,
    configs: [] as unknown[],
    // El editor espera la lectura de la apariencia antes de dejar guardar (develop, «lectura caída no pisa»).
    configQuery: { data: [] as unknown[] },
    updateConfigsAsync: async () => {},
    isUpdating: false,
  },
}))

const auth = {
  staffInfo: { role: 'OWNER' },
  checkFeatureAccess: () => true,
  checkModuleAccess: (code: string) => h.modules.has(code),
}
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('@/hooks/use-role-config', () => ({ useRoleConfig: () => h.roleConfig }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => {} }) }))
vi.mock('@/services/rolePermission.service', () => ({
  default: {
    getAllRolePermissions: (...a: unknown[]) => h.getAll(...a),
    updateRolePermissions: (...a: unknown[]) => h.update(...a),
    deleteRolePermissions: async () => ({}),
  },
}))

import PermissionEditorModal from '../components/PermissionEditorModal'


const TODAS = Object.values(PERMISSION_CATEGORIES).flatMap(c => c.permissions as readonly string[])

/** Un rol que tiene todo el catálogo menos `approve`: marcar esa casilla completa la lista. */
function respuestaSoloFaltaApprove() {
  return {
    success: true,
    data: [
      {
        role: StaffRole.MANAGER,
        permissions: TODAS.filter(p => p !== APPROVE),
        deniedPermissions: [],
        isCustom: true,
        modifiedBy: null,
        modifiedAt: null,
      },
    ],
  }
}

function renderEditor() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <PermissionEditorModal open onClose={() => {}} role={StaffRole.MANAGER} venueId="v-pt" />
    </QueryClientProvider>,
  )
}

async function marcarLaUltima() {
  h.modules = new Set(['SERIALIZED_INVENTORY'])
  renderEditor()
  await userEvent.click(await screen.findByText('Verificación de ventas', {}, ESPERA))
  const [casilla] = await screen.findAllByRole('checkbox', { name: /Aprobar o rechazar ventas/ }, ESPERA)
  expect(casilla).not.toBeChecked()
  await userEvent.click(casilla)
  return casilla
}

beforeAll(async () => {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.releasePointerCapture = () => {}
  await i18n.changeLanguage('es')
})

beforeEach(() => {
  h.modules = new Set()
  h.getAll.mockReset()
  h.update.mockReset()
  h.getAll.mockResolvedValue(respuestaSoloFaltaApprove())
  h.update.mockResolvedValue({ success: true, data: {} })
})

describe('Roles y permisos — marcar la última casilla del catálogo', () => {
  it('la casilla se queda marcada y se puede volver a desmarcar', async () => {
    const casilla = await marcarLaUltima()
    await waitFor(() => expect(casilla).toBeChecked(), ESPERA)
    await userEvent.click(casilla)
    await waitFor(() => expect(casilla).not.toBeChecked(), ESPERA)
  })

  it('al guardar manda la lista literal, sin `*:*` y sin negar lo marcado', async () => {
    await marcarLaUltima()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }))
    await waitFor(() => expect(h.update).toHaveBeenCalled(), ESPERA)
    const [, , permissions, denied] = h.update.mock.calls[0] as [string, StaffRole, string[], string[]]
    expect(permissions).not.toContain('*:*')
    expect(permissions).toContain(APPROVE)
    // Nada de lo que el admin vio marcado va como quitado (los de fábrica fuera del catálogo no tienen casilla).
    expect(denied.filter(p => TODAS.includes(p))).toEqual([])
  })
})
