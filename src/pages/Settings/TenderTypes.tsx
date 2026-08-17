import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Banknote, Loader2, Pencil, Plus, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Currency } from '@/utils/currency'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import {
  createTenderType,
  listTenderTypes,
  updateTenderType,
  type CreateTenderTypeInput,
  type TenderType,, getTenderCommissions } from '@/services/tenderType.service'

/**
 * Ajustes → Tipos de pago (VenueTenderType, slice A1) — catálogo core/FREE.
 * Square-style: Principales / Más / Desactivados; apagado se VE, nunca desaparece.
 * El POS aún no consume el catálogo (slice B) — el badge lo dice explícitamente.
 * Permisos: tender-types:read (ver) / tender-types:manage (mutar).
 */

/** SAT c_FormaPago options offered in the form. '' = not individually invoiceable. */
const SAT_OPTIONS = ['05', '08', '03', '02', '06', '29', '31'] as const

interface FormState {
  name: string
  posSection: 'PRIMARY' | 'MORE'
  countsAsPhysicalCash: boolean
  captureTip: boolean
  showOnPos: boolean
  commissionPercent: string
  satFormaPago: string
}

const EMPTY_FORM: FormState = {
  name: '',
  posSection: 'MORE',
  countsAsPhysicalCash: false,
  captureTip: true,
  showOnPos: true,
  commissionPercent: '',
  satFormaPago: '',
}

export default function TenderTypes() {
  const { t } = useTranslation('tenderTypes')
  const { toast } = useToast()
  const { venueId } = useCurrentVenue()
  const { can } = useAccess()
  const queryClient = useQueryClient()

  const canManage = can('tender-types:manage')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<TenderType | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const { data: tenderTypes, isLoading } = useQuery({
    queryKey: ['tender-types', venueId],
    queryFn: () => listTenderTypes(venueId!),
    enabled: !!venueId,
  })

  // Comisiones pagadas. Es una lectura aparte del catálogo a propósito: el catálogo se
  // invalida en cada edición y este reporte no tiene por qué recargarse con ella.
  const { data: commissions } = useQuery({
    queryKey: ['tender-commissions', venueId],
    queryFn: () => getTenderCommissions(venueId!),
    enabled: !!venueId,
  })

  const sections = useMemo(() => {
    const all = tenderTypes ?? []
    return {
      primary: all.filter(x => x.active && x.posSection === 'PRIMARY'),
      more: all.filter(x => x.active && x.posSection === 'MORE'),
      disabled: all.filter(x => !x.active),
    }
  }, [tenderTypes])

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['tender-types', venueId] })

  const onError = (error: unknown) => {
    const message = (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data
    toast({ variant: 'destructive', title: t('toast.error'), description: message?.message ?? message?.error ?? undefined })
    // Un 409 (edición concurrente) se cura recargando el catálogo.
    invalidate()
  }

  const createMutation = useMutation({
    mutationFn: (input: CreateTenderTypeInput) => createTenderType(venueId!, input),
    onSuccess: () => {
      toast({ title: t('toast.created') })
      setDialogOpen(false)
      invalidate()
    },
    onError,
  })

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; input: Parameters<typeof updateTenderType>[2] }) => updateTenderType(venueId!, vars.id, vars.input),
    onSuccess: () => {
      toast({ title: t('toast.updated') })
      setDialogOpen(false)
      setEditing(null)
      invalidate()
    },
    onError,
  })

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEdit = (tender: TenderType) => {
    setEditing(tender)
    setForm({
      name: tender.name,
      posSection: tender.posSection,
      countsAsPhysicalCash: tender.countsAsPhysicalCash,
      captureTip: tender.captureTip,
      showOnPos: tender.showOnPos,
      commissionPercent: tender.commissionPercent != null ? String(Number(tender.commissionPercent)) : '',
      satFormaPago: tender.satFormaPago ?? '',
    })
    setDialogOpen(true)
  }

  const submitForm = () => {
    if (!form.name.trim()) {
      toast({ variant: 'destructive', title: t('form.nameRequired') })
      return
    }
    const commission = form.commissionPercent.trim() === '' ? null : Number(form.commissionPercent)
    if (commission != null && (Number.isNaN(commission) || commission < 0 || commission > 100)) {
      toast({ variant: 'destructive', title: t('form.commissionInvalid') })
      return
    }
    const shared = {
      name: form.name,
      posSection: form.posSection,
      countsAsPhysicalCash: form.countsAsPhysicalCash,
      captureTip: form.captureTip,
      showOnPos: form.showOnPos,
      commissionPercent: commission,
      satFormaPago: form.satFormaPago === '' ? null : form.satFormaPago,
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, input: { expectedRevision: editing.revision, ...shared } })
    } else {
      createMutation.mutate(shared)
    }
  }

  const toggleActive = (tender: TenderType, active: boolean) => {
    updateMutation.mutate({ id: tender.id, input: { expectedRevision: tender.revision, active } })
  }

  if (!venueId) return null

  const renderRow = (tender: TenderType) => (
    <div key={tender.id} className="flex items-center justify-between gap-3 border-b border-input px-4 py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{tender.name}</span>
          {tender.isSystem && (
            <Badge variant="secondary" className="text-[10px]">
              {t('badges.system')}
            </Badge>
          )}
          {tender.countsAsPhysicalCash && (
            <Badge variant="outline" className="text-[10px]">
              <Banknote className="mr-1 h-3 w-3" />
              {t('badges.cash')}
            </Badge>
          )}
          {!tender.captureTip && (
            <Badge variant="outline" className="text-[10px]">
              {t('badges.noTip')}
            </Badge>
          )}
          {tender.commissionPercent != null && Number(tender.commissionPercent) > 0 && (
            <Badge variant="outline" className="text-[10px]">
              {t('badges.commission', { percent: Number(tender.commissionPercent) })}
            </Badge>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {tender.satFormaPago ? t('badges.sat', { code: tender.satFormaPago }) : t('badges.notInvoiceable')}
        </p>
      </div>
      {canManage && (
        <div className="flex shrink-0 items-center gap-2">
          {!tender.isSystem && (
            <Button variant="ghost" size="icon" aria-label={t('form.editTitle')} onClick={() => openEdit(tender)}>
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          <Switch
            checked={tender.active}
            disabled={updateMutation.isPending}
            onCheckedChange={checked => toggleActive(tender, checked)}
            aria-label={tender.name}
          />
        </div>
      )}
    </div>
  )

  const renderSection = (title: string, rows: TenderType[], emptyLabel?: string) => (
    <div>
      <h2 className="mb-2 text-sm font-medium text-muted-foreground">{title}</h2>
      <Card className="border-input">
        <CardContent className="p-0">
          {rows.length === 0 ? <p className="px-4 py-3 text-sm text-muted-foreground">{emptyLabel ?? t('empty')}</p> : rows.map(renderRow)}
        </CardContent>
      </Card>
    </div>
  )

  /**
   * "¿Cuánto me cobró Uber Eats?" — la lectura que faltaba. Vive aquí, junto al catálogo
   * donde se configura la comisión, para que el dueño vea el efecto de lo que configuró.
   * Se oculta si no hay cobros: una tabla de ceros no informa nada.
   */
  const renderCommissions = () => {
    const rows = commissions?.rows ?? []
    if (rows.length === 0) return null
    return (
      <div>
        <h2 className="mb-1 text-sm font-medium text-muted-foreground">{t('commissions.title')}</h2>
        <p className="mb-2 text-xs text-muted-foreground">{t('commissions.subtitle')}</p>
        <Card className="border-input">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="px-4 py-2 text-left font-medium">{t('commissions.colType')}</th>
                    <th className="px-4 py-2 text-right font-medium">{t('commissions.colCount')}</th>
                    <th className="px-4 py-2 text-right font-medium">{t('commissions.colGross')}</th>
                    <th className="px-4 py-2 text-right font-medium">{t('commissions.colCommission')}</th>
                    <th className="px-4 py-2 text-right font-medium">{t('commissions.colNet')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.tenderTypeId} className="border-b last:border-0">
                      <td className="px-4 py-2">{row.tenderLabel}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{row.count}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{Currency(row.gross)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{Currency(row.commission)}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium">{Currency(row.net)}</td>
                    </tr>
                  ))}
                  <tr className="bg-muted/40">
                    <td className="px-4 py-2 font-medium">{t('commissions.total')}</td>
                    <td className="px-4 py-2" />
                    <td className="px-4 py-2 text-right tabular-nums">{Currency(commissions?.totalGross ?? 0)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{Currency(commissions?.totalCommission ?? 0)}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium">{Currency(commissions?.totalNet ?? 0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Wallet className="h-6 w-6" /> {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
        </div>
        {canManage && (
          <Button onClick={openCreate} data-tour="tender-types-new">
            <Plus className="mr-1 h-4 w-4" />
            {t('newButton')}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {renderSection(t('sections.primary'), sections.primary)}
          {renderSection(t('sections.more'), sections.more)}
          {renderSection(t('sections.disabled'), sections.disabled, t('sections.disabledEmpty'))}
          {renderCommissions()}
        </>
      )}

      <FullScreenModal
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false)
          setEditing(null)
        }}
        title={editing ? t('form.editTitle') : t('form.createTitle')}
        subtitle={t('title')}
        contentClassName="bg-muted/30"
        actions={
          <Button onClick={submitForm} disabled={createMutation.isPending || updateMutation.isPending} data-tour="tender-types-save">
            {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            {t('form.save')}
          </Button>
        }
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-6 p-4 md:p-6">
          <div className="flex flex-col gap-4 rounded-2xl border border-border/50 bg-card p-6">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tender-name">{t('form.name')}</Label>
              <Input
                id="tender-name"
                data-tour="tender-types-name"
                className="h-12 text-base"
                value={form.name}
                maxLength={80}
                placeholder={t('form.namePlaceholder')}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>{t('form.section')}</Label>
              <Select value={form.posSection} onValueChange={value => setForm(f => ({ ...f, posSection: value as 'PRIMARY' | 'MORE' }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRIMARY">{t('form.sectionPrimary')}</SelectItem>
                  <SelectItem value="MORE">{t('form.sectionMore')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-input p-3">
              <div>
                <Label>{t('form.countsAsCash')}</Label>
                <p className="text-xs text-muted-foreground">{t('form.countsAsCashHint')}</p>
              </div>
              <Switch
                checked={form.countsAsPhysicalCash}
                onCheckedChange={checked => setForm(f => ({ ...f, countsAsPhysicalCash: checked }))}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-input p-3">
              <div>
                <Label>{t('form.captureTip')}</Label>
                <p className="text-xs text-muted-foreground">{t('form.captureTipHint')}</p>
              </div>
              <Switch checked={form.captureTip} onCheckedChange={checked => setForm(f => ({ ...f, captureTip: checked }))} />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-input p-3">
              <div>
                <Label>{t('form.showOnPos')}</Label>
                <p className="text-xs text-muted-foreground">{t('form.showOnPosHint')}</p>
              </div>
              <Switch checked={form.showOnPos} onCheckedChange={checked => setForm(f => ({ ...f, showOnPos: checked }))} />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <Label htmlFor="tender-commission">{t('form.commission')}</Label>
                <Badge variant="outline" className="text-[10px]">
                  PRO
                </Badge>
              </div>
              <Input
                id="tender-commission"
                type="number"
                className="h-12 text-base"
                min={0}
                max={100}
                step="0.01"
                value={form.commissionPercent}
                placeholder="0"
                onChange={e => setForm(f => ({ ...f, commissionPercent: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">{t('form.commissionHint')}</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>{t('form.sat')}</Label>
              <Select value={form.satFormaPago || 'none'} onValueChange={value => setForm(f => ({ ...f, satFormaPago: value === 'none' ? '' : value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('form.satNone')}</SelectItem>
                  {SAT_OPTIONS.map(code => (
                    <SelectItem key={code} value={code}>
                      {code} — {t(`form.satCodes.${code}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t('form.satHint')}</p>
            </div>
          </div>
        </div>
      </FullScreenModal>
    </div>
  )
}
