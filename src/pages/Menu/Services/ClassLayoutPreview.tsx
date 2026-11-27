import { useTranslation } from 'react-i18next'
import type { LayoutConfig } from './ClassLayoutEditor'

/**
 * Vista previa de sólo lectura del mapa de lugares: el mismo grid que el editor, con las casillas
 * apagadas como espacio vacío. Cabe en una tarjeta angosta (las casillas se encogen con el ancho).
 */
export function ClassLayoutPreview({ layout }: { layout: LayoutConfig }) {
  const { t } = useTranslation('menu')

  return (
    <div className="space-y-2 border-t border-input bg-muted/20 px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{t('layout.previewTitle', { defaultValue: 'Así lo verá tu clienta' })}</p>
      <div className="mx-auto w-full max-w-xs space-y-2">
        {layout.showInstructor && (
          <div className="rounded-md bg-primary/10 py-1 text-center text-[11px] font-medium text-primary">
            {t('layout.previewFront', { defaultValue: 'Frente · coach' })}
          </div>
        )}
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: layout.rows }).map((_, row) =>
            Array.from({ length: layout.cols }).map((_, col) => {
              const spot = layout.spots.find(s => s.row === row && s.col === col)
              if (spot && !spot.enabled) {
                return <div key={`${row}-${col}`} data-testid="hueco" aria-hidden className="aspect-square" />
              }
              return (
                <div
                  key={`${row}-${col}`}
                  data-testid="lugar"
                  className="flex aspect-square items-center justify-center rounded-md border border-input bg-background text-[10px] font-medium tabular-nums"
                >
                  {spot?.label}
                </div>
              )
            }),
          )}
        </div>
      </div>
    </div>
  )
}
