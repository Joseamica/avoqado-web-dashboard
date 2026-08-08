import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { AlertCircle, CheckCircle2, Clock, ExternalLink, Info, Loader2, Upload, XCircle } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useVenueDateTime } from '@/utils/datetime'
import { REGIMEN_FISCAL_OPTIONS } from '@/pages/Cfdi/components/receptor-catalog'
import {
  ALLOWED_CONSTANCIA_TYPES,
  fiscalProfileService,
  type SatValidationField,
  type SatValidationResult,
  type VenueFiscalProfile,
} from '@/services/fiscalProfile.service'

// RFC: 3-4 letras + 6 dígitos + 3 caracteres de homoclave (12 morales, 13 físicas).
const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i
const MAX_CONSTANCIA_SIZE = 10 * 1024 * 1024 // 10MB, mirrors VenueDocuments

// Shape-only validation (mirrors avoqado-server's upsertFiscalProfileSchema). Business validity
// (RFC exists at SAT, régimen/CP match, etc.) is enforced by the backend — see `SatValidationResult`.
const fiscalProfileFormSchema = z.object({
  rfc: z
    .string()
    .trim()
    .min(1, 'El RFC es obligatorio.')
    .refine(v => RFC_REGEX.test(v), 'El RFC no tiene un formato válido.'),
  razonSocial: z.string().trim().min(1, 'La razón social es obligatoria.'),
  regimenFiscal: z.string().trim().regex(/^\d{3}$/, 'Selecciona un régimen fiscal.'),
  codigoPostal: z
    .string()
    .trim()
    .regex(/^\d{5}$/, 'El código postal debe tener 5 dígitos.'),
  email: z.union([z.string().trim().email('Correo electrónico inválido.'), z.literal('')]).optional(),
})

type FiscalProfileFormValues = z.infer<typeof fiscalProfileFormSchema>

const EMPTY_FORM_VALUES: FiscalProfileFormValues = {
  rfc: '',
  razonSocial: '',
  regimenFiscal: '',
  codigoPostal: '',
  email: '',
}

function FiscalProfileSkeleton() {
  return (
    <div className="container mx-auto pt-6 pb-20 px-3 md:px-4 grow overflow-auto">
      <div className="max-w-2xl">
        <Skeleton className="h-16 w-full mb-6 rounded-lg" />
        <Skeleton className="h-7 w-48 mb-2" />
        <Skeleton className="h-0.5 w-full mb-6" />
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Badge de `validationStatus`. `PENDING` (o sin perfil todavía) se pinta neutro. */
function ValidationStatusBadge({ status, validatedAt }: { status: VenueFiscalProfile['validationStatus'] | null; validatedAt: string | null }) {
  const { t } = useTranslation('venue')
  const { formatDate } = useVenueDateTime()

  if (status === 'VALID') {
    return (
      <Badge className="gap-1.5 border-transparent bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-950/50 dark:text-green-400">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {validatedAt ? t('edit.fiscal.statusValidAt', { date: formatDate(validatedAt) }) : t('edit.fiscal.statusValid')}
      </Badge>
    )
  }

  if (status === 'INVALID') {
    return (
      <Badge className="gap-1.5 border-transparent bg-destructive/10 text-destructive hover:bg-destructive/10">
        <XCircle className="h-3.5 w-3.5" />
        {t('edit.fiscal.statusInvalid')}
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="gap-1.5 text-muted-foreground">
      <Clock className="h-3.5 w-3.5" />
      {t('edit.fiscal.statusPending')}
    </Badge>
  )
}

export default function FiscalProfile() {
  const { t } = useTranslation(['venue', 'common'])
  const { venueId } = useCurrentVenue()
  const { can } = useAccess()
  const canEdit = can('venue-fiscal-profile:manage')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Errores del SAT sin campo específico (`field: 'otro'`) — no hay dónde pintarlos inline.
  const [otherErrors, setOtherErrors] = useState<string[]>([])
  // El PAC no respondió en el último intento de guardar. NUNCA se trata como rechazo.
  const [pacUnavailable, setPacUnavailable] = useState(false)
  const [uploadingConstancia, setUploadingConstancia] = useState(false)

  const queryKey = ['venue-fiscal-profile', venueId]

  const { data: profile, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => fiscalProfileService.getProfile(venueId!),
    enabled: !!venueId,
  })

  const form = useForm<FiscalProfileFormValues>({
    resolver: zodResolver(fiscalProfileFormSchema),
    defaultValues: EMPTY_FORM_VALUES,
  })

  // 🔴 Requisito no negociable: la razón social NUNCA se prellena con el nombre del venue.
  // Este componente ni siquiera consulta `venue.name` — el único origen de datos aquí es el
  // perfil fiscal (`profile`), que arranca vacío si el venue todavía no lo capturó.
  useEffect(() => {
    if (profile) {
      form.reset({
        rfc: profile.rfc,
        razonSocial: profile.razonSocial,
        regimenFiscal: profile.regimenFiscal,
        codigoPostal: profile.codigoPostal,
        email: profile.email ?? '',
      })
    } else {
      form.reset(EMPTY_FORM_VALUES)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  const saveMutation = useMutation({
    mutationFn: (values: FiscalProfileFormValues) =>
      fiscalProfileService.updateProfile(venueId!, {
        rfc: values.rfc.toUpperCase(),
        razonSocial: values.razonSocial.trim().toUpperCase(),
        regimenFiscal: values.regimenFiscal,
        codigoPostal: values.codigoPostal,
        email: values.email?.trim() ? values.email.trim() : undefined,
      }),
    onSuccess: result => {
      queryClient.setQueryData(queryKey, result.profile)
      form.reset({
        rfc: result.profile.rfc,
        razonSocial: result.profile.razonSocial,
        regimenFiscal: result.profile.regimenFiscal,
        codigoPostal: result.profile.codigoPostal,
        email: result.profile.email ?? '',
      })

      applyValidationResult(result.validation)
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: t('edit.fiscal.saveErrorTitle'),
        description: error?.response?.data?.message || error?.response?.data?.error || 'Intenta de nuevo.',
      })
    },
  })

  // 🔴 Requisito no negociable: `validation === null` = "no se pudo validar" (PAC caído),
  // NUNCA "inválido". No se marca ningún campo y sólo se muestra un aviso suave.
  function applyValidationResult(validation: SatValidationResult | null) {
    setOtherErrors([])

    if (validation === null) {
      setPacUnavailable(true)
      toast({
        title: t('edit.fiscal.saveSuccessPacDownTitle'),
        description: t('edit.fiscal.saveSuccessPacDownDesc'),
      })
      return
    }

    setPacUnavailable(false)

    if (validation.valid) {
      toast({
        title: t('edit.fiscal.saveSuccessValidTitle'),
        description: t('edit.fiscal.saveSuccessValidDesc'),
      })
      return
    }

    const general: string[] = []
    validation.errors.forEach(err => {
      if (err.field === 'otro') {
        general.push(err.message)
      } else {
        form.setError(err.field as Exclude<SatValidationField, 'otro'>, { type: 'server', message: err.message })
      }
    })
    setOtherErrors(general)

    toast({
      variant: 'destructive',
      title: t('edit.fiscal.saveSuccessInvalidTitle'),
      description: t('edit.fiscal.saveSuccessInvalidDesc'),
    })
  }

  const uploadConstanciaMutation = useMutation({
    mutationFn: (file: File) => fiscalProfileService.uploadConstancia(venueId!, file),
    onMutate: () => setUploadingConstancia(true),
    onSuccess: updated => {
      queryClient.setQueryData(queryKey, updated)
      toast({
        title: t('edit.fiscal.constanciaUploadSuccess'),
        description: t('edit.fiscal.constanciaUploadSuccessDesc'),
      })
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: t('edit.fiscal.constanciaUploadError'),
        description: error?.response?.data?.error || error?.response?.data?.message || 'Intenta de nuevo.',
      })
    },
    onSettled: () => setUploadingConstancia(false),
  })

  const handleConstanciaChange = (file: File | null) => {
    if (!file) return

    if (!ALLOWED_CONSTANCIA_TYPES.includes(file.type as (typeof ALLOWED_CONSTANCIA_TYPES)[number])) {
      toast({ variant: 'destructive', title: t('edit.fiscal.invalidFileType') })
      return
    }
    if (file.size > MAX_CONSTANCIA_SIZE) {
      toast({ variant: 'destructive', title: t('edit.fiscal.fileTooLarge') })
      return
    }

    uploadConstanciaMutation.mutate(file)
  }

  const onSubmit = (values: FiscalProfileFormValues) => {
    saveMutation.mutate(values)
  }

  if (!venueId || isLoading) return <FiscalProfileSkeleton />

  // 🔴 Requisito no negociable: si el GET falla, NUNCA mostrar el formulario vacío — se
  // vería idéntico a "todavía no he capturado mis datos" e invitaría a sobrescribir un
  // perfil ya válido con datos tecleados de memoria (el mismo tipo de accidente que
  // originó este proyecto).
  if (isError) {
    return (
      <div className="container mx-auto pt-6 pb-20 px-4 md:px-6 lg:px-8 grow overflow-auto">
        <div className="max-w-3xl mx-auto">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t('edit.fiscal.loadError')}</AlertTitle>
          </Alert>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto pt-6 pb-20 px-4 md:px-6 lg:px-8 grow overflow-auto">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Requisito 1: aviso visible arriba — la confusión más probable de la pantalla */}
        <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/50">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertTitle className="font-semibold text-blue-800 dark:text-blue-200">{t('edit.fiscal.noticeTitle')}</AlertTitle>
          <AlertDescription className="text-blue-700 dark:text-blue-300">{t('edit.fiscal.noticeBody')}</AlertDescription>
        </Alert>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">{t('edit.fiscal.title')}</h3>
            <p className="text-sm text-muted-foreground">{t('edit.fiscal.subtitle')}</p>
          </div>
          <ValidationStatusBadge status={profile?.validationStatus ?? null} validatedAt={profile?.validatedAt ?? null} />
        </div>
        <Separator />

        {/* Requisito 4: `validation === null` — aviso suave, nunca un rechazo */}
        {pacUnavailable && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{t('edit.fiscal.pacDownNotice')}</AlertDescription>
          </Alert>
        )}

        {otherErrors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t('edit.fiscal.otherErrorsTitle')}</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {otherErrors.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {!canEdit && (
          <div className="rounded-md border border-border bg-muted/40 text-muted-foreground text-sm px-4 py-3">
            {t('edit.readOnly')}
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <fieldset disabled={!canEdit || saveMutation.isPending} className={!canEdit ? 'opacity-80' : undefined}>
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="rfc"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('edit.fiscal.labels.rfc')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          onChange={e => field.onChange(e.target.value.toUpperCase())}
                          placeholder={t('edit.fiscal.placeholders.rfc')}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="razonSocial"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('edit.fiscal.labels.razonSocial')}</FormLabel>
                      <FormControl>
                        {/* Requisito 2: NUNCA se prellena con el nombre del venue — ver el useEffect de arriba */}
                        <Input {...field} placeholder={t('edit.fiscal.placeholders.razonSocial')} />
                      </FormControl>
                      <FormDescription>{t('edit.fiscal.descriptions.razonSocial')}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="regimenFiscal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('edit.fiscal.labels.regimenFiscal')}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('edit.fiscal.placeholders.regimenFiscal')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {REGIMEN_FISCAL_OPTIONS.map(option => (
                              <SelectItem key={option.code} value={option.code}>
                                {option.code} — {option.description}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="codigoPostal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('edit.fiscal.labels.codigoPostal')}</FormLabel>
                        <FormControl>
                          <Input {...field} inputMode="numeric" maxLength={5} placeholder={t('edit.fiscal.placeholders.codigoPostal')} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('edit.fiscal.labels.email')}</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder={t('edit.fiscal.placeholders.email')} />
                      </FormControl>
                      <FormDescription>{t('edit.fiscal.descriptions.email')}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="pt-6">
                <Button type="submit" disabled={!canEdit || saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {saveMutation.isPending ? t('edit.fiscal.saving') : t('edit.fiscal.save')}
                </Button>
              </div>
            </fieldset>
          </form>
        </Form>

        {/* Constancia — respaldo opcional del documento oficial */}
        <div className="pt-4 mt-4 border-t border-border">
          <div className="space-y-1 mb-4">
            <h4 className="text-base font-semibold">{t('edit.fiscal.constanciaTitle')}</h4>
            <p className="text-sm text-muted-foreground">{t('edit.fiscal.constanciaDesc')}</p>
          </div>

          <input
            type="file"
            id="fiscal-constancia-input"
            accept=".pdf,.png,.jpg,.jpeg"
            className="hidden"
            onChange={e => {
              handleConstanciaChange(e.target.files?.[0] || null)
              e.target.value = ''
            }}
          />

          <div className="flex flex-wrap items-center gap-3">
            {profile?.constanciaUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={profile.constanciaUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  {t('edit.fiscal.constanciaView')}
                </a>
              </Button>
            )}
            <Button
              type="button"
              variant={profile?.constanciaUrl ? 'ghost' : 'outline'}
              size="sm"
              disabled={!canEdit || !profile || uploadingConstancia}
              onClick={() => document.getElementById('fiscal-constancia-input')?.click()}
            >
              {uploadingConstancia ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('edit.fiscal.constanciaUploading')}
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  {profile?.constanciaUrl ? t('edit.fiscal.constanciaChange') : t('edit.fiscal.constanciaUpload')}
                </>
              )}
            </Button>
            {!profile && <p className="text-xs text-muted-foreground">{t('edit.fiscal.constanciaNeedsProfileFirst')}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
