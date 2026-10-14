import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const count = vi.fn()
const download = vi.fn()
const terminalOpts = vi.fn()
vi.mock('@/services/settlementReport.service', () => ({
  countSettlementReport: (...a: unknown[]) => count(...a),
  terminalOptions: (...a: unknown[]) => terminalOpts(...a),
  downloadSettlementReport: (...a: unknown[]) => download(...a),
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: any) => (o?.count !== undefined ? `${k}:${o.count}` : k), i18n: { language: 'es' } }),
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
import { SettlementReportDialog } from '@/pages/AvailableBalance/SettlementReportDialog'

const newQc = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
const tree = (qc: QueryClient, venueId = 'v1', open = true) => (
  <QueryClientProvider client={qc}>
    <SettlementReportDialog key={venueId} open={open} onClose={() => {}} venueId={venueId} venueTimezone="America/Mexico_City" />
  </QueryClientProvider>
)
const renderDlg = (open = true) => render(tree(newQc(), 'v1', open))

beforeEach(() => {
  vi.clearAllMocks()
  terminalOpts.mockResolvedValue({ items: [], nextCursor: null })
  count.mockResolvedValue({ candidateCount: 3464, caps: { xlsx: 5000, csv: 10000 } })
  download.mockResolvedValue({ blob: new Blob(['x']), filename: 'transacciones.xlsx' })
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:x')
  globalThis.URL.revokeObjectURL = vi.fn()
})

describe('SettlementReportDialog', () => {
  it('cerrado no consulta nada', () => {
    renderDlg(false)
    expect(count).not.toHaveBeenCalled()
  })
  it('abierto: cuenta y muestra ≈ N; la fecha estimada no se puede desmarcar', async () => {
    renderDlg()
    expect(await screen.findByText('settlementReport.estimated:3464')).toBeTruthy()
    expect((screen.getByTestId('col-fechaDeposito') as HTMLInputElement).disabled).toBe(true)
  })
  it('mientras el conteo no responde, el botón está deshabilitado', () => {
    count.mockReturnValue(new Promise(() => {}))
    renderDlg()
    expect((screen.getByTestId('settlement-report-submit') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('settlementReport.block.contando')).toBeTruthy()
  })
  it('conteo fallido: avisa y ofrece reintentar', async () => {
    count.mockRejectedValue(new Error('x'))
    renderDlg()
    expect(await screen.findByText(/settlementReport.block.errorConteo/, {}, { timeout: 4000 })).toBeTruthy()
    expect((screen.getByTestId('settlement-report-submit') as HTMLButtonElement).disabled).toBe(true)
  })
  it('cambiar a Dispersiones reinicia columnas y la base pasa a depósito', async () => {
    renderDlg()
    fireEvent.click(screen.getByTestId('col-folio'))
    fireEvent.click(screen.getByTestId('report-deposits'))
    expect(screen.queryByTestId('col-folio')).toBeNull()
    expect((screen.getByTestId('col-depositoNeto') as HTMLInputElement).checked).toBe(true)
    expect((screen.getByTestId('basis-deposit') as HTMLInputElement).checked).toBe(true)
  })
  it('Excel arriba de 5,000 apaga el botón y ofrece CSV', async () => {
    count.mockResolvedValue({ candidateCount: 6000, caps: { xlsx: 5000, csv: 10000 } })
    renderDlg()
    expect(await screen.findByText(/settlementReport.block.demasiadosExcel:6000/)).toBeTruthy()
    expect((screen.getByTestId('settlement-report-submit') as HTMLButtonElement).disabled).toBe(true)
  })
  it('Excel arriba de 5,000 pero CSV cabe: «Cambiar a CSV» pasa a CSV y desbloquea', async () => {
    count.mockResolvedValue({ candidateCount: 6000, caps: { xlsx: 5000, csv: 10000 } })
    renderDlg()
    fireEvent.click(await screen.findByTestId('switch-to-csv'))
    expect((screen.getByTestId('format-csv') as HTMLInputElement).checked).toBe(true)
    await waitFor(() => expect((screen.getByTestId('settlement-report-submit') as HTMLButtonElement).disabled).toBe(false))
    expect(screen.queryByTestId('switch-to-csv')).toBeNull()
  })
  it('fecha vacía: mensaje propio (no el de 92 días) y bloquea', () => {
    renderDlg()
    fireEvent.change(screen.getByTestId('date-end'), { target: { value: '' } })
    expect(screen.getByText('settlementReport.block.fechasVacias')).toBeTruthy()
    expect(screen.queryByText('settlementReport.block.rangoLargo')).toBeNull()
    expect((screen.getByTestId('settlement-report-submit') as HTMLButtonElement).disabled).toBe(true)
  })
  it('cambiar de negocio (key) reinicia la selección: no viajan terminales del anterior', async () => {
    terminalOpts.mockResolvedValue({ items: [{ id: 't1', name: 'T1', serialNumber: null }], nextCursor: null })
    const qc = newQc()
    const { rerender } = render(tree(qc, 'v1'))
    fireEvent.click(await screen.findByText('T1'))
    await waitFor(() => expect(count).toHaveBeenLastCalledWith('v1', expect.objectContaining({ terminalIds: ['t1'] })))
    rerender(tree(qc, 'v2'))
    await waitFor(() => expect(count).toHaveBeenLastCalledWith('v2', expect.objectContaining({ terminalIds: [] })))
    expect(count.mock.calls.filter(c => c[0] === 'v2').every(c => c[1].terminalIds.length === 0)).toBe(true)
  })
  it('rango de más de 92 días: avisa y no deja descargar', () => {
    renderDlg()
    fireEvent.change(screen.getByTestId('date-start'), { target: { value: '2026-01-01' } })
    fireEvent.change(screen.getByTestId('date-end'), { target: { value: '2026-06-30' } })
    expect(screen.getByText('settlementReport.block.rangoLargo')).toBeTruthy()
    expect((screen.getByTestId('settlement-report-submit') as HTMLButtonElement).disabled).toBe(true)
  })
  it('fecha final anterior a la inicial: mensaje propio y bloquea', () => {
    renderDlg()
    fireEvent.change(screen.getByTestId('date-start'), { target: { value: '2026-08-20' } })
    fireEvent.change(screen.getByTestId('date-end'), { target: { value: '2026-08-10' } })
    expect(screen.getByText('settlementReport.block.rangoInvertido')).toBeTruthy()
    expect((screen.getByTestId('settlement-report-submit') as HTMLButtonElement).disabled).toBe(true)
  })
  it('conteo viejo no cuenta: al cambiar parámetros el botón sigue deshabilitado hasta que llegue el nuevo', async () => {
    renderDlg()
    await screen.findByText('settlementReport.estimated:3464')
    expect((screen.getByTestId('settlement-report-submit') as HTMLButtonElement).disabled).toBe(false)
    count.mockReturnValue(new Promise(() => {}))
    fireEvent.change(screen.getByTestId('date-start'), { target: { value: '2026-08-05' } })
    expect((screen.getByTestId('settlement-report-submit') as HTMLButtonElement).disabled).toBe(true)
    await waitFor(() => expect(count).toHaveBeenCalledTimes(2))
    expect(screen.getByText('settlementReport.block.contando')).toBeTruthy()
    expect((screen.getByTestId('settlement-report-submit') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByText('settlementReport.estimated:3464')).toBeNull()
  })
  it('doble clic descarga UNA vez', async () => {
    renderDlg()
    await screen.findByText('settlementReport.estimated:3464')
    const btn = screen.getByTestId('settlement-report-submit')
    fireEvent.click(btn)
    fireEvent.click(btn)
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1))
    expect(download).toHaveBeenCalledWith(
      'v1',
      expect.objectContaining({
        report: 'transactions',
        format: 'xlsx',
        dateBasis: 'charge',
        columns: expect.arrayContaining(['fechaDeposito']),
      }),
    )
  })
})
