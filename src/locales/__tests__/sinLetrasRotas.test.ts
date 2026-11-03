/**
 * Un texto guardado dos veces con la codificación equivocada sale con letras rotas: «NÂ° Transacciones» en vez de «N° Transacciones».
 * Compila y pasa la revisión de llaves, así que sólo se detecta leyendo el archivo (hz:ce4800da:D1, 2-nov). El francés ya no se usa.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const LOCALES = path.resolve(__dirname, '..')
// Ã, Â, â u ð seguida de un carácter de los que produce leer UTF-8 como Windows-1252 (los bytes 0x80–0xBF).
const LETRA_ROTA =
  /[ÃÂâð][\u0080-¿ŒœŠšŸŽžƒˆ˜–—‘-‚“-„†-•…‰‹›€™]/

describe.each(['en', 'es'])('textos en %s', idioma => {
  const carpeta = path.join(LOCALES, idioma)
  const archivos = fs.readdirSync(carpeta).filter(archivo => archivo.endsWith('.json'))

  it('ningún archivo trae letras rotas', () => {
    expect(archivos.length).toBeGreaterThan(0)
    const rotas = archivos.flatMap(archivo =>
      fs
        .readFileSync(path.join(carpeta, archivo), 'utf8')
        .split('\n')
        .flatMap((linea, i) => (LETRA_ROTA.test(linea) ? [`${idioma}/${archivo}:${i + 1} ${linea.trim()}`] : [])),
    )
    expect(rotas).toEqual([])
  })
})
