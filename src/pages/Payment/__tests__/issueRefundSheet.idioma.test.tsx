/**
 * Pagos › Devolver con el panel en inglés (revisión final, D): el server escribe en español los avisos de tarjetas de regalo y manda
 * su `code`; la hoja enseña la traducción por `code` (`serverCodes` de `giftCards`). En español, igual que hoy: el texto del server.
 * i18next REAL con los recursos REALES de `giftCards` (los de `payment` no se cargan: salen con su `defaultValue`).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import en from '@/locales/en/giftCards.json'
import es from '@/locales/es/giftCards.json'

const post = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => vi.fn())
vi.mock('@/api', () => ({ default: { post } }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('@/components/ui/select', () => import('@/test/nativeSelectShim'))
vi.mock('react-i18next', async () => {
  const { default: i18n } = await import('i18next')
  return { useTranslation: (ns: string) => ({ t: i18n.getFixedT(null, ns) }) }
})

import { IssueRefundSheet } from '../IssueRefundSheet'

const SERVER = 'Texto en español del server.'
const rechazo = (data: unknown) => Object.assign(new Error('Request failed with status code 409'), { response: { status: 409, data } })

async function devolver(error: unknown) {
  post.mockRejectedValueOnce(error)
  const user = userEvent.setup()
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <IssueRefundSheet
        venueId="v1"
        paymentId="p1"
        maxRefundable={500}
        methodLabel="Efectivo"
        open
        onOpenChange={() => {}}
        onRefunded={() => {}}
      />
    </QueryClientProvider>,
  )
  await user.type(screen.getByRole('textbox'), '500')
  await user.selectOptions(screen.getByRole('combobox'), 'OTHER')
  await user.click(screen.getByRole('button', { name: 'Reembolsar' }))
  await waitFor(() => expect(toast).toHaveBeenCalled())
  return toast.mock.calls[0][0].description
}

describe('IssueRefundSheet: el aviso del server en el idioma del panel', () => {
  beforeAll(async () => {
    await i18next.init({
      lng: 'en',
      fallbackLng: 'en',
      resources: { en: { giftCards: en }, es: { giftCards: es } },
      interpolation: { escapeValue: false },
    })
  })
  afterAll(async () => {
    await i18next.changeLanguage('es')
  })
  beforeEach(() => {
    post.mockReset()
    toast.mockReset()
  })

  it.each(['GIFT_CARD_CANCEL_NOT_STARTED', 'GIFT_CARD_SALE_REFUND_MUST_BE_FULL'] as const)(
    'en inglés, %s sale con su texto en inglés (no el del server)',
    async code => {
      await i18next.changeLanguage('en')
      expect(await devolver(rechazo({ code, message: SERVER }))).toBe(en.serverCodes[code])
    },
  )

  it('en español, igual que hoy: el texto del server', async () => {
    await i18next.changeLanguage('es')
    expect(await devolver(rechazo({ code: 'GIFT_CARD_CANCEL_NOT_STARTED', message: SERVER }))).toBe(SERVER)
  })

  it('en inglés, un error sin code sale como hoy: el texto que trae', async () => {
    await i18next.changeLanguage('en')
    expect(await devolver(rechazo({ message: 'Refund exceeds the payment' }))).toBe('Refund exceeds the payment')
  })

  it('en inglés, un code sin traducción sale con el texto del server, nunca la llave', async () => {
    await i18next.changeLanguage('en')
    expect(await devolver(rechazo({ code: 'REFUND_CODIGO_NUEVO', message: SERVER }))).toBe(SERVER)
  })
})
