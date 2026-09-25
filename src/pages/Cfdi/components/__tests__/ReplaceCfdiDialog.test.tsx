/**
 * 🔴 Lo único que esta pantalla NO puede hacer es mentir sobre la factura vieja.
 *
 * El SAT puede dejar la cancelación en trámite (espera la aceptación del receptor) o rechazarla, y
 * en los DOS casos la factura anterior SIGUE VIGENTE. Un «listo, cancelada» ahí le haría creer al
 * negocio que tiene un solo comprobante cuando tiene dos. Estas pruebas fijan los tres desenlaces.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import es from '@/locales/es/cfdi.json'
import type { Cfdi, ReplaceCfdiResponse } from '@/services/cfdi.service'

const traducir = (key: string, opts?: Record<string, unknown>) => {
  const raw = key.split('.').reduce<any>((o, k) => o?.[k], es as any)
  if (typeof raw !== 'string') return key
  return raw.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => String(opts?.[k] ?? ''))
}
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: traducir, i18n: { language: 'es' } }),
}))

const mutate = vi.fn()
vi.mock('@/hooks/use-cfdi', () => ({
  useReplaceCfdi: () => ({ mutate, isPending: false }),
}))

import { ReplaceCfdiDialog } from '../ReplaceCfdiDialog'

const factura = {
  id: 'cfdi-orig',
  serie: 'A',
  folio: '14',
  uuid: 'UUID-ORIG',
  totalCents: 12500,
  receptorNombre: 'LAURA PÉREZ',
  status: 'STAMPED',
} as unknown as Cfdi

function responder(res: Partial<ReplaceCfdiResponse>) {
  mutate.mockImplementation((_vars: unknown, opts: any) =>
    opts.onSuccess({
      status: 'REPLACED',
      sustituta: { id: 's1', uuid: 'UUID-SUB', serie: 'A', folio: '16', totalCents: 13500, xmlUrl: null, pdfUrl: null },
      original: { id: 'cfdi-orig', uuid: 'UUID-ORIG' },
      cancelStatus: 'CANCELLED',
      cancelPendiente: false,
      ...res,
    }),
  )
}

const confirmar = () => fireEvent.click(screen.getByRole('button', { name: es.replaceDialog.confirm }))

describe('ReplaceCfdiDialog', () => {
  beforeEach(() => {
    mutate.mockReset()
  })

  it('antes de confirmar enseña la factura actual y qué va a pasar', () => {
    render(<ReplaceCfdiDialog cfdi={factura} onOpenChange={() => {}} />)
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveTextContent('A-14')
    expect(dialog).toHaveTextContent(es.replaceDialog.step1)
    expect(dialog).toHaveTextContent(es.replaceDialog.step2)
  })

  it('cancelación confirmada ⇒ dice que la anterior quedó cancelada', async () => {
    responder({ cancelStatus: 'CANCELLED', cancelPendiente: false })
    render(<ReplaceCfdiDialog cfdi={factura} onOpenChange={() => {}} />)
    confirmar()
    await waitFor(() => expect(screen.getByRole('alertdialog')).toHaveTextContent(es.replaceDialog.cancelledOk))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('A-16')
  })

  it('🔴 cancelación EN TRÁMITE ⇒ dice que la anterior sigue vigente, nunca «cancelada»', async () => {
    responder({ cancelStatus: 'REQUESTED', cancelPendiente: true })
    render(<ReplaceCfdiDialog cfdi={factura} onOpenChange={() => {}} />)
    confirmar()
    await waitFor(() => expect(screen.getByRole('alertdialog')).toHaveTextContent(es.replaceDialog.cancelPending))
    expect(screen.getByRole('alertdialog')).not.toHaveTextContent(es.replaceDialog.cancelledOk)
  })

  it('🔴 cancelación RECHAZADA ⇒ lo dice, y la sustituta sigue emitida', async () => {
    responder({ cancelStatus: 'REJECTED', cancelPendiente: true })
    render(<ReplaceCfdiDialog cfdi={factura} onOpenChange={() => {}} />)
    confirmar()
    await waitFor(() => expect(screen.getByRole('alertdialog')).toHaveTextContent(es.replaceDialog.cancelRejected))
    expect(screen.getByRole('alertdialog')).toHaveTextContent(es.replaceDialog.doneTitle)
    expect(screen.getByRole('alertdialog')).not.toHaveTextContent(es.replaceDialog.cancelledOk)
  })

  it('🔴 422 ⇒ enseña los motivos y NO afirma que se emitió nada', async () => {
    mutate.mockImplementation((_vars: unknown, opts: any) =>
      opts.onError({ response: { status: 422, data: { reasons: ['El total de la factura corregida no coincide con lo cobrado.'] } } }),
    )
    render(<ReplaceCfdiDialog cfdi={factura} onOpenChange={() => {}} />)
    confirmar()
    await waitFor(() => expect(screen.getByRole('alertdialog')).toHaveTextContent(es.replaceDialog.rejectedTitle))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('no coincide con lo cobrado')
    expect(screen.getByRole('alertdialog')).not.toHaveTextContent(es.replaceDialog.doneTitle)
  })
})
