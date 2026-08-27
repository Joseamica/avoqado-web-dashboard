import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CreditCard, Image as ImageIcon, Palette, Upload, Loader2, Info, Gift } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GlassCard } from '@/components/ui/glass-card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { PermissionGate } from '@/components/PermissionGate'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { walletCardService, type WalletCardDesign, type WalletStampShape } from '@/services/walletCard.service'
import loyaltyService from '@/services/loyalty.service'
import { WalletCardPreview } from './components/WalletCardPreview'
import { cn } from '@/lib/utils'

/**
 * El diseñador de la credencial del cliente.
 *
 * 🔴 La decisión de forma que gobierna esta pantalla: TEMAS primero, colores sueltos
 * después. Loyalz expone siete selectores de color de golpe, y este dashboard se
 * diseña para el usuario menos técnico — un dueño de estética no quiere elegir siete
 * colores, quiere que su tarjeta se vea bien. Los temas resuelven eso de un clic; los
 * colores individuales siguen ahí para quien los quiera.
 *
 * La vista previa se actualiza al instante y sin llamar al servidor: configurar a
 * ciegas y descubrir el resultado en el teléfono de un cliente es exactamente el
 * problema que esta pantalla existe para evitar.
 */

/** Temas de un clic. El acento se conserva: es la marca del negocio. */
const TEMAS: { id: string; colores: Partial<WalletCardDesign> }[] = [
  {
    id: 'dark',
    colores: { backgroundColor: '#1C1C1E', textColor: '#FFFFFF', labelColor: '#98989D', stripColor: '#2C2C2E' },
  },
  {
    id: 'light',
    colores: { backgroundColor: '#FFFFFF', textColor: '#1C1C1E', labelColor: '#6E6E73', stripColor: '#F2F2F7' },
  },
  {
    id: 'carbon',
    colores: { backgroundColor: '#000000', textColor: '#FFFFFF', labelColor: '#8E8E93', stripColor: '#141416' },
  },
]

/**
 * El orden importa: primero las figuras genéricas que sirven a cualquier giro, luego
 * los iconos que sólo tienen sentido en uno. Un dueño de tienda no debería tener que
 * pasar por "tijeras" y "mancuerna" antes de llegar a algo que le sirva.
 */
const FORMAS: WalletStampShape[] = ['CIRCLE', 'STAR', 'HEART', 'SQUARE', 'CUP', 'SCISSORS', 'DUMBBELL', 'FLOWER', 'BAG']

function SectionHeader({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <div className="rounded-xl bg-muted p-2">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

/** Selector de color: la muestra abre el selector del sistema, el campo acepta el hex. */
function ColorField({ label, value, onChange, tourKey }: { label: string; value: string; onChange: (v: string) => void; tourKey: string }) {
  // Estado local para que se pueda BORRAR el campo mientras se escribe. Sin él, el
  // primer caracter borrado dispara un valor inválido y el campo se pelea contigo.
  const [texto, setTexto] = useState(value)
  useEffect(() => setTexto(value), [value])

  const commit = (raw: string) => {
    const limpio = raw.trim().startsWith('#') ? raw.trim() : `#${raw.trim()}`
    if (/^#[0-9a-fA-F]{6}$/.test(limpio)) onChange(limpio.toUpperCase())
    else setTexto(value) // vuelve al último válido en vez de guardar basura
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-input px-3 py-2">
      <Label className="text-sm font-normal">{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && commit((e.target as HTMLInputElement).value)}
          className="h-8 w-[92px] font-mono text-xs uppercase"
          data-tour={`wallet-color-${tourKey}`}
        />
        <label
          className="h-9 w-9 shrink-0 cursor-pointer rounded-md border border-input focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background"
          style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(texto) ? texto : value }}
        >
          {/*
            El <input type="color"> va oculto y la muestra es su etiqueta: así se ve
            el color, no un control gris del sistema. `focus-within` traslada el foco
            del input escondido a la muestra visible.
          */}
          <input type="color" value={value} onChange={e => onChange(e.target.value.toUpperCase())} className="sr-only" aria-label={label} />
        </label>
      </div>
    </div>
  )
}

export default function WalletCardDesigner() {
  const { venueId, venue } = useCurrentVenue()
  const { t } = useTranslation('loyalty')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [borrador, setBorrador] = useState<WalletCardDesign | null>(null)
  const [avisos, setAvisos] = useState<string[]>([])
  const [subiendo, setSubiendo] = useState<'logo' | 'icon' | 'stamp' | null>(null)
  const logoInput = useRef<HTMLInputElement>(null)
  const stampInput = useRef<HTMLInputElement>(null)
  const iconInput = useRef<HTMLInputElement>(null)

  const { data: guardado, isLoading } = useQuery({
    queryKey: ['wallet-card-design', venueId],
    queryFn: () => walletCardService.getDesign(venueId!),
    enabled: !!venueId,
  })

  // Los sellos de la vista previa salen de la config REAL del negocio, no de un
  // número inventado: si configuró "al 7 va gratis", eso es lo que debe ver aquí.
  const { data: config } = useQuery({
    queryKey: ['loyalty-config', venueId],
    queryFn: () => loyaltyService.getConfig(venueId!),
    enabled: !!venueId,
  })

  useEffect(() => {
    if (guardado) setBorrador(guardado)
  }, [guardado])

  const guardar = useMutation({
    mutationFn: (patch: Partial<WalletCardDesign>) => walletCardService.updateDesign(venueId!, patch),
    onSuccess: data => {
      setBorrador(data)
      queryClient.invalidateQueries({ queryKey: ['wallet-card-design', venueId] })
      toast({ title: t('card.toasts.saved') })
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: t('card.toasts.error'), description: error?.response?.data?.message })
    },
  })

  // ── El programa de sellos ───────────────────────────────────────────────
  // Vive AQUÍ, junto a la vista previa, y no en una pantalla aparte: cambiar "7
  // sellos" y ver la cartilla encogerse en el acto es lo que hace entendible la
  // decisión. Guarda en LoyaltyConfig (otra tabla que el diseño), así que es su
  // propio botón — mezclarlos dejaría al negocio sin saber qué se guardó.
  type TipoPremio = 'FREE_PRODUCT' | 'FIXED_AMOUNT' | 'PERCENTAGE'
  const [programa, setPrograma] = useState<{
    stampsEnabled: boolean
    stampsRequired: number | undefined
    stampRewardType: TipoPremio
    stampRewardValue: number | undefined
    stampRewardLabel: string
  }>({
    stampsEnabled: false,
    stampsRequired: 10,
    stampRewardType: 'FREE_PRODUCT',
    stampRewardValue: undefined,
    stampRewardLabel: '',
  })

  useEffect(() => {
    if (!config) return
    setPrograma({
      stampsEnabled: !!config.stampsEnabled,
      stampsRequired: config.stampsRequired ?? 10,
      stampRewardType: (config.stampRewardType as TipoPremio) ?? 'FREE_PRODUCT',
      stampRewardValue: config.stampRewardValue == null ? undefined : Number(config.stampRewardValue),
      stampRewardLabel: config.stampRewardLabel ?? '',
    })
  }, [config])

  const guardarPrograma = useMutation({
    mutationFn: () =>
      loyaltyService.updateConfig(venueId!, {
        stampsEnabled: programa.stampsEnabled,
        stampsRequired: programa.stampsRequired,
        stampRewardType: programa.stampRewardType,
        // El monto sólo viaja cuando el tipo lo usa: mandarlo con FREE_PRODUCT
        // guardaría un número que nadie lee y confunde al leer la configuración.
        ...(programa.stampRewardType === 'FREE_PRODUCT' ? {} : { stampRewardValue: programa.stampRewardValue }),
        ...(programa.stampRewardLabel.trim() ? { stampRewardLabel: programa.stampRewardLabel.trim() } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loyalty-config', venueId] })
      toast({ title: t('card.program.saved') })
    },
    onError: (error: any) => {
      // El servidor es quien decide si el premio es coherente; su mensaje es más
      // útil que uno genérico ("necesita un porcentaje mayor a 0").
      toast({
        variant: 'destructive',
        title: t('card.toasts.error'),
        description: error?.response?.data?.message,
      })
    },
  })

  const subir = async (kind: 'logo' | 'icon' | 'stamp', file: File) => {
    setSubiendo(kind)
    setAvisos([])
    try {
      const result = await walletCardService.uploadImage(venueId!, kind, file)
      setBorrador(result.design)
      setAvisos(result.avisos)
      queryClient.invalidateQueries({ queryKey: ['wallet-card-design', venueId] })
      toast({ title: t('card.toasts.imageUploaded') })
    } catch (error: any) {
      toast({ variant: 'destructive', title: t('card.toasts.imageError'), description: error?.response?.data?.message })
    } finally {
      setSubiendo(null)
    }
  }

  if (isLoading || !borrador) {
    // 🔴 Esqueleto, no un spinner centrado. El esqueleto ya enseña la forma de la
    // pantalla —editor a la izquierda, tarjeta a la derecha— así que cuando el
    // contenido llega no hay salto de disposición ni sorpresa. Un spinner en medio
    // de la nada no dice nada y hace que la llegada se sienta brusca.
    return (
      <div className="space-y-6 p-4 md:p-6" aria-busy="true" aria-live="polite">
        <span className="sr-only">{t('card.loading')}</span>
        <div className="h-7 w-48 animate-pulse rounded-md bg-muted" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="order-2 space-y-4 lg:order-1">
            <div className="h-52 animate-pulse rounded-2xl bg-muted" />
            <div className="h-72 animate-pulse rounded-2xl bg-muted" />
          </div>
          <div className="order-1 lg:order-2">
            <div className="mx-auto h-[300px] w-[300px] animate-pulse rounded-[18px] bg-muted" />
          </div>
        </div>
      </div>
    )
  }

  const set = (patch: Partial<WalletCardDesign>) => setBorrador(prev => (prev ? { ...prev, ...patch } : prev))
  const hayCambios = JSON.stringify(borrador) !== JSON.stringify(guardado)

  return (
    <FeatureGate feature="LOYALTY_PROGRAM">
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <PageTitleWithInfo title={t('card.title')} tooltip={t('card.info')} />
            <p className="mt-1 text-sm text-muted-foreground">{t('card.subtitle')}</p>
          </div>
          <PermissionGate permission="loyalty:update">
            <Button
              onClick={() => guardar.mutate(borrador)}
              disabled={!hayCambios || guardar.isPending}
              data-tour="wallet-card-save"
              className="cursor-pointer"
            >
              {guardar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('card.save')}
            </Button>
          </PermissionGate>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* ── Editor ────────────────────────────────────────────────── */}
          {/*
            🔴 `order-2 lg:order-1`: en un teléfono la vista previa va ARRIBA, no
            debajo de tres secciones de ajustes. Apilar en el orden del código
            dejaría al dueño cambiando colores a ciegas y bajando a comprobar cada
            uno, que es justo el problema que esta pantalla existe para evitar. El
            producto declara "mobile-aware": muchos entran desde el teléfono.
          */}
          <div className="order-2 space-y-4 lg:order-1">
            <GlassCard className="p-6">
              <SectionHeader icon={Gift} title={t('card.program.title')} description={t('card.program.description')} />

              <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                <div className="pr-4">
                  <Label className="text-sm">{t('card.program.enabled')}</Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t('card.program.enabledHint')}</p>
                </div>
                <Switch
                  checked={programa.stampsEnabled}
                  onCheckedChange={v => setPrograma(p => ({ ...p, stampsEnabled: v }))}
                  aria-label={t('card.program.enabled')}
                />
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm">{t('card.program.required')}</Label>
                  <Input
                    type="number"
                    min={2}
                    max={50}
                    /* Vaciable a propósito: con `|| 10` no se puede borrar el 1 para escribir 12. */
                    value={programa.stampsRequired ?? ''}
                    onChange={e => {
                      const raw = e.target.value
                      setPrograma(p => ({ ...p, stampsRequired: raw === '' ? undefined : parseInt(raw, 10) }))
                    }}
                  />
                  <p className="text-xs text-muted-foreground">{t('card.program.requiredHint')}</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">{t('card.program.rewardLabel')}</Label>
                  <Input
                    maxLength={60}
                    placeholder={t('card.program.rewardLabelPlaceholder')}
                    value={programa.stampRewardLabel}
                    onChange={e => setPrograma(p => ({ ...p, stampRewardLabel: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">{t('card.program.rewardLabelHint')}</p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <Label className="text-sm">{t('card.program.rewardType')}</Label>
                <div className="flex flex-wrap gap-2">
                  {(['FREE_PRODUCT', 'FIXED_AMOUNT', 'PERCENTAGE'] as const).map(tipo => (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => setPrograma(p => ({ ...p, stampRewardType: tipo }))}
                      className={cn(
                        'cursor-pointer rounded-lg border px-3 py-1.5 text-sm transition-colors',
                        programa.stampRewardType === tipo
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-input text-muted-foreground hover:bg-accent',
                      )}
                    >
                      {t(`card.program.rewardTypes.${tipo}`)}
                    </button>
                  ))}
                </div>
                {programa.stampRewardType === 'FREE_PRODUCT' ? (
                  <p className="text-xs text-muted-foreground">{t('card.program.freeProductHint')}</p>
                ) : (
                  <div className="pt-1">
                    <Input
                      type="number"
                      min={0}
                      max={programa.stampRewardType === 'PERCENTAGE' ? 100 : undefined}
                      value={programa.stampRewardValue ?? ''}
                      onChange={e => {
                        const raw = e.target.value
                        setPrograma(p => ({ ...p, stampRewardValue: raw === '' ? undefined : parseFloat(raw) }))
                      }}
                      placeholder={programa.stampRewardType === 'PERCENTAGE' ? '15' : '50'}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {programa.stampRewardType === 'PERCENTAGE' ? t('card.program.percentageHint') : t('card.program.fixedAmountHint')}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-5 flex justify-end">
                <Button size="sm" onClick={() => guardarPrograma.mutate()} disabled={guardarPrograma.isPending}>
                  {guardarPrograma.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('card.program.save')}
                </Button>
              </div>
            </GlassCard>

            <GlassCard className="p-6">
              <SectionHeader icon={ImageIcon} title={t('card.brand.title')} description={t('card.brand.description')} />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm">{t('card.brand.logo')}</Label>
                  <div className="flex h-[72px] items-center justify-center rounded-lg border border-dashed border-input bg-muted/40 p-2">
                    {borrador.logoUrl ? (
                      // 🔴 La imagen subida lleva su propio botón de quitar. Sin él, un
                      // negocio que se equivoca sólo puede tapar el error con otra
                      // imagen, nunca volver al respaldo — y eso se reportó como "ya no
                      // la puedo cambiar".
                      <div className="group relative flex h-full w-full items-center justify-center">
                        <img src={borrador.logoUrl} alt={t('card.brand.logo')} className="max-h-full max-w-full object-contain" />
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">{t('card.brand.noLogo')}</span>
                    )}
                  </div>
                  <input
                    ref={logoInput}
                    type="file"
                    accept="image/png"
                    className="sr-only"
                    onChange={e => e.target.files?.[0] && subir('logo', e.target.files[0])}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full cursor-pointer"
                    onClick={() => logoInput.current?.click()}
                    disabled={subiendo !== null}
                    data-tour="wallet-upload-logo"
                  >
                    {subiendo === 'logo' ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-2 h-3.5 w-3.5" />}
                    {borrador.logoUrl ? t('card.brand.replace') : t('card.brand.upload')}
                  </Button>
                  {/*
                    🔴 "Quitar" con TEXTO, no un icono superpuesto sobre la imagen. Es el
                    mismo patrón que el sello propio de más abajo: la pantalla no puede
                    pedirle al usuario que aprenda dos formas de hacer lo mismo. Y un ✕
                    encima de una imagen es ambiguo — no se sabe si borra o cierra algo.
                    Nació de un bug reportado: "me equivoqué al subir esta foto y ya no la
                    puedo cambiar".
                  */}
                  {borrador.logoUrl && (
                    <PermissionGate permission="loyalty:update">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-11 w-full cursor-pointer text-muted-foreground lg:min-h-9"
                        onClick={() => set({ logoUrl: null })}
                        data-tour="wallet-remove-logo"
                      >
                        {t('card.brand.remove')}
                      </Button>
                    </PermissionGate>
                  )}
                  <p className="text-[11px] text-muted-foreground">{t('card.brand.logoHint')}</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">{t('card.brand.icon')}</Label>
                  <div className="flex h-[72px] items-center justify-center rounded-lg border border-dashed border-input bg-muted/40 p-2">
                    {borrador.iconUrl ? (
                      <div className="group relative flex h-full w-full items-center justify-center">
                        <img src={borrador.iconUrl} alt={t('card.brand.icon')} className="h-12 w-12 rounded-lg object-cover" />
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">{t('card.brand.noIcon')}</span>
                    )}
                  </div>
                  <input
                    ref={iconInput}
                    type="file"
                    accept="image/png"
                    className="sr-only"
                    onChange={e => e.target.files?.[0] && subir('icon', e.target.files[0])}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full cursor-pointer"
                    onClick={() => iconInput.current?.click()}
                    disabled={subiendo !== null}
                    data-tour="wallet-upload-icon"
                  >
                    {subiendo === 'icon' ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-2 h-3.5 w-3.5" />}
                    {borrador.iconUrl ? t('card.brand.replace') : t('card.brand.upload')}
                  </Button>
                  {/*
                    🔴 "Quitar" con TEXTO, no un icono superpuesto sobre la imagen. Es el
                    mismo patrón que el sello propio de más abajo: la pantalla no puede
                    pedirle al usuario que aprenda dos formas de hacer lo mismo. Y un ✕
                    encima de una imagen es ambiguo — no se sabe si borra o cierra algo.
                    Nació de un bug reportado: "me equivoqué al subir esta foto y ya no la
                    puedo cambiar".
                  */}
                  {borrador.iconUrl && (
                    <PermissionGate permission="loyalty:update">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-11 w-full cursor-pointer text-muted-foreground lg:min-h-9"
                        onClick={() => set({ iconUrl: null })}
                        data-tour="wallet-remove-icon"
                      >
                        {t('card.brand.remove')}
                      </Button>
                    </PermissionGate>
                  )}
                  <p className="text-[11px] text-muted-foreground">{t('card.brand.iconHint')}</p>
                </div>
              </div>

              {avisos.length > 0 && (
                <div className="mt-4 space-y-2 rounded-lg border border-input bg-muted/40 p-3">
                  {avisos.map((aviso, i) => (
                    <p key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {aviso}
                    </p>
                  ))}
                </div>
              )}
            </GlassCard>

            <GlassCard className="p-6">
              <SectionHeader icon={Palette} title={t('card.colors.title')} description={t('card.colors.description')} />

              <div className="mb-5 flex flex-wrap gap-2">
                {TEMAS.map(tema => {
                  const activo = TEMAS.find(x => x.id === tema.id)!.colores.backgroundColor === borrador.backgroundColor
                  return (
                    <button
                      key={tema.id}
                      type="button"
                      onClick={() => set(tema.colores)}
                      data-tour={`wallet-theme-${tema.id}`}
                      className={cn(
                        // 🔴 `min-h-11` (44px) en táctil: es el mínimo con el que un dedo
                        // acierta. Se relaja a 36px en escritorio, donde hay puntero y un
                        // chip de 44px se ve desproporcionado.
                        'flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-xs font-medium transition-colors lg:min-h-9',
                        // Sin esto, quien navega con teclado no ve dónde está: es un
                        // <button> propio, no uno del sistema de diseño.
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                        activo ? 'border-foreground bg-foreground text-background' : 'border-input hover:bg-muted',
                      )}
                    >
                      <span
                        className="h-3.5 w-3.5 rounded-full border border-input"
                        style={{ backgroundColor: tema.colores.backgroundColor }}
                      />
                      {t(`card.themes.${tema.id}`)}
                    </button>
                  )
                })}
              </div>

              <div className="space-y-2">
                <ColorField
                  label={t('card.colors.background')}
                  value={borrador.backgroundColor}
                  onChange={v => set({ backgroundColor: v })}
                  tourKey="bg"
                />
                <ColorField label={t('card.colors.text')} value={borrador.textColor} onChange={v => set({ textColor: v })} tourKey="text" />
                <ColorField
                  label={t('card.colors.label')}
                  value={borrador.labelColor}
                  onChange={v => set({ labelColor: v })}
                  tourKey="label"
                />
                <ColorField
                  label={t('card.colors.strip')}
                  value={borrador.stripColor}
                  onChange={v => set({ stripColor: v })}
                  tourKey="strip"
                />
                <ColorField
                  label={t('card.colors.stamp')}
                  value={borrador.stampFilledColor}
                  onChange={v => set({ stampFilledColor: v })}
                  tourKey="stamp"
                />
              </div>
            </GlassCard>

            <GlassCard className="p-6">
              <SectionHeader icon={CreditCard} title={t('card.stamps.title')} description={t('card.stamps.description')} />

              {/*
                🔴 Cuando hay un sello propio, las formas se apagan de verdad (no sólo
                se ven grises): la imagen manda sobre la forma en el servidor, así que
                dejarlas activas prometería un cambio que no va a ocurrir.
              */}
              <div className={cn('flex flex-wrap gap-2 transition-opacity', borrador.stampImageUrl && 'pointer-events-none opacity-40')}>
                {FORMAS.map(forma => (
                  <button
                    key={forma}
                    type="button"
                    disabled={Boolean(borrador.stampImageUrl)}
                    onClick={() => set({ stampShape: forma })}
                    data-tour={`wallet-shape-${forma.toLowerCase()}`}
                    className={cn(
                      'min-h-11 cursor-pointer rounded-full border px-5 text-xs font-medium transition-colors lg:min-h-9',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      borrador.stampShape === forma ? 'border-foreground bg-foreground text-background' : 'border-input hover:bg-muted',
                    )}
                  >
                    {t(`card.shapes.${forma}`)}
                  </button>
                ))}
              </div>

              {/* El sello propio */}
              <div className="mt-5 border-t border-input pt-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t('card.stamps.ownTitle')}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t('card.stamps.ownHint')}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {borrador.stampImageUrl && (
                      <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-input bg-muted/40 p-1.5">
                        <img src={borrador.stampImageUrl} alt="" className="max-h-full max-w-full object-contain" />
                      </div>
                    )}
                    <input
                      ref={stampInput}
                      type="file"
                      accept="image/png"
                      className="sr-only"
                      onChange={e => e.target.files?.[0] && subir('stamp', e.target.files[0])}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-11 cursor-pointer lg:min-h-9"
                      onClick={() => stampInput.current?.click()}
                      disabled={subiendo !== null}
                      data-tour="wallet-upload-stamp"
                    >
                      {subiendo === 'stamp' ? (
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-3.5 w-3.5" />
                      )}
                      {borrador.stampImageUrl ? t('card.stamps.replace') : t('card.stamps.upload')}
                    </Button>
                    {borrador.stampImageUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-11 cursor-pointer text-muted-foreground lg:min-h-9"
                        onClick={() => set({ stampImageUrl: null })}
                        data-tour="wallet-remove-stamp"
                      >
                        {t('card.stamps.remove')}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <p className="mt-4 text-xs text-muted-foreground">{t('card.stamps.countHint', { count: config?.stampsRequired ?? 10 })}</p>
            </GlassCard>
          </div>

          {/* ── Vista previa ──────────────────────────────────────────── */}
          <div className="order-1 lg:sticky lg:top-6 lg:order-2 lg:h-fit">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{t('card.preview.title')}</h3>
              <Badge variant="outline" className="text-[10px]">
                {t('card.preview.live')}
              </Badge>
            </div>

            <WalletCardPreview
              venueId={venueId!}
              design={borrador}
              venueName={venue?.name ?? 'Mi negocio'}
              // Un ejemplo a media cartilla: es donde se distingue un sello ganado
              // de uno que falta, que es lo que hay que poder juzgar aquí.
              /*
                🔴 La previa sigue el BORRADOR, no lo último guardado. Con `config` decía
                "3 / 10" mientras el formulario ya decía 7: el dueño escribe un número y ve
                otro, que es justo lo que esta sección existe para evitar. Sólo se vio
                mirando la pantalla — compila igual de las dos formas.
              */
              stampsEarned={Math.min(3, programa.stampsRequired ?? config?.stampsRequired ?? 10)}
              stampsRequired={programa.stampsRequired ?? config?.stampsRequired ?? 10}
              rewardLabel={programa.stampRewardLabel.trim() || config?.stampRewardLabel || t('card.preview.sampleReward')}
            />

            <p className="mt-4 text-center text-[11px] text-muted-foreground">{t('card.poweredBy')}</p>
          </div>
        </div>
      </div>
    </FeatureGate>
  )
}
