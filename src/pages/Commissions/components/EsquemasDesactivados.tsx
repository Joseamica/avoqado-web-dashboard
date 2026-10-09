import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useCommissionConfigs } from '@/hooks/useCommissions'
import { textoDeTasa } from '../tasaDelEsquema'
import DesactivarEsquema from './DesactivarEsquema'

/**
 * Los esquemas desactivados de la sede (ft-graves, B1). La lista principal sólo trae los que calculan; uno desactivado no desaparece
 * en silencio: se ve aquí, con su tasa, y se puede reactivar o abrir su ficha.
 */
export default function EsquemasDesactivados() {
  const { t, i18n } = useTranslation('commissions')
  const navigate = useNavigate()
  const { fullBasePath } = useCurrentVenue()
  const { data } = useCommissionConfigs(true)
  const desactivados = useMemo(() => (data ?? []).filter(c => !c.active), [data])

  if (desactivados.length === 0) return null
  return (
    <section className="space-y-2" data-tour="commission-inactive-configs">
      <div>
        <h3 className="text-sm font-medium">{t('config.inactiveSection', { count: desactivados.length })}</h3>
        <p className="text-xs text-muted-foreground">{t('config.inactiveSectionHint')}</p>
      </div>
      <ul className="divide-y divide-border rounded-xl border border-input">
        {desactivados.map(c => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
            <button
              type="button"
              className="min-w-0 flex-1 cursor-pointer text-left"
              onClick={() => navigate(`${fullBasePath}/commissions/config/${c.id}`)}
            >
              <p className="truncate text-sm font-medium">{c.name}</p>
              <p className="text-xs text-muted-foreground">
                {textoDeTasa(c.calcType, c.defaultRate, i18n.language)} · {t('config.inactive')}
              </p>
            </button>
            <DesactivarEsquema config={c} />
          </li>
        ))}
      </ul>
    </section>
  )
}
