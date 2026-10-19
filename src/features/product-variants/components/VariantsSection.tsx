import { Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import {
  MAX_OPCIONES, limpiarOpciones, nombreDeVariante, sincronizarFilas, sugerirSku, validarOpciones,
  type FilaVariante, type OpcionEditable,
} from '../combinations'
import { OptionLibraryPicker } from './OptionLibraryPicker'
import { OptionValuesInput } from './OptionValuesInput'

export interface ValorVariantes {
  opciones: OpcionEditable[]
  filas: FilaVariante[]
  conInventario: boolean
}
// eslint-disable-next-line react-refresh/only-export-components
export const VARIANTES_INICIALES: ValorVariantes = { opciones: [{ name: '', values: [] }], filas: [], conInventario: false }

/** Errores que se pintan en rojo; los demás son pasos pendientes mientras el dueño teclea (gris). */
const GRAVES = new Set(['demasiadasCombinaciones', 'demasiadosValores', 'textoLargo', 'opcionRepetida', 'demasiadasOpciones'])

function CampoNumero(p: { value?: number; onChange: (v: number | undefined) => void; label: string; entero?: boolean; disabled?: boolean; placeholder?: string }) {
  return (
    <Input
      type="number"
      inputMode={p.entero ? 'numeric' : 'decimal'}
      min={0}
      step={p.entero ? 1 : 0.01}
      aria-label={p.label}
      value={p.value ?? ''}
      placeholder={p.placeholder}
      disabled={p.disabled}
      onChange={e => p.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      className="h-10 min-w-24 bg-transparent"
    />
  )
}

interface Props {
  venueId: string
  nombrePadre: string
  value: ValorVariantes
  onChange: (v: ValorVariantes) => void
  disabled?: boolean
  mostrarInventario?: boolean
}

export function VariantsSection({ venueId, nombrePadre, value, onChange, disabled, mostrarInventario = true }: Props) {
  const { t } = useTranslation('variants')
  const limpias = useMemo(() => limpiarOpciones(value.opciones), [value.opciones])
  const problema = useMemo(() => validarOpciones(limpias), [limpias])
  // Con una opción a medias (paso pendiente, no error) la tabla se queda con la última combinación válida: nada de lo capturado se
  // esconde, y al completarla las combinaciones nuevas heredan su precio (sincronizarFilas).
  const enEspera = !!problema && !GRAVES.has(problema.code) && value.filas.length > 0
  const padre = nombrePadre.trim() || t('alta.padreSinNombre')

  const cambiarOpciones = (opciones: OpcionEditable[]) => {
    const l = limpiarOpciones(opciones)
    onChange({ ...value, opciones, filas: validarOpciones(l) === null ? sincronizarFilas(l, value.filas) : value.filas })
  }
  const cambiarOpcion = (i: number, cambio: Partial<OpcionEditable>) =>
    cambiarOpciones(value.opciones.map((o, j) => (j === i ? { ...o, ...cambio } : o)))

  return (
    <div className="space-y-6" data-tour="product-variants-section">
      <div className="space-y-4">
        {value.opciones.map((o, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-input p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                aria-label={t('opciones.nombre')}
                placeholder={t('opciones.nombreEjemplo')}
                value={o.name}
                disabled={disabled}
                onChange={e => cambiarOpcion(i, { name: e.target.value })}
                onKeyDown={e => {
                  if (e.key === 'Enter') e.preventDefault() // dentro de un <form> (el alta): Enter no debe enviarlo
                }}
                className="h-12 max-w-64 bg-transparent text-base"
                data-tour={i === 0 ? 'product-variants-option-name' : undefined}
              />
              <OptionLibraryPicker venueId={venueId} disabled={disabled} onPick={elegida => cambiarOpcion(i, elegida)} />
              {value.opciones.length > 1 && (
                <Button type="button" variant="ghost" size="icon" className="cursor-pointer" aria-label={t('opciones.quitar', { name: o.name || String(i + 1) })} disabled={disabled}
                  onClick={() => cambiarOpciones(value.opciones.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <OptionValuesInput
              aria-label={t('opciones.valores')}
              placeholder={t('opciones.valoresEjemplo')}
              values={o.values}
              disabled={disabled}
              onChange={values => cambiarOpcion(i, { values })}
            />
          </div>
        ))}
        <Button type="button" variant="outline" disabled={disabled || value.opciones.length >= MAX_OPCIONES}
          onClick={() => cambiarOpciones([...value.opciones, { name: '', values: [] }])} data-tour="product-variants-add-option">
          <Plus className="mr-2 h-4 w-4" />
          {value.opciones.length >= MAX_OPCIONES ? t('opciones.maximo') : t('opciones.agregar')}
        </Button>
      </div>

      {problema && (
        <p role="status" className={cn('text-sm', GRAVES.has(problema.code) ? 'text-destructive' : 'text-muted-foreground')}>
          {t(`validacion.${problema.code}`, problema)}
        </p>
      )}
      {enEspera && <p className="text-sm text-muted-foreground">{t('validacion.tablaEnEspera')}</p>}
      {(!problema || enEspera) && (
        <div className="space-y-4">
          {mostrarInventario && (
            <div className="flex items-center gap-3">
              <Switch id="variantes-inventario" checked={value.conInventario} disabled={disabled} onCheckedChange={v => onChange({ ...value, conInventario: v })} data-tour="product-variants-track-inventory" />
              <Label htmlFor="variantes-inventario">{t('tabla.llevarInventario')}</Label>
            </div>
          )}
          <CombinationsTable padre={padre} filas={value.filas} conInventario={mostrarInventario && value.conInventario} disabled={disabled}
            onChange={filas => onChange({ ...value, filas })} />
        </div>
      )}
    </div>
  )
}

/** La tabla de combinaciones con «Aplicar a todas». Se reusa al agregar variantes a una familia que ya existe (Tarea 7). */
export function CombinationsTable(p: { padre: string; filas: FilaVariante[]; onChange: (filas: FilaVariante[]) => void; conInventario: boolean; disabled?: boolean }) {
  const { t } = useTranslation('variants')
  const [precioTodas, setPrecioTodas] = useState<number>()
  const [costoTodas, setCostoTodas] = useState<number>()
  const { padre, filas, onChange, conInventario, disabled } = p
  const cambiarFila = (key: string, cambio: Partial<FilaVariante>) => onChange(filas.map(f => (f.key === key ? { ...f, ...cambio } : f)))
  const aplicarATodas = () =>
    onChange(
      filas.map(f =>
        f.incluida ? { ...f, ...(precioTodas !== undefined ? { price: precioTodas } : {}), ...(costoTodas !== undefined ? { cost: costoTodas } : {}) } : f,
      ),
    )
  const incluidas = filas.filter(f => f.incluida).length
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label>{t('tabla.precioTodasTitulo')}</Label>
          <CampoNumero label={t('tabla.precioTodas')} value={precioTodas} onChange={setPrecioTodas} disabled={disabled} />
        </div>
        <div className="space-y-1">
          <Label>{t('tabla.costoTodasTitulo')}</Label>
          <CampoNumero label={t('tabla.costoTodas')} value={costoTodas} onChange={setCostoTodas} disabled={disabled} />
        </div>
        <Button type="button" variant="secondary" disabled={disabled || (precioTodas === undefined && costoTodas === undefined)} onClick={aplicarATodas} data-tour="product-variants-apply-all">
          {t('tabla.aplicarTodas')}
        </Button>
        <p className="ml-auto text-sm text-muted-foreground">{t('tabla.conteo', { count: incluidas, total: filas.length })}</p>
      </div>
      {/* La casilla y el nombre van en la primera columna, que se queda fija: al deslizar hasta «Código» o «Existencias» se sigue viendo
          en qué talla/color se escribe. */}
      <div className="overflow-hidden rounded-xl border border-input">
        <Table stickyFirstColumn>
          <TableHeader>
            <TableRow>
              <TableHead>{t('tabla.variante')}</TableHead>
              <TableHead>{t('tabla.precioCol')}</TableHead>
              <TableHead>{t('tabla.costoCol')}</TableHead>
              <TableHead>{t('tabla.skuCol')}</TableHead>
              <TableHead>{t('tabla.codigoCol')}</TableHead>
              {conInventario && <TableHead>{t('tabla.existenciasCol')}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map(f => {
              const nombre = nombreDeVariante(padre, f.values)
              return (
                // Sin opacidad en el renglón: volvería transparente la celda fija y se verían por debajo las columnas al deslizar.
                <TableRow key={f.key}>
                  <TableCell className={cn('min-w-56 font-medium', !f.incluida && 'text-muted-foreground')}>
                    <div className="flex items-center gap-3">
                      <Checkbox aria-label={t('tabla.incluir', { name: nombre })} checked={f.incluida} disabled={disabled}
                        onCheckedChange={v => cambiarFila(f.key, { incluida: v === true })} />
                      {nombre}
                    </div>
                  </TableCell>
                  <TableCell><CampoNumero label={t('tabla.precio', { name: nombre })} value={f.price} disabled={disabled || !f.incluida} onChange={price => cambiarFila(f.key, { price })} /></TableCell>
                  <TableCell><CampoNumero label={t('tabla.costo', { name: nombre })} value={f.cost} disabled={disabled || !f.incluida} onChange={cost => cambiarFila(f.key, { cost })} /></TableCell>
                  <TableCell>
                    <Input aria-label={t('tabla.sku', { name: nombre })} className="h-10 min-w-40 bg-transparent" value={f.sku ?? ''}
                      placeholder={sugerirSku(padre, f.values)} disabled={disabled || !f.incluida} onChange={e => cambiarFila(f.key, { sku: e.target.value })} />
                  </TableCell>
                  <TableCell>
                    <Input aria-label={t('tabla.codigo', { name: nombre })} className="h-10 min-w-36 bg-transparent" value={f.gtin ?? ''} inputMode="numeric"
                      disabled={disabled || !f.incluida} onChange={e => cambiarFila(f.key, { gtin: e.target.value })} />
                  </TableCell>
                  {conInventario && (
                    <TableCell>
                      <CampoNumero entero label={t('tabla.existencias', { name: nombre })} value={f.initialStock} disabled={disabled || !f.incluida}
                        onChange={initialStock => cambiarFila(f.key, { initialStock })} />
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
