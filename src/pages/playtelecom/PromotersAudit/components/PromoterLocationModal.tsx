/**
 * PromoterLocationModal - Modal con mapa GPS para ver ubicaciones de check-in/out
 *
 * Muestra:
 * - Mapa con marcadores de check-in y check-out
 * - Información del promotor
 * - Hora y precisión GPS de cada punto
 * - Distancia entre check-in y check-out
 */

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { CheckCircle2, Clock, ExternalLink, MapPin, Navigation, XCircle } from 'lucide-react'
import { useMemo } from 'react'

interface LocationPoint {
  lat: number
  lng: number
  time?: string
  accuracy?: number
}

interface PromoterLocationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  promoter: {
    id: string
    name: string
    avatar?: string
    storeName: string
    checkInTime?: string
    checkInLocation?: LocationPoint
    checkInPhotoUrl?: string
    checkOutTime?: string
    checkOutLocation?: LocationPoint
    checkOutPhotoUrl?: string
    status: 'ACTIVE' | 'INACTIVE'
  }
}

export function PromoterLocationModal({ open, onOpenChange, promoter }: PromoterLocationModalProps) {
  // Calculate distance between check-in and check-out (Haversine formula)
  const distance = useMemo(() => {
    if (!promoter.checkInLocation || !promoter.checkOutLocation) return null

    const R = 6371e3 // Earth radius in meters
    const φ1 = (promoter.checkInLocation.lat * Math.PI) / 180
    const φ2 = (promoter.checkOutLocation.lat * Math.PI) / 180
    const Δφ = ((promoter.checkOutLocation.lat - promoter.checkInLocation.lat) * Math.PI) / 180
    const Δλ = ((promoter.checkOutLocation.lng - promoter.checkInLocation.lng) * Math.PI) / 180

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return Math.round(R * c) // Distance in meters
  }, [promoter.checkInLocation, promoter.checkOutLocation])

  const hasCheckIn = !!promoter.checkInLocation
  const hasCheckOut = !!promoter.checkOutLocation

  // Generate Google Maps URLs
  const checkInMapUrl = promoter.checkInLocation
    ? `https://www.google.com/maps/search/?api=1&query=${promoter.checkInLocation.lat},${promoter.checkInLocation.lng}`
    : null

  const checkOutMapUrl = promoter.checkOutLocation
    ? `https://www.google.com/maps/search/?api=1&query=${promoter.checkOutLocation.lat},${promoter.checkOutLocation.lng}`
    : null

  // URL with both points (directions)
  const directionsUrl =
    hasCheckIn && hasCheckOut
      ? `https://www.google.com/maps/dir/?api=1&origin=${promoter.checkInLocation!.lat},${promoter.checkInLocation!.lng}&destination=${promoter.checkOutLocation!.lat},${promoter.checkOutLocation!.lng}`
      : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
                  className={cn('text-xs font-bold', promoter.status === 'ACTIVE' && 'bg-green-100 text-green-700 border-green-200')}
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
          <DialogDescription>Ubicaciones GPS de check-in y check-out</DialogDescription>
        </DialogHeader>

        {/* Google Maps Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {checkInMapUrl && (
            <Button
              variant="outline"
              className="h-auto py-3 flex flex-col items-center gap-2"
              onClick={() => window.open(checkInMapUrl, '_blank')}
            >
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-sm font-bold">Ver Check-in</span>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
            </Button>
          )}

          {checkOutMapUrl && (
            <Button
              variant="outline"
              className="h-auto py-3 flex flex-col items-center gap-2"
              onClick={() => window.open(checkOutMapUrl, '_blank')}
            >
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="text-sm font-bold">Ver Check-out</span>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
            </Button>
          )}

          {directionsUrl && (
            <Button
              variant="default"
              className="h-auto py-3 flex flex-col items-center gap-2"
              onClick={() => window.open(directionsUrl, '_blank')}
            >
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4" />
                <span className="text-sm font-bold">Ver Ruta</span>
              </div>
              <ExternalLink className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Location Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {/* Check-in Details */}
          <div
            className={cn(
              'p-4 rounded-xl border',
              hasCheckIn ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' : 'bg-muted',
            )}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-green-500">
                <Clock className="w-4 h-4 text-white" />
              </div>
              <h4 className="font-bold text-sm">Check-in</h4>
            </div>

            {hasCheckIn ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="font-mono">{promoter.checkInTime || '--:--'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {promoter.checkInLocation?.lat.toFixed(6)}, {promoter.checkInLocation?.lng.toFixed(6)}
                    </span>
                  </div>
                  {promoter.checkInLocation?.accuracy && (
                    <div className="flex items-center gap-2 text-sm">
                      <Navigation className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Precisión: ±{promoter.checkInLocation.accuracy.toFixed(0)}m</span>
                    </div>
                  )}
                </div>

                {/* Check-in Photo */}
                {promoter.checkInPhotoUrl && (
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground mb-2">Foto de entrada:</p>
                    <img
                      src={promoter.checkInPhotoUrl}
                      alt="Check-in"
                      className="w-full rounded-lg border border-green-200 dark:border-green-800"
                    />
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Sin registro de check-in</p>
            )}
          </div>

          {/* Check-out Details */}
          <div
            className={cn(
              'p-4 rounded-xl border',
              hasCheckOut ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800' : 'bg-muted',
            )}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-red-500">
                <Clock className="w-4 h-4 text-white" />
              </div>
              <h4 className="font-bold text-sm">Check-out</h4>
            </div>

            {hasCheckOut ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="font-mono">{promoter.checkOutTime || '--:--'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {promoter.checkOutLocation?.lat.toFixed(6)}, {promoter.checkOutLocation?.lng.toFixed(6)}
                    </span>
                  </div>
                  {promoter.checkOutLocation?.accuracy && (
                    <div className="flex items-center gap-2 text-sm">
                      <Navigation className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Precisión: ±{promoter.checkOutLocation.accuracy.toFixed(0)}m</span>
                    </div>
                  )}
                </div>

                {/* Check-out Photo */}
                {promoter.checkOutPhotoUrl && (
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground mb-2">Foto de salida:</p>
                    <img
                      src={promoter.checkOutPhotoUrl}
                      alt="Check-out"
                      className="w-full rounded-lg border border-red-200 dark:border-red-800"
                    />
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{promoter.status === 'ACTIVE' ? 'Aún en turno' : 'Sin registro de check-out'}</p>
            )}
          </div>
        </div>

        {/* Distance between points */}
        {distance !== null && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl">
            <div className="flex items-center gap-2">
              <Navigation className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium">Distancia entre check-in y check-out:</span>
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                {distance < 1000 ? `${distance}m` : `${(distance / 1000).toFixed(2)}km`}
              </span>
            </div>
            {distance > 100 && (
              <p className="text-xs text-muted-foreground mt-2">⚠️ El promotor se movió {distance}m entre check-in y check-out</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
