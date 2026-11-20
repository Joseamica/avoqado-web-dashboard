import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { vi, beforeAll, beforeEach, describe, it, expect } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { createInstance } from 'i18next'
import es from '@/locales/es/account.json'
import { SupportWhatsappCard } from '../SupportWhatsappCard'
import * as service from '@/services/supportWhatsapp.service'
vi.mock('@/services/supportWhatsapp.service')
const i18n = createInstance()
beforeAll(async () => {
  await i18n.init({ lng: 'es', resources: { es: { account: es } } })
})
beforeEach(() => {
  vi.mocked(service.getSupportStatus).mockResolvedValue({ enabled: true, linked: false, phone: null, expiresAt: null })
})
function show(staffId = 'staff-one') {
  // retryDelay 0: the data section's reads retry once, and the test does not wait the default second for it.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 }, mutations: { retry: false } } })
  const tree = (id: string) => (
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <SupportWhatsappCard key={id} staffId={id} />
      </I18nextProvider>
    </QueryClientProvider>
  )
  return { ...render(tree(staffId)), tree, client }
}
async function ask() {
  fireEvent.change(await screen.findByLabelText('Tu WhatsApp personal'), { target: { value: '+525511112222' } })
  fireEvent.click(screen.getByRole('checkbox', { name: /Confirmo que este WhatsApp es sólo mío/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Pedir código' }))
}
it('keeps the operation reference and form after a network failure, then updates link and unlink without reloading', async () => {
  vi.mocked(service.requestSupportCode)
    .mockRejectedValueOnce(new Error('Network Error'))
    .mockResolvedValue({ challengeId: 'challenge', expiresAt: new Date(Date.now() + 600000).toISOString() })
  vi.mocked(service.verifySupportCode).mockResolvedValue({ linked: true })
  vi.mocked(service.unlinkSupportPhone).mockResolvedValue({ linked: false })
  show()
  await ask()
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: 'Pedir código' }))
  await screen.findByLabelText('Código de seis dígitos')
  const calls = vi.mocked(service.requestSupportCode).mock.calls
  expect(calls[0][0]).toBe('staff-one')
  expect(calls[0][1]).toEqual(calls[1][1])
  vi.mocked(service.getSupportStatus).mockResolvedValue({ enabled: true, linked: true, phone: '••••2222', expiresAt: null })
  fireEvent.change(screen.getByLabelText('Código de seis dígitos'), { target: { value: '123456' } })
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar código' }))
  await screen.findByText('••••2222')
  fireEvent.click(screen.getByRole('button', { name: 'Desvincular WhatsApp' }))
  vi.mocked(service.getSupportStatus).mockResolvedValue({ enabled: true, linked: false, phone: null, expiresAt: null })
  fireEvent.click(screen.getByRole('button', { name: 'Sí, desvincular' }))
  await screen.findByRole('button', { name: 'Pedir código' })
  expect(screen.queryByText('••••2222')).not.toBeInTheDocument()
})
// Verify is no longer repeated by api.ts (a repeat could spend a second attempt), so this manual path is the only one left.
it('after a lost verify response it shows the error, keeps the typed code and lets the person retry by hand', async () => {
  vi.mocked(service.requestSupportCode).mockResolvedValue({
    challengeId: 'challenge',
    expiresAt: new Date(Date.now() + 600000).toISOString(),
  })
  vi.mocked(service.verifySupportCode).mockRejectedValueOnce(new Error('Network Error')).mockResolvedValue({ linked: true })
  show()
  await ask()
  fireEvent.change(await screen.findByLabelText('Código de seis dígitos'), { target: { value: '123456' } })
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar código' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(es.supportWhatsapp.requestError)
  expect(screen.getByLabelText('Código de seis dígitos')).toHaveValue('123456')
  expect(service.verifySupportCode).toHaveBeenCalledTimes(1)
  vi.mocked(service.getSupportStatus).mockResolvedValue({ enabled: true, linked: true, phone: '••••2222', expiresAt: null })
  const again = screen.getByRole('button', { name: 'Confirmar código' })
  await waitFor(() => expect(again).toBeEnabled())
  fireEvent.click(again)
  await screen.findByText('••••2222')
  const calls = vi.mocked(service.verifySupportCode).mock.calls
  expect(calls).toHaveLength(2)
  expect(calls[1]).toEqual(calls[0])
})
it('shows the disabled channel and its alternatives without hiding an existing unlink action', async () => {
  vi.mocked(service.getSupportStatus).mockResolvedValue({ enabled: false, linked: true, phone: '••••0001', expiresAt: null })
  show()
  await screen.findByText('El soporte por WhatsApp todavía no está activado.')
  expect(screen.getByRole('link', { name: 'Consultar guías' })).toHaveAttribute('href', 'https://avoqado.io/help')
  expect(screen.getByRole('button', { name: 'Desvincular WhatsApp' })).toBeEnabled()
})
it('erases the old form and ignores the previous person’s late response', async () => {
  let finish!: (value: { challengeId: string; expiresAt: string }) => void
  vi.mocked(service.requestSupportCode).mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve
      }),
  )
  const view = show()
  await ask()
  await waitFor(() => expect(service.requestSupportCode).toHaveBeenCalledTimes(1))
  view.rerender(view.tree('staff-two'))
  await act(async () => {
    finish({ challengeId: 'old-person', expiresAt: new Date().toISOString() })
  })
  expect(screen.queryByLabelText('Código de seis dígitos')).not.toBeInTheDocument()
  expect(await screen.findByLabelText('Tu WhatsApp personal')).toHaveValue('')
})
it.each(['request', 'verify', 'unlink'] as const)('blocks two immediate %s clicks before React renders the pending state', async action => {
  vi.mocked(service.requestSupportCode).mockResolvedValue({
    challengeId: 'challenge',
    expiresAt: new Date(Date.now() + 600000).toISOString(),
  })
  if (action === 'unlink')
    vi.mocked(service.getSupportStatus).mockResolvedValue({ enabled: true, linked: true, phone: '***2222', expiresAt: null })
  show()
  if (action === 'verify') {
    await ask()
    fireEvent.change(await screen.findByLabelText('Código de seis dígitos'), { target: { value: '12345' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar código' }))
    await screen.findByText('Escribe los seis dígitos del código.')
    fireEvent.change(screen.getByLabelText('Código de seis dígitos'), { target: { value: '123456' } })
  } else if (action === 'unlink') fireEvent.click(await screen.findByRole('button', { name: 'Desvincular WhatsApp' }))
  else {
    fireEvent.change(await screen.findByLabelText('Tu WhatsApp personal'), { target: { value: '+525511112222' } })
    fireEvent.click(screen.getByRole('checkbox'))
  }
  const target =
    action === 'request' ? service.requestSupportCode : action === 'verify' ? service.verifySupportCode : service.unlinkSupportPhone
  vi.mocked(target)
    .mockClear()
    .mockImplementation(() => new Promise<never>(() => {}))
  const button = screen.getByRole('button', {
    name: action === 'request' ? 'Pedir código' : action === 'verify' ? 'Confirmar código' : 'Sí, desvincular',
  })
  await act(async () => {
    fireEvent.click(button)
    fireEvent.click(button)
  })
  expect(target).toHaveBeenCalledTimes(1)
  await waitFor(() => expect(button).toBeDisabled())
})
it('the data section appears only when linked and dataEnabled', async () => {
  vi.mocked(service.listSupportVenues).mockResolvedValue({
    items: [{ id: 'v1', name: 'Norte', organizationId: 'o1' }],
    total: 1,
    nextCursor: null,
  })
  vi.mocked(service.getSupportDataAccess).mockResolvedValue({
    accepted: false,
    unlocked: false,
    venueName: 'Norte',
    notice: { text: 'AVISO DE LA B', hash: 'a'.repeat(64) },
  })
  const states = [
    { linked: false, phone: null, dataEnabled: true, shown: false },
    { linked: true, phone: '••••2222', dataEnabled: false, shown: false },
    { linked: true, phone: '••••2222', dataEnabled: true, shown: true },
  ]
  for (const { shown, ...state } of states) {
    vi.mocked(service.getSupportStatus).mockResolvedValue({ enabled: true, expiresAt: null, ...state })
    const view = show()
    if (state.linked) await screen.findByText('••••2222')
    else await screen.findByRole('button', { name: 'Pedir código' })
    if (shown) {
      expect(await screen.findByText('Datos por WhatsApp')).toBeInTheDocument()
      expect(await screen.findByText('Hoy todavía no.')).toBeInTheDocument()
    } else {
      expect(screen.queryByText('Datos por WhatsApp')).not.toBeInTheDocument()
      expect(service.listSupportVenues).not.toHaveBeenCalled()
    }
    view.unmount()
  }
})
it('a later data tap that works clears the red error of the one that failed', async () => {
  vi.mocked(service.getSupportStatus).mockResolvedValue({
    enabled: true,
    linked: true,
    phone: '••••2222',
    expiresAt: null,
    dataEnabled: true,
  })
  vi.mocked(service.listSupportVenues).mockResolvedValue({
    items: [{ id: 'v1', name: 'Norte', organizationId: 'o1' }],
    total: 1,
    nextCursor: null,
  })
  const notice = { text: 'AVISO DE LA B', hash: 'a'.repeat(64) }
  vi.mocked(service.getSupportDataAccess).mockResolvedValue({ accepted: true, unlocked: false, venueName: 'Norte', notice })
  vi.mocked(service.grantSupportDataAccess)
    .mockRejectedValueOnce(new Error('Network Error'))
    .mockResolvedValue({ accepted: true, unlocked: true, venueName: 'Norte', notice })
  show()
  fireEvent.click(await screen.findByRole('button', { name: 'Consultar datos por WhatsApp hoy' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(es.supportWhatsapp.requestError)
  const again = screen.getByRole('button', { name: 'Consultar datos por WhatsApp hoy' })
  await waitFor(() => expect(again).toBeEnabled())
  fireEvent.click(again)
  expect(await screen.findByText('Hoy el asistente puede darte datos de Norte hasta las 23:59.')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(service.grantSupportDataAccess).toHaveBeenCalledTimes(2)
})
const notice = { text: 'AVISO DE LA B', hash: 'a'.repeat(64) }
/** Linked, with data on WhatsApp switched on, one venue and the notice already accepted (one tap unlocks). */
function linkedWithData() {
  vi.mocked(service.getSupportStatus).mockResolvedValue({
    enabled: true,
    linked: true,
    phone: '••••2222',
    expiresAt: null,
    dataEnabled: true,
  })
  vi.mocked(service.listSupportVenues).mockResolvedValue({
    items: [{ id: 'v1', name: 'Norte', organizationId: 'o1' }],
    total: 1,
    nextCursor: null,
  })
}
it('the error of a failed unlink survives a permission tap that ends well', async () => {
  linkedWithData()
  vi.mocked(service.getSupportDataAccess).mockResolvedValue({ accepted: true, unlocked: false, venueName: 'Norte', notice })
  vi.mocked(service.grantSupportDataAccess).mockResolvedValue({ accepted: true, unlocked: true, venueName: 'Norte', notice })
  vi.mocked(service.unlinkSupportPhone).mockRejectedValue(new Error('Network Error'))
  show()
  fireEvent.click(await screen.findByRole('button', { name: 'Desvincular WhatsApp' }))
  fireEvent.click(screen.getByRole('button', { name: 'Sí, desvincular' }))
  await waitFor(() => expect(service.unlinkSupportPhone).toHaveBeenCalledTimes(1))
  fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(es.supportWhatsapp.requestError)
  fireEvent.click(await screen.findByRole('button', { name: 'Consultar datos por WhatsApp hoy' }))
  expect(await screen.findByText('Hoy el asistente puede darte datos de Norte hasta las 23:59.')).toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent(es.supportWhatsapp.requestError)
})
// T-F25 (W2): the dialog stays open on a failed unlink, so the reason shows inside it, not behind it.
it('a failed unlink says why inside the open dialog', async () => {
  linkedWithData()
  vi.mocked(service.getSupportDataAccess).mockResolvedValue({ accepted: true, unlocked: false, venueName: 'Norte', notice })
  vi.mocked(service.unlinkSupportPhone).mockRejectedValue(new Error('Network Error'))
  show()
  fireEvent.click(await screen.findByRole('button', { name: 'Desvincular WhatsApp' }))
  fireEvent.click(screen.getByRole('button', { name: 'Sí, desvincular' }))
  const dialog = screen.getByRole('alertdialog')
  expect(await within(dialog).findByRole('alert')).toHaveTextContent(es.supportWhatsapp.requestError)
})
// T-F25 (W4): after unlinking, the data section is on its way out: its reads are not asked again (the server would say 409).
it('after unlinking, the data section reads nothing more', async () => {
  linkedWithData()
  vi.mocked(service.getSupportDataAccess).mockResolvedValue({ accepted: true, unlocked: false, venueName: 'Norte', notice })
  vi.mocked(service.unlinkSupportPhone).mockResolvedValue({ linked: false })
  show()
  expect(await screen.findByText('Hoy todavía no.')).toBeInTheDocument()
  const venues = vi.mocked(service.listSupportVenues).mock.calls.length
  const access = vi.mocked(service.getSupportDataAccess).mock.calls.length
  vi.mocked(service.getSupportStatus).mockResolvedValue({ enabled: true, linked: false, phone: null, expiresAt: null, dataEnabled: true })
  fireEvent.click(screen.getByRole('button', { name: 'Desvincular WhatsApp' }))
  fireEvent.click(screen.getByRole('button', { name: 'Sí, desvincular' }))
  await screen.findByRole('button', { name: 'Pedir código' })
  expect(service.listSupportVenues).toHaveBeenCalledTimes(venues)
  expect(service.getSupportDataAccess).toHaveBeenCalledTimes(access)
})
it('a failed minute poll shows «Reintentar» and no red request text', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  try {
    linkedWithData()
    vi.mocked(service.getSupportDataAccess)
      .mockResolvedValueOnce({ accepted: true, unlocked: true, venueName: 'Norte', notice })
      .mockRejectedValue(new Error('Network Error'))
    show()
    expect(await screen.findByText('Hoy el asistente puede darte datos de Norte hasta las 23:59.')).toBeInTheDocument()
    await act(async () => {
      vi.advanceTimersByTime(60000)
    })
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText(es.supportWhatsapp.requestError)).not.toBeInTheDocument()
  } finally {
    vi.useRealTimers()
  }
})
it('after a failed permission tap, a «Reintentar» that works removes the red text', async () => {
  linkedWithData()
  let down = false // the network: the tap and the re-read after it fail; later it comes back
  vi.mocked(service.getSupportDataAccess).mockImplementation(async () => {
    if (down) throw new Error('Network Error')
    return { accepted: true, unlocked: false, venueName: 'Norte', notice }
  })
  vi.mocked(service.grantSupportDataAccess).mockImplementation(async () => {
    down = true
    throw new Error('Network Error')
  })
  show()
  fireEvent.click(await screen.findByRole('button', { name: 'Consultar datos por WhatsApp hoy' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(es.supportWhatsapp.requestError) // a failed tap still says so
  const retry = await screen.findByRole('button', { name: 'Reintentar' })
  down = false
  fireEvent.click(retry)
  expect(await screen.findByText('Hoy todavía no.')).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  expect(service.grantSupportDataAccess).toHaveBeenCalledTimes(1) // T-B29: nothing sent again on its own
})
it('the card no longer says «No mandes ventas»', async () => {
  show()
  await screen.findByRole('button', { name: 'Pedir código' })
  expect(screen.queryByText(/No mandes ventas/)).not.toBeInTheDocument()
  expect(screen.getByText(/No mandes contraseñas, PIN ni tarjetas\./)).toBeInTheDocument()
})

// T-F15: the card shows the support's own WhatsApp number (SUPPORT_WHATSAPP_DISPLAY_NUMBER on the server) with a button that
// opens it. Without it (an older server, or the variable unset) nothing new shows and the old bridge link stays.
describe('T-F15: the support number', () => {
  const supportNumber = { display: '+1 555 788 4728', waMe: 'https://wa.me/15557884728' }
  it.each([false, true])('shows the number and «Abrir WhatsApp» with its link (linked: %s)', async linked => {
    vi.mocked(service.getSupportStatus).mockResolvedValue({
      enabled: true,
      linked,
      phone: linked ? '••••2222' : null,
      expiresAt: null,
      supportNumber,
    })
    show()
    expect(await screen.findByText('+1 555 788 4728')).toBeInTheDocument()
    expect(screen.getByText(es.supportWhatsapp.number)).toBeInTheDocument()
    const open = screen.getByRole('link', { name: es.supportWhatsapp.openWhatsapp })
    // T-F25 (W5): it opens with AYUDA already typed, like the landing's /wa.
    expect(open).toHaveAttribute('href', 'https://wa.me/15557884728?text=AYUDA')
    expect(open).toHaveAttribute('target', '_blank')
    expect(open).toHaveAttribute('rel', 'noopener noreferrer')
    // One button to open the chat, never two.
    expect(screen.queryByRole('link', { name: es.supportWhatsapp.openChat })).not.toBeInTheDocument()
  })
  it.each([
    ['absent', {}],
    ['null', { supportNumber: null }],
  ])('without a number (%s) nothing new shows and the old link stays', async (_case, extra) => {
    vi.mocked(service.getSupportStatus).mockResolvedValue({ enabled: true, linked: false, phone: null, expiresAt: null, ...extra })
    show()
    await screen.findByRole('button', { name: 'Pedir código' })
    expect(screen.queryByText(es.supportWhatsapp.number)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: es.supportWhatsapp.openWhatsapp })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: es.supportWhatsapp.openChat })).toHaveAttribute('href', 'https://avoqado.io/wa?intent=soporte')
  })
  it('with the support off the number is not shown', async () => {
    vi.mocked(service.getSupportStatus).mockResolvedValue({ enabled: false, linked: false, phone: null, expiresAt: null, supportNumber })
    show()
    await screen.findByText(es.supportWhatsapp.off)
    expect(screen.queryByText('+1 555 788 4728')).not.toBeInTheDocument()
  })
})
