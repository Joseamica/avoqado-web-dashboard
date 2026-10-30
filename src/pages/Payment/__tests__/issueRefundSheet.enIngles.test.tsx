import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import paymentEn from '@/locales/en/payment.json'
import paymentEs from '@/locales/es/payment.json'
import giftCardsEn from '@/locales/en/giftCards.json'
import giftCardsEs from '@/locales/es/giftCards.json'
import commonEn from '@/locales/en/common.json'
import commonEs from '@/locales/es/common.json'

const post = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => vi.fn())
vi.mock('@/api', () => ({ default: { post } }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('@/components/ui/select', () => import('@/test/nativeSelectShim'))
vi.mock('react-i18next', async () => {
  const { default: i18n } = await import('i18next')
  return { useTranslation: (ns = 'common') => ({ t: i18n.getFixedT(null, ns) }) }
})

import { IssueRefundSheet } from '../IssueRefundSheet'

const abrir = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
    <IssueRefundSheet venueId="v1" paymentId="p1" maxRefundable={500} methodLabel="Cash" open onOpenChange={() => {}} onRefunded={() => {}} />
  </QueryClientProvider>,
)
const rechazo = (status: number, data: unknown) => Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, data } })

async function devolver(err: unknown) {
  post.mockRejectedValueOnce(err)
  abrir()
  const user = userEvent.setup()
  await user.type(screen.getByRole('textbox'), '500')
  await user.selectOptions(screen.getByRole('combobox'), 'OTHER')
  await user.click(screen.getByRole('button', { name: /^(Refund|Reembolsar)$/ }))
  await waitFor(() => expect(toast).toHaveBeenCalled())
  return toast.mock.calls[0][0]
}

describe('Pagos › Devolver: idioma, incertidumbre y accesibilidad', () => {
  beforeAll(async () => {
    await i18next.init({ lng: 'en', fallbackLng: 'en', resources: {
      en: { payment: paymentEn, giftCards: giftCardsEn, common: commonEn },
      es: { payment: paymentEs, giftCards: giftCardsEs, common: commonEs },
    }, interpolation: { escapeValue: false } })
  })
  afterAll(async () => { await i18next.changeLanguage('es') })
  let warn: ReturnType<typeof vi.spyOn>
  let error: ReturnType<typeof vi.spyOn>
  beforeEach(async () => {
    post.mockReset()
    toast.mockReset()
    await i18next.changeLanguage('en')
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    error = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('en inglés el diálogo lleva su título real, descripción y textos en inglés', () => {
    abrir()
    expect(screen.getByRole('dialog', { name: 'Issue refund' })).toHaveAccessibleDescription('Choose what to refund and why.')
    expect(screen.getByText('Refund by amount')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Refund' })).toBeInTheDocument()
  })

  it('no deja avisos Radix por título o descripción ausentes', () => {
    abrir()
    for (const spy of [warn, error]) expect(JSON.stringify(spy.mock.calls)).not.toMatch(/aria-describedby|Description|DialogTitle/)
  })

  it.each(['es', 'en'])('un 500 sin código en %s dice que el reembolso está sin confirmar', async lng => {
    await i18next.changeLanguage(lng)
    const aviso = await devolver(rechazo(500, { message: 'Se cayó la base' }))
    expect(aviso).toMatchObject({
      title: lng === 'es' ? 'Reembolso sin confirmar' : 'Refund not confirmed',
      description: lng === 'es'
        ? 'No supimos si se emitió el reembolso. Revisa los reembolsos de este pago antes de intentarlo otra vez.'
        : "We don't know if the refund went through. Check this payment's refunds before trying again.",
      variant: 'destructive',
    })
    expect(JSON.stringify(aviso)).not.toContain('Se cayó la base')
  })

  it('sin respuesta de red también dice sin confirmar, nunca Network Error', async () => {
    const aviso = await devolver(new Error('Network Error'))
    expect(aviso.title).toBe('Refund not confirmed')
    expect(aviso.description).toBe("We don't know if the refund went through. Check this payment's refunds before trying again.")
  })

  it.each(['es', 'en'])('un 403 sin código en %s dice que falta permiso', async lng => {
    await i18next.changeLanguage(lng)
    const aviso = await devolver(rechazo(403, { message: 'Insufficient permissions' }))
    expect(aviso).toMatchObject({
      title: lng === 'es' ? 'No se pudo emitir el reembolso' : "Couldn't issue the refund",
      description: lng === 'es'
        ? 'No tienes permiso para emitir reembolsos. Pídeselo a quien administra el negocio.'
        : "You don't have permission to issue refunds. Ask whoever manages the business.",
    })
  })

  it('un 409 de tarjetas conserva su traducción por código', async () => {
    const aviso = await devolver(rechazo(409, { code: 'GIFT_CARD_CANCEL_NOT_STARTED', message: 'Texto del servidor' }))
    expect(aviso.description).toBe(giftCardsEn.serverCodes.GIFT_CARD_CANCEL_NOT_STARTED)
    expect(aviso.title).toBe("Couldn't issue the refund")
  })

  it('otro 4xx sin código conserva su aviso actual', async () => {
    expect((await devolver(rechazo(422, { message: 'Refund exceeds the payment' }))).description).toBe('Refund exceeds the payment')
  })

  it('un rechazo conocido con código conserva su texto incluso si tiene estado 500', async () => {
    expect((await devolver(rechazo(500, { code: 'GIFT_CARD_CANCEL_NOT_STARTED', message: 'Texto del servidor' }))).description)
      .toBe(giftCardsEn.serverCodes.GIFT_CARD_CANCEL_NOT_STARTED)
  })
})
