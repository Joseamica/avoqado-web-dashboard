import { describe, expect, it } from 'vitest'
import es from '@/locales/es/organization.json'
import en from '@/locales/en/organization.json'
import { detailValueKey } from '../formatActivity'

type Bitacora = { activityLog: { detailValues: Record<string, Record<string, string>> } }

// D32 (hz:be99f328:D32): pausar referidos sin escribir razón guardaba «No reason provided» y la bitácora lo enseñaba en inglés.
// El panel sigue mandando ese mismo valor fijo (`ReferralsSettings.tsx`; así también se leen los asientos viejos), y cada quien
// lo lee en su idioma.
const SIN_RAZON_DE_PAUSA = 'No reason provided'

describe('bitácora: la pausa de referidos sin razón se lee en el idioma de quien la abre (D32)', () => {
  const razon = (bundle: unknown) => (bundle as Bitacora).activityLog.detailValues.reason?.[detailValueKey(SIN_RAZON_DE_PAUSA)]

  it('es: «Sin razón»', () => expect(razon(es)).toBe('Sin razón'))
  it('en: «No reason given»', () => expect(razon(en)).toBe('No reason given'))
})
