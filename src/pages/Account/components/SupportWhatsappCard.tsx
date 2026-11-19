import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { isAxiosError } from 'axios'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { PhoneInput } from '@/components/phone-input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import * as service from '@/services/supportWhatsapp.service'
import { SupportDataSection } from './SupportDataSection'

export function SupportWhatsappCard({ staffId, onReauthenticate }: { staffId: string; onReauthenticate?: () => void }) {
  const { t } = useTranslation('account')
  const client = useQueryClient()
  const key = ['support-whatsapp', staffId]
  const alive = useRef(true)
  const submitting = useRef(false)
  const operation = useRef<{ phone: string; key: string } | null>(null)
  const [challenge, setChallenge] = useState<{ challengeId: string; expiresAt: string } | null>(null)
  const [error, setError] = useState('')
  const [reauth, setReauth] = useState(false)
  // The data section's error lives apart: the card's own steps never clear it, and the section never clears the card's.
  const [dataError, setDataError] = useState<{ text: string; reauth: boolean } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const schema = z.object({
    phone: z.string().regex(/^\+[1-9]\d{7,14}$/, t('supportWhatsapp.phoneError')),
    personalPhone: z.boolean().refine(value => value, t('supportWhatsapp.personalError')),
    code: z.string(),
  })
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { phone: '', personalPhone: false, code: '' },
  })
  const status = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => service.getSupportStatus(staffId, signal),
    retry: 1,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })
  const explain = (err: unknown) => {
    const data = isAxiosError(err) ? err.response?.data : null
    if (data?.code === 'SUPPORT_IDENTITY_CHANGED') void client.invalidateQueries({ queryKey: ['status'] })
    return {
      text: typeof data?.message === 'string' ? data.message : t('supportWhatsapp.requestError'),
      reauth: data?.code === 'SUPPORT_PERSONAL_SESSION_REQUIRED' || data?.code === 'SUPPORT_ACCESS_REVOKED',
    }
  }
  const fail = (err: unknown) => {
    if (!alive.current) return
    const { text, reauth } = explain(err)
    setReauth(reauth)
    setError(text)
  }
  const failData = (err: unknown) => {
    if (alive.current) setDataError(explain(err))
  }
  const request = useMutation({
    gcTime: 0,
    mutationFn: async () => {
      const phone = form.getValues('phone')
      if (operation.current?.phone !== phone) operation.current = { phone, key: crypto.randomUUID() }
      return service.requestSupportCode(staffId, { phone, operationKey: operation.current.key, personalPhone: true })
    },
    onSuccess: value => {
      if (alive.current) {
        setChallenge(value)
        setError('')
        form.setFocus('code')
      }
    },
    onError: fail,
    onSettled: () => {
      submitting.current = false
    },
    retry: false,
  })
  const verify = useMutation({
    gcTime: 0,
    mutationFn: () => service.verifySupportCode(staffId, { challengeId: challenge!.challengeId, code: form.getValues('code') }),
    onSuccess: async () => {
      if (!alive.current) return
      form.reset()
      operation.current = null
      setChallenge(null)
      setError('')
      await client.invalidateQueries({ queryKey: key })
    },
    onError: fail,
    onSettled: () => {
      submitting.current = false
    },
    retry: false,
  })
  const unlink = useMutation({
    gcTime: 0,
    mutationFn: () => service.unlinkSupportPhone(staffId),
    onSuccess: async () => {
      if (!alive.current) return
      setConfirmOpen(false)
      setChallenge(null)
      setError('')
      setDataError(null) // the section goes away with the link, and so does its error
      form.reset()
      operation.current = null
      // Only the status (T-F25, W4): the data section's reads, still mounted until it answers, would only get a 409 now.
      await client.invalidateQueries({ queryKey: key, exact: true })
    },
    onError: fail,
    onSettled: () => {
      submitting.current = false
    },
    retry: false,
  })
  useEffect(() => {
    if (isAxiosError(status.error) && status.error.response?.data?.code === 'SUPPORT_IDENTITY_CHANGED')
      void client.invalidateQueries({ queryKey: ['status'] })
  }, [status.error, client])
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      operation.current = null
      form.reset()
      void client.cancelQueries({ queryKey: ['support-whatsapp', staffId] })
      client.removeQueries({ queryKey: ['support-whatsapp', staffId] })
      request.reset()
      verify.reset()
      unlink.reset()
    }
    // This component is keyed by the confirmed person; its whole form is destroyed on identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffId, client])
  const busy = request.isPending || verify.isPending || unlink.isPending
  const supportNumber = status.data?.supportNumber ?? null
  return (
    <Card className="border-input" data-tour="support-whatsapp-card">
      <CardHeader>
        <CardTitle>{t('supportWhatsapp.title')}</CardTitle>
        <CardDescription>{t('supportWhatsapp.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">{t('supportWhatsapp.privacy')}</p>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <a href="https://avoqado.io/help" className="underline underline-offset-4">
            {t('supportWhatsapp.guides')}
          </a>
          <a href="mailto:hola@avoqado.io" className="underline underline-offset-4">
            {t('supportWhatsapp.contact')}
          </a>
          <a href="https://avoqado.io/privacy#soporte-whatsapp" className="underline underline-offset-4">
            {t('supportWhatsapp.privacyLink')}
          </a>
        </div>
        {status.isPending && <p role="status">{t('supportWhatsapp.loading')}</p>}
        {status.isError && (
          <div role="alert" className="space-y-2">
            <p>{t('supportWhatsapp.statusError')}</p>
            <Button variant="outline" onClick={() => void status.refetch()}>
              {t('supportWhatsapp.retry')}
            </Button>
            {onReauthenticate && (
              <Button variant="outline" onClick={onReauthenticate}>
                {t('supportWhatsapp.reauthenticate')}
              </Button>
            )}
          </div>
        )}
        {(error || dataError) && (
          <div role="alert" className="text-sm text-destructive space-y-2">
            {error && <p>{error}</p>}
            {dataError && <p>{dataError.text}</p>}
            {((!!error && reauth) || dataError?.reauth) && onReauthenticate && (
              <Button variant="outline" onClick={onReauthenticate}>
                {t('supportWhatsapp.reauthenticate')}
              </Button>
            )}
          </div>
        )}
        {status.data && !status.isError && (
          <>
            {!status.data.enabled && <p className="rounded-lg bg-muted p-4 text-sm">{t('supportWhatsapp.off')}</p>}
            {status.data.enabled && supportNumber && (
              <div className="flex flex-wrap items-center gap-3" data-tour="support-whatsapp-number">
                <p className="text-sm">
                  {t('supportWhatsapp.number')} <strong>{supportNumber.display}</strong>
                </p>
                <Button type="button" variant="outline" asChild>
                  {/* T-F25 (W5): with AYUDA already typed, like the landing's /wa. */}
                  <a href={`${supportNumber.waMe}?text=AYUDA`} target="_blank" rel="noopener noreferrer">
                    {t('supportWhatsapp.openWhatsapp')}
                  </a>
                </Button>
              </div>
            )}
            {status.data.linked ? (
              <>
                <div className="space-y-3" aria-live="polite">
                  <p>
                    {t('supportWhatsapp.linked')} <strong>{status.data.phone}</strong>
                  </p>
                  <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" disabled={busy} data-tour="support-whatsapp-unlink">
                        {t('supportWhatsapp.unlink')}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('supportWhatsapp.unlinkTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>{t('supportWhatsapp.unlinkDescription')}</AlertDialogDescription>
                      </AlertDialogHeader>
                      {/* T-F25 (W2): a failed unlink keeps the dialog open; its reason shows here, not behind it. */}
                      {error && (
                        <p role="alert" className="text-sm text-destructive">
                          {error}
                        </p>
                      )}
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={busy}>{t('supportWhatsapp.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                          disabled={busy}
                          onClick={event => {
                            event.preventDefault()
                            if (submitting.current) return
                            submitting.current = true
                            setError('')
                            unlink.mutate()
                          }}
                        >
                          {t('supportWhatsapp.confirmUnlink')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                {status.data.dataEnabled && <SupportDataSection staffId={staffId} onError={failData} onOk={() => setDataError(null)} />}
              </>
            ) : (
              status.data.enabled && (
                <Form {...form}>
                  <form
                    className="space-y-5"
                    data-tour="support-whatsapp-form"
                    onSubmit={event => {
                      if (busy || submitting.current) {
                        event.preventDefault()
                        return
                      }
                      // React's pending render happens after the next synchronous click.
                      submitting.current = true
                      if (challenge) {
                        event.preventDefault()
                        if (!/^\d{6}$/.test(form.getValues('code'))) {
                          submitting.current = false
                          form.setError('code', { message: t('supportWhatsapp.codeError') })
                          return
                        }
                        setError('')
                        verify.mutate()
                      } else
                        void form.handleSubmit(
                          () => {
                            setError('')
                            request.mutate()
                          },
                          () => {
                            submitting.current = false
                          },
                        )(event)
                    }}
                  >
                    {!challenge ? (
                      <>
                        <p className="rounded-lg bg-muted p-4 text-sm">{t('supportWhatsapp.start')}</p>
                        {/* T-F15: with the support's own number shown above, its button replaces this bridge link. */}
                        {!supportNumber && (
                          <Button type="button" variant="outline" asChild>
                            <a
                              href="https://avoqado.io/wa?intent=soporte"
                              target="_blank"
                              rel="noopener noreferrer"
                              data-tour="support-whatsapp-open-chat"
                            >
                              {t('supportWhatsapp.openChat')}
                            </a>
                          </Button>
                        )}
                        <FormField
                          control={form.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem data-tour="support-whatsapp-phone">
                              <FormLabel htmlFor="support-whatsapp-phone">{t('supportWhatsapp.phone')}</FormLabel>
                              <FormControl>
                                <PhoneInput id="support-whatsapp-phone" value={field.value} onChange={field.onChange} disabled={busy} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="personalPhone"
                          render={({ field }) => (
                            <FormItem className="flex items-start gap-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  id="support-whatsapp-personal"
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  disabled={busy}
                                  data-tour="support-whatsapp-personal"
                                />
                              </FormControl>
                              <div className="space-y-1">
                                <FormLabel htmlFor="support-whatsapp-personal">{t('supportWhatsapp.personal')}</FormLabel>
                                <FormMessage />
                              </div>
                            </FormItem>
                          )}
                        />
                        <Button type="submit" disabled={busy} data-tour="support-whatsapp-request">
                          {busy ? t('supportWhatsapp.working') : t('supportWhatsapp.request')}
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground">{t('supportWhatsapp.codeInstructions')}</p>
                        <FormField
                          control={form.control}
                          name="code"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('supportWhatsapp.code')}</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  inputMode="numeric"
                                  autoComplete="one-time-code"
                                  maxLength={6}
                                  disabled={busy}
                                  data-tour="support-whatsapp-code"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex flex-wrap gap-3">
                          <Button type="submit" disabled={busy} data-tour="support-whatsapp-verify">
                            {busy ? t('supportWhatsapp.working') : t('supportWhatsapp.verify')}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={busy}
                            onClick={() => {
                              setChallenge(null)
                              form.setValue('code', '')
                              operation.current = null
                              setError('')
                            }}
                          >
                            {t('supportWhatsapp.changePhone')}
                          </Button>
                        </div>
                      </>
                    )}
                  </form>
                </Form>
              )
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
