import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { useAuth } from '@/context/AuthContext'
import { fetchMasterCatalogAccess } from './api'
import { deniedAccess, findMasterCatalogMembership } from './types'
import type { MasterCatalogAccess, MasterCatalogAccessReasonCode } from './types'

export interface UseMasterCatalogAccessOptions {
  organizationId?: string | null
  /** Alias used by route guards, which read `:orgId` straight off the URL. */
  orgId?: string | null
}

export interface UseMasterCatalogAccessResult {
  /** Always present. There is no state in which this is `undefined`. */
  access: MasterCatalogAccess
  isLoading: boolean
  /** False when the client deliberately skipped the network probe. */
  isProbeEnabled: boolean
  canRead: boolean
  canMutateContent: boolean
  canConfigureControlPlane: boolean
  reasonCode: MasterCatalogAccessReasonCode
  refetch: () => void
}

export const MASTER_CATALOG_ACCESS_QUERY_KEY = 'master-catalog-access'

function reasonForRequestFailure(error: unknown): MasterCatalogAccessReasonCode {
  const status =
    typeof error === 'object' && error !== null && 'response' in error
      ? (error as { response?: { status?: unknown } }).response?.status
      : undefined

  // A refused identity is a role verdict; everything else — including a
  // timeout, a 5xx and an offline client — is "we could not tell", which is
  // still a denial, just a differently worded one.
  return status === 401 || status === 403 ? 'ROLE_DENIED' : 'DEPENDENCY_UNAVAILABLE'
}

/**
 * Resolves whether the signed-in user may see the organization master catalog.
 *
 * Two independent gates, in this order:
 *
 *  1. The auth payload must already say the catalog is visible for this
 *     organization. Absent or false means the client makes **no** request at
 *     all, so an organization without the module never probes an endpoint it
 *     has no business touching.
 *  2. The server endpoint decides. The cached auth hint is a visibility
 *     optimization, never an authorization.
 *
 * Everything unexpected resolves to a denial. The control-plane flag is always
 * clamped off here: turning the module on is a platform action and never
 * belongs to a standard dashboard session, whatever the payload says.
 */
export function useMasterCatalogAccess(options: UseMasterCatalogAccessOptions): UseMasterCatalogAccessResult {
  const { user } = useAuth()
  const organizationId = options.organizationId ?? options.orgId ?? null

  const isVisibleInAuth = useMemo(() => findMasterCatalogMembership(user, organizationId) !== null, [user, organizationId])
  const isProbeEnabled = Boolean(organizationId) && isVisibleInAuth

  const query = useQuery({
    queryKey: [MASTER_CATALOG_ACCESS_QUERY_KEY, organizationId],
    queryFn: () => fetchMasterCatalogAccess(organizationId as string),
    enabled: isProbeEnabled,
    retry: false,
    // Access is re-read on entry rather than served warm: an entitlement that
    // lapsed mid-session must close the section, not wait for a cache to age.
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
  })

  const access = useMemo<MasterCatalogAccess>(() => {
    const scopedId = organizationId ?? ''

    if (!isProbeEnabled) return deniedAccess(scopedId, 'ROLE_DENIED')
    if (query.isPending) return deniedAccess(scopedId, 'DEPENDENCY_UNAVAILABLE')
    if (query.isError) return deniedAccess(scopedId, reasonForRequestFailure(query.error))

    const resolved = query.data
    if (!resolved) return deniedAccess(scopedId, 'DEPENDENCY_UNAVAILABLE')

    // The rollout gate is re-applied client-side: a readable row whose core
    // gate is off is a default-off organization, and rendering the section
    // would advertise a module nobody turned on.
    if (resolved.canRead && resolved.config?.catalogCoreEnabled !== true) {
      return deniedAccess(scopedId, 'GATE_DISABLED')
    }

    return { ...resolved, canConfigureControlPlane: false }
  }, [isProbeEnabled, organizationId, query.data, query.error, query.isError, query.isPending])

  return {
    access,
    isLoading: isProbeEnabled && query.isPending,
    isProbeEnabled,
    canRead: access.canRead,
    canMutateContent: access.canMutateContent,
    canConfigureControlPlane: access.canConfigureControlPlane,
    reasonCode: access.reasonCode,
    refetch: query.refetch,
  }
}
