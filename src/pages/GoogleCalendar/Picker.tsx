import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, ArrowLeft, Calendar, CheckCircle2, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useToast } from '@/hooks/use-toast'
import googleCalendarService, { type CalendarPickerItem } from '@/services/googleCalendar.service'

// -----------------------------------------------------------------------------
// Google Calendar Picker — the page Google's redirect lands on after the
// `/oauth/callback` server-side endpoint issues a 303 with `?session=<token>`.
//
// The dashboard's auth cookie IS present here (Google redirects to our domain),
// so the `api` axios instance attaches credentials automatically. We:
//   1. Read the session token from the URL.
//   2. Ask the backend which calendars the user can pick (filtered by intent).
//   3. Let the user pick one, then POST /connections to commit.
//   4. Redirect back to /account where the connection card surfaces the new row.
//
// We don't try to be clever about return paths. The card lives in two places
// (Reservation Settings + Mi Cuenta), but both query the same `listConnections`
// endpoint. Sending the user to /account works for either origin because the
// venue card on the next page will re-fetch and render fresh state.
// -----------------------------------------------------------------------------

export default function GoogleCalendarPicker() {
  const { t } = useTranslation('googleCalendar')
  const { t: tCommon } = useTranslation()
  const { toast } = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const sessionToken = searchParams.get('session') ?? ''
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('')

  // ---------------------------------------------------------------------------
  // Calendar list — only fires when we actually have a session in the URL. The
  // `retry: false` keeps us from looping when the session is missing/expired:
  // a single 4xx surfaces the empty state below.
  // ---------------------------------------------------------------------------
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['google-calendar', 'picker', sessionToken],
    queryFn: () => googleCalendarService.listCalendars(sessionToken),
    enabled: !!sessionToken,
    retry: false,
  })

  const calendars: CalendarPickerItem[] = useMemo(() => data?.calendars ?? [], [data])

  // ---------------------------------------------------------------------------
  // Connect mutation — finalizes the connection on the backend. On success the
  // backend has already created the row + watch channel inside a transaction,
  // so all we do here is toast, invalidate listConnections, and navigate.
  // ---------------------------------------------------------------------------
  const connectMutation = useMutation({
    mutationFn: () => googleCalendarService.createConnection(sessionToken, selectedCalendarId),
    onSuccess: () => {
      toast({ title: t('toast.connected') })
      queryClient.invalidateQueries({ queryKey: ['google-calendar', 'connections'] })
      navigate('/account', { replace: true })
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: t('toast.connectFailed'),
        description: err?.response?.data?.message ?? undefined,
      })
    },
  })

  // ---------------------------------------------------------------------------
  // Error states — Google redirects us here even when the user denies consent
  // or when the session expires before they got back. Surface them clearly so
  // the user knows to retry from Mi Cuenta / Reservation Settings.
  // ---------------------------------------------------------------------------
  if (!sessionToken) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              {tCommon('error')}
            </CardTitle>
            <CardDescription>{t('picker.missingSession')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link to="/account">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('picker.back')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">{t('picker.loading')}</span>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              {tCommon('error')}
            </CardTitle>
            <CardDescription>
              {(error as any)?.response?.data?.message ?? t('picker.invalidSession')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link to="/account">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('picker.back')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <Calendar className="h-4 w-4" />
          <span className="text-sm">{t('title')}</span>
        </div>
        <h1 className="text-2xl font-semibold">{t('picker.title')}</h1>
        <p className="text-muted-foreground mt-1">{t('picker.description')}</p>
      </div>

      {calendars.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3 text-sm">
              <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-muted-foreground">{t('picker.noWritable')}</p>
            </div>
            <div className="mt-4">
              <Button asChild variant="outline">
                <Link to="/account">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {t('picker.back')}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            {/* Radix RadioGroup wraps the rows; each row is a tappable label so
                clicking anywhere on the calendar card selects it. */}
            <RadioGroup
              value={selectedCalendarId}
              onValueChange={setSelectedCalendarId}
              className="space-y-2"
            >
              {calendars.map(cal => {
                const isReadOnly = cal.accessRole === 'reader' || cal.accessRole === 'freeBusyReader'
                const itemId = `cal-${cal.id}`
                return (
                  <label
                    key={cal.id}
                    htmlFor={itemId}
                    className="flex items-start gap-3 rounded-md border border-input p-4 cursor-pointer hover:bg-muted/40 transition-colors data-[state=selected]:border-primary"
                    data-state={selectedCalendarId === cal.id ? 'selected' : undefined}
                  >
                    <RadioGroupItem value={cal.id} id={itemId} className="mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">
                          {cal.summary || cal.id}
                        </span>
                        {cal.primary && (
                          <Badge variant="secondary" className="text-[10px] py-0">
                            {t('picker.primaryBadge')}
                          </Badge>
                        )}
                        {isReadOnly && (
                          <Badge variant="outline" className="text-[10px] py-0">
                            {t('picker.readOnlyBadge')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{cal.timeZone}</p>
                    </div>
                  </label>
                )
              })}
            </RadioGroup>

            <div className="flex items-center justify-between gap-3 pt-6">
              <Button asChild variant="ghost">
                <Link to="/account">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {t('picker.back')}
                </Link>
              </Button>
              <Button
                onClick={() => connectMutation.mutate()}
                disabled={!selectedCalendarId || connectMutation.isPending}
              >
                {connectMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('picker.useThis')}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {t('picker.useThis')}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
