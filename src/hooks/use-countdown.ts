import { useEffect, useState } from 'react'

const pad = (n: number) => String(n).padStart(2, '0')

/** Milisegundos restantes → «m:ss» (o «h:mm:ss» a partir de una hora); vencido → «0:00». */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00'
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/**
 * Cuenta regresiva hasta un instante ISO (UTC). Es una DURACIÓN, así que no pasa por la zona del venue; la hora
 * absoluta («vence a las 13:25») sí la pinta quien la muestra, con useVenueDateTime.
 * ponytail: un intervalo por fila; con 50 filas son 50 timers de 1 s — si la lista crece, un solo reloj compartido.
 */
export function useCountdown(deadlineAt: string | null): { msLeft: number; expired: boolean; label: string } {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!deadlineAt) return
    const end = new Date(deadlineAt).getTime()
    setNow(Date.now())
    if (Date.now() >= end) return
    // Al llegar a cero el reloj se detiene: una fila vencida no se vuelve a pintar cada segundo.
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (t >= end) clearInterval(id)
    }, 1000)
    return () => clearInterval(id)
  }, [deadlineAt])
  const msLeft = deadlineAt ? Math.max(0, new Date(deadlineAt).getTime() - now) : 0
  return { msLeft, expired: msLeft <= 0, label: formatCountdown(msLeft) }
}
