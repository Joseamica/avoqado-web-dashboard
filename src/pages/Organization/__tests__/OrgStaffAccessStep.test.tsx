import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useOrgVenueAccessCandidates, useGrantOrgVenueAccess } from '@/hooks/use-org-venue-access'
import type { OrgVenueAccessCandidate } from '@/services/organizationDashboard.service'

// ─── Mocks ─────────────────────────────────────────────────────

vi.mock('@/hooks/use-org-venue-access', () => ({
  useOrgVenueAccessCandidates: vi.fn(),
  useGrantOrgVenueAccess: vi.fn(),
}))

const toastMock = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}))

// Echo the key (with interpolation) so we can assert on the row summary text.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === 'terminals.staffAccess.rowSummary') {
        return `summary:${options?.name}:${options?.role}:${options?.pin}`
      }
      if (key.startsWith('terminals.staffAccess.roles.')) {
        return key.replace('terminals.staffAccess.roles.', 'role:')
      }
      return (options?.defaultValue as string) || key
    },
  }),
}))

// Render the role <Select> as a native control so we can read its current value.
vi.mock('@/components/ui/select', () => ({
  Select: ({ value, children }: React.PropsWithChildren<{ value?: string; onValueChange?: (v: string) => void }>) => (
    <div data-testid="role-select" data-value={value}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SelectValue: () => <span data-testid="role-value" />,
  SelectContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SelectItem: ({ children }: React.PropsWithChildren<{ value?: string }>) => <div>{children}</div>,
}))

// Stub the search combobox: expose an "add" button per item so we can pick people.
vi.mock('@/components/search-combobox', () => ({
  SearchCombobox: ({
    items,
    onSelect,
  }: {
    items: { id: string; label: string }[]
    onSelect: (item: { id: string }) => void
  }) => (
    <div data-testid="picker">
      {items.map(item => (
        <button key={item.id} type="button" onClick={() => onSelect(item)}>
          add:{item.label}
        </button>
      ))}
    </div>
  ),
}))

// ─── Import component under test (AFTER all vi.mock calls) ────

import OrgStaffAccessStep from '../components/OrgStaffAccessStep'

const mockedCandidates = vi.mocked(useOrgVenueAccessCandidates)
const mockedGrant = vi.mocked(useGrantOrgVenueAccess)

// ─── Fixtures ──────────────────────────────────────────────────

const sourcePerson: OrgVenueAccessCandidate = {
  staffId: 'staff-1',
  name: 'Isaac Promotor',
  email: 'isaac@example.com',
  inSourceVenue: true,
  currentRoleAtSource: 'CASHIER',
  alreadyAtDestination: false,
  currentRoleAtDestination: null,
  suggestedPin: '1234',
  rolesHeld: ['CASHIER'],
}

const otherPerson: OrgVenueAccessCandidate = {
  staffId: 'staff-2',
  name: 'Maria Gerente',
  email: 'maria@example.com',
  inSourceVenue: false,
  currentRoleAtSource: null,
  alreadyAtDestination: true,
  currentRoleAtDestination: 'MANAGER',
  suggestedPin: null,
  rolesHeld: ['MANAGER'],
}

function mockCandidates(list: OrgVenueAccessCandidate[]) {
  mockedCandidates.mockReturnValue({ data: list, isLoading: false } as any)
}

let mutateImpl: ReturnType<typeof vi.fn>

function mockMutation(impl?: (vars: any, opts: any) => void) {
  mutateImpl = vi.fn(impl ?? (() => {}))
  mockedGrant.mockReturnValue({ mutate: mutateImpl, isPending: false } as any)
}

// ─── Tests ─────────────────────────────────────────────────────

describe('OrgStaffAccessStep', () => {
  beforeEach(() => {
    toastMock.mockReset()
    mockMutation()
  })

  it('pre-seeds the people who used the terminal at the source venue and shows a plain summary', () => {
    mockCandidates([sourcePerson, otherPerson])

    render(
      <OrgStaffAccessStep
        orgId="org-1"
        destVenueId="venue-dest"
        sourceVenueId="venue-src"
        destVenueName="Sucursal Centro"
        onDone={vi.fn()}
        onSkip={vi.fn()}
      />,
    )

    // The source-venue person is auto-added; the role defaults to their source role,
    // the PIN is pre-filled with the suggested PIN.
    expect(screen.getByText('Isaac Promotor')).toBeInTheDocument()
    expect(screen.getByText('summary:Isaac Promotor:role:CASHIER:1234')).toBeInTheDocument()

    // The non-source person is NOT pre-added (only offered in the picker).
    expect(screen.queryByText('Maria Gerente')).not.toBeInTheDocument()
  })

  it('posts the expected grants when the primary button is clicked', () => {
    const onDone = vi.fn()
    mockCandidates([sourcePerson])
    mockMutation((_, opts) => opts.onSuccess?.())

    render(
      <OrgStaffAccessStep
        orgId="org-1"
        destVenueId="venue-dest"
        sourceVenueId="venue-src"
        destVenueName="Sucursal Centro"
        onDone={onDone}
        onSkip={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByText('terminals.staffAccess.grantAndContinue'))

    expect(mutateImpl).toHaveBeenCalledTimes(1)
    const [vars] = mutateImpl.mock.calls[0]
    expect(vars).toMatchObject({
      orgId: 'org-1',
      venueId: 'venue-dest',
      grants: [{ staffId: 'staff-1', role: 'CASHIER', pin: '1234' }],
    })
    // onSuccess wired through → onDone called, success toast shown.
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(toastMock).toHaveBeenCalled()
  })

  it('surfaces the backend error message verbatim on grant failure', () => {
    mockCandidates([sourcePerson])
    mockMutation((_, opts) =>
      opts.onError?.({ response: { data: { message: 'Este PIN ya está en uso en esta sucursal' } } }),
    )

    render(
      <OrgStaffAccessStep
        orgId="org-1"
        destVenueId="venue-dest"
        sourceVenueId="venue-src"
        onDone={vi.fn()}
        onSkip={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByText('terminals.staffAccess.grantAndContinue'))

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        description: 'Este PIN ya está en uso en esta sucursal',
      }),
    )
  })

  it('lets the owner add a person from the picker', () => {
    mockCandidates([otherPerson])

    render(
      <OrgStaffAccessStep
        orgId="org-1"
        destVenueId="venue-dest"
        onDone={vi.fn()}
        onSkip={vi.fn()}
      />,
    )

    // Not pre-added (no source venue) → appears only in the picker.
    expect(screen.queryByText('Maria Gerente')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('add:Maria Gerente'))

    // Now added as a row; already-at-destination badge shown.
    expect(screen.getByText('Maria Gerente')).toBeInTheDocument()
    expect(screen.getByText('terminals.staffAccess.alreadyHasAccess')).toBeInTheDocument()
  })
})
