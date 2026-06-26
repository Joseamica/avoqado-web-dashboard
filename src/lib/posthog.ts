// src/lib/posthog.ts
//
// Thin wrapper around posthog-js for product analytics + the onboarding funnel.
// Safe by design: every export no-ops if VITE_POSTHOG_KEY is unset (e.g. local
// dev without the key, or if PostHog ever needs to be disabled). Session replay
// masks ALL inputs so bank / KYC / identity values are never recorded.
//
// Set in the deploy env (Cloudflare/CI) and .env.local for local:
//   VITE_POSTHOG_KEY=phc_xxx
//   VITE_POSTHOG_HOST=https://us.i.posthog.com   (optional, defaults to US)
import posthog from 'posthog-js'
import type { User } from '@/types'

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://us.i.posthog.com'

let initialized = false

export function initPostHog(): void {
  if (initialized || !KEY || typeof window === 'undefined') return
  try {
    posthog.init(KEY, {
      api_host: HOST,
      person_profiles: 'identified_only',
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: true,
      // Share the anonymous distinct_id across *.avoqado.io subdomains so a visitor's
      // marketing-site session (avoqado.io) stitches to their dashboard session here.
      cross_subdomain_cookie: true,
      // Privacy: never record input values (bank account, RFC/CURP, KYC, etc.).
      session_recording: { maskAllInputs: true },
    })
    initialized = true
  } catch (e) {
    // Never let analytics break the app.
    console.error('[posthog] init failed', e)
  }
}

/** Fire a product/funnel event. No-op until PostHog is initialized. */
export function track(event: string, props?: Record<string, unknown>): void {
  if (!initialized) return
  try {
    posthog.capture(event, props)
  } catch {
    /* noop */
  }
}

type IdentifiableUser = Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'organizationId' | 'role'>

/** Tie subsequent events to the logged-in person (so you see WHO got stuck). */
export function identifyUser(user: IdentifiableUser): void {
  if (!initialized) return
  try {
    posthog.identify(user.id, {
      email: user.email,
      name: [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || undefined,
      organization_id: user.organizationId,
      role: user.role,
    })
  } catch {
    /* noop */
  }
}

/** Clear identity on logout so the next user isn't merged into the previous one. */
export function resetUser(): void {
  if (!initialized) return
  try {
    posthog.reset()
  } catch {
    /* noop */
  }
}
