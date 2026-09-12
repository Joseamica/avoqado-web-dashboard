import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { ReceiptBlock } from '@/services/receiptLayout.service'
import { BLOCK_CATALOG, type BlockOption } from './blockCatalog'
import { MAX_CARACTERES, MAX_RENGLONES, revisarTexto } from './textoImprimible'

interface BlockEditorProps {
  block: ReceiptBlock
  onChange: (block: ReceiptBlock) => void
  readOnly?: boolean
}

const ALINEACIONES = ['left', 'center', 'right'] as const
const ENFASIS = ['normal', 'bold', 'double'] as const
const TAMANOS = ['S', 'M', 'L'] as const
const ESTILOS = ['line', 'double', 'blank'] as const

/** Los interruptores del catálogo, en el orden en que salen impresos. */
const CONMUTADORES: BlockOption[] = [
  'showOrderType',
  'showModifiers',
  'showNotes',
  'showSubtotal',
  'showTax',
  'showDiscount',
  'showTip',
  'showChange',
  'showCardLastFour',
  'showTransactionId',
  'showAppVersion',
]

/**
 * Las opciones de UN bloque. Aparece DEBAJO de su renglón en la lista, no en un tercer panel:
 * sólo se ve el que estás editando (progressive disclosure), y el papel no pierde sitio.
 *
 * 🔴 Lo que este panel DECLARA, y no sólo configura: hay renglones que no se pueden apagar
 * (el TOTAL, la autorización y la referencia del cobro) y decirlo aquí evita que el dueño los
 * busque. Un interruptor ausente sin explicación se lee como un hueco del producto.
 */
export function BlockEditor({ block, onChange, readOnly = false }: BlockEditorProps) {
  const { t } = useTranslation('receiptLayout')
  const meta = BLOCK_CATALOG[block.type]

  if (!meta) {
    return (
      <p className="px-3 py-4 text-xs text-muted-foreground" data-testid="block-editor-unknown">
        {t('editor.unknownBlock')}
      </p>
    )
  }

  const set = (parche: Record<string, unknown>) => onChange({ ...block, ...parche } as ReceiptBlock)
  const v = block as Record<string, unknown>
  const tiene = (o: BlockOption) => meta.options.includes(o)
  const conmutadores = CONMUTADORES.filter(tiene)

  // Un panel vacío parece roto. Si el bloque no tiene opciones, se dice con todas sus letras.
  const sinOpciones = meta.options.length === 0

  return (
    <div
      data-testid={`block-editor-${block.type}`}
      // Tarjeta blanca con cabecera, el patrón del repo dentro de un FullScreenModal.
      className="mx-3 mb-3 rounded-2xl border border-border/50 bg-card p-4"
    >
      <p className="mb-3 text-xs text-muted-foreground">{t(meta.descriptionKey)}</p>

      {sinOpciones ? (
        <p className="text-xs text-muted-foreground" data-testid={`block-editor-${block.type}-no-options`}>
          {t('editor.noOptions')}
        </p>
      ) : (
        <div className="space-y-4">
          {tiene('lines') && (
            <RenglonesDeTexto
              lines={Array.isArray(v.lines) ? (v.lines as string[]) : ['']}
              onChange={lines => set({ lines })}
              readOnly={readOnly}
            />
          )}

          {tiene('caption') && (
            <CampoDeTexto
              id={`caption-${block.type}`}
              label={t('editor.caption')}
              value={typeof v.caption === 'string' ? v.caption : ''}
              onChange={caption => set({ caption })}
              readOnly={readOnly}
            />
          )}

          {tiene('size') && (
            <Pills
              label={t('editor.size')}
              options={TAMANOS.map(s => ({ value: s, label: t(`summary.size.${s}`) }))}
              value={typeof v.size === 'string' ? v.size : 'M'}
              onChange={size => set({ size })}
              readOnly={readOnly}
              testId={`block-size-${block.type}`}
            />
          )}

          {tiene('align') && (
            <Pills
              label={t('editor.align')}
              options={ALINEACIONES.map(a => ({ value: a, label: t(`summary.align.${a}`) }))}
              value={typeof v.align === 'string' ? v.align : 'center'}
              onChange={align => set({ align })}
              readOnly={readOnly}
              testId={`block-align-${block.type}`}
            />
          )}

          {tiene('emphasis') && (
            <Pills
              label={t('editor.emphasis')}
              options={ENFASIS.map(e => ({ value: e, label: t(`summary.emphasis.${e}`) }))}
              value={typeof v.emphasis === 'string' ? v.emphasis : 'normal'}
              onChange={emphasis => set({ emphasis })}
              readOnly={readOnly}
              testId={`block-emphasis-${block.type}`}
            />
          )}

          {tiene('style') && (
            <Pills
              label={t('editor.style')}
              options={ESTILOS.map(s => ({ value: s, label: t(`summary.style.${s}`) }))}
              value={typeof v.style === 'string' ? v.style : 'line'}
              onChange={style => set({ style })}
              readOnly={readOnly}
              testId={`block-style-${block.type}`}
            />
          )}

          {conmutadores.length > 0 && (
            <div className="space-y-3">
              {conmutadores.map(opcion => (
                <div key={opcion} className="flex items-center justify-between gap-3">
                  <Label htmlFor={`${opcion}-${block.type}`} className="cursor-pointer text-sm font-normal">
                    {t(`editor.${opcion}`)}
                  </Label>
                  <Switch
                    id={`${opcion}-${block.type}`}
                    data-testid={`block-switch-${opcion}`}
                    checked={v[opcion] !== false}
                    disabled={readOnly}
                    onCheckedChange={checked => set({ [opcion]: checked })}
                  />
                </div>
              ))}
            </div>
          )}

          {/* 🔴 Lo que NO se puede apagar, dicho aquí para que nadie lo busque. */}
          {block.type === 'totals' && <SiempreSale texto={t('editor.alwaysTotal')} />}
          {block.type === 'payment' && <SiempreSale texto={t('editor.alwaysAuth')} />}
        </div>
      )}
    </div>
  )
}

function SiempreSale({ texto }: { texto: string }) {
  return (
    <p className="border-t border-border/50 pt-3 text-xs text-muted-foreground" data-testid="editor-always-prints">
      {texto}
    </p>
  )
}

function RenglonesDeTexto({
  lines,
  onChange,
  readOnly,
}: {
  lines: string[]
  onChange: (lines: string[]) => void
  readOnly?: boolean
}) {
  const { t } = useTranslation('receiptLayout')
  const actual = lines.length > 0 ? lines : ['']

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <Label className="text-sm">{t('editor.lines')}</Label>
        <span className="text-xs text-muted-foreground">
          {t('editor.linesCount', { count: actual.length, max: MAX_RENGLONES })}
        </span>
      </div>

      {actual.map((linea, i) => (
        <CampoDeTexto
          key={i}
          id={`text-line-${i}`}
          value={linea}
          onChange={valor => onChange(actual.map((l, j) => (j === i ? valor : l)))}
          onRemove={actual.length > 1 && !readOnly ? () => onChange(actual.filter((_, j) => j !== i)) : undefined}
          readOnly={readOnly}
        />
      ))}

      {!readOnly && actual.length < MAX_RENGLONES && (
        <button
          type="button"
          data-testid="block-text-add-line"
          onClick={() => onChange([...actual, ''])}
          className="cursor-pointer text-xs font-medium text-primary hover:underline"
        >
          {t('editor.addLine')}
        </button>
      )}
    </div>
  )
}

/**
 * 🔴 El contador de caracteres NO es cosmético: el servidor rechaza en 49 con un 400. Sin él, el
 * dueño escribe un párrafo y se estrella al guardar. Y el carácter que el papel no imprime se
 * marca AQUÍ, en el campo, no en un error de red después.
 */
function CampoDeTexto({
  id,
  label,
  value,
  onChange,
  onRemove,
  readOnly,
}: {
  id: string
  label?: string
  value: string
  onChange: (v: string) => void
  onRemove?: () => void
  readOnly?: boolean
}) {
  const { t } = useTranslation('receiptLayout')
  const revision = revisarTexto(value)
  const excedido = value.length > MAX_CARACTERES
  const malo = !revision.ok || excedido

  return (
    <div className="space-y-1">
      {label && (
        <Label htmlFor={id} className="text-sm">
          {label}
        </Label>
      )}
      <div className="flex items-center gap-2">
        <Input
          id={id}
          data-testid={`block-field-${id}`}
          value={value}
          readOnly={readOnly}
          maxLength={MAX_CARACTERES * 2}
          aria-invalid={malo || undefined}
          onChange={e => onChange(e.target.value)}
          className={cn('h-12 border-border/60 bg-transparent text-base', malo && 'border-destructive')}
        />
        {onRemove && (
          <button
            type="button"
            data-testid={`block-field-${id}-remove`}
            aria-label={t('actions.remove')}
            onClick={onRemove}
            className="cursor-pointer px-1 text-muted-foreground hover:text-foreground"
          >
            ×
          </button>
        )}
      </div>

      <div className="flex items-start justify-between gap-2">
        {malo ? (
          <p role="alert" data-testid={`block-field-${id}-problem`} className="flex items-center gap-1 text-xs text-destructive">
            <AlertTriangle aria-hidden className="h-3 w-3 shrink-0" />
            {excedido
              ? t('editor.tooLong', { max: MAX_CARACTERES })
              : t(`editor.notPrintable.${revision.motivo}`, { char: revision.offending })}
          </p>
        ) : (
          <span />
        )}
        <span className={cn('shrink-0 text-xs tabular-nums', excedido ? 'text-destructive' : 'text-muted-foreground')}>
          {value.length}/{MAX_CARACTERES}
        </span>
      </div>
    </div>
  )
}

function Pills<T extends string>({
  label,
  options,
  value,
  onChange,
  readOnly,
  testId,
}: {
  label: string
  options: Array<{ value: T; label: string }>
  value: string
  onChange: (v: T) => void
  readOnly?: boolean
  testId: string
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <div className="flex flex-wrap gap-1.5" data-testid={testId} role="group" aria-label={label}>
        {options.map(o => (
          <button
            key={o.value}
            type="button"
            data-testid={`${testId}-${o.value}`}
            aria-pressed={value === o.value}
            disabled={readOnly}
            onClick={() => onChange(o.value)}
            className={cn(
              'cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
              value === o.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border/60 text-muted-foreground hover:bg-muted',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
