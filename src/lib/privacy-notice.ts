/**
 * ¿El negocio tiene un aviso de privacidad REALMENTE publicado?
 *
 * 🔴 Vive en su propio módulo, sin efectos secundarios, a propósito. Estaba en
 * `services/marketing.service.ts` junto al tipo, y eso rompía a CustomerForm en cualquier
 * test que mockeara ese servicio: un `vi.mock` enumera exports, y el que no enumera queda
 * `undefined` — el error que sale (`No "X" export is defined on the mock`) no se parece en
 * nada a la causa y manda a depurar el componente. Aquí nadie necesita mockearlo: es una
 * función pura sobre un objeto que ya se tiene en la mano.
 *
 * 🔴 Y la razón por la que existe en vez de un `Boolean(notice)` en cada sitio: desde la
 * fase 1C-A el servidor responde SIEMPRE con un objeto `notice`. Cuando el negocio no tiene
 * versión guardada manda una PROPUESTA de precarga (`draftContent`, `esPlantilla: true`,
 * `content: null`) para que el editor no abra en blanco. `Boolean(notice)` pasó a ser
 * siempre verdadero, y con él se habilitó la casilla de consentimiento de marketing en
 * negocios SIN aviso publicado — justo lo que el servidor rechaza al guardar
 * (`consent.service.ts` exige una fila real de `PrivacyNoticeVersion`).
 *
 * Se comprueban las DOS cosas y no una: `content` cubre a un servidor que todavía no manda
 * `esPlantilla`, y `esPlantilla` cubre el día en que la plantilla llegue por `content`.
 */
export interface AvisoDePrivacidadParaCandado {
	content?: string | null
	esPlantilla?: boolean
}

export function tieneAvisoPublicado(notice: AvisoDePrivacidadParaCandado | null | undefined): boolean {
	return Boolean(notice?.content) && notice?.esPlantilla !== true
}
