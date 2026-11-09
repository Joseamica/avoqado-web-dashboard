/**
 * Pantalla «Celulares de promotores»: estados de la fila, montaje en la sucursal y en la organización, «Generar código» (y su
 * doble clic), WhatsApp, «Desvincular» con confirmación y los estados de carga que no deben confundirse.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import commonEs from '@/locales/es/common.json'
import organizationEs from '@/locales/es/organization.json'
import type { CelularesDeCampo, CodigosGenerados, FilaDePromotor, RetenidoDeCampo } from '@/services/celularesDeCampo.service'

// `mockReset: true` borra los vi.fn() entre pruebas: el estado vive en variables y las fábricas son funciones planas.
type Llamada = unknown[]
let respuestaLista: () => Promise<CelularesDeCampo> = () => Promise.resolve(listaCon([]))
let respuestaGenerar: () => Promise<CodigosGenerados> = () => Promise.resolve({ generados: [], omitidos: [], restantes: 0 })
let llamadasLista: Llamada[] = []
let llamadasGenerar: Llamada[] = []
let llamadasDesvincular: Llamada[] = []
let llamadasPinOrg: Llamada[] = []
let llamadasPinSucursal: Llamada[] = []
let llamadasResolver: Llamada[] = []
let respuestaRetenidos: () => Promise<{ items: RetenidoDeCampo[]; total: number }> = () => Promise.resolve({ items: [], total: 0 })
let respuestaResolver: () => Promise<unknown> = () => Promise.resolve({ estado: 'APLICADO', repetida: false })
let toasts: { title?: string; description?: string }[] = []
let venueActual: { id: string } | undefined

vi.mock('@/services/celularesDeCampo.service', () => ({
  getCelularesDeCampo: (...a: Llamada) => {
    llamadasLista.push(a)
    return respuestaLista()
  },
  generarCodigosDeCelular: (...a: Llamada) => {
    llamadasGenerar.push(a)
    return respuestaGenerar()
  },
  desvincularCelularDeCampo: (...a: Llamada) => {
    llamadasDesvincular.push(a)
    return Promise.resolve({ desvinculadoAt: '', graciaHasta: '', porSubir: 0, huellasReportadas: 0, yaEstaba: false })
  },
  getRetenidosDeCampo: () => respuestaRetenidos(),
  resolverRetenidoDeCampo: (...a: Llamada) => {
    llamadasResolver.push(a)
    return respuestaResolver()
  },
}))

vi.mock('@/services/organizationConfig.service', () => ({
  updateOrgTeamMemberPin: (...a: Llamada) => {
    llamadasPinOrg.push(a)
    return Promise.resolve({})
  },
}))

vi.mock('@/services/team.service', () => ({
  teamService: {
    updateTeamMember: (...a: Llamada) => {
      llamadasPinSucursal.push(a)
      return Promise.resolve({})
    },
  },
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ allVenues: [{ id: 'v1', name: 'Sucursal Norte', organizationId: 'o1' }] }),
}))

vi.mock('@/hooks/use-current-organization', () => ({
  useCurrentOrganization: () => ({ orgId: 'o1' }),
}))

vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venue: venueActual }),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: (t: { title?: string; description?: string }) => void toasts.push(t) }),
}))

vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({ formatDate: (v: string) => `F:${v.slice(0, 10)}`, formatDateTime: (v: string) => `FH:${v}` }),
}))

// Los textos salen de los archivos de idioma reales: la prueba ve lo mismo que el usuario.
vi.mock('react-i18next', () => ({
  useTranslation: (ns?: string) => {
    const archivo = (ns === 'common' ? commonEs : organizationEs) as Record<string, unknown>
    return {
      t: (clave: string | string[], opts?: Record<string, unknown>) => {
        const key = Array.isArray(clave) ? clave[0] : clave
        const texto = key.split('.').reduce<unknown>((acc, k) => (acc as Record<string, unknown> | undefined)?.[k], archivo)
        const base = typeof texto === 'string' ? texto : ((opts?.defaultValue as string | undefined) ?? key)
        return base.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(opts?.[k] ?? ''))
      },
      i18n: { language: 'es' },
    }
  },
}))

import CelularesDePromotores, { CelularesDePromotoresVista } from '../CelularesDePromotores'
import { rechazoDeAplicar } from '../ayudantes'
import { PorRevisarModal } from '../components/PorRevisarModal'

// ─── Datos ─────────────────────────────────────────────────────

const EN_7_DIAS = '2026-11-16T12:00:00.000Z'

function fila(extra: Partial<FilaDePromotor> & Pick<FilaDePromotor, 'staffId' | 'nombre' | 'estado'>): FilaDePromotor {
  return {
    telefono: null,
    sucursales: [{ venueId: 'v1', staffVenueId: 'sv-' + extra.staffId, nombre: 'Sucursal Norte', tienePin: false }],
    codigo: null,
    celular: null,
    ultimaChecada: null,
    porRevisar: 0,
    ...extra,
  }
}

function listaCon(items: FilaDePromotor[], extra: Partial<CelularesDeCampo> = {}): CelularesDeCampo {
  return {
    disponible: true,
    items,
    total: items.length,
    conteos: { SIN_CELULAR: 1, CODIGO_SIN_USAR: 1, ACTIVO: 1 },
    porRevisar: 0,
    ...extra,
  }
}

const sinCelular = fila({ staffId: 's1', nombre: 'Ana Sin Celular', estado: 'SIN_CELULAR', telefono: '5512345678' })
const conCodigo = fila({
  staffId: 's2',
  nombre: 'Beto Con Codigo',
  estado: 'CODIGO_SIN_USAR',
  telefono: '5512345678',
  codigo: { codigo: 'AB12CD34', expiraAt: EN_7_DIAS },
})
const activo = fila({
  staffId: 's3',
  nombre: 'Carla Activa',
  estado: 'ACTIVO',
  celular: {
    id: 'cel1',
    marca: 'Samsung',
    modelo: 'A15',
    versionApp: '1.0.0',
    activadoAt: '2026-11-01T12:00:00.000Z',
    vistoAt: new Date().toISOString(),
    porSubir: 4,
  },
  ultimaChecada: { at: new Date().toISOString(), conUbicacion: true, venueId: 'v1' },
})

function conProveedores(ui: ReactNode, ruta = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 10 } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/" element={ui} />
          <Route path="/venues/:slug/playtelecom/celulares-de-promotores" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const filaDe = (nombre: string) => screen.getByText(nombre).closest('tr') as HTMLElement

beforeEach(() => {
  llamadasLista = []
  llamadasGenerar = []
  llamadasDesvincular = []
  llamadasPinOrg = []
  llamadasPinSucursal = []
  llamadasResolver = []
  toasts = []
  respuestaRetenidos = () => Promise.resolve({ items: [], total: 0 })
  respuestaResolver = () => Promise.resolve({ estado: 'APLICADO', repetida: false })
  venueActual = { id: 'v1' }
  respuestaLista = () => Promise.resolve(listaCon([sinCelular, conCodigo, activo]))
  respuestaGenerar = () => Promise.resolve({ generados: [], omitidos: [], restantes: 0 })
})

afterEach(() => vi.restoreAllMocks())

// ─── Tests ─────────────────────────────────────────────────────

describe('CelularesDePromotores', () => {
  it('cada estado de la fila dice su texto exacto', async () => {
    conProveedores(<CelularesDePromotoresVista orgId="o1" />)
    await screen.findByText('Ana Sin Celular')

    const a = within(filaDe('Ana Sin Celular'))
    expect(a.getByText('Sin celular')).toBeInTheDocument()
    expect(a.getByRole('button', { name: 'Generar código' })).toBeInTheDocument()
    expect(a.queryByRole('button', { name: 'Desvincular' })).not.toBeInTheDocument()

    const b = within(filaDe('Beto Con Codigo'))
    expect(b.getByText('Código sin usar · vence F:2026-11-16')).toBeInTheDocument()
    expect(b.getByRole('button', { name: 'Copiar' })).toBeInTheDocument()
    expect(b.getByRole('button', { name: 'Mandar por WhatsApp' })).toBeInTheDocument()
    expect(b.getByRole('button', { name: 'Generar otro' })).toBeInTheDocument()

    const c = within(filaDe('Carla Activa'))
    expect(c.getByText('Activado · Samsung A15')).toBeInTheDocument()
    expect(c.getByText(/^Visto /)).toBeInTheDocument()
    expect(c.getByText('Checó con ubicación')).toBeInTheDocument()
    expect(c.getByText('Por subir: 4')).toBeInTheDocument()
    expect(c.getByRole('button', { name: 'Desvincular' })).toBeInTheDocument()
  })

  it('un celular activado sin marca ni modelo dice sólo «Activado»', async () => {
    const sinModelo = fila({ ...activo, celular: { ...activo.celular!, marca: null, modelo: null } })
    respuestaLista = () => Promise.resolve(listaCon([sinModelo]))
    conProveedores(<CelularesDePromotoresVista orgId="o1" />)
    await screen.findByText('Carla Activa')
    expect(within(filaDe('Carla Activa')).getByText('Activado')).toBeInTheDocument()
  })

  it('montada en la sucursal arranca filtrada a ella y el PIN usa el equipo de la sucursal', async () => {
    conProveedores(<CelularesDePromotoresVista orgId="o1" venueIdInicial="v1" />)
    await screen.findByText('Ana Sin Celular')
    expect(llamadasLista[0]).toEqual(['o1', expect.objectContaining({ venueId: 'v1' })])
    expect(screen.getByRole('button', { name: /Sucursal Norte/ })).toBeInTheDocument() // el filtro de sucursal ya la trae puesta

    fireEvent.click(within(filaDe('Ana Sin Celular')).getByRole('button', { name: 'Poner PIN' }))
    fireEvent.change(await screen.findByLabelText('PIN de 4 a 6 dígitos'), { target: { value: '1234' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar PIN' }))

    await waitFor(() => expect(llamadasPinSucursal).toEqual([['v1', 'sv-s1', { pin: '1234' }]]))
    expect(llamadasPinOrg).toHaveLength(0)
  })

  it('el montaje de la sucursal (default export) toma la sucursal de la ruta', async () => {
    conProveedores(<CelularesDePromotores />, '/venues/norte/playtelecom/celulares-de-promotores')
    await screen.findByText('Ana Sin Celular')
    expect(llamadasLista[0]).toEqual(['o1', expect.objectContaining({ venueId: 'v1' })])
  })

  it('montada en la organización no filtra y el PIN usa la ruta de la organización', async () => {
    conProveedores(<CelularesDePromotoresVista orgId="o1" />)
    await screen.findByText('Ana Sin Celular')
    expect((llamadasLista[0][1] as { venueId?: string }).venueId).toBeUndefined()

    fireEvent.click(within(filaDe('Ana Sin Celular')).getByRole('button', { name: 'Poner PIN' }))
    fireEvent.change(await screen.findByLabelText('PIN de 4 a 6 dígitos'), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar PIN' }))

    await waitFor(() => expect(llamadasPinOrg).toEqual([['o1', 's1', '123456']]))
    expect(llamadasPinSucursal).toHaveLength(0)
  })

  it('«Generar código» llama con { staffIds: [id] } y enseña el código', async () => {
    respuestaGenerar = () =>
      Promise.resolve({
        generados: [{ staffId: 's1', nombre: 'Ana Sin Celular', telefono: '5512345678', codigo: 'ZZ99YY88', expiraAt: EN_7_DIAS }],
        omitidos: [],
        restantes: 0,
      })
    conProveedores(<CelularesDePromotoresVista orgId="o1" />)
    await screen.findByText('Ana Sin Celular')

    fireEvent.click(within(filaDe('Ana Sin Celular')).getByRole('button', { name: 'Generar código' }))

    expect(await screen.findByTestId('codigo-de-celular')).toHaveTextContent('ZZ99YY88')
    expect(llamadasGenerar).toEqual([['o1', { staffIds: ['s1'] }]])
  })

  it('doble clic en «Generar código» manda UNA sola llamada', async () => {
    let soltar: (v: CodigosGenerados) => void = () => undefined
    respuestaGenerar = () => new Promise<CodigosGenerados>(r => (soltar = r))
    conProveedores(<CelularesDePromotoresVista orgId="o1" />)
    await screen.findByText('Ana Sin Celular')
    const boton = within(filaDe('Ana Sin Celular')).getByRole('button', { name: 'Generar código' })

    // Dos clics en el mismo instante: el servicio sale en un microtask, así que se espera a que salga y luego a que no salga otro.
    await act(async () => {
      boton.click()
      boton.click()
    })
    await waitFor(() => expect(llamadasGenerar).toHaveLength(1))
    await act(async () => new Promise(r => setTimeout(r, 50)))
    expect(llamadasGenerar).toHaveLength(1)
    await act(async () => soltar({ generados: [], omitidos: [], restantes: 0 }))
  })

  it('el enlace de WhatsApp con teléfono 5512345678 es https://wa.me/525512345678?text=…', async () => {
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null)
    conProveedores(<CelularesDePromotoresVista orgId="o1" />)
    await screen.findByText('Beto Con Codigo')

    fireEvent.click(within(filaDe('Beto Con Codigo')).getByRole('button', { name: 'Mandar por WhatsApp' }))

    expect(abrir).toHaveBeenCalledTimes(1)
    const [url, destino, rasgos] = abrir.mock.calls[0]
    expect(String(url).startsWith('https://wa.me/525512345678?text=')).toBe(true)
    expect(decodeURIComponent(String(url).split('text=')[1])).toBe(
      'Hola Beto Con Codigo, tu código para activar la app de campo de Avoqado es AB12CD34. Vence el F:2026-11-16. Escríbelo en la app junto con tu PIN.',
    )
    expect(destino).toBe('_blank')
    expect(rasgos).toBe('noopener,noreferrer')
  })

  it('«Desvincular» pide confirmación y no llama hasta confirmar', async () => {
    conProveedores(<CelularesDePromotoresVista orgId="o1" />)
    await screen.findByText('Carla Activa')

    fireEvent.click(within(filaDe('Carla Activa')).getByRole('button', { name: 'Desvincular' }))

    const dialogo = await screen.findByRole('alertdialog')
    expect(within(dialogo).getByText(/¿Desvincular el celular de Carla Activa\?.*por subir \(4\)/)).toBeInTheDocument()
    expect(llamadasDesvincular).toHaveLength(0)

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Desvincular' }))
    await waitFor(() => expect(llamadasDesvincular).toEqual([['o1', 'cel1', { perdidoORobado: false }]]))
  })

  it('«Lo perdió o se lo robaron» manda perdidoORobado: true y avisa que nada se acepta solo', async () => {
    conProveedores(<CelularesDePromotoresVista orgId="o1" />)
    await screen.findByText('Carla Activa')
    fireEvent.click(within(filaDe('Carla Activa')).getByRole('button', { name: 'Desvincular' }))

    const dialogo = await screen.findByRole('alertdialog')
    expect(within(dialogo).getByText(/se acepta durante 24 horas/)).toBeInTheDocument()
    fireEvent.click(within(dialogo).getByRole('checkbox', { name: /Lo perdió o se lo robaron/ }))
    expect(within(dialogo).getByText('Todo lo que llegue de ese celular queda en «Por revisar».')).toBeInTheDocument()
    expect(within(dialogo).queryByText(/se acepta durante 24 horas/)).not.toBeInTheDocument()

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Desvincular' }))
    await waitFor(() => expect(llamadasDesvincular).toEqual([['o1', 'cel1', { perdidoORobado: true }]]))
  })

  it('montada en una sucursal, quien no la tiene no muestra «Poner PIN»', async () => {
    const otraSucursal = fila({
      staffId: 's9',
      nombre: 'Dani Otra Sucursal',
      estado: 'SIN_CELULAR',
      sucursales: [{ venueId: 'v2', staffVenueId: 'sv-s9', nombre: 'Sucursal Sur', tienePin: false }],
    })
    respuestaLista = () => Promise.resolve(listaCon([sinCelular, otraSucursal]))
    conProveedores(<CelularesDePromotoresVista orgId="o1" venueIdInicial="v1" />)
    await screen.findByText('Dani Otra Sucursal')
    expect(within(filaDe('Ana Sin Celular')).getByRole('button', { name: 'Poner PIN' })).toBeInTheDocument()
    expect(within(filaDe('Dani Otra Sucursal')).queryByRole('button', { name: /PIN/ })).not.toBeInTheDocument()
  })

  describe('«Por revisar»: un 422 NO_SE_PUDO_APLICAR dice su razón', () => {
    const retenido: RetenidoDeCampo = {
      id: 'r1',
      staffId: 's3',
      nombre: 'Carla Activa',
      venueId: 'v1',
      sucursal: 'Sucursal Norte',
      tipo: 'VENTA',
      motivo: 'CELULAR_PERDIDO',
      rechazo: null,
      resumen: '1 SIM',
      createdAt: '2026-11-01T12:00:00.000Z',
      estado: 'PENDIENTE',
    }
    const error422 = (cuerpo: Record<string, unknown>, anidado = false) => ({
      response: {
        status: 422,
        data: {
          message: 'No se pudo aplicar. Revisa el motivo y vuelve a intentar.',
          code: 'NO_SE_PUDO_APLICAR',
          ...(anidado ? { details: cuerpo } : cuerpo),
        },
      },
    })

    it('el motivo CELULAR_PERDIDO sale en llano', async () => {
      respuestaRetenidos = () => Promise.resolve({ items: [retenido], total: 1 })
      conProveedores(<PorRevisarModal orgId="o1" open onClose={() => undefined} />)
      expect(await screen.findByText('El celular se reportó perdido o robado')).toBeInTheDocument()
    })

    it('PERSONA_SIN_ASIGNACION enseña el rechazo y «Reactívala en esa sucursal o descártalo.»', async () => {
      respuestaRetenidos = () => Promise.resolve({ items: [retenido], total: 1 })
      respuestaResolver = () =>
        Promise.reject(
          error422({ rechazo: { code: 'PERSONA_SIN_ASIGNACION', message: 'La persona ya no tiene asignación activa en esa sucursal.' } }),
        )
      conProveedores(<PorRevisarModal orgId="o1" open onClose={() => undefined} />)
      fireEvent.click(await screen.findByRole('button', { name: 'Aplicar' }))
      await waitFor(() => expect(toasts).toHaveLength(1))
      expect(toasts[0].description).toBe(
        'La persona ya no tiene asignación activa en esa sucursal. Reactívala en esa sucursal o descártalo.',
      )
    })

    it('rechazoDeAplicar: otro rechazo trae sólo su mensaje; otro código no aplica', () => {
      expect(rechazoDeAplicar(error422({ rechazo: { code: 'X', message: 'Ya está vendida.' } }))).toEqual({
        message: 'Ya está vendida.',
        sinAsignacion: false,
      })
      expect(rechazoDeAplicar(error422({ motivo: 'PERSONA_SIN_ASIGNACION' }))?.sinAsignacion).toBe(true)
      expect(rechazoDeAplicar(error422({ motivo: 'PERSONA_SIN_ASIGNACION' }, true))?.sinAsignacion).toBe(true) // anidado en details
      expect(rechazoDeAplicar({ response: { data: { code: 'RETENIDO_EN_PROCESO', message: 'm' } } })).toBeNull()
    })
  })

  describe('los cuatro estados de carga se distinguen', () => {
    it('cargando: esqueleto, sin aviso ni «vacío»', () => {
      respuestaLista = () => new Promise(() => undefined)
      conProveedores(<CelularesDePromotoresVista orgId="o1" />)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.queryByText('Todavía no hay promotores')).not.toBeInTheDocument()
      expect(screen.queryByText('Nadie coincide con los filtros')).not.toBeInTheDocument()
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
    })

    it('error: aviso de que no cargó, nunca «no hay promotores»', async () => {
      respuestaLista = () => Promise.reject(new Error('red'))
      conProveedores(<CelularesDePromotoresVista orgId="o1" />)
      expect(await screen.findByRole('alert', {}, { timeout: 5000 })).toHaveTextContent(commonEs.loadFailure.empty)
      expect(screen.queryByText('Todavía no hay promotores')).not.toBeInTheDocument()
    })

    it('vacío: sin promotores y sin filtros', async () => {
      respuestaLista = () => Promise.resolve(listaCon([], { conteos: { SIN_CELULAR: 0, CODIGO_SIN_USAR: 0, ACTIVO: 0 } }))
      conProveedores(<CelularesDePromotoresVista orgId="o1" />)
      expect(await screen.findByText('Todavía no hay promotores')).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.queryByText('Nadie coincide con los filtros')).not.toBeInTheDocument()
    })

    it('sin resultados: con una búsqueda puesta y su «Quitar filtros»', async () => {
      conProveedores(<CelularesDePromotoresVista orgId="o1" />)
      await screen.findByText('Ana Sin Celular')
      respuestaLista = () => Promise.resolve(listaCon([], { conteos: { SIN_CELULAR: 0, CODIGO_SIN_USAR: 0, ACTIVO: 0 } }))
      fireEvent.click(screen.getByRole('button', { name: 'Buscar promotor' }))
      fireEvent.change(await screen.findByPlaceholderText('Buscar promotor'), { target: { value: 'zzz' } })
      expect(await screen.findByText('Nadie coincide con los filtros')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Quitar filtros' })).toBeInTheDocument()
      expect(screen.queryByText('Todavía no hay promotores')).not.toBeInTheDocument()
    })

    it('sucursal sin promotores, sin otro filtro: «Todavía no hay promotores en esta sucursal»', async () => {
      respuestaLista = () => Promise.resolve(listaCon([], { conteos: { SIN_CELULAR: 0, CODIGO_SIN_USAR: 0, ACTIVO: 0 } }))
      conProveedores(<CelularesDePromotoresVista orgId="o1" venueIdInicial="v1" />)
      expect(await screen.findByText('Todavía no hay promotores en esta sucursal')).toBeInTheDocument()
      expect(screen.queryByText('Nadie coincide con los filtros')).not.toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('sin inventario serializado: lo explica', async () => {
      respuestaLista = () => Promise.resolve(listaCon([], { disponible: false }))
      conProveedores(<CelularesDePromotoresVista orgId="o1" />)
      expect(await screen.findByText(organizationEs.celulares.noDisponible)).toBeInTheDocument()
    })
  })
})
