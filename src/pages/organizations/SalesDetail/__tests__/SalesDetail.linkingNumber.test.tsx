/**
 * Número de vinculación en «Ventas — Detalle» (PlayTelecom, spec §5.6).
 *
 * Sólo existe con el interruptor `features.linkingNumber` prendido. Apagado, la página queda exactamente como hoy
 * (aunque el servidor mande números viejos); sin saber todavía (cargando o con error) no se finge «apagado».
 */
import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { OrgSaleRow } from '@/services/saleVerification.org.service'

const listMock = vi.fn()
const summaryMock = vi.fn()
const setNumbersMock = vi.fn()
const flagMock = vi.fn()
const toastMock = vi.fn()
const excelMock = vi.fn()

vi.mock('@/services/saleVerification.org.service', async orig => ({
  ...(await orig<typeof import('@/services/saleVerification.org.service')>()),
  listOrgSaleVerifications: (...a: unknown[]) => listMock(...a),
  getOrgSalesSummary: (...a: unknown[]) => summaryMock(...a),
  setOrgSaleVerificationNumbers: (...a: unknown[]) => setNumbersMock(...a),
  useOrgLinkingNumberEnabled: (...a: unknown[]) => flagMock(...a),
}))

vi.mock('@/utils/export', () => ({
  exportToExcel: (...a: unknown[]) => excelMock(...a),
  exportToCSV: () => {},
  generateFilename: () => 'ventas',
}))

vi.mock('@/hooks/use-current-organization', () => ({
  useCurrentOrganization: () => ({
    orgId: 'org-pt',
    orgSlug: 'playtelecom',
    isLoading: false,
    organization: { id: 'org-pt', name: 'PlayTelecom' },
  }),
}))
vi.mock('@/hooks/use-org-staff-by-role', () => ({ useOrgPromoters: () => ({ data: [] }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'OWNER' }, activeVenue: null }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: (...a: unknown[]) => toastMock(...a) }) }))

import SalesDetail from '../SalesDetail'

const VENUE = { id: 'v1', name: 'BAE MEZQUITAL', city: 'San Luis Potosí', slug: 'bae-mezquital' }

function venta(over: Partial<OrgSaleRow> & { id: string; serial: string }): OrgSaleRow {
  const { serial, ...rest } = over
  return {
    paymentId: `pay-${over.id}`,
    hasVerification: true,
    status: 'PENDING',
    isPortabilidad: false,
    saleType: 'LINEA_NUEVA',
    photos: ['https://fotos/vinculacion.jpg'],
    serialNumbers: [serial],
    reviewedById: null,
    reviewedAt: null,
    reviewNotes: null,
    rejectionReasons: [],
    createdAt: '2026-10-20T18:00:00.000Z',
    updatedAt: '2026-10-20T18:00:00.000Z',
    venue: VENUE,
    staff: { id: 's1', firstName: 'Josefina', lastName: 'Alvarado', email: null, photoUrl: null },
    reviewedBy: null,
    payment: {
      id: `pay-${over.id}`,
      amount: 100,
      method: 'CASH',
      paymentForm: 'CASH',
      status: 'COMPLETED',
      createdAt: '2026-10-20T18:00:00.000Z',
    },
    category: null,
    registeredFromVenue: null,
    terminal: null,
    linkingNumber: null,
    portedNumber: null,
    linkingNumberSource: null,
    portedNumberSource: null,
    linkingNumberSetAt: null,
    portedNumberSetAt: null,
    isExternalSale: false,
    numberAlerts: [],
    ...rest,
  } as OrgSaleRow
}

const linea = venta({ id: 'sv-1', serial: 'ICCID-LINEA', linkingNumber: '5512345678', linkingNumberSource: 'TPV' })
const porta = venta({
  id: 'sv-2',
  serial: 'ICCID-PORTA',
  isPortabilidad: true,
  saleType: 'PORTABILIDAD',
  linkingNumber: '5522223333',
  portedNumber: '5598765432',
  linkingNumberSource: 'TPV',
  portedNumberSource: 'TPV',
})

const FLAG_ON = { enabled: true, isError: false, refetch: () => {} }

function renderCon(rows: OrgSaleRow[], flag: { enabled: boolean | undefined; isError: boolean; refetch: () => void } = FLAG_ON) {
  listMock.mockResolvedValue({ data: rows, pagination: { pageSize: 25, pageNumber: 1, totalCount: rows.length, totalPages: 1 } })
  summaryMock.mockResolvedValue({ totalCount: rows.length, completedCount: 0, pendingCount: rows.length, failedCount: 0, rejectedCount: 0 })
  flagMock.mockReturnValue(flag)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <SalesDetail />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const fila = (serial: string) => screen.getByText(serial).closest('tr')!

async function exportarExcel() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: /Exportar/ }))
  await user.click(await screen.findByRole('menuitem', { name: /Excel/ }))
  await waitFor(() => expect(excelMock).toHaveBeenCalled())
  return excelMock.mock.calls[0][0] as Record<string, unknown>[]
}

describe('Ventas — Detalle: interruptor del número de vinculación', () => {
  it('apagado: ni columna, ni filtro, ni columnas del Excel (aunque el servidor mande el número)', async () => {
    renderCon([linea], { enabled: false, isError: false, refetch: () => {} })
    await screen.findByText('ICCID-LINEA')

    expect(screen.queryByRole('columnheader', { name: 'Número de vinculación' })).not.toBeInTheDocument()
    expect(screen.queryByText('5512345678')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Alerta de número/ })).not.toBeInTheDocument()
    expect(screen.queryByText('No se pudo cargar el número de vinculación')).not.toBeInTheDocument()

    const rows = await exportarExcel()
    expect(Object.keys(rows[0]).slice(0, 4)).toEqual(['#', 'ID Venta', 'ID SIM', 'SIMs Adicionales'])
    expect(Object.keys(rows[0])).not.toContain('Número de vinculación')
    expect(listMock.mock.calls.every(([, p]) => (p as { numberAlert?: string }).numberAlert === undefined)).toBe(true)
  })

  it('cargando: no lo esconde como apagado ni exporta sin las columnas', async () => {
    renderCon([linea], { enabled: undefined, isError: false, refetch: () => {} })
    await screen.findByText('ICCID-LINEA')

    expect(screen.queryByRole('columnheader', { name: 'Número de vinculación' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Exportar/ })).toBeDisabled()
  })

  it('si la consulta falla, lo dice con «Reintentar» en vez de esconderlo como apagado', async () => {
    const refetch = vi.fn()
    renderCon([linea], { enabled: undefined, isError: true, refetch })
    await screen.findByText('ICCID-LINEA')

    expect(screen.getByText('No se pudo cargar el número de vinculación')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(refetch).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('columnheader', { name: 'Número de vinculación' })).not.toBeInTheDocument()
  })
})

describe('Ventas — Detalle: columna, alertas y filtro (prendido)', () => {
  it('la celda muestra el número y, en portabilidad, el portado debajo', async () => {
    renderCon([linea, porta])
    await screen.findByText('ICCID-LINEA')

    expect(screen.getByRole('columnheader', { name: 'Número de vinculación' })).toBeInTheDocument()
    expect(within(fila('ICCID-LINEA')).getByText('5512345678')).toBeInTheDocument()
    const p = fila('ICCID-PORTA')
    expect(within(p).getByText('5522223333')).toBeInTheDocument()
    expect(within(p).getByText('5598765432')).toBeInTheDocument()
  })

  it('el filtro «Alerta de número» ofrece las cuatro opciones y manda numberAlert', async () => {
    const user = userEvent.setup()
    renderCon([linea])
    await screen.findByText('ICCID-LINEA')

    await user.click(screen.getByRole('button', { name: /Alerta de número/ }))
    for (const o of ['Cualquiera', 'Repetido', 'Falta', '9 dígitos']) expect(await screen.findByText(o)).toBeInTheDocument()
    await user.click(screen.getByText('Repetido'))

    await waitFor(() =>
      expect(listMock).toHaveBeenLastCalledWith('org-pt', expect.objectContaining({ numberAlert: 'duplicate', pageNumber: 1 })),
    )
  })

  it('si el servidor rechaza el filtro («acota las fechas»), lo dice en vez de «No hay ventas»', async () => {
    const user = userEvent.setup()
    renderCon([linea])
    await screen.findByText('ICCID-LINEA')
    listMock.mockImplementation((_org: string, p: { numberAlert?: string }) =>
      p.numberAlert
        ? Promise.reject({ response: { data: { message: 'Hay demasiadas ventas con alerta en el rango; acota las fechas' } } })
        : Promise.resolve({ data: [linea], pagination: { pageSize: 25, pageNumber: 1, totalCount: 1, totalPages: 1 } }),
    )

    await user.click(screen.getByRole('button', { name: /Alerta de número/ }))
    await user.click(await screen.findByText('Cualquiera'))

    expect(await screen.findByText('Hay demasiadas ventas con alerta en el rango; acota las fechas')).toBeInTheDocument()
    expect(screen.queryByText('No hay ventas que coincidan con los filtros.')).not.toBeInTheDocument()
  })

  it('«Razón» pinta repetidos (con «y N más» e histórico), 9 dígitos y faltantes', async () => {
    const repetida = venta({
      id: 'sv-3',
      serial: 'ICCID-REP',
      linkingNumber: '5511110000',
      linkingNumberSource: 'TPV',
      numberAlerts: [
        {
          code: 'LINKING_DUPLICATE',
          total: 1,
          matches: [
            {
              kind: 'SALE',
              verificationId: 'sv-x',
              status: 'COMPLETED',
              date: '2026-10-12T18:00:00.000Z',
              staffName: 'Pilar Guzmán',
              venueName: 'BAE Puerta del Sol',
            },
          ],
        },
      ],
    })
    const muchas = venta({
      id: 'sv-4',
      serial: 'ICCID-MUCHAS',
      isPortabilidad: true,
      saleType: 'PORTABILIDAD',
      linkingNumber: '5533334444',
      portedNumber: '5544445555',
      numberAlerts: [
        {
          code: 'PORTED_DUPLICATE',
          total: 5,
          matches: [
            { kind: 'HISTORICAL', date: '2026-03-02T18:00:00.000Z' },
            {
              kind: 'SALE',
              verificationId: 'a',
              status: 'REJECTED',
              date: '2026-09-01T18:00:00.000Z',
              staffName: 'Ana Ruiz',
              venueName: 'BAE Centro',
            },
            {
              kind: 'SALE',
              verificationId: 'b',
              status: 'FAILED',
              date: '2026-08-01T18:00:00.000Z',
              staffName: 'Luis Mora',
              venueName: 'BAE Norte',
            },
          ],
        },
      ],
    })
    const nueve = venta({
      id: 'sv-5',
      serial: 'ICCID-NUEVE',
      linkingNumber: '551234567',
      linkingNumberSource: 'TPV',
      numberAlerts: [{ code: 'NOT_10_DIGITS' }],
    })
    const falta = venta({
      id: 'sv-6',
      serial: 'ICCID-FALTA',
      isPortabilidad: true,
      saleType: 'PORTABILIDAD',
      numberAlerts: [{ code: 'LINKING_MISSING' }, { code: 'PORTED_MISSING' }],
    })
    renderCon([repetida, muchas, nueve, falta])
    await screen.findByText('ICCID-REP')

    expect(
      within(fila('ICCID-REP')).getByText('# de vinculación repetido · choca con Pilar Guzmán, BAE Puerta del Sol, 12-oct (Aprobada)'),
    ).toBeInTheDocument()
    const m = within(fila('ICCID-MUCHAS')).getByText(/# portado repetido · choca con/)
    expect(m.textContent).toContain('Histórico (Excel), 2-mar')
    expect(m.textContent).toContain('Ana Ruiz, BAE Centro, 1-sep (Rechazada)')
    expect(m.textContent).toMatch(/y 2 más$/)
    expect(within(fila('ICCID-NUEVE')).getByText('Tiene 9 dígitos')).toBeInTheDocument()
    expect(within(fila('ICCID-NUEVE')).queryByText(/confirmado por el back-office/)).not.toBeInTheDocument()
    expect(within(fila('ICCID-FALTA')).getByText('Falta número')).toBeInTheDocument()
    expect(within(fila('ICCID-FALTA')).getByText('Falta número portado')).toBeInTheDocument()
  })

  it('un 9 confirmado por el back-office se ve gris y no como alerta', async () => {
    renderCon([venta({ id: 'sv-7', serial: 'ICCID-CONF', linkingNumber: '551234567', linkingNumberSource: 'BACKOFFICE' })])
    await screen.findByText('ICCID-CONF')

    const nota = within(fila('ICCID-CONF')).getByText('9 dígitos · confirmado por el back-office')
    expect(nota.className).toContain('text-muted-foreground')
    expect(within(fila('ICCID-CONF')).queryByText('Tiene 9 dígitos')).not.toBeInTheDocument()
  })
})

describe('Ventas — Detalle: editar el número', () => {
  async function abrirEdicion(serial: string, campo: 'vinculación' | 'portado' = 'vinculación') {
    await screen.findByText(serial)
    fireEvent.click(
      within(fila(serial)).getByRole('button', { name: `Editar número ${campo === 'vinculación' ? 'de vinculación' : 'portado'}` }),
    )
    return within(fila(serial)).getByRole('textbox', { name: campo === 'vinculación' ? 'Número de vinculación' : 'Número portado' })
  }

  it('10 dígitos se guarda con Enter, avisa e invalida la lista', async () => {
    setNumbersMock.mockResolvedValue({ id: 'sv-1' })
    renderCon([linea])
    const input = await abrirEdicion('ICCID-LINEA')
    const antes = listMock.mock.calls.length

    fireEvent.change(input, { target: { value: '55 1111-2222' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => expect(setNumbersMock).toHaveBeenCalledWith('org-pt', 'sv-1', { linkingNumber: '5511112222' }))
    await waitFor(() => expect(listMock.mock.calls.length).toBeGreaterThan(antes))
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Número guardado' }))
    await waitFor(() => expect(within(fila('ICCID-LINEA')).queryByRole('textbox')).not.toBeInTheDocument())
  })

  it('el portado se corrige aparte', async () => {
    setNumbersMock.mockResolvedValue({ id: 'sv-2' })
    renderCon([porta])
    const input = await abrirEdicion('ICCID-PORTA', 'portado')

    fireEvent.change(input, { target: { value: '5500001111' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => expect(setNumbersMock).toHaveBeenCalledWith('org-pt', 'sv-2', { portedNumber: '5500001111' }))
  })

  it('9 dígitos pide confirmar y manda allowNineDigits', async () => {
    setNumbersMock.mockResolvedValue({ id: 'sv-1' })
    renderCon([linea])
    const input = await abrirEdicion('ICCID-LINEA')

    fireEvent.change(input, { target: { value: '551111222' } })
    fireEvent.click(within(fila('ICCID-LINEA')).getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText('Tiene 9 dígitos. ¿Guardarlo así?')).toBeInTheDocument()
    expect(setNumbersMock).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar así' }))

    await waitFor(() =>
      expect(setNumbersMock).toHaveBeenCalledWith('org-pt', 'sv-1', { linkingNumber: '551111222', allowNineDigits: true }),
    )
    expect(setNumbersMock).toHaveBeenCalledTimes(1)
  })

  it('8 dígitos no deja guardar', async () => {
    renderCon([linea])
    const input = await abrirEdicion('ICCID-LINEA')

    fireEvent.change(input, { target: { value: '55111122' } })
    expect(within(fila('ICCID-LINEA')).getByRole('button', { name: 'Guardar' })).toBeDisabled()
    fireEvent.submit(input.closest('form')!)

    expect(screen.queryByText('Tiene 9 dígitos. ¿Guardarlo así?')).not.toBeInTheDocument()
    expect(setNumbersMock).not.toHaveBeenCalled()
  })

  it('Escape cancela sin mandar nada', async () => {
    renderCon([linea])
    const input = await abrirEdicion('ICCID-LINEA')

    fireEvent.change(input, { target: { value: '5599998888' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(within(fila('ICCID-LINEA')).queryByRole('textbox')).not.toBeInTheDocument()
    expect(within(fila('ICCID-LINEA')).getByText('5512345678')).toBeInTheDocument()
    expect(setNumbersMock).not.toHaveBeenCalled()
  })

  it('doble clic en Guardar manda una sola vez', async () => {
    setNumbersMock.mockReturnValue(new Promise(() => {}))
    renderCon([linea])
    const input = await abrirEdicion('ICCID-LINEA')

    fireEvent.change(input, { target: { value: '5511112222' } })
    const guardar = within(fila('ICCID-LINEA')).getByRole('button', { name: 'Guardar' })
    fireEvent.click(guardar)
    fireEvent.click(guardar)
    // Enter dos veces: el campo sigue activo, así que lo frena el candado y no el botón apagado.
    fireEvent.submit(input.closest('form')!)
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => expect(setNumbersMock).toHaveBeenCalled())
    expect(setNumbersMock).toHaveBeenCalledTimes(1)
  })

  it('el error del servidor sale en el aviso y la edición sigue abierta', async () => {
    setNumbersMock.mockRejectedValue({ response: { data: { message: 'El número debe tener 10 dígitos (o 9, confirmado)' } } })
    renderCon([linea])
    const input = await abrirEdicion('ICCID-LINEA')

    fireEvent.change(input, { target: { value: '5511112222' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'El número debe tener 10 dígitos (o 9, confirmado)', variant: 'destructive' }),
      ),
    )
    expect(within(fila('ICCID-LINEA')).getByRole('textbox', { name: 'Número de vinculación' })).toBeInTheDocument()
  })
})

describe('Ventas — Detalle: Excel (prendido)', () => {
  it('trae «Número de vinculación», «Número portado» y «Alertas de número» justo después de «ID SIM»', async () => {
    const conAlerta = venta({
      ...porta,
      id: 'sv-8',
      serial: 'ICCID-PORTA',
      numberAlerts: [{ code: 'NOT_10_DIGITS' }, { code: 'PORTED_MISSING' }],
    })
    renderCon([conAlerta])
    await screen.findByText('ICCID-PORTA')

    const rows = await exportarExcel()
    const keys = Object.keys(rows[0])
    const i = keys.indexOf('ID SIM')
    expect(keys.slice(i, i + 4)).toEqual(['ID SIM', 'Número de vinculación', 'Número portado', 'Alertas de número'])
    expect(rows[0]['Número de vinculación']).toBe('5522223333')
    expect(rows[0]['Número portado']).toBe('5598765432')
    expect(rows[0]['Alertas de número']).toBe('Tiene 9 dígitos; Falta número portado')
  })
})
