/**
 * 🔴 H24 (auditoría 2026-09-30): la pantalla de facturar prometía «Le enviaremos la factura a este correo» y nadie la enviaba.
 * Este diálogo reenvía una factura timbrada: sin correo nuevo va al que dio el cliente al facturar; con uno nuevo, a ése
 * (el cliente escribió mal el suyo).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import es from '@/locales/es/cfdi.json'
import type { Cfdi } from '@/services/cfdi.service'

const traducir = (key: string, opts?: Record<string, unknown>) => {
  const raw = key.split('.').reduce<any>((o, k) => o?.[k], es as any)
  if (typeof raw !== 'string') return key
  return raw.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => String(opts?.[k] ?? ''))
}
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: traducir, i18n: { language: 'es' } }) }))

const mutate = vi.fn()
vi.mock('@/hooks/use-cfdi', () => ({ useSendCfdiEmail: () => ({ mutate, isPending: false }) }))

import { SendCfdiEmailDialog } from '../SendCfdiEmailDialog'

const factura = { id: 'c1', serie: 'A', folio: '36', receptorNombre: 'MAVERICKS', status: 'STAMPED' } as unknown as Cfdi

describe('SendCfdiEmailDialog', () => {
  beforeEach(() => mutate.mockReset())

  it('dice qué factura se va a enviar', () => {
    render(<SendCfdiEmailDialog cfdi={factura} onOpenChange={() => {}} />)
    expect(screen.getByText('Enviar la factura A-36 por correo')).toBeInTheDocument()
  })

  it('sin correo nuevo, la manda al registrado en la factura', () => {
    render(<SendCfdiEmailDialog cfdi={factura} onOpenChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: es.sendEmailDialog.submit }))
    expect(mutate).toHaveBeenCalledWith({ cfdiId: 'c1', email: undefined }, expect.anything())
  })

  it('con un correo nuevo, la manda a ése (sin espacios de más)', () => {
    render(<SendCfdiEmailDialog cfdi={factura} onOpenChange={() => {}} />)
    fireEvent.change(screen.getByLabelText(es.sendEmailDialog.emailLabel), { target: { value: '  nuevo@correo.mx ' } })
    fireEvent.click(screen.getByRole('button', { name: es.sendEmailDialog.submit }))
    expect(mutate).toHaveBeenCalledWith({ cfdiId: 'c1', email: 'nuevo@correo.mx' }, expect.anything())
  })

  // Codex (ronda 2): es un formulario — Enter envía y el navegador valida el correo antes de llamar al servidor.
  it('Enter en el campo envía (es un formulario)', async () => {
    render(<SendCfdiEmailDialog cfdi={factura} onOpenChange={() => {}} />)
    await userEvent.type(screen.getByLabelText(es.sendEmailDialog.emailLabel), 'otro@correo.mx{Enter}')
    expect(mutate).toHaveBeenCalledWith({ cfdiId: 'c1', email: 'otro@correo.mx' }, expect.anything())
  })

  it('Cancelar no envía', () => {
    render(<SendCfdiEmailDialog cfdi={factura} onOpenChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: es.sendEmailDialog.cancel }))
    expect(mutate).not.toHaveBeenCalled()
  })

  it('cerrado (sin factura) no pinta nada', () => {
    const { container } = render(<SendCfdiEmailDialog cfdi={null} onOpenChange={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
})
