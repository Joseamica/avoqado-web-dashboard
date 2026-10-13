/**
 * C3 (ola final, I-1) — el aviso de Facturación: ventas que se sacaron de la factura global y cuya factura del cliente no salió.
 * Ámbar (nunca rojo), sólo si hay alguna (`total > 0`), con el número; `enProceso` (aparte) sólo si hay.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import es from '@/locales/es/cfdi.json'
import en from '@/locales/en/cfdi.json'

// Como i18next: con `count` busca la forma `_one` (singular) y si no, la base.
const traductor = (json: unknown) => (key: string, opts?: Record<string, unknown>) => {
  const buscar = (k: string) => k.split('.').reduce<any>((o, p) => o?.[p], json as any)
  const raw = opts?.count === 1 && typeof buscar(`${key}_one`) === 'string' ? buscar(`${key}_one`) : buscar(key)
  if (typeof raw !== 'string') return key
  return raw.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => String(opts?.[k] ?? ''))
}
const idioma = vi.hoisted(() => ({ actual: 'es' }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: traductor(idioma.actual === 'es' ? es : en), i18n: { language: idioma.actual } }),
}))

import { ExtraccionesPendientesAviso } from '../ExtraccionesPendientesAviso'

const AVISO = 'aviso-extracciones-pendientes'

describe('ExtraccionesPendientesAviso', () => {
  it('🔴 sin ventas pendientes (total 0) no se ve nada, ni aunque haya alguna en proceso', () => {
    const { container, rerender } = render(<ExtraccionesPendientesAviso total={0} enProceso={0} />)
    expect(screen.queryByTestId(AVISO)).not.toBeInTheDocument()
    expect(container).toBeEmptyDOMElement()
    rerender(<ExtraccionesPendientesAviso total={0} enProceso={4} />)
    expect(screen.queryByTestId(AVISO)).not.toBeInTheDocument()
  })

  it('🔴 con N pendientes dice el número y qué hacer, en ámbar (no rojo)', () => {
    render(<ExtraccionesPendientesAviso total={3} enProceso={0} />)
    const aviso = screen.getByTestId(AVISO)
    expect(aviso).toHaveTextContent(
      '3 ventas se sacaron de tu factura global pero su factura del cliente no salió. Revísalas y vuelve a facturarlas.',
    )
    expect(aviso.className).toContain('amber')
    expect(aviso.className).not.toMatch(/destructive|red-/)
    expect(aviso).not.toHaveTextContent('procesando')
  })

  it('una sola venta va en singular', () => {
    render(<ExtraccionesPendientesAviso total={1} enProceso={0} />)
    expect(screen.getByTestId(AVISO)).toHaveTextContent(
      '1 venta se sacó de tu factura global pero su factura del cliente no salió. Revísala y vuelve a facturarla.',
    )
  })

  it('con ventas en proceso las menciona aparte (M se están procesando)', () => {
    const { rerender } = render(<ExtraccionesPendientesAviso total={2} enProceso={5} />)
    expect(screen.getByTestId(AVISO)).toHaveTextContent('Además, 5 se están procesando.')
    rerender(<ExtraccionesPendientesAviso total={2} enProceso={1} />)
    expect(screen.getByTestId(AVISO)).toHaveTextContent('Además, 1 se está procesando.')
  })

  it('también existe en inglés, con el número', () => {
    idioma.actual = 'en'
    render(<ExtraccionesPendientesAviso total={3} enProceso={2} />)
    expect(screen.getByTestId(AVISO)).toHaveTextContent(
      "3 sales were taken out of your global invoice but the customer's invoice didn't go through. Review them and invoice them again.",
    )
    expect(screen.getByTestId(AVISO)).toHaveTextContent('Also, 2 are being processed.')
    idioma.actual = 'es'
  })
})
