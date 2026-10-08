import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getRawMaterialPresentations } from '@/services/inventory.service'
import { purchaseOrderInvoiceService, type InvoiceCatalogItem, type PurchaseOrderInvoiceLine } from '@/services/purchaseOrderInvoice.service'
import { useDebounce } from '@/hooks/useDebounce'
import { useUnitTranslation } from '@/hooks/use-unit-translation'
import { Unit } from '@/services/purchaseOrder.service'
import { useToast } from '@/hooks/use-toast'

export function InvoiceLineEditor({ venueId, invoiceId, line, onClose }: { venueId: string; invoiceId: string; line: PurchaseOrderInvoiceLine; onClose: () => void }) {
  const fieldId = useId()
  const satUnits: Record<string, string> = { KGM: 'KILOGRAM', GRM: 'GRAM', LTR: 'LITER', MLT: 'MILLILITER', H87: 'PIECE', C62: 'UNIT' }
  const xmlUnit = satUnits[line.claveUnidad?.toUpperCase() ?? '']
  const { t } = useTranslation(['purchaseOrders', 'common'])
  const { getShortLabel } = useUnitTranslation()
  const { toast } = useToast()
  const client = useQueryClient()
  const [kind, setKind] = useState<'RAW' | 'PRODUCT'>(line.productId ? 'PRODUCT' : 'RAW')
  const [target, setTarget] = useState<InvoiceCatalogItem | null>(line.rawMaterial ?? line.product ?? null)
  const [unit, setUnit] = useState(line.purchaseUnit ?? '')
  const [presentation, setPresentation] = useState(line.presentationName ?? '')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const debounced = useDebounce(search, 300)
  const catalog = useQuery({ queryKey: ['invoice-inventory-catalog', venueId, kind, page, debounced],
    queryFn: () => purchaseOrderInvoiceService.catalog(venueId, kind, page, debounced), placeholderData: keepPreviousData,
    staleTime: 30000, retry: 1, refetchOnWindowFocus: false })
  const presentations = useQuery({ queryKey: ['raw-material-presentations', venueId, target?.id],
    queryFn: () => getRawMaterialPresentations(venueId, target!.id), enabled: kind === 'RAW' && !!target,
    staleTime: 30000, retry: 1, refetchOnWindowFocus: false })
  const save = useMutation({ mutationFn: () => purchaseOrderInvoiceService.identifyLine(venueId, invoiceId, line.id, {
    ...(kind === 'RAW' ? { rawMaterialId: target!.id } : { productId: target!.id }),
    purchaseUnit: unit || null, presentationName: presentation || null,
  }), onSuccess: () => {
    client.invalidateQueries({ queryKey: ['supplier-invoice-inbox', venueId] })
    client.invalidateQueries({ queryKey: ['supplier-invoices', venueId] })
    client.invalidateQueries({ queryKey: ['purchase-order-invoices', venueId] })
    client.invalidateQueries({ queryKey: ['invoice-inventory-review', venueId, invoiceId] })
    onClose()
  }, onError: (error: any) => toast({ title: t('invoices.toasts.errorTitle'), description: error?.response?.data?.message, variant: 'destructive' }) })
  return <FullScreenModal open onClose={onClose} title={t('invoices.receipt.identify')} contentClassName="bg-muted/30"
    actions={<Button disabled={!target || (!unit && !presentation) || save.isPending} onClick={() => save.mutate()} data-tour="invoice-line-save">{t('invoices.lines.confirm')}</Button>}>
    <div className="mx-auto w-full max-w-3xl p-6 space-y-5">
      <section className="rounded-2xl border border-input bg-card p-6 space-y-4" data-tour="invoice-line-article">
        <p className="font-medium">{line.descripcion}</p>
        <p className="text-sm text-muted-foreground">{t('invoices.receipt.xmlQuantity', { quantity: Number(line.cantidad), unit: line.claveUnidad ?? '—' })}</p>
        <Label htmlFor={`${fieldId}-kind`}>{t('invoices.lines.kind')}</Label>
        <select id={`${fieldId}-kind`} value={kind} className="h-12 w-full rounded-md border border-input bg-background px-3" onChange={e => {
          setKind(e.target.value as 'RAW' | 'PRODUCT'); setTarget(null); setUnit(''); setPresentation(''); setPage(1)
        }}><option value="RAW">{t('invoices.lines.raw')}</option><option value="PRODUCT">{t('invoices.lines.product')}</option></select>
        <Label htmlFor={`${fieldId}-search`}>{t('invoices.lines.target')}</Label>
        <Input id={`${fieldId}-search`} value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder={t('invoices.lines.targetPlaceholder')} data-tour="invoice-line-search" className="h-12" />
        {catalog.isError ? <p role="alert">{t('invoices.receipt.loadError')}</p> : <div className="space-y-1">
          {catalog.data?.rows.map(item => <Button key={item.id} variant={target?.id === item.id ? 'secondary' : 'ghost'} className="w-full justify-start" onClick={() => {
            setTarget(item); setPresentation('');
            setUnit(xmlUnit ?? '')
          }}>{item.name} · {getShortLabel(item.unit as Unit)}</Button>)}
          {!catalog.isLoading && !catalog.data?.rows.length && <p className="text-sm">{t('invoices.receipt.noArticles')}</p>}
        </div>}
        <div className="flex items-center justify-between gap-2 text-sm">
          <span>{t('invoices.receipt.totalArticles', { count: catalog.data?.total ?? 0 })}</span>
          <div className="flex gap-2"><Button variant="outline" disabled={page === 1 || catalog.isFetching} onClick={() => setPage(p => p - 1)}>{t('invoices.receipt.previous')}</Button>
            <Button variant="outline" disabled={!catalog.data || page >= catalog.data.totalPages || catalog.isFetching} onClick={() => setPage(p => p + 1)}>{t('invoices.receipt.next')}</Button></div>
        </div>
      </section>
      {target && <section className="rounded-2xl border border-input bg-card p-6 space-y-4" data-tour="invoice-line-unit">
        <p className="font-medium">{target.name}</p>
        <p className="text-sm text-muted-foreground">{t('invoices.receipt.unitHint', { unit: getShortLabel(target.unit as Unit) })}</p>
        <Label htmlFor={`${fieldId}-unit`}>{t('invoices.receipt.purchaseUnit')}</Label>
        <select id={`${fieldId}-unit`} value={presentation ? `presentation:${presentation}` : unit} className="h-12 w-full rounded-md border border-input bg-background px-3" onChange={e => {
          const value = e.target.value
          if (value.startsWith('presentation:')) { setPresentation(value.slice(13)); setUnit(target.unit) } else { setPresentation(''); setUnit(value) }
        }}>
          <option value="">{t('invoices.receipt.chooseUnit')}</option>
          {(xmlUnit ? [xmlUnit] : []).map(value => <option key={value} value={value}>{getShortLabel(value as Unit)}</option>)}
          {presentations.data?.filter(p => p.isPurchase).map(p => <option key={p.id} value={`presentation:${p.name}`}>{p.name} = {Number(p.factorToBase)} {getShortLabel(target.unit as Unit)}</option>)}
        </select>
        <p className="text-sm text-muted-foreground">{t(xmlUnit ? 'invoices.receipt.presentationHint' : 'invoices.receipt.explicitPresentation')}</p>
        {presentations.isError && <p role="alert">{t('invoices.receipt.loadError')}</p>}
      </section>}
    </div>
  </FullScreenModal>
}
