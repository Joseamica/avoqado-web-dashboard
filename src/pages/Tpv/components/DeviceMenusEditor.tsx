import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { MultiSelectCombobox } from '@/components/multi-select-combobox'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { getDeviceMenuOptions, setTerminalMenus, type DeviceMenusTerminalRow } from '@/services/deviceMenus.service'

export type DeviceMenuChoice = { value: string; label: string; description?: string }
type MenuRef = { id: string; name: string }

/**
 * El selector de «Menú del aparato» y su guardado, compartido por la pestaña Menús y la ficha del aparato.
 * 🔴 Guarda su propia selección: al terminar un guardado la toma de la respuesta ANTES de desbloquear (la siguiente elección
 * parte de lo guardado, no de la relectura que aún no llega); sin guardado en curso sigue a `menus` cuando cambia; con uno en
 * curso ignora las props. Opciones: las que le pase la pestaña (ya paginadas) o, si no, las pide él (la ficha no tiene pestaña).
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
  useEffect(() => {
    if (!guardando.current) setSeleccion(menus)
  }, [menus])

  const propias = useQuery({
    queryKey: ['device-menu-options-all', venueId],
    // ponytail: sólo la primera página (100 menús); la pestaña, que pagina y busca, pasa sus propias opciones.
    queryFn: () => getDeviceMenuOptions(venueId, { page: 1, pageSize: 100 }),
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
    enabled: !options && !!venueId,
  })
  const opciones = useMemo<DeviceMenuChoice[]>(
    () =>
      options ??
      (propias.data?.menus ?? []).map(m => ({
        value: m.id,
        label: m.name,
        description: t('deviceMenus.categoriasDelMenu', { count: m.categoryCount }),
      })),
    [options, propias.data, t],
  )

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
      // El 400 suele ser un menú que ya no está (se apagó o se borró en «Menús»): se relee la fila y las opciones.
      queryClient.invalidateQueries({ queryKey: ['device-menus', venueId] })
      queryClient.invalidateQueries({ queryKey: ['device-menu-options', venueId] })
      queryClient.invalidateQueries({ queryKey: ['device-menu-options-all', venueId] })
      toast({
        title: t('deviceMenus.errorAlGuardar'),
        description: error?.response?.data?.message ?? error?.message,
        variant: 'destructive',
      })
    },
  })

  // Los chips salen de la selección (con su nombre), aunque el menú no esté en la página de opciones.
  const selected = useMemo<DeviceMenuChoice[]>(() => seleccion.map(m => ({ value: m.id, label: m.name })), [seleccion])

  return (
    <MultiSelectCombobox
      options={opciones}
      selected={selected}
      onChange={next => save.mutate(next.map(o => o.value))}
      placeholder={t('deviceMenus.todosLosMenus')}
      searchPlaceholder={t('deviceMenus.buscarMenus')}
      ariaLabel={t('deviceMenus.menusDelAparato', {
        aparato: deviceName ?? '',
        menus: selected.length > 0 ? selected.map(o => o.label).join(', ') : t('deviceMenus.todosLosMenus'),
      })}
      emptyText={t('deviceMenus.sinResultadosMenus')}
      isLoading={(optionsLoading ?? propias.isFetching) && opciones.length === 0}
      disabled={!canEdit || save.isPending}
    />
  )
}
