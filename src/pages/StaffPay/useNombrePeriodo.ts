import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { getIntlLocale } from '@/utils/i18n-locale'

/** Cómo la pantalla llama a un periodo: «septiembre de 2026» o, quincenal, «16–30 de septiembre de 2026». */
export function useNombrePeriodo() {
  const { t, i18n } = useTranslation('staffPay')
  const idioma = i18n?.language
  return useCallback(
    (p: { start: string; end: string }, periodicidad: 'MONTHLY' | 'SEMIMONTHLY') => {
      const mes = new Date(`${p.start}T12:00:00Z`).toLocaleDateString(getIntlLocale(idioma), { month: 'long', year: 'numeric', timeZone: 'UTC' })
      return periodicidad === 'SEMIMONTHLY' ? t('periods.semimonthLabel', { desde: Number(p.start.slice(8)), hasta: Number(p.end.slice(8)), mes }) : mes
    },
    [t, idioma],
  )
}

/**
 * La periodicidad de un periodo por sus fechas, para nombrarlo donde no se tiene la de la organización (la tarjeta de una
 * clase, el diálogo de liquidar): una quincena es 1–15 o 16–fin; un mes, 1–fin.
 */
export const periodicidadDe = (p: { start: string; end: string }): 'MONTHLY' | 'SEMIMONTHLY' =>
  p.start.endsWith('-01') && !p.end.endsWith('-15') ? 'MONTHLY' : 'SEMIMONTHLY'
