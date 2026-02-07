/**
 * DepositValidation - Deposit voucher validation with approve/reject actions
 *
 * IMPORTANTE: Implementar con TPV
 * - El TPV debe permitir registrar depósitos de efectivo (CashDeposit)
 * - El TPV debe subir foto del voucher a Firebase Storage
 * - El TPV crea CashDeposit con status PENDING
 * - El dashboard aprueba/rechaza y actualiza status a APPROVED/REJECTED
 */

import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { GlassCard } from '@/components/ui/glass-card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Receipt,
  CheckCircle2,
  XCircle,
  Clock,
  Image,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type DepositStatus = 'pending' | 'approved' | 'rejected'

interface Deposit {
  id: string
  amount: number
  date: string
  voucherUrl?: string
  status: DepositStatus
  notes?: string
  reviewedBy?: string
  reviewedAt?: string
}

interface DepositValidationProps {
  deposits: Deposit[]
  currency?: string
  onApprove?: (depositId: string, notes?: string) => void
  onReject?: (depositId: string, reason: string) => void
  className?: string
}

const STATUS_CONFIG: Record<DepositStatus, {
  label: string
  icon: typeof CheckCircle2
  color: string
  bgColor: string
}> = {
  pending: {
    label: 'Pendiente',
    icon: Clock,
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-500/10',
  },
  approved: {
    label: 'Aprobado',
    icon: CheckCircle2,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-500/10',
  },
  rejected: {
    label: 'Rechazado',
    icon: XCircle,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-500/10',
  },
}

export const DepositValidation: React.FC<DepositValidationProps> = ({
  deposits,
  currency = 'MXN',
  onApprove,
  onReject,
  className,
}) => {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { activeVenue } = useAuth()
  const venueTimezone = activeVenue?.timezone || 'America/Mexico_City'
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(value)

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: venueTimezone,
    })

  const pendingCount = deposits.filter(d => d.status === 'pending').length

  return (
    <GlassCard className={cn('p-4', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-muted-foreground" />
          <h4 className="font-semibold text-sm">
            {t('playtelecom:promoters.deposits.title', { defaultValue: 'Depósitos' })}
          </h4>
        </div>
        {pendingCount > 0 && (
          <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600">
            {pendingCount} {t('playtelecom:promoters.deposits.pending', { defaultValue: 'pendientes' })}
          </Badge>
        )}
      </div>

      {deposits.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <Receipt className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">
            {t('playtelecom:promoters.deposits.noDeposits', { defaultValue: 'Sin depósitos' })}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {deposits.map((deposit) => {
            const statusConfig = STATUS_CONFIG[deposit.status]
            const StatusIcon = statusConfig.icon
            const isExpanded = expandedId === deposit.id

            return (
              <div
                key={deposit.id}
                className={cn(
                  'rounded-lg border border-border/50 overflow-hidden transition-colors',
                  deposit.status === 'pending' && 'border-yellow-500/50 bg-yellow-500/5'
                )}
              >
                {/* Header - clickable */}
                <div
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30"
                  onClick={() => setExpandedId(isExpanded ? null : deposit.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn('p-1.5 rounded-lg', statusConfig.bgColor)}>
                      <StatusIcon className={cn('w-4 h-4', statusConfig.color)} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{formatCurrency(deposit.amount)}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(deposit.date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn('text-xs', statusConfig.color)}>
                      {statusConfig.label}
                    </Badge>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-3">
                    <div className="h-px bg-border/50" />

                    {/* Voucher image */}
                    {deposit.voucherUrl ? (
                      <div className="relative rounded-lg overflow-hidden bg-muted/30">
                        <img
                          src={deposit.voucherUrl}
                          alt="Voucher"
                          className="w-full h-40 object-cover"
                        />
                        <a
                          href={deposit.voucherUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute top-2 right-2 p-1.5 rounded-lg bg-background/80 hover:bg-background transition-colors"
                        >
                          <Image className="w-4 h-4" />
                        </a>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-24 rounded-lg bg-muted/30 text-muted-foreground">
                        <div className="text-center">
                          <AlertTriangle className="w-6 h-6 mx-auto mb-1" />
                          <p className="text-xs">Sin comprobante</p>
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {deposit.notes && (
                      <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg">
                        {deposit.notes}
                      </p>
                    )}

                    {/* Review info */}
                    {deposit.reviewedBy && (
                      <p className="text-xs text-muted-foreground">
                        Revisado por {deposit.reviewedBy}
                        {deposit.reviewedAt && ` · ${formatDate(deposit.reviewedAt)}`}
                      </p>
                    )}

                    {/* Actions for pending deposits */}
                    {deposit.status === 'pending' && (onApprove || onReject) && (
                      <div className="space-y-2 pt-2">
                        <Textarea
                          placeholder={t('playtelecom:promoters.deposits.rejectReason', {
                            defaultValue: 'Razón del rechazo (requerido para rechazar)'
                          })}
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          className="text-sm h-20 resize-none"
                        />
                        <div className="flex items-center gap-2">
                          {onApprove && (
                            <Button
                              size="sm"
                              className="flex-1 bg-green-600 hover:bg-green-700"
                              onClick={() => {
                                onApprove(deposit.id)
                                setExpandedId(null)
                              }}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              {t('playtelecom:promoters.deposits.approve', { defaultValue: 'Aprobar' })}
                            </Button>
                          )}
                          {onReject && (
                            <Button
                              size="sm"
                              variant="destructive"
                              className="flex-1"
                              disabled={!rejectReason.trim()}
                              onClick={() => {
                                onReject(deposit.id, rejectReason)
                                setRejectReason('')
                                setExpandedId(null)
                              }}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              {t('playtelecom:promoters.deposits.reject', { defaultValue: 'Rechazar' })}
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </GlassCard>
  )
}

export default DepositValidation
