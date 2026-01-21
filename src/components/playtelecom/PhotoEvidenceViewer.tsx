/**
 * PhotoEvidenceViewer - Photo evidence display with zoom
 *
 * Displays thumbnail images with zoom on hover/click functionality.
 * Used for attendance photos, voucher validation, etc.
 *
 * Used in: promotores.html, tiendas.html, ventas.html mockups
 * Design: Matches Avoqado glassmorphism with interactive states
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, MapPin, Camera, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export interface PhotoEvidence {
  id: string
  url: string
  type: 'selfie' | 'voucher' | 'storefront' | 'product' | 'other'
  timestamp: Date
  location?: {
    lat: number
    lng: number
    address?: string
  }
  validations?: {
    biometry?: boolean
    gpsInRange?: boolean
    quality?: 'high' | 'medium' | 'low'
  }
  notes?: string
}

export interface PhotoEvidenceViewerProps {
  photos: PhotoEvidence[]
  layout?: 'grid' | 'row' // Grid for multiple, row for single/pair
  compact?: boolean
  className?: string
}

/**
 * PhotoEvidenceViewer Component
 *
 * @example
 * <PhotoEvidenceViewer
 *   photos={attendancePhotos}
 *   layout="row"
 * />
 */
export function PhotoEvidenceViewer({
  photos,
  layout = 'grid',
  compact = false,
  className,
}: PhotoEvidenceViewerProps) {
  if (photos.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center p-8 text-center', className)}>
        <Camera className="w-8 h-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No hay evidencias fotográficas</p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        layout === 'grid' && 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4',
        layout === 'row' && 'flex gap-4',
        className,
      )}
    >
      {photos.map(photo => (
        <PhotoCard key={photo.id} photo={photo} compact={compact} />
      ))}
    </div>
  )
}

// Individual photo card with modal zoom
function PhotoCard({ photo, compact }: { photo: PhotoEvidence; compact: boolean }) {
  const typeLabels = {
    selfie: 'Selfie',
    voucher: 'Voucher',
    storefront: 'Fachada',
    product: 'Producto',
    other: 'Otro',
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div
          className={cn(
            'group relative overflow-hidden rounded-lg border border-border bg-card cursor-pointer',
            'transition-all duration-300 hover:shadow-lg hover:scale-105',
            compact ? 'h-24' : 'h-40',
          )}
        >
          {/* Image */}
          <img
            src={photo.url}
            alt={`${typeLabels[photo.type]} - ${format(photo.timestamp, 'PPp', { locale: es })}`}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
          />

          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-white text-xs font-medium">
                Ver ampliado
              </div>
            </div>
          </div>

          {/* Type badge */}
          <div className="absolute top-2 left-2">
            <Badge variant="secondary" className="text-xs bg-black/60 text-white border-none backdrop-blur">
              {typeLabels[photo.type]}
            </Badge>
          </div>

          {/* Timestamp */}
          <div className="absolute bottom-2 left-2 right-2">
            <div className="text-[10px] font-mono text-white bg-black/60 px-1.5 py-0.5 rounded backdrop-blur truncate">
              {format(photo.timestamp, 'PPp', { locale: es })}
            </div>
          </div>

          {/* Validation badges (top right) */}
          {photo.validations && (
            <div className="absolute top-2 right-2 flex flex-col gap-1">
              {photo.validations.biometry && (
                <div className="bg-green-500 text-white rounded-full p-0.5">
                  <CheckCircle className="w-3 h-3" />
                </div>
              )}
              {photo.validations.gpsInRange && (
                <div className="bg-green-500 text-white rounded-full p-0.5">
                  <MapPin className="w-3 h-3" />
                </div>
              )}
              {photo.validations.quality === 'low' && (
                <div className="bg-yellow-500 text-white rounded-full p-0.5">
                  <AlertCircle className="w-3 h-3" />
                </div>
              )}
            </div>
          )}
        </div>
      </DialogTrigger>

      {/* Full-size modal */}
      <DialogContent className="max-w-4xl">
        <div className="space-y-4">
          {/* Full image */}
          <div className="relative w-full max-h-[70vh] overflow-hidden rounded-lg">
            <img
              src={photo.url}
              alt={`${typeLabels[photo.type]} - ${format(photo.timestamp, 'PPp', { locale: es })}`}
              className="w-full h-full object-contain"
            />
          </div>

          {/* Metadata */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{typeLabels[photo.type]}</h3>
                <p className="text-sm text-muted-foreground">
                  {format(photo.timestamp, 'PPPp', { locale: es })}
                </p>
              </div>
              {photo.validations && (
                <div className="flex gap-2">
                  {photo.validations.biometry && (
                    <Badge variant="secondary" className="text-xs">
                      <CheckCircle className="w-3 h-3 mr-1 text-green-600" />
                      Biometría OK
                    </Badge>
                  )}
                  {photo.validations.gpsInRange && (
                    <Badge variant="secondary" className="text-xs">
                      <MapPin className="w-3 h-3 mr-1 text-green-600" />
                      GPS en Rango
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Location */}
            {photo.location && (
              <div className="text-sm">
                <p className="text-muted-foreground">
                  📍 {photo.location.address || `${photo.location.lat}, ${photo.location.lng}`}
                </p>
              </div>
            )}

            {/* Notes */}
            {photo.notes && (
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm">{photo.notes}</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
