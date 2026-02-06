import React, { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, UserCircle, Users, Sparkles, Puzzle } from 'lucide-react'
import type { TeamData, StaffInvite, ModuleSelection } from '../onboarding.types'
import { fetchFeatures, fetchModules } from '../onboarding.service'

interface Props {
  team: TeamData
  features: string[]
  modules: ModuleSelection[]
  onTeamChange: (data: Partial<TeamData>) => void
  onFeaturesChange: (features: string[]) => void
  onModulesChange: (modules: ModuleSelection[]) => void
}

export const Step5TeamFeatures: React.FC<Props> = ({
  team,
  features,
  modules,
  onTeamChange,
  onFeaturesChange,
  onModulesChange,
}) => {
  const [featureList, setFeatureList] = useState<Array<{ id: string; code: string; name: string; description: string }>>([])
  const [moduleList, setModuleList] = useState<Array<{ id: string; code: string; name: string; description: string }>>([])

  useEffect(() => {
    fetchFeatures().then(setFeatureList)
    fetchModules().then(setModuleList)
  }, [])

  const updateOwner = (field: keyof StaffInvite, value: string) => {
    onTeamChange({ owner: { ...team.owner, [field]: value } })
  }

  const addStaff = () => {
    onTeamChange({
      additionalStaff: [...team.additionalStaff, { email: '', firstName: '', lastName: '', role: 'CASHIER' }],
    })
  }

  const updateStaff = (index: number, field: keyof StaffInvite, value: string) => {
    const updated = [...team.additionalStaff]
    updated[index] = { ...updated[index], [field]: value }
    onTeamChange({ additionalStaff: updated })
  }

  const removeStaff = (index: number) => {
    onTeamChange({ additionalStaff: team.additionalStaff.filter((_, i) => i !== index) })
  }

  const toggleFeature = (code: string) => {
    onFeaturesChange(features.includes(code) ? features.filter((f) => f !== code) : [...features, code])
  }

  const toggleModule = (code: string) => {
    const exists = modules.find((m) => m.code === code)
    if (exists) {
      onModulesChange(modules.filter((m) => m.code !== code))
    } else {
      onModulesChange([...modules, { code }])
    }
  }

  return (
    <div className="space-y-6">
      {/* Owner Card */}
      <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
            <UserCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold">Owner del Venue</h3>
            <p className="text-sm text-muted-foreground">Cuenta principal del venue</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input className="h-12 text-base" value={team.owner.email} onChange={(e) => updateOwner('email', e.target.value)} placeholder="owner@venue.com" />
          </div>
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input className="h-12 text-base" value={team.owner.firstName} onChange={(e) => updateOwner('firstName', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Apellido</Label>
            <Input className="h-12 text-base" value={team.owner.lastName} onChange={(e) => updateOwner('lastName', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Rol</Label>
            <Select value={team.owner.role} onValueChange={(v) => updateOwner('role', v)}>
              <SelectTrigger className="h-12 text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OWNER">Owner</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Additional Staff Card */}
      <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5">
              <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold">Staff Adicional</h3>
              <p className="text-sm text-muted-foreground">Invitaciones adicionales al equipo</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={addStaff} className="rounded-full cursor-pointer">
            <Plus className="w-4 h-4 mr-1" /> Agregar
          </Button>
        </div>

        {team.additionalStaff.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin invitaciones adicionales. Puedes agregar staff despues.</p>
        )}

        <div className="space-y-4">
          {team.additionalStaff.map((s, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input className="h-12 text-base" value={s.email} onChange={(e) => updateStaff(i, 'email', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input className="h-12 text-base" value={s.firstName} onChange={(e) => updateStaff(i, 'firstName', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Apellido</Label>
                <Input className="h-12 text-base" value={s.lastName} onChange={(e) => updateStaff(i, 'lastName', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Rol</Label>
                <Select value={s.role} onValueChange={(v) => updateStaff(i, 'role', v)}>
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="MANAGER">Manager</SelectItem>
                    <SelectItem value="CASHIER">Cajero</SelectItem>
                    <SelectItem value="WAITER">Mesero</SelectItem>
                    <SelectItem value="KITCHEN">Cocina</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeStaff(i)} className="cursor-pointer">
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Features Card */}
      {featureList.length > 0 && (
        <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-500/5">
              <Sparkles className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h3 className="font-semibold">Funcionalidades</h3>
              <p className="text-sm text-muted-foreground">Features disponibles para el venue</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {featureList.map((f) => (
              <div
                key={f.code}
                className="flex items-start gap-3 p-3 rounded-xl border border-border/50 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => toggleFeature(f.code)}
              >
                <Checkbox
                  checked={features.includes(f.code)}
                  onClick={(e) => e.stopPropagation()}
                  className="cursor-pointer mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium">{f.name}</p>
                  <p className="text-xs text-muted-foreground">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modules Card */}
      {moduleList.length > 0 && (
        <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5">
              <Puzzle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold">Modulos</h3>
              <p className="text-sm text-muted-foreground">Modulos adicionales para el venue</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {moduleList.map((m) => (
              <div
                key={m.code}
                className="flex items-start gap-3 p-3 rounded-xl border border-border/50 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => toggleModule(m.code)}
              >
                <Checkbox
                  checked={modules.some((mod) => mod.code === m.code)}
                  onClick={(e) => e.stopPropagation()}
                  className="cursor-pointer mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
