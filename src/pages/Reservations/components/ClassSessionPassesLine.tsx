import { useTranslation } from 'react-i18next'
import type { SessionPasses } from '@/types/passes'

/** «Pases: 2 de 3» en el bloque de la clase del calendario (spec §6). Nada si la clase no se ofrece a pases o el server es viejo. */
export function ClassSessionPassesLine({ passes }: { passes: SessionPasses | null | undefined }) {
  const { t } = useTranslation('reservations')
  if (!passes) return null
  return <div className="truncate text-[10px] opacity-80">{t('classSession.passes', { taken: passes.taken, cap: passes.cap })}</div>
}
