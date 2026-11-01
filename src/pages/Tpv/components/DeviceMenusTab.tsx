import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Monitor, Plus, Search, Tablet } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { FeatureGate } from '@/components/billing/FeatureGate'
import { MultiSelectCombobox } from '@/components/multi-select-combobox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { useDebounce } from '@/hooks/useDebounce'
import { MenuWizardDialog } from '@/pages/Menu/Menus/components/MenuWizardDialog'
import {
  getDeviceMenuOptions,
  getDeviceMenus,
  setTerminalMenus,
  type DeviceMenusCounts,
  type DeviceMenusPage,
  type DeviceMenusTerminalRow,
} from '@/services/deviceMenus.service'
import { getDeviceSystem } from '../deviceListPresentation'

/**
 * Menú del aparato (B4): «Qué muestra cada aparato». Cada aparato POS elige qué menús pinta en la cuadrícula de Cobrar y
 * Mesas; vacío = «Todos los menús». Cada elección se guarda sola (no hay botón Guardar). Pro: `DEVICE_MENUS`; un negocio
 * Gratis ve la pantalla borrosa con el candado, nunca desaparece.
 * Contrato: `deviceMenus.service.ts`. `sees` es lo de HOY y `seesAfterUpdate` lo que verá al actualizar la app (Ruling 11).
 */
const PAGE_SIZE = 50
const OPTIONS_PAGE_SIZE = 100
const NEW_MENU_DEFAULTS = { appliesToDevices: true, appliesToOnline: false }

type Option = { value: string; label: string; description?: string }

export default function DeviceMenusTab() {
  return (
    <FeatureGate feature="DEVICE_MENUS">
      <DeviceMenusContent />
    </FeatureGate>
  )
}

function useCuenta() {
  const { t } = useTranslation('tpv')
  return (c: DeviceMenusCounts) =>
    t('deviceMenus.ve', {
      categorias: t('deviceMenus.categorias', { count: c.categories }),
      productos: t('deviceMenus.productos', { count: c.products }),
    })
}

function DeviceMenusContent() {
  const { t } = useTranslation('tpv')
  const { venueId } = useCurrentVenue()
  const { can } = useAccess()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [menuSearch, setMenuSearch] = useState('')
  const debouncedMenuSearch = useDebounce(menuSearch, 300)
  const [wizardOpen, setWizardOpen] = useState(false)

  const devices = useQuery({
    queryKey: ['device-menus', venueId, page],
    queryFn: () => getDeviceMenus(venueId, { page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
    // Los menús se cambian en «Menús»: al volver a la pestaña se relee, aunque no hayan pasado 30 s (Codex r1 #2).
    refetchOnMount: 'always',
    enabled: !!venueId,
  })

  const menuOptions = useInfiniteQuery({
    queryKey: ['device-menu-options', venueId, debouncedMenuSearch],
    queryFn: ({ pageParam }) =>
      getDeviceMenuOptions(venueId, { search: debouncedMenuSearch || undefined, page: pageParam, pageSize: OPTIONS_PAGE_SIZE }),
    initialPageParam: 1,
    // Sin `last.menus.length` una página vacía (se borraron menús) pediría «más» para siempre.
    getNextPageParam: (last, all) =>
      last.menus.length > 0 && all.reduce((n, p) => n + p.menus.length, 0) < last.total ? all.length + 1 : undefined,
    // La búsqueda va en la llave: sin esto cada tecla vacía las opciones (bounded-data-and-query-load.md).
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
    enabled: !!venueId,
  })

  const options = useMemo<Option[]>(() => {
    // Por id: si un menú se movió de página entre una lectura y otra, no sale dos veces.
    const vistos = new Set<string>()
    return (menuOptions.data?.pages ?? [])
      .flatMap(p => p.menus)
      .filter(m => !vistos.has(m.id) && !!vistos.add(m.id))
      .map(m => ({
        value: m.id,
        label: m.name,
        // Categorías DIRECTAS del menú: no es la cuenta de «En su pantalla ve» (ésa suma subcategorías con productos).
        description: t('deviceMenus.categoriasDelMenu', { count: m.categoryCount }),
      }))
  }, [menuOptions.data, t])

  const canEdit = can('tpv:update')
  const canCreateMenu = can('menu:create')
  const optionsPages = menuOptions.data?.pages ?? []
  const optionsTotal = optionsPages[optionsPages.length - 1]?.total ?? 0
  // Visible si no cupieron en una página, o si ya hay una búsqueda (si no, al filtrar se escondería a sí mismo).
  const showMenuSearch = menuSearch !== '' || optionsTotal > OPTIONS_PAGE_SIZE

  const newMenuButton = canCreateMenu && (
    <Button size="sm" className="h-9" data-tour="device-menus-new-menu" onClick={() => setWizardOpen(true)}>
      <Plus className="w-4 h-4 mr-1.5" />
      {t('deviceMenus.nuevoMenu')}
    </Button>
  )

  const total = devices.data?.total ?? 0
  const ultimaPagina = Math.max(1, Math.ceil(total / PAGE_SIZE))
  // Se retiraron aparatos y la página ya no existe: a la última que sí, releyendo (las demás traen el total viejo).
  const fueraDeRango = !!devices.data && !devices.isPlaceholderData && page > ultimaPagina
  useEffect(() => {
    if (!fueraDeRango) return
    queryClient.invalidateQueries({ queryKey: ['device-menus', venueId], refetchType: 'none' })
    setPage(ultimaPagina)
  }, [fueraDeRango, ultimaPagina, queryClient, venueId])
  // Sólo con aparatos: sin ninguno ya se dice «sinAparatos», y dos avisos a la vez confunden.
  const noDeviceMenus = total > 0 && menuOptions.isSuccess && optionsTotal === 0 && debouncedMenuSearch === ''
  const desde = (page - 1) * PAGE_SIZE + 1
  const hasta = Math.min(page * PAGE_SIZE, total)

  return (
    <div className="space-y-4 p-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">{t('deviceMenus.subtitulo')}</p>
        {newMenuButton}
      </div>

      {!canEdit && <p className="text-sm text-muted-foreground">{t('deviceMenus.sinPermisoEditar')}</p>}

      {noDeviceMenus && (
        <div
          data-testid="device-menus-sin-menus"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-input bg-muted/40 p-4"
        >
          <p className="max-w-2xl text-sm">{t('deviceMenus.sinMenusParaAparatos')}</p>
          {newMenuButton}
        </div>
      )}

      {menuOptions.isError && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{t('deviceMenus.errorMenus')}</span>
          <Button size="sm" variant="outline" onClick={() => menuOptions.refetch()}>
            {t('deviceMenus.reintentar')}
          </Button>
        </div>
      )}

      {showMenuSearch && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label={t('deviceMenus.buscarMenus')}
              placeholder={t('deviceMenus.buscarMenus')}
              value={menuSearch}
              maxLength={100}
              onChange={e => setMenuSearch(e.target.value)}
              className="h-9 rounded-full pl-8 text-sm"
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {t('deviceMenus.menusCargados', { cargados: options.length, total: optionsTotal })}
          </span>
          {menuOptions.hasNextPage && (
            <Button size="sm" variant="outline" disabled={menuOptions.isFetchingNextPage} onClick={() => menuOptions.fetchNextPage()}>
              {t('deviceMenus.mostrarMasMenus')}
            </Button>
          )}
        </div>
      )}

      {devices.isLoading ? (
        <div data-testid="device-menus-cargando" className="space-y-2">
          {[0, 1, 2].map(i => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : devices.isError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-input p-8 text-center">
          <p className="text-sm">{t('deviceMenus.error')}</p>
          <Button size="sm" variant="outline" onClick={() => devices.refetch()}>
            {t('deviceMenus.reintentar')}
          </Button>
        </div>
      ) : total === 0 ? (
        <div className="rounded-xl border border-input p-8 text-center text-sm text-muted-foreground">{t('deviceMenus.sinAparatos')}</div>
      ) : (
        <div className="rounded-xl border border-input">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('deviceMenus.columnas.aparato')}</TableHead>
                <TableHead>{t('deviceMenus.columnas.area')}</TableHead>
                <TableHead className="min-w-64">{t('deviceMenus.columnas.muestra')}</TableHead>
                <TableHead>{t('deviceMenus.columnas.enSuPantallaVe')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.data?.terminals.map(row => (
                <DeviceMenusRow
                  key={row.id}
                  row={row}
                  page={page}
                  options={options}
                  optionsLoading={menuOptions.isFetching}
                  // Con la página pedida aún en camino, estas filas son de la anterior: no se editan (Codex r1 #1).
                  canEdit={canEdit && !devices.isPlaceholderData}
                />
              ))}
            </TableBody>
          </Table>
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-end gap-3 border-t border-input px-4 py-3 text-sm text-muted-foreground">
              <span>{t('deviceMenus.rango', { desde, hasta, total })}</span>
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                {t('deviceMenus.anterior')}
              </Button>
              <Button size="sm" variant="outline" disabled={hasta >= total} onClick={() => setPage(p => p + 1)}>
                {t('deviceMenus.siguiente')}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Montado siempre: `defaults` sólo se toma al montar (y al cerrar), así nace sólo con «Aparatos». */}
      <MenuWizardDialog
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        defaults={NEW_MENU_DEFAULTS}
        onSuccess={() => {
          // El asistente ya invalida ['menus', venueId]; aquí, lo que pinta esta pestaña.
          queryClient.invalidateQueries({ queryKey: ['device-menus', venueId] })
          queryClient.invalidateQueries({ queryKey: ['device-menu-options', venueId] })
        }}
      />
    </div>
  )
}

function DeviceMenusRow({
  row,
  page,
  options,
  optionsLoading,
  canEdit,
}: {
  row: DeviceMenusTerminalRow
  page: number
  options: Option[]
  optionsLoading: boolean
  canEdit: boolean
}) {
  const { t } = useTranslation('tpv')
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const cuenta = useCuenta()
  const system = getDeviceSystem(row)
  const SystemIcon = system.system === 'windows' ? Monitor : Tablet

  // Los chips salen de la fila (con su nombre), aunque el menú no esté en la página de opciones.
  const selected = useMemo<Option[]>(() => row.menus.map(m => ({ value: m.id, label: m.name })), [row.menus])

  const save = useMutation({
    // `page` viaja con la elección: si el dueño cambió de página mientras guardaba, lo guardado va a la página de la fila.
    mutationFn: ({ menuIds }: { menuIds: string[]; page: number }) => setTerminalMenus(venueId, row.id, menuIds),
    onSuccess: (saved, { page: paginaDeLaFila }) => {
      // 🔴 ANTES de desbloquear: la siguiente elección parte de lo guardado, no de la relectura que todavía no llega (Codex r2-2).
      queryClient.setQueryData<DeviceMenusPage>(['device-menus', venueId, paginaDeLaFila], old =>
        old ? { ...old, terminals: old.terminals.map(r => (r.id === saved.id ? saved : r)) } : old,
      )
      // Sin `return`: si se esperara la relectura, el selector seguiría bloqueado hasta que contestara.
      queryClient.invalidateQueries({ queryKey: ['device-menus', venueId] })
      toast({ title: t('deviceMenus.guardado') })
    },
    onError: (error: any) => {
      // El 400 suele ser un menú que ya no está (se apagó o se borró en «Menús»): se relee la fila y las opciones.
      queryClient.invalidateQueries({ queryKey: ['device-menus', venueId] })
      queryClient.invalidateQueries({ queryKey: ['device-menu-options', venueId] })
      toast({
        title: t('deviceMenus.errorAlGuardar'),
        description: error?.response?.data?.message ?? error?.message,
        variant: 'destructive',
      })
    },
  })

  return (
    <TableRow data-testid={`device-menus-row-${row.id}`}>
      <TableCell>
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
            <SystemIcon className="size-4" aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{row.name}</span>
            {system.label && <span className="truncate text-xs text-muted-foreground">{system.label}</span>}
            {/* Con «Todos los menús» la app vieja ya muestra todo: no hay nada que aplicar (Ruling 18). */}
            {row.needsAppUpdate && row.menus.length > 0 && (
              <span className="text-xs text-muted-foreground">{t('deviceMenus.actualizaLaApp')}</span>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="text-sm">{row.areaName ?? '—'}</TableCell>
      <TableCell data-tour="device-menus-selector">
        <MultiSelectCombobox
          options={options}
          selected={selected}
          onChange={next => save.mutate({ menuIds: next.map(o => o.value), page })}
          placeholder={t('deviceMenus.todosLosMenus')}
          searchPlaceholder={t('deviceMenus.buscarMenus')}
          ariaLabel={t('deviceMenus.menusDelAparato', {
            aparato: row.name,
            menus: selected.length > 0 ? selected.map(o => o.label).join(', ') : t('deviceMenus.todosLosMenus'),
          })}
          emptyText={t('deviceMenus.sinResultadosMenus')}
          isLoading={optionsLoading && options.length === 0}
          disabled={!canEdit || save.isPending}
        />
      </TableCell>
      <TableCell className="text-sm">
        <div>{cuenta(row.sees)}</div>
        {row.seesAfterUpdate && (
          <div className="text-xs text-muted-foreground">{t('deviceMenus.veAlActualizar', { cuenta: cuenta(row.seesAfterUpdate) })}</div>
        )}
      </TableCell>
    </TableRow>
  )
}
