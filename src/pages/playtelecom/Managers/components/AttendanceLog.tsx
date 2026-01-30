/**
 * AttendanceLog - Attendance and validation table
 * Shows clock-in/out times, photo/GPS badges, approve/reject buttons
 */

import { useTranslation } from 'react-i18next'
import { GlassCard } from '@/components/ui/glass-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Check, X, Image, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface AttendanceEntry {
  id: string
  timeEntryId: string | null
  date: string
  storeName: string
  promoterName: string
  clockIn: string | null
  clockOut: string | null
  clockInPhotoUrl: string | null
  clockInLat: number | null
  clockInLon: number | null
  validationStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
  sales: number
  incidents: Array<{ label: string; severity: 'ok' | 'warning' | 'critical' }>
  isLate?: boolean
  gpsWarning?: boolean
}

interface AttendanceLogProps {
  entries: AttendanceEntry[]
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onViewPhoto: (entry: AttendanceEntry) => void
}

export function AttendanceLog({ entries, onApprove, onReject, onViewPhoto }: AttendanceLogProps) {
  const { t } = useTranslation('playtelecom')

  return (
    <GlassCard className="overflow-hidden">
      <div className="px-6 py-4 border-b border-border/50 flex justify-between items-center bg-card/80">
        <h3 className="font-semibold flex items-center gap-2">
          {t('managers.attendance.title', { defaultValue: 'Bitacora de Asistencia y Validacion' })}
        </h3>
        <div className="text-xs text-muted-foreground italic flex items-center gap-2">
          <span className="w-2 h-2 bg-red-500 rounded-full" />
          {t('managers.attendance.incidentDetected', { defaultValue: 'Incidencia detectada' })}
        </div>
      </div>

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
            {entries.map(entry => (
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
                          {entry.clockInPhotoUrl && (
                            <button
                              onClick={() => onViewPhoto(entry)}
                              className="text-muted-foreground hover:text-primary transition-colors"
                            >
                              <Image className="w-4 h-4" />
                            </button>
                          )}
                          <button className={cn(
                            'transition-colors',
                            entry.gpsWarning
                              ? 'text-red-500 animate-pulse'
                              : 'text-muted-foreground hover:text-primary'
                          )}>
                            <MapPin className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    {entry.validationStatus === 'PENDING' && entry.clockIn && entry.timeEntryId && (
                      <div className="flex gap-1 bg-muted/50 rounded p-1 border border-border/50">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-green-500 hover:text-green-600 hover:bg-green-500/10"
                          onClick={() => onApprove(entry.timeEntryId!)}
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
                      <Badge variant="default" className="text-[10px] bg-green-500/20 text-green-400 border-green-500/30">
                        <Check className="w-3 h-3 mr-0.5" />
                      </Badge>
                    )}
                    {entry.validationStatus === 'REJECTED' && (
                      <Badge variant="destructive" className="text-[10px]">
                        <X className="w-3 h-3 mr-0.5" />
                      </Badge>
                    )}
                  </div>
                </td>

                {/* Clock Out */}
                <td className="px-6 py-4">
                  <span className={cn(
                    'font-mono',
                    entry.clockOut ? 'text-muted-foreground' : 'text-muted-foreground/50'
                  )}>
                    {entry.clockOut || '--:--'}
                  </span>
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
                            'text-[10px]',
                            inc.severity === 'critical'
                              ? 'bg-red-500/10 text-red-400 border-red-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          )}
                        >
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
    </GlassCard>
  )
}
