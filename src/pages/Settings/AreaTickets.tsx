import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2, Plus, Scale, ScanBarcode, TicketCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import {
  createFulfillmentArea,
  createScaleProfile,
  getAreaTicketOperations,
  getAreaTicketOverview,
  updateAreaTicketSettings,
  toUpdateAreaTicketSettingsInput,
  updateAreaTicketTerminal,
  updateFulfillmentArea,
  updateScaleProfile,
  updateScaleSettings,
  type AreaTicketSettings,
  type AreaTicketTerminal,
  type DeliveryVerificationMode,
  type FulfillmentArea,
  type FulfillmentMode,
  type InventoryReservationMode,
  type ScaleProfile,
  type ScaleSettings as ScaleSettingsData,
} from '@/services/areaTickets.service'

const NONE = '__none__'
const panelClass = 'border-border/50 shadow-sm'
const tabTriggerClass =
  'group rounded-full border border-transparent px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/80 hover:text-foreground data-[state=active]:border-foreground data-[state=active]:bg-foreground data-[state=active]:text-background'
const apiError = (error: any, fallback: string): string => error?.response?.data?.message ?? error?.response?.data?.error ?? fallback
const SCALE_PRESETS = {
  RHINO_BAR8RS: {
    label: 'Rhino BAR-8RS',
    model: 'Rhino BAR-8RS',
    location: 'CREMERIA',
    baudRate: 9_600,
    frameParser: { type: 'RHINO_BAR8RS_ASCII', mode: 'REQUEST' },
    stableIndicator: null,
  },
  JUSTA_LP7516: {
    label: 'Justa LP7516',
    model: 'Justa LP7516',
    location: 'CEDIS',
    baudRate: 9_600,
    frameParser: { type: 'JUSTA_LP7516_ASCII', mode: 'REQUEST' },
    stableIndicator: 'ST',
  },
  TORREY_PCR: {
    label: 'Torrey PCR',
    model: 'Torrey PCR',
    location: 'CREMERIA',
    baudRate: 115_200,
    frameParser: { type: 'TORREY_PCR_ASCII', mode: 'REQUEST' },
    stableIndicator: null,
  },
} as const
type ScalePresetKey = keyof typeof SCALE_PRESETS

function SettingRow({
  title,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  title: string
  description: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex min-h-16 items-center justify-between gap-6 rounded-lg bg-muted/40 px-4 py-3">
      <div className="space-y-0.5">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  )
}

export default function AreaTickets() {
  const { t } = useTranslation('settings')
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const overviewQuery = useQuery({
    queryKey: ['area-ticket-overview', venueId],
    queryFn: () => getAreaTicketOverview(venueId!),
    enabled: Boolean(venueId),
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['area-ticket-overview', venueId] })

  if (!venueId) return null
  if (overviewQuery.isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Cargando configuración…
      </div>
    )
  }
  if (!overviewQuery.data) {
    return (
      <Alert variant="destructive" className="m-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>No se pudo cargar la configuración</AlertTitle>
        <AlertDescription>{apiError(overviewQuery.error, 'Intenta de nuevo.')}</AlertDescription>
      </Alert>
    )
  }

  const data = overviewQuery.data
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <TicketCheck className="h-6 w-6" />
            {t('areaTickets.title', 'Vales por área y básculas')}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Configura cremería, panadería, cafetería o CEDIS por separado. Los locales que no usan este flujo continúan con el POS normal.
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant={data.effective.areaTickets ? 'default' : 'outline'}>
            Vales {data.effective.areaTickets ? 'activos' : 'inactivos'}
          </Badge>
          <Badge variant={data.effective.scales ? 'default' : 'outline'}>Básculas {data.effective.scales ? 'activas' : 'inactivas'}</Badge>
        </div>
      </div>

      <Tabs defaultValue="flow">
        <TabsList className="inline-flex h-auto flex-wrap items-center justify-start rounded-full border border-border bg-muted/60 p-1 text-muted-foreground">
          <TabsTrigger value="flow" className={tabTriggerClass}>
            Flujo
          </TabsTrigger>
          <TabsTrigger value="areas" className={tabTriggerClass}>
            Áreas
          </TabsTrigger>
          <TabsTrigger value="terminals" className={tabTriggerClass}>
            Terminales
          </TabsTrigger>
          <TabsTrigger value="scales" className={tabTriggerClass}>
            Básculas
          </TabsTrigger>
          <TabsTrigger value="operations" className={tabTriggerClass}>
            Operación
          </TabsTrigger>
        </TabsList>

        <TabsContent value="flow" className="mt-6">
          <FlowSettings venueId={venueId} initial={data.settings} entitled={data.entitlements.areaTickets} onSaved={refresh} />
        </TabsContent>
        <TabsContent value="areas" className="mt-6">
          <AreasSettings venueId={venueId} areas={data.areas} onSaved={refresh} />
        </TabsContent>
        <TabsContent value="terminals" className="mt-6">
          <TerminalSettings
            venueId={venueId}
            terminals={data.terminals}
            areas={data.areas}
            profiles={data.scaleProfiles}
            onSaved={refresh}
          />
        </TabsContent>
        <TabsContent value="scales" className="mt-6">
          <ScaleSettings
            venueId={venueId}
            profiles={data.scaleProfiles}
            settings={data.scaleSettings}
            scaleEntitled={data.entitlements.scaleIntegration}
            barcodeEntitled={data.entitlements.variableWeightBarcode}
            onSaved={refresh}
          />
        </TabsContent>
        <TabsContent value="operations" className="mt-6">
          <Operations venueId={venueId} counters={data.operations} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function FlowSettings({
  venueId,
  initial,
  entitled,
  onSaved,
}: {
  venueId: string
  initial: AreaTicketSettings
  entitled: boolean
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [form, setForm] = useState(initial)
  useEffect(() => setForm(initial), [initial])
  const mutation = useMutation({
    mutationFn: () => updateAreaTicketSettings(venueId, toUpdateAreaTicketSettingsInput(form)),
    onSuccess: () => {
      toast({ title: 'Configuración guardada' })
      onSaved()
    },
    onError: error =>
      toast({ title: 'No se pudo guardar', description: apiError(error, 'Revisa la configuración.'), variant: 'destructive' }),
  })

  return (
    <Card className={panelClass}>
      <CardHeader>
        <CardTitle>Comportamiento del local</CardTitle>
        <CardDescription>Se aplica sólo a las terminales que habilites en la pestaña Terminales.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!entitled && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>El plan no incluye vales por área</AlertTitle>
            <AlertDescription>Puedes revisar la configuración, pero no activarla hasta habilitar el módulo.</AlertDescription>
          </Alert>
        )}
        <SettingRow
          title="Activar vales por área"
          description="Las áreas emiten vales independientes y caja los consolida en una sola orden."
          checked={form.enabled}
          disabled={!entitled}
          onCheckedChange={enabled => setForm(current => ({ ...current, enabled }))}
        />
        <SettingRow
          title="Permitir carrito mixto"
          description="Caja puede combinar vales con papas, refrescos u otros productos normales."
          checked={form.allowMixedCart}
          onCheckedChange={allowMixedCart => setForm(current => ({ ...current, allowMixedCart }))}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Comprobación de entrega</Label>
            <Select
              value={form.deliveryVerificationMode}
              onValueChange={(deliveryVerificationMode: DeliveryVerificationMode) =>
                setForm(current => ({ ...current, deliveryVerificationMode }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PAPER_CONFIRMATION">Revisar papel</SelectItem>
                <SelectItem value="RECEIPT_SCAN">Escanear ticket pagado</SelectItem>
                <SelectItem value="PAPER_OR_SCAN">Papel o escaneo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reserva de inventario</Label>
            <Select
              value={form.inventoryReservationMode}
              onValueChange={(inventoryReservationMode: InventoryReservationMode) =>
                setForm(current => ({ ...current, inventoryReservationMode }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Consumir al pagar</SelectItem>
                <SelectItem value="HOLD_AVAILABLE_STOCK">Reservar al emitir</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tiempo de reclamo en caja (segundos)</Label>
            <Input
              type="number"
              min={30}
              max={1800}
              value={form.claimTtlSeconds}
              onChange={event => setForm(current => ({ ...current, claimTtlSeconds: Number(event.target.value) }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Duración máxima de sesión (minutos)</Label>
            <Input
              type="number"
              min={5}
              max={240}
              value={form.checkoutSessionMaxAgeMinutes}
              onChange={event => setForm(current => ({ ...current, checkoutSessionMaxAgeMinutes: Number(event.target.value) }))}
            />
          </div>
        </div>
        <SettingRow
          title="Gerente requerido para cancelar"
          description="Evita que un vale con producto preparado se cancele sin autorización."
          checked={form.requireManagerForCancel}
          onCheckedChange={requireManagerForCancel => setForm(current => ({ ...current, requireManagerForCancel }))}
        />
        <SettingRow
          title="Registrar merma al cancelar"
          description="Conserva evidencia cuando el producto ya preparado no puede regresar al inventario."
          checked={form.recordWasteOnCancel}
          onCheckedChange={recordWasteOnCancel => setForm(current => ({ ...current, recordWasteOnCancel }))}
        />
        <div className="flex justify-end">
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Guardar flujo
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function AreasSettings({ venueId, areas, onSaved }: { venueId: string; areas: FulfillmentArea[]; onSaved: () => void }) {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [mode, setMode] = useState<FulfillmentMode>('HOLD_UNTIL_PAID')
  const createMutation = useMutation({
    mutationFn: () => createFulfillmentArea(venueId, { name, fulfillmentMode: mode }),
    onSuccess: () => {
      setName('')
      toast({ title: 'Área creada' })
      onSaved()
    },
    onError: error => toast({ title: 'No se pudo crear', description: apiError(error, 'Revisa el nombre.'), variant: 'destructive' }),
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateFulfillmentArea>[2] }) =>
      updateFulfillmentArea(venueId, id, input),
    onSuccess: onSaved,
    onError: error => toast({ title: 'No se pudo actualizar', description: apiError(error, 'Intenta de nuevo.'), variant: 'destructive' }),
  })

  return (
    <div className="space-y-4">
      <Card className={panelClass}>
        <CardHeader>
          <CardTitle>Nueva área</CardTitle>
          <CardDescription>Ejemplos: Cremería, Panadería, Cafetería o Mostrador.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_260px_auto]">
          <Input value={name} onChange={event => setName(event.target.value)} placeholder="Nombre del área" />
          <Select value={mode} onValueChange={(value: FulfillmentMode) => setMode(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="HOLD_UNTIL_PAID">Guardar hasta que pague</SelectItem>
              <SelectItem value="PREPARE_ON_PAID">Preparar después de pagar</SelectItem>
              <SelectItem value="IMMEDIATE">Entregar al momento</SelectItem>
            </SelectContent>
          </Select>
          <Button disabled={!name.trim() || createMutation.isPending} onClick={() => createMutation.mutate()}>
            <Plus className="mr-2 h-4 w-4" /> Agregar
          </Button>
        </CardContent>
      </Card>

      <Card className={panelClass}>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Área</TableHead>
                <TableHead>Proceso</TableHead>
                <TableHead>Terminales</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {areas.map(area => (
                <TableRow key={area.id}>
                  <TableCell className="font-medium">{area.name}</TableCell>
                  <TableCell>
                    <Select
                      value={area.fulfillmentMode}
                      onValueChange={(fulfillmentMode: FulfillmentMode) =>
                        updateMutation.mutate({ id: area.id, input: { fulfillmentMode } })
                      }
                    >
                      <SelectTrigger className="w-56">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HOLD_UNTIL_PAID">Guardar hasta pago</SelectItem>
                        <SelectItem value="PREPARE_ON_PAID">Preparar al pagar</SelectItem>
                        <SelectItem value="IMMEDIATE">Entrega inmediata</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{area._count?.terminals ?? 0}</TableCell>
                  <TableCell>
                    <Switch checked={area.active} onCheckedChange={active => updateMutation.mutate({ id: area.id, input: { active } })} />
                  </TableCell>
                </TableRow>
              ))}
              {areas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                    Aún no hay áreas.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function TerminalSettings({
  venueId,
  terminals,
  areas,
  profiles,
  onSaved,
}: {
  venueId: string
  terminals: AreaTicketTerminal[]
  areas: FulfillmentArea[]
  profiles: ScaleProfile[]
  onSaved: () => void
}) {
  const { toast } = useToast()
  const mutation = useMutation({
    mutationFn: ({ terminalId, input }: { terminalId: string; input: Parameters<typeof updateAreaTicketTerminal>[2] }) =>
      updateAreaTicketTerminal(venueId, terminalId, input),
    onSuccess: onSaved,
    onError: error => toast({ title: 'No se pudo actualizar', description: apiError(error, 'Intenta de nuevo.'), variant: 'destructive' }),
  })

  return (
    <Card className={panelClass}>
      <CardHeader>
        <CardTitle>Capacidades por terminal</CardTitle>
        <CardDescription>
          Una terminal sólo ve las funciones marcadas. Caja, área y CEDIS pueden usar configuraciones distintas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {terminals.map(terminal => (
          <div key={terminal.id} className="rounded-xl border border-border/50 bg-muted/20 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{terminal.name}</p>
                <p className="text-xs text-muted-foreground">
                  {[terminal.brand, terminal.model, terminal.status].filter(Boolean).join(' · ')}
                </p>
              </div>
              <Select
                value={terminal.fulfillmentAreaId ?? NONE}
                onValueChange={value =>
                  mutation.mutate({ terminalId: terminal.id, input: { fulfillmentAreaId: value === NONE ? null : value } })
                }
              >
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Sin área" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sin área / caja</SelectItem>
                  {areas
                    .filter(area => area.active)
                    .map(area => (
                      <SelectItem key={area.id} value={area.id}>
                        {area.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['canIssueAreaTickets', 'Emitir vales'],
                ['canCheckoutAreaTickets', 'Cobrar vales'],
                ['canDeliverAreaTickets', 'Entregar'],
              ].map(([key, label]) => (
                <label key={key} className="flex min-h-10 items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                  {label}
                  <Switch
                    checked={Boolean(terminal[key as keyof AreaTicketTerminal])}
                    onCheckedChange={checked => mutation.mutate({ terminalId: terminal.id, input: { [key]: checked } })}
                  />
                </label>
              ))}
              <Select
                value={terminal.scaleProfileId ?? NONE}
                onValueChange={value =>
                  mutation.mutate({ terminalId: terminal.id, input: { scaleProfileId: value === NONE ? null : value } })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin báscula" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sin báscula</SelectItem>
                  {profiles
                    .filter(profile => profile.active)
                    .map(profile => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
        {terminals.length === 0 && <p className="py-8 text-center text-muted-foreground">No hay terminales registradas.</p>}
      </CardContent>
    </Card>
  )
}

function ScaleSettings({
  venueId,
  profiles,
  settings,
  scaleEntitled,
  barcodeEntitled,
  onSaved,
}: {
  venueId: string
  profiles: ScaleProfile[]
  settings: ScaleSettingsData
  scaleEntitled: boolean
  barcodeEntitled: boolean
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [location, setLocation] = useState('CREMERIA')
  const [presetKey, setPresetKey] = useState<ScalePresetKey>('RHINO_BAR8RS')
  const [variableBarcodeEnabled, setVariableBarcodeEnabled] = useState(settings.variableBarcodeEnabled)
  const [variableBarcodePrefix, setVariableBarcodePrefix] = useState(settings.variableBarcodePrefix)
  useEffect(() => {
    setVariableBarcodeEnabled(settings.variableBarcodeEnabled)
    setVariableBarcodePrefix(settings.variableBarcodePrefix)
  }, [settings])
  const preset = SCALE_PRESETS[presetKey]
  const settingMutation = useMutation({
    mutationFn: (next: boolean) => updateScaleSettings(venueId, { enabled: next }),
    onSuccess: onSaved,
    onError: error => toast({ title: 'No se pudo activar', description: apiError(error, 'Revisa el plan.'), variant: 'destructive' }),
  })
  const barcodeMutation = useMutation({
    mutationFn: () =>
      updateScaleSettings(venueId, {
        variableBarcodeEnabled,
        variableBarcodePrefix,
      }),
    onSuccess: () => {
      toast({ title: 'Lectura de etiquetas guardada' })
      onSaved()
    },
    onError: error =>
      toast({ title: 'No se pudo guardar', description: apiError(error, 'Revisa el prefijo.'), variant: 'destructive' }),
  })
  const createMutation = useMutation({
    mutationFn: () =>
      createScaleProfile(venueId, {
        name,
        location,
        model: preset.model,
        transport: 'ANDROID_USB_SERIAL',
        allowedContexts: location === 'CEDIS' ? ['STOCK_COUNT'] : ['AREA_TICKET_LINE'],
        baudRate: preset.baudRate,
        dataBits: 8,
        parity: 'NONE',
        stopBits: 1,
        frameParser: preset.frameParser,
        stableIndicator: preset.stableIndicator,
        unit: 'KILOGRAM',
      }),
    onSuccess: () => {
      setName('')
      toast({ title: 'Perfil de báscula creado' })
      onSaved()
    },
    onError: error => toast({ title: 'No se pudo crear', description: apiError(error, 'Revisa los datos.'), variant: 'destructive' }),
  })
  const profileMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => updateScaleProfile(venueId, id, { active }),
    onSuccess: onSaved,
    onError: error => toast({ title: 'No se pudo actualizar', description: apiError(error, 'Intenta de nuevo.'), variant: 'destructive' }),
  })

  return (
    <div className="space-y-4">
      <Card className={panelClass}>
        <CardContent className="pt-6">
          <SettingRow
            title="Activar integración de básculas"
            description="Los perfiles manuales siguen disponibles como respaldo; USB/bridge requiere el módulo del plan."
            checked={settings.enabled}
            disabled={!scaleEntitled}
            onCheckedChange={next => settingMutation.mutate(next)}
          />
          {!scaleEntitled && (
            <p className="mt-2 text-sm text-amber-600">La integración física de básculas no está incluida en el plan actual.</p>
          )}
        </CardContent>
      </Card>
      <Card className={panelClass}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScanBarcode className="h-5 w-5" /> Etiquetas impresas por una báscula externa
          </CardTitle>
          <CardDescription>
            Para EAN-13 con formato prefijo de 2 dígitos + PLU de 5 dígitos + peso en gramos de 5 dígitos. El precio siempre sale del catálogo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingRow
            title="Leer peso desde la etiqueta"
            description="Caja agrega directamente el producto pesado; no requiere conectar la báscula a la tablet."
            checked={variableBarcodeEnabled}
            disabled={!barcodeEntitled}
            onCheckedChange={setVariableBarcodeEnabled}
          />
          <div className="grid gap-3 rounded-lg bg-muted/40 p-4 md:grid-cols-[minmax(0,1fr)_8rem_auto] md:items-end">
            <div className="space-y-1">
              <Label>Correspondencia de producto</Label>
              <p className="text-sm text-muted-foreground">El PLU de la etiqueta debe coincidir con el SKU del producto vendido por peso.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="variable-barcode-prefix">Prefijo</Label>
              <Input
                id="variable-barcode-prefix"
                inputMode="numeric"
                maxLength={2}
                value={variableBarcodePrefix}
                onChange={event => setVariableBarcodePrefix(event.target.value.replace(/\D/g, '').slice(0, 2))}
                placeholder="20"
              />
            </div>
            <Button
              disabled={!barcodeEntitled || variableBarcodePrefix.length !== 2 || barcodeMutation.isPending}
              onClick={() => barcodeMutation.mutate()}
            >
              {barcodeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Guardar etiquetas
            </Button>
          </div>
          {!barcodeEntitled && <p className="text-sm text-amber-600">El plan actual no incluye lectura de etiquetas de peso variable.</p>}
          <p className="text-xs text-muted-foreground">
            Un folio opaco como VPZ1617070 no contiene PLU ni peso y no puede reconstruirse sin una integración del fabricante.
          </p>
        </CardContent>
      </Card>
      <Card className={panelClass}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" /> Nuevo perfil
          </CardTitle>
          <CardDescription>
            Usa perfiles separados por terminal. Los valores seriales del modelo certificado se cargan automáticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <Input value={name} onChange={event => setName(event.target.value)} placeholder="Nombre: Rhino cremería" />
          <Select value={location} onValueChange={setLocation}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CREMERIA">Cremería</SelectItem>
              <SelectItem value="CEDIS">CEDIS</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={presetKey}
            onValueChange={(value: ScalePresetKey) => {
              const next = SCALE_PRESETS[value]
              setPresetKey(value)
              setLocation(next.location)
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SCALE_PRESETS).map(([key, value]) => (
                <SelectItem key={key} value={key}>
                  {value.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input value={`${preset.baudRate} · 8N1 · USB serial`} disabled aria-label="Configuración serial" />
          <Button disabled={!scaleEntitled || !name.trim() || createMutation.isPending} onClick={() => createMutation.mutate()}>
            <Plus className="mr-2 h-4 w-4" /> Crear
          </Button>
          <p className="text-xs text-muted-foreground md:col-span-2 lg:col-span-5">
            Kretz Report continúa por etiqueta/código de barras; no se conecta como puerto serial hasta certificar su protocolo.
          </p>
        </CardContent>
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        {profiles.map(profile => (
          <Card key={profile.id} className={panelClass}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{profile.name}</CardTitle>
                <Switch checked={profile.active} onCheckedChange={active => profileMutation.mutate({ id: profile.id, active })} />
              </div>
              <CardDescription>
                {profile.location} · {profile.model}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Badge variant="outline">{profile.transport}</Badge>
              {profile.baudRate && <Badge variant="outline">{profile.baudRate} · 8N1</Badge>}
              {profile.allowedContexts.map(context => (
                <Badge key={context} variant="secondary">
                  {context}
                </Badge>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function Operations({
  venueId,
  counters,
}: {
  venueId: string
  counters: { tickets: Record<string, number>; checkouts: Record<string, number>; paymentReconciliationCount: number }
}) {
  const query = useQuery({
    queryKey: ['area-ticket-operations', venueId],
    queryFn: () => getAreaTicketOperations(venueId),
    refetchInterval: 30_000,
  })
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Card className={panelClass}>
          <CardHeader>
            <CardDescription>Pendientes de entrega</CardDescription>
            <CardTitle>{counters.tickets.PAID ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className={panelClass}>
          <CardHeader>
            <CardDescription>Sesiones abiertas</CardDescription>
            <CardTitle>{counters.checkouts.OPEN ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className={panelClass}>
          <CardHeader>
            <CardDescription>Requieren conciliación</CardDescription>
            <CardTitle>{counters.paymentReconciliationCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>
      {counters.paymentReconciliationCount > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Hay pagos que requieren revisión</AlertTitle>
          <AlertDescription>No vuelvas a cobrar esas órdenes hasta confirmar el estado del proveedor.</AlertDescription>
        </Alert>
      )}
      <Card className={panelClass}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScanBarcode className="h-5 w-5" /> Vales pagados por entregar
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vale</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Orden</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data?.pendingDelivery.map(ticket => (
                <TableRow key={ticket.id}>
                  <TableCell className="font-mono">{ticket.code}</TableCell>
                  <TableCell>{ticket.fulfillmentArea.name}</TableCell>
                  <TableCell>{ticket.order?.orderNumber ?? '—'}</TableCell>
                  <TableCell>${ticket.total}</TableCell>
                </TableRow>
              ))}
              {!query.isLoading && (query.data?.pendingDelivery.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                    No hay entregas pendientes.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
