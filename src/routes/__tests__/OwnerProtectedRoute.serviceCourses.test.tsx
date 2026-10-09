import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { OwnerProtectedRoute } from '../OwnerProtectedRoute'

const state = vi.hoisted(() => ({
  role: 'ADMIN',
  memberships: [{ organizationId: 'o1', role: 'OWNER' }],
  venues: [{ organizationId: 'o1', role: 'ADMIN', organization: { id: 'o1', slug: 'la-mesa' } }],
}))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { role: state.role, organizationMemberships: state.memberships },
    isAuthenticated: true,
    isLoading: false,
    allVenues: state.venues,
  }),
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
function page(url: string, wl = false) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path={wl ? '/wl/organizations/:orgSlug' : '/organizations/:orgId'} element={<OwnerProtectedRoute />}>
          <Route path="settings/service-courses" element={<p>Shared courses</p>} />
          <Route path="settings" element={<p>Legacy settings</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}
beforeEach(() => {
  state.role = 'ADMIN'
  state.memberships = [{ organizationId: 'o1', role: 'OWNER' }]
  state.venues[0].role = 'ADMIN'
})
it('a canonical organization OWNER can configure courses even when their branch role is ADMIN', () => {
  page('/organizations/o1/settings/service-courses')
  expect(screen.getByText('Shared courses')).toBeInTheDocument()
})
it('a white-label slug resolves to the same canonical organization membership', () => {
  page('/wl/organizations/la-mesa/settings/service-courses', true)
  expect(screen.getByText('Shared courses')).toBeInTheDocument()
})
it('ownership of another organization does not grant target access', () => {
  page('/organizations/o2/settings/service-courses')
  expect(screen.queryByText('Shared courses')).not.toBeInTheDocument()
})
it('venue OWNER alone cannot configure the organization catalog', () => {
  state.role = 'OWNER'
  state.memberships = []
  state.venues[0].role = 'OWNER'
  page('/organizations/o1/settings/service-courses')
  expect(screen.queryByText('Shared courses')).not.toBeInTheDocument()
})
it('does not broaden the existing settings route with new course-specific ownership', () => {
  page('/organizations/o1/settings')
  expect(screen.queryByText('Legacy settings')).not.toBeInTheDocument()
})
