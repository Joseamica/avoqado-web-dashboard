/**
 * MasterCatalogProtectedRoute — fail-closed guard for the organization master catalog.
 *
 * Unlike the other organization routes, this one is NOT nested under
 * `OwnerProtectedRoute`: the master catalog is readable by an org VIEWER, and
 * widening the OWNER guard to allow that would hand VIEWERs the owner-only
 * settings and team pages too. It authorizes against the server's own
 * `/master-catalog/access` endpoint instead, on every entry.
 *
 * Three states, and only one of them renders anything:
 *  - probing  → a spinner. Never a redirect: a slow answer is not a denial.
 *  - denied   → redirect, carrying the reason so the destination can explain it.
 *  - allowed  → the nested routes.
 *
 * Usage:
 * ```tsx
 * <Route path="/organizations/:orgId/master-catalog" element={<MasterCatalogProtectedRoute />}>
 *   <Route path="items" element={<CatalogItemsPage />} />
 *   <Route element={<MasterCatalogProtectedRoute require="mutate" />}>
 *     <Route path="import" element={<CatalogImportPage />} />
 *   </Route>
 * </Route>
 * ```
 */

import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/context/AuthContext'
import { useMasterCatalogAccess } from '@/features/master-catalog/use-master-catalog-access'

interface MasterCatalogProtectedRouteProps {
  /**
   * `read` admits OWNER, ADMIN and VIEWER. `mutate` admits only the roles the
   * server reports as able to change catalog content.
   */
  require?: 'read' | 'mutate'
  /** Where a denied user lands. Must never be inside the catalog itself. */
  fallbackPath?: string
}

export function MasterCatalogProtectedRoute({ require = 'read', fallbackPath = '/' }: MasterCatalogProtectedRouteProps) {
  const { t } = useTranslation('common')
  const { orgId } = useParams<{ orgId: string }>()
  const location = useLocation()
  const { isLoading: isAuthLoading } = useAuth()
  const { access, isLoading, canRead, canMutateContent, reasonCode } = useMasterCatalogAccess({ orgId: orgId ?? null })

  // ProtectedRoute deliberately renders optimistically when a session hint is
  // present. Wait for the actual user before interpreting a missing cached
  // membership as a denial, otherwise a valid catalog deep-link briefly sees
  // `user=null` and is redirected to the default venue.
  if (isAuthLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]" role="status" aria-label={t('loading')}>
        <div className="motion-safe:animate-spin rounded-full h-8 w-8 border-b-2 border-primary" aria-hidden="true" />
      </div>
    )
  }

  const isAllowed = require === 'mutate' ? canRead && canMutateContent : canRead

  if (!isAllowed) {
    // The reason travels with the redirect so the landing screen can say what
    // is missing and who turns it on, instead of bouncing the user in silence.
    return (
      <Navigate
        to={fallbackPath}
        replace
        state={{
          from: location.pathname,
          masterCatalogReason: reasonCode,
          masterCatalogOrganizationId: access.organizationId || null,
        }}
      />
    )
  }

  return <Outlet />
}

export default MasterCatalogProtectedRoute
