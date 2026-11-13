/**
 * La bitácora de la ORGANIZACIÓN nombra y colorea cada acción igual que la del negocio (hz:8024bc1c:D32).
 *
 * Antes tenía su propio mapa fijo de ~24 colores y su propio texto de respaldo: una acción sin texto salía como su
 * código a gritos («TABLE OPENED») y los avisos que el dueño debe revisar (ámbar en el negocio, como una venta sin
 * internet que no se registró) salían grises.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import es from '@/locales/es/organization.json'
import { actionTone } from '@/pages/Venue/activity-log/formatActivity'

const fila = (id: string, action: string) => ({
  id,
  action,
  entity: null,
  entityId: null,
  data: null,
  ipAddress: null,
  createdAt: '2026-11-12T18:00:00.000Z',
  staff: null,
  venueName: 'Testarudo Cafe',
})

vi.mock('@/services/organizationDashboard.service', () => ({
  getOrgActivityLog: vi.fn(),
  getOrgActivityLogActions: vi.fn(),
}))
vi.mock('@/services/organization.service', () => ({ getOrganizationVenues: vi.fn() }))
vi.mock('react-router-dom', () => ({ useParams: () => ({ orgId: 'org-1' }) }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ activeVenue: { id: 'v1', timezone: 'America/Mexico_City' } }),
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

function pintar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <OrganizationActivityLog />
    </QueryClientProvider>,
  )
}

/** Las clases del icono de la fila que dice `texto`. */
const claseDelIcono = (texto: string) => screen.getByText(texto).closest('tr')!.querySelector('svg')!.getAttribute('class') ?? ''

describe('OrganizationActivityLog · nombre y color de cada acción', () => {
  beforeEach(() => {
    vi.mocked(getOrgActivityLog).mockResolvedValue({
      logs: [
        fila('a', 'TABLE_OPENED'),
        fila('b', 'ALGO_NUEVO_DEL_SERVIDOR'),
        fila('c', 'VENTA_SIN_RED_RECHAZADA'),
        fila('d', 'COBRO_SIN_RED_CON_DIFERENCIA'),
        fila('e', 'PRODUCT_DELETED'),
      ] as any,
      pagination: { page: 1, pageSize: 25, total: 5, totalPages: 1 },
    })
    vi.mocked(getOrgActivityLogActions).mockResolvedValue([])
    vi.mocked(getOrganizationVenues).mockResolvedValue([])
  })

  it('una acción con texto se lee en español', async () => {
    pintar()
    expect(await screen.findByText('Mesa abierta')).toBeInTheDocument()
  })

  it('🔴 una acción sin texto ya no grita en MAYÚSCULAS: usa el mismo respaldo que el negocio', async () => {
    pintar()
    expect(await screen.findByText('Algo nuevo del servidor')).toBeInTheDocument()
    expect(screen.queryByText('ALGO NUEVO DEL SERVIDOR')).not.toBeInTheDocument()
  })

  it('🔴 los avisos que el dueño debe revisar salen en ámbar, como en el negocio (no grises)', async () => {
    pintar()
    await screen.findByText('Mesa abierta')
    expect(claseDelIcono('Venta sin internet no registrada')).toContain('text-amber-600')
    expect(claseDelIcono('Cobro sin internet con diferencia')).toContain('text-amber-600')
    expect(claseDelIcono(es.activityLog.actions.PRODUCT_DELETED)).toContain('text-red-600')
  })

  it('lo que este panel ya resaltaba (entrar con la clave maestra, cambiar un rol) sigue resaltado', () => {
    expect(actionTone('MASTER_LOGIN_SUCCESS')).toBe('attention')
    expect(actionTone('ROLE_CHANGED')).toBe('attention')
    // Fallido sigue rojo: la negación gana.
    expect(actionTone('MASTER_LOGIN_FAILED')).toBe('destructive')
  })
})
