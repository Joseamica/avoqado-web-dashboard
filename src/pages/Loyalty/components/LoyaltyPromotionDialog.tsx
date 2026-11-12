import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { CalendarDays, ChevronDown, Info, SlidersHorizontal, Sparkles } from 'lucide-react'

import MultipleSelector, { type Option } from '@/components/multi-selector'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ProductMultiSelect } from '@/features/product-variants/components/ProductMultiSelect'
import { cn } from '@/lib/utils'
import { getMenuCategories, getProducts } from '@/services/menu.service'
import type {
  LoyaltyPromotion,
  LoyaltyPromotionEndDatePatch,
  LoyaltyPromotionInput,
  LoyaltyPromotionKind,
  LoyaltyPromotionLimit,
} from '@/types/customer'
import { describirPromo, type ProgramaPrendido } from '../describirPromo'

type Alcance = 'ALL' | 'PRODUCTS' | 'CATEGORIES'

/** Lo que el dueño va escribiendo. Los números vacíos son `undefined` (campos que se pueden borrar). */
export interface Borrador {
  name: string
  kind: LoyaltyPromotionKind
  multiplier: number | undefined
  extraStamps: number | undefined
  extraPoints: number | undefined
  startDate: string
  endDate: string
  sinFin: boolean
  daysOfWeek: number[]
  timeFrom: string
  timeUntil: string
  alcance: Alcance
  productIds: string[]
  categoryIds: string[]
  minSpend: number | undefined
  limit: LoyaltyPromotionLimit
}

type Campo =
  | 'name'
  | 'multiplier'
  | 'extraStamps'
  | 'extraPoints'
  | 'extra'
  | 'startDate'
  | 'endDate'
  | 'hours'
  | 'products'
  | 'categories'
  | 'minSpend'
const DE_MAS_OPCIONES: Campo[] = ['hours', 'products', 'categories', 'minSpend']
const LIMITES: LoyaltyPromotionLimit[] = ['NONE', 'ONCE_PER_DAY', 'ONCE_PER_PROMOTION']
const LUNES_PRIMERO = [1, 2, 3, 4, 5, 6, 0]
const GASTO_MAXIMO = 9_999_999.99

export const borradorNuevo = (hoy: string): Borrador => ({
  name: '',
  kind: 'MULTIPLY',
  multiplier: 2,
  extraStamps: undefined,
  extraPoints: undefined,
  startDate: hoy,
  endDate: '',
  sinFin: false,
  daysOfWeek: [],
  timeFrom: '',
  timeUntil: '',
  alcance: 'ALL',
  productIds: [],
  categoryIds: [],
  minSpend: undefined,
  limit: 'NONE',
})

const borradorDe = (p: LoyaltyPromotion): Borrador => ({
  name: p.name,
  kind: p.kind,
  multiplier: p.multiplier ?? undefined,
  extraStamps: p.extraStamps ?? undefined,
  extraPoints: p.extraPoints ?? undefined,
  startDate: p.startDate,
  endDate: p.endDate ?? '',
  sinFin: p.endDate === null,
  daysOfWeek: p.daysOfWeek,
  timeFrom: p.timeFrom ?? '',
  timeUntil: p.timeUntil ?? '',
  alcance: p.productIds.length > 0 ? 'PRODUCTS' : p.categoryIds.length > 0 ? 'CATEGORIES' : 'ALL',
  productIds: p.productIds,
  categoryIds: p.categoryIds,
  minSpend: p.minSpend ?? undefined,
  limit: p.limit,
})

const tieneMasOpciones = (b: Borrador) =>
  b.daysOfWeek.length > 0 || !!b.timeFrom || !!b.timeUntil || b.alcance !== 'ALL' || b.minSpend !== undefined || b.limit !== 'NONE'

const entero = (n: number | undefined, min: number, max: number) => n !== undefined && Number.isInteger(n) && n >= min && n <= max
const conCentavos = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6

/**
 * Los mismos rangos que el servidor, para avisar antes de mandar. Devuelve la llave del error de cada campo
 * (`promotions.errors.<llave>`). `soloFin`: la promo ya empezó y sólo se puede cambiar su fecha de fin.
 */
export function erroresDelBorrador(b: Borrador, programa: ProgramaPrendido, hoy: string, soloFin: boolean): Partial<Record<Campo, string>> {
  const e: Partial<Record<Campo, string>> = {}
  if (!b.sinFin) {
    if (!b.endDate) e.endDate = 'endDate'
    else if (!soloFin && b.startDate && b.endDate < b.startDate) e.endDate = 'endBeforeStart'
    else if (b.endDate < hoy) e.endDate = 'endPast'
  }
  if (soloFin) return e

  const nombre = b.name.trim()
  if (nombre.length < 1 || nombre.length > 80) e.name = 'name'
  if (b.kind === 'MULTIPLY') {
    if (!entero(b.multiplier, 2, 10)) e.multiplier = 'multiplier'
  } else {
    const sellos = programa.sellos && b.extraStamps !== undefined
    const puntos = programa.puntos && b.extraPoints !== undefined
    if (sellos && !entero(b.extraStamps, 1, 9)) e.extraStamps = 'extraStamps'
    if (puntos && !entero(b.extraPoints, 1, 10_000)) e.extraPoints = 'extraPoints'
    if (!sellos && !puntos) e.extra = 'extra'
  }
  if (!b.startDate) e.startDate = 'startDate'
  else if (b.startDate < hoy) e.startDate = 'startPast'
  if (!!b.timeFrom !== !!b.timeUntil) e.hours = 'hours'
  if (b.alcance === 'PRODUCTS' && b.productIds.length === 0) e.products = 'products'
  if (b.alcance === 'CATEGORIES' && b.categoryIds.length === 0) e.categories = 'categories'
  const gasto = b.minSpend
  if (gasto !== undefined && (!Number.isFinite(gasto) || gasto < 0 || gasto > GASTO_MAXIMO || !conCentavos(gasto))) e.minSpend = 'minSpend'
  return e
}

/** El cuerpo completo (alta o promo programada). */
function cuerpoDelBorrador(b: Borrador): LoyaltyPromotionInput {
  const suma = b.kind === 'ADD'
  return {
    name: b.name.trim(),
    kind: b.kind,
    multiplier: suma ? null : (b.multiplier ?? null),
    // Un extra guardado que el negocio apagó después NO se borra en silencio al editar: viaja tal cual (el servidor ya lo aceptó).
    extraStamps: suma ? (b.extraStamps ?? null) : null,
    extraPoints: suma ? (b.extraPoints ?? null) : null,
    startDate: b.startDate,
    endDate: b.sinFin ? null : b.endDate,
    daysOfWeek: [...b.daysOfWeek].sort((x, y) => x - y),
    timeFrom: b.timeFrom || null,
    timeUntil: b.timeUntil || null,
    productIds: b.alcance === 'PRODUCTS' ? b.productIds : [],
    categoryIds: b.alcance === 'CATEGORIES' ? b.categoryIds : [],
    minSpend: b.minSpend ?? null,
    limit: b.limit,
  }
}

const numero = (raw: string) => (raw === '' ? undefined : Number(raw))
const SECCION = 'space-y-5 rounded-2xl border border-border/50 bg-card p-6'

interface Props {
  open: boolean
  onClose: () => void
  /** `null` = nueva. Una ACTIVA sólo deja cambiar la fecha de fin; una TERMINADA no se abre. */
  promo: LoyaltyPromotion | null
  programa: ProgramaPrendido
  /** Hoy en el negocio, 'AAAA-MM-DD'. */
  hoy: string
  venueId: string
  saving: boolean
  /** Termina cuando termina el envío (con éxito o no): mientras tanto, otro «Crear»/«Guardar» no manda nada. */
  onSave: (body: LoyaltyPromotionInput | LoyaltyPromotionEndDatePatch) => Promise<unknown>
}

/**
 * Crear o editar una promoción de lealtad (spec §4.1). Lo básico a la vista (nombre, qué da, fechas); lo demás en «Más opciones»,
 * cerrado. La vista previa sale del BORRADOR, no de lo guardado: el dueño lee qué va a pasar antes de crearla.
 *
 * Se monta al abrir: el borrador nace del `promo` y del `hoy` de ese momento y ningún redibujo lo vuelve a sembrar (pasada la
 * medianoche, una relectura de la lista o un `hoy` nuevo no borran lo que el dueño ya escribió).
 */
export function LoyaltyPromotionDialog({ open, onClose, promo, programa, hoy, venueId, saving, onSave }: Props) {
  const { t } = useTranslation('loyalty')
  const soloFin = promo?.status === 'ACTIVE'
  const [b, setB] = useState<Borrador>(() => (promo ? borradorDe(promo) : borradorNuevo(hoy)))
  const [intento, setIntento] = useState(false)
  const [mas, setMas] = useState(() => tieneMasOpciones(b))
  // Candado del envío: `saving` llega hasta el siguiente redibujo y dos clics del mismo instante pasarían los dos.
  const enviando = useRef(false)

  // El catálogo sólo se pide cuando su selector está a la vista. Mismas llaves que los descuentos: comparten caché.
  const productosQuery = useQuery({
    queryKey: ['products', venueId, 'orderBy:name'],
    queryFn: () => getProducts(venueId, { orderBy: 'name', includeRecipe: false, includeModifiers: false }),
    enabled: open && mas && b.alcance === 'PRODUCTS',
    staleTime: 30_000,
  })
  const categoriasQuery = useQuery({
    queryKey: ['categories', venueId],
    queryFn: () => getMenuCategories(venueId),
    enabled: open && mas && b.alcance === 'CATEGORIES',
    staleTime: 30_000,
  })
  const productos = useMemo(() => productosQuery.data ?? [], [productosQuery.data])
  const categoriaOpciones = useMemo<Option[]>(
    () => (categoriasQuery.data ?? []).map(c => ({ value: c.id, label: c.name })),
    [categoriasQuery.data],
  )
  const nombres = useMemo(() => {
    const m = new Map<string, string>()
    for (const x of [...(promo?.products ?? []), ...(promo?.categories ?? []), ...productos, ...(categoriasQuery.data ?? [])])
      m.set(x.id, x.name)
    return m
  }, [promo, productos, categoriasQuery.data])

  const set = (cambio: Partial<Borrador>) => setB(prev => ({ ...prev, ...cambio }))
  const errores = erroresDelBorrador(b, programa, hoy, soloFin)
  const error = (campo: Campo) =>
    intento && errores[campo] ? (
      <p id={`promo-${campo}-error`} className="text-xs text-destructive">
        {t(`promotions.errors.${errores[campo]}`)}
      </p>
    ) : null

  const vistaPrevia = describirPromo(
    {
      kind: b.kind,
      multiplier: b.multiplier ?? null,
      extraStamps: b.extraStamps ?? null,
      extraPoints: b.extraPoints ?? null,
      startDate: b.startDate,
      endDate: b.sinFin || !b.endDate ? null : b.endDate,
      daysOfWeek: b.daysOfWeek,
      timeFrom: b.timeFrom || null,
      timeUntil: b.timeUntil || null,
      productNames: b.alcance === 'PRODUCTS' ? b.productIds.flatMap(id => nombres.get(id) ?? []) : [],
      categoryNames: b.alcance === 'CATEGORIES' ? b.categoryIds.flatMap(id => nombres.get(id) ?? []) : [],
      minSpend: b.minSpend ?? null,
      limit: b.limit,
      hoy,
    },
    programa,
    t,
  )

  const guardar = () => {
    if (saving || enviando.current) return
    setIntento(true)
    const campos = Object.keys(errores) as Campo[]
    if (campos.length > 0) {
      if (campos.some(c => DE_MAS_OPCIONES.includes(c))) setMas(true)
      return
    }
    enviando.current = true
    void onSave(soloFin ? { endDate: b.sinFin ? null : b.endDate } : cuerpoDelBorrador(b)).finally(() => {
      enviando.current = false
    })
  }

  const dias = t('promotions.dialog.dayShort', { returnObjects: true }) as unknown as string[]
  const bloqueado = soloFin || saving

  return (
    <FullScreenModal
      open={open}
      onClose={onClose}
      title={promo ? t('promotions.dialog.editTitle') : t('promotions.dialog.createTitle')}
      contentClassName="bg-muted/30"
      actions={
        <Button type="button" onClick={guardar} disabled={saving} className="cursor-pointer" data-tour="loyalty-promo-submit">
          {saving ? t('promotions.dialog.saving') : promo ? t('promotions.dialog.save') : t('promotions.dialog.create')}
        </Button>
      }
    >
      <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
        {soloFin && (
          <p className="flex gap-2 rounded-2xl border border-input bg-card px-4 py-3 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            {t('promotions.dialog.activeNote')}
          </p>
        )}

        {/* ── Nombre y qué da ── */}
        <section className={SECCION}>
          <h3 className="flex items-center gap-2 font-semibold">
            <Sparkles className="h-4 w-4" />
            {t('promotions.dialog.basics')}
          </h3>
          <div className="space-y-1.5">
            <Label htmlFor="promo-name">{t('promotions.dialog.name')}</Label>
            <Input
              id="promo-name"
              className="h-12 text-base"
              maxLength={80}
              placeholder={t('promotions.dialog.namePlaceholder')}
              value={b.name}
              disabled={bloqueado}
              onChange={e => set({ name: e.target.value })}
              aria-invalid={!!(intento && errores.name)}
              data-tour="loyalty-promo-name"
            />
            {error('name')}
          </div>

          <div className="space-y-2">
            <Label>{t('promotions.dialog.gives')}</Label>
            <RadioGroup
              value={b.kind}
              onValueChange={v => set({ kind: v as LoyaltyPromotionKind })}
              disabled={bloqueado}
              className="gap-3"
              data-tour="loyalty-promo-kind"
            >
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-input px-4 py-3">
                <RadioGroupItem value="MULTIPLY" id="promo-kind-multiply" />
                <Label htmlFor="promo-kind-multiply" className="cursor-pointer">
                  {t('promotions.dialog.multiply')}
                </Label>
                <span className="text-muted-foreground">×</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={2}
                  max={10}
                  step={1}
                  className="h-12 w-20 text-base"
                  aria-label={t('promotions.dialog.multiply')}
                  value={b.multiplier ?? ''}
                  disabled={bloqueado || b.kind !== 'MULTIPLY'}
                  onChange={e => set({ multiplier: numero(e.target.value) })}
                  data-tour="loyalty-promo-multiplier"
                />
                <span className="text-xs text-muted-foreground">{t('promotions.dialog.multiplyHint')}</span>
              </div>
              {error('multiplier')}

              <div className="space-y-3 rounded-lg border border-input px-4 py-3">
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="ADD" id="promo-kind-add" />
                  <Label htmlFor="promo-kind-add" className="cursor-pointer">
                    {t('promotions.dialog.add')}
                  </Label>
                  <span className="text-xs text-muted-foreground">{t('promotions.dialog.addHint')}</span>
                </div>
                <div className="flex flex-wrap gap-4 pl-7">
                  {programa.sellos && (
                    <label className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">+</span>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={9}
                        step={1}
                        className="h-12 w-20 text-base"
                        value={b.extraStamps ?? ''}
                        disabled={bloqueado || b.kind !== 'ADD'}
                        onChange={e => set({ extraStamps: numero(e.target.value) })}
                        data-tour="loyalty-promo-extra-stamps"
                      />
                      {t('promotions.dialog.extraStamps')}
                    </label>
                  )}
                  {programa.puntos && (
                    <label className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">+</span>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={10000}
                        step={1}
                        className="h-12 w-28 text-base"
                        value={b.extraPoints ?? ''}
                        disabled={bloqueado || b.kind !== 'ADD'}
                        onChange={e => set({ extraPoints: numero(e.target.value) })}
                        data-tour="loyalty-promo-extra-points"
                      />
                      {t('promotions.dialog.extraPoints')}
                    </label>
                  )}
                </div>
                {error('extraStamps')}
                {error('extraPoints')}
                {error('extra')}
              </div>
            </RadioGroup>
          </div>
        </section>

        {/* ── Fechas ── */}
        <section className={SECCION}>
          <h3 className="flex items-center gap-2 font-semibold">
            <CalendarDays className="h-4 w-4" />
            {t('promotions.dialog.dates')}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="promo-start">{t('promotions.dialog.from')}</Label>
              <Input
                id="promo-start"
                type="date"
                min={hoy}
                className="h-12 text-base"
                value={b.startDate}
                disabled={bloqueado}
                onChange={e => set({ startDate: e.target.value })}
                aria-invalid={!!(intento && errores.startDate)}
                data-tour="loyalty-promo-start"
              />
              {error('startDate')}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-end">{t('promotions.dialog.until')}</Label>
              <Input
                id="promo-end"
                type="date"
                min={b.startDate && b.startDate > hoy && !soloFin ? b.startDate : hoy}
                className="h-12 text-base"
                value={b.sinFin ? '' : b.endDate}
                disabled={saving || b.sinFin}
                onChange={e => set({ endDate: e.target.value })}
                aria-invalid={!!(intento && errores.endDate)}
                data-tour="loyalty-promo-end"
              />
              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  id="promo-no-end"
                  checked={b.sinFin}
                  disabled={saving}
                  onCheckedChange={v => set({ sinFin: v === true })}
                  data-tour="loyalty-promo-no-end"
                />
                <Label htmlFor="promo-no-end" className="cursor-pointer font-normal">
                  {t('promotions.dialog.noEnd')}
                </Label>
              </div>
              {error('endDate')}
            </div>
          </div>
        </section>

        {/* ── Más opciones (cerrado por default) ── */}
        <Collapsible open={mas} onOpenChange={setMas} className="rounded-2xl border border-border/50 bg-card">
          <CollapsibleTrigger asChild>
            <button type="button" className="flex w-full cursor-pointer items-center gap-3 p-6 text-left" data-tour="loyalty-promo-more">
              <SlidersHorizontal className="h-4 w-4 shrink-0" />
              <span className="flex-1">
                <span className="block font-semibold">{t('promotions.dialog.more')}</span>
                <span className="block text-xs text-muted-foreground">{t('promotions.dialog.moreHint')}</span>
              </span>
              <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', mas && 'rotate-180')} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-6 px-6 pb-6">
            <div className="space-y-2">
              <Label>{t('promotions.dialog.days')}</Label>
              <div className="flex flex-wrap gap-2">
                {LUNES_PRIMERO.map(d => {
                  const elegido = b.daysOfWeek.includes(d)
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={elegido}
                      disabled={bloqueado}
                      onClick={() => set({ daysOfWeek: elegido ? b.daysOfWeek.filter(x => x !== d) : [...b.daysOfWeek, d] })}
                      className={cn(
                        'h-10 min-w-12 cursor-pointer rounded-full border px-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                        elegido ? 'border-foreground bg-foreground text-background' : 'border-input bg-background hover:bg-muted',
                      )}
                    >
                      {dias[d]}
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground">{t('promotions.dialog.daysHint')}</p>
            </div>

            <div className="space-y-2">
              <Label>{t('promotions.dialog.hours')}</Label>
              <div className="flex flex-wrap items-center gap-3">
                <Label htmlFor="promo-time-from" className="font-normal text-muted-foreground">
                  {t('promotions.dialog.hoursFrom')}
                </Label>
                <Input
                  id="promo-time-from"
                  type="time"
                  step={300}
                  className="h-12 w-36 text-base"
                  value={b.timeFrom}
                  disabled={bloqueado}
                  onChange={e => set({ timeFrom: e.target.value })}
                />
                <Label htmlFor="promo-time-until" className="font-normal text-muted-foreground">
                  {t('promotions.dialog.hoursUntil')}
                </Label>
                <Input
                  id="promo-time-until"
                  type="time"
                  step={300}
                  className="h-12 w-36 text-base"
                  value={b.timeUntil}
                  disabled={bloqueado}
                  onChange={e => set({ timeUntil: e.target.value })}
                />
              </div>
              <p className="text-xs text-muted-foreground">{t('promotions.dialog.hoursHint')}</p>
              {error('hours')}
            </div>

            <div className="space-y-2">
              <Label>{t('promotions.dialog.scope')}</Label>
              <RadioGroup value={b.alcance} onValueChange={v => set({ alcance: v as Alcance })} disabled={bloqueado} className="gap-2">
                {(['ALL', 'PRODUCTS', 'CATEGORIES'] as const).map(a => (
                  <div key={a} className="flex items-center gap-2">
                    <RadioGroupItem value={a} id={`promo-scope-${a}`} />
                    <Label htmlFor={`promo-scope-${a}`} className="cursor-pointer font-normal">
                      {t(`promotions.dialog.scope${a === 'ALL' ? 'All' : a === 'PRODUCTS' ? 'Products' : 'Categories'}`)}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              {b.alcance === 'PRODUCTS' && (
                <ProductMultiSelect
                  productos={productos}
                  value={b.productIds}
                  onChange={ids => set({ productIds: ids })}
                  disabled={bloqueado}
                  placeholder={t('promotions.dialog.productsPlaceholder')}
                  emptyIndicator={<p className="py-6 text-center text-sm text-muted-foreground">{t('promotions.dialog.noResults')}</p>}
                />
              )}
              {b.alcance === 'CATEGORIES' && (
                <MultipleSelector
                  options={categoriaOpciones}
                  value={b.categoryIds.map(id => ({ value: id, label: nombres.get(id) ?? id }))}
                  onChange={opts => set({ categoryIds: opts.map(o => o.value) })}
                  disabled={bloqueado}
                  placeholder={t('promotions.dialog.categoriesPlaceholder')}
                  emptyIndicator={<p className="py-6 text-center text-sm text-muted-foreground">{t('promotions.dialog.noResults')}</p>}
                />
              )}
              {error('products')}
              {error('categories')}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="promo-min-spend">{t('promotions.dialog.minSpend')}</Label>
              <div className="relative max-w-xs">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">$</span>
                <Input
                  id="promo-min-spend"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  className="h-12 pl-7 text-base"
                  value={b.minSpend ?? ''}
                  disabled={bloqueado}
                  onChange={e => set({ minSpend: numero(e.target.value) })}
                />
              </div>
              <p className="text-xs text-muted-foreground">{t('promotions.dialog.minSpendHint')}</p>
              {error('minSpend')}
            </div>

            <div className="space-y-2">
              <Label>{t('promotions.dialog.limit')}</Label>
              <RadioGroup
                value={b.limit}
                onValueChange={v => set({ limit: v as LoyaltyPromotionLimit })}
                disabled={bloqueado}
                className="gap-2"
              >
                {LIMITES.map(l => (
                  <div key={l} className="flex items-center gap-2">
                    <RadioGroupItem value={l} id={`promo-limit-${l}`} />
                    <Label htmlFor={`promo-limit-${l}`} className="cursor-pointer font-normal">
                      {t(`promotions.dialog.limit${l}`)}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* ── Vista previa (del borrador) ── */}
        <section className="rounded-2xl border border-input bg-card p-6" data-tour="loyalty-promo-preview">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('promotions.dialog.preview')}</p>
          <p className="text-base" aria-live="polite" data-testid="loyalty-promo-preview">
            {vistaPrevia}
          </p>
        </section>
      </div>
    </FullScreenModal>
  )
}
