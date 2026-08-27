import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import CounterPosterCard from '../CounterPosterCard'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}(${Object.entries(opts).map(([k, v]) => `${k}=${v}`).join(',')})` : key,
    i18n: { language: 'es' },
  }),
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/services/walletCard.service', () => ({
  buildPosterUrl: (slug: string) => `https://book.avoqado.io/${slug}#cuenta`,
}))

const irAlSwitch = vi.fn()
const pintar = (stampsEnabled: boolean) =>
  render(
    <CounterPosterCard
      venueSlug="cafe-centro"
      venueName="Café Centro"
      stampsEnabled={stampsEnabled}
      onGoToSwitch={irAlSwitch}
    />,
  )

describe('CounterPosterCard', () => {
  it('con los sellos apagados NO desaparece: explica que hay que prenderlos', () => {
    // 🔴 El defecto que reporto el founder: la seccion se esconderia entera y el
    // dueño se queda mirando la pantalla sin entender donde quedo el cartel. La
    // regla del workspace es que lo apagado se VE y se EXPLICA.
    pintar(false)
    expect(screen.getByTestId('counter-poster-card')).toBeInTheDocument()
    expect(screen.getByTestId('counter-poster-disabled')).toBeInTheDocument()
    expect(screen.queryByTestId('counter-poster-qr')).not.toBeInTheDocument()
  })

  it('con los sellos prendidos muestra el QR y el boton de imprimir', () => {
    pintar(true)
    expect(screen.getByTestId('counter-poster-qr')).toBeInTheDocument()
    expect(screen.getByTestId('counter-poster-print-btn')).toBeInTheDocument()
    expect(screen.queryByTestId('counter-poster-disabled')).not.toBeInTheDocument()
  })

  it('el aviso LLEVA al interruptor, no solo lo describe', () => {
    // 🔴 Salio de una prueba real: el aviso decia "prendelo aqui arriba" y el founder
    // no lo encontro — en una pantalla de seis secciones, "arriba" no es una direccion.
    irAlSwitch.mockClear()
    pintar(false)
    fireEvent.click(screen.getByTestId('counter-poster-goto-switch'))
    expect(irAlSwitch).toHaveBeenCalledTimes(1)
  })
})
