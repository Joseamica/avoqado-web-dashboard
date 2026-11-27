import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { JSDOM } from 'jsdom'

export type Respuesta = { status: number; body?: unknown } | 'red' | 'colgada'

/** Carga una página de public/presentacion en jsdom, corre sus scripts en línea y le da un `fetch` falso. */
export function cargarPagina(archivo: string, responder: (url: string) => Respuesta, search = '') {
  const llamadas: string[] = []
  const html = readFileSync(join(process.cwd(), 'public/presentacion', archivo), 'utf8').replace(/<script[^>]*\bsrc=[^>]*><\/script>/g, '')
  const dom = new JSDOM(html, {
    url: `http://localhost/${archivo}${search}`,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(window) {
      ;(window as any).fetch = (url: string) => {
        llamadas.push(String(url))
        const r = responder(String(url))
        if (r === 'red') return Promise.reject(new TypeError('network'))
        if (r === 'colgada') return new Promise(() => {})
        return Promise.resolve({ ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body })
      }
    },
  })
  return { dom, document: dom.window.document, llamadas }
}

export const espera = () => new Promise(r => setTimeout(r, 20))

/**
 * `display` efectivo de un nodo, como lo resolvería un navegador: una regla de la hoja de estilos de la página
 * (con !important manda; si no, la última que coincide) pisa el `[hidden]` del navegador, que es lo que se rompió con `.grid4{display:grid}`.
 * No usa getComputedStyle: jsdom truena con `border:… var(--x)` de la página.
 */
function displayEfectivo(n: Element): string {
  const inline = (n as HTMLElement).style?.display
  if (inline) return inline
  let valor = ''
  let importante = false
  for (const hoja of Array.from(n.ownerDocument.styleSheets)) {
    for (const regla of Array.from((hoja as CSSStyleSheet).cssRules) as CSSStyleRule[]) {
      if (!regla.selectorText || !regla.style?.display) continue
      let coincide = false
      try { coincide = n.matches(regla.selectorText) } catch { /* selector que jsdom no entiende */ }
      if (!coincide) continue
      const imp = regla.style.getPropertyPriority('display') === 'important'
      if (imp || !importante) { valor = regla.style.display; importante = imp }
    }
  }
  return valor || ((n as HTMLElement).hidden ? 'none' : 'block')
}

/** Un nodo está a la vista si ni él ni sus ancestros tienen `display:none` efectivo. */
export function visible(nodo: Element | null): boolean {
  if (!nodo) return false
  for (let n: Element | null = nodo; n; n = n.parentElement) if (displayEfectivo(n) === 'none') return false
  return true
}
