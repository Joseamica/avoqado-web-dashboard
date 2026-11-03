import type { ReactNode } from 'react'
import { AvisoDeCarga } from '@/components/AvisoDeCarga'
import { Skeleton } from '@/components/ui/skeleton'
import { falloDeCarga, type EstadoDeCarga } from '@/lib/falloDeCarga'

/**
 * Lo que sale de UNA consulta. Sin leerla su número no existe: aviso si falló o está en pausa, esqueleto mientras intenta. Un cero leído
 * sí se pinta, y con la recarga caída el dato viejo sigue junto a su aviso. No sirve para una consulta que puede estar apagada por permiso
 * o plan: sin fallo ni datos se quedaría en esqueleto.
 */
export function PorFuente({
  query,
  children,
  esqueleto = <Skeleton className="mt-1 h-9 w-32" />,
  conAviso = true,
}: {
  query: EstadoDeCarga & { data: unknown }
  children: ReactNode
  esqueleto?: ReactNode
  /** En false, otra parte de la pantalla ya avisa de esta misma consulta: dos avisos iguales sólo estorban. */
  conAviso?: boolean
}) {
  const hayDatos = query.data !== undefined
  return (
    <>
      {conAviso && <AvisoDeCarga query={query} hayDatos={hayDatos} />}
      {hayDatos ? children : !falloDeCarga(query) && esqueleto}
    </>
  )
}
