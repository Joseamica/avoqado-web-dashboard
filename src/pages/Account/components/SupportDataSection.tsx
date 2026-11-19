import { useEffect, useRef, useState } from 'react'
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { useDebounce } from '@/hooks/useDebounce'
import * as service from '@/services/supportWhatsapp.service'
import type { SupportDataAccess, SupportVenue } from '@/services/supportWhatsapp.service'

const PAGE = 50

/**
 * «Datos por WhatsApp»: el único lugar donde la persona da el permiso del día para una sucursal. Lo que dice sale siempre de
 * una respuesta del servidor, nunca de haber tocado: el positivo sólo con `accepted && unlocked`, la misma condición con la que
 * WhatsApp contesta.
 */
export function SupportDataSection({
  staffId,
  onError,
  onOk,
}: {
  staffId: string
  onError: (err: unknown) => void
  /** A tap the server answered, or a «Reintentar» that worked: the card clears the error this section raised. */
  onOk: () => void
}) {
  const { t, i18n } = useTranslation('account')
  const client = useQueryClient()
  const language: 'es' | 'en' = i18n.language?.startsWith('en') ? 'en' : 'es'
  const alive = useRef(true)
  const submitting = useRef(false)
  const [search, setSearch] = useState('')
  const debounced = useDebounce(search.trim(), 300)
  const [searchable, setSearchable] = useState(false)
  // What the person picked is kept as the row they had in hand, never re-derived from the visible (searched) page.
  const [picked, setPicked] = useState<SupportVenue | null>(null)
  // The notice on screen, ITS hash and the venue row it was opened for (its name is the dialog's «Sucursal:» line): «Aceptar»
  // sends exactly what the person read, even if the list is fetched again and reorders or renames under the open dialog.
  const [dialog, setDialog] = useState<{ notice: SupportDataAccess['notice']; venue: SupportVenue } | null>(null)
  const base = ['support-whatsapp', staffId, 'data']
  const accessKey = (venueId: string, lang: string) => [...base, 'access', venueId, lang]
  const venues = useInfiniteQuery({
    queryKey: [...base, 'venues', debounced],
    queryFn: ({ pageParam, signal }) =>
      service.listSupportVenues(staffId, { search: debounced || undefined, cursor: pageParam, limit: PAGE }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
    staleTime: 30000,
    retry: 1,
    refetchOnWindowFocus: false,
  })
  const first = venues.data?.pages[0]
  const items = [...new Map((venues.data?.pages ?? []).flatMap(page => page.items).map(v => [v.id, v] as const)).values()]
  const options = picked && !items.some(v => v.id === picked.id) ? [picked, ...items] : items
  // The row the select shows: a refetch may have refreshed the picked one (a rename), and the tap pins and names that copy.
  const current = (picked && (items.find(v => v.id === picked.id) ?? picked)) ?? items[0] ?? null
  // The search box shows once the first load WITHOUT a search had more pages, and stays (also while a search finds few).
  if (!searchable && !debounced && !venues.isPlaceholderData && first?.nextCursor) setSearchable(true)
  const access = useQuery({
    queryKey: accessKey(current?.id ?? '', language),
    queryFn: ({ signal }) => service.getSupportDataAccess(staffId, current!.id, language, signal),
    enabled: !!current,
    staleTime: 30000,
    retry: 1,
    // After midnight yesterday's unlock no longer counts: re-read when the person comes back to the tab, and every minute
    // while (and only while) it says «sí», so a tab left open overnight stops saying it. Hidden tabs never poll.
    refetchInterval: query => (query.state.status === 'success' && query.state.data?.accepted && query.state.data.unlocked ? 60000 : false),
  })
  const grant = useMutation({
    gcTime: 0,
    // The tapped row travels with the tap, so a reopened dialog names it; the POST carries only its id.
    mutationFn: ({ venue, ...body }: { venue: SupportVenue; noticeHash: string; language: 'es' | 'en'; acceptNotice: boolean }) =>
      service.grantSupportDataAccess(staffId, { venueId: venue.id, ...body }),
    onSuccess: (value, input) => {
      if (!alive.current) return
      client.setQueryData(accessKey(input.venue.id, input.language), value)
      onOk()
      // accepted: false = the notice changed between reading and tapping, or (one tap from a stale tab, T-B37) the acceptance no
      // longer counts for this link: ask again, with the notice the server sent, for the same venue.
      setDialog(value.accepted ? null : { notice: value.notice, venue: input.venue })
    },
    onError: (err, input) => {
      if (!alive.current) return
      setDialog(null)
      onError(err)
      // T-B29: nothing is sent again on its own. The POST may have landed and only its response got lost, so what the
      // section says next comes from reading the server again.
      void client.invalidateQueries({ queryKey: accessKey(input.venue.id, input.language) })
    },
    onSettled: () => {
      submitting.current = false
    },
    retry: false,
  })
  // acceptNotice (T-B37): only «Aceptar» in the dialog accepts the notice; the one tap only asks for today's unlock.
  const send = (venue: SupportVenue, noticeHash: string, acceptNotice: boolean) => {
    // React's pending render happens after the next synchronous click.
    if (submitting.current) return
    submitting.current = true
    grant.mutate({ venue, noticeHash, language, acceptNotice })
  }
  // Only a read the person is waiting for reports its error: the first one (of the list, a search, another venue's status), or
  // one they tap («Reintentar», «Ver más»). A read in the background (the minute poll, a focus, a reconnect, the re-read after
  // a failed tap) leaves what is on screen, or turns the status into «Reintentar»: nobody asked for it.
  useEffect(() => {
    if (venues.error && venues.data === undefined) onError(venues.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venues.error])
  useEffect(() => {
    if (access.error && access.data === undefined) onError(access.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access.error])
  // «Reintentar» is a request the person makes: its success clears the section's error, and its failure is reported (without
  // any data the effects above already report it).
  const retry = (refetch: () => Promise<{ isSuccess: boolean; data: unknown; error: unknown }>) =>
    void refetch().then(result => {
      if (!alive.current) return
      if (result.isSuccess) onOk()
      else if (result.data !== undefined) onError(result.error)
    })
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      // An unlink unmounts only this section: a later link must not show the old link's unlock from the cache.
      void client.cancelQueries({ queryKey: ['support-whatsapp', staffId, 'data'] })
      client.removeQueries({ queryKey: ['support-whatsapp', staffId, 'data'] })
    }
  }, [staffId, client])
  // Without any venue there is nothing to unlock.
  if (!debounced && !venues.isPlaceholderData && first?.total === 0) return null
  const data = access.data
  const busy = grant.isPending
  return (
    <section className="space-y-4 border-t border-border pt-5" data-tour="support-data-section" aria-labelledby="support-data-title">
      <h2 id="support-data-title" className="font-semibold leading-none tracking-tight">
        {t('supportWhatsapp.data.title')}
      </h2>
      {venues.isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          {t('supportWhatsapp.data.loading')}
        </p>
      )}
      {venues.isError && !venues.data && (
        <Button variant="outline" onClick={() => retry(venues.refetch)}>
          {t('supportWhatsapp.retry')}
        </Button>
      )}
      {venues.data && (
        <div className="space-y-2">
          <Label htmlFor="support-data-venue">{t('supportWhatsapp.data.venue')}</Label>
          {searchable && (
            <Input
              type="search"
              aria-label={t('supportWhatsapp.data.search')}
              placeholder={t('supportWhatsapp.data.search')}
              value={search}
              maxLength={200}
              disabled={busy}
              onChange={event => setSearch(event.target.value)}
            />
          )}
          {/* ponytail: <select> nativo; un combobox si alguien lo pide */}
          <select
            id="support-data-venue"
            data-tour="support-data-venue"
            value={current?.id ?? ''}
            disabled={busy}
            onChange={event => setPicked(options.find(v => v.id === event.target.value) ?? null)}
            className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-base text-foreground shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
          >
            {options.map(v => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          {debounced && !venues.isPlaceholderData && items.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('supportWhatsapp.data.noMatch')}</p>
          )}
          {!!first && first.total > items.length && (
            <p className="text-sm text-muted-foreground">
              {t('supportWhatsapp.data.showing', { shown: items.length, total: first.total })}
            </p>
          )}
          {venues.hasNextPage && (
            <Button
              variant="outline"
              size="sm"
              disabled={venues.isFetchingNextPage}
              onClick={() =>
                void venues.fetchNextPage().then(result => {
                  if (alive.current && result.isError) onError(result.error)
                })
              }
            >
              {t('supportWhatsapp.data.more')}
            </Button>
          )}
        </div>
      )}
      {current &&
        (access.isError ? (
          <Button variant="outline" onClick={() => retry(access.refetch)}>
            {t('supportWhatsapp.retry')}
          </Button>
        ) : data ? (
          <div className="space-y-3">
            <p aria-live="polite">
              {data.accepted && data.unlocked ? t('supportWhatsapp.data.on', { venue: data.venueName }) : t('supportWhatsapp.data.off')}
            </p>
            <Button
              disabled={busy}
              data-tour="support-data-unlock"
              onClick={() => {
                // Pin the venue on screen: a refetch that reorders the list while the dialog is open or the tap is pending
                // must not swap the select, so what the section shows next is the status of the venue being authorised.
                setPicked(current)
                if (data.accepted) send(current, data.notice.hash, false)
                else setDialog({ notice: data.notice, venue: current })
              }}
            >
              {busy ? t('supportWhatsapp.working') : t('supportWhatsapp.data.button')}
            </Button>
            <p className="text-sm text-muted-foreground">{t('supportWhatsapp.data.explain')}</p>
          </div>
        ) : (
          <p role="status" className="text-sm text-muted-foreground">
            {t('supportWhatsapp.data.loading')}
          </p>
        ))}
      <AlertDialog
        open={!!dialog}
        onOpenChange={open => {
          if (!open && !busy) setDialog(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('supportWhatsapp.data.noticeTitle')}</AlertDialogTitle>
            {/* The venue line is interface, not part of the notice (the hash «Aceptar» sends is still the one of the server's text
                alone), but it lives in the description so it is announced with the notice. Same spacing as the header's. */}
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                {dialog && (
                  <p className="font-medium text-foreground">{t('supportWhatsapp.data.noticeVenue', { venue: dialog.venue.name })}</p>
                )}
                <p className="whitespace-pre-line">{dialog?.notice.text}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t('supportWhatsapp.data.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              data-tour="support-data-accept"
              onClick={event => {
                event.preventDefault()
                if (dialog) send(dialog.venue, dialog.notice.hash, true)
              }}
            >
              {busy ? t('supportWhatsapp.working') : t('supportWhatsapp.data.accept')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
