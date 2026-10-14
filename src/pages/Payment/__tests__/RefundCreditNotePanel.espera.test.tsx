/**
 * F6 · H3 — el panel COMPLETO (hook real, servicio de mentira, reloj simulado): una espera que se resuelve sola —una nota automática que el
 * job emitirá, o una nota enviada y en duda (`recoveryOnly`)— consulta sola con el tope de siempre; al agotarse, dice que la pantalla dejó de
 * consultar y ofrece «Volver a consultar» en la rama que toque; al volver a consultar, se ve la nota timbrada.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import es from '@/locales/es/cfdi.json'

const traducir = (key: string, opts?: Record<string, unknown>) => {
  const raw = key.split('.').reduce<any>((o, k) => o?.[k], es as any)
  if (typeof raw !== 'string') return (opts?.defaultValue as string) ?? key
  return raw.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => String(opts?.[k] ?? ''))
}
const m = vi.hoisted(() => ({ getRefundCreditNote: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: traducir, i18n: { language: 'es' } }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/api', () => ({ default: { post: vi.fn(), get: vi.fn() } }))
vi.mock('@/services/cfdi.service', async importOriginal => ({
  ...(await importOriginal<object>()),
  default: { getRefundCreditNote: m.getRefundCreditNote, emitRefundCreditNote: vi.fn() },
}))

import { MAX_CONSULTAS_EN_ESPERA } from '@/hooks/use-cfdi'
import { RefundCreditNotePanel } from '../RefundCreditNotePanel'

const timbrada = {
  creditNote: { id: 'n1', status: 'STAMPED', serie: 'NC', folio: '3', uuid: 'U-3', totalCents: 5000 },
  recoveryOnly: false,
  eligibility: { eligible: false, reason: null, message: 'Este reembolso ya tiene su nota de crédito timbrada.' },
  preview: null,
}
const esperas: Array<[string, unknown]> = [
  [
    'nota automática que el job emitirá (rama elegible)',
    {
      creditNote: null,
      recoveryOnly: false,
      eligibility: { eligible: true, reason: null, message: null },
      preview: null,
      automatica: { estado: 'RECUPERANDO' },
    },
  ],
  [
    'nota enviada y en duda (`recoveryOnly`, rama «no procede»)',
    {
      creditNote: { id: 'n1', status: 'STAMP_FAILED' },
      recoveryOnly: true,
      eligibility: { eligible: false, reason: null, message: 'x' },
      preview: null,
    },
  ],
]

const MOTIVO_ESPERA = 'Primero tiene que salir la nota de la devolución de artículos por $58.00. Revisa esa devolución.'
const conAlternativa = {
  creditNote: null,
  recoveryOnly: false,
  eligibility: { eligible: false, reason: 'ARTICULO_SIN_EVIDENCIA', message: 'Puedes acreditar lo devuelto por importe.' },
  preview: {
    facturaOriginal: { folio: 'F12', uuid: 'UUID-1', totalCents: 25800 },
    receptor: { rfc: 'EKU9003173C9', nombre: 'ESCUELA KEMPER' },
    amountToCreditCents: 3000,
    tipRefundCents: 0,
    alternativa: {
      modalidad: 'POR_IMPORTE',
      desglose: [{ tratamiento: 'IVA_16', cents: 3000, baseCents: 2586, ivaCents: 414 }],
      redondeo: [],
      huella: 'a'.repeat(64),
    },
  },
}
/** R4-1: estados que NO se resuelven solos (no consultan solos) y lo que el servidor responde después; el botón tiene que dejar avanzar. */
const bloqueadas: Array<[string, unknown, unknown, string]> = [
  [
    'espera a otra nota (REQUIERE_INTERVENCION)',
    {
      creditNote: null,
      recoveryOnly: false,
      eligibility: { eligible: false, reason: 'ESPERA_NOTA_DE_ARTICULOS', message: MOTIVO_ESPERA },
      preview: null,
      automatica: { estado: 'REQUIERE_INTERVENCION' },
    },
    timbrada,
    'U-3',
  ],
  [
    '«por importe» (P10) detenido mientras sale la de artículos',
    {
      creditNote: null,
      recoveryOnly: false,
      eligibility: {
        eligible: false,
        reason: 'ARTICULO_SIN_EVIDENCIA',
        message: `Tampoco se puede acreditar por importe: ${MOTIVO_ESPERA}`,
      },
      preview: null,
    },
    conAlternativa,
    traducir('creditNote.byAmount.button', { defaultValue: 'Acreditar por importe' }),
  ],
]

describe('F6 · H3 · el panel con su espera de verdad', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    m.getRefundCreditNote.mockReset()
  })
  afterEach(() => vi.useRealTimers())
  const avanzar = async (ms: number) => {
    for (let falta = ms; falta >= 0; falta -= 5_000)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(Math.min(5_000, falta))
      })
  }
  it.each(esperas)(
    '🔴 %s ⇒ consulta sola 1 + 8 veces, dice que dejó de consultar, y «Volver a consultar» trae la timbrada',
    async (_c, espera) => {
      m.getRefundCreditNote.mockResolvedValue(espera)
      render(
        <QueryClientProvider client={new QueryClient()}>
          <RefundCreditNotePanel refundId="r1" />
        </QueryClientProvider>,
      )
      await avanzar(10 * 60_000)
      expect(m.getRefundCreditNote).toHaveBeenCalledTimes(1 + MAX_CONSULTAS_EN_ESPERA)
      expect(screen.getByText(es.creditNote.esperaAgotada)).toBeInTheDocument()
      m.getRefundCreditNote.mockResolvedValue(timbrada)
      fireEvent.click(screen.getByRole('button', { name: es.creditNote.retryXml }))
      await avanzar(0)
      expect(screen.getByText('U-3')).toBeInTheDocument()
    },
  )
  it.each(bloqueadas)(
    '🔴 R4-1: %s ⇒ no consulta sola ni dice que dejó de hacerlo, pero «Volver a consultar» está y deja avanzar',
    async (_c, antes, despues, seVe) => {
      m.getRefundCreditNote.mockResolvedValue(antes)
      render(
        <QueryClientProvider client={new QueryClient()}>
          <RefundCreditNotePanel refundId="r1" />
        </QueryClientProvider>,
      )
      await avanzar(10 * 60_000)
      expect(m.getRefundCreditNote).toHaveBeenCalledTimes(1) // no es una espera que se resuelva sola: nada de consultas solas
      expect(screen.queryByText(es.creditNote.esperaAgotada)).not.toBeInTheDocument()
      m.getRefundCreditNote.mockResolvedValue(despues)
      fireEvent.click(screen.getByRole('button', { name: es.creditNote.retryXml }))
      await avanzar(0)
      expect(screen.getByText(seVe)).toBeInTheDocument()
    },
  )
})
