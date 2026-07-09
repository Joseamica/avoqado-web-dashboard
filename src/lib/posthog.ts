// src/lib/posthog.ts
//
// Thin wrapper around posthog-js for product analytics + the onboarding funnel.
// Safe by design: every export no-ops if VITE_POSTHOG_KEY is unset (e.g. local
// dev without the key, or if PostHog ever needs to be disabled).
//
// Session replay is SCOPED to the onboarding wizard only — auto-start is disabled
// globally (disable_session_recording below) and turned on explicitly by SetupWizard
// via startSessionReplay(). So we learn where users get stuck in /setup WITHOUT
// recording every logged-in user's entire dashboard session. Analytics EVENTS
// (pageviews, autocapture, funnel) still fire app-wide — only replay is scoped.
// While recording, ALL inputs are masked so bank / KYC / identity values are never
// captured.
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
      // Session replay is scoped to onboarding — don't auto-start it for the whole
      // dashboard. SetupWizard calls startSessionReplay() to record just /setup.
      disable_session_recording: true,
      // Privacy: even in onboarding, never record input values (bank, RFC/CURP, KYC).
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

/**
 * Start session replay for the onboarding wizard. Global auto-start is disabled in
 * initPostHog, so this is the ONLY place replay turns on — call it when the user enters
 * /setup so we see where people drop off, without recording the whole dashboard.
 */
export function startSessionReplay(): void {
  if (!initialized) return
  try {
    posthog.startSessionRecording()
  } catch {
    /* noop */
  }
}

/** Stop the onboarding session replay when the user leaves the wizard. */
export function stopSessionReplay(): void {
  if (!initialized) return
  try {
    posthog.stopSessionRecording()
  } catch {
    /* noop */
  }
}
