import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import api from '@/api'
import { useAuth } from '@/context/AuthContext'
import { useMasterCatalogAccess } from './use-master-catalog-access'
import type { MasterCatalogAccess } from './types'

vi.mock('@/api', () => ({
  default: { get: vi.fn() },
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

const mockedApiGet = vi.mocked(api.get)
const mockedUseAuth = vi.mocked(useAuth)

const ORG_ID = 'org_pits'

/** A membership payload shaped like the auth-status field Task 12's server half will add. */
function membership(overrides: Partial<{ organizationId: string; role: string; masterCatalogVisible: unknown }> = {}) {
  return {
    organizationId: ORG_ID,
    organizationName: 'PITS',
    role: 'OWNER',
    masterCatalogVisible: true,
    ...overrides,
  }
}

function setAuthUser(user: unknown) {
  mockedUseAuth.mockReturnValue({ user, isLoading: false } as unknown as ReturnType<typeof useAuth>)
}

function accessPayload(overrides: Partial<MasterCatalogAccess> = {}): MasterCatalogAccess {
  return {
    organizationId: ORG_ID,
    orgRole: 'OWNER',
    entitlementActive: true,
    moduleActive: true,
    config: {
      schemaVersion: 1,
      catalogCoreEnabled: true,
      identifiersEnabled: false,
      regionalPricingEnabled: false,
      governanceMode: 'ADVISORY',
    },
    reasonCode: 'ACCESSIBLE',
    canRead: true,
    canMutateContent: true,
    canConfigureControlPlane: false,
    ...overrides,
  }
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

function renderAccess(orgId: string | null | undefined = ORG_ID) {
  return renderHook(() => useMasterCatalogAccess({ orgId }), { wrapper })
}

function axiosErrorWith(status: number, data: unknown): AxiosError {
  const error = new AxiosError('Request failed')
  error.response = { status, statusText: '', headers: new AxiosHeaders(), config: { headers: new AxiosHeaders() }, data }
  return error
}

beforeEach(() => {
  mockedApiGet.mockReset()
  setAuthUser({ id: 'staff_1', organizationMemberships: [membership()] })
})

describe('useMasterCatalogAccess', () => {
  describe('no probe unless auth already says the catalog is visible', () => {
    it('does not call the API when the auth payload has no memberships field at all', async () => {
      setAuthUser({ id: 'staff_1' })
      const { result } = renderAccess()

      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(mockedApiGet).not.toHaveBeenCalled()
      expect(result.current.isProbeEnabled).toBe(false)
      expect(result.current.canRead).toBe(false)
    })

    it('does not call the API when the membership hides the catalog', async () => {
      setAuthUser({ id: 'staff_1', organizationMemberships: [membership({ masterCatalogVisible: false })] })
      const { result } = renderAccess()

      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(mockedApiGet).not.toHaveBeenCalled()
      expect(result.current.canRead).toBe(false)
    })

    it('treats a non-boolean masterCatalogVisible as hidden', async () => {
      setAuthUser({ id: 'staff_1', organizationMemberships: [membership({ masterCatalogVisible: 'true' })] })
      const { result } = renderAccess()

      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(mockedApiGet).not.toHaveBeenCalled()
    })

    it('does not probe when the cached membership carries an unknown organization role', async () => {
      setAuthUser({ user: 'staff_1', organizationMemberships: [membership({ role: 'SUPERADMIN' })] })
      const { result } = renderAccess()

      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(mockedApiGet).not.toHaveBeenCalled()
      expect(result.current.canRead).toBe(false)
    })

    it('does not call the API for an organization the user is not a member of', async () => {
      setAuthUser({ id: 'staff_1', organizationMemberships: [membership({ organizationId: 'other_org' })] })
      const { result } = renderAccess()

      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(mockedApiGet).not.toHaveBeenCalled()
      expect(result.current.reasonCode).toBe('ROLE_DENIED')
    })

    it('does not call the API when there is no signed-in user', async () => {
      setAuthUser(null)
      const { result } = renderAccess()

      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(mockedApiGet).not.toHaveBeenCalled()
    })

    it('does not call the API when no organization is in scope', async () => {
      const { result } = renderAccess(null)

      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(mockedApiGet).not.toHaveBeenCalled()
    })

    it('ignores a memberships value that is not an array', async () => {
      setAuthUser({ id: 'staff_1', organizationMemberships: { [ORG_ID]: true } })
      const { result } = renderAccess()

      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(mockedApiGet).not.toHaveBeenCalled()
    })
  })

  describe('the server endpoint, not the cached token, is what grants access', () => {
    it('probes the organization-scoped access endpoint once visibility is signalled', async () => {
      mockedApiGet.mockResolvedValue({ data: { success: true, data: accessPayload() } })
      const { result } = renderAccess()

      await waitFor(() => expect(result.current.canRead).toBe(true))
      expect(mockedApiGet).toHaveBeenCalledWith(`/api/v1/dashboard/organizations/${ORG_ID}/master-catalog/access`)
    })

    it('denies read when auth says visible but the server says the entitlement is gone', async () => {
      mockedApiGet.mockResolvedValue({
        data: { success: true, data: accessPayload({ canRead: false, canMutateContent: false, reasonCode: 'ENTITLEMENT_INACTIVE' }) },
      })
      const { result } = renderAccess()

      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(result.current.canRead).toBe(false)
      expect(result.current.reasonCode).toBe('ENTITLEMENT_INACTIVE')
    })

    it('denies read while the probe is still in flight', () => {
      mockedApiGet.mockReturnValue(new Promise(() => {}))
      const { result } = renderAccess()

      expect(result.current.isLoading).toBe(true)
      expect(result.current.canRead).toBe(false)
      expect(result.current.canMutateContent).toBe(false)
    })
  })

  describe('reads and writes are separate verdicts', () => {
    it('lets a VIEWER read without granting content mutation', async () => {
      mockedApiGet.mockResolvedValue({
        data: { success: true, data: accessPayload({ orgRole: 'VIEWER', canMutateContent: false }) },
      })
      const { result } = renderAccess()

      await waitFor(() => expect(result.current.canRead).toBe(true))
      expect(result.current.canMutateContent).toBe(false)
    })

    it('never grants control-plane configuration to a standard dashboard user', async () => {
      mockedApiGet.mockResolvedValue({
        data: { success: true, data: accessPayload({ canConfigureControlPlane: true }) },
      })
      const { result } = renderAccess()

      await waitFor(() => expect(result.current.canRead).toBe(true))
      expect(result.current.canConfigureControlPlane).toBe(false)
    })
  })

  describe('anything unexpected is a denial, never an accident', () => {
    it('denies on a 403 and reports ROLE_DENIED', async () => {
      mockedApiGet.mockRejectedValue(axiosErrorWith(403, { message: 'no' }))
      const { result } = renderAccess()

      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(result.current.canRead).toBe(false)
      expect(result.current.reasonCode).toBe('ROLE_DENIED')
    })

    it('denies on a 503 and reports DEPENDENCY_UNAVAILABLE', async () => {
      mockedApiGet.mockRejectedValue(axiosErrorWith(503, { message: 'down' }))
      const { result } = renderAccess()

      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(result.current.canRead).toBe(false)
      expect(result.current.reasonCode).toBe('DEPENDENCY_UNAVAILABLE')
    })

    it('denies on a network failure with no response at all', async () => {
      mockedApiGet.mockRejectedValue(new Error('Network Error'))
      const { result } = renderAccess()

      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(result.current.canRead).toBe(false)
      expect(result.current.reasonCode).toBe('DEPENDENCY_UNAVAILABLE')
    })

    it('denies when the response body is not the documented envelope', async () => {
      mockedApiGet.mockResolvedValue({ data: { success: true, data: { canRead: 'yes' } } })
      const { result } = renderAccess()

      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(result.current.canRead).toBe(false)
      expect(result.current.reasonCode).toBe('DEPENDENCY_UNAVAILABLE')
    })

    it('denies when the payload belongs to a different organization', async () => {
      mockedApiGet.mockResolvedValue({ data: { success: true, data: accessPayload({ organizationId: 'someone_else' }) } })
      const { result } = renderAccess()

      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(result.current.canRead).toBe(false)
      expect(result.current.reasonCode).toBe('DEPENDENCY_UNAVAILABLE')
    })

    it('denies when core config is off even though the server flagged the row readable', async () => {
      mockedApiGet.mockResolvedValue({
        data: {
          success: true,
          data: accessPayload({
            config: {
              schemaVersion: 1,
              catalogCoreEnabled: false,
              identifiersEnabled: false,
              regionalPricingEnabled: false,
              governanceMode: 'OFF',
            },
          }),
        },
      })
      const { result } = renderAccess()

      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(result.current.canRead).toBe(false)
      expect(result.current.reasonCode).toBe('GATE_DISABLED')
    })

    it('always exposes an access object, so no caller can read undefined as permission', async () => {
      setAuthUser(null)
      const { result } = renderAccess()

      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(result.current.access.canRead).toBe(false)
      expect(result.current.access.organizationId).toBe(ORG_ID)
    })
  })
})
