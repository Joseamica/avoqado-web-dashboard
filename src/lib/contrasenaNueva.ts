import { z } from 'zod'
import type { TFunction } from 'i18next'

/**
 * Regla de contraseña para CUENTAS NUEVAS (alta, invitación, restablecer, cambiar): de 8 a 128 caracteres y que no
 * sea una de las más comunes. SIN exigir mayúsculas, números ni símbolos. Es la misma regla que aplica el SERVIDOR.
 * Una cuenta que ya existe NO pasa por aquí (su contraseña vieja se compara sin reglas de formato).
 */
export const CONTRASENA_MIN = 8
export const CONTRASENA_MAX = 128

/**
 * 🔴 COPIA de la lista del SERVIDOR: `avoqado-server/src/utils/contrasenaNueva.ts` (`CONTRASENAS_COMUNES`).
 * Si cambias una, cambia la otra. Siempre en minúsculas; se compara sin importar mayúsculas.
 */
export const CONTRASENAS_COMUNES: readonly string[] = [
  '12345678',
  '123456789',
  '1234567890',
  '12345678910',
  '87654321',
  '987654321',
  '9876543210',
  '11111111',
  '111111111',
  '1111111111',
  '22222222',
  '00000000',
  '000000000',
  '0000000000',
  '12341234',
  '12121212',
  '123123123',
  '11223344',
  '1q2w3e4r',
  '1qaz2wsx',
  'abcd1234',
  'abc12345',
  'qwerty123',
  'qwertyui',
  'qwertyuiop',
  'asdfghjk',
  'asdfghjkl',
  'zxcvbnm1',
  'password',
  'password1',
  'password12',
  'password123',
  'passw0rd',
  'p@ssw0rd',
  'contraseña',
  'contraseña1',
  'contraseña123',
  'contrasena',
  'contrasena1',
  'contrasena123',
  'iloveyou',
  'welcome1',
  'welcome123',
  'admin123',
  'admin1234',
  'administrador',
  'avoqado1',
  'avoqado123',
  'avoqado1234',
  'avoqado2026',
  'mexico123',
  'teamo123',
]

const COMUNES = new Set(CONTRASENAS_COMUNES)

export const esContrasenaComun = (p: string): boolean => COMUNES.has(p.toLowerCase())

/** Esquema de Zod de la contraseña nueva (mensajes por `t()`, llaves `auth:contrasenaNueva.*`). */
export const contrasenaNuevaZod = (t: TFunction) =>
  z
    .string({ required_error: t('auth:contrasenaNueva.requerida') })
    .min(CONTRASENA_MIN, t('auth:contrasenaNueva.min', { min: CONTRASENA_MIN }))
    .max(CONTRASENA_MAX, t('auth:contrasenaNueva.max', { max: CONTRASENA_MAX }))
    .refine(p => !esContrasenaComun(p), t('auth:contrasenaNueva.comun'))
