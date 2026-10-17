import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GiftCardDetail, GiftCardReason } from '@/types/giftCard'

const svc = vi.hoisted(() => ({
  getGiftCardSettings: vi.fn(),
  updateGiftCardSettings: vi.fn(),
  listGiftCards: vi.fn(),
  getGiftCardDetail: vi.fn(),
  operateGiftCard: vi.fn(),
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
  }),
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/demo' }) }))
const toast = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

import { olvidarPendientes } from '@/pages/Commissions/envioUnico'
import en from '@/locales/en/giftCards.json'
import es from '@/locales/es/giftCards.json'
import { GiftCardManagerActions } from '../components/GiftCardManagerActions'

/** El detalle de C4 TAL CUAL (F3). Nota 13: `cancel` trae `message` (null salvo cuando el server explica por qué no). */
const DETALLE: GiftCardDetail = {
  id: 'g1', last4: '4821', status: 'ACTIVE', initialAmount: 1500, balance: 500, createdAt: '2026-10-14T16:00:00.000Z',
  activatedAt: '2026-10-14T16:01:00.000Z', expiresAt: null, deliveryChannel: 'PRINTED', deliveryStatus: 'SENT',
  recipientName: 'Ana López', purchaserName: null, source: 'POS', customer: null, order: { id: 'o1', orderNumber: 'A-1042' },
  validityMonths: null, termsVersion: '2026-10-14', message: null, recipientPhone: null, recipientEmail: null, purchaserContact: null,
  deliveredAt: null, deactivatedAt: null, hasRedeem: false, canReplaceCode: true,
  cancel: { allowed: true, reason: null, message: null },
  currentBlock: null,
  activities: { items: [], nextCursor: null, total: 0 },
}
const detalle = (over: Partial<GiftCardDetail> = {}): GiftCardDetail => ({ ...DETALLE, ...over })
const bloqueo = (reason: GiftCardReason) => ({ reason, note: null, at: '2026-09-01T10:00:00.000Z' })
/** Un ajuste cualquiera: la primera página de la libreta de una tarjeta con muchos movimientos ya no trae su BLOCK. */
const AJUSTE_VIEJO = {
  id: 'a40', type: 'ADJUST_INCREMENT' as const, amount: 10, balanceAfter: 500, reason: 'CASHIER_ERROR' as const, note: 'Faltaban $10',
  createdAt: '2026-10-13T10:00:00.000Z', staff: { id: 's1', name: 'Gerente' }, paymentId: null, refundPaymentId: null, orderId: null,
}

let client: QueryClient
const arbol = (d: GiftCardDetail) => (
  <MemoryRouter>
    <QueryClientProvider client={client}>
      <GiftCardManagerActions venueId="v1" detail={d} />
    </QueryClientProvider>
  </MemoryRouter>
)
const pintar = (d: GiftCardDetail = detalle()) => render(arbol(d))
const boton = (name: string) => screen.getByRole('button', { name })
const sinRespuesta = () => Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' })
const llave = (fn: ReturnType<typeof vi.fn>, i: number) => (fn.mock.calls[i][2] as { operationKey: string }).operationKey

/** Llena el formulario de ajuste (FullScreenModal) y lo manda. */
function ajustar(direccion: 'increment' | 'decrement', monto: string, nota: string) {
  fireEvent.click(boton('actions.adjust.button'))
  fireEvent.click(screen.getByLabelText(`actions.adjust.${direccion}`))
  fireEvent.change(screen.getByLabelText('actions.adjust.amount'), { target: { value: monto } })
  fireEvent.click(screen.getByLabelText('reason.CASHIER_ERROR'))
  fireEvent.change(screen.getByLabelText('actions.note'), { target: { value: nota } })
  fireEvent.click(boton('actions.adjust.confirm'))
}

beforeEach(() => {
  vi.clearAllMocks()
  olvidarPendientes()
  access.allowed = ['giftCards:read', 'giftCards:manage']
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
})

describe('GiftCardManagerActions', () => {
  it('sin giftCards:manage no hay ninguna acción', () => {
    access.allowed = ['giftCards:read']
    pintar()
    expect(screen.queryByText('actions.title')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'actions.adjust.button' })).not.toBeInTheDocument()
  })

  it('activa: ajustar, bloquear, reponer y cancelar la venta (no desbloquear)', () => {
    pintar()
    for (const b of ['actions.adjust.button', 'actions.block.button', 'actions.replace.button', 'actions.cancelSale.button']) expect(boton(b)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'actions.unblock.button' })).not.toBeInTheDocument()
  })

  it('🔴 en cancelación (lo dicen `cancel` y `currentBlock`, aunque el BLOCK no esté en la primera página): sólo «Ir a la venta» y «Ya no cancelar»', () => {
    pintar(
      detalle({
        status: 'BLOCKED',
        cancel: { allowed: false, reason: 'IN_PROGRESS', message: null },
        currentBlock: bloqueo('CANCEL_IN_PROGRESS'),
        activities: { items: [AJUSTE_VIEJO], nextCursor: 'c-2', total: 40 },
      }),
    )
    expect(boton('actions.cancelSale.goToSale')).toBeInTheDocument()
    expect(boton('actions.cancelSale.release')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'actions.adjust.button' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'actions.unblock.button' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'actions.cancelSale.button' })).not.toBeInTheDocument()
  })

  it('🔴 ajustar y reponer son formularios en FullScreenModal; bloquear es una confirmación breve (AlertDialog) (auditoría r1, D-3)', () => {
    pintar()
    fireEvent.click(boton('actions.adjust.button'))
    expect(screen.getByRole('dialog', { name: 'actions.adjust.title' })).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    fireEvent.click(boton('actions.replace.button'))
    expect(screen.getByRole('dialog', { name: 'actions.replace.title' })).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    fireEvent.click(boton('actions.block.button'))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  })

  it('quitar más del saldo no se manda y se explica', () => {
    pintar()
    ajustar('decrement', '600', 'Se cobró de más')
    expect(screen.getByRole('alert')).toHaveTextContent('actions.adjust.errors.moreThanBalance')
    expect(svc.operateGiftCard).not.toHaveBeenCalled()
  })

  it('🔴 ajustar: si quedó en duda, congela los campos y «Intentar otra vez» manda la MISMA llave', async () => {
    svc.operateGiftCard.mockRejectedValueOnce(sinRespuesta()).mockResolvedValueOnce({ activityIds: ['a1'] })
    pintar()
    ajustar('increment', '150', 'Se cobró de menos')
    await screen.findByText('actions.inDoubt')
    expect(screen.getByLabelText('actions.adjust.amount')).toBeDisabled()
    fireEvent.click(boton('actions.retry'))
    await waitFor(() => expect(svc.operateGiftCard).toHaveBeenCalledTimes(2))
    const [c1, c2] = svc.operateGiftCard.mock.calls
    expect(c1[2]).toEqual({ tipo: 'AJUSTE', direccion: 'INCREMENT', amount: 150, reason: 'CASHIER_ERROR', note: 'Se cobró de menos', operationKey: expect.any(String) })
    expect((c2[2] as { operationKey: string }).operationKey).toBe((c1[2] as { operationKey: string }).operationKey)
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'actions.adjust.done' }))
  })

  it('🔴 D-1 quitar $400 de $500: la respuesta se perdió y el saldo refrescado ya es $100; el reintento reenvía el MISMO cuerpo con la MISMA llave, sin revalidar', async () => {
    svc.operateGiftCard.mockRejectedValueOnce(sinRespuesta()).mockResolvedValueOnce({ activityIds: ['a1'] })
    const { rerender } = pintar(detalle({ balance: 500 }))
    ajustar('decrement', '400', 'Se cobró de más')
    await screen.findByText('actions.inDoubt')
    // El server SÍ lo aplicó: la invalidación trae el saldo nuevo. Validar $400 contra $100 bloquearía el reintento.
    rerender(arbol(detalle({ balance: 100 })))
    fireEvent.click(boton('actions.retry'))
    await waitFor(() => expect(svc.operateGiftCard).toHaveBeenCalledTimes(2))
    const [c1, c2] = svc.operateGiftCard.mock.calls
    expect(c1[2]).toMatchObject({ tipo: 'AJUSTE', direccion: 'DECREMENT', amount: 400 })
    expect(c2[2]).toEqual(c1[2])
    expect(screen.queryByText('actions.adjust.errors.moreThanBalance')).not.toBeInTheDocument()
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'actions.adjust.done' }))
  })

  it('🔴 D-1 sumar hasta el techo ($9,000 + $1,000): respuesta perdida, refresco en $10,000; el reintento se manda igual (sin «pasa del máximo»)', async () => {
    svc.operateGiftCard.mockRejectedValueOnce(sinRespuesta()).mockResolvedValueOnce({ activityIds: ['a1'] })
    const { rerender } = pintar(detalle({ balance: 9000 }))
    ajustar('increment', '1000', 'Faltó cargar saldo')
    await screen.findByText('actions.inDoubt')
    rerender(arbol(detalle({ balance: 10000 })))
    fireEvent.click(boton('actions.retry'))
    await waitFor(() => expect(svc.operateGiftCard).toHaveBeenCalledTimes(2))
    const [c1, c2] = svc.operateGiftCard.mock.calls
    expect(c1[2]).toMatchObject({ tipo: 'AJUSTE', direccion: 'INCREMENT', amount: 1000 })
    expect(c2[2]).toEqual(c1[2])
    expect(screen.queryByText('actions.adjust.errors.overCap')).not.toBeInTheDocument()
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'actions.adjust.done' }))
  })

  it('🔴 nota 7: tras un ajuste que salió bien, el SIGUIENTE ajuste (mismos datos) es otra operación con OTRA llave', async () => {
    svc.operateGiftCard.mockResolvedValue({ activityIds: ['a1'] })
    pintar()
    ajustar('increment', '150', 'Se cobró de menos')
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'actions.adjust.done' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    ajustar('increment', '150', 'Se cobró de menos')
    await waitFor(() => expect(svc.operateGiftCard).toHaveBeenCalledTimes(2))
    expect(llave(svc.operateGiftCard, 1)).not.toBe(llave(svc.operateGiftCard, 0))
  })

  it('🔴 nota 14: cerrar el ajuste en duda abandona el intento; reabrirlo con los MISMOS datos manda OTRA llave', async () => {
    svc.operateGiftCard.mockRejectedValueOnce(sinRespuesta()).mockResolvedValueOnce({ activityIds: ['a1'] })
    pintar()
    ajustar('increment', '150', 'Se cobró de menos')
    await screen.findByText('actions.inDoubt')
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    ajustar('increment', '150', 'Se cobró de menos')
    await waitFor(() => expect(svc.operateGiftCard).toHaveBeenCalledTimes(2))
    expect(svc.operateGiftCard.mock.calls[1][2]).toMatchObject({ amount: 150, note: 'Se cobró de menos' })
    expect(llave(svc.operateGiftCard, 1)).not.toBe(llave(svc.operateGiftCard, 0))
  })

  it('🔴 nota 15a: si el diálogo en duda se DESMONTA sin cerrarse (se cerró la hoja), la llave vieja no sobrevive', async () => {
    svc.operateGiftCard.mockRejectedValueOnce(sinRespuesta()).mockResolvedValueOnce({ activityIds: ['a1'] })
    const { unmount } = pintar()
    ajustar('increment', '150', 'Se cobró de menos')
    await screen.findByText('actions.inDoubt')
    unmount()
    pintar()
    ajustar('increment', '150', 'Se cobró de menos')
    await waitFor(() => expect(svc.operateGiftCard).toHaveBeenCalledTimes(2))
    expect(llave(svc.operateGiftCard, 1)).not.toBe(llave(svc.operateGiftCard, 0))
  })

  it('un 4xx se dice con el texto del server (trae `code`) y deja corregir', async () => {
    svc.operateGiftCard.mockRejectedValue({
      response: { status: 409, data: { code: 'GIFT_CARD_BLOCKED', message: 'La tarjeta cambió: vuelve a abrirla.' } },
    })
    pintar()
    fireEvent.click(boton('actions.block.button'))
    fireEvent.click(screen.getByLabelText('reason.SUSPICIOUS_ACTIVITY'))
    fireEvent.click(boton('actions.block.confirm'))
    expect(await screen.findByText('La tarjeta cambió: vuelve a abrirla.')).toBeInTheDocument()
    expect(svc.operateGiftCard.mock.calls[0][2]).toMatchObject({ tipo: 'BLOQUEAR', reason: 'SUSPICIOUS_ACTIVITY' })
    expect(boton('actions.block.confirm')).toBeEnabled()
  })

  it('notas 10 y 12: un error SIN `code` (un 403 en inglés) enseña el texto genérico, nunca el `message` crudo', async () => {
    svc.operateGiftCard.mockRejectedValue({ response: { status: 403, data: { message: 'Forbidden' } } })
    pintar()
    fireEvent.click(boton('actions.block.button'))
    fireEvent.click(screen.getByLabelText('reason.SUSPICIOUS_ACTIVITY'))
    fireEvent.click(boton('actions.block.confirm'))
    expect(await screen.findByText('errors.generic')).toBeInTheDocument()
    expect(screen.queryByText('Forbidden')).not.toBeInTheDocument()
  })

  it('reponer: pide el folio, enseña el código nuevo UNA vez y al terminar ya no está', async () => {
    svc.operateGiftCard.mockResolvedValue({ activityIds: ['a9'], nuevoCodigo: { display: 'K7QM-2XRA-9TBC-H4WD-6', last4: 'H4WD' } })
    pintar()
    fireEvent.click(boton('actions.replace.button'))
    fireEvent.click(boton('actions.replace.confirm'))
    expect(screen.getByRole('alert')).toHaveTextContent('actions.replace.errors.folio')
    // El campo es «Folio de la compra (número de cuenta)»: el `Order.orderNumber` del comprobante (decisión 4 del coordinador).
    expect(es.actions.replace.folio).toBe('Folio de la compra (número de cuenta)')
    expect(en.actions.replace.folio).toBe('Purchase folio (order number)')
    fireEvent.change(screen.getByLabelText('actions.replace.folio'), { target: { value: ' A-1042 ' } })
    fireEvent.click(boton('actions.replace.confirm'))
    expect(await screen.findByText('K7QM-2XRA-9TBC-H4WD-6')).toBeInTheDocument()
    expect(svc.operateGiftCard.mock.calls[0][2]).toMatchObject({ tipo: 'REEMPLAZAR_CODIGO', reason: 'LOST_CARD', folio: 'A-1042' })
    expect(toast).not.toHaveBeenCalled()
    fireEvent.click(boton('actions.replace.done'))
    await waitFor(() => expect(screen.queryByText('K7QM-2XRA-9TBC-H4WD-6')).not.toBeInTheDocument())
  })

  it('nota 15b: la nota de reponer de más de 500 caracteres no se manda y se explica', () => {
    pintar()
    fireEvent.click(boton('actions.replace.button'))
    fireEvent.change(screen.getByLabelText('actions.replace.folio'), { target: { value: 'A-1042' } })
    fireEvent.change(screen.getByLabelText('actions.noteOptional'), { target: { value: 'x'.repeat(501) } })
    fireEvent.click(boton('actions.replace.confirm'))
    expect(screen.getByRole('alert')).toHaveTextContent('actions.errors.noteTooLong')
    expect(svc.operateGiftCard).not.toHaveBeenCalled()
  })

  it('cancelar la venta: explica los pasos y manda su llave a ESA venta', async () => {
    svc.startGiftCardSaleCancel.mockResolvedValue({ giftCardIds: ['g1', 'g2'] })
    pintar()
    fireEvent.click(boton('actions.cancelSale.button'))
    expect(screen.getByText('actions.cancelSale.step2')).toBeInTheDocument()
    fireEvent.click(boton('actions.cancelSale.confirm'))
    await waitFor(() => expect(svc.startGiftCardSaleCancel).toHaveBeenCalledWith('v1', 'o1', expect.any(String)))
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'actions.cancelSale.started' }))
  })

  it('🔴 nota 14: cancelar la venta en duda y cerrar el aviso abandona el intento; volver a cancelar manda OTRA llave', async () => {
    svc.startGiftCardSaleCancel.mockRejectedValueOnce(sinRespuesta()).mockResolvedValueOnce({ giftCardIds: ['g1'] })
    pintar()
    fireEvent.click(boton('actions.cancelSale.button'))
    fireEvent.click(boton('actions.cancelSale.confirm'))
    await screen.findByText('actions.inDoubt')
    fireEvent.click(boton('actions.cancel'))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    fireEvent.click(boton('actions.cancelSale.button'))
    fireEvent.click(boton('actions.cancelSale.confirm'))
    await waitFor(() => expect(svc.startGiftCardSaleCancel).toHaveBeenCalledTimes(2))
    expect(svc.startGiftCardSaleCancel.mock.calls[1][2]).not.toBe(svc.startGiftCardSaleCancel.mock.calls[0][2])
  })

  it('🔴 liberar (F6): sin la casilla «Comprobé que la devolución NO se hizo» no se puede; con ella manda `confirmacionNoDevuelto: true`', async () => {
    svc.releaseGiftCardSaleCancel.mockResolvedValue({ released: true })
    pintar(detalle({ status: 'BLOCKED', cancel: { allowed: false, reason: 'IN_PROGRESS', message: null }, currentBlock: bloqueo('CANCEL_IN_PROGRESS') }))
    fireEvent.click(boton('actions.cancelSale.release'))
    expect(screen.getByText('actions.cancelSale.releaseDescription')).toBeInTheDocument()
    expect(boton('actions.cancelSale.releaseConfirm')).toBeDisabled()
    fireEvent.click(boton('actions.cancelSale.releaseConfirm'))
    expect(svc.releaseGiftCardSaleCancel).not.toHaveBeenCalled()
    fireEvent.click(screen.getByLabelText('actions.cancelSale.releaseCheck'))
    expect(boton('actions.cancelSale.releaseConfirm')).toBeEnabled()
    fireEvent.click(boton('actions.cancelSale.releaseConfirm'))
    await waitFor(() =>
      expect(svc.releaseGiftCardSaleCancel).toHaveBeenCalledWith('v1', 'o1', expect.any(String), { confirmacionNoDevuelto: true }),
    )
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'actions.cancelSale.released' }))
  })

  it.each(['NOT_PAID', 'NOT_SAME_DAY', 'ALREADY_USED', 'ALREADY_CANCELLED'] as const)(
    '🔴 cancelación imposible (%s, lo dice el server): el botón se ve apagado y dice por qué',
    reason => {
      pintar(detalle({ cancel: { allowed: false, reason, message: null } }))
      expect(screen.getByText(`actions.cancelSale.blocker.${reason}`)).toBeInTheDocument()
      expect(boton('actions.cancelSale.button')).toBeDisabled()
    },
  )

  it('🔴 nota 2: si el server explica por qué no se puede (`cancel.message`), se enseña SU texto en vez del genérico', () => {
    const texto = 'No se puede cancelar: el cobro ya se reembolsó. Habla a soporte.'
    pintar(detalle({ cancel: { allowed: false, reason: 'NOT_PAID', message: texto } }))
    expect(screen.getByText(texto)).toBeInTheDocument()
    expect(screen.queryByText('actions.cancelSale.blocker.NOT_PAID')).not.toBeInTheDocument()
    expect(boton('actions.cancelSale.button')).toBeDisabled()
  })

  it('bloqueada por otro motivo (`reason: null`, `currentBlock` del server): el botón apagado dice que primero se desbloquee', () => {
    pintar(detalle({ status: 'BLOCKED', cancel: { allowed: false, reason: null, message: null }, currentBlock: bloqueo('SUSPICIOUS_ACTIVITY') }))
    expect(screen.getByText('actions.cancelSale.blocker.BLOCKED_OTHER')).toBeInTheDocument()
    expect(boton('actions.cancelSale.button')).toBeDisabled()
    expect(boton('actions.unblock.button')).toBeInTheDocument()
  })
})
