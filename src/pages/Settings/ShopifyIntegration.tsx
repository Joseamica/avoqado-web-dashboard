import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { useInvalidateShopifyListas, useInvalidateShopifyResumen, useShopifyOverview } from '@/hooks/use-shopify'
import { useVenueTier } from '@/hooks/use-tier-feature-access'
import { conexionDetenida, SHOPIFY_CALLBACK_ERRORS, SHOPIFY_FEATURE, type ShopifyEstado } from '@/types/shopify'
import { ShopifyConnect, ShopifyPiloto } from './components/shopify/ShopifyConnect'
import { ShopifyConnectReview, ShopifyImportDetenida, ShopifyProgreso } from './components/shopify/ShopifyConnectReview'
import { ShopifyIssueList } from './components/shopify/ShopifyIssueList'
import { Cargando, ErrorConReintento } from './components/shopify/ShopifyListStates'
import { ShopifyReviewList } from './components/shopify/ShopifyReviewList'
import { ShopifyStatusCard } from './components/shopify/ShopifyStatusCard'
import { type Navegar, navegarDeVerdad } from './components/shopify/shopify.helpers'

/**
 * Configuración › Integraciones › Shopify (spec 2026-10-07 §4 ⑥ y 12 bis). Vive en
 * `/venues/:slug/settings/integrations/shopify`: ahí ligan los avisos de la campanita (plan A) y el detalle de un conteo.
 *
 * 🔴 Sin `FeatureGate` (Codex N2): su cartel ofrece comprar el plan y en la Fase 1 comprar Premium no da Shopify. Sin
 * conexión, el acceso lo decide lo que el server CONCEDE: `planActive` del resumen y `useVenueTier` (`grantedFeatureCodes`).
 * Con acceso, el formulario; sin él, «Shopify está en piloto». Con una conexión (también pausada o sin permiso) la pausa se ve
 * y se explica, y Desconectar no lleva candado de plan.
 *
 * Permisos (nombres exactos del server): `inventory:read` ve · `settings:manage` conecta, aplica, desconecta, reautoriza y
 * cuadra · `inventory:adjust` resuelve. Sin el permiso, la acción se VE deshabilitada y un texto dice a quién pedirlo.
 *
 * Todo se reinicia al cambiar de sucursal: el Outlet del layout no lleva `key`, así que la raíz la lleva (N12) y ni la
 * búsqueda, ni los filtros, ni los datos provisionales cruzan de una sucursal a otra.
 */
export default function ShopifyIntegration({ navegar = navegarDeVerdad }: { navegar?: Navegar }) {
  const { venueId } = useCurrentVenue()
  return <PaginaShopify key={venueId ?? 'sin-sucursal'} navegar={navegar} />
}

function PaginaShopify({ navegar }: { navegar: Navegar }) {
  const { t } = useTranslation('shopify')
  const { venueId } = useCurrentVenue()
  const { can, isLoading: permisosCargando } = useAccess()
  const { hasFeatureAccess, isResolved, isLoading: accesoCargando } = useVenueTier()
  const { toast } = useToast()
  const [params, setParams] = useSearchParams()
  const overview = useShopifyOverview(venueId ?? undefined)
  const invalidarListas = useInvalidateShopifyListas()
  const invalidarResumen = useInvalidateShopifyResumen()
  const resumen = overview.data
  const connection = resumen?.connection ?? null
  const canManage = can('settings:manage')
  const canRead = can('inventory:read')
  const intent = params.get('intent')
  // Si la consulta del plan falló (no resuelta) se deja intentar: el server decide con su candado.
  const sinAcceso = (isResolved && !hasFeatureAccess(SHOPIFY_FEATURE)) || resumen?.planActive === false

  // Regreso del OAuth (B): `?error=<código>` o `?reautorizada=1`. Se avisa UNA vez (el ref evita el doble aviso de StrictMode)
  // y se limpian de la URL.
  const avisado = useRef<string | null>(null)
  useEffect(() => {
    const error = params.get('error')
    const reautorizada = params.get('reautorizada')
    if (!error && !reautorizada) return
    const marca = `${error}|${reautorizada}`
    if (avisado.current === marca) return
    avisado.current = marca
    if (error) {
      const conocido = (SHOPIFY_CALLBACK_ERRORS as readonly string[]).includes(error)
      toast({ variant: 'destructive', title: t(`connect.callbackErrors.${conocido ? error : 'generic'}`) })
    } else {
      toast({ title: t('connect.reauthorized') })
    }
    const resto = new URLSearchParams(params)
    resto.delete('error')
    resto.delete('reautorizada')
    setParams(resto, { replace: true })
  }, [params, setParams, toast, t])

  // N6 y requisito 8: se refrescan las dos listas cuando (a) el cuadre pedido TERMINÓ: `pendiente` pasa de true a false O cambia
  // `cuadre.ultimo` (un cuadre rápido puede cerrar antes del primer GET y la página nunca ve `pendiente = true`); o (b) la
  // aplicación del stock TERMINÓ (APLICANDO → ACTIVA). Sólo cuenta con un resumen ya visto: la primera carga no refresca nada.
  const estado = connection?.estado
  const cuadrePendiente = connection?.cuadre.pendiente
  const cuadreUltimo = connection?.cuadre.ultimo
  const visto = useRef<{ estado: ShopifyEstado; pendiente: boolean; ultimo: string | null } | null>(null)
  useEffect(() => {
    const antes = visto.current
    visto.current =
      estado === undefined || cuadrePendiente === undefined ? null : { estado, pendiente: cuadrePendiente, ultimo: cuadreUltimo ?? null }
    if (!antes || !visto.current) return
    const cuadreTermino = (antes.pendiente && !cuadrePendiente) || antes.ultimo !== (cuadreUltimo ?? null)
    const aplicacionTermino = antes.estado === 'APLICANDO' && estado === 'ACTIVA'
    if (cuadreTermino || aplicacionTermino) void invalidarListas(venueId ?? undefined)
  }, [estado, cuadrePendiente, cuadreUltimo, invalidarListas, venueId])

  // Sin permiso de Shopify, B contesta 403 SHOPIFY_FALTA_PERMISO la primera vez y 409 SHOPIFY_EN_PAUSA después: en cuanto el
  // resumen trae la marca, no se ofrece elegir y se dice por qué. Sin el permiso del usuario, los botones se ven deshabilitados.
  const sinPermisoResolver = !can('inventory:adjust')
  const motivoSinResolver = sinPermisoResolver
    ? t('review.readOnlyResolve')
    : !resumen?.planActive || connection?.estado !== 'ACTIVA'
      ? t('review.inactiveResolve')
      : connection.importacion.error === 'FALTA_PERMISO'
        ? t('review.permissionResolve')
        : null

  // «Volver a empezar» suelta el intent y relee el resumen: el asistente pudo morir porque la sucursal YA estaba conectada
  // (RELEER) y el resumen en pantalla sigue diciendo «sin conexión».
  const alVolverAEmpezar = () => {
    setParams({}, { replace: true })
    void invalidarResumen(venueId ?? undefined)
  }

  function contenido() {
    // Mientras los permisos cargan no se sabe si falta `inventory:read`: «cargando», nunca «No tienes permiso» por un instante.
    if (permisosCargando) return <Cargando />
    if (!canRead) {
      return (
        <Alert className="border-input bg-muted/40">
          <AlertDescription className="text-sm text-muted-foreground">{t('errors.forbidden')}</AlertDescription>
        </Alert>
      )
    }
    if (!venueId || (overview.isLoading && !resumen) || (!connection && !intent && accesoCargando)) return <Cargando />
    if (overview.isError && !resumen)
      return <ErrorConReintento texto={t('errors.loadError')} onRetry={() => overview.refetch()} cargando={overview.isFetching} />
    if (intent)
      return <ShopifyConnect venueId={venueId} intent={intent} canManage={canManage} navegar={navegar} onDone={alVolverAEmpezar} />
    if (!connection) {
      return sinAcceso ? (
        <ShopifyPiloto canManage={canManage} />
      ) : (
        <ShopifyConnect venueId={venueId} intent={null} canManage={canManage} navegar={navegar} onDone={alVolverAEmpezar} />
      )
    }
    const enCurso = connection.estado === 'IMPORTANDO' || connection.estado === 'APLICANDO' || connection.estado === 'POR_APLICAR'
    if (enCurso) {
      // Detenida por un error permanente: no hay avance que esperar ni sondeo (N7, Z2); se ofrece lo que la arregla.
      if (conexionDetenida(connection))
        return <ShopifyImportDetenida venueId={venueId} connection={connection} canManage={canManage} navegar={navegar} />
      return connection.estado === 'POR_APLICAR' ? (
        <ShopifyConnectReview venueId={venueId} canManage={canManage} />
      ) : (
        <ShopifyProgreso connection={connection} />
      )
    }
    return (
      <>
        <ShopifyStatusCard venueId={venueId} overview={resumen!} connection={connection} canManage={canManage} navegar={navegar} />
        <ShopifyReviewList venueId={venueId} overview={resumen} sinPermiso={sinPermisoResolver} motivoSinResolver={motivoSinResolver} />
        <ShopifyIssueList venueId={venueId} />
      </>
    )
  }

  return (
    <div className="space-y-6 p-6" data-tour="shopify-integration-page">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('page.title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('page.subtitle')}</p>
      </div>
      {!permisosCargando && canRead && !canManage && (
        <Alert className="border-input bg-muted/40">
          <AlertDescription className="text-sm text-muted-foreground">{t('page.readOnly')}</AlertDescription>
        </Alert>
      )}
      {overview.isRefetchError && (
        <ErrorConReintento texto={t('page.staleOverview')} onRetry={() => overview.refetch()} cargando={overview.isFetching} />
      )}
      <div className="space-y-6">{contenido()}</div>
    </div>
  )
}
