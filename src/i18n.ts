/* eslint-disable @typescript-eslint/no-unused-vars */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import testingEn from '@/locales/en/testing.json'
import testingEs from '@/locales/es/testing.json'
import testingFr from '@/locales/fr/testing.json'
import sidebarEn from '@/locales/en/sidebar.json'
import sidebarEs from '@/locales/es/sidebar.json'
import sidebarFr from '@/locales/fr/sidebar.json'
import paymentEn from '@/locales/en/payment.json'
import paymentEs from '@/locales/es/payment.json'
import paymentFr from '@/locales/fr/payment.json'
import menuEn from '@/locales/en/menu.json'
import menuEs from '@/locales/es/menu.json'
import menuFr from '@/locales/fr/menu.json'
import venueEn from '@/locales/en/venue.json'
import venueEs from '@/locales/es/venue.json'
import venueFr from '@/locales/fr/venue.json'
import inventoryEn from '@/locales/en/inventory.json'
import inventoryEs from '@/locales/es/inventory.json'
import settingsEn from '@/locales/en/settings.json'
import settingsEs from '@/locales/es/settings.json'
import commonEn from '@/locales/en/common.json'
import commonEs from '@/locales/es/common.json'
import commonFr from '@/locales/fr/common.json'
import superadminEn from '@/locales/en/superadmin.json'
import superadminEs from '@/locales/es/superadmin.json'
import superadminFr from '@/locales/fr/superadmin.json'
import onboardingEn from '@/locales/en/onboarding.json'
import onboardingEs from '@/locales/es/onboarding.json'
import onboardingFr from '@/locales/fr/onboarding.json'
import billingEn from '@/locales/en/billing.json'
import billingEs from '@/locales/es/billing.json'
import authEn from '@/locales/en/auth.json'
import authEs from '@/locales/es/auth.json'
import authFr from '@/locales/fr/auth.json'
import tpvEn from '@/locales/en/tpv.json'
import tpvEs from '@/locales/es/tpv.json'
import tpvFr from '@/locales/fr/tpv.json'
import notificationsEn from '@/locales/en/notifications.json'
import notificationsEs from '@/locales/es/notifications.json'
import notificationsFr from '@/locales/fr/notifications.json'
import kycEn from '@/locales/en/kyc.json'
import kycEs from '@/locales/es/kyc.json'
import kycFr from '@/locales/fr/kyc.json'
import inviteAcceptEn from '@/locales/en/inviteAccept.json'
import inviteAcceptEs from '@/locales/es/inviteAccept.json'
// Lightweight language detector (avoids external dependency)
const simpleDetector = {
  type: 'languageDetector' as const,
  detect() {
    try {
      const persisted = (typeof localStorage !== 'undefined' && localStorage.getItem('lang')) || ''
      if (persisted && (persisted.startsWith('en') || persisted.startsWith('es'))) return persisted.slice(0, 2)
    } catch (e) {
      // ignore storage read errors (e.g., privacy mode)
    }
    if (typeof navigator !== 'undefined') {
      const cand = (navigator.languages && navigator.languages[0]) || navigator.language || ''
      if (cand.startsWith('es')) return 'es'
      if (cand.startsWith('en')) return 'en'
    }
    return 'en'
  },
  init() {
    // no-op
  },
  cacheUserLanguage(lng: string) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem('lang', lng)
    } catch (e) {
      // ignore storage write errors (e.g., privacy mode)
    }
  },
}

// Load base translation namespace from locale JSON files
// Base namespace includes all general dashboard translations
const resources = {
  en: {
    translation: superadminEn as Record<string, unknown>,
  },
  es: {
    translation: superadminEs as Record<string, unknown>,
  },
  fr: {
    translation: superadminFr as Record<string, unknown>,
  },
}

i18n
  .use(simpleDetector)
  .use(initReactI18next)
  .init({
    resources,
    // Let language detector determine current language; default to English
    fallbackLng: 'en',
    supportedLngs: ['en', 'es', 'fr'],
    interpolation: {
      escapeValue: false,
    },
  })
;(
  [
    ['en', testingEn],
    ['es', testingEs],
    ['fr', testingFr],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'testing', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', sidebarEn],
    ['es', sidebarEs],
    ['fr', sidebarFr],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'sidebar', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', paymentEn],
    ['es', paymentEs],
    ['fr', paymentFr],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'payment', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', menuEn],
    ['es', menuEs],
    ['fr', menuFr],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'menu', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', venueEn],
    ['es', venueEs],
    ['fr', venueFr],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'venue', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', inventoryEn],
    ['es', inventoryEs],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'inventory', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', settingsEn],
    ['es', settingsEs],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'settings', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', commonEn],
    ['es', commonEs],
    ['fr', commonFr],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'common', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', onboardingEn],
    ['es', onboardingEs],
    ['fr', onboardingFr],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'onboarding', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', billingEn],
    ['es', billingEs],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'billing', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', authEn],
    ['es', authEs],
    ['fr', authFr],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'auth', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', tpvEn],
    ['es', tpvEs],
    ['fr', tpvFr],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'tpv', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', notificationsEn],
    ['es', notificationsEs],
    ['fr', notificationsFr],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'notifications', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', kycEn],
    ['es', kycEs],
    ['fr', kycFr],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'kyc', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', inviteAcceptEn],
    ['es', inviteAcceptEs],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'inviteAccept', bundle as Record<string, unknown>, true, true)
})

export default i18n
