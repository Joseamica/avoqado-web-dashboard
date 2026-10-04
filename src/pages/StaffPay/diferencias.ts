import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { CausaDiferencia, FilaDiferenciaDto } from '@/types/staffPay'

type Fila = Pick<FilaDiferenciaDto, 'persona' | 'personaNombre' | 'congelado'>

/** Dentro de una clase: primero quien la tenía al cerrar (lo congelado ≠ 0), luego las demás por nombre (no por id). */
export const porPersona = (a: Fila, b: Fila) =>
  Number(Number(b.congelado) !== 0) - Number(Number(a.congelado) !== 0) ||
  (a.personaNombre ?? '').localeCompare(b.personaNombre ?? '', 'es') ||
  (a.persona ?? '').localeCompare(b.persona ?? '')

/** Por fecha de la clase; dentro de la misma clase, por persona (el server entrega por id de clase: así pagina rápido). */
export const porFechaYPersona = (a: FilaDiferenciaDto, b: FilaDiferenciaDto) =>
  Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.classSessionId.localeCompare(b.classSessionId) || porPersona(a, b)

const CAUSAS = new Set<CausaDiferencia>(['CONTEO', 'COACH_SALE', 'COACH_ENTRA', 'CANCELADA', 'EXCLUIDA', 'TARDIA', 'MONTO'])

/** Una línea corta con POR QUÉ existe la diferencia de esa persona; null si el server no lo dice (o es una causa nueva). */
export function useCausaDiferencia() {
  const { t } = useTranslation('staffPay')
  return useCallback(
    (f: Pick<FilaDiferenciaDto, 'causa' | 'conteo' | 'conteoCongelado' | 'coachActualNombre'>): string | null => {
      if (!f.causa || !CAUSAS.has(f.causa)) return null
      if (f.causa === 'CONTEO') {
        return f.conteoCongelado != null
          ? t('differences.cause.CONTEO', { antes: f.conteoCongelado, ahora: f.conteo })
          : t('differences.cause.CONTEO_SIN_ANTES')
      }
      if (f.causa === 'COACH_SALE') {
        return f.coachActualNombre
          ? t('differences.cause.COACH_SALE', { coach: f.coachActualNombre })
          : t('differences.cause.COACH_SALE_SIN_NOMBRE')
      }
      return t(`differences.cause.${f.causa}`)
    },
    [t],
  )
}
