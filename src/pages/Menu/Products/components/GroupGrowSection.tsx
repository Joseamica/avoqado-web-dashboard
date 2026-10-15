import { useMutation } from '@tanstack/react-query'
import { Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { MAX_OPCIONES, MAX_TEXTO_OPCION, limpiarOpciones, norm, validarFilas, type FilaVariante } from '@/features/product-variants/combinations'
import { OptionValuesInput } from '@/features/product-variants/components/OptionValuesInput'
import { CombinationsTable } from '@/features/product-variants/components/VariantsSection'
import { cuerpoDeCrecimiento, planDeCrecimiento, type Crecimiento, type ProblemaDeCrecimiento } from '@/features/product-variants/familyEdits'
import { useInvalidarCatalogo } from '@/features/product-variants/hooks'
import { useErrorDeEscritura } from '@/features/product-variants/useErrorDeEscritura'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { addVariants, renameOptionValue } from '@/services/productGroups.service'
import type { AddVariantsBody, ProductGroupDetail } from '@/types/productGroup'

interface Props {
  venueId: string
  familia: ProductGroupDetail
  disabled: boolean
}

/** El diálogo de la familia pregunta antes de cerrar si quedó algo sin guardar aquí (`true` = hay algo tecleado). */
type ConCambios = { onCambios?: (sucio: boolean) => void }

const SIN_CAMBIOS: Crecimiento = { nuevosValores: {} }
/** En rojo; los demás son pasos pendientes mientras el dueño teclea (gris), como en el alta. */
const GRAVES = new Set(['demasiadasCombinaciones', 'noCaben', 'demasiadosValores', 'textoLargo', 'opcionRepetida', 'demasiadasOpciones'])
const PROPIOS = new Set(['sinCambios', 'valorParaExistentes', 'noCaben'])
const enOrden = (f: ProductGroupDetail) =>
  [...f.options].sort((a, b) => a.position - b.position).map(o => ({ ...o, values: [...o.values].sort((a, b) => a.position - b.position) }))

/**
 * Agregar valores nuevos («XL») o una opción nueva («Material») a una familia que ya existe. Pide `menu:create` y el plan (Codex A5).
 * Debajo, marcadas, las combinaciones que llevan algo nuevo. Las de puros valores viejos que nunca se crearon sólo se cuentan; el dueño
 * las pide con «Ver combinaciones que faltan» y salen desmarcadas (si caben).
 */
export function GroupGrowSection({ venueId, familia, disabled, onCambios }: Props & ConCambios) {
  const { t } = useTranslation('variants')
  const { toast } = useToast()
  const invalidar = useInvalidarCatalogo()
  const alFallar = useErrorDeEscritura(venueId)
  const [crec, setCrec] = useState<Crecimiento>(SIN_CAMBIOS)
  const [tecleadas, setTecleadas] = useState<Record<string, FilaVariante>>({})
  const [verFaltantes, setVerFaltantes] = useState(false)
  const enviando = useRef(false) // isPending no cambia entre dos clics del mismo instante
  const opciones = useMemo(() => enOrden(familia), [familia])
  // El server copia el inventario de UNA hermana viva cualquiera (Codex C2): con inventario mixto (posible tras agrupar) las existencias
  // iniciales podían ignorarse en silencio. Sólo se piden si TODAS lo llevan; en una familia mixta se capturan después, en cada variante.
  const conInventario = familia.variants.length > 0 && familia.variants.every(v => v.stock !== null)
  const inventarioMixto = !conInventario && familia.variants.some(v => v.stock !== null)
  const hayAlgo = !!crec.nuevaOpcion || Object.values(crec.nuevosValores).some(v => v.length > 0) || Object.keys(tecleadas).length > 0
  useEffect(() => {
    onCambios?.(hayAlgo)
    return () => onCambios?.(false)
  }, [hayAlgo, onCambios])

  // El valor que toman las existentes: el elegido si sigue entre los valores; si no, el primero (como Shopify).
  const efectivo = useMemo<Crecimiento>(() => {
    if (!crec.nuevaOpcion) return crec
    const valores = limpiarOpciones([crec.nuevaOpcion])[0].values
    const elegido = valores.find(v => norm(v) === norm(crec.nuevaOpcion!.paraExistentes)) ?? valores[0] ?? ''
    return { ...crec, nuevaOpcion: { ...crec.nuevaOpcion, paraExistentes: elegido } }
  }, [crec])
  const plan = useMemo(() => planDeCrecimiento(familia, efectivo, verFaltantes), [familia, efectivo, verFaltantes])
  // Lo tecleado en cada combinación se conserva por llave mientras siga existiendo (lo mismo que sincronizarFilas).
  const filas = useMemo(() => plan.filas.map(f => (tecleadas[f.key] ? { ...tecleadas[f.key], values: f.values } : f)), [plan.filas, tecleadas])
  const valoresNueva = efectivo.nuevaOpcion ? limpiarOpciones([efectivo.nuevaOpcion])[0].values : []
  const cuerpo = useMemo(() => cuerpoDeCrecimiento(familia, efectivo, filas, conInventario), [familia, efectivo, filas, conInventario])
  const nadaQueMandar = !cuerpo.newValues && !cuerpo.newOptions && cuerpo.variants.length === 0
  // QA MEDIO-1: el server cuenta vivas + nuevas ≤ 250. Se comparan las MARCADAS (no las generadas): con 240 vivas y 12 generadas, el
  // dueño desmarca 2 y ya puede agregar.
  const deMas = cuerpo.variants.length > plan.caben

  const agregar = useMutation({
    mutationFn: (body: AddVariantsBody) => addVariants(venueId, familia.id, body),
    onSuccess: async (_r, body) => {
      await invalidar(venueId)
      setCrec(SIN_CAMBIOS)
      setTecleadas({})
      setVerFaltantes(false)
      toast({ title: body.variants.length ? t('crecer.agregadas', { count: body.variants.length }) : t('crecer.guardado') })
    },
    onError: alFallar(t('crecer.noAgregadas')),
    onSettled: () => {
      enviando.current = false
    },
  })
  const bloqueado = disabled || agregar.isPending

  const enviar = () => {
    if (enviando.current || plan.problema || nadaQueMandar || deMas) return
    // Sólo valores o sólo un eje («Material: Algodón» para todas), sin combinaciones marcadas, es válido (Codex A4).
    const soloOpciones = cuerpo.variants.length === 0 && !!(cuerpo.newValues || cuerpo.newOptions)
    const p = soloOpciones ? null : validarFilas(familia.name, filas, conInventario)
    if (p) {
      toast({ variant: 'destructive', title: t(`validacion.${p.code}`, p) })
      return
    }
    enviando.current = true
    agregar.mutate(cuerpo)
  }
  const cambiarNueva = (c: Partial<NonNullable<Crecimiento['nuevaOpcion']>>) =>
    setCrec(prev => (prev.nuevaOpcion ? { ...prev, nuevaOpcion: { ...prev.nuevaOpcion, ...c } } : prev))
  const textoDe = (p: ProblemaDeCrecimiento) => t(PROPIOS.has(p.code) ? `crecer.${p.code}` : `validacion.${p.code}`, p)

  return (
    <section className="space-y-5 rounded-2xl border border-border/50 bg-card p-6" data-tour="product-group-grow">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">{t('crecer.titulo')}</h3>
        <p className="text-sm text-muted-foreground">{t('crecer.ayuda')}</p>
      </div>

      {opciones.map(o => (
        <div key={o.id} className="space-y-2" data-tour="product-group-grow-values">
          <p className="text-sm font-medium">{t('crecer.valoresNuevos', { name: o.name })}</p>
          <OptionValuesInput
            aria-label={t('crecer.valoresNuevos', { name: o.name })}
            placeholder={t('opciones.valoresEjemplo')}
            values={crec.nuevosValores[o.name] ?? []}
            disabled={bloqueado}
            onChange={values => setCrec(prev => ({ ...prev, nuevosValores: { ...prev.nuevosValores, [o.name]: values } }))}
          />
        </div>
      ))}

      {crec.nuevaOpcion ? (
        <div className="space-y-3 rounded-xl border border-input p-4" data-tour="product-group-grow-new-option">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              aria-label={t('opciones.nombre')}
              placeholder={t('opciones.nombreEjemplo')}
              value={crec.nuevaOpcion.name}
              disabled={bloqueado}
              onChange={e => cambiarNueva({ name: e.target.value })}
              className="h-12 max-w-64 bg-transparent text-base"
              data-tour="product-group-grow-option-name"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="cursor-pointer"
              aria-label={t('opciones.quitar', { name: crec.nuevaOpcion.name })}
              disabled={bloqueado}
              onClick={() => setCrec(prev => ({ nuevosValores: prev.nuevosValores }))}
              data-tour="product-group-grow-remove-option"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <OptionValuesInput
            aria-label={t('opciones.valores')}
            placeholder={t('opciones.valoresEjemplo')}
            values={crec.nuevaOpcion.values}
            disabled={bloqueado}
            onChange={values => cambiarNueva({ values })}
          />
          {valoresNueva.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('crecer.paraExistentes', { count: familia.variants.length })}</p>
              <Select value={efectivo.nuevaOpcion?.paraExistentes} onValueChange={v => cambiarNueva({ paraExistentes: v })} disabled={bloqueado}>
                <SelectTrigger
                  className="h-12 max-w-64 bg-transparent text-base"
                  aria-label={t('crecer.paraExistentes', { count: familia.variants.length })}
                  data-tour="product-group-grow-existing-value"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {valoresNueva.map(v => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          disabled={bloqueado || opciones.length >= MAX_OPCIONES}
          onClick={() => setCrec(prev => ({ ...prev, nuevaOpcion: { name: '', values: [], paraExistentes: '' } }))}
          data-tour="product-group-grow-add-option"
        >
          <Plus className="mr-2 h-4 w-4" />
          {opciones.length >= MAX_OPCIONES ? t('opciones.maximo') : t('crecer.nuevaOpcion')}
        </Button>
      )}

      {plan.problema ? (
        <p role="status" className={cn('text-sm', GRAVES.has(plan.problema.code) ? 'text-destructive' : 'text-muted-foreground')}>
          {textoDe(plan.problema)}
        </p>
      ) : (
        <>
          {plan.faltantes > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Switch id={`ver-faltantes-${familia.id}`} checked={verFaltantes} disabled={bloqueado} onCheckedChange={setVerFaltantes}
                  data-tour="product-group-grow-missing" />
                <Label htmlFor={`ver-faltantes-${familia.id}`}>{t('crecer.verFaltantes', { count: plan.faltantes })}</Label>
              </div>
              {verFaltantes && !plan.faltantesCaben && (
                <p role="status" className="text-sm text-muted-foreground">
                  {t('crecer.faltantesDemasiadas', { count: plan.faltantes })}
                </p>
              )}
            </div>
          )}
          {filas.length > 0 && inventarioMixto && <p className="text-sm text-muted-foreground">{t('crecer.existenciasDespues')}</p>}
          {filas.length > 0 && (
            <CombinationsTable
              padre={familia.name}
              filas={filas}
              conInventario={conInventario}
              disabled={bloqueado}
              onChange={nuevas => setTecleadas(prev => ({ ...prev, ...Object.fromEntries(nuevas.map(f => [f.key, f])) }))}
            />
          )}
          {deMas && (
            <p role="status" className="text-sm text-destructive">
              {t('crecer.marcadasDeMas', { count: cuerpo.variants.length, vivas: familia.variants.length, caben: plan.caben })}
            </p>
          )}
        </>
      )}

      <div className="flex justify-end">
        <Button disabled={bloqueado || !!plan.problema || nadaQueMandar || deMas} onClick={enviar} data-tour="product-group-grow-submit">
          {agregar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('crecer.agregar')}
        </Button>
      </div>
    </section>
  )
}

/**
 * Las opciones de la familia como fichas; el lápiz renombra un valor («M» → «Mediana») y el server renombra sus variantes.
 * Pide `menu:update` y el plan. Enter confirma; Esc cancela (el diálogo no se cierra: ver `data-renombrar-valor`).
 */
export function GroupOptionValues({ venueId, familia, disabled, onCambios }: Props & ConCambios) {
  const { t } = useTranslation('variants')
  const { toast } = useToast()
  const invalidar = useInvalidarCatalogo()
  const alFallar = useErrorDeEscritura(venueId)
  const [editando, setEditando] = useState<{ id: string; texto: string } | null>(null)
  const enviando = useRef(false)
  const opciones = useMemo(() => enOrden(familia), [familia])
  // Un renombre a medias («M» → «Mediana» sin ✓) también es algo sin guardar: la X del diálogo pregunta.
  const valorQueSeRenombra = editando && familia.options.flatMap(o => o.values).find(v => v.id === editando.id)?.value
  const renombrePendiente = !!editando && editando.texto.trim() !== valorQueSeRenombra
  useEffect(() => {
    onCambios?.(renombrePendiente)
    return () => onCambios?.(false)
  }, [renombrePendiente, onCambios])

  const renombrar = useMutation({
    mutationFn: (v: { id: string; value: string }) => renameOptionValue(venueId, familia.id, v.id, v.value),
    onSuccess: async () => {
      await invalidar(venueId)
      setEditando(null)
      toast({ title: t('valores.renombrado') })
    },
    onError: alFallar(t('valores.noRenombrado')), // el 409 «Mediana ya existe en Talla» se ve tal cual; lo tecleado sigue para corregir
    onSettled: () => {
      enviando.current = false
    },
  })
  const confirmar = (actual: string) => {
    if (!editando || enviando.current) return
    const value = editando.texto.trim()
    if (!value || value === actual) return setEditando(null)
    if (value.length > MAX_TEXTO_OPCION) {
      toast({ variant: 'destructive', title: t('validacion.textoLargo', { text: value }) })
      return
    }
    enviando.current = true
    renombrar.mutate({ id: editando.id, value })
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border/50 bg-card p-6" data-tour="product-group-options">
      <h3 className="text-lg font-semibold">{t('valores.titulo')}</h3>
      {opciones.map(o => (
        <div key={o.id} className="space-y-2">
          <p className="text-sm font-medium">{o.name}</p>
          <div className="flex flex-wrap items-center gap-2">
            {o.values.map(v =>
              editando?.id === v.id ? (
                // Esc en el campo o en ✓/✗ cancela el renombre (el diálogo no se cierra: ver `onEscapeKeyDown` en ProductGroupDialog).
                <div
                  key={v.id}
                  className="flex items-center gap-1"
                  data-renombrar-valor=""
                  onKeyDown={e => {
                    if (e.key === 'Escape') setEditando(null)
                  }}
                >
                  <Input
                    autoFocus
                    aria-label={t('valores.renombrar', { name: v.value })}
                    value={editando.texto}
                    readOnly={renombrar.isPending}
                    onChange={e => setEditando({ id: v.id, texto: e.target.value })}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        confirmar(v.value)
                      }
                    }}
                    className="h-9 w-40 bg-transparent"
                    data-tour="product-group-rename-input"
                  />
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" aria-label={t('valores.guardar')}
                    disabled={renombrar.isPending} onClick={() => confirmar(v.value)} data-tour="product-group-rename-save">
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" aria-label={t('valores.cancelar')}
                    disabled={renombrar.isPending} onClick={() => setEditando(null)} data-tour="product-group-rename-cancel">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Badge key={v.id} variant="secondary" className="gap-1 text-sm">
                  {v.value}
                  <button
                    type="button"
                    className="cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={t('valores.renombrar', { name: v.value })}
                    disabled={disabled || renombrar.isPending}
                    onClick={() => setEditando({ id: v.id, texto: v.value })}
                    data-tour="product-group-rename-value"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                </Badge>
              ),
            )}
          </div>
        </div>
      ))}
    </section>
  )
}
