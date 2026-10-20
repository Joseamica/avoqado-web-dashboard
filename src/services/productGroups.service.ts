/**
 * Familias de productos («productos con variantes») y biblioteca de opciones. Contrato del bloque 1 del server.
 * Leer: menu:read, sin candado. Crear y agregar variantes: menu:create. Editar, agrupar, separar, deshacer, renombrar, foto:
 * menu:update. Archivar: menu:delete. Biblioteca: menu:create. Candado PRODUCT_VARIANTS en todo lo que crea, crece o edita
 * (también la biblioteca); reducir (archivar, deshacer, separar) no lo lleva. El server envuelve el éxito en { success, data }.
 */
import api from '@/api'
import type {
  AddVariantsBody,
  ArchivedVariant,
  CreateGroupBody,
  CursorPage,
  GroupExistingBody,
  GroupExistingPreview,
  GroupSuggestion,
  OptionLibraryBody,
  OptionLibraryItem,
  OptionLibraryListItem,
  Paged,
  ProductGroupDetail,
  ProductGroupListItem,
  ProductGroupWriteResult,
  ShopifyBatchResult,
  ShopifyChoices,
  ShopifyFileProposalsResponse,
  ShopifyPreviewAllPage,
  ShopifyProposal,
  ShopifyProposalPreview,
  UpdateGroupBody,
} from '@/types/productGroup'

const groups = (venueId: string) => `/api/v1/dashboard/venues/${venueId}/product-groups`
const library = (venueId: string) => `/api/v1/dashboard/venues/${venueId}/product-options`
const texto = (q?: string) => q?.trim() || undefined
const data = <T>(r: { data: { data: T } }): T => r.data.data

interface PageParams {
  page: number
  pageSize: number
}

export const listProductGroups = async (venueId: string, p: PageParams & { search?: string }) =>
  data<Paged<ProductGroupListItem>>(
    await api.get(groups(venueId), { params: { page: p.page, pageSize: p.pageSize, search: texto(p.search) } }),
  )

export const getProductGroup = async (venueId: string, groupId: string) =>
  data<ProductGroupDetail>(await api.get(`${groups(venueId)}/${groupId}`))

export const getArchivedVariants = async (venueId: string, groupId: string, p: PageParams) =>
  data<Paged<ArchivedVariant>>(await api.get(`${groups(venueId)}/${groupId}/archived`, { params: p }))

export const getGroupSuggestions = async (venueId: string, p: PageParams) =>
  data<Paged<GroupSuggestion>>(await api.get(`${groups(venueId)}/suggestions`, { params: p }))

export const previewGroupExisting = async (venueId: string, body: GroupExistingBody) =>
  data<GroupExistingPreview>(await api.post(`${groups(venueId)}/group-existing/preview`, body))

/** El body debe ser IDÉNTICO al de la vista previa (la huella lo compara). */
export const applyGroupExisting = async (venueId: string, body: GroupExistingBody, expectedFingerprint: string) =>
  data<ProductGroupWriteResult>(await api.post(`${groups(venueId)}/group-existing`, { ...body, expectedFingerprint }))

/** El archivo viaja como texto en JSON (≤ 900 KB); el server no acepta multipart aquí. */
export const shopifyFileProposals = async (venueId: string, csv: string) =>
  data<ShopifyFileProposalsResponse>(await api.post(`${groups(venueId)}/shopify-file/proposals`, { csv }))

// «Desde Shopify» (bloque 5). El gid (`gid://shopify/Product/1`) va codificado en la ruta.
const propuestas = (venueId: string) => `${groups(venueId)}/shopify-proposals`
const propuesta = (venueId: string, shopifyProductId: string) => `${propuestas(venueId)}/${encodeURIComponent(shopifyProductId)}`

export const listShopifyProposals = async (venueId: string, q: { cursor?: string; limit: number }) =>
  data<CursorPage<ShopifyProposal>>(await api.get(propuestas(venueId), { params: { cursor: q.cursor, limit: q.limit } }))

export const previewShopifyProposal = async (venueId: string, shopifyProductId: string, choices: ShopifyChoices) =>
  data<ShopifyProposalPreview>(await api.post(`${propuesta(venueId, shopifyProductId)}/preview`, choices))

/** `choices` debe ser IDÉNTICO al de la vista previa (la huella lo cubre). */
export const applyShopifyProposal = async (
  venueId: string,
  shopifyProductId: string,
  choices: ShopifyChoices,
  expectedFingerprint: string,
) =>
  data<ProductGroupWriteResult & { mode: 'CREATE' | 'ADD' }>(
    await api.post(`${propuesta(venueId, shopifyProductId)}/apply`, { ...choices, expectedFingerprint }),
  )

/** «Agrupar todas», paso 1: hasta 25 vistas previas completas por página, y las bloqueadas aparte con su motivo. */
export const previewAllShopifyProposals = async (venueId: string, cursor?: string) =>
  data<ShopifyPreviewAllPage>(await api.post(`${propuestas(venueId)}/preview-all`, { cursor }))

/** «Agrupar todas», paso 2: EXACTAMENTE los pares que se vieron, hasta 25 por llamada. */
export const applyShopifyProposalsBatch = async (venueId: string, items: Array<{ shopifyProductId: string; fingerprint: string }>) =>
  data<ShopifyBatchResult>(await api.post(`${propuestas(venueId)}/apply-batch`, { items }))

export const createProductGroup = async (venueId: string, body: CreateGroupBody) =>
  data<ProductGroupWriteResult>(await api.post(groups(venueId), body))

export const updateProductGroup = async (venueId: string, groupId: string, body: UpdateGroupBody) =>
  data<ProductGroupWriteResult>(await api.patch(`${groups(venueId)}/${groupId}`, body))

/** El server exige `variants` aunque sólo se agreguen valores u opciones. */
export const addVariants = async (venueId: string, groupId: string, body: AddVariantsBody) =>
  data<ProductGroupWriteResult>(await api.post(`${groups(venueId)}/${groupId}/variants`, { ...body, variants: body.variants ?? [] }))

export const archiveProductGroup = async (venueId: string, groupId: string) =>
  data<ProductGroupWriteResult>(await api.post(`${groups(venueId)}/${groupId}/archive`))

export const ungroupProductGroup = async (venueId: string, groupId: string) =>
  data<ProductGroupWriteResult>(await api.post(`${groups(venueId)}/${groupId}/ungroup`))

/** Si era la última viva, el server archiva la familia; la respuesta no lo dice: hay que releer. */
export const detachVariant = async (venueId: string, groupId: string, productId: string) =>
  data<ProductGroupWriteResult>(await api.post(`${groups(venueId)}/${groupId}/variants/${productId}/detach`))

export const renameOptionValue = async (venueId: string, groupId: string, optionValueId: string, value: string) =>
  data<ProductGroupWriteResult>(await api.patch(`${groups(venueId)}/${groupId}/values/${optionValueId}`, { value }))

/** `null` quita la foto propia y vuelve la del padre. */
export const setVariantImage = async (venueId: string, groupId: string, productId: string, imageUrl: string | null) =>
  data<ProductGroupWriteResult>(await api.put(`${groups(venueId)}/${groupId}/variants/${productId}/image`, { imageUrl }))

export const listOptionLibrary = async (venueId: string, p: PageParams) =>
  data<Paged<OptionLibraryListItem>>(await api.get(library(venueId), { params: p }))

export const createLibraryOption = async (venueId: string, body: OptionLibraryBody) =>
  data<OptionLibraryItem>(await api.post(library(venueId), body))

/** Reemplaza TODOS los valores (los ids de los valores cambian en cada guardado). */
export const updateLibraryOption = async (venueId: string, optionId: string, body: OptionLibraryBody) =>
  data<OptionLibraryItem>(await api.put(`${library(venueId)}/${optionId}`, body))

export const deleteLibraryOption = async (venueId: string, optionId: string) =>
  data<{ id: string; deleted: true }>(await api.delete(`${library(venueId)}/${optionId}`))
