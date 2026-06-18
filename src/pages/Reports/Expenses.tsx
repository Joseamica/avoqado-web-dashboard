import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Inbox, Landmark, Loader2, Plus, Scale, Sparkles } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { AccountingErrorState } from '@/components/accounting/AccountingErrorState'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import { useExpenses, useCreateExpense, useGenerateExpensePolicies, useMarkExpensePaid } from '@/hooks/useExpenses'
import type { ExpenseCategoria, ExpenseDTO, ExpenseMetodoPago } from '@/services/fiscal/expense.service'
import { Currency } from '@/utils/currency'
import { cn } from '@/lib/utils'

const SAMPLE: ExpenseDTO[] = [
  {
    id: 's1', proveedorRfc: 'CACO850101AB1', proveedorNombre: 'Café del Centro SA', tipoTercero: 'NACIONAL', comprobanteTipo: 'INGRESO',
    metodoPago: 'PUE', categoria: 'COSTO_MERCANCIA', fechaEmision: '2026-06-12', fechaPago: '2026-06-12',
    subtotalCents: 100000, descuentoCents: 0, ivaCents: 16000, iva16Cents: 16000, iva8Cents: 0, iepsCents: 0,
    isrRetenidoCents: 0, ivaRetenidoCents: 0, totalCents: 116000, deducible: true, ivaAcreditable: true,
    paymentStatus: 'PAID', paidCents: 116000, paidPeriod: '2026-06', posted: false, uuid: 'SAMPLE-UUID', serie: null, folio: 'A-101',
    source: 'MANUAL', status: 'REGISTERED', createdAt: '2026-06-12T12:00:00.000Z',
  },
]

const CATEGORIAS: ExpenseCategoria[] = ['COSTO_MERCANCIA', 'GASTO_GENERAL', 'ARRENDAMIENTO', 'COMBUSTIBLE', 'HONORARIOS', 'SERVICIOS', 'OTRO']

const peso = (s: string) => Math.round((parseFloat(s) || 0) * 100)

function PayBadge({ status }: { status: ExpenseDTO['paymentStatus'] }) {
  const { t } = useTranslation('reports')
  const map = {
    PAID: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400',
    PARTIALLY_PAID: 'border-amber-500/40 text-amber-600 dark:text-amber-400',
    UNPAID: 'border-input text-muted-foreground',
  } as const
  return (
    <Badge variant="outline" className={cn('h-5 px-1.5 text-[10px]', map[status])}>
      {t(`expenses.payStatus.${status}`)}
    </Badge>
  )
}

function ExpensesInner() {
  const { t } = useTranslation('reports')
  const { fullBasePath } = useCurrentVenue()
  const { can } = useAccess()
  const { hasAccess } = useTierFeatureAccess('CFDI')
  const canManage = can('accounting:manage')
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7))
  const [modalOpen, setModalOpen] = useState(false)

  const query = useExpenses({ period }, { enabled: hasAccess })
  const generateMutation = useGenerateExpensePolicies()
  const markPaidMutation = useMarkExpensePaid()
  const [payTarget, setPayTarget] = useState<ExpenseDTO | null>(null)
  const data = query.data
  const expenses = hasAccess ? data?.expenses ?? [] : SAMPLE
  const summary = hasAccess ? data?.summary : { count: 1, totalCents: 116000, ivaCents: 16000, deducibleCents: 100000 }
  const needsFiscalSetup = hasAccess && data?.needsFiscalSetup

  return (
    <div className="p-4 space-y-5 bg-background">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('expenses.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {data?.rfc
              ? t('subtitleSuffix', { base: t('expenses.subtitle'), suffix: t('chartOfAccounts.rfcLabel', { rfc: data.rfc }) })
              : t('expenses.subtitle')}
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <label htmlFor="exp-period" className="block text-[10px] text-muted-foreground">{t('trialBalance.period')}</label>
            <Input id="exp-period" type="month" value={period} onChange={e => setPeriod(e.target.value)} className="h-10 w-40" />
          </div>
          {!needsFiscalSetup && canManage && hasAccess && (
            <>
              <Button size="sm" variant="outline" onClick={() => generateMutation.mutate(period)} disabled={generateMutation.isPending}>
                {generateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {t('expenses.generate')}
              </Button>
              <Button size="sm" onClick={() => setModalOpen(true)}>
                <Plus className="w-4 h-4" />
                {t('expenses.new')}
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Resumen */}
      {!needsFiscalSetup && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard label={t('expenses.summary.count')} value={String(summary?.count ?? 0)} />
          <SummaryCard label={t('expenses.summary.total')} value={Currency(summary?.totalCents ?? 0, true)} />
          <SummaryCard label={t('expenses.summary.iva')} value={Currency(summary?.ivaCents ?? 0, true)} />
          <SummaryCard label={t('expenses.summary.deducible')} value={Currency(summary?.deducibleCents ?? 0, true)} />
        </div>
      )}

      {query.isLoading && hasAccess ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : query.isError && hasAccess ? (
        <AccountingErrorState onRetry={() => query.refetch()} />
      ) : needsFiscalSetup ? (
        <Card className="border-input">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Landmark className="w-8 h-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">{t('chartOfAccounts.needsFiscalSetupTitle')}</p>
            <p className="max-w-md text-sm text-muted-foreground">{t('chartOfAccounts.needsFiscalSetupBody')}</p>
            <Link to={`${fullBasePath}/cfdi/configuracion`}>
              <Button size="sm" variant="outline">{t('chartOfAccounts.goToFiscalConfig')}</Button>
            </Link>
          </CardContent>
        </Card>
      ) : expenses.length === 0 ? (
        <Card className="border-input">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Inbox className="w-8 h-8 text-emerald-500" />
            <p className="text-sm font-medium text-foreground">{t('expenses.emptyTitle')}</p>
            <p className="max-w-md text-sm text-muted-foreground">{t('expenses.emptyBody')}</p>
            {canManage && (
              <Button size="sm" onClick={() => setModalOpen(true)}>
                <Plus className="w-4 h-4" />
                {t('expenses.new')}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-input">
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-input text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-normal">{t('expenses.col.proveedor')}</th>
                  <th className="px-3 py-2 font-normal">{t('expenses.col.fecha')}</th>
                  <th className="px-3 py-2 text-right font-normal">{t('expenses.col.iva')}</th>
                  <th className="px-3 py-2 text-right font-normal">{t('expenses.col.total')}</th>
                  <th className="px-3 py-2 font-normal">{t('expenses.col.metodo')}</th>
                  <th className="px-3 py-2 font-normal">{t('expenses.col.pago')}</th>
                  <th className="px-3 py-2 font-normal">{t('expenses.col.poliza')}</th>
                  {canManage && <th className="px-3 py-2 font-normal"></th>}
                </tr>
              </thead>
              <tbody>
                {expenses.map(e => (
                  <tr key={e.id} className="border-b border-input/40">
                    <td className="px-3 py-2">
                      <div className="font-medium text-foreground">{e.proveedorNombre}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">{e.proveedorRfc}</div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{e.fechaEmision}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{Currency(e.ivaCents, true)}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums text-foreground">{Currency(e.totalCents, true)}</td>
                    <td className="px-3 py-2"><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{e.metodoPago}</span></td>
                    <td className="px-3 py-2"><PayBadge status={e.paymentStatus} /></td>
                    <td className="px-3 py-2">
                      {e.posted ? (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400">{t('expenses.posted')}</span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">{t('expenses.notPosted')}</span>
                      )}
                    </td>
                    {canManage && (
                      <td className="px-3 py-2 text-right">
                        {e.paymentStatus !== 'PAID' && e.id !== 's1' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPayTarget(e)}>
                            {t('expenses.markPaid')}
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card className="border-input">
        <CardContent className="py-3 space-y-1 text-xs text-muted-foreground">
          <p>{t('expenses.disclosureCashBasis')}</p>
          <p>{t('expenses.disclosurePost')}</p>
        </CardContent>
      </Card>

      {modalOpen && <NewExpenseModal onClose={() => setModalOpen(false)} />}
      {payTarget && (
        <MarkPaidDialog
          expense={payTarget}
          pending={markPaidMutation.isPending}
          onClose={() => setPayTarget(null)}
          onConfirm={fechaPago => markPaidMutation.mutate({ expenseId: payTarget.id, fechaPago }, { onSuccess: () => setPayTarget(null) })}
        />
      )}
    </div>
  )
}

/** Dialog mínimo para marcar un gasto como pagado (define la fecha de pago = mes en que el IVA acredita). */
function MarkPaidDialog({ expense, pending, onClose, onConfirm }: { expense: ExpenseDTO; pending: boolean; onClose: () => void; onConfirm: (fechaPago: string) => void }) {
  const { t } = useTranslation('reports')
  const [fechaPago, setFechaPago] = useState(() => new Date().toISOString().slice(0, 10))
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('expenses.markPaidTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('expenses.markPaidBody', { name: expense.proveedorNombre })}</p>
          <div className="space-y-1">
            <Label htmlFor="pay-date">{t('expenses.modal.date')}</Label>
            <Input id="pay-date" type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)} className="h-11" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={pending}>{t('expenses.markPaidCancel')}</Button>
          <Button size="sm" onClick={() => onConfirm(fechaPago)} disabled={!fechaPago || pending}>
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {t('expenses.markPaidConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-input">
      <CardContent className="py-3">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-base font-semibold tabular-nums text-foreground">{value}</p>
      </CardContent>
    </Card>
  )
}

/** Modal para registrar un gasto / CFDI recibido, con cuadre del comprobante en vivo. */
function NewExpenseModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('reports')
  const createMutation = useCreateExpense()

  const today = new Date().toISOString().slice(0, 10)
  const [proveedorRfc, setProveedorRfc] = useState('')
  const [proveedorNombre, setProveedorNombre] = useState('')
  const [fechaEmision, setFechaEmision] = useState(today)
  const [categoria, setCategoria] = useState<ExpenseCategoria>('GASTO_GENERAL')
  const [metodoPago, setMetodoPago] = useState<ExpenseMetodoPago>('PUE')
  const [subtotal, setSubtotal] = useState('')
  const [iva, setIva] = useState('')
  const [ivaTouched, setIvaTouched] = useState(false)
  const [descuento, setDescuento] = useState('')
  const [ieps, setIeps] = useState('')
  const [ivaRet, setIvaRet] = useState('')
  const [isrRet, setIsrRet] = useState('')
  const [folio, setFolio] = useState('')
  const [uuid, setUuid] = useState('')
  const [paid, setPaid] = useState(true)

  // Auto-sugerencia de IVA 16% mientras el usuario no lo edite manualmente.
  const onSubtotal = (v: string) => {
    setSubtotal(v)
    if (!ivaTouched) {
      const s = parseFloat(v)
      setIva(Number.isFinite(s) ? (Math.round(s * 0.16 * 100) / 100).toFixed(2) : '')
    }
  }

  const totalCents = peso(subtotal) - peso(descuento) + peso(iva) + peso(ieps) - peso(ivaRet) - peso(isrRet)
  const canSubmit = !!proveedorRfc.trim() && !!proveedorNombre.trim() && !!fechaEmision && peso(subtotal) > 0 && totalCents > 0 && !createMutation.isPending

  const submit = () => {
    if (!canSubmit) return
    createMutation.mutate(
      {
        proveedorRfc: proveedorRfc.trim().toUpperCase(),
        proveedorNombre: proveedorNombre.trim(),
        fechaEmision,
        categoria,
        metodoPago,
        subtotalCents: peso(subtotal),
        ivaCents: peso(iva),
        descuentoCents: peso(descuento),
        iepsCents: peso(ieps),
        ivaRetenidoCents: peso(ivaRet),
        isrRetenidoCents: peso(isrRet),
        totalCents,
        paid: metodoPago === 'PPD' ? false : paid,
        folio: folio.trim() || null,
        uuid: uuid.trim() || null,
      },
      { onSuccess: onClose },
    )
  }

  const money = (label: string, value: string, set: (v: string) => void, opts?: { onChange?: (v: string) => void }) => (
    <div className="space-y-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <Input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={e => (opts?.onChange ? opts.onChange(e.target.value) : set(e.target.value))}
        placeholder="0.00"
        className="h-11 text-right"
      />
    </div>
  )

  return (
    <FullScreenModal
      open
      onClose={onClose}
      title={t('expenses.modal.title')}
      contentClassName="bg-muted/30"
      actions={
        <Button size="sm" onClick={submit} disabled={!canSubmit}>
          {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {t('expenses.modal.save')}
        </Button>
      }
    >
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        {/* Proveedor */}
        <div className="rounded-2xl border border-input bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">{t('expenses.modal.supplier')}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-1">
              <Label>{t('expenses.modal.rfc')}</Label>
              <Input value={proveedorRfc} onChange={e => setProveedorRfc(e.target.value.toUpperCase())} placeholder="XAXX010101000" className="h-11 font-mono" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{t('expenses.modal.name')}</Label>
              <Input value={proveedorNombre} onChange={e => setProveedorNombre(e.target.value)} placeholder={t('expenses.modal.namePh')} className="h-11" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>{t('expenses.modal.date')}</Label>
              <Input type="date" value={fechaEmision} onChange={e => setFechaEmision(e.target.value)} className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>{t('expenses.modal.categoria')}</Label>
              <Select value={categoria} onValueChange={v => setCategoria(v as ExpenseCategoria)}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map(c => (
                    <SelectItem key={c} value={c}>{t(`expenses.categoria.${c}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('expenses.modal.metodoPago')}</Label>
              <Select value={metodoPago} onValueChange={v => setMetodoPago(v as ExpenseMetodoPago)}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PUE">{t('expenses.metodo.PUE')}</SelectItem>
                  <SelectItem value="PPD">{t('expenses.metodo.PPD')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Importes */}
        <div className="rounded-2xl border border-input bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">{t('expenses.modal.amounts')}</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {money(t('expenses.modal.subtotal'), subtotal, setSubtotal, { onChange: onSubtotal })}
            {money(t('expenses.modal.descuento'), descuento, setDescuento)}
            {money(t('expenses.modal.iva'), iva, setIva, { onChange: v => { setIvaTouched(true); setIva(v) } })}
            {money(t('expenses.modal.ieps'), ieps, setIeps)}
            {money(t('expenses.modal.ivaRet'), ivaRet, setIvaRet)}
            {money(t('expenses.modal.isrRet'), isrRet, setIsrRet)}
          </div>
          <div className="flex items-center justify-between rounded-lg border border-input bg-muted/40 p-3">
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Scale className="h-4 w-4 text-muted-foreground" />
              {t('expenses.modal.total')}
            </span>
            <span className="text-lg font-semibold tabular-nums text-foreground">{Currency(totalCents, true)}</span>
          </div>
        </div>

        {/* Fiscal / pago */}
        <div className="rounded-2xl border border-input bg-card p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('expenses.modal.folio')}</Label>
              <Input value={folio} onChange={e => setFolio(e.target.value)} placeholder="A-123" className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>{t('expenses.modal.uuid')}</Label>
              <Input value={uuid} onChange={e => setUuid(e.target.value)} placeholder="UUID (folio fiscal)" className="h-11 font-mono text-xs" />
            </div>
          </div>
          {metodoPago === 'PUE' && (
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={paid} onChange={e => setPaid(e.target.checked)} className="h-4 w-4 rounded border-input" />
              {t('expenses.modal.paid')}
            </label>
          )}
          <p className="text-xs text-muted-foreground">{t('expenses.modal.hint')}</p>
        </div>
      </div>
    </FullScreenModal>
  )
}

/**
 * Buzón de CFDIs / Gastos (Capa B fiscal) — CFDIs recibidos de proveedores → IVA acreditable + DIOT
 * + costos/gastos reales. Gated PREMIUM (FeatureGate CFDI). Captura manual; carga XML = siguiente slice.
 */
export default function Expenses() {
  return (
    <FeatureGate feature="CFDI">
      <ExpensesInner />
    </FeatureGate>
  )
}
