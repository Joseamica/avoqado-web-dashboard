import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'

vi.mock('@/api', () => ({
  default: {
    post: vi.fn(),
    delete: vi.fn(),
  },
}))

import api from '@/api'
import {
  cancelDisplayModeRequest,
  createDisplayModeRequest,
  type DisplayModeMutationData,
  type EffectiveDeviceCapabilities,
} from '@/services/tpv.service'
import { COMMAND_DEFINITIONS, TpvCommandPriority, TpvCommandType, UI_AVAILABLE_COMMANDS } from '@/types/tpv-commands'
import {
  canAcceptTerminalPaymentRequests,
  canActivate,
  canConfigurePayments,
  canDeactivate,
  canRequestDisplayInversion,
  canSendCommand,
  getCommonSupportedRemoteCommands,
  getDeviceActionPolicy,
  getCapabilityStateTranslationKey,
  isActivationPending,
} from '../deviceCapabilities'

const mockedApi = api as unknown as {
  post: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

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

const mutationData: DisplayModeMutationData = {
  mutated: true,
  version: 4,
  request: {
    requestId: 'request-1',
    desiredInverted: true,
    status: 'PENDING',
    requestedAt: '2026-08-31T12:00:00.000Z',
    requestedBy: 'staff-1',
    expiresAt: '2026-08-31T12:15:00.000Z',
  },
  customerDisplayInverted: false,
  previousCustomerDisplayInverted: false,
}

describe('device capability helpers', () => {
  it('reads activation support only from requiresActivation', () => {
    expect(canActivate(baseCapabilities)).toBe(false)
    expect(canActivate({ ...baseCapabilities, requiresActivation: true })).toBe(true)
  })

  it('reads payment configuration support independently', () => {
    expect(canConfigurePayments(baseCapabilities)).toBe(false)
    expect(canConfigurePayments({ ...baseCapabilities, canManagePaymentConfiguration: true })).toBe(true)
  })

  it('reads terminal payment request support independently', () => {
    expect(canAcceptTerminalPaymentRequests(baseCapabilities)).toBe(false)
    expect(
      canAcceptTerminalPaymentRequests({
        ...baseCapabilities,
        canAcceptTerminalPaymentRequests: true,
      }),
    ).toBe(true)
  })

  it('allows only commands present in the server allowlist', () => {
    const capabilities = {
      ...baseCapabilities,
      supportedRemoteCommands: [TpvCommandType.LOCK],
    }

    expect(canSendCommand(capabilities, TpvCommandType.LOCK)).toBe(true)
    expect(canSendCommand(capabilities, TpvCommandType.RESTART)).toBe(false)
  })

  it('accepts the AngelPay merchant command emitted by the server capability DTO', () => {
    expect(TpvCommandType.FETCH_ANGELPAY_MERCHANTS).toBe('FETCH_ANGELPAY_MERCHANTS')
    const capabilities = {
      ...baseCapabilities,
      supportedRemoteCommands: [TpvCommandType.FETCH_ANGELPAY_MERCHANTS],
    }

    expect(canSendCommand(capabilities, TpvCommandType.FETCH_ANGELPAY_MERCHANTS)).toBe(true)
  })

  it('catalogs AngelPay merchant discovery without exposing it in venue command UI', () => {
    expect(COMMAND_DEFINITIONS[TpvCommandType.FETCH_ANGELPAY_MERCHANTS]).toEqual({
      type: TpvCommandType.FETCH_ANGELPAY_MERCHANTS,
      category: 'configuration',
      icon: 'RefreshCw',
      requiresOnline: true,
      requiresConfirmation: false,
      isDangerous: false,
      defaultPriority: TpvCommandPriority.NORMAL,
      hasPayload: true,
    })
    expect(UI_AVAILABLE_COMMANDS).not.toContain(TpvCommandType.FETCH_ANGELPAY_MERCHANTS)
  })

  it('uses canRequestInversion as the canonical display decision', () => {
    const reportedDisplay = {
      ...baseCapabilities,
      customerDisplay: {
        ...baseCapabilities.customerDisplay,
        presence: 'SUPPORTED' as const,
        invertibility: 'SUPPORTED' as const,
        stale: false,
      },
    }

    expect(canRequestDisplayInversion(reportedDisplay)).toBe(false)
    expect(
      canRequestDisplayInversion({
        ...baseCapabilities,
        customerDisplay: {
          ...baseCapabilities.customerDisplay,
          presence: 'UNSUPPORTED',
          invertibility: 'UNSUPPORTED',
          canRequestInversion: true,
        },
      }),
    ).toBe(true)
  })

  it.each([
    ['SUPPORTED', 'capabilities.states.supported'],
    ['UNSUPPORTED', 'capabilities.states.unsupported'],
    ['UNKNOWN', 'capabilities.states.unknown'],
  ] as const)('maps %s to its typed translation key', (state, expectedKey) => {
    expect(getCapabilityStateTranslationKey(state)).toBe(expectedKey)
  })

  it('keeps actor permissions outside technical helper inputs', () => {
    expectTypeOf(canActivate).parameters.toEqualTypeOf<[EffectiveDeviceCapabilities | null | undefined]>()
    expectTypeOf(canConfigurePayments).parameters.toEqualTypeOf<[EffectiveDeviceCapabilities | null | undefined]>()
    expectTypeOf(canAcceptTerminalPaymentRequests).parameters.toEqualTypeOf<[EffectiveDeviceCapabilities | null | undefined]>()
    expectTypeOf(canRequestDisplayInversion).parameters.toEqualTypeOf<[EffectiveDeviceCapabilities | null | undefined]>()
    expectTypeOf(canSendCommand).parameters.toEqualTypeOf<[
      EffectiveDeviceCapabilities | null | undefined,
      TpvCommandType,
    ]>()
  })

  it('fails closed while a legacy device has no capability projection', () => {
    expect(canActivate(undefined)).toBe(false)
    expect(canConfigurePayments(undefined)).toBe(false)
    expect(canRequestDisplayInversion(undefined)).toBe(false)
    expect(canSendCommand(undefined, TpvCommandType.RESTART)).toBe(false)
    expect(getDeviceActionPolicy(undefined, null)).toEqual({
      activationState: 'capabilities-unavailable',
      activationPending: false,
      canDeactivate: false,
      canConfigurePayments: false,
      canRequestDisplayInversion: false,
      supportedRemoteCommands: [],
    })
  })

  it('derives the same capability action policy for detail and organization surfaces', () => {
    const fixtures = {
      provisionedTpv: {
        ...baseCapabilities,
        requiresActivation: true,
        canManagePaymentConfiguration: true,
        supportedRemoteCommands: [TpvCommandType.RESTART, TpvCommandType.MAINTENANCE_MODE],
      },
      d3: {
        ...baseCapabilities,
        customerDisplay: {
          ...baseCapabilities.customerDisplay,
          presence: 'SUPPORTED' as const,
          invertibility: 'SUPPORTED' as const,
          canRequestInversion: true,
          stale: false,
        },
      },
      t3Pro: {
        ...baseCapabilities,
        customerDisplay: {
          ...baseCapabilities.customerDisplay,
          presence: 'UNSUPPORTED' as const,
          invertibility: 'UNSUPPORTED' as const,
          stale: false,
        },
      },
      phonePos: baseCapabilities,
    }

    expect(getDeviceActionPolicy(fixtures.provisionedTpv, null)).toEqual({
      activationState: 'pending',
      activationPending: true,
      canDeactivate: false,
      canConfigurePayments: true,
      canRequestDisplayInversion: false,
      supportedRemoteCommands: [TpvCommandType.RESTART, TpvCommandType.MAINTENANCE_MODE],
    })
    expect(getDeviceActionPolicy(fixtures.provisionedTpv, '2026-08-31T12:00:00.000Z')).toMatchObject({
      activationState: 'activated',
      activationPending: false,
      canDeactivate: true,
    })
    expect(getDeviceActionPolicy(fixtures.d3, null)).toEqual({
      activationState: 'not-required',
      activationPending: false,
      canDeactivate: false,
      canConfigurePayments: false,
      canRequestDisplayInversion: true,
      supportedRemoteCommands: [],
    })
    expect(getDeviceActionPolicy(fixtures.t3Pro, null)).toEqual({
      activationState: 'not-required',
      activationPending: false,
      canDeactivate: false,
      canConfigurePayments: false,
      canRequestDisplayInversion: false,
      supportedRemoteCommands: [],
    })
    expect(getDeviceActionPolicy(fixtures.phonePos, null)).toEqual(getDeviceActionPolicy(fixtures.t3Pro, null))
  })

  it('keeps lifecycle state and capability separate', () => {
    const provisioned = { ...baseCapabilities, requiresActivation: true }
    expect(isActivationPending(provisioned, null)).toBe(true)
    expect(isActivationPending(provisioned, '2026-08-31T12:00:00.000Z')).toBe(false)
    expect(canDeactivate(provisioned, null)).toBe(false)
    expect(canDeactivate(provisioned, '2026-08-31T12:00:00.000Z')).toBe(true)

    expect(isActivationPending(baseCapabilities, null)).toBe(false)
    expect(canDeactivate(baseCapabilities, '2026-08-31T12:00:00.000Z')).toBe(false)
  })

  it('distinguishes a missing capability projection from an explicit activation opt-out', () => {
    expect(getDeviceActionPolicy(undefined, null).activationState).toBe('capabilities-unavailable')
    expect(getDeviceActionPolicy(baseCapabilities, null).activationState).toBe('not-required')
  })

  it('intersects bulk commands across every selected device and excludes venue-internal commands', () => {
    const first = {
      ...baseCapabilities,
      supportedRemoteCommands: [
        TpvCommandType.RESTART,
        TpvCommandType.SYNC_DATA,
        TpvCommandType.FETCH_ANGELPAY_MERCHANTS,
      ],
    }
    const second = {
      ...baseCapabilities,
      supportedRemoteCommands: [TpvCommandType.RESTART, TpvCommandType.LOCK],
    }

    expect(getCommonSupportedRemoteCommands([first, second])).toEqual([TpvCommandType.RESTART])
    expect(getCommonSupportedRemoteCommands([first, undefined])).toEqual([])
    expect(getCommonSupportedRemoteCommands([])).toEqual([])
  })
})

describe('display mode request API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a durable request with the exact dashboard endpoint and envelope', async () => {
    mockedApi.post.mockResolvedValue({ data: { data: mutationData } })

    const result = await createDisplayModeRequest('venue-1', 'terminal-1', true)

    expect(mockedApi.post).toHaveBeenCalledWith('/api/v1/dashboard/venues/venue-1/terminals/terminal-1/display-mode-request', {
      desiredInverted: true,
    })
    expect(result).toEqual({ data: mutationData })
  })

  it('cancels a durable request with the exact dashboard endpoint and envelope', async () => {
    const cancelled = {
      ...mutationData,
      request: {
        ...mutationData.request!,
        status: 'CANCELLED' as const,
        resolvedAt: '2026-08-31T12:01:00.000Z',
      },
      disposition: 'IDEMPOTENT' as const,
    }
    mockedApi.delete.mockResolvedValue({ data: { data: cancelled } })

    const result = await cancelDisplayModeRequest('venue-1', 'terminal-1', 'request-1')

    expect(mockedApi.delete).toHaveBeenCalledWith('/api/v1/dashboard/venues/venue-1/terminals/terminal-1/display-mode-request/request-1')
    expect(result).toEqual({ data: cancelled })
  })
})
