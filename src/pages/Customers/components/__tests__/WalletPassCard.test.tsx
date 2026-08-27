import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import WalletPassCard from '../WalletPassCard'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}(${Object.entries(opts).map(([k, v]) => `${k}=${v}`).join(',')})` : key,
    i18n: { language: 'es' },
  }),
}))

const toastMock = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastMock }) }))

vi.mock('@/hooks/use-access', () => ({
  useAccess: () => ({ can: () => true, canAny: () => true, canAll: () => true }),
}))

vi.mock('@/services/walletCard.service', () => ({
  buildWalletPassUrl: (slug: string, id: string) => `https://api.test/api/v1/public/venues/${slug}/wallet/apple/${id}`,
}))

const cliente = { id: 'cus_1', firstName: 'Ana', lastName: 'Pérez' }

function pintar(stampsEnabled: boolean | undefined) {
  return render(
    <MemoryRouter>
      <WalletPassCard
        customer={cliente}
        venueSlug="cafe-centro"
        venueName="Café Centro"
        fullBasePath="/venues/cafe-centro"
        stampsEnabled={stampsEnabled}
      />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  toastMock.mockClear()
})

describe('WalletPassCard', () => {
  it('no dibuja nada mientras la config viaja', () => {
    // Enseñar "apagado" y saltar a "prendido" 200 ms despues hace parpadear un
    // aviso que no era cierto.
    const { container } = pintar(undefined)
    expect(container).toBeEmptyDOMElement()
  })

  it('con los sellos apagados NO se esconde: explica y ofrece prenderlos', () => {
    // 🔴 La regla del workspace: lo apagado se VE y se EXPLICA. Si esta tarjeta
    // desapareciera, el negocio no se enteraria de que la funcion existe.
    pintar(false)
    expect(screen.getByTestId('wallet-pass-card')).toBeInTheDocument()
    expect(screen.getByText('walletPass.disabled')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /walletPass.turnOn/ })).toHaveAttribute(
      'href',
      '/venues/cafe-centro/loyalty/card',
    )
    expect(screen.queryByTestId('wallet-pass-qr')).not.toBeInTheDocument()
  })

  it('con los sellos prendidos muestra el QR y las dos formas de mandarla', () => {
    pintar(true)
    expect(screen.getByTestId('wallet-pass-qr')).toBeInTheDocument()
    expect(screen.getByTestId('wallet-pass-copy-btn')).toBeInTheDocument()
    expect(screen.getByTestId('wallet-pass-whatsapp-btn')).toBeInTheDocument()
  })

  it('el mensaje de WhatsApp lleva nombre, negocio y liga', () => {
    pintar(true)
    const href = decodeURIComponent(screen.getByTestId('wallet-pass-whatsapp-btn').getAttribute('href') || '')
    expect(href).toContain('name=Ana Pérez')
    expect(href).toContain('venue=Café Centro')
    expect(href).toContain('https://api.test/api/v1/public/venues/cafe-centro/wallet/apple/cus_1')
  })

  it('la liga NO se enseña mientras el copiado funcione', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
    pintar(true)
    fireEvent.click(screen.getByTestId('wallet-pass-copy-btn'))
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith({ title: 'walletPass.copied' }))
    expect(screen.queryByTestId('wallet-pass-url')).not.toBeInTheDocument()
  })

  it('si el portapapeles falla, REVELA la liga en vez de pedir lo imposible', async () => {
    // 🔴 Se descubrio tocando el boton, no en ninguna prueba: el aviso decia
    // "selecciona la liga a mano" y la liga no estaba en ningun lado de la
    // pantalla. Sin esto, un portapapeles bloqueado deja al negocio sin salida.
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('bloqueado')) } })
    pintar(true)
    fireEvent.click(screen.getByTestId('wallet-pass-copy-btn'))
    const campo = await screen.findByTestId('wallet-pass-url')
    expect(campo).toHaveValue('https://api.test/api/v1/public/venues/cafe-centro/wallet/apple/cus_1')
    expect(campo).toHaveAttribute('readonly')
  })

  it('advierte que por ahora solo es iPhone', () => {
    // Sin este aviso el negocio le manda la liga a alguien con Android, no le
    // abre nada, y el que queda mal es el negocio.
    pintar(true)
    expect(screen.getByText('walletPass.iphoneOnly')).toBeInTheDocument()
  })
})
