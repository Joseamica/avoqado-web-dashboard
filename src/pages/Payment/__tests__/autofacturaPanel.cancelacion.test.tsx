/**
 * C2 · Tarea 10 — el recibo público dice cuando la factura del ticket tiene la cancelación en trámite (sólo lectura): mientras el SAT no la
 * resuelve, la factura SIGUE vigente y se puede descargar; el GET manda `cancelacionEnTramite: true` (nuevo y opcional).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import es from '@/locales/es/cfdi.json'

const get = vi.hoisted(() => vi.fn())
vi.mock('axios', () => ({ default: { get, post: vi.fn() } }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

import { AutofacturaPanel } from '../AutofacturaPanel'

const timbrada = { uuid: 'UUID-1', status: 'STAMPED', serie: 'F', folio: '1', pdfUrl: 'https://storage/cfdi/UUID-1.pdf' }
function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <AutofacturaPanel accessKey="key-abc" />
    </QueryClientProvider>,
  )
}

describe('AutofacturaPanel — C2 · T10 · cancelación en trámite', () => {
  beforeEach(() => {
    get.mockReset()
  })

  it('🔴 `cancelacionEnTramite: true` ⇒ dice que la cancelación está en trámite y que mientras tanto sigue vigente (y se puede descargar)', async () => {
    get.mockResolvedValue({ data: { cfdi: timbrada, autofacturaAvailable: true, cancelacionEnTramite: true } })
    mount()
    expect(await screen.findByText('autofactura.cancelPending')).toBeInTheDocument()
    expect(screen.getByText('autofactura.downloadZip')).toBeInTheDocument()
    expect(es.autofactura.cancelPending).toBe('La cancelación de esta factura está en trámite ante el SAT; mientras tanto sigue vigente.')
  })

  it('control — sin el campo (o falso): la tarjeta de «ya facturada» de siempre', async () => {
    get.mockResolvedValue({ data: { cfdi: timbrada, autofacturaAvailable: true } })
    mount()
    expect(await screen.findByText('autofactura.alreadyInvoiced')).toBeInTheDocument()
    expect(screen.queryByText('autofactura.cancelPending')).not.toBeInTheDocument()
  })
})
