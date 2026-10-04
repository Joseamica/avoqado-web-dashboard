import { useEffect, useMemo, useState } from 'react'
import { useStaffPayPeriods } from '@/hooks/useStaffPay'
import type { SimulacionVigenciaDto } from '@/types/staffPay'

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/

const diaSiguiente = (d: string) => {
  const x = new Date(`${d}T12:00:00Z`)
  x.setUTCDate(x.getUTCDate() + 1)
  return x.toISOString().slice(0, 10)
}

type ErrorApi = { response?: { data?: { code?: string; message?: string; details?: { primeraFechaPermitida?: string } } } }
/** El 400 de una vigencia dentro de un periodo cerrado: su mensaje (en español, del server) y la primera fecha que sí vale. */
const fechaCerrada = (err: unknown) => {
  const data = (err as ErrorApi | null)?.response?.data
  return data?.code === 'FECHA_EN_PERIODO_CERRADO'
    ? { message: data.message ?? '', primera: data.details?.primeraFechaPermitida ?? null }
    : null
}

/**
 * La vigencia de una tabla o de un nivel (spec §7.1): la fecha, su simulación («cambia el pago de…») y el límite de los
 * periodos cerrados. El mínimo sale de la lista de periodos del módulo si ya está en caché (sin pedir nada) o del 400
 * `FECHA_EN_PERIODO_CERRADO` en cuanto la simulación lo devuelve; con una fecha cerrada no se deja confirmar.
 */
export function useVigenciaSimulada(hoy: string, simular: (fecha: string) => Promise<SimulacionVigenciaDto>, clave: string) {
  const [fecha, setFecha] = useState(hoy)
  const [efecto, setEfecto] = useState<SimulacionVigenciaDto | null>(null)
  const [calculando, setCalculando] = useState(false)
  const [cerrada, setCerrada] = useState<{ fecha: string; message: string } | null>(null)
  const [minimoDelServer, setMinimoDelServer] = useState<string | null>(null)
  // Sólo lo que ya está en caché (enabled=false): sin petición nueva.
  const { data: periodos } = useStaffPayPeriods(false)
  const items = useMemo(() => periodos?.items ?? [], [periodos])
  // El server deja cerrar fuera de orden (septiembre abierto por excepciones mientras octubre se cierra): la lista sólo
  // impone un mínimo si NO hay un periodo abierto antes del último cerrado. El 400 del server sigue siendo la autoridad.
  const minimoDeLista = useMemo(() => {
    const finCerrado = items.filter(p => p.estado === 'CLOSED').reduce<string | null>((a, p) => (!a || p.end > a ? p.end : a), null)
    if (!finCerrado || items.some(p => p.estado === 'OPEN' && p.start < finCerrado)) return null
    return diaSiguiente(finCerrado)
  }, [items])
  const fechaValida = FECHA_ISO.test(fecha)
  // La fecha cae DENTRO de un periodo cerrado de la lista: no se confirma, y se dice desde cuándo sí (el día siguiente a
  // los cerrados seguidos, como el server).
  const cerradoDeLista = useMemo(() => {
    const cerrado = (d: string) => items.find(p => p.estado === 'CLOSED' && p.start <= d && d <= p.end)
    const p = fechaValida ? cerrado(fecha) : undefined
    if (!p) return null
    let primera = diaSiguiente(p.end)
    for (let siguiente = cerrado(primera); siguiente; siguiente = cerrado(primera)) primera = diaSiguiente(siguiente.end)
    return { start: p.start, end: p.end, primera }
  }, [items, fecha, fechaValida])

  useEffect(() => {
    if (!fechaValida) {
      setEfecto(null)
      return
    }
    let vivo = true
    setCalculando(true)
    simular(fecha)
      .then(r => {
        if (!vivo) return
        setEfecto(r)
        setCerrada(null)
      })
      .catch(err => {
        if (!vivo) return
        setEfecto(null)
        const c = fechaCerrada(err)
        if (c) {
          setCerrada({ fecha, message: c.message })
          if (c.primera) setMinimoDelServer(c.primera)
        }
      })
      .finally(() => {
        if (vivo) setCalculando(false)
      })
    return () => {
      vivo = false
    }
  }, [fecha, clave]) // eslint-disable-line react-hooks/exhaustive-deps

  const error = cerrada && cerrada.fecha === fecha ? cerrada.message : null
  const minimo = minimoDelServer ?? minimoDeLista
  return {
    fecha,
    setFecha,
    efecto,
    calculando,
    /** El mensaje del server (400) para ESTA fecha. */
    error,
    /** La fecha cae en un periodo cerrado de la lista en caché (se explica igual que el 400). */
    cerradoDeLista,
    minimo,
    /** A dónde lleva el atajo «Usar el …». */
    atajo: (error ? minimoDelServer : null) ?? cerradoDeLista?.primera ?? null,
    /** De la lista en caché; si no está, la decide el primer periodo de la simulación. */
    periodicidad: periodos?.periodicidad ?? null,
    /** Fecha inválida o dentro de un periodo cerrado (según el server o la lista): no se confirma. */
    bloqueada: !fechaValida || !!error || !!cerradoDeLista,
    /** Un 400 de fecha cerrada AL GUARDAR también se muestra en línea; devuelve true si lo era. */
    tomarError: (err: unknown) => {
      const c = fechaCerrada(err)
      if (!c) return false
      setCerrada({ fecha, message: c.message })
      if (c.primera) setMinimoDelServer(c.primera)
      return true
    },
  }
}
