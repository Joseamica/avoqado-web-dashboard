import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PermissionGate } from '@/components/PermissionGate'
import type { CommissionConfig } from '@/types/commission'
import DesactivarEsquema from './DesactivarEsquema'
import DuplicarConCambiosDialog from './DuplicarConCambiosDialog'

/**
 * Un esquema con comisiones calculadas no cambia de tasa, tipo ni quién recibe (ft-graves, B1): lo ya pagado no se reescribe. Lo
 * dice en la misma pantalla y da las dos salidas: desactivarlo, o duplicarlo con la tasa nueva (el nuevo reemplaza al original).
 */
export default function CandadoPorComisiones({ config, onHecho }: { config: CommissionConfig; onHecho: () => void }) {
  const { t } = useTranslation('commissions')
  const [duplicando, setDuplicando] = useState(false)
  const calculadas = config._count?.calculations ?? 0

  return (
    <div className="space-y-3 rounded-xl border border-amber-500/50 bg-amber-500/10 p-4">
      <div className="flex gap-3">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="space-y-1">
          <p className="font-medium text-amber-700 dark:text-amber-400">{t('config.locked.title')}</p>
          <p className="text-sm text-amber-700 dark:text-amber-300">{t('config.locked.desc', { count: calculadas })}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pl-7">
        <DesactivarEsquema config={config} onHecho={onHecho} />
        <PermissionGate permission="commissions:create">
          <Button variant="outline" className="cursor-pointer" onClick={() => setDuplicando(true)}>
            <Copy className="mr-2 h-4 w-4" />
            {t('config.duplicateWithChanges')}
          </Button>
        </PermissionGate>
      </div>
      {duplicando && <DuplicarConCambiosDialog open={duplicando} onOpenChange={setDuplicando} original={config} onHecho={onHecho} />}
    </div>
  )
}
