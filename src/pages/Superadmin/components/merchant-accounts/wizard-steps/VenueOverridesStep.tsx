import React, { useEffect, useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { Store, ChevronDown, ChevronRight, Building2, Search, X, Info } from 'lucide-react'
import type { WizardState, WizardContext, PricingData } from '../PaymentSetupWizard'

interface VenueOverridesStepProps {
  state: WizardState
  dispatch: React.Dispatch<any>
  context: WizardContext
}

const RATE_FIELDS: Array<{ key: keyof PricingData; label: string }> = [
  { key: 'debitRate', label: 'Débito' },
  { key: 'creditRate', label: 'Crédito' },
  { key: 'amexRate', label: 'AMEX' },
  { key: 'internationalRate', label: 'Internacional' },
]

export const VenueOverridesStep: React.FC<VenueOverridesStepProps> = ({ state, dispatch, context }) => {
  const [search, setSearch] = useState('')

  // Fetch org venues
  const { data: orgDetail, isLoading } = useQuery({
    queryKey: ['org-detail-for-wizard', context.organizationId],
    queryFn: async () => {
      const { getOrganizationById } = await import('@/services/superadmin-organizations.service')
      return getOrganizationById(context.organizationId)
    },
  })

  // Initialize venue overrides when org data arrives
  useEffect(() => {
    if (!orgDetail?.venues) return
    dispatch({
      type: 'INIT_VENUE_OVERRIDES',
      venues: orgDetail.venues.map(v => ({ id: v.id, name: v.name, slug: v.slug })),
    })

    // If opened from a specific venue, auto-enable its override
    if (context.initialVenueId && orgDetail.venues.some(v => v.id === context.initialVenueId)) {
      const existing = state.venueOverrides[context.initialVenueId]
      if (!existing?.enabled) {
        dispatch({ type: 'TOGGLE_VENUE_OVERRIDE', venueId: context.initialVenueId })
      }
    }
  }, [orgDetail?.venues, context.initialVenueId]) // eslint-disable-line react-hooks/exhaustive-deps

  const orgPricing = state.pricing.PRIMARY
  const venues = Object.values(state.venueOverrides)

  const filteredVenues = useMemo(() => {
    if (!search) return venues
    const q = search.toLowerCase()
    return venues.filter(
      v => v.venueName.toLowerCase().includes(q) || v.venueSlug.toLowerCase().includes(q),
    )
  }, [venues, search])

  const enabledCount = venues.filter(v => v.enabled).length

  const handlePricingChange = (venueId: string, field: keyof PricingData, value: string) => {
    const numValue = value === '' ? 0 : parseFloat(value)
    if (isNaN(numValue)) return
    const rounded = Math.round(numValue * 10000) / 10000
    const current = state.venueOverrides[venueId]?.pricing
    if (!current) return
    dispatch({
      type: 'SET_VENUE_PRICING',
      venueId,
      data: { ...current, [field]: rounded },
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-border/50 bg-card p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-xl bg-purple-500/10">
            <Store className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold">Tarifas por Sucursal</h3>
            <p className="text-sm text-muted-foreground">
              Configura tarifas personalizadas para sucursales específicas
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            Por defecto, todas las sucursales usan las tarifas de la organización (paso Pricing).
            Si una sucursal necesita tarifas distintas, activa el toggle para asignarle tarifas propias.
          </span>
        </div>
      </div>

      {/* Org defaults reminder */}
      {orgPricing && (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Tarifas de la organización (aplican a todos)</span>
            </div>
            {venues.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {enabledCount} personalizada{enabledCount !== 1 ? 's' : ''} de {venues.length} sucursal{venues.length !== 1 ? 'es' : ''}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-2">
            {RATE_FIELDS.map(f => (
              <span key={f.key}>
                {f.label}: <strong>{orgPricing[f.key].toFixed(2)}%</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      {venues.length > 3 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar sucursal por nombre o slug..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 h-10"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Venue list */}
      {isLoading ? (
        <div className="rounded-2xl border border-border/50 bg-card p-8 text-center text-muted-foreground">
          Cargando sucursales de la organización...
        </div>
      ) : venues.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-card p-8 text-center text-muted-foreground">
          Esta organización no tiene sucursales registradas.
        </div>
      ) : (
        <div className="space-y-2">
          {search && (
            <p className="text-xs text-muted-foreground">
              {filteredVenues.length} de {venues.length} sucursales
            </p>
          )}
          {filteredVenues.map(venue => (
            <div
              key={venue.venueId}
              className={cn(
                'rounded-xl border bg-card transition-all',
                venue.enabled
                  ? 'border-primary/30 shadow-sm'
                  : 'border-border/50',
              )}
            >
              {/* Venue header row */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  {venue.enabled ? (
                    <ChevronDown className="w-4 h-4 text-primary flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{venue.venueName}</p>
                    <p className="text-xs text-muted-foreground truncate">/{venue.venueSlug}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  {!venue.enabled && (
                    <Badge variant="secondary" className="text-[10px]">
                      Usa tarifas org
                    </Badge>
                  )}
                  {venue.enabled && (
                    <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">
                      Tarifa personalizada
                    </Badge>
                  )}
                  <Switch
                    checked={venue.enabled}
                    onCheckedChange={() => dispatch({ type: 'TOGGLE_VENUE_OVERRIDE', venueId: venue.venueId })}
                  />
                </div>
              </div>

              {/* Expanded pricing override */}
              {venue.enabled && venue.pricing && (
                <div className="border-t border-border/30 px-4 pb-4 pt-3">
                  <div className="space-y-2">
                    <div className="grid grid-cols-4 gap-4 text-xs font-medium text-muted-foreground px-1">
                      <span>Tipo</span>
                      <span>Tarifa org</span>
                      <span>Esta sucursal</span>
                      <span>Diferencia</span>
                    </div>

                    {RATE_FIELDS.map(field => {
                      const orgRate = orgPricing?.[field.key] ?? 0
                      const venueRate = venue.pricing![field.key]
                      const diff = venueRate - orgRate

                      return (
                        <div
                          key={field.key}
                          className="grid grid-cols-4 gap-4 items-center py-1"
                        >
                          <span className="text-sm font-medium">{field.label}</span>
                          <span className="text-sm text-muted-foreground">{orgRate.toFixed(2)}%</span>
                          <div className="relative">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={venueRate ? Number(venueRate.toFixed(4)) : ''}
                              onChange={e => handlePricingChange(venue.venueId, field.key, e.target.value)}
                              className="h-8 text-sm pr-6"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                              %
                            </span>
                          </div>
                          <span
                            className={cn(
                              'text-sm font-medium',
                              diff > 0 && 'text-amber-600',
                              diff < 0 && 'text-blue-600',
                              diff === 0 && 'text-muted-foreground',
                            )}
                          >
                            {diff > 0 ? '+' : ''}{diff.toFixed(2)}%
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Fixed fees */}
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Cuota fija/transacción</span>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={venue.pricing.fixedFeePerTransaction ? Number(venue.pricing.fixedFeePerTransaction.toFixed(2)) : ''}
                          onChange={e => handlePricingChange(venue.venueId, 'fixedFeePerTransaction', e.target.value)}
                          className="h-8 text-sm pl-7"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Cuota mensual</span>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={venue.pricing.monthlyServiceFee ? Number(venue.pricing.monthlyServiceFee.toFixed(2)) : ''}
                          onChange={e => handlePricingChange(venue.venueId, 'monthlyServiceFee', e.target.value)}
                          className="h-8 text-sm pl-7"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
