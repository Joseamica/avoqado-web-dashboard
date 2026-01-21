 
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
import inventoryFr from '@/locales/fr/inventory.json'
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
import billingFr from '@/locales/fr/billing.json'
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
import teamEn from '@/locales/en/team.json'
import teamEs from '@/locales/es/team.json'
import teamFr from '@/locales/fr/team.json'
import homeEn from '@/locales/en/home.json'
import homeEs from '@/locales/es/home.json'
import homeFr from '@/locales/fr/home.json'
import ordersEn from '@/locales/en/orders.json'
import ordersEs from '@/locales/es/orders.json'
import ordersFr from '@/locales/fr/orders.json'
import analyticsEn from '@/locales/en/analytics.json'
import analyticsEs from '@/locales/es/analytics.json'
import analyticsFr from '@/locales/fr/analytics.json'
import shiftsEn from '@/locales/en/shifts.json'
import shiftsEs from '@/locales/es/shifts.json'
import shiftsFr from '@/locales/fr/shifts.json'
import reviewsEn from '@/locales/en/reviews.json'
import reviewsEs from '@/locales/es/reviews.json'
import reviewsFr from '@/locales/fr/reviews.json'
import accountEn from '@/locales/en/account.json'
import accountEs from '@/locales/es/account.json'
import accountFr from '@/locales/fr/account.json'
import legalEn from '@/locales/en/legal.json'
import legalEs from '@/locales/es/legal.json'
import legalFr from '@/locales/fr/legal.json'
import venuesEn from '@/locales/en/venues.json'
import venuesEs from '@/locales/es/venues.json'
import venuesFr from '@/locales/fr/venues.json'
import availableBalanceEn from '@/locales/en/availableBalance.json'
import availableBalanceEs from '@/locales/es/availableBalance.json'
import availableBalanceFr from '@/locales/fr/availableBalance.json'
import settlementIncidentsEn from '@/locales/en/settlementIncidents.json'
import settlementIncidentsEs from '@/locales/es/settlementIncidents.json'
import settlementIncidentsFr from '@/locales/fr/settlementIncidents.json'
import cashCloseoutEn from '@/locales/en/cashCloseout.json'
import cashCloseoutEs from '@/locales/es/cashCloseout.json'
import creditOfferEn from '@/locales/en/creditOffer.json'
import creditOfferEs from '@/locales/es/creditOffer.json'
import googleIntegrationEn from '@/locales/en/googleIntegration.json'
import googleIntegrationEs from '@/locales/es/googleIntegration.json'
import googleIntegrationFr from '@/locales/fr/googleIntegration.json'
import menuImportEn from '@/locales/en/menuImport.json'
import menuImportEs from '@/locales/es/menuImport.json'
import menuImportFr from '@/locales/fr/menuImport.json'
import terminalsEn from '@/locales/en/terminals.json'
import terminalsEs from '@/locales/es/terminals.json'
import terminalsFr from '@/locales/fr/terminals.json'
import webhooksEn from '@/locales/en/webhooks.json'
import webhooksEs from '@/locales/es/webhooks.json'
import webhooksFr from '@/locales/fr/webhooks.json'
import ecommerceEn from '@/locales/en/ecommerce.json'
import ecommerceEs from '@/locales/es/ecommerce.json'
import ecommerceFr from '@/locales/fr/ecommerce.json'
import venuePricingEn from '@/locales/en/venuePricing.json'
import venuePricingEs from '@/locales/es/venuePricing.json'
import venuePricingFr from '@/locales/fr/venuePricing.json'
import customersEn from '@/locales/en/customers.json'
import customersEs from '@/locales/es/customers.json'
import customersFr from '@/locales/fr/customers.json'
import loyaltyEn from '@/locales/en/loyalty.json'
import loyaltyEs from '@/locales/es/loyalty.json'
import loyaltyFr from '@/locales/fr/loyalty.json'
import promotionsEn from '@/locales/en/promotions.json'
import promotionsEs from '@/locales/es/promotions.json'
import promotionsFr from '@/locales/fr/promotions.json'
import organizationEn from '@/locales/en/organization.json'
import organizationEs from '@/locales/es/organization.json'
import reportsEn from '@/locales/en/reports.json'
import reportsEs from '@/locales/es/reports.json'
import commissionsEn from '@/locales/en/commissions.json'
import commissionsEs from '@/locales/es/commissions.json'
import playtelecomEn from '@/locales/en/playtelecom.json'
import playtelecomEs from '@/locales/es/playtelecom.json'
import playtelecomFr from '@/locales/fr/playtelecom.json'
import suppliersEn from '@/locales/en/suppliers.json'
import suppliersEs from '@/locales/es/suppliers.json'
import purchaseOrdersEn from '@/locales/en/purchaseOrders.json'
import purchaseOrdersEs from '@/locales/es/purchaseOrders.json'
import purchaseOrdersFr from '@/locales/fr/purchaseOrders.json'
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
// Base namespace uses common.json for shared strings across all features
const resources = {
  en: {
    translation: commonEn as Record<string, unknown>,
  },
  es: {
    translation: commonEs as Record<string, unknown>,
  },
  fr: {
    translation: commonFr as Record<string, unknown>,
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
    ['fr', inventoryFr],
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
    ['en', superadminEn],
    ['es', superadminEs],
    ['fr', superadminFr],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'superadmin', bundle as Record<string, unknown>, true, true)
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
    ['fr', billingFr],
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
;(
  [
    ['en', teamEn],
    ['es', teamEs],
    ['fr', teamFr],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'team', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', homeEn],
    ['es', homeEs],
    ['fr', homeFr],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'home', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', ordersEn],
    ['es', ordersEs],
    ['fr', ordersFr],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'orders', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', analyticsEn],
    ['es', analyticsEs],
    ['fr', analyticsFr],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'analytics', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', shiftsEn],
    ['es', shiftsEs],
    ['fr', shiftsFr],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'shifts', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', reviewsEn],
    ['es', reviewsEs],
    ['fr', reviewsFr],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'reviews', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', accountEn],
    ['es', accountEs],
    ['fr', accountFr],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'account', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', legalEn],
    ['es', legalEs],
    ['fr', legalFr],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'legal', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', venuesEn],
    ['es', venuesEs],
    ['fr', venuesFr],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'venues', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', availableBalanceEn],
    ['es', availableBalanceEs],
    ['fr', availableBalanceFr],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'availableBalance', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', settlementIncidentsEn],
    ['es', settlementIncidentsEs],
    ['fr', settlementIncidentsFr],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'settlementIncidents', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', cashCloseoutEn],
    ['es', cashCloseoutEs],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'cashCloseout', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', creditOfferEn],
    ['es', creditOfferEs],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'creditOffer', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', googleIntegrationEn],
    ['es', googleIntegrationEs],
    ['fr', googleIntegrationFr],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'googleIntegration', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', menuImportEn],
    ['es', menuImportEs],
    ['fr', menuImportFr],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'menuImport', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', terminalsEn],
    ['es', terminalsEs],
    ['fr', terminalsFr],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'terminals', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', webhooksEn],
    ['es', webhooksEs],
    ['fr', webhooksFr],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'webhooks', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', ecommerceEn],
    ['es', ecommerceEs],
    ['fr', ecommerceFr],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'ecommerce', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', venuePricingEn],
    ['es', venuePricingEs],
    ['fr', venuePricingFr],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'venuePricing', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', customersEn],
    ['es', customersEs],
    ['fr', customersFr],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'customers', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', loyaltyEn],
    ['es', loyaltyEs],
    ['fr', loyaltyFr],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'loyalty', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', promotionsEn],
    ['es', promotionsEs],
    ['fr', promotionsFr],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'promotions', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', organizationEn],
    ['es', organizationEs],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'organization', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', reportsEn],
    ['es', reportsEs],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'reports', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', commissionsEn],
    ['es', commissionsEs],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'commissions', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', playtelecomEn],
    ['es', playtelecomEs],
    ['fr', playtelecomFr],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'playtelecom', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', suppliersEn],
    ['es', suppliersEs],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'suppliers', bundle as Record<string, unknown>, true, true)
})
;(
  [
    ['en', purchaseOrdersEn],
    ['es', purchaseOrdersEs],
    ['fr', purchaseOrdersFr],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'purchaseOrders', bundle as Record<string, unknown>, true, true)
})

export default i18n
