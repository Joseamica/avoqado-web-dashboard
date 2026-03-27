import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useCurrentOrganization } from '@/hooks/use-current-organization'
import { useAuth } from '@/context/AuthContext'
import { useCurrentVenue } from '@/hooks/use-current-venue'

// ─── Mocks ─────────────────────────────────────────────────────

vi.mock('@/hooks/use-current-organization', () => ({
  useCurrentOrganization: vi.fn(),
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      (options?.defaultValue as string) || key,
  }),
}))

// Mock the sidebar primitives — render as simple HTML so we can query text
vi.mock('@/components/ui/sidebar', () => ({
  Sidebar: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <aside data-testid="sidebar" {...props}>{children}</aside>
  ),
  SidebarContent: ({ children }: React.PropsWithChildren) => <div data-testid="sidebar-content">{children}</div>,
  SidebarFooter: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SidebarHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SidebarMenu: ({ children }: React.PropsWithChildren) => <ul>{children}</ul>,
  SidebarMenuButton: ({ children }: React.PropsWithChildren<Record<string, unknown>>) => <div>{children}</div>,
  SidebarMenuItem: ({ children }: React.PropsWithChildren) => <li>{children}</li>,
  SidebarRail: () => <div />,
  SidebarGroup: ({ children }: React.PropsWithChildren) => <div data-testid="sidebar-group">{children}</div>,
  SidebarGroupLabel: ({ children }: React.PropsWithChildren) => <h3 data-testid="group-label">{children}</h3>,
  SidebarGroupContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  useSidebar: () => ({ isMobile: false }),
}))

vi.mock('@/components/Sidebar/nav-user', () => ({
  NavUser: () => <div data-testid="nav-user" />,
}))

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children }: React.PropsWithChildren<Record<string, unknown>>) => <div>{children}</div>,
  AvatarImage: () => <span />,
  AvatarFallback: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: React.PropsWithChildren<Record<string, unknown>>) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: React.PropsWithChildren<Record<string, unknown>>) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: React.PropsWithChildren<Record<string, unknown>>) => <div>{children}</div>,
  DropdownMenuLabel: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: React.PropsWithChildren<Record<string, unknown>>) => <div>{children}</div>,
}))

// ─── Import component under test (AFTER all vi.mock calls) ────

import OrgSidebar from '../components/OrgSidebar'

// ─── Typed mock accessors ──────────────────────────────────────

const mockedUseAuth = vi.mocked(useAuth)
const mockedUseCurrentOrganization = vi.mocked(useCurrentOrganization)
const mockedUseCurrentVenue = vi.mocked(useCurrentVenue)

// ─── Helpers ───────────────────────────────────────────────────

const ORG_ID = 'org-test-001'

function makeWLVenue(orgId: string) {
  return {
    id: 'venue-alpha',
    name: 'Tienda Alpha',
    slug: 'venue-alpha',
    organizationId: orgId,
    organization: { id: orgId, name: 'Test Organization' },
    role: 'OWNER',
    modules: [
      { module: { id: 'mod-wl', code: 'WHITE_LABEL_DASHBOARD', name: 'White Label' }, enabled: true },
    ],
    features: [],
  }
}

function makeNonWLVenue(orgId: string) {
  return {
    id: 'venue-alpha',
    name: 'Tienda Alpha',
    slug: 'venue-alpha',
    organizationId: orgId,
    organization: { id: orgId, name: 'Test Organization' },
    role: 'OWNER',
    modules: [
      { module: { id: 'mod-team', code: 'TEAM', name: 'Team Management' }, enabled: true },
    ],
    features: [],
  }
}

function renderSidebar() {
  return render(
    <MemoryRouter initialEntries={[`/organizations/${ORG_ID}`]}>
      <Routes>
        <Route path="/organizations/:orgId/*" element={<OrgSidebar />} />
      </Routes>
    </MemoryRouter>,
  )
}

// ─── Tests ─────────────────────────────────────────────────────

describe('OrgSidebar', () => {
  beforeEach(() => {
    mockedUseCurrentOrganization.mockReturnValue({
      organization: { name: 'Test Organization' } as any,
      orgId: ORG_ID,
      orgSlug: ORG_ID,
      basePath: `/organizations/${ORG_ID}`,
      venues: [],
      isLoading: false,
      isOwner: true,
      error: null,
    })

    mockedUseCurrentVenue.mockReturnValue({
      venue: null,
      venueId: null,
      venueSlug: null,
      isLoading: false,
      hasVenueAccess: false,
      isWhiteLabelMode: false,
      venueBasePath: '/venues',
      fullBasePath: '/venues',
    } as any)
  })

  it('shows "Configuracion Org." section when org has WHITE_LABEL_DASHBOARD module', () => {
    const wlVenue = makeWLVenue(ORG_ID)

    mockedUseAuth.mockReturnValue({
      user: { role: 'OWNER', firstName: 'Test', lastName: 'User', email: 'test@test.com' },
      allVenues: [wlVenue],
      isAuthenticated: true,
    } as any)

    renderSidebar()

    // Section label should be present
    expect(screen.getByText('Configuración Org.')).toBeInTheDocument()

    // All 5 items should be present
    expect(screen.getByText('Configuración TPV')).toBeInTheDocument()
    expect(screen.getByText('Metas')).toBeInTheDocument()
    expect(screen.getByText('Categorías')).toBeInTheDocument()
    expect(screen.getByText('Mensajes')).toBeInTheDocument()
    expect(screen.getByText('Asignación de Personal')).toBeInTheDocument()
  })

  it('hides "Configuracion Org." section when org has no WHITE_LABEL_DASHBOARD module', () => {
    const nonWLVenue = makeNonWLVenue(ORG_ID)

    mockedUseAuth.mockReturnValue({
      user: { role: 'OWNER', firstName: 'Test', lastName: 'User', email: 'test@test.com' },
      allVenues: [nonWLVenue],
      isAuthenticated: true,
    } as any)

    renderSidebar()

    // Section label should NOT be present
    expect(screen.queryByText('Configuración Org.')).not.toBeInTheDocument()

    // WL-specific items should NOT be present
    expect(screen.queryByText('Configuración TPV')).not.toBeInTheDocument()
    expect(screen.queryByText('Asignación de Personal')).not.toBeInTheDocument()
  })

  it('renders the staff assignment link pointing to the correct route', () => {
    const wlVenue = makeWLVenue(ORG_ID)

    mockedUseAuth.mockReturnValue({
      user: { role: 'OWNER', firstName: 'Test', lastName: 'User', email: 'test@test.com' },
      allVenues: [wlVenue],
      isAuthenticated: true,
    } as any)

    renderSidebar()

    // Find the NavLink for staff assignment by its text
    const staffLink = screen.getByText('Asignación de Personal')
    expect(staffLink).toBeInTheDocument()

    // The NavLink wrapping it should point to the correct href
    const anchor = staffLink.closest('a')
    expect(anchor).toHaveAttribute('href', `/organizations/${ORG_ID}/staff-assignment`)
  })
})
