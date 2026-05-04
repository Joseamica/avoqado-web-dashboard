import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Smartphone, AlertCircle, Copy, Shield, ChevronDown, Settings2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { terminalAPI, TerminalType, CreateTerminalRequest } from '@/services/superadmin-terminals.service'
import { DEFAULT_TPV_SETTINGS, type TpvSettings } from '@/services/tpv-settings.service'
import { TpvSettingsFields } from '@/components/tpv/TpvSettingsFields'
import { cn } from '@/lib/utils'

interface SuperadminTerminalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export const SuperadminTerminalDialog: React.FC<SuperadminTerminalDialogProps> = ({ open, onOpenChange, onSuccess }) => {
  const { t } = useTranslation('tpv')
  const { t: tCommon } = useTranslation('common')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { venueId, venue } = useCurrentVenue()
  const venueName = venue?.name || ''
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    serialNumber: '',
    name: '',
    type: TerminalType.TPV_ANDROID,
    brand: 'PAX',
    model: 'A910S',
    generateActivationCode: true,
  })

  // Optional pre-configuration (collapsible "advanced settings" section).
  // - customizeOpen: whether the section is expanded
  // - customSettings: current values shown in the form (initialized to defaults)
  // - dirtyKeysRef: set of keys the superadmin actually touched. Only those
  //   keys are sent as configOverrides on submit, so an unchanged section
  //   never overrides org/venue defaults.
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [customSettings, setCustomSettings] = useState<TpvSettings>(DEFAULT_TPV_SETTINGS)
  const dirtyKeysRef = useRef<Set<keyof TpvSettings>>(new Set())

  const handleSettingsUpdate = useCallback((updates: Partial<TpvSettings>) => {
    Object.keys(updates).forEach(k => dirtyKeysRef.current.add(k as keyof TpvSettings))
    setCustomSettings(prev => ({ ...prev, ...updates }))
  }, [])

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setFormData({
        serialNumber: '',
        name: '',
        type: TerminalType.TPV_ANDROID,
        brand: 'PAX',
        model: 'A910S',
        generateActivationCode: true,
      })
      setCustomizeOpen(false)
      setCustomSettings(DEFAULT_TPV_SETTINGS)
      dirtyKeysRef.current = new Set()
    }
  }, [open])

  const createMutation = useMutation({
    mutationFn: terminalAPI.createTerminal,
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: ['tpvs'] })
      queryClient.invalidateQueries({ queryKey: ['terminals'] })

      if (data.activationCode) {
        toast({
          title: t('tpv.superadmin.created', { defaultValue: '✅ Terminal creada' }),
          description: (
            <div className="space-y-2">
              <p>
                <strong>{t('tpv.superadmin.name', { defaultValue: 'Nombre' })}:</strong> {data.terminal.name}
              </p>
              <p>
                <strong>{t('tpv.superadmin.serial', { defaultValue: 'Serie' })}:</strong> {data.terminal.serialNumber}
              </p>
              <p className="font-mono text-lg bg-muted p-2 rounded">
                <strong>{t('tpv.superadmin.activationCode', { defaultValue: 'Código' })}:</strong> {data.activationCode.activationCode}
              </p>
              <p className="text-xs text-muted-foreground">{t('tpv.superadmin.expiresIn7Days', { defaultValue: 'Expira en 7 días' })}</p>
              {data.autoAttachedMerchants && data.autoAttachedMerchants.length > 0 && (
                <p className="text-green-600 dark:text-green-400 text-sm">
                  🔗 Auto-attached {data.autoAttachedMerchants.length} merchant(s)
                </p>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(data.activationCode!.activationCode)
                  toast({
                    title: tCommon('copied'),
                    description: t('tpv.superadmin.codeCopied', { defaultValue: 'Código copiado al portapapeles' }),
                  })
                }}
              >
                <Copy className="w-3 h-3 mr-1" /> {tCommon('copy')}
              </Button>
            </div>
          ),
          duration: 15000,
        })
      } else {
        const autoAttachMsg =
          data.autoAttachedMerchants && data.autoAttachedMerchants.length > 0
            ? ` 🔗 Auto-attached ${data.autoAttachedMerchants.length} merchant(s).`
            : ''
        toast({
          title: t('tpv.superadmin.created', { defaultValue: '✅ Terminal creada' }),
          description: t('tpv.superadmin.createdDesc', { defaultValue: 'La terminal se creó correctamente' }) + autoAttachMsg,
        })
      }

      onSuccess?.()
      onOpenChange(false)
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || error.message || tCommon('error')
      toast({
        title: tCommon('error'),
        description: message,
        variant: 'destructive',
      })
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!venueId) return

    setLoading(true)

    try {
      // Ensure serial number has AVQD- prefix
      const serialNumber = formData.serialNumber.startsWith('AVQD-') ? formData.serialNumber : `AVQD-${formData.serialNumber}`

      // Only include configOverrides if the superadmin opened the advanced
      // section AND modified at least one field. Empty overrides preserve
      // default org/venue inheritance.
      const overrides =
        customizeOpen && dirtyKeysRef.current.size > 0
          ? (Object.fromEntries(Array.from(dirtyKeysRef.current).map(k => [k, customSettings[k]])) as Partial<TpvSettings>)
          : undefined

      const request: CreateTerminalRequest = {
        venueId,
        serialNumber,
        name: formData.name,
        type: formData.type,
        brand: formData.brand,
        model: formData.model,
        generateActivationCode: formData.generateActivationCode,
        ...(overrides ? { configOverrides: overrides } : {}),
      }

      await createMutation.mutateAsync(request)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-background max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gradient-to-r from-amber-400 to-pink-500">
                <Shield className="h-4 w-4 text-primary-foreground" />
              </div>
              <DialogTitle>{t('tpv.superadmin.dialogTitle', { defaultValue: 'Crear Terminal (Superadmin)' })}</DialogTitle>
            </div>
            <DialogDescription>
              {t('tpv.superadmin.dialogDescription', {
                venue: venueName,
                defaultValue: `Crear terminal directamente para ${venueName}`,
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Venue indicator */}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-gradient-to-r from-amber-400/10 to-pink-500/10 border border-amber-400/20">
              <Smartphone className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium">{venueName}</span>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="serialNumber">
                {t('tpv.superadmin.serialNumber', { defaultValue: 'Número de Serie' })}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="serialNumber"
                value={formData.serialNumber}
                onChange={e => setFormData({ ...formData, serialNumber: e.target.value })}
                placeholder={t('tpv.superadmin.serialPlaceholder', { defaultValue: 'Ej: 2841548417' })}
                required
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                {t('tpv.superadmin.serialHelp', { defaultValue: 'El prefijo AVQD- se agrega automáticamente' })}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="name">
                {t('tpv.superadmin.terminalName', { defaultValue: 'Nombre de la Terminal' })}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('tpv.superadmin.namePlaceholder', { defaultValue: 'Ej: Caja Principal' })}
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="grid gap-2">
                <Label>{t('tpv.superadmin.type', { defaultValue: 'Tipo' })}</Label>
                <Select value={formData.type} onValueChange={value => setFormData({ ...formData, type: value as TerminalType })}>
                  <SelectTrigger>
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
                <Label>{t('tpv.superadmin.brand', { defaultValue: 'Marca' })}</Label>
                <Input value={formData.brand} onChange={e => setFormData({ ...formData, brand: e.target.value })} />
              </div>

              <div className="grid gap-2">
                <Label>{t('tpv.superadmin.model', { defaultValue: 'Modelo' })}</Label>
                <Input value={formData.model} onChange={e => setFormData({ ...formData, model: e.target.value })} />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.generateActivationCode}
                onChange={e => setFormData({ ...formData, generateActivationCode: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm">{t('tpv.superadmin.generateCode', { defaultValue: 'Generar código de activación' })}</span>
            </label>

            <div className="flex items-start space-x-2 text-sm bg-amber-50 dark:bg-amber-950/50 p-3 rounded-md border border-amber-200 dark:border-amber-800">
              <AlertCircle className="h-4 w-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="text-amber-700 dark:text-amber-300">
                {t('tpv.superadmin.directCreateWarning', {
                  defaultValue: 'Creación directa sin proceso de compra. Asegúrate de que la terminal ya está asignada a este restaurante.',
                })}
              </p>
            </div>

            {/* Optional pre-configuration. Collapsed by default; if not opened
                or not modified, the terminal is created with default settings
                (current behavior preserved). */}
            <Collapsible open={customizeOpen} onOpenChange={setCustomizeOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg border border-input bg-card px-4 py-3 text-left hover:bg-muted/40 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Settings2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">
                        {t('tpv.superadmin.advancedConfig.title', { defaultValue: 'Configuración avanzada (opcional)' })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t('tpv.superadmin.advancedConfig.description', {
                          defaultValue:
                            'Pre-configura propinas, modo kiosko, pantalla de inicio, reloj checador y más. Si lo dejas cerrado, la terminal hereda los valores por defecto del restaurante.',
                        })}
                      </p>
                    </div>
                  </div>
                  <ChevronDown
                    className={cn('h-4 w-4 text-muted-foreground transition-transform shrink-0', customizeOpen && 'rotate-180')}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <div className="rounded-lg border border-input bg-card p-1">
                  <TpvSettingsFields settings={customSettings} onUpdate={handleSettingsUpdate} mode="terminal" disabled={loading} />
                </div>
                {dirtyKeysRef.current.size > 0 && (
                  <p className="text-xs text-muted-foreground mt-2 pl-1">
                    {t('tpv.superadmin.advancedConfig.dirtyHint', {
                      count: dirtyKeysRef.current.size,
                      defaultValue: `Se aplicarán ${dirtyKeysRef.current.size} ajuste(s) personalizados al crear la terminal.`,
                    })}
                  </p>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              {t('common.cancel', { defaultValue: 'Cancelar' })}
            </Button>
            <Button
              type="submit"
              disabled={loading || !formData.serialNumber || !formData.name}
              className="bg-gradient-to-r from-amber-400 to-pink-500 hover:from-amber-500 hover:to-pink-600 text-primary-foreground"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading
                ? t('common.creating', { defaultValue: 'Creando...' })
                : t('tpv.superadmin.createTerminal', { defaultValue: 'Crear Terminal' })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
