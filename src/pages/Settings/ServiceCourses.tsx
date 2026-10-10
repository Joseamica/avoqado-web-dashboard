import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, Building2, Clock, ExternalLink, Plus, RotateCcw, Store, Trash2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useCurrentOrganization } from '@/hooks/use-current-organization'
import { useToast } from '@/hooks/use-toast'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  canManageOrganizationCourses,
  courseValidation,
  getServiceCourses,
  normalizeCourses,
  saveServiceCourses,
  serviceCourseKey,
  type ServiceCourse,
  type ServiceCoursesRead,
  type ServiceCourseScope,
} from '@/services/serviceCourses.service'

function Confirm({
  open,
  title,
  body,
  confirm,
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  body: string
  confirm: string
  onClose: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation('serviceCourses')
  return (
    <AlertDialog open={open} onOpenChange={isOpen => !isOpen && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{confirm}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function CourseEditor({
  initial,
  context,
  pending,
  onClose,
  onSave,
  reload,
}: {
  initial: ServiceCoursesRead
  context: string
  pending: boolean
  onClose: () => void
  onSave: (revision: string, courses: ServiceCourse[]) => Promise<void>
  reload: () => Promise<ServiceCoursesRead>
}) {
  const { t } = useTranslation('serviceCourses')
  const [base, setBase] = useState(initial)
  const [draft, setDraft] = useState(() => initial.courses.map(c => ({ ...c })))
  const [error, setError] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const [confirm, setConfirm] = useState<'discard' | 'reload' | null>(null)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const dirty = JSON.stringify(base.courses) !== JSON.stringify(draft)
  const validation = courseValidation(draft, base.limits)
  const move = (index: number, offset: number) =>
    setDraft(list => {
      const copy = [...list]
      ;[copy[index], copy[index + offset]] = [copy[index + offset], copy[index]]
      return copy
    })
  const save = async () => {
    if (validation) return
    setError(null)
    try {
      await onSave(base.revision, normalizeCourses(draft))
      onClose()
    } catch (err) {
      setConflict((err as { response?: { status?: number } }).response?.status === 409)
      setError(t((err as { response?: { status?: number } }).response?.status === 409 ? 'conflict' : 'saveError'))
    }
  }
  const loadLatest = async () => {
    try {
      const latest = await reload()
      setBase(latest)
      setDraft(latest.courses.map(c => ({ ...c })))
      setError(null)
      setConflict(false)
      setConfirm(null)
    } catch {
      setError(t('loadError'))
      setConfirm(null)
    }
  }
  return (
    <>
      <FullScreenModal
        open
        onClose={() => !pending && (dirty ? setConfirm('discard') : onClose())}
        title={t('editTitle')}
        subtitle={context}
        actions={
          <Button onClick={save} disabled={pending || !!validation || !dirty || conflict} data-tour="service-courses-save">
            {t(pending ? 'saving' : 'save')}
          </Button>
        }
        contentClassName="px-4 py-8"
      >
        <div className="mx-auto max-w-3xl space-y-6">
          <p className="text-sm text-muted-foreground">{t(initial.venueId ? 'venueEditBody' : 'orgEditBody')}</p>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">{t('count', { count: draft.length, max: base.limits.maxCourses })}</p>
            <span className="text-xs text-muted-foreground">{t('labelLimit', { max: base.limits.maxLabelLength })}</span>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>
                <p role="alert">{error}</p>
                {conflict && (
                  <Button className="mt-3" variant="outline" onClick={() => setConfirm('reload')}>
                    {t('reviewLatest')}
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
          <div className="divide-y rounded-xl border border-border bg-card">
            {draft.map((course, index) => (
              <div className="flex items-start gap-3 p-4" key={course.id} data-testid="course-editor-row">
                <span className="mt-2.5 w-5 text-sm tabular-nums text-muted-foreground">{index + 1}</span>
                <div className="flex-1 space-y-2">
                  <Input
                    aria-label={t('courseName', { index: index + 1 })}
                    value={course.label}
                    maxLength={base.limits.maxLabelLength}
                    disabled={pending}
                    onChange={e => setDraft(list => list.map(c => (c.id === course.id ? { ...c, label: e.target.value } : c)))}
                  />
                  {course.kind === 'IMMEDIATE' && <p className="text-xs text-muted-foreground">{t('immediateMeaning')}</p>}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('moveUp', { name: course.label })}
                    disabled={pending || index <= 1}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('moveDown', { name: course.label })}
                    disabled={pending || index === 0 || index === draft.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('remove', { name: course.label })}
                    disabled={pending || course.kind === 'IMMEDIATE'}
                    onClick={() => setRemoveId(course.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {validation && (
            <p role="alert" className="text-sm text-destructive">
              {t(validation, { max: base.limits.maxCourses, length: base.limits.maxLabelLength })}
            </p>
          )}
          <Button
            variant="outline"
            disabled={pending || draft.length >= base.limits.maxCourses}
            onClick={() =>
              setDraft(list => [...list, { id: crypto.randomUUID(), label: t('newCourse', { index: list.length }), kind: 'STANDARD' }])
            }
            data-tour="service-courses-add"
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('add')}
          </Button>
          <p className="text-xs text-muted-foreground">{t('historical')}</p>
        </div>
      </FullScreenModal>
      <Confirm
        open={confirm !== null}
        title={t(confirm === 'reload' ? 'reloadTitle' : 'discardTitle')}
        body={t(confirm === 'reload' ? 'reloadBody' : 'discardBody')}
        confirm={t(confirm === 'reload' ? 'loadLatest' : 'discard')}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm === 'reload') void loadLatest()
          else onClose()
        }}
      />
      <Confirm
        open={removeId !== null}
        title={t('removeTitle')}
        body={t('historical')}
        confirm={t('removeConfirm')}
        onClose={() => setRemoveId(null)}
        onConfirm={() => {
          setDraft(list => list.filter(c => c.id !== removeId))
          setRemoveId(null)
        }}
      />
    </>
  )
}

export function ServiceCoursesContent({
  scope,
  canManage,
  organizationHref,
  returnHref,
}: {
  scope: ServiceCourseScope
  canManage: boolean
  organizationHref?: string
  returnHref?: string
}) {
  const { t } = useTranslation('serviceCourses')
  const client = useQueryClient()
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const query = useQuery({ queryKey: serviceCourseKey(scope), queryFn: () => getServiceCourses(scope), staleTime: 60_000, retry: false })
  const mutation = useMutation({
    mutationFn: ({ revision, courses }: { revision: string; courses: ServiceCourse[] | null }) =>
      saveServiceCourses(scope, revision, courses),
    onSuccess: saved => {
      client.setQueryData(serviceCourseKey(scope), saved)
      void client.invalidateQueries({
        predicate: cached => {
          if (cached.queryKey[0] !== 'service-courses' || cached.queryKey[2] === scope.id) return false
          const data = cached.state.data as ServiceCoursesRead | undefined
          return (
            data?.organizationId === saved.organizationId &&
            (scope.kind === 'venue' ? cached.queryKey[1] === 'organization' : cached.queryKey[1] === 'venue' && !data.hasOwnConfiguration)
          )
        },
      })
      toast({ title: t('saved') })
    },
  })
  const data = query.data
  const context = data ? (scope.kind === 'venue' ? `${data.organizationName} · ${data.venueName}` : data.organizationName) : ''
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-6" data-tour="service-courses-page">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            {scope.kind === 'venue' ? <Store className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
            <span>{t(scope.kind === 'venue' ? 'venueContext' : 'orgContext')}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t(scope.kind === 'venue' ? 'venueBody' : 'orgBody')}</p>
        </div>
        <Badge variant="outline">Pro</Badge>
      </div>
      {returnHref && (
        <Button variant="ghost" asChild>
          <Link to={returnHref}>{t('returnVenue')}</Link>
        </Button>
      )}
      {query.isLoading && (
        <p role="status" className="text-sm text-muted-foreground">
          {t('loading')}
        </p>
      )}
      {query.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            <p>{t('loadError')}</p>
            <Button variant="outline" className="mt-3" onClick={() => void query.refetch()}>
              {t('retry')}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {data && (
        <>
          <section className="space-y-4 rounded-xl border border-border bg-card p-5" data-testid="service-courses-context">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{context}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(scope.kind === 'organization' && data.source === 'ORGANIZATION' ? 'sharedList' : `source.${data.source}`)}
                </p>
              </div>
              {data.enabled && canManage && (
                <div className="flex gap-2">
                  <Button data-tour="service-courses-edit" onClick={() => setEditing(true)}>
                    {t(scope.kind === 'venue' && !data.hasOwnConfiguration ? 'customize' : 'edit')}
                  </Button>
                  {scope.kind === 'venue' && data.hasOwnConfiguration && (
                    <Button
                      variant="outline"
                      onClick={() => setRestoring(true)}
                      disabled={mutation.isPending}
                      data-tour="service-courses-inherit"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      {t('restore')}
                    </Button>
                  )}
                </div>
              )}
            </div>
            {scope.kind === 'organization' && (
              <p className="text-sm text-muted-foreground">
                {t('inheritCount', { count: data.inheritingVenues, total: data.totalVenues })}
              </p>
            )}
            {scope.kind === 'venue' && data.hasOwnConfiguration && <p className="text-sm text-muted-foreground">{t('overrideBody')}</p>}
            {!canManage && <p className="text-sm text-muted-foreground">{t('readOnly')}</p>}
          </section>
          {!data.enabled &&
            (scope.kind === 'venue' ? (
              <FeatureGate feature="TABLE_SERVICE" requiredTier="PRO">
                <CourseList courses={data.courses} />
              </FeatureGate>
            ) : (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>{t('orgProBody')}</AlertDescription>
              </Alert>
            ))}
          {(data.enabled || scope.kind === 'organization') && <CourseList courses={data.courses} />}
          {scope.kind === 'venue' && (
            <section className="rounded-xl border border-border bg-muted/30 p-5" data-tour="service-courses-organization-link">
              <p className="font-medium">{t('organizationTitle')}</p>
              <p className="mt-2 text-sm text-muted-foreground">{t('organizationBody')}</p>
              {organizationHref ? (
                <Button className="mt-4" variant="outline" asChild>
                  <Link to={organizationHref}>
                    {t('goOrganization')}
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">{t('organizationOwnerOnly')}</p>
              )}
            </section>
          )}
          <p className="text-sm text-muted-foreground">{t('comboBody')}</p>
          {mutation.isError && !editing && (
            <p role="alert" className="text-sm text-destructive">
              {t((mutation.error as { response?: { status?: number } }).response?.status === 409 ? 'conflict' : 'saveError')}
            </p>
          )}
          {editing && (
            <CourseEditor
              initial={data}
              context={context}
              pending={mutation.isPending}
              onClose={() => setEditing(false)}
              onSave={async (revision, courses) => {
                await mutation.mutateAsync({ revision, courses })
              }}
              reload={async () => {
                const result = await query.refetch()
                if (!result.data || result.error) throw result.error
                return result.data
              }}
            />
          )}
          <Confirm
            open={restoring}
            title={t('restoreTitle')}
            body={t('restoreBody')}
            confirm={t('restoreConfirm')}
            onClose={() => setRestoring(false)}
            onConfirm={() => {
              setRestoring(false)
              mutation.mutate({ revision: data.revision, courses: null })
            }}
          />
        </>
      )}
    </div>
  )
}

function CourseList({ courses }: { courses: ServiceCourse[] }) {
  const { t } = useTranslation('serviceCourses')
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 text-sm font-semibold">{t('effective')}</h2>
      <ol className="divide-y divide-border">
        {courses.map((c, index) => (
          <li key={c.id} className="flex items-center gap-4 py-4">
            <span className="w-5 text-sm tabular-nums text-muted-foreground">{index + 1}</span>
            <div>
              <p className="text-sm font-medium">{c.label}</p>
              {c.kind === 'IMMEDIATE' && <p className="mt-1 text-xs text-muted-foreground">{t('immediateMeaning')}</p>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default function VenueServiceCourses() {
  const { venueId, venue, fullBasePath, isLoading } = useCurrentVenue()
  const { basePath } = useCurrentOrganization({ includeVenues: false, fetchStats: false })
  const { can } = useAccess()
  const { user } = useAuth()
  const { t } = useTranslation('serviceCourses')
  if (!venueId || !venue) return <p className="p-6">{t(isLoading ? 'loading' : 'loadError')}</p>
  const href = canManageOrganizationCourses(user, venue.organizationId)
    ? `${basePath}/settings/service-courses?returnTo=${encodeURIComponent(`${fullBasePath}/settings/service-courses`)}`
    : undefined
  return (
    <ServiceCoursesContent
      key={venueId}
      scope={{ kind: 'venue', id: venueId }}
      canManage={can('settings:manage')}
      organizationHref={href}
    />
  )
}
