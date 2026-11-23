/**
 * D682 (Mindform, 22-nov): quien reserva desde book.avoqado.io queda con `lastName = null` y las Reservaciones y los
 * asistentes de la clase decían «Jose null». El nombre junta sólo las partes que existen.
 */
import { describe, expect, it } from 'vitest'

import { nombreCompleto } from '../nombreCompleto'

describe('nombreCompleto', () => {
  it('nombre y apellido', () => {
    expect(nombreCompleto({ firstName: 'Jose', lastName: 'Amieva' })).toBe('Jose Amieva')
  })

  it('sólo nombre: sin «null», «undefined» ni espacio de más', () => {
    expect(nombreCompleto({ firstName: 'Jose', lastName: null })).toBe('Jose')
    expect(nombreCompleto({ firstName: 'Jose', lastName: undefined })).toBe('Jose')
    expect(nombreCompleto({ firstName: 'Jose', lastName: '' })).toBe('Jose')
    expect(nombreCompleto({ firstName: 'Jose', lastName: '   ' })).toBe('Jose')
    expect(nombreCompleto({ firstName: 'Jose' })).toBe('Jose')
  })

  it('sólo apellido', () => {
    expect(nombreCompleto({ firstName: null, lastName: 'Amieva' })).toBe('Amieva')
  })

  it('recorta espacios de cada parte', () => {
    expect(nombreCompleto({ firstName: ' Jose ', lastName: ' Amieva ' })).toBe('Jose Amieva')
  })

  it('sin ninguna parte o sin persona: vacío, para que la pantalla use su respaldo con ||', () => {
    expect(nombreCompleto({ firstName: null, lastName: null })).toBe('')
    expect(nombreCompleto({ firstName: '', lastName: '' })).toBe('')
    expect(nombreCompleto(null)).toBe('')
    expect(nombreCompleto(undefined)).toBe('')
    expect(nombreCompleto(null) || 'Sin nombre').toBe('Sin nombre')
  })
})
