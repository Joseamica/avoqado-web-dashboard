import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy, CreditCard, KeyRound, Loader2, Settings2, Shield, Zap } from 'lucide-react'

import { TpvSettingsFields } from '@/components/tpv/TpvSettingsFields'
import { Button } from '@/components/ui/button'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { TERMINAL_BRAND_OPTIONS, type TerminalBrand } from '@/pages/Superadmin/components/TerminalDialog'
import { terminalAPI, TerminalStatus, TerminalType, type CreateTerminalRequest } from '@/services/superadmin-terminals.service'
import { DEFAULT_TPV_SETTINGS, type TpvSettings } from '@/services/tpv-settings.service'
import { useQueryClient } from '@tanstack/react-query'

interface SuperadminTerminalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

/** Modelos que se venden hoy (TerminalPurchaseWizard). «Otro» abre tipo/marca/modelo libres. */
const KNOWN_MODELS = [
  { id: 'nexgo-n86', brand: 'NEXGO', model: 'N86', label: 'NEXGO N86', processor: 'AngelPay' },
  { id: 'nexgo-n62', brand: 'NEXGO', model: 'N62', label: 'NEXGO N62', processor: 'AngelPay' },
  { id: 'pax-a910s', brand: 'PAX', model: 'A910S', label: 'PAX A910S', processor: 'Blumon' },
] as const

type ModelChoice = (typeof KNOWN_MODELS)[number]['id'] | 'other'
type ActivationMode = 'with-code' | 'activate-now'

const SERIAL_PREFIX = 'AVQD-'

/**
 * «Crear terminal» del superadmin dentro del venue (maqueta G, 8-oct-2026).
 *
 * 🔑 «Activar ya, sin código» antes sólo existía en la app avoqado-superadmin (NewTerminalPage). Aquí
 * hace lo mismo: crea sin código y luego PATCH `status: ACTIVE` a la ruta de superadmin, que es la que
 * sella `activatedAt` (terminals.superadmin.service.ts). Al encenderse, la TPV consulta
 * `activation-status`, ve la activación y entra sin pedir código. No se usa REMOTE_ACTIVATE: una TPV
 * nueva todavía no manda heartbeats y el comando no se entregaría.
 */
export const SuperadminTerminalDialog: React.FC<SuperadminTerminalDialogProps> = ({ open, onOpenChange, onSuccess }) => {
  const { t } = useTranslation('tpv')
  const { t: tCommon } = useTranslation('common')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { venueId, venue } = useCurrentVenue()
  const venueName = venue?.name || ''

  const [submitting, setSubmitting] = useState(false)
  const [modelChoice, setModelChoice] = useState<ModelChoice>('nexgo-n86')
  const [serialNumber, setSerialNumber] = useState('')
  const [name, setName] = useState('')
  const [otherType, setOtherType] = useState<TerminalType>(TerminalType.TPV_ANDROID)
  const [otherBrand, setOtherBrand] = useState<string>('PAX')
  const [otherModel, setOtherModel] = useState('')
  const [activationMode, setActivationMode] = useState<ActivationMode>('with-code')
  const [createdCode, setCreatedCode] = useState<{ code: string; terminalName: string } | null>(null)
  const [codeCopied, setCodeCopied] = useState(false)

  // Ajustes: por default hereda los de la organización. «Personalizar» abre los campos y sólo se
  // mandan las llaves que el superadmin TOCÓ, para no pisar lo que la organización ya configuró.
  const [customize, setCustomize] = useState(false)
  const [customSettings, setCustomSettings] = useState<TpvSettings>(DEFAULT_TPV_SETTINGS)
  const dirtyKeysRef = useRef<Set<keyof TpvSettings>>(new Set())

  const handleSettingsUpdate = useCallback((updates: Partial<TpvSettings>) => {
    Object.keys(updates).forEach(k => dirtyKeysRef.current.add(k as keyof TpvSettings))
    setCustomSettings(prev => ({ ...prev, ...updates }))
  }, [])

  useEffect(() => {
    if (!open) return
    setModelChoice('nexgo-n86')
    setSerialNumber('')
    setName('')
    setOtherType(TerminalType.TPV_ANDROID)
    setOtherBrand('PAX')
    setOtherModel('')
    setActivationMode('with-code')
    setCreatedCode(null)
    setCodeCopied(false)
    setCustomize(false)
    setCustomSettings(DEFAULT_TPV_SETTINGS)
    dirtyKeysRef.current = new Set()
  }, [open])

  const known = KNOWN_MODELS.find(m => m.id === modelChoice)
  const serialBody = serialNumber.trim().replace(/^AVQD-/i, '')
  const canSubmit = Boolean(venueId && serialBody && name.trim() && (known || otherModel.trim())) && !submitting

  const close = () => onOpenChange(false)

  const handleSubmit = async () => {
    if (!canSubmit || !venueId) return
    setSubmitting(true)
    try {
      const overrides =
        customize && dirtyKeysRef.current.size > 0
          ? (Object.fromEntries(Array.from(dirtyKeysRef.current).map(k => [k, customSettings[k]])) as Partial<TpvSettings>)
          : undefined

      const request: CreateTerminalRequest = {
        venueId,
        serialNumber: `${SERIAL_PREFIX}${serialBody}`,
        name: name.trim(),
        type: known ? TerminalType.TPV_ANDROID : otherType,
        brand: known ? known.brand : otherBrand,
        model: known ? known.model : otherModel.trim(),
        generateActivationCode: activationMode === 'with-code',
        ...(overrides ? { configOverrides: overrides } : {}),
      }

      const created = await terminalAPI.createTerminal(request)
      queryClient.invalidateQueries({ queryKey: ['tpvs'] })
      queryClient.invalidateQueries({ queryKey: ['terminals'] })
      onSuccess?.()

      if (activationMode === 'with-code') {
        if (created.activationCode) {
          // El código se queda a la vista hasta que lo copien: un toast que se va no basta.
          setCreatedCode({ code: created.activationCode.activationCode, terminalName: created.terminal.name })
          return
        }
        toast({ title: t('newTerminal.toast.created'), description: t('newTerminal.toast.createdNoCode') })
        close()
        return
      }

      try {
        await terminalAPI.updateTerminal(created.terminal.id, { status: TerminalStatus.ACTIVE })
        queryClient.invalidateQueries({ queryKey: ['tpvs'] })
        toast({ title: t('newTerminal.toast.activated'), description: t('newTerminal.toast.activatedDesc', { name: created.terminal.name }) })
      } catch (activationError: any) {
        // La terminal YA existe: no se repite la creación. Se dice qué pasó y cómo seguir.
        toast({
          variant: 'destructive',
          title: t('newTerminal.toast.activationFailed'),
          description: t('newTerminal.toast.activationFailedDesc', {
            error: activationError?.response?.data?.message || activationError?.message || '',
          }),
        })
      }
      close()
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: error?.response?.data?.message || error?.message || tCommon('error'),
      })
    } finally {
      setSubmitting(false)
    }
  }

  const copyCode = async () => {
    if (!createdCode) return
    try {
      await navigator.clipboard.writeText(createdCode.code)
      setCodeCopied(true)
    } catch {
      /* El código sigue a la vista para copiarlo a mano. */
    }
  }

  const submitLabel = activationMode === 'activate-now' ? t('newTerminal.submitActivate') : t('newTerminal.submitWithCode')

  return (
    <FullScreenModal
      open={open}
      onClose={close}
      title={t('newTerminal.title')}
      contentClassName="bg-muted/30"
      actions={
        createdCode ? (
          <Button onClick={close}>{t('newTerminal.done')}</Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            data-tour="tpv-create-submit"
            className="bg-gradient-to-r from-amber-400 to-pink-500 hover:from-amber-500 hover:to-pink-600 text-primary-foreground"
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitting ? t('newTerminal.submitting') : submitLabel}
          </Button>
        )
      }
    >
      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
          <Shield className="h-4 w-4 text-amber-500" />
          <span className="bg-gradient-to-r from-amber-400 to-pink-500 bg-clip-text text-transparent">
            {t('newTerminal.superadminOnly', { venue: venueName })}
          </span>
        </div>

        {createdCode ? (
          <section className="rounded-2xl border border-border/50 bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">{t('newTerminal.codeIntro', { name: createdCode.terminalName })}</p>
            <p className="my-4 font-mono text-4xl font-semibold tracking-[0.3em]" data-testid="activation-code">
              {createdCode.code}
            </p>
            <Button variant="outline" onClick={copyCode}>
              {codeCopied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {codeCopied ? tCommon('copied') : tCommon('copy')}
            </Button>
            <p className="mt-4 text-xs text-muted-foreground">{t('newTerminal.codeExpires')}</p>
          </section>
        ) : (
          <>
            {/* 1 · Modelo y datos */}
            <section className="rounded-2xl border border-border/50 bg-card p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-lg bg-muted">
                  <CreditCard className="h-4 w-4" />
                </span>
                <h2 className="text-base font-semibold">{t('newTerminal.sections.model')}</h2>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="radiogroup" aria-label={t('newTerminal.sections.model')}>
                {[...KNOWN_MODELS.map(m => ({ id: m.id as ModelChoice, label: m.label, sub: m.processor })), { id: 'other' as ModelChoice, label: t('newTerminal.otherModel'), sub: t('newTerminal.otherModelHint') }].map(option => {
                  const selected = modelChoice === option.id
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setModelChoice(option.id)}
                      data-tour={`tpv-create-model-${option.id}`}
                      className={cn(
                        'relative flex cursor-pointer flex-col items-center gap-2 rounded-xl border p-4 text-center transition-colors',
                        selected ? 'border-foreground ring-1 ring-foreground' : 'border-input hover:bg-muted/40',
                      )}
                    >
                      {selected && (
                        <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-foreground text-background">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                      <span className="flex h-16 w-11 items-start justify-center rounded-lg border-2 border-muted-foreground/30 bg-muted pt-1.5">
                        <span className="h-6 w-8 rounded-sm bg-muted-foreground/30" />
                      </span>
                      <span className="text-sm font-semibold">{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.sub}</span>
                    </button>
                  )
                })}
              </div>

              {modelChoice === 'other' && (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="grid gap-2">
                    <Label>{t('newTerminal.fields.type')}</Label>
                    <Select value={otherType} onValueChange={value => setOtherType(value as TerminalType)}>
                      <SelectTrigger className="h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TPV_ANDROID">{t('superadmin.terminalTypes.tpvAndroid')}</SelectItem>
                        <SelectItem value="TPV_IOS">{t('superadmin.terminalTypes.tpvIOS')}</SelectItem>
                        <SelectItem value="PRINTER_RECEIPT">{t('superadmin.terminalTypes.printerReceipt')}</SelectItem>
                        <SelectItem value="PRINTER_KITCHEN">{t('superadmin.terminalTypes.printerKitchen')}</SelectItem>
                        <SelectItem value="KDS">{t('superadmin.terminalTypes.kds')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>{t('newTerminal.fields.brand')}</Label>
                    <Select value={otherBrand} onValueChange={value => setOtherBrand(value as TerminalBrand)}>
                      <SelectTrigger className="h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TERMINAL_BRAND_OPTIONS.map(brand => (
                          <SelectItem key={brand} value={brand}>
                            {brand}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="tpv-create-other-model">{t('newTerminal.fields.model')}</Label>
                    <Input
                      id="tpv-create-other-model"
                      value={otherModel}
                      onChange={e => setOtherModel(e.target.value)}
                      className="h-12 text-base"
                    />
                  </div>
                </div>
              )}

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="tpv-create-serial">{t('newTerminal.fields.serial')}</Label>
                  <div className="flex h-12 items-center rounded-md border border-input focus-within:ring-2 focus-within:ring-ring">
                    <span className="border-r border-input px-3 font-mono text-sm text-muted-foreground">{SERIAL_PREFIX}</span>
                    <input
                      id="tpv-create-serial"
                      data-tour="tpv-create-serial"
                      value={serialNumber}
                      onChange={e => setSerialNumber(e.target.value)}
                      placeholder="N860W175377"
                      className="h-full flex-1 bg-transparent px-3 font-mono text-base outline-none"
                      autoComplete="off"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="tpv-create-name">{t('newTerminal.fields.name')}</Label>
                  <Input
                    id="tpv-create-name"
                    data-tour="tpv-create-name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={t('newTerminal.fields.namePlaceholder')}
                    className="h-12 text-base"
                  />
                </div>
              </div>
            </section>

            {/* 2 · ¿Cómo se activa? */}
            <section className="rounded-2xl border border-border/50 bg-card p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-lg bg-muted">
                  <KeyRound className="h-4 w-4" />
                </span>
                <h2 className="text-base font-semibold">{t('newTerminal.sections.activation')}</h2>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t('newTerminal.sections.activation')}>
                {(
                  [
                    { id: 'with-code', icon: KeyRound, title: t('newTerminal.activation.withCode'), desc: t('newTerminal.activation.withCodeDesc'), tag: t('newTerminal.activation.recommended') },
                    { id: 'activate-now', icon: Zap, title: t('newTerminal.activation.now'), desc: t('newTerminal.activation.nowDesc'), tag: null },
                  ] as const
                ).map(option => {
                  const selected = activationMode === option.id
                  const Icon = option.icon
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setActivationMode(option.id)}
                      data-tour={`tpv-create-activation-${option.id}`}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-left transition-colors',
                        selected ? 'border-foreground ring-1 ring-foreground' : 'border-input hover:bg-muted/40',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 size-4 shrink-0 rounded-full border-2',
                          selected ? 'border-[5px] border-foreground' : 'border-muted-foreground/50',
                        )}
                      />
                      <span className="flex-1 space-y-1">
                        <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                          <Icon className="h-4 w-4" />
                          {option.title}
                          {option.tag && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{option.tag}</span>}
                        </span>
                        <span className="block text-sm text-muted-foreground">{option.desc}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* 3 · Ajustes de cobro */}
            <section className="rounded-2xl border border-border/50 bg-card p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-lg bg-muted">
                  <Settings2 className="h-4 w-4" />
                </span>
                <h2 className="text-base font-semibold">{t('newTerminal.sections.settings')}</h2>
              </div>
              <div className="grid gap-3" role="radiogroup" aria-label={t('newTerminal.sections.settings')}>
                {(
                  [
                    { id: false, title: t('newTerminal.settings.inherit'), desc: t('newTerminal.settings.inheritDesc') },
                    { id: true, title: t('newTerminal.settings.customize'), desc: t('newTerminal.settings.customizeDesc') },
                  ] as const
                ).map(option => {
                  const selected = customize === option.id
                  return (
                    <button
                      key={String(option.id)}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setCustomize(option.id)}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-left transition-colors',
                        selected ? 'border-foreground ring-1 ring-foreground' : 'border-input hover:bg-muted/40',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 size-4 shrink-0 rounded-full border-2',
                          selected ? 'border-[5px] border-foreground' : 'border-muted-foreground/50',
                        )}
                      />
                      <span className="space-y-1">
                        <span className="block text-sm font-semibold">{option.title}</span>
                        <span className="block text-sm text-muted-foreground">{option.desc}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
              {customize && (
                <div className="mt-4 rounded-xl border border-input p-1">
                  <TpvSettingsFields settings={customSettings} onUpdate={handleSettingsUpdate} mode="terminal" disabled={submitting} />
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </FullScreenModal>
  )
}
