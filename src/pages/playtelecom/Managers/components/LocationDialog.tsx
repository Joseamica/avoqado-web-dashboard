/**
 * LocationDialog - Shows GPS coordinates with a link to open in Google Maps
 */

import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { MapPin, Clock, User, ExternalLink } from 'lucide-react'
import type { AttendanceEntry } from './AttendanceLog'

interface LocationDialogProps {
  entry: AttendanceEntry | null
  type: 'clockIn' | 'clockOut'
  open: boolean
  onClose: () => void
}

export function LocationDialog({ entry, type, open, onClose }: LocationDialogProps) {
  if (!entry) return null

  const lat = type === 'clockIn' ? entry.clockInLat : entry.clockOutLat
  const lon = type === 'clockIn' ? entry.clockInLon : entry.clockOutLon
  const time = type === 'clockIn' ? entry.clockIn : entry.clockOut
  const label = type === 'clockIn' ? 'Entrada' : 'Salida'
  const mapsUrl = lat != null && lon != null
    ? `https://www.google.com/maps?q=${lat},${lon}`
    : null

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-card">
          <MapPin className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Ubicación — {label}</h3>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="w-4 h-4" />
            <span>{entry.promoterName}</span>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>{time || 'N/A'} — {entry.storeName}</span>
          </div>

          {lat != null && lon != null ? (
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground block mb-0.5">Latitud</span>
                  <span className="font-mono font-semibold">{lat.toFixed(6)}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block mb-0.5">Longitud</span>
                  <span className="font-mono font-semibold">{lon.toFixed(6)}</span>
                </div>
              </div>

              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  Abrir en Google Maps
                </a>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-center text-sm text-red-400">
              Sin datos de ubicación
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border/50 flex justify-end bg-card">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
