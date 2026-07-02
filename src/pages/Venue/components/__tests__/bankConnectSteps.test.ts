import { describe, it, expect } from 'vitest'
import { stepForStatus } from '../bankConnectSteps'

describe('stepForStatus', () => {
  it('mapea cada status del backend al paso de UI correcto', () => {
    expect(stepForStatus('PENDING_TWO_FACTOR_AUTH')).toEqual({ step: 'code', variant: 'twoFactor' })
    expect(stepForStatus('PENDING_DEVICE_VALIDATION')).toEqual({ step: 'code', variant: 'device' })
    expect(stepForStatus('PENDING_ACCOUNT_SELECTION')).toEqual({ step: 'selectAccount' })
    expect(stepForStatus('CONNECTED')).toEqual({ step: 'done' })
  })
  it('estados no-wizard (NEEDS_REAUTH/REVOKED/ERROR) regresan a credenciales', () => {
    expect(stepForStatus('NEEDS_REAUTH')).toEqual({ step: 'credentials' })
    expect(stepForStatus('REVOKED')).toEqual({ step: 'credentials' })
    expect(stepForStatus('ERROR')).toEqual({ step: 'credentials' })
  })
})
