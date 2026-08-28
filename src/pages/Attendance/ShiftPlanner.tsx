import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Loader2, Plus, PowerOff } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { attendanceService, type WorkShiftAssignment, type WorkShiftTemplate, type WorkShiftTemplateInput } from '@/services/attendance.service'
import { teamService } from '@/services/team.service'
import { LoadError } from './PunctualityReport'
import { crossesMidnight, shiftWeek, shiftWeekOffset, type ShiftWeek } from './shiftWeek'

/**
 * Turnos ROTATIVOS (fase 1 "como Sesame"): plantillas de turno + cuadrante semanal persona×día que
 * se arma en BORRADOR y se PUBLICA. Convive con la jornada fija de cada persona (WorkScheduleSection):
 * la asignación publicada gana sobre la jornada fija; una excepción manual (vacaciones) gana sobre
 * las dos. Sólo cuenta si el negocio prendió el interruptor en Ajustes — apagado se VE y se EXPLICA.
 */
interface Props {
  venueId: string
  todayIso: string
  enabled: boolean
  canManage: boolean
  settingsPath: string
}

type Draft = Record<string, string | null> // `${staffVenueId}|${date}` → templateId | null (vaciar)

const cellKey = (staffVenueId: string, date: string) => `${staffVenueId}|${date}`

export function ShiftPlanner({ venueId, todayIso, enabled, canManage, settingsPath }: Props) {
  const { t, i18n } = useTranslation('attendance')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [week, setWeek] = useState<ShiftWeek>(() => shiftWeek(todayIso))
  const [draft, setDraft] = useState<Draft>({})
  const [editing, setEditing] = useState<Partial<WorkShiftTemplate> | null>(null)

  useEffect(() => setDraft({}), [week.from])

  const templatesQ = useQuery({
    queryKey: ['work-shift-templates', venueId],
    queryFn: () => attendanceService.getWorkShiftTemplates(venueId, true),
    enabled,
  })
  // El servidor limita `pageSize` a 100 (visto en /full-testing: 200 daba 400). Se pide por páginas
  // hasta traer a todo el equipo — un cuadrante con la mitad del personal miente.
  const teamQ = useQuery({
    queryKey: ['team', venueId, 'shift-planner'],
    queryFn: async () => {
      const first = await teamService.getTeamMembers(venueId, 1, 100)
      const all = [...first.data]
      const totalPages = first.meta?.totalPages ?? 1
      for (let page = 2; page <= totalPages; page++) {
        const next = await teamService.getTeamMembers(venueId, page, 100)
        all.push(...next.data)
      }
      return { data: all }
    },
    enabled,
  })
  const assignmentsQ = useQuery({
    queryKey: ['work-shift-assignments', venueId, week.from, week.to],
    queryFn: () => attendanceService.getWorkShiftAssignments(venueId, week.from, week.to),
    enabled,
  })

  const templates = useMemo(() => templatesQ.data ?? [], [templatesQ.data])
  const activeTemplates = useMemo(() => templates.filter(x => x.active), [templates])
  const members = useMemo(() => (teamQ.data?.data ?? []).filter(m => m.active), [teamQ.data])
  // Por celda conviven una fila PUBLISHED y una DRAFT (Codex, 2ª auditoría): el borrador NO despublica.
  const byCell = useMemo(() => {
    const map = new Map<string, { published?: WorkShiftAssignment; draft?: WorkShiftAssignment }>()
    for (const a of assignmentsQ.data ?? []) {
      const key = cellKey(a.staffVenueId, a.date)
      const cell = map.get(key) ?? {}
      if (a.status === 'DRAFT') cell.draft = a
      else cell.published = a
      map.set(key, cell)
    }
    return map
  }, [assignmentsQ.data])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['work-shift-assignments', venueId] })
    queryClient.invalidateQueries({ queryKey: ['work-shift-templates', venueId] })
  }
  const fail = (error: any) =>
    toast({ title: t('shifts.toastError'), description: error?.response?.data?.message ?? error?.message, variant: 'destructive' })

  const saveDraft = useMutation({
    mutationFn: (): Promise<WorkShiftAssignment[]> =>
      attendanceService.replaceWorkShiftAssignments(venueId, {
        from: week.from,
        to: week.to,
        items: Object.entries(draft).map(([key, templateId]) => {
          const [staffVenueId, date] = key.split('|')
          return { staffVenueId, date, templateId }
        }),
      }),
    onSuccess: () => {
      setDraft({})
      invalidate()
      toast({ title: t('shifts.toastDraftSaved') })
    },
    onError: fail,
  })
  const publish = useMutation({
    mutationFn: async () => {
      // Se publica SÓLO lo que esta pantalla REVISÓ (los ids de los borradores que tiene enfrente);
      // un borrador que otro gerente guardó después no se publica a ciegas (Codex, 2ª auditoría).
      // Sólo lo que ESTA pantalla revisó: los borradores que ya tenía cargados + las celdas que acaba de
      // editar. Un borrador ajeno que venga en la respuesta del guardado no se publica (Codex 3ª). Cada uno
      // viaja con su revisión (`updatedAt`): si alguien lo cambió por debajo, el server contesta 409.
      const known = new Set((assignmentsQ.data ?? []).filter(a => a.status === 'DRAFT').map(a => a.id))
      const editedKeys = new Set(Object.keys(draft))
      const rows = Object.keys(draft).length ? await saveDraft.mutateAsync() : (assignmentsQ.data ?? [])
      const drafts = rows
        .filter(a => a.status === 'DRAFT' && (known.has(a.id) || editedKeys.has(cellKey(a.staffVenueId, a.date))))
        .map(a => ({ id: a.id, updatedAt: a.updatedAt }))
      return attendanceService.publishWorkShiftAssignments(venueId, { from: week.from, to: week.to, drafts })
    },
    onSuccess: r => {
      invalidate()
      toast({ title: t('shifts.toastPublished', { count: r.published + r.cleared }) })
      if (r.skipped > 0) toast({ title: t('shifts.toastSkipped', { count: r.skipped }), variant: 'destructive' })
    },
    onError: (error: any) => {
      if (error?.response?.status === 409) {
        // alguien cambió un borrador que tenías enfrente: se recarga y se enseña antes de volver a publicar
        invalidate()
        toast({ title: t('shifts.toastConflict'), description: error?.response?.data?.message, variant: 'destructive' })
        return
      }
      fail(error)
    },
  })
  const saveTemplate = useMutation({
    mutationFn: (input: Partial<WorkShiftTemplate>) =>
      input.id
        ? attendanceService.updateWorkShiftTemplate(venueId, input.id, input as Partial<WorkShiftTemplateInput> & { active?: boolean })
        : attendanceService.createWorkShiftTemplate(venueId, input as WorkShiftTemplateInput),
    onSuccess: () => {
      setEditing(null)
      invalidate()
      toast({ title: t('shifts.toastTemplateSaved') })
    },
    onError: fail,
  })

  if (!enabled) {
    return (
      <Card className="border-amber-500/40" role="status">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <PowerOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="space-y-0.5">
              <p className="text-sm font-medium">{t('shifts.disabled.title')}</p>
              <p className="text-sm text-muted-foreground">{t('shifts.disabled.description')}</p>
            </div>
          </div>
          <Link to={settingsPath} className="text-sm font-medium underline underline-offset-4 shrink-0">
            {t('shifts.disabled.cta')}
          </Link>
        </CardContent>
      </Card>
    )
  }

  const dayLabel = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return new Intl.DateTimeFormat(i18n.language, { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)))
  }
  const dirty = Object.keys(draft).length > 0
  const hasDrafts = (assignmentsQ.data ?? []).some(a => a.status === 'DRAFT')
  // Cambiar de semana con cambios sin guardar los tiraba en silencio (Codex P2): se bloquea y se ofrece descartar.
  const goWeek = (delta: number) => {
    if (dirty) return
    setWeek(w => shiftWeekOffset(w, delta))
  }

  return (
    <div className="space-y-4">
      {/* Plantillas */}
      <Card className="border-input">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{t('shifts.templates.title')}</p>
              <p className="text-xs text-muted-foreground">{t('shifts.templates.description')}</p>
            </div>
            {canManage && (
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => setEditing({ name: '', abbreviation: '', color: '#7ADD2C', startTime: '09:00', endTime: '17:00', active: true })}>
                <Plus className="mr-1 h-4 w-4" />
                {t('shifts.templates.new')}
              </Button>
            )}
          </div>
          {templatesQ.isLoading ? (
            <p className="text-sm text-muted-foreground">{t('loading')}</p>
          ) : templatesQ.isError ? (
            <LoadError t={t} onRetry={() => templatesQ.refetch()} />
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('shifts.templates.empty')}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {templates.map(tpl => (
                <button
                  key={tpl.id}
                  type="button"
                  disabled={!canManage}
                  onClick={() => setEditing(tpl)}
                  className={`flex items-center gap-2 rounded-full border border-input px-3 py-1.5 text-sm ${tpl.active ? '' : 'opacity-50 line-through'}`}
                >
                  <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: tpl.color }} />
                  <span className="font-medium">{tpl.name}</span>
                  <span className="text-muted-foreground">
                    {tpl.startTime}–{tpl.endTime}
                    {crossesMidnight(tpl.startTime, tpl.endTime) ? ' +1' : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cuadrante semanal */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="rounded-full" disabled={dirty} onClick={() => goWeek(-1)} aria-label={t('shifts.week.prev')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium tabular-nums">{t('shifts.week.label', { from: dayLabel(week.from), to: dayLabel(week.to) })}</span>
          <Button variant="outline" size="icon" className="rounded-full" disabled={dirty} onClick={() => goWeek(1)} aria-label={t('shifts.week.next')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {hasDrafts && (
            <Badge variant="outline" className="rounded-full">
              {t('shifts.week.hasDrafts')}
            </Badge>
          )}
          {dirty && canManage && (
            <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setDraft({})}>
              {t('shifts.week.discard')}
            </Button>
          )}
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-full" disabled={!dirty || saveDraft.isPending} onClick={() => saveDraft.mutate()}>
              {saveDraft.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('shifts.week.saveDraft')}
            </Button>
            <Button className="rounded-full" disabled={publish.isPending || (!dirty && !hasDrafts)} onClick={() => publish.mutate()}>
              {publish.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('shifts.week.publish')}
            </Button>
          </div>
        )}
      </div>

      {teamQ.isLoading || assignmentsQ.isLoading ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : teamQ.isError || assignmentsQ.isError ? (
        <LoadError t={t} onRetry={() => { teamQ.refetch(); assignmentsQ.refetch() }} />
      ) : members.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('shifts.week.noTeam')}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-input">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">{t('shifts.week.person')}</th>
                {week.days.map(d => (
                  <th key={d} className={`px-2 py-2 text-center font-medium ${d === todayIso ? 'text-primary' : ''}`}>
                    {dayLabel(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id} className="border-t border-input">
                  <td className="px-3 py-2 whitespace-nowrap">{`${m.firstName} ${m.lastName}`.trim()}</td>
                  {week.days.map(d => {
                    const key = cellKey(m.id, d)
                    const cell = byCell.get(key)
                    const saved = cell?.draft ?? cell?.published
                    // El borrador manda en pantalla; lo publicado sigue mandando en asistencia hasta publicar.
                    const value = key in draft ? (draft[key] ?? '') : cell?.draft ? (cell.draft.templateId ?? '') : (cell?.published?.templateId ?? '')
                    const tpl = activeTemplates.find(x => x.id === value)
                    const isDraft = key in draft || !!cell?.draft
                    return (
                      <td key={d} className="px-1 py-1 text-center">
                        <select
                          aria-label={`${m.firstName} ${dayLabel(d)}`}
                          disabled={!canManage}
                          value={value}
                          onChange={e => setDraft(prev => ({ ...prev, [key]: e.target.value || null }))}
                          className={`w-full rounded-md border bg-background px-1 py-1 text-xs ${isDraft ? 'border-dashed border-amber-500/70' : 'border-input'}`}
                          style={tpl ? { borderLeft: `4px solid ${tpl.color}` } : undefined}
                        >
                          <option value="">—</option>
                          {activeTemplates.map(x => (
                            <option key={x.id} value={x.id}>
                              {x.abbreviation} · {x.startTime}–{x.endTime}
                            </option>
                          ))}
                          {saved && saved.templateId && !activeTemplates.some(x => x.id === saved.templateId) && (
                            <option value={saved.templateId}>{saved.templateName} · {saved.startTime}–{saved.endTime}</option>
                          )}
                        </select>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t('shifts.week.legend')}</p>

      {/* Editor de plantilla */}
      <Dialog open={!!editing} onOpenChange={open => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? t('shifts.templates.edit') : t('shifts.templates.new')}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label>{t('shifts.templates.name')}</Label>
                  <Input value={editing.name ?? ''} maxLength={40} onChange={e => setEditing({ ...editing, name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>{t('shifts.templates.abbreviation')}</Label>
                  <Input value={editing.abbreviation ?? ''} maxLength={4} onChange={e => setEditing({ ...editing, abbreviation: e.target.value.toUpperCase() })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>{t('shifts.templates.start')}</Label>
                  <Input type="time" value={editing.startTime ?? ''} onChange={e => setEditing({ ...editing, startTime: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>{t('shifts.templates.end')}</Label>
                  <Input type="time" value={editing.endTime ?? ''} onChange={e => setEditing({ ...editing, endTime: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>{t('shifts.templates.color')}</Label>
                  <Input type="color" value={editing.color ?? '#7ADD2C'} onChange={e => setEditing({ ...editing, color: e.target.value })} />
                </div>
              </div>
              {editing.startTime && editing.endTime && crossesMidnight(editing.startTime, editing.endTime) && (
                <p className="text-xs text-muted-foreground">{t('shifts.templates.overnightHint')}</p>
              )}
              {editing.id && (
                <div className="flex items-center justify-between rounded-lg border border-input p-3">
                  <div>
                    <p className="text-sm font-medium">{t('shifts.templates.active')}</p>
                    <p className="text-xs text-muted-foreground">{t('shifts.templates.activeHint')}</p>
                  </div>
                  <Switch checked={editing.active ?? true} onCheckedChange={v => setEditing({ ...editing, active: v })} />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setEditing(null)}>
              {t('shifts.templates.cancel')}
            </Button>
            <Button
              className="rounded-full"
              disabled={saveTemplate.isPending || !editing?.name?.trim() || !editing?.abbreviation?.trim() || !editing?.startTime || !editing?.endTime || editing.startTime === editing.endTime}
              onClick={() => editing && saveTemplate.mutate(editing)}
            >
              {saveTemplate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('shifts.templates.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
