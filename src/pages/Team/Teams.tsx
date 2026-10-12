import api from '@/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, Clock, MoreHorizontal, Pencil, UserMinus, UserPlus, Search, X, Lock, Sparkles } from 'lucide-react'
import { useState, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

import DataTable from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { FilterPill, FilterPillBar, CheckboxFilterContent, ColumnCustomizer, AmountFilterContent, type AmountFilter } from '@/components/filters'
import { useAuth } from '@/context/AuthContext'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useRoleConfig } from '@/hooks/use-role-config'
import { useDebounce } from '@/hooks/useDebounce'
import { useAccess } from '@/hooks/use-access'
import { useInvalidarConteosDePuesto, usePositions } from '@/hooks/useRh'
import { useTeamInvitationTour } from '@/hooks/useTeamInvitationTour'
import { useToast } from '@/hooks/use-toast'
import teamService, { type Invitation, type PaginatedTeamResponse } from '@/services/team.service'
import { getVenueSeatStatus } from '@/services/features.service'
import { TeamMember, StaffRole } from '@/types'
import { filterSuperadminFromTeam, getRoleBadgeColor, canViewSuperadminInfo } from '@/utils/role-permissions'
import { Currency } from '@/utils/currency'
import { canModifyRole, canDeactivateTeamMember } from '@/lib/permissions/roleHierarchy'
import { cn } from '@/lib/utils'

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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import AsistenciaSettings from './AsistenciaSettings'
import { useTranslation } from 'react-i18next'
import { useVenueDateTime } from '@/utils/datetime'

import EditTeamMemberForm from './components/EditTeamMemberForm'
import InviteTeamMemberForm, { type InviteTeamMemberFormRef } from './components/InviteTeamMemberForm'
import { PermissionGate } from '@/components/PermissionGate'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { FullScreenModal } from '@/components/ui/full-screen-modal'

// ⚠️ COHERENCIA con tours interactivos:
// Esta página tiene un tour driver.js (`useTeamInvitationTour`) que guía al
// usuario a invitar a su primer miembro. Si modificas la UI/UX (botón de
// invitar, dialog de invitación, columnas de la tabla, formulario), revisa
// `src/hooks/useTeamInvitationTour.ts` y actualiza los selectores
// `data-tour="team-*"` y los textos de los steps en paralelo.
export default function Teams() {
  const { venueId } = useCurrentVenue()
  // Al cambiar de sucursal la ruta es la misma y React conserva el componente: sin esto se arrastrarían a la sucursal nueva el
  // puesto elegido, la búsqueda, la página, los filtros y hasta los diálogos abiertos de la anterior. Con `key` nace limpio.
  return <TeamsContent key={venueId} />
}

function TeamsContent() {
  const { venueId, fullBasePath } = useCurrentVenue()

  // Misma llave que Ajustes → Editar negocio: comparten caché, y el invalidate de
  // AsistenciaSettings refresca las dos pantallas.
  const { data: venueData } = useQuery({
    queryKey: ['get-venue-data', venueId],
    queryFn: async () => (await api.get(`/api/v1/dashboard/venues/${venueId}`)).data,
    enabled: !!venueId,
  })
  const { toast } = useToast()
  const { staffInfo } = useAuth()
  const { can } = useAccess()
  const queryClient = useQueryClient()
  // Activar, desactivar o dar de baja cambia las personas vigentes por puesto (chips «Coaches · 4»).
  const refrescarConteosDePuesto = useInvalidarConteosDePuesto()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation('team')
  const { t: tCommon } = useTranslation()
  const { t: tRh } = useTranslation('rh')
  const { formatDate } = useVenueDateTime()

  // ─── Free-plan seat cap ────────────────────────────────────────────────────
  // Proactive paywall on "Invitar": Free venues at the 2-seat cap can't add users.
  // `allowed === false` ⇒ blocked. `cap === null` ⇒ unlimited (paid/exempt).
  const { data: seatStatus } = useQuery({
    queryKey: ['seatStatus', venueId],
    queryFn: () => getVenueSeatStatus(venueId),
    enabled: !!venueId,
  })
  const seatCapReached = seatStatus?.allowed === false
  const [showSeatCapUpsell, setShowSeatCapUpsell] = useState(false)

  // Navigate to the plan/billing portal to upgrade to Pro.
  const goToUpgrade = useCallback(() => {
    setShowSeatCapUpsell(false)
    navigate(`${fullBasePath}/settings/billing/subscriptions`)
  }, [navigate, fullBasePath])

  // Tour driver.js — auto-arranca cuando `requestAtomicTour('team-invitation')`
  // se dispara desde HomeSetupChecklist. Ver `useTeamInvitationTour.ts`.
  useTeamInvitationTour()

  // Custom role display names from venue config
  const { getDisplayName: getCustomRoleDisplayName, getColor: getCustomRoleColor } = useRoleConfig()

  // Get role display name with superadmin visibility check
  const getRoleDisplayName = useCallback(
    (role: StaffRole, userRole?: StaffRole): string => {
      // Hide superadmin role from non-superadmin users
      if (role === StaffRole.SUPERADMIN && !canViewSuperadminInfo(userRole)) {
        return 'Sistema'
      }
      return getCustomRoleDisplayName(role)
    },
    [getCustomRoleDisplayName],
  )

  // Get role badge color with custom color support
  const getRoleBadgeColorWithCustom = useCallback(
    (role: StaffRole, userRole?: StaffRole): string => {
      const customColor = getCustomRoleColor(role)
      if (customColor) {
        // If there's a custom color, create a badge style with it
        return `border border-current/20`
      }
      return getRoleBadgeColor(role, userRole)
    },
    [getCustomRoleColor],
  )

  // Get inline style for custom colors
  const getRoleBadgeStyle = useCallback(
    (role: StaffRole): React.CSSProperties | undefined => {
      const customColor = getCustomRoleColor(role)
      if (customColor) {
        return {
          backgroundColor: `${customColor}20`,
          color: customColor,
          borderColor: `${customColor}40`,
        }
      }
      return undefined
    },
    [getCustomRoleColor],
  )

  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 20,
  })
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [isInviteSubmitting, setIsInviteSubmitting] = useState(false)
  const [isInviteFormValid, setIsInviteFormValid] = useState(false)
  const inviteFormRef = useRef<InviteTeamMemberFormRef>(null)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [removingMember, setRemovingMember] = useState<TeamMember | null>(null)

  // Stripe-style filter states
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [roleFilter, setRoleFilter] = useState<string[]>([])
  const [salesFilter, setSalesFilter] = useState<AmountFilter | null>(null)
  const [tipsFilter, setTipsFilter] = useState<AmountFilter | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  // Sin espacios en las orillas: «   » no es una búsqueda, y teclear un espacio al final no reinicia el debounce.
  const debouncedSearchTerm = useDebounce(searchTerm.trim(), 300)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  // Puesto elegido en los chips ('' = Todos). La búsqueda y el puesto los resuelve el SERVIDOR; el resto de filtros, todavía no.
  const [positionId, setPositionId] = useState('')
  const [activeTeamTab, setActiveTeamTab] = useState<'members' | 'invitations' | 'asistencia'>('members')

  // La llave cuelga de ['team-members', sede]: las mutaciones de RH y de equipo invalidan ese prefijo.
  const teamMembersQueryKey = ['team-members', venueId, pagination.pageIndex, pagination.pageSize, debouncedSearchTerm, positionId] as const

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'firstName',
    'role',
    'position',
    'checks',
    'relation',
    'active',
    'totalSales',
    'totalTips',
    'totalOrders',
  ])

  // Al cambiar un filtro o la búsqueda se vuelve a la página 1 ANTES de pedir: si fuera en un efecto, la primera petición
  // saldría con la página vieja (p. ej. la 3 de una búsqueda que sólo tiene una).
  const filtrosKey = JSON.stringify([statusFilter, roleFilter, salesFilter, tipsFilter, debouncedSearchTerm, positionId])
  const [filtrosPrevios, setFiltrosPrevios] = useState(filtrosKey)
  if (filtrosKey !== filtrosPrevios) {
    setFiltrosPrevios(filtrosKey)
    setPagination(prev => ({ ...prev, pageIndex: 0 }))
  }

  // Helper function to format amount filter label
  const getAmountFilterLabel = useCallback(
    (filter: AmountFilter | null, label: string): string => {
      if (!filter) return label
      const formatValue = (val: number) => Currency(val, false, i18n.language)
      switch (filter.operator) {
        case 'gt':
          return `${label}: > ${formatValue(filter.value)}`
        case 'lt':
          return `${label}: < ${formatValue(filter.value)}`
        case 'eq':
          return `${label}: ${formatValue(filter.value)}`
        case 'between':
          return `${label}: ${formatValue(filter.value)} - ${formatValue(filter.value2 || 0)}`
        default:
          return label
      }
    },
    [i18n.language],
  )

  // Get filter display label for checkbox filters
  const getFilterDisplayLabel = useCallback((values: string[], label: string, optionLabels: Record<string, string>): string => {
    if (values.length === 0) return label
    if (values.length === 1) return `${label}: ${optionLabels[values[0]] || values[0]}`
    return `${label}: ${values.length}`
  }, [])

  // Reset all filters
  const resetFilters = useCallback(() => {
    setStatusFilter([])
    setRoleFilter([])
    setSalesFilter(null)
    setTipsFilter(null)
    setSearchTerm('')
    setPositionId('')
  }, [])

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (statusFilter.length > 0) count++
    if (roleFilter.length > 0) count++
    if (salesFilter) count++
    if (tipsFilter) count++
    if (debouncedSearchTerm) count++
    if (positionId) count++
    return count
  }, [statusFilter, roleFilter, salesFilter, tipsFilter, debouncedSearchTerm, positionId])

  // Filter options for checkboxes
  const statusOptions = useMemo(
    () => [
      { value: 'active', label: t('status.active') },
      { value: 'inactive', label: t('status.inactive') },
    ],
    [t],
  )

  const roleOptions = useMemo(
    () => [
      { value: StaffRole.ADMIN, label: getRoleDisplayName(StaffRole.ADMIN, staffInfo?.role) },
      { value: StaffRole.MANAGER, label: getRoleDisplayName(StaffRole.MANAGER, staffInfo?.role) },
      { value: StaffRole.WAITER, label: getRoleDisplayName(StaffRole.WAITER, staffInfo?.role) },
      { value: StaffRole.CASHIER, label: getRoleDisplayName(StaffRole.CASHIER, staffInfo?.role) },
      { value: StaffRole.KITCHEN, label: getRoleDisplayName(StaffRole.KITCHEN, staffInfo?.role) },
      { value: StaffRole.HOST, label: getRoleDisplayName(StaffRole.HOST, staffInfo?.role) },
      { value: StaffRole.VIEWER, label: getRoleDisplayName(StaffRole.VIEWER, staffInfo?.role) },
    ],
    [getRoleDisplayName, staffInfo?.role],
  )

  // Create label maps for display
  const statusLabels = useMemo(
    () => ({
      active: t('status.active'),
      inactive: t('status.inactive'),
    }),
    [t],
  )

  const roleLabels = useMemo(
    () => roleOptions.reduce((acc, opt) => ({ ...acc, [opt.value]: opt.label }), {} as Record<string, string>),
    [roleOptions],
  )

  // Fetch team members. Búsqueda y puesto van al servidor; conservar los datos anteriores (placeholderData) evita que cada tecla deje la tabla en «cargando»
  // (la tabla desmontaría el buscador y en Android se cerraría el teclado).
  const {
    data: teamData,
    isLoading: isLoadingTeam,
    isError: isTeamError,
    isPlaceholderData,
    refetch: refetchTeam,
  } = useQuery({
    queryKey: teamMembersQueryKey,
    queryFn: () =>
      teamService.getTeamMembers(venueId, pagination.pageIndex + 1, pagination.pageSize, debouncedSearchTerm || undefined, positionId || undefined),
    enabled: !!venueId,
    // Sólo conserva lo anterior si era de ESTA sucursal (defensa extra: el `key` de arriba ya reinicia el componente).
    placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[1] === venueId ? prev : undefined),
    refetchOnWindowFocus: false,
    staleTime: 30_000,
    retry: 1,
  })

  // Puestos del negocio para los chips (con cuántas personas lo tienen vigente) y el color de cada chip de la tabla.
  const { data: positionsData } = usePositions({ limit: 100 })
  const positions = positionsData?.data
  const positionColors = useMemo(() => new Map((positions ?? []).map(p => [p.id, p.color])), [positions])
  const hasPositions = !!positions && positions.length > 0

  // «Todos · N» y el número de la pestaña «Miembros» son toda la gente, no lo que deja el filtro: con búsqueda o puesto puestos, el
  // total de la respuesta es el filtrado, así que se pide aparte (una fila basta, sólo interesa el total). Sólo hace falta si hay
  // chips o un filtro puesto; sin ellos el total de la lista misma ya es el de todos.
  const hasServerFilter = !!debouncedSearchTerm || !!positionId
  const { data: unfilteredData } = useQuery({
    queryKey: ['team-members', venueId, 'total'],
    queryFn: () => teamService.getTeamMembers(venueId, 1, 1),
    enabled: !!venueId && (hasPositions || hasServerFilter),
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })
  // Sin filtro (y sin datos prestados de uno anterior) el total de la lista es el de todos y siempre está fresco. Con filtro, el de
  // la consulta aparte; mientras llega (o si falla) NO se muestra el filtrado como si fuera el de todos: queda sin número.
  const everyoneCount =
    !hasServerFilter && !isPlaceholderData
      ? teamData?.meta.totalCount
      : (unfilteredData?.meta.totalCount ?? (hasServerFilter ? undefined : teamData?.meta.totalCount))
  const positionChips = [
    // Sin número («—») si aún no se sabe o la consulta falló: la fila nunca desaparece, así siempre se puede quitar el filtro.
    // (i18next tipa `count` como número; «—» sólo se interpola, no pluraliza.)
    { id: '', label: tRh('people.filterAll', { count: everyoneCount ?? ('—' as unknown as number) }), color: null as string | null },
    ...(positions ?? []).map(p => ({ id: p.id, label: `${p.name} · ${p.personasVigentes}`, color: p.color })),
  ]

  // Fetch pending invitations
  const { data: invitationsData, isLoading: isLoadingInvitations } = useQuery({
    queryKey: ['team-invitations', venueId],
    queryFn: () => teamService.getPendingInvitations(venueId),
  })

  // Remove team member mutation
  const removeTeamMemberMutation = useMutation({
    mutationFn: (member: TeamMember) => teamService.removeTeamMember(venueId, member.id),
    onMutate: member => ({ member }),
    onSuccess: (_data, _member, context) => {
      const removedMember = context?.member
      toast({
        title: t('toasts.memberRemovedTitle'),
        description: t('toasts.memberRemovedDesc', {
          firstName: removedMember?.firstName || '',
          lastName: removedMember?.lastName || '',
        }),
      })
      queryClient.invalidateQueries({ queryKey: ['team-members', venueId] })
      queryClient.invalidateQueries({ queryKey: ['seatStatus', venueId] })
      refrescarConteosDePuesto()
      setRemovingMember(null)
    },
    onError: (error: any) => {
      toast({
        title: tCommon('error'),
        description: error.response?.data?.message || t('toasts.memberRemoveError'),
        variant: 'destructive',
      })
    },
  })

  // Cancel invitation mutation
  const cancelInvitationMutation = useMutation({
    mutationFn: (invitationId: string) => teamService.cancelInvitation(venueId, invitationId),
    onSuccess: () => {
      toast({
        title: t('toasts.invitationCancelled'),
        description: t('toasts.invitationCancelledDesc'),
      })
      queryClient.invalidateQueries({ queryKey: ['team-invitations', venueId] })
    },
    onError: (error: any) => {
      toast({
        title: tCommon('error'),
        description: error.response?.data?.message || t('toasts.invitationCancelError'),
        variant: 'destructive',
      })
    },
  })

  // Resend invitation mutation
  const resendInvitationMutation = useMutation({
    mutationFn: (invitationId: string) => teamService.resendInvitation(venueId, invitationId),
    onSuccess: () => {
      toast({
        title: t('toasts.invitationResent'),
        description: t('toasts.invitationResentDesc'),
      })
      queryClient.invalidateQueries({ queryKey: ['team-invitations', venueId] })
    },
    onError: (error: any) => {
      toast({
        title: tCommon('error'),
        description: error.response?.data?.message || t('toasts.invitationResendError'),
        variant: 'destructive',
      })
    },
  })

  const toggleMemberStatusMutation = useMutation({
    mutationFn: async ({ memberId, active }: { memberId: string; active: boolean }) =>
      teamService.updateTeamMember(venueId, memberId, { active }),
    onMutate: async ({ memberId, active }) => {
      await queryClient.cancelQueries({ queryKey: teamMembersQueryKey })

      const previousTeamData = queryClient.getQueryData<PaginatedTeamResponse>(teamMembersQueryKey)

      queryClient.setQueryData<PaginatedTeamResponse>(teamMembersQueryKey, old => {
        if (!old) return old
        return {
          ...old,
          data: old.data.map(member => (member.id === memberId ? { ...member, active } : member)),
        }
      })

      return { previousTeamData }
    },
    onError: (error: any, _variables, context) => {
      if (context?.previousTeamData) {
        queryClient.setQueryData(teamMembersQueryKey, context.previousTeamData)
      }
      toast({
        title: tCommon('error'),
        description: error.response?.data?.message || t('toasts.memberStatusError'),
        variant: 'destructive',
      })
    },
    onSuccess: (result) => {
      const updatedMember = result.data
      queryClient.setQueryData<PaginatedTeamResponse>(teamMembersQueryKey, old => {
        if (!old) return old
        return {
          ...old,
          data: old.data.map(member => (member.id === updatedMember.id ? { ...member, ...updatedMember } : member)),
        }
      })

      // Activating/deactivating changes the active seat count → refresh the gate.
      queryClient.invalidateQueries({ queryKey: ['seatStatus', venueId] })
      refrescarConteosDePuesto()

      toast({
        title: updatedMember.active ? t('toasts.memberActivatedTitle') : t('toasts.memberDeactivatedTitle'),
        description: updatedMember.active
          ? t('toasts.memberActivatedDesc', {
              firstName: updatedMember.firstName,
              lastName: updatedMember.lastName,
            })
          : t('toasts.memberDeactivatedDesc', {
              firstName: updatedMember.firstName,
              lastName: updatedMember.lastName,
            }),
      })
    },
  })

  // Misma regla que la pantalla de detalle: a un OWNER o SUPERADMIN no se le quita
  // el acceso desde aqui. Sin esta guarda el menu ofrecia una accion que el backend
  // rechaza, y el usuario descubria el limite hasta ver el error.
  const canDeactivateMember = useCallback((member: TeamMember) => canDeactivateTeamMember(staffInfo?.role, member.role), [staffInfo?.role])

  const canToggleMember = useCallback(
    (member: TeamMember) => {
      if (!staffInfo?.role) return false
      if (!can('teams:update')) return false
      if (member.role === StaffRole.OWNER) return false
      return canModifyRole(staffInfo.role, member.role)
    },
    [can, staffInfo?.role],
  )

  // Filter team members to hide superadmins from non-superadmin users
  // CRITICAL: Must be memoized to prevent infinite re-render loop
  // filterSuperadminFromTeam() returns new array for non-SUPERADMIN roles
  // Also applies client-side filters (status, role, sales, tips). La búsqueda y el puesto ya los filtró el servidor.
  const filteredTeamMembers = useMemo(() => {
    let result = filterSuperadminFromTeam(teamData?.data || [], staffInfo?.role)

    // Apply status filter
    if (statusFilter.length > 0) {
      result = result.filter(member => {
        const status = member.active ? 'active' : 'inactive'
        return statusFilter.includes(status)
      })
    }

    // Apply role filter
    if (roleFilter.length > 0) {
      result = result.filter(member => roleFilter.includes(member.role))
    }

    // Apply sales amount filter
    if (salesFilter) {
      result = result.filter(member => {
        const sales = member.totalSales || 0
        switch (salesFilter.operator) {
          case 'gt':
            return sales > salesFilter.value
          case 'lt':
            return sales < salesFilter.value
          case 'eq':
            return sales === salesFilter.value
          case 'between':
            return sales >= salesFilter.value && sales <= (salesFilter.value2 || salesFilter.value)
          default:
            return true
        }
      })
    }

    // Apply tips amount filter
    if (tipsFilter) {
      result = result.filter(member => {
        const tips = member.totalTips || 0
        switch (tipsFilter.operator) {
          case 'gt':
            return tips > tipsFilter.value
          case 'lt':
            return tips < tipsFilter.value
          case 'eq':
            return tips === tipsFilter.value
          case 'between':
            return tips >= tipsFilter.value && tips <= (tipsFilter.value2 || tipsFilter.value)
          default:
            return true
        }
      })
    }

    return result
  }, [teamData?.data, staffInfo?.role, statusFilter, roleFilter, salesFilter, tipsFilter])

  const filteredInvitations = useMemo(
    () => filterSuperadminFromTeam(invitationsData?.data || [], staffInfo?.role),
    [invitationsData?.data, staffInfo?.role],
  )

  const handleInvitationSearch = useCallback((search: string, rows: Invitation[]) => {
    if (!search) return rows
    const q = search.toLowerCase()
    return rows.filter(inv => {
      const email = (inv.email || '').toLowerCase()
      const inviter = (inv.invitedBy?.name || '').toLowerCase()
      const role = (inv.role || '').toString().toLowerCase()
      return email.includes(q) || inviter.includes(q) || role.includes(q)
    })
  }, [])

  // Memoize column definitions to prevent recreation on every render
  const teamColumns: ColumnDef<TeamMember>[] = useMemo(
    () => [
      {
        accessorKey: 'firstName',
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            {t('columns.name')}
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center space-x-2">
            <div>
              <div className="font-medium">
                {row.original.firstName} {row.original.lastName}
              </div>
              <div className="text-sm text-muted-foreground">{row.original.email}</div>
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'role',
        header: t('columns.role'),
        cell: ({ row }) => (
          <Badge
            variant="soft"
            className={getRoleBadgeColorWithCustom(row.original.role, staffInfo?.role)}
            style={getRoleBadgeStyle(row.original.role)}
          >
            {getRoleDisplayName(row.original.role, staffInfo?.role)}
          </Badge>
        ),
      },
      {
        id: 'position',
        header: tRh('people.position'),
        cell: ({ row }) => {
          const asignaciones = row.original.currentAssignments ?? []
          if (asignaciones.length === 0) return <span className="text-sm text-muted-foreground">{tRh('people.noPosition')}</span>
          return (
            <div className="flex flex-wrap gap-1">
              {asignaciones.map(a => {
                const color = positionColors.get(a.positionId)
                return (
                  <Badge key={a.id} variant="outline" className="gap-1.5 px-2 font-normal text-foreground">
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full bg-muted-foreground/40"
                      style={color ? { backgroundColor: color } : undefined}
                    />
                    {a.positionName}
                  </Badge>
                )
              })}
            </div>
          )
        },
      },
      {
        id: 'checks',
        header: tRh('people.checks'),
        // Sí si alguna asignación vigente checa entrada y salida; «—» si todavía no tiene puesto.
        cell: ({ row }) => {
          const asignaciones = row.original.currentAssignments ?? []
          if (asignaciones.length === 0) return <span className="text-sm text-muted-foreground">—</span>
          return <span className="text-sm">{asignaciones.some(a => a.tracksAttendance) ? tCommon('yes') : tCommon('no')}</span>
        },
      },
      {
        id: 'relation',
        header: tRh('people.relation'),
        // La relación es opcional: null se dice «Sin definir» (gris), nunca otra cosa.
        cell: ({ row }) => {
          const asignaciones = row.original.currentAssignments ?? []
          if (asignaciones.length === 0) return <span className="text-sm text-muted-foreground">—</span>
          const relaciones = [...new Set(asignaciones.map(a => a.relation))]
          return (
            <div className="flex flex-col gap-0.5 text-sm">
              {relaciones.map(r => (
                <span key={r ?? 'none'} className={cn(!r && 'text-muted-foreground')}>
                  {tRh(r ? `relation.${r}` : 'relation.none')}
                </span>
              ))}
            </div>
          )
        },
      },
      {
        accessorKey: 'active',
        header: t('columns.status'),
        cell: ({ row }) => {
          const isActive = row.original.active
          const canToggle = canToggleMember(row.original)
          return (
            <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
              <Switch
                checked={isActive}
                onCheckedChange={checked =>
                  toggleMemberStatusMutation.mutate({ memberId: row.original.id, active: checked })
                }
                disabled={!canToggle || toggleMemberStatusMutation.isPending}
              />
              <span className="text-sm text-muted-foreground">
                {isActive ? t('status.active') : t('status.inactive')}
              </span>
            </div>
          )
        },
      },
      {
        accessorKey: 'totalSales',
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            {t('columns.totalSales')}
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        ),
        cell: ({ row }) => <div className="text-right font-medium">{Currency(row.original.totalSales || 0, false, i18n.language)}</div>,
      },
      {
        accessorKey: 'totalTips',
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            {t('columns.totalTips')}
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-right font-medium text-green-600 dark:text-green-400">
            {Currency(row.original.totalTips || 0, false, i18n.language)}
          </div>
        ),
      },
      {
        accessorKey: 'totalOrders',
        header: t('columns.totalOrders'),
        cell: ({ row }) => <div className="text-right">{row.original.totalOrders}</div>,
      },
      {
        id: 'actions',
        header: tCommon('actions'),
        cell: ({ row }) => (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={5} className="w-48" onClick={e => e.stopPropagation()}>
              <PermissionGate permission="teams:update">
                <DropdownMenuItem onClick={() => setEditingMember(row.original)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  {t('actions.edit')}
                </DropdownMenuItem>
              </PermissionGate>
              <DropdownMenuSeparator />
              <PermissionGate permission="teams:delete">
                {canDeactivateMember(row.original) && (
                  <DropdownMenuItem
                    onClick={() => setRemovingMember(row.original)}
                    className="text-amber-600 focus:text-amber-700 dark:text-amber-500 dark:focus:text-amber-400"
                  >
                    <UserMinus className="h-4 w-4 mr-2" />
                    {t('actions.deactivate')}
                  </DropdownMenuItem>
                )}
              </PermissionGate>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [
      t,
      tCommon,
      tRh,
      i18n.language,
      staffInfo?.role,
      getRoleDisplayName,
      getRoleBadgeColorWithCustom,
      getRoleBadgeStyle,
      positionColors,
      canToggleMember,
      canDeactivateMember,
      toggleMemberStatusMutation,
    ],
  )

  const invitationColumns: ColumnDef<Invitation>[] = useMemo(
    () => [
      {
        accessorKey: 'email',
        header: t('columns.email'),
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.email}</div>
            <div className="text-sm text-muted-foreground">{t('columns.invitedBy', { name: row.original.invitedBy.name })}</div>
          </div>
        ),
      },
      {
        accessorKey: 'role',
        header: t('columns.role'),
        cell: ({ row }) => (
          <Badge
            variant="soft"
            className={getRoleBadgeColorWithCustom(row.original.role, staffInfo?.role)}
            style={getRoleBadgeStyle(row.original.role)}
          >
            {getRoleDisplayName(row.original.role, staffInfo?.role)}
          </Badge>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: t('columns.sent'),
        cell: ({ row }) => <div className="text-sm">{formatDate(row.original.createdAt)}</div>,
      },
      {
        accessorKey: 'expiresAt',
        header: t('columns.expires'),
        cell: ({ row }) => {
          const isExpired = row.original.isExpired || row.original.status === 'EXPIRED'
          return (
            <div className={`text-sm ${isExpired ? 'text-red-600' : 'text-amber-600'}`}>
              <Clock className="h-4 w-4 inline mr-1" />
              {formatDate(row.original.expiresAt)}
              {isExpired && <span className="ml-1 text-xs">{t('status.expired')}</span>}
            </div>
          )
        },
      },
      {
        id: 'actions',
        header: tCommon('actions'),
        cell: ({ row }) => {
          const isExpired = row.original.isExpired || row.original.status === 'EXPIRED'

          return (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => resendInvitationMutation.mutate(row.original.id)}
                disabled={resendInvitationMutation.isPending}
              >
                {t('actions.resend')}
              </Button>
              {!isExpired && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => cancelInvitationMutation.mutate(row.original.id)}
                  disabled={cancelInvitationMutation.isPending}
                  className="text-destructive hover:text-destructive"
                >
                  {t('actions.cancel')}
                </Button>
              )}
            </div>
          )
        },
      },
    ],
    [
      t,
      tCommon,
      staffInfo?.role,
      formatDate,
      getRoleDisplayName,
      getRoleBadgeColorWithCustom,
      getRoleBadgeStyle,
      resendInvitationMutation,
      cancelInvitationMutation,
    ],
  )

  // Filter columns based on visibility state
  const filteredTeamColumns = useMemo(() => {
    return teamColumns.filter(col => {
      const colId = col.id || (col as { accessorKey?: string }).accessorKey
      // Always show actions column
      if (colId === 'actions') return true
      return visibleColumns.includes(colId as string)
    })
  }, [teamColumns, visibleColumns])

  // Column options for the column customizer
  const columnOptions = useMemo(
    () => [
      { id: 'firstName', label: t('columns.name'), visible: visibleColumns.includes('firstName') },
      { id: 'role', label: t('columns.role'), visible: visibleColumns.includes('role') },
      { id: 'position', label: tRh('people.position'), visible: visibleColumns.includes('position') },
      { id: 'checks', label: tRh('people.checks'), visible: visibleColumns.includes('checks') },
      { id: 'relation', label: tRh('people.relation'), visible: visibleColumns.includes('relation') },
      { id: 'active', label: t('columns.status'), visible: visibleColumns.includes('active') },
      { id: 'totalSales', label: t('columns.totalSales'), visible: visibleColumns.includes('totalSales') },
      { id: 'totalTips', label: t('columns.totalTips'), visible: visibleColumns.includes('totalTips') },
      { id: 'totalOrders', label: t('columns.totalOrders'), visible: visibleColumns.includes('totalOrders') },
    ],
    [t, tRh, visibleColumns],
  )

  return (
    <div className={`p-4 bg-background text-foreground`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <PageTitleWithInfo
            title={t('header.title')}
            className="text-2xl font-bold"
            tooltip={t('info.team', {
              defaultValue: 'Gestiona miembros del equipo, roles e invitaciones pendientes.',
            })}
          />
          <p className="text-muted-foreground">{t('header.subtitle')}</p>
        </div>

        <PermissionGate permission="teams:invite">
          <Button
            id="invite-member-button"
            data-tour="team-invite-btn"
            onClick={() => (seatCapReached ? setShowSeatCapUpsell(true) : setShowInviteDialog(true))}
          >
            {seatCapReached ? <Lock className="h-4 w-4 mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
            {t('header.inviteButton')}
          </Button>
          <FullScreenModal
            open={showInviteDialog}
            onClose={() => setShowInviteDialog(false)}
            title={t('header.inviteDialog.title')}
            contentClassName="bg-muted/30"
            actions={
              <Button
                data-tour="team-invite-submit"
                onClick={() => inviteFormRef.current?.submit()}
                disabled={!isInviteFormValid || isInviteSubmitting}
              >
                {isInviteSubmitting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                    {t('invite.sending')}
                  </>
                ) : (
                  t('invite.sendButton')
                )}
              </Button>
            }
          >
            <div className="max-w-2xl mx-auto px-6 py-8">
              <InviteTeamMemberForm
                ref={inviteFormRef}
                venueId={venueId}
                onSuccess={() => {
                  setShowInviteDialog(false)
                  queryClient.invalidateQueries({ queryKey: ['team-members', venueId] })
                  queryClient.invalidateQueries({ queryKey: ['team-invitations', venueId] })
                  queryClient.invalidateQueries({ queryKey: ['seatStatus', venueId] })
                }}
                onLoadingChange={setIsInviteSubmitting}
                onValidChange={setIsInviteFormValid}
                onSeatCapReached={() => {
                  // Reactive fallback: the backend rejected at the cap (raced past
                  // the proactive gate). Close the form, refresh the gate, upsell.
                  setShowInviteDialog(false)
                  queryClient.invalidateQueries({ queryKey: ['seatStatus', venueId] })
                  toast({
                    title: t('seatCap.title'),
                    description: t('seatCap.desc'),
                    variant: 'destructive',
                  })
                  setShowSeatCapUpsell(true)
                }}
              />
            </div>
          </FullScreenModal>
        </PermissionGate>
      </div>

      <Tabs value={activeTeamTab} onValueChange={v => setActiveTeamTab(v as any)} className="space-y-6">
        <div className="border-b border-border">
          <nav className="flex items-center gap-6">
            <button
              onClick={() => setActiveTeamTab('members')}
              className={`relative pb-3 text-sm font-medium transition-colors ${
                activeTeamTab === 'members' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('tabs.members')}
              {everyoneCount !== undefined && <span className="ml-1.5 text-xs opacity-60">{everyoneCount}</span>}
              {activeTeamTab === 'members' && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-full" />
              )}
            </button>
            <button
              onClick={() => setActiveTeamTab('invitations')}
              className={`relative pb-3 text-sm font-medium transition-colors ${
                activeTeamTab === 'invitations' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('tabs.invitations')}
              <span className="ml-1.5 text-xs opacity-60">{invitationsData?.data.length || 0}</span>
              {activeTeamTab === 'invitations' && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-full" />
              )}
            </button>
            <button
              onClick={() => setActiveTeamTab('asistencia')}
              className={`relative pb-3 text-sm font-medium transition-colors ${
                activeTeamTab === 'asistencia' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('tabs.attendance')}
              {activeTeamTab === 'asistencia' && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-full" />
              )}
            </button>
          </nav>
        </div>

        <TabsContent value="members" data-tour="team-members-table" className="space-y-4">
          {/* Chips por puesto: «Todos · N» y uno por puesto con su gente vigente. Sin puestos no hay nada que filtrar. */}
          {hasPositions && (
            <div className="flex flex-wrap gap-2">
              {positionChips.map(chip => (
                <button
                  key={chip.id || 'all'}
                  type="button"
                  aria-pressed={positionId === chip.id}
                  onClick={() => setPositionId(chip.id)}
                  className={cn(
                    'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    positionId === chip.id
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border bg-muted/60 text-muted-foreground hover:text-foreground',
                  )}
                >
                  {chip.id && (
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full bg-muted-foreground/40"
                      style={chip.color ? { backgroundColor: chip.color } : undefined}
                    />
                  )}
                  {chip.label}
                </button>
              ))}
            </div>
          )}

          {/* Un fallo de red no puede verse como «no hay gente» */}
          {isTeamError && (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm"
            >
              <span>{tCommon('errors.serverUnavailableDescription')}</span>
              <Button variant="outline" size="sm" onClick={() => refetchTeam()}>
                {tCommon('errors.retryNow')}
              </Button>
            </div>
          )}

          {/* Results count */}
          {(activeFiltersCount > 0 || debouncedSearchTerm) && (
            <div className="text-sm text-muted-foreground">
              {t('filters.showingResults', {
                count: filteredTeamMembers.length,
                total: teamData?.meta.totalCount || 0,
                defaultValue: 'Mostrando {{count}} de {{total}} miembros',
              })}
            </div>
          )}

          <DataTable
            data={filteredTeamMembers}
            columns={filteredTeamColumns}
            isLoading={isLoadingTeam}
            pagination={pagination}
            setPagination={setPagination}
            tableId="team:members"
            rowCount={teamData?.meta.totalCount ?? 0}
            enableSearch={false}
            clickableRow={row => ({ to: row.id })}
            tableTabLeft={
              <>
                {/* Expandable Search */}
                <div className="relative flex items-center">
                  {isSearchOpen ? (
                    <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2 duration-200">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          type="text"
                          placeholder={tRh('people.search')}
                          value={searchTerm}
                          onChange={e => setSearchTerm(e.target.value)}
                          className="h-7 w-[180px] pl-8 pr-7 text-xs rounded-full"
                          autoFocus
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full"
                        onClick={() => {
                          setSearchTerm('')
                          setIsSearchOpen(false)
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant={searchTerm ? 'secondary' : 'ghost'}
                      size="icon"
                      aria-label={tCommon('search')}
                      className="h-7 w-7 rounded-full"
                      onClick={() => setIsSearchOpen(true)}
                    >
                      <Search className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {searchTerm && !isSearchOpen && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />}
                </div>

                <FilterPillBar onReset={resetFilters}>
                  <FilterPill
                    label={getFilterDisplayLabel(statusFilter, t('columns.status'), statusLabels)}
                    isActive={statusFilter.length > 0}
                    onClear={() => setStatusFilter([])}
                  >
                    <CheckboxFilterContent
                      title={t('columns.status')}
                      options={statusOptions}
                      selectedValues={statusFilter}
                      onApply={setStatusFilter}
                    />
                  </FilterPill>
                  <FilterPill
                    label={getFilterDisplayLabel(roleFilter, t('columns.role'), roleLabels)}
                    isActive={roleFilter.length > 0}
                    onClear={() => setRoleFilter([])}
                  >
                    <CheckboxFilterContent
                      title={t('columns.role')}
                      options={roleOptions}
                      selectedValues={roleFilter}
                      onApply={setRoleFilter}
                    />
                  </FilterPill>
                  <FilterPill
                    label={getAmountFilterLabel(salesFilter, t('columns.totalSales'))}
                    isActive={!!salesFilter}
                    onClear={() => setSalesFilter(null)}
                  >
                    <AmountFilterContent title={t('columns.totalSales')} currentFilter={salesFilter} onApply={setSalesFilter} currency="$" />
                  </FilterPill>
                  <FilterPill
                    label={getAmountFilterLabel(tipsFilter, t('columns.totalTips'))}
                    isActive={!!tipsFilter}
                    onClear={() => setTipsFilter(null)}
                  >
                    <AmountFilterContent title={t('columns.totalTips')} currentFilter={tipsFilter} onApply={setTipsFilter} currency="$" />
                  </FilterPill>
                </FilterPillBar>
              </>
            }
            tableTab={
              <ColumnCustomizer
                columns={columnOptions}
                onApply={setVisibleColumns}
                triggerVariant="ghost"
                triggerClassName="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60"
              />
            }
          />
        </TabsContent>

        <TabsContent value="invitations" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('cards.pendingInvitationsDesc')}
          </p>

          <DataTable
            data={filteredInvitations}
            columns={invitationColumns}
            isLoading={isLoadingInvitations}
            pagination={{ pageIndex: 0, pageSize: 50 }}
            setPagination={() => {}}
            tableId="team:invitations"
            rowCount={invitationsData?.data.length || 0}
            enableSearch={true}
            searchPlaceholder={tCommon('search')}
            onSearch={handleInvitationSearch}
          />
        </TabsContent>

        <TabsContent value="asistencia" className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('cards.attendanceDesc')}</p>
          <AsistenciaSettings venueId={venueId} settings={venueData?.settings} canEdit={can('venues:update')} />
        </TabsContent>
      </Tabs>

      {/* Edit Team Member Dialog */}
      {editingMember && (
        <Dialog open={!!editingMember} onOpenChange={() => setEditingMember(null)}>
          <DialogContent
            className="max-w-md"
            onCloseAutoFocus={e => {
              // Restore focus to the team search input for quick keyboard navigation
              e.preventDefault()
              // Focus back to tab list
            }}
          >
            <DialogHeader>
              <DialogTitle>{t('dialogs.editMemberTitle')}</DialogTitle>
              <DialogDescription>
                {t('dialogs.editMemberDesc', { firstName: editingMember.firstName, lastName: editingMember.lastName })}
              </DialogDescription>
            </DialogHeader>
            <EditTeamMemberForm
              venueId={venueId}
              teamMember={editingMember}
              onSuccess={() => {
                setEditingMember(null)
                queryClient.invalidateQueries({ queryKey: ['team-members', venueId] })
                refrescarConteosDePuesto()
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Remove Team Member Alert */}
      {removingMember && (
        <AlertDialog open={!!removingMember} onOpenChange={() => setRemovingMember(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('dialogs.removeTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('dialogs.removeDesc', { firstName: removingMember.firstName, lastName: removingMember.lastName })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('dialogs.removeCancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => removeTeamMemberMutation.mutate(removingMember)}
                disabled={removeTeamMemberMutation.isPending}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {removeTeamMemberMutation.isPending ? t('dialogs.deactivating') : t('dialogs.deactivateConfirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Free-plan seat cap upsell — shown when an OWNER hits the 2-seat limit */}
      <Dialog open={showSeatCapUpsell} onOpenChange={setShowSeatCapUpsell}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mb-2 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-400/15 text-amber-400">
                <Sparkles className="h-5 w-5" />
              </div>
              <DialogTitle>{t('seatCap.title')}</DialogTitle>
            </div>
            <DialogDescription>{t('seatCap.desc')}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              className="text-muted-foreground cursor-pointer"
              onClick={() => setShowSeatCapUpsell(false)}
            >
              {tCommon('cancel')}
            </Button>
            <Button data-tour="team-seatcap-upgrade" onClick={goToUpgrade} className="cursor-pointer">
              <Sparkles className="h-4 w-4 mr-2" />
              {t('seatCap.cta')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
