import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Search, UserPlus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn, includesNormalized } from '@/lib/utils'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useRoleConfig } from '@/hooks/use-role-config'
import { teamService } from '@/services/team.service'

export interface AQuienAplica {
  soloElegidas: boolean
  staffIds: string[]
}

interface AQuienAplicaEditorProps {
  /** El servidor sabe limitar el esquema a personas elegidas (sus esquemas traen `filterByStaff`). */
  disponible: boolean
  valor: AQuienAplica
  onChange: (valor: AQuienAplica) => void
}

/**
 * «¿A quién aplica?» en «Editar configuración» (final-comisiones-viejas, D-ELEGIDOS): todo el equipo o sólo las personas elegidas
 * (`filterByStaff` + `staffIds`). Las excepciones (excluir o tasa especial) siguen en la ficha del esquema. Con un servidor que no sabe
 * restringir, lo dice y no ofrece elegir.
 */
export default function AQuienAplicaEditor({ disponible, valor, onChange }: AQuienAplicaEditorProps) {
  const { t } = useTranslation('commissions')

  return (
    <div className="space-y-3 rounded-xl border border-border/50 p-4">
      <h3 className="text-sm font-medium text-muted-foreground">{t('config.staffScope.title')}</h3>
      {!disponible ? (
        <p className="text-xs text-muted-foreground">{t('setup.staff.restrictionUnavailable')}</p>
      ) : (
        <>
          <div className="inline-flex rounded-full bg-muted/50 p-1">
            {[false, true].map(soloElegidas => (
              <button
                key={String(soloElegidas)}
                type="button"
                aria-pressed={valor.soloElegidas === soloElegidas}
                onClick={() => onChange({ ...valor, soloElegidas })}
                className={cn(
                  'px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer',
                  valor.soloElegidas === soloElegidas ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {soloElegidas ? t('config.staffScope.chosen') : t('config.staffScope.all')}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {valor.soloElegidas ? t('config.staffScope.chosenDesc') : t('config.staffScope.allDesc')}
          </p>
          {valor.soloElegidas && <ElegirPersonas staffIds={valor.staffIds} onChange={staffIds => onChange({ ...valor, staffIds })} />}
        </>
      )}
    </div>
  )
}

function ElegirPersonas({ staffIds, onChange }: { staffIds: string[]; onChange: (staffIds: string[]) => void }) {
  const { t } = useTranslation('commissions')
  const { venueId } = useCurrentVenue()
  const { getDisplayName: getRoleDisplayName } = useRoleConfig()
  const [busqueda, setBusqueda] = useState('')

  // Misma lista y misma llave que la tarjeta «Empleados» del panel.
  const { data: equipo } = useQuery({
    queryKey: ['team-members', venueId],
    queryFn: () => teamService.getTeamMembers(venueId!, 1, 100),
    enabled: !!venueId,
  })
  const personas = equipo?.data ?? []
  const nombreDe = (staffId: string) => {
    const p = personas.find(x => x.staffId === staffId)
    return p ? `${p.firstName} ${p.lastName}` : staffId
  }
  const disponibles = personas.filter(p => !staffIds.includes(p.staffId) && includesNormalized(`${p.firstName} ${p.lastName}`, busqueda))

  return (
    <div className="space-y-3">
      {staffIds.length === 0 ? (
        <p className="text-xs text-destructive">{t('setup.staff.chooseAtLeastOne')}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {staffIds.map(id => (
            <span key={id} className="inline-flex items-center gap-1 rounded-full border border-input px-3 py-1 text-sm">
              {nombreDe(id)}
              <button
                type="button"
                aria-label={t('config.staffScope.remove', { name: nombreDe(id) })}
                onClick={() => onChange(staffIds.filter(x => x !== id))}
                className="text-muted-foreground hover:text-destructive cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder={t('setup.staff.searchPlaceholder')}
          className="pl-9"
        />
      </div>
      <div className="max-h-[200px] overflow-y-auto space-y-1 rounded-lg border border-input p-1">
        {disponibles.length === 0 ? (
          <p className="text-xs text-muted-foreground p-3 text-center">{t('setup.staff.noResults')}</p>
        ) : (
          disponibles.map(p => (
            <button
              key={p.staffId}
              type="button"
              onClick={() => onChange([...staffIds, p.staffId])}
              className="w-full text-left flex items-center gap-2 rounded-md p-2 hover:bg-muted/30 transition-colors cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {p.firstName} {p.lastName}
                </p>
                {p.role && <p className="text-xs text-muted-foreground">{getRoleDisplayName(p.role)}</p>}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
