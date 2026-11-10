import { onlineManager, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'

import { MultiSelectCombobox } from '@/components/multi-select-combobox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { useDebounce } from '@/hooks/useDebounce'
import { falloDeCarga } from '@/lib/falloDeCarga'
import { setTerminalMenus, type DeviceMenusTerminalRow } from '@/services/deviceMenus.service'
import { getTpvById } from '@/services/tpv.service'

import { OPTIONS_PAGE_SIZE, useDeviceMenuOptions, type DeviceMenuChoice } from './useDeviceMenuOptions'

export type { DeviceMenuChoice }
type MenuRef = { id: string; name: string }

/**
 * El selector de «Menú del aparato» y su guardado, compartido por la pestaña Menús y la ficha del aparato.
 * 🔴 Guarda su propia selección: al terminar un guardado la toma de la respuesta ANTES de desbloquear (la siguiente elección
 * parte de lo guardado, no de la relectura que aún no llega); sin guardado en curso sigue a `menus` cuando cambia; con uno en
 * curso ignora las props. 🔴 Tras CUALQUIER error (Codex final #1) suelta su selección, relee la fila y la ficha y queda bloqueado
 * hasta que la relectura llega; entonces toma las props aunque se vean iguales: con la respuesta perdida el servidor pudo
 * guardar, y una elección hecha sobre la selección vieja borraría lo guardado. Opciones: las que le pase la pestaña o, si no, las pide él con búsqueda y paginación del servidor (la ficha no tiene pestaña).
 */
export function DeviceMenusEditor({
  terminalId,
  menus,
  canEdit,
  onSaved,
  deviceName,
  options,
  optionsLoading,
}: {
  terminalId: string
  menus: MenuRef[]
  canEdit: boolean
  onSaved?: (row: DeviceMenusTerminalRow) => void
  /** Sólo para el nombre accesible del selector. */
  deviceName?: string
  options?: DeviceMenuChoice[]
  optionsLoading?: boolean
}) {
  const { t } = useTranslation('tpv')
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [seleccion, setSeleccion] = useState<MenuRef[]>(menus)
  const guardando = useRef(false)
  // 'releyendo' = leyendo del servidor tras un error; 'fallo' = esa lectura falló (sigue bloqueado, con «Reintentar»).
  const [resync, setResync] = useState<'no' | 'releyendo' | 'fallo'>('no')
  const bloqueado = useRef(false)
  const ultimas = useRef(menus)
  ultimas.current = menus
  useEffect(() => {
    // Sin guardado ni recuperación en curso, sigue a las props.
    if (!guardando.current && !bloqueado.current) setSeleccion(menus)
  }, [menus])
  const enLinea = useSyncExternalStore(onlineManager.subscribe, () => onlineManager.isOnline())

  /**
   * 🔴 Tras CUALQUIER error del guardado (Codex final #1, r2): el servidor pudo guardar sin que llegara la respuesta. El editor
   * queda bloqueado y lee ÉL la fila de este aparato (la ficha, `['tpv', venue, id]`); sólo con ese dato leído de verdad toma la
   * selección y se desbloquea. No toma las props, y una lectura pausada sin red sigue pendiente (no se confunde con terminada).
   */
  const releer = useCallback(() => {
    bloqueado.current = true
    setSeleccion(ultimas.current)
    setResync('releyendo')
    const ficha = ['tpv', venueId, terminalId]
    queryClient.invalidateQueries({ queryKey: ['device-menus', venueId] })
    queryClient.invalidateQueries({ queryKey: ['tpvs', venueId] })
    // Invalidar cancela la lectura en vuelo (pudo salir antes de que el servidor guardara) y, si la ficha está abierta, lee de
    // nuevo; `fetchQuery` se suma a esa lectura o hace la suya.
    queryClient.invalidateQueries({ queryKey: ficha, exact: true })
    queryClient
      .fetchQuery({ queryKey: ficha, queryFn: () => getTpvById(venueId, terminalId), staleTime: 0 })
      .then((tpv: { deviceMenus?: { menus?: MenuRef[] } }) => {
        const leidos = tpv?.deviceMenus?.menus
        if (!leidos) throw new Error('La ficha no trae el menú del aparato')
        setSeleccion(leidos)
        bloqueado.current = false
        setResync('no')
      })
      .catch(() => setResync('fallo'))
  }, [queryClient, venueId, terminalId])

  // Sin `options` de la pestaña, el editor pide las suyas con la misma búsqueda y paginación del servidor.
  const propio = !options
  const [busqueda, setBusqueda] = useState('')
  const busquedaConRetraso = useDebounce(busqueda, 300)
  const { query: propias, options: propiasOpciones, total } = useDeviceMenuOptions(venueId, busquedaConRetraso, propio)
  const opciones = options ?? propiasOpciones
  const mostrarBusqueda = propio && (busqueda !== '' || total > OPTIONS_PAGE_SIZE)

  const save = useMutation({
    mutationFn: (menuIds: string[]) => setTerminalMenus(venueId, terminalId, menuIds),
    onMutate: () => {
      guardando.current = true
    },
    onSuccess: saved => {
      // 🔴 ANTES de desbloquear: la siguiente elección parte de lo guardado.
      setSeleccion(saved.menus)
      guardando.current = false
      onSaved?.(saved)
      // Sin `return`: si se esperara la relectura, el selector seguiría bloqueado hasta que contestara.
      queryClient.invalidateQueries({ queryKey: ['device-menus', venueId] })
      queryClient.invalidateQueries({ queryKey: ['tpv', venueId, terminalId] })
      queryClient.invalidateQueries({ queryKey: ['tpvs', venueId] })
      queryClient.invalidateQueries({ queryKey: ['printRouting', venueId] })
      toast({ title: t('deviceMenus.guardado') })
    },
    onError: (error: any) => {
      guardando.current = false
      // El 400 suele ser un menú que ya no está (se apagó o se borró en «Menús»); y sin respuesta, el servidor pudo guardar:
      // se relee la fila, la ficha y las opciones antes de dejar elegir otra vez.
      releer()
      queryClient.invalidateQueries({ queryKey: ['device-menu-options', venueId] })
      toast({
        title: t('deviceMenus.errorAlGuardar'),
        description: error?.response?.data?.message ?? error?.message,
        variant: 'destructive',
      })
    },
  })

  // Los chips salen de la selección (con su nombre), aunque el menú no esté en la página de opciones.
  const selected = useMemo<DeviceMenuChoice[]>(() => seleccion.map(m => ({ value: m.id, label: m.name })), [seleccion])

  const combobox = (
    <MultiSelectCombobox
      options={opciones}
      selected={selected}
      onChange={next => {
        // Nunca se elige sobre una selección que el servidor quizá no tiene.
        if (!bloqueado.current) save.mutate(next.map(o => o.value))
      }}
      placeholder={t('deviceMenus.todosLosMenus')}
      searchPlaceholder={t('deviceMenus.buscarMenus')}
      ariaLabel={t('deviceMenus.menusDelAparato', {
        aparato: deviceName ?? '',
        menus: selected.length > 0 ? selected.map(o => o.label).join(', ') : t('deviceMenus.todosLosMenus'),
      })}
      emptyText={t('deviceMenus.sinResultadosMenus')}
      isLoading={(optionsLoading ?? (propio && propias.isFetching)) && opciones.length === 0}
      disabled={!canEdit || save.isPending || resync !== 'no'}
    />
  )

  const falloAlReleer =
    resync === 'fallo' ? (
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>{t('deviceMenus.errorAlReleer')}</span>
        <Button size="sm" variant="outline" onClick={releer}>
          {t('deviceMenus.reintentar')}
        </Button>
      </div>
    ) : resync === 'releyendo' && !enLinea ? (
      <p className="text-sm text-muted-foreground">{t('deviceMenus.sinConexionReleyendo')}</p>
    ) : null

  if (!propio)
    return falloAlReleer ? (
      <div className="space-y-2">
        {combobox}
        {falloAlReleer}
      </div>
    ) : (
      combobox
    )
  return (
    <div className="space-y-2">
      {combobox}
      {falloAlReleer}
      {falloDeCarga(propias) && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{t('deviceMenus.errorMenus')}</span>
          <Button size="sm" variant="outline" onClick={() => propias.refetch()}>
            {t('deviceMenus.reintentar')}
          </Button>
        </div>
      )}
      {mostrarBusqueda && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label={t('deviceMenus.buscarMenus')}
            placeholder={t('deviceMenus.buscarMenus')}
            value={busqueda}
            maxLength={100}
            onChange={e => setBusqueda(e.target.value)}
            className="h-9 max-w-xs rounded-full text-sm"
          />
          <span className="text-sm text-muted-foreground">{t('deviceMenus.menusCargados', { cargados: opciones.length, total })}</span>
          {propias.hasNextPage && (
            <Button size="sm" variant="outline" disabled={propias.isFetchingNextPage} onClick={() => propias.fetchNextPage()}>
              {t('deviceMenus.mostrarMasMenus')}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
