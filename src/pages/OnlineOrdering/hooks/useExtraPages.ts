import { useCallback, useEffect, useRef, useState } from 'react'

export interface ExtraPage<T> {
  items: T[]
  next: string | null
}

/**
 * «Cargar más» con páginas que no se quedan viejas. La dueña pide páginas extra con el cursor que dejó la página 1; en CADA
 * sondeo (`pollToken` cambia) se RELEEN en orden esas mismas páginas, con los cursores nuevos y sin pasar de las que ella cargó
 * (acotado a lo que pidió). Así un folio que cambió en otro aparato, aunque los conteos y la página 1 queden igual, se actualiza
 * o sale en el siguiente sondeo. La página 1 la sigue trayendo quien llama; aquí sólo viven las extra.
 */
export function useExtraPages<T>(
  firstCursor: string | null,
  pollToken: number,
  fetchPage: (cursor: string) => Promise<ExtraPage<T>>,
  onError: () => void,
) {
  const [st, setSt] = useState<{ items: T[]; next: string | null; pages: number }>({ items: [], next: null, pages: 0 })
  const [loading, setLoading] = useState(false)
  const gen = useRef(0)
  const pages = useRef(0)
  const first = useRef(firstCursor)
  first.current = firstCursor
  const fetchRef = useRef(fetchPage)
  fetchRef.current = fetchPage
  pages.current = st.pages

  useEffect(() => {
    const want = pages.current
    if (!want) return
    const mine = ++gen.current
    void (async () => {
      const items: T[] = []
      let cursor = first.current
      let n = 0
      while (cursor && n < want) {
        const p = await fetchRef.current(cursor)
        if (gen.current !== mine) return
        items.push(...p.items)
        cursor = p.next
        n++
      }
      setSt({ items, next: cursor, pages: n })
    })().catch(() => {
      // Una relectura fallida deja lo que ya se veía; el siguiente sondeo lo vuelve a intentar.
    })
  }, [pollToken])

  const next = st.pages > 0 ? st.next : firstCursor
  const loadMore = useCallback(async () => {
    if (!next || loading) return
    const mine = ++gen.current
    setLoading(true)
    try {
      const p = await fetchRef.current(next)
      if (gen.current !== mine) return // una relectura se adelantó: esta página ya es vieja, que vuelva a tocar
      setSt(s => ({ items: [...s.items, ...p.items], next: p.next, pages: s.pages + 1 }))
    } catch {
      onError()
    } finally {
      setLoading(false)
    }
  }, [next, loading, onError])

  return { items: st.items, next, loading, loadMore }
}
