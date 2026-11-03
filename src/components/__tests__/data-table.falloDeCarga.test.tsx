/**
 * Cuando la consulta falla, la pantalla le pasa una lista vacía a la tabla y esta decía «Sin resultados», como si el negocio no
 * tuviera datos (D3, 3-nov: 42 de 58 tablas). Con la tabla real y TanStack real, porque una simulación no comprobaría nada de esto.
 */
import { QueryClient, QueryClientProvider, onlineManager, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { configure, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const estables = vi.hoisted(() => {
  const t = (k: string) => k
  return { i18n: { t, i18n: { language: 'es' } } }
})
vi.mock('react-i18next', () => ({ useTranslation: () => estables.i18n }))

import DataTable from '../data-table'

vi.setConfig({ testTimeout: 30_000 })
configure({ asyncUtilTimeout: 10_000 })

type Fila = { id: string; name: string }
const columnas: ColumnDef<Fila, unknown>[] = [{ id: 'name', header: 'Nombre', cell: ({ row }) => <span>{row.original.name}</span> }]
const fila = (i: number): Fila => ({ id: `f${i}`, name: `Fila ${i}` })
const caida = { response: { status: 500 } }

let client: QueryClient
function montar(nodo: React.ReactNode) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(<QueryClientProvider client={client}>{nodo}</QueryClientProvider>)
}

function Pantalla({ cargar }: { cargar: () => Promise<Fila[]> }) {
  const query = useQuery({ queryKey: ['lista'], queryFn: cargar })
  return <DataTable data={query.data ?? []} rowCount={query.data?.length ?? 0} columns={columnas} isLoading={query.isLoading} query={query} />
}

const aviso = () => screen.queryByRole('alert')
const reintentar = () => screen.getByRole('button', { name: 'retry' })

afterEach(() => {
  onlineManager.setOnline(true)
  client?.clear()
})

describe('DataTable: si falla la carga', () => {
  it('sin datos avisa y deja reintentar, en vez de decir «Sin resultados»', async () => {
    const cargar = vi.fn<() => Promise<Fila[]>>().mockRejectedValue(caida)
    montar(<Pantalla cargar={cargar} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('loadFailure.empty')
    expect(screen.queryByText('no_results')).not.toBeInTheDocument()
    // Tampoco un «0 de 0» que parezca dato (lo que ya exigía la prueba E2E del catálogo).
    expect(screen.queryByText(/selectedRows/)).not.toBeInTheDocument()

    cargar.mockResolvedValue([fila(1)])
    fireEvent.click(reintentar())

    expect(await screen.findByText('Fila 1')).toBeInTheDocument()
    expect(aviso()).not.toBeInTheDocument()
  })

  it('un negocio de verdad vacío sigue diciendo «Sin resultados», sin aviso', async () => {
    montar(<Pantalla cargar={async () => []} />)

    expect(await screen.findByText('no_results')).toBeInTheDocument()
    expect(aviso()).not.toBeInTheDocument()
    expect(screen.getByText(/selectedRows/)).toBeInTheDocument()
  })

  it('mientras carga no avisa ni dice «Sin resultados»', async () => {
    montar(<Pantalla cargar={() => new Promise(() => {})} />)

    await waitFor(() => expect(client.isFetching()).toBe(1))
    expect(aviso()).not.toBeInTheDocument()
    expect(screen.queryByText('no_results')).not.toBeInTheDocument()
  })

  it('sin internet tampoco dice «Sin resultados», y al volver la red carga sola', async () => {
    onlineManager.setOnline(false)
    montar(<Pantalla cargar={async () => [fila(1)]} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('loadFailure.empty')
    expect(screen.queryByText('no_results')).not.toBeInTheDocument()

    onlineManager.setOnline(true)

    expect(await screen.findByText('Fila 1')).toBeInTheDocument()
    expect(aviso()).not.toBeInTheDocument()
  })

  it('si falla la recarga conserva la lista y avisa que puede estar vieja; al reintentar se quita el aviso', async () => {
    const cargar = vi.fn<() => Promise<Fila[]>>().mockResolvedValue([fila(1)])
    montar(<Pantalla cargar={cargar} />)
    await screen.findByText('Fila 1')

    cargar.mockRejectedValue(caida)
    void client.invalidateQueries()

    expect(await screen.findByRole('alert')).toHaveTextContent('loadFailure.partial')
    expect(screen.getByText('Fila 1')).toBeInTheDocument()

    cargar.mockReturnValue(new Promise(() => {}))
    fireEvent.click(reintentar())

    await waitFor(() => expect(aviso()).not.toBeInTheDocument())
    expect(screen.getByText('Fila 1')).toBeInTheDocument()
  })

  it('sin permiso lo dice y no ofrece un «Reintentar» que no lo va a arreglar', async () => {
    montar(<Pantalla cargar={() => Promise.reject({ response: { status: 403 } })} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('loadFailure.forbidden')
    expect(screen.queryByRole('button', { name: 'retry' })).not.toBeInTheDocument()
    expect(screen.queryByText('no_results')).not.toBeInTheDocument()
  })

  it('con query={null} la tabla no se mete: datos que no vienen de una consulta', () => {
    montar(<DataTable data={[]} rowCount={0} columns={columnas} query={null} />)

    expect(screen.getByText('no_results')).toBeInTheDocument()
    expect(aviso()).not.toBeInTheDocument()
  })

  it('una página que falla deja regresar a la anterior: la paginación sigue, aunque ya no haya filas', async () => {
    function Paginada() {
      const [pagination, setPagination] = useState({ pageIndex: 1, pageSize: 10 })
      const query = useQuery({
        queryKey: ['paginada', pagination.pageIndex],
        queryFn: async () => {
          if (pagination.pageIndex === 1) throw caida
          return [fila(1)]
        },
      })
      return (
        <DataTable
          data={query.data ?? []}
          rowCount={20}
          columns={columnas}
          isLoading={query.isLoading}
          pagination={pagination}
          setPagination={setPagination}
          query={query}
        />
      )
    }
    montar(<Paginada />)
    await screen.findByRole('alert')

    fireEvent.click(document.querySelector('.lucide-chevron-left')!.closest('button')!)

    expect(await screen.findByText('Fila 1')).toBeInTheDocument()
    expect(aviso()).not.toBeInTheDocument()
  })

  it('en una lista infinita, si falla la página siguiente, «Reintentar» pide esa página (Codex r0)', async () => {
    const cargar = vi.fn(async (pagina: number) => [fila(pagina)])
    function Infinita() {
      const query = useInfiniteQuery({
        queryKey: ['infinita'],
        queryFn: ({ pageParam }) => cargar(pageParam),
        initialPageParam: 1,
        getNextPageParam: (ultima: Fila[]) => (ultima[0].id === 'f1' ? 2 : undefined),
      })
      const filas = query.data?.pages.flat() ?? []
      return (
        <>
          <button onClick={() => void query.fetchNextPage()}>más</button>
          <DataTable data={filas} rowCount={filas.length} columns={columnas} isLoading={query.isLoading} query={query} />
        </>
      )
    }
    montar(<Infinita />)
    await screen.findByText('Fila 1')

    cargar.mockRejectedValueOnce(caida)
    fireEvent.click(screen.getByRole('button', { name: 'más' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('loadFailure.partial')
    expect(screen.getByText('Fila 1')).toBeInTheDocument()

    fireEvent.click(reintentar())

    expect(await screen.findByText('Fila 2')).toBeInTheDocument()
    expect(aviso()).not.toBeInTheDocument()
  })
})
