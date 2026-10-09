import DataTable from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useCommissionSummariesPage } from '@/hooks/useCommissions'
import type { CommissionSummary } from '@/types/commission'
import { type ColumnDef } from '@tanstack/react-table'
import { Eye, MoreHorizontal, FileText } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { MostrandoDeTotal, NotaDeLoCalculado } from './AvisosDeResumen'
import { fechaEnLaSede, useZonaDeLaSede } from '../fechasDeVigencia'

/**
 * Lo que el motor calculó por persona y periodo. Sin columna de estado (E6a-fix F9, QA H4): el estado de estos resúmenes es
 * del flujo viejo de pagos (retirado con el 410 de E1a) y contradecía al recibo («Pagado» con el recibo pendiente). El pago
 * vive en el recibo de Pago al personal; aquí no se aprueba ni se paga. Con Pago al personal activo (E6a-fix2 C6) se dice que
 * esto es lo CALCULADO —puede no coincidir con lo que se paga— y, a quien puede verlo, se le lleva al recibo.
 */
export default function TeamCommissionTable({ staffPayActive = false, puedeVerRecibos = false }: { staffPayActive?: boolean; puedeVerRecibos?: boolean } = {}) {
  const { t, i18n } = useTranslation('commissions')
  const { t: _tCommon } = useTranslation()
  const navigate = useNavigate()
  const { venueSlug, fullBasePath } = useCurrentVenue()
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 20,
  })

  // Fetch summaries. Sin fechas a propósito: el servidor pone la ventana de los últimos 12 meses y topa los renglones (`total`).
  const { data: page, isLoading } = useCommissionSummariesPage()
  const summaries = page?.items

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(i18n.language === 'es' ? 'es-MX' : 'en-US', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  // Format date
  // Los periodos los corta el servidor en la zona del negocio: se leen en esa misma zona (ft-graves, D-D2).
  const zona = useZonaDeLaSede()
  const formatDate = (dateString: string) => fechaEnLaSede(dateString, zona, i18n.language)

  // Format period
  const formatPeriod = (start: string, end: string) => {
    const startDate = formatDate(start)
    const endDate = formatDate(end)
    return `${startDate} - ${endDate}`
  }

  // Table columns
  const columns: ColumnDef<CommissionSummary>[] = useMemo(
    () => [
      {
        accessorKey: 'staff',
        header: t('table.staff'),
        cell: ({ row }) => {
          const staff = row.original.staff
          return (
            <div className="font-medium">
              {staff.firstName} {staff.lastName}
            </div>
          )
        },
      },
      {
        accessorKey: 'period',
        header: t('table.period'),
        cell: ({ row }) => formatPeriod(row.original.periodStart, row.original.periodEnd),
      },
      {
        accessorKey: 'totalCommissions',
        header: t('table.commission'),
        cell: ({ row }) => <span className="font-medium">{formatCurrency(row.original.totalCommissions)}</span>,
      },
      {
        accessorKey: 'netAmount',
        header: t('summary.netAmount'),
        cell: ({ row }) => <span className="font-semibold text-foreground">{formatCurrency(row.original.netAmount)}</span>,
      },
      {
        id: 'actions',
        header: t('table.actions'),
        cell: ({ row }) => {
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(`${fullBasePath}/team/${row.original.staff.staffVenueId}`)}>
                  <Eye className="h-4 w-4 mr-2" />
                  {t('table.viewDetails')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [t, i18n.language, formatCurrency, formatPeriod, navigate, venueSlug, fullBasePath],
  )

  const encabezado = (
    <div className="p-4 border-b border-border/50 space-y-1">
      <h3 className="font-semibold">{t('summary.title')}</h3>
      {/* Sin fechas, el servidor devuelve los últimos 12 meses (no toda la historia de la sede): se dice cuál ventana es. */}
      <p className="text-sm text-muted-foreground" data-tour="commissions-summary-window">
        {t('summary.lastTwelveMonths')}
      </p>
      <NotaDeLoCalculado staffPayActive={staffPayActive} puedeVerRecibos={puedeVerRecibos} />
      <MostrandoDeTotal n={summaries?.length ?? 0} total={page?.total} />
    </div>
  )

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  // Empty state — no summaries yet
  if (!summaries || summaries.length === 0) {
    return (
      <div className="relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-sm">
        {encabezado}
        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
          <div className="p-4 rounded-full bg-muted mb-4">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-base font-medium mb-1">{t('summary.noSummaries')}</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            {t('summary.noSummariesDescription')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-sm">
      {encabezado}
      <DataTable<CommissionSummary>
        columns={columns}
        data={summaries}
        showColumnCustomizer={false}
        pagination={pagination}
        setPagination={setPagination}
        rowCount={summaries.length}
      />
    </div>
  )
}
