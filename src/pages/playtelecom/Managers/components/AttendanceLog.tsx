/**
 * AttendanceLog - Attendance and validation table
 * Shows clock-in/out times, photo/GPS badges, approve/reject buttons
 */

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '@/components/ui/glass-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Check, X, Image, ImageOff, MapPin, MapPinOff, RotateCcw, ClipboardList, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FilterPill, CheckboxFilterContent } from '@/components/filters'

export interface AttendanceEntry {
  id: string
  timeEntryId: string | null
  date: string
  storeName: string
  promoterName: string
  clockIn: string | null
  clockOut: string | null
  clockInPhotoUrl: string | null
  clockOutPhotoUrl: string | null
  clockInLat: number | null
  clockInLon: number | null
  clockOutLat: number | null
  clockOutLon: number | null
  validationStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
  sales: number
  cashSales: number
  dailyCashSales: number
  incidents: Array<{ label: string; severity: 'ok' | 'warning' | 'critical' }>
  isLate?: boolean
  gpsWarning?: boolean
  checkOutPhotoUrl?: string | null
}

interface AttendanceLogProps {
  entries: AttendanceEntry[]
  onApprove: (entry: AttendanceEntry) => void
  onReject: (id: string) => void
  onResetValidation: (id: string) => void
  onViewPhoto: (entry: AttendanceEntry, type: 'clockIn' | 'clockOut') => void
  onViewLocation: (entry: AttendanceEntry, type: 'clockIn' | 'clockOut') => void
}

export function AttendanceLog({ entries, onApprove, onReject, onResetValidation, onViewPhoto, onViewLocation }: AttendanceLogProps) {
  const { t } = useTranslation('playtelecom')
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [photoFilter, setPhotoFilter] = useState<string[]>([])
  const [incidentFilter, setIncidentFilter] = useState<string[]>([])

  const statusOptions = useMemo(() => [
    { value: 'PENDING', label: t('managers.attendance.statusPending', { defaultValue: 'Pendiente' }) },
    { value: 'APPROVED', label: t('managers.attendance.statusApproved', { defaultValue: 'Aprobado' }) },
    { value: 'REJECTED', label: t('managers.attendance.statusRejected', { defaultValue: 'Rechazado' }) },
  ], [t])

  const photoOptions = useMemo(() => [
    { value: 'with-photo', label: t('managers.attendance.filterWithPhoto', { defaultValue: 'Con Foto' }) },
    { value: 'no-photo', label: t('managers.attendance.filterNoPhoto', { defaultValue: 'Sin Foto' }) },
  ], [t])

  const incidentOptions = useMemo(() => [
    { value: 'with-incidents', label: t('managers.attendance.filterIncidents', { defaultValue: 'Con Incidencias' }) },
    { value: 'no-incidents', label: t('managers.attendance.noIncidents', { defaultValue: 'Sin Incidencias' }) },
  ], [t])

  const hasActiveFilters = statusFilter.length > 0 || photoFilter.length > 0 || incidentFilter.length > 0

  const filteredEntries = useMemo(() => {
    let result = entries

    if (statusFilter.length > 0) {
      result = result.filter(e => statusFilter.includes(e.validationStatus))
    }

    if (photoFilter.length > 0) {
      result = result.filter(e => {
        const hasPhoto = !!e.clockInPhotoUrl
        if (photoFilter.includes('with-photo') && photoFilter.includes('no-photo')) return true
        if (photoFilter.includes('with-photo')) return hasPhoto
        if (photoFilter.includes('no-photo')) return !hasPhoto
        return true
      })
    }

    if (incidentFilter.length > 0) {
      result = result.filter(e => {
        const hasIncidents = e.incidents.some(i => i.severity !== 'ok')
        if (incidentFilter.includes('with-incidents') && incidentFilter.includes('no-incidents')) return true
        if (incidentFilter.includes('with-incidents')) return hasIncidents
        if (incidentFilter.includes('no-incidents')) return !hasIncidents
        return true
      })
    }

    return result
  }, [entries, statusFilter, photoFilter, incidentFilter])

  const getFilterDisplayLabel = (selectedValues: string[], options: { value: string; label: string }[]): string | undefined => {
    if (selectedValues.length === 0) return undefined
    if (selectedValues.length === 1) {
      return options.find(o => o.value === selectedValues[0])?.label
    }
    return `${selectedValues.length} ${t('managers.attendance.selected', { defaultValue: 'seleccionados' })}`
  }

  const incidentCount = useMemo(() =>
    entries.filter(e => e.incidents.some(i => i.severity !== 'ok')).length,
  [entries])

  return (
    <GlassCard className="overflow-hidden">
      <div className="px-6 py-4 border-b border-border/50 flex flex-col gap-3 bg-card/80">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold flex items-center gap-2">
            {t('managers.attendance.title', { defaultValue: 'Bitacora de Asistencia y Validacion' })}
          </h3>
          {incidentCount > 0 && (
            <div className="text-xs text-red-400 font-semibold flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              {incidentCount} {t('managers.attendance.incidentDetected', { defaultValue: incidentCount === 1 ? 'incidencia detectada' : 'incidencias detectadas' })}
            </div>
          )}
        </div>

        {/* Stripe-style Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <FilterPill
            label={t('managers.attendance.filterValidation', { defaultValue: 'Validacion' })}
            activeValue={getFilterDisplayLabel(statusFilter, statusOptions)}
            isActive={statusFilter.length > 0}
            onClear={() => setStatusFilter([])}
          >
            <CheckboxFilterContent
              title={t('managers.attendance.filterValidation', { defaultValue: 'Validacion' })}
              options={statusOptions}
              selectedValues={statusFilter}
              onApply={setStatusFilter}
            />
          </FilterPill>

          <FilterPill
            label={t('managers.attendance.filterPhotos', { defaultValue: 'Fotos' })}
            activeValue={getFilterDisplayLabel(photoFilter, photoOptions)}
            isActive={photoFilter.length > 0}
            onClear={() => setPhotoFilter([])}
          >
            <CheckboxFilterContent
              title={t('managers.attendance.filterPhotos', { defaultValue: 'Fotos' })}
              options={photoOptions}
              selectedValues={photoFilter}
              onApply={setPhotoFilter}
            />
          </FilterPill>

          <FilterPill
            label={t('managers.attendance.filterIncidentsLabel', { defaultValue: 'Incidencias' })}
            activeValue={getFilterDisplayLabel(incidentFilter, incidentOptions)}
            isActive={incidentFilter.length > 0}
            onClear={() => setIncidentFilter([])}
          >
            <CheckboxFilterContent
              title={t('managers.attendance.filterIncidentsLabel', { defaultValue: 'Incidencias' })}
              options={incidentOptions}
              selectedValues={incidentFilter}
              onApply={setIncidentFilter}
            />
          </FilterPill>

          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-full dark:bg-white dark:text-black dark:hover:bg-gray-100 dark:hover:text-black"
              onClick={() => {
                setStatusFilter([])
                setPhotoFilter([])
                setIncidentFilter([])
              }}
            >
              <X className="h-3.5 w-3.5" />
              {t('managers.attendance.clearFilters', { defaultValue: 'Borrar filtros' })}
            </Button>
          )}
        </div>
      </div>

      {filteredEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <ClipboardList className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm font-medium">
            {!hasActiveFilters
              ? t('managers.attendance.noEntries', { defaultValue: 'Sin asistencia registrada para este periodo' })
              : t('managers.attendance.noFilterResults', { defaultValue: 'Sin resultados para este filtro' })
            }
          </p>
          {hasActiveFilters && (
            <button
              onClick={() => { setStatusFilter([]); setPhotoFilter([]); setIncidentFilter([]) }}
              className="text-xs text-primary mt-2 hover:underline"
            >
              {t('managers.attendance.clearFilters', { defaultValue: 'Borrar filtros' })}
            </button>
          )}
        </div>
      ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/30 text-xs uppercase font-bold text-muted-foreground">
            <tr>
              <th className="px-6 py-3">
                {t('managers.attendance.dateStore', { defaultValue: 'Fecha / Tienda' })}
              </th>
              <th className="px-6 py-3">
                {t('managers.attendance.promoter', { defaultValue: 'Promotor' })}
              </th>
              <th className="px-6 py-3 min-w-[200px]">
                {t('managers.attendance.clockIn', { defaultValue: 'Entrada (Val.)' })}
              </th>
              <th className="px-6 py-3 min-w-[200px]">
                {t('managers.attendance.clockOut', { defaultValue: 'Salida (Val.)' })}
              </th>
              <th className="px-6 py-3 text-center">
                {t('managers.attendance.sales', { defaultValue: 'Ventas' })}
              </th>
              <th className="px-6 py-3">
                {t('managers.attendance.incidents', { defaultValue: 'Incidencias' })}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {filteredEntries.map(entry => (
              <tr
                key={entry.id}
                className={cn(
                  'hover:bg-muted/20 transition',
                  entry.incidents.some(i => i.severity === 'critical') && 'bg-red-500/5'
                )}
              >
                <td className="px-6 py-4">
                  <div className="font-semibold">{entry.date}</div>
                  <div className="text-xs text-primary">{entry.storeName}</div>
                </td>
                <td className="px-6 py-4 text-muted-foreground">{entry.promoterName}</td>

                {/* Clock In */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <span className={cn(
                        'font-mono font-semibold',
                        entry.isLate ? 'text-red-400' : 'text-green-400'
                      )}>
                        {entry.clockIn || '--:--'}
                      </span>
                      {entry.clockIn && (
                        <div className="flex gap-2 mt-1">
                          {entry.clockInPhotoUrl ? (
                            <button
                              onClick={() => onViewPhoto(entry, 'clockIn')}
                              className="text-muted-foreground hover:text-primary transition-colors"
                            >
                              <Image className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="text-red-500">
                              <ImageOff className="w-4 h-4" />
                            </span>
                          )}
                          {entry.clockInLat != null && entry.clockInLon != null ? (
                            <button
                              onClick={() => onViewLocation(entry, 'clockIn')}
                              className={cn(
                                'transition-colors',
                                entry.gpsWarning
                                  ? 'text-red-500 animate-pulse'
                                  : 'text-muted-foreground hover:text-primary'
                              )}
                            >
                              <MapPin className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="text-red-500">
                              <MapPinOff className="w-4 h-4" />
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {entry.validationStatus === 'PENDING' && entry.clockIn && entry.clockOut && entry.timeEntryId && (
                      <div className="flex gap-1 bg-muted/50 rounded p-1 border border-border/50">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-green-500 hover:text-green-600 hover:bg-green-500/10"
                          onClick={() => onApprove(entry)}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                          onClick={() => onReject(entry.timeEntryId!)}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                    {entry.validationStatus === 'APPROVED' && (
                      <div className="flex items-center gap-1">
                        <Badge variant="default" className="text-[10px] bg-green-500/20 text-green-400 border-green-500/30">
                          <Check className="w-3 h-3 mr-0.5" />
                        </Badge>
                        {entry.timeEntryId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-muted-foreground hover:text-foreground"
                            onClick={() => onResetValidation(entry.timeEntryId!)}
                            title={t('managers.attendance.undo', { defaultValue: 'Deshacer' })}
                          >
                            <RotateCcw className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    )}
                    {entry.validationStatus === 'REJECTED' && (
                      <div className="flex items-center gap-1">
                        <Badge variant="destructive" className="text-[10px]">
                          <X className="w-3 h-3 mr-0.5" />
                        </Badge>
                        {entry.timeEntryId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-muted-foreground hover:text-foreground"
                            onClick={() => onResetValidation(entry.timeEntryId!)}
                            title={t('managers.attendance.undo', { defaultValue: 'Deshacer' })}
                          >
                            <RotateCcw className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </td>

                {/* Clock Out */}
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className={cn(
                      'font-mono',
                      entry.clockOut ? 'text-muted-foreground' : 'text-muted-foreground/50'
                    )}>
                      {entry.clockOut || '--:--'}
                    </span>
                    {entry.clockOut && (
                      <div className="flex gap-2 mt-1">
                        {entry.clockOutPhotoUrl ? (
                          <button
                            onClick={() => onViewPhoto(entry, 'clockOut')}
                            className="text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Image className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-red-500">
                            <ImageOff className="w-4 h-4" />
                          </span>
                        )}
                        {entry.clockOutLat != null && entry.clockOutLon != null ? (
                          <button
                            onClick={() => onViewLocation(entry, 'clockOut')}
                            className="text-muted-foreground hover:text-primary transition-colors"
                          >
                            <MapPin className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-red-500">
                            <MapPinOff className="w-4 h-4" />
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </td>

                <td className="px-6 py-4 text-center font-semibold">{entry.sales}</td>

                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {entry.incidents.length === 0 || entry.incidents.every(i => i.severity === 'ok') ? (
                      <Badge className="text-[10px] bg-green-500/10 text-green-400 border-green-500/20">
                        {t('managers.attendance.noIncidents', { defaultValue: 'Sin Incidencias' })}
                      </Badge>
                    ) : (
                      entry.incidents.filter(i => i.severity !== 'ok').map((inc, idx) => (
                        <Badge
                          key={idx}
                          className={cn(
                            'text-[10px] flex items-center gap-1',
                            inc.severity === 'critical'
                              ? 'bg-red-500/10 text-red-400 border-red-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          )}
                        >
                          <AlertTriangle className="w-3 h-3" />
                          {inc.label}
                        </Badge>
                      ))
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </GlassCard>
  )
}
