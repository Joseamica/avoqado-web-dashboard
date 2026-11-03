import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '@/i18n'
import { StaffRole } from '@/types'
import { DEFAULT_PERMISSIONS } from '@/lib/permissions/defaultPermissions'
import { PERMISSION_CATEGORIES } from '@/lib/permissions/roleHierarchy'

/**
 * Ajustes → Roles y permisos, para «Aprobar o rechazar ventas» (`sale-verifications:approve`):
 * - la categoría «Verificación de ventas» sólo existe para tiendas con SERIALIZED_INVENTORY;
 * - guardar el rol MANAGER nunca le devuelve en silencio el `approve` que PlayTelecom le negó,
 *   ni siquiera desde una pestaña vieja cuyo catálogo no conoce ese permiso.
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

/** El MANAGER de PlayTelecom tras la Parte D: todo lo de fábrica menos `approve`, que se le negó. */
function respuestaManagerSinAprobar() {
  return {
    success: true,
    data: [
      {
        role: StaffRole.MANAGER,
        permissions: DEFAULT_PERMISSIONS[StaffRole.MANAGER].filter(p => p !== APPROVE),
        deniedPermissions: [APPROVE],
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

/** Cambia una casilla cualquiera (no la de aprobar) y guarda. */
async function cambiarAlgoYGuardar() {
  const casillas = await screen.findAllByRole('checkbox', {}, ESPERA)
  await userEvent.click(casillas.find(c => !c.hasAttribute('disabled'))!)
  await userEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }))
  await waitFor(() => expect(h.update).toHaveBeenCalled(), ESPERA)
  return h.update.mock.calls[0] as [string, StaffRole, string[], string[]]
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
  h.getAll.mockResolvedValue(respuestaManagerSinAprobar())
  h.update.mockResolvedValue({ success: true, data: {} })
})

describe('Roles y permisos — «Verificación de ventas»', () => {
  it('no aparece en una tienda sin SERIALIZED_INVENTORY', async () => {
    renderEditor()
    await screen.findAllByRole('checkbox', {}, ESPERA)
    expect(screen.queryByText('Verificación de ventas')).not.toBeInTheDocument()
  })

  it('aparece en una tienda con SERIALIZED_INVENTORY', async () => {
    h.modules = new Set(['SERIALIZED_INVENTORY'])
    renderEditor()
    expect(await screen.findByText('Verificación de ventas', {}, ESPERA)).toBeInTheDocument()
  })
})

describe('Roles y permisos — guardar el MANAGER conserva «Aprobar o rechazar ventas» negado', () => {
  it('con el catálogo que conoce el permiso', async () => {
    h.modules = new Set(['SERIALIZED_INVENTORY'])
    renderEditor()
    const [, , , denied] = await cambiarAlgoYGuardar()
    expect(denied).toContain(APPROVE)
  })

  it('si el admin vuelve a marcar «Aprobar o rechazar ventas», al guardar ya no va negado', async () => {
    h.modules = new Set(['SERIALIZED_INVENTORY'])
    renderEditor()
    await userEvent.click(await screen.findByText('Verificación de ventas', {}, ESPERA))
    const [casilla] = await screen.findAllByRole('checkbox', { name: /Aprobar o rechazar ventas/ }, ESPERA)
    await userEvent.click(casilla)
    await userEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }))
    await waitFor(() => expect(h.update).toHaveBeenCalled(), ESPERA)

    const [, , permissions, denied] = h.update.mock.calls[0] as [string, StaffRole, string[], string[]]
    expect(denied).not.toContain(APPROVE)
    expect(permissions).toContain(APPROVE)
  })

  it('con un catálogo viejo que no conoce el permiso (pestaña abierta de antes): se manda como llegó', async () => {
    // Simula el bundle de antes de la Parte A: ni el catálogo ni los de fábrica conocen `approve`.
    const categoria = PERMISSION_CATEGORIES.SALE_VERIFICATIONS as unknown as { permissions: string[] }
    const deFabrica = DEFAULT_PERMISSIONS as Record<StaffRole, string[]>
    const categoriaOriginal = categoria.permissions
    const managerOriginal = deFabrica[StaffRole.MANAGER]
    categoria.permissions = categoriaOriginal.filter(p => p !== APPROVE)
    deFabrica[StaffRole.MANAGER] = managerOriginal.filter(p => p !== APPROVE)
    try {
      h.modules = new Set(['SERIALIZED_INVENTORY'])
      renderEditor()
      const [, , permissions, denied] = await cambiarAlgoYGuardar()
      expect(denied).toContain(APPROVE)
      expect(permissions).not.toContain(APPROVE)
    } finally {
      categoria.permissions = categoriaOriginal
      deFabrica[StaffRole.MANAGER] = managerOriginal
    }
  })
})
