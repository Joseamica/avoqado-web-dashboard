/**
 * Variantes de producto, bloque 2 (Tarea 8): la biblioteca de opciones («Talla», «Color») en Menú › Opciones.
 * Arnés de `ProductGroupDialog.test.tsx` (vi.hoisted + vi.mock; respuestas en beforeEach: vitest corre con mockReset). `t` devuelve la clave.
 * 🔴 El PUT del server REEMPLAZA todos los valores y la lista trae máx. 100 por opción: una opción truncada se abre en sólo lectura.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const svc = vi.hoisted(() => ({
  listOptionLibrary: vi.fn(),
  createLibraryOption: vi.fn(),
  updateLibraryOption: vi.fn(),
  deleteLibraryOption: vi.fn(),
}))
const acceso = vi.hoisted(() => ({ puede: true }))
const avisos = vi.hoisted(() => ({ toast: vi.fn() }))
vi.mock('@/services/productGroups.service', () => svc)
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/mi-tienda' }) }))
vi.mock('@/hooks/use-access', () => ({
  useAccess: () => ({ can: () => acceso.puede, canAny: () => acceso.puede, canAll: () => acceso.puede }),
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: avisos.toast }) }))
// El candado de plan tiene sus propias pruebas: aquí sólo se comprueba QUÉ función pide.
vi.mock('@/components/billing/FeatureGate', () => ({
  FeatureGate: ({ feature, children }: { feature: string; children: React.ReactNode }) => <div data-testid={`gate-${feature}`}>{children}</div>,
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o?.count !== undefined ? `${k}:${o.count}` : o?.name !== undefined ? `${k}:${o.name}` : k),
    i18n: { language: 'es' },
  }),
}))

import ProductOptions from '../ProductOptions'

const opcion = (id: string, name: string, values: string[], extra: Record<string, unknown> = {}) => ({
  id,
  name,
  valuesTotal: values.length,
  valuesTruncated: false,
  values: values.map((value, sortOrder) => ({ id: `${id}-${sortOrder}`, value, sortOrder })),
  ...extra,
})
const pagina = (items: ReturnType<typeof opcion>[], total = items.length, page = 1, pageSize = 25) => ({ items, total, page, pageSize })

function pintar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } })
  return render(
    <QueryClientProvider client={qc}>
      <ProductOptions />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  acceso.puede = true
  svc.listOptionLibrary.mockResolvedValue(pagina([opcion('o1', 'Talla', ['S', 'M']), opcion('o2', 'Color', ['Rojo'])]))
  svc.createLibraryOption.mockResolvedValue({ id: 'o3' })
  svc.updateLibraryOption.mockResolvedValue({ id: 'o1' })
  svc.deleteLibraryOption.mockResolvedValue({ id: 'o1', deleted: true })
})

describe('ProductOptions — la biblioteca de opciones', () => {
  it('(1) mientras carga muestra el esqueleto, ni vacío ni error', () => {
    svc.listOptionLibrary.mockReturnValue(new Promise(() => {}))
    pintar()
    expect(screen.getByTestId('biblioteca-cargando')).toBeInTheDocument()
    expect(screen.queryByText('biblioteca.vacia')).not.toBeInTheDocument()
    expect(screen.queryByText('biblioteca.error')).not.toBeInTheDocument()
  })

  it('está envuelta en el candado de Variantes (Pro)', async () => {
    pintar()
    expect(screen.getByTestId('gate-PRODUCT_VARIANTS')).toBeInTheDocument()
    await screen.findByText('Talla')
  })

  it('(2) sin opciones guardadas lo explica y ofrece crear', async () => {
    svc.listOptionLibrary.mockResolvedValue(pagina([]))
    pintar()
    expect(await screen.findByText('biblioteca.vacia')).toBeInTheDocument()
    expect(screen.queryByTestId('biblioteca-cargando')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'biblioteca.nueva' }).length).toBeGreaterThan(0)
  })

  it('(3) un error se distingue del vacío y «Reintentar» vuelve a pedir', async () => {
    svc.listOptionLibrary.mockRejectedValue(new Error('boom'))
    pintar()
    expect(await screen.findByText('biblioteca.error')).toBeInTheDocument()
    expect(screen.queryByText('biblioteca.vacia')).not.toBeInTheDocument()
    const antes = svc.listOptionLibrary.mock.calls.length
    svc.listOptionLibrary.mockResolvedValue(pagina([opcion('o1', 'Talla', ['S'])]))
    fireEvent.click(screen.getByRole('button', { name: 'biblioteca.reintentar' }))
    expect(await screen.findByText('Talla')).toBeInTheDocument()
    expect(svc.listOptionLibrary.mock.calls.length).toBeGreaterThan(antes)
  })

  it('(4) pinta nombres y valores, el total, y «Cargar más» pide la página 2', async () => {
    svc.listOptionLibrary
      // pageSize 2 en la respuesta: así la página 1 (2 de 3) deja una siguiente, como las 25 de 30 del server real.
      .mockResolvedValueOnce(pagina([opcion('o1', 'Talla', ['S', 'M']), opcion('o2', 'Color', ['Rojo'])], 3, 1, 2))
      .mockResolvedValueOnce(pagina([opcion('o3', 'Tamaño', ['Chico'])], 3, 2, 2))
    pintar()
    expect(await screen.findByText('Talla')).toBeInTheDocument()
    expect(screen.getByText('S, M')).toBeInTheDocument()
    expect(screen.getByText('Color')).toBeInTheDocument()
    expect(screen.getByText('biblioteca.total:3')).toBeInTheDocument()
    expect(svc.listOptionLibrary).toHaveBeenCalledWith('v1', { page: 1, pageSize: 25 })
    fireEvent.click(screen.getByRole('button', { name: 'biblioteca.cargarMas:1' }))
    expect(await screen.findByText('Tamaño')).toBeInTheDocument()
    expect(svc.listOptionLibrary).toHaveBeenCalledWith('v1', { page: 2, pageSize: 25 })
    expect(screen.queryByRole('button', { name: /biblioteca.cargarMas/ })).not.toBeInTheDocument()
  })

  it('(5) crear «Talla» con S, M llama al server y la lista se vuelve a pedir sin recargar', async () => {
    pintar()
    await screen.findByText('Talla')
    expect(svc.listOptionLibrary).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'biblioteca.nueva' }))
    fireEvent.change(await screen.findByLabelText('biblioteca.nombre'), { target: { value: 'Medida' } })
    fireEvent.change(screen.getByLabelText('biblioteca.valores'), { target: { value: 'S, M' } })
    fireEvent.click(screen.getByRole('button', { name: 'biblioteca.guardar' }))
    await waitFor(() => expect(svc.createLibraryOption).toHaveBeenCalledWith('v1', { name: 'Medida', values: ['S', 'M'] }))
    await waitFor(() => expect(svc.listOptionLibrary).toHaveBeenCalledTimes(2))
    expect(svc.updateLibraryOption).not.toHaveBeenCalled()
  })

  it('crear sin valores no llama al server y dice qué falta', async () => {
    pintar()
    await screen.findByText('Talla')
    fireEvent.click(screen.getByRole('button', { name: 'biblioteca.nueva' }))
    fireEvent.change(await screen.findByLabelText('biblioteca.nombre'), { target: { value: 'Medida' } })
    fireEvent.click(screen.getByRole('button', { name: 'biblioteca.guardar' }))
    expect(await screen.findByText('validacion.opcionSinValores:Medida')).toBeInTheDocument()
    expect(svc.createLibraryOption).not.toHaveBeenCalled()
  })

  it('editar una opción manda el PUT con el nombre y TODOS sus valores, limpios', async () => {
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: /Talla/ }))
    fireEvent.change(await screen.findByLabelText('biblioteca.valores'), { target: { value: 'L,  m ,' } })
    fireEvent.click(screen.getByRole('button', { name: 'biblioteca.guardar' }))
    // «m» repite a «M» (se ignora sin importar mayúsculas): queda S, M, L.
    await waitFor(() => expect(svc.updateLibraryOption).toHaveBeenCalledWith('v1', 'o1', { name: 'Talla', values: ['S', 'M', 'L'] }))
    expect(svc.createLibraryOption).not.toHaveBeenCalled()
  })

  it('(6) borrar pide confirmación y sólo entonces llama al server', async () => {
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: /Talla/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'biblioteca.borrar' }))
    const aviso = await screen.findByRole('alertdialog')
    expect(within(aviso).getByText('biblioteca.borrarConfirmar:Talla')).toBeInTheDocument()
    expect(svc.deleteLibraryOption).not.toHaveBeenCalled()
    fireEvent.click(within(aviso).getByRole('button', { name: 'biblioteca.borrar' }))
    await waitFor(() => expect(svc.deleteLibraryOption).toHaveBeenCalledWith('v1', 'o1'))
    await waitFor(() => expect(svc.listOptionLibrary).toHaveBeenCalledTimes(2))
  })

  it('(7) 🔴 una opción con más valores de los que trae la lista se abre en sólo lectura: sin guardar, nunca un PUT', async () => {
    svc.listOptionLibrary.mockResolvedValue(
      pagina([opcion('o1', 'Talla', ['S', 'M'], { valuesTotal: 130, valuesTruncated: true }), opcion('o2', 'Color', ['Rojo'])]),
    )
    pintar()
    expect(await screen.findByText('biblioteca.masValores:128')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Talla/ }))
    expect(await screen.findByText('biblioteca.truncada:130')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'biblioteca.guardar' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('biblioteca.nombre')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'biblioteca.borrar' })).toBeInTheDocument()
    expect(svc.updateLibraryOption).not.toHaveBeenCalled()
  })

  it('sin permiso de crear no hay «Nueva opción», ni guardar, ni borrar; la opción se puede ver', async () => {
    acceso.puede = false
    pintar()
    expect(screen.queryByRole('button', { name: 'biblioteca.nueva' })).not.toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: /Talla/ }))
    expect(await screen.findByLabelText('biblioteca.nombre')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'biblioteca.guardar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'biblioteca.borrar' })).not.toBeInTheDocument()
    // Sólo lectura: el título dice «Ver», no «Editar», y se explica por qué no hay botones.
    expect(screen.getByRole('heading', { name: 'biblioteca.ver' })).toBeInTheDocument()
    expect(screen.getByText('biblioteca.sinPermiso')).toBeInTheDocument()
  })

  it('sin permiso de crear, el estado vacío no invita a «Crear…»', async () => {
    acceso.puede = false
    svc.listOptionLibrary.mockResolvedValue(pagina([]))
    pintar()
    expect(await screen.findByText('biblioteca.vaciaSoloLectura')).toBeInTheDocument()
    expect(screen.queryByText('biblioteca.vacia')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'biblioteca.nueva' })).not.toBeInTheDocument()
  })

  it('un error al guardar se avisa en español y la lista se vuelve a leer (el primer intento pudo aplicarse)', async () => {
    svc.createLibraryOption.mockRejectedValue({ response: { status: 400, data: { message: 'Ya existe una opción con el nombre "Medida"' } } })
    pintar()
    await screen.findByText('Talla')
    fireEvent.click(screen.getByRole('button', { name: 'biblioteca.nueva' }))
    fireEvent.change(await screen.findByLabelText('biblioteca.nombre'), { target: { value: 'Medida' } })
    fireEvent.change(screen.getByLabelText('biblioteca.valores'), { target: { value: 'S,' } })
    fireEvent.click(screen.getByRole('button', { name: 'biblioteca.guardar' }))
    await waitFor(() =>
      expect(avisos.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', description: 'Ya existe una opción con el nombre "Medida"' })),
    )
    await waitFor(() => expect(svc.listOptionLibrary).toHaveBeenCalledTimes(2))
    // El editor sigue abierto con lo que tecleó.
    expect(screen.getByLabelText('biblioteca.nombre')).toHaveValue('Medida')
  })

  it('el nombre no pasa de 40 letras (el tope del server)', async () => {
    pintar()
    await screen.findByText('Talla')
    fireEvent.click(screen.getByRole('button', { name: 'biblioteca.nueva' }))
    expect(await screen.findByLabelText('biblioteca.nombre')).toHaveAttribute('maxlength', '40')
  })

  it('editar quitando TODOS los valores no manda ningún PUT (reemplazaría la opción por nada)', async () => {
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: /Talla/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'opciones.quitarValor:S' }))
    fireEvent.click(screen.getByRole('button', { name: 'opciones.quitarValor:M' }))
    fireEvent.click(screen.getByRole('button', { name: 'biblioteca.guardar' }))
    expect(await screen.findByText('validacion.opcionSinValores:Talla')).toBeInTheDocument()
    expect(svc.updateLibraryOption).not.toHaveBeenCalled()
  })

  it('🔴 aunque la bandera no venga, si el total pasa de lo que trajo la lista, la opción es de sólo lectura', async () => {
    svc.listOptionLibrary.mockResolvedValue(pagina([opcion('o1', 'Talla', ['S', 'M'], { valuesTotal: 130, valuesTruncated: false })]))
    pintar()
    expect(await screen.findByText('biblioteca.masValores:128')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Talla/ }))
    expect(await screen.findByText('biblioteca.truncada:130')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'biblioteca.guardar' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'biblioteca.ver' })).toBeInTheDocument()
  })

  it('una opción truncada SÍ se puede borrar: se confirma en el aviso y se llama al server', async () => {
    svc.listOptionLibrary.mockResolvedValue(pagina([opcion('o1', 'Talla', ['S', 'M'], { valuesTotal: 130, valuesTruncated: true })]))
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: /Talla/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'biblioteca.borrar' }))
    const aviso = await screen.findByRole('alertdialog')
    expect(svc.deleteLibraryOption).not.toHaveBeenCalled()
    fireEvent.click(within(aviso).getByRole('button', { name: 'biblioteca.borrar' }))
    await waitFor(() => expect(svc.deleteLibraryOption).toHaveBeenCalledWith('v1', 'o1'))
    expect(svc.updateLibraryOption).not.toHaveBeenCalled()
  })
})
