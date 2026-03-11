import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

// Card brand icons — using inline SVG approach for brand-accurate colors

function VisaIcon() {
  return (
    <svg className="h-7 w-10" viewBox="0 0 40 28" fill="none">
      <rect width="40" height="28" rx="4" fill="#1A1F71" />
      <text x="20" y="18" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="700" fontFamily="sans-serif">VISA</text>
    </svg>
  )
}

function McIcon() {
  return (
    <svg className="h-7 w-10" viewBox="0 0 40 28" fill="none">
      <rect width="40" height="28" rx="4" className="fill-foreground/10" />
      <circle cx="16" cy="14" r="7" fill="#EB001B" />
      <circle cx="24" cy="14" r="7" fill="#F79E1B" opacity="0.85" />
    </svg>
  )
}

function AmexIcon() {
  return (
    <svg className="h-7 w-10" viewBox="0 0 40 28" fill="none">
      <rect width="40" height="28" rx="4" fill="#006FCF" />
      <text x="20" y="18" textAnchor="middle" fill="#FFFFFF" fontSize="8" fontWeight="700" fontFamily="sans-serif">AMEX</text>
    </svg>
  )
}

export default function PaymentLinkSettings() {
  const { t } = useTranslation('paymentLinks')

  const [dashboardNotifs, setDashboardNotifs] = useState(false)
  const [tpvNotifs, setTpvNotifs] = useState(true)
  const [customerNotes, setCustomerNotes] = useState(false)

  return (
    <div className="p-4 bg-background text-foreground">
      <div className="max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">{t('settings.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('settings.description')}</p>
        </div>

        <div className="space-y-10">
          {/* ── Payments ─────────────────────────────────── */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">{t('settings.payments')}</h2>

            <div className="flex items-center justify-between py-3">
              <span className="text-sm font-medium">{t('settings.creditCard')}</span>
              <div className="flex items-center gap-1.5">
                <VisaIcon />
                <McIcon />
                <AmexIcon />
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              {t('settings.creditCardHint')}
            </p>
          </section>

          <hr className="border-border" />

          {/* ── Email notifications ───────────────────────── */}
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">{t('settings.notifications')}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t('settings.notificationsHint')}
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm">{t('settings.dashboardNotifications')}</span>
                <Switch
                  checked={dashboardNotifs}
                  onCheckedChange={setDashboardNotifs}
                  className="cursor-pointer"
                />
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm">{t('settings.tpvNotifications')}</span>
                <Switch
                  checked={tpvNotifs}
                  onCheckedChange={setTpvNotifs}
                  className="cursor-pointer"
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {t('settings.editEmail')}{' '}
              <span className="underline font-medium text-foreground cursor-pointer">
                {t('settings.accountSettings')}
              </span>
            </p>
          </section>

          <hr className="border-border" />

          {/* ── Tips ──────────────────────────────────────── */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{t('settings.tips')}</h2>
              <Badge variant="outline" className="text-[10px] h-4 px-1.5">Muy pronto</Badge>
            </div>

            <div className="space-y-1 opacity-50">
              <button
                disabled
                className="w-full flex items-center justify-between py-3 text-left"
              >
                <div>
                  <span className="text-sm font-medium">{t('settings.tipsOptions')}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
              <hr className="border-border" />
              <button
                disabled
                className="w-full flex items-center justify-between py-3 text-left"
              >
                <div>
                  <span className="text-sm font-medium">{t('settings.tipsAmounts')}</span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    15%, 20%, 25%
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </section>

          <hr className="border-border" />

          {/* ── Customer info ─────────────────────────────── */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">{t('settings.customerInfo')}</h2>

            <div className="flex items-center justify-between py-2">
              <div>
                <span className="text-sm font-medium">{t('settings.customerNotes')}</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('settings.customerNotesHint')}
                </p>
              </div>
              <Switch
                checked={customerNotes}
                onCheckedChange={setCustomerNotes}
                className="cursor-pointer"
              />
            </div>
          </section>

          <hr className="border-border" />

          {/* ── Policies ──────────────────────────────────── */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{t('settings.policies')}</h2>
              <Badge variant="outline" className="text-[10px] h-4 px-1.5">Muy pronto</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('settings.policiesHint')}
            </p>
            <button
              disabled
              className="w-full rounded-xl border border-input bg-muted/50 py-3 text-sm font-medium text-muted-foreground opacity-50"
            >
              {t('settings.addPolicy')}
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}
