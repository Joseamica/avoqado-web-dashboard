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
 *
 * Nunca corren dos relecturas a la vez: si llega otro sondeo con una en vuelo, se anota y se corre UNA más al terminar. Cada página
 * releída se aplica al llegar (no todo o nada), así una relectura lenta no se descarta por los sondeos que llegaron mientras tanto.
 */
export function useExtraPages<T>(
  firstCursor: string | null,
  pollToken: number,
  fetchPage: (cursor: string) => Promise<ExtraPage<T>>,
  onError: () => void,
  idOf: (item: T) => string,
) {
  const [st, setSt] = useState<{ pages: T[][]; next: string | null }>({ pages: [], next: null })
  const [loading, setLoading] = useState(false)
  const pages = useRef(0)
  pages.current = st.pages.length
  const first = useRef(firstCursor)
  first.current = firstCursor
  const fetchRef = useRef(fetchPage)
  fetchRef.current = fetchPage
  const running = useRef(false)
  const again = useRef(false)

  useEffect(() => {
    if (!pages.current) return
    if (running.current) {
      again.current = true
      return
    }
    running.current = true
    void (async () => {
      try {
        do {
          again.current = false
          const want = pages.current
          let cursor = first.current
          for (let i = 0; cursor && i < want; i++) {
            const p = await fetchRef.current(cursor)
            const idx = i
            setSt(s => {
              const pg = p.next === null ? s.pages.slice(0, idx + 1) : [...s.pages]
              pg[idx] = p.items
              return { pages: pg, next: p.next === null || idx === s.pages.length - 1 ? p.next : s.next }
            })
            cursor = p.next
          }
        } while (again.current)
      } catch {
        // Una relectura fallida deja lo que ya se veía; el siguiente sondeo lo vuelve a intentar.
      } finally {
        running.current = false
      }
    })()
  }, [pollToken])

  const next = st.pages.length > 0 ? st.next : firstCursor
  const loadMore = useCallback(async () => {
    if (!next || loading) return
    setLoading(true)
    try {
      const p = await fetchRef.current(next)
      setSt(s => ({ pages: [...s.pages, p.items], next: p.next }))
    } catch {
      onError()
    } finally {
      setLoading(false)
    }
  }, [next, loading, onError])

  // Un folio que cambió de página entre lecturas puede venir en dos: sale una sola vez (mismo id ⇒ misma llave de React).
  const byId = new Map<string, T>()
  for (const item of st.pages.flat()) if (!byId.has(idOf(item))) byId.set(idOf(item), item)

  return { items: [...byId.values()], next, loading, loadMore }
}
