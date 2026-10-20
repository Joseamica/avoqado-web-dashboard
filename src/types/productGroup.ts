/**
 * Contrato del bloque 1 de «Variantes de producto» (server, rama feat/variantes-producto 0472d10bf).
 * Fuente: Apéndice A del plan del bloque 2. El server NUNCA manda un campo `variants` en un producto.
 */
export type AllowedGroupType = 'REGULAR' | 'FOOD_AND_BEV' | 'RETAIL' | 'FOOD' | 'BEVERAGE' | 'ALCOHOL' | 'OTHER'
export const ALLOWED_GROUP_TYPES: readonly AllowedGroupType[] = ['REGULAR', 'FOOD_AND_BEV', 'RETAIL', 'FOOD', 'BEVERAGE', 'ALCOHOL', 'OTHER']
export type IvaElegible = 'IVA_16' | 'IVA_0' | 'EXENTO'

export interface VariantOption {
  name: string
  value: string
  namePosition: number
  valuePosition: number
}

export interface OptionInput {
  name: string
  values: string[]
}

export interface VariantRowInput {
  values: string[]
  price: number
  cost?: number | null
  sku?: string | null
  gtin?: string | null
  initialStock?: number | null
  variantImageUrl?: string | null
}

export interface ParentFields {
  description?: string | null
  imageUrl?: string | null
  type?: string
  ivaTratamiento?: IvaElegible
  satProductKey?: string | null
  satUnitKey?: string | null
  printStationId?: string | null
  modifierGroupIds?: string[]
}

export interface CreateGroupBody extends ParentFields {
  name: string
  categoryId: string
  trackInventory?: boolean
  options: OptionInput[]
  variants: VariantRowInput[]
}

export interface UpdateGroupBody extends ParentFields {
  name?: string
  categoryId?: string
}

export interface AddVariantsBody {
  newValues?: Array<{ optionName: string; values: string[] }>
  newOptions?: Array<{ name: string; values: string[]; defaultValueForExisting: string }>
  variants: VariantRowInput[]
}

export interface ProductGroupWriteResult {
  groupId: string
  productIds: string[]
  categoryId: string
}

export interface ProductGroupVariant {
  id: string
  name: string
  sku: string
  gtin: string | null
  price: number
  cost: number | null
  active: boolean
  variantImageUrl: string | null
  values: string[]
  stock: number | null
}

export interface ProductGroupDetail {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  categoryId: string
  type: string
  ivaTratamiento: string
  satProductKey: string | null
  satUnitKey: string | null
  printStationId: string | null
  source: 'MANUAL' | 'SHOPIFY'
  modifierGroupIds: string[]
  options: Array<{ id: string; name: string; position: number; values: Array<{ id: string; value: string; position: number }> }>
  variants: ProductGroupVariant[]
  archivedCount: number
  archived: boolean
  archivedAt: string | null
}

export interface ProductGroupListItem {
  id: string
  name: string
  imageUrl: string | null
  categoryId: string
  variantCount: number
  minPrice: number | null
  maxPrice: number | null
}

export interface Paged<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface ArchivedVariant {
  id: string
  name: string
  sku: string
  archivedAt: string
}

export interface GroupSuggestion {
  key: string
  parentName: string
  optionNames: string[]
  memberCount: number
  members: Array<{ productId: string; name: string; sku: string; values: string[] }>
}

export interface GroupExistingBody extends ParentFields {
  name: string
  categoryId?: string
  options: OptionInput[]
  members: Array<{ productId: string; values: string[] }>
}

export interface GroupExistingPreview {
  parent: {
    name: string
    categoryId: string
    type: string
    ivaTratamiento: string
    description: string | null
    imageUrl: string | null
    printStationId: string | null
    satProductKey: string | null
    satUnitKey: string | null
    modifierGroupIds: string[]
  }
  options: OptionInput[]
  members: Array<{ productId: string; sku: string; currentName: string; newName: string; values: string[]; changes: string[] }>
  warnings: string[]
  fingerprint: string
  firstMemberIva: string
}

export interface ShopifyFileProposal {
  handle: string
  parentName: string
  options: OptionInput[]
  members: Array<{ productId: string; name: string; values: string[] }>
  unmatched: string[]
  conflicts: string[]
}

export interface ShopifyFileProposalsResponse {
  proposals: ShopifyFileProposal[]
  skippedHandles: number
  skipped: Array<{ handle: string; conflicts: string[]; unmatched: string[] }>
}

export interface OptionLibraryListItem {
  id: string
  name: string
  values: Array<{ id: string; value: string; sortOrder: number }>
  valuesTotal: number
  valuesTruncated: boolean
}

export interface OptionLibraryItem {
  id: string
  venueId: string
  name: string
  values: Array<{ id: string; value: string; sortOrder: number }>
  createdAt: string
}

export interface OptionLibraryBody {
  name: string
  values: string[]
}

/** «Desde Shopify» (bloque 5, server `shopifyFamilies.service.ts`): un renglón por producto de Shopify con tallas sueltas ligadas. */
export interface ShopifyProposal {
  shopifyProductId: string
  mode: 'CREATE' | 'ADD'
  groupId: string | null
  groupName: string | null
  /** null: ninguna pareja trae todavía el título de Shopify. */
  title: string | null
  /** false: alguna pareja se ligó antes del bloque 5 y se completa en la próxima sincronización. */
  ready: boolean
  blockedReason: string | null
  members: Array<{ productId: string; name: string; sku: string }>
}

export interface CursorPage<T> {
  items: T[]
  total: number
  nextCursor: string | null
}

/** Lo de Avoqado que el dueño elige al crear (nombre, opciones y miembros los arma el server con lo que dijo Shopify). */
export interface ShopifyChoices {
  categoryId?: string
  ivaTratamiento?: string
  printStationId?: string | null
  modifierGroupIds?: string[]
}

export interface ShopifySkippedMember {
  productId: string
  name: string
  motivo: string
}

export type ShopifyProposalPreview = GroupExistingPreview & {
  mode: 'CREATE' | 'ADD'
  groupId: string | null
  skipped: ShopifySkippedMember[]
}

export interface ShopifyPreviewAllPage {
  items: Array<{ shopifyProductId: string; mode: 'CREATE' | 'ADD'; groupName: string; preview: ShopifyProposalPreview }>
  blocked: Array<{ shopifyProductId: string; motivo: string }>
  total: number
  nextCursor: string | null
}

export interface ShopifyBatchResult {
  applied: Array<{ shopifyProductId: string; groupId: string; mode: 'CREATE' | 'ADD' }>
  skipped: Array<{ shopifyProductId: string; motivo: string; groupId?: string }>
}
