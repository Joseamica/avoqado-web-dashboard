/**
 * AllCheckInsDialog - Muestra todos los check-ins del día de un promotor
 *
 * Muestra:
 * - Todos los check-ins/outs del día
 * - Foto de cada check-in/out (clickeable para ver en grande)
 * - Ubicación GPS con botón para ver en Google Maps
 * - Hora de entrada/salida
 */

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Clock,
  MapPin,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Camera,
  X,
  ZoomIn,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface TimeEntryData {
  clockInTime: string
  clockInLocation?: { lat: number; lng: number } | null
  checkInPhotoUrl?: string | null
  clockOutTime?: string | null
  clockOutLocation?: { lat: number; lng: number } | null
  checkOutPhotoUrl?: string | null
  status: string
}

interface AllCheckInsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  promoter: {
    name: string
    avatar?: string
    storeName: string
    status: 'ACTIVE' | 'INACTIVE'
  }
  timeEntries: TimeEntryData[]
  aboveModal?: boolean
}

export function AllCheckInsDialog({
  open,
  onOpenChange,
  promoter,
  timeEntries,
}: AllCheckInsDialogProps) {
  const [zoomedImage, setZoomedImage] = useState<string | null>(null)

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto border-none">

          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border-2 border-primary">
                <AvatarImage src={promoter.avatar} alt={promoter.name} />
                <AvatarFallback>{promoter.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">{promoter.name}</span>
                  <Badge
                    variant={promoter.status === 'ACTIVE' ? 'default' : 'secondary'}
                    className={cn(
                      'text-xs font-bold',
                      promoter.status === 'ACTIVE' && 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400'
                    )}
                  >
                    {promoter.status === 'ACTIVE' ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Activo
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3 mr-1" />
                        Inactivo
                      </>
                    )}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground font-normal">{promoter.storeName}</p>
              </div>
            </DialogTitle>
            <DialogDescription>
              {timeEntries.length} registro{timeEntries.length !== 1 ? 's' : ''} de asistencia del día
            </DialogDescription>
          </DialogHeader>

          {/* All Time Entries */}
          <div className="space-y-4 mt-4">
            {timeEntries.map((entry, idx) => {
              const checkInTime = new Date(entry.clockInTime).toLocaleTimeString('es-MX', {
                hour: '2-digit',
                minute: '2-digit',
              })
              const checkOutTime = entry.clockOutTime
                ? new Date(entry.clockOutTime).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
                : null

              const checkInMapUrl = entry.clockInLocation
                ? `https://www.google.com/maps/search/?api=1&query=${entry.clockInLocation.lat},${entry.clockInLocation.lng}`
                : null

              const checkOutMapUrl = entry.clockOutLocation
                ? `https://www.google.com/maps/search/?api=1&query=${entry.clockOutLocation.lat},${entry.clockOutLocation.lng}`
                : null

              return (
                <div
                  key={idx}
                  className="rounded-xl p-5 bg-muted/30 dark:bg-muted/10"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-base">
                      Registro #{timeEntries.length - idx}
                    </h4>
                    <Badge
                      variant={entry.status === 'CLOCKED_IN' ? 'default' : 'secondary'}
                      className={cn(
                        'text-xs font-bold',
                        entry.status === 'CLOCKED_IN' && 'bg-green-500 text-white'
                      )}
                    >
                      {entry.status === 'CLOCKED_IN' ? 'En turno' : 'Finalizado'}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Check-in */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 pb-2 border-b">
                        <div className="p-2 rounded-lg bg-green-500">
                          <Clock className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Check-in</p>
                          <p className="font-mono text-base font-bold">{checkInTime}</p>
                        </div>
                      </div>

                      {entry.clockInLocation && (
                        <div className="flex items-start gap-2 text-xs bg-card p-3 rounded-lg min-h-[60px]">
                          <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="text-muted-foreground block break-all">
                              {entry.clockInLocation.lat.toFixed(6)}, {entry.clockInLocation.lng.toFixed(6)}
                            </span>
                            {checkInMapUrl && (
                              <Button
                                variant="link"
                                size="sm"
                                className="h-auto p-0 text-xs mt-1"
                                onClick={() => window.open(checkInMapUrl, '_blank')}
                              >
                                <ExternalLink className="w-3 h-3 mr-1" />
                                Ver en Google Maps
                              </Button>
                            )}
                          </div>
                        </div>
                      )}

                      {entry.checkInPhotoUrl ? (
                        <div className="relative group h-48">
                          <img
                            src={entry.checkInPhotoUrl}
                            alt="Check-in"
                            className="w-full h-48 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setZoomedImage(entry.checkInPhotoUrl!)}
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg cursor-pointer pointer-events-none">
                            <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      ) : (
                        <div className="relative w-full h-48 rounded-lg bg-card flex items-center justify-center">
                          <Badge
                            variant="destructive"
                            className="absolute top-2 right-2 h-6 w-6 rounded-full p-0 flex items-center justify-center"
                          >
                            <AlertCircle className="h-4 w-4" />
                          </Badge>
                          <div className="text-center">
                            <Camera className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                            <p className="text-xs text-muted-foreground">Sin foto</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Check-out */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 pb-2 border-b">
                        <div className={cn('p-2 rounded-lg', checkOutTime ? 'bg-red-500' : 'bg-muted')}>
                          <Clock className={cn('w-4 h-4', checkOutTime ? 'text-white' : 'text-muted-foreground')} />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Check-out</p>
                          <p className="font-mono text-base font-bold">
                            {checkOutTime || '--:--'}
                          </p>
                        </div>
                      </div>

                      {entry.clockOutLocation ? (
                        <div className="flex items-start gap-2 text-xs bg-card p-3 rounded-lg min-h-[60px]">
                          <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="text-muted-foreground block break-all">
                              {entry.clockOutLocation.lat.toFixed(6)}, {entry.clockOutLocation.lng.toFixed(6)}
                            </span>
                            {checkOutMapUrl && (
                              <Button
                                variant="link"
                                size="sm"
                                className="h-auto p-0 text-xs mt-1"
                                onClick={() => window.open(checkOutMapUrl, '_blank')}
                              >
                                <ExternalLink className="w-3 h-3 mr-1" />
                                Ver en Google Maps
                              </Button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2 text-xs bg-card p-3 rounded-lg min-h-[60px]">
                          <MapPin className="w-3.5 h-3.5 text-muted-foreground/50 mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <span className="text-muted-foreground/70 text-xs italic">
                              {entry.status === 'CLOCKED_IN'
                                ? 'Esperando check-out del promotor...'
                                : 'No se registró ubicación de salida'}
                            </span>
                          </div>
                        </div>
                      )}

                      {entry.checkOutPhotoUrl ? (
                        <div className="relative group h-48">
                          <img
                            src={entry.checkOutPhotoUrl}
                            alt="Check-out"
                            className="w-full h-48 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setZoomedImage(entry.checkOutPhotoUrl!)}
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg cursor-pointer pointer-events-none">
                            <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      ) : (
                        <div className="relative w-full h-48 rounded-lg bg-card flex items-center justify-center">
                          {checkOutTime && (
                            <Badge
                              variant="destructive"
                              className="absolute top-2 right-2 h-6 w-6 rounded-full p-0 flex items-center justify-center"
                            >
                              <AlertCircle className="h-4 w-4" />
                            </Badge>
                          )}
                          <div className="text-center">
                            <Camera className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                            <p className="text-xs text-muted-foreground">
                              {entry.status === 'CLOCKED_IN' ? 'Aún en turno' : 'Sin foto'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <Dialog open={!!zoomedImage} onOpenChange={() => setZoomedImage(null)}>
          <DialogContent
            className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none [&>button]:hidden"
          >
            <div className="relative w-full h-full flex items-center justify-center p-4">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 z-50 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white"
                onClick={() => setZoomedImage(null)}
              >
                <X className="h-5 w-5" />
              </Button>
              <img
                src={zoomedImage}
                alt="Foto ampliada"
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
