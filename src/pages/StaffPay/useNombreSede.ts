import { useCallback, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'

/** Nombre legible de una sede: el de la sesión si el usuario la tiene; si no, el id (nunca vacío). */
export function useNombreSede() {
  const { allVenues } = useAuth()
  const nombres = useMemo(() => new Map((allVenues ?? []).map(v => [v.id, v.name])), [allVenues])
  return useCallback((id: string) => nombres.get(id) ?? id, [nombres])
}
