/**
 * SupervisorSelect — the "Supervisor" dropdown shared by the SIM custody dialogs
 * (Asignar SIMs · Reasignar a otro Supervisor).
 *
 * Exists so the list is NEVER silently empty. Both dialogs previously read the
 * OWNER-only `/team` endpoint, so an ADMIN — who legitimately holds
 * `sim-custody:assign-to-supervisor` / `:reassign-supervisor` — opened the dialog,
 * got a 403 swallowed by the query, and saw an empty dropdown with no reason given.
 * The data source is fixed (`useOrgSupervisors`); this component covers the rest of
 * the rule "apagado se VE y se EXPLICA" (`avoqado-server/.claude/rules/feature-gating.md`):
 * the control stays visible, and when it has nothing to offer it says WHAT is missing,
 * HOW to fix it, and WHO to ask.
 */
import { AlertTriangle, RefreshCw } from 'lucide-react'
import type { UseQueryResult } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/searchable-select'
import type { OrgStaffOption } from '@/hooks/use-org-staff-by-role'

interface Props {
  value: string
  onValueChange: (value: string) => void
  /** Result of `useOrgSupervisors(orgId)`. */
  query: UseQueryResult<OrgStaffOption[]>
  label?: string
  placeholder?: string
}

export function SupervisorSelect({ value, onValueChange, query, label = 'Supervisor', placeholder }: Props) {
  const supervisors = query.data ?? []
  const isEmpty = !query.isLoading && !query.isError && supervisors.length === 0

  const resolvedPlaceholder = query.isLoading
    ? 'Cargando…'
    : query.isError
      ? 'No se pudo cargar la lista'
      : isEmpty
        ? 'No hay Supervisores disponibles'
        : (placeholder ?? 'Selecciona un Supervisor')

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <SearchableSelect
        value={value}
        onValueChange={onValueChange}
        options={supervisors.map(s => ({
          value: s.id,
          // Suffix the org-internal ID (white-label orgs) so the selector lets you
          // disambiguate two people with the same name. Empty suffix when there's
          // no code, so non-WL orgs see just the name.
          label: s.employeeCode ? `${s.fullName} (${s.employeeCode})` : s.fullName,
        }))}
        placeholder={resolvedPlaceholder}
        searchPlaceholder="Buscar por nombre…"
        emptyMessage="Sin resultados"
        disabled={query.isLoading || query.isError || isEmpty}
        searchThreshold={0}
        className="w-full"
      />

      {query.isError && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-1">
            <p>
              <strong>No pudimos cargar la lista de Supervisores.</strong> Puede ser un problema de conexión, o que tu usuario ya no
              pertenezca a esta organización.
            </p>
            <p>Reintenta; si sigue fallando, pídele al dueño (OWNER) de la organización que revise tus accesos.</p>
            <Button size="sm" variant="outline" className="mt-1 h-7 gap-1.5 text-xs" onClick={() => void query.refetch()}>
              <RefreshCw className="h-3 w-3" />
              Reintentar
            </Button>
          </div>
        </div>
      )}

      {isEmpty && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-1">
            <p>
              <strong>Esta organización no tiene Supervisores activos.</strong> Un Supervisor es un usuario con el rol{' '}
              <strong>Gerente</strong> activo en al menos una tienda de la organización.
            </p>
            <p>Asigna ese rol desde Equipo. Si no puedes cambiar roles, pídeselo al dueño (OWNER) de la organización.</p>
          </div>
        </div>
      )}
    </div>
  )
}
