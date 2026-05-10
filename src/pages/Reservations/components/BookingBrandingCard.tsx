import { useEffect, useRef, useState } from 'react'
import api from '@/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { ColorPicker } from '@/components/ui/color-picker'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { Image as ImageIcon, Loader2, Trash2, Upload } from 'lucide-react'
import { storage, buildStoragePath } from '@/firebase'
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage'

/**
 * Self-contained branding card for the public booking page.
 *
 * Lives inside Reservaciones → Online Booking because hero photo + brand
 * color are specific to the customer-facing booking experience, not the
 * venue's general identity (logo lives in Venue → Edit). This card lets
 * the venue admin edit + preview both fields without leaving the
 * Reservaciones context where they're configuring the booking flow.
 *
 * Mutates via PUT /api/v1/dashboard/venues/:id (same endpoint
 * ContactImages.tsx already uses) so there's no new server work needed.
 */
export function BookingBrandingCard() {
  const { venueId, venueSlug } = useCurrentVenue()
  const { toast } = useToast()
  const qc = useQueryClient()

  const { data: venue } = useQuery({
    queryKey: ['get-venue-data', venueId],
    queryFn: async () => {
      const res = await api.get(`/api/v1/dashboard/venues/${venueId}`)
      return res.data
    },
    enabled: !!venueId,
  })

  const [heroImageUrl, setHeroImageUrl] = useState<string>('')
  const [primaryColor, setPrimaryColor] = useState<string>('')
  const [dirty, setDirty] = useState(false)

  // Sync local form state with the fetched venue when it loads or changes.
  useEffect(() => {
    if (!venue) return
    setHeroImageUrl(venue.heroImageUrl ?? '')
    setPrimaryColor(venue.primaryColor ?? '')
    setDirty(false)
  }, [venue])

  const saveMutation = useMutation({
    mutationFn: async () => {
      return api.put(`/api/v1/dashboard/venues/${venueId}`, {
        heroImageUrl: heroImageUrl || null,
        primaryColor: primaryColor || null,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['get-venue-data', venueId] })
      setDirty(false)
      toast({
        title: 'Personalización guardada',
        description: 'Los cambios ya se aplican en book.avoqado.io.',
      })
    },
    onError: () => {
      toast({
        title: 'Error al guardar',
        description: 'Inténtalo de nuevo en un momento.',
        variant: 'destructive',
      })
    },
  })

  // Hero photo upload to Firebase Storage — mirrors the logo cropper's path
  // scheme but skips the cropper UI for now; admins crop client-side.
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const onPickFile = () => fileInputRef.current?.click()
  const onFileChange = (e: any) => {
    const file: File | undefined = e?.target?.files?.[0]
    e.target.value = ''
    if (!file || !venueSlug) return
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Archivo no soportado', description: 'Selecciona JPG, PNG o WebP.', variant: 'destructive' })
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: 'Imagen muy grande', description: 'Máximo 8 MB.', variant: 'destructive' })
      return
    }
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const fileName = `hero_${Date.now()}.${ext}`
    const storageRef = ref(storage, buildStoragePath(`venues/${venueSlug}/hero/${fileName}`))
    const uploadTask = uploadBytesResumable(storageRef, file)
    setUploading(true)
    uploadTask.on(
      'state_changed',
      () => {},
      (err) => {
        console.error(err)
        setUploading(false)
        toast({ title: 'Error al subir', description: 'Intenta de nuevo.', variant: 'destructive' })
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then((url) => {
          setUploading(false)
          setHeroImageUrl(url)
          setDirty(true)
          toast({ title: 'Foto subida', description: 'Recuerda guardar para aplicar el cambio.' })
        })
      },
    )
  }

  const accent = (primaryColor && primaryColor.trim()) || '#6366F1'
  const isHexish = /^#?([0-9a-fA-F]{3,8})$/.test(accent)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Personalización de marca</CardTitle>
        <CardDescription>
          Foto de portada y color de marca que aparecen en{' '}
          <span className="font-mono text-xs">book.avoqado.io/{venueSlug ?? '<slug>'}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Hero photo */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Foto de portada</Label>
          {heroImageUrl ? (
            <div className="space-y-2">
              <div className="rounded-lg overflow-hidden border border-border bg-muted">
                <img
                  src={heroImageUrl}
                  alt=""
                  className="w-full max-h-48 object-cover"
                  onError={(e) => {
                    ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onPickFile} disabled={uploading}>
                  {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                  {uploading ? 'Subiendo…' : 'Reemplazar foto'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setHeroImageUrl('')
                    setDirty(true)
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Quitar
                </Button>
              </div>
            </div>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={onPickFile} disabled={uploading}>
              {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ImageIcon className="w-4 h-4 mr-1" />}
              {uploading ? 'Subiendo…' : 'Subir foto'}
            </Button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onFileChange}
          />
          <details className="mt-1">
            <summary className="text-xs text-muted-foreground cursor-pointer">Pegar URL en lugar de subir</summary>
            <Input
              type="url"
              placeholder="https://cdn.tu-marca.com/hero.jpg"
              className="mt-2"
              value={heroImageUrl}
              onChange={(e) => {
                setHeroImageUrl(e.target.value)
                setDirty(true)
              }}
            />
          </details>
          <p className="text-xs text-muted-foreground">
            16:9 recomendado, mín. 1200px de ancho. Aparece como hero en book.avoqado.io.
          </p>
        </div>

        {/* Brand color */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Color de marca</Label>
          <ColorPicker
            placeholder="#6366F1"
            value={primaryColor}
            onChange={(value) => {
              setPrimaryColor(value)
              setDirty(true)
            }}
          />
          <p className="text-xs text-muted-foreground">
            Se usa como acento en botones, badges y enlaces del widget de reservas.
          </p>
        </div>

        {/* Live preview */}
        <div className="rounded-xl border border-border bg-muted/40 overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-muted/60 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
              Vista previa en book.avoqado.io
            </span>
            <span className="text-[10px] font-mono text-muted-foreground/80">
              {isHexish ? accent : 'usando default'}
            </span>
          </div>
          <div className="p-4 space-y-3">
            <div
              className="relative w-full h-24 rounded-lg overflow-hidden flex items-end p-3"
              style={{
                backgroundImage: heroImageUrl
                  ? `linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(0,0,0,0.6) 100%), url('${heroImageUrl}')`
                  : `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 65%, #000))`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              <span className="font-semibold text-sm" style={{ color: '#ffffff', textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
                {venue?.name ?? 'Tu venue'}
              </span>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-background border border-border p-3">
              <div
                className="w-9 h-9 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0"
                style={{ background: accent, color: '#ffffff' }}
              >
                09:00
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground truncate">Yoga Vinyasa</div>
                <div className="text-[11px] text-muted-foreground truncate">María G. · 60 min</div>
              </div>
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                style={{
                  background: `color-mix(in srgb, ${accent} 14%, transparent)`,
                  color: accent,
                }}
              >
                8 disponibles
              </span>
            </div>
            <button
              type="button"
              tabIndex={-1}
              className="w-full text-center py-2.5 text-sm font-semibold text-white rounded-md cursor-default"
              style={{ background: accent }}
            >
              Reservar lugar
            </button>
          </div>
        </div>

        {/* Save bar */}
        <div className="flex items-center gap-2 pt-2">
          <Button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={!dirty || saveMutation.isPending}
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
            {saveMutation.isPending ? 'Guardando…' : 'Guardar cambios'}
          </Button>
          {dirty && !saveMutation.isPending && (
            <span className="text-xs text-muted-foreground">Tienes cambios sin guardar</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
