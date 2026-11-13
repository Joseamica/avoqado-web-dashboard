import { useCallback, useRef, useState } from 'react'

/**
 * D1 (founder 13-nov: «A, una ventana = un folio»): la llave (`idempotencyKey`) de un reembolso o de un pago manual del panel.
 *
 * - La llave NACE al abrir la ventana y se QUEDA mientras siga abierta. Todo lo que salga de esa ventana la lleva: el doble clic
 *   (que además frena `useCandado`), el reenvío automático tras un corte (D6 repite un POST con llave) y el «intentar otra vez» de
 *   la persona tras quedar en duda. Si el primero sí entró, el SERVIDOR devuelve el mismo y no registra otro; si cambió algún dato,
 *   contesta 409 `IDEMPOTENCY_KEY_REUSED` (`esFolioDeOtraOperacion`): ya se había registrado, no se duplica.
 * - Un éxito CONFIRMADO estrena llave (`estrenar`): lo siguiente en esa ventana es otra operación.
 * - Cerrar y volver a abrir la ventana estrena llave: cuenta como otra operación. Por eso el aviso de duda pide revisar antes.
 * - No se recuerda nada entre ventanas, pestañas ni recargas (era la opción B, que Codex tumbó tres veces).
 */

/** UUID v4: 36 caracteres de hex y guiones, dentro de lo que acepta el servidor (`^[A-Za-z0-9_-]{8,64}$`). */
export const llaveNueva = (): string => crypto.randomUUID()

/** La llave de la ventana: nace al abrirla y se queda mientras esté abierta; `estrenar()` la cambia tras un éxito confirmado. */
export function useLlaveDeLaVentana(abierta: boolean) {
  const [llave, setLlave] = useState(llaveNueva)
  const [abiertaAntes, setAbiertaAntes] = useState(abierta)
  // Ajuste durante el render (patrón de React para «estado que depende de una prop»): al reabrir, folio nuevo ANTES de pintar.
  if (abierta !== abiertaAntes) {
    setAbiertaAntes(abierta)
    if (abierta) setLlave(llaveNueva())
  }
  const estrenar = useCallback(() => setLlave(llaveNueva()), [])
  return { llave, estrenar }
}

/** Candado síncrono contra el doble clic del mismo instante: `isPending` de TanStack Query llega tarde. */
export function useCandado() {
  const ocupado = useRef(false)
  return useCallback(async <T,>(trabajo: () => Promise<T>): Promise<T | undefined> => {
    if (ocupado.current) return undefined
    ocupado.current = true
    try {
      return await trabajo()
    } finally {
      ocupado.current = false
    }
  }, [])
}

/** El servidor ya tiene esta llave con OTROS datos: lo primero (que quedó en duda) sí entró. No se duplica. */
export function esFolioDeOtraOperacion(error: unknown): boolean {
  const respuesta = (error as { response?: { status?: number; data?: { code?: unknown } } } | undefined)?.response
  return respuesta?.status === 409 && respuesta.data?.code === 'IDEMPOTENCY_KEY_REUSED'
}
