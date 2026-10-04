import { useEffect, useMemo, useState } from 'react'
import { useStaffPayPeriods } from '@/hooks/useStaffPay'
import type { SimulacionVigenciaDto } from '@/types/staffPay'
import { MESES_VIGENCIA, sumarMeses } from './rangos'

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/

const diaSiguiente = (d: string) => {
  const x = new Date(`${d}T12:00:00Z`)
  x.setUTCDate(x.getUTCDate() + 1)
  return x.toISOString().slice(0, 10)
}

type ErrorApi = {
  response?: { data?: { code?: string; message?: string; details?: { primeraFechaPermitida?: string; desde?: string; hasta?: string } } }
}
/**
 * Los 400 de una fecha que no vale: dentro de un periodo cerrado (la primera fecha que sí vale) o fuera del rango del
 * contrato (FECHA_FUERA_DE_RANGO: la orilla más cercana). Su mensaje, en español, viene del server.
 */
const fechaQueNoVale = (err: unknown, fecha: string) => {
  const data = (err as ErrorApi | null)?.response?.data
  if (data?.code === 'FECHA_EN_PERIODO_CERRADO') {
    const primera = data.details?.primeraFechaPermitida ?? null
    return { message: data.message ?? '', atajo: primera, minimo: primera }
  }
  if (data?.code === 'FECHA_FUERA_DE_RANGO') {
    const { desde, hasta } = data.details ?? {}
    return { message: data.message ?? '', atajo: (desde && fecha < desde ? desde : hasta) ?? desde ?? null, minimo: null }
  }
  return null
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
  const [cerrada, setCerrada] = useState<{ fecha: string; message: string; atajo: string | null } | null>(null)
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
  // El rango del contrato (hoy ± 24 meses): antes «1900» dejaba «Guardar» encendido y decía «1515 meses abiertos» (A11).
  const rangoDesde = sumarMeses(hoy, -MESES_VIGENCIA)
  const rangoHasta = sumarMeses(hoy, MESES_VIGENCIA)
  const fueraDeRango = fechaValida && (fecha < rangoDesde || fecha > rangoHasta)
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
    // Fuera del rango ni se simula: el server diría lo mismo con un 400.
    if (!fechaValida || fueraDeRango) {
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
        const c = fechaQueNoVale(err, fecha)
        if (c) {
          setCerrada({ fecha, message: c.message, atajo: c.atajo })
          if (c.minimo) setMinimoDelServer(c.minimo)
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
  const minimoDeCierres = minimoDelServer ?? minimoDeLista
  const minimo = minimoDeCierres && minimoDeCierres > rangoDesde ? minimoDeCierres : rangoDesde
  return {
    fecha,
    setFecha,
    efecto,
    calculando,
    /** El mensaje del server (400) para ESTA fecha. */
    error,
    /** La fecha cae en un periodo cerrado de la lista en caché (se explica igual que el 400). */
    cerradoDeLista,
    /** Fuera de hoy ± 24 meses: `{ desde, hasta }` para explicarlo. */
    fueraDeRango: fueraDeRango ? { desde: rangoDesde, hasta: rangoHasta } : null,
    minimo,
    maximo: rangoHasta,
    /** A dónde lleva el atajo «Usar el …»: la fecha válida más cercana. */
    atajo:
      (error ? cerrada?.atajo : null) ??
      (fueraDeRango ? (fecha < rangoDesde ? rangoDesde : rangoHasta) : null) ??
      cerradoDeLista?.primera ??
      null,
    /** De la lista en caché; si no está, la decide el primer periodo de la simulación. */
    periodicidad: periodos?.periodicidad ?? null,
    /** Fecha inválida o dentro de un periodo cerrado (según el server o la lista): no se confirma. */
    bloqueada: !fechaValida || !!error || !!cerradoDeLista || fueraDeRango,
    /** Un 400 de fecha que no vale AL GUARDAR también se muestra en línea; devuelve true si lo era. */
    tomarError: (err: unknown) => {
      const c = fechaQueNoVale(err, fecha)
      if (!c) return false
      setCerrada({ fecha, message: c.message, atajo: c.atajo })
      if (c.minimo) setMinimoDelServer(c.minimo)
      return true
    },
  }
}
