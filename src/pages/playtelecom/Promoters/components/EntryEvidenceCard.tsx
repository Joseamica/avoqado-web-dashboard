/**
 * EntryEvidenceCard - Check-in evidence with selfie and GPS validation
 *
 * IMPORTANTE: Implementar con TPV
 * - El TPV debe enviar la selfie de check-in a Firebase Storage
 * - El TPV debe enviar coordenadas GPS al hacer check-in
 * - El TPV debe crear el TimeEntry con checkInPhotoUrl y gpsLatitude/gpsLongitude
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { GlassCard } from '@/components/ui/glass-card'
import { Badge } from '@/components/ui/badge'
import {
  Camera,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Fingerprint,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface EntryEvidence {
  selfieUrl?: string
  checkInTime?: string
  checkOutTime?: string
  gpsValid: boolean
  gpsLocation?: { lat: number; lng: number }
  biometricValid?: boolean
  distanceFromStore?: number // in meters
}

interface EntryEvidenceCardProps {
  evidence: EntryEvidence | null
  storeName?: string
  className?: string
}

export const EntryEvidenceCard: React.FC<EntryEvidenceCardProps> = ({
  evidence,
  storeName,
  className,
}) => {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { activeVenue } = useAuth()
  const venueTimezone = activeVenue?.timezone || 'America/Mexico_City'

  if (!evidence) {
    return (
      <GlassCard className={cn('p-4', className)}>
        <div className="text-center py-6">
          <Camera className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">
            {t('playtelecom:promoters.evidence.noCheckIn', { defaultValue: 'Sin check-in registrado' })}
          </p>
        </div>
      </GlassCard>
    )
  }

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '--:--'
    return new Date(timeStr).toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: venueTimezone,
    })
  }

  const validations = [
    {
      label: t('playtelecom:promoters.evidence.gps', { defaultValue: 'GPS' }),
      valid: evidence.gpsValid,
      icon: MapPin,
      detail: evidence.distanceFromStore
        ? `${evidence.distanceFromStore}m de la tienda`
        : undefined,
    },
    {
      label: t('playtelecom:promoters.evidence.biometric', { defaultValue: 'Biométrico' }),
      valid: evidence.biometricValid ?? false,
      icon: Fingerprint,
    },
    {
      label: t('playtelecom:promoters.evidence.selfie', { defaultValue: 'Selfie' }),
      valid: !!evidence.selfieUrl,
      icon: Camera,
    },
  ]

  return (
    <GlassCard className={cn('p-4', className)}>
      <div className="flex items-center gap-2 mb-3">
        <Camera className="w-4 h-4 text-muted-foreground" />
        <h4 className="font-semibold text-sm">
          {t('playtelecom:promoters.evidence.title', { defaultValue: 'Evidencia de Entrada' })}
        </h4>
      </div>

      <div className="flex gap-4">
        {/* Selfie */}
        <div className="w-24 h-24 rounded-xl overflow-hidden bg-muted/30 shrink-0">
          {evidence.selfieUrl ? (
            <img
              src={evidence.selfieUrl}
              alt="Check-in selfie"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Camera className="w-8 h-8 text-muted-foreground/50" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 space-y-2">
          {/* Time */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-sm">
              <Clock className="w-3.5 h-3.5 text-green-500" />
              <span className="text-muted-foreground">
                {t('playtelecom:promoters.evidence.entry', { defaultValue: 'Entrada' })}:
              </span>
              <span className="font-medium">{formatTime(evidence.checkInTime)}</span>
            </div>
            {evidence.checkOutTime && (
              <div className="flex items-center gap-1.5 text-sm">
                <Clock className="w-3.5 h-3.5 text-red-500" />
                <span className="text-muted-foreground">
                  {t('playtelecom:promoters.evidence.exit', { defaultValue: 'Salida' })}:
                </span>
                <span className="font-medium">{formatTime(evidence.checkOutTime)}</span>
              </div>
            )}
          </div>

          {/* Store */}
          {storeName && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="w-3.5 h-3.5" />
              <span>{storeName}</span>
            </div>
          )}

          {/* Validations */}
          <div className="flex flex-wrap gap-2">
            {validations.map((validation) => (
              <Badge
                key={validation.label}
                variant="outline"
                className={cn(
                  'text-xs gap-1',
                  validation.valid
                    ? 'border-green-500/50 text-green-600 dark:text-green-400'
                    : 'border-red-500/50 text-red-600 dark:text-red-400'
                )}
              >
                {validation.valid ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : (
                  <AlertTriangle className="w-3 h-3" />
                )}
                {validation.label}
              </Badge>
            ))}
          </div>

          {/* GPS distance warning */}
          {evidence.distanceFromStore && evidence.distanceFromStore > 100 && (
            <p className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Check-in a {evidence.distanceFromStore}m de la tienda
            </p>
          )}
        </div>
      </div>
    </GlassCard>
  )
}

export default EntryEvidenceCard
