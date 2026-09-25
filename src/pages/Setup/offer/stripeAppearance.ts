/**
 * El formulario de tarjeta de Stripe vive en su PROPIO iframe: no hereda nuestro CSS, ni el tema
 * oscuro, ni la tipografía. Si no se le pasan los colores, pinta un bloque blanco en medio de una
 * pantalla oscura (así se veía el alta hasta el 25-sep).
 *
 * Este módulo traduce los tokens del dashboard (`--background`, `--input`, `--ring`…) al
 * `appearance` de Stripe y lo recalcula cuando cambia el tema. Los tokens están en OKLCH y Stripe
 * no entiende variables CSS, así que se resuelven a hex pintando un pixel en un canvas.
 */
import { useEffect, useMemo, useState } from 'react'
import type { Appearance, StripeElementsOptions } from '@stripe/stripe-js'

export interface PaletaDeTarjeta {
  fondo: string
  texto: string
  textoTenue: string
  borde: string
  anillo: string
  primario: string
  peligro: string
}

/** Respaldo por tema, por si el navegador no deja resolver los tokens (o en pruebas). */
export const PALETA_DE_RESPALDO: Record<'claro' | 'oscuro', PaletaDeTarjeta> = {
  claro: {
    fondo: '#fdfcfb',
    texto: '#1a1816',
    textoTenue: '#5f5b57',
    borde: '#e2dfdc',
    anillo: '#9a9591',
    primario: '#221f1c',
    peligro: '#e7000b',
  },
  oscuro: {
    fondo: '#0a0a0a',
    texto: '#fafafa',
    textoTenue: '#a1a1a1',
    borde: '#383838',
    anillo: '#737373',
    primario: '#e5e5e5',
    peligro: '#ff6467',
  },
}

/** La tipografía del dashboard (Geist), para que el iframe no caiga a la de Stripe. */
export const FUENTES_DE_TARJETA: StripeElementsOptions['fonts'] = [
  { cssSrc: 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap' },
]

function conAlfa(hex: string, alfa: number): string {
  const limpio = hex.replace('#', '')
  if (limpio.length !== 6) return hex
  const [r, g, b] = [0, 2, 4].map(i => parseInt(limpio.slice(i, i + 2), 16))
  return `rgba(${r}, ${g}, ${b}, ${alfa})`
}

/** PURA: paleta + tema ⇒ el `appearance` que recibe Stripe. */
export function aparienciaDeTarjeta(p: PaletaDeTarjeta, oscuro: boolean): Appearance {
  const suave = 'border-color 150ms cubic-bezier(0.25, 1, 0.5, 1), box-shadow 150ms cubic-bezier(0.25, 1, 0.5, 1)'
  return {
    theme: oscuro ? 'night' : 'stripe',
    labels: 'above',
    variables: {
      colorPrimary: p.primario,
      colorBackground: p.fondo,
      colorText: p.texto,
      colorTextSecondary: p.textoTenue,
      colorTextPlaceholder: p.textoTenue,
      colorIcon: p.textoTenue,
      colorDanger: p.peligro,
      fontFamily: 'Geist, Inter, system-ui, sans-serif',
      fontSizeBase: '15px',
      borderRadius: '10px',
      spacingUnit: '4px',
    },
    rules: {
      '.Label': { fontWeight: '500', color: p.texto, marginBottom: '6px' },
      '.Input': {
        backgroundColor: p.fondo,
        border: `1px solid ${p.borde}`,
        boxShadow: 'none',
        padding: '12px 14px',
        transition: suave,
      },
      '.Input:hover': { borderColor: p.anillo },
      '.Input:focus': { borderColor: p.anillo, boxShadow: `0 0 0 3px ${conAlfa(p.anillo, 0.25)}` },
      '.Input--invalid': { borderColor: p.peligro, boxShadow: `0 0 0 3px ${conAlfa(p.peligro, 0.18)}` },
      '.Tab': { backgroundColor: p.fondo, border: `1px solid ${p.borde}`, boxShadow: 'none', transition: suave },
      '.Tab:hover': { borderColor: p.anillo },
      '.Tab--selected': { borderColor: p.primario, boxShadow: `0 0 0 1px ${p.primario}` },
      '.Error': { color: p.peligro },
    },
  }
}

/** Resuelve un token CSS (OKLCH o lo que sea) a `#rrggbb` pintándolo en un pixel. `null` si no se puede. */
function resolverToken(variable: string): string | null {
  if (typeof document === 'undefined') return null
  const muestra = document.createElement('span')
  muestra.style.color = `var(${variable})`
  muestra.style.display = 'none'
  document.documentElement.appendChild(muestra)
  const color = getComputedStyle(muestra).color
  muestra.remove()
  if (!color) return null
  try {
    const lienzo = document.createElement('canvas')
    lienzo.width = lienzo.height = 1
    const ctx = lienzo.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.fillStyle = color
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
    if (a === 0) return null
    return `#${[r, g, b].map(n => n.toString(16).padStart(2, '0')).join('')}`
  } catch {
    return null
  }
}

function paletaDelDocumento(oscuro: boolean): PaletaDeTarjeta {
  const respaldo = PALETA_DE_RESPALDO[oscuro ? 'oscuro' : 'claro']
  return {
    fondo: resolverToken('--background') ?? respaldo.fondo,
    texto: resolverToken('--foreground') ?? respaldo.texto,
    textoTenue: resolverToken('--muted-foreground') ?? respaldo.textoTenue,
    borde: resolverToken('--input') ?? respaldo.borde,
    anillo: resolverToken('--ring') ?? respaldo.anillo,
    primario: resolverToken('--primary') ?? respaldo.primario,
    peligro: resolverToken('--destructive') ?? respaldo.peligro,
  }
}

const esOscuro = () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark')

/**
 * El `appearance` del tema ACTIVO. Lee la clase `dark` del `<html>` (la que pone el ThemeProvider),
 * no el contexto, para funcionar también donde el alta se monta sin proveedor. Se recalcula al cambiar.
 */
export function useAparienciaDeTarjeta(): Appearance {
  const [oscuro, setOscuro] = useState(esOscuro)

  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return
    const observador = new MutationObserver(() => setOscuro(esOscuro()))
    observador.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observador.disconnect()
  }, [])

  return useMemo(() => aparienciaDeTarjeta(paletaDelDocumento(oscuro), oscuro), [oscuro])
}
