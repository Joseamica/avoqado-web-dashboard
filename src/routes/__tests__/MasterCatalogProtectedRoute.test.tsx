import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MasterCatalogProtectedRoute } from '@/routes/MasterCatalogProtectedRoute'
import { useMasterCatalogAccess } from '@/features/master-catalog/use-master-catalog-access'
import { useAuth } from '@/context/AuthContext'
import { deniedAccess } from '@/features/master-catalog/types'
import type { MasterCatalogAccess } from '@/features/master-catalog/types'

vi.mock('@/features/master-catalog/use-master-catalog-access', () => ({
  useMasterCatalogAccess: vi.fn(),
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const mockedUseAccess = vi.mocked(useMasterCatalogAccess)
const mockedUseAuth = vi.mocked(useAuth)

const ORG_ID = 'org_pits'
const CATALOG_PATH = `/organizations/${ORG_ID}/master-catalog/items`

function grantedAccess(overrides: Partial<MasterCatalogAccess> = {}): MasterCatalogAccess {
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

function mockAccess(access: MasterCatalogAccess, isLoading = false) {
  mockedUseAccess.mockReturnValue({
    access,
    isLoading,
    isProbeEnabled: true,
    canRead: access.canRead,
    canMutateContent: access.canMutateContent,
    canConfigureControlPlane: access.canConfigureControlPlane,
    reasonCode: access.reasonCode,
    refetch: vi.fn(),
  })
}

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

function renderGuard(props: { require?: 'read' | 'mutate' } = {}) {
  return render(
    <MemoryRouter initialEntries={[CATALOG_PATH]}>
      <Routes>
        <Route path="/organizations/:orgId/master-catalog" element={<MasterCatalogProtectedRoute {...props} />}>
          <Route path="items" element={<div data-testid="catalog-content">Catálogo maestro</div>} />
        </Route>
        <Route path="/" element={<LocationProbe />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockedUseAccess.mockReset()
  mockedUseAuth.mockReturnValue({ user: { id: 'staff_1' }, isLoading: false } as unknown as ReturnType<typeof useAuth>)
})

describe('MasterCatalogProtectedRoute', () => {
  describe('renders nothing until the server has answered', () => {
    it('does not redirect a deep link while the authenticated user is still hydrating', () => {
      mockedUseAuth.mockReturnValue({ user: null, isLoading: true } as unknown as ReturnType<typeof useAuth>)
      mockAccess(deniedAccess(ORG_ID, 'ROLE_DENIED'))
      renderGuard()

      expect(screen.queryByTestId('location')).not.toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveAccessibleName('loading')
    })

    it('shows no catalog content while the access probe is loading', () => {
      mockAccess(deniedAccess(ORG_ID, 'DEPENDENCY_UNAVAILABLE'), true)
      renderGuard()

      expect(screen.queryByTestId('catalog-content')).not.toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveAccessibleName('loading')
    })

    it('does not redirect while loading, so a slow probe is not mistaken for a denial', () => {
      mockAccess(deniedAccess(ORG_ID, 'DEPENDENCY_UNAVAILABLE'), true)
      renderGuard()

      expect(screen.queryByTestId('location')).not.toBeInTheDocument()
    })
  })

  describe('every denial reason keeps the section dark', () => {
    const denials = [
      'ENTITLEMENT_MISSING',
      'ENTITLEMENT_INACTIVE',
      'MODULE_MISSING',
      'MODULE_INACTIVE',
      'CONFIG_MISSING',
      'CONFIG_INVALID',
      'GATE_DISABLED',
      'ROLE_DENIED',
      'DEPENDENCY_UNAVAILABLE',
    ] as const

    it.each(denials)('renders no catalog content when the reason is %s', reason => {
      mockAccess(deniedAccess(ORG_ID, reason))
      renderGuard()

      expect(screen.queryByTestId('catalog-content')).not.toBeInTheDocument()
    })

    it.each(denials)('navigates away from the catalog when the reason is %s', async reason => {
      mockAccess(deniedAccess(ORG_ID, reason))
      renderGuard()

      await waitFor(() => expect(screen.getByTestId('location')).toBeInTheDocument())
      expect(screen.getByTestId('location').textContent).not.toContain('master-catalog')
    })
  })

  describe('grants access only on an explicit allow', () => {
    it('renders the nested route when the server says the organization can read', async () => {
      mockAccess(grantedAccess())
      renderGuard()

      await waitFor(() => expect(screen.getByTestId('catalog-content')).toBeInTheDocument())
    })

    it('lets a VIEWER through the read guard', async () => {
      mockAccess(grantedAccess({ orgRole: 'VIEWER', canMutateContent: false }))
      renderGuard()

      await waitFor(() => expect(screen.getByTestId('catalog-content')).toBeInTheDocument())
    })
  })

  describe('a mutation guard is stricter than a read guard', () => {
    it('blocks a VIEWER from a mutate-scoped subtree', async () => {
      mockAccess(grantedAccess({ orgRole: 'VIEWER', canMutateContent: false }))
      renderGuard({ require: 'mutate' })

      await waitFor(() => expect(screen.getByTestId('location')).toBeInTheDocument())
      expect(screen.queryByTestId('catalog-content')).not.toBeInTheDocument()
    })

    it('admits an ADMIN who can mutate content', async () => {
      mockAccess(grantedAccess({ orgRole: 'ADMIN' }))
      renderGuard({ require: 'mutate' })

      await waitFor(() => expect(screen.getByTestId('catalog-content')).toBeInTheDocument())
    })
  })

  describe('the guard asks about the organization in the URL', () => {
    it('passes the route orgId to the access hook rather than a cached one', () => {
      mockAccess(grantedAccess())
      renderGuard()

      expect(mockedUseAccess).toHaveBeenCalledWith({ orgId: ORG_ID })
    })
  })
})
