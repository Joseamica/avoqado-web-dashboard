import { useTranslation } from 'react-i18next'
import type { SessionPasses } from '@/types/passes'

/**
 * «· Pases 2/3» al final de la fila de inscritos del bloque de la clase en el calendario (spec §6). Va en esa fila —que
 * ya se ve desde `height > 40`— y no en un renglón propio, que en la clase de 60 min salía cortado. Nada si la clase no
 * se ofrece a pases o el server es viejo.
 */
export function ClassSessionPassesLine({ passes }: { passes: SessionPasses | null | undefined }) {
  const { t } = useTranslation('reservations')
  if (!passes) return null
  return <span className="min-w-0 truncate">{t('classSession.passesShort', { taken: passes.taken, cap: passes.cap })}</span>
}
