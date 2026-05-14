import { useMemo, useState } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Info, Tag, Globe, BellRing } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CategoryPolicy, DerivedRow, GlobalPolicy } from '../../types/profitability'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  rows: DerivedRow[]
  /** Optional: opening the drawer focused on a single product's policy */
  focusedProduct?: DerivedRow | null
}

type Tab = 'category' | 'global' | 'alerts'

const TABS: Array<{ id: Tab; label: string; icon: typeof Tag; desc: string }> = [
  { id: 'category', label: 'Por categoría', icon: Tag, desc: 'Margen objetivo por sección de tu menú' },
  { id: 'global', label: 'Reglas globales', icon: Globe, desc: 'Cálculo, redondeo y default' },
  { id: 'alerts', label: 'Alertas', icon: BellRing, desc: 'Cuándo avisarte' },
]

export function PolicyDrawer({ open, onOpenChange, rows, focusedProduct }: Props) {
  const [tab, setTab] = useState<Tab>(focusedProduct ? 'category' : 'category')

  // Initial per-category state derived from rows
  const initialCategories = useMemo<CategoryPolicy[]>(() => {
    const map = new Map<string, { count: number; below: number }>()
    rows.forEach(r => {
      const k = r.category ?? 'Sin categoría'
      const cur = map.get(k) ?? { count: 0, below: 0 }
      cur.count += 1
      if (r.marginPct !== null && r.marginPct < 0.5) cur.below += 1
      map.set(k, cur)
    })
    return Array.from(map.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .map(([category, v]) => ({ category, targetMarginPct: 0.5, productsBelow: v.below }))
  }, [rows])

  const [categories, setCategories] = useState<CategoryPolicy[]>(initialCategories)
  const [global, setGlobal] = useState<GlobalPolicy>({
    defaultTargetMarginPct: 0.5,
    rounding: 'PSYCHOLOGICAL_99',
    computeBy: 'MARGIN',
    costChangeAlertThresholdPct: 0.05,
  })

  const updateCategory = (category: string, targetMarginPct: number) =>
    setCategories(prev => prev.map(c => (c.category === category ? { ...c, targetMarginPct } : c)))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl tracking-tight">Políticas de precios</SheetTitle>
          <SheetDescription>
            {focusedProduct
              ? `Configurando ${focusedProduct.name}. Define el margen objetivo y cómo calcular el precio sugerido.`
              : 'Define cómo se calculan los precios sugeridos y cuándo te avisamos de cambios.'}
          </SheetDescription>
        </SheetHeader>

        {/* Tab nav */}
        <div className="mt-6 border-b border-border">
          <nav className="flex items-center gap-1">
            {TABS.map(t => {
              const Icon = t.icon
              const active = tab === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'relative flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors',
                    active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                  {active && <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-primary rounded-full" />}
                </button>
              )
            })}
          </nav>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">{TABS.find(t => t.id === tab)?.desc}</p>

        <div className="mt-5 space-y-5">
          {tab === 'category' && (
            <ul className="space-y-2">
              {categories.map(c => {
                const tgtPct = Math.round(c.targetMarginPct * 100)
                return (
                  <li
                    key={c.category}
                    className="rounded-xl border border-border/60 bg-card p-4 hover:border-border transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{c.category}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {c.productsBelow > 0 ? (
                            <>
                              <span className="text-amber-600 dark:text-amber-400 font-medium">{c.productsBelow}</span> bajo objetivo
                            </>
                          ) : (
                            'todo arriba del objetivo'
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-none">
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={100}
                          value={tgtPct}
                          onChange={e => updateCategory(c.category, Math.max(0, Math.min(100, Number(e.target.value))) / 100)}
                          className="h-9 w-20 text-right tabular-nums"
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {tab === 'global' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-border/60 bg-card p-4">
                <div className="flex items-center justify-between gap-4 mb-1">
                  <Label className="text-sm font-medium">Calcular por</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="text-muted-foreground hover:text-foreground">
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs leading-relaxed">
                        <p className="font-medium mb-1">Margen vs Markup</p>
                        <p>
                          <strong>Margen 50%</strong>: ganas la mitad del precio (precio = costo × 2).{' '}
                          <strong>Markup 50%</strong>: subes el costo a la mitad (precio = costo × 1.5). Diferente cosa.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <RadioGroup
                  value={global.computeBy}
                  onValueChange={v => setGlobal(g => ({ ...g, computeBy: v as GlobalPolicy['computeBy'] }))}
                  className="flex gap-4 mt-3"
                >
                  <label className="flex items-center gap-2 cursor-pointer">
                    <RadioGroupItem value="MARGIN" id="compute-margin" />
                    <span className="text-sm">Margen</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <RadioGroupItem value="MARKUP" id="compute-markup" />
                    <span className="text-sm">Markup</span>
                  </label>
                </RadioGroup>
              </div>

              <div className="rounded-xl border border-border/60 bg-card p-4">
                <Label className="text-sm font-medium">Margen objetivo por defecto</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Se aplica a categorías sin objetivo específico.
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={Math.round(global.defaultTargetMarginPct * 100)}
                    onChange={e =>
                      setGlobal(g => ({
                        ...g,
                        defaultTargetMarginPct: Math.max(0, Math.min(100, Number(e.target.value))) / 100,
                      }))
                    }
                    className="h-9 w-24 text-right tabular-nums"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-card p-4">
                <Label className="text-sm font-medium">Redondeo del precio sugerido</Label>
                <RadioGroup
                  value={global.rounding}
                  onValueChange={v => setGlobal(g => ({ ...g, rounding: v as GlobalPolicy['rounding'] }))}
                  className="mt-3 grid grid-cols-2 gap-2"
                >
                  {[
                    { v: 'NONE', l: 'Sin redondear', ex: '$97.34' },
                    { v: 'PSYCHOLOGICAL_99', l: 'Terminar en .99', ex: '$97.99' },
                    { v: 'NEAREST_50', l: 'A los .50 más cercanos', ex: '$97.50' },
                    { v: 'WHOLE', l: 'Entero', ex: '$97' },
                  ].map(o => (
                    <label
                      key={o.v}
                      className={cn(
                        'flex items-center justify-between gap-2 cursor-pointer rounded-lg border p-3 transition-colors',
                        global.rounding === o.v ? 'border-primary bg-primary/5' : 'border-border/60 hover:border-border',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value={o.v} id={`round-${o.v}`} />
                        <span className="text-sm">{o.l}</span>
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground">{o.ex}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>
            </div>
          )}

          {tab === 'alerts' && (
            <div className="space-y-3">
              <div className="rounded-xl border border-border/60 bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label className="text-sm font-medium">Alerta de costo</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Te avisamos cuando el costo de un producto suba sin que ajustes el precio.
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <span className="text-xs text-muted-foreground">Umbral</span>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={Math.round(global.costChangeAlertThresholdPct * 100)}
                    onChange={e =>
                      setGlobal(g => ({
                        ...g,
                        costChangeAlertThresholdPct: Math.max(0, Math.min(100, Number(e.target.value))) / 100,
                      }))
                    }
                    className="h-8 w-20 text-right tabular-nums"
                  />
                  <span className="text-xs text-muted-foreground">% de cambio</span>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label className="text-sm font-medium">Productos sin política</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Aviso semanal con los productos que no tienen objetivo de margen.
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label className="text-sm font-medium">Margen por debajo de objetivo</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Cuando un producto cae por debajo del objetivo de su categoría.
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-border space-y-3">
          <div className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/30 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <Info className="h-3.5 w-3.5 mt-0.5 flex-none" />
            <span>
              <strong>Próximamente:</strong> guardar políticas. Estamos terminando la persistencia de objetivos por
              categoría y reglas globales. Por ahora puedes explorarlo en modo vista.
            </span>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
