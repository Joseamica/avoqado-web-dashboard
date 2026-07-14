import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { usePrintStations } from '@/hooks/use-print-stations'
import { useTerminology } from '@/hooks/use-terminology'

/** Sentinel Select value for "inherit from category" — maps to `printStationId: null`. */
const INHERIT_VALUE = '__inherit__'

interface PrintStationFieldProps {
  /** Matches useCurrentVenue().venueId, which is string | null until resolved. */
  venueId: string | null
  /** Current printStationId. null/undefined both render as "inherit". */
  value: string | null | undefined
  onChange: (value: string | null) => void
  /** Which i18n namespace + key path to read copy from (product wizard vs category forms). */
  namespace: 'inventory' | 'menu'
}

/**
 * Optional "prints at" selector for product and category forms.
 * Renders nothing (including its own card wrapper) when the venue has no
 * active print stations — this is an opt-in FREE feature (print-station
 * routing), not something every venue needs to see. Owns its full card
 * wrapper (rather than expecting the caller to wrap it) specifically so it
 * can hide itself completely with no empty container left behind. See
 * avoqado-server print-stations service for the underlying model.
 */
export function PrintStationField({ venueId, value, onChange, namespace }: PrintStationFieldProps) {
  const { t } = useTranslation(namespace)
  const { term } = useTerminology()
  const { data: printStations, isLoading } = usePrintStations(venueId)

  const activeStations = (printStations ?? []).filter(station => station.active)

  // Nothing to route to yet (still loading, or venue has 0 active stations) — hide entirely.
  if (isLoading || activeStations.length === 0) {
    return null
  }

  const keyPrefix = namespace === 'inventory' ? 'wizard.step1.printStation' : 'wizard.printStation'
  const selectValue = value ?? INHERIT_VALUE

  return (
    <section data-tour="print-station-field" className="bg-card rounded-2xl border border-border/50 p-6 space-y-1.5">
      <Label className="text-sm font-medium">{t(`${keyPrefix}.label`, { defaultValue: term('printStation') })}</Label>
      <Select value={selectValue} onValueChange={val => onChange(val === INHERIT_VALUE ? null : val)}>
        <SelectTrigger className="h-12 text-base">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={INHERIT_VALUE}>{t(`${keyPrefix}.inheritOption`)}</SelectItem>
          {activeStations.map(station => (
            <SelectItem key={station.id} value={station.id}>
              {station.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{t(`${keyPrefix}.help`)}</p>
    </section>
  )
}
