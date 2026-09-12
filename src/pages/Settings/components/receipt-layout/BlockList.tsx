import { ArrowDown, ArrowUp, Lock, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { ReceiptBlock } from '@/services/receiptLayout.service'
import { BLOCK_CATALOG, LOCK_BADGE, LOCK_TOOLTIP_KEY } from './blockCatalog'

interface BlockListProps {
  blocks: ReceiptBlock[]
  onReorder: (from: number, to: number) => void
  onRemove: (index: number) => void
  onSelect: (index: number) => void
  selectedIndex?: number | null
  /** Sin `receipt-layout:manage`: se ve todo, no hay un solo control de escritura. */
  readOnly?: boolean
}

/**
 * La lista de bloques del ticket.
 *
 * Las tres decisiones que la definen:
 *
 * 1. **Reordenar con botones y teclado**, no sólo arrastrando. `@dnd-kit` está en el repo y el
 *    arrastre se puede añadir encima, pero los botones son la BASE: un arrastre sin alternativa
 *    deja fuera a quien no puede arrastrar, y en un trackpad con prisa falla.
 * 2. **Los obligatorios se VEN**, con su clase de candado y un tooltip distinto por clase.
 *    Esconderlos dejaría al dueño sin entender por qué su ticket trae algo que él no puso.
 * 3. **`readOnly` ELIMINA los controles** en vez de deshabilitarlos: un botón apagado sugiere
 *    «podrías si…», y sin permiso la respuesta es «no puedes» — eso se dice una vez arriba.
 */
export function BlockList({ blocks, onReorder, onRemove, onSelect, selectedIndex = null, readOnly = false }: BlockListProps) {
  const { t } = useTranslation('receiptLayout')

  // 🔴 La firma vive SIEMPRE al final (el servidor rechaza con RECEIPT_LAYOUT_SIGNATURE_NOT_LAST),
  // así que ni ella sube ni el de encima baja. Se deshabilita y se explica, nunca se esconde.
  const indiceFirma = blocks.findIndex(b => b.type === 'signature')

  return (
    <TooltipProvider delayDuration={150}>
      <ul className="divide-y divide-border/50" data-tour="receipt-layout-block-list">
        {blocks.map((block, i) => {
          const meta = BLOCK_CATALOG[block.type]
          const bloqueado = Boolean(meta?.lock)
          const esFirma = i === indiceFirma
          const empujariaLaFirma = indiceFirma >= 0 && i === indiceFirma - 1
          const Icono = meta?.icon
          const seleccionado = selectedIndex === i

          return (
            <li
              key={`${block.type}-${i}`}
              data-testid={`block-row-${block.type}`}
              aria-current={seleccionado || undefined}
              onClick={() => onSelect(i)}
              className={cn(
                'group grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2.5',
                'transition-colors hover:bg-muted/40',
                seleccionado && 'bg-muted/60',
              )}
            >
              {Icono ? (
                <Icono aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <span aria-hidden className="h-4 w-4" />
              )}

              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {meta ? t(meta.labelKey) : t('blocks.unknown')}
                </p>
                <p className="truncate text-xs text-muted-foreground">{resumen(block, t)}</p>
              </div>

              <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                {bloqueado && meta?.lock && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        data-testid={`block-lock-${block.type}`}
                        data-lock={meta.lock}
                        aria-label={t(LOCK_TOOLTIP_KEY[meta.lock])}
                        className="mr-1 inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
                      >
                        <Lock aria-hidden className="h-3 w-3" />
                        {LOCK_BADGE[meta.lock]}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{t(LOCK_TOOLTIP_KEY[meta.lock])}</TooltipContent>
                  </Tooltip>
                )}

                {!readOnly && (
                  <>
                    <IconButton
                      testId={`block-up-${block.type}`}
                      label={t('actions.moveUp')}
                      disabled={i === 0 || esFirma}
                      onClick={() => onReorder(i, i - 1)}
                    >
                      <ArrowUp aria-hidden className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      testId={`block-down-${block.type}`}
                      label={t('actions.moveDown')}
                      disabled={i === blocks.length - 1 || esFirma || empujariaLaFirma}
                      onClick={() => onReorder(i, i + 1)}
                    >
                      <ArrowDown aria-hidden className="h-4 w-4" />
                    </IconButton>
                    {!bloqueado && (
                      <IconButton
                        testId={`block-remove-${block.type}`}
                        label={t('actions.remove')}
                        onClick={() => onRemove(i)}
                      >
                        <X aria-hidden className="h-4 w-4" />
                      </IconButton>
                    )}
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </TooltipProvider>
  )
}

function IconButton({
  testId,
  label,
  disabled,
  onClick,
  children,
}: {
  testId: string
  label: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  )
}

/**
 * El resumen del renglón — «doble ancho · centrado», «con modificadores».
 * Es lo que evita tener que abrir cada bloque para saber cómo está configurado.
 */
function resumen(block: ReceiptBlock, t: (k: string, o?: Record<string, unknown>) => string): string {
  const partes: string[] = []
  const v = block as Record<string, unknown>

  if (typeof v.size === 'string') partes.push(t(`summary.size.${v.size}`))
  if (typeof v.emphasis === 'string' && v.emphasis !== 'normal') partes.push(t(`summary.emphasis.${v.emphasis}`))
  if (typeof v.align === 'string' && v.align !== 'left') partes.push(t(`summary.align.${v.align}`))
  if (typeof v.style === 'string') partes.push(t(`summary.style.${v.style}`))
  if (Array.isArray(v.lines)) partes.push(t('summary.lines', { count: v.lines.length }))
  if (typeof v.caption === 'string' && v.caption) partes.push(`«${v.caption}»`)

  // Los interruptores apagados son lo interesante: lo prendido es el default.
  const apagados = Object.entries(v)
    .filter(([k, val]) => k.startsWith('show') && val === false)
    .map(([k]) => t(`summary.off.${k}`))
  partes.push(...apagados)

  if (partes.length > 0) return partes.join(' · ')

  // 🔴 Nada que resumir. Antes se caía a la DESCRIPCIÓN del bloque, y como es una frase larga
  // salía truncada con puntos suspensivos («Folio, fecha y hora de la venta. La …»), que se lee
  // como algo roto. Sólo se vio MIRANDO la pantalla: las pruebas comprueban que el texto esté,
  // no cómo se lee. Ahora, si el bloque tiene interruptores y están TODOS prendidos, se dice —
  // que además informa; y si no tiene nada configurable, el renglón se queda con su nombre.
  const meta = BLOCK_CATALOG[block.type]
  const tieneInterruptores = meta?.options.some(o => o.startsWith('show')) ?? false
  return tieneInterruptores ? t('summary.allOn') : ''
}
