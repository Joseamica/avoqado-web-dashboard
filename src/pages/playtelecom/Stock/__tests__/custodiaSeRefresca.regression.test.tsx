/**
 * Regresión de producción (2026-09-02, supervisor de PlayTelecom en su celular).
 *
 * Al mover `VenueSimCustodyPanel` del overview legacy (que traía TODO y filtraba en
 * memoria) al endpoint paginado `stock-control/custody`, se rompieron dos cosas que
 * el compilador no ve y que ninguna prueba cubría:
 *
 * 1. El panel lee de la clave `['org-stock-custody', …]`, pero `AssignToPromoterDialog`
 *    y `CollectSimDialog` siguen invalidando sólo `['org-stock-control']`. Invalidar una
 *    clave que ya no alimenta esa lista NO da error: simplemente no hace nada. El SIM se
 *    asignaba bien (200 en el server) y la lista seguía diciendo «Con Supervisor», así que
 *    el supervisor lo intentaba otra vez y el segundo intento SÍ fallaba —
 *    «0 asignados, 1 con error»— porque el SIM ya no estaba en SUPERVISOR_HELD.
 *
 * 2. La búsqueda pasó a ser del servidor y entra en la queryKey, pero el hook no conserva
 *    los datos anteriores. Cada dígito tecleado estrena clave ⇒ `isLoading` ⇒ el early
 *    return del panel (`Cargando custodia…`) desmonta el `<Input>` ⇒ en Android se cierra
 *    el teclado y se pierde el foco: «me está botando cada que escribo un dígito».
 *    Los hooks hermanos (`useOrgStockBulkGroups`, `useOrgStockItemsSearch`) sí lo hacen.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'

import { useOrgStockCustody } from '../hooks/useOrgStockCustody'

const AREA = path.resolve(__dirname, '../..')

const leer = (relativo: string) => fs.readFileSync(path.resolve(AREA, relativo), 'utf8')

/**
 * Guarda estática a propósito: lo que se rompió no fue la lógica de un diálogo sino el
 * ACOPLE entre la clave que lee el panel y la que invalidan sus mutaciones. Montar Radix
 * + combobox + mutación para afirmar eso sería más frágil que leer el contrato.
 */
describe('custodia — las mutaciones invalidan la clave que el panel realmente lee', () => {
  const CLAVE_DEL_PANEL = 'org-stock-custody'

  it('el panel de custodia lee de la clave org-stock-custody', () => {
    expect(leer('Stock/hooks/useOrgStockCustody.ts')).toContain(`'${CLAVE_DEL_PANEL}'`)
    expect(leer('Stock/components/VenueSimCustodyPanel.tsx')).toContain('useOrgStockCustody')
  })

  // Los dos primeros los monta el propio panel; los demás mueven la custodia de un SIM
  // que ese panel puede estar mostrando en otra pestaña. Invalidar una clave que no está
  // montada es un no-op, así que incluirlos no cuesta nada y cierra la clase de bug.
  it.each([
    ['Organization/StockControl/components/AssignToPromoterDialog.tsx', 'asignar a promotor'],
    ['Organization/StockControl/components/CollectSimDialog.tsx', 'recolectar un SIM'],
    ['Organization/StockControl/components/AssignToSupervisorDialog.tsx', 'asignar a supervisor'],
    ['Organization/StockControl/components/ReassignPromoterDialog.tsx', 'reasignar promotor'],
    ['Organization/StockControl/components/ReassignSupervisorDialog.tsx', 'reasignar supervisor'],
    ['Organization/StockControl/components/ChangeCategoryDialog.tsx', 'cambiar categoría'],
  ])('%s invalida org-stock-custody al %s', archivo => {
    const fuente = leer(archivo)
    expect(fuente).toContain('invalidateQueries')
    expect(fuente).toContain(`'${CLAVE_DEL_PANEL}'`)
  })
})

/**
 * Misma trampa, un tab más allá: `StockApprovalQueue` (pestaña «Solicitudes», 7,703 SIMs)
 * también mete su búsqueda en la queryKey y también desmonta su propio <Input> con un early
 * return por `isLoading`. Era PREEXISTENTE — no vino de bcbc9e7c— pero es el mismo síntoma
 * para el mismo supervisor, así que se cierra aquí.
 */
describe('hooks con búsqueda en la clave — todos conservan los datos previos', () => {
  it.each([
    ['Stock/hooks/useOrgStockCustody.ts', 'custodia del supervisor'],
    ['Organization/StockControl/hooks/useStockApprovals.ts', 'solicitudes por aprobar'],
  ])('%s usa placeholderData (%s)', archivo => {
    const fuente = leer(archivo)
    expect(fuente).toContain('keepPreviousData')
    expect(fuente).toContain('placeholderData')
  })
})

describe('useOrgStockCustody — teclear no puede vaciar la lista', () => {
  const envoltura = (client: QueryClient) =>
    function Wrapper({ children }: { children: ReactNode }) {
      return createElement(QueryClientProvider, { client }, children)
    }

  it('conserva los datos anteriores mientras carga la búsqueda nueva (isLoading nunca se prende)', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    // Siembra la primera búsqueda para que el cambio de clave tenga algo que conservar.
    const pagina = {
      items: [],
      pagination: { page: 1, pageSize: 50, total: 0, totalPages: 1 },
      summary: { total: 0, almacen: 0, pendientes: 0, aceptados: 0, rechazados: 0, vendidos: 0, estancados: 0 },
      promoterRanking: [],
    }
    client.setQueryData(['org-stock-custody', 'org-1', { venueId: 'v1', search: undefined }], {
      pages: [pagina],
      pageParams: [1],
    })

    const { result, rerender } = renderHook(
      ({ search }: { search?: string }) => useOrgStockCustody('org-1', { venueId: 'v1', search }, false),
      { wrapper: envoltura(client), initialProps: {} as { search?: string } },
    )

    await waitFor(() => expect(result.current.data).toBeDefined())

    // El supervisor teclea un dígito: la clave cambia. Sin placeholderData la lista se
    // vacía, el panel entra en su early return y el <Input> se desmonta.
    rerender({ search: '0' })

    expect(result.current.data).toBeDefined()
    expect(result.current.isLoading).toBe(false)
  })
})
