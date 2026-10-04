import { Ticket } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { SessionPasses } from '@/types/passes'

/**
 * Indicador de pases en la fila de inscritos del bloque de la clase en el calendario (spec §6): boleto + «2/3», compacto e
 * inquebrantable — en la vista SEMANA la columna mide ~119 px y «· Pases 2/3» partía la fila fuera del bloque (R2b-34).
 * El texto completo («Pases: 2 de 3») va en `title` y en el nombre accesible. Nada si la clase no se ofrece a pases o el
 * server es viejo.
 */
export function ClassSessionPassesLine({ passes }: { passes: SessionPasses | null | undefined }) {
  const { t } = useTranslation('reservations')
  if (!passes) return null
  const full = t('classSession.passes', { taken: passes.taken, cap: passes.cap })
  return (
    <span role="img" aria-label={full} title={full} className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap">
      <Ticket className="h-3 w-3" aria-hidden="true" />
      {passes.taken}/{passes.cap}
    </span>
  )
}
