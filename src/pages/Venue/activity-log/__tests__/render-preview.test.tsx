/**
 * No es una prueba: es un generador de VISTA PREVIA.
 *
 * Renderiza la bitácora REAL con los datos que hoy tiene el venue de producción
 * (los `PERMISSION_DENIED` de la captura del founder) y vuelca el HTML a disco,
 * para poder MIRAR la pantalla sin iniciar sesión ni backend.
 *
 * Usa los textos reales de `locales/es/organization.json`, así que una llave sin
 * traducir sale cruda y se nota — que es la mitad de lo que se está arreglando.
 *
 * APAGADO por defecto. Se enciende así:
 *
 *   VISTA_PREVIA=1 npx vitest run src/pages/Venue/activity-log/__tests__/render-preview.test.tsx
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import fs from 'fs'
import path from 'path'
import { describe, expect, it, vi } from 'vitest'

import es from '@/locales/es/organization.json'
import VenueActivityLog from '@/pages/Venue/VenueActivityLog'

vi.mock('@/services/venueActivity.service', () => ({
  getVenueActivityLog: vi.fn(),
  getVenueActivityLogActions: vi.fn(),
}))
vi.mock('@/services/team.service', () => ({ teamService: { getTeamMembers: vi.fn() } }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/x' }) }))
vi.mock('@/components/billing/FeatureGate', () => ({ FeatureGate: ({ children }: any) => children }))
vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({
    venueTimezone: 'America/Mexico_City',
    formatDateTime: (d: string) => new Date(d).toISOString().replace('T', ' ').slice(0, 16),
    formatTime: (d: string) => new Date(d).toISOString().slice(11, 16),
    formatDate: (d: string) => new Date(d).toISOString().slice(0, 10),
    formatCalendarDate: (d: string) => {
      const [y, m, dd] = d.split('-')
      const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
      return `${dd} ${meses[Number(m) - 1]} ${y}`
    },
  }),
}))

// `t` REAL contra el español: una llave que faltara saldría cruda en la vista previa.
function traducir(llave: string, opts?: Record<string, unknown>): string {
  const valor = llave.split('.').reduce<any>((o, k) => (o == null ? o : o[k]), es as any)
  if (typeof valor !== 'string') return (opts?.defaultValue as string) ?? llave
  return valor.replace(/\{\{(\w+)\}\}/g, (_m, v) => String(opts?.[v] ?? `{{${v}}}`))
}
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: traducir, i18n: { language: 'es' } }) }))

import { getVenueActivityLog, getVenueActivityLogActions } from '@/services/venueActivity.service'
import { teamService } from '@/services/team.service'

/** Datos calcados de lo que el MCP devolvió para este venue. */
const LOGS = [
  {
    id: '1',
    action: 'STAFF_LOGIN',
    entity: 'Staff',
    entityId: 'cmsnhhl8q000029c9b8uo5hew',
    data: { role: 'SUPERADMIN', method: 'google', source: 'dashboard' },
    ipAddress: '189.203.1.1',
    createdAt: '2026-08-31T21:50:35.455Z',
    staff: { id: 's1', firstName: 'Daniel', lastName: 'Aguirre' },
    venueName: 'Testarudo Cafe',
  },
  {
    id: '2',
    action: 'DEVICE_REGISTERED',
    entity: 'Terminal',
    entityId: 'cmthpw8k70856ku2bs8yyl3wa',
    data: { name: 'OnePlus8Pro (6)', brand: 'OnePlus', model: 'OnePlus8Pro', platform: 'ANDROID', formFactor: 'PHONE' },
    ipAddress: null,
    createdAt: '2026-08-31T20:55:17.438Z',
    staff: { id: 's2', firstName: 'Manager', lastName: 'Venue 1' },
    venueName: 'Testarudo Cafe',
  },
  {
    id: '3',
    action: 'ORDER_COMPED',
    entity: 'Order',
    entityId: 'cmthpw8k70856ku2bs8yyl3ab',
    data: { amount: 235.5, reason: 'Cliente frecuente' },
    ipAddress: null,
    createdAt: '2026-08-31T19:12:00.000Z',
    staff: { id: 's2', firstName: 'Manager', lastName: 'Venue 1' },
    venueName: 'Testarudo Cafe',
  },
  {
    id: '4',
    action: 'PERMISSION_DENIED',
    entity: 'permission',
    entityId: 'billing:subscriptions:read',
    data: {
      path: '/api/v1/dashboard/venues/cmhvejgq300ad2gtxbrawgh7w/features',
      method: 'GET',
      userRole: 'WAITER',
      permission: 'billing:subscriptions:read',
      roleSource: 'staffVenue',
      hasPermissionSet: false,
    },
    ipAddress: '189.203.1.9',
    createdAt: '2026-08-30T23:53:16.646Z',
    staff: { id: 's3', firstName: 'Waiter', lastName: 'Avoqado' },
    venueName: 'Testarudo Cafe',
  },
  {
    id: '5',
    action: 'PERMISSION_DENIED',
    entity: 'permission',
    entityId: 'settlements:read',
    data: { path: '/api/v1/…/settlement-calendar', method: 'GET', userRole: 'WAITER', permission: 'settlements:read' },
    ipAddress: '189.203.1.9',
    createdAt: '2026-08-30T23:53:16.672Z',
    staff: { id: 's3', firstName: 'Waiter', lastName: 'Avoqado' },
    venueName: 'Testarudo Cafe',
  },
  {
    id: '6',
    action: 'PRODUCT_DELETED',
    entity: 'Product',
    entityId: 'cmt9y0aaa0001ku2bxxxxxxx1',
    data: { name: 'Latte grande', password: 'no-deberia-verse' },
    ipAddress: null,
    createdAt: '2026-08-30T18:02:00.000Z',
    staff: null,
    venueName: 'Testarudo Cafe',
  },
  {
    id: '7',
    action: 'UNA_ACCION_QUE_EL_FRONT_NO_CONOCE',
    entity: 'PurchaseOrder',
    entityId: 'OC-2026-0148',
    data: null,
    ipAddress: null,
    createdAt: '2026-08-29T10:00:00.000Z',
    staff: { id: 's4', firstName: 'Main', lastName: 'Owner' },
    venueName: 'Testarudo Cafe',
  },
]

const SALIDA = '/tmp/vista-previa-bitacora'
const ENCENDIDA = process.env.VISTA_PREVIA === '1'

describe.skipIf(!ENCENDIDA)('vista previa de la bitácora', () => {
  it('vuelca el HTML de la pantalla', async () => {
    fs.mkdirSync(SALIDA, { recursive: true })

    vi.mocked(getVenueActivityLog).mockResolvedValue({
      logs: LOGS as any,
      pagination: { page: 1, pageSize: 25, total: 122, totalPages: 5 },
    })
    vi.mocked(getVenueActivityLogActions).mockResolvedValue([
      'PERMISSION_DENIED',
      'STAFF_LOGIN',
      'DEVICE_REGISTERED',
      'ORDER_COMPED',
      'PRODUCT_DELETED',
    ])
    vi.mocked(teamService.getTeamMembers).mockResolvedValue({
      data: [
        { staffId: 's1', firstName: 'Daniel', lastName: 'Aguirre' },
        { staffId: 's3', firstName: 'Waiter', lastName: 'Avoqado' },
      ],
    } as any)

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const vista = render(
      <QueryClientProvider client={client}>
        <VenueActivityLog />
      </QueryClientProvider>,
    )

    // Esperar a que la consulta RESUELVA, no sólo a que el nodo exista.
    try {
      await screen.findAllByText('Permiso denegado', {}, { timeout: 4000 })
    } catch {
      // Volcar igual: un HTML incompleto dice más que un error de timeout.
      fs.writeFileSync(path.join(SALIDA, 'bitacora-INCOMPLETA.html'), vista.container.innerHTML)
      throw new Error('la lista no renderizó — revisar /tmp/vista-previa-bitacora/bitacora-INCOMPLETA.html')
    }

    const html = vista.container.innerHTML
    fs.writeFileSync(path.join(SALIDA, 'bitacora.html'), html)

    // Y con una fila ABIERTA: el detalle es la otra mitad del arreglo (antes
    // era JSON crudo en inglés) y no se ve sin hacer clic.
    fireEvent.click(screen.getAllByText('Permiso denegado')[0])
    fs.writeFileSync(path.join(SALIDA, 'bitacora-expandida.html'), vista.container.innerHTML)

    expect(html.length).toBeGreaterThan(1000)
    // Lo que no puede aparecer nunca en pantalla:
    expect(html).not.toContain('PERMISSION DENIED')
    expect(html).not.toContain('#settleme')
    expect(html).not.toContain('no-deberia-verse')
  })
})
