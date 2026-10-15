import { Info, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { CustomerDisplayFicha } from '@/services/customerDisplay.service'
import type { Momento } from './model'
import { TabletPreview, type TabletPreviewProps } from './TabletPreview'

export interface PreviewPaneProps {
  ficha: CustomerDisplayFicha
  momento: Momento
  momentos: Momento[]
  onMomento: (momento: Momento) => void
  nombreDelNegocio: string
  pasos: TabletPreviewProps['pasos']
  /** false = no se pudieron leer los pasos de este dispositivo: se usan los de siempre y se dice (Codex #4). */
  pasosConocidos: boolean
  cargando: boolean
  /** null = sin error; '' = falló sin texto del server. */
  error: string | null
}

export function PreviewPane({
  ficha,
  momento,
  momentos,
  onMomento,
  nombreDelNegocio,
  pasos,
  pasosConocidos,
  cargando,
  error,
}: PreviewPaneProps) {
  const { t } = useTranslation('customerDisplay')
  return (
    // `grid gap` y no `space-y`: la tablet es un <figure> con `m-0`, que anula el margen de `space-y` y pegaba los momentos a ella.
    <div className="grid gap-3" data-tour="customer-display-preview">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{t('preview.caption')}</span>
        <span className="inline-flex items-center gap-1" title={t('preview.approximateHelp')}>
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
          {t('preview.approximate')}
        </span>
      </div>
      <TabletPreview ficha={ficha} momento={momento} nombreDelNegocio={nombreDelNegocio} pasos={pasos} tamano="grande" />
      {!pasosConocidos && <p className="text-xs text-muted-foreground">{t('preview.stepsUnknown')}</p>}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('preview.momentsLabel')}>
        {momentos.map(m => (
          <button
            key={m}
            type="button"
            aria-pressed={momento === m}
            onClick={() => onMomento(m)}
            className={cn(
              'cursor-pointer rounded-full border px-3 py-1 text-sm',
              momento === m ? 'border-foreground font-medium text-foreground' : 'border-input text-muted-foreground hover:text-foreground',
            )}
            data-tour={`customer-display-preview-moment-${m}`}
          >
            {t(`preview.moments.${m}`)}
          </button>
        ))}
        {cargando && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" aria-live="polite">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            {t('preview.updating')}
          </span>
        )}
      </div>
      {error !== null && (
        <p role="alert" className="text-xs text-destructive">
          {error ? t('preview.error', { message: error }) : t('preview.errorGeneric')}
        </p>
      )}
    </div>
  )
}
