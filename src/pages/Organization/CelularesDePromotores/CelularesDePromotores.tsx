import { AvisoDeCarga } from '@/components/AvisoDeCarga'
import { FilterPill, SingleSelectFilterContent } from '@/components/filters'
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
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/context/AuthContext'
import { useCurrentOrganization } from '@/hooks/use-current-organization'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useDebounce } from '@/hooks/useDebounce'
import { useToast } from '@/hooks/use-toast'
import { falloDeCarga } from '@/lib/falloDeCarga'
import {
  generarCodigosDeCelular,
  getCelularesDeCampo,
  type EstadoDelPromotor,
  type FilaDePromotor,
  type FiltrosDeCelulares,
} from '@/services/celularesDeCampo.service'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, Search, Smartphone, X } from 'lucide-react'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useParams } from 'react-router-dom'
import { useMensajeDeError, usePaginacion, useUnaALaVez, type CodigoParaMandar } from './ayudantes'
import { CodigoDialog } from './components/CodigoDialog'
import { DesvincularDialog } from './components/DesvincularDialog'
import { PinModal } from './components/PinModal'
import { PorRevisarModal } from './components/PorRevisarModal'
import { TablaDeCelulares } from './components/TablaDeCelulares'

const ESTADOS: EstadoDelPromotor[] = ['SIN_CELULAR', 'CODIGO_SIN_USAR', 'ACTIVO']

/**
 * Se monta en la organización (`/organizations/:orgId/…`, `/wl/organizations/:orgSlug/…`, dueño) y en la sucursal
 * (`/venues/:slug/playtelecom/…`, `/wl/venues/:slug/…`, supervisor o más; A7). En la sucursal arranca filtrada a ella y el PIN va
 * por el equipo de la sucursal.
 */
export default function CelularesDePromotores() {
  const { slug } = useParams<{ slug?: string }>()
  // `/venues/:slug/playtelecom/…` vive dentro de PlayTelecomLayout, que ya pone el título y el margen (como las demás páginas de ahí).
  const dentroDePlayTelecom = useLocation().pathname.split('/').includes('playtelecom')
  const { venue } = useCurrentVenue()
  const { orgId } = useCurrentOrganization({ includeVenues: false, fetchStats: false })
  const venueIdInicial = slug ? venue?.id : undefined

  if (!orgId || (slug && !venueIdInicial)) return <Skeleton className="m-6 h-96 rounded-xl" />
  return (
    <CelularesDePromotoresVista
      key={venueIdInicial ?? orgId}
      orgId={orgId}
      venueIdInicial={venueIdInicial}
      sinTitulo={dentroDePlayTelecom}
    />
  )
}

export function CelularesDePromotoresVista({
  orgId,
  venueIdInicial,
  sinTitulo = false,
}: {
  orgId: string
  venueIdInicial?: string
  /** Dentro de un layout que ya pone el título y el margen: sólo queda la explicación. */
  sinTitulo?: boolean
}) {
  const { t } = useTranslation('organization')
  const { toast } = useToast()
  const mensajeDeError = useMensajeDeError()
  const queryClient = useQueryClient()
  const { allVenues } = useAuth()
  const unaALaVez = useUnaALaVez()

  const [searchTerm, setSearchTerm] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [estado, setEstado] = useState<EstadoDelPromotor | null>(null)
  const [venueId, setVenueId] = useState<string | null>(venueIdInicial ?? null)
  const [pagination, setPagination] = usePaginacion()
  const debouncedSearch = useDebounce(searchTerm, 300)

  const [codigoAbierto, setCodigoAbierto] = useState<CodigoParaMandar | null>(null)
  const [filaPin, setFilaPin] = useState<FilaDePromotor | null>(null)
  const [filaDesvincular, setFilaDesvincular] = useState<FilaDePromotor | null>(null)
  const [confirmarTodos, setConfirmarTodos] = useState(false)
  const [porRevisarAbierto, setPorRevisarAbierto] = useState(false)

  const irAPrimera = () => setPagination(p => ({ ...p, pageIndex: 0 }))

  const params: FiltrosDeCelulares = useMemo(
    () => ({
      q: debouncedSearch.trim() || undefined,
      venueId: venueId ?? undefined,
      estado: estado ?? undefined,
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
    }),
    [debouncedSearch, venueId, estado, pagination.pageIndex, pagination.pageSize],
  )

  const listQuery = useQuery({
    queryKey: ['celulares-de-campo', orgId, params],
    queryFn: () => getCelularesDeCampo(orgId, params),
    // Con la búsqueda en la llave, sin esto cada tecla deja `data` vacío y la pantalla desmonta el buscador.
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })
  const { data } = listQuery
  const filas = useMemo(() => data?.items ?? [], [data?.items])

  const sucursalOptions = useMemo(
    () => allVenues.filter(v => v.organizationId === orgId).map(v => ({ value: v.id, label: v.name })),
    [allVenues, orgId],
  )

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['celulares-de-campo', orgId] })

  const generarUno = useMutation({
    mutationFn: (fila: FilaDePromotor) => generarCodigosDeCelular(orgId, { staffIds: [fila.staffId] }),
    onSuccess: (res, fila) => {
      invalidar()
      const generado = res.generados[0]
      if (generado) setCodigoAbierto(generado)
      else
        toast({
          variant: 'destructive',
          title: t('celulares.omitido', { nombre: fila.nombre, defaultValue: '{{nombre}} ya no es promotor de campo' }),
        })
    },
    onError: err =>
      toast({
        variant: 'destructive',
        title: t('celulares.codigo.error', { defaultValue: 'No se pudo generar el código' }),
        description: mensajeDeError(err),
      }),
  })

  const generarTodos = useMutation({
    // El mismo filtro de sucursal que da el conteo del botón: se generan exactamente esos N.
    mutationFn: (venue?: string) => generarCodigosDeCelular(orgId, { todosLosSinCelular: true, venueId: venue }),
    onSuccess: res => {
      invalidar()
      toast({
        title: t('celulares.generarTodos.hecho', { n: res.generados.length, defaultValue: 'Se generaron {{n}} códigos' }),
        description:
          res.restantes > 0
            ? t('celulares.generarTodos.faltan', { n: res.restantes, defaultValue: 'Faltan {{n}}: vuelve a tocar el botón.' })
            : undefined,
      })
      // La lista viene del servidor: si `api.ts` reenvió el POST, nada se pierde; cada fila trae su «Copiar» y su WhatsApp.
      setEstado('CODIGO_SIN_USAR')
      irAPrimera()
      setConfirmarTodos(false)
    },
    onError: err =>
      toast({
        variant: 'destructive',
        title: t('celulares.codigo.error', { defaultValue: 'No se pudo generar el código' }),
        description: mensajeDeError(err),
      }),
  })

  const { mutateAsync: generarUnoAsync } = generarUno
  const onGenerarCodigo = useCallback((fila: FilaDePromotor) => void unaALaVez(() => generarUnoAsync(fila)), [unaALaVez, generarUnoAsync])

  const quitarFiltros = () => {
    setSearchTerm('')
    setEstado(null)
    setVenueId(null)
    irAPrimera()
  }

  const leido = data !== undefined
  const hayFiltros = !!debouncedSearch.trim() || !!estado || !!venueId
  // Sólo la sucursal puesta (sin búsqueda ni estado): vacía significa que ahí no hay promotores, no que «nadie coincide».
  const soloSucursal = !!venueId && !debouncedSearch.trim() && !estado
  const sinCelular = data?.conteos.SIN_CELULAR ?? 0
  const porRevisar = data?.porRevisar ?? 0
  const nombreSucursal = venueId ? (sucursalOptions.find(o => o.value === venueId)?.label ?? null) : null

  const titulo = (
    <div>
      {!sinTitulo && (
        <h1 className="text-2xl font-bold text-foreground">{t('celulares.titulo', { defaultValue: 'Celulares de promotores' })}</h1>
      )}
      <p className="text-sm text-muted-foreground mt-0.5">
        {t('celulares.subtitulo', { defaultValue: 'Quién ya activó la app de campo en su celular, y su código si todavía no.' })}
      </p>
    </div>
  )

  let cuerpo: ReactNode
  if (!leido) {
    cuerpo = !falloDeCarga(listQuery) && <Skeleton className="h-96 rounded-xl" />
  } else if (!data.disponible) {
    cuerpo = (
      <GlassCard className="px-6 py-16 text-center">
        <Smartphone className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">
          {t('celulares.noDisponible', { defaultValue: 'Esta pantalla aparece cuando la organización tiene inventario serializado.' })}
        </p>
      </GlassCard>
    )
  } else if (!hayFiltros && data.total === 0) {
    cuerpo = (
      <GlassCard className="px-6 py-16 text-center">
        <Smartphone className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">{t('celulares.vacio.sinPromotores', { defaultValue: 'Todavía no hay promotores' })}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('celulares.vacio.sinPromotoresTexto', {
            defaultValue: 'Aparecen aquí las personas que venden en las sucursales con inventario serializado.',
          })}
        </p>
      </GlassCard>
    )
  } else {
    cuerpo = (
      <>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex items-center">
            {isSearchOpen ? (
              <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2 duration-200">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    data-tour="celulares-buscar"
                    placeholder={t('celulares.buscar', { defaultValue: 'Buscar promotor' })}
                    value={searchTerm}
                    onChange={e => {
                      setSearchTerm(e.target.value)
                      irAPrimera()
                    }}
                    className="h-8 w-[260px] pl-8 text-sm rounded-full"
                    autoFocus
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full cursor-pointer"
                  onClick={() => {
                    setSearchTerm('')
                    setIsSearchOpen(false)
                    irAPrimera()
                  }}
                  aria-label={t('celulares.cerrarBusqueda', { defaultValue: 'Cerrar búsqueda' })}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant={searchTerm ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8 rounded-full cursor-pointer"
                onClick={() => setIsSearchOpen(true)}
                aria-label={t('celulares.buscar', { defaultValue: 'Buscar promotor' })}
              >
                <Search className="h-4 w-4" />
              </Button>
            )}
            {searchTerm && !isSearchOpen && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
            )}
          </div>

          <FilterPill
            label={t('celulares.filtros.estado', { defaultValue: 'Estado' })}
            activeLabel={estado ? t(`celulares.estadoFiltro.${estado}`) : null}
            onClear={() => {
              setEstado(null)
              irAPrimera()
            }}
          >
            <SingleSelectFilterContent
              title={t('celulares.filtros.estado', { defaultValue: 'Estado' })}
              options={ESTADOS.map(e => ({
                value: e,
                label: `${t(`celulares.estadoFiltro.${e}`)} (${data.conteos[e] ?? 0})`,
              }))}
              selectedValue={estado}
              onSelect={v => {
                setEstado(v as EstadoDelPromotor)
                irAPrimera()
              }}
            />
          </FilterPill>

          <FilterPill
            label={t('celulares.filtros.sucursal', { defaultValue: 'Sucursal' })}
            activeLabel={venueId ? (sucursalOptions.find(o => o.value === venueId)?.label ?? venueId) : null}
            onClear={() => {
              setVenueId(null)
              irAPrimera()
            }}
          >
            <SingleSelectFilterContent
              title={t('celulares.filtros.sucursal', { defaultValue: 'Sucursal' })}
              options={sucursalOptions}
              selectedValue={venueId}
              onSelect={v => {
                setVenueId(v)
                irAPrimera()
              }}
              searchable
            />
          </FilterPill>
        </div>

        <GlassCard className="p-0 overflow-hidden">
          {filas.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm font-medium">
                {soloSucursal
                  ? t('celulares.vacio.sinPromotoresSucursal', { defaultValue: 'Todavía no hay promotores en esta sucursal' })
                  : t('celulares.vacio.sinResultados', { defaultValue: 'Nadie coincide con los filtros' })}
              </p>
              {!(soloSucursal && venueId === venueIdInicial) && (
                <Button variant="outline" size="sm" className="mt-4 cursor-pointer" onClick={quitarFiltros}>
                  {t('celulares.vacio.quitarFiltros', { defaultValue: 'Quitar filtros' })}
                </Button>
              )}
            </div>
          ) : (
            <TablaDeCelulares
              query={listQuery}
              filas={filas}
              total={data.total}
              isLoading={listQuery.isFetching && filas.length === 0}
              pagination={pagination}
              setPagination={setPagination}
              venueIdInicial={venueIdInicial}
              generandoCodigo={generarUno.isPending}
              onGenerarCodigo={onGenerarCodigo}
              onPin={setFilaPin}
              onDesvincular={setFilaDesvincular}
            />
          )}
        </GlassCard>
      </>
    )
  }

  return (
    <div className={sinTitulo ? 'space-y-6' : 'p-6 space-y-6'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        {titulo}
        {leido && data.disponible && (
          <div className="flex flex-wrap gap-2">
            {porRevisar > 0 && (
              <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => setPorRevisarAbierto(true)}>
                <ClipboardList className="h-4 w-4 mr-1.5" />
                {t('celulares.porRevisar.boton', { n: porRevisar, defaultValue: 'Por revisar ({{n}})' })}
              </Button>
            )}
            <Button
              size="sm"
              data-tour="celulares-generar-todos"
              disabled={sinCelular === 0 || generarTodos.isPending}
              onClick={() => setConfirmarTodos(true)}
            >
              <Smartphone className="h-4 w-4 mr-1.5" />
              {t('celulares.generarTodos.boton', { n: sinCelular, defaultValue: 'Generar códigos para los {{n}} sin celular' })}
            </Button>
          </div>
        )}
      </div>

      <AvisoDeCarga query={listQuery} hayDatos={leido} />
      {cuerpo}

      <AlertDialog open={confirmarTodos} onOpenChange={o => !o && !generarTodos.isPending && setConfirmarTodos(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {nombreSucursal
                ? t('celulares.generarTodos.tituloSucursal', {
                    n: sinCelular,
                    sucursal: nombreSucursal,
                    defaultValue: '¿Generar códigos para los {{n}} sin celular de {{sucursal}}?',
                  })
                : t('celulares.generarTodos.titulo', { n: sinCelular, defaultValue: '¿Generar códigos para los {{n}} sin celular?' })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('celulares.generarTodos.descripcion', {
                defaultValue:
                  'Cada promotor sin celular ni código vivo recibe un código que vence en 7 días. Después los ves en «Código sin usar», cada uno con su «Copiar» y su WhatsApp.',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={generarTodos.isPending}>{t('celulares.cancelar', { defaultValue: 'Cancelar' })}</AlertDialogCancel>
            <AlertDialogAction
              disabled={generarTodos.isPending}
              onClick={e => {
                e.preventDefault()
                void unaALaVez(() => generarTodos.mutateAsync(venueId ?? undefined))
              }}
            >
              {t('celulares.generarTodos.confirmar', { defaultValue: 'Generar códigos' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CodigoDialog codigo={codigoAbierto} onClose={() => setCodigoAbierto(null)} />
      <PinModal orgId={orgId} venueIdInicial={venueIdInicial} fila={filaPin} onClose={() => setFilaPin(null)} />
      <DesvincularDialog orgId={orgId} fila={filaDesvincular} onClose={() => setFilaDesvincular(null)} />
      <PorRevisarModal orgId={orgId} open={porRevisarAbierto} onClose={() => setPorRevisarAbierto(false)} venueId={venueId ?? undefined} />
    </div>
  )
}
