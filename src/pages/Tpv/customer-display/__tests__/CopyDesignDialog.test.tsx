/**
 * «Copiar a otras cajas» (B4). Lo elegido se guarda AL ELEGIRLO con su token; el ORIGEN se congela al abrir; la copia es
 * todo-o-nada con CAS por destino; y una respuesta PERDIDA se reconcilia releyendo (la lista y la vista de cada destino),
 * nunca re-copiando sola. Varias pruebas RETIENEN respuestas: así se mira el diálogo mientras espera.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  copyCustomerDisplay,
  getCustomerDisplay,
  listCustomerDisplayDevices,
  type CustomerDisplayCopyResult,
  type CustomerDisplayDesign,
  type CustomerDisplayDeviceItem,
  type CustomerDisplayDeviceList,
  type CustomerDisplayEntitlements,
  type CustomerDisplayView,
} from '@/services/customerDisplay.service'
import { CopyDesignDialog, type CopyDesignDialogProps } from '../CopyDesignDialog'
import { DISENO_DE_FABRICA } from '../model'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k), i18n: { language: 'es' } }),
}))
const toast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('@/services/customerDisplay.service', () => ({
  listCustomerDisplayDevices: vi.fn(),
  copyCustomerDisplay: vi.fn(),
  getCustomerDisplay: vi.fn(),
}))

const fila = (id: string, extra: Partial<CustomerDisplayDeviceItem> = {}): CustomerDisplayDeviceItem => ({
  id, name: id, editToken: 'factory', designVersion: 1, presence: 'SUPPORTED', stale: false, capabilitiesObservedAt: null, lastHeartbeat: null, ...extra,
})
const ORIGEN = { terminalId: 'caja-1', editToken: 'd1:2', name: 'Caja 1', design: { ...DISENO_DE_FABRICA, theme: 'DARK' as const } }
const SIN_PRO: CustomerDisplayEntitlements = { slides: false, promotionCards: false }
const CLAVE_DE_LA_LISTA = ['customer-display-devices', 'v1']

/** La vista de UN destino, como la contesta el server al releerla. */
function vistaDe(id: string, design: CustomerDisplayDesign, editToken: string): CustomerDisplayView {
  return {
    terminal: { id, name: id },
    editToken,
    design,
    ficha: {
      schemaVersion: 1,
      fingerprint: `fp-${editToken}`,
      theme: design.theme,
      accent: { custom: false },
      logo: null,
      welcomeText: design.welcomeText,
      thanksText: design.thanksText,
      slides: [],
      slideSeconds: design.slideSeconds,
      promotionCards: { enabled: false },
      poweredBy: true,
    },
    entitlements: SIN_PRO,
    assetRejected: [],
    device: {
      presence: 'SUPPORTED',
      stale: false,
      capabilitiesObservedAt: null,
      lastHeartbeat: null,
      designVersion: 1,
      ack: null,
      installationWarning: false,
    },
  }
}

/** Una promesa que la prueba resuelve o rechaza cuando quiere: así se mira el estado MIENTRAS espera. */
function retenida<T>() {
  let resolver!: (v: T) => void
  let rechazar!: (e: unknown) => void
  const promesa = new Promise<T>((res, rej) => {
    resolver = res
    rechazar = rej
  })
  return { promesa, resolver, rechazar }
}

type Origen = CopyDesignDialogProps['source']

function pintar(entitlements: CustomerDisplayEntitlements = SIN_PRO) {
  const onClose = vi.fn()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const arbol = (tokenVigente: string, source: Origen = ORIGEN) => (
    <QueryClientProvider client={qc}>
      <CopyDesignDialog onClose={onClose} venueId="v1" source={source} tokenVigente={tokenVigente} entitlements={entitlements} />
    </QueryClientProvider>
  )
  const { rerender } = render(arbol(ORIGEN.editToken))
  return {
    onClose,
    qc,
    cambiaElOrigen: (token: string) => rerender(arbol(token)),
    /** El llamador vuelve a pasar la foto VIVA (otro token y otro diseño): el diálogo debe seguir con la del arranque. */
    cambiaLaFoto: (source: Origen) => rerender(arbol(source.editToken, source)),
  }
}
const dosPaginas = () =>
  vi.mocked(listCustomerDisplayDevices).mockImplementation(async (_v, { cursor }) =>
    cursor
      ? { total: 4, nextCursor: null, devices: [fila('caja-2', { name: 'Caja 2', editToken: 'd2:7' }), fila('mostrador', { name: 'Mostrador', designVersion: null })] }
      : { total: 4, nextCursor: 'caja-1', devices: [fila('barra', { name: 'Barra' }), fila('caja-1', { name: 'Caja 1' })] },
  )
const renglon = (nombre: string) => screen.getByRole('checkbox', { name: nombre }).closest('label') as HTMLElement
async function elegirBarraYCaja2(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('checkbox', { name: 'Barra' }))
  await user.click(screen.getByRole('button', { name: 'copy.loadMore' }))
  await user.click(await screen.findByRole('checkbox', { name: 'Caja 2' }))
}
async function confirmar(user: ReturnType<typeof userEvent.setup>, cuantos: number) {
  await user.click(screen.getByRole('button', { name: `copy.submit {"count":${cuantos}}` }))
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'copy.confirmGo' }))
}

/**
 * Un «server» con memoria para las respuestas perdidas: guarda el token y el diseño de cada destino, la lista y la vista
 * lo leen, y `aplicarCopia` hace lo que haría la copia del server (cada destino estrena token y lleva el diseño del origen).
 */
function servidorConMemoria() {
  const tokens: Record<string, string> = { barra: 'factory', 'caja-2': 'd2:7' }
  const disenos: Record<string, CustomerDisplayDesign> = {
    barra: { ...DISENO_DE_FABRICA },
    'caja-2': { ...DISENO_DE_FABRICA, welcomeText: 'Hola' },
  }
  vi.mocked(listCustomerDisplayDevices).mockImplementation(async (_v, { cursor }) =>
    cursor
      ? { total: 4, nextCursor: null, devices: [fila('caja-2', { name: 'Caja 2', editToken: tokens['caja-2'] }), fila('mostrador', { name: 'Mostrador', designVersion: null })] }
      : { total: 4, nextCursor: 'caja-1', devices: [fila('barra', { name: 'Barra', editToken: tokens.barra }), fila('caja-1', { name: 'Caja 1' })] },
  )
  vi.mocked(getCustomerDisplay).mockImplementation(async (_v, id) => vistaDe(id, disenos[id], tokens[id]))
  const aplicarCopia = (destinos: { terminalId: string }[]) => {
    for (const d of destinos) {
      tokens[d.terminalId] = 'cdd-9:1'
      disenos[d.terminalId] = { ...ORIGEN.design }
    }
  }
  return { tokens, disenos, aplicarCopia }
}

beforeEach(() => {
  vi.mocked(copyCustomerDisplay).mockResolvedValue({ copied: ['barra', 'caja-2'], promosOmitted: true })
  vi.mocked(getCustomerDisplay).mockRejectedValue(new Error('getCustomerDisplay sin preparar en esta prueba'))
})

describe('CopyDesignDialog', () => {
  it('lista paginada: total sin el origen, «Cargar más» con el cursor, y el estado de cada destino', async () => {
    dosPaginas()
    const user = userEvent.setup()
    pintar()
    expect(await screen.findByText('copy.counter {"shown":1,"total":3}')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Caja 1' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'copy.loadMore' }))
    expect(await screen.findByText('copy.counter {"shown":3,"total":3}')).toBeInTheDocument()
    expect(listCustomerDisplayDevices).toHaveBeenLastCalledWith('v1', { cursor: 'caja-1', take: 50 })
    expect(screen.getByText('copy.rowReplace')).toBeInTheDocument() // Caja 2 ya tiene su diseño
    expect(screen.getByText('copy.rowFactory · copy.rowNoApp')).toBeInTheDocument() // Mostrador
    expect(screen.queryByRole('button', { name: 'copy.loadMore' })).not.toBeInTheDocument()
  })

  it('🔴 lo elegido sobrevive a «Cargar más» y viaja con el token del ORIGEN congelado y el de cada destino al elegirlo', async () => {
    dosPaginas()
    const user = userEvent.setup()
    const { onClose } = pintar()
    await elegirBarraYCaja2(user)
    expect(screen.getByRole('checkbox', { name: 'Barra' })).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'copy.submit {"count":2}' }))
    const dialogo = await screen.findByRole('alertdialog')
    expect(dialogo).toHaveTextContent('Barra y Caja 2')
    await user.click(within(dialogo).getByRole('button', { name: 'copy.confirmGo' }))
    await waitFor(() =>
      expect(copyCustomerDisplay).toHaveBeenCalledWith('v1', { terminalId: 'caja-1', editToken: 'd1:2' }, [
        { terminalId: 'barra', editToken: 'factory' },
        { terminalId: 'caja-2', editToken: 'd2:7' },
      ]),
    )
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(toast).toHaveBeenCalledWith({ title: 'copy.done {"names":"Barra y Caja 2"}', description: undefined })
  })

  it('🔴 si la fila cambia de token DESPUÉS de elegirla, se manda el token de cuando se eligió (el server decide con CAS)', async () => {
    dosPaginas()
    const user = userEvent.setup()
    const { qc } = pintar()
    await user.click(await screen.findByRole('checkbox', { name: 'Barra' }))
    // Otra persona le guarda un diseño a Barra; la lista se relee y la fila ya trae otro token.
    vi.mocked(listCustomerDisplayDevices).mockResolvedValue({ total: 4, nextCursor: null, devices: [fila('barra', { name: 'Barra', editToken: 'd9:1' })] })
    await act(async () => {
      await qc.invalidateQueries({ queryKey: CLAVE_DE_LA_LISTA })
    })
    await waitFor(() => expect(within(renglon('Barra')).getByText('copy.rowReplace')).toBeInTheDocument())
    expect(screen.getByRole('checkbox', { name: 'Barra' })).toBeChecked()
    await confirmar(user, 1)
    await waitFor(() => expect(copyCustomerDisplay).toHaveBeenCalledWith('v1', { terminalId: 'caja-1', editToken: 'd1:2' }, [{ terminalId: 'barra', editToken: 'factory' }]))
  })

  it('🔴 si el ORIGEN cambia con el diálogo abierto, no se copia: se avisa y se pide reabrir (Codex #8)', async () => {
    dosPaginas()
    const user = userEvent.setup()
    const { onClose, cambiaElOrigen } = pintar()
    await user.click(await screen.findByRole('checkbox', { name: 'Barra' }))
    cambiaElOrigen('d1:3')
    expect(await screen.findByText('copy.originChanged {"name":"Caja 1"}')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'copy.submit {"count":1}' })).toBeDisabled()
    expect(copyCustomerDisplay).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'copy.conflictBack' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('🔴 el origen cambia con la CONFIRMACIÓN abierta: «Copiar» de la confirmación queda bloqueado y nada viaja', async () => {
    dosPaginas()
    const user = userEvent.setup()
    const { cambiaElOrigen } = pintar()
    await user.click(await screen.findByRole('checkbox', { name: 'Barra' }))
    await user.click(screen.getByRole('button', { name: 'copy.submit {"count":1}' }))
    const dialogo = await screen.findByRole('alertdialog')
    cambiaElOrigen('d1:3')
    const ir = within(dialogo).getByRole('button', { name: 'copy.confirmGo' })
    await waitFor(() => expect(ir).toBeDisabled())
    await user.click(ir)
    expect(copyCustomerDisplay).not.toHaveBeenCalled()
  })

  it('🔴 la foto del origen se congela AL ABRIR: si el llamador pasa después la foto viva, se sigue copiando la del arranque', async () => {
    dosPaginas()
    const user = userEvent.setup()
    const { cambiaLaFoto } = pintar()
    await user.click(await screen.findByRole('checkbox', { name: 'Barra' }))
    // Un llamador descuidado manda la foto VIVA (otro token y otro diseño) con su token vigente: coinciden entre sí.
    cambiaLaFoto({ ...ORIGEN, editToken: 'd1:3', design: { ...ORIGEN.design, welcomeText: 'Otro' } })
    // La foto del arranque (d1:2) ya no es la vigente (d1:3): se avisa y no se copia nada que el usuario no vio.
    expect(await screen.findByText('copy.originChanged {"name":"Caja 1"}')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'copy.submit {"count":1}' })).toBeDisabled()
    expect(copyCustomerDisplay).not.toHaveBeenCalled()
  })

  it('409 del ORIGEN: el mensaje del server, «Copiar» queda bloqueado y se ofrece volver a la tarjeta', async () => {
    dosPaginas()
    vi.mocked(copyCustomerDisplay).mockRejectedValue({
      response: { status: 409, data: { message: 'El diseño del dispositivo de origen cambió mientras copiabas.', code: 'CUSTOMER_DISPLAY_CONFLICT', details: { source: true, terminalId: 'caja-1' } } },
    })
    const user = userEvent.setup()
    const { onClose } = pintar()
    await user.click(await screen.findByRole('checkbox', { name: 'Barra' }))
    await confirmar(user, 1)
    expect(await screen.findByText('El diseño del dispositivo de origen cambió mientras copiabas.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'copy.submit {"count":1}' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'copy.conflictBack' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('🔴 409 por un destino: el mensaje del server y se quita SÓLO ese de lo elegido', async () => {
    dosPaginas()
    vi.mocked(copyCustomerDisplay).mockRejectedValue({
      response: { status: 409, data: { message: 'Alguien más cambió el diseño de algún dispositivo mientras copiabas.', code: 'CUSTOMER_DISPLAY_CONFLICT', details: { conflicts: ['barra'] } } },
    })
    const user = userEvent.setup()
    pintar()
    await elegirBarraYCaja2(user)
    await confirmar(user, 2)
    expect(await screen.findByText('Alguien más cambió el diseño de algún dispositivo mientras copiabas.')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Barra' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Caja 2' })).toBeChecked()
    expect(screen.queryByRole('button', { name: 'copy.conflictBack' })).not.toBeInTheDocument()
  })

  it('🔴 409 por un destino: la lista se relee y, si se vuelve a elegir, viaja el token NUEVO del destino (y el de los otros, intacto)', async () => {
    const tokens: Record<string, string> = { barra: 'factory', 'caja-2': 'd2:7' }
    vi.mocked(listCustomerDisplayDevices).mockImplementation(async (_v, { cursor }) =>
      cursor
        ? { total: 4, nextCursor: null, devices: [fila('caja-2', { name: 'Caja 2', editToken: tokens['caja-2'] })] }
        : { total: 4, nextCursor: 'caja-1', devices: [fila('barra', { name: 'Barra', editToken: tokens.barra }), fila('caja-1', { name: 'Caja 1' })] },
    )
    // Otra persona guardó en Barra justo antes: el server rechaza TODO (nada se escribió) y dice cuál chocó.
    vi.mocked(copyCustomerDisplay).mockImplementationOnce(async () => {
      tokens.barra = 'b5:1'
      throw {
        response: { status: 409, data: { message: 'Alguien más cambió el diseño de algún dispositivo mientras copiabas.', code: 'CUSTOMER_DISPLAY_CONFLICT', details: { conflicts: ['barra'] } } },
      }
    })
    const user = userEvent.setup()
    pintar()
    await elegirBarraYCaja2(user)
    await confirmar(user, 2)
    await waitFor(() => expect(within(renglon('Barra')).getByText('copy.rowReplace')).toBeInTheDocument())
    expect(screen.getByRole('checkbox', { name: 'Barra' })).not.toBeChecked()
    await user.click(screen.getByRole('checkbox', { name: 'Barra' }))
    await confirmar(user, 2)
    await waitFor(() =>
      expect(copyCustomerDisplay).toHaveBeenLastCalledWith('v1', { terminalId: 'caja-1', editToken: 'd1:2' }, [
        { terminalId: 'caja-2', editToken: 'd2:7' },
        { terminalId: 'barra', editToken: 'b5:1' },
      ]),
    )
  })

  it('409 «ocupado» (otro cambio se cruzó): el mensaje del server y lo elegido se queda para volver a intentar', async () => {
    dosPaginas()
    vi.mocked(copyCustomerDisplay).mockRejectedValue({
      response: { status: 409, data: { message: 'Otro cambio se cruzó; vuelve a intentarlo.', code: 'CUSTOMER_DISPLAY_BUSY' } },
    })
    const user = userEvent.setup()
    pintar()
    await user.click(await screen.findByRole('checkbox', { name: 'Barra' }))
    await confirmar(user, 1)
    expect(await screen.findByText('Otro cambio se cruzó; vuelve a intentarlo.')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Barra' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'copy.submit {"count":1}' })).toBeEnabled()
    expect(screen.queryByText('copy.uncertain')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'copy.conflictBack' })).not.toBeInTheDocument()
  })

  it('🔴 respuesta PERDIDA: la copia SÍ se aplicó; la lista se relee y trae lo APLICADO, lo elegido se vacía y nunca se re-copia sola (Codex #9)', async () => {
    const server = servidorConMemoria()
    vi.mocked(copyCustomerDisplay).mockImplementation(async (_v, _origen, destinos) => {
      server.aplicarCopia(destinos)
      throw new Error('Network Error')
    })
    const user = userEvent.setup()
    const { onClose } = pintar()
    await elegirBarraYCaja2(user)
    expect(within(renglon('Barra')).getByText('copy.rowFactory')).toBeInTheDocument()
    await confirmar(user, 2)
    expect(await screen.findByText('copy.uncertain')).toBeInTheDocument()
    // 🔴 El resultado APLICADO, no sólo «hubo otra consulta»: Barra ya aparece con diseño propio (antes «de fábrica»)...
    await waitFor(() => expect(within(renglon('Barra')).getByText('copy.rowReplace')).toBeInTheDocument())
    // ...y la revisión de cada destino dice cuáles YA tienen el diseño del origen.
    expect(await screen.findByText('copy.uncertainApplied {"name":"Caja 1","names":"Barra y Caja 2"}')).toBeInTheDocument()
    expect(screen.queryByText(/copy\.uncertainNotApplied/)).not.toBeInTheDocument()
    expect(screen.queryByText(/copy\.uncertainUnchecked/)).not.toBeInTheDocument()
    expect(getCustomerDisplay).toHaveBeenCalledWith('v1', 'barra')
    expect(getCustomerDisplay).toHaveBeenCalledWith('v1', 'caja-2')
    expect(screen.getByRole('checkbox', { name: 'Barra' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Caja 2' })).not.toBeChecked()
    expect(copyCustomerDisplay).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
    expect(toast).not.toHaveBeenCalled()
    // Si la persona decide volver a copiar, viaja el token NUEVO que trajo la relectura, nunca el de antes.
    vi.mocked(copyCustomerDisplay).mockResolvedValue({ copied: ['barra'], promosOmitted: false })
    await user.click(screen.getByRole('checkbox', { name: 'Barra' }))
    await confirmar(user, 1)
    await waitFor(() =>
      expect(copyCustomerDisplay).toHaveBeenLastCalledWith('v1', { terminalId: 'caja-1', editToken: 'd1:2' }, [{ terminalId: 'barra', editToken: 'cdd-9:1' }]),
    )
  })

  it('🔴 respuesta PERDIDA y la copia NO se aplicó: se dice que no lo tienen, y volver a elegir manda el MISMO token (sigue vigente)', async () => {
    servidorConMemoria()
    vi.mocked(copyCustomerDisplay).mockRejectedValue(new Error('Network Error')) // se cayó ANTES de llegar: nada cambió
    const user = userEvent.setup()
    const { onClose } = pintar()
    await elegirBarraYCaja2(user)
    await confirmar(user, 2)
    expect(await screen.findByText('copy.uncertain')).toBeInTheDocument()
    expect(await screen.findByText('copy.uncertainNotApplied {"name":"Caja 1","names":"Barra y Caja 2"}')).toBeInTheDocument()
    expect(screen.queryByText(/copy\.uncertainApplied/)).not.toBeInTheDocument()
    expect(within(renglon('Barra')).getByText('copy.rowFactory')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Barra' })).not.toBeChecked()
    expect(copyCustomerDisplay).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
    expect(toast).not.toHaveBeenCalled()
    vi.mocked(copyCustomerDisplay).mockResolvedValue({ copied: ['barra'], promosOmitted: false })
    await user.click(screen.getByRole('checkbox', { name: 'Barra' }))
    await confirmar(user, 1)
    await waitFor(() =>
      expect(copyCustomerDisplay).toHaveBeenLastCalledWith('v1', { terminalId: 'caja-1', editToken: 'd1:2' }, [{ terminalId: 'barra', editToken: 'factory' }]),
    )
  })

  it('🔴 409 del REINTENTO automático (la 1ª copia pudo aplicarse): es incierto, no «alguien más cambió»; se reconcilia y se ve lo aplicado', async () => {
    const server = servidorConMemoria()
    vi.mocked(copyCustomerDisplay).mockImplementation(async (_v, _origen, destinos) => {
      server.aplicarCopia(destinos) // el PRIMER intento sí escribió; su respuesta se perdió
      throw {
        response: { status: 409, data: { message: 'Alguien más cambió el diseño de algún dispositivo mientras copiabas.', code: 'CUSTOMER_DISPLAY_CONFLICT', details: { conflicts: ['barra', 'caja-2'] } } },
        config: { _retry: true },
      }
    })
    const user = userEvent.setup()
    pintar()
    await elegirBarraYCaja2(user)
    await confirmar(user, 2)
    expect(await screen.findByText('copy.uncertain')).toBeInTheDocument()
    expect(await screen.findByText('copy.uncertainApplied {"name":"Caja 1","names":"Barra y Caja 2"}')).toBeInTheDocument()
    expect(screen.queryByText('Alguien más cambió el diseño de algún dispositivo mientras copiabas.')).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Caja 2' })).not.toBeChecked()
    expect(copyCustomerDisplay).toHaveBeenCalledTimes(1)
  })

  it('🔴 mientras se REVISA (lecturas retenidas) nada se puede elegir ni cerrar; una vista que no se pudo leer se dice aparte', async () => {
    const server = servidorConMemoria()
    vi.mocked(copyCustomerDisplay).mockImplementation(async (_v, _origen, destinos) => {
      server.aplicarCopia(destinos)
      throw new Error('Network Error')
    })
    const lecturaDeBarra = retenida<CustomerDisplayView>()
    const lecturaDeCaja2 = retenida<CustomerDisplayView>()
    vi.mocked(getCustomerDisplay).mockImplementation((_v, id) => (id === 'barra' ? lecturaDeBarra.promesa : lecturaDeCaja2.promesa))
    const user = userEvent.setup()
    const { onClose } = pintar()
    await elegirBarraYCaja2(user)
    await confirmar(user, 2)
    expect(await screen.findByText('copy.uncertainChecking')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(screen.getByRole('checkbox', { name: 'Barra' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'Barra' })).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'copy.submitEmpty' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'common:close' })) // la X de FullScreenModal, ya traducida
    expect(onClose).not.toHaveBeenCalled()
    await act(async () => {
      lecturaDeBarra.resolver(vistaDe('barra', server.disenos.barra, server.tokens.barra))
      lecturaDeCaja2.rechazar(new Error('Network Error'))
    })
    expect(await screen.findByText('copy.uncertainApplied {"name":"Caja 1","names":"Barra"}')).toBeInTheDocument()
    expect(screen.getByText('copy.uncertainUnchecked {"names":"Caja 2"}')).toBeInTheDocument()
    expect(screen.queryByText('copy.uncertainChecking')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Barra' })).toBeEnabled())
    expect(copyCustomerDisplay).toHaveBeenCalledTimes(1)
  })

  it('🔴 un 500 genérico NO es un rechazo confirmado: se reconcilia igual que una respuesta perdida (Codex r2)', async () => {
    dosPaginas()
    vi.mocked(copyCustomerDisplay).mockRejectedValue({ response: { status: 500, data: { message: 'Ocurrió un error inesperado en el servidor.' } } })
    const user = userEvent.setup()
    pintar()
    await user.click(await screen.findByRole('checkbox', { name: 'Barra' }))
    const lecturasAntes = vi.mocked(listCustomerDisplayDevices).mock.calls.length
    await confirmar(user, 1)
    expect(await screen.findByText('copy.uncertain')).toBeInTheDocument()
    await waitFor(() => expect(vi.mocked(listCustomerDisplayDevices).mock.calls.length).toBeGreaterThan(lecturasAntes))
    expect(screen.getByRole('checkbox', { name: 'Barra' })).not.toBeChecked()
    expect(toast).not.toHaveBeenCalled()
  })

  it('un rechazo CONFIRMADO (403: nada se escribió) se dice y conserva lo elegido para reintentar', async () => {
    dosPaginas()
    vi.mocked(copyCustomerDisplay).mockRejectedValue({ response: { status: 403, data: { message: 'No tienes permiso para cambiar la pantalla del cliente.' } } })
    const user = userEvent.setup()
    pintar()
    await user.click(await screen.findByRole('checkbox', { name: 'Barra' }))
    await confirmar(user, 1)
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({ variant: 'destructive', title: 'copy.error', description: 'No tienes permiso para cambiar la pantalla del cliente.' }),
    )
    expect(screen.getByRole('checkbox', { name: 'Barra' })).toBeChecked()
  })

  it('🔴 copia EN CURSO (respuesta retenida): un segundo toque no manda otra, nada se puede elegir y la confirmación no se cierra', async () => {
    dosPaginas()
    const copia = retenida<CustomerDisplayCopyResult>()
    vi.mocked(copyCustomerDisplay).mockReturnValue(copia.promesa)
    const user = userEvent.setup()
    const { onClose } = pintar()
    await user.click(await screen.findByRole('checkbox', { name: 'Barra' }))
    await confirmar(user, 1)
    const dialogo = screen.getByRole('alertdialog')
    const ir = within(dialogo).getByRole('button', { name: 'copy.confirmGo' })
    await waitFor(() => expect(ir).toBeDisabled())
    await user.click(ir)
    await user.keyboard('{Escape}')
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    // Con la confirmación abierta, Radix esconde lo de atrás del árbol de accesibilidad: por eso `hidden: true`.
    expect(screen.getByRole('checkbox', { name: 'Barra', hidden: true })).toBeDisabled()
    expect(copyCustomerDisplay).toHaveBeenCalledTimes(1)
    await act(async () => copia.resolver({ copied: ['barra'], promosOmitted: false }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(toast).toHaveBeenCalledWith({ title: 'copy.done {"names":"Barra"}', description: undefined })
  })

  it('🔴 lo elegido sobrevive a «Cargar más» (respuesta retenida) y el tope de 20 bloquea el 21º, venga de la página que venga', async () => {
    const pagina1 = Array.from({ length: 15 }, (_, i) => fila(`p${String(i).padStart(2, '0')}`, { editToken: `tp${i}:1` }))
    const pagina2 = Array.from({ length: 10 }, (_, i) => fila(`q${String(i).padStart(2, '0')}`, { editToken: `tq${i}:1` }))
    const segunda = retenida<CustomerDisplayDeviceList>()
    vi.mocked(listCustomerDisplayDevices).mockImplementation((_v, { cursor }) =>
      cursor ? segunda.promesa : Promise.resolve({ total: 26, nextCursor: 'p14', devices: [...pagina1, fila('caja-1')] }),
    )
    const user = userEvent.setup()
    pintar()
    await screen.findByRole('checkbox', { name: 'p00' })
    for (const f of pagina1) await user.click(screen.getByRole('checkbox', { name: f.name }))
    await user.click(screen.getByRole('button', { name: 'copy.loadMore' }))
    // Mientras llega la segunda página, lo elegido sigue ahí.
    expect(await screen.findByRole('button', { name: 'copy.loadingMore' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'p00' })).toBeChecked()
    await act(async () => segunda.resolver({ total: 26, nextCursor: null, devices: pagina2 }))
    expect(await screen.findByText('copy.counter {"shown":25,"total":25}')).toBeInTheDocument()
    for (const f of pagina2.slice(0, 5)) await user.click(screen.getByRole('checkbox', { name: f.name }))
    expect(screen.getByRole('checkbox', { name: 'q05' })).toBeDisabled()
    expect(screen.getByText('copy.limit {"max":20}')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'q05' }))
    expect(screen.getByRole('checkbox', { name: 'q05' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'p00' })).toBeChecked()
    await confirmar(user, 20)
    await waitFor(() => expect(copyCustomerDisplay).toHaveBeenCalledTimes(1))
    const destinos = vi.mocked(copyCustomerDisplay).mock.calls[0][2]
    expect(destinos).toHaveLength(20)
    expect(destinos).toEqual([
      ...pagina1.map(f => ({ terminalId: f.id, editToken: f.editToken })),
      ...pagina2.slice(0, 5).map(f => ({ terminalId: f.id, editToken: f.editToken })),
    ])
  })

  it('🔴 sin Pro, un destino que CONSERVA sus imágenes y su interruptor de promos tras la copia cuenta como «ya lo tiene» (la regla del server)', async () => {
    const server = servidorConMemoria()
    server.disenos.barra = { ...DISENO_DE_FABRICA, slides: [{ assetId: 's-barra' }], showPromotions: true }
    vi.mocked(copyCustomerDisplay).mockImplementation(async (_v, _origen, destinos) => {
      // Sin Pro el server copia marca, textos, logo y segundos; las imágenes y el interruptor del DESTINO se quedan.
      for (const d of destinos) {
        const antes = server.disenos[d.terminalId]
        server.disenos[d.terminalId] = { ...ORIGEN.design, slides: antes.slides, showPromotions: antes.showPromotions }
        server.tokens[d.terminalId] = 'cdd-9:1'
      }
      throw new Error('Network Error')
    })
    const user = userEvent.setup()
    pintar()
    await user.click(await screen.findByRole('checkbox', { name: 'Barra' }))
    await confirmar(user, 1)
    expect(await screen.findByText('copy.uncertainApplied {"name":"Caja 1","names":"Barra"}')).toBeInTheDocument()
    expect(screen.queryByText(/copy\.uncertainNotApplied/)).not.toBeInTheDocument()
  })

  it('🔴 si la revisión misma truena (una vista sin `entitlements`), no se queda en «Revisando…»: todos «no se pudo revisar»', async () => {
    const server = servidorConMemoria()
    vi.mocked(copyCustomerDisplay).mockImplementation(async (_v, _origen, destinos) => {
      server.aplicarCopia(destinos)
      throw new Error('Network Error')
    })
    vi.mocked(getCustomerDisplay).mockImplementation(
      async (_v, id) => ({ ...vistaDe(id, server.disenos[id], server.tokens[id]), entitlements: undefined }) as unknown as CustomerDisplayView,
    )
    const user = userEvent.setup()
    pintar()
    await elegirBarraYCaja2(user)
    await confirmar(user, 2)
    expect(await screen.findByText('copy.uncertainUnchecked {"names":"Barra y Caja 2"}')).toBeInTheDocument()
    expect(screen.queryByText('copy.uncertainChecking')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Barra' })).toBeEnabled())
    expect(copyCustomerDisplay).toHaveBeenCalledTimes(1)
  })

  it('🔴 «Cargar más» no cancela la relectura de la lista (retenida): queda bloqueado y los tokens nuevos sí llegan', async () => {
    const tokens: Record<string, string> = { barra: 'factory', 'caja-2': 'd2:7' }
    const relectura = retenida<void>()
    let retener = false
    vi.mocked(listCustomerDisplayDevices).mockImplementation(async (_v, { cursor }) => {
      if (!cursor && retener) await relectura.promesa
      return cursor
        ? { total: 4, nextCursor: null, devices: [fila('caja-2', { name: 'Caja 2', editToken: tokens['caja-2'] })] }
        : { total: 4, nextCursor: 'caja-1', devices: [fila('barra', { name: 'Barra', editToken: tokens.barra }), fila('caja-1', { name: 'Caja 1' })] }
    })
    // Alguien guardó en Barra: 409 confirmado y la lista se relee (sin que la mutación quede pendiente).
    vi.mocked(copyCustomerDisplay).mockImplementationOnce(async () => {
      tokens.barra = 'b5:1'
      retener = true
      throw {
        response: { status: 409, data: { message: 'Alguien más cambió el diseño de algún dispositivo mientras copiabas.', code: 'CUSTOMER_DISPLAY_CONFLICT', details: { conflicts: ['barra'] } } },
      }
    })
    const user = userEvent.setup()
    pintar()
    await user.click(await screen.findByRole('checkbox', { name: 'Barra' }))
    await confirmar(user, 1)
    await screen.findByText('Alguien más cambió el diseño de algún dispositivo mientras copiabas.')
    const cargarMas = screen.getByRole('button', { name: 'copy.loadMore' })
    await waitFor(() => expect(cargarMas).toBeDisabled())
    await user.click(cargarMas) // un toque aquí no debe cancelar la relectura
    retener = false
    await act(async () => relectura.resolver())
    await waitFor(() => expect(within(renglon('Barra')).getByText('copy.rowReplace')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole('button', { name: 'copy.loadMore' })).toBeEnabled())
    await user.click(screen.getByRole('checkbox', { name: 'Barra' }))
    await confirmar(user, 1)
    await waitFor(() =>
      expect(copyCustomerDisplay).toHaveBeenLastCalledWith('v1', { terminalId: 'caja-1', editToken: 'd1:2' }, [{ terminalId: 'barra', editToken: 'b5:1' }]),
    )
  })

  it('409 por destinos: se dice CUÁLES se quitaron de lo elegido, con los nombres guardados al elegir', async () => {
    dosPaginas()
    vi.mocked(copyCustomerDisplay).mockRejectedValue({
      response: { status: 409, data: { message: 'Alguien más cambió el diseño de algún dispositivo mientras copiabas.', code: 'CUSTOMER_DISPLAY_CONFLICT', details: { conflicts: ['barra', 'caja-2'] } } },
    })
    const user = userEvent.setup()
    pintar()
    await elegirBarraYCaja2(user)
    await user.click(screen.getByRole('checkbox', { name: 'Mostrador' }))
    await confirmar(user, 3)
    expect(await screen.findByText('copy.conflictRemoved {"names":"Barra y Caja 2"}')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Mostrador' })).toBeChecked()
  })

  it('el aviso de éxito no promete de más: si alguna copiada aún no tiene la app que muestra diseños, lo dice', async () => {
    dosPaginas()
    vi.mocked(copyCustomerDisplay).mockResolvedValue({ copied: ['barra', 'mostrador'], promosOmitted: false })
    const user = userEvent.setup()
    const { onClose } = pintar()
    await user.click(await screen.findByRole('checkbox', { name: 'Barra' }))
    await user.click(screen.getByRole('button', { name: 'copy.loadMore' }))
    await user.click(await screen.findByRole('checkbox', { name: 'Mostrador' })) // designVersion null: «Aún sin la app…»
    await confirmar(user, 2)
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(toast).toHaveBeenCalledWith({ title: 'copy.doneNeedsApp {"names":"Barra y Mostrador"}', description: undefined })
  })

  it('tope de 20: con 20 elegidos, el resto no se puede marcar y se explica', async () => {
    const muchas = Array.from({ length: 22 }, (_, i) => fila(`d${String(i).padStart(2, '0')}`))
    vi.mocked(listCustomerDisplayDevices).mockResolvedValue({ total: 22, nextCursor: null, devices: muchas })
    const user = userEvent.setup()
    pintar()
    await screen.findByRole('checkbox', { name: 'd00' })
    for (let i = 0; i < 20; i++) await user.click(screen.getByRole('checkbox', { name: `d${String(i).padStart(2, '0')}` }))
    expect(screen.getByRole('checkbox', { name: 'd20' })).toBeDisabled()
    expect(screen.getByText('copy.limit {"max":20}')).toBeInTheDocument()
  })

  it('el renglón completo marca y desmarca (no sólo la casilla)', async () => {
    dosPaginas()
    const user = userEvent.setup()
    pintar()
    await screen.findByRole('checkbox', { name: 'Barra' })
    await user.click(within(renglon('Barra')).getByText('Barra'))
    expect(screen.getByRole('checkbox', { name: 'Barra' })).toBeChecked()
    await user.click(within(renglon('Barra')).getByText('copy.rowFactory'))
    expect(screen.getByRole('checkbox', { name: 'Barra' })).not.toBeChecked()
  })

  it('vacío y sin PRO se distinguen', async () => {
    vi.mocked(listCustomerDisplayDevices).mockResolvedValue({ total: 1, nextCursor: null, devices: [fila('caja-1')] })
    pintar()
    expect(await screen.findByText('copy.empty')).toBeInTheDocument()
    expect(screen.getByText('copy.noProNote')).toBeInTheDocument()
  })

  it('si la lista falla, se dice y se puede reintentar (no se ve como «vacía»)', async () => {
    vi.mocked(listCustomerDisplayDevices).mockRejectedValue(new Error('Network Error'))
    pintar({ slides: true, promotionCards: true })
    expect(await screen.findByText('copy.loadError', {}, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.queryByText('copy.empty')).not.toBeInTheDocument()
    expect(screen.queryByText('copy.noProNote')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'copy.retry' })).toBeInTheDocument()
  })
})
