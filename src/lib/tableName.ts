type Translate = (key: string, options?: Record<string, unknown>) => string

/** Los idiomas del panel (`supportedLngs` de `src/i18n.ts`): el número se guardó en el de quien lo escribió. */
const IDIOMAS = ['es', 'en', 'fr']

/**
 * El número de una mesa SIN la palabra: «Mesa 1» → «1», «5» → «5». Es lo que va en `{{number}}` de toda frase o etiqueta
 * que ya dice «mesa» («La mesa {{numbers}} tiene una cuenta abierta», «Mesa {{number}}»).
 *
 * 🔴 D20 (5-nov, video del plano): el panel decía «Mesa Mesa 1». La demo sembraba las mesas como «Mesa 1…10» (hay negocios
 * reales que las guardan igual) y los textos le anteponían otra «Mesa». La palabra se busca en todos los idiomas: «Mesa 1»
 * con el panel en inglés no es «Table Mesa 1» (Codex r1). Las frases conservan su artículo: «La mesa 1 tiene…» (CI #295).
 */
export function tableNumber(t: Translate, number: string | number): string {
  const n = String(number).trim()
  const bajo = n.toLocaleLowerCase()
  for (const lng of IDIOMAS) {
    const palabra = t('common:tableWord', { lng }).toLocaleLowerCase()
    if (!palabra || !bajo.startsWith(palabra) || /\p{L}/u.test(n.charAt(palabra.length))) continue
    const resto = n.slice(palabra.length).replace(/^[\s#:.\-–]+/, '')
    if (resto) return resto
  }
  return n
}

/** La etiqueta suelta de una mesa: «Mesa 1», sea que se guardó «1» o «Mesa 1». */
export function tableName(t: Translate, number: string | number): string {
  return t('common:tableName', { number: tableNumber(t, number) })
}
