import React, { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Store, CreditCard, Terminal, Settings, AlertCircle } from 'lucide-react'
import type { BulkOnboardingState } from '../types'

interface Props {
  state: BulkOnboardingState
}

export const Step4Review: React.FC<Props> = ({ state }) => {
  const stats = useMemo(() => {
    const totalTerminals = state.venues.reduce((sum, v) => sum + v.terminals.length, 0)
    const customPricing = state.venues.filter(v => v.pricingOverride).length
    const customSettlement = state.venues.filter(v => v.settlementOverride).length
    const withAddress = state.venues.filter(v => v.address).length
    const withTerminals = state.venues.filter(v => v.terminals.length > 0).length
    return { totalTerminals, customPricing, customSettlement, withAddress, withTerminals }
  }, [state.venues])

  const validationErrors = useMemo(() => {
    const errors: string[] = []

    if (!state.organizationId) {
      errors.push('No se ha seleccionado una organización')
    }

    if (state.venues.length === 0) {
      errors.push('No hay venues para crear')
    }

    const emptyNames = state.venues.filter(v => !v.name.trim())
    if (emptyNames.length > 0) {
      errors.push(`${emptyNames.length} venue(s) sin nombre`)
    }

    // Check duplicate serial numbers
    const serials = state.venues.flatMap(v => v.terminals.map(t => t.serialNumber).filter(Boolean))
    const serialSet = new Set<string>()
    const duplicates = new Set<string>()
    for (const s of serials) {
      if (serialSet.has(s)) duplicates.add(s)
      serialSet.add(s)
    }
    if (duplicates.size > 0) {
      errors.push(`Números de serie duplicados: ${[...duplicates].join(', ')}`)
    }

    // Check terminals without serial numbers
    const incompleteTerminals = state.venues.flatMap(v =>
      v.terminals.filter(t => !t.serialNumber || !t.name),
    )
    if (incompleteTerminals.length > 0) {
      errors.push(`${incompleteTerminals.length} terminal(es) sin número de serie o nombre`)
    }

    return errors
  }, [state])

  return (
    <div className="space-y-6">
      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertCircle className="w-4 h-4" />
            Problemas encontrados
          </div>
          <ul className="space-y-1 text-sm text-destructive/80">
            {validationErrors.map((e, i) => (
              <li key={i}>• {e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard icon={<Store className="w-4 h-4" />} label="Venues" value={state.venues.length} color="blue" />
        <SummaryCard icon={<Terminal className="w-4 h-4" />} label="Terminales" value={stats.totalTerminals} color="emerald" />
        <SummaryCard icon={<CreditCard className="w-4 h-4" />} label="Pricing custom" value={stats.customPricing} color="amber" />
        <SummaryCard icon={<Settings className="w-4 h-4" />} label="Settlement custom" value={stats.customSettlement} color="violet" />
      </div>

      {/* Default Config Summary */}
      <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-4 space-y-3">
        <h3 className="font-semibold text-sm">Configuración por defecto</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Tipo:</span>{' '}
            <span className="font-medium">{state.defaults.venueType.replace(/_/g, ' ')}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Zona:</span>{' '}
            <span className="font-medium">{state.defaults.timezone.split('/')[1]}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Moneda:</span>{' '}
            <span className="font-medium">{state.defaults.currency}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Merchant:</span>{' '}
            <span className="font-medium">{state.merchantAccountId ? 'Configurado' : 'Sin merchant'}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm pt-2 border-t border-border/30">
          <div>
            <span className="text-muted-foreground">Débito:</span>{' '}
            <span className="font-medium">{state.pricing.debitRate.toFixed(2)}%</span>
          </div>
          <div>
            <span className="text-muted-foreground">Crédito:</span>{' '}
            <span className="font-medium">{state.pricing.creditRate.toFixed(2)}%</span>
          </div>
          <div>
            <span className="text-muted-foreground">AMEX:</span>{' '}
            <span className="font-medium">{state.pricing.amexRate.toFixed(2)}%</span>
          </div>
          <div>
            <span className="text-muted-foreground">Int'l:</span>{' '}
            <span className="font-medium">{state.pricing.internationalRate.toFixed(2)}%</span>
          </div>
        </div>
      </div>

      {/* Full Venue Table */}
      <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
        <div className="max-h-[400px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead className="text-center">Terminales</TableHead>
                <TableHead>Débito</TableHead>
                <TableHead>Crédito</TableHead>
                <TableHead>AMEX</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.venues.map((venue, idx) => {
                const pricing = venue.pricingOverride || state.pricing
                return (
                  <TableRow key={venue.clientId}>
                    <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                    <TableCell className="font-medium">{venue.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate max-w-[180px]">
                      {venue.address || '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      {venue.terminals.length > 0 ? (
                        <Badge variant="secondary" className="text-xs">{venue.terminals.length}</Badge>
                      ) : '0'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {pricing.debitRate.toFixed(2)}%
                      {venue.pricingOverride && <Badge className="ml-1 text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20 px-1">C</Badge>}
                    </TableCell>
                    <TableCell className="text-xs">{pricing.creditRate.toFixed(2)}%</TableCell>
                    <TableCell className="text-xs">{pricing.amexRate.toFixed(2)}%</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: number
  color: string
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-lg bg-${color}-500/10 text-${color}-500`}>{icon}</div>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}
