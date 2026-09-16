/**
 * Guardia estática: el Home NO puede volver a tener el chatbot legacy.
 *
 * `chatbot:openWithMessage` era la señal que el input del Home mandaba a la
 * burbuja del asistente; esa burbuja está apagada desde el 18-jun-2026
 * (`e8221a35`), así que el control quedó muerto: el cliente escribía, daba
 * Enter y no pasaba nada. La entrada del Home es ahora `McpConnectCard`, que
 * abre la guía para conectar Claude / Codex. Leer el archivo evita montar la
 * página entera (decenas de queries) sólo para comprobar un cableado.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const home = readFileSync(resolve(__dirname, '../Home.tsx'), 'utf8')

describe('Home: la tarjeta del chatbot legacy quedó sustituida', () => {
  it('ya no manda la señal chatbot:openWithMessage a una burbuja apagada', () => {
    expect(home).not.toContain('chatbot:openWithMessage')
  })

  it('renderiza McpConnectCard en su lugar', () => {
    expect(home).toMatch(/<McpConnectCard\b/)
  })
})
