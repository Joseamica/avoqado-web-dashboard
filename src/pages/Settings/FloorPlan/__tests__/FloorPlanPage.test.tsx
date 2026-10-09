import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FloorPlanSettings from '../FloorPlanPage'
import { getFloorPlan } from '@/services/floorPlan.service'
import type { FloorPlanDto } from '../model/types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, o?: Record<string, unknown>) =>
      o?.tables !== undefined ? `${key}:${o.tables}/${o.seats}` : o?.count !== undefined ? `${key}:${o.count}` : key,
  }),
}))
vi.mock('@/services/floorPlan.service', () => ({ getFloorPlan: vi.fn(), publishFloorPlan: vi.fn() }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', venue: { name: 'Testarudo Cafe' } }) }))
let permisos: string[] = []
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => permisos.includes(p) }) }))
let tienePro = true
vi.mock('@/hooks/use-tier-feature-access', () => ({ useVenueTier: () => ({ hasFeatureAccess: () => tienePro }) }))
// El cartel de pago tiene su propia prueba; aquí sólo importa lo que la página pone adentro.
vi.mock('@/components/billing/FeatureGate', () => ({ FeatureGate: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
vi.mock('../FloorPlanEditor', () => ({
  FloorPlanEditor: ({ initialAreaKey }: { initialAreaKey?: string | null }) => <div data-testid="editor-abierto" data-area={initialAreaKey ?? ''} />,
}))

const get = vi.mocked(getFloorPlan)
const LIMITS = { areas: 30, tables: 500, elements: 1500 }
const vacio: FloorPlanDto = { fingerprint: '0000000000000000', areas: [], tables: [], elements: [], limits: LIMITS, overLimit: false }
const mesa = { id: 't1', number: '1', capacity: 4, shape: 'SQUARE' as const, rotation: 0, positionX: 0.5, positionY: 0.5, areaId: 'a1', hasOpenOrder: false }
const conSalon: FloorPlanDto = {
  ...vacio,
  fingerprint: 'aaaaaaaaaaaaaaaa',
  areas: [
    { id: 'a1', name: 'Salón', floorShape: 'WIDE', sortOrder: 0, externalId: null },
    { id: 'a2', name: 'Terraza', floorShape: 'SQUARE', sortOrder: 1, externalId: 'SR-7' },
  ],
  tables: [mesa, { ...mesa, id: 't2', number: '2', capacity: 2 }, { ...mesa, id: 't3', number: '9', areaId: null, positionX: null, positionY: null }],
}

/** La prueba corre en jsdom: el setup dice «pantalla angosta»; aquí se elige. */
const matchMediaOriginal = window.matchMedia
function pantalla(ancha: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: ancha,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
}

function pintar() {
  // La consulta de la página pide `retry: 1`; sin espera entre intentos para no alargar la prueba.
  const qc = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } })
  return render(
    <QueryClientProvider client={qc}>
      <FloorPlanSettings />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  permisos = ['tables:read', 'tables:configure']
  tienePro = true
  pantalla(true)
})
afterEach(() => {
  window.matchMedia = matchMediaOriginal
})

describe('Configuración → Mesas y plano', () => {
  it('mientras carga se ve el esqueleto, no «aún no dibujas tu salón»', () => {
    get.mockReturnValue(new Promise(() => {}))
    pintar()
    expect(screen.getByTestId('floor-plan-loading')).toBeInTheDocument()
    expect(screen.queryByTestId('floor-plan-empty')).not.toBeInTheDocument()
  })

  it('🔴 si el servidor falla se DICE y se puede reintentar: nunca parece un salón vacío', async () => {
    get.mockRejectedValue(new Error('500'))
    pintar()
    expect(await screen.findByTestId('floor-plan-error')).toBeInTheDocument()
    expect(screen.queryByTestId('floor-plan-empty')).not.toBeInTheDocument()

    get.mockResolvedValue(vacio)
    await userEvent.click(screen.getByTestId('floor-plan-retry'))
    expect(await screen.findByTestId('floor-plan-empty')).toBeInTheDocument()
  })

  it('salón vacío con permiso y plan: «Arma tu salón» abre el editor', async () => {
    get.mockResolvedValue(vacio)
    pintar()
    await userEvent.click(await screen.findByTestId('floor-plan-start'))
    expect(screen.getByTestId('editor-abierto')).toBeInTheDocument()
    expect(screen.queryByTestId('floor-plan-edit-btn')).not.toBeInTheDocument()
  })

  it('en el celular el plano sólo se ve y la pantalla explica por qué', async () => {
    pantalla(false)
    get.mockResolvedValue(conSalon)
    pintar()
    expect(await screen.findByTestId('floor-plan-area-Salón')).toBeInTheDocument()
    expect(screen.getByTestId('floor-plan-narrow')).toBeInTheDocument()
    expect(screen.queryByTestId('floor-plan-edit-btn')).not.toBeInTheDocument()
  })

  it('sin «Configurar mesas y plano» ve el plano, no edita, y sabe a quién pedirlo', async () => {
    permisos = ['tables:read']
    get.mockResolvedValue(conSalon)
    pintar()
    expect(await screen.findByTestId('floor-plan-area-Salón')).toBeInTheDocument()
    expect(screen.getByTestId('floor-plan-no-permission')).toBeInTheDocument()
    expect(screen.queryByTestId('floor-plan-narrow')).not.toBeInTheDocument()
    expect(screen.queryByTestId('floor-plan-edit-btn')).not.toBeInTheDocument()
  })

  it('cada área con su miniatura, sus mesas y lugares; las mesas sin área se cuentan aparte', async () => {
    get.mockResolvedValue(conSalon)
    pintar()
    const salon = await screen.findByTestId('floor-plan-area-Salón')
    // Plural de verdad (R7): «2 mesas · 6 lugares» sale de dos llaves con `count`, no de «{{tables}} mesas».
    expect(salon).toHaveTextContent('page.areaSummary:page.tables:2/page.seats:6')
    expect(salon.querySelector('[data-testid="floor-table-1"]')).not.toBeNull()
    expect(screen.getByTestId('floor-plan-area-Terraza')).toHaveTextContent('page.fromPos')
    expect(screen.getByText('page.unplaced:1')).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('floor-plan-edit-btn'))
    expect(screen.getByTestId('editor-abierto')).toBeInTheDocument()
  })

  it('R31: una mesa con 0 personas («sin dato») cuenta como mesa pero no suma lugares', async () => {
    get.mockResolvedValue({ ...conSalon, tables: [mesa, { ...mesa, id: 't2', number: '2', capacity: 0 }] })
    pintar()
    expect(await screen.findByTestId('floor-plan-area-Salón')).toHaveTextContent('page.areaSummary:page.tables:2/page.seats:4')
  })

  it('tocar la tarjeta de un área abre el editor EN esa área; «Acomodarlas» lo abre en la primera', async () => {
    get.mockResolvedValue(conSalon)
    pintar()
    const terraza = await screen.findByTestId('floor-plan-area-Terraza')
    // M5: ninguna clase con «card» (src/theme.css:78 `.dark [class*='card']` se comería el hover en oscuro).
    expect(terraza.getAttribute('class')).not.toMatch(/card/)
    await userEvent.click(terraza)
    expect(screen.getByTestId('editor-abierto')).toHaveAttribute('data-area', 'a2')
    await userEvent.click(screen.getByRole('button', { name: 'page.unplacedAction:1' }))
    expect(screen.getByTestId('editor-abierto')).toHaveAttribute('data-area', '')
  })

  it('sin permiso para editar, la tarjeta no es un botón', async () => {
    permisos = ['tables:read']
    get.mockResolvedValue(conSalon)
    pintar()
    const salon = await screen.findByTestId('floor-plan-area-Salón')
    expect(salon.tagName).not.toBe('BUTTON')
    expect(screen.queryByRole('button', { name: /page.editAreaLabel/ })).not.toBeInTheDocument()
  })

  // Task 14: con la consulta en el modo por defecto, sin red TanStack la dejaba EN PAUSA y la página se quedaba cargando.
  it('🔴 sin red (el navegador lo sabe) no se queda cargando: dice que no pudo y ofrece Reintentar', async () => {
    get.mockRejectedValue(Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK' }))
    onlineManager.setOnline(false)
    try {
      pintar()
      expect(await screen.findByTestId('floor-plan-error')).toBeInTheDocument()
      expect(screen.queryByTestId('floor-plan-loading')).not.toBeInTheDocument()
      expect(screen.getByTestId('floor-plan-retry')).toBeInTheDocument()
      expect(get).toHaveBeenCalled()
    } finally {
      onlineManager.setOnline(true)
    }
  })

  it('un plano más grande que el editor se enseña con el aviso, pero no se abre a editar', async () => {
    get.mockResolvedValue({ ...conSalon, overLimit: true })
    pintar()
    expect(await screen.findByText('page.overLimit')).toBeInTheDocument()
    expect(screen.getByTestId('floor-plan-area-Salón')).toBeInTheDocument()
    expect(screen.queryByTestId('floor-plan-edit-btn')).not.toBeInTheDocument()
  })

  it('sin Servicio de mesas (PRO) no hay botón de editar ni de arrancar', async () => {
    tienePro = false
    get.mockResolvedValue(vacio)
    pintar()
    expect(await screen.findByTestId('floor-plan-empty')).toBeInTheDocument()
    expect(screen.queryByTestId('floor-plan-start')).not.toBeInTheDocument()
  })
})
