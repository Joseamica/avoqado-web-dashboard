type Translate = (key: string, options?: Record<string, unknown>) => string

/** Los idiomas del panel (`supportedLngs` de `src/i18n.ts`): el número se guardó en el de quien lo escribió. */
const IDIOMAS = ['es', 'en', 'fr']

/**
 * Nombre de una mesa para mostrar: «Mesa 1» cuando su número es «1», y el número tal cual cuando ya trae la palabra.
 *
 * 🔴 D20 (5-nov, video del plano): el panel decía «Mesa Mesa 1». La demo siembra las mesas como «Mesa 1…10», y un negocio
 * real en producción las guarda igual; los textos le anteponían otra «Mesa». Todo texto que nombra una mesa recibe este
 * nombre ya armado, nunca «Mesa {{number}}». La palabra se busca en todos los idiomas: «Mesa 1» con el panel en inglés
 * no es «Table Mesa 1» (Codex r1).
 */
export function tableName(t: Translate, number: string | number): string {
  const n = String(number).trim()
  const bajo = n.toLocaleLowerCase()
  const yaTraePalabra = IDIOMAS.some(lng => {
    const palabra = t('common:tableWord', { lng }).toLocaleLowerCase()
    return !!palabra && bajo.startsWith(palabra) && !/\p{L}/u.test(n.charAt(palabra.length))
  })
  return yaTraePalabra ? n : t('common:tableName', { number: n })
}
