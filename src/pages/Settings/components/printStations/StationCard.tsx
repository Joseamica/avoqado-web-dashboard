import { useTranslation } from 'react-i18next'
import { Pencil, Printer as PrinterIcon, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { PrintStation } from '@/services/printStations.service'
import { KitchenDisplayToggle } from './KitchenDisplayToggle'
import { destinoDeComanda } from './kitchenDisplay'

/**
 * Tarjeta de UNA estación (diseño A, 26-sep): a dónde imprime, su casilla de pantalla y a dónde llega su comanda. La
 * pantalla cuenta para «Llega a» sólo si está prendida Y el plan la incluye (el `hasKitchenDisplay` efectivo que el
 * servidor manda a la caja). El ruteo por categoría se sigue editando en la pestaña «Ruteo».
 */
export function StationCard({
  venueId,
  station,
  abiertaAClientes,
  tieneAccesoPro,
  onEdit,
  onDelete,
}: {
  venueId: string
  station: PrintStation
  abiertaAClientes: boolean
  tieneAccesoPro: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation('printStations')
  const destino = destinoDeComanda(station, station.hasKitchenDisplay && tieneAccesoPro)

  return (
    <Card className="border-input" data-testid={`station-card-${station.id}`}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="font-medium">{station.name}</span>
            {station.isDefault && <Badge variant="secondary">{t('stations.defaultBadge')}</Badge>}
            {station.isPacking && <Badge variant="outline">{t('stations.packingBadge')}</Badge>}
            {!station.active && <Badge variant="outline">{t('stations.statusInactive')}</Badge>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="icon" className="cursor-pointer" aria-label={t('actions.edit')} onClick={onEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="cursor-pointer text-destructive"
              aria-label={t('actions.delete')}
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <PrinterIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {station.printer ? t('stations.printerLine', { printer: station.printer.name }) : t('stations.printerFallback')}
            {station.printer && station.copies > 1 && <> · {t('stations.copiesSuffix', { count: station.copies })}</>}
          </span>
        </div>

        <KitchenDisplayToggle venueId={venueId} station={station} abiertaAClientes={abiertaAClientes} />

        <p className="text-xs text-muted-foreground">{t('stations.destinationLine', { destino: t(`destino.${destino}`) })}</p>
      </CardContent>
    </Card>
  )
}
