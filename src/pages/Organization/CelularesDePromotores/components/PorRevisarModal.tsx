import DataTable from '@/components/data-table'
import { AvisoDeCarga } from '@/components/AvisoDeCarga'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FilterPill, SingleSelectFilterContent } from '@/components/filters'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { falloDeCarga } from '@/lib/falloDeCarga'
import {
  getRetenidosDeCampo,
  resolverRetenidoDeCampo,
  type EstadoDelRetenido,
  type RetenidoDeCampo,
} from '@/services/celularesDeCampo.service'
import { useVenueDateTime } from '@/utils/datetime'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef, PaginationState } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { mensajeDelServidor, useUnaALaVez } from '../ayudantes'

const PAGE_SIZE = 20
const ESTADOS: EstadoDelRetenido[] = ['PENDIENTE', 'APLICANDO', 'APLICADO', 'DESCARTADO']

interface PorRevisarModalProps {
  orgId: string
  open: boolean
  onClose: () => void
  /** El filtro de sucursal de la pantalla: en la sucursal, sólo lo suyo. */
  venueId?: string
}

export function PorRevisarModal({ orgId, open, onClose, venueId }: PorRevisarModalProps) {
  const { t } = useTranslation('organization')
  const { toast } = useToast()
  const { formatDateTime } = useVenueDateTime()
  const queryClient = useQueryClient()
  const unaALaVez = useUnaALaVez()
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: PAGE_SIZE })
  const [porDescartar, setPorDescartar] = useState<RetenidoDeCampo | null>(null)
  const [nota, setNota] = useState('')
  // Arranca en PENDIENTE, como el «Por revisar (n)» del botón. El servidor filtra por UN estado: «A medias» (APLICANDO) y los
  // resueltos se eligen en el filtro; null = todos.
  const [estado, setEstado] = useState<EstadoDelRetenido | null>('PENDIENTE')

  const params = { venueId, estado: estado ?? undefined, page: pagination.pageIndex + 1, pageSize: PAGE_SIZE }
  const retenidosQuery = useQuery({
    queryKey: ['celulares-de-campo', orgId, 'retenidos', params],
    queryFn: () => getRetenidosDeCampo(orgId, params),
    enabled: open && !!orgId,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })
  const { data } = retenidosQuery
  const items = useMemo(() => data?.items ?? [], [data?.items])

  const mutation = useMutation({
    mutationFn: (v: { id: string; accion: 'APLICAR' | 'DESCARTAR'; nota?: string }) =>
      resolverRetenidoDeCampo(orgId, v.id, { accion: v.accion, nota: v.nota }),
    onSuccess: res => {
      queryClient.invalidateQueries({ queryKey: ['celulares-de-campo', orgId] })
      toast({
        title:
          res.estado === 'APLICADO'
            ? t('celulares.porRevisar.aplicado', { defaultValue: 'Aplicado' })
            : t('celulares.porRevisar.descartado', { defaultValue: 'Descartado' }),
      })
      setPorDescartar(null)
      setNota('')
    },
    onError: err => {
      // 409/422 traen su razón en llano (p. ej. «Vuelve a tocar Aplicar para terminarla»).
      queryClient.invalidateQueries({ queryKey: ['celulares-de-campo', orgId, 'retenidos'] })
      toast({
        variant: 'destructive',
        title: t('celulares.porRevisar.error', { defaultValue: 'No se pudo resolver' }),
        description: mensajeDelServidor(err),
      })
    },
  })

  const { isPending, mutateAsync } = mutation
  const columns = useMemo<ColumnDef<RetenidoDeCampo>[]>(
    () => [
      {
        id: 'quien',
        header: t('celulares.porRevisar.columnas.quien', { defaultValue: 'Promotor y sucursal' }),
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.nombre}</p>
            <p className="text-xs text-muted-foreground">{row.original.sucursal}</p>
          </div>
        ),
      },
      {
        id: 'que',
        header: t('celulares.porRevisar.columnas.que', { defaultValue: 'Qué es' }),
        cell: ({ row }) => (
          <div>
            <p className="text-sm font-medium">{t(`celulares.porRevisar.tipo.${row.original.tipo}`, { defaultValue: row.original.tipo })}</p>
            <p className="text-xs text-muted-foreground">{row.original.resumen}</p>
            <p className="text-xs text-muted-foreground">{formatDateTime(row.original.createdAt)}</p>
          </div>
        ),
      },
      {
        id: 'motivo',
        header: t('celulares.porRevisar.columnas.motivo', { defaultValue: 'Por qué quedó aquí' }),
        cell: ({ row }) => (
          <div className="max-w-sm">
            <p className="text-sm">{t(`celulares.porRevisar.motivo.${row.original.motivo}`, { defaultValue: row.original.motivo })}</p>
            {row.original.rechazo && <p className="text-xs text-destructive">{row.original.rechazo.message}</p>}
          </div>
        ),
      },
      {
        id: 'acciones',
        header: '',
        cell: ({ row }) => {
          const r = row.original
          if (r.estado === 'APLICADO' || r.estado === 'DESCARTADO') {
            return <Badge variant="secondary">{t(`celulares.porRevisar.estado.${r.estado}`, { defaultValue: r.estado })}</Badge>
          }
          return (
            <div className="flex flex-wrap justify-end gap-1">
              {r.estado === 'APLICANDO' && (
                <Badge variant="outline" className="border-input">
                  {t('celulares.porRevisar.estado.APLICANDO', { defaultValue: 'A medias: toca «Aplicar» otra vez' })}
                </Badge>
              )}
              <Button
                size="sm"
                className="cursor-pointer"
                disabled={isPending}
                onClick={() => void unaALaVez(() => mutateAsync({ id: r.id, accion: 'APLICAR' }))}
              >
                {t('celulares.porRevisar.aplicar', { defaultValue: 'Aplicar' })}
              </Button>
              {r.estado === 'PENDIENTE' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="cursor-pointer"
                  disabled={isPending}
                  onClick={() => {
                    setNota('')
                    setPorDescartar(r)
                  }}
                >
                  {t('celulares.porRevisar.descartar', { defaultValue: 'Descartar' })}
                </Button>
              )}
            </div>
          )
        },
      },
    ],
    [t, formatDateTime, isPending, mutateAsync, unaALaVez],
  )

  const total = data?.total ?? 0

  return (
    <FullScreenModal
      open={open}
      onClose={onClose}
      title={t('celulares.porRevisar.titulo', { defaultValue: 'Por revisar' })}
      contentClassName="bg-muted/30"
    >
      <div className="mx-auto max-w-5xl p-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          {t('celulares.porRevisar.explicacion', {
            defaultValue:
              'Lo que un celular subió después de desvincularse y no se pudo aceptar solo. «Aplicar» lo registra a nombre de quien lo hizo; «Descartar» lo deja fuera.',
          })}
        </p>
        <FilterPill
          label={t('celulares.filtros.estado', { defaultValue: 'Estado' })}
          activeLabel={estado ? t(`celulares.porRevisar.estado.${estado}`) : null}
          onClear={() => {
            setEstado(null)
            setPagination(p => ({ ...p, pageIndex: 0 }))
          }}
        >
          <SingleSelectFilterContent
            title={t('celulares.filtros.estado', { defaultValue: 'Estado' })}
            options={ESTADOS.map(e => ({ value: e, label: t(`celulares.porRevisar.estado.${e}`) }))}
            selectedValue={estado}
            onSelect={v => {
              setEstado(v as EstadoDelRetenido)
              setPagination(p => ({ ...p, pageIndex: 0 }))
            }}
          />
        </FilterPill>
        <AvisoDeCarga query={retenidosQuery} hayDatos={data !== undefined} />
        {data === undefined ? (
          !falloDeCarga(retenidosQuery) && <Skeleton className="h-48 w-full rounded-xl" />
        ) : total === 0 ? (
          <div className="rounded-2xl border border-border/50 bg-card p-10 text-center text-sm text-muted-foreground">
            {estado === 'PENDIENTE'
              ? t('celulares.porRevisar.vacio', { defaultValue: 'No hay nada por revisar.' })
              : t('celulares.porRevisar.vacioConFiltro', { defaultValue: 'No hay nada con ese estado.' })}
          </div>
        ) : (
          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
            <DataTable<RetenidoDeCampo>
              query={retenidosQuery}
              data={items}
              rowCount={total}
              columns={columns}
              pagination={pagination}
              setPagination={setPagination}
              getRowId={r => r.id}
              showColumnCustomizer={false}
              tableId="celulares-por-revisar"
            />
          </div>
        )}
      </div>

      <AlertDialog open={!!porDescartar} onOpenChange={o => !o && !mutation.isPending && setPorDescartar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('celulares.porRevisar.confirmarDescartar', { defaultValue: '¿Descartar?' })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('celulares.porRevisar.confirmarDescartarTexto', {
                defaultValue: 'No se registra. Queda en la bitácora con tu nombre y la nota.',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            aria-label={t('celulares.porRevisar.nota', { defaultValue: 'Nota (opcional)' })}
            placeholder={t('celulares.porRevisar.nota', { defaultValue: 'Nota (opcional)' })}
            maxLength={500}
            value={nota}
            onChange={e => setNota(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>{t('celulares.cancelar', { defaultValue: 'Cancelar' })}</AlertDialogCancel>
            <AlertDialogAction
              disabled={mutation.isPending}
              onClick={e => {
                e.preventDefault()
                const r = porDescartar
                if (r) void unaALaVez(() => mutation.mutateAsync({ id: r.id, accion: 'DESCARTAR', nota: nota.trim() || undefined }))
              }}
            >
              {t('celulares.porRevisar.descartar', { defaultValue: 'Descartar' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </FullScreenModal>
  )
}
