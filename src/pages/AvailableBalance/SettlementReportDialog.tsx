import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useDebounce } from '@/hooks/useDebounce'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  countSettlementReport,
  downloadSettlementReport,
  terminalOptions,
  type DateBasis,
  type ReportKind,
} from '@/services/settlementReport.service'
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { ChevronRight, Download, Info } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { COLUMNAS, diasDelRango, motivoDeBloqueo, rangoRapido } from './settlementReportColumns'

const CARD_TYPES = ['DEBIT', 'CREDIT', 'AMEX', 'INTERNATIONAL', 'OTHER', 'NONE']
const OPERATIONS = ['SALE', 'REFUND', 'TIP_REFUND']
const BRANDS: Array<[string, string]> = [
  ['VISA', 'Visa'],
  ['MASTERCARD', 'Mastercard'],
  ['AMERICAN_EXPRESS', 'American Express'],
  ['DISCOVER', 'Discover'],
  ['DINERS_CLUB', 'Diners Club'],
  ['JCB', 'JCB'],
  ['MAESTRO', 'Maestro'],
  ['UNIONPAY', 'UnionPay'],
  ['ELO', 'Elo'],
  ['HIPERCARD', 'Hipercard'],
  ['OTHER', ''],
]
const NONE = 'NONE'

interface Props {
  open: boolean
  onClose: () => void
  venueId: string
  venueTimezone: string
}

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v])

function Check({
  label,
  checked,
  onChange,
  testId,
  disabled,
}: {
  label: string
  checked: boolean
  onChange: () => void
  testId?: string
  disabled?: boolean
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="h-4 w-4 accent-primary"
        data-testid={testId}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
      <span className={cn(disabled && 'text-muted-foreground')}>{label}</span>
    </label>
  )
}

function Choice({
  name,
  testId,
  checked,
  onChange,
  title,
  hint,
  className,
}: {
  name: string
  testId: string
  checked: boolean
  onChange: () => void
  title: string
  hint?: string
  className?: string
}) {
  return (
    <label
      className={cn(
        'cursor-pointer rounded-lg border border-input px-3 py-2 text-sm transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
        className,
      )}
    >
      <input type="radio" name={name} data-testid={testId} className="sr-only" checked={checked} onChange={onChange} />
      <span className="block font-medium">{title}</span>
      {hint && <span className="block text-xs opacity-80">{hint}</span>}
    </label>
  )
}

function Section({ title, tour, children }: { title: string; tour: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2" data-tour={tour}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

function Fold({ title, summary, tour, children }: { title: string; summary: string; tour: string; children: React.ReactNode }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <Collapsible open={abierto} onOpenChange={setAbierto} className="rounded-xl border border-input bg-card" data-tour={tour}>
      <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm">
        <span>
          <span className="font-medium">{title}</span> <span className="text-xs text-muted-foreground">· {summary}</span>
        </span>
        <ChevronRight className={cn('h-4 w-4 transition-transform', abierto && 'rotate-90')} />
      </CollapsibleTrigger>
      {/* forceMount: la selección sigue en el DOM aunque esté plegado */}
      <CollapsibleContent forceMount className="space-y-4 border-t border-input p-3 data-[state=closed]:hidden">
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}

export function SettlementReportDialog({ open, onClose, venueId, venueTimezone }: Props) {
  const { t, i18n } = useTranslation('availableBalance')
  const nf = (n: number) => n.toLocaleString(i18n.language)
  const { toast } = useToast()

  const [report, setReport] = useState<ReportKind>('transactions')
  const [basis, setBasis] = useState<DateBasis>('charge')
  const [rango, setRango] = useState(() => rangoRapido('mesPasado', venueTimezone))
  const [terminalIds, setTerminalIds] = useState<string[]>([])
  const [cardTypes, setCardTypes] = useState<string[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [operations, setOperations] = useState<string[]>([])
  const [columnas, setColumnas] = useState<Set<string>>(() => new Set(COLUMNAS.transactions.map(c => c.id)))
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx')
  const [terminalSearch, setTerminalSearch] = useState('')
  const [descargando, setDescargando] = useState(false)
  const enCurso = useRef(false)

  const cambiarReporte = (r: ReportKind) => {
    setReport(r)
    setBasis(r === 'deposits' ? 'deposit' : 'charge')
    setColumnas(new Set(COLUMNAS[r].map(c => c.id)))
  }

  const dias = diasDelRango(rango.startDate, rango.endDate)
  const rangoValido = dias >= 1 && dias <= 92

  const params = useMemo(
    () => ({ startDate: rango.startDate, endDate: rango.endDate, dateBasis: basis, terminalIds, cardTypes, brands, operations }),
    [rango.startDate, rango.endDate, basis, terminalIds, cardTypes, brands, operations],
  )
  const debounced = useDebounce(params, 300)

  const conteo = useQuery({
    queryKey: ['settlement-report-count', venueId, debounced],
    queryFn: () => countSettlementReport(venueId, debounced),
    enabled:
      open &&
      !!venueId &&
      diasDelRango(debounced.startDate, debounced.endDate) >= 1 &&
      diasDelRango(debounced.startDate, debounced.endDate) <= 92,
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  })
  // Un dato viejo (keepPreviousData) o de otros parámetros NO es un conteo confirmado.
  const pendiente = JSON.stringify(debounced) !== JSON.stringify(params) || conteo.isFetching || conteo.isPlaceholderData
  const confirmado = !pendiente && !conteo.isError ? conteo.data : undefined

  const debouncedSearch = useDebounce(terminalSearch, 300)
  const terminales = useInfiniteQuery({
    queryKey: ['settlement-report-terminals', venueId, debouncedSearch],
    queryFn: ({ pageParam }) => terminalOptions(venueId, debouncedSearch, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: last => last.nextCursor ?? undefined,
    enabled: open && !!venueId,
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })
  const terminalItems = terminales.data?.pages.flatMap(p => p.items) ?? []

  const bloqueoDatos = motivoDeBloqueo({ dias, candidatos: confirmado?.candidateCount, format, caps: confirmado?.caps })
  let mensaje: string | null = null
  if (!rango.startDate || !rango.endDate) mensaje = t('settlementReport.block.fechasVacias')
  else if (dias < 1) mensaje = t('settlementReport.block.rangoInvertido')
  else if (!rangoValido) mensaje = t('settlementReport.block.rangoLargo')
  else if (conteo.isError && !conteo.isFetching) mensaje = t('settlementReport.block.errorConteo')
  else if (pendiente) mensaje = t('settlementReport.block.contando')
  else if (bloqueoDatos) mensaje = t(`settlementReport.block.${bloqueoDatos.key}`, { count: bloqueoDatos.count ?? 0, formatted: nf(bloqueoDatos.count ?? 0) })
  const bloqueado = mensaje !== null || descargando || columnas.size === 0

  const descargar = async () => {
    if (enCurso.current || bloqueado) return
    enCurso.current = true
    setDescargando(true)
    try {
      const { blob, filename } = await downloadSettlementReport(venueId, {
        ...params,
        report,
        format,
        columns: COLUMNAS[report].filter(c => columnas.has(c.id)).map(c => c.id),
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast({ title: t('settlementReport.success') })
      onClose()
    } catch (err: any) {
      let description = t('settlementReport.error')
      try {
        const data = err?.response?.data
        if (data instanceof Blob) description = JSON.parse(await data.text())?.message ?? description
        else if (data?.message) description = data.message
      } catch {
        /* se queda el mensaje genérico */
      }
      toast({ title: t('settlementReport.error'), description, variant: 'destructive' })
    } finally {
      enCurso.current = false
      setDescargando(false)
    }
  }

  const chips = [
    ['esteMes', 'thisMonth'],
    ['mesPasado', 'lastMonth'],
    ['ultimos30', 'last30'],
  ] as const
  const nFiltros = terminalIds.length + cardTypes.length + brands.length + operations.length

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent hasTitle className="max-w-lg gap-0 p-0">
        <div className="border-b border-border px-5 py-4">
          <DialogTitle>{t('settlementReport.title')}</DialogTitle>
          <DialogDescription className="sr-only">{t('settlementReport.note')}</DialogDescription>
        </div>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto px-5 py-4">
          <Section title={t('settlementReport.report.title')} tour="settlement-report-kind">
            <div className="grid grid-cols-2 gap-2">
              <Choice
                name="report"
                testId="report-transactions"
                checked={report === 'transactions'}
                onChange={() => cambiarReporte('transactions')}
                title={t('settlementReport.report.transactions')}
                hint={t('settlementReport.report.transactionsHint')}
              />
              <Choice
                name="report"
                testId="report-deposits"
                checked={report === 'deposits'}
                onChange={() => cambiarReporte('deposits')}
                title={t('settlementReport.report.deposits')}
                hint={t('settlementReport.report.depositsHint')}
              />
            </div>
          </Section>

          <Section title={t('settlementReport.dates.title')} tour="settlement-report-dates">
            <div className="flex flex-wrap gap-2">
              {chips.map(([tipo, key]) => (
                <Button key={tipo} type="button" variant="outline" size="sm" onClick={() => setRango(rangoRapido(tipo, venueTimezone))}>
                  {t(`settlementReport.dates.${key}`)}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1 text-xs text-muted-foreground">
                {t('settlementReport.dates.from')}
                <Input
                  type="date"
                  data-testid="date-start"
                  value={rango.startDate}
                  onChange={e => setRango(r => ({ ...r, startDate: e.target.value }))}
                />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                {t('settlementReport.dates.to')}
                <Input
                  type="date"
                  data-testid="date-end"
                  value={rango.endDate}
                  onChange={e => setRango(r => ({ ...r, endDate: e.target.value }))}
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {t('settlementReport.dates.basis')}
              <Choice
                name="basis"
                testId="basis-charge"
                checked={basis === 'charge'}
                onChange={() => setBasis('charge')}
                title={t('settlementReport.dates.charge')}
                className="px-2 py-1 text-xs"
              />
              <Choice
                name="basis"
                testId="basis-deposit"
                checked={basis === 'deposit'}
                onChange={() => setBasis('deposit')}
                title={t('settlementReport.dates.deposit')}
                className="px-2 py-1 text-xs"
              />
            </div>
          </Section>

          <Fold
            title={t('settlementReport.filters.title')}
            summary={nFiltros ? t('settlementReport.filters.active', { count: nFiltros }) : t('settlementReport.filters.summary')}
            tour="settlement-report-filters"
          >
            <div className="space-y-2">
              <h4 className="text-sm font-medium">{t('settlementReport.filters.terminal')}</h4>
              <Input
                placeholder={t('settlementReport.filters.searchTerminal')}
                value={terminalSearch}
                onChange={e => setTerminalSearch(e.target.value)}
              />
              <div className="max-h-40 space-y-1.5 overflow-y-auto">
                <Check
                  label={t('settlementReport.filters.noTerminal')}
                  checked={terminalIds.includes(NONE)}
                  onChange={() => setTerminalIds(l => toggle(l, NONE))}
                />
                {terminales.isLoading && <p className="text-xs text-muted-foreground">{t('settlementReport.filters.loadingTerminals')}</p>}
                {terminales.isError && (
                  <p className="text-xs text-destructive">
                    {t('settlementReport.filters.terminalsError')}{' '}
                    <button type="button" className="underline" onClick={() => terminales.refetch()}>
                      {t('settlementReport.retry')}
                    </button>
                  </p>
                )}
                {!terminales.isLoading && !terminales.isError && terminalItems.length === 0 && (
                  <p className="text-xs text-muted-foreground">{t('settlementReport.filters.noTerminals')}</p>
                )}
                {terminalItems.map(it => (
                  <Check
                    key={it.id}
                    label={it.serialNumber ? `${it.name} · ${it.serialNumber}` : it.name}
                    checked={terminalIds.includes(it.id)}
                    onChange={() => setTerminalIds(l => toggle(l, it.id))}
                  />
                ))}
                {terminales.hasNextPage && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={terminales.isFetchingNextPage}
                    onClick={() => terminales.fetchNextPage()}
                  >
                    {t('settlementReport.filters.loadMore')}
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <h4 className="text-sm font-medium">{t('settlementReport.filters.cardType')}</h4>
              <div className="grid grid-cols-2 gap-1.5">
                {CARD_TYPES.map(v => (
                  <Check
                    key={v}
                    label={t(`settlementReport.cardTypes.${v}`)}
                    checked={cardTypes.includes(v)}
                    onChange={() => setCardTypes(l => toggle(l, v))}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <h4 className="text-sm font-medium">{t('settlementReport.filters.brand')}</h4>
              <div className="grid grid-cols-2 gap-1.5">
                {BRANDS.map(([v, label]) => (
                  <Check
                    key={v}
                    label={label || t(`settlementReport.brands.${v}`)}
                    checked={brands.includes(v)}
                    onChange={() => setBrands(l => toggle(l, v))}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <h4 className="text-sm font-medium">{t('settlementReport.filters.operation')}</h4>
              <div className="grid grid-cols-2 gap-1.5">
                {OPERATIONS.map(v => (
                  <Check
                    key={v}
                    label={t(`settlementReport.operations.${v}`)}
                    checked={operations.includes(v)}
                    onChange={() => setOperations(l => toggle(l, v))}
                  />
                ))}
              </div>
            </div>
          </Fold>

          <Fold
            title={t('settlementReport.columns.title')}
            summary={t('settlementReport.columns.summary', { count: columnas.size, total: COLUMNAS[report].length })}
            tour="settlement-report-columns"
          >
            <div className="grid grid-cols-2 gap-1.5">
              {COLUMNAS[report].map(c => (
                <Check
                  key={c.id}
                  testId={`col-${c.id}`}
                  label={c.required ? `${t(c.labelKey)} (${t('settlementReport.columns.required')})` : t(c.labelKey)}
                  checked={columnas.has(c.id)}
                  disabled={c.required}
                  onChange={() =>
                    setColumnas(s => {
                      const n = new Set(s)
                      if (n.has(c.id)) n.delete(c.id)
                      else n.add(c.id)
                      return n
                    })
                  }
                />
              ))}
            </div>
          </Fold>

          <Section title={t('settlementReport.format.title')} tour="settlement-report-format">
            <div className="grid grid-cols-2 gap-2">
              <Choice
                name="format"
                testId="format-xlsx"
                checked={format === 'xlsx'}
                onChange={() => setFormat('xlsx')}
                title={t('settlementReport.format.xlsx')}
                hint={t('settlementReport.format.xlsxHint')}
              />
              <Choice
                name="format"
                testId="format-csv"
                checked={format === 'csv'}
                onChange={() => setFormat('csv')}
                title={t('settlementReport.format.csv')}
                hint={t('settlementReport.format.csvHint')}
              />
            </div>
          </Section>

          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {t('settlementReport.note')}
          </p>
        </div>

        <div className="space-y-2 rounded-b-2xl bg-muted px-5 py-3">
          {mensaje && (
            <p
              className={cn('text-sm', pendiente && rangoValido && !conteo.isError ? 'text-muted-foreground' : 'text-destructive')}
              role="status"
            >
              {mensaje}{' '}
              {bloqueoDatos?.key === 'demasiadosExcel' && (
                <button type="button" className="underline" data-testid="switch-to-csv" onClick={() => setFormat('csv')}>
                  {t('settlementReport.block.cambiarCsv')}
                </button>
              )}
              {conteo.isError && rangoValido && !conteo.isFetching && (
                <button type="button" className="underline" onClick={() => conteo.refetch()}>
                  {t('settlementReport.retry')}
                </button>
              )}
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              {confirmado ? t('settlementReport.estimated', { count: confirmado.candidateCount, formatted: nf(confirmado.candidateCount) }) : ''}
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                {t('settlementReport.cancel')}
              </Button>
              <Button
                type="button"
                data-testid="settlement-report-submit"
                data-tour="settlement-report-submit"
                disabled={bloqueado}
                onClick={descargar}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                {t('settlementReport.download')}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
