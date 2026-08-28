import { Separator } from '@radix-ui/react-separator'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AppSidebar } from './components/Sidebar/app-sidebar'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from './components/ui/breadcrumb'
import { SidebarInset, SidebarProvider, SidebarTrigger } from './components/ui/sidebar'
import { ThemeToggle } from './components/theme-toggle'
import { useAuth } from './context/AuthContext'
import { useEffect, useState } from 'react'
// ChatBubble moved to sidebar footer; imported directly by AppSidebar.
import DashboardCommandPalette from './components/Sidebar/DashboardCommandPalette'
import type { SidebarMeta } from './components/Sidebar/app-sidebar'
import { DemoBanner } from './components/DemoBanner'
import { TrialStatusBanner } from './components/TrialStatusBanner'
import { PaymentSetupAlert } from './components/PaymentSetupAlert'
import { VenueSuspendedScreen } from './components/VenueSuspendedScreen'
import { StaffRole } from './types'
import { isDemoVenueStatus } from './types/superadmin'
import { useCurrentVenue } from './hooks/use-current-venue'
import { Button } from './components/ui/button'
import { Shield, ArrowLeft } from 'lucide-react'
import { NotificationBell } from './components/notifications/NotificationBell'
import { AnnouncementGate } from './components/announcements/AnnouncementGate'
import LanguageSwitcher from './components/language-switcher'
import { ImpersonationHeaderButton } from './components/impersonation/ImpersonationHeaderButton'
import { ImpersonationBanner } from './components/impersonation/ImpersonationBanner'
import { ImpersonationShortcut } from './components/impersonation/ImpersonationShortcut'
import { ImpersonationScreenRing } from './components/impersonation/ImpersonationScreenRing'
import { ImpersonationErrorListener } from './components/impersonation/ImpersonationErrorListener'
import { useInventoryWelcomeTourOrchestrator } from './hooks/useInventoryWelcomeTour'
import { useAutoLaunchPlatformWelcomeTour } from './hooks/useAutoLaunchPlatformWelcomeTour'
import { consumeAtomicTourReturnPath, usePeekAtomicTourCompletion } from './hooks/useAtomicTourListener'
import { useHomeChecklistAutoMark } from './hooks/useHomeChecklistAutoMark'
import { useTourProgressSync } from './hooks/useTourProgressSync'
import { useDemoTour } from './hooks/useDemoTour'
import { useTranslation } from 'react-i18next'
import { BreadcrumbProvider, useBreadcrumb } from './context/BreadcrumbContext'
import { ChatReferencesProvider } from './context/ChatReferencesContext'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from './api'
import { LoadingScreen } from './components/spinner'

// Route segment -> i18n key mapping
const routeKeyMap: Record<string, string> = {
  payments: 'sidebar:routes.payments',
  orders: 'sidebar:routes.orders',
  home: 'sidebar:routes.home',
  menu: 'sidebar:routes.menu',
  settings: 'sidebar:routes.settings',
  shifts: 'sidebar:routes.shifts',
  categories: 'sidebar:routes.categories',
  products: 'sidebar:routes.products',
  users: 'sidebar:routes.users',
  waiters: 'sidebar:routes.waiters',
  tpv: 'sidebar:routes.tpv',
  overview: 'sidebar:routes.overview',
  menumaker: 'sidebar:routes.menumaker',
  editvenue: 'sidebar:routes.editvenue',
  'credit-packs': 'sidebar:routes.creditPacks',
  'payment-links': 'sidebar:routes.paymentLinks',
  // Toda el área de promociones venía saliendo en inglés en la miga de pan
  // ("Promotions › Discounts") porque nunca se mapearon sus segmentos.
  promotions: 'sidebar:promotionsMenu.title',
  discounts: 'sidebar:promotionsMenu.discounts',
  coupons: 'sidebar:promotionsMenu.coupons',
  upsell: 'sidebar:promotionsMenu.upsell',
  // Mismo descuido que el de promociones, repetido al montar la tarjeta digital:
  // la miga de pan salia "Loyalty > Card" sobre un dashboard en espanol.
  customers: 'sidebar:customersMenu.title',
  loyalty: 'sidebar:customersMenu.loyalty',
  card: 'sidebar:customersMenu.walletCard',
  referrals: 'sidebar:customersMenu.referrals',
  // Tercera vez que aparece el mismo descuido (promociones, luego la tarjeta digital), asi que
  // esta pasada mapea el resto de las secciones navegables de una vez. Un segmento sin entrada
  // aqui NO falla: cae al fallback de abajo, que humaniza el slug de la URL — y como los slugs
  // estan en ingles, el usuario en espanol acababa leyendo "Modifier groups", "Purchase orders"
  // o "Suppliers". `dashboard.breadcrumbs.test.ts` avisa si se agrega una ruta nueva sin pasar
  // por aqui, para que no haya una cuarta ronda.
  // Catalogo
  menus: 'menu:menumaker.nav.menus',
  services: 'menu:menumaker.nav.services',
  'modifier-groups': 'menu:menumaker.nav.modifierGroups',
  groups: 'sidebar:routes.customerGroups',
  bundles: 'sidebar:routes.bundles',
  'sales-summary': 'sidebar:routes.reportSalesSummary',
  'sales-by-item': 'sidebar:routes.reportSalesByItem',
  'sales-by-category': 'sidebar:routes.reportSalesByCategory',
  'home-charts': 'sidebar:routes.reportHomeCharts',
  'pay-later-aging': 'sidebar:routes.reportPayLaterAging',
  // Inventario y compras
  inventory: 'sidebar:routes.inventory',
  suppliers: 'sidebar:routes.suppliers',
  vendors: 'sidebar:routes.suppliers',
  'purchase-orders': 'sidebar:routes.purchaseOrders',
  'raw-materials': 'sidebar:routes.rawMaterials',
  ingredients: 'sidebar:routes.ingredients',
  recipes: 'sidebar:routes.recipes',
  modifiers: 'sidebar:routes.modifiers',
  'stock-counts': 'sidebar:routes.stockCounts',
  counts: 'sidebar:routes.stockCounts',
  transfers: 'sidebar:routes.transfers',
  transferencias: 'sidebar:routes.transfers',
  // Operacion
  reservations: 'sidebar:routes.reservations',
  waitlist: 'sidebar:routes.waitlist',
  reviews: 'sidebar:routes.reviews',
  delivery: 'sidebar:routes.delivery',
  ecommerce: 'sidebar:routes.ecommerce',
  calendar: 'sidebar:routes.calendar',
  history: 'sidebar:routes.history',
  asistencia: 'sidebar:routes.attendance',
  team: 'sidebar:routes.teams',
  commissions: 'sidebar:routes.commissions',
  // Dinero
  refunds: 'sidebar:routes.refunds',
  disputes: 'sidebar:routes.disputes',
  subscriptions: 'sidebar:routes.subscriptions',
  billing: 'sidebar:routes.billing',
  bancos: 'sidebar:routes.banks',
  contabilidad: 'sidebar:routes.accounting',
  nomina: 'sidebar:routes.payroll',
  'tender-types': 'sidebar:routes.tenderTypes',
  'payment-methods': 'sidebar:routes.paymentMethods',
  fiscal: 'sidebar:routes.fiscal',
  cfdi: 'sidebar:routes.cfdi',
  // Reportes
  reports: 'sidebar:routes.reports',
  reportes: 'sidebar:routes.reports',
  // Ajustes
  account: 'sidebar:routes.account',
  profile: 'sidebar:routes.profile',
  security: 'sidebar:routes.security',
  preferences: 'sidebar:routes.preferences',
  notifications: 'sidebar:routes.notifications',
  documents: 'sidebar:routes.documents',
  general: 'sidebar:routes.general',
  branding: 'sidebar:routes.branding',
  integrations: 'sidebar:routes.integrations',
  'print-stations': 'sidebar:routes.printStations',
  'role-permissions': 'sidebar:routes.rolePermissions',
  'activity-log': 'sidebar:routes.activityLog',
  // Inventario (el modulo mas grande: 24 rutas). "Stock overview" salia asi, en ingles,
  // en la miga de pan de su pantalla principal.
  'stock-overview': 'sidebar:routes.stockOverview',
  'product-stock': 'sidebar:routes.productStock',
  'auto-reorder': 'sidebar:routes.autoReorder',
  profitability: 'sidebar:routes.profitability',
  'inter-venue-transfers': 'sidebar:routes.interVenueTransfers',
  'modifier-analytics': 'sidebar:routes.modifierAnalytics',
  restocks: 'sidebar:routes.restocks',
  // Acciones
  create: 'sidebar:routes.create',
  edit: 'sidebar:routes.edit',
}

function DashboardContent() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, authorizeVenue, allVenues } = useAuth()
  const { venue, venueSlug, fullBasePath, isLoading, hasVenueAccess } = useCurrentVenue()
  const { customSegments } = useBreadcrumb()

  // Mount the inventory welcome tour orchestrator here (stable across
  // venue sub-routes like /menumaker/* and /inventory/*), so the tour can
  // navigate between sections without losing state.
  useInventoryWelcomeTourOrchestrator()

  // Mount the platform-wide welcome tour orchestrator. Mounting it here
  // (instead of in Home.tsx) keeps it alive while the tour navigates
  // between pages, so the resume effect inside the hook can re-create
  // driver.js on each matching page.
  useAutoLaunchPlatformWelcomeTour()

  // Marca pasos del HomeSetupChecklist como done apenas un atomic tour
  // notifica completion. Listener cross-page (siempre vivo aquí en el
  // dashboard shell) — así no dependemos de que la Home esté montada en
  // el momento exacto del notify.
  useHomeChecklistAutoMark()

  // Sync del cache de tour-progress con backend (lastStepIndex por step
  // dentro de `home-checklist`). Hidrata el Map al boot, escribe writes
  // del cache vía `setValue` con debounce de 500ms.
  useTourProgressSync()

  // Live-demo journey (`?demoTour=venta-tpv`): crea el cobro simulado del
  // visitante vía /live-demo/sim/fast-payment y lo guía con un tour hasta
  // Ventas → Transacciones donde su pago acaba de aparecer. Inerte fuera
  // de venues demo (LIVE_DEMO/TRIAL). Montado aquí (no en una página) para
  // que el tour sobreviva la navegación entre rutas del venue.
  useDemoTour()

  // Cuando un atomic tour completa, si el HomeSetupChecklist había
  // registrado un return path antes de lanzarlo, regresamos al usuario a
  // esa ruta (típicamente Home). Pequeño delay para que el último popover
  // del tour termine de cerrarse antes del navigate. Usamos peek (no
  // drena la cola) para que HomeSetupChecklist al re-montar siga
  // recibiendo la completion y pueda marcar el step como done.
  usePeekAtomicTourCompletion(() => {
    const returnPath = consumeAtomicTourReturnPath()
    if (!returnPath) return
    window.setTimeout(() => navigate(returnPath), 150)
  })

  // Persistimos el fullBasePath actual del venue en sessionStorage para
  // que handlers DOM no-React (ej.: el botón "Volver a inicio" inyectado
  // dentro de un popover de driver.js) puedan leerlo sin tener acceso a
  // hooks. La ruta cambia cuando el user cambia de venue.
  useEffect(() => {
    if (!venueSlug) return
    try {
      sessionStorage.setItem('avoqado-current-venue-base-path', fullBasePath)
    } catch {
      /* noop */
    }
  }, [venueSlug, fullBasePath])

  // Command palette state
  const [commandOpen, setCommandOpen] = useState(false)
  const [sidebarMeta, setSidebarMeta] = useState<SidebarMeta>({ navItems: [], hiddenSidebarItems: [], isSuperadmin: false })
  // SUPERADMIN impersonation picker — popover open state controlled by the header button + global shortcut
  const [impersonationPickerOpen, setImpersonationPickerOpen] = useState(false)

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setCommandOpen(prev => !prev)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // Record the last venue slug where the user had access, to recover from invalid deep links.
  const [lastAccessibleVenueSlug, setLastAccessibleVenueSlug] = useState<string | null>(null)

  // SUPERADMIN tiene acceso global entre venues; OWNER queda limitado a su scope backend.
  const hasGlobalVenueAccess = user?.role === StaffRole.SUPERADMIN

  // Cuando el usuario accede a un venue al que tiene permisos, recordarlo como último válido
  useEffect(() => {
    if (venueSlug && hasVenueAccess) {
      setLastAccessibleVenueSlug(venueSlug)
    }
  }, [venueSlug, hasVenueAccess])

  // Verificar autorización al montar y cuando cambia el slug
  useEffect(() => {
    if (venueSlug) {
      authorizeVenue(venueSlug)
    }
  }, [venueSlug, authorizeVenue])

  // Restore to the last valid venue without artificial delays.
  useEffect(() => {
    if (!venueSlug || hasVenueAccess || hasGlobalVenueAccess || isLoading) {
      return
    }

    if (!lastAccessibleVenueSlug || lastAccessibleVenueSlug === venueSlug) {
      return
    }

    const currentPath = location.pathname
    const newPath = currentPath.startsWith('/wl/')
      ? currentPath.replace(/wl\/venues\/[^/]+/, `wl/venues/${lastAccessibleVenueSlug}`)
      : currentPath.replace(/venues\/[^/]+/, `venues/${lastAccessibleVenueSlug}`)

    if (newPath !== currentPath) {
      navigate(newPath, { replace: true })
    }
  }, [venueSlug, hasVenueAccess, hasGlobalVenueAccess, isLoading, lastAccessibleVenueSlug, location.pathname, navigate])

  // Mutation para reactivar venue suspendido
  const reactivateVenueMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/api/v1/dashboard/venues/${venue?.id}/reactivate`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status'] })
      window.location.reload()
    },
  })

  // Si está cargando el venue, mostrar estado de carga
  if (isLoading) {
    return <LoadingScreen message={t('dashboardShell.loadingVenue')} />
  }

  // Verificar si el venue está suspendido/cerrado (bloquear acceso completo)
  // SUPERADMIN puede acceder a cualquier venue, incluso suspendido
  const isVenueSuspended = venue?.status === 'SUSPENDED'
  const isVenueAdminSuspended = venue?.status === 'ADMIN_SUSPENDED'
  const isVenueClosed = venue?.status === 'CLOSED'
  const isSuperadmin = user?.role === StaffRole.SUPERADMIN

  if (venue && (isVenueSuspended || isVenueAdminSuspended || isVenueClosed) && !isSuperadmin) {
    const canReactivate = isVenueSuspended && [StaffRole.OWNER, StaffRole.ADMIN].includes(user?.role as StaffRole)

    return (
      <VenueSuspendedScreen
        status={venue.status as 'SUSPENDED' | 'ADMIN_SUSPENDED' | 'CLOSED'}
        venueName={venue.name}
        suspensionReason={venue.suspensionReason}
        canReactivate={canReactivate}
        onReactivate={() => reactivateVenueMutation.mutate()}
        isReactivating={reactivateVenueMutation.isPending}
        otherVenuesAvailable={(user?.venues?.length || 0) > 1}
      />
    )
  }

  // Si el usuario NO tiene acceso al slug, restaurar al último venue válido o mostrar acceso denegado.
  if (venueSlug && !hasVenueAccess && !hasGlobalVenueAccess) {
    // Mientras se restaura al último slug válido, mostrar estado de transición.
    if (lastAccessibleVenueSlug && lastAccessibleVenueSlug !== venueSlug) {
      return <LoadingScreen message={t('dashboardShell.restoringAccess')} />
    }

    // Si no hay venue válido anterior o no es privilegiado, mostrar mensaje de acceso denegado
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">{t('dashboardShell.accessDenied')}</h2>
          <p className="text-muted-foreground">{t('dashboardShell.noPermission')}</p>
        </div>
      </div>
    )
  }

  // Determine the route prefix based on current location
  const isWhiteLabelRoute = location.pathname.startsWith('/wl/')
  const routePrefix = isWhiteLabelRoute ? '/wl' : '/venues'

  const pathSegments = location.pathname
    .split('/')
    .filter(segment => segment)
    .slice(1) // Remover 'venues' o 'wl' del inicio

  // Get the display name for a path segment
  const getDisplayName = (segment: string, index: number): string => {
    // Check for custom breadcrumb first
    if (customSegments[segment]) {
      return customSegments[segment]
    }

    // Si es el primer segmento (slug del venue), usar el nombre del venue actual
    if (index === 0 && venue && segment === venueSlug) {
      return venue.name
    }

    // Para otros segmentos, verificar si corresponde a un slug de venue
    // Para propietarios (OWNER), buscar en allVenues
    if (user?.role === StaffRole.OWNER && allVenues?.length) {
      const venueMatch = allVenues.find(v => v.slug === segment)
      if (venueMatch) return venueMatch.name
    }
    // Para usuarios regulares, buscar en su lista de venues
    else if (user?.venues?.length) {
      const venueMatch = user.venues.find(v => v.slug === segment)
      if (venueMatch) return venueMatch.name
    }

    // Check if we have a predefined display name for this segment
    const lowerSegment = segment.toLowerCase()
    if (routeKeyMap[lowerSegment]) {
      return t(routeKeyMap[lowerSegment])
    }

    // Segmento sin mapear: se humaniza aqui (guiones -> espacios, solo la
    // primera letra en mayuscula). Antes lo hacia `capitalize` de CSS, que
    // ademas destrozaba los nombres ya traducidos: "Ligas de pago" -> "Ligas De Pago".
    return lowerSegment.replace(/[-_]+/g, ' ').replace(/^./, c => c.toUpperCase())
  }

  return (
    <SidebarProvider className="theme-scaled">
      <AppSidebar user={user} variant="inset" onSidebarReady={setSidebarMeta} onSearchClick={() => setCommandOpen(true)} />
      <SidebarInset
        style={
          {
            '--font-sans': 'var(--font-inter)',
          } as React.CSSProperties
        }
      >
        <header
          className={`flex h-14 md:h-16 shrink-0 items-center justify-between transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 px-3 md:px-4 text-foreground`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <SidebarTrigger className="-ml-1 shrink-0" />
            <Separator orientation="vertical" className="h-4 mr-2 hidden sm:block" />
            {/* Breadcrumb: Shows venue name + path segments */}
            <Breadcrumb className="hidden sm:block">
              <BreadcrumbList>
                {pathSegments.map((segment, index) => {
                  const isLast = index === pathSegments.length - 1
                  const linkPath = `${routePrefix}/${pathSegments.slice(0, index + 1).join('/')}`
                  const displayName = getDisplayName(segment, index)

                  return (
                    <BreadcrumbItem key={`${segment}-${index}`}>
                      {isLast ? (
                        <BreadcrumbPage>{displayName}</BreadcrumbPage>
                      ) : (
                        <>
                          <BreadcrumbLink as={Link} to={linkPath}>
                            {displayName}
                          </BreadcrumbLink>
                          <BreadcrumbSeparator />
                        </>
                      )}
                    </BreadcrumbItem>
                  )
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Superadmin Navigation Button - only show for SUPERADMIN users */}
            {user?.role === StaffRole.SUPERADMIN && (
              <Button variant="outline" size="sm" onClick={() => navigate('/superadmin')} className="flex items-center space-x-1 sm:space-x-2">
                <Shield className="w-4 h-4" />
                <span className="hidden sm:inline">{t('header.superadmin', { ns: 'superadmin' })}</span>
                <ArrowLeft className="w-3 h-3 hidden sm:block" />
              </Button>
            )}
            {/* SUPERADMIN impersonation — button hidden for non-superadmins.
                While an impersonation session is active, the button transforms
                into a destructive "Salir" action. */}
            <ImpersonationHeaderButton open={impersonationPickerOpen} onOpenChange={setImpersonationPickerOpen} />
            <LanguageSwitcher />
            {/* Payment setup alert (SUPERADMIN-only) — header variant shows
                a compact gradient icon button that opens a popover with the
                full alert card. Replaces the old fixed floating version that
                used to cover pagination in the bottom-right. */}
            {venue && <PaymentSetupAlert venueId={venue.id} variant="header" />}
            <NotificationBell />
            <ThemeToggle />
          </div>
        </header>

        {/* Impersonation banner — visible only while the SUPERADMIN is inside
            a read-only impersonation session. Sticky at the top with a striped
            amber→pink gradient that is visually distinct from every other banner. */}
        <ImpersonationBanner />

        {/* Demo conversion banner — shows for BOTH the onboarding TRIAL venue
            (convert-this-venue flow) and the public LIVE_DEMO venue
            (create-real-account flow). DemoBanner branches by status. */}
        {isDemoVenueStatus(venue?.status) && <DemoBanner />}

        {/* Trial Status Banner - show for non-demo venues with active feature trials */}
        {venue?.status !== 'TRIAL' && venue?.status !== 'LIVE_DEMO' && <TrialStatusBanner />}

        <div className="flex flex-col flex-1 gap-4 p-4">
          {/* Main Content */}
          <div className={`flex-1 rounded-xl bg-background transition-colors duration-200`}>
            <Outlet />
          </div>
        </div>

        {/* Anuncio de plataforma que Avoqado marcó para interrumpir. Vive AQUÍ, en el
            layout, no dentro del Home: si viviera en el Home sólo lo vería quien pasa por
            el inicio. Sale una vez, se cierra, y después queda en la campana. */}
        <AnnouncementGate />

        {/* PaymentSetupAlert moved to the header (see above) — the floating
            bottom-right version was covering DataTable pagination. */}

        {/* ChatBubble trigger has moved to the sidebar footer (see AppSidebar).
            The chat panel itself is still position:fixed so it opens from the
            bottom-right regardless of where the trigger button lives. */}
      </SidebarInset>
      <DashboardCommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        navItems={sidebarMeta.navItems}
        hiddenSidebarItems={sidebarMeta.hiddenSidebarItems}
        isSuperadmin={sidebarMeta.isSuperadmin}
        onOpenImpersonation={() => setImpersonationPickerOpen(true)}
      />

      {/* Global keyboard shortcut (⌘⇧I) to toggle the impersonation picker / exit. */}
      <ImpersonationShortcut
        onTogglePicker={() => setImpersonationPickerOpen(prev => !prev)}
      />

      {/* Whole-screen amber ring while impersonating — peripheral-vision reminder. */}
      <ImpersonationScreenRing />

      {/* Turns impersonation 401/403 responses into toasts + state cleanup. */}
      <ImpersonationErrorListener />
    </SidebarProvider>
  )
}

export default function Dashboard() {
  return (
    <BreadcrumbProvider>
      <ChatReferencesProvider>
        <DashboardContent />
      </ChatReferencesProvider>
    </BreadcrumbProvider>
  )
}
