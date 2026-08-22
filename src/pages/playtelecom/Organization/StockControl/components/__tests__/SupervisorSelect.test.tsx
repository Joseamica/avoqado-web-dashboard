/**
 * SupervisorSelect unit tests.
 *
 * The bug this guards: the Supervisor dropdown used to read the OWNER-only
 * `/team` endpoint, so an ADMIN — who DOES hold `sim-custody:assign-to-supervisor`
 * and `sim-custody:reassign-supervisor` — got a 403 swallowed by the query and an
 * EMPTY, MUTE dropdown. Fixing the data source is half the fix; the other half is
 * that an empty list must never be silent ("apagado se VE y se EXPLICA").
 *
 * Covers:
 *   - Empty list → explains WHAT is missing, HOW to fix it, WHO to ask.
 *   - Error → explains + offers a retry that actually calls refetch().
 *   - Populated → no warning, control enabled.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import type { UseQueryResult } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { SupervisorSelect } from '../SupervisorSelect'
import type { OrgStaffOption } from '@/hooks/use-org-staff-by-role'

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeQuery(
  partial: Partial<{ data: OrgStaffOption[]; isLoading: boolean; isError: boolean; refetch: () => void }>,
): UseQueryResult<OrgStaffOption[]> {
  return {
    data: partial.data ?? [],
    isLoading: partial.isLoading ?? false,
    isError: partial.isError ?? false,
    refetch: partial.refetch ?? vi.fn(),
  } as unknown as UseQueryResult<OrgStaffOption[]>
}

const juan: OrgStaffOption = {
  id: 'staff-mgr-1',
  firstName: 'Juan',
  lastName: 'Nájera',
  fullName: 'Juan Nájera',
  email: 'juan@pt.mx',
  employeeCode: 'PT-014',
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('SupervisorSelect', () => {
  it('explains WHAT is missing, HOW to fix it and WHO to ask when the list is empty', () => {
    render(<SupervisorSelect value="" onValueChange={vi.fn()} query={makeQuery({ data: [] })} />)

    expect(screen.getByText(/no tiene Supervisores activos/i)).toBeInTheDocument()
    // HOW: the role that makes someone a Supervisor.
    expect(screen.getByText(/Gerente/)).toBeInTheDocument()
    // WHO: the person to escalate to when you can't change roles yourself.
    expect(screen.getByText(/pídeselo al dueño \(OWNER\) de la organización/i)).toBeInTheDocument()
    // The control stays VISIBLE (never hidden), just not selectable.
    expect(screen.getByText('No hay Supervisores disponibles')).toBeInTheDocument()
  })

  it('explains the failure and retries on demand when the lookup errors', () => {
    const refetch = vi.fn()
    render(<SupervisorSelect value="" onValueChange={vi.fn()} query={makeQuery({ isError: true, refetch })} />)

    expect(screen.getByText(/No pudimos cargar la lista de Supervisores/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/i }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('shows no warning and offers the supervisor when the list has results', () => {
    render(<SupervisorSelect value="" onValueChange={vi.fn()} query={makeQuery({ data: [juan] })} />)

    expect(screen.queryByText(/no tiene Supervisores activos/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/No pudimos cargar/i)).not.toBeInTheDocument()
    expect(screen.getByText('Selecciona un Supervisor')).toBeInTheDocument()
  })

  it('renders the employeeCode suffix so two people with the same name can be told apart', () => {
    render(<SupervisorSelect value={juan.id} onValueChange={vi.fn()} query={makeQuery({ data: [juan] })} />)

    expect(screen.getByText('Juan Nájera (PT-014)')).toBeInTheDocument()
  })

  it('uses the custom label when given (Reasignar dialog says "Supervisor destino")', () => {
    render(<SupervisorSelect label="Supervisor destino" value="" onValueChange={vi.fn()} query={makeQuery({ data: [juan] })} />)

    expect(screen.getByText('Supervisor destino')).toBeInTheDocument()
  })
})
