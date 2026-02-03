import React, { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'
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
    <div className="space-y-8">
      {/* Owner */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Owner del Venue</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label>Email</Label>
            <Input value={team.owner.email} onChange={(e) => updateOwner('email', e.target.value)} placeholder="owner@venue.com" />
          </div>
          <div>
            <Label>Nombre</Label>
            <Input value={team.owner.firstName} onChange={(e) => updateOwner('firstName', e.target.value)} />
          </div>
          <div>
            <Label>Apellido</Label>
            <Input value={team.owner.lastName} onChange={(e) => updateOwner('lastName', e.target.value)} />
          </div>
          <div>
            <Label>Rol</Label>
            <Select value={team.owner.role} onValueChange={(v) => updateOwner('role', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OWNER">Owner</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* Additional Staff */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Staff Adicional</h3>
          <Button variant="outline" size="sm" onClick={addStaff}>
            <Plus className="w-4 h-4 mr-1" /> Agregar
          </Button>
        </div>
        {team.additionalStaff.map((s, i) => (
          <div key={i} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div>
              <Label>Email</Label>
              <Input value={s.email} onChange={(e) => updateStaff(i, 'email', e.target.value)} />
            </div>
            <div>
              <Label>Nombre</Label>
              <Input value={s.firstName} onChange={(e) => updateStaff(i, 'firstName', e.target.value)} />
            </div>
            <div>
              <Label>Apellido</Label>
              <Input value={s.lastName} onChange={(e) => updateStaff(i, 'lastName', e.target.value)} />
            </div>
            <div>
              <Label>Rol</Label>
              <Select value={s.role} onValueChange={(v) => updateStaff(i, 'role', v)}>
                <SelectTrigger>
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
            <Button variant="ghost" size="icon" onClick={() => removeStaff(i)}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        ))}
      </section>

      {/* Features */}
      {featureList.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-lg font-semibold">Funcionalidades</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {featureList.map((f) => (
              <label key={f.code} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-accent cursor-pointer">
                <Checkbox checked={features.includes(f.code)} onCheckedChange={() => toggleFeature(f.code)} />
                <div>
                  <p className="text-sm font-medium">{f.name}</p>
                  <p className="text-xs text-muted-foreground">{f.description}</p>
                </div>
              </label>
            ))}
          </div>
        </section>
      )}

      {/* Modules */}
      {moduleList.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-lg font-semibold">Modulos</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {moduleList.map((m) => (
              <label key={m.code} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-accent cursor-pointer">
                <Checkbox checked={modules.some((mod) => mod.code === m.code)} onCheckedChange={() => toggleModule(m.code)} />
                <div>
                  <p className="text-sm font-medium">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.description}</p>
                </div>
              </label>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
