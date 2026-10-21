import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_TPV_SETTINGS, tpvSettingsService } from '@/services/tpv-settings.service'
import { TpvSettingsForm } from '../TpvSettingsForm'

vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))
const toast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: unknown) => (o && typeof o === 'object' ? `${k} ${JSON.stringify(o)}` : k),
    i18n: { language: 'es' },
  }),
}))
vi.mock('@/services/tpv-settings.service', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/tpv-settings.service')>()
  return { ...real, tpvSettingsService: { getSettings: vi.fn(), updateSettings: vi.fn(), getTerminalMerchants: vi.fn() } }
})

const servicio = vi.mocked(tpvSettingsService)
const rechazoDelServidor = (status: number, data: unknown) => Object.assign(new Error('Request failed'), { response: { status, data } })

async function agregarPropinaYEsperarElRechazo(rechazo: unknown) {
  servicio.getSettings.mockResolvedValue({ ...DEFAULT_TPV_SETTINGS, tipSuggestions: [10, 15, 20] })
  servicio.getTerminalMerchants.mockResolvedValue([])
  servicio.updateSettings.mockRejectedValue(rechazo)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <TpvSettingsForm tpvId="t1" compact />
    </QueryClientProvider>,
  )
  const user = userEvent.setup()
  await user.type(await screen.findByPlaceholderText('tpvSettings.tipPlaceholder'), '25')
  await user.click(screen.getByRole('button', { name: /tpvSettings\.addTipOption/ }))
  await waitFor(() => expect(toast).toHaveBeenCalled())
}

describe('TpvSettingsForm · el rechazo del guardado', () => {
  beforeEach(() => toast.mockClear())

  it('🔴 un 400 del servidor muestra SU mensaje, no sólo el genérico', async () => {
    await agregarPropinaYEsperarElRechazo(rechazoDelServidor(400, { message: 'No puedes ofrecer más de 6 porcentajes de propina' }))
    expect(toast).toHaveBeenCalledWith({
      title: 'tpvSettings.updateError',
      description: 'No puedes ofrecer más de 6 porcentajes de propina',
      variant: 'destructive',
    })
  })

  it('un 500 no enseña el texto del servidor (puede ser jerga): queda el genérico', async () => {
    await agregarPropinaYEsperarElRechazo(rechazoDelServidor(500, { message: 'Internal Server Error' }))
    expect(toast).toHaveBeenCalledWith({ title: 'tpvSettings.updateError', description: undefined, variant: 'destructive' })
  })
})
