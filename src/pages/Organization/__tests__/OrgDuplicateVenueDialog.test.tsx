import i18n from '@/i18n'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * «Duplicar tienda» en las dos listas de tiendas del dueño de la organización: `OrganizationVenues`
 * (/organizations/:orgId/venues) y la de marca blanca `TiendasList` (/wl/organizations/:orgSlug/venues), la que usa
 * Isaac (PlayTelecom). El SERVIDOR decide; aquí se prueba lo que ve: botón sólo con el módulo prendido, botón «Crear
 * tienda» apagado hasta tener todo, el choque de número antes de enviar, un solo POST, el mensaje del servidor sin
 * cerrar, la misma llave en el reintento y, al crear, la tienda en la lista sin recargar con sus dos pendientes.
 */

vi.mock('@/components/ui/select', () => import('@/test/nativeSelectShim'))

const PLACE = {
  address: 'Av. Himno Nacional 1450, Lomas 4ª, San Luis Potosí, S.L.P., México',
  city: 'San Luis Potosí',
  state: 'San Luis Potosí',
  country: 'MX',
  zipCode: '78216',
  latitude: 22.14,
  longitude: -101.01,
  timezone: 'America/Mexico_City',
}
vi.mock('@/components/address-autocomplete', () => ({
  AddressAutocomplete: ({
    id,
    onAddressSelect,
    onTextChange,
  }: {
    id?: string
    onAddressSelect: (p: unknown) => void
    onTextChange?: (s: string) => void
  }) => (
    <div>
      <input id={id} aria-label="direccion-texto" onChange={e => onTextChange?.(e.target.value)} />
      <button type="button" onClick={() => onAddressSelect(PLACE)}>
        elegir-direccion
      </button>
      <button type="button" onClick={() => onAddressSelect({ ...PLACE, timezone: undefined })}>
        elegir-direccion-sin-zona
      </button>
    </div>
  ),
}))

const auth = {
  user: {
    id: 'isaac',
    role: 'OWNER',
    organizationId: 'org-1',
    organizationMemberships: [{ organizationId: 'org-1', role: 'OWNER' }] as { organizationId: string; role: string }[],
  },
  staffInfo: { role: 'OWNER' },
  isAuthenticated: true,
  isLoading: false,
  activeVenue: null,
  allVenues: [{ id: 'v-1', slug: 'bae-mision', organizationId: 'org-1', role: 'OWNER', organization: { id: 'org-1', slug: 'playtelecom' } }],
  getVenueBySlug: () => null,
  checkVenueAccess: () => false,
}
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }))

const listar = vi.fn()
const opciones = vi.fn()
const duplicar = vi.fn()
vi.mock('@/services/organization.service', () => ({
  getOrganizationVenues: (...a: unknown[]) => listar(...a),
  getOrganizationStats: async () => ({ id: 'org-1', name: 'PlayTelecom', venueCount: 1, staffCount: 1 }),
  getVenueDuplicationOptions: (...a: unknown[]) => opciones(...a),
  duplicateVenue: (...a: unknown[]) => duplicar(...a),
}))

import OrganizationVenues from '@/pages/Organization/OrganizationVenues'
import TiendasList from '@/pages/organizations/TiendasList/TiendasList'

const tienda = (id: string, name: string, slug: string) => ({
  id,
  name,
  slug,
  logo: null,
  address: null,
  city: 'SLP',
  state: null,
  status: 'ACTIVE',
  createdAt: '2026-11-01T00:00:00Z',
  metrics: { revenue: 0, orderCount: 0, paymentCount: 0, staffCount: 0, growth: 0 },
})
const MODELO = tienda('ckmodelo00000000000000001', 'BAE MISION SAN PEDRO (3952)', 'bae-mision')
const NUEVA = tienda('cknueva000000000000000001', 'BAE LOMAS 4 (4120)', 'bae-lomas-4-4120')
const OPCIONES = {
  enabled: true,
  templates: [{ id: MODELO.id, name: MODELO.name, city: 'SLP' }],
  supervisors: [{ staffId: 'cksuper000000000000000001', name: 'Juan Nájera' }],
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function pintar(pantalla: 'org' | 'wl') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const ruta = pantalla === 'org' ? '/organizations/org-1/venues' : '/wl/organizations/playtelecom/venues'
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/organizations/:orgId/venues" element={<OrganizationVenues />} />
          <Route path="/wl/organizations/:orgSlug/venues" element={<TiendasList />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const botonDuplicar = () => screen.findByRole('button', { name: 'Duplicar tienda' })
const crear = () => within(screen.getByRole('dialog')).getByRole('button', { name: 'Crear tienda' })

async function abrirYLlenar(user: ReturnType<typeof userEvent.setup>, nombre = 'BAE LOMAS 4 (4120)', botonDireccion = 'elegir-direccion') {
  await user.click(await botonDuplicar())
  const dialogo = await screen.findByRole('dialog')
  await user.selectOptions(within(dialogo).getByRole('combobox', { name: 'template' }), MODELO.id)
  await user.type(within(dialogo).getByLabelText('Nombre y número de la tienda nueva'), nombre)
  await user.click(within(dialogo).getByRole('button', { name: botonDireccion }))
  await user.selectOptions(within(dialogo).getByRole('combobox', { name: 'supervisor' }), OPCIONES.supervisors[0].staffId)
  return dialogo
}

beforeAll(async () => {
  await i18n.changeLanguage('es')
})

beforeEach(() => {
  vi.clearAllMocks()
  auth.user.organizationMemberships = [{ organizationId: 'org-1', role: 'OWNER' }]
  listar.mockResolvedValue([MODELO])
  opciones.mockResolvedValue(OPCIONES)
})

describe.each([
  ['org', 'OrganizationVenues', '/venues'],
  ['wl', 'TiendasList (marca blanca)', '/wl/venues'],
] as const)('«Duplicar tienda» en %s · %s', (pantalla, _nombre, base) => {
  it('con el módulo apagado no se ve el botón', async () => {
    opciones.mockResolvedValue({ enabled: false, templates: [], supervisors: [] })
    pintar(pantalla)
    expect(await screen.findByText(MODELO.name)).toBeInTheDocument()
    await waitFor(() => expect(opciones).toHaveBeenCalledWith('org-1'))
    expect(screen.queryByRole('button', { name: 'Duplicar tienda' })).toBeNull()
  })

  it('si la consulta de opciones falla no se ve el botón (nada roto a la vista)', async () => {
    opciones.mockRejectedValue({ response: { status: 403, data: { error: 'owner_required' } } })
    pintar(pantalla)
    expect(await screen.findByText(MODELO.name)).toBeInTheDocument()
    await waitFor(() => expect(opciones).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: 'Duplicar tienda' })).toBeNull()
  })

  it('🔴 al crear: cierra, la tienda aparece en ESTA lista sin recargar y salen los dos pendientes', async () => {
    const user = userEvent.setup()
    duplicar.mockResolvedValue({ venueId: NUEVA.id, slug: NUEVA.slug, name: NUEVA.name })
    pintar(pantalla)
    await abrirYLlenar(user)
    listar.mockResolvedValue([NUEVA, MODELO])
    await user.click(crear())

    expect(await screen.findByText('BAE LOMAS 4 (4120) ya está activa')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    // la lista, no el aviso: el nombre solo, en su tarjeta o renglón
    expect(await screen.findByText(NUEVA.name)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Asignar o migrar una TPV/ })).toHaveAttribute('href', `${base}/${NUEVA.slug}/devices`)
    expect(screen.getByRole('link', { name: /Dar de alta a los promotores con su PIN/ })).toHaveAttribute('href', `${base}/${NUEVA.slug}/team`)
    // «Nueva» en la fila de la tienda nueva, no en la modelo
    expect(within(screen.getByText(NUEVA.name).parentElement!).getByText('Nueva')).toBeInTheDocument()
    expect(within(screen.getByText(MODELO.name).parentElement!).queryByText('Nueva')).toBeNull()
    // el aviso se cierra; la etiqueta se queda
    await user.click(screen.getByRole('button', { name: 'Cerrar aviso' }))
    expect(screen.queryByText('BAE LOMAS 4 (4120) ya está activa')).toBeNull()
    expect(within(screen.getByText(NUEVA.name).parentElement!).getByText('Nueva')).toBeInTheDocument()
    expect(duplicar).toHaveBeenCalledWith('org-1', {
      idempotencyKey: expect.stringMatching(UUID),
      templateVenueId: MODELO.id,
      name: 'BAE LOMAS 4 (4120)',
      address: {
        address: PLACE.address,
        city: PLACE.city,
        state: PLACE.state,
        zipCode: PLACE.zipCode,
        country: PLACE.country,
        latitude: PLACE.latitude,
        longitude: PLACE.longitude,
        timezone: PLACE.timezone,
      },
      supervisorStaffId: OPCIONES.supervisors[0].staffId,
    })
  })
})

describe('el diálogo «Duplicar tienda»', () => {
  it('🔴 quien no es dueño de la ORGANIZACIÓN (sólo de una tienda) ni consulta las opciones ni ve el botón', async () => {
    auth.user.organizationMemberships = [{ organizationId: 'org-1', role: 'MEMBER' }]
    pintar('org')
    expect(await screen.findByText(MODELO.name)).toBeInTheDocument()
    expect(opciones).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Duplicar tienda' })).toBeNull()
  })

  it('la etiqueta «Dirección» queda asociada a su campo', async () => {
    const user = userEvent.setup()
    pintar('org')
    await user.click(await botonDuplicar())
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByLabelText('Dirección')).toBe(within(dialogo).getByLabelText('direccion-texto'))
  })

  it('🔴 mientras envía, ni Esc ni la X cierran la ventana', async () => {
    const user = userEvent.setup()
    duplicar.mockReturnValue(new Promise(() => {}))
    pintar('org')
    await abrirYLlenar(user)
    await user.click(crear())
    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cerrar' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('🔴 al corregir un campo tras un error del servidor, el error se borra', async () => {
    const user = userEvent.setup()
    duplicar.mockRejectedValue({ response: { status: 400, data: { message: 'Ya hay una tienda con el número 4120', code: 'VENUE_NAME_TAKEN' } } })
    pintar('org')
    const dialogo = await abrirYLlenar(user)
    await user.click(crear())
    await within(dialogo).findByText('Ya hay una tienda con ese nombre o número. Cámbialo e inténtalo de nuevo.')
    await user.type(within(dialogo).getByLabelText('Nombre y número de la tienda nueva'), '1')
    expect(within(dialogo).queryByText('Ya hay una tienda con ese nombre o número. Cámbialo e inténtalo de nuevo.')).toBeNull()
  })

  it('«Crear tienda» apagado hasta tener modelo, nombre, dirección elegida y supervisor', async () => {
    const user = userEvent.setup()
    pintar('org')
    await user.click(await botonDuplicar())
    const dialogo = await screen.findByRole('dialog')
    expect(crear()).toBeDisabled()

    await user.selectOptions(within(dialogo).getByRole('combobox', { name: 'template' }), MODELO.id)
    expect(crear()).toBeDisabled()
    await user.type(within(dialogo).getByLabelText('Nombre y número de la tienda nueva'), 'BAE LOMAS 4 (4120)')
    expect(crear()).toBeDisabled()
    await user.click(within(dialogo).getByRole('button', { name: 'elegir-direccion' }))
    expect(crear()).toBeDisabled()
    await user.selectOptions(within(dialogo).getByRole('combobox', { name: 'supervisor' }), OPCIONES.supervisors[0].staffId)
    expect(crear()).toBeEnabled()

    // escribir encima de la dirección elegida la deja sin elegir
    await user.type(within(dialogo).getByLabelText('direccion-texto'), 'x')
    expect(crear()).toBeDisabled()
  })

  it('el recuadro gris dice qué se copia de la modelo', async () => {
    const user = userEvent.setup()
    pintar('org')
    await abrirYLlenar(user)
    expect(
      screen.getByText(
        'Se copia igual de BAE MISION SAN PEDRO (3952): cobro con tarjeta, tarifa, configuración de SIMs, ajustes, y sus dueños y administradores.',
      ),
    ).toBeInTheDocument()
  })

  it('🔴 la zona horaria del autocompletado viaja en address; sin zona, la llave no va', async () => {
    const user = userEvent.setup()
    duplicar.mockReturnValue(new Promise(() => {}))
    pintar('org')
    await abrirYLlenar(user, 'BAE LOMAS 4 (4120)', 'elegir-direccion-sin-zona')
    await user.click(crear())
    await waitFor(() => expect(duplicar).toHaveBeenCalledTimes(1))
    expect(duplicar.mock.calls[0][1].address).not.toHaveProperty('timezone')
  })

  it('🔴 número que ya existe: botón apagado y «Ya hay una tienda con el número 3952» antes de enviar', async () => {
    const user = userEvent.setup()
    pintar('org')
    await abrirYLlenar(user, 'BAE OTRA (3952)')
    expect(screen.getByText('Ya hay una tienda con el número 3952')).toBeInTheDocument()
    expect(crear()).toBeDisabled()
    expect(duplicar).not.toHaveBeenCalled()
  })

  it('🔴 mientras envía: botón apagado y un solo POST aunque haga doble clic', async () => {
    const user = userEvent.setup()
    duplicar.mockReturnValue(new Promise(() => {}))
    pintar('org')
    await abrirYLlenar(user)
    await user.dblClick(crear())
    expect(crear()).toBeDisabled()
    expect(duplicar).toHaveBeenCalledTimes(1)
  })

  it('🔴 dos clics en el mismo instante (antes de que se pinte el botón apagado) mandan un solo POST', async () => {
    const user = userEvent.setup()
    duplicar.mockReturnValue(new Promise(() => {}))
    pintar('org')
    await abrirYLlenar(user)
    const boton = crear()
    act(() => {
      boton.click()
      boton.click()
    })
    await waitFor(() => expect(duplicar).toHaveBeenCalled())
    await new Promise(r => setTimeout(r, 50))
    expect(duplicar).toHaveBeenCalledTimes(1)
  })

  it.each([
    [403, 'module_disabled', 'Esta función no está prendida para tu organización.'],
    [400, 'VENUE_NAME_TAKEN', 'Ya hay una tienda con ese nombre o número. Cámbialo e inténtalo de nuevo.'],
    [400, 'SUPERVISOR_NOT_IN_ORG', 'Ese supervisor ya no es de tu organización. Elige a otro.'],
    [400, 'TEMPLATE_NOT_ACTIVE', 'La tienda modelo ya no está activa. Elige otra.'],
    [400, 'TEMPLATE_HAS_PAID_PLAN', 'La tienda modelo tiene un plan de pago, y no se puede copiar. Elige otra.'],
  ])('🔴 un %s %s muestra su texto propio sin cerrar el diálogo', async (status, code, texto) => {
    const user = userEvent.setup()
    duplicar.mockRejectedValue({ response: { status, data: { message: 'texto crudo del servidor', code } } })
    pintar('org')
    await abrirYLlenar(user)
    await user.click(crear())
    expect(await within(screen.getByRole('dialog')).findByText(texto)).toBeInTheDocument()
    expect(screen.queryByText('texto crudo del servidor')).toBeNull()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('código desconocido: sale el message del servidor', async () => {
    const user = userEvent.setup()
    duplicar.mockRejectedValue({ response: { status: 400, data: { message: 'Algo nuevo del servidor', code: 'CODIGO_NUEVO' } } })
    pintar('org')
    await abrirYLlenar(user)
    await user.click(crear())
    expect(await within(screen.getByRole('dialog')).findByText('Algo nuevo del servidor')).toBeInTheDocument()
  })

  it('con la UI en inglés el error por código sale en inglés y el aviso trae lo del PIN', async () => {
    await i18n.changeLanguage('en')
    try {
      const user = userEvent.setup()
      duplicar.mockRejectedValueOnce({ response: { status: 400, data: { message: 'crudo', code: 'TEMPLATE_NOT_ACTIVE' } } })
      pintar('org')
      await user.click(await screen.findByRole('button', { name: 'Duplicate store' }))
      const d = await screen.findByRole('dialog')
      await user.selectOptions(within(d).getByRole('combobox', { name: 'template' }), MODELO.id)
      await user.type(within(d).getByLabelText('Name and number of the new store'), 'BAE LOMAS 4 (4120)')
      await user.click(within(d).getByRole('button', { name: 'elegir-direccion' }))
      await user.selectOptions(within(d).getByRole('combobox', { name: 'supervisor' }), OPCIONES.supervisors[0].staffId)
      await user.click(within(d).getByRole('button', { name: 'Create store' }))
      expect(await within(d).findByText('The template store is no longer active. Choose another one.')).toBeInTheDocument()
      duplicar.mockResolvedValueOnce({ venueId: NUEVA.id, slug: NUEVA.slug, name: NUEVA.name })
      await user.click(within(d).getByRole('button', { name: 'Create store' }))
      expect(await screen.findByText('The supervisor needs their PIN under Team.')).toBeInTheDocument()
    } finally {
      await i18n.changeLanguage('es')
    }
  })

  it('al crear invalida también el conteo de la cabecera (organization/stats)', async () => {
    const user = userEvent.setup()
    duplicar.mockResolvedValue({ venueId: NUEVA.id, slug: NUEVA.slug, name: NUEVA.name })
    const spy = vi.spyOn(QueryClient.prototype, 'invalidateQueries')
    pintar('org')
    await abrirYLlenar(user)
    await user.click(crear())
    await screen.findByText('BAE LOMAS 4 (4120) ya está activa')
    expect(spy).toHaveBeenCalledWith({ queryKey: ['organization', 'stats'] })
    expect(screen.getByText('El supervisor necesita su PIN en Equipo.')).toBeInTheDocument()
    spy.mockRestore()
  })

  it('🔴 la llave se genera al abrir: el reintento manda la MISMA y otra apertura una nueva', async () => {
    const user = userEvent.setup()
    duplicar.mockRejectedValue({ response: { status: 400, data: { message: 'Esa tienda ya no está activa; elige otra', code: 'TEMPLATE_NOT_ACTIVE' } } })
    pintar('org')
    await abrirYLlenar(user)
    await user.click(crear())
    await screen.findByText('La tienda modelo ya no está activa. Elige otra.')
    await user.click(crear())
    await waitFor(() => expect(duplicar).toHaveBeenCalledTimes(2))
    const [primera, segunda] = duplicar.mock.calls.map(c => (c[1] as { idempotencyKey: string }).idempotencyKey)
    expect(primera).toMatch(UUID)
    expect(segunda).toBe(primera)

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await abrirYLlenar(user)
    await user.click(crear())
    await waitFor(() => expect(duplicar).toHaveBeenCalledTimes(3))
    expect((duplicar.mock.calls[2][1] as { idempotencyKey: string }).idempotencyKey).not.toBe(primera)
  })
})
