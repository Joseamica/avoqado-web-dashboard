import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CustomerDisplayFicha } from '@/services/customerDisplay.service'
import { TabletPreview } from '../TabletPreview'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k),
    i18n: { language: 'es' },
  }),
}))

const base: CustomerDisplayFicha = {
  schemaVersion: 1,
  fingerprint: 'fp',
  theme: 'LIGHT',
  accent: { custom: false },
  logo: null,
  welcomeText: null,
  thanksText: null,
  slides: [],
  slideSeconds: 8,
  promotionCards: { enabled: false },
  poweredBy: true,
}
const pasos = { tipSuggestions: [10, 15, 20], showTipScreen: true, showReceiptScreen: true }
const pantalla = () => screen.getByTestId('tablet-preview-pantalla')

describe('TabletPreview', () => {
  it('en espera: sin texto propio usa el de siempre, con el nombre del negocio y «Powered by»', () => {
    render(<TabletPreview ficha={base} momento="espera" nombreDelNegocio="Testarudo" pasos={pasos} />)
    expect(screen.getByText('preview.defaultWelcome')).toBeInTheDocument()
    expect(screen.getByText('Testarudo')).toBeInTheDocument()
    expect(screen.getByText('preview.poweredBy')).toBeInTheDocument()
  })
  it('🔴 «Powered by» lleva el logo horizontal de Avoqado: letras negras en tema claro, blancas en oscuro', () => {
    const { rerender } = render(<TabletPreview ficha={base} momento="espera" nombreDelNegocio="X" pasos={pasos} />)
    expect(screen.getByTestId('tablet-preview-avoqado')).toHaveAttribute('src', expect.stringContaining('avoqado-logo-light'))
    rerender(<TabletPreview ficha={{ ...base, theme: 'DARK' }} momento="espera" nombreDelNegocio="X" pasos={pasos} />)
    expect(screen.getByTestId('tablet-preview-avoqado')).toHaveAttribute('src', expect.stringContaining('avoqado-logo-dark'))
    expect(screen.getByTestId('tablet-preview-avoqado')).toHaveAttribute('alt', 'Avoqado')
  })
  it('pinta el texto de la ficha del servidor, no otro', () => {
    render(<TabletPreview ficha={{ ...base, welcomeText: '¡Hola!' }} momento="espera" nombreDelNegocio="X" pasos={pasos} />)
    expect(screen.getByText('¡Hola!')).toBeInTheDocument()
    expect(screen.queryByText('preview.defaultWelcome')).not.toBeInTheDocument()
  })
  it('🔴 el tema es el de la tablet (fondos del contrato), no el del dashboard', () => {
    const { rerender } = render(<TabletPreview ficha={base} momento="espera" nombreDelNegocio="X" pasos={pasos} />)
    expect(pantalla()).toHaveStyle({ backgroundColor: '#FFFFFF' })
    rerender(<TabletPreview ficha={{ ...base, theme: 'DARK' }} momento="espera" nombreDelNegocio="X" pasos={pasos} />)
    expect(pantalla()).toHaveStyle({ backgroundColor: '#1C1C1E' })
    expect(screen.getByTestId('tablet-preview')).toHaveAttribute('data-tema', 'DARK')
  })
  it('el acento es el que mandó el servidor (ya empujado por contraste); no se recalcula', () => {
    render(
      <TabletPreview
        ficha={{ ...base, accent: { custom: true, color: '#0A5C4C', on: '#FFFFFF' } }}
        momento="carrito"
        nombreDelNegocio="X"
        pasos={pasos}
      />,
    )
    expect(screen.getByTestId('tablet-preview-total')).toHaveStyle({ color: '#0A5C4C' })
  })
  it('propina: los porcentajes de este dispositivo y «Sin propina»', () => {
    render(<TabletPreview ficha={base} momento="propina" nombreDelNegocio="X" pasos={{ ...pasos, tipSuggestions: [12, 18] }} />)
    expect(screen.getByText('12 %')).toBeInTheDocument()
    expect(screen.getByText('18 %')).toBeInTheDocument()
    expect(screen.getByText('preview.noTip')).toBeInTheDocument()
  })
  it('gracias: el QR sólo si «Ofrecer recibo» está prendido', () => {
    const { rerender } = render(<TabletPreview ficha={base} momento="gracias" nombreDelNegocio="X" pasos={pasos} />)
    expect(screen.getByTestId('tablet-preview-qr')).toBeInTheDocument()
    rerender(<TabletPreview ficha={base} momento="gracias" nombreDelNegocio="X" pasos={{ ...pasos, showReceiptScreen: false }} />)
    expect(screen.queryByTestId('tablet-preview-qr')).not.toBeInTheDocument()
    expect(screen.getByText('preview.defaultThanks')).toBeInTheDocument()
  })
  it('con logo, lo pinta desde la URL de la ficha', () => {
    render(
      <TabletPreview
        ficha={{ ...base, logo: { source: 'asset', url: 'https://storage.googleapis.com/b/logo.png', sha256: 'x' } }}
        momento="espera"
        nombreDelNegocio="X"
        pasos={pasos}
      />,
    )
    expect(screen.getByTestId('tablet-preview-logo')).toHaveAttribute('src', 'https://storage.googleapis.com/b/logo.png')
  })
})
