import { esIdiomaEspanol } from '@/pages/GiftCards/giftCardText'
import type { IsrProvisionalResponse } from '@/services/fiscal/isr.service'
import { Currency } from '@/utils/currency'

type Traducir = (clave: string, opciones?: Record<string, unknown>) => string

/**
 * El aviso de tarjetas de regalo del ISR (ruling B4) en el idioma del panel. El server lo arma en español (`avisoDeTarjetas`,
 * `isr.service.ts`) y manda con él las dos cifras: en español se enseña tal cual; en otro idioma se arma aquí con las llaves
 * `isr.giftCardsNotice.*` de `reports` y las MISMAS reglas del server (un importe negativo se dice como devuelto y en positivo; el cero,
 * como «no incluye $0.00»; RESICO habla del periodo y el régimen general, del ejercicio). Sin las cifras (un server viejo) o sin aviso,
 * el texto del server: el server decide si hay aviso. `t` es el de `useTranslation('reports')`.
 */
export function avisoDeTarjetasDelIsr(
  d: Pick<IsrProvisionalResponse, 'regime' | 'avisoTarjetasDeRegalo' | 'tarjetasCobradasNoIncluidasCents' | 'pagadoConSaldoIncluidoCents'>,
  t: Traducir,
): string | undefined {
  const delServidor = d.avisoTarjetasDeRegalo
  const cobradas = d.tarjetasCobradasNoIncluidasCents
  const saldo = d.pagadoConSaldoIncluidoCents
  if (!delServidor || esIdiomaEspanol() || typeof cobradas !== 'number' || typeof saldo !== 'number') return delServidor
  const cuando = t(d.regime === 'RESICO' ? 'isr.giftCardsNotice.whenPeriod' : 'isr.giftCardsNotice.whenYear')
  const sold =
    cobradas < 0
      ? t('isr.giftCardsNotice.refundedNotDeducted', { amount: Currency(-cobradas, true), when: cuando })
      : t('isr.giftCardsNotice.soldNotIncluded', { amount: Currency(cobradas, true), when: cuando })
  const balance =
    saldo < 0
      ? t('isr.giftCardsNotice.balanceRefunded', { amount: Currency(-saldo, true) })
      : t('isr.giftCardsNotice.balanceIncluded', { amount: Currency(saldo, true) })
  return t('isr.giftCardsNotice.main', { sold, balance })
}
