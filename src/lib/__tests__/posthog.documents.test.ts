import { beforeEach, describe, expect, it, vi } from 'vitest'
const sdk = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  startSessionRecording: vi.fn(),
  stopSessionRecording: vi.fn(),
  set_config: vi.fn(),
}))
vi.mock('posthog-js', () => ({ default: sdk }))
beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_POSTHOG_KEY', 'test-key')
  history.replaceState({}, '', '/login')
})
describe('analytics guard for private document navigation', () => {
  it('does not initialize PostHog on a document route', async () => {
    history.replaceState({}, '', '/documentos/request#token=' + 'a'.repeat(64))
    const analytics = await import('../posthog')
    analytics.initPostHog()
    analytics.track('should-not-send')
    analytics.startSessionReplay()
    expect(sdk.init).not.toHaveBeenCalled()
    expect(sdk.capture).not.toHaveBeenCalled()
    expect(sdk.startSessionRecording).not.toHaveBeenCalled()
  })
  it('drops SDK pageviews/autocapture and wrapper events when navigating from an initialized app', async () => {
    const analytics = await import('../posthog')
    analytics.initPostHog()
    expect(sdk.init).toHaveBeenCalledOnce()
    const config = sdk.init.mock.calls[0][1]
    const event = { event: '$autocapture', properties: { $current_url: '/login' } }
    expect(config.before_send(event)).toBe(event)
    history.replaceState({}, '', '/documentos/request#token=' + 'a'.repeat(64))
    window.dispatchEvent(new Event('avoqado:private-documents'))
    expect(sdk.stopSessionRecording).toHaveBeenCalled()
    expect(sdk.set_config).toHaveBeenCalledWith({
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
    })
    analytics.track('should-not-send')
    analytics.startSessionReplay()
    expect(config.before_send(event)).toBeNull()
    expect(sdk.capture).not.toHaveBeenCalled()
    expect(sdk.startSessionRecording).not.toHaveBeenCalled()
  })
  it('does not emit Google or OpenAI Ads conversions on a document route', async () => {
    const gtag = vi.fn()
    const oaiq = vi.fn()
    Object.assign(window, { gtag, oaiq })
    history.replaceState({}, '', '/documentos/request')
    const analytics = await import('../gtag')
    analytics.trackSignup()
    analytics.trackPurchase(22)
    expect(gtag).not.toHaveBeenCalled()
    expect(oaiq).not.toHaveBeenCalled()
  })
})
