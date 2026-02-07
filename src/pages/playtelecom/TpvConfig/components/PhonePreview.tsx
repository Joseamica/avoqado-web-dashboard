/**
 * PhonePreview - Live TPV preview matching the PAX A910S terminal form factor
 * White/silver body, dark NFC top piece, 5" touchscreen,
 * 3 Android nav buttons at bottom (recent, home, back)
 *
 * When attendanceTracking is ON, shows a second PAX with the login/PIN screen
 * and an overlay dialog prompting the user to check in first.
 */

import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Settings } from 'lucide-react'
import type { ModuleToggleState } from './ModuleToggles'
import type { ReactNode } from 'react'

interface PhonePreviewProps {
  modules: ModuleToggleState
  className?: string
}

/** Reusable PAX A910S frame wrapper */
function PaxFrame({ children }: { children: ReactNode }) {
  const w = 'w-[280px]'
  const screenH = '420px'

  return (
    <div className="relative">
      {/* Dark NFC top piece */}
      <div className={cn('bg-zinc-700 dark:bg-zinc-800 rounded-t-2xl pt-3 pb-2 flex justify-center border-x border-t border-zinc-500 dark:border-zinc-700', w)}>
        <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0" />
        </svg>
      </div>

      {/* White/silver body */}
      <div className={cn('bg-zinc-200 dark:bg-zinc-300 rounded-b-2xl pb-2.5 border-x border-b border-zinc-300 dark:border-zinc-400 shadow-2xl', w)}>
        {/* PAX + A910S labels */}
        <div className="flex items-center justify-between px-4 py-1">
          <span className="text-[8px] font-bold text-zinc-500 tracking-wide">PAX</span>
          <span className="text-[8px] font-semibold text-zinc-400">A910S</span>
        </div>

        {/* Screen */}
        <div className="mx-2.5 rounded-lg overflow-hidden border border-zinc-400/50 bg-card shadow-inner">
          <div className="w-full flex flex-col" style={{ height: screenH }}>
            {children}
          </div>
        </div>

        {/* Android nav buttons */}
        <div className="flex items-center justify-center gap-7 mt-2 px-6">
          <svg className="w-3.5 h-3.5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <rect x="5" y="5" width="14" height="14" rx="1" />
          </svg>
          <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <circle cx="12" cy="12" r="8" />
          </svg>
          <svg className="w-3.5 h-3.5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
          </svg>
        </div>
      </div>
    </div>
  )
}

/** Home screen content (main TPV screen) */
function HomeScreen({ modules, t }: { modules: ModuleToggleState; t: (key: string, opts?: any) => string }) {
  return (
    <>
      {/* App header */}
      <div className="bg-card border-b border-border/50 px-3 py-2.5 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold text-foreground">
            {t('tpvConfig.preview.hello', { defaultValue: 'Hola, Super Admin' })}
          </p>
          <p className="text-[9px] text-muted-foreground mt-0.5">
            playtelecom-centro
          </p>
        </div>
        <Settings className="w-3.5 h-3.5 text-muted-foreground" />
      </div>

      <div className="flex-1 p-2.5 overflow-y-auto space-y-2 bg-background">
        {/* Meta de Ventas */}
        <div className="bg-card p-2.5 rounded-lg border border-border/50">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <svg className="w-3 h-3 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-[9px] font-bold text-foreground uppercase">
                {t('tpvConfig.preview.salesGoal', { defaultValue: 'Meta de Ventas' })}
              </p>
            </div>
            <span className="text-[7px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-semibold">
              Diario
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden mb-1.5">
            <div className="h-full w-0 rounded-full bg-primary" />
          </div>
          <div className="flex items-center justify-between">
            <div className="text-center">
              <p className="text-[8px] text-muted-foreground">Vendido</p>
              <p className="text-[10px] font-bold text-foreground">$0</p>
            </div>
            <p className="text-xs font-bold text-muted-foreground">0%</p>
            <div className="text-center">
              <p className="text-[8px] text-muted-foreground">Meta</p>
              <p className="text-[10px] font-bold text-foreground">$500</p>
            </div>
          </div>
        </div>

        {/* Action cards */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-green-600 text-white p-2.5 rounded-lg flex flex-col items-center justify-center aspect-square">
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4h4V3H2v5h1V4zm17-1h-4v1h4v4h1V3h-1zM3 20v-4H2v5h5v-1H3zm18-4v4h-4v1h5v-5h-1z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h3v3H7V7zm7 0h3v3h-3V7zm-7 7h3v3H7v-3zm7 0h3v3h-3v-3zm-3.5-3.5h1v1h-1v-1z" />
            </svg>
            <p className="text-[10px] font-bold">
              {t('tpvConfig.preview.sell', { defaultValue: 'Vender' })}
            </p>
          </div>
          <div className="bg-blue-600 text-white p-2.5 rounded-lg flex flex-col items-center justify-center aspect-square">
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3h10l4 4v14a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6v5H9v-5zm0 2.5h6M12 13v5" />
            </svg>
            <p className="text-[10px] font-bold">
              {t('tpvConfig.preview.simActivation', { defaultValue: 'Alta de SIM' })}
            </p>
          </div>
          <div className="bg-card border border-border/50 p-2.5 rounded-lg flex flex-col items-center justify-center aspect-square">
            <svg className="w-6 h-6 mb-1 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-[10px] font-semibold text-muted-foreground">
              {t('tpvConfig.preview.support', { defaultValue: 'Soporte' })}
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

/** Login/PIN screen with check-in overlay dialog */
function LoginScreenWithCheckin({ t }: { t: (key: string, opts?: any) => string }) {
  return (
    <div className="relative flex-1 bg-background">
      {/* PIN screen background */}
      <div className="flex flex-col items-center pt-6 px-4">
        <p className="text-[13px] font-semibold text-foreground">
          {t('tpvConfig.preview.enterPin', { defaultValue: 'Ingresa tu PIN' })}
        </p>
        {/* PIN input */}
        <div className="mt-3 w-full h-8 rounded-lg border border-border bg-muted flex items-center px-3 justify-between">
          <div className="flex gap-1">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-foreground" />
            ))}
          </div>
          <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <p className="text-[8px] text-muted-foreground mt-1">0/10</p>

        {/* Numpad grid (simplified) */}
        <div className="grid grid-cols-3 gap-1.5 mt-3 w-full">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', ''].map((key, i) => (
            <div
              key={i}
              className={cn(
                'aspect-square rounded-full flex items-center justify-center text-[11px] font-medium',
                key ? 'bg-muted text-foreground' : 'bg-transparent',
              )}
            >
              {key === '' ? (
                <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75L14.25 12m0 0l2.25 2.25M14.25 12l2.25-2.25M14.25 12L12 14.25m-2.58 4.92l-6.375-6.375a1.125 1.125 0 010-1.59L9.42 4.83c.21-.211.497-.33.795-.33H19.5a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25h-9.284c-.298 0-.585-.119-.795-.33z" />
                </svg>
              ) : key}
            </div>
          ))}
        </div>
      </div>

      {/* Check-in dialog overlay */}
      <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-lg">
        <div className="bg-card rounded-xl p-4 mx-4 shadow-xl border border-border text-center max-w-[85%]">
          <div className="mx-auto w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center mb-2">
            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-[10px] font-bold text-foreground">
            {t('tpvConfig.preview.checkinRequired', { defaultValue: 'Debes registrar tu entrada' })}
          </p>
          <p className="text-[8px] text-muted-foreground mt-1">
            {t('tpvConfig.preview.checkinDesc', { defaultValue: 'Registra tu asistencia antes de usar la terminal' })}
          </p>
          <div className="mt-2.5 bg-primary text-primary-foreground rounded-md py-1.5 px-3">
            <p className="text-[9px] font-semibold">
              {t('tpvConfig.preview.clockIn', { defaultValue: 'Registrar Entrada' })}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Payment method selection screen — "Seleccionar Cuenta" */
function PaymentScreen({ modules, t }: { modules: ModuleToggleState; t: (key: string, opts?: any) => string }) {
  const methods: { key: string; label: string }[] = []
  if (modules.enableCardPayments) methods.push({ key: 'card', label: t('tpvConfig.preview.payCard', { defaultValue: 'Tarjeta' }) })
  if (modules.enableCashPayments) methods.push({ key: 'cash', label: t('tpvConfig.preview.payCash', { defaultValue: 'Efectivo' }) })

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header — dark bar */}
      <div className="bg-zinc-800 dark:bg-zinc-900 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          <div>
            <p className="text-[11px] font-semibold text-white">
              {t('tpvConfig.preview.selectAccount', { defaultValue: 'Seleccionar Cuenta' })}
            </p>
            <p className="text-[8px] text-zinc-400">
              {t('tpvConfig.preview.step2', { defaultValue: 'Paso 2 de 2 · Total: $100.00' })}
            </p>
          </div>
        </div>
      </div>

      {/* Amount display — centered */}
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="bg-card rounded-2xl px-8 py-6 border border-border/50">
          <p className="text-3xl font-light text-foreground tracking-tight">$100.00</p>
        </div>
      </div>

      {/* Payment method tabs at bottom */}
      <div className="px-3 pb-3">
        <p className="text-[8px] text-muted-foreground text-center mb-1.5">
          {t('tpvConfig.preview.paymentMethod', { defaultValue: 'Metodo de pago' })}
        </p>
        <div className="flex gap-1">
          {methods.map((m, i) => (
            <div
              key={m.key}
              className={cn(
                'flex-1 py-2 rounded-lg text-center text-[10px] font-semibold',
                i === 0
                  ? 'bg-card border border-border text-foreground shadow-sm'
                  : 'bg-transparent text-muted-foreground',
              )}
            >
              {m.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function PhonePreview({ modules, className }: PhonePreviewProps) {
  const { t } = useTranslation('playtelecom')

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest mb-6">
        {t('tpvConfig.preview.title', { defaultValue: 'Vista Previa en Vivo' })}
      </p>

      {/* Main PAX — Home screen */}
      <div className="flex flex-col items-center">
        <p className="text-[9px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
          {t('tpvConfig.preview.homeLabel', { defaultValue: 'Pantalla Principal' })}
        </p>
        <PaxFrame>
          <HomeScreen modules={modules} t={t} />
        </PaxFrame>
      </div>

      {/* Second PAX — Login screen with check-in dialog (only when attendance is ON) */}
      {modules.attendanceTracking && (
        <div className="flex flex-col items-center mt-8">
          <p className="text-[9px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
            {t('tpvConfig.preview.loginLabel', { defaultValue: 'Pantalla de Login' })}
          </p>
          <PaxFrame>
            <LoginScreenWithCheckin t={t} />
          </PaxFrame>
        </div>
      )}

      {/* Third PAX — Payment method selection (when card or cash payments are ON) */}
      {(modules.enableCardPayments || modules.enableCashPayments) && (
        <div className="flex flex-col items-center mt-8">
          <p className="text-[9px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
            {t('tpvConfig.preview.paymentLabel', { defaultValue: 'Pantalla de Pago' })}
          </p>
          <PaxFrame>
            <PaymentScreen modules={modules} t={t} />
          </PaxFrame>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground mt-4 text-center max-w-[220px]">
        {t('tpvConfig.preview.syncNote', { defaultValue: 'Los cambios se reflejaran en las TPVs activas al guardar.' })}
      </p>
    </div>
  )
}
