import { describe, expect, it } from 'vitest'
import { getUnauthorizedLoginRedirectUrl } from '@/api'

describe('getUnauthorizedLoginRedirectUrl', () => {
  it('returns null for login route', () => {
    const url = getUnauthorizedLoginRedirectUrl({
      pathname: '/login',
      search: '',
      hash: '',
    })

    expect(url).toBeNull()
  })

  it('returns null for google callback route', () => {
    const url = getUnauthorizedLoginRedirectUrl({
      pathname: '/auth/google/callback',
      search: '?code=abc',
      hash: '',
    })

    expect(url).toBeNull()
  })

  it('preserves full deep-link context in returnTo', () => {
    const url = getUnauthorizedLoginRedirectUrl({
      pathname: '/venues/authctx-orga-centro/home',
      search: '?tab=metrics',
      hash: '#chart',
    })

    expect(url).toBe('/login?returnTo=%2Fvenues%2Fauthctx-orga-centro%2Fhome%3Ftab%3Dmetrics%23chart')
  })
})
