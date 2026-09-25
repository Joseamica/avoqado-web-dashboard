import { afterEach, describe, expect, it, vi } from 'vitest'
import { trackPurchase, trackSignup } from '../gtag'

/**
 * El alta se mide para Google Y para ChatGPT Ads. El píxel de OpenAI (`window.oaiq`) lo carga
 * index.html; `trackSignup` es el embudo ÚNICO de las dos puertas del alta (correo y Google),
 * así que es el único sitio que lo llama.
 */
type Ventana = { oaiq?: unknown; gtag?: unknown }
const w = window as unknown as Ventana

afterEach(() => {
  delete w.oaiq
  delete w.gtag
})

describe('trackSignup — ChatGPT Ads', () => {
  it('manda registration_completed al píxel de ChatGPT Ads', () => {
    const oaiq = vi.fn()
    w.oaiq = oaiq
    trackSignup('google', 'pos-22-mx')
    expect(oaiq).toHaveBeenCalledTimes(1)
    expect(oaiq).toHaveBeenCalledWith('measure', 'registration_completed', { type: 'customer_action' })
  })

  it('sin el píxel (bloqueador de anuncios, local) no revienta', () => {
    expect(() => trackSignup('email')).not.toThrow()
  })

  it('si el píxel lanza, el alta sigue: medir nunca rompe la app', () => {
    w.oaiq = () => {
      throw new Error('sdk roto')
    }
    expect(() => trackSignup('email')).not.toThrow()
  })

  it('Google sigue recibiendo su sign_up (regresión)', () => {
    const gtag = vi.fn()
    w.gtag = gtag
    w.oaiq = vi.fn()
    trackSignup('email', 'pos-22-mx')
    expect(gtag).toHaveBeenCalledWith('event', 'sign_up', expect.objectContaining({ method: 'email', launch_offer_code: 'pos-22-mx' }))
  })

  it('el primer cobro NO se manda a ChatGPT (la «pieza B» es otra decisión)', () => {
    const oaiq = vi.fn()
    w.oaiq = oaiq
    trackPurchase(22, 'pos-22-mx')
    expect(oaiq).not.toHaveBeenCalled()
  })
})
