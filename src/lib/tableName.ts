type Translate = (key: string, options?: Record<string, unknown>) => string

/**
 * Nombre de una mesa para mostrar: «Mesa 1» cuando su número es «1», y el número tal cual cuando ya trae la palabra.
 *
 * 🔴 D20 (5-nov, video del plano): el panel decía «Mesa Mesa 1». La demo siembra las mesas como «Mesa 1…10», y un negocio
 * real en producción las guarda igual; los textos le anteponían otra «Mesa». Todo texto que nombra una mesa recibe este
 * nombre ya armado, nunca «Mesa {{number}}».
 */
export function tableName(t: Translate, number: string | number): string {
  const n = String(number).trim()
  const word = t('common:tableWord')
  return n.toLocaleLowerCase().startsWith(word.toLocaleLowerCase()) ? n : t('common:tableName', { number: n })
}
