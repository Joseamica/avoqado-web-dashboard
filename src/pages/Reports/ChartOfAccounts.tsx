import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Landmark, Loader2, Plus, Sparkles } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { AccountingErrorState } from '@/components/accounting/AccountingErrorState'
import { NatureBadge } from '@/components/accounting/StatusBadge'
import { useToast } from '@/hooks/use-toast'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import {
  useChartOfAccounts,
  useCreateLedgerAccount,
  useSeedChartOfAccounts,
} from '@/hooks/useChartOfAccounts'
import type { LedgerAccount, LedgerAccountType } from '@/services/fiscal/chartOfAccounts.service'
import { cn } from '@/lib/utils'

const TYPE_ORDER: LedgerAccountType[] = ['ACTIVO', 'PASIVO', 'CAPITAL', 'INGRESO', 'COSTO', 'GASTO', 'ORDEN']

/** Datos de muestra que se ven DETRÁS del blur del teaser cuando el venue no tiene CFDI. */
const SAMPLE_ACCOUNTS: LedgerAccount[] = [
  { id: 's1', code: '101', satGroupingCode: '101', name: 'Caja', type: 'ACTIVO', nature: 'DEUDORA', level: 1, parentId: null, isPostable: false, isActive: true },
  { id: 's2', code: '101.01', satGroupingCode: '101', name: 'Caja general', type: 'ACTIVO', nature: 'DEUDORA', level: 2, parentId: 's1', isPostable: true, isActive: true },
  { id: 's3', code: '102', satGroupingCode: '102', name: 'Bancos', type: 'ACTIVO', nature: 'DEUDORA', level: 1, parentId: null, isPostable: false, isActive: true },
  { id: 's4', code: '102.01', satGroupingCode: '102', name: 'Bancos nacionales', type: 'ACTIVO', nature: 'DEUDORA', level: 2, parentId: 's3', isPostable: true, isActive: true },
  { id: 's5', code: '208', satGroupingCode: '208', name: 'IVA trasladado cobrado', type: 'PASIVO', nature: 'ACREEDORA', level: 1, parentId: null, isPostable: true, isActive: true },
  { id: 's6', code: '401', satGroupingCode: '401', name: 'Ventas', type: 'INGRESO', nature: 'ACREEDORA', level: 1, parentId: null, isPostable: true, isActive: true },
]

function ChartOfAccountsInner() {
  const { t } = useTranslation('reports')
  const { fullBasePath } = useCurrentVenue()
  const { can } = useAccess()
  const { toast } = useToast()
  const { hasAccess } = useTierFeatureAccess('CFDI')
  const canManage = can('accounting:manage')

  const query = useChartOfAccounts({ enabled: hasAccess })
  const seedMutation = useSeedChartOfAccounts()
  const [addOpen, setAddOpen] = useState(false)

  const data = query.data
  // When the venue lacks CFDI we never fetch — render a realistic sample behind the blur.
  const accounts = useMemo<LedgerAccount[]>(() => (hasAccess ? data?.accounts ?? [] : SAMPLE_ACCOUNTS), [hasAccess, data?.accounts])
  const needsFiscalSetup = hasAccess && data?.needsFiscalSetup
  const seeded = hasAccess ? data?.seeded ?? false : true

  const byType = useMemo(() => {
    const m = new Map<LedgerAccountType, LedgerAccount[]>()
    for (const a of accounts) {
      const list = m.get(a.type) ?? []
      list.push(a)
      m.set(a.type, list)
    }
    return m
  }, [accounts])

  return (
    <div className="p-4 space-y-5 bg-background">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('chartOfAccounts.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {data?.rfc
              ? t('subtitleSuffix', {
                  base: t('chartOfAccounts.subtitle'),
                  suffix: t('chartOfAccounts.rfcLabel', { rfc: data.rfc }),
                })
              : t('chartOfAccounts.subtitle')}
          </p>
        </div>
        {seeded && accounts.length > 0 && canManage && (
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)} data-tour="ledger-add-account">
            <Plus className="w-4 h-4" />
            {t('chartOfAccounts.addAccount')}
          </Button>
        )}
      </header>

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
              <Button size="sm" variant="outline">
                {t('chartOfAccounts.goToFiscalConfig')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : !seeded ? (
        <Card className="border-input">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Sparkles className="w-8 h-8 text-emerald-500" />
            <p className="text-sm font-medium text-foreground">{t('chartOfAccounts.emptyTitle')}</p>
            <p className="max-w-md text-sm text-muted-foreground">{t('chartOfAccounts.emptyBody')}</p>
            {canManage ? (
              <Button
                size="sm"
                onClick={() =>
                  seedMutation.mutate(undefined, {
                    onError: (err: any) =>
                      toast({ title: err?.response?.data?.message ?? t('accountingError.body'), variant: 'destructive' }),
                  })
                }
                disabled={seedMutation.isPending}
                data-tour="ledger-seed"
              >
                {seedMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {t('chartOfAccounts.generateBase')}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">{t('chartOfAccounts.emptyNoPermission')}</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {TYPE_ORDER.filter(ty => byType.has(ty)).map(ty => (
            <Card key={ty} className="border-input">
              <CardContent className="py-3">
                <h2 className="mb-2 text-sm font-semibold text-foreground">{t(`chartOfAccounts.types.${ty}`)}</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-input text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-2 w-32">{t('chartOfAccounts.col.code')}</th>
                        <th className="py-2 pr-2">{t('chartOfAccounts.col.name')}</th>
                        <th className="py-2 pr-2 w-28">{t('chartOfAccounts.col.satCode')}</th>
                        <th className="py-2 pl-2 w-24">{t('chartOfAccounts.col.nature')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byType.get(ty)!.map(a => (
                        <tr key={a.id} className={cn('border-b border-input/50', !a.isActive && 'opacity-50')}>
                          <td className="py-1.5 pr-2 font-mono text-xs tabular-nums text-muted-foreground">
                            <span style={{ paddingLeft: `${(a.level - 1) * 14}px` }}>{a.code}</span>
                          </td>
                          <td className={cn('py-1.5 pr-2', a.isPostable ? 'text-foreground' : 'font-medium text-foreground')}>
                            {a.name}
                            {!a.isActive && <span className="ml-2 text-[10px] text-muted-foreground">({t('chartOfAccounts.inactive')})</span>}
                          </td>
                          <td className="py-1.5 pr-2 font-mono text-xs tabular-nums text-muted-foreground">{a.satGroupingCode}</td>
                          <td className="py-1.5 pl-2">
                            <NatureBadge nature={a.nature}>{t(`chartOfAccounts.nature.${a.nature}`)}</NatureBadge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="border-input">
        <CardContent className="py-3 space-y-1 text-xs text-muted-foreground">
          <p>{t('chartOfAccounts.disclosureSat')}</p>
          <p>{t('chartOfAccounts.disclosureScope')}</p>
        </CardContent>
      </Card>

      {addOpen && <AddAccountModal accounts={accounts} onClose={() => setAddOpen(false)} />}
    </div>
  )
}

/** Modal para agregar una cuenta nueva (hoja). */
function AddAccountModal({ accounts, onClose }: { accounts: LedgerAccount[]; onClose: () => void }) {
  const { t } = useTranslation('reports')
  const { toast } = useToast()
  const createMutation = useCreateLedgerAccount()

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [satGroupingCode, setSatGroupingCode] = useState('')
  const [type, setType] = useState<LedgerAccountType>('ACTIVO')
  const [parentCode, setParentCode] = useState<string>('__none__')

  const canSubmit = code.trim() && name.trim() && satGroupingCode.trim() && !createMutation.isPending

  const submit = () => {
    if (!canSubmit) return
    createMutation.mutate(
      {
        code: code.trim(),
        name: name.trim(),
        satGroupingCode: satGroupingCode.trim(),
        type,
        parentCode: parentCode === '__none__' ? null : parentCode,
      },
      {
        onSuccess: onClose,
        onError: (err: any) =>
          toast({ title: err?.response?.data?.message ?? t('accountingError.body'), variant: 'destructive' }),
      },
    )
  }

  // Posibles padres: solo cuentas activas, ordenadas por código.
  const parentOptions = useMemo(() => [...accounts].filter(a => a.isActive).sort((x, y) => x.code.localeCompare(y.code)), [accounts])

  return (
    <FullScreenModal
      open
      onClose={onClose}
      title={t('chartOfAccounts.modal.title')}
      contentClassName="bg-muted/30"
      actions={
        <Button size="sm" onClick={submit} disabled={!canSubmit}>
          {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {t('chartOfAccounts.modal.save')}
        </Button>
      }
    >
      <div className="mx-auto max-w-xl space-y-4 p-4">
        <div className="space-y-2">
          <Label>{t('chartOfAccounts.modal.code')}</Label>
          <Input value={code} onChange={e => setCode(e.target.value)} placeholder={t('chartOfAccounts.modal.codePh')} className="h-12 text-base" />
        </div>
        <div className="space-y-2">
          <Label>{t('chartOfAccounts.modal.name')}</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder={t('chartOfAccounts.modal.namePh')} className="h-12 text-base" />
        </div>
        <div className="space-y-2">
          <Label>{t('chartOfAccounts.modal.satCode')}</Label>
          <Input
            value={satGroupingCode}
            onChange={e => setSatGroupingCode(e.target.value)}
            placeholder={t('chartOfAccounts.modal.satCodePh')}
            className="h-12 text-base"
          />
        </div>
        <div className="space-y-2">
          <Label>{t('chartOfAccounts.modal.type')}</Label>
          <Select value={type} onValueChange={v => setType(v as LedgerAccountType)}>
            <SelectTrigger className="h-12 text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_ORDER.map(ty => (
                <SelectItem key={ty} value={ty}>
                  {t(`chartOfAccounts.types.${ty}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t('chartOfAccounts.modal.parent')}</Label>
          <Select value={parentCode} onValueChange={setParentCode}>
            <SelectTrigger className="h-12 text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">{t('chartOfAccounts.modal.parentNone')}</SelectItem>
              {parentOptions.map(a => (
                <SelectItem key={a.id} value={a.code}>
                  {a.code} · {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">{t('chartOfAccounts.modal.natureHint')}</p>
      </div>
    </FullScreenModal>
  )
}

/**
 * Catálogo de cuentas (Capa B fiscal). Gated PREMIUM (FeatureGate CFDI — bundle con
 * facturación). Sembrado base verificado contra el código agrupador del SAT, editable.
 */
export default function ChartOfAccounts() {
  return (
    <FeatureGate feature="CFDI">
      <ChartOfAccountsInner />
    </FeatureGate>
  )
}
