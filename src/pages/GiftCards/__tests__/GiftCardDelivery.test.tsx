import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GiftCardDelivery as Entrega, GiftCardDetail, GiftCardResendResult } from '@/types/giftCard'

const svc = vi.hoisted(() => ({
  getGiftCardSettings: vi.fn(),
  updateGiftCardSettings: vi.fn(),
  listGiftCards: vi.fn(),
  getGiftCardDetail: vi.fn(),
  operateGiftCard: vi.fn(),
  resendGiftCard: vi.fn(),
  startGiftCardSaleCancel: vi.fn(),
  releaseGiftCardSaleCancel: vi.fn(),
  getGiftCardSummary: vi.fn(),
  getGiftCardAging: vi.fn(),
  listGiftCardPendingAccounting: vi.fn(),
  downloadGiftCardBalancesCsv: vi.fn(),
}))
vi.mock('@/services/giftCard.service', () => svc)
const access = vi.hoisted(() => ({ allowed: ['giftCards:read', 'giftCards:manage'] as string[] }))
vi.mock('@/hooks/use-access', () => ({
  useAccess: () => ({
    can: (p: string) => access.allowed.includes(p),
    canAny: (ps: string[]) => ps.some(p => access.allowed.includes(p)),
    canAll: (ps: string[]) => ps.every(p => access.allowed.includes(p)),
    access: { userId: 'u1' },
  }),
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/demo' }) }))
const toast = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({ formatDateTime: (d: string) => `fecha ${d}`, formatDate: (d: string) => `día ${d}` }),
}))
// Devuelve la llave (sin i18n inicializado, el panel se toma como español: el texto del server con `code` sale tal cual).
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

import { olvidarIntentosEnDuda } from '@/hooks/use-gift-cards'
import { olvidarPendientes } from '@/pages/Commissions/envioUnico'
import { GiftCardDelivery } from '../components/GiftCardDelivery'

const ENTREGA_FALLIDA: Entrega = {
  channel: 'WHATSAPP',
  status: 'FAILED',
  deliveredAt: null,
  error: 'WhatsApp no aceptó el envío.',
  errorCode: 'WHATSAPP_SEND_FAILED',
  destino: '55•••••678',
  intentos: 4,
}
/** El detalle de C4 + S7 TAL CUAL: `recipientPhone` llega COMPLETO por compatibilidad y el panel nunca lo pinta (contrato § 8). */
const DETALLE: GiftCardDetail = {
  id: 'g1',
  last4: '4821',
  status: 'ACTIVE',
  initialAmount: 1500,
  balance: 500,
  createdAt: '2026-10-14T16:00:00.000Z',
  activatedAt: '2026-10-14T16:01:00.000Z',
  expiresAt: null,
  deliveryChannel: 'WHATSAPP',
  deliveryStatus: 'FAILED',
  recipientName: 'Ana López',
  purchaserName: null,
  source: 'POS',
  customer: null,
  order: { id: 'o1', orderNumber: 'A-1042' },
  validityMonths: null,
  termsVersion: '2026-10-14',
  message: null,
  recipientPhone: '+525512345678',
  recipientEmail: null,
  purchaserContact: null,
  deliveredAt: null,
  deactivatedAt: null,
  hasRedeem: false,
  canReplaceCode: true,
  cancel: { allowed: true, reason: null, message: null },
  currentBlock: null,
  activities: { items: [], nextCursor: null, total: 0 },
  entrega: ENTREGA_FALLIDA,
}
const HECHO: GiftCardResendResult = { giftCardId: 'g1', deliveryStatus: 'PENDING', repuesta: false, ultimos4: '4821' }
const detalle = (over: Partial<GiftCardDetail> = {}, entrega: Partial<Entrega> = {}): GiftCardDetail => ({
  ...DETALLE,
  ...over,
  entrega: { ...ENTREGA_FALLIDA, ...entrega },
})

let client: QueryClient
let user: ReturnType<typeof userEvent.setup>
const pintar = (d: GiftCardDetail = DETALLE) =>
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <GiftCardDelivery venueId="v1" detail={d} />
      </QueryClientProvider>
    </MemoryRouter>,
  )
const boton = (name: string) => screen.getByRole('button', { name })
const sinBoton = (name: string) => expect(screen.queryByRole('button', { name })).toBeNull()
const sinRespuesta = () => Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' })
type Llamada = { operationKey: string; deliveryChannel?: string; recipientPhone?: string; recipientEmail?: string }
const cuerpo = (i: number) => svc.resendGiftCard.mock.calls[i][2] as Llamada
const cerrarModal = () => user.click(screen.getByRole('button', { name: /^(Cerrar|common:close)$/ }))

/** Abre «Cambiar destino», elige el canal, teclea el destino y manda. */
async function cambiarA(canal: 'WHATSAPP' | 'EMAIL', destino: string) {
  if (!screen.queryByRole('dialog')) await user.click(boton('deliveryActions.changeDestination'))
  await user.click(screen.getByLabelText(`delivery.${canal}`))
  const campo = screen.getByLabelText(canal === 'WHATSAPP' ? 'deliveryActions.changePhone' : 'deliveryActions.changeEmail')
  await user.clear(campo)
  await user.type(campo, destino)
  await user.click(boton('deliveryActions.changeConfirm'))
}

beforeEach(() => {
  vi.clearAllMocks()
  olvidarPendientes()
  olvidarIntentosEnDuda()
  sessionStorage.clear()
  access.allowed = ['giftCards:read', 'giftCards:manage']
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  user = userEvent.setup()
})

describe('GiftCardDelivery — cómo va la entrega', () => {
  it('un cajero (sólo giftCards:read) ve destino, intentos y el motivo del fallo, pero ninguna acción', () => {
    access.allowed = ['giftCards:read']
    pintar(DETALLE)
    expect(screen.getByText('55•••••678')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('deliveryErrors.WHATSAPP_SEND_FAILED')).toBeInTheDocument()
    sinBoton('deliveryActions.resend')
    sinBoton('deliveryActions.changeDestination')
  })

  it('🔴 el destino es el ENMASCARADO del server: el teléfono y el correo completos del detalle nunca se pintan', () => {
    const { unmount } = pintar(DETALLE)
    expect(document.body.textContent).not.toContain('5512345678')
    expect(document.body.textContent).not.toContain('+525512345678')
    unmount()
    pintar(
      detalle(
        { deliveryChannel: 'EMAIL', recipientPhone: null, recipientEmail: 'ana.lopez@correo.com' },
        { channel: 'EMAIL', destino: 'an•••@correo.com', errorCode: 'EMAIL_SEND_FAILED' },
      ),
    )
    expect(screen.getByText('an•••@correo.com')).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('ana.lopez@correo.com')
  })

  it('sin `entrega` (server sin S7) no pinta nada', () => {
    const { container } = pintar({ ...DETALLE, entrega: undefined })
    expect(container).toBeEmptyDOMElement()
  })

  it('enviada: enseña «Enviada» con la fecha del negocio y sin motivo de fallo', () => {
    pintar(detalle({}, { status: 'SENT', deliveredAt: '2026-10-14T16:05:00.000Z', error: null, errorCode: null, intentos: 1 }))
    expect(screen.getByText('deliveryInfo.sentAt')).toBeInTheDocument()
    expect(screen.getByText('fecha 2026-10-14T16:05:00.000Z')).toBeInTheDocument()
    expect(screen.queryByText(/^deliveryInfo\.failed/)).toBeNull()
    expect(screen.queryByText(/^deliveryErrors\./)).toBeNull()
  })

  it('por enviar y sin intentos: el destino, sin «Intentos» ni motivo', () => {
    pintar(detalle({}, { status: 'PENDING', error: null, errorCode: null, intentos: 0 }))
    expect(screen.getByText('55•••••678')).toBeInTheDocument()
    expect(screen.queryByText('deliveryInfo.attempts')).toBeNull()
    expect(screen.queryByText(/^deliveryErrors\./)).toBeNull()
  })
})

describe('GiftCardDelivery — qué acciones ofrece', () => {
  it('activa, por WhatsApp y con giftCards:manage: «Reenviar» y «Cambiar destino»', () => {
    pintar(DETALLE)
    expect(boton('deliveryActions.resend')).toBeEnabled()
    expect(boton('deliveryActions.changeDestination')).toBeEnabled()
  })

  it.each(['PRINTED', 'HANDED_TO_BUYER'] as const)('con %s no hay «Reenviar», pero sí «Cambiar destino»', canal => {
    pintar(
      detalle({ deliveryChannel: canal }, { channel: canal, status: 'PENDING', destino: null, error: null, errorCode: null, intentos: 0 }),
    )
    sinBoton('deliveryActions.resend')
    expect(boton('deliveryActions.changeDestination')).toBeEnabled()
    // Sin destino digital no hay nada que informar de la entrega (el canal ya lo dice el detalle).
    expect(screen.queryByText('deliveryInfo.destination')).toBeNull()
  })

  it.each([
    ['BLOCKED', { status: 'BLOCKED' }],
    ['DEACTIVATED', { status: 'DEACTIVATED' }],
    ['PENDING', { status: 'PENDING' }],
    // EXPIRED = ACTIVE con `expiresAt` ya pasado
    ['EXPIRED', { status: 'ACTIVE', expiresAt: '2020-01-01T00:00:00.000Z' }],
  ] as const)('una tarjeta %s no ofrece acciones de entrega (S-4)', (_estado, over) => {
    pintar(detalle(over as Partial<GiftCardDetail>))
    sinBoton('deliveryActions.resend')
    sinBoton('deliveryActions.changeDestination')
    // la información sí se ve
    expect(screen.getByText('55•••••678')).toBeInTheDocument()
  })

  it('CUSTOMER_CARD (1c) no ofrece acciones de entrega', () => {
    const { container } = pintar(
      detalle(
        { deliveryChannel: 'CUSTOMER_CARD' },
        { channel: 'CUSTOMER_CARD', status: 'PENDING', destino: null, error: null, errorCode: null },
      ),
    )
    sinBoton('deliveryActions.resend')
    sinBoton('deliveryActions.changeDestination')
    expect(container).toBeEmptyDOMElement()
  })

  it('«Cambiar destino» se ve apagado con su razón si ya se usó o está guardada (canReplaceCode=false)', () => {
    pintar(detalle({ canReplaceCode: false }))
    expect(boton('deliveryActions.changeDestination')).toBeDisabled()
    expect(screen.getByText('deliveryActions.cantChange')).toBeInTheDocument()
    // Reenviar al MISMO destino no repone: sigue disponible.
    expect(boton('deliveryActions.resend')).toBeEnabled()
  })

  it('cada CTA lleva su `data-tour`', () => {
    pintar(DETALLE)
    expect(document.querySelector('[data-tour="gift-card-delivery"]')).not.toBeNull()
    expect(boton('deliveryActions.resend')).toHaveAttribute('data-tour', 'gift-card-resend')
    expect(boton('deliveryActions.changeDestination')).toHaveAttribute('data-tour', 'gift-card-change-destination')
  })
})

describe('GiftCardDelivery — «Reenviar»', () => {
  it('🔴 «Reenviar» manda UNA vez { operationKey } (sin destino) aunque haya doble clic; al éxito avisa, cierra y relee', async () => {
    // La respuesta tarda (como en la red): el doble clic ocurre con el primer envío todavía en vuelo.
    let responder: (r: GiftCardResendResult) => void = () => {}
    svc.resendGiftCard.mockReturnValue(new Promise<GiftCardResendResult>(r => (responder = r)))
    const relee = vi.spyOn(client, 'invalidateQueries')
    pintar(DETALLE)
    await user.click(boton('deliveryActions.resend'))
    const dialogo = screen.getByRole('alertdialog')
    expect(within(dialogo).getByText('deliveryActions.resendTitle')).toBeInTheDocument()
    expect(within(dialogo).getByText('deliveryActions.resendDescription')).toBeInTheDocument()
    const confirmar = within(dialogo).getByRole('button', { name: 'deliveryActions.resend' })
    expect(confirmar).toHaveAttribute('data-tour', 'gift-card-resend-confirm')
    await user.dblClick(confirmar)
    expect(svc.resendGiftCard).toHaveBeenCalledTimes(1)
    responder(HECHO)
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'deliveryActions.resendDone' }))
    expect(svc.resendGiftCard).toHaveBeenCalledTimes(1)
    expect(svc.resendGiftCard).toHaveBeenCalledWith('v1', 'g1', { operationKey: expect.any(String) })
    expect(relee).toHaveBeenCalledWith({ queryKey: ['gift-cards', 'v1', 'detail', 'g1'] })
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('🔴 un 409 con `code` enseña el texto del server y el siguiente intento lleva llave nueva', async () => {
    const texto = 'Esta tarjeta se entregó en papel o en mano. Para mandarla por WhatsApp o correo, cambia el destino.'
    svc.resendGiftCard
      .mockRejectedValueOnce({ response: { status: 409, data: { code: 'GIFT_CARD_NOT_DELIVERABLE', message: texto } } })
      .mockResolvedValueOnce(HECHO)
    pintar(DETALLE)
    await user.click(boton('deliveryActions.resend'))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'deliveryActions.resend' }))
    expect(await screen.findByText(texto)).toBeInTheDocument()
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'deliveryActions.resend' }))
    await waitFor(() => expect(svc.resendGiftCard).toHaveBeenCalledTimes(2))
    expect(cuerpo(1).operationKey).not.toBe(cuerpo(0).operationKey)
  })

  it('🔴 Cierre A: el tope de reenvíos (429) enseña el texto del server y no deja nada en duda', async () => {
    const texto = 'Ya reenviamos esta tarjeta varias veces. Espera un rato y vuelve a intentar.'
    svc.resendGiftCard.mockRejectedValueOnce({
      response: { status: 429, data: { success: false, code: 'GIFT_CARD_RESEND_RATE_LIMITED', message: texto, retryAfter: 3600 } },
    })
    pintar(DETALLE)
    await user.click(boton('deliveryActions.resend'))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'deliveryActions.resend' }))
    expect(await screen.findByText(texto)).toBeInTheDocument()
    expect(screen.queryByText('actions.inDoubt')).toBeNull()
  })

  it('🔴 en duda: «Intentar otra vez» repite la MISMA llave; cerrar y reabrir lo trae con «Descartar»', async () => {
    svc.resendGiftCard.mockRejectedValueOnce(sinRespuesta()).mockResolvedValueOnce(HECHO)
    pintar(DETALLE)
    await user.click(boton('deliveryActions.resend'))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'deliveryActions.resend' }))
    await screen.findByText('actions.inDoubt')
    await user.click(boton('actions.cancel'))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await user.click(boton('deliveryActions.resend'))
    expect(screen.getByText('actions.inDoubtBefore')).toBeInTheDocument()
    expect(boton('actions.discard')).toBeInTheDocument()
    await user.click(boton('actions.retry'))
    await waitFor(() => expect(svc.resendGiftCard).toHaveBeenCalledTimes(2))
    expect(cuerpo(1)).toEqual(cuerpo(0))
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'deliveryActions.resendDone' }))
  })
})

describe('GiftCardDelivery — «Cambiar destino»', () => {
  it('es un formulario (FullScreenModal) que avisa que repone, con sus `data-tour`', async () => {
    pintar(DETALLE)
    await user.click(boton('deliveryActions.changeDestination'))
    expect(screen.getByRole('dialog', { name: 'deliveryActions.changeDestination' })).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByText('deliveryActions.changeWarning')).toBeInTheDocument()
    expect(screen.getByLabelText('deliveryActions.changePhone')).toHaveAttribute('data-tour', 'gift-card-change-destination-input')
    expect(boton('deliveryActions.changeConfirm')).toHaveAttribute('data-tour', 'gift-card-change-destination-confirm')
    // Por omisión, el canal actual (WhatsApp).
    expect(screen.getByLabelText('delivery.WHATSAPP')).toBeChecked()
  })

  it('🔴 valida antes de mandar, avisa que repone y manda el destino limpio (WhatsApp)', async () => {
    svc.resendGiftCard.mockResolvedValue({ ...HECHO, repuesta: true, ultimos4: 'H4WD' })
    pintar(DETALLE)
    await cambiarA('WHATSAPP', '55 1234-567')
    expect(screen.getByText('deliveryActions.errors.phone')).toBeInTheDocument()
    expect(svc.resendGiftCard).not.toHaveBeenCalled()
    await cambiarA('WHATSAPP', '55 1234 5678')
    await waitFor(() =>
      expect(svc.resendGiftCard).toHaveBeenCalledWith('v1', 'g1', {
        operationKey: expect.any(String),
        deliveryChannel: 'WHATSAPP',
        recipientPhone: '5512345678',
      }),
    )
    expect(svc.resendGiftCard).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'deliveryActions.changeDone' }))
  })

  it('🔴 valida antes de mandar y manda el correo recortado (correo)', async () => {
    svc.resendGiftCard.mockResolvedValue({ ...HECHO, repuesta: true })
    pintar(DETALLE)
    await cambiarA('EMAIL', 'ana@')
    expect(screen.getByText('deliveryActions.errors.email')).toBeInTheDocument()
    expect(svc.resendGiftCard).not.toHaveBeenCalled()
    await cambiarA('EMAIL', ' ana@correo.com ')
    await waitFor(() =>
      expect(svc.resendGiftCard).toHaveBeenCalledWith('v1', 'g1', {
        operationKey: expect.any(String),
        deliveryChannel: 'EMAIL',
        recipientEmail: 'ana@correo.com',
      }),
    )
  })

  it('🔴 doble clic en «Reponer y enviar»: sale UN solo POST', async () => {
    let responder: (r: GiftCardResendResult) => void = () => {}
    svc.resendGiftCard.mockReturnValue(new Promise<GiftCardResendResult>(r => (responder = r)))
    pintar(DETALLE)
    await user.click(boton('deliveryActions.changeDestination'))
    await user.type(screen.getByLabelText('deliveryActions.changePhone'), '5512345678')
    await user.dblClick(boton('deliveryActions.changeConfirm'))
    expect(svc.resendGiftCard).toHaveBeenCalledTimes(1)
    responder({ ...HECHO, repuesta: true })
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'deliveryActions.changeDone' }))
    expect(svc.resendGiftCard).toHaveBeenCalledTimes(1)
  })

  it('🔴 en duda (sin respuesta): congela el destino; «Intentar otra vez» repite la MISMA llave y el MISMO teléfono', async () => {
    svc.resendGiftCard.mockRejectedValueOnce(sinRespuesta()).mockResolvedValueOnce({ ...HECHO, repuesta: true })
    pintar(DETALLE)
    await cambiarA('WHATSAPP', '55 1234 5678')
    await screen.findByText('actions.inDoubt')
    expect(screen.getByLabelText('deliveryActions.changePhone')).toBeDisabled()
    expect(screen.getByLabelText('delivery.EMAIL')).toBeDisabled()
    await user.click(boton('actions.retry'))
    await waitFor(() => expect(svc.resendGiftCard).toHaveBeenCalledTimes(2))
    expect(cuerpo(1)).toEqual(cuerpo(0))
    expect(cuerpo(1)).toMatchObject({ deliveryChannel: 'WHATSAPP', recipientPhone: '5512345678' })
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'deliveryActions.changeDone' }))
  })

  it('🔴 en duda → cerrar → reabrir ⇒ aviso, el teléfono prellenado y congelado, «Descartar», y la MISMA llave', async () => {
    svc.resendGiftCard.mockRejectedValueOnce(sinRespuesta()).mockResolvedValueOnce({ ...HECHO, repuesta: true })
    pintar(DETALLE)
    await cambiarA('WHATSAPP', '+52 55 1234 5678')
    await screen.findByText('actions.inDoubt')
    await cerrarModal()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await user.click(boton('deliveryActions.changeDestination'))
    expect(screen.getByText('actions.inDoubtBefore')).toBeInTheDocument()
    expect(screen.getByLabelText('deliveryActions.changePhone')).toHaveValue('5512345678')
    expect(screen.getByLabelText('deliveryActions.changePhone')).toBeDisabled()
    expect(boton('actions.discard')).toBeInTheDocument()
    await user.click(boton('actions.retry'))
    await waitFor(() => expect(svc.resendGiftCard).toHaveBeenCalledTimes(2))
    expect(cuerpo(1)).toEqual(cuerpo(0))
  })

  it('🔴 en duda → RECARGAR la página → reabrir ⇒ el mismo cuerpo y la MISMA llave (sessionStorage); el éxito lo borra', async () => {
    svc.resendGiftCard.mockRejectedValueOnce(sinRespuesta()).mockResolvedValueOnce({ ...HECHO, repuesta: true })
    const { unmount } = pintar(DETALLE)
    await cambiarA('EMAIL', 'ana@correo.com')
    await screen.findByText('actions.inDoubt')
    unmount()
    olvidarPendientes()
    olvidarIntentosEnDuda()
    pintar(DETALLE)
    await user.click(boton('deliveryActions.changeDestination'))
    expect(screen.getByText('actions.inDoubtBefore')).toBeInTheDocument()
    expect(screen.getByLabelText('delivery.EMAIL')).toBeChecked()
    expect(screen.getByLabelText('deliveryActions.changeEmail')).toHaveValue('ana@correo.com')
    await user.click(boton('actions.retry'))
    await waitFor(() => expect(svc.resendGiftCard).toHaveBeenCalledTimes(2))
    expect(cuerpo(1)).toEqual(cuerpo(0))
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'deliveryActions.changeDone' }))
    expect(sessionStorage.getItem('gc-en-duda:v1:u1:g1:resend-cambiar')).toBeNull()
  })

  it('«Descartar este intento» olvida la llave: lo que siga es una operación nueva (llave nueva)', async () => {
    svc.resendGiftCard.mockRejectedValueOnce(sinRespuesta()).mockResolvedValueOnce({ ...HECHO, repuesta: true })
    pintar(DETALLE)
    await cambiarA('WHATSAPP', '5512345678')
    await screen.findByText('actions.inDoubt')
    await cerrarModal()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await user.click(boton('deliveryActions.changeDestination'))
    await user.click(boton('actions.discard'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await cambiarA('WHATSAPP', '5512345678')
    await waitFor(() => expect(svc.resendGiftCard).toHaveBeenCalledTimes(2))
    expect(cuerpo(1).operationKey).not.toBe(cuerpo(0).operationKey)
  })

  it('🔴 «cambiar» que sale bien descarta un «mismo» que había quedado en duda', async () => {
    svc.resendGiftCard
      .mockRejectedValueOnce(sinRespuesta())
      .mockResolvedValueOnce({ ...HECHO, repuesta: true })
      .mockResolvedValueOnce(HECHO)
    pintar(DETALLE)
    // 1) «Reenviar» queda en duda.
    await user.click(boton('deliveryActions.resend'))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'deliveryActions.resend' }))
    await screen.findByText('actions.inDoubt')
    await user.click(boton('actions.cancel'))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    // 2) «Cambiar destino» sale bien.
    await cambiarA('WHATSAPP', '5587654321')
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'deliveryActions.changeDone' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // 3) «Reenviar» ya no ofrece el intento viejo: es una operación nueva, con llave nueva.
    await user.click(boton('deliveryActions.resend'))
    expect(screen.queryByText('actions.inDoubtBefore')).toBeNull()
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'deliveryActions.resend' }))
    await waitFor(() => expect(svc.resendGiftCard).toHaveBeenCalledTimes(3))
    expect(cuerpo(2)).toEqual({ operationKey: expect.any(String) })
    expect(cuerpo(2).operationKey).not.toBe(cuerpo(0).operationKey)
  })

  it('un canal actual de correo abre el formulario en «Correo»; impresa abre en WhatsApp', async () => {
    const { unmount } = pintar(
      detalle({ deliveryChannel: 'EMAIL' }, { channel: 'EMAIL', destino: 'an•••@correo.com', errorCode: 'EMAIL_SEND_FAILED' }),
    )
    await user.click(boton('deliveryActions.changeDestination'))
    expect(screen.getByLabelText('delivery.EMAIL')).toBeChecked()
    unmount()
    pintar(detalle({ deliveryChannel: 'PRINTED' }, { channel: 'PRINTED', status: 'PENDING', destino: null, error: null, errorCode: null }))
    await user.click(boton('deliveryActions.changeDestination'))
    expect(screen.getByLabelText('delivery.WHATSAPP')).toBeChecked()
  })
})
