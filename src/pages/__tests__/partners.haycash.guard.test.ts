/**
 * Guardia estática: el enlace de HayCash vive en UN solo sitio.
 *
 * La atribución del socio viaja en la URL (`/onboarding/Avoqado`): si alguien
 * escribiera otra URL a mano en el Home o en Integraciones, la referencia dejaría
 * de contarse a Avoqado sin que nada falle. Leer los archivos evita montar las
 * páginas (decenas de queries) sólo para comprobar un cableado.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { HAYCASH_ONBOARDING_URL } from '@/config/partners'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')
const surfaces = {
  'Home.tsx': read('../Home.tsx'),
  'Venue/Edit/Integrations.tsx': read('../Venue/Edit/Integrations.tsx'),
}

describe('HayCash: socio comercial enlazado desde Home e Integraciones', () => {
  it('la URL conserva la atribución de Avoqado', () => {
    expect(HAYCASH_ONBOARDING_URL).toBe('https://haycash.com.mx/onboarding/Avoqado')
  })

  it.each(Object.entries(surfaces))('%s usa la constante compartida y no una URL a mano', (_name, source) => {
    expect(source).toContain('openPartner(HAYCASH_ONBOARDING_URL)')
    expect(source).not.toContain('haycash.com.mx')
  })
})
