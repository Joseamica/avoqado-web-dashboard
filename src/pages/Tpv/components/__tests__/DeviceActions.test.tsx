import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { EffectiveDeviceCapabilities } from '@/services/tpv.service'
import type { OrgTerminal } from '@/services/organizationDashboard.service'
import { TpvCommandType } from '@/types/tpv-commands'
import { OrgTerminalDrawer } from '@/pages/Organization/components/OrgTerminalDrawer'
import { OrgTerminalsBulkBar } from '@/pages/Organization/components/OrgTerminalsBulkBar'
import { RemoteCommandPanel } from '../RemoteCommandPanel'

const mocks = vi.hoisted(() => ({
  sendTpvCommand: vi.fn(),
  sendRemoteActivation: vi.fn(),
  bulkCommandOrgTerminals: vi.fn(),
  getOrgTerminalById: vi.fn(),
  getOrgAppVersions: vi.fn(),
  getAppUpdates: vi.fn(),
}))

vi.mock('@/services/tpv.service', async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/tpv.service')>()),
  sendTpvCommand: mocks.sendTpvCommand,
}))

vi.mock('@/services/organizationDashboard.service', async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/organizationDashboard.service')>()),
  bulkCommandOrgTerminals: mocks.bulkCommandOrgTerminals,
  getOrgTerminalById: mocks.getOrgTerminalById,
  getOrgAppVersions: mocks.getOrgAppVersions,
}))

vi.mock('@/services/superadmin-terminals.service', () => ({
  terminalAPI: {
    getAppUpdates: mocks.getAppUpdates,
    sendRemoteActivation: mocks.sendRemoteActivation,
  },
}))

vi.mock('@/context/SocketContext', () => ({
  useSocket: () => ({ socket: null }),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

vi.mock('@/components/PermissionGate', () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({ formatDateTime: (value: string) => value }),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}))

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children: ReactNode }) => <>{children}</>,
  SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

const baseCapabilities: EffectiveDeviceCapabilities = {
  requiresActivation: false,
  canManagePaymentConfiguration: false,
  canAcceptTerminalPaymentRequests: false,
  customerDisplay: {
    presence: 'UNKNOWN',
    invertibility: 'UNKNOWN',
    canRequestInversion: false,
    observedAt: null,
    stale: true,
  },
  supportedRemoteCommands: [],
}

function renderWithClient(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  const result = render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
  return {
    client,
    ...result,
    rerenderWithClient(nextUi: ReactNode) {
      result.rerender(<QueryClientProvider client={client}>{nextUi}</QueryClientProvider>)
    },
  }
}

const remoteDefaults: Omit<ComponentProps<typeof RemoteCommandPanel>, 'supportedRemoteCommands'> = {
  terminalId: 'device-1',
  terminalName: 'Caja',
  isOnline: true,
  isLocked: false,
  isInMaintenance: false,
  activationPending: false,
  venueId: 'venue-1',
}

function orgTerminal(capabilities: EffectiveDeviceCapabilities): OrgTerminal {
  return {
    id: 'device-1',
    name: 'Caja',
    serialNumber: null,
    type: 'POS',
    status: 'ACTIVE',
    brand: null,
    model: null,
    version: null,
    lastHeartbeat: null,
    ipAddress: null,
    healthScore: null,
    isLocked: false,
    assignedMerchantIds: [],
    activatedAt: null,
    activationCode: null,
    activationCodeExpiry: null,
    venue: { id: 'venue-1', name: 'Sucursal', slug: 'sucursal' },
    capabilities,
    customerDisplayInverted: false,
    customerDisplayRequest: null,
    selfRegistered: true,
  }
}

describe('capability-aware device actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getOrgAppVersions.mockResolvedValue([])
    mocks.getAppUpdates.mockResolvedValue([])
    mocks.sendTpvCommand.mockResolvedValue({})
    mocks.sendRemoteActivation.mockResolvedValue({})
    mocks.bulkCommandOrgTerminals.mockResolvedValue({ total: 2, succeeded: 2, failed: 0, results: [] })
  })

  it('renders no remote panel when the exact device allowlist is empty', () => {
    renderWithClient(<RemoteCommandPanel {...remoteDefaults} supportedRemoteCommands={[]} />)
    expect(screen.queryByText('commands.remoteCommands')).not.toBeInTheDocument()
  })

  it('renders and executes only commands present in the exact allowlist', async () => {
    renderWithClient(
      <RemoteCommandPanel {...remoteDefaults} supportedRemoteCommands={[TpvCommandType.RESTART]} />,
    )

    expect(screen.getByText('commands.types.RESTART')).toBeInTheDocument()
    expect(screen.queryByText('commands.types.SYNC_DATA')).not.toBeInTheDocument()
    expect(screen.queryByText('actions.unlocked')).not.toBeInTheDocument()
    expect(screen.queryByText('actions.maintenance')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('commands.types.RESTART'))
    fireEvent.click(screen.getByText('commands.execute'))
    await waitFor(() => {
      expect(mocks.sendTpvCommand).toHaveBeenCalledWith(
        'device-1',
        TpvCommandType.RESTART,
        undefined,
        expect.anything(),
      )
    })
  })

  it('does not show the opposite state transition unless that exact transition is supported', () => {
    renderWithClient(
      <RemoteCommandPanel
        {...remoteDefaults}
        isLocked
        isInMaintenance
        supportedRemoteCommands={[TpvCommandType.LOCK, TpvCommandType.MAINTENANCE_MODE]}
      />,
    )

    expect(screen.queryByText('actions.locked')).not.toBeInTheDocument()
    expect(screen.queryByText('actions.maintenance')).not.toBeInTheDocument()
  })

  it('closes an A confirmation when the panel identity changes instead of sending it to cached B', () => {
    const { rerenderWithClient } = renderWithClient(
      <RemoteCommandPanel
        {...remoteDefaults}
        terminalId="device-a"
        venueId="venue-a"
        supportedRemoteCommands={[TpvCommandType.RESTART]}
      />,
    )

    fireEvent.click(screen.getByText('commands.types.RESTART'))
    expect(screen.getByText('commands.execute')).toBeInTheDocument()

    rerenderWithClient(
      <RemoteCommandPanel
        {...remoteDefaults}
        terminalId="device-b"
        venueId="venue-b"
        supportedRemoteCommands={[TpvCommandType.RESTART]}
      />,
    )

    expect(screen.queryByText('commands.execute')).not.toBeInTheDocument()
    expect(mocks.sendTpvCommand).not.toHaveBeenCalled()
  })

  it('keeps unresolved A pending state and invalidation scoped away from B', async () => {
    let resolveA!: (value: object) => void
    mocks.sendTpvCommand.mockImplementationOnce(
      () => new Promise<object>(resolve => {
        resolveA = resolve
      }),
    )
    const { client, rerenderWithClient } = renderWithClient(
      <RemoteCommandPanel
        {...remoteDefaults}
        terminalId="device-a"
        venueId="venue-a"
        supportedRemoteCommands={[TpvCommandType.RESTART]}
      />,
    )
    const invalidateQueries = vi.spyOn(client, 'invalidateQueries')

    fireEvent.click(screen.getByText('commands.types.RESTART'))
    fireEvent.click(screen.getByText('commands.execute'))
    await waitFor(() => expect(mocks.sendTpvCommand).toHaveBeenCalledWith(
      'device-a',
      TpvCommandType.RESTART,
      undefined,
      expect.anything(),
    ))

    rerenderWithClient(
      <RemoteCommandPanel
        {...remoteDefaults}
        terminalId="device-b"
        venueId="venue-b"
        supportedRemoteCommands={[TpvCommandType.RESTART]}
      />,
    )

    expect(screen.getByText('commands.types.RESTART').closest('button')).not.toBeDisabled()
    resolveA({})
    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tpv', 'venue-a', 'device-a'] })
    })
    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: ['tpv', 'venue-b', 'device-b'] })
  })

  it('does not expose remote activation for a non-activatable self-registered POS even with a contradictory allowlist', () => {
    renderWithClient(
      <RemoteCommandPanel
        {...remoteDefaults}
        activationPending={false}
        isSuperadmin
        supportedRemoteCommands={[TpvCommandType.REMOTE_ACTIVATE]}
      />,
    )

    expect(screen.queryByText('commands.remoteActivate')).not.toBeInTheDocument()
    expect(mocks.sendRemoteActivation).not.toHaveBeenCalled()
  })

  it('keeps management actions but hides unsupported POS lifecycle, payment, and remote actions in the org drawer', () => {
    renderWithClient(
      <OrgTerminalDrawer
        orgId="org-1"
        terminalId="device-1"
        fromCache={orgTerminal(baseCapabilities)}
        onClose={vi.fn()}
        onCommand={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onEditMerchants={vi.fn()}
        onGenerateActivationCode={vi.fn()}
        onRemoteActivate={vi.fn()}
        onRevokeSessions={vi.fn()}
      />,
    )

    expect(screen.getByText('terminals.actions.edit')).toBeInTheDocument()
    expect(screen.getByText('terminals.actions.revokeSessions')).toBeInTheDocument()
    expect(screen.queryByText('terminals.actions.restart')).not.toBeInTheDocument()
    expect(screen.queryByText('terminals.actions.generateCode')).not.toBeInTheDocument()
    expect(screen.queryByText('terminals.drawer.merchants')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('terminals.drawer.dangerZone'))
    expect(screen.getByText('terminals.actions.delete')).toBeInTheDocument()
    expect(screen.queryByText('terminals.actions.factoryReset')).not.toBeInTheDocument()
  })

  it('shows only a provisioned TPV action set in the org drawer', () => {
    const capabilities = {
      ...baseCapabilities,
      requiresActivation: true,
      canManagePaymentConfiguration: true,
      supportedRemoteCommands: [TpvCommandType.RESTART, TpvCommandType.FACTORY_RESET],
    }

    renderWithClient(
      <OrgTerminalDrawer
        orgId="org-1"
        terminalId="device-1"
        fromCache={{ ...orgTerminal(capabilities), selfRegistered: false }}
        onClose={vi.fn()}
        onCommand={vi.fn()}
        onEditMerchants={vi.fn()}
        onGenerateActivationCode={vi.fn()}
        onRemoteActivate={vi.fn()}
      />,
    )

    expect(screen.getByText('terminals.actions.restart')).toBeInTheDocument()
    expect(screen.getByText('terminals.actions.generateCode')).toBeInTheDocument()
    expect(screen.getByText('terminals.drawer.merchants')).toBeInTheDocument()
    fireEvent.click(screen.getByText('terminals.drawer.dangerZone'))
    expect(screen.getByText('terminals.actions.factoryReset')).toBeInTheDocument()
    expect(screen.queryByText('terminals.actions.syncData')).not.toBeInTheDocument()
  })

  it('offers org bulk actions only from the capability intersection of every selected device', () => {
    const first = orgTerminal({
      ...baseCapabilities,
      supportedRemoteCommands: [TpvCommandType.RESTART, TpvCommandType.SYNC_DATA],
    })
    const second = {
      ...orgTerminal({
        ...baseCapabilities,
        supportedRemoteCommands: [TpvCommandType.RESTART, TpvCommandType.LOCK],
      }),
      id: 'device-2',
      name: 'Teléfono',
    }

    renderWithClient(
      <OrgTerminalsBulkBar
        orgId="org-1"
        selected={[first, second]}
        onClear={vi.fn()}
        onComplete={vi.fn()}
      />,
    )

    expect(screen.getByText('terminals.bulk.action.RESTART')).toBeInTheDocument()
    expect(screen.queryByText('terminals.bulk.action.SYNC_DATA')).not.toBeInTheDocument()
    expect(screen.queryByText('terminals.bulk.action.LOCK')).not.toBeInTheDocument()
  })

  it('offers LOCK only when every selected device is unlocked', () => {
    const capabilities = {
      ...baseCapabilities,
      supportedRemoteCommands: [TpvCommandType.LOCK, TpvCommandType.UNLOCK],
    }
    const first = orgTerminal(capabilities)
    const second = { ...orgTerminal(capabilities), id: 'device-2', name: 'Caja 2' }

    renderWithClient(
      <OrgTerminalsBulkBar orgId="org-1" selected={[first, second]} onClear={vi.fn()} onComplete={vi.fn()} />,
    )

    expect(screen.getByText('terminals.bulk.action.LOCK')).toBeInTheDocument()
    expect(screen.queryByText('terminals.bulk.action.UNLOCK')).not.toBeInTheDocument()
  })

  it('offers UNLOCK only when every selected device is locked', () => {
    const capabilities = {
      ...baseCapabilities,
      supportedRemoteCommands: [TpvCommandType.LOCK, TpvCommandType.UNLOCK],
    }
    const first = { ...orgTerminal(capabilities), isLocked: true }
    const second = { ...orgTerminal(capabilities), id: 'device-2', name: 'Caja 2', isLocked: true }

    renderWithClient(
      <OrgTerminalsBulkBar orgId="org-1" selected={[first, second]} onClear={vi.fn()} onComplete={vi.fn()} />,
    )

    expect(screen.getByText('terminals.bulk.action.UNLOCK')).toBeInTheDocument()
    expect(screen.queryByText('terminals.bulk.action.LOCK')).not.toBeInTheDocument()
  })

  it('offers neither LOCK nor UNLOCK for a mixed lock selection', () => {
    const capabilities = {
      ...baseCapabilities,
      supportedRemoteCommands: [TpvCommandType.LOCK, TpvCommandType.UNLOCK],
    }
    const first = orgTerminal(capabilities)
    const second = { ...orgTerminal(capabilities), id: 'device-2', name: 'Caja 2', isLocked: true }

    renderWithClient(
      <OrgTerminalsBulkBar orgId="org-1" selected={[first, second]} onClear={vi.fn()} onComplete={vi.fn()} />,
    )

    expect(screen.queryByText('terminals.bulk.action.LOCK')).not.toBeInTheDocument()
    expect(screen.queryByText('terminals.bulk.action.UNLOCK')).not.toBeInTheDocument()
  })

  it('revalidates lock state inside the bulk mutation when selection becomes stale', async () => {
    const capabilities = {
      ...baseCapabilities,
      supportedRemoteCommands: [TpvCommandType.LOCK, TpvCommandType.UNLOCK],
    }
    const first = orgTerminal(capabilities)
    const second = { ...orgTerminal(capabilities), id: 'device-2', name: 'Caja 2' }
    const selected = [first, second]

    renderWithClient(
      <OrgTerminalsBulkBar orgId="org-1" selected={selected} onClear={vi.fn()} onComplete={vi.fn()} />,
    )

    fireEvent.click(screen.getByText('terminals.bulk.action.LOCK'))
    second.isLocked = true
    const lockActions = screen.getAllByText('terminals.bulk.action.LOCK')
    fireEvent.click(lockActions[lockActions.length - 1])

    await new Promise(resolve => setTimeout(resolve, 25))
    expect(mocks.bulkCommandOrgTerminals).not.toHaveBeenCalled()
  })
})
