import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Radix Select usa pointer capture, que jsdom no trae. Funciones planas, NO vi.fn() (mockReset: true las vaciaría).
Element.prototype.hasPointerCapture = () => false
Element.prototype.setPointerCapture = () => {}
Element.prototype.releasePointerCapture = () => {}

const svc = vi.hoisted(() => ({ setPassProductLinks: vi.fn() }))
vi.mock('@/services/passes.service', () => svc)
const toastSpy = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastSpy }) }))
const invalidateSpy = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/use-passes', () => ({ useInvalidatePasses: () => invalidateSpy }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key) }),
}))

import { ProductLinksEditor } from '../ProductLinksEditor'

const PLANS = [
  { id: '305', name: 'Gold', code: 'ABCD' },
  { id: '306', name: 'Silver', code: 'EFGH' },
]
const LINKS = [{ productId: 'p1', productName: 'Yoga', externalPlanId: '305', externalPlanName: 'Gold' }]
const PRODUCTS = {
  items: [
    { id: 'p1', name: 'Yoga' },
    { id: 'p2', name: 'Pilates' },
  ],
  total: 2,
}

// Los textos reales del server (`passIntegrations.service.ts`, setPassProductLinks).
const HAS_BOOKINGS =
  '«Yoga» tiene 2 reserva(s) de TotalPass próximas o en curso. Cancélalas desde la clase o espera a que terminen para desligarla.'
const PLAN_CHANGE =
  '«Yoga» tiene clases publicadas con otro plan. Para cambiarlo, primero desliga la clase, espera unos minutos a que se den de baja y vuelve a ligarla.'
const PLANS_UNKNOWN = 'No pudimos leer tus planes de TotalPass. Vuelve a conectar la llave para actualizarlos.'
const NOT_A_CLASS = 'Sólo se pueden ligar clases de este negocio.'

function renderEditor(over: Partial<Parameters<typeof ProductLinksEditor>[0]> = {}) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ProductLinksEditor
        venueId="v1"
        provider="TOTALPASS"
        plans={PLANS}
        productLinks={LINKS}
        classProducts={PRODUCTS}
        canManage
        {...over}
      />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  invalidateSpy.mockResolvedValue(undefined)
  svc.setPassProductLinks.mockResolvedValue({ productLinks: LINKS })
})

describe('ProductLinksEditor', () => {
  // Guardar manda la lista COMPLETA de las ligadas (el server desliga lo que no venga).
  it('ligar una clase y guardar manda todas las ligas juntas e invalida', async () => {
    const user = userEvent.setup()
    renderEditor()
    expect(screen.getByRole('button', { name: 'products.save' })).toBeDisabled()
    await user.click(screen.getByRole('combobox', { name: 'Pilates' }))
    await user.click(await screen.findByRole('option', { name: 'Silver' }))
    await user.click(screen.getByRole('button', { name: 'products.save' }))
    await waitFor(() =>
      expect(svc.setPassProductLinks).toHaveBeenCalledWith('v1', 'TOTALPASS', [
        { productId: 'p1', externalPlanId: '305' },
        { productId: 'p2', externalPlanId: '306' },
      ]),
    )
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith('v1', 'connection'))
    expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ title: 'products.saved' }))
  })

  // P2-8: el botón sigue deshabilitado hasta que la vista nueva llegó, no sólo hasta que el PUT contestó.
  it('guardar deja los selectores y el botón deshabilitados hasta que los datos nuevos llegaron', async () => {
    const user = userEvent.setup()
    let release!: () => void
    invalidateSpy.mockReturnValueOnce(
      new Promise<void>(resolve => {
        release = resolve
      }),
    )
    renderEditor()
    await user.click(screen.getByRole('combobox', { name: 'Pilates' }))
    await user.click(await screen.findByRole('option', { name: 'Silver' }))
    await user.click(screen.getByRole('button', { name: 'products.save' }))
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith('v1', 'connection'))
    expect(screen.getByRole('combobox', { name: 'Yoga' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'products.save' })).toBeDisabled()
    release()
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Yoga' })).toBeEnabled())
  })

  // Desligar = «Sin ligar». El 409 del server (socios reservados) se ve tal cual, en la tarjeta, y la vista se recarga
  // (R2b-17: el server pudo haber cambiado, p. ej. la conexión dejó de estar activa).
  it('desligar una clase con socios ⇒ el 409 del servidor se ve tal cual y la vista general se recarga', async () => {
    const user = userEvent.setup()
    svc.setPassProductLinks.mockRejectedValue({
      response: { status: 409, data: { message: HAS_BOOKINGS, code: 'PASS_PRODUCT_HAS_BOOKINGS' } },
    })
    renderEditor()
    await user.click(screen.getByRole('combobox', { name: 'Yoga' }))
    await user.click(await screen.findByRole('option', { name: 'products.none' }))
    await user.click(screen.getByRole('button', { name: 'products.save' }))
    await waitFor(() => expect(svc.setPassProductLinks).toHaveBeenCalledWith('v1', 'TOTALPASS', []))
    const message = await screen.findByText(HAS_BOOKINGS)
    expect(message.closest('[role="alert"]')).toHaveClass('text-destructive')
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith('v1', 'connection'))
    expect(toastSpy).not.toHaveBeenCalled()
    // El borrador se conserva para que el dueño decida qué hacer.
    expect(screen.getByRole('combobox', { name: 'Yoga' })).toHaveTextContent('products.none')
  })

  // H4 (gemela de P2-8): el onError también DEVUELVE la invalidación ⇒ los controles se rehabilitan cuando la vista nueva llegó.
  it('guardar falla ⇒ selectores y botón deshabilitados hasta que la recarga de la vista llegó', async () => {
    const user = userEvent.setup()
    svc.setPassProductLinks.mockRejectedValue({ response: { status: 409, data: { message: HAS_BOOKINGS } } })
    let release!: () => void
    invalidateSpy.mockReturnValueOnce(
      new Promise<void>(resolve => {
        release = resolve
      }),
    )
    renderEditor()
    await user.click(screen.getByRole('combobox', { name: 'Yoga' }))
    await user.click(await screen.findByRole('option', { name: 'products.none' }))
    await user.click(screen.getByRole('button', { name: 'products.save' }))
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith('v1', 'connection'))
    expect(screen.getByRole('combobox', { name: 'Yoga' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'products.save' })).toBeDisabled()
    release()
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Yoga' })).toBeEnabled())
    expect(screen.getByText(HAS_BOOKINGS)).toBeInTheDocument()
  })

  // H3: al volver a guardar, el error del intento anterior se va en cuanto sale la petición nueva.
  it('volver a guardar borra el error del intento anterior', async () => {
    const user = userEvent.setup()
    svc.setPassProductLinks.mockRejectedValueOnce({ response: { status: 409, data: { message: HAS_BOOKINGS } } })
    svc.setPassProductLinks.mockReturnValueOnce(new Promise(() => {}))
    renderEditor()
    await user.click(screen.getByRole('combobox', { name: 'Yoga' }))
    await user.click(await screen.findByRole('option', { name: 'products.none' }))
    await user.click(screen.getByRole('button', { name: 'products.save' }))
    expect(await screen.findByText(HAS_BOOKINGS)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'products.save' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'products.save' }))
    await waitFor(() => expect(svc.setPassProductLinks).toHaveBeenCalledTimes(2))
    expect(screen.queryByText(HAS_BOOKINGS)).not.toBeInTheDocument()
  })

  // H2: una liga a un plan que TotalPass ya no tiene se ve («Plan que ya no existe…»), no deja el selector en blanco, y la
  // fila se puede pasar a «Sin ligar».
  it('una liga a un plan que ya no existe se ve y se puede desligar', async () => {
    const user = userEvent.setup()
    renderEditor({ productLinks: [{ productId: 'p1', productName: 'Yoga', externalPlanId: '999', externalPlanName: 'Bronze' }] })
    expect(screen.getByRole('combobox', { name: 'Yoga' })).toHaveTextContent('products.missingPlan')
    await user.click(screen.getByRole('combobox', { name: 'Yoga' }))
    await user.click(await screen.findByRole('option', { name: 'products.none' }))
    await user.click(screen.getByRole('button', { name: 'products.save' }))
    await waitFor(() => expect(svc.setPassProductLinks).toHaveBeenCalledWith('v1', 'TOTALPASS', []))
  })

  // Los demás rechazos del server también salen tal cual (nada de texto fijo) y recargan la vista.
  it.each([
    ['409 cambiar el plan de una clase ya publicada', 409, 'PASS_PLAN_CHANGE_NEEDS_UNLINK', PLAN_CHANGE],
    ['400 planes desconocidos', 400, 'PASS_PLANS_UNKNOWN', PLANS_UNKNOWN],
    ['400 producto que no es clase', 400, 'PASS_NOT_A_CLASS', NOT_A_CLASS],
  ])('%s ⇒ el mensaje del servidor tal cual', async (_name, status, code, text) => {
    const user = userEvent.setup()
    svc.setPassProductLinks.mockRejectedValue({ response: { status, data: { message: text, code } } })
    renderEditor()
    await user.click(screen.getByRole('combobox', { name: 'Pilates' }))
    await user.click(await screen.findByRole('option', { name: 'Silver' }))
    await user.click(screen.getByRole('button', { name: 'products.save' }))
    expect(await screen.findByText(text)).toBeInTheDocument()
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith('v1', 'connection'))
  })

  // Una clase ya ligada que no entró en las 200 del server igual se muestra (si no, Guardar la desligaría sin verla).
  it('una clase ligada fuera de la lista del server igual aparece y se manda al guardar', async () => {
    const user = userEvent.setup()
    renderEditor({
      productLinks: [...LINKS, { productId: 'p9', productName: 'Spinning', externalPlanId: '306', externalPlanName: 'Silver' }],
    })
    expect(screen.getByRole('combobox', { name: 'Spinning' })).toHaveTextContent('Silver')
    await user.click(screen.getByRole('combobox', { name: 'Pilates' }))
    await user.click(await screen.findByRole('option', { name: 'Gold' }))
    await user.click(screen.getByRole('button', { name: 'products.save' }))
    await waitFor(() =>
      expect(svc.setPassProductLinks).toHaveBeenCalledWith('v1', 'TOTALPASS', [
        { productId: 'p1', externalPlanId: '305' },
        { productId: 'p2', externalPlanId: '305' },
        { productId: 'p9', externalPlanId: '306' },
      ]),
    )
  })

  // D3 (P2-10): una clase archivada (o que dejó de ser clase) con su liga viva se ve marcada; sólo se puede conservar tal cual
  // o quitar (el server rechaza ligarla o cambiarle el plan).
  describe('liga a una clase archivada', () => {
    const ARCHIVED = { productId: 'p8', productName: 'Barre', externalPlanId: '305', externalPlanName: 'Gold', productArchived: true }

    it('se ve marcada y su selector sólo ofrece conservar su plan o «Sin ligar»', async () => {
      const user = userEvent.setup()
      renderEditor({ productLinks: [...LINKS, ARCHIVED] })
      expect(screen.getByText('products.archived')).toBeInTheDocument()
      expect(screen.getByRole('combobox', { name: 'Barre' })).toHaveTextContent('Gold')
      await user.click(screen.getByRole('combobox', { name: 'Barre' }))
      const options = (await screen.findAllByRole('option')).map(o => o.textContent)
      expect(options).toEqual(['products.none', 'Gold'])
    })

    it('guardar otro cambio la manda sin cambios; quitarla la manda fuera', async () => {
      const user = userEvent.setup()
      renderEditor({ productLinks: [...LINKS, ARCHIVED] })
      await user.click(screen.getByRole('combobox', { name: 'Pilates' }))
      await user.click(await screen.findByRole('option', { name: 'Silver' }))
      await user.click(screen.getByRole('button', { name: 'products.save' }))
      await waitFor(() =>
        expect(svc.setPassProductLinks).toHaveBeenCalledWith('v1', 'TOTALPASS', [
          { productId: 'p1', externalPlanId: '305' },
          { productId: 'p2', externalPlanId: '306' },
          { productId: 'p8', externalPlanId: '305' },
        ]),
      )
      await user.click(screen.getByRole('combobox', { name: 'Barre' }))
      await user.click(await screen.findByRole('option', { name: 'products.none' }))
      await user.click(screen.getByRole('button', { name: 'products.save' }))
      await waitFor(() =>
        expect(svc.setPassProductLinks).toHaveBeenLastCalledWith('v1', 'TOTALPASS', [
          { productId: 'p1', externalPlanId: '305' },
          { productId: 'p2', externalPlanId: '306' },
        ]),
      )
    })

    it('si era la última clase, el editor sigue a la vista para poder quitarla', async () => {
      const user = userEvent.setup()
      renderEditor({ productLinks: [ARCHIVED], classProducts: { items: [], total: 0 } })
      expect(screen.queryByText('products.noClasses')).not.toBeInTheDocument()
      await user.click(screen.getByRole('combobox', { name: 'Barre' }))
      await user.click(await screen.findByRole('option', { name: 'products.none' }))
      await user.click(screen.getByRole('button', { name: 'products.save' }))
      await waitFor(() => expect(svc.setPassProductLinks).toHaveBeenCalledWith('v1', 'TOTALPASS', []))
    })
  })

  // P2-10: la lista del server viene acotada (200) y NO se pagina (R32): se dice con un aviso VISIBLE, no un contador escondido.
  it('si hay más clases que las mostradas, lo dice con un aviso visible', () => {
    renderEditor({ classProducts: { items: PRODUCTS.items, total: 240 } })
    expect(screen.getByRole('alert')).toHaveTextContent('products.showing:{"shown":2,"total":240}')
  })

  it('sin planes en la sucursal ⇒ aviso y nada que elegir', () => {
    renderEditor({ plans: [], productLinks: [] })
    expect(screen.getByText('products.noPlans')).toBeInTheDocument()
    expect(screen.queryAllByRole('combobox')).toHaveLength(0)
  })

  it('sin clases en el negocio ⇒ lo dice y nada que elegir', () => {
    renderEditor({ productLinks: [], classProducts: { items: [], total: 0 } })
    expect(screen.getByText('products.noClasses')).toBeInTheDocument()
    expect(screen.queryAllByRole('combobox')).toHaveLength(0)
  })

  it('sin permiso: selects y Guardar deshabilitados', () => {
    renderEditor({ canManage: false })
    for (const s of screen.getAllByRole('combobox')) expect(s).toBeDisabled()
    expect(screen.getByRole('button', { name: 'products.save' })).toBeDisabled()
  })
})
