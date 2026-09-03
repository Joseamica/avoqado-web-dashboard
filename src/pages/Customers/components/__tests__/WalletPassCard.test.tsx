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

// 🔴 El mock interpola `platform` de verdad: si el componente algún día
// olvida pasarlo (o pasa siempre 'apple'), las dos ligas resultantes serían
// iguales y las pruebas de "no se cruzan las plataformas" de abajo lo cazan.
vi.mock('@/services/walletCard.service', () => ({
  buildWalletPassUrl: (slug: string, id: string, platform: string) =>
    `https://api.test/api/v1/public/venues/${slug}/wallet/${platform}/${id}`,
}))

const cliente = { id: 'cus_1', firstName: 'Ana', lastName: 'Pérez' }
const APPLE_URL = 'https://api.test/api/v1/public/venues/cafe-centro/wallet/apple/cus_1'
const GOOGLE_URL = 'https://api.test/api/v1/public/venues/cafe-centro/wallet/google/cus_1'

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
    expect(screen.queryByTestId('wallet-pass-qr-apple')).not.toBeInTheDocument()
    expect(screen.queryByTestId('wallet-pass-qr-google')).not.toBeInTheDocument()
  })

  it('con los sellos prendidos muestra LAS DOS tarjetas, cada una con su QR', () => {
    // 🔴 Aqui no se adivina el telefono: quien mira la pantalla es el barista, y
    // el telefono es el del cliente que tiene enfrente. Las dos van SIEMPRE, sin
    // seleccionar ninguna por default.
    pintar(true)
    expect(screen.getByTestId('wallet-pass-qr-apple')).toBeInTheDocument()
    expect(screen.getByTestId('wallet-pass-qr-google')).toBeInTheDocument()
    expect(screen.getByTestId('wallet-pass-copy-btn-apple')).toBeInTheDocument()
    expect(screen.getByTestId('wallet-pass-copy-btn-google')).toBeInTheDocument()
    expect(screen.getByTestId('wallet-pass-whatsapp-btn-apple')).toBeInTheDocument()
    expect(screen.getByTestId('wallet-pass-whatsapp-btn-google')).toBeInTheDocument()
  })

  it('las etiquetas iPhone y Android estan visibles, y ya NO hay disculpa de "solo iPhone"', () => {
    pintar(true)
    expect(screen.getByText('walletPass.appleLabel')).toBeInTheDocument()
    expect(screen.getByText('walletPass.googleLabel')).toBeInTheDocument()
    expect(screen.queryByText('walletPass.iphoneOnly')).not.toBeInTheDocument()
  })

  it('el mensaje de WhatsApp de iPhone lleva la liga de Apple, no la de Android', () => {
    pintar(true)
    const href = decodeURIComponent(screen.getByTestId('wallet-pass-whatsapp-btn-apple').getAttribute('href') || '')
    expect(href).toContain('walletPass.whatsappMessageApple')
    expect(href).toContain(`name=Ana Pérez`)
    expect(href).toContain(`venue=Café Centro`)
    expect(href).toContain(`url=${APPLE_URL}`)
    expect(href).not.toContain(GOOGLE_URL)
  })

  it('el mensaje de WhatsApp de Android lleva la liga de Google, no la de Apple', () => {
    pintar(true)
    const href = decodeURIComponent(screen.getByTestId('wallet-pass-whatsapp-btn-google').getAttribute('href') || '')
    expect(href).toContain('walletPass.whatsappMessageGoogle')
    expect(href).toContain(`url=${GOOGLE_URL}`)
    expect(href).not.toContain(APPLE_URL)
  })

  it('copiar en la tarjeta de iPhone copia la liga de Apple, nunca la de Android', async () => {
    // 🔴 Si el boton de Apple llamara al handler con el id de plataforma
    // equivocado, esta prueba fallaria: aqui SI importa cual liga viaja al
    // portapapeles, porque son dos telefonos distintos delante del barista.
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    pintar(true)
    fireEvent.click(screen.getByTestId('wallet-pass-copy-btn-apple'))
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith({ title: 'walletPass.copied' }))
    expect(writeText).toHaveBeenCalledWith(APPLE_URL)
    expect(writeText).not.toHaveBeenCalledWith(GOOGLE_URL)
  })

  it('copiar en la tarjeta de Android copia la liga de Google, nunca la de Apple', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    pintar(true)
    fireEvent.click(screen.getByTestId('wallet-pass-copy-btn-google'))
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith({ title: 'walletPass.copied' }))
    expect(writeText).toHaveBeenCalledWith(GOOGLE_URL)
    expect(writeText).not.toHaveBeenCalledWith(APPLE_URL)
  })

  it('la liga NO se enseña mientras el copiado funcione, en ninguna de las dos tarjetas', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
    pintar(true)
    fireEvent.click(screen.getByTestId('wallet-pass-copy-btn-apple'))
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith({ title: 'walletPass.copied' }))
    expect(screen.queryByTestId('wallet-pass-url-apple')).not.toBeInTheDocument()
    expect(screen.queryByTestId('wallet-pass-url-google')).not.toBeInTheDocument()
  })

  it('si el portapapeles falla al copiar Android, revela SOLO la liga de Android', async () => {
    // 🔴 Se descubrio tocando el boton, no en ninguna prueba (en la version de
    // iPhone): el aviso decia "selecciona la liga a mano" y la liga no estaba
    // en ningun lado. Ahora hay dos tarjetas — la que falla es la que se revela,
    // la otra se queda como estaba.
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('bloqueado')) } })
    pintar(true)
    fireEvent.click(screen.getByTestId('wallet-pass-copy-btn-google'))
    const campo = await screen.findByTestId('wallet-pass-url-google')
    expect(campo).toHaveValue(GOOGLE_URL)
    expect(campo).toHaveAttribute('readonly')
    expect(screen.queryByTestId('wallet-pass-url-apple')).not.toBeInTheDocument()
  })
})
