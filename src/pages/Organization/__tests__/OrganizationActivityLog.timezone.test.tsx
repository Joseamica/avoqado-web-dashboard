/**
 * La bitácora de auditoría de la ORGANIZACIÓN pinta las horas en la zona del
 * NEGOCIO, nunca en la del navegador (regla crítica #4 del repo).
 *
 * El defecto que originó estas pruebas: la fila formateaba con date-fns sobre un
 * `new Date(...)`, que usa la zona del SISTEMA. Abierta desde otro huso, la
 * bitácora mostraba todas las horas corridas — en una pantalla cuyo valor entero
 * es «a qué hora pasó esto».
 *
 * 🔴 El contraste NO depende de la zona de la máquina que corre las pruebas.
 * Fijar `TZ` por fuera haría que la prueba pasara en verde en cualquier Mac ya
 * configurada en México sin ejercitar nada. En su lugar se elige una zona de
 * negocio (UTC+14) que no puede coincidir con la de ningún equipo del equipo, y
 * se COMPRUEBA que difiere antes de afirmar nada.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { DateTime } from 'luxon'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import es from '@/locales/es/organization.json'

/** Zona del negocio en la prueba: UTC+14, sin horario de verano. */
const ZONA_DEL_NEGOCIO = 'Pacific/Kiritimati'
/** 31-ago 21:50 UTC → 1-sep 11:50 en el negocio: cambia la hora Y el día. */
const INSTANTE = '2026-08-31T21:50:35.455Z'

const LOG = {
  id: 'log-1',
  action: 'STAFF_LOGIN',
  entity: 'Staff',
  entityId: 'cmsnhhl8q000029c9b8uo5hew',
  data: null,
  ipAddress: '189.203.1.1',
  createdAt: INSTANTE,
  staff: { id: 's1', firstName: 'Daniel', lastName: 'Aguirre' },
  venueName: 'Testarudo Cafe',
}

vi.mock('@/services/organizationDashboard.service', () => ({
  getOrgActivityLog: vi.fn(),
  getOrgActivityLogActions: vi.fn(),
}))
vi.mock('@/services/organization.service', () => ({ getOrganizationVenues: vi.fn() }))
vi.mock('react-router-dom', () => ({ useParams: () => ({ orgId: 'org-1' }) }))

// El venue activo es lo ÚNICO que decide la zona; `useVenueDateTime` la lee de aquí.
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ activeVenue: { id: 'v1', timezone: ZONA_DEL_NEGOCIO } }),
}))

// `t` REAL contra el español: una llave que faltara saldría cruda y se notaría.
function traducir(llave: string, opts?: Record<string, unknown>): string {
  const valor = llave.split('.').reduce<any>((o, k) => (o == null ? o : o[k]), es as any)
  if (typeof valor !== 'string') return (opts?.defaultValue as string) ?? llave
  return valor.replace(/\{\{(\w+)\}\}/g, (_m, v) => String(opts?.[v] ?? `{{${v}}}`))
}
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: traducir, i18n: { language: 'es' } }) }))

import { getOrgActivityLog, getOrgActivityLogActions } from '@/services/organizationDashboard.service'
import { getOrganizationVenues } from '@/services/organization.service'
import OrganizationActivityLog from '@/pages/Organization/OrganizationActivityLog'

/** Cómo se leería el instante en una zona dada, con el mismo idioma que la app. */
const enZona = (zona: string) =>
  DateTime.fromISO(INSTANTE, { zone: 'utc' }).setZone(zona).setLocale('es-MX').toLocaleString(DateTime.DATETIME_MED)

const abreviaturaDe = (zona: string) => DateTime.now().setZone(zona).toFormat('ZZZZ')

const zonaDelSistema = Intl.DateTimeFormat().resolvedOptions().timeZone

function pintar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <OrganizationActivityLog />
    </QueryClientProvider>,
  )
}

describe('OrganizationActivityLog · zona horaria', () => {
  beforeEach(() => {
    vi.mocked(getOrgActivityLog).mockResolvedValue({
      logs: [LOG] as any,
      pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
    })
    vi.mocked(getOrgActivityLogActions).mockResolvedValue([])
    vi.mocked(getOrganizationVenues).mockResolvedValue([])
  })

  it('el contraste de la prueba es real: la zona del negocio no es la de la máquina', () => {
    // Sin esto, todo lo de abajo podría pasar sin ejercitar nada.
    expect(zonaDelSistema).not.toBe(ZONA_DEL_NEGOCIO)
    expect(enZona(ZONA_DEL_NEGOCIO)).not.toBe(enZona(zonaDelSistema))
  })

  it('pinta la hora en la zona del NEGOCIO, no en la del navegador', async () => {
    pintar()

    const celda = await screen.findByText(enZona(ZONA_DEL_NEGOCIO))
    expect(celda).toBeInTheDocument()

    // Y la del navegador no aparece por ningún lado: es el defecto que se arregló.
    expect(screen.queryByText(enZona(zonaDelSistema))).not.toBeInTheDocument()
  })

  it('DECLARA en la columna en qué zona está mostrando las horas', async () => {
    pintar()

    // Sin esto el usuario no puede saber que una sucursal de otro huso se está
    // pintando en una zona ajena: la pantalla estaría mintiendo por omisión.
    expect(await screen.findByText(`(${abreviaturaDe(ZONA_DEL_NEGOCIO)})`)).toBeInTheDocument()
    expect(abreviaturaDe(ZONA_DEL_NEGOCIO)).not.toBe(abreviaturaDe(zonaDelSistema))
  })
})
