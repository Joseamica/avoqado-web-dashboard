import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { EffectiveDeviceCapabilities } from '@/services/tpv.service'
import { CustomerDisplaySection } from '../CustomerDisplaySection'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }))
vi.mock('../CustomerDisplayCard', () => ({
  CustomerDisplayCard: (p: { latidoVigente?: string | null }) => <div data-testid="tarjeta" data-latido={String(p.latidoVigente)} />,
}))
vi.mock('../CheckoutStepsSection', () => ({ CheckoutStepsSection: () => <div data-testid="pasos" /> }))
vi.mock('../../components/DisplayModeRequestControl', () => ({ DisplayModeRequestControl: () => <div data-testid="inversion" /> }))

const capacidades = (presence: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN', invertibility = presence): EffectiveDeviceCapabilities => ({
  requiresActivation: false, canManagePaymentConfiguration: false, canAcceptTerminalPaymentRequests: false,
  customerDisplay: { presence, invertibility, canRequestInversion: false, observedAt: null, stale: false }, supportedRemoteCommands: [],
})
const pintar = (deviceType: string, caps: EffectiveDeviceCapabilities, lastHeartbeat?: string | null) =>
  render(
    <CustomerDisplaySection venueId="v1" terminalId="t1" deviceType={deviceType} deviceName="X" venueName="Y" versionName={null}
      capabilities={caps} customerDisplayInverted={false} customerDisplayRequest={null} canUpdateDevice lastHeartbeat={lastHeartbeat} />,
  )

describe('CustomerDisplaySection (spec §6.1, según el aparato)', () => {
  it('POS_ANDROID: tarjeta, pasos del cobro e inversión (lo de hoy se queda)', () => {
    pintar('POS_ANDROID', capacidades('SUPPORTED'))
    expect(screen.getByTestId('tarjeta')).toBeInTheDocument()
    expect(screen.getByTestId('pasos')).toBeInTheDocument()
    expect(screen.getByTestId('inversion')).toBeInTheDocument()
  })
  it('🔴 le pasa a la tarjeta el latido de la página (el del encabezado), no la deja con su foto (Codex #3)', () => {
    pintar('POS_ANDROID', capacidades('SUPPORTED'), '2026-10-15T09:00:00.000Z')
    expect(screen.getByTestId('tarjeta')).toHaveAttribute('data-latido', '2026-10-15T09:00:00.000Z')
  })
  it('POS_ANDROID sin segunda pantalla: tarjeta y pasos, sin la inversión (igual que hoy)', () => {
    pintar('POS_ANDROID', capacidades('UNSUPPORTED'))
    expect(screen.getByTestId('tarjeta')).toBeInTheDocument()
    expect(screen.getByTestId('pasos')).toBeInTheDocument()
    expect(screen.queryByTestId('inversion')).not.toBeInTheDocument()
  })
  it('POS_IOS: sólo pasos del cobro y el aviso del iPad', () => {
    pintar('POS_IOS', capacidades('UNSUPPORTED'))
    expect(screen.getByText('card.ipadNoDisplay')).toBeInTheDocument()
    expect(screen.getByTestId('pasos')).toBeInTheDocument()
    expect(screen.queryByTestId('tarjeta')).not.toBeInTheDocument()
    expect(screen.queryByTestId('inversion')).not.toBeInTheDocument()
  })
  it('TPV_ANDROID: nada nuevo (sin pantalla del cliente, la sección no se pinta)', () => {
    const { container } = pintar('TPV_ANDROID', capacidades('UNSUPPORTED'))
    expect(container).toBeEmptyDOMElement()
  })
  it('TPV_ANDROID con pantalla invertible: sólo la inversión de hoy, sin tarjeta ni pasos', () => {
    pintar('TPV_ANDROID', capacidades('SUPPORTED'))
    expect(screen.getByTestId('inversion')).toBeInTheDocument()
    expect(screen.queryByTestId('tarjeta')).not.toBeInTheDocument()
    expect(screen.queryByTestId('pasos')).not.toBeInTheDocument()
    expect(screen.queryByText('card.new')).not.toBeInTheDocument()
  })
})
