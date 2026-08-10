import type { CatalogItemCommand, CatalogItemDetail, CatalogOrganizationValueInput, CatalogReference } from './types'

function organizationValueKey(value: { kind: string; currency: string }): string {
  return `${value.kind}:${value.currency}`
}

/**
 * The update API treats every active organization value as durable authority.
 * Preserve currencies the compact editor does not expose and attach the exact
 * rule revision so a concurrent price change fails instead of being erased.
 */
export function prepareCatalogItemUpdate(item: CatalogItemDetail, command: CatalogItemCommand) {
  const submittedByKey = new Map(command.organizationValues.map(value => [organizationValueKey(value), value]))
  const activeValues = item.organizationValues.filter(value => value.active)
  const organizationValues: CatalogOrganizationValueInput[] = activeValues.map(value => {
    const submitted = submittedByKey.get(organizationValueKey(value))
    submittedByKey.delete(organizationValueKey(value))
    return {
      kind: value.kind,
      amount: submitted?.amount ?? value.amount,
      currency: value.currency,
      expectedRuleRevision: value.revision,
    }
  })

  organizationValues.push(...submittedByKey.values())

  return {
    ...command,
    organizationValues,
    expectedRevision: item.revision,
    organizationValueDeactivations: [],
  }
}

export function catalogLeafFamilies(references: CatalogReference[]): CatalogReference[] {
  return references.filter(reference => reference.status === 'ACTIVE' && reference.parent?.status === 'ACTIVE')
}
