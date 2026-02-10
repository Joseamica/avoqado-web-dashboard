/**
 * PhotoEvidenceModal - Full-size photo with GPS overlay
 */

import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { MapPin, Clock, User } from 'lucide-react'
import type { AttendanceEntry } from './AttendanceLog'

interface PhotoEvidenceModalProps {
  entry: AttendanceEntry | null
  type: 'clockIn' | 'clockOut'
  open: boolean
  onClose: () => void
}

export function PhotoEvidenceModal({ entry, type, open, onClose }: PhotoEvidenceModalProps) {
  if (!entry) return null

  const photoUrl = type === 'clockIn' ? entry.clockInPhotoUrl : entry.clockOutPhotoUrl
  const lat = type === 'clockIn' ? entry.clockInLat : entry.clockOutLat
  const lon = type === 'clockIn' ? entry.clockInLon : entry.clockOutLon
  const time = type === 'clockIn' ? entry.clockIn : entry.clockOut
  const label = type === 'clockIn' ? 'Entrada' : 'Salida'

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-card">
          <User className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">{entry.promoterName} — {label}</h3>
        </div>

        {/* Photo */}
        <div className="p-4 flex justify-center bg-background relative">
          <div className="relative rounded-xl overflow-hidden border-2 border-border shadow-lg">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt="Evidencia"
                className="max-h-[400px] w-auto object-cover"
              />
            ) : (
              <div className="w-[300px] h-[300px] bg-muted flex items-center justify-center text-muted-foreground">
                Sin foto
              </div>
            )}

            {/* GPS Overlay */}
            <div className="absolute bottom-3 left-3 flex flex-col gap-1">
              {lat != null && lon != null && (
                <span className="text-[9px] font-semibold bg-black/60 text-white px-1.5 py-0.5 rounded-md flex items-center gap-1 backdrop-blur-md border border-white/10">
                  <MapPin className="w-2.5 h-2.5 text-green-400" />
                  Lat: {lat.toFixed(4)}, Lon: {lon.toFixed(4)}
                </span>
              )}
              <span className="text-[9px] font-semibold bg-black/60 text-white px-1.5 py-0.5 rounded-md flex items-center gap-1 backdrop-blur-md border border-white/10">
                <Clock className="w-2.5 h-2.5 text-blue-400" />
                {time || 'N/A'} - {entry.storeName}
              </span>
            </div>
          </div>
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
