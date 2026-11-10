import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TOPE_DE_PAGINA, usePaginacion } from '../ayudantes'

describe('usePaginacion', () => {
  it('arranca en 20 y respeta lo que se elige hasta el tope del servidor', () => {
    const { result } = renderHook(() => usePaginacion())
    expect(result.current[0]).toEqual({ pageIndex: 0, pageSize: 20 })
    act(() => result.current[1](p => ({ ...p, pageSize: 50 })))
    expect(result.current[0].pageSize).toBe(50)
  })
  it('si eligen 200 se queda en el tope (100): la tabla dice lo mismo que llega', () => {
    const { result } = renderHook(() => usePaginacion())
    act(() => result.current[1]({ pageIndex: 2, pageSize: 200 }))
    expect(result.current[0]).toEqual({ pageIndex: 2, pageSize: TOPE_DE_PAGINA })
  })
})
