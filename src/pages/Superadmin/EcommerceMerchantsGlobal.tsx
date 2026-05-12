/**
 * EcommerceMerchantsGlobal — Superadmin cross-venue view of every ecommerce
 * merchant Avoqado is processing on behalf of.
 *
 * - Top: editable "default" platform fee (applies to NEW merchants only)
 * - Below: table of every merchant with their platformFeeBps and GMV
 *   (paymentCount, totalCollected). Inline edit on the fee column.
 *
 * Per CLAUDE.md, Superadmin pages use hardcoded Spanish — no i18n needed.
 *
 * @module pages/Superadmin/EcommerceMerchantsGlobal
 */

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Loader2, ShoppingCart, ExternalLink, Settings2, Search, X, History } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { useDebounce } from '@/hooks/useDebounce'
import { FilterPill, CheckboxFilterContent } from '@/components/filters'
import api from '@/api'
import { ecommerceMerchantAPI } from '@/services/ecommerceMerchant.service'

interface MerchantRow {
  id: string
  channelName: string
  businessName: string
  contactEmail: string
  active: boolean
  sandboxMode: boolean
  onboardingStatus?: string
  chargesEnabled?: boolean
  platformFeeBps: number
  venue: { id: string; name: string; slug: string }
  provider: { code: string; name: string } | null
  paymentCount: number
  totalCollected: string
  createdAt: string
}

interface PlatformSettings {
  id: string
  ecommercePlatformFeeBpsDefault: number
  vatRateBps: number
  updatedAt: string
  updatedById: string | null
}

const formatBps = (bps: number) => `${(bps / 100).toFixed(2)}%`

/**
 * Effective rate when the platform fee is charged inclusive of IVA. Used in
 * the UI so a Superadmin sees both "1% (neto)" and "1.16% (con IVA)" — same
 * way Mercado Pago and Stripe present their commissions.
 */
const formatEffectiveRate = (feeBps: number, vatBps: number) => {
  const effective = (feeBps * (10000 + vatBps)) / 10000 / 100
  return `${effective.toFixed(2)}%`
}
const formatCurrency = (raw: string) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(raw) || 0)

function renderStatusBadge(m: MerchantRow) {
  if (m.provider?.code !== 'STRIPE_CONNECT') {
    return <Badge variant={m.active ? 'default' : 'secondary'}>{m.active ? 'Activo' : 'Inactivo'}</Badge>
  }
  if (m.chargesEnabled) {
    return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20">✓ Listo</Badge>
  }
  if (m.onboardingStatus === 'REJECTED') return <Badge variant="destructive">Rechazado</Badge>
  if (m.onboardingStatus === 'RESTRICTED') return <Badge variant="destructive">Restringido</Badge>
  if (m.onboardingStatus === 'PENDING_VERIFICATION')
    return <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-300">En revisión</Badge>
  if (m.onboardingStatus === 'IN_PROGRESS')
    return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">Pendiente</Badge>
  return <Badge variant="outline">Sin alta</Badge>
}

// ───────────────────────────────────────────────────────────────────────────
// Top card: editable default platform fee
// ───────────────────────────────────────────────────────────────────────────

function DefaultFeePanel() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [feeDraft, setFeeDraft] = useState('')
  const [vatDraft, setVatDraft] = useState('')

  const { data: settings, isLoading } = useQuery<PlatformSettings>({
    queryKey: ['platform-settings'],
    queryFn: async () => {
      const res = await api.get('/api/v1/dashboard/superadmin/platform-settings')
      return res.data.data
    },
  })

  const mutation = useMutation({
    mutationFn: async (body: { ecommercePlatformFeeBpsDefault?: number; vatRateBps?: number }) => {
      const res = await api.patch('/api/v1/dashboard/superadmin/platform-settings', body)
      return res.data.data as PlatformSettings
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-settings'] })
      toast({ title: 'Configuración global actualizada' })
      setEditing(false)
    },
    onError: (err: any) => {
      toast({
        title: 'Error',
        description: err?.response?.data?.error || err?.message || 'No se pudo guardar',
        variant: 'destructive',
      })
    },
  })

  const handleSave = () => {
    const feeParsed = parseInt(feeDraft, 10)
    const vatParsed = parseInt(vatDraft, 10)
    if (!Number.isFinite(feeParsed) || !Number.isFinite(vatParsed)) return
    mutation.mutate({ ecommercePlatformFeeBpsDefault: feeParsed, vatRateBps: vatParsed })
  }

  const currentFee = settings?.ecommercePlatformFeeBpsDefault ?? 100
  const currentVat = settings?.vatRateBps ?? 1600

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Settings2 className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle>Configuración global Avoqado</CardTitle>
            <CardDescription>
              Comisión default + IVA aplicado. La comisión solo afecta a <strong>merchants nuevos</strong>; los actuales mantienen su
              valor actual. El IVA aplica a TODAS las transacciones (cobra inclusive del IVA, como Mercado Pago/Stripe).
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
          </div>
        ) : editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                  Comisión Avoqado (neta, sin IVA)
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={feeDraft}
                    onChange={e => setFeeDraft(e.target.value)}
                    className="h-9"
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    bps = <strong>{formatBps(parseInt(feeDraft, 10) || 0)}</strong>
                  </span>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">IVA aplicado</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={vatDraft}
                    onChange={e => setVatDraft(e.target.value)}
                    className="h-9"
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    bps = <strong>{formatBps(parseInt(vatDraft, 10) || 0)}</strong>
                  </span>
                </div>
              </div>
            </div>
            <Alert>
              <AlertDescription className="text-sm">
                Cobro efectivo por transacción:{' '}
                <strong className="text-foreground">
                  {formatEffectiveRate(parseInt(feeDraft, 10) || 0, parseInt(vatDraft, 10) || 0)}
                </strong>{' '}
                del monto cobrado. Comisión neta:{' '}
                <strong>{formatBps(parseInt(feeDraft, 10) || 0)}</strong> + IVA{' '}
                <strong>{formatBps(parseInt(vatDraft, 10) || 0)}</strong>.
              </AlertDescription>
            </Alert>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={mutation.isPending}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={mutation.isPending || !feeDraft.trim() || !vatDraft.trim()}>
                {mutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Guardar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <div className="text-xs text-muted-foreground">Comisión neta</div>
                <div className="text-2xl font-semibold tracking-tight">{formatBps(currentFee)}</div>
              </div>
              <div className="text-muted-foreground text-2xl font-light">+</div>
              <div>
                <div className="text-xs text-muted-foreground">IVA</div>
                <div className="text-2xl font-semibold tracking-tight">{formatBps(currentVat)}</div>
              </div>
              <div className="text-muted-foreground text-2xl font-light">=</div>
              <div>
                <div className="text-xs text-muted-foreground">Cobro efectivo</div>
                <div className="text-2xl font-semibold tracking-tight text-emerald-700 dark:text-emerald-300">
                  {formatEffectiveRate(currentFee, currentVat)}
                </div>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setFeeDraft(String(currentFee))
                setVatDraft(String(currentVat))
                setEditing(true)
              }}
            >
              Editar
            </Button>
          </div>
        )}
        {!editing && settings?.updatedAt && (
          <p className="text-xs text-muted-foreground mt-3">
            Última actualización: {new Date(settings.updatedAt).toLocaleString('es-MX')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Main page
// ───────────────────────────────────────────────────────────────────────────

export default function EcommerceMerchantsGlobal() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<string>('')

  // ── Fee history modal ──────────────────────────────────────────────────
  const [historyMerchant, setHistoryMerchant] = useState<MerchantRow | null>(null)

  // ── Filters & search ───────────────────────────────────────────────────
  // Search is debounced so typing doesn't thrash the filter compute on every
  // keystroke. Filter pills are multi-select (Stripe pattern) — empty array
  // means "no filter applied".
  const [searchTerm, setSearchTerm] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const debouncedSearch = useDebounce(searchTerm, 250)
  const [providerFilter, setProviderFilter] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [activeFilter, setActiveFilter] = useState<string[]>([])

  const { data: merchants = [], isLoading, error } = useQuery<MerchantRow[]>({
    queryKey: ['superadmin-ecommerce-merchants'],
    queryFn: async () => {
      const res = await api.get('/api/v1/dashboard/superadmin/ecommerce-merchants')
      return res.data.data
    },
  })

  /**
   * Status derived for filter purposes — collapses every "needs action" Stripe
   * substate into one label the user can filter by. Different from the badge
   * the table renders (which is more granular).
   */
  const deriveStatusLabel = (m: MerchantRow): string => {
    if (m.provider?.code !== 'STRIPE_CONNECT') return m.active ? 'Activo' : 'Inactivo'
    if (m.chargesEnabled) return 'Listo'
    if (m.onboardingStatus === 'REJECTED') return 'Rechazado'
    if (m.onboardingStatus === 'RESTRICTED') return 'Restringido'
    if (m.onboardingStatus === 'PENDING_VERIFICATION') return 'En revisión'
    if (m.onboardingStatus === 'IN_PROGRESS') return 'Pendiente'
    return 'Sin alta'
  }

  // Unique values for each filter pill — derived from data so we don't have
  // to manually maintain enums in the UI.
  const providerOptions = useMemo(() => {
    const set = new Set<string>()
    merchants.forEach(m => m.provider?.name && set.add(m.provider.name))
    return Array.from(set).sort().map(v => ({ value: v, label: v }))
  }, [merchants])

  const statusOptions = useMemo(() => {
    const set = new Set<string>()
    merchants.forEach(m => set.add(deriveStatusLabel(m)))
    return Array.from(set).sort().map(v => ({ value: v, label: v }))
  }, [merchants])

  const activeOptions = useMemo(
    () => [
      { value: 'active', label: 'Activo' },
      { value: 'inactive', label: 'Inactivo' },
    ],
    [],
  )

  // Filtered + searched rows. Search matches case-insensitively on venue
  // name, channel name, business name, and contact email — covers every
  // reasonable lookup a Superadmin might do.
  const filteredMerchants = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return merchants.filter(m => {
      if (q) {
        const haystack = [m.venue.name, m.channelName, m.businessName, m.contactEmail].join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (providerFilter.length > 0 && (!m.provider?.name || !providerFilter.includes(m.provider.name))) return false
      if (statusFilter.length > 0 && !statusFilter.includes(deriveStatusLabel(m))) return false
      if (activeFilter.length > 0) {
        const v = m.active ? 'active' : 'inactive'
        if (!activeFilter.includes(v)) return false
      }
      return true
    })
  }, [merchants, debouncedSearch, providerFilter, statusFilter, activeFilter])

  const hasAnyFilter = !!searchTerm || providerFilter.length > 0 || statusFilter.length > 0 || activeFilter.length > 0
  const clearAllFilters = () => {
    setSearchTerm('')
    setProviderFilter([])
    setStatusFilter([])
    setActiveFilter([])
  }

  const feeMutation = useMutation({
    mutationFn: ({ venueId, merchantId, bps }: { venueId: string; merchantId: string; bps: number }) =>
      ecommerceMerchantAPI.updatePlatformFee(venueId, merchantId, bps),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-ecommerce-merchants'] })
      toast({ title: 'Comisión actualizada' })
      setEditingId(null)
    },
    onError: (err: any) => {
      toast({
        title: 'Error',
        description: err?.response?.data?.error || err?.message || 'No se pudo actualizar la comisión',
        variant: 'destructive',
      })
    },
  })

  // Summary stats — computed on the filtered set so the cards reflect what
  // the user is actually looking at, not the whole platform. When no filters
  // are applied they trivially match the global totals.
  const stats = useMemo(() => {
    const gmv = filteredMerchants.reduce((acc, m) => acc + Number(m.totalCollected), 0)
    const payments = filteredMerchants.reduce((acc, m) => acc + m.paymentCount, 0)
    const estimatedRevenue = filteredMerchants.reduce(
      (acc, m) => acc + (Number(m.totalCollected) * m.platformFeeBps) / 10000,
      0,
    )
    return { gmv, payments, estimatedRevenue, merchantCount: filteredMerchants.length }
  }, [filteredMerchants])

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">E-commerce Merchants</h1>
        <p className="text-muted-foreground mt-1">
          Vista global de todos los canales de e-commerce que Avoqado procesa. Edita la comisión por merchant para excepciones
          comerciales, o ajusta el default global arriba.
        </p>
      </div>

      <DefaultFeePanel />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Merchants</div>
            <div className="text-2xl font-bold tracking-tight mt-1">{stats.merchantCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Pagos completados</div>
            <div className="text-2xl font-bold tracking-tight mt-1">{stats.payments.toLocaleString('es-MX')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">GMV procesado</div>
            <div className="text-2xl font-bold tracking-tight mt-1">{formatCurrency(String(stats.gmv))}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Revenue Avoqado (est.)</div>
            <div className="text-2xl font-bold tracking-tight mt-1 text-emerald-700 dark:text-emerald-300">
              {formatCurrency(String(stats.estimatedRevenue))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <ShoppingCart className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Todos los canales</CardTitle>
              <CardDescription>Editar la comisión actualiza solo ese merchant — no afecta a los demás.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search + filter pills row. Same pattern as Orders.tsx so the
              Superadmin UI stays consistent across the dashboard. */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {/* Expandable search */}
            <div className="relative">
              {isSearchOpen ? (
                <div className="flex items-center animate-in fade-in slide-in-from-left-2 duration-200">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    type="text"
                    placeholder="Buscar por venue, canal, email..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-9 pr-8 h-9 w-72 rounded-full"
                    autoFocus
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 h-9 w-9 p-0 cursor-pointer"
                    onClick={() => {
                      setSearchTerm('')
                      setIsSearchOpen(false)
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-full cursor-pointer relative"
                  onClick={() => setIsSearchOpen(true)}
                >
                  <Search className="h-4 w-4 mr-2" />
                  Buscar
                  {searchTerm && (
                    <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 bg-primary rounded-full" />
                  )}
                </Button>
              )}
            </div>

            <FilterPill
              label="Provider"
              activeLabel={providerFilter.length > 0 ? `${providerFilter.length}` : null}
              isActive={providerFilter.length > 0}
              onClear={() => setProviderFilter([])}
            >
              <CheckboxFilterContent
                title="Provider"
                options={providerOptions}
                selectedValues={providerFilter}
                onApply={setProviderFilter}
              />
            </FilterPill>

            <FilterPill
              label="Estado"
              activeLabel={statusFilter.length > 0 ? `${statusFilter.length}` : null}
              isActive={statusFilter.length > 0}
              onClear={() => setStatusFilter([])}
            >
              <CheckboxFilterContent
                title="Estado"
                options={statusOptions}
                selectedValues={statusFilter}
                onApply={setStatusFilter}
              />
            </FilterPill>

            <FilterPill
              label="Actividad"
              activeLabel={activeFilter.length > 0 ? `${activeFilter.length}` : null}
              isActive={activeFilter.length > 0}
              onClear={() => setActiveFilter([])}
            >
              <CheckboxFilterContent
                title="Actividad"
                options={activeOptions}
                selectedValues={activeFilter}
                onApply={setActiveFilter}
              />
            </FilterPill>

            {hasAnyFilter && (
              <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={clearAllFilters}>
                Limpiar filtros
              </Button>
            )}

            <div className="ml-auto text-xs text-muted-foreground">
              {filteredMerchants.length} de {merchants.length}
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertDescription>Error al cargar: {(error as any).message}</AlertDescription>
            </Alert>
          ) : merchants.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart className="mx-auto h-12 w-12 mb-3 opacity-30" />
              <p>Aún no hay canales de e-commerce en la plataforma.</p>
            </div>
          ) : filteredMerchants.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="mx-auto h-12 w-12 mb-3 opacity-30" />
              <p>No hay resultados con los filtros actuales.</p>
              <Button variant="link" size="sm" onClick={clearAllFilters}>
                Limpiar filtros
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Venue</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Pagos</TableHead>
                  <TableHead className="text-right">GMV</TableHead>
                  <TableHead className="text-right">Comisión</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMerchants.map(m => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Link
                        to={`/venues/${m.venue.slug}/ecommerce-merchants`}
                        className="font-medium hover:underline flex items-center gap-1"
                      >
                        {m.venue.name}
                        <ExternalLink className="h-3 w-3 opacity-60" />
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{m.channelName}</div>
                      <div className="text-xs text-muted-foreground">{m.contactEmail}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {m.provider?.name ?? '—'}
                      </Badge>
                    </TableCell>
                    <TableCell>{renderStatusBadge(m)}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.paymentCount.toLocaleString('es-MX')}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(m.totalCollected)}</TableCell>
                    <TableCell className="text-right">
                      {editingId === m.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <Input
                            type="number"
                            inputMode="numeric"
                            value={draft}
                            onChange={e => setDraft(e.target.value)}
                            className="h-8 w-20 text-right"
                            autoFocus
                          />
                        </div>
                      ) : (
                        <span className="font-mono">{formatBps(m.platformFeeBps)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId === m.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                            disabled={feeMutation.isPending}
                          >
                            Cancelar
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              const parsed = parseInt(draft, 10)
                              if (!Number.isFinite(parsed)) return
                              feeMutation.mutate({ venueId: m.venue.id, merchantId: m.id, bps: parsed })
                            }}
                            disabled={feeMutation.isPending || !draft.trim()}
                          >
                            Guardar
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            title="Ver historial de cambios de comisión"
                            onClick={() => setHistoryMerchant(m)}
                          >
                            <History className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingId(m.id)
                              setDraft(String(m.platformFeeBps))
                            }}
                          >
                            Editar
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <FeeHistoryDialog merchant={historyMerchant} onClose={() => setHistoryMerchant(null)} />
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Fee change history dialog — driven by ActivityLog rows tagged with
// action=ECOMMERCE_MERCHANT_PLATFORM_FEE_UPDATED. Lets a Superadmin audit
// who changed the commission and when.
// ───────────────────────────────────────────────────────────────────────────

interface FeeHistoryEvent {
  id: string
  oldFeeBps: number | null
  newFeeBps: number | null
  staff: { id: string; firstName: string; lastName: string; email?: string } | null
  createdAt: string
}

function FeeHistoryDialog({ merchant, onClose }: { merchant: MerchantRow | null; onClose: () => void }) {
  const open = !!merchant

  const { data: history = [], isLoading } = useQuery<FeeHistoryEvent[]>({
    queryKey: ['fee-history', merchant?.id],
    queryFn: async () => {
      const res = await api.get(`/api/v1/dashboard/superadmin/ecommerce-merchants/${merchant!.id}/fee-history`)
      return res.data.data
    },
    enabled: open,
  })

  const formatDelta = (oldBps: number | null, newBps: number | null) => {
    if (oldBps == null || newBps == null) return '—'
    const oldPct = (oldBps / 100).toFixed(2)
    const newPct = (newBps / 100).toFixed(2)
    return `${oldPct}% → ${newPct}%`
  }

  return (
    <Dialog open={open} onOpenChange={isOpen => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Historial de comisión</DialogTitle>
          <DialogDescription>
            {merchant ? (
              <>
                Cambios en la comisión de Avoqado para <strong>{merchant.channelName}</strong> ({merchant.venue.name}).
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : history.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <History className="mx-auto h-10 w-10 mb-3 opacity-30" />
            Sin cambios registrados. La comisión sigue en su valor original.
          </div>
        ) : (
          <ol className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {history.map(ev => (
              <li key={ev.id} className="rounded-xl border border-input bg-card p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono font-medium">{formatDelta(ev.oldFeeBps, ev.newFeeBps)}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {new Date(ev.createdAt).toLocaleString('es-MX')}
                  </span>
                </div>
                {ev.staff && (
                  <div className="text-xs text-muted-foreground mt-1.5">
                    Por: {ev.staff.firstName} {ev.staff.lastName}
                    {ev.staff.email ? ` · ${ev.staff.email}` : ''}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  )
}
