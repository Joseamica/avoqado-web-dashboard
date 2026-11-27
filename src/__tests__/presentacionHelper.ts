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

/** Un nodo está a la vista si ni él ni sus ancestros están `hidden`. */
export function visible(nodo: Element | null): boolean {
  for (let n: Element | null = nodo; n; n = n.parentElement) if ((n as HTMLElement).hidden) return false
  return !!nodo
}
