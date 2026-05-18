/**
 * Device-compatibility banner (Task 17, spec §5.2).
 *
 * Front-end surfacing of the rule enforced server-side by
 * `assertVenueHasCompatibleTerminal` (Task 10) and
 * `assertMerchantTerminalCompatible` (Task 11): a venue must have at least
 * one ACTIVE terminal of a brand compatible with the selected provider
 * before a MerchantAccount can be created for that combination.
 *
 * The map lives in `@/lib/providerDeviceCompatibility` and MIRRORS the
 * canonical backend constant — Task 20 wires up a CI test that fails on
 * drift.
 *
 * UX contract:
 *   - Unconstrained provider (not in map)  → render nothing.
 *   - Constraint + ≥1 compatible terminal  → neutral Alert (informational).
 *   - Constraint + 0 compatible terminals  → destructive Alert + CTA hint;
 *                                            parent disables submit via
 *                                            `onCompatibilityChange(false)`.
 *
 * The parent stays in control of submit-disable so we don't have to share
 * a global "form valid" registry — `onCompatibilityChange` is the only
 * cross-cutting signal we emit.
 */

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { getCompatibleBrandsFor } from '@/lib/providerDeviceCompatibility'
import { TerminalStatus, terminalAPI, type Terminal } from '@/services/superadmin-terminals.service'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import React, { useEffect, useMemo } from 'react'

export interface DeviceCompatibilityBannerProps {
  /** Provider code (e.g. 'ANGELPAY', 'BLUMON'). Drives the brand lookup. */
  providerCode: string
  /** Venue scope. Banner is a no-op when empty (no venue selected yet). */
  venueId: string
  /**
   * Notified on every transition. `true` when the provider is unconstrained
   * OR the venue has ≥1 compatible ACTIVE terminal. Parent should disable
   * submit on `false`.
   */
  onCompatibilityChange?: (compatible: boolean) => void
  /**
   * Optional inline CTA. When provided AND the destructive (0 compatible
   * terminals) branch renders, we mount a small "Registrar terminal {brand}"
   * Button under the description so the operator can launch a nested
   * TerminalDialog without leaving the create-account flow.
   */
  onRegisterTerminal?: () => void
}

export const DeviceCompatibilityBanner: React.FC<DeviceCompatibilityBannerProps> = ({
  providerCode,
  venueId,
  onCompatibilityChange,
  onRegisterTerminal,
}) => {
  const compatibleBrands = useMemo(() => getCompatibleBrandsFor(providerCode), [providerCode])
  const constrained = compatibleBrands !== null

  // Only fetch when both a constrained provider AND a venue are selected.
  // Re-fetches whenever the operator switches venue or provider.
  const {
    data: terminals = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['superadmin-terminals', 'by-venue', venueId, providerCode],
    queryFn: () => terminalAPI.getAllTerminals({ venueId }),
    enabled: constrained && !!venueId,
  })

  const compatibleCount = useMemo(() => {
    if (!constrained || !compatibleBrands) return 0
    return terminals.filter(
      (t: Terminal) => t.status === TerminalStatus.ACTIVE && t.brand && compatibleBrands.includes(t.brand),
    ).length
  }, [constrained, compatibleBrands, terminals])

  // Compute the boolean we report up. While loading we report `true`
  // (don't pre-disable submit on a not-yet-known answer); the destructive
  // state only fires after the fetch resolves with 0 matches.
  const compatible = useMemo(() => {
    if (!constrained) return true
    if (!venueId) return true
    if (isLoading || isError) return true
    return compatibleCount > 0
  }, [constrained, venueId, isLoading, isError, compatibleCount])

  useEffect(() => {
    onCompatibilityChange?.(compatible)
  }, [compatible, onCompatibilityChange])

  // Render-time short-circuits — keep the constraint logic above pure so the
  // parent's `compatible` signal stays stable independent of what we paint.
  if (!constrained) return null
  if (!venueId) return null
  if (isLoading) return null

  const brandLabel = compatibleBrands!.join(' o ')

  if (compatibleCount === 0) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Sin terminales compatibles</AlertTitle>
        <AlertDescription>
          <p>
            {providerCode} solo opera en terminales <strong>{brandLabel}</strong>. Este venue no tiene ninguna terminal{' '}
            <strong>{brandLabel}</strong> activa.
          </p>
          <p className="text-xs">
            Registra primero una terminal {brandLabel} para este venue antes de crear la cuenta de comercio.
          </p>
          {onRegisterTerminal && (
            <div className="mt-2">
              <Button type="button" size="sm" variant="outline" onClick={onRegisterTerminal}>
                Registrar terminal {brandLabel}
              </Button>
            </div>
          )}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Alert variant="default">
      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
      <AlertTitle>Hardware compatible</AlertTitle>
      <AlertDescription>
        {providerCode} solo opera en terminales <strong>{brandLabel}</strong>. Este venue tiene{' '}
        <strong>
          {compatibleCount} {compatibleCount === 1 ? `terminal ${brandLabel} activa` : `terminales ${brandLabel} activas`}
        </strong>
        .
      </AlertDescription>
    </Alert>
  )
}

/**
 * Lightweight read-only icon variant used inline where a full Alert would be
 * too heavy (e.g. inside a select option label). Currently unused but kept
 * exported so future call sites (Task 18 terminal assignment view) don't
 * re-implement the brand-list rendering.
 */
export function ProviderCompatibilityHint({ providerCode }: { providerCode: string }) {
  const brands = getCompatibleBrandsFor(providerCode)
  if (!brands) return null
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Info className="h-3 w-3" />
      Solo {brands.join(' o ')}
    </span>
  )
}

export default DeviceCompatibilityBanner
