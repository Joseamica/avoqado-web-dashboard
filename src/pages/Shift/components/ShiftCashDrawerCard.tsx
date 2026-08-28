import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'
import { Banknote } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * Fase 5 de la unificación de caja: el arqueo del CAJÓN que cubrió este turno.
 *
 * `CashReconciliationSummary` (arriba) muestra lo que la PAX declaró al cerrar el turno; esto
 * muestra lo que el cajón físico (Android + TPV al cobrar) registró en el mismo lapso. Cuando
 * los dos existen y no coinciden, el dueño lo ve — y eso es exactamente lo que antes no podía.
 * Si el turno no tuvo caja abierta, la tarjeta no aparece (el turno se ve como siempre).
 */
export interface ShiftCashDrawer {
  sessionId: string
  status: string
  deviceName: string | null
  openedByName: string
  closedByName: string | null
  openedAt: string
  closedAt: string | null
  startingAmount: number
  expectedAmount: number
  counted: boolean
  actualAmount: number | null
  overShort: number | null
}

export function ShiftCashDrawerCard({ drawer }: { drawer: ShiftCashDrawer | null | undefined }) {
  const { t } = useTranslation('shifts')
  const { formatDateTime } = useVenueDateTime()
  if (!drawer) return null

  const result = (() => {
    if (drawer.status === 'OPEN') return <Badge variant="secondary">{t('drawer.stillOpen')}</Badge>
    if (!drawer.counted) return <Badge variant="outline">{t('drawer.notCounted')}</Badge>
    const v = drawer.overShort ?? 0
    if (v === 0) return <Badge variant="secondary">{t('drawer.balanced')}</Badge>
    return (
      <Badge variant={v < 0 ? 'destructive' : 'secondary'}>
        {v < 0 ? t('drawer.short') : t('drawer.over')} {Currency(Math.abs(v))}
      </Badge>
    )
  })()

  return (
    <Card className="border-input" data-tour="shift-cash-drawer">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Banknote className="h-4 w-4" aria-hidden="true" />
          {t('drawer.title')}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {drawer.deviceName ?? '—'} · {drawer.openedByName} · {formatDateTime(drawer.openedAt)}
        </p>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">{t('drawer.starting')}</dt>
            <dd className="tabular-nums">{Currency(drawer.startingAmount)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t('drawer.expected')}</dt>
            <dd className="font-semibold tabular-nums">{Currency(drawer.expectedAmount)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t('drawer.col.counted')}</dt>
            <dd className="tabular-nums">{drawer.counted && drawer.actualAmount !== null ? Currency(drawer.actualAmount) : '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t('drawer.col.result')}</dt>
            <dd>{result}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}
