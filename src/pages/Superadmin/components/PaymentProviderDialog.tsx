import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { type PaymentProvider } from '@/services/paymentProvider.service'
import { Loader2, CreditCard, Globe, Wallet, Building2, Store } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PaymentProviderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  provider?: PaymentProvider | null
  onSave: (data: Partial<PaymentProvider>) => Promise<void>
}

const PROVIDER_TYPES = [
  { value: 'PAYMENT_PROCESSOR', label: 'Procesador de Pagos', icon: CreditCard },
  { value: 'GATEWAY', label: 'Gateway', icon: Globe },
  { value: 'WALLET', label: 'Billetera Digital', icon: Wallet },
  { value: 'BANK_DIRECT', label: 'Banco Directo', icon: Building2 },
  { value: 'AGGREGATOR', label: 'Agregador', icon: Store },
]

const COUNTRIES = [
  { value: 'MX', label: 'México', flag: '🇲🇽' },
  { value: 'US', label: 'Estados Unidos', flag: '🇺🇸' },
  { value: 'CA', label: 'Canadá', flag: '🇨🇦' },
  { value: 'BR', label: 'Brasil', flag: '🇧🇷' },
  { value: 'AR', label: 'Argentina', flag: '🇦🇷' },
  { value: 'CL', label: 'Chile', flag: '🇨🇱' },
  { value: 'CO', label: 'Colombia', flag: '🇨🇴' },
  { value: 'PE', label: 'Perú', flag: '🇵🇪' },
]

export const PaymentProviderDialog: React.FC<PaymentProviderDialogProps> = ({
  open,
  onOpenChange,
  provider,
  onSave,
}) => {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: 'PAYMENT_PROCESSOR' as PaymentProvider['type'],
    countryCode: [] as string[],
    active: true,
  })

  useEffect(() => {
    if (provider) {
      setFormData({
        code: provider.code,
        name: provider.name,
        type: provider.type,
        countryCode: provider.countryCode || [],
        active: provider.active,
      })
    } else {
      setFormData({
        code: '',
        name: '',
        type: 'PAYMENT_PROCESSOR',
        countryCode: [],
        active: true,
      })
    }
  }, [provider, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onSave(formData)
      onOpenChange(false)
    } catch (error) {
      console.error('Error saving provider:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleCountry = (country: string) => {
    setFormData(prev => ({
      ...prev,
      countryCode: prev.countryCode.includes(country)
        ? prev.countryCode.filter(c => c !== country)
        : [...prev.countryCode, country],
    }))
  }

  const isEditing = !!provider

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-500/5">
                <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <DialogTitle>
                  {isEditing ? 'Editar Proveedor' : 'Nuevo Proveedor de Pago'}
                </DialogTitle>
                <DialogDescription>
                  {isEditing
                    ? 'Actualiza la información del proveedor de pagos'
                    : 'Agrega un nuevo proveedor de pagos al sistema'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid gap-5 py-5">
            {/* Code */}
            <div className="grid gap-2">
              <Label htmlFor="code">
                Código del Proveedor <span className="text-destructive">*</span>
              </Label>
              <Input
                id="code"
                value={formData.code}
                onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="BLUMON, STRIPE, etc."
                required
                disabled={isEditing}
                className="bg-background font-mono"
              />
              {isEditing && (
                <p className="text-xs text-muted-foreground">
                  El código no puede ser modificado después de la creación
                </p>
              )}
            </div>

            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">
                Nombre del Proveedor <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Blumon Payments, Stripe, etc."
                required
                className="bg-background"
              />
            </div>

            {/* Type */}
            <div className="grid gap-2">
              <Label htmlFor="type">
                Tipo de Proveedor <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.type}
                onValueChange={(value: PaymentProvider['type']) =>
                  setFormData({ ...formData, type: value })
                }
              >
                <SelectTrigger className="bg-background cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_TYPES.map(type => {
                    const Icon = type.icon
                    return (
                      <SelectItem key={type.value} value={type.value} className="cursor-pointer">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                          <span>{type.label}</span>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Countries */}
            <div className="grid gap-2">
              <Label>Países Soportados</Label>
              <div className="grid grid-cols-2 gap-2 p-3 border border-border rounded-lg bg-muted/30">
                {COUNTRIES.map(country => (
                  <div
                    key={country.value}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors',
                      'hover:bg-muted/50',
                      formData.countryCode.includes(country.value) && 'bg-primary/10'
                    )}
                    onClick={() => toggleCountry(country.value)}
                  >
                    <Checkbox
                      id={`country-${country.value}`}
                      checked={formData.countryCode.includes(country.value)}
                      onCheckedChange={() => toggleCountry(country.value)}
                      onClick={e => e.stopPropagation()}
                      className="cursor-pointer"
                    />
                    <label
                      htmlFor={`country-${country.value}`}
                      className="text-sm font-medium leading-none cursor-pointer flex items-center gap-1.5 flex-1"
                    >
                      <span>{country.flag}</span>
                      <span>{country.label}</span>
                    </label>
                  </div>
                ))}
              </div>
              {formData.countryCode.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Selecciona al menos un país donde opera este proveedor
                </p>
              )}
            </div>

            {/* Active */}
            <div className="flex items-center justify-between p-3 border border-border rounded-lg bg-muted/30">
              <div className="flex-1">
                <Label htmlFor="active" className="cursor-pointer">
                  Estado del Proveedor
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formData.active
                    ? 'El proveedor está disponible para nuevas integraciones'
                    : 'El proveedor no aparecerá como opción disponible'}
                </p>
              </div>
              <Switch
                id="active"
                checked={formData.active}
                onCheckedChange={(checked: boolean) => setFormData({ ...formData, active: checked })}
                className="cursor-pointer"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="cursor-pointer"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="cursor-pointer">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Guardar Cambios' : 'Crear Proveedor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
