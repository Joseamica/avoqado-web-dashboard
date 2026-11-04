import { reintentarSirve } from '@/lib/falloDeCarga'
import { Skeleton } from '@/components/ui/skeleton'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { listCatalogAudit, listCatalogAuditActions } from '@/features/master-catalog/api'
import type { CatalogAuditPage as CatalogAuditData } from '@/features/master-catalog/types'

function actionLabel(action: string): string {
  return action
    .replace(/^CATALOG_/, '')
    .split('_')
    .join(' ')
    .toLocaleLowerCase()
}

export default function CatalogAuditPage() {
  const { orgId = '' } = useParams<{ orgId: string }>()
  const { t } = useTranslation('organization')
  const [data, setData] = useState<CatalogAuditData | null>(null)
  const [actions, setActions] = useState<string[]>([])
  const [action, setAction] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState<unknown>(null)

  const [accionesCaidas, setAccionesCaidas] = useState<unknown>(null)
  const [accionesEnCamino, setAccionesEnCamino] = useState(true)

  function cargarAcciones(vigente: () => boolean = () => true) {
    setAccionesCaidas(null)
    setAccionesEnCamino(true)
    void listCatalogAuditActions(orgId)
      .then(value => {
        if (vigente()) setActions(value)
      })
      .catch(fallo => {
        if (vigente()) setAccionesCaidas(fallo)
      })
      .finally(() => {
        if (vigente()) setAccionesEnCamino(false)
      })
  }

  async function load(page = 1) {
    setError(null)
    try {
      setData(await listCatalogAudit(orgId, { page, pageSize: 25, action: action || undefined, search: search.trim() || undefined }))
    } catch (fallo) {
      setError(fallo)
    }
  }

  useEffect(() => {
    let active = true
    cargarAcciones(() => active)
    void listCatalogAudit(orgId, { page: 1, pageSize: 25 })
      .then(value => {
        if (active) setData(value)
      })
      .catch(fallo => {
        if (active) setError(fallo)
      })
    return () => {
      active = false
    }
  }, [orgId])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('masterCatalog.audit.title', { defaultValue: 'Bitácora del catálogo maestro' })}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('masterCatalog.audit.description', { defaultValue: 'Quién cambió qué, sobre qué entidad y cuándo.' })}
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>{t('masterCatalog.audit.filters', { defaultValue: 'Filtros' })}</CardTitle>
          <CardDescription>
            {t('masterCatalog.audit.filtersDescription', { defaultValue: 'Todos los filtros se aplican dentro de esta organización.' })}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <select
            aria-label={t('masterCatalog.audit.action', { defaultValue: 'Acción' })}
            value={action}
            onChange={event => setAction(event.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">{t('masterCatalog.audit.allActions', { defaultValue: 'Todas las acciones' })}</option>
            {actions.map(value => (
              <option key={value} value={value}>
                {actionLabel(value)}
              </option>
            ))}
          </select>
          <Input
            aria-label={t('masterCatalog.audit.search', { defaultValue: 'Buscar en la bitácora' })}
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder={t('masterCatalog.audit.searchPlaceholder', { defaultValue: 'Actor, entidad o identificador' })}
          />
          {accionesEnCamino && <Skeleton className="h-9 w-28" aria-label={t('masterCatalog.audit.actionsLoading', { defaultValue: 'Cargando acciones' })} />}
          <Button onClick={() => void load(1)}>{t('masterCatalog.audit.apply', { defaultValue: 'Aplicar filtros' })}</Button>
        </CardContent>
        {accionesCaidas != null && (
          <CardContent role="alert" className="flex flex-wrap items-center gap-2 pt-0 text-sm text-destructive">
            <p>{t('masterCatalog.audit.actionsError', { defaultValue: 'No se pudieron cargar las acciones del filtro.' })}</p>
            {reintentarSirve(accionesCaidas) && (
              <Button variant="outline" size="sm" onClick={() => cargarAcciones()}>
                {t('common:retry', { defaultValue: 'Reintentar' })}
              </Button>
            )}
          </CardContent>
        )}
      </Card>
      <Card>
        <CardContent className="pt-6">
          {error != null && (
            <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-2 text-destructive">
              <p>{t('masterCatalog.audit.loadError', { defaultValue: 'No se pudo cargar la bitácora.' })}</p>
              {reintentarSirve(error) && (
                <Button variant="outline" size="sm" onClick={() => void load(data?.pagination.page ?? 1)}>
                  {t('common:retry', { defaultValue: 'Reintentar' })}
                </Button>
              )}
            </div>
          )}
          {data === null ? (
            error == null && <Skeleton className="h-72 w-full" />
          ) : (
            <Table aria-label={t('masterCatalog.audit.tableLabel', { defaultValue: 'Bitácora del catálogo maestro' })}>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('masterCatalog.columns.action', { defaultValue: 'Acción' })}</TableHead>
                  <TableHead>{t('masterCatalog.columns.actor', { defaultValue: 'Actor' })}</TableHead>
                  <TableHead>{t('masterCatalog.columns.entity', { defaultValue: 'Entidad' })}</TableHead>
                  <TableHead>{t('masterCatalog.columns.date', { defaultValue: 'Fecha UTC' })}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.logs.map(log => {
                  const actor = log.staff
                    ? `${log.staff.firstName} ${log.staff.lastName}`
                    : (log.servicePrincipalId ?? t('masterCatalog.audit.system', { defaultValue: 'Sistema' }))
                  return (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge variant="secondary">{log.action}</Badge>
                      </TableCell>
                      <TableCell>{actor}</TableCell>
                      <TableCell>{log.entity}</TableCell>
                      <TableCell>
                        <time dateTime={log.createdAt}>{log.createdAt}</time>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {data.logs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                      {t('masterCatalog.audit.empty', { defaultValue: 'No hay eventos para estos filtros.' })}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
          {data && (
            <nav
              className="mt-4 grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-center"
              aria-label={t('masterCatalog.audit.pagination', { defaultValue: 'Paginación de la bitácora' })}
            >
              <Button
                className="min-h-11 w-full sm:min-h-9 sm:w-auto"
                variant="outline"
                onClick={() => void load(data.pagination.page - 1)}
                disabled={data.pagination.page <= 1}
              >
                {t('masterCatalog.audit.previous', { defaultValue: 'Página anterior' })}
              </Button>
              <span className="-order-1 text-center text-sm text-muted-foreground sm:order-none">
                {t('masterCatalog.audit.page', {
                  defaultValue: 'Página {{page}} de {{totalPages}}',
                  page: data.pagination.page,
                  totalPages: data.pagination.totalPages,
                })}
              </span>
              <Button
                variant="outline"
                className="min-h-11 w-full sm:min-h-9 sm:w-auto"
                onClick={() => void load(data.pagination.page + 1)}
                disabled={data.pagination.page >= data.pagination.totalPages}
              >
                {t('masterCatalog.audit.next', { defaultValue: 'Siguiente página' })}
              </Button>
            </nav>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
