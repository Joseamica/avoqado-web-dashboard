/**
 * DepositValidation - Validación de depósito de efectivo
 *
 * Compara:
 * - Venta esperada (del sistema)
 * - Depósito declarado (por el promotor)
 * - Foto del comprobante de depósito
 *
 * Permite aprobar/rechazar el cierre de caja
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { AlertTriangle, Camera, CheckCircle2, DollarSign, Download, Receipt, XCircle } from 'lucide-react'
import { useState } from 'react'

interface DepositValidationProps {
  promoterId: string
  promoterName: string
  expectedAmount: number // Venta del día
  declaredAmount?: number // Monto declarado por el promotor
  voucherPhotoUrl?: string // Foto del comprobante
  status?: 'PENDING' | 'APPROVED' | 'REJECTED'
}

export function DepositValidation({
  promoterId: _promoterId,
  promoterName,
  expectedAmount,
  declaredAmount,
  voucherPhotoUrl,
  status = 'PENDING',
}: DepositValidationProps) {
  const [validationStatus, setValidationStatus] = useState(status)
  const [photoModalOpen, setPhotoModalOpen] = useState(false)

  // Calculate difference
  const difference = declaredAmount ? declaredAmount - expectedAmount : 0
  const hasDifference = Math.abs(difference) > 0
  const isExcess = difference > 0
  const isShortage = difference < 0

  // Determine validation state
  const isDifferenceSignificant = Math.abs(difference) > expectedAmount * 0.05 // 5% tolerance

  return (
    <div className="bg-card rounded-xl border p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-bold flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-500/5">
              <Receipt className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            Validación de Depósito
          </h3>
          <p className="text-xs text-muted-foreground mt-1">Cierre de caja - {promoterName}</p>
        </div>

        {validationStatus !== 'PENDING' && (
          <Badge
            variant={validationStatus === 'APPROVED' ? 'default' : 'destructive'}
            className={cn('font-bold', validationStatus === 'APPROVED' && 'bg-green-100 text-green-700 border-green-200')}
          >
            {validationStatus === 'APPROVED' ? (
              <>
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Aprobado
              </>
            ) : (
              <>
                <XCircle className="w-3 h-3 mr-1" />
                Rechazado
              </>
            )}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Amounts comparison */}
        <div className="space-y-4">
          {/* Expected amount */}
          <div className="p-4 rounded-xl border bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <p className="text-xs font-bold text-blue-900 dark:text-blue-100">Venta Esperada (Sistema)</p>
            </div>
            <p className="text-2xl font-black text-blue-600 dark:text-blue-400">${expectedAmount.toLocaleString('es-MX')}</p>
          </div>

          {/* Declared amount */}
          <div
            className={cn(
              'p-4 rounded-xl border',
              !declaredAmount && 'bg-muted',
              declaredAmount && !hasDifference && 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800',
              declaredAmount && isExcess && 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800',
              declaredAmount && isShortage && 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800',
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <Receipt className="w-4 h-4" />
              <p className="text-xs font-bold">Depósito Declarado</p>
            </div>
            {declaredAmount ? (
              <p className="text-2xl font-black">${declaredAmount.toLocaleString('es-MX')}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Pendiente de declarar</p>
            )}
          </div>

          {/* Difference indicator */}
          {declaredAmount && hasDifference && (
            <div
              className={cn(
                'p-4 rounded-xl border flex items-center gap-3',
                isDifferenceSignificant
                  ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                  : 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800',
              )}
            >
              <AlertTriangle
                className={cn(
                  'w-5 h-5',
                  isDifferenceSignificant ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400',
                )}
              />
              <div>
                <p className="text-xs font-bold">{isExcess ? 'Excedente' : 'Faltante'}</p>
                <p className="text-lg font-black">
                  {isExcess ? '+' : ''}${difference.toLocaleString('es-MX')}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {((Math.abs(difference) / expectedAmount) * 100).toFixed(1)}% de diferencia
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right: Voucher photo */}
        <div className="space-y-4">
          <div
            className={cn(
              'relative aspect-[4/3] rounded-xl border-2 border-dashed overflow-hidden',
              voucherPhotoUrl ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 bg-muted',
            )}
          >
            {voucherPhotoUrl ? (
              <>
                <img
                  src={voucherPhotoUrl}
                  alt="Comprobante de depósito"
                  className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setPhotoModalOpen(true)}
                />
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 rounded-full shadow-lg"
                  onClick={() => setPhotoModalOpen(true)}
                >
                  <Download className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Camera className="w-8 h-8 text-muted-foreground/50 mb-2" />
                <p className="text-xs text-muted-foreground">Sin comprobante de depósito</p>
              </div>
            )}
          </div>

          {/* Actions */}
          {validationStatus === 'PENDING' && declaredAmount && (
            <div className="flex gap-2">
              <Button onClick={() => setValidationStatus('APPROVED')} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Aprobar Cierre
              </Button>
              <Button onClick={() => setValidationStatus('REJECTED')} variant="destructive" className="flex-1">
                <XCircle className="w-4 h-4 mr-2" />
                Rechazar
              </Button>
            </div>
          )}

          {validationStatus === 'APPROVED' && (
            <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
              <p className="text-sm font-bold text-green-700 dark:text-green-400">✓ Cierre de caja aprobado</p>
              <p className="text-xs text-muted-foreground mt-1">El depósito ha sido validado correctamente</p>
            </div>
          )}

          {validationStatus === 'REJECTED' && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
              <p className="text-sm font-bold text-red-700 dark:text-red-400">✗ Cierre de caja rechazado</p>
              <p className="text-xs text-muted-foreground mt-1">El depósito requiere revisión</p>
            </div>
          )}
        </div>
      </div>

      {/* Photo modal */}
      {voucherPhotoUrl && (
        <Dialog open={photoModalOpen} onOpenChange={setPhotoModalOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Comprobante de Depósito</DialogTitle>
            </DialogHeader>
            <img src={voucherPhotoUrl} alt="Comprobante de depósito" className="w-full rounded-lg" />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
