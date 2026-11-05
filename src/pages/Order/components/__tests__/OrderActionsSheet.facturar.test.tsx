/**
 * Pedidos → ⋯ → Facturar abre el mismo formulario que «Nueva factura»: sin nada listo lleva a la ventana que dice qué falta, no al
 * formulario que va a fallar al final. Mientras carga o si la lectura falla, deja pasar: el candado de verdad es el SERVIDOR.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import es from '@/locales/es/cfdi.json'
import type { Order } from '@/types'

const leer = (key: string) => key.split('.').reduce<any>((o, s) => o?.[s], es as any)
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => (typeof leer(key) === 'string' ? leer(key) : key) }) }))

const m = vi.hoisted(() => ({
  permisos: ['cfdi:issue', 'cfdi:configure'] as string[],
  fiscal: { data: undefined as unknown, isError: false },
  refetch: vi.fn(),
  habilitada: undefined as boolean | undefined,
}))
vi.mock('@/api', () => ({ default: {} }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => m.permisos.includes(p) }) }))
vi.mock('@/hooks/use-tier-feature-access', () => ({ useTierFeatureAccess: () => ({ hasAccess: true }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/demo' }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@tanstack/react-query', () => ({ useMutation: () => ({ mutate: vi.fn(), isPending: false }) }))
vi.mock('@/hooks/use-cfdi', () => ({
  useFiscalConfig: ({ enabled }: { enabled: boolean }) => {
    m.habilitada = enabled
    return { ...m.fiscal, refetch: m.refetch }
  },
}))
vi.mock('@/pages/Cfdi/components/IssueCfdiDialog', () => ({
  IssueCfdiDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="formulario" /> : null),
}))

import { OrderActionsSheet } from '../OrderActionsSheet'

const orden = { id: 'o1', payments: [], customerEmail: null } as unknown as Order

function tocarFacturar() {
  const ui = (open: boolean) => (
    <MemoryRouter>
      <OrderActionsSheet order={orden} open={open} onOpenChange={() => {}} fullBasePath="/venues/demo" />
    </MemoryRouter>
  )
  const r = render(ui(true))
  fireEvent.click(screen.getByRole('button', { name: es.issueDialog.openButton }))
  r.rerender(ui(false))
}

describe('OrderActionsSheet · Facturar', () => {
  beforeEach(() => {
    m.permisos = ['cfdi:issue', 'cfdi:configure']
    m.fiscal = { data: undefined, isError: false }
  })

  it('🔴 sin emisor ⇒ dice qué falta y lleva a Configuración; el formulario no se abre', () => {
    m.fiscal = { data: { emisores: [], merchantConfigs: [] }, isError: false }
    tocarFacturar()

    expect(screen.queryByTestId('formulario')).not.toBeInTheDocument()
    expect(screen.getByText(es.faltaParaFacturar.configurar.emisor)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: es.faltaParaFacturar.irAConfiguracion })).toHaveAttribute(
      'href',
      '/venues/demo/cfdi/configuracion',
    )
  })

  it('todo listo ⇒ abre el formulario', () => {
    m.fiscal = {
      data: { emisores: [{ id: 'e1', csdStatus: 'ACTIVE' }], merchantConfigs: [{ fiscalEmisorId: 'e1', facturacionEnabled: true }] },
      isError: false,
    }
    tocarFacturar()
    expect(screen.getByTestId('formulario')).toBeInTheDocument()
  })

  it('🔴 cargando o con la lectura fallida ⇒ abre el formulario y no pinta aviso: decide el servidor', () => {
    for (const fiscal of [
      { data: undefined, isError: false },
      { data: undefined, isError: true },
      { data: { emisores: [], merchantConfigs: [] }, isError: true },
    ]) {
      m.fiscal = fiscal
      const { unmount } = render(
        <MemoryRouter>
          <OrderActionsSheet order={orden} open onOpenChange={() => {}} fullBasePath="/venues/demo" />
        </MemoryRouter>,
      )
      fireEvent.click(screen.getByRole('button', { name: es.issueDialog.openButton }))
      expect(screen.getByTestId('formulario')).toBeInTheDocument()
      expect(screen.queryByText(es.faltaParaFacturar.title)).not.toBeInTheDocument()
      unmount()
    }
  })

  it('control — con la hoja cerrada no pregunta la configuración', () => {
    render(
      <MemoryRouter>
        <OrderActionsSheet order={orden} open={false} onOpenChange={() => {}} fullBasePath="/venues/demo" />
      </MemoryRouter>,
    )
    expect(m.habilitada).toBe(false)
  })
})
