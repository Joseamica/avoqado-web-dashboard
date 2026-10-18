/**
 * CollectFromSupervisorBulkDialog — Isaac pastes a column of ICCIDs and every
 * SIM a supervisor still holds goes back to the admin warehouse (Asana 1219467533602693).
 *
 * Covers: paste → one bulk call (deduped, with the batch reason), the per-row
 * summary (ok + the promotor rejection), the custody keys refreshed after the
 * write, the 500 cap, and the empty-list guard.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CollectFromSupervisorBulkDialog } from '../CollectFromSupervisorBulkDialog'
import { parseSerialList } from '../parseSerialList'

const mockCollect = vi.fn()
vi.mock('@/services/simCustody.service', () => ({
  collectSimsFromSupervisor: (...a: unknown[]) => mockCollect(...a),
}))
const mockSearchHook = vi.fn((..._a: unknown[]) => ({ data: { items: [] }, isFetching: false }))
vi.mock('../../hooks/useOrgStockItemsSearch', () => ({
  useOrgStockItemsSearch: (...a: unknown[]) => mockSearchHook(...a),
}))
const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ toast: (...a: unknown[]) => mockToast(...a) }))

function renderDialog() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  render(
    <QueryClientProvider client={queryClient}>
      <CollectFromSupervisorBulkDialog open onOpenChange={() => {}} orgId="org-1" />
    </QueryClientProvider>,
  )
  return { invalidate }
}

const textarea = () => screen.getByPlaceholderText(/8952140063000001111/)
const submit = () => screen.getByRole('button', { name: 'Recolectar SIMs' })

beforeEach(() => {
  vi.clearAllMocks()
  mockCollect.mockResolvedValue({
    summary: { total: 2, succeeded: 1, failed: 1 },
    results: [
      { serialNumber: 'SIM-1', status: 'ok', event: 'COLLECTED_FROM_SUPERVISOR' },
      {
        serialNumber: 'SIM-2',
        status: 'error',
        code: 'HAS_DOWNSTREAM_CUSTODY',
        message: 'El Supervisor aún tiene este SIM asignado a un Promotor. Recolecta primero del Promotor.',
      },
    ],
  })
})

describe('parseSerialList', () => {
  it('splits by line, comma, semicolon and tab, trims, and drops repeats', () => {
    expect(parseSerialList(' SIM-1\nSIM-2,SIM-3;SIM-1\tSIM-4\n\n')).toEqual(['SIM-1', 'SIM-2', 'SIM-3', 'SIM-4'])
  })
})

describe('CollectFromSupervisorBulkDialog', () => {
  it('tells the operator up front that promotor SIMs are not collected', () => {
    renderDialog()
    expect(screen.getByText(/Los que un Promotor ya trae encima NO se recolectan/)).toBeInTheDocument()
  })

  it('pasted list → ONE bulk call, deduped, with the default reason', async () => {
    renderDialog()
    fireEvent.change(textarea(), { target: { value: 'SIM-1\nSIM-2\nSIM-1' } })
    fireEvent.click(submit())

    await waitFor(() => expect(mockCollect).toHaveBeenCalledTimes(1))
    expect(mockCollect).toHaveBeenCalledWith(
      'org-1',
      { serialNumbers: ['SIM-1', 'SIM-2'], reason: 'SUPERVISOR_COLLECTION' },
      undefined,
      expect.any(String),
    )
  })

  it('shows the per-row summary: collected and the promotor rejection with its reason', async () => {
    renderDialog()
    fireEvent.change(textarea(), { target: { value: 'SIM-1\nSIM-2' } })
    fireEvent.click(submit())

    expect(await screen.findByText('Recolectado')).toBeInTheDocument()
    expect(screen.getByText('HAS_DOWNSTREAM_CUSTODY')).toBeInTheDocument()
    expect(screen.getByText(/Recolecta primero del Promotor/)).toBeInTheDocument()
    expect(screen.getByText('1 OK')).toBeInTheDocument()
    expect(screen.getByText('1 errores')).toBeInTheDocument()
  })

  it('refreshes every key that reads custody after the write (the list must not stay stale)', async () => {
    const { invalidate } = renderDialog()
    fireEvent.change(textarea(), { target: { value: 'SIM-1' } })
    fireEvent.click(submit())

    await screen.findByText('Recolectado')
    const keys = invalidate.mock.calls.map(c => (c[0] as { queryKey: string[] }).queryKey[0])
    expect(keys).toEqual(
      expect.arrayContaining([
        'org-stock-items',
        'org-stock-items-search',
        'org-stock-custody',
        'org-stock-summary',
        'org-inventory-by-responsible',
        'sim-custody-events',
        // the store-level stock page (movements, responsibles) also shows who holds each SIM (Codex r1 #5)
        'stock',
      ]),
    )
  })

  it('a manual retry of the SAME list after a failure reuses the idempotency key (Codex r1 #3)', async () => {
    mockCollect.mockRejectedValueOnce(Object.assign(new Error('Network Error'), {}))
    renderDialog()
    fireEvent.change(textarea(), { target: { value: 'SIM-1\nSIM-2' } })
    fireEvent.click(submit())
    await waitFor(() => expect(mockToast).toHaveBeenCalled())

    fireEvent.click(submit())
    await screen.findByText('Recolectado')

    const [first, second] = mockCollect.mock.calls.map(c => c[3])
    expect(first).toEqual(expect.any(String))
    expect(second).toBe(first)
  })

  it('a DIFFERENT list gets a new idempotency key (the server would reject the reused one)', async () => {
    mockCollect.mockRejectedValueOnce(new Error('Network Error'))
    renderDialog()
    fireEvent.change(textarea(), { target: { value: 'SIM-1' } })
    fireEvent.click(submit())
    await waitFor(() => expect(mockToast).toHaveBeenCalled())

    fireEvent.change(textarea(), { target: { value: 'SIM-1\nSIM-9' } })
    fireEvent.click(submit())
    await screen.findByText('Recolectado')

    const [first, second] = mockCollect.mock.calls.map(c => c[3])
    expect(second).not.toBe(first)
  })

  it('shows the server message when a retry arrives while the first is still running', async () => {
    mockCollect.mockRejectedValueOnce(
      Object.assign(new Error('Request failed with status code 409'), {
        response: { data: { error: 'IDEMPOTENCY_IN_FLIGHT', message: 'La operación está en curso. Reintenta en unos segundos.' } },
      }),
    )
    renderDialog()
    fireEvent.change(textarea(), { target: { value: 'SIM-1' } })
    fireEvent.click(submit())
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'La operación está en curso. Reintenta en unos segundos.' })),
    )
  })

  it('Buscar sees SIMs of any age — no 30-day window on the registration date (Codex r1 #4)', () => {
    renderDialog()
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Buscar' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Buscar' }))
    const params = mockSearchHook.mock.calls.map(c => c[1] as Record<string, unknown>)
    expect(params.length).toBeGreaterThan(0)
    for (const p of params) {
      expect(p).not.toHaveProperty('dateFrom')
      expect(p).not.toHaveProperty('dateTo')
      expect(p).toMatchObject({ custodyState: 'SUPERVISOR_HELD' })
    }
  })

  it('empty list → explains and sends nothing', async () => {
    renderDialog()
    fireEvent.click(submit())
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Agrega al menos un ICCID' })))
    expect(mockCollect).not.toHaveBeenCalled()
  })

  it('more than 500 → explains the cap and sends nothing', async () => {
    renderDialog()
    const many = Array.from({ length: 501 }, (_, i) => `SIM-${i}`).join('\n')
    fireEvent.change(textarea(), { target: { value: many } })
    fireEvent.click(submit())
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringMatching(/máximo por vez es 500/) })),
    )
    expect(mockCollect).not.toHaveBeenCalled()
  })
})
