import { useCallback, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useCurrentVenue } from '@/hooks/use-current-venue'

/** Nombre legible de una sede: el de la sesión si el usuario la tiene; si no, el id (nunca vacío). */
export function useNombreSede() {
  const { allVenues } = useAuth()
  const nombres = useMemo(() => new Map((allVenues ?? []).map(v => [v.id, v.name])), [allVenues])
  return useCallback((id: string) => nombres.get(id) ?? id, [nombres])
}

/**
 * La ruta base de una sede por su id (`/venues/<slug>` o `/wl/venues/<slug>`, con el prefijo de la pantalla actual): un
 * enlace a una clase de OTRA sede lleva a esa sede, no a la del URL (Codex C4). Sin esa sede en la sesión, la actual.
 */
export function useRutaDeSede() {
  const { allVenues } = useAuth()
  const { venueBasePath, fullBasePath } = useCurrentVenue()
  const slugs = useMemo(() => new Map((allVenues ?? []).map(v => [v.id, v.slug])), [allVenues])
  return useCallback(
    (id: string) => {
      const slug = slugs.get(id)
      return slug ? `${venueBasePath}/${slug}` : fullBasePath
    },
    [slugs, venueBasePath, fullBasePath],
  )
}
