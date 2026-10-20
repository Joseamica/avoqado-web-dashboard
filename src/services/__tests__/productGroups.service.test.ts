import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGet = vi.fn()
const mockPost = vi.fn()
const mockPatch = vi.fn()
const mockPut = vi.fn()
const mockDelete = vi.fn()
vi.mock('@/api', () => ({
  default: {
    get: (...a: unknown[]) => mockGet(...a),
    post: (...a: unknown[]) => mockPost(...a),
    patch: (...a: unknown[]) => mockPatch(...a),
    put: (...a: unknown[]) => mockPut(...a),
    delete: (...a: unknown[]) => mockDelete(...a),
  },
}))

import * as s from '@/services/productGroups.service'

const G = '/api/v1/dashboard/venues/v1/product-groups'
const O = '/api/v1/dashboard/venues/v1/product-options'
const ok = (data: unknown) => ({ data: { success: true, data } })

beforeEach(() => {
  for (const m of [mockGet, mockPost, mockPatch, mockPut, mockDelete]) m.mockResolvedValue(ok('dato'))
})

describe('productGroups.service', () => {
  it('desenvuelve { success, data } y arma las rutas con el prefijo /api/v1', async () => {
    await expect(s.getProductGroup('v1', 'g1')).resolves.toBe('dato')
    expect(mockGet).toHaveBeenCalledWith(`${G}/g1`)
  })

  it('las listas piden página y tamaño; una búsqueda vacía no viaja', async () => {
    await s.listProductGroups('v1', { page: 2, pageSize: 25, search: '  ' })
    expect(mockGet).toHaveBeenCalledWith(G, { params: { page: 2, pageSize: 25, search: undefined } })
    await s.getGroupSuggestions('v1', { page: 1, pageSize: 20 })
    expect(mockGet).toHaveBeenCalledWith(`${G}/suggestions`, { params: { page: 1, pageSize: 20 } })
    await s.getArchivedVariants('v1', 'g1', { page: 1, pageSize: 25 })
    expect(mockGet).toHaveBeenCalledWith(`${G}/g1/archived`, { params: { page: 1, pageSize: 25 } })
    await s.listOptionLibrary('v1', { page: 3, pageSize: 25 })
    expect(mockGet).toHaveBeenCalledWith(O, { params: { page: 3, pageSize: 25 } })
  })

  it('agregar variantes manda `variants: []` aunque sólo se agreguen valores (el server lo exige)', async () => {
    await s.addVariants('v1', 'g1', { newValues: [{ optionName: 'Talla', values: ['XL'] }] } as never)
    expect(mockPost).toHaveBeenCalledWith(`${G}/g1/variants`, { newValues: [{ optionName: 'Talla', values: ['XL'] }], variants: [] })
  })

  it('el archivo de Shopify viaja como TEXTO en JSON, no como multipart', async () => {
    await s.shopifyFileProposals('v1', 'Handle,Title\nh,T')
    expect(mockPost).toHaveBeenCalledWith(`${G}/shopify-file/proposals`, { csv: 'Handle,Title\nh,T' })
  })

  it('el resto de las rutas', async () => {
    await s.createProductGroup('v1', { name: 'P', categoryId: 'c', options: [], variants: [] })
    expect(mockPost).toHaveBeenCalledWith(G, { name: 'P', categoryId: 'c', options: [], variants: [] })
    await s.updateProductGroup('v1', 'g1', { name: 'Q' })
    expect(mockPatch).toHaveBeenCalledWith(`${G}/g1`, { name: 'Q' })
    await s.previewGroupExisting('v1', { name: 'P', options: [], members: [] })
    expect(mockPost).toHaveBeenCalledWith(`${G}/group-existing/preview`, { name: 'P', options: [], members: [] })
    await s.applyGroupExisting('v1', { name: 'P', options: [], members: [] }, 'huella')
    expect(mockPost).toHaveBeenCalledWith(`${G}/group-existing`, { name: 'P', options: [], members: [], expectedFingerprint: 'huella' })
    await s.archiveProductGroup('v1', 'g1')
    expect(mockPost).toHaveBeenCalledWith(`${G}/g1/archive`)
    await s.ungroupProductGroup('v1', 'g1')
    expect(mockPost).toHaveBeenCalledWith(`${G}/g1/ungroup`)
    await s.detachVariant('v1', 'g1', 'p1')
    expect(mockPost).toHaveBeenCalledWith(`${G}/g1/variants/p1/detach`)
    await s.renameOptionValue('v1', 'g1', 'val1', 'Mediana')
    expect(mockPatch).toHaveBeenCalledWith(`${G}/g1/values/val1`, { value: 'Mediana' })
    await s.setVariantImage('v1', 'g1', 'p1', null)
    expect(mockPut).toHaveBeenCalledWith(`${G}/g1/variants/p1/image`, { imageUrl: null })
    await s.createLibraryOption('v1', { name: 'Talla', values: ['S'] })
    expect(mockPost).toHaveBeenCalledWith(O, { name: 'Talla', values: ['S'] })
    await s.updateLibraryOption('v1', 'o1', { name: 'Talla', values: ['S', 'M'] })
    expect(mockPut).toHaveBeenCalledWith(`${O}/o1`, { name: 'Talla', values: ['S', 'M'] })
    await s.deleteLibraryOption('v1', 'o1')
    expect(mockDelete).toHaveBeenCalledWith(`${O}/o1`)
  })

  it('«Desde Shopify» (bloque 5): el gid viaja codificado en la ruta y del cuerpo sólo va lo de Avoqado', async () => {
    const gid = 'gid://shopify/Product/12'
    const P = `${G}/shopify-proposals`
    const enRuta = `${P}/gid%3A%2F%2Fshopify%2FProduct%2F12`
    await s.listShopifyProposals('v1', { limit: 20 })
    expect(mockGet).toHaveBeenCalledWith(P, { params: { cursor: undefined, limit: 20 } })
    await s.listShopifyProposals('v1', { cursor: gid, limit: 20 })
    expect(mockGet).toHaveBeenLastCalledWith(P, { params: { cursor: gid, limit: 20 } })
    await s.previewShopifyProposal('v1', gid, { categoryId: 'c1' })
    expect(mockPost).toHaveBeenCalledWith(`${enRuta}/preview`, { categoryId: 'c1' })
    await s.applyShopifyProposal('v1', gid, { categoryId: 'c1' }, 'huella')
    expect(mockPost).toHaveBeenCalledWith(`${enRuta}/apply`, { categoryId: 'c1', expectedFingerprint: 'huella' })
    await s.previewAllShopifyProposals('v1', gid)
    expect(mockPost).toHaveBeenCalledWith(`${P}/preview-all`, { cursor: gid })
    await s.applyShopifyProposalsBatch('v1', [{ shopifyProductId: gid, fingerprint: 'h' }])
    expect(mockPost).toHaveBeenCalledWith(`${P}/apply-batch`, { items: [{ shopifyProductId: gid, fingerprint: 'h' }] })
  })
})
