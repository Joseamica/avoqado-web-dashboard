/**
 * IVA por producto (plan 6b, Tarea 12, spec §5.5): con el negocio encendido, un aviso FIJO si hay un aparato viejo o actividad sin
 * identidad. Los textos los arma el servidor; el componente sólo los pinta. Apagado, o sin avisos: no pinta nada.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const svc = vi.hoisted(() => ({
  getIvaPorProducto: vi.fn(),
  // Función plana (no vi.fn): la clave de la consulta del estado del IVA.
  IVA_QUERY_KEY: (v: string) => ['iva-por-producto', v] as const,
}))
vi.mock('@/services/menu.service', () => svc)
// Con `count`, la clave lleva el número (`clave:N`) para poder afirmarlo.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: { count?: number }) => (o?.count != null ? `${k}:${o.count}` : k) }),
}))
import { AvisoAparatosIva } from '../components/AvisoAparatosIva'

const pintar = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const vista = render(
    <QueryClientProvider client={qc}>
      <AvisoAparatosIva venueId="v1" />
    </QueryClientProvider>,
  )
  return { ...vista, qc }
}
const estado = (over = {}) => ({
  encendido: true,
  habilitadoAt: '2026-11-01T00:00:00Z',
  contabilidad: false,
  bloqueos: [],
  avisos: [],
  facturasSinSello: [],
  ...over,
})
// PF-m7: sin esperar la consulta, «nada» pasaría en vacío (el componente aún no tiene datos). Se espera la llamada, que la consulta
// quede resuelta y un tick para que React pinte lo que haya.
const esperarConsulta = async (qc: QueryClient) => {
  await waitFor(() => expect(svc.getIvaPorProducto).toHaveBeenCalled())
  await waitFor(() => expect(qc.getQueryState(svc.IVA_QUERY_KEY('v1'))?.status).toBe('success'))
  await new Promise(r => setTimeout(r, 0))
}

describe('AvisoAparatosIva', () => {
  it('encendido con un aparato viejo: aviso fijo con el texto del servidor', async () => {
    svc.getIvaPorProducto.mockResolvedValue(
      estado({ avisos: [{ codigo: 'APARATO_VIEJO', mensaje: 'Caja 2 imprime el IVA de forma incorrecta; actualízalo' }] }),
    )
    pintar()
    expect(await screen.findByText('Caja 2 imprime el IVA de forma incorrecta; actualízalo')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('iva.aviso.titulo')
    expect(screen.getByRole('status')).toHaveTextContent('iva.aviso.accion') // dice qué hacer: actualizar la app
    expect(screen.getByRole('status').className).toContain('warning') // ámbar, nunca rojo
  })

  it('actividad sin identidad: también se pinta, junto al aparato viejo', async () => {
    svc.getIvaPorProducto.mockResolvedValue(
      estado({
        avisos: [
          { codigo: 'APARATO_VIEJO', mensaje: 'Caja 2 imprime el IVA de forma incorrecta; actualízalo' },
          { codigo: 'POS_SIN_IDENTIDAD', mensaje: 'Un celular con una versión vieja de la app se usó el 2026-11-02' },
        ],
      }),
    )
    pintar()
    expect(await screen.findByText('Un celular con una versión vieja de la app se usó el 2026-11-02')).toBeInTheDocument()
    expect(screen.getByText('Caja 2 imprime el IVA de forma incorrecta; actualízalo')).toBeInTheDocument()
  })

  // Codex código r1 #7 (Ruling CX-7) + pulido 6b (QA 14-oct): el aviso pinta a lo más 5 aparatos y «y N más» con el resto.
  // `avisosTotal` (si el servidor manda más de 20) cuenta el total real; sin él, el total es el largo de `avisos`.
  it('con avisosTotal mayor que la lista: pinta 5 y «y N más» con el total real; sin avisosTotal, el N sale del largo de la lista', async () => {
    const veinte = Array.from({ length: 20 }, (_, i) => ({ codigo: 'APARATO_VIEJO' as const, mensaje: `Caja ${i} imprime el IVA mal` }))
    svc.getIvaPorProducto.mockResolvedValue(estado({ avisos: veinte, avisosTotal: 25 }))
    const { unmount } = pintar()
    expect(await screen.findByText('iva.aviso.mas:20')).toBeInTheDocument() // 25 en total - 5 pintados
    expect(screen.getAllByRole('listitem')).toHaveLength(6)
    unmount()

    svc.getIvaPorProducto.mockResolvedValue(estado({ avisos: veinte }))
    pintar()
    expect(await screen.findByText('iva.aviso.mas:15')).toBeInTheDocument() // 20 - 5
    expect(screen.getByText('Caja 4 imprime el IVA mal')).toBeInTheDocument()
    expect(screen.queryByText('Caja 5 imprime el IVA mal')).toBeNull()
  })

  it('siete avisos: pinta cinco y «y 2 más» (pulido 6b, aviso muy alto)', async () => {
    const siete = Array.from({ length: 7 }, (_, i) => ({ codigo: 'APARATO_VIEJO' as const, mensaje: `Caja ${i} imprime el IVA mal` }))
    svc.getIvaPorProducto.mockResolvedValue(estado({ avisos: siete }))
    pintar()
    expect(await screen.findByText('iva.aviso.mas:2')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(6)
    expect(screen.getByText('Caja 4 imprime el IVA mal')).toBeInTheDocument()
    expect(screen.queryByText('Caja 5 imprime el IVA mal')).toBeNull()
  })

  it('cinco avisos o menos: se pintan todos y no hay «y N más»', async () => {
    const cinco = Array.from({ length: 5 }, (_, i) => ({ codigo: 'APARATO_VIEJO' as const, mensaje: `Caja ${i} imprime el IVA mal` }))
    svc.getIvaPorProducto.mockResolvedValue(estado({ avisos: cinco }))
    pintar()
    expect(await screen.findByText('Caja 4 imprime el IVA mal')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    expect(screen.queryByText(/iva\.aviso\.mas/)).toBeNull()
  })

  it('encendido sin aparatos viejos: nada', async () => {
    svc.getIvaPorProducto.mockResolvedValue(estado())
    const { container, qc } = pintar()
    await esperarConsulta(qc)
    expect(container).toBeEmptyDOMElement()
  })

  it('apagado: nada, aunque el servidor mande avisos', async () => {
    svc.getIvaPorProducto.mockResolvedValue(estado({ encendido: false, avisos: [{ codigo: 'APARATO_VIEJO', mensaje: 'x' }] }))
    const { container, qc } = pintar()
    await esperarConsulta(qc)
    expect(container).toBeEmptyDOMElement()
  })
})
