/**
 * StockControl - Serialized Inventory Management
 *
 * Features:
 * - Summary cards by category with coverage estimation
 * - Stock vs Sales chart
 * - Low stock alerts
 * - Movements table with search, filters, and export (CSV/Excel)
 * - Bulk CSV upload
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/context/AuthContext'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { getCategoryStock, getStockMetrics, getStockMovements, type StockMovement } from '@/services/stockDashboard.service'
import { useQuery } from '@tanstack/react-query'
import { Box, CheckCircle2, Download, FileSpreadsheet, FileText, Package, Plus, Search, Settings2, Upload } from 'lucide-react'
import { Suspense, useCallback, useMemo, useState } from 'react'
import { lazyWithRetry } from '@/lib/lazyWithRetry'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { BulkUploadDialog, CategoryManagement, LowStockAlerts, StockVsSalesChart } from './components'

// `lazyWithRetry` instead of raw `lazy` so a stale chunk after a deploy triggers
// an automatic hard reload (fetching fresh chunk hashes) instead of bubbling a
// "Failed to fetch dynamically imported module" to the route-level error page.
const VenueSimCustodyPanel = lazyWithRetry(() =>
  import('./components/VenueSimCustodyPanel').then(m => ({ default: m.VenueSimCustodyPanel })),
)

// ─── Movement type config (Spanish labels + styling) ───
const MOVEMENT_TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  REGISTERED: { label: 'Registro SIM', className: 'bg-green-500/10 text-green-600 border-green-500/20' },
  SOLD: { label: 'Vendido', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  RETURNED: { label: 'Devuelto', className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  DAMAGED: { label: 'Dañado', className: 'bg-red-500/10 text-red-600 border-red-500/20' },
  BULK_UPLOAD: { label: 'Carga masiva', className: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
}
const FALLBACK_TYPE_CONFIG = { label: 'Desconocido', className: 'bg-muted text-muted-foreground' }

// ─── Export helpers ───
function escapeCSV(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`
  }
  return val
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + content], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function StockControl() {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { venueId } = useCurrentVenue()
  const { activeVenue } = useAuth()
  const { can } = useAccess()
  const venueTimezone = activeVenue?.timezone || 'America/Mexico_City'
  const canUploadStock = can('serialized-inventory:create')

  // Custody tab: visible to any role that can assign SIMs to a Promoter. The
  // tab itself filters to "my SIMs" so Supervisors see their own inventory
  // first. OWNER/SUPERADMIN also see the tab but with empty state unless they
  // happen to own SIMs (rare — they're typically upstream).
  const canSeeCustody = can('sim-custody:assign-to-promoter') || can('sim-custody:collect-from-promoter')
  const orgIdFromVenue = activeVenue?.organizationId ?? null
  const [activeTab, setActiveTab] = useState<'inventario' | 'custodia'>('inventario')

  // Dialog state
  const [showCategoryManagement, setShowCategoryManagement] = useState(false)
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [bulkDetailMovement, setBulkDetailMovement] = useState<StockMovement | null>(null)

  // Movements filters
  const [movementSearch, setMovementSearch] = useState('')
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>('all')
  const [movementCategoryFilter, setMovementCategoryFilter] = useState<string>('all')

  // ─── Queries ───
  const { data: metricsData, isLoading: isLoadingMetrics } = useQuery({
    queryKey: ['stock', 'metrics', venueId],
    queryFn: () => getStockMetrics(venueId!),
    enabled: !!venueId,
  })

  const { data: categoryData, isLoading: isLoadingCategories } = useQuery({
    queryKey: ['stock', 'categories', venueId],
    queryFn: () => getCategoryStock(venueId!),
    enabled: !!venueId,
  })

  const { data: movementsData, isLoading: isLoadingMovements } = useQuery({
    queryKey: ['stock', 'movements', venueId],
    queryFn: () => getStockMovements(venueId!, { limit: 500 }),
    enabled: !!venueId,
  })

  const isLoading = isLoadingMetrics || isLoadingCategories || isLoadingMovements
  const categories = categoryData?.categories || []
  const movements = movementsData?.movements || []

  // Totals
  const totals = useMemo(
    () => ({
      available: metricsData?.availablePieces || 0,
      sold: metricsData?.soldToday || 0,
      total: metricsData?.totalPieces || 0,
    }),
    [metricsData],
  )

  // ─── Filtered movements ───
  const filteredMovements = useMemo(() => {
    let result = movements
    if (movementSearch.trim()) {
      const q = movementSearch.toLowerCase()
      result = result.filter(
        m =>
          m.serialNumber.toLowerCase().includes(q) ||
          m.categoryName.toLowerCase().includes(q) ||
          (m.userName && m.userName.toLowerCase().includes(q)) ||
          (m.venueName && m.venueName.toLowerCase().includes(q)),
      )
    }
    if (movementTypeFilter !== 'all') {
      result = result.filter(m => m.type === movementTypeFilter)
    }
    if (movementCategoryFilter !== 'all') {
      result = result.filter(m => m.categoryName === movementCategoryFilter)
    }
    return result
  }, [movements, movementSearch, movementTypeFilter, movementCategoryFilter])

  // Unique category names for filter
  const uniqueCategories = useMemo(() => {
    const names = new Set(movements.map(m => m.categoryName))
    return [...names].sort()
  }, [movements])

  // ─── Format helpers ───
  const formatDate = useCallback(
    (ts: string) => {
      return new Date(ts).toLocaleString('es-MX', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: venueTimezone,
      })
    },
    [venueTimezone],
  )

  const getTypeLabel = (type: string) => MOVEMENT_TYPE_CONFIG[type]?.label || type

  // ─── Export ───
  const buildExportRows = useCallback(() => {
    const headers = ['SIM ID', 'Categoría', 'Tipo', 'Fecha', 'Usuario', 'Registrado desde', 'Vendido por', 'Vendido en']
    const rows: string[][] = []
    for (const m of filteredMovements) {
      const soldBy = m.soldByName || '-'
      const soldAt = m.soldAtVenueName || '-'
      if (m.type === 'BULK_UPLOAD' && m.serialNumbers && m.serialNumbers.length > 0) {
        for (const sn of m.serialNumbers) {
          rows.push([sn, m.categoryName, getTypeLabel(m.type), formatDate(m.timestamp), m.userName || '-', m.registeredFromVenueName || '-', soldBy, soldAt])
        }
      } else {
        rows.push([m.serialNumber, m.categoryName, getTypeLabel(m.type), formatDate(m.timestamp), m.userName || '-', m.registeredFromVenueName || '-', soldBy, soldAt])
      }
    }
    return { headers, rows }
  }, [filteredMovements, formatDate])

  const handleExportCSV = useCallback(() => {
    const { headers, rows } = buildExportRows()
    const lines = [headers.map(escapeCSV).join(','), ...rows.map(r => r.map(escapeCSV).join(','))]
    downloadFile(lines.join('\n'), `movimientos_stock_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv')
  }, [buildExportRows])

  const handleExportExcel = useCallback(() => {
    // Generate a simple XML-based Excel file (compatible with Excel, LibreOffice, Numbers)
    const { headers, rows } = buildExportRows()
    const escXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const headerCells = headers.map(h => `<Cell><Data ss:Type="String">${escXml(h)}</Data></Cell>`).join('')
    const dataRows = rows
      .map(r => {
        const cells = r.map(c => `<Cell><Data ss:Type="String">${escXml(c)}</Data></Cell>`).join('')
        return `<Row>${cells}</Row>`
      })
      .join('')
    const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Movimientos"><Table>
<Row>${headerCells}</Row>
${dataRows}
</Table></Worksheet></Workbook>`
    downloadFile(xml, `movimientos_stock_${new Date().toISOString().slice(0, 10)}.xls`, 'application/vnd.ms-excel')
  }, [buildExportRows])

  // ─── Stock request handler ───
  const handleRequestStock = (productId: string) => {
    console.log('Requesting stock for product:', productId)
  }

  // ─── Loading ───
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-20 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold">{t('playtelecom:stock.title', { defaultValue: 'Control de Inventario' })}</h2>
          <p className="text-sm text-muted-foreground">
            {t('playtelecom:stock.subtitle', { defaultValue: 'Gestiona categorías y números de serie' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowCategoryManagement(true)}>
            <Settings2 className="w-4 h-4 mr-2" />
            {t('playtelecom:stock.manageCategories', { defaultValue: 'Configurar Categorías' })}
          </Button>
          {canUploadStock && (
            <Button onClick={() => setShowBulkUpload(true)}>
              <Upload className="w-4 h-4 mr-2" />
              {t('playtelecom:stock.uploadItems', { defaultValue: 'Cargar Items' })}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs: Inventario (todo lo existente) + Custodia (panel del Supervisor) */}
      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as 'inventario' | 'custodia')}>
        {canSeeCustody && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('inventario')}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTab === 'inventario'
                  ? 'bg-foreground text-background'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted'
              }`}
            >
              {t('playtelecom:stock.tabs.inventario', { defaultValue: 'Inventario' })}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('custodia')}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTab === 'custodia'
                  ? 'bg-foreground text-background'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted'
              }`}
            >
              {t('playtelecom:stock.tabs.custodia', { defaultValue: 'Custodia de SIMs' })}
            </button>
          </div>
        )}

        <TabsContent value="inventario" className="mt-4 space-y-6">

      {/* Category Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {categories.length > 0 ? (
          categories.slice(0, 4).map(category => (
            <GlassCard key={category.id} className="p-4" hover>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-sm">{category.name}</h3>
                <Package className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('playtelecom:stock.available', { defaultValue: 'Disponible' })}</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">{category.available}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('playtelecom:stock.sold7d', { defaultValue: 'Vendidos 7d' })}</span>
                  <span className="font-medium">{category.sold7d}</span>
                </div>
                <div className="h-px bg-border/50" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('playtelecom:stock.coverage', { defaultValue: 'Cobertura' })}</span>
                  <span
                    className={`font-bold ${
                      (category.coverage || 0) < 7 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                    }`}
                  >
                    {category.coverage !== null ? `${category.coverage} días` : '-'}
                  </span>
                </div>
              </div>
            </GlassCard>
          ))
        ) : (
          <GlassCard className="col-span-full p-8 text-center">
            <Package className="w-10 h-10 mx-auto mb-2 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mb-4">
              {t('playtelecom:stock.noCategories', { defaultValue: 'No hay categorías de stock configuradas' })}
            </p>
            <Button onClick={() => setShowCategoryManagement(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {t('playtelecom:stock.createFirstCategory', { defaultValue: 'Crear Primera Categoría' })}
            </Button>
          </GlassCard>
        )}
      </div>

      {/* Summary Bar */}
      <GlassCard className="p-4">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-linear-to-br from-green-500/20 to-green-500/5">
              <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('playtelecom:stock.totalAvailable', { defaultValue: 'Total Disponible' })}</p>
              <p className="text-lg font-semibold">{totals.available}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-linear-to-br from-blue-500/20 to-blue-500/5">
              <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('playtelecom:stock.soldToday', { defaultValue: 'Vendido Hoy' })}</p>
              <p className="text-lg font-semibold">{totals.sold}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-linear-to-br from-purple-500/20 to-purple-500/5">
              <Box className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('playtelecom:stock.totalInventory', { defaultValue: 'Inventario Total' })}</p>
              <p className="text-lg font-semibold">{totals.total}</p>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Stock vs Sales Chart & Low Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StockVsSalesChart />
        <LowStockAlerts onRequestStock={handleRequestStock} />
      </div>

      {/* ─── Movimientos Recientes ─── */}
      <GlassCard className="p-6">
        {/* Header + Export */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <h3 className="text-lg font-semibold">{t('playtelecom:stock.recentMovements', { defaultValue: 'Movimientos Recientes' })}</h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                {t('playtelecom:stock.export', { defaultValue: 'Exportar' })}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportCSV}>
                <FileText className="w-4 h-4 mr-2" />
                CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportExcel}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Excel (.xls)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={movementSearch}
              onChange={e => setMovementSearch(e.target.value)}
              placeholder={t('playtelecom:stock.searchPlaceholder', { defaultValue: 'Buscar por SIM ID, categoría, usuario...' })}
              className="pl-9 h-9"
            />
          </div>
          <Select value={movementTypeFilter} onValueChange={setMovementTypeFilter}>
            <SelectTrigger className="w-full sm:w-[160px] h-9">
              <SelectValue placeholder={t('playtelecom:stock.filterType', { defaultValue: 'Tipo' })} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('playtelecom:stock.allTypes', { defaultValue: 'Todos los tipos' })}</SelectItem>
              <SelectItem value="REGISTERED">Registro SIM</SelectItem>
              <SelectItem value="SOLD">Vendido</SelectItem>
              <SelectItem value="RETURNED">Devuelto</SelectItem>
              <SelectItem value="DAMAGED">Dañado</SelectItem>
              <SelectItem value="BULK_UPLOAD">Carga masiva</SelectItem>
            </SelectContent>
          </Select>
          {uniqueCategories.length > 1 && (
            <Select value={movementCategoryFilter} onValueChange={setMovementCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[180px] h-9">
                <SelectValue placeholder={t('playtelecom:stock.filterCategory', { defaultValue: 'Categoría' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('playtelecom:stock.allCategories', { defaultValue: 'Todas las categorías' })}</SelectItem>
                {uniqueCategories.map(cat => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Results count */}
        {(movementSearch || movementTypeFilter !== 'all' || movementCategoryFilter !== 'all') && (
          <p className="text-xs text-muted-foreground mb-3">
            {filteredMovements.length} {filteredMovements.length === 1 ? 'resultado' : 'resultados'}
          </p>
        )}

        {/* Table — desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">SIM ID</th>
                <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('playtelecom:stock.category', { defaultValue: 'Categoría' })}
                </th>
                <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('playtelecom:stock.type', { defaultValue: 'Tipo' })}
                </th>
                <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('playtelecom:stock.timestamp', { defaultValue: 'Fecha' })}
                </th>
                <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('playtelecom:stock.user', { defaultValue: 'Usuario' })}
                </th>
                <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Registrado desde</th>
                <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Vendido por</th>
                <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Vendido en</th>
              </tr>
            </thead>
            <tbody>
              {filteredMovements.length > 0 ? (
                filteredMovements.map(movement => {
                  const typeConfig = MOVEMENT_TYPE_CONFIG[movement.type] || FALLBACK_TYPE_CONFIG
                  return (
                    <tr
                      key={movement.id}
                      className={`border-b border-border/30 hover:bg-muted/30 transition-colors ${movement.type === 'BULK_UPLOAD' ? 'cursor-pointer' : ''}`}
                      onClick={movement.type === 'BULK_UPLOAD' ? () => setBulkDetailMovement(movement) : undefined}
                    >
                      <td className="py-3 px-2">
                        {movement.type === 'BULK_UPLOAD' ? (
                          <span className="text-xs font-medium text-purple-600 dark:text-purple-400">
                            {movement.itemCount ?? movement.serialNumber} items
                          </span>
                        ) : (
                          <code className="text-xs bg-muted/50 px-2 py-1 rounded font-mono">{movement.serialNumber}</code>
                        )}
                      </td>
                      <td className="py-3 px-2 text-sm">{movement.categoryName}</td>
                      <td className="py-3 px-2">
                        <Badge variant="outline" className={`text-xs ${typeConfig.className}`}>
                          {typeConfig.label}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 text-sm text-muted-foreground whitespace-nowrap">{formatDate(movement.timestamp)}</td>
                      <td className="py-3 px-2 text-sm">{movement.userName || <span className="text-muted-foreground">-</span>}</td>
                      <td className="py-3 px-2 text-sm">
                        {movement.registeredFromVenueName || <span className="text-muted-foreground">-</span>}
                      </td>
                      <td className="py-3 px-2 text-sm">{movement.soldByName || <span className="text-muted-foreground">-</span>}</td>
                      <td className="py-3 px-2 text-sm">{movement.soldAtVenueName || <span className="text-muted-foreground">-</span>}</td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    {movementSearch || movementTypeFilter !== 'all' || movementCategoryFilter !== 'all'
                      ? t('playtelecom:stock.noResults', { defaultValue: 'No se encontraron movimientos con esos filtros' })
                      : t('playtelecom:stock.noMovements', { defaultValue: 'No hay movimientos recientes' })}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <div className="md:hidden space-y-2">
          {filteredMovements.length > 0 ? (
            filteredMovements.map(movement => {
              const typeConfig = MOVEMENT_TYPE_CONFIG[movement.type] || FALLBACK_TYPE_CONFIG
              return (
                <div
                  key={movement.id}
                  className={`rounded-lg border border-border/50 p-3 space-y-2 ${movement.type === 'BULK_UPLOAD' ? 'cursor-pointer active:bg-muted/50' : ''}`}
                  onClick={movement.type === 'BULK_UPLOAD' ? () => setBulkDetailMovement(movement) : undefined}
                >
                  <div className="flex items-center justify-between gap-2">
                    {movement.type === 'BULK_UPLOAD' ? (
                      <span className="text-xs font-medium text-purple-600 dark:text-purple-400">
                        {movement.itemCount ?? movement.serialNumber} items
                      </span>
                    ) : (
                      <code className="text-xs bg-muted/50 px-2 py-1 rounded font-mono truncate">{movement.serialNumber}</code>
                    )}
                    <Badge variant="outline" className={`text-xs shrink-0 ${typeConfig.className}`}>
                      {typeConfig.label}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <span className="text-muted-foreground">Categoría</span>
                    <span className="truncate">{movement.categoryName}</span>
                    <span className="text-muted-foreground">Fecha</span>
                    <span>{formatDate(movement.timestamp)}</span>
                    <span className="text-muted-foreground">Usuario</span>
                    <span>{movement.userName || '-'}</span>
                    {movement.registeredFromVenueName && (
                      <>
                        <span className="text-muted-foreground">Registrado desde</span>
                        <span className="truncate">{movement.registeredFromVenueName}</span>
                      </>
                    )}
                    {movement.soldByName && (
                      <>
                        <span className="text-muted-foreground">Vendido por</span>
                        <span className="truncate">{movement.soldByName}</span>
                      </>
                    )}
                    {movement.soldAtVenueName && (
                      <>
                        <span className="text-muted-foreground">Vendido en</span>
                        <span className="truncate">{movement.soldAtVenueName}</span>
                      </>
                    )}
                  </div>
                </div>
              )
            })
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {movementSearch || movementTypeFilter !== 'all' || movementCategoryFilter !== 'all'
                ? t('playtelecom:stock.noResults', { defaultValue: 'No se encontraron movimientos con esos filtros' })
                : t('playtelecom:stock.noMovements', { defaultValue: 'No hay movimientos recientes' })}
            </p>
          )}
        </div>
      </GlassCard>
        </TabsContent>

        {/* Custodia de SIMs — panel del Supervisor (o filtrado a su inventario) */}
        <TabsContent value="custodia" className="mt-4">
          {orgIdFromVenue ? (
            <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
              <VenueSimCustodyPanel orgId={orgIdFromVenue} />
            </Suspense>
          ) : (
            <div className="text-sm text-muted-foreground py-8 text-center">
              No se pudo determinar la organización del venue activo.
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <CategoryManagement open={showCategoryManagement} onOpenChange={setShowCategoryManagement} />
      <BulkUploadDialog open={showBulkUpload} onOpenChange={setShowBulkUpload} />

      {/* Bulk upload detail dialog */}
      <Dialog open={!!bulkDetailMovement} onOpenChange={() => setBulkDetailMovement(null)}>
        <DialogContent className="max-w-md max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20">
                Carga masiva
              </Badge>
              {bulkDetailMovement?.itemCount} items
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
              <span>Categoría</span>
              <span className="text-foreground">{bulkDetailMovement?.categoryName}</span>
              <span>Fecha</span>
              <span className="text-foreground">{bulkDetailMovement && formatDate(bulkDetailMovement.timestamp)}</span>
              <span>Usuario</span>
              <span className="text-foreground">{bulkDetailMovement?.userName || '-'}</span>
              {bulkDetailMovement?.registeredFromVenueName && (
                <>
                  <span>Registrado desde</span>
                  <span className="text-foreground">{bulkDetailMovement.registeredFromVenueName}</span>
                </>
              )}
            </div>
            <div className="border-t border-border pt-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Números de serie</p>
              <div className="max-h-[40vh] overflow-y-auto space-y-1">
                {bulkDetailMovement?.serialNumbers?.map((sn, i) => (
                  <div key={sn} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50">
                    <span className="text-xs text-muted-foreground w-6 text-right">{i + 1}</span>
                    <code className="text-xs bg-muted/50 px-2 py-0.5 rounded font-mono">{sn}</code>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default StockControl
