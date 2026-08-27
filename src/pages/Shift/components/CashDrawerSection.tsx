import api from '@/api'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'

/**
 * LA CAJA FÍSICA — fase 1 de la unificación de caja (auditoría 27-ago).
 *
 * La tabla de "Turnos" de arriba es el `Shift` de la PAX: ventas y propinas por jornada.
 * Esto es OTRA cosa: el cajón que escriben Android y la TPV al cobrar en efectivo, con su
 * fondo, entradas, salidas y el conteo al cerrar. Calculaba el sobrante/faltante desde
 * siempre y el dueño no podía verlo desde ningún lado.
 *
 * Dos reglas que vienen del riesgo laboral de un faltante (LFT 107/110):
 *   · un cierre SIN conteo se dice así — nunca se pinta como "cuadró";
 *   · si hay más de una caja abierta a la vez, se avisa en vez de esconderlo.
 */

interface DrawerSession {
  id: string
  status: string
  deviceName: string | null
  openedByName: string
  openedAt: string
  closedByName: string | null
  closedAt: string | null
  startingAmount: number
  cashSales: number
  payIns: number
  payOuts: number
  expectedAmount: number
  counted: boolean
  actualAmount: number | null
  overShort: number | null
  closingNote: string | null
}

interface DrawerStatus {
  open: DrawerSession | null
  anomalies: Array<{ code: string; sessionIds: string[]; message: string }>
}

interface DrawerSessions {
  sessions: DrawerSession[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

const PAGE_SIZE = 10

export function CashDrawerSection() {
  const { t } = useTranslation('shifts')
  const { venueId } = useCurrentVenue()
  const { formatDateTime } = useVenueDateTime()
  const [page, setPage] = useState(1)

  const status = useQuery({
    queryKey: ['cash-drawer', 'status', venueId],
    queryFn: async () => (await api.get<DrawerStatus>(`/api/v1/dashboard/venues/${venueId}/cash-drawer/status`)).data,
    enabled: !!venueId,
    refetchInterval: 60_000,
  })

  const history = useQuery({
    queryKey: ['cash-drawer', 'sessions', venueId, page],
    queryFn: async () =>
      (await api.get<DrawerSessions>(`/api/v1/dashboard/venues/${venueId}/cash-drawer/sessions`, { params: { page, pageSize: PAGE_SIZE } })).data,
    enabled: !!venueId,
  })

  const open = status.data?.open ?? null
  const anomalies = status.data?.anomalies ?? []
  const sessions = history.data?.sessions ?? []
  const totalPages = history.data?.pagination.totalPages ?? 1

  const diffBadge = useMemo(
    () => (s: DrawerSession) => {
      if (!s.counted) {
        return <Badge variant="outline">{t('drawer.notCounted')}</Badge>
      }
      const v = s.overShort ?? 0
      if (v === 0) return <Badge variant="secondary">{t('drawer.balanced')}</Badge>
      return (
        <Badge variant={v < 0 ? 'destructive' : 'secondary'}>
          {v < 0 ? t('drawer.short') : t('drawer.over')} {Currency(Math.abs(v))}
        </Badge>
      )
    },
    [t],
  )

  return (
    <section className="mt-10" data-tour="cash-drawer-section">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">{t('drawer.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('drawer.subtitle')}</p>
      </div>

      {anomalies.length > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-input bg-muted p-4" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
          <div className="text-sm">
            {anomalies.map(a => (
              <p key={a.code}>{a.message}</p>
            ))}
          </div>
        </div>
      )}

      {/* La caja de ahora */}
      <Card className="border-input mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('drawer.now')}</CardTitle>
        </CardHeader>
        <CardContent>
          {status.isLoading ? (
            <p className="text-sm text-muted-foreground">{t('drawer.loading')}</p>
          ) : status.isError ? (
            <div className="flex items-center gap-3">
              <p className="text-sm text-destructive">{t('drawer.error')}</p>
              <Button size="sm" variant="outline" onClick={() => status.refetch()}>
                {t('drawer.retry')}
              </Button>
            </div>
          ) : !open ? (
            <p className="text-sm text-muted-foreground">{t('drawer.noneOpen')}</p>
          ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
              <Item label={t('drawer.openedBy')} value={`${open.openedByName} · ${formatDateTime(open.openedAt)}`} wide />
              <Item label={t('drawer.device')} value={open.deviceName ?? '—'} />
              <Item label={t('drawer.starting')} value={Currency(open.startingAmount)} />
              <Item label={t('drawer.cashSales')} value={Currency(open.cashSales)} />
              <Item label={t('drawer.payIns')} value={Currency(open.payIns)} />
              <Item label={t('drawer.payOuts')} value={Currency(open.payOuts)} />
              <Item label={t('drawer.expected')} value={Currency(open.expectedAmount)} strong />
            </dl>
          )}
        </CardContent>
      </Card>

      {/* Historial */}
      <Card className="border-input">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('drawer.history')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {history.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">{t('drawer.loading')}</p>
          ) : history.isError ? (
            <div className="flex items-center gap-3 p-4">
              <p className="text-sm text-destructive">{t('drawer.error')}</p>
              <Button size="sm" variant="outline" onClick={() => history.refetch()}>
                {t('drawer.retry')}
              </Button>
            </div>
          ) : sessions.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">{t('drawer.empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">{t('drawer.col.opened')}</th>
                    <th className="px-4 py-2 font-medium">{t('drawer.col.closed')}</th>
                    <th className="px-4 py-2 font-medium">{t('drawer.col.by')}</th>
                    <th className="px-4 py-2 text-right font-medium">{t('drawer.starting')}</th>
                    <th className="px-4 py-2 text-right font-medium">{t('drawer.cashSales')}</th>
                    <th className="px-4 py-2 text-right font-medium">{t('drawer.expected')}</th>
                    <th className="px-4 py-2 text-right font-medium">{t('drawer.col.counted')}</th>
                    <th className="px-4 py-2 font-medium">{t('drawer.col.result')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map(s => (
                    <tr key={s.id} className="border-t border-border">
                      <td className="px-4 py-2 whitespace-nowrap">{formatDateTime(s.openedAt)}</td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {s.closedAt ? formatDateTime(s.closedAt) : <Badge variant="secondary">{t('drawer.stillOpen')}</Badge>}
                      </td>
                      <td className="px-4 py-2">{s.closedByName ?? s.openedByName}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{Currency(s.startingAmount)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{Currency(s.cashSales)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{Currency(s.expectedAmount)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{s.counted && s.actualAmount !== null ? Currency(s.actualAmount) : '—'}</td>
                      <td className="px-4 py-2">{s.status === 'OPEN' ? '' : diffBadge(s)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 border-t border-border p-3 text-sm">
              <span className="text-muted-foreground">
                {t('drawer.page', { page, total: totalPages })}
              </span>
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                ‹
              </Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                ›
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

function Item({ label, value, strong, wide }: { label: string; value: string; strong?: boolean; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : undefined}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={strong ? 'font-semibold tabular-nums' : 'tabular-nums'}>{value}</dd>
    </div>
  )
}
