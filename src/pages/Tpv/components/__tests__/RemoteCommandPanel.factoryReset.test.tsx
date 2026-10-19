/**
 * «Borrar de fábrica» en el panel de comandos de UNA terminal: lo decide el PERMISO, no el nombre del rol.
 *
 * Antes el botón salía con `isOwnerPlus || isSuperadmin`, y `TpvId` calculaba `isOwnerPlus` con
 * `user.role` — el rol MÁS ALTO de la persona en cualquier sucursal, no el de ésta. Un negocio que le
 * quitara el permiso al dueño seguía viendo el botón (y recibía un 403), y uno que se lo diera a un
 * ADMIN no lo veía nunca. El servidor exige `tpv-factory-reset:execute` en el venue de la terminal;
 * la pantalla ahora pregunta lo mismo con `can()`.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TpvCommandType } from '@/types/tpv-commands'
import { RemoteCommandPanel } from '../RemoteCommandPanel'

// `mockReset: true` borra los vi.fn() entre pruebas: el estado vive en variables y las fábricas son funciones planas.
let permisos = new Set<string>()

vi.mock('@/hooks/use-access', () => ({
  useAccess: () => ({
    can: (permiso: string) => permisos.has(permiso),
    canAny: (lista: string[]) => lista.some(p => permisos.has(p)),
    canAll: (lista: string[]) => lista.every(p => permisos.has(p)),
  }),
}))

vi.mock('@/services/tpv.service', async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/tpv.service')>()),
  sendTpvCommand: () => Promise.resolve({}),
}))

vi.mock('@/services/superadmin-terminals.service', () => ({
  terminalAPI: {
    getAppUpdates: () => Promise.resolve([]),
    sendRemoteActivation: () => Promise.resolve({}),
  },
}))

vi.mock('@/context/SocketContext', () => ({
  useSocket: () => ({ socket: null }),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: () => undefined }),
}))

vi.mock('@/components/PermissionGate', () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'es' },
  }),
}))

const base: Omit<ComponentProps<typeof RemoteCommandPanel>, 'supportedRemoteCommands'> = {
  terminalId: 'device-1',
  terminalName: 'Caja',
  isOnline: true,
  isLocked: false,
  isInMaintenance: false,
  activationPending: false,
  venueId: 'venue-1',
}

function renderPanel(props: Partial<ComponentProps<typeof RemoteCommandPanel>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <RemoteCommandPanel
        {...base}
        supportedRemoteCommands={[TpvCommandType.RESTART, TpvCommandType.SYNC_DATA, TpvCommandType.FACTORY_RESET]}
        {...props}
      />
    </QueryClientProvider>,
  )
}

const BORRADO = 'commands.types.FACTORY_RESET'

describe('RemoteCommandPanel · borrar de fábrica sólo con `tpv-factory-reset:execute`', () => {
  beforeEach(() => {
    permisos = new Set(['tpv:command'])
  })

  it('🔴 lo ve quien TIENE el permiso, sin importar el nombre de su rol', () => {
    permisos.add('tpv-factory-reset:execute')
    renderPanel()

    expect(screen.getByText(BORRADO)).toBeInTheDocument()
  })

  it('🔴 no lo ve quien NO tiene el permiso, aunque la pantalla lo marque como superadmin', () => {
    // En la vida real un superadmin sí tiene el permiso (`can()` le contesta que sí a todo); aquí se
    // aíslan las dos cosas para fijar que el candado ya no es la etiqueta del rol.
    renderPanel({ isSuperadmin: true })

    expect(screen.queryByText(BORRADO)).not.toBeInTheDocument()
  })

  it('con el permiso pero sin la capacidad del aparato, tampoco aparece', () => {
    permisos.add('tpv-factory-reset:execute')
    renderPanel({ supportedRemoteCommands: [TpvCommandType.RESTART] })

    expect(screen.queryByText(BORRADO)).not.toBeInTheDocument()
  })

  it('REGRESIÓN: los demás comandos no dependen de ese permiso', () => {
    renderPanel()

    expect(screen.getByText('commands.types.RESTART')).toBeInTheDocument()
    expect(screen.getByText('commands.types.SYNC_DATA')).toBeInTheDocument()
  })
})
