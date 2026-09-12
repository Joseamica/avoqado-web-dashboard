import { Fragment, type ReactNode } from 'react'
import { QrCode } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import type { LogicalLine } from '@/services/receiptLayout.service'

interface ReceiptPaperProps {
  lines: LogicalLine[]
  /** Columnas REALES del papel: 48 (80 mm) o 32 (58 mm). */
  width: 48 | 32
  /** `true` mientras el papel muestra el diseño anterior porque la vista previa va en camino. */
  stale?: boolean
  /**
   * El `data-tour` del papel. Sólo lo pasa el DISEÑADOR: si la sección de Ajustes también lo
   * llevara, el tour iluminaría el primero del DOM, que no siempre es el que se está viendo.
   */
  tourId?: string
  className?: string
}

/**
 * El ticket, a escala real.
 *
 * Recibe las líneas que YA acomodó el intérprete del servidor —el MISMO que van a usar las tres
 * apps— y las pinta sin volver a alinear nada. Si el dashboard reacomodara, la vista previa
 * podría divergir del papel y dejaría de servir para lo único que existe.
 *
 * 🔴 Monoespaciada a propósito, y no es decoración «técnica»: un ticket térmico ES una rejilla de
 * 48 celdas iguales. Con una fuente proporcional, el recorte a 32 columnas deja de verse — y ver
 * ese recorte es justo lo que ningún editor de recibos del mercado enseña.
 */
export function ReceiptPaper({ lines, width, stale = false, tourId, className }: ReceiptPaperProps) {
  const { t } = useTranslation('receiptLayout')

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div
        data-paper=""
        data-width={width}
        data-tour={tourId}
        // Superficie propia, sin tarjeta y sin blur: tiene que leerse como un trozo de papel,
        // no como un widget. El ancho es EXACTAMENTE el del ticket más su margen de impresión.
        className={cn(
          'relative bg-card text-card-foreground shadow-sm ring-1 ring-border/60',
          'px-3 pb-5 pt-4 font-mono text-[13px] leading-[1.45] tabular-nums',
          // Único movimiento: un asentamiento de opacidad al repintarse. Sin salto de layout.
          'transition-opacity duration-[120ms] ease-out',
          stale && 'opacity-60',
        )}
        style={{ width: `calc(${width}ch + 1.5rem)`, maxWidth: '100%' }}
        aria-label={t('paper.aria', { width })}
      >
        {lines.length === 0 ? (
          <p data-testid="paper-empty" className="py-10 text-center font-sans text-xs text-muted-foreground">
            {t('paper.empty')}
          </p>
        ) : (
          lines.map((line, i) => <Fragment key={i}>{renderLine(line, width)}</Fragment>)
        )}

        {/* Borde troquelado inferior: lo que hace que se lea como papel arrancado, no como caja. */}
        <svg
          aria-hidden
          className="absolute -bottom-[7px] left-0 w-full text-card"
          height="8"
          preserveAspectRatio="none"
          viewBox="0 0 100 8"
        >
          <polygon
            fill="currentColor"
            points="0,0 100,0 100,1 96,8 92,1 88,8 84,1 80,8 76,1 72,8 68,1 64,8 60,1 56,8 52,1 48,8 44,1 40,8 36,1 32,8 28,1 24,8 20,1 16,8 12,1 8,8 4,1 0,8"
          />
        </svg>
      </div>
    </div>
  )
}

function renderLine(line: LogicalLine, width: 48 | 32): ReactNode {
  switch (line.kind) {
    case 'text': {
      // 🔴 `double` = doble ancho Y doble alto: el renglón gasta DOS columnas por carácter, así
      // que su ancho lógico es la MITAD. Pintarlo al mismo tamaño mentiría sobre dónde se corta.
      const anchoLogico = line.double ? Math.floor(width / 2) : width
      return (
        <div
          data-line="text"
          data-double={String(line.double)}
          className={cn(
            'whitespace-pre',
            line.bold && 'font-bold',
            line.double && 'text-[26px] font-bold leading-[1.2]',
            line.align === 'center' && 'text-center',
            line.align === 'right' && 'text-right',
          )}
          style={{ width: `${anchoLogico}ch`, marginInline: line.double ? 'auto' : undefined }}
        >
          {line.text}
        </div>
      )
    }

    case 'image':
      return line.ref === 'logo' ? (
        <div data-line="image" className="my-1.5 flex justify-center">
          <div
            data-testid="paper-logo-placeholder"
            className="flex items-center justify-center rounded border border-dashed border-muted-foreground/40 py-3 font-sans text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
            style={{ width: `${Math.round((line.widthPct / 100) * width)}ch` }}
          >
            logo
          </div>
        </div>
      ) : (
        <div data-line="image" className="my-1 flex justify-center">
          <span data-testid="paper-avoqado-mark" className="text-[11px] font-semibold tracking-tight text-muted-foreground">
            ✦ avoqado
          </span>
        </div>
      )

    case 'qr':
      return (
        <div data-line="qr" className="my-1.5 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded border border-dashed border-muted-foreground/40">
            <QrCode aria-hidden className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>
      )

    case 'barcode':
      return (
        <div data-line="barcode" className="my-1.5 flex justify-center">
          {/* No es un gradiente decorativo (regla 15 del repo): SON las barras. */}
          <div
            aria-hidden
            className="h-8 text-card-foreground"
            style={{
              width: `${Math.min(width, 24)}ch`,
              backgroundImage:
                'repeating-linear-gradient(90deg, currentColor 0 2px, transparent 2px 4px, currentColor 4px 5px, transparent 5px 8px)',
            }}
          />
        </div>
      )

    case 'feed':
      // Devuelve VARIOS nodos para UNA línea lógica, y es correcto: un `feed: 2` son dos
      // renglones. No lo colapses a un div de altura doble — el papel dejaría de contar
      // renglones como el aparato, y hay una prueba que lo fija.
      return Array.from({ length: line.lines }, (_, i) => <div key={i} data-line="feed" className="h-[1.45em]" />)

    case 'cut':
      return <div data-line="cut" className="mt-2 border-t border-dashed border-muted-foreground/50" />
  }
}
