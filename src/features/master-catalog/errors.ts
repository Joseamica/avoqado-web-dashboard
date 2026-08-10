/**
 * One place that turns a master-catalog API failure into something a writer UI
 * can show.
 *
 * Create product, edit product, the inventory wizard and the legacy menu import
 * all hit the same governance rules. Four independent `error.response.data.code`
 * checks drift into four subtly different messages, so they share this instead.
 *
 * Two rules this module exists to enforce:
 *  - It returns `null` for anything that is not a master-catalog error, so the
 *    caller keeps its existing legacy handling untouched.
 *  - It never produces user-facing copy directly. It returns i18n keys plus a
 *    Spanish `defaultValue`, because `src/locales/**` belongs to another task.
 */

export type MasterCatalogErrorCode = 'CATALOG_GOVERNANCE_REQUIRED' | 'CODE_ALREADY_ASSIGNED' | 'CATALOG_GOVERNANCE_DEPENDENCY_UNAVAILABLE'

export type MasterCatalogErrorAction = 'OPEN_MASTER_CATALOG'

export interface MasterCatalogRowError {
  /** 1-based position of the category in the imported file. */
  categoryOrdinal: number | null
  /** 1-based position of the product inside that category. */
  productOrdinal: number | null
  /** Absent when the server bounded it away for size. */
  sku: string | null
  code: MasterCatalogErrorCode
}

export interface MasterCatalogErrorInfo {
  code: MasterCatalogErrorCode
  status: number | null
  /** The server message, verbatim — it is already written for the end user. */
  message: string
  /** True when retrying the exact same request can only fail the same way. */
  nonRetryable: boolean
  action: MasterCatalogErrorAction | null
  titleKey: string
  defaultTitle: string
  descriptionKey: string
  defaultDescription: string
  actionLabelKey: string
  defaultActionLabel: string
  /** Per-row diagnostics for bulk writers. Empty for single-item writers. */
  rows: MasterCatalogRowError[]
  /** How many rows actually failed, which can exceed `rows.length`. */
  totalRows: number | null
  truncated: boolean
  /** Conflicting identifier field, when the server names one. */
  field: string | null
  existingProductId: string | null
}

interface CodeDescriptor {
  nonRetryable: boolean
  action: MasterCatalogErrorAction | null
  titleKey: string
  defaultTitle: string
  descriptionKey: string
  defaultDescription: string
}

const DESCRIPTORS: Record<MasterCatalogErrorCode, CodeDescriptor> = {
  CATALOG_GOVERNANCE_REQUIRED: {
    nonRetryable: true,
    action: 'OPEN_MASTER_CATALOG',
    titleKey: 'masterCatalog:errors.governanceRequired.title',
    defaultTitle: 'Este producto se da de alta en el Catálogo maestro',
    descriptionKey: 'masterCatalog:errors.governanceRequired.description',
    defaultDescription:
      'Tu organización activó el Catálogo maestro, así que los productos que se venden se crean ahí y se publican a las sucursales. Volver a intentarlo aquí no va a funcionar.',
  },
  CODE_ALREADY_ASSIGNED: {
    nonRetryable: true,
    action: 'OPEN_MASTER_CATALOG',
    titleKey: 'masterCatalog:errors.codeAlreadyAssigned.title',
    defaultTitle: 'Ese código ya está en uso',
    descriptionKey: 'masterCatalog:errors.codeAlreadyAssigned.description',
    defaultDescription: 'Otro producto ya tiene ese código. Búscalo en el Catálogo maestro y edítalo ahí, o usa un código distinto.',
  },
  CATALOG_GOVERNANCE_DEPENDENCY_UNAVAILABLE: {
    // Transient by nature: the catalog could not be consulted, so nothing was
    // decided. Opening the catalog fixes nothing, hence no action.
    nonRetryable: false,
    action: null,
    titleKey: 'masterCatalog:errors.dependencyUnavailable.title',
    defaultTitle: 'No pudimos consultar el Catálogo maestro',
    descriptionKey: 'masterCatalog:errors.dependencyUnavailable.description',
    defaultDescription: 'El servicio del catálogo no respondió, así que no se guardó nada. Inténtalo de nuevo en un momento.',
  },
}

const ACTION_LABEL_KEY = 'masterCatalog:errors.openMasterCatalog'
const ACTION_LABEL_DEFAULT = 'Ir al Catálogo maestro'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asMasterCatalogCode(value: unknown): MasterCatalogErrorCode | null {
  return typeof value === 'string' && value in DESCRIPTORS ? (value as MasterCatalogErrorCode) : null
}

function asPositiveOrdinal(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

/**
 * Pulls `{ message, code, details }` out of an Axios failure.
 *
 * Deliberately structural instead of `axios.isAxiosError`: a rejection that
 * crossed a wrapper or a retry helper can lose its prototype and would then be
 * misread as an unrelated error.
 */
function readResponse(error: unknown): { status: number | null; body: Record<string, unknown> } | null {
  if (!isRecord(error)) return null

  const response = error.response
  if (!isRecord(response)) return null

  const body = response.data
  if (!isRecord(body)) return null

  return { status: typeof response.status === 'number' ? response.status : null, body }
}

function parseRows(details: Record<string, unknown> | null, fallbackCode: MasterCatalogErrorCode): MasterCatalogRowError[] {
  if (!details || !Array.isArray(details.errors)) return []

  const rows: MasterCatalogRowError[] = []
  for (const entry of details.errors) {
    if (!isRecord(entry)) continue
    rows.push({
      categoryOrdinal: asPositiveOrdinal(entry.categoryOrdinal),
      productOrdinal: asPositiveOrdinal(entry.productOrdinal),
      sku: asNonEmptyString(entry.sku),
      code: asMasterCatalogCode(entry.code) ?? fallbackCode,
    })
  }
  return rows
}

/**
 * Returns structured information for a master-catalog failure, or `null` when
 * the error is anything else — including a catalog-adjacent code we do not own.
 */
export function parseMasterCatalogError(error: unknown): MasterCatalogErrorInfo | null {
  const response = readResponse(error)
  if (!response) return null

  const code = asMasterCatalogCode(response.body.code)
  if (!code) return null

  const descriptor = DESCRIPTORS[code]
  const details = isRecord(response.body.details) ? response.body.details : null

  return {
    code,
    status: response.status,
    message: asNonEmptyString(response.body.message) ?? descriptor.defaultTitle,
    nonRetryable: descriptor.nonRetryable,
    // Implied by the code, not by `details.action`: the server sends that hint
    // for governance but not for a code collision, and both are fixed in the
    // same place. Whether the link is actually RENDERED is the caller's call —
    // it must check `useMasterCatalogAccess().canRead` first, or a venue-level
    // user gets a link that bounces them straight back.
    action: descriptor.action,
    titleKey: descriptor.titleKey,
    defaultTitle: descriptor.defaultTitle,
    descriptionKey: descriptor.descriptionKey,
    defaultDescription: descriptor.defaultDescription,
    actionLabelKey: ACTION_LABEL_KEY,
    defaultActionLabel: ACTION_LABEL_DEFAULT,
    rows: parseRows(details, code),
    totalRows: typeof details?.total === 'number' ? details.total : null,
    truncated: details?.truncated === true,
    field: asNonEmptyString(details?.field),
    existingProductId: asNonEmptyString(details?.existingProductId),
  }
}

export function isMasterCatalogError(error: unknown): boolean {
  return parseMasterCatalogError(error) !== null
}

/**
 * Where the "go fix it" link points. Returns `null` when there is no
 * organization in scope, so the caller renders the message without a dead link.
 */
export function masterCatalogPath(organizationId: string | null | undefined): string | null {
  const trimmed = organizationId?.trim()
  if (!trimmed) return null
  return `/organizations/${encodeURIComponent(trimmed)}/master-catalog`
}

type TranslateMasterCatalogError = (key: string, options?: Record<string, unknown> & { defaultValue?: string }) => string

export interface MasterCatalogErrorPresentation {
  info: MasterCatalogErrorInfo
  title: string
  description: string
  actionLabel: string
  actionPath: string | null
}

export function buildMasterCatalogErrorPresentation(
  error: unknown,
  options: {
    organizationId: string | null | undefined
    canRead: boolean
    t: TranslateMasterCatalogError
  },
): MasterCatalogErrorPresentation | null {
  const info = parseMasterCatalogError(error)
  if (!info) return null

  return {
    info,
    title: options.t(info.titleKey, { defaultValue: info.defaultTitle }),
    description: options.t(info.descriptionKey, { defaultValue: info.defaultDescription }),
    actionLabel: options.t(info.actionLabelKey, { defaultValue: info.defaultActionLabel }),
    actionPath: info.action === 'OPEN_MASTER_CATALOG' && options.canRead ? masterCatalogPath(options.organizationId) : null,
  }
}

export function describeMasterCatalogRowError(row: MasterCatalogRowError, t: TranslateMasterCatalogError): string {
  const descriptor = DESCRIPTORS[row.code]
  const location = t('masterCatalog:errors.importRow', {
    category: row.categoryOrdinal ?? '?',
    product: row.productOrdinal ?? '?',
    sku: row.sku ?? '—',
    defaultValue: `Categoría ${row.categoryOrdinal ?? '?'}, producto ${row.productOrdinal ?? '?'}, SKU ${row.sku ?? '—'}`,
  })
  const reason = t(descriptor.titleKey, { defaultValue: descriptor.defaultTitle })
  return `${location}: ${reason}`
}
