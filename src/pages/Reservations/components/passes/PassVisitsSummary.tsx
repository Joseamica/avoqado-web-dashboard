import { useMemo, useState } from 'react'
import { DateTime } from 'luxon'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePassIntegrationsOverview, usePassVisitsSummary } from '@/hooks/use-passes'
import { apiErrorDescription } from '@/utils/apiError'
import { useVenueDateTime } from '@/utils/datetime'

/** El producto arranca en 2026: un año a medias (0002, 0020…) o anterior a esto no es un mes que valga la pena pedir. */
const MIN_MONTH = '2020-01'
const COLUMNS = ['confirmed', 'alreadyConfirmed', 'expired', 'rejected', 'pending', 'lateCancellations'] as const

/**
 * Reporte mensual por proveedor (spec §8): lo que el estudio cuadra contra el depósito del día 15. El mes se elige con
 * un `<input type="month">` nativo y arranca en el mes actual DEL VENUE (zona del negocio, nunca la del navegador ni
 * UTC); no se ofrecen meses futuros. Sólo salen los proveedores con conexión (R2b-28, como el filtro de la lista): hoy
 * TotalPass; Wellhub aparece solo cuando se conecte. Un refresco fallido no tapa las cifras ya cargadas (H1).
 */
export function PassVisitsSummary({ venueId }: { venueId: string }) {
  const { t } = useTranslation('passes')
  const { venueTimezone } = useVenueDateTime()
  const currentMonth = DateTime.now().setZone(venueTimezone).toFormat('yyyy-MM')
  const [month, setMonth] = useState(currentMonth)
  // `draft` es lo que muestra el campo. Donde el navegador no trae selector de mes (Firefox, Safari de escritorio) es un
  // campo de texto que se teclea de a poco — y Chrome dispara «change» por cada dígito del año: a la consulta sólo llega un
  // AAAA-MM completo, válido y razonable (≥ MIN_MONTH), no una petición por dígito.
  const [draft, setDraft] = useState(currentMonth)
  const onMonthChange = (value: string) => {
    const next = value > currentMonth ? currentMonth : value
    setDraft(next)
    if (next >= MIN_MONTH && DateTime.fromFormat(next, 'yyyy-MM').isValid) setMonth(next)
  }

  const summary = usePassVisitsSummary(venueId, month)
  // Misma clave que la lista y el filtro de proveedor (TanStack la pide una vez). Conexión revocada = sigue contando.
  const overview = usePassIntegrationsOverview(venueId)
  const connected = useMemo(() => new Set(overview.data?.connections.filter(c => c.status !== null).map(c => c.provider) ?? []), [overview.data])
  const rows = (summary.data ?? []).filter(row => connected.has(row.provider))

  // Sólo es error de pantalla si nunca llegó lo que hace falta; sin la vista general no se adivina qué proveedores mostrar.
  const failed = (summary.isError && !summary.data) || (overview.isError && !overview.data)
  const error = summary.isError && !summary.data ? summary.error : overview.error
  // `isPending` y no `isLoading`: con la consulta apagada tampoco hay nada que concluir.
  const loading = !failed && (summary.isPending || overview.isPending)
  // La vista general NO se refresca sola (el resumen sí, cada 30 s): sin esto un error suyo dejaba la tarjeta muerta hasta recargar.
  const retry = () => {
    if (summary.isError && !summary.data) void summary.refetch()
    if (overview.isError && !overview.data) void overview.refetch()
  }

  return (
    <Card className="border-input shadow-sm" data-tour="passes-summary">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <CardTitle className="text-base">{t('summary.title')}</CardTitle>
            <CardDescription>{t('summary.description')}</CardDescription>
          </div>
          <div className="space-y-1">
            <Label htmlFor="passes-summary-month">{t('summary.month')}</Label>
            <Input
              id="passes-summary-month"
              type="month"
              className="w-44"
              value={draft}
              min={MIN_MONTH}
              max={currentMonth}
              placeholder={t('summary.monthPlaceholder')}
              onChange={e => onMonthChange(e.target.value)}
              onBlur={() => setDraft(month)}
              data-tour="passes-summary-month"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {failed ? (
          <div className="p-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{t('summary.loadError')}</AlertTitle>
              <AlertDescription>{apiErrorDescription(error) || t('errors.generic')}</AlertDescription>
              <Button
                variant="outline"
                size="sm"
                className="col-start-2 mt-2 justify-self-start"
                onClick={retry}
                disabled={summary.isFetching || overview.isFetching}
                data-tour="passes-summary-retry"
              >
                {t('common:retry')}
              </Button>
            </Alert>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground" role="status" aria-label={t('common:loading')}>
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t('summary.empty')}</p>
        ) : (
          <>
            {summary.isError && (
              <div className="px-4 pb-3">
                <Alert className="border-input bg-muted/40">
                  <AlertTriangle className="h-4 w-4" />
                  {/* En la descripción y no en el título: el título recorta a una línea (line-clamp-1) y en celular se cortaba. */}
                  <AlertDescription className="text-foreground">
                    <p>{t('summary.refreshError')}</p>
                    {apiErrorDescription(summary.error) && <p className="text-muted-foreground">{apiErrorDescription(summary.error)}</p>}
                  </AlertDescription>
                </Alert>
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow className="border-input">
                  <TableHead>{t('summary.columns.provider')}</TableHead>
                  {COLUMNS.map(c => (
                    <TableHead key={c} className="text-right">
                      {t(`summary.columns.${c}`)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(row => (
                  <TableRow key={row.provider} className="border-input">
                    <TableCell className="font-medium">{t(`providers.${row.provider}`)}</TableCell>
                    {COLUMNS.map(c => (
                      <TableCell key={c} className={`text-right tabular-nums ${c === 'expired' && row.expired > 0 ? 'text-destructive' : ''}`}>
                        {row[c]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {/* Es de RESERVAS y por el día de la cancelación, no de visitas por día de check-in como las otras columnas. */}
            <p className="px-4 py-3 text-xs text-muted-foreground">{t('summary.lateCancellationsNote')}</p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
