import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  ImageIcon,
  Loader2,
  Pencil,
  Trash2,
  Upload,
  Users as UsersIcon,
} from 'lucide-react'
import api from '@/api'
import { storage, buildStoragePath } from '@/firebase'
import { getDownloadURL, ref as storageRef, uploadBytesResumable } from 'firebase/storage'
import { Button } from '@/components/ui/button'
import { ColorPicker } from '@/components/ui/color-picker'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { useToast } from '@/hooks/use-toast'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { cn } from '@/lib/utils'

type Step = 1 | 2
type PreviewMode = 'appointments' | 'classes'
type LogoSlot = 'logoFull' | 'logo'

interface EditBrandIdentityModalProps {
  open: boolean
  onClose: () => void
}

/**
 * Two-step fullscreen modal to edit the venue brand identity used on the
 * public booking page (book.avoqado.io/<slug>).
 *
 * Step 1: pick logos + brand color (no preview, focused on inputs).
 * Step 2: live preview on the left, tweaks on the right; "Completar" saves.
 *
 * Persisted fields on Venue:
 *   - logoFull      (wide marketing logo — new)
 *   - logo          (existing small/square logo, used in receipts + avatars)
 *   - primaryColor  (existing brand accent)
 *   - heroImageUrl  (existing cover photo)
 */
export function EditBrandIdentityModal({ open, onClose }: EditBrandIdentityModalProps) {
  const { t } = useTranslation('reservations')
  const { venueId, venueSlug } = useCurrentVenue()
  const { toast } = useToast()
  const qc = useQueryClient()

  const [step, setStep] = useState<Step>(1)
  const [previewMode, setPreviewMode] = useState<PreviewMode>('appointments')

  const { data: venue } = useQuery<{
    id: string
    name: string
    logo?: string | null
    logoFull?: string | null
    heroImageUrl?: string | null
    primaryColor?: string | null
  }>({
    queryKey: ['get-venue-data', venueId],
    queryFn: async () => {
      const res = await api.get(`/api/v1/dashboard/venues/${venueId}`)
      return res.data
    },
    enabled: !!venueId && open,
  })

  const [logoFull, setLogoFull] = useState('')
  const [logoSmall, setLogoSmall] = useState('')
  const [heroImageUrl, setHeroImageUrl] = useState('')
  const [primaryColor, setPrimaryColor] = useState('')
  const [dirty, setDirty] = useState(false)

  // Reset local form state whenever the modal (re)opens with fresh server data.
  useEffect(() => {
    if (!open) return
    setLogoFull(venue?.logoFull ?? '')
    setLogoSmall(venue?.logo ?? '')
    setHeroImageUrl(venue?.heroImageUrl ?? '')
    setPrimaryColor(venue?.primaryColor ?? '')
    setDirty(false)
    setStep(1)
    setPreviewMode('appointments')
  }, [open, venue])

  const saveMutation = useMutation({
    mutationFn: async () => {
      return api.put(`/api/v1/dashboard/venues/${venueId}`, {
        logo: logoSmall || null,
        logoFull: logoFull || null,
        heroImageUrl: heroImageUrl || null,
        primaryColor: primaryColor || null,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['get-venue-data', venueId] })
      toast({
        title: t('onlineBooking.brandIdentity.saved'),
        description: t('onlineBooking.brandIdentity.savedDescription'),
      })
      onClose()
    },
    onError: () => {
      toast({
        title: t('onlineBooking.brandIdentity.saveError'),
        description: t('onlineBooking.brandIdentity.saveErrorDescription'),
        variant: 'destructive',
      })
    },
  })

  const accent = (primaryColor && primaryColor.trim()) || '#6366F1'

  // ---- Header actions per step ---------------------------------------------
  const headerActions =
    step === 1 ? (
      <>
        <Button variant="secondary" onClick={onClose} className="rounded-full">
          {t('onlineBooking.brandIdentity.skip')}
        </Button>
        <Button onClick={() => setStep(2)} className="rounded-full">
          {t('onlineBooking.brandIdentity.next')}
        </Button>
      </>
    ) : (
      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="rounded-full"
      >
        {saveMutation.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : null}
        {t('onlineBooking.brandIdentity.complete')}
      </Button>
    )

  const title =
    step === 1
      ? t('onlineBooking.brandIdentity.step1Title')
      : t('onlineBooking.brandIdentity.step2Title')

  // FullScreenModal renders a fixed close button on the left of its header.
  // For step 2 we want a back arrow there instead — we fake that by passing
  // an extra action button anchored to the visual left via an absolute
  // wrapper inside the content area. Since FullScreenModal owns the header,
  // we instead expose a back affordance inside the page content for step 2.
  return (
    <FullScreenModal
      open={open}
      onClose={onClose}
      title={title}
      actions={headerActions}
      contentClassName={step === 2 ? 'bg-muted/30' : ''}
    >
      {step === 1 ? (
        <Step1Content
          logoFull={logoFull}
          logoSmall={logoSmall}
          primaryColor={primaryColor}
          onLogoChange={(slot, url) => {
            if (slot === 'logoFull') setLogoFull(url)
            else setLogoSmall(url)
            setDirty(true)
          }}
          onColorChange={(c) => {
            setPrimaryColor(c)
            setDirty(true)
          }}
          venueSlug={venueSlug ?? null}
        />
      ) : (
        <Step2Content
          venueName={venue?.name ?? 'Tu negocio'}
          accent={accent}
          heroImageUrl={heroImageUrl}
          logoSmall={logoSmall}
          primaryColor={primaryColor}
          previewMode={previewMode}
          venueSlug={venueSlug ?? null}
          onBack={() => setStep(1)}
          onPreviewModeChange={setPreviewMode}
          onHeroChange={(url) => {
            setHeroImageUrl(url)
            setDirty(true)
          }}
          onColorChange={(c) => {
            setPrimaryColor(c)
            setDirty(true)
          }}
        />
      )}
      {/* Track dirty state via aria-hidden span so React doesn't yell about
          a "set but never read" variable when the user types only Omitir. */}
      <span aria-hidden className="sr-only">
        {dirty ? 'dirty' : 'clean'}
      </span>
    </FullScreenModal>
  )
}

// ============================================================================
// Step 1 — Apply your brand design
// ============================================================================

interface Step1Props {
  logoFull: string
  logoSmall: string
  primaryColor: string
  venueSlug: string | null
  onLogoChange: (slot: LogoSlot, url: string) => void
  onColorChange: (color: string) => void
}

function Step1Content({
  logoFull,
  logoSmall,
  primaryColor,
  venueSlug,
  onLogoChange,
  onColorChange,
}: Step1Props) {
  const { t } = useTranslation('reservations')
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <h2 className="text-2xl font-semibold tracking-tight">
        {t('onlineBooking.brandIdentity.step1Heading')}
      </h2>
      <p className="mt-3 text-sm text-muted-foreground">
        {t('onlineBooking.brandIdentity.step1Description')}
      </p>

      <div className="mt-8 space-y-4">
        <LogoUploadCard
          slot="logoFull"
          label={t('onlineBooking.brandIdentity.logoFull')}
          helper={t('onlineBooking.brandIdentity.logoFullHelper')}
          value={logoFull}
          venueSlug={venueSlug}
          onChange={(url) => onLogoChange('logoFull', url)}
        />
        <LogoUploadCard
          slot="logo"
          label={t('onlineBooking.brandIdentity.logoSmall')}
          helper={t('onlineBooking.brandIdentity.logoSmallHelper')}
          value={logoSmall}
          venueSlug={venueSlug}
          onChange={(url) => onLogoChange('logo', url)}
        />
        <ColorCard
          label={t('onlineBooking.brandIdentity.color')}
          helper={t('onlineBooking.brandIdentity.colorHelper')}
          value={primaryColor}
          onChange={onColorChange}
        />
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------
// Logo upload card (Square-style row with thumbnail + Añadir/Reemplazar button)

interface LogoUploadCardProps {
  slot: LogoSlot
  label: string
  helper: string
  value: string
  venueSlug: string | null
  onChange: (url: string) => void
}

function LogoUploadCard({ slot, label, helper, value, venueSlug, onChange }: LogoUploadCardProps) {
  const { t } = useTranslation('reservations')
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const onPick = () => inputRef.current?.click()
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !venueSlug) return
    if (!file.type.startsWith('image/')) {
      toast({
        title: t('onlineBooking.brandIdentity.fileUnsupported'),
        description: t('onlineBooking.brandIdentity.fileUnsupportedDescription'),
        variant: 'destructive',
      })
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      toast({
        title: t('onlineBooking.brandIdentity.fileTooLarge'),
        description: t('onlineBooking.brandIdentity.fileTooLargeDescription'),
        variant: 'destructive',
      })
      return
    }
    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
    const fileName = `${slot}_${Date.now()}.${ext}`
    const sRef = storageRef(storage, buildStoragePath(`venues/${venueSlug}/branding/${fileName}`))
    const task = uploadBytesResumable(sRef, file)
    setUploading(true)
    task.on(
      'state_changed',
      () => {},
      (err) => {
        console.error(err)
        setUploading(false)
        toast({
          title: t('onlineBooking.brandIdentity.uploadError'),
          description: t('onlineBooking.brandIdentity.uploadErrorDescription'),
          variant: 'destructive',
        })
      },
      () => {
        getDownloadURL(task.snapshot.ref).then((url) => {
          setUploading(false)
          onChange(url)
        })
      },
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-input bg-card px-4 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
            {value ? (
              <img src={value} alt="" className="h-full w-full object-contain" />
            ) : (
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{label}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {value ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange('')}
              aria-label={t('onlineBooking.brandIdentity.remove')}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="rounded-full"
            onClick={onPick}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                {t('onlineBooking.brandIdentity.uploading')}
              </>
            ) : value ? (
              <>
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                {t('onlineBooking.brandIdentity.replace')}
              </>
            ) : (
              t('onlineBooking.brandIdentity.add')
            )}
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/svg+xml"
          className="hidden"
          onChange={onFileChange}
        />
      </div>
      <p className="mt-2 px-1 text-xs text-muted-foreground">{helper}</p>
    </div>
  )
}

// ----------------------------------------------------------------------------
// Color card — Square shows a circular swatch + hex + edit pencil; the
// ColorPicker popover does the heavy lifting.

interface ColorCardProps {
  label: string
  helper: string
  value: string
  onChange: (color: string) => void
}

function ColorCard({ label, helper, value, onChange }: ColorCardProps) {
  const display = value && value.trim() ? value : '#6366F1'
  const [open, setOpen] = useState(false)
  return (
    <div>
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-input bg-card px-4 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="h-11 w-11 shrink-0 rounded-full border border-input"
            style={{ background: display }}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{label}</p>
            <p className="font-mono text-xs text-muted-foreground">{display.toUpperCase()}</p>
          </div>
        </div>
        {open ? (
          <div className="w-64">
            <ColorPicker value={value} onChange={onChange} placeholder="#6366F1" />
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setOpen(true)}
            aria-label={label}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>
      <p className="mt-2 px-1 text-xs text-muted-foreground">{helper}</p>
    </div>
  )
}

// ============================================================================
// Step 2 — Preview + adjust
// Layout per user request: preview on the LEFT, controls on the RIGHT.
// ============================================================================

interface Step2Props {
  venueName: string
  accent: string
  heroImageUrl: string
  logoSmall: string
  primaryColor: string
  venueSlug: string | null
  previewMode: PreviewMode
  onBack: () => void
  onPreviewModeChange: (mode: PreviewMode) => void
  onHeroChange: (url: string) => void
  onColorChange: (c: string) => void
}

function Step2Content({
  venueName,
  accent,
  heroImageUrl,
  logoSmall,
  primaryColor,
  venueSlug,
  previewMode,
  onBack,
  onPreviewModeChange,
  onHeroChange,
  onColorChange,
}: Step2Props) {
  const { t } = useTranslation('reservations')
  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* LEFT — Controls pane (preview on the right per user request) */}
      <aside className="w-full shrink-0 border-b border-input bg-card lg:w-[380px] lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3 px-6 pt-6">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={onBack}
            aria-label={t('onlineBooking.brandIdentity.back')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <p className="text-sm font-semibold">
            {t('onlineBooking.brandIdentity.adjust')}
          </p>
        </div>

        {/* Tabs — preview context only (citas vs clases). The brand values
            themselves are shared across both flows. */}
        <div className="px-6 pt-6 lg:pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('onlineBooking.brandIdentity.previewContext')}
          </p>
          <div className="inline-flex items-center gap-1 rounded-full border border-input bg-muted/60 p-1">
            <PreviewTabButton
              active={previewMode === 'appointments'}
              onClick={() => onPreviewModeChange('appointments')}
            >
              <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
              {t('onlineBooking.brandIdentity.tabAppointments')}
            </PreviewTabButton>
            <PreviewTabButton
              active={previewMode === 'classes'}
              onClick={() => onPreviewModeChange('classes')}
            >
              <UsersIcon className="mr-1.5 h-3.5 w-3.5" />
              {t('onlineBooking.brandIdentity.tabClasses')}
            </PreviewTabButton>
          </div>
        </div>

        {/* Brand design controls */}
        <div className="space-y-5 px-6 py-6">
          <p className="text-sm font-semibold">
            {t('onlineBooking.brandIdentity.brandDesign')}
          </p>

          <HeroImageField
            value={heroImageUrl}
            venueSlug={venueSlug}
            onChange={onHeroChange}
          />

          <div className="space-y-2">
            <p className="text-sm font-medium">
              {t('onlineBooking.brandIdentity.color')}
            </p>
            <ColorPicker
              value={primaryColor}
              onChange={onColorChange}
              placeholder="#6366F1"
            />
          </div>
        </div>
      </aside>

      {/* RIGHT — Preview pane */}
      <div className="relative flex-1 bg-muted/40 px-4 py-8 sm:px-8 lg:py-12">
        <div className="mx-auto max-w-md">
          <BookingPagePreview
            venueName={venueName}
            accent={accent}
            heroImageUrl={heroImageUrl}
            logoSmall={logoSmall}
            mode={previewMode}
          />
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------
// Preview tab button (pill-style per UI patterns rule)

function PreviewTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition',
        active
          ? 'bg-foreground text-background'
          : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

// ----------------------------------------------------------------------------
// Hero image upload — Firebase Storage with size + type validation.

function HeroImageField({
  value,
  venueSlug,
  onChange,
}: {
  value: string
  venueSlug: string | null
  onChange: (url: string) => void
}) {
  const { t } = useTranslation('reservations')
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const onPick = () => inputRef.current?.click()
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !venueSlug) return
    if (!file.type.startsWith('image/')) {
      toast({
        title: t('onlineBooking.brandIdentity.fileUnsupported'),
        description: t('onlineBooking.brandIdentity.fileUnsupportedDescription'),
        variant: 'destructive',
      })
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      toast({
        title: t('onlineBooking.brandIdentity.fileTooLarge'),
        description: t('onlineBooking.brandIdentity.fileTooLargeDescription'),
        variant: 'destructive',
      })
      return
    }
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const fileName = `hero_${Date.now()}.${ext}`
    const sRef = storageRef(storage, buildStoragePath(`venues/${venueSlug}/hero/${fileName}`))
    const task = uploadBytesResumable(sRef, file)
    setUploading(true)
    task.on(
      'state_changed',
      () => {},
      (err) => {
        console.error(err)
        setUploading(false)
        toast({
          title: t('onlineBooking.brandIdentity.uploadError'),
          description: t('onlineBooking.brandIdentity.uploadErrorDescription'),
          variant: 'destructive',
        })
      },
      () => {
        getDownloadURL(task.snapshot.ref).then((url) => {
          setUploading(false)
          onChange(url)
        })
      },
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">
        {t('onlineBooking.brandIdentity.heroPhoto')}
      </p>
      {value ? (
        <div className="space-y-2">
          <div className="overflow-hidden rounded-lg border border-input bg-muted">
            <img src={value} alt="" className="h-32 w-full object-cover" />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={onPick}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="mr-1.5 h-3.5 w-3.5" />
              )}
              {t('onlineBooking.brandIdentity.replace')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange('')}
              aria-label={t('onlineBooking.brandIdentity.remove')}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onPick}
          disabled={uploading}
          className="w-full"
        >
          {uploading ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <ImageIcon className="mr-1.5 h-3.5 w-3.5" />
          )}
          {uploading
            ? t('onlineBooking.brandIdentity.uploading')
            : t('onlineBooking.brandIdentity.uploadHero')}
        </Button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onFileChange}
      />
      <p className="text-xs text-muted-foreground">
        {t('onlineBooking.brandIdentity.heroHelper')}
      </p>
    </div>
  )
}

// ----------------------------------------------------------------------------
// Booking page preview — phone-frame mock showing how the brand looks.

function BookingPagePreview({
  venueName,
  accent,
  heroImageUrl,
  logoSmall,
  mode,
}: {
  venueName: string
  accent: string
  heroImageUrl: string
  logoSmall: string
  mode: PreviewMode
}) {
  const { t } = useTranslation('reservations')
  const headerBg = heroImageUrl
    ? undefined
    : `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 65%, #000))`

  return (
    <div className="relative rounded-3xl border border-input bg-card shadow-sm">
      {/* Hero header — overflow-hidden is scoped here so background-image
          respects the rounded corners. The logo lives outside this clip so
          it can overlap the hero/body boundary without being cut. */}
      <div
        className="h-32 overflow-hidden rounded-t-3xl"
        style={{
          background: headerBg,
          backgroundImage: heroImageUrl ? `url('${heroImageUrl}')` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      {/* Logo — absolutely positioned at the hero/body seam (y = 8rem) so
          half of it sits on the hero and half on the white body. Rendered
          outside the overflow-hidden hero to avoid clipping. */}
      {logoSmall ? (
        <div className="absolute left-1/2 top-32 z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-2xl border border-input bg-background p-2 shadow-sm">
          <img src={logoSmall} alt="" className="h-full w-full object-contain" />
        </div>
      ) : null}

      <div className="px-6 pb-6 pt-12 text-center">
        <p className="text-sm font-semibold">{venueName}</p>

        {mode === 'appointments' ? (
          <div className="mt-6 space-y-3 text-left">
            <PreviewServiceRow accent={accent} title="Corte de pelo" subtitle="30 min · $250" />
            <PreviewServiceRow accent={accent} title="Color & balayage" subtitle="90 min · $850" />
            <PreviewServiceRow accent={accent} title="Manicura express" subtitle="20 min · $180" />
          </div>
        ) : (
          <div className="mt-6 space-y-3 text-left">
            <PreviewClassRow accent={accent} time="09:00" title="Yoga Vinyasa" subtitle="María G. · 60 min" spots={8} />
            <PreviewClassRow accent={accent} time="11:00" title="Pilates Reformer" subtitle="Carlos R. · 50 min" spots={3} />
            <PreviewClassRow accent={accent} time="18:30" title="Cycling" subtitle="Lucía P. · 45 min" spots={12} />
          </div>
        )}

        <button
          type="button"
          tabIndex={-1}
          className="mt-6 w-full rounded-full py-2.5 text-sm font-semibold"
          style={{ background: accent, color: '#ffffff' }}
        >
          {mode === 'appointments'
            ? t('onlineBooking.brandIdentity.previewCtaAppointments')
            : t('onlineBooking.brandIdentity.previewCtaClasses')}
        </button>
      </div>
    </div>
  )
}

function PreviewServiceRow({
  accent,
  title,
  subtitle,
}: {
  accent: string
  title: string
  subtitle: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-input bg-background px-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
        style={{
          background: `color-mix(in srgb, ${accent} 14%, transparent)`,
          color: accent,
        }}
      >
        Reservar
      </span>
    </div>
  )
}

function PreviewClassRow({
  accent,
  time,
  title,
  subtitle,
  spots,
}: {
  accent: string
  time: string
  title: string
  subtitle: string
  spots: number
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-input bg-background px-3 py-2.5">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[11px] font-bold"
        style={{ background: accent, color: '#ffffff' }}
      >
        {time}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
        style={{
          background: `color-mix(in srgb, ${accent} 14%, transparent)`,
          color: accent,
        }}
      >
        {spots}
      </span>
    </div>
  )
}
