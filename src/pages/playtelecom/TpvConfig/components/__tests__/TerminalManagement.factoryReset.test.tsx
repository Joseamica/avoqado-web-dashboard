/**
 * «Borrar Almacenamiento y Cache» (FACTORY_RESET) en la configuración de TPV del panel de marca blanca:
 * lo decide el PERMISO del venue, no el nombre del rol.
 *
 * Antes salía con `role === 'OWNER' || role === 'SUPERADMIN'`. Pega en `POST /dashboard/tpv/:id/command`,
 * que exige `tpv-factory-reset:execute` en el venue de la terminal: un negocio que se lo quitara al
 * dueño le dejaba un botón que respondía 403, y uno que se lo diera a un ADMIN no se lo enseñaba.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TerminalManagement } from '../TerminalManagement'

// `mockReset: true` borra los vi.fn() entre pruebas: el estado vive en variables y las fábricas son funciones planas.
let rol = 'ADMIN'
let permisos = new Set<string>()

vi.mock('@/hooks/use-access', () => ({
  useAccess: () => ({
    role: rol,
    can: (permiso: string) => permisos.has(permiso),
    canAny: (lista: string[]) => lista.some(p => permisos.has(p)),
    canAll: (lista: string[]) => lista.every(p => permisos.has(p)),
  }),
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ activeVenue: { id: 'venue-1' } }),
}))

vi.mock('@/context/SocketContext', () => ({
  useSocket: () => ({ socket: null }),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: () => undefined }),
}))

vi.mock('@/services/tpv.service', async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/tpv.service')>()),
  getTpvs: () =>
    Promise.resolve({
      data: [{ id: 'terminal-1', name: 'Caja 1', serialNumber: 'AVQD-1', status: 'ACTIVE', isLocked: false, lastHeartbeat: null }],
      meta: { totalCount: 1 },
    }),
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'es' },
  }),
}))

const BORRADO = 'playtelecom:tpvConfig.terminals.factoryReset'

async function pintar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <TerminalManagement />
    </QueryClientProvider>,
  )
  await screen.findByText('playtelecom:tpvConfig.terminals.restart')
}

describe('TerminalManagement · borrar de fábrica sólo con `tpv-factory-reset:execute`', () => {
  beforeEach(() => {
    rol = 'ADMIN'
    permisos = new Set(['tpv:command'])
  })

  it('🔴 un ADMIN al que el negocio le dio el permiso SÍ lo ve', async () => {
    permisos.add('tpv-factory-reset:execute')
    await pintar()

    expect(screen.getByText(BORRADO)).toBeInTheDocument()
  })

  it('🔴 un OWNER al que el negocio le QUITÓ el permiso NO lo ve', async () => {
    rol = 'OWNER'
    await pintar()

    expect(screen.queryByText(BORRADO)).not.toBeInTheDocument()
  })

  it('el dueño con el permiso lo ve', async () => {
    rol = 'OWNER'
    permisos.add('tpv-factory-reset:execute')
    await pintar()

    expect(screen.getByText(BORRADO)).toBeInTheDocument()
  })

  it('REGRESIÓN: los demás comandos del menú no dependen de ese permiso', async () => {
    await pintar()

    expect(screen.getByText('playtelecom:tpvConfig.terminals.restart')).toBeInTheDocument()
    expect(screen.getByText('playtelecom:tpvConfig.terminals.clearCache')).toBeInTheDocument()
  })
})
