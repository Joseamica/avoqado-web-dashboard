import { describe, expect, it } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { isMasterCatalogError, masterCatalogPath, parseMasterCatalogError } from './errors'

/**
 * Builds an AxiosError shaped exactly like the server envelope
 * (`src/app.ts` serializes AppError as `{ message, code?, details? }`).
 */
function axiosErrorWith(status: number, data: unknown): AxiosError {
  const error = new AxiosError('Request failed')
  error.response = {
    status,
    statusText: '',
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
    data,
  }
  return error
}

describe('parseMasterCatalogError', () => {
  describe('non-catalog errors keep legacy behavior', () => {
    it('returns null for an unrelated server error', () => {
      expect(parseMasterCatalogError(axiosErrorWith(500, { message: 'Boom' }))).toBeNull()
    })

    it('returns null for a validation error that carries no catalog code', () => {
      expect(parseMasterCatalogError(axiosErrorWith(400, { message: 'El nombre es requerido' }))).toBeNull()
    })

    it('returns null for a plain Error, a string, null and undefined', () => {
      expect(parseMasterCatalogError(new Error('network down'))).toBeNull()
      expect(parseMasterCatalogError('CATALOG_GOVERNANCE_REQUIRED')).toBeNull()
      expect(parseMasterCatalogError(null)).toBeNull()
      expect(parseMasterCatalogError(undefined)).toBeNull()
    })

    it('does not confuse an unrelated code that merely contains the word CATALOG', () => {
      expect(parseMasterCatalogError(axiosErrorWith(409, { message: 'x', code: 'CATALOG_SOMETHING_ELSE' }))).toBeNull()
    })

    it('isMasterCatalogError agrees with parse', () => {
      expect(isMasterCatalogError(axiosErrorWith(500, { message: 'Boom' }))).toBe(false)
      expect(isMasterCatalogError(axiosErrorWith(422, { message: 'x', code: 'CATALOG_GOVERNANCE_REQUIRED' }))).toBe(true)
    })
  })

  describe('CATALOG_GOVERNANCE_REQUIRED', () => {
    const raw = axiosErrorWith(422, {
      message: 'Este producto debe crearse o activarse desde el Catálogo maestro.',
      code: 'CATALOG_GOVERNANCE_REQUIRED',
      details: { action: 'OPEN_MASTER_CATALOG' },
    })

    it('is recognized, non-retryable and actionable', () => {
      const parsed = parseMasterCatalogError(raw)
      expect(parsed).not.toBeNull()
      expect(parsed?.code).toBe('CATALOG_GOVERNANCE_REQUIRED')
      expect(parsed?.status).toBe(422)
      expect(parsed?.nonRetryable).toBe(true)
      expect(parsed?.action).toBe('OPEN_MASTER_CATALOG')
    })

    it('preserves the server message verbatim so the user reads one voice', () => {
      expect(parseMasterCatalogError(raw)?.message).toBe('Este producto debe crearse o activarse desde el Catálogo maestro.')
    })

    it('exposes i18n keys plus Spanish defaults instead of hardcoded UI copy', () => {
      const parsed = parseMasterCatalogError(raw)
      expect(parsed?.titleKey).toBe('masterCatalog:errors.governanceRequired.title')
      expect(parsed?.descriptionKey).toBe('masterCatalog:errors.governanceRequired.description')
      expect(parsed?.defaultTitle.length).toBeGreaterThan(0)
      expect(parsed?.actionLabelKey).toBe('masterCatalog:errors.openMasterCatalog')
    })

    it('still parses when the server omits details', () => {
      const parsed = parseMasterCatalogError(axiosErrorWith(422, { message: 'x', code: 'CATALOG_GOVERNANCE_REQUIRED' }))
      expect(parsed?.code).toBe('CATALOG_GOVERNANCE_REQUIRED')
      expect(parsed?.rows).toEqual([])
    })

    it('derives the action from the code, not from details.action', () => {
      // The server sends `details.action` for governance but not for a code
      // collision, and both are resolved in the same screen. Gating the link on
      // the hint would silently drop it for the 409.
      const withHint = parseMasterCatalogError(raw)
      const withoutHint = parseMasterCatalogError(axiosErrorWith(422, { message: 'x', code: 'CATALOG_GOVERNANCE_REQUIRED' }))
      expect(withHint?.action).toBe('OPEN_MASTER_CATALOG')
      expect(withoutHint?.action).toBe('OPEN_MASTER_CATALOG')
    })
  })

  describe('per-row import diagnostics', () => {
    const importFailure = axiosErrorWith(422, {
      message: 'Este producto debe crearse o activarse desde el Catálogo maestro.',
      code: 'CATALOG_GOVERNANCE_REQUIRED',
      details: {
        action: 'OPEN_MASTER_CATALOG',
        total: 7,
        truncated: true,
        errors: [
          { categoryOrdinal: 1, productOrdinal: 3, sku: 'ABC-1', code: 'CATALOG_GOVERNANCE_REQUIRED' },
          { categoryOrdinal: 2, productOrdinal: 1, code: 'CATALOG_GOVERNANCE_REQUIRED' },
        ],
      },
    })

    it('surfaces each offending row instead of collapsing to one generic error', () => {
      const parsed = parseMasterCatalogError(importFailure)
      expect(parsed?.rows).toHaveLength(2)
      expect(parsed?.rows[0]).toEqual({
        categoryOrdinal: 1,
        productOrdinal: 3,
        sku: 'ABC-1',
        code: 'CATALOG_GOVERNANCE_REQUIRED',
      })
    })

    it('keeps sku null when the server bounded it away', () => {
      expect(parseMasterCatalogError(importFailure)?.rows[1].sku).toBeNull()
    })

    it('reports the true total and that the list was truncated', () => {
      const parsed = parseMasterCatalogError(importFailure)
      expect(parsed?.totalRows).toBe(7)
      expect(parsed?.truncated).toBe(true)
    })

    it('ignores malformed row entries rather than throwing mid-render', () => {
      const parsed = parseMasterCatalogError(
        axiosErrorWith(422, {
          message: 'x',
          code: 'CATALOG_GOVERNANCE_REQUIRED',
          details: { errors: [null, 'nope', 42, { code: 'CATALOG_GOVERNANCE_REQUIRED' }] },
        }),
      )
      expect(parsed?.rows).toHaveLength(1)
      expect(parsed?.rows[0].categoryOrdinal).toBeNull()
    })

    it('tolerates details.errors that is not an array', () => {
      const parsed = parseMasterCatalogError(
        axiosErrorWith(422, { message: 'x', code: 'CATALOG_GOVERNANCE_REQUIRED', details: { errors: 'boom' } }),
      )
      expect(parsed?.rows).toEqual([])
    })
  })

  describe('CODE_ALREADY_ASSIGNED (H1B forward-compatibility)', () => {
    const raw = axiosErrorWith(409, {
      message: 'Ese código ya está asignado a otro producto.',
      code: 'CODE_ALREADY_ASSIGNED',
      details: { field: 'gtin', existingProductId: 'cmxyz123' },
    })

    it('is recognized, non-retryable and actionable', () => {
      const parsed = parseMasterCatalogError(raw)
      expect(parsed?.code).toBe('CODE_ALREADY_ASSIGNED')
      expect(parsed?.status).toBe(409)
      expect(parsed?.nonRetryable).toBe(true)
      expect(parsed?.action).toBe('OPEN_MASTER_CATALOG')
    })

    it('carries the conflicting field and existing product so the UI can point at it', () => {
      const parsed = parseMasterCatalogError(raw)
      expect(parsed?.field).toBe('gtin')
      expect(parsed?.existingProductId).toBe('cmxyz123')
    })

    it('drops non-string field/existingProductId instead of leaking objects into copy', () => {
      const parsed = parseMasterCatalogError(
        axiosErrorWith(409, { message: 'x', code: 'CODE_ALREADY_ASSIGNED', details: { field: { a: 1 }, existingProductId: 9 } }),
      )
      expect(parsed?.field).toBeNull()
      expect(parsed?.existingProductId).toBeNull()
    })
  })

  describe('CATALOG_GOVERNANCE_DEPENDENCY_UNAVAILABLE', () => {
    const raw = axiosErrorWith(503, {
      message: 'No fue posible validar el gobierno del Catálogo maestro.',
      code: 'CATALOG_GOVERNANCE_DEPENDENCY_UNAVAILABLE',
    })

    it('is recognized as a transient dependency failure, not a governance verdict', () => {
      const parsed = parseMasterCatalogError(raw)
      expect(parsed?.code).toBe('CATALOG_GOVERNANCE_DEPENDENCY_UNAVAILABLE')
      expect(parsed?.status).toBe(503)
      expect(parsed?.nonRetryable).toBe(false)
    })

    it('offers no master-catalog link, because opening the catalog fixes nothing here', () => {
      expect(parseMasterCatalogError(raw)?.action).toBeNull()
    })
  })

  describe('masterCatalogPath', () => {
    it('builds the organization-scoped path the router will register', () => {
      expect(masterCatalogPath('org_123')).toBe('/organizations/org_123/master-catalog')
    })

    it('encodes the organization id', () => {
      expect(masterCatalogPath('a/b')).toBe('/organizations/a%2Fb/master-catalog')
    })

    it('returns null when there is no organization to link to', () => {
      expect(masterCatalogPath(null)).toBeNull()
      expect(masterCatalogPath('')).toBeNull()
      expect(masterCatalogPath('   ')).toBeNull()
    })
  })
})
