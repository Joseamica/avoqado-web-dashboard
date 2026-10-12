import { useTranslation } from 'react-i18next'

export interface PuestoSugerido {
  name: string
  suggestedRole: string
}

/** Los puestos típicos del giro que todavía no existen. Un clic NO crea nada: sólo abre el diálogo ya llenado. */
export function SugeridosChips({ sugeridos, onElegir }: { sugeridos: PuestoSugerido[]; onElegir: (s: PuestoSugerido) => void }) {
  const { t } = useTranslation('rh')
  if (sugeridos.length === 0) return null
  return (
    <section className="space-y-2" data-tour="rh-positions-suggested">
      <p className="text-sm text-muted-foreground">{t('positions.suggestionsTitle')}</p>
      <div className="flex flex-wrap gap-2">
        {sugeridos.map(s => (
          <button
            key={s.name}
            type="button"
            className="min-h-11 cursor-pointer rounded-full border border-input px-4 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onElegir(s)}
          >
            {t('positions.add', { name: s.name })}
          </button>
        ))}
      </div>
    </section>
  )
}
