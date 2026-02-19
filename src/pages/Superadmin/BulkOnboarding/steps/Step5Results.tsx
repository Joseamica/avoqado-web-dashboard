import React from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CheckCircle2, Store, Terminal, CreditCard, Clock, RotateCcw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { BulkCreateVenuesResponse } from '@/services/superadmin.service'

interface Props {
  results: BulkCreateVenuesResponse
  onReset: () => void
}

export const Step5Results: React.FC<Props> = ({ results, onReset }) => {
  const navigate = useNavigate()
  const { summary, venues, errors } = results

  return (
    <div className="space-y-6">
      {/* Success Banner */}
      <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-6 flex items-center gap-4">
        <div className="p-3 rounded-full bg-green-500/10">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Creación completada</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Se crearon {summary.venuesCreated} venues exitosamente
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ResultCard
          icon={<Store className="w-4 h-4" />}
          label="Venues creados"
          value={summary.venuesCreated}
          color="blue"
        />
        <ResultCard
          icon={<Terminal className="w-4 h-4" />}
          label="Terminales"
          value={summary.terminalsCreated}
          color="emerald"
        />
        <ResultCard
          icon={<CreditCard className="w-4 h-4" />}
          label="Pricing structures"
          value={summary.pricingStructuresCreated}
          color="amber"
        />
        <ResultCard
          icon={<Clock className="w-4 h-4" />}
          label="Settlement configs"
          value={summary.settlementConfigsCreated}
          color="violet"
        />
      </div>

      {/* Errors (if any) */}
      {errors.length > 0 && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 space-y-2">
          <h3 className="text-sm font-semibold text-destructive">Errores ({errors.length})</h3>
          {errors.map((err, i) => (
            <div key={i} className="text-sm text-destructive/80">
              Venue #{err.index + 1}: {err.error} ({err.field})
            </div>
          ))}
        </div>
      )}

      {/* Results Table */}
      <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
        <div className="max-h-[400px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="text-center">Terminales</TableHead>
                <TableHead className="text-center">Pagos</TableHead>
                <TableHead className="text-center">Pricing</TableHead>
                <TableHead className="text-center">Settlement</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {venues.map(venue => (
                <TableRow key={venue.venueId}>
                  <TableCell className="text-muted-foreground text-xs">{venue.index + 1}</TableCell>
                  <TableCell className="font-medium">{venue.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground font-mono">{venue.slug}</TableCell>
                  <TableCell className="text-center">
                    {venue.terminals.length > 0 ? (
                      <Badge variant="secondary" className="text-xs">{venue.terminals.length}</Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-center">
                    {venue.paymentConfigured ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500 inline" />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {venue.pricingConfigured ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500 inline" />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {venue.settlementConfigured ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500 inline" />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        venue.status === 'ACTIVE'
                          ? 'bg-green-500/10 text-green-600 border-green-500/20'
                          : 'bg-muted text-muted-foreground'
                      }
                    >
                      {venue.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <Button variant="outline" onClick={onReset} className="rounded-full cursor-pointer">
          <RotateCcw className="w-4 h-4 mr-2" /> Crear otro lote
        </Button>
        <Button onClick={() => navigate('/superadmin/venues')} className="rounded-full cursor-pointer">
          Ir a Venues
        </Button>
      </div>
    </div>
  )
}

function ResultCard({
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
