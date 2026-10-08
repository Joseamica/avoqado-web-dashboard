import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { TpvListDevice } from '@/services/tpv.service'
import { getDeviceIdentifier } from '../deviceListPresentation'
import { DeviceAppVersionCell, DeviceBatteryCell, DeviceIcon, DeviceStatusPill, DeviceSystemCell, DeviceTodaySalesCell } from './DeviceListCells'

interface DeviceMobileListProps {
  devices: TpvListDevice[]
  isLoading: boolean
  total: number
  pageIndex: number
  pageSize: number
  onPageChange: (pageIndex: number) => void
  linkState?: Record<string, unknown>
  emptyMessage: string
}

/**
 * Lista en tarjetas para pantallas chicas (maqueta D). La tabla de escritorio no cabía:
 * se partía en dos renglones y escondía batería, versión e ID. Aquí cada tarjeta enseña lo
 * mismo que la fila, sin scroll de lado.
 */
export function DeviceMobileList({ devices, isLoading, total, pageIndex, pageSize, onPageChange, linkState, emptyMessage }: DeviceMobileListProps) {
  const { t } = useTranslation('tpv')
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  if (isLoading) {
    return (
      <div className="space-y-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[104px] w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (devices.length === 0) {
    return <p className="rounded-xl border border-dashed border-input px-4 py-10 text-center text-sm text-muted-foreground">{emptyMessage}</p>
  }

  return (
    <div className="space-y-2.5">
      {devices.map(device => {
        const id = getDeviceIdentifier(device)
        return (
          <Link
            key={device.id}
            to={device.id}
            state={linkState}
            className="block rounded-xl border border-input bg-card p-3.5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-start gap-3">
              <DeviceIcon device={device} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{device.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[device.model, id?.display].filter(Boolean).join(' · ')}
                </p>
              </div>
              <DeviceStatusPill device={device} className="shrink-0" />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border pt-3">
              <DeviceBatteryCell device={device} />
              <DeviceSystemCell device={device} />
              <DeviceAppVersionCell device={device} />
              {(device.todayPaymentCount ?? 0) > 0 && (
                <span className="ml-auto">
                  <DeviceTodaySalesCell count={device.todayPaymentCount} total={device.todayPaymentTotal} />
                </span>
              )}
            </div>
          </Link>
        )
      })}

      {pageCount > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" size="sm" disabled={pageIndex === 0} onClick={() => onPageChange(pageIndex - 1)}>
            <ChevronLeft className="size-4" />
            {t('list.pagination.prev')}
          </Button>
          <span className="text-xs text-muted-foreground">{t('list.pagination.page', { page: pageIndex + 1, pages: pageCount })}</span>
          <Button variant="outline" size="sm" disabled={pageIndex + 1 >= pageCount} onClick={() => onPageChange(pageIndex + 1)}>
            {t('list.pagination.next')}
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
