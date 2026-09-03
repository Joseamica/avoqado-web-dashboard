import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SendCampaignDialog } from '../SendCampaignDialog'

/**
 * Mandar una campaña es IRREVERSIBLE y le llega a los clientes del negocio. Estas pruebas
 * fijan las tres cosas que impiden que salga por accidente:
 *
 *  1. El conteo lo pone el SERVIDOR y se pide al abrir — nunca se reusa uno viejo.
 *  2. El botón dice el NÚMERO. «¿Seguro?» no le dice a nadie lo que va a pasar.
 *  3. Con cero destinatarios NO se puede mandar, y se explica por qué (nadie ha dado
 *     permiso todavía), en vez de dejar un botón que produce un error.
 */
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // eco de la clave + el conteo, para poder afirmar que el número llega al texto
    t: (key: string, opts?: any) => (opts && typeof opts.count === 'number' ? `${key}:${opts.count}` : key),
  }),
}))

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }))

const mockPreview = vi.fn()
const mockPublish = vi.fn()
vi.mock('@/services/marketing.service', () => ({
  default: {
    previewCampaign: (...a: unknown[]) => mockPreview(...a),
    publishCampaign: (...a: unknown[]) => mockPublish(...a),
  },
}))

function abrir(onSent = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <SendCampaignDialog venueId="v1" campaignId="c1" onClose={vi.fn()} onSent={onSent} />
    </QueryClientProvider>,
  )
}

describe('SendCampaignDialog', () => {
  beforeEach(() => vi.clearAllMocks())

  it('pide el conteo al SERVIDOR y lo enseña', async () => {
    mockPreview.mockResolvedValue({ totalDestinatarios: 3412, token: 'tk', expiraEn: '2026-09-03T12:00:00Z' })
    abrir()

    await waitFor(() => expect(screen.getByTestId('send-recipient-count')).toHaveTextContent('3,412'))
    expect(mockPreview).toHaveBeenCalledWith('v1', 'c1')
  })

  it('el botón de confirmar dice el NÚMERO, no un "¿estás seguro?"', async () => {
    mockPreview.mockResolvedValue({ totalDestinatarios: 3412, token: 'tk', expiraEn: 'x' })
    abrir()

    await waitFor(() => expect(screen.getByTestId('send-confirm')).toHaveTextContent('3412'))
  })

  it('manda con el token que firmó el servidor, no con uno inventado', async () => {
    mockPreview.mockResolvedValue({ totalDestinatarios: 5, token: 'token-firmado', expiraEn: 'x' })
    mockPublish.mockResolvedValue({})
    abrir()

    await waitFor(() => expect(screen.getByTestId('send-confirm')).toBeEnabled())
    await userEvent.click(screen.getByTestId('send-confirm'))

    await waitFor(() => expect(mockPublish).toHaveBeenCalledWith('v1', 'c1', 'token-firmado'))
  })

  it('con CERO destinatarios no se puede mandar, y se explica por qué', async () => {
    mockPreview.mockResolvedValue({ totalDestinatarios: 0, token: 'tk', expiraEn: 'x' })
    abrir()

    await waitFor(() => expect(screen.getByText('campaigns.sendDialog.noRecipients')).toBeInTheDocument())
    expect(screen.getByTestId('send-confirm')).toBeDisabled()
    expect(mockPublish).not.toHaveBeenCalled()
  })

  it('si el servidor rechaza el envío, muestra SU mensaje y pide un token nuevo', async () => {
    mockPreview.mockResolvedValue({ totalDestinatarios: 5, token: 'tk', expiraEn: 'x' })
    mockPublish.mockRejectedValue({ response: { data: { message: 'El contenido cambió desde la vista previa.' } } })
    abrir()

    await waitFor(() => expect(screen.getByTestId('send-confirm')).toBeEnabled())
    await userEvent.click(screen.getByTestId('send-confirm'))

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'El contenido cambió desde la vista previa.', variant: 'destructive' }),
      ),
    )
    // 🔴 El token viejo ya no sirve: se pide otro. Reusarlo sería justo lo que este
    // mecanismo existe para impedir.
    await waitFor(() => expect(mockPreview).toHaveBeenCalledTimes(2))
  })

  it('no manda mientras el conteo no haya llegado', async () => {
    mockPreview.mockReturnValue(new Promise(() => {})) // nunca resuelve
    abrir()

    expect(screen.getByTestId('send-confirm')).toBeDisabled()
    expect(mockPublish).not.toHaveBeenCalled()
  })
})
