import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, MinusCircle, Loader2, AlertTriangle, ExternalLink, Eye, Power, Plus, RotateCcw } from 'lucide-react'
import type { WizardState, StepResult, WizardResponse } from '../onboarding.types'

interface Props {
  state: WizardState
  results: StepResult[] | null
  response?: WizardResponse | null
  loading: boolean
  onReset?: () => void
}

const SummarySection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm p-4 space-y-2">
    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{title}</h4>
    {children}
  </div>
)

const Field: React.FC<{ label: string; value?: string | number | null }> = ({ label, value }) =>
  value ? (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  ) : null

const statusIcon = (status: string) => {
  if (status === 'success') return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
  if (status === 'error') return <XCircle className="w-4 h-4 text-destructive" />
  return <MinusCircle className="w-4 h-4 text-muted-foreground" />
}

const STEP_LINKS: Record<string, { label: string; path: (venueId?: string) => string }> = {
  settlement: { label: 'Configurar liquidacion', path: () => '/superadmin/settlement-terms' },
  terminal: { label: 'Agregar terminal', path: () => '/superadmin/terminals' },
  features: { label: 'Configurar features', path: (vid) => vid ? `/superadmin/venues/${vid}` : '/superadmin/venues' },
  modules: { label: 'Configurar modulos', path: (vid) => vid ? `/superadmin/venues/${vid}` : '/superadmin/venues' },
  invitations: { label: 'Gestionar equipo', path: (vid) => vid ? `/superadmin/venues/${vid}` : '/superadmin/venues' },
}

export const Step6ReviewConfirm: React.FC<Props> = ({ state, results, response, loading, onReset }) => {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Creando venue...</p>
      </div>
    )
  }

  if (results) {
    const successCount = results.filter((r) => r.status === 'success').length
    const skippedCount = results.filter((r) => r.status === 'skipped').length
    const errorCount = results.filter((r) => r.status === 'error').length
    const total = results.length
    const venueId = response?.venueId

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Resultado</h3>

        {/* Completeness indicator */}
        <div className="rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{successCount}/{total} pasos completados</span>
            <div className="flex gap-2">
              {successCount > 0 && <Badge variant="default">{successCount} exitosos</Badge>}
              {skippedCount > 0 && <Badge variant="secondary">{skippedCount} omitidos</Badge>}
              {errorCount > 0 && <Badge variant="destructive">{errorCount} errores</Badge>}
            </div>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-emerald-500 h-2 rounded-full transition-all"
              style={{ width: `${(successCount / total) * 100}%` }}
            />
          </div>
        </div>

        {/* Skipped/error banner */}
        {(skippedCount > 0 || errorCount > 0) && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 p-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                Algunos pasos requieren atencion
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Los pasos omitidos o con error se pueden configurar manualmente desde el dashboard.
            </p>
          </div>
        )}

        {/* Step results with direct links */}
        <div className="space-y-2">
          {results.map((r) => (
            <div key={r.step} className="flex items-center gap-3 p-3 rounded-lg border border-border">
              {statusIcon(r.status)}
              <span className="text-sm font-medium capitalize">{r.step}</span>
              <Badge variant={r.status === 'success' ? 'default' : r.status === 'error' ? 'destructive' : 'secondary'}>
                {r.status}
              </Badge>
              {r.message && <span className="text-xs text-muted-foreground ml-auto truncate max-w-[300px]">{r.message}</span>}
              {(r.status === 'skipped' || r.status === 'error') && STEP_LINKS[r.step] && (
                <a
                  href={STEP_LINKS[r.step].path(venueId)}
                  className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
                >
                  {STEP_LINKS[r.step].label}
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="rounded-xl border border-border p-4 space-y-3">
          <h4 className="text-sm font-semibold">Acciones rapidas</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <a href={`/venues/${response?.venueSlug}`}>
              <Button variant="outline" size="sm" className="w-full">
                <Eye className="w-4 h-4 mr-1" />
                Ver venue
              </Button>
            </a>
            <a href={`/superadmin/venues/${venueId}`}>
              <Button variant="outline" size="sm" className="w-full">
                <Power className="w-4 h-4 mr-1" />
                Activar
              </Button>
            </a>
            <a href={`/venues/${response?.venueSlug}/menu/products`}>
              <Button variant="outline" size="sm" className="w-full">
                <Plus className="w-4 h-4 mr-1" />
                Productos
              </Button>
            </a>
            {onReset && (
              <Button variant="outline" size="sm" className="w-full" onClick={onReset}>
                <RotateCcw className="w-4 h-4 mr-1" />
                Nuevo venue
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Settlement warning when no merchant account
  const showSettlementWarning =
    !state.pricing.useOrgConfig &&
    !state.pricing.merchantAccountId &&
    !(state.pricing.createOrgConfig?.primaryAccountId)

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Revision</h3>

      {showSettlementWarning && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 p-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-400">
            No hay cuenta merchant vinculada. La liquidacion no se podra configurar automaticamente.
          </p>
        </div>
      )}

      <SummarySection title="Organizacion">
        <Field label="Modo" value={state.organization.mode === 'new' ? 'Nueva' : 'Existente'} />
        {state.organization.mode === 'new' && <Field label="Nombre" value={state.organization.name} />}
        {state.organization.mode === 'existing' && <Field label="ID" value={state.organization.id} />}
      </SummarySection>

      <SummarySection title="Venue">
        <Field label="Nombre" value={state.venue.name} />
        <Field label="Slug" value={state.venue.slug} />
        <Field label="Tipo" value={state.venue.venueType} />
        <Field label="Ciudad" value={state.venue.city} />
        <Field label="Entidad" value={state.venue.entityType} />
        <Field label="RFC" value={state.venue.rfc} />
      </SummarySection>

      <SummarySection title="Pagos">
        {state.pricing.useOrgConfig ? (
          <p className="text-sm">Usando configuracion organizacional</p>
        ) : (
          <>
            <Field label="Debito" value={`${state.pricing.debitRate}%`} />
            <Field label="Credito" value={`${state.pricing.creditRate}%`} />
            <Field label="AMEX" value={`${state.pricing.amexRate}%`} />
            <Field label="Internacional" value={`${state.pricing.internationalRate}%`} />
          </>
        )}
        {state.pricing.merchantAccountId ? (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span className="text-xs text-emerald-600">Merchant account vinculado</span>
          </div>
        ) : state.pricing.createOrgConfig?.primaryAccountId ? (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span className="text-xs text-emerald-600">Se creara config org con merchant</span>
          </div>
        ) : !state.pricing.useOrgConfig ? (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            <span className="text-xs text-amber-600">Sin merchant account</span>
          </div>
        ) : null}
      </SummarySection>

      <SummarySection title="Terminal">
        {state.terminal ? (
          <>
            <Field label="Serie" value={state.terminal.serialNumber} />
            <Field label="Marca" value={`${state.terminal.brand} ${state.terminal.model}`} />
            <Field label="Ambiente" value={state.terminal.environment} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Sin terminal</p>
        )}
      </SummarySection>

      <SummarySection title="Liquidacion">
        <Field label="Debito" value={`${state.settlement.debitDays} dias`} />
        <Field label="Credito" value={`${state.settlement.creditDays} dias`} />
        <Field label="AMEX" value={`${state.settlement.amexDays} dias`} />
        <Field label="Tipo" value={state.settlement.dayType === 'BUSINESS_DAYS' ? 'Habiles' : 'Calendario'} />
        <Field label="Corte" value={`${state.settlement.cutoffTime} ${state.settlement.cutoffTimezone}`} />
      </SummarySection>

      <SummarySection title="Equipo">
        {state.team.owner.email ? (
          <>
            <Field label="Owner" value={`${state.team.owner.firstName} ${state.team.owner.lastName} (${state.team.owner.email})`} />
            {state.team.additionalStaff.length > 0 && (
              <Field label="Staff adicional" value={`${state.team.additionalStaff.length} invitaciones`} />
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Sin invitaciones</p>
        )}
      </SummarySection>

      {(state.features.length > 0 || state.modules.length > 0) && (
        <SummarySection title="Features y Modulos">
          {state.features.length > 0 && <Field label="Features" value={state.features.join(', ')} />}
          {state.modules.length > 0 && <Field label="Modulos" value={state.modules.map((m) => m.code).join(', ')} />}
        </SummarySection>
      )}
    </div>
  )
}
