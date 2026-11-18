import { useEffect, useState } from 'react'
import { getPublicBasicPlan, type PublicBasicPlan } from '@/services/hybridBilling.service'

/**
 * El Plan Básico a la venta. `loaded` sólo es true cuando ya hay respuesta (o falló): quien decide algo con el
 * slug espera a eso. Un error NUNCA bloquea el alta: se lee como «no hay Básico».
 */
export function usePublicBasicPlan(enabled = true): { plan: PublicBasicPlan | null; loaded: boolean } {
  const [state, setState] = useState<{ plan: PublicBasicPlan | null; loaded: boolean }>({ plan: null, loaded: false })
  useEffect(() => {
    if (!enabled) return
    const ctrl = new AbortController()
    getPublicBasicPlan(ctrl.signal)
      .then(plan => !ctrl.signal.aborted && setState({ plan: plan ?? null, loaded: true }))
      .catch(() => !ctrl.signal.aborted && setState({ plan: null, loaded: true }))
    return () => ctrl.abort()
  }, [enabled])
  return state
}
