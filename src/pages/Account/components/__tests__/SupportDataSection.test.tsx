import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi, beforeAll, beforeEach, it, expect } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { createInstance } from 'i18next'
import es from '@/locales/es/account.json'
import en from '@/locales/en/account.json'
import { SupportDataSection } from '../SupportDataSection'
import * as service from '@/services/supportWhatsapp.service'
import type { SupportDataAccess } from '@/services/supportWhatsapp.service'
vi.mock('@/services/supportWhatsapp.service')
const i18n = createInstance()
const i18nEn = createInstance()
beforeAll(async () => {
  await i18n.init({ lng: 'es', resources: { es: { account: es } } })
  // `en-US`, as the browser reports it: the section must read it as English.
  await i18nEn.init({ lng: 'en-US', resources: { en: { account: en } } })
})
const onError = vi.fn()
const onOk = vi.fn()
/** Como el `show` de SupportWhatsappCard.test.tsx, pero pinta `<SupportDataSection staffId={staffId} onError={onError} onOk={onOk} />`. */
function show(staffId = 'staff-one', language = i18n) {
  // retryDelay 0: the section's reads retry once, and the test does not wait the default second for it.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 }, mutations: { retry: false } } })
  const tree = () => (
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={language}>
        <SupportDataSection staffId={staffId} onError={onError} onOk={onOk} />
      </I18nextProvider>
    </QueryClientProvider>
  )
  return { ...render(tree()), tree, client }
}
const access = (over: Partial<SupportDataAccess> = {}): SupportDataAccess => ({
  accepted: false,
  unlocked: false,
  venueName: 'Norte',
  notice: { text: 'AVISO DE LA B', hash: 'a'.repeat(64) },
  ...over,
})
const unlockButton = () => screen.getByRole('button', { name: 'Consultar datos por WhatsApp hoy' })
beforeEach(() => {
  onError.mockClear()
  onOk.mockClear()
  vi.mocked(service.listSupportVenues).mockResolvedValue({
    items: [
      { id: 'v1', name: 'Norte', organizationId: 'o1' },
      { id: 'v2', name: 'Sur', organizationId: 'o1' },
    ],
    total: 2,
    nextCursor: null,
  })
  vi.mocked(service.getSupportDataAccess).mockResolvedValue(access())
  vi.mocked(service.grantSupportDataAccess).mockResolvedValue(access({ accepted: true, unlocked: true }))
})
it('the first tap shows the server notice and writes only after accepting', async () => {
  show()
  expect(await screen.findByText('Hoy todavía no.')).toBeInTheDocument()
  fireEvent.click(unlockButton())
  expect(await screen.findByText('AVISO DE LA B')).toBeInTheDocument()
  expect(screen.getByText('Sucursal: Norte')).toBeInTheDocument() // the dialog names the venue it authorises
  // …and announces it: the venue line is part of the description Radix wires to aria-describedby, with the notice.
  expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription(/Sucursal: Norte/)
  expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription(/AVISO DE LA B/)
  expect(service.grantSupportDataAccess).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Aceptar y consultar hoy' }))
  expect(await screen.findByText('Hoy el asistente puede darte datos de Norte hasta las 23:59.')).toBeInTheDocument()
  expect(service.grantSupportDataAccess).toHaveBeenCalledWith('staff-one', {
    venueId: 'v1',
    noticeHash: 'a'.repeat(64),
    language: 'es',
    acceptNotice: true,
  })
})
it('a failed tap never claims «autorizado»: it reports the error, sends nothing again, re-reads the state and shows what the server says (T-B29)', async () => {
  vi.mocked(service.getSupportDataAccess).mockResolvedValue(access({ accepted: true })) // aviso ya aceptado; hoy, sin desbloqueo
  vi.mocked(service.grantSupportDataAccess).mockRejectedValue(new Error('Network Error')) // el POST no llegó
  show()
  expect(await screen.findByText('Hoy todavía no.')).toBeInTheDocument()
  fireEvent.click(unlockButton())
  await waitFor(() => expect(onError).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(service.getSupportDataAccess).toHaveBeenCalledTimes(2)) // lo volvió a leer
  expect(screen.getByText('Hoy todavía no.')).toBeInTheDocument()
  expect(screen.queryByText(/Hoy el asistente puede darte datos/)).not.toBeInTheDocument()
  expect(service.grantSupportDataAccess).toHaveBeenCalledTimes(1) // la sección tampoco lo repite sola
  expect(unlockButton()).toBeEnabled() // la persona puede volver a tocar
})
it('if the lost POST did land, the re-read says so and «autorizado» is shown, because it is true (T-B29)', async () => {
  vi.mocked(service.getSupportDataAccess)
    .mockResolvedValueOnce(access({ accepted: true }))
    .mockResolvedValue(access({ accepted: true, unlocked: true }))
  // el servidor sí lo guardó; se perdió la respuesta
  vi.mocked(service.grantSupportDataAccess).mockRejectedValue(new Error('Network Error'))
  show()
  fireEvent.click(await screen.findByRole('button', { name: 'Consultar datos por WhatsApp hoy' }))
  expect(await screen.findByText('Hoy el asistente puede darte datos de Norte hasta las 23:59.')).toBeInTheDocument()
  expect(onError).toHaveBeenCalledTimes(1)
  expect(service.grantSupportDataAccess).toHaveBeenCalledTimes(1)
})
it('«Cancelar» sends nothing', async () => {
  show()
  fireEvent.click(await screen.findByRole('button', { name: 'Consultar datos por WhatsApp hoy' }))
  expect(await screen.findByText('AVISO DE LA B')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  await waitFor(() => expect(screen.queryByText('AVISO DE LA B')).not.toBeInTheDocument())
  expect(service.grantSupportDataAccess).not.toHaveBeenCalled()
  expect(screen.getByText('Hoy todavía no.')).toBeInTheDocument()
})
it('with the notice already accepted, one tap unlocks without a dialog', async () => {
  vi.mocked(service.getSupportDataAccess).mockResolvedValue(access({ accepted: true }))
  show()
  fireEvent.click(await screen.findByRole('button', { name: 'Consultar datos por WhatsApp hoy' }))
  expect(await screen.findByText('Hoy el asistente puede darte datos de Norte hasta las 23:59.')).toBeInTheDocument()
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(service.grantSupportDataAccess).toHaveBeenCalledWith('staff-one', {
    venueId: 'v1',
    noticeHash: 'a'.repeat(64),
    language: 'es',
    acceptNotice: false,
  })
})
it('a double click sends one request', async () => {
  vi.mocked(service.getSupportDataAccess).mockResolvedValue(access({ accepted: true }))
  vi.mocked(service.grantSupportDataAccess).mockImplementation(() => new Promise<never>(() => {}))
  show()
  const button = await screen.findByRole('button', { name: 'Consultar datos por WhatsApp hoy' })
  await act(async () => {
    fireEvent.click(button)
    fireEvent.click(button)
  })
  expect(service.grantSupportDataAccess).toHaveBeenCalledTimes(1)
  await waitFor(() => expect(button).toBeDisabled())
})
it('a notice that changed between reading and tapping reopens the dialog with the new text', async () => {
  vi.mocked(service.grantSupportDataAccess)
    .mockResolvedValueOnce(access({ notice: { text: 'AVISO NUEVO', hash: 'b'.repeat(64) } }))
    .mockResolvedValue(access({ accepted: true, unlocked: true, notice: { text: 'AVISO NUEVO', hash: 'b'.repeat(64) } }))
  show()
  fireEvent.click(await screen.findByRole('button', { name: 'Consultar datos por WhatsApp hoy' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Aceptar y consultar hoy' }))
  expect(await screen.findByText('AVISO NUEVO')).toBeInTheDocument()
  expect(screen.getByText('Hoy todavía no.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Aceptar y consultar hoy' }))
  expect(await screen.findByText('Hoy el asistente puede darte datos de Norte hasta las 23:59.')).toBeInTheDocument()
  expect(vi.mocked(service.grantSupportDataAccess).mock.calls.map(call => call[1].noticeHash)).toEqual(['a'.repeat(64), 'b'.repeat(64)])
})
it('changing the venue reads that venue and shows its own state', async () => {
  vi.mocked(service.getSupportDataAccess).mockImplementation(async (_staff, venueId) =>
    venueId === 'v2' ? access({ accepted: true, unlocked: true, venueName: 'Sur' }) : access(),
  )
  show()
  expect(await screen.findByText('Hoy todavía no.')).toBeInTheDocument()
  expect(screen.queryByLabelText('Buscar sucursal')).not.toBeInTheDocument() // todas caben en la primera página
  fireEvent.change(screen.getByLabelText('Sucursal'), { target: { value: 'v2' } })
  expect(await screen.findByText('Hoy el asistente puede darte datos de Sur hasta las 23:59.')).toBeInTheDocument()
  expect(service.getSupportDataAccess).toHaveBeenLastCalledWith('staff-one', 'v2', 'es', expect.anything())
  expect(screen.queryByText('Hoy todavía no.')).not.toBeInTheDocument()
})
it('51 venues with the same name: «Ver más sucursales» reaches the last one (Codex plan r1 #5)', async () => {
  const page = (first: number, n: number, nextCursor: string | null) => ({
    items: Array.from({ length: n }, (_, i) => ({ id: `v${first + i}`, name: 'Sucursal', organizationId: 'o1' })),
    total: 51,
    nextCursor,
  })
  vi.mocked(service.listSupportVenues).mockImplementation(async (_staff, params) =>
    params.cursor ? page(51, 1, null) : page(1, 50, 'v50'),
  )
  show()
  expect(await screen.findByText('Mostrando 50 de 51 sucursales.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Ver más sucursales' }))
  await waitFor(() => expect(screen.getByLabelText('Sucursal').querySelectorAll('option')).toHaveLength(51))
  expect(service.listSupportVenues).toHaveBeenLastCalledWith(
    'staff-one',
    expect.objectContaining({ cursor: 'v50', limit: 50 }),
    expect.anything(),
  )
  fireEvent.change(screen.getByLabelText('Sucursal'), { target: { value: 'v51' } })
  await waitFor(() => expect(service.getSupportDataAccess).toHaveBeenLastCalledWith('staff-one', 'v51', 'es', expect.anything()))
  expect(screen.queryByRole('button', { name: 'Ver más sucursales' })).not.toBeInTheDocument()
})
it('the search box appears when the first load has more pages, searches in the server, and stays while there is text even if it finds few', async () => {
  const first = {
    items: Array.from({ length: 50 }, (_, i) => ({ id: `v${i + 1}`, name: `Sucursal ${i + 1}`, organizationId: 'o1' })),
    total: 60,
    nextCursor: 'v50',
  }
  vi.mocked(service.listSupportVenues).mockImplementation(async (_staff, params) =>
    params.search ? { items: [{ id: 'v2', name: 'Sur', organizationId: 'o1' }], total: 1, nextCursor: null } : first,
  )
  show()
  fireEvent.change(await screen.findByLabelText('Buscar sucursal'), { target: { value: 'sur' } })
  await waitFor(() => expect(vi.mocked(service.listSupportVenues).mock.lastCall?.[1]).toEqual({ search: 'sur', limit: 50 })) // sin cursor
  await waitFor(() => expect(screen.getByLabelText('Sucursal').querySelectorAll('option')).toHaveLength(1))
  expect(screen.queryByText(/^Mostrando/)).not.toBeInTheDocument()
  expect(screen.getByLabelText('Buscar sucursal')).toHaveValue('sur') // sigue ahí aunque encontró pocas
  await waitFor(() => expect(service.getSupportDataAccess).toHaveBeenLastCalledWith('staff-one', 'v2', 'es', expect.anything()))
})
it('an unlock without a valid notice is not announced (Codex plan r1 #6)', async () => {
  // el aviso cambió y el desbloqueo de hoy sigue ahí
  vi.mocked(service.getSupportDataAccess).mockResolvedValue(access({ accepted: false, unlocked: true }))
  show()
  expect(await screen.findByText('Hoy todavía no.')).toBeInTheDocument()
  expect(screen.queryByText(/Hoy el asistente puede darte datos/)).not.toBeInTheDocument()
  fireEvent.click(unlockButton())
  expect(await screen.findByText('AVISO DE LA B')).toBeInTheDocument()
  expect(service.grantSupportDataAccess).not.toHaveBeenCalled()
})
const norte = { id: 'v1', name: 'Norte', organizationId: 'o1' }
const sur = { id: 'v2', name: 'Sur', organizationId: 'o1' }
const fiftyOfSixty = {
  items: Array.from({ length: 50 }, (_, i) => ({ id: `v${i + 1}`, name: `Sucursal ${i + 1}`, organizationId: 'o1' })),
  total: 60,
  nextCursor: 'v50',
}
const reorderedLater = () =>
  vi
    .mocked(service.listSupportVenues)
    .mockResolvedValueOnce({ items: [norte, sur], total: 2, nextCursor: null })
    .mockResolvedValue({ items: [sur, norte], total: 2, nextCursor: null })
const refetchVenues = (client: QueryClient) =>
  act(async () => {
    await client.refetchQueries({ queryKey: ['support-whatsapp', 'staff-one', 'data', 'venues'] })
  })
const optionValues = () => [...screen.getByLabelText('Sucursal').querySelectorAll('option')].map(option => option.getAttribute('value'))
it('the list reorders with the dialog open: the select stays on the venue being authorised, «Aceptar» sends it with the notice that was on screen, and the section then shows ITS status', async () => {
  vi.mocked(service.listSupportVenues)
    .mockResolvedValueOnce({ items: [norte, sur], total: 2, nextCursor: null })
    .mockResolvedValue({ items: [sur, { ...norte, name: 'Norte renombrada' }], total: 2, nextCursor: null })
  const { client } = show()
  fireEvent.click(await screen.findByRole('button', { name: 'Consultar datos por WhatsApp hoy' }))
  expect(await screen.findByText('AVISO DE LA B')).toBeInTheDocument()
  await refetchVenues(client)
  // The refetch landed (Sur is first now); the select behind the dialog still shows Norte, and the dialog what was read.
  await waitFor(() => expect(optionValues()).toEqual(['v2', 'v1']))
  expect(screen.getByLabelText('Sucursal')).toHaveValue('v1')
  expect(screen.getByText('AVISO DE LA B')).toBeInTheDocument()
  // The name too is the one of the row on screen when the dialog opened: a later read of the list does not change it.
  expect(screen.getByText('Sucursal: Norte')).toBeInTheDocument()
  expect(screen.queryByText('Sucursal: Norte renombrada')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Aceptar y consultar hoy' }))
  expect(await screen.findByText('Hoy el asistente puede darte datos de Norte hasta las 23:59.')).toBeInTheDocument()
  expect(service.grantSupportDataAccess).toHaveBeenCalledTimes(1)
  expect(service.grantSupportDataAccess).toHaveBeenCalledWith('staff-one', {
    venueId: 'v1',
    noticeHash: 'a'.repeat(64),
    language: 'es',
    acceptNotice: true,
  })
  expect(service.getSupportDataAccess).not.toHaveBeenCalledWith('staff-one', 'v2', 'es', expect.anything())
})
it('the open dialog keeps the notice it showed: a re-read that brings a new notice changes neither its text nor what «Aceptar» sends', async () => {
  const fresh = { text: 'AVISO NUEVO', hash: 'b'.repeat(64) }
  // The re-read also brings another name for the venue: the dialog's «Sucursal:» line must not follow it either.
  vi.mocked(service.getSupportDataAccess)
    .mockResolvedValueOnce(access())
    .mockResolvedValue(access({ notice: fresh, venueName: 'Norte según la relectura' }))
  vi.mocked(service.grantSupportDataAccess).mockResolvedValue(access({ notice: fresh })) // accepted: false, with the new text
  const { client } = show()
  fireEvent.click(await screen.findByRole('button', { name: 'Consultar datos por WhatsApp hoy' }))
  expect(await screen.findByText('AVISO DE LA B')).toBeInTheDocument()
  await act(async () => {
    await client.refetchQueries({ queryKey: ['support-whatsapp', 'staff-one', 'data', 'access'] })
    // TanStack hands the new result to React in a setTimeout(0): let it render before looking at the dialog.
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  expect(service.getSupportDataAccess).toHaveBeenCalledTimes(2)
  expect(screen.getByText('AVISO DE LA B')).toBeInTheDocument()
  expect(screen.queryByText('AVISO NUEVO')).not.toBeInTheDocument()
  expect(screen.getByText('Sucursal: Norte')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Aceptar y consultar hoy' }))
  expect(await screen.findByText('AVISO NUEVO')).toBeInTheDocument() // the server's answer is what opens it with the new text
  expect(service.grantSupportDataAccess).toHaveBeenCalledTimes(1)
  expect(service.grantSupportDataAccess).toHaveBeenCalledWith('staff-one', {
    venueId: 'v1',
    noticeHash: 'a'.repeat(64),
    language: 'es',
    acceptNotice: true,
  })
})
it('the list reorders while a one-tap unlock is pending: the section then shows the status of the venue it unlocked', async () => {
  reorderedLater()
  vi.mocked(service.getSupportDataAccess).mockImplementation(async (_staff, venueId) =>
    access({ accepted: true, venueName: venueId === 'v2' ? 'Sur' : 'Norte' }),
  )
  let finish!: (value: SupportDataAccess) => void
  vi.mocked(service.grantSupportDataAccess).mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve
      }),
  )
  const { client } = show()
  fireEvent.click(await screen.findByRole('button', { name: 'Consultar datos por WhatsApp hoy' }))
  await refetchVenues(client)
  await waitFor(() => expect(optionValues()).toEqual(['v2', 'v1']))
  expect(screen.getByLabelText('Sucursal')).toHaveValue('v1')
  await act(async () => {
    finish(access({ accepted: true, unlocked: true }))
  })
  expect(await screen.findByText('Hoy el asistente puede darte datos de Norte hasta las 23:59.')).toBeInTheDocument()
  expect(service.grantSupportDataAccess).toHaveBeenCalledWith('staff-one', {
    venueId: 'v1',
    noticeHash: 'a'.repeat(64),
    language: 'es',
    acceptNotice: false,
  })
})
it('a positive state is read again every minute: a tab left open past midnight stops saying «sí», and then stops reading', async () => {
  // Only the intervals are fake: the reads, the retries and waitFor keep their real timeouts.
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  try {
    vi.mocked(service.getSupportDataAccess)
      .mockResolvedValueOnce(access({ accepted: true, unlocked: true }))
      .mockResolvedValue(access({ accepted: true })) // pasó la medianoche: el desbloqueo de ayer ya no cuenta
    show()
    expect(await screen.findByText('Hoy el asistente puede darte datos de Norte hasta las 23:59.')).toBeInTheDocument()
    await act(async () => {
      vi.advanceTimersByTime(59000)
    })
    expect(service.getSupportDataAccess).toHaveBeenCalledTimes(1)
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(await screen.findByText('Hoy todavía no.')).toBeInTheDocument()
    expect(service.getSupportDataAccess).toHaveBeenCalledTimes(2)
    await act(async () => {
      vi.advanceTimersByTime(180000)
    })
    expect(service.getSupportDataAccess).toHaveBeenCalledTimes(2)
  } finally {
    vi.useRealTimers()
  }
})
it.each([
  ['not accepted, not unlocked', access()],
  ['accepted, not unlocked', access({ accepted: true })],
  ['unlocked under a notice that changed', access({ unlocked: true })],
])('no polling while the state is not positive: %s', async (_name, state) => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  try {
    vi.mocked(service.getSupportDataAccess).mockResolvedValue(state)
    show()
    expect(await screen.findByText('Hoy todavía no.')).toBeInTheDocument()
    await act(async () => {
      vi.advanceTimersByTime(180000)
    })
    expect(service.getSupportDataAccess).toHaveBeenCalledTimes(1)
  } finally {
    vi.useRealTimers()
  }
})
it('a minute read that fails shows «Reintentar» and stops polling', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  try {
    vi.mocked(service.getSupportDataAccess)
      .mockResolvedValueOnce(access({ accepted: true, unlocked: true }))
      .mockRejectedValue(new Error('Network Error'))
    show()
    expect(await screen.findByText('Hoy el asistente puede darte datos de Norte hasta las 23:59.')).toBeInTheDocument()
    await act(async () => {
      vi.advanceTimersByTime(60000)
    })
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByText(/Hoy el asistente puede darte datos/)).not.toBeInTheDocument()
    expect(onError).not.toHaveBeenCalled() // nobody asked for that read: no red text in the card
    const reads = vi.mocked(service.getSupportDataAccess).mock.calls.length
    await act(async () => {
      vi.advanceTimersByTime(180000)
    })
    expect(service.getSupportDataAccess).toHaveBeenCalledTimes(reads)
  } finally {
    vi.useRealTimers()
  }
})
it.each(['venues', 'access'] as const)(
  'the %s read that fails reports the error, says nothing about the state and offers «Reintentar»',
  async read => {
    const failure = new Error('Network Error')
    const target = read === 'venues' ? service.listSupportVenues : service.getSupportDataAccess
    vi.mocked(target).mockRejectedValue(failure)
    show()
    const retry = await screen.findByRole('button', { name: 'Reintentar' })
    expect(onError).toHaveBeenCalledWith(failure)
    expect(screen.queryByText('Hoy todavía no.')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Consultar datos por WhatsApp hoy' })).not.toBeInTheDocument()
    if (read === 'venues') vi.mocked(service.listSupportVenues).mockResolvedValue({ items: [norte], total: 1, nextCursor: null })
    else vi.mocked(service.getSupportDataAccess).mockResolvedValue(access())
    fireEvent.click(retry)
    expect(await screen.findByText('Hoy todavía no.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
  },
)
it('a search that finds nothing says so and offers nothing to unlock', async () => {
  vi.mocked(service.listSupportVenues).mockImplementation(async (_staff, params) =>
    params.search ? { items: [], total: 0, nextCursor: null } : fiftyOfSixty,
  )
  show()
  fireEvent.change(await screen.findByLabelText('Buscar sucursal'), { target: { value: 'zzz' } })
  expect(await screen.findByText('Ninguna sucursal coincide con tu búsqueda.')).toBeInTheDocument()
  expect(screen.getByText('Datos por WhatsApp')).toBeInTheDocument() // the section and its search box stay
  expect(screen.getByLabelText('Buscar sucursal')).toHaveValue('zzz')
  expect(screen.getByLabelText('Sucursal').querySelectorAll('option')).toHaveLength(0)
  expect(screen.queryByRole('button', { name: 'Consultar datos por WhatsApp hoy' })).not.toBeInTheDocument()
})
it('without any venue the section shows nothing and reads no state', async () => {
  vi.mocked(service.listSupportVenues).mockResolvedValue({ items: [], total: 0, nextCursor: null })
  const { container } = show()
  await waitFor(() => expect(container).toBeEmptyDOMElement())
  expect(service.listSupportVenues).toHaveBeenCalledTimes(1)
  expect(service.getSupportDataAccess).not.toHaveBeenCalled()
})
it('unmounting erases its reads: mounted again (a later link), it never shows the old unlock from the cache', async () => {
  vi.mocked(service.getSupportDataAccess).mockResolvedValue(access({ accepted: true, unlocked: true }))
  const view = show()
  expect(await screen.findByText('Hoy el asistente puede darte datos de Norte hasta las 23:59.')).toBeInTheDocument()
  view.unmount()
  expect(view.client.getQueryCache().findAll({ queryKey: ['support-whatsapp', 'staff-one', 'data'] })).toEqual([])
  vi.mocked(service.getSupportDataAccess).mockResolvedValue(access())
  render(view.tree())
  expect(screen.queryByText(/Hoy el asistente puede darte datos/)).not.toBeInTheDocument()
  expect(await screen.findByText('Hoy todavía no.')).toBeInTheDocument()
  expect(screen.queryByText(/Hoy el asistente puede darte datos/)).not.toBeInTheDocument()
})
it('in English it reads and accepts the English notice', async () => {
  const notice = { text: 'NOTICE OF B', hash: 'e'.repeat(64) }
  vi.mocked(service.getSupportDataAccess).mockResolvedValue(access({ notice }))
  vi.mocked(service.grantSupportDataAccess).mockResolvedValue(access({ accepted: true, unlocked: true, notice }))
  show('staff-one', i18nEn)
  expect(await screen.findByText('Not yet today.')).toBeInTheDocument()
  expect(service.getSupportDataAccess).toHaveBeenCalledWith('staff-one', 'v1', 'en', expect.anything())
  fireEvent.click(screen.getByRole('button', { name: 'Check data on WhatsApp today' }))
  expect(await screen.findByText('NOTICE OF B')).toBeInTheDocument()
  expect(screen.getByText('Venue: Norte')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Accept and check today' }))
  expect(await screen.findByText('Today the assistant can give you data for Norte until 23:59.')).toBeInTheDocument()
  expect(service.grantSupportDataAccess).toHaveBeenCalledWith('staff-one', {
    venueId: 'v1',
    noticeHash: 'e'.repeat(64),
    language: 'en',
    acceptNotice: true,
  })
})
it('a background re-read that fails stays silent, but a «Reintentar» the person taps reports its failure', async () => {
  vi.mocked(service.getSupportDataAccess).mockResolvedValueOnce(access()).mockRejectedValue(new Error('Network Error'))
  const { client } = show()
  expect(await screen.findByText('Hoy todavía no.')).toBeInTheDocument()
  await act(async () => {
    await client.refetchQueries({ queryKey: ['support-whatsapp', 'staff-one', 'data', 'access'] })
  })
  const retry = await screen.findByRole('button', { name: 'Reintentar' })
  expect(onError).not.toHaveBeenCalled()
  fireEvent.click(retry)
  await waitFor(() => expect(onError).toHaveBeenCalledTimes(1))
  expect(onOk).not.toHaveBeenCalled()
})
it('a stale tab: the one-tap POST is answered «not accepted» with a notice → the dialog opens with it, naming the tapped venue, and «Aceptar» accepts it (T-B37)', async () => {
  // This tab read «accepted» before the person unlinked and linked again in another tab.
  vi.mocked(service.getSupportDataAccess).mockImplementation(async (_staff, venueId) =>
    access({ accepted: true, venueName: venueId === 'v2' ? 'Sur' : 'Norte' }),
  )
  const relinked = { text: 'AVISO PARA EL VINCULO NUEVO', hash: 'd'.repeat(64) }
  vi.mocked(service.grantSupportDataAccess)
    .mockResolvedValueOnce(access({ venueName: 'Sur', notice: relinked })) // with acceptNotice: false the server writes nothing and asks
    .mockResolvedValue(access({ accepted: true, unlocked: true, venueName: 'Sur', notice: relinked }))
  show()
  expect(await screen.findByText('Hoy todavía no.')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Sucursal'), { target: { value: 'v2' } })
  await waitFor(() => expect(service.getSupportDataAccess).toHaveBeenLastCalledWith('staff-one', 'v2', 'es', expect.anything()))
  fireEvent.click(await screen.findByRole('button', { name: 'Consultar datos por WhatsApp hoy' }))
  expect(await screen.findByText(relinked.text)).toBeInTheDocument()
  expect(screen.getByText('Sucursal: Sur')).toBeInTheDocument()
  expect(screen.getByText('Hoy todavía no.')).toBeInTheDocument()
  expect(screen.getByLabelText('Sucursal')).toHaveValue('v2')
  fireEvent.click(screen.getByRole('button', { name: 'Aceptar y consultar hoy' }))
  expect(await screen.findByText('Hoy el asistente puede darte datos de Sur hasta las 23:59.')).toBeInTheDocument()
  // One POST per tap, none repeated (T-B29): the one tap asked only for today; the dialog accepted the notice it showed.
  // The body is unchanged by the venue line: the hash is the server's notice hash, and no name travels.
  expect(vi.mocked(service.grantSupportDataAccess).mock.calls.map(call => call[1])).toEqual([
    { venueId: 'v2', noticeHash: 'a'.repeat(64), language: 'es', acceptNotice: false },
    { venueId: 'v2', noticeHash: 'd'.repeat(64), language: 'es', acceptNotice: true },
  ])
})
it('a background re-read of the venue list that fails stays silent while the list is on screen', async () => {
  vi.mocked(service.listSupportVenues)
    .mockResolvedValueOnce({ items: [norte, sur], total: 2, nextCursor: null })
    .mockRejectedValue(new Error('Network Error'))
  const { client } = show()
  expect(await screen.findByText('Hoy todavía no.')).toBeInTheDocument()
  await act(async () => {
    await client.refetchQueries({ queryKey: ['support-whatsapp', 'staff-one', 'data', 'venues'] })
    // TanStack hands the new result to React in a setTimeout(0): let it render (and its effects run) before looking.
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  expect(service.listSupportVenues).toHaveBeenCalledTimes(3) // the first read, the re-read and its one retry
  expect(onError).not.toHaveBeenCalled()
  expect(optionValues()).toEqual(['v1', 'v2'])
  expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
  expect(unlockButton()).toBeEnabled()
})
it('a «Reintentar» of the venue list that fails again reports it again: the person asked', async () => {
  const failure = new Error('Network Error')
  vi.mocked(service.listSupportVenues).mockRejectedValue(failure)
  show()
  fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))
  await waitFor(() => expect(onError).toHaveBeenCalledTimes(2))
  expect(onError).toHaveBeenLastCalledWith(failure)
  expect(onOk).not.toHaveBeenCalled()
})
it('«Ver más sucursales» that fails reports it once, and the venues already shown stay', async () => {
  const failure = new Error('Network Error')
  vi.mocked(service.listSupportVenues).mockImplementation(async (_staff, params) => {
    if (params.cursor) throw failure
    return fiftyOfSixty
  })
  show()
  fireEvent.click(await screen.findByRole('button', { name: 'Ver más sucursales' }))
  await waitFor(() => expect(onError).toHaveBeenCalledWith(failure))
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  expect(onError).toHaveBeenCalledTimes(1)
  expect(optionValues()).toHaveLength(50)
})
it('the selected row is renamed by a refetch BEFORE the tap: the dialog names the row the select shows', async () => {
  vi.mocked(service.listSupportVenues)
    .mockResolvedValueOnce({ items: [norte, sur], total: 2, nextCursor: null })
    .mockResolvedValue({ items: [norte, { ...sur, name: 'Sur nueva' }], total: 2, nextCursor: null })
  const { client } = show()
  expect(await screen.findByText('Hoy todavía no.')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Sucursal'), { target: { value: 'v2' } })
  await waitFor(() => expect(service.getSupportDataAccess).toHaveBeenLastCalledWith('staff-one', 'v2', 'es', expect.anything()))
  await refetchVenues(client)
  const select = screen.getByLabelText('Sucursal') as HTMLSelectElement
  await waitFor(() => expect(select.selectedOptions[0]?.textContent).toBe('Sur nueva'))
  fireEvent.click(await screen.findByRole('button', { name: 'Consultar datos por WhatsApp hoy' }))
  expect(await screen.findByText('AVISO DE LA B')).toBeInTheDocument()
  expect(screen.getByText('Sucursal: Sur nueva')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Aceptar y consultar hoy' }))
  await waitFor(() => expect(service.grantSupportDataAccess).toHaveBeenCalledTimes(1))
  expect(service.grantSupportDataAccess).toHaveBeenCalledWith('staff-one', {
    venueId: 'v2',
    noticeHash: 'a'.repeat(64),
    language: 'es',
    acceptNotice: true,
  })
})
