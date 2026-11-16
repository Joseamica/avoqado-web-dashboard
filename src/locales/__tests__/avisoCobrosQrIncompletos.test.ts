/** D15: el aviso de «total incompleto» existe en los dos idiomas, con el texto que aprobó el founder en español. */
import { describe, expect, it } from 'vitest'
import es from '@/locales/es/common.json'
import en from '@/locales/en/common.json'

describe('aviso de cobros QR incompletos', () => {
  it('español: el texto de la promesa', () => {
    expect(es.loadFailure.legacyQr).toBe(
      'No pudimos leer todos los cobros del sistema anterior de QR. Este total puede estar incompleto: vuelve a intentar.',
    )
  })

  it('inglés: existe y dice lo mismo', () => {
    expect(en.loadFailure.legacyQr).toBe(
      "We couldn't read all the charges from the previous QR system. This total may be incomplete: please try again.",
    )
  })
})
