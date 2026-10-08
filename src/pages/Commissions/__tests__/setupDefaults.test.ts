import { describe, expect, it } from 'vitest'
import { initialState } from '../components/setup-panel/useSetupReducer'

describe('esquema nuevo de comisión', () => {
  it('nace «Sin IVA» (decisión D5 enmendada): nadie lo voltea sin decidirlo', () => {
    expect(initialState().calculationBase.includeTax).toBe(false)
  })
})
