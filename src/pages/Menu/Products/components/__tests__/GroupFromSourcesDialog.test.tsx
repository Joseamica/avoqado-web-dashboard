/**
 * Variantes de producto, bloque 2 (Tarea 11): «Agrupar productos que ya tengo» = Sugerencias del server + «Archivo de Shopify».
 * `t` pega los valores con «:» (`fuentes.productos:3`); `GroupExistingDialog` se simula (tiene su prueba). vitest corre con mockReset:
 * las respuestas van en beforeEach o dentro del `it`.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import en from '@/locales/en/variants.json'
import es from '@/locales/es/variants.json'
import type { EstadoAgrupar } from '@/features/product-variants/groupExisting'
import type { GroupSuggestion, ShopifyFileProposalsResponse, ShopifyProposal } from '@/types/productGroup'

const grupos = vi.hoisted(() => ({
  getGroupSuggestions: vi.fn(),
  shopifyFileProposals: vi.fn(),
  listShopifyProposals: vi.fn(),
  previewAllShopifyProposals: vi.fn(),
  applyShopifyProposalsBatch: vi.fn(),
}))
const revisado = vi.hoisted(() => ({ inicial: undefined as unknown, avisos: undefined as unknown, shopify: undefined as unknown }))
const estables = vi.hoisted(() => ({
  i18n: {
    t: (k: string, o?: Record<string, unknown>) =>
      [k, ...Object.entries(o ?? {}).flatMap(([c, v]) => (c === 'defaultValue' ? [] : [String(v)]))].join(':'),
    i18n: { language: 'es' },
  },
}))
vi.mock('@/services/productGroups.service', () => grupos)
vi.mock('react-i18next', () => ({ useTranslation: () => estables.i18n }))
vi.mock('../GroupExistingDialog', () => ({
  GroupExistingDialog: (p: {
    inicial: unknown
    avisos?: string[]
    shopify?: unknown
    onClose: () => void
    onDone: (groupId: string) => void
  }) => {
    revisado.inicial = p.inicial
    revisado.avisos = p.avisos
    revisado.shopify = p.shopify
    return (
      <div data-testid="agrupar-simulado">
        <button onClick={() => p.onDone('g9')}>agrupado</button>
        <button onClick={p.onClose}>cerrar-agrupar</button>
      </div>
    )
  },
}))

import { GroupFromSourcesDialog } from '../GroupFromSourcesDialog'

const sugerencia = (key: string, extra: Partial<GroupSuggestion> = {}): GroupSuggestion => ({
  key,
  parentName: key,
  optionNames: ['Talla'],
  memberCount: 2,
  members: [
    { productId: `${key}-1`, name: `${key} - Talla 26`, sku: 'A26', values: ['26'] },
    { productId: `${key}-2`, name: `${key} - Talla 27`, sku: '', values: ['27'] },
  ],
  ...extra,
})
const pagina = (items: GroupSuggestion[], total: number, page = 1, pageSize = 2) => ({ items, total, page, pageSize })

const propuesta = {
  handle: 'playera',
  parentName: 'Playera',
  options: [
    { name: 'Talla', values: ['S', 'M'] },
    { name: 'Color', values: ['Azul'] },
  ],
  members: [
    { productId: 'a', name: 'Playera S Azul', values: ['S', 'Azul'] },
    { productId: 'b', name: 'Playera M', values: ['M'] }, // el server puede mandar un valor de menos
  ],
  unmatched: ['SKU-9'],
  conflicts: ['El SKU X aparece en dos filas'],
}
const respuestaDeArchivo = (): ShopifyFileProposalsResponse => ({
  proposals: [propuesta],
  skippedHandles: 1,
  skipped: [{ handle: 'gorra', conflicts: [], unmatched: ['G-1', 'G-2'] }],
})

function pintar() {
  const onDone = vi.fn()
  const onClose = vi.fn()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const usuario = userEvent.setup()
  render(
    <QueryClientProvider client={qc}>
      <GroupFromSourcesDialog open onClose={onClose} venueId="v1" onDone={onDone} />
    </QueryClientProvider>,
  )
  return { onDone, onClose, usuario }
}
/** jsdom no implementa `Blob.text()` (el navegador sí, y es lo que usa el diálogo): se la ponemos al archivo de la prueba. */
const archivoCsv = (contenido: string) => {
  const archivo = new File([contenido], 'productos.csv', { type: 'text/csv' })
  Object.defineProperty(archivo, 'text', { value: () => Promise.resolve(contenido) })
  return archivo
}
const abrirArchivo = (usuario: ReturnType<typeof userEvent.setup>) => usuario.click(screen.getByRole('tab', { name: 'fuentes.archivo' }))
const campoDeArchivo = () => screen.getByLabelText('fuentes.elegirArchivo') as HTMLInputElement

beforeEach(() => {
  revisado.inicial = undefined
  revisado.avisos = undefined
  revisado.shopify = undefined
  grupos.getGroupSuggestions.mockResolvedValue(pagina([], 0))
})

describe('GroupFromSourcesDialog — Sugerencias', () => {
  it('pinta las tarjetas, pide la página 2 con «Cargar más» y abre el diálogo de agrupar con las opciones correctas', async () => {
    grupos.getGroupSuggestions.mockImplementation(async (_v: string, p: { page: number }) =>
      p.page === 1
        ? pagina(
            [
              sugerencia('Tenis'),
              sugerencia('Camisa', {
                optionNames: ['Opción 1', 'Opción 2'],
                memberCount: 300,
                members: [
                  { productId: 'c1', name: 'Camisa · S · Azul', sku: 'C1', values: ['S', 'Azul'] },
                  { productId: 'c2', name: 'Camisa · M', sku: 'C2', values: ['M'] }, // más corto que las opciones
                ],
              }),
            ],
            3,
          )
        : pagina([sugerencia('Gorra')], 3, 2),
    )
    const { usuario } = pintar()

    await screen.findByText('Tenis')
    expect(grupos.getGroupSuggestions).toHaveBeenCalledWith('v1', { page: 1, pageSize: 20 })
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText('fuentes.productos:2')).toBeInTheDocument()
    expect(screen.getByText('fuentes.totalSugerencias:3')).toBeInTheDocument()
    // memberCount 300 > 250 que manda el server: la tarjeta lo avisa
    expect(screen.getByText('fuentes.primeros250:300')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'fuentes.cargarMas:1' }))
    await screen.findByText('Gorra')
    expect(grupos.getGroupSuggestions).toHaveBeenLastCalledWith('v1', { page: 2, pageSize: 20 })
    expect(screen.queryByRole('button', { name: /fuentes\.cargarMas/ })).not.toBeInTheDocument()

    // «- Talla» conserva su opción «Talla»
    await usuario.click(within(screen.getByText('Tenis').closest('li')!).getByRole('button', { name: 'fuentes.revisar' }))
    expect(revisado.inicial).toEqual({
      name: 'Tenis',
      optionNames: ['Talla'],
      members: [
        { productId: 'Tenis-1', name: 'Tenis - Talla 26', sku: 'A26', values: ['26'] },
        { productId: 'Tenis-2', name: 'Tenis - Talla 27', sku: undefined, values: ['27'] },
      ],
    } satisfies EstadoAgrupar)

    // las «Opción 1/2» del server se muestran VACÍAS y los valores cortos se rellenan con ''
    await usuario.click(screen.getByRole('button', { name: 'cerrar-agrupar' }))
    expect(screen.queryByTestId('agrupar-simulado')).not.toBeInTheDocument()
    await usuario.click(within(screen.getByText('Camisa').closest('li')!).getByRole('button', { name: 'fuentes.revisar' }))
    expect(revisado.inicial).toEqual({
      name: 'Camisa',
      optionNames: ['', ''],
      members: [
        { productId: 'c1', name: 'Camisa · S · Azul', sku: 'C1', values: ['S', 'Azul'] },
        { productId: 'c2', name: 'Camisa · M', sku: 'C2', values: ['M', ''] },
      ],
    })
  })

  it('muestra hasta 4 nombres de ejemplo por tarjeta', async () => {
    const muchos = Array.from({ length: 6 }, (_, i) => ({ productId: `m${i}`, name: `Zapato ${i}`, sku: '', values: [String(i)] }))
    grupos.getGroupSuggestions.mockResolvedValue(pagina([sugerencia('Zapato', { memberCount: 6, members: muchos })], 1))
    pintar()
    const tarjeta = (await screen.findByText('Zapato', { selector: 'p' })).closest('li')!
    expect(within(tarjeta).getByText(/Zapato 0/)).toBeInTheDocument()
    expect(within(tarjeta).getByText(/Zapato 3/)).toBeInTheDocument()
    expect(within(tarjeta).queryByText(/Zapato 4/)).not.toBeInTheDocument()
  })

  it('cargando no se confunde con vacío', async () => {
    grupos.getGroupSuggestions.mockReturnValue(new Promise(() => {}))
    pintar()
    expect(await screen.findByText('fuentes.cargando')).toBeInTheDocument()
    expect(screen.queryByText('fuentes.vacio')).not.toBeInTheDocument()
    expect(screen.queryByText('fuentes.error')).not.toBeInTheDocument()
  })

  it('vacío: dice cómo seguir a mano', async () => {
    grupos.getGroupSuggestions.mockResolvedValue(pagina([], 0))
    pintar()
    expect(await screen.findByText('fuentes.vacio')).toBeInTheDocument()
    expect(screen.queryByText('fuentes.error')).not.toBeInTheDocument()
  })

  it('error: no se confunde con vacío, da el motivo del server y «Reintentar» vuelve a pedir', async () => {
    grupos.getGroupSuggestions.mockRejectedValue({
      response: { status: 409, data: { code: 'PRODUCT_VARIANTS_MASTER_CATALOG', message: 'Tu negocio usa el catálogo maestro.' } },
    })
    const { usuario } = pintar()
    expect(await screen.findByText('fuentes.error', undefined, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.getByText('Tu negocio usa el catálogo maestro.')).toBeInTheDocument()
    expect(screen.queryByText('fuentes.vacio')).not.toBeInTheDocument()

    grupos.getGroupSuggestions.mockResolvedValue(pagina([sugerencia('Tenis')], 1))
    await usuario.click(screen.getByRole('button', { name: 'fuentes.reintentar' }))
    expect(await screen.findByText('Tenis')).toBeInTheDocument()
  })
})

describe('GroupFromSourcesDialog — pestañas', () => {
  it('I1: sólo se ve una pestaña a la vez; tocar «Archivo de Shopify» cambia el contenido, no sólo el color de la pastilla', async () => {
    grupos.getGroupSuggestions.mockResolvedValue(pagina([sugerencia('Tenis')], 1))
    const { usuario } = pintar()
    const tarjeta = await screen.findByText('Tenis', { selector: 'p' })
    expect(tarjeta).toBeVisible()
    expect(campoDeArchivo()).not.toBeVisible()

    await abrirArchivo(usuario)
    expect(campoDeArchivo()).toBeVisible()
    expect(tarjeta).not.toBeVisible()

    await usuario.click(screen.getByRole('tab', { name: 'fuentes.sugerencias' }))
    expect(tarjeta).toBeVisible()
    expect(campoDeArchivo()).not.toBeVisible()
  })
})

describe('GroupFromSourcesDialog — Archivo de Shopify', () => {
  it('un archivo de más de 900 KB no se manda: dice que lo dividas', async () => {
    const { usuario } = pintar()
    await abrirArchivo(usuario)
    const grande = new File([new Uint8Array(1024 * 1024)], 'productos.csv', { type: 'text/csv' })
    await usuario.upload(campoDeArchivo(), grande)
    expect(await screen.findByText('fuentes.muyGrande')).toBeInTheDocument()
    expect(grupos.shopifyFileProposals).not.toHaveBeenCalled()
  })

  it('manda el TEXTO del archivo, pinta la propuesta y lo que se omitió', async () => {
    grupos.shopifyFileProposals.mockResolvedValue(respuestaDeArchivo())
    const { usuario } = pintar()
    await abrirArchivo(usuario)
    expect(screen.getByText('fuentes.archivoAyuda')).toBeInTheDocument()
    expect(campoDeArchivo()).toHaveAttribute('accept', '.csv,text/csv')

    await usuario.upload(campoDeArchivo(), archivoCsv('Handle,Title\nplayera,Playera'))
    await screen.findByText('Playera', { selector: 'p' })
    expect(grupos.shopifyFileProposals).toHaveBeenCalledTimes(1)
    expect(grupos.shopifyFileProposals).toHaveBeenCalledWith('v1', 'Handle,Title\nplayera,Playera')

    expect(screen.getByText('fuentes.propuestas:1')).toBeInTheDocument()
    const tarjeta = screen.getByText('Playera', { selector: 'p' }).closest('li')!
    expect(within(tarjeta).getByText('fuentes.productos:2')).toBeInTheDocument()
    expect(within(tarjeta).getByText(/Talla: S, M/)).toBeInTheDocument()
    // los conflictos se ven con su título; los códigos que no están en Avoqado van plegados
    expect(within(tarjeta).getByText('fuentes.conflictos')).toBeInTheDocument()
    expect(within(tarjeta).getByText('El SKU X aparece en dos filas')).toBeInTheDocument()
    await usuario.click(within(tarjeta).getByText('fuentes.noEncontrados:1'))
    expect(within(tarjeta).getByText('SKU-9')).toBeInTheDocument()

    // el único «handle» que no se pudo proponer está plegado, con lo que se encontró
    await usuario.click(screen.getByText('fuentes.omitidos:1'))
    expect(screen.getByText('gorra')).toBeInTheDocument()
    expect(screen.getByText(/G-1, G-2/)).toBeInTheDocument()
  })

  it('«Revisar y agrupar» abre el diálogo con las opciones y valores de la propuesta; al terminar queda «Agrupada» y avisa al padre', async () => {
    grupos.shopifyFileProposals.mockResolvedValue(respuestaDeArchivo())
    const { usuario, onDone } = pintar()
    await abrirArchivo(usuario)
    await usuario.upload(campoDeArchivo(), archivoCsv('csv'))
    const tarjeta = (await screen.findByText('Playera', { selector: 'p' })).closest('li')!

    await usuario.click(within(tarjeta).getByRole('button', { name: 'fuentes.revisar' }))
    expect(revisado.inicial).toEqual({
      name: 'Playera',
      optionNames: ['Talla', 'Color'],
      members: [
        { productId: 'a', name: 'Playera S Azul', values: ['S', 'Azul'] },
        { productId: 'b', name: 'Playera M', values: ['M', ''] },
      ],
    })
    expect(revisado.avisos).toEqual(['El SKU X aparece en dos filas', 'fuentes.noEncontrados:1: SKU-9'])

    await usuario.click(screen.getByRole('button', { name: 'agrupado' }))
    expect(onDone).toHaveBeenCalledWith('g9')
    expect(screen.queryByTestId('agrupar-simulado')).not.toBeInTheDocument()
    expect(within(tarjeta).getByText('fuentes.agrupada')).toBeInTheDocument()
    expect(within(tarjeta).queryByRole('button', { name: 'fuentes.revisar' })).not.toBeInTheDocument()
  })

  it('un archivo sin propuestas ni omitidos dice que no encontró nada', async () => {
    grupos.shopifyFileProposals.mockResolvedValue({ proposals: [], skippedHandles: 0, skipped: [] })
    const { usuario } = pintar()
    await abrirArchivo(usuario)
    await usuario.upload(campoDeArchivo(), archivoCsv('csv'))
    expect(await screen.findByText('fuentes.sinPropuestas')).toBeInTheDocument()
  })

  it('🔴 Codex C6: una respuesta sin `skipped` (o sin `proposals`) no tumba la vista: pinta lo que sí vino', async () => {
    grupos.shopifyFileProposals.mockResolvedValueOnce({ proposals: [propuesta] }).mockResolvedValueOnce({ skipped: respuestaDeArchivo().skipped })
    const { usuario } = pintar()
    await abrirArchivo(usuario)
    await usuario.upload(campoDeArchivo(), archivoCsv('csv'))
    expect(await screen.findByText('Playera', { selector: 'p' })).toBeInTheDocument()
    expect(screen.queryByText(/fuentes\.omitidos/)).not.toBeInTheDocument()

    await usuario.upload(campoDeArchivo(), archivoCsv('csv 2'))
    expect(await screen.findByText('fuentes.omitidos:1')).toBeInTheDocument()
    expect(screen.queryByText(/fuentes\.propuestas/)).not.toBeInTheDocument()
  })

  it('un 403 del plan (en inglés, sin code) se ve en español, no el texto del server', async () => {
    grupos.shopifyFileProposals.mockRejectedValue({
      response: {
        status: 403,
        data: {
          error: 'Feature not available',
          message: 'This venue does not have access to the PRODUCT_VARIANTS feature.',
          featureCode: 'PRODUCT_VARIANTS',
          subscriptionRequired: true,
        },
      },
    })
    const { usuario } = pintar()
    await abrirArchivo(usuario)
    await usuario.upload(campoDeArchivo(), archivoCsv('csv'))
    expect(await screen.findByText('variants:errors.planRequired')).toBeInTheDocument()
    expect(screen.queryByText(/does not have access/)).not.toBeInTheDocument()
    // la clave existe y está en español
    expect(es.errors.planRequired).toMatch(/Pro y Premium/)
  })

  it('un 400 del server (CSV mal formado) muestra su texto en español y deja volver a elegir el mismo archivo', async () => {
    grupos.shopifyFileProposals.mockRejectedValueOnce({
      response: { status: 400, data: { message: 'No parece un CSV de productos de Shopify: falta la columna «Handle».' } },
    })
    grupos.shopifyFileProposals.mockResolvedValueOnce(respuestaDeArchivo())
    const { usuario } = pintar()
    await abrirArchivo(usuario)
    const archivo = archivoCsv('csv')
    await usuario.upload(campoDeArchivo(), archivo)
    expect(await screen.findByText(/falta la columna «Handle»/)).toBeInTheDocument()

    await usuario.upload(campoDeArchivo(), archivo)
    await waitFor(() => expect(screen.getByText('fuentes.propuestas:1')).toBeInTheDocument())
    expect(screen.queryByText(/falta la columna/)).not.toBeInTheDocument()
  })
})

describe('GroupFromSourcesDialog — Archivo de Shopify, ronda de arreglos 1', () => {
  it('M1: «Agrupada» es de ESE archivo; al subir otro (p. ej. tras deshacer la familia) la tarjeta vuelve a tener su botón', async () => {
    grupos.shopifyFileProposals.mockResolvedValue(respuestaDeArchivo())
    const { usuario } = pintar()
    await abrirArchivo(usuario)
    await usuario.upload(campoDeArchivo(), archivoCsv('csv'))
    const primera = (await screen.findByText('Playera', { selector: 'p' })).closest('li')!
    await usuario.click(within(primera).getByRole('button', { name: 'fuentes.revisar' }))
    await usuario.click(screen.getByRole('button', { name: 'agrupado' }))
    expect(within(primera).getByText('fuentes.agrupada')).toBeInTheDocument()

    await usuario.upload(campoDeArchivo(), archivoCsv('csv'))
    const segunda = (await screen.findByText('Playera', { selector: 'p' })).closest('li')!
    expect(grupos.shopifyFileProposals).toHaveBeenCalledTimes(2)
    expect(within(segunda).queryByText('fuentes.agrupada')).not.toBeInTheDocument()
    expect(within(segunda).getByRole('button', { name: 'fuentes.revisar' })).toBeInTheDocument()
  })

  it('M2: un archivo vacío no se manda al server y dice que está vacío', async () => {
    const { usuario } = pintar()
    await abrirArchivo(usuario)
    await usuario.upload(campoDeArchivo(), new File([], 'productos.csv', { type: 'text/csv' }))
    expect(await screen.findByText('fuentes.archivoVacio')).toBeInTheDocument()
    expect(grupos.shopifyFileProposals).not.toHaveBeenCalled()
    expect(es.fuentes.archivoVacio).toMatch(/vacío/)
    expect(en.fuentes.archivoVacio).toMatch(/empty/)
  })

  it('M2: un 413 del server (cuerpo más grande de lo que cabe) se ve como «pasa de 900 KB», no como el texto genérico', async () => {
    grupos.shopifyFileProposals.mockRejectedValue({
      response: { status: 413, data: { message: 'La solicitud excede el tamaño máximo permitido.', code: 'PAYLOAD_TOO_LARGE' } },
    })
    const { usuario } = pintar()
    await abrirArchivo(usuario)
    await usuario.upload(campoDeArchivo(), archivoCsv('csv'))
    expect(await screen.findByText('fuentes.muyGrande')).toBeInTheDocument()
    expect(screen.queryByText(/excede el tamaño/)).not.toBeInTheDocument()
  })

  // Pinta cientos de renglones en jsdom: ~1-2 s sola, >5 s con la suite completa en una máquina cargada.
  it('M3: un archivo con muchas propuestas pinta 50 y «Mostrar más» de 50 en 50, con el total a la vista', { timeout: 20_000 }, async () => {
    const muchas = Array.from({ length: 120 }, (_, i) => ({ ...propuesta, handle: `h${i}`, parentName: `Producto ${i}`, conflicts: [], unmatched: [] }))
    grupos.shopifyFileProposals.mockResolvedValue({ proposals: muchas, skippedHandles: 0, skipped: [] })
    const { usuario } = pintar()
    await abrirArchivo(usuario)
    await usuario.upload(campoDeArchivo(), archivoCsv('csv'))
    await screen.findByText('Producto 0', { selector: 'p' })
    const tarjetas = () => screen.getAllByRole('button', { name: 'fuentes.revisar' })
    expect(screen.getByText('fuentes.propuestas:120')).toBeInTheDocument()
    expect(tarjetas()).toHaveLength(50)
    expect(screen.queryByText('Producto 50', { selector: 'p' })).not.toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'fuentes.mostrarMas:70' }))
    expect(tarjetas()).toHaveLength(100)
    await usuario.click(screen.getByRole('button', { name: 'fuentes.mostrarMas:20' }))
    expect(tarjetas()).toHaveLength(120)
    expect(screen.getByText('Producto 119', { selector: 'p' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /fuentes\.mostrarMas/ })).not.toBeInTheDocument()
  })

  it('M3: los handles omitidos también se pintan de 50 en 50', async () => {
    const omitidos = Array.from({ length: 60 }, (_, i) => ({ handle: `omitido-${i}`, conflicts: [], unmatched: [`X-${i}`] }))
    grupos.shopifyFileProposals.mockResolvedValue({ proposals: [], skippedHandles: 60, skipped: omitidos })
    const { usuario } = pintar()
    await abrirArchivo(usuario)
    await usuario.upload(campoDeArchivo(), archivoCsv('csv'))
    await usuario.click(await screen.findByText('fuentes.omitidos:60'))
    expect(screen.getByText('omitido-49')).toBeInTheDocument()
    expect(screen.queryByText('omitido-50')).not.toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'fuentes.mostrarMas:10' }))
    expect(screen.getByText('omitido-59')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /fuentes\.mostrarMas/ })).not.toBeInTheDocument()
  })
})

const gid = (n: number) => `gid://shopify/Product/${n}`
const propuestaShopify = (n: number, extra: Partial<ShopifyProposal> = {}): ShopifyProposal => ({
  shopifyProductId: gid(n),
  mode: 'CREATE',
  groupId: null,
  groupName: null,
  title: `Playera ${n}`,
  ready: true,
  blockedReason: null,
  members: [
    { productId: `p${n}a`, name: `Playera ${n} S`, sku: `S${n}` },
    { productId: `p${n}b`, name: `Playera ${n} M`, sku: '' },
  ],
  ...extra,
})
const vistaDe = (n: number) => ({
  shopifyProductId: gid(n),
  mode: 'CREATE' as const,
  groupName: `Playera ${n}`,
  preview: {
    parent: {
      name: `Playera ${n}`,
      categoryId: 'c1',
      type: 'RETAIL',
      ivaTratamiento: 'IVA_16',
      description: null,
      imageUrl: null,
      printStationId: null,
      satProductKey: null,
      satUnitKey: null,
      modifierGroupIds: [],
    },
    options: [{ name: 'Talla', values: ['S', 'M'] }],
    members: [
      {
        productId: `p${n}a`,
        sku: `S${n}`,
        currentName: `Playera ${n} S`,
        newName: `Playera ${n} · S`,
        values: ['S'],
        changes: [`IVA ${n}: Exento → 16 %`, `Categoría ${n}: Ropa → Playeras`, `Extras ${n}: se quitan «Bordado»`],
      },
    ],
    warnings: [],
    fingerprint: `h${n}`,
    firstMemberIva: 'IVA_16',
    mode: 'CREATE' as const,
    groupId: null,
    skipped: [],
  },
})
const abrirShopify = (usuario: ReturnType<typeof userEvent.setup>) => usuario.click(screen.getByRole('tab', { name: 'fuentes.shopify' }))

describe('GroupFromSourcesDialog — Desde Shopify', () => {
  it('la pestaña lista CREATE y ADD, muestra no-listas con su texto y abre la vista previa con nombre bloqueado', async () => {
    grupos.listShopifyProposals.mockImplementation(async (_v: string, q: { cursor?: string }) =>
      q.cursor
        ? { items: [propuestaShopify(5)], total: 5, nextCursor: null }
        : {
            items: [
              propuestaShopify(1),
              propuestaShopify(2, { mode: 'ADD', groupId: 'g2', groupName: 'Sudadera' }),
              propuestaShopify(3, { ready: false, title: null }),
              propuestaShopify(4, { blockedReason: 'No se puede agrupar: Shopify trae más de 3 opciones.' }),
            ],
            total: 5,
            nextCursor: gid(4),
          },
    )
    const { usuario, onDone } = pintar()
    await screen.findByText('fuentes.vacio')
    // pestaña oculta = no se pide (regla de datos acotados)
    expect(grupos.listShopifyProposals).not.toHaveBeenCalled()

    await abrirShopify(usuario)
    await screen.findByText('Playera 1')
    expect(grupos.listShopifyProposals).toHaveBeenCalledWith('v1', { cursor: undefined, limit: 20 })
    expect(screen.getByText('shopify.total:5')).toBeInTheDocument()
    const tarjeta = (n: number) => screen.getByText(`Playera ${n}`, { selector: 'p' }).closest('li')!
    expect(within(tarjeta(1)).getByText('shopify.crear')).toBeInTheDocument()
    expect(within(tarjeta(2)).getByText('shopify.agregarA:Sudadera')).toBeInTheDocument()
    // sin título (pareja vieja): se nombra por su primera talla, dice que se completa sola y no ofrece agrupar
    const pendiente = screen.getByText('Playera 3 S', { selector: 'p' }).closest('li')!
    expect(within(pendiente).getByText('shopify.pendiente')).toBeInTheDocument()
    expect(within(pendiente).queryByRole('button', { name: 'fuentes.revisar' })).not.toBeInTheDocument()
    expect(within(tarjeta(4)).getByText('No se puede agrupar: Shopify trae más de 3 opciones.')).toBeInTheDocument()
    expect(within(tarjeta(4)).queryByRole('button', { name: 'fuentes.revisar' })).not.toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'shopify.verMas:1' }))
    await screen.findByText('Playera 5')
    expect(grupos.listShopifyProposals).toHaveBeenLastCalledWith('v1', { cursor: gid(4), limit: 20 })
    expect(screen.queryByRole('button', { name: /shopify\.verMas/ })).not.toBeInTheDocument()

    await usuario.click(within(tarjeta(2)).getByRole('button', { name: 'fuentes.revisar' }))
    expect(revisado.shopify).toEqual({ shopifyProductId: gid(2), mode: 'ADD', groupName: 'Sudadera' })
    await usuario.click(screen.getByRole('button', { name: 'cerrar-agrupar' }))
    await usuario.click(within(tarjeta(1)).getByRole('button', { name: 'fuentes.revisar' }))
    expect(revisado.shopify).toEqual({ shopifyProductId: gid(1), mode: 'CREATE', groupName: null })
    expect(revisado.inicial).toMatchObject({ name: 'Playera 1', members: [{ productId: 'p1a' }, { productId: 'p1b' }] })
    await usuario.click(screen.getByRole('button', { name: 'agrupado' }))
    expect(onDone).toHaveBeenCalledWith('g9')
  })

  it('vacío: lo dice (no se confunde con cargando)', async () => {
    grupos.listShopifyProposals.mockResolvedValue({ items: [], total: 0, nextCursor: null })
    const { usuario } = pintar()
    await abrirShopify(usuario)
    expect(await screen.findByText('shopify.vacio')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /shopify\.agruparTodas/ })).not.toBeInTheDocument()
  })

  it(
    'Agrupar todas muestra por propuesta los cambios concretos de IVA, categoría y extras de cada talla (no sólo un contador), manda los pares vistos en lotes de 25 y muestra aplicadas, saltadas y bloqueadas',
    { timeout: 20_000 },
    async () => {
      grupos.listShopifyProposals.mockResolvedValue({ items: [propuestaShopify(1)], total: 29, nextCursor: gid(1) })
      const primeras = Array.from({ length: 25 }, (_, i) => vistaDe(i + 1))
      grupos.previewAllShopifyProposals.mockImplementation(async (_v: string, cursor?: string) =>
        cursor
          ? {
              items: [vistaDe(27), vistaDe(28)],
              blocked: [{ shopifyProductId: gid(29), motivo: 'No se puede agrupar: Shopify trae más de 3 opciones.' }],
              total: 29,
              nextCursor: null,
            }
          : {
              items: primeras,
              blocked: [{ shopifyProductId: gid(26), motivo: 'Este producto se completa en la próxima sincronización con Shopify.' }],
              total: 29,
              nextCursor: gid(26),
            },
      )
      grupos.applyShopifyProposalsBatch.mockImplementation(async (_v: string, items: Array<{ shopifyProductId: string }>) =>
        items.length === 25
          ? {
              applied: items
                .filter(x => x.shopifyProductId !== gid(3))
                .map(x => ({ shopifyProductId: x.shopifyProductId, groupId: 'g', mode: 'CREATE' })),
              skipped: [{ shopifyProductId: gid(3), motivo: 'Cambió desde que lo viste' }],
            }
          : { applied: items.map(x => ({ shopifyProductId: x.shopifyProductId, groupId: 'g', mode: 'CREATE' })), skipped: [] },
      )
      const { usuario } = pintar()
      await abrirShopify(usuario)
      await usuario.click(await screen.findByRole('button', { name: 'shopify.agruparTodas:29' }))

      await screen.findByText('shopify.todas.listas:27')
      expect(grupos.previewAllShopifyProposals).toHaveBeenNthCalledWith(1, 'v1', undefined)
      expect(grupos.previewAllShopifyProposals).toHaveBeenNthCalledWith(2, 'v1', gid(26))
      expect(screen.getByText('shopify.todas.bloqueadas:2')).toBeInTheDocument()
      // los cambios concretos de cada talla, no sólo «cambia el IVA de N»
      expect(screen.getByText('IVA 1: Exento → 16 %')).toBeInTheDocument()
      expect(screen.getByText('Categoría 27: Ropa → Playeras')).toBeInTheDocument()
      expect(screen.getByText('Extras 28: se quitan «Bordado»')).toBeInTheDocument()
      expect(screen.getByText('Este producto se completa en la próxima sincronización con Shopify.')).toBeInTheDocument()
      expect(grupos.applyShopifyProposalsBatch).not.toHaveBeenCalled()

      const confirmarTodas = screen.getByRole('button', { name: 'shopify.todas.confirmar:27' })
      await usuario.dblClick(confirmarTodas)
      await screen.findByText('shopify.todas.aplicadas:26')
      expect(grupos.applyShopifyProposalsBatch).toHaveBeenCalledTimes(2) // el doble clic no manda dos veces
      const par = (n: number) => ({ shopifyProductId: gid(n), fingerprint: `h${n}` })
      expect(grupos.applyShopifyProposalsBatch).toHaveBeenNthCalledWith(
        1,
        'v1',
        primeras.map((_, i) => par(i + 1)),
      )
      expect(grupos.applyShopifyProposalsBatch).toHaveBeenNthCalledWith(2, 'v1', [par(27), par(28)])

      const saltadas = screen.getByText('shopify.todas.saltadas:1').closest('section')!
      expect(within(saltadas).getByText('Playera 3')).toBeInTheDocument()
      expect(within(saltadas).getByText('Cambió desde que lo viste')).toBeInTheDocument()
      const bloqueadas = screen.getByText('shopify.todas.bloqueadas:2').closest('section')!
      expect(within(bloqueadas).getByText('No se puede agrupar: Shopify trae más de 3 opciones.')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /shopify\.todas\.confirmar/ })).not.toBeInTheDocument()
    },
  )
})

describe('GroupFromSourcesDialog — Agrupar todas, ronda de arreglos 1', () => {
  it('🔴 el resumen sigue a la vista aunque la lista releída quede vacía; avisa las que no abriste; un lote sin respuesta va aparte, no como saltado', { timeout: 30_000 }, async () => {
    grupos.listShopifyProposals
      .mockResolvedValueOnce({ items: [propuestaShopify(1)], total: 60, nextCursor: null })
      .mockResolvedValue({ items: [], total: 0, nextCursor: null })
    grupos.previewAllShopifyProposals.mockImplementation(async (_v: string, cursor?: string) =>
      cursor
        ? { items: Array.from({ length: 30 }, (_, i) => vistaDe(i + 31)), blocked: [], total: 60, nextCursor: null }
        : { items: Array.from({ length: 30 }, (_, i) => vistaDe(i + 1)), blocked: [], total: 60, nextCursor: gid(30) },
    )
    let lote = 0
    grupos.applyShopifyProposalsBatch.mockImplementation(async (_v: string, items: Array<{ shopifyProductId: string }>) => {
      lote++
      if (lote === 2) throw new Error('Network Error') // sin respuesta: pudo haber entrado o no
      return { applied: items.map(x => ({ shopifyProductId: x.shopifyProductId, groupId: 'g', mode: 'CREATE' })), skipped: [] }
    })
    const { usuario } = pintar()
    await abrirShopify(usuario)
    await usuario.click(await screen.findByRole('button', { name: 'shopify.agruparTodas:60' }))
    await screen.findByText('shopify.todas.listas:60')
    // se pintan 50; las 10 de abajo también se mandan y la confirmación lo dice
    expect(screen.getByText('shopify.todas.noAbiertas:10')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'shopify.todas.confirmar:60' }))
    await screen.findByText('shopify.todas.aplicadas:35', undefined, { timeout: 4000 })
    expect(grupos.applyShopifyProposalsBatch).toHaveBeenCalledTimes(3)
    expect(grupos.applyShopifyProposalsBatch.mock.calls.flatMap(c => c[1]).map((x: { shopifyProductId: string }) => x.shopifyProductId)).toEqual(
      Array.from({ length: 60 }, (_, i) => gid(i + 1)),
    )
    // la lista se releyó y quedó vacía; el resumen NO se fue con ella (ni se volvió a montar: las vistas previas se pidieron una vez)
    expect(await screen.findByText('shopify.vacio')).toBeInTheDocument()
    expect(screen.getByText('shopify.todas.aplicadas:35')).toBeInTheDocument()
    expect(grupos.previewAllShopifyProposals).toHaveBeenCalledTimes(2)
    const sinRespuesta = screen.getByText('shopify.todas.sinRespuesta:25').closest('section')!
    expect(within(sinRespuesta).getByText('Playera 26')).toBeInTheDocument()
    expect(within(sinRespuesta).getByText('Playera 50')).toBeInTheDocument()
    expect(screen.queryByText(/shopify\.todas\.saltadas/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'shopify.todas.cerrar' })).toBeInTheDocument()
  })
})

describe('textos de «fuentes» y «shopify»', () => {
  it('es y en tienen las mismas claves', () => {
    const claves = (o: Record<string, unknown>): string[] =>
      Object.entries(o)
        .flatMap(([k, v]) => (v && typeof v === 'object' ? claves(v as Record<string, unknown>).map(x => `${k}.${x}`) : [k]))
        .sort()
    expect(claves(en.fuentes)).toEqual(claves(es.fuentes))
    expect(claves(en.shopify)).toEqual(claves(es.shopify))
    expect(es.fuentes.shopify).toBe('Desde Shopify')
    expect(es.shopify.crear).toBe('Crear familia')
    expect(es.shopify.agregarA).toBe('Agregar a «{{name}}»')
    expect(es.shopify.pendiente).toBe('Se completa en la próxima sincronización')
    expect(es.shopify.agruparTodas).toBe('Agrupar todas ({{count}})')
  })
})
