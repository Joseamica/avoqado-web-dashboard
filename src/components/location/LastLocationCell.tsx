import { useTranslation } from 'react-i18next'
import { DateTime } from 'luxon'
import { MapPin, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useVenueDateTime } from '@/utils/datetime'

interface LatestLocation {
  latitude: number
  longitude: number
  accuracy: number | null
  capturedAt: string
  source: string
}

export function LastLocationCell({ latest }: { latest: LatestLocation | null }) {
  const { t, i18n } = useTranslation('playtelecom')
  const { formatDateTime } = useVenueDateTime()

  if (!latest) {
    return <span className="text-xs text-muted-foreground">{t('location.none')}</span>
  }

  const relative =
    DateTime.fromISO(latest.capturedAt, { zone: 'utc' }).toRelative({ locale: i18n.language }) ?? formatDateTime(latest.capturedAt)
  const absolute = formatDateTime(latest.capturedAt)
  const mapsUrl = `https://www.google.com/maps?q=${latest.latitude},${latest.longitude}`

  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-col" title={absolute}>
        <span className="text-xs font-medium">{relative}</span>
        {latest.accuracy != null && <span className="text-[10px] text-muted-foreground">±{Math.round(latest.accuracy)} m</span>}
      </div>
      <Button asChild variant="outline" size="sm" className="h-7 cursor-pointer">
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
          <MapPin className="w-3.5 h-3.5 mr-1" />
          {t('location.viewOnMap')}
          <ExternalLink className="w-3 h-3 ml-1" />
        </a>
      </Button>
    </div>
  )
}
