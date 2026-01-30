/**
 * PhonePreview - Live phone frame preview of TPV config
 * Shows how the mobile app will look with current settings
 */

import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { ModuleToggleState } from './ModuleToggles'
import type { CatalogItem } from './CatalogEditor'

interface PhonePreviewProps {
  modules: ModuleToggleState
  categories: CatalogItem[]
  className?: string
}

export function PhonePreview({ modules, categories, className }: PhonePreviewProps) {
  const { t } = useTranslation('playtelecom')

  const activeItems = categories.filter(c => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className={cn('flex flex-col items-center justify-center', className)}>
      <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest mb-6">
        {t('tpvConfig.preview.title', { defaultValue: 'Vista Previa en Vivo' })}
      </p>

      {/* Phone frame */}
      <div className="bg-card rounded-[3rem] w-[280px] h-[560px] overflow-hidden border-8 border-border shadow-2xl">
        <div className="w-full h-full flex flex-col">
          {/* Status bar */}
          <div className="bg-muted h-6 w-full flex justify-end px-3 items-center gap-1.5 text-muted-foreground">
            <span className="text-[9px]">9:41</span>
          </div>

          {/* App header */}
          <div className="bg-primary p-4 text-primary-foreground rounded-b-xl">
            <p className="text-[10px] opacity-80 uppercase">
              {t('tpvConfig.preview.hello', { defaultValue: 'Hola, Promotor' })}
            </p>
            <h3 className="font-bold text-lg">
              {t('tpvConfig.preview.shiftStart', { defaultValue: 'Inicio de Turno' })}
            </h3>
          </div>

          {/* Content */}
          <div className="flex-1 p-3 overflow-y-auto space-y-2.5 bg-background">
            {/* Attendance module */}
            {modules.attendanceTracking && (
              <div className="bg-card p-3 rounded-xl border border-border/50 flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-xs font-semibold">
                  {t('tpvConfig.preview.clockIn', { defaultValue: 'Registrar Entrada' })}
                </p>
              </div>
            )}

            {/* Sale buttons */}
            <p className="text-[10px] font-bold text-muted-foreground uppercase mt-3 mb-1">
              {t('tpvConfig.preview.newSale', { defaultValue: 'Nueva Venta' })}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {activeItems.slice(0, 4).map(item => (
                <div
                  key={item.id}
                  className="bg-card p-2.5 rounded-xl border border-border/50 text-center"
                >
                  <p className="text-xs font-bold" style={{ color: item.color }}>
                    ${item.price}
                  </p>
                  <p className="text-[9px] text-muted-foreground truncate">{item.name}</p>
                </div>
              ))}
            </div>

            {/* Scanner hint */}
            {modules.enableBarcodeScanner && (
              <div className="bg-card p-2.5 rounded-xl border border-border/50 flex items-center justify-center gap-2">
                <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                <p className="text-[10px] font-semibold text-muted-foreground">
                  {t('tpvConfig.preview.scanBarcode', { defaultValue: 'Escanear ICCID' })}
                </p>
              </div>
            )}
          </div>

          {/* Bottom nav */}
          <div className="bg-card border-t border-border/50 p-2.5 flex justify-around">
            <div className="w-5 h-5 rounded bg-primary/20" />
            <div className="w-5 h-5 rounded bg-muted" />
            <div className="w-5 h-5 rounded bg-muted" />
          </div>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground mt-4 text-center max-w-[200px]">
        {t('tpvConfig.preview.syncNote', { defaultValue: 'Los cambios se reflejaran en las TPVs activas al guardar.' })}
      </p>
    </div>
  )
}
