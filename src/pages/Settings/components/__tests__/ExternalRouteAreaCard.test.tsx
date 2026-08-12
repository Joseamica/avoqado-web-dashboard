import fs from 'node:fs'
import path from 'node:path'

import i18n from '@/i18n'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { FulfillmentArea } from '@/services/areaTickets.service'

// ---------------------------------------------------------------------------
// Radix Select usa pointer capture, que jsdom no implementa. Funciones planas y
// NO `vi.fn()`: la config de vitest tiene `mockReset: true`, que borraría la
// implementación antes de cada test y dejaría el stub inservible (misma trampa
// documentada para ResizeObserver en `src/test/setup.ts`).
// ---------------------------------------------------------------------------
Element.prototype.hasPointerCapture = () => false
Element.prototype.setPointerCapture = () => {}
Element.prototype.releasePointerCapture = () => {}

const mockUpdateAreaSettlementRoute = vi.fn()

vi.mock('@/services/areaTickets.service', async importOriginal => {
  const actual = await importOriginal<typeof import('@/services/areaTickets.service')>()
  return {
    ...actual,
    updateAreaSettlementRoute: (...args: unknown[]) => mockUpdateAreaSettlementRoute(...args),
  }
})

// `useAccess` lee AuthContext; aquí sólo interesa que el usuario SÍ pueda configurar
// (el caso sin permiso ya tiene su propia rama visible en el card).
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))

import { ExternalRouteAreaCard } from '../ExternalRouteAreaCard'

// ---------------------------------------------------------------------------
// Los defaults NO se copian aquí: se leen del `schema.prisma` del server, que es
// la fuente real. `AVOQADO_DEFAULTS` (en el componente) ya es una copia a mano de
// esos `@default(...)`; repetirlos en el test haría una tercera copia y el test
// pasaría feliz aunque las tres se hubieran desincronizado de la base de datos.
// ---------------------------------------------------------------------------
// Anclado al propio archivo de test (no a `process.cwd()`): sigue apuntando bien
// aunque vitest se lance desde otro directorio. `__tests__` → … → workspace root.
const SCHEMA_PATH = path.resolve(__dirname, '../../../../../../avoqado-server/prisma/schema.prisma')

function prismaFulfillmentAreaDefaults(): Record<string, string> {
  if (!fs.existsSync(SCHEMA_PATH)) {
    throw new Error(
      `No se encontró el schema de Prisma en ${SCHEMA_PATH}. Este test compara los defaults del ` +
        `dashboard contra la fuente real (avoqado-server), así que necesita el repo hermano del workspace.`,
    )
  }
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8')
  const model = /^model FulfillmentArea \{([\s\S]*?)^\}/m.exec(schema)
  if (!model) throw new Error('No se encontró el modelo `FulfillmentArea` en schema.prisma')

  const readDefault = (field: string): string => {
    const match = new RegExp(`^\\s*${field}\\s+\\w+\\s+@default\\((\\w+)\\)`, 'm').exec(model[1])
    if (!match) throw new Error(`El campo \`${field}\` ya no tiene \`@default(...)\` en el modelo FulfillmentArea`)
    return match[1]
  }

  return {
    settlementRoute: readDefault('settlementRoute'),
    externalConfirmationMode: readDefault('externalConfirmationMode'),
    externalOfflinePolicy: readDefault('externalOfflinePolicy'),
    externalDeliveryTracking: readDefault('externalDeliveryTracking'),
  }
}

const VENUE_ID = 'venue_1'

const AREA_AVOQADO: FulfillmentArea = {
  id: 'area_1',
  name: 'Cremería',
  fulfillmentMode: 'IMMEDIATE',
  printStationId: null,
  active: true,
  displayOrder: 0,
  settlementRoute: 'AVOQADO',
  externalConfirmationMode: 'MANUAL',
  externalOfflinePolicy: 'BLOCK',
  externalDeliveryTracking: 'TRACKED',
}

// Ruta externa encendida y con las CUATRO políticas en valores distintos del default,
// a propósito: así "apagar resetea a los defaults" no se puede confundir con "apagar
// reenvía lo que ya tenía el área".
const AREA_EXTERNAL_NON_DEFAULT: FulfillmentArea = {
  ...AREA_AVOQADO,
  settlementRoute: 'EXTERNAL',
  externalConfirmationMode: 'ASSUME_ON_PRINT',
  externalOfflinePolicy: 'ALLOW',
  externalDeliveryTracking: 'UNTRACKED',
}

const AREA_EXTERNAL_MANUAL: FulfillmentArea = { ...AREA_AVOQADO, settlementRoute: 'EXTERNAL' }

function renderCard(area: FulfillmentArea) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <ExternalRouteAreaCard venueId={VENUE_ID} area={area} onSaved={() => {}} />
    </QueryClientProvider>,
  )
}

describe('ExternalRouteAreaCard — el switch maestro de la ruta de cobro externa', () => {
  // El público real es México: se fija el idioma para verificar el texto que el
  // cliente lee de verdad, no la detección de locale del entorno de pruebas.
  beforeAll(async () => {
    await i18n.changeLanguage('es')
  })

  beforeEach(() => {
    mockUpdateAreaSettlementRoute.mockReset()
    mockUpdateAreaSettlementRoute.mockResolvedValue(AREA_EXTERNAL_MANUAL)
  })

  it('encender SIEMPRE pasa por el diálogo, que advierte que Avoqado dejará de registrar esas ventas', async () => {
    const user = userEvent.setup()
    renderCard(AREA_AVOQADO)

    await user.click(screen.getByRole('switch'))

    // El switch por sí solo no escribe nada: sin confirmar, no hay PATCH.
    expect(mockUpdateAreaSettlementRoute).not.toHaveBeenCalled()
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent(/Avoqado no registrará esas ventas ni emitirá factura por ellas/i)

    // Cancelar tampoco escribe…
    await user.click(screen.getByRole('button', { name: /cancelar/i }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(mockUpdateAreaSettlementRoute).not.toHaveBeenCalled()

    // …y el segundo intento vuelve a pedir confirmación (no queda "ya confirmado").
    await user.click(screen.getByRole('switch'))
    const secondDialog = await screen.findByRole('alertdialog')
    expect(secondDialog).toHaveTextContent(/Avoqado no registrará esas ventas ni emitirá factura por ellas/i)

    await user.click(screen.getByRole('button', { name: /sí, cobrar en otra caja/i }))

    await waitFor(() => expect(mockUpdateAreaSettlementRoute).toHaveBeenCalledTimes(1))
    expect(mockUpdateAreaSettlementRoute).toHaveBeenCalledWith(
      VENUE_ID,
      AREA_AVOQADO.id,
      expect.objectContaining({ settlementRoute: 'EXTERNAL' }),
    )
  })

  it('apagar NO pide diálogo — volver a Avoqado es la dirección segura', async () => {
    const user = userEvent.setup()
    renderCard(AREA_EXTERNAL_NON_DEFAULT)

    await user.click(screen.getByRole('switch'))

    await waitFor(() => expect(mockUpdateAreaSettlementRoute).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('apagar resetea las cuatro políticas a los `@default` reales del schema de Prisma', async () => {
    const prismaDefaults = prismaFulfillmentAreaDefaults()
    const user = userEvent.setup()
    renderCard(AREA_EXTERNAL_NON_DEFAULT)

    await user.click(screen.getByRole('switch'))

    await waitFor(() => expect(mockUpdateAreaSettlementRoute).toHaveBeenCalledTimes(1))
    // Igualdad exacta contra lo leído del schema: si alguien cambia un `@default(...)`
    // en el server y no toca `AVOQADO_DEFAULTS`, este test se pone rojo.
    expect(mockUpdateAreaSettlementRoute).toHaveBeenCalledWith(VENUE_ID, AREA_EXTERNAL_NON_DEFAULT.id, prismaDefaults)
  })

  it('los dos controles sin consumidor en el backend no se pueden elegir, y dicen por qué', async () => {
    const user = userEvent.setup()
    const { container } = renderCard(AREA_EXTERNAL_MANUAL)

    // 1) "Vales sin conexión": el Select completo, deshabilitado (cero lectores en el server).
    const offlineTrigger = container.querySelector('[data-tour="area-external-offline-policy"]')
    expect(offlineTrigger).toBeDisabled()
    expect(screen.getByText(/Todavía no tiene efecto/i)).toBeInTheDocument()

    // 2) "Se asume cobrado al imprimir": la OPCIÓN deshabilitada dentro de un Select que
    //    sigue vivo — "Alguien lo confirma a mano" sí funciona y debe poder elegirse.
    expect(screen.getByText(/todavía no se puede elegir/i)).toBeInTheDocument()

    const modeTrigger = container.querySelector<HTMLElement>('[data-tour="area-external-confirmation-mode"]')
    expect(modeTrigger).not.toBeDisabled()
    await user.click(modeTrigger!)

    const options = await screen.findAllByRole('option')
    const assumeOnPrint = options.find(option => option.textContent?.includes('Se asume cobrado al imprimir'))
    const manual = options.find(option => option.textContent?.includes('Alguien lo confirma a mano'))

    expect(assumeOnPrint).toHaveAttribute('aria-disabled', 'true')
    expect(manual).not.toHaveAttribute('aria-disabled', 'true')
  })

  it('un área ya guardada en el modo deshabilitado dice la verdad de lo que le pasa', async () => {
    renderCard(AREA_EXTERNAL_NON_DEFAULT)

    // Lo que de verdad ocurre hoy: sus cobros se quedan pendientes y nadie abre incidencia.
    expect(screen.getByText(/sus cobros se quedan pendientes de confirmar y no se abre ninguna incidencia/i)).toBeInTheDocument()
    // Y NUNCA la promesa vieja, que era falsa.
    expect(screen.queryByText(/Se marca como cobrado al imprimir el vale, sin confirmación/i)).not.toBeInTheDocument()
  })
})
