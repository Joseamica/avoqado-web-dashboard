import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useCausaDiferencia } from '../diferencias'
import type { FilaDiferenciaDto } from '@/types/staffPay'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: object) => (o ? `${k}:${JSON.stringify(o)}` : k) }) }))

const causa = (f: Partial<FilaDiferenciaDto>) => renderHook(() => useCausaDiferencia()).result.current({ conteo: 9, ...f })

describe('useCausaDiferencia', () => {
  it('cada causa del server tiene su línea; REINCLUIDA (no se pagaba al cerrar y ahora sí) es distinta de TARDIA', () => {
    expect(causa({ causa: 'REINCLUIDA' })).toBe('differences.cause.REINCLUIDA')
    expect(causa({ causa: 'TARDIA' })).toBe('differences.cause.TARDIA')
    expect(causa({ causa: 'CONTEO', conteoCongelado: 8 })).toBe('differences.cause.CONTEO:{"antes":8,"ahora":9}')
    expect(causa({ causa: 'CONTEO' })).toBe('differences.cause.CONTEO_SIN_ANTES')
    expect(causa({ causa: 'COACH_SALE', coachActualNombre: 'Ana' })).toBe('differences.cause.COACH_SALE:{"coach":"Ana"}')
  })
  it('sin causa, o con una que este dashboard no conoce, no pinta nada', () => {
    expect(causa({})).toBeNull()
    expect(causa({ causa: 'OTRA' as FilaDiferenciaDto['causa'] })).toBeNull()
  })
})
