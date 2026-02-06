import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import {
  CheckCircle2, XCircle, MinusCircle, Loader2, AlertTriangle,
  ExternalLink, Eye, Power, Plus, RotateCcw,
  Building2, Store, CreditCard, Monitor, Banknote, Users, Sparkles, ClipboardCheck,
} from 'lucide-react'
import type { WizardState, StepResult, WizardResponse } from '../onboarding.types'

interface Props {
  state: WizardState
  results: StepResult[] | null
  response?: WizardResponse | null
  loading: boolean
  onReset?: () => void
}

const SummarySection: React.FC<{
  title: string
  icon: React.ReactNode
  gradient: string
  children: React.ReactNode
}> = ({ title, icon, gradient, children }) => (
  <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-4 space-y-2">
    <div className="flex items-center gap-3 mb-2">
      <div className={`p-1.5 rounded-lg bg-gradient-to-br ${gradient}`}>
        {icon}
      </div>
      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{title}</h4>
    </div>
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
  if (status === 'success') return <CheckCircle2 className="w-4 h-4 text-green-500" />
  if (status === 'error') return <XCircle className="w-4 h-4 text-destructive" />
  return <MinusCircle className="w-4 h-4 text-muted-foreground" />
}

const getStepLink = (step: string, venueSlug?: string): { label: string; path: string } | null => {
  switch (step) {
    case 'settlement':
      return { label: 'Configurar liquidacion', path: '/superadmin/settlement-terms' }
    case 'terminal':
      return { label: 'Agregar terminal', path: '/superadmin/terminals' }
    case 'features':
      return { label: 'Configurar features', path: '/superadmin/features' }
    case 'modules':
      return { label: 'Configurar modulos', path: '/superadmin/modules' }
    case 'invitations':
      return venueSlug
        ? { label: 'Gestionar equipo', path: `/venues/${venueSlug}/team` }
        : { label: 'Gestionar equipo', path: '/superadmin/venues' }
    default:
      return null
  }
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
    const venueSlug = response?.venueSlug

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5">
            <ClipboardCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="font-semibold">Resultado</h3>
            <p className="text-sm text-muted-foreground">Resumen de la creacion del venue</p>
          </div>
        </div>

        {/* Completeness indicator */}
        <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{successCount}/{total} pasos completados</span>
            <div className="flex gap-2">
              {successCount > 0 && <Badge className="rounded-full">{successCount} exitosos</Badge>}
              {skippedCount > 0 && <Badge variant="secondary" className="rounded-full">{skippedCount} omitidos</Badge>}
              {errorCount > 0 && <Badge variant="destructive" className="rounded-full">{errorCount} errores</Badge>}
            </div>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${(successCount / total) * 100}%` }}
            />
          </div>
        </div>

        {/* Skipped/error banner */}
        {(skippedCount > 0 || errorCount > 0) && (
          <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
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
          {results.map((r) => {
            const link = (r.status === 'skipped' || r.status === 'error') ? getStepLink(r.step, venueSlug) : null
            return (
              <div key={r.step} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm">
                {statusIcon(r.status)}
                <span className="text-sm font-medium capitalize">{r.step}</span>
                <Badge
                  variant={r.status === 'success' ? 'default' : r.status === 'error' ? 'destructive' : 'secondary'}
                  className="rounded-full"
                >
                  {r.status}
                </Badge>
                {r.message && <span className="text-xs text-muted-foreground ml-auto truncate max-w-[300px]">{r.message}</span>}
                {link && (
                  <Link
                    to={link.path}
                    className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
                  >
                    {link.label}
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>
            )
          })}
        </div>

        {/* Quick Actions */}
        <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-4 space-y-3">
          <h4 className="text-sm font-semibold">Acciones rapidas</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Link to={`/venues/${venueSlug}`}>
              <Button variant="outline" size="sm" className="w-full rounded-full cursor-pointer">
                <Eye className="w-4 h-4 mr-1" />
                Ver venue
              </Button>
            </Link>
            <Link to="/superadmin/venues">
              <Button variant="outline" size="sm" className="w-full rounded-full cursor-pointer">
                <Power className="w-4 h-4 mr-1" />
                Venues
              </Button>
            </Link>
            <Link to={`/venues/${venueSlug}/menumaker/products`}>
              <Button variant="outline" size="sm" className="w-full rounded-full cursor-pointer">
                <Plus className="w-4 h-4 mr-1" />
                Productos
              </Button>
            </Link>
            {onReset && (
              <Button variant="outline" size="sm" className="w-full rounded-full cursor-pointer" onClick={onReset}>
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
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
          <ClipboardCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h3 className="font-semibold">Revision</h3>
          <p className="text-sm text-muted-foreground">Verifica los datos antes de crear el venue</p>
        </div>
      </div>

      {showSettlementWarning && (
        <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
          <p className="text-sm text-orange-600 dark:text-orange-400">
            No hay cuenta merchant vinculada. La liquidacion no se podra configurar automaticamente.
          </p>
        </div>
      )}

      <SummarySection
        title="Organizacion"
        icon={<Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
        gradient="from-blue-500/20 to-blue-500/5"
      >
        <Field label="Modo" value={state.organization.mode === 'new' ? 'Nueva' : 'Existente'} />
        {state.organization.mode === 'new' && <Field label="Nombre" value={state.organization.name} />}
        {state.organization.mode === 'existing' && <Field label="ID" value={state.organization.id} />}
      </SummarySection>

      <SummarySection
        title="Venue"
        icon={<Store className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />}
        gradient="from-purple-500/20 to-purple-500/5"
      >
        <Field label="Nombre" value={state.venue.name} />
        <Field label="Slug" value={state.venue.slug} />
        <Field label="Tipo" value={state.venue.venueType} />
        <Field label="Ciudad" value={state.venue.city} />
        <Field label="Entidad" value={state.venue.entityType} />
        <Field label="RFC" value={state.venue.rfc} />
      </SummarySection>

      <SummarySection
        title="Pagos"
        icon={<CreditCard className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />}
        gradient="from-green-500/20 to-green-500/5"
      >
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
            <CheckCircle2 className="w-3 h-3 text-green-500" />
            <span className="text-xs text-green-600 dark:text-green-400">Merchant account vinculado</span>
          </div>
        ) : state.pricing.createOrgConfig?.primaryAccountId ? (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
            <CheckCircle2 className="w-3 h-3 text-green-500" />
            <span className="text-xs text-green-600 dark:text-green-400">Se creara config org con merchant</span>
          </div>
        ) : !state.pricing.useOrgConfig ? (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
            <AlertTriangle className="w-3 h-3 text-orange-500" />
            <span className="text-xs text-orange-600 dark:text-orange-400">Sin merchant account</span>
          </div>
        ) : null}
      </SummarySection>

      <SummarySection
        title="Terminal"
        icon={<Monitor className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />}
        gradient="from-orange-500/20 to-orange-500/5"
      >
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

      <SummarySection
        title="Liquidacion"
        icon={<Banknote className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />}
        gradient="from-green-500/20 to-green-500/5"
      >
        <Field label="Debito" value={`${state.settlement.debitDays} dias`} />
        <Field label="Credito" value={`${state.settlement.creditDays} dias`} />
        <Field label="AMEX" value={`${state.settlement.amexDays} dias`} />
        <Field label="Tipo" value={state.settlement.dayType === 'BUSINESS_DAYS' ? 'Habiles' : 'Calendario'} />
        <Field label="Corte" value={`${state.settlement.cutoffTime} ${state.settlement.cutoffTimezone}`} />
      </SummarySection>

      <SummarySection
        title="Equipo"
        icon={<Users className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />}
        gradient="from-purple-500/20 to-purple-500/5"
      >
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
        <SummarySection
          title="Features y Modulos"
          icon={<Sparkles className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />}
          gradient="from-orange-500/20 to-orange-500/5"
        >
          {state.features.length > 0 && <Field label="Features" value={state.features.join(', ')} />}
          {state.modules.length > 0 && <Field label="Modulos" value={state.modules.map((m) => m.code).join(', ')} />}
        </SummarySection>
      )}
    </div>
  )
}
