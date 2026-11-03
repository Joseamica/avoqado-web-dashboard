import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { StampCardSection } from '../StampCardSection'

/**
 * «Ajustar sellos» (sellos a mano). Lo que se fija:
 *  - la meta y el máximo salen de la TARJETA, no de la configuración;
 *  - Guardar sólo se habilita con un entero válido y distinto del actual;
 *  - se mandan los expected* de la lectura (CAS) y un 409 refresca sin cerrar.
 */
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}|${JSON.stringify(opts)}` : key),
  }),
}))
const toast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))

const permisos = { valor: new Set<string>() }
vi.mock('@/components/PermissionGate', () => ({
  PermissionGate: ({ permission, children, fallback }: any) => (permisos.valor.has(permission) ? <>{children}</> : <>{fallback ?? null}</>),
}))

const mockGet = vi.fn()
const mockAdjust = vi.fn()
vi.mock('@/services/walletCard.service', () => ({
  stampCardService: {
    getStatus: (...a: unknown[]) => mockGet(...a),
    adjust: (...a: unknown[]) => mockAdjust(...a),
  },
}))

const estado = (over: Record<string, unknown> = {}) => ({
  stampCardId: 'c1',
  version: 3,
  stampsEnabled: true,
  stampsEarned: 6,
  stampsRequired: 10,
  rewardLabel: 'Un producto gratis',
  pendingRewards: 0,
  rewardsToClaim: [],
  ...over,
})

let client: QueryClient
const arbol = (customerId = 'u1', enabled = true) => (
  <QueryClientProvider client={client}>
    <StampCardSection venueId="v1" customerId={customerId} enabled={enabled} />
  </QueryClientProvider>
)
function pintar(enabled = true) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(arbol('u1', enabled))
}

async function abrir() {
  const user = userEvent.setup()
  await user.click(await screen.findByTestId('stamps-adjust-open'))
  return user
}
const campo = () => screen.getByLabelText('stamps.adjust.fields.stamps') as HTMLInputElement
const guardar = () => screen.getByTestId('stamps-adjust-save') as HTMLButtonElement
const motivo = () => screen.getByLabelText('stamps.adjust.fields.reason')

async function escribir(user: ReturnType<typeof userEvent.setup>, v: string) {
  await user.clear(campo())
  if (v !== '') await user.type(campo(), v)
}

beforeEach(() => {
  vi.clearAllMocks()
  permisos.valor = new Set(['loyalty:adjust'])
  mockGet.mockResolvedValue(estado())
  mockAdjust.mockResolvedValue({ stampCardId: 'c1', from: 6, to: 8, delta: 2, completed: false, stampsRequired: 10 })
})

describe('StampCardSection', () => {
  it('enseña 6 de 10 y los premios por canjear', async () => {
    mockGet.mockResolvedValue(estado({ rewardsToClaim: [{ id: 'r1' }, { id: 'r2' }] }))
    pintar()
    const resumen = await screen.findByTestId('stamps-summary')
    expect(resumen).toHaveTextContent('"earned":6')
    expect(resumen).toHaveTextContent('"required":10')
    expect(screen.getByTestId('stamps-rewards')).toHaveTextContent('"count":2')
  })

  it('sin loyalty:adjust no hay botón', async () => {
    permisos.valor = new Set()
    pintar()
    await screen.findByTestId('stamps-summary')
    expect(screen.queryByTestId('stamps-adjust-open')).toBeNull()
  })

  it('la meta y el máximo salen de la tarjeta', async () => {
    mockGet.mockResolvedValue(estado({ stampsEarned: 3, stampsRequired: 5 }))
    pintar()
    const user = await abrir()
    expect(campo().value).toBe('3')
    expect(campo()).toHaveAttribute('max', '5')
    await user.type(screen.getByLabelText('stamps.adjust.fields.reason'), 'Venían de otro sistema')
    await escribir(user, '6')
    expect(guardar()).toBeDisabled()
    await escribir(user, '5')
    expect(guardar()).toBeEnabled()
  })

  it('7.5, -1, vacío, 11 o igual al actual dejan Guardar deshabilitado', async () => {
    pintar()
    const user = await abrir()
    await user.type(screen.getByLabelText('stamps.adjust.fields.reason'), 'Venían de otro sistema')
    for (const v of ['7.5', '-1', '', '11', '6']) {
      await escribir(user, v)
      expect(guardar(), `valor «${v}»`).toBeDisabled()
    }
    await escribir(user, '8')
    expect(guardar()).toBeEnabled()
  })

  it('en la meta dice «Completa la tarjeta: gana «Un producto gratis»…»', async () => {
    pintar()
    const user = await abrir()
    await escribir(user, '10')
    const p = screen.getByTestId('stamps-adjust-preview')
    expect(p).toHaveTextContent('stamps.adjust.preview.complete')
    expect(p).toHaveTextContent('Un producto gratis')
    await escribir(user, '8')
    expect(screen.getByTestId('stamps-adjust-preview')).toHaveTextContent('stamps.adjust.preview.change')
  })

  it('manda los expected* de la lectura', async () => {
    pintar()
    const user = await abrir()
    await escribir(user, '8')
    await user.type(screen.getByLabelText('stamps.adjust.fields.reason'), '  Venían de otro sistema  ')
    await user.click(guardar())
    await waitFor(() => expect(mockAdjust).toHaveBeenCalledTimes(1))
    expect(mockAdjust).toHaveBeenCalledWith('v1', 'u1', {
      stampsEarned: 8,
      expectedStampCardId: 'c1',
      expectedStampsEarned: 6,
      expectedVersion: 3,
      expectedStampsRequired: 10,
      reason: 'Venían de otro sistema',
    })
  })

  it('409 STAMPS_CHANGED: avisa con el número nuevo y refresca', async () => {
    mockAdjust.mockRejectedValue({
      response: {
        status: 409,
        data: {
          code: 'STAMPS_CHANGED',
          details: { stampCardId: 'c1', stampsEarned: 9, stampsRequired: 10, version: 4, rewardLabel: 'Un producto gratis' },
        },
      },
    })
    pintar()
    const user = await abrir()
    await escribir(user, '8')
    await user.type(screen.getByLabelText('stamps.adjust.fields.reason'), 'Venían de otro sistema')
    const antes = mockGet.mock.calls.length
    await user.click(guardar())
    await waitFor(() => expect(toast).toHaveBeenCalled())
    expect(toast.mock.calls[0][0].title).toContain('stamps.adjust.changed')
    expect(toast.mock.calls[0][0].title).toContain('"n":9')
    await waitFor(() => expect(mockGet.mock.calls.length).toBeGreaterThan(antes))
    expect(screen.getByTestId('stamps-adjust-save')).toBeInTheDocument() // diálogo abierto
  })

  it('éxito: toast e invalida', async () => {
    pintar()
    const user = await abrir()
    await escribir(user, '8')
    await user.type(screen.getByLabelText('stamps.adjust.fields.reason'), 'Venían de otro sistema')
    const spy = vi.spyOn(client, 'invalidateQueries')
    await user.click(guardar())
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'stamps.adjust.success' }))
    expect(spy).toHaveBeenCalledWith({ queryKey: ['stamp-card', 'v1', 'u1'] })
    await waitFor(() => expect(screen.queryByTestId('stamps-adjust-save')).toBeNull())
  })

  // 🔴 Codex r1, bloqueante 1: el ajuste se amarra a la tarjeta con que se abrió el diálogo.
  it('un refresco de la consulta con el diálogo abierto no cambia los expected* que se mandan', async () => {
    mockGet.mockResolvedValue(estado({ stampsEarned: 9, version: 5 }))
    pintar()
    const user = await abrir()
    await escribir(user, '10')
    await user.type(motivo(), 'Venían de otro sistema')
    // mientras tanto una venta completó la tarjeta y abrió otra en 0
    mockGet.mockResolvedValue(estado({ stampCardId: 'c2', stampsEarned: 0, version: 0 }))
    await act(async () => {
      await client.invalidateQueries({ queryKey: ['stamp-card', 'v1', 'u1'] })
    })
    await waitFor(() => expect(screen.getByTestId('stamps-summary')).toHaveTextContent('"earned":0'))
    await user.click(guardar())
    await waitFor(() => expect(mockAdjust).toHaveBeenCalledTimes(1))
    expect(mockAdjust).toHaveBeenCalledWith('v1', 'u1', {
      stampsEarned: 10,
      expectedStampCardId: 'c1',
      expectedStampsEarned: 9,
      expectedVersion: 5,
      // la meta también es de la foto con que se abrió
      expectedStampsRequired: 10,
      reason: 'Venían de otro sistema',
    })
  })

  it('tras un 409 el segundo Guardar manda los números del aviso', async () => {
    mockAdjust.mockRejectedValueOnce({
      response: {
        status: 409,
        data: {
          code: 'STAMPS_CHANGED',
          details: { stampCardId: 'c1', stampsEarned: 9, stampsRequired: 10, version: 4, rewardLabel: 'Un producto gratis' },
        },
      },
    })
    pintar()
    const user = await abrir()
    await escribir(user, '8')
    await user.type(motivo(), 'Venían de otro sistema')
    await user.click(guardar())
    await waitFor(() => expect(toast).toHaveBeenCalled())
    // Lo escrito no sobrevive al aviso: el campo enseña el número nuevo y Guardar espera un número nuevo
    // (un segundo clic «por si no se guardó» no puede llenar una tarjeta que el gerente no vio).
    await waitFor(() => expect(campo().value).toBe('9'))
    expect(guardar()).toBeDisabled()
    await escribir(user, '8')
    await user.click(guardar())
    await waitFor(() => expect(mockAdjust).toHaveBeenCalledTimes(2))
    expect(mockAdjust).toHaveBeenLastCalledWith('v1', 'u1', {
      stampsEarned: 8,
      expectedStampCardId: 'c1',
      expectedStampsEarned: 9,
      expectedVersion: 4,
      expectedStampsRequired: 10,
      reason: 'Venían de otro sistema',
    })
  })

  // 🔴 Codex r1, bloqueante 2: el diálogo no sobrevive al cambio de cliente.
  it('cambiar de cliente cierra el diálogo y no manda nada al otro cliente', async () => {
    mockGet.mockImplementation(async (_v: string, c: string) => (c === 'u2' ? estado({ stampCardId: 'c2', stampsEarned: 2 }) : estado()))
    const { rerender } = pintar()
    const user = await abrir()
    await escribir(user, '8')
    await user.type(motivo(), 'Venían de otro sistema')
    rerender(arbol('u2'))
    await waitFor(() => expect(screen.getByTestId('stamps-summary')).toHaveTextContent('"earned":2'))
    expect(screen.queryByTestId('stamps-adjust-save')).toBeNull()
    expect(mockAdjust).not.toHaveBeenCalled()
  })

  it('409 STAMPS_DISABLED: avisa, cierra el diálogo e invalida la tarjeta', async () => {
    mockAdjust.mockRejectedValue({ response: { status: 409, data: { code: 'STAMPS_DISABLED' } } })
    pintar()
    const user = await abrir()
    await escribir(user, '8')
    await user.type(motivo(), 'Venían de otro sistema')
    const spy = vi.spyOn(client, 'invalidateQueries')
    await user.click(guardar())
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'stamps.adjust.disabled' })))
    expect(spy).toHaveBeenCalledWith({ queryKey: ['stamp-card', 'v1', 'u1'] })
    await waitFor(() => expect(screen.queryByTestId('stamps-adjust-save')).toBeNull())
  })

  // ── Pasada de la familia (24-oct): el ajuste se aplica SÓLO sobre lo que el gerente vio ──────────────────────────────

  // F4: la respuesta de una apertura vieja (Guardar, Cancelar, abrir otra) nunca toca la apertura actual.
  it.each<[string, (ok: (v: unknown) => void, falla: (e: unknown) => void) => void]>([
    ['éxito', ok => ok({ stampCardId: 'c1', from: 6, to: 8, delta: 2, completed: false, stampsRequired: 10 })],
    [
      'STAMPS_CHANGED',
      (_ok, falla) =>
        falla({
          response: {
            status: 409,
            data: {
              code: 'STAMPS_CHANGED',
              details: { stampCardId: 'c7', stampsEarned: 4, stampsRequired: 8, version: 7, rewardLabel: 'Postre' },
            },
          },
        }),
    ],
    ['STAMPS_DISABLED', (_ok, falla) => falla({ response: { status: 409, data: { code: 'STAMPS_DISABLED' } } })],
  ])('una respuesta de otra apertura (%s) no toca el borrador actual', async (_n, desenlace) => {
    let ok!: (v: unknown) => void
    let falla!: (e: unknown) => void
    mockAdjust.mockImplementationOnce(
      () =>
        new Promise((res, rej) => {
          ok = res
          falla = rej
        }),
    )
    pintar()
    const user = await abrir()
    await escribir(user, '8')
    await user.type(motivo(), 'Venían de otro sistema')
    await user.click(guardar())
    await waitFor(() => expect(mockAdjust).toHaveBeenCalledTimes(1))
    // Cancela la apertura 1 con su POST en vuelo y abre la 2.
    await user.click(screen.getByText('stamps.adjust.cancel'))
    await waitFor(() => expect(screen.queryByTestId('stamps-adjust-save')).toBeNull())
    await user.click(screen.getByTestId('stamps-adjust-open'))
    await escribir(user, '9')
    await user.type(motivo(), 'Segunda apertura')

    await act(async () => desenlace(ok, falla))
    await waitFor(() => expect(toast).toHaveBeenCalled())

    // La apertura 2 sigue abierta con SU foto, su 9 y su motivo, y nadie mandó otro POST.
    expect(screen.getByTestId('stamps-adjust-save')).toBeInTheDocument()
    expect(campo().value).toBe('9')
    expect(motivo()).toHaveValue('Segunda apertura')
    expect(screen.getByTestId('stamps-adjust-foto')).toHaveTextContent('"earned":6')
    expect(screen.getByTestId('stamps-adjust-foto')).toHaveTextContent('"required":10')
    expect(campo()).toHaveAttribute('max', '10')
    expect(mockAdjust).toHaveBeenCalledTimes(1)
  })

  // Segunda capa del `key={customerId}` del padre: el componente solo no resucita el diálogo de A al volver a A.
  it('A → B → A no resucita el diálogo', async () => {
    mockGet.mockImplementation(async (_v: string, c: string) => (c === 'u2' ? estado({ stampCardId: 'c2', stampsEarned: 2 }) : estado()))
    const { rerender } = pintar()
    const user = await abrir()
    await escribir(user, '8')
    await user.type(motivo(), 'Venían de otro sistema')
    rerender(arbol('u2'))
    await waitFor(() => expect(screen.getByTestId('stamps-summary')).toHaveTextContent('"earned":2'))
    rerender(arbol('u1'))
    await waitFor(() => expect(screen.getByTestId('stamps-summary')).toHaveTextContent('"earned":6'))
    expect(screen.queryByTestId('stamps-adjust-save')).toBeNull()
    expect(mockAdjust).not.toHaveBeenCalled()
  })

  // F5: apagar los sellos en otra pestaña no borra el diálogo en silencio.
  it('apagar los sellos con el diálogo abierto no lo borra y lo explica', async () => {
    const { rerender } = pintar()
    const user = await abrir()
    await escribir(user, '8')
    await user.type(motivo(), 'Venían de otro sistema')
    rerender(arbol('u1', false))
    expect(screen.getByTestId('stamps-adjust-save')).toBeInTheDocument()
    expect(campo().value).toBe('8')
    expect(motivo()).toHaveValue('Venían de otro sistema')
    expect(guardar()).toBeDisabled()
    expect(screen.getByTestId('stamps-adjust-disabled')).toHaveTextContent('stamps.adjust.disabled')
    await user.click(guardar())
    expect(mockAdjust).not.toHaveBeenCalled()
  })

  it('con los sellos apagados y sin diálogo no pinta nada ni pide la cartilla', async () => {
    const { container } = pintar(false)
    await act(async () => {})
    expect(container).toBeEmptyDOMElement()
    expect(mockGet).not.toHaveBeenCalled()
  })

  // El 409 propio reemplaza la foto COMPLETA: también la meta y la etiqueta del premio.
  it('el 409 reemplaza la foto completa', async () => {
    mockAdjust.mockRejectedValueOnce({
      response: {
        status: 409,
        data: {
          code: 'STAMPS_CHANGED',
          details: { stampCardId: 'c1', stampsEarned: 3, stampsRequired: 8, version: 4, rewardLabel: 'Postre gratis' },
        },
      },
    })
    pintar()
    const user = await abrir()
    await escribir(user, '8')
    await user.type(motivo(), 'Venían de otro sistema')
    await user.click(guardar())
    await waitFor(() => expect(campo().value).toBe('3'))
    expect(campo()).toHaveAttribute('max', '8')
    expect(guardar()).toBeDisabled()
    await escribir(user, '8')
    const p = screen.getByTestId('stamps-adjust-preview')
    expect(p).toHaveTextContent('stamps.adjust.preview.complete')
    expect(p).toHaveTextContent('Postre gratis')
    // «de N» dentro del diálogo: la foto contra la que se confirma.
    expect(screen.getByTestId('stamps-adjust-foto')).toHaveTextContent('"earned":3')
    expect(screen.getByTestId('stamps-adjust-foto')).toHaveTextContent('"required":8')
    await user.click(guardar())
    await waitFor(() => expect(mockAdjust).toHaveBeenCalledTimes(2))
    expect(mockAdjust).toHaveBeenLastCalledWith('v1', 'u1', {
      stampsEarned: 8,
      expectedStampCardId: 'c1',
      expectedStampsEarned: 3,
      expectedVersion: 4,
      expectedStampsRequired: 8,
      reason: 'Venían de otro sistema',
    })
  })

  // ── Full-testing (24-oct): W1 y W2 ──────────────────────────────────────────────────────────────────────────────────

  // W1: dos envíos en el MISMO instante (antes de que `isPending` cambie) salían los dos; el servidor aplicaba uno y la
  // pantalla enseñaba «Sellos ajustados» y el 409 a la vez.
  it('W1: dos envíos en el mismo instante mandan UN solo POST', async () => {
    let soltar: (v: unknown) => void = () => undefined
    mockAdjust.mockReturnValue(new Promise(r => (soltar = r)))
    pintar()
    const user = await abrir()
    await escribir(user, '8')
    await user.type(motivo(), 'Venían de otro sistema')
    act(() => {
      guardar().click()
      guardar().click()
    })
    // `mutate` llama al servicio en la siguiente vuelta: se espera a que salga lo que vaya a salir.
    await waitFor(() => expect(mockAdjust).toHaveBeenCalled())
    await act(async () => new Promise(r => setTimeout(r, 0)))
    expect(mockAdjust).toHaveBeenCalledTimes(1)
    await act(async () => soltar({ stampCardId: 'c1', from: 6, to: 8, delta: 2, completed: false, stampsRequired: 10 }))
  })

  // W2: tras «El programa de sellos está apagado» la tarjeta seguía ofreciendo «Ajustar sellos» hasta recargar: la
  // configuración del padre (`['loyalty-config', venueId]`) no se refrescaba.
  it('W2: 409 STAMPS_DISABLED también refresca la configuración de lealtad', async () => {
    mockAdjust.mockRejectedValue({ response: { status: 409, data: { code: 'STAMPS_DISABLED' } } })
    pintar()
    const user = await abrir()
    await escribir(user, '8')
    await user.type(motivo(), 'Venían de otro sistema')
    const spy = vi.spyOn(client, 'invalidateQueries')
    await user.click(guardar())
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ['loyalty-config', 'v1'] }))
  })
})
