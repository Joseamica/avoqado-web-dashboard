import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { KeyRound, Plus, Copy, Check, ShieldAlert, Loader2, Activity, Clock } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { getOrganizationsList, type OrganizationSimple } from '@/services/superadmin-organizations.service'
import {
  getPartnerKeys,
  createPartnerKey,
  deactivatePartnerKey,
  type PartnerAPIKey,
} from '@/services/superadmin-partner-keys.service'

// ─── Main Page ──────────────────────────────────────────────
const PartnerKeys: React.FC = () => {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [searchTerm, setSearchTerm] = useState('')
  const [orgFilter, setOrgFilter] = useState<string>('all')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [secretKeyModal, setSecretKeyModal] = useState<{ name: string; secretKey: string } | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<PartnerAPIKey | null>(null)

  // ─── Data ──────────────────────────────────────────────────
  const { data: keys = [], isLoading } = useQuery({
    queryKey: ['partner-keys'],
    queryFn: getPartnerKeys,
  })

  const { data: organizations = [] } = useQuery({
    queryKey: ['organizations-list'],
    queryFn: getOrganizationsList,
  })

  // ─── Mutations ─────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: createPartnerKey,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['partner-keys'] })
      setCreateDialogOpen(false)
      setSecretKeyModal({ name: res.data.name, secretKey: res.data.secretKey })
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo crear la API key',
        variant: 'destructive',
      })
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: deactivatePartnerKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-keys'] })
      setDeactivateTarget(null)
      toast({ title: 'API key desactivada' })
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo desactivar',
        variant: 'destructive',
      })
    },
  })

  // ─── Filtering ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    return keys.filter((k) => {
      const matchesSearch =
        !searchTerm ||
        k.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        k.organization.name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesOrg = orgFilter === 'all' || k.organizationId === orgFilter
      return matchesSearch && matchesOrg
    })
  }, [keys, searchTerm, orgFilter])

  const activeKeys = useMemo(() => filtered.filter((k) => k.active), [filtered])
  const inactiveKeys = useMemo(() => filtered.filter((k) => !k.active), [filtered])

  const recentlyUsed = useMemo(() => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    return keys.filter((k) => k.lastUsedAt && new Date(k.lastUsedAt) > oneDayAgo).length
  }, [keys])

  // ─── Render ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Partner API Keys</h1>
          <p className="text-muted-foreground">Gestiona las API keys para socios externos (PlayTelecom, etc.)</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Crear API Key
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-input">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <KeyRound className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{keys.length}</p>
                <p className="text-sm text-muted-foreground">Total Keys</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-input">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Activity className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{keys.filter((k) => k.active).length}</p>
                <p className="text-sm text-muted-foreground">Activas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-input">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{recentlyUsed}</p>
                <p className="text-sm text-muted-foreground">Usadas (24h)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Input
          placeholder="Buscar por nombre u organización..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <Select value={orgFilter} onValueChange={setOrgFilter}>
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Organización" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las organizaciones</SelectItem>
            {organizations.map((org) => (
              <SelectItem key={org.id} value={org.id}>
                {org.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Keys List */}
      {filtered.length === 0 ? (
        <Card className="border-input">
          <CardContent className="py-12 text-center text-muted-foreground">
            <KeyRound className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">No hay API keys</p>
            <p className="text-sm">Crea una para que un socio pueda consultar datos de ventas.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Active keys */}
          {activeKeys.length > 0 && (
            <div className="space-y-2">
              {activeKeys.map((key) => (
                <KeyRow key={key.id} apiKey={key} onDeactivate={() => setDeactivateTarget(key)} />
              ))}
            </div>
          )}

          {/* Divider */}
          {activeKeys.length > 0 && inactiveKeys.length > 0 && (
            <div className="flex items-center gap-3 py-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">Desactivadas</span>
              <div className="h-px flex-1 bg-border" />
            </div>
          )}

          {/* Inactive keys */}
          {inactiveKeys.length > 0 && (
            <div className="space-y-2 opacity-60">
              {inactiveKeys.map((key) => (
                <KeyRow key={key.id} apiKey={key} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Dialog */}
      <CreateKeyDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        organizations={organizations}
        onSubmit={(data) => createMutation.mutate(data)}
        isLoading={createMutation.isPending}
      />

      {/* Secret Key Modal (one-time display) */}
      <SecretKeyModal
        data={secretKeyModal}
        onClose={() => setSecretKeyModal(null)}
      />

      {/* Deactivate Confirmation */}
      <DeactivateDialog
        target={deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={() => deactivateTarget && deactivateMutation.mutate(deactivateTarget.id)}
        isLoading={deactivateMutation.isPending}
      />
    </div>
  )
}

// ─── Key Row ─────────────────────────────────────────────────
function KeyRow({ apiKey, onDeactivate }: { apiKey: PartnerAPIKey; onDeactivate?: () => void }) {
  return (
    <Card className="border-input">
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-lg bg-muted">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{apiKey.name}</span>
                <Badge variant={apiKey.sandboxMode ? 'secondary' : 'default'} className="text-[10px] h-5">
                  {apiKey.sandboxMode ? 'TEST' : 'LIVE'}
                </Badge>
                {!apiKey.active && (
                  <Badge variant="outline" className="text-[10px] h-5 text-muted-foreground">
                    Inactiva
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{apiKey.organization.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right text-sm">
              <p className="text-muted-foreground">
                {apiKey.lastUsedAt
                  ? `Último uso: ${new Date(apiKey.lastUsedAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                  : 'Nunca usada'}
              </p>
              <p className="text-xs text-muted-foreground">
                Creada: {new Date(apiKey.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            </div>
            {apiKey.active && onDeactivate && (
              <Button variant="ghost" size="sm" onClick={onDeactivate} className="text-destructive hover:text-destructive">
                Desactivar
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Create Key Dialog ───────────────────────────────────────
function CreateKeyDialog({
  open,
  onClose,
  organizations,
  onSubmit,
  isLoading,
}: {
  open: boolean
  onClose: () => void
  organizations: OrganizationSimple[]
  onSubmit: (data: { organizationId: string; name: string; sandboxMode: boolean }) => void
  isLoading: boolean
}) {
  const [orgId, setOrgId] = useState('')
  const [name, setName] = useState('')
  const [sandboxMode, setSandboxMode] = useState(false)

  const handleSubmit = () => {
    onSubmit({ organizationId: orgId, name, sandboxMode })
  }

  const handleClose = () => {
    setOrgId('')
    setName('')
    setSandboxMode(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear Partner API Key</DialogTitle>
          <DialogDescription>
            Genera una API key para que un socio externo pueda consultar datos de ventas.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Organización *</Label>
            <Select value={orgId} onValueChange={setOrgId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar organización" />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Nombre *</Label>
            <Input
              placeholder='ej. "PlayTelecom Production"'
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-input p-3">
            <div>
              <p className="font-medium text-sm">Modo Sandbox</p>
              <p className="text-xs text-muted-foreground">
                {sandboxMode ? 'Genera sk_test_* (solo pruebas)' : 'Genera sk_live_* (producción)'}
              </p>
            </div>
            <Switch checked={sandboxMode} onCheckedChange={setSandboxMode} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!orgId || !name || isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Crear Key
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Secret Key Modal (one-time display) ─────────────────────
function SecretKeyModal({ data, onClose }: { data: { name: string; secretKey: string } | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!data) return
    await navigator.clipboard.writeText(data.secretKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={!!data} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-lg" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            API Key Creada
          </DialogTitle>
          <DialogDescription>
            Copia esta clave ahora. <strong>No se puede recuperar después de cerrar esta ventana.</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label className="text-muted-foreground">Nombre</Label>
            <p className="font-medium">{data?.name}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Secret Key</Label>
            <div className="flex items-center gap-2 mt-1">
              <code className="flex-1 block rounded-md bg-muted px-3 py-2.5 font-mono text-sm break-all select-all">
                {data?.secretKey}
              </code>
              <Button size="icon" variant="outline" onClick={handleCopy} className="shrink-0">
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Esta clave solo se muestra una vez. Si la pierdes, tendrás que crear una nueva y desactivar esta.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose} className="w-full">
            Ya copié la clave — Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Deactivate Confirmation ─────────────────────────────────
function DeactivateDialog({
  target,
  onClose,
  onConfirm,
  isLoading,
}: {
  target: PartnerAPIKey | null
  onClose: () => void
  onConfirm: () => void
  isLoading: boolean
}) {
  return (
    <Dialog open={!!target} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Desactivar API Key</DialogTitle>
          <DialogDescription>
            ¿Estás seguro de desactivar <strong>{target?.name}</strong>? El socio ya no podrá hacer consultas con esta clave.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Desactivar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default PartnerKeys
