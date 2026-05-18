/**
 * AngelPay-specific MerchantAccount form fields (Task 17, spec §5.2).
 *
 * Replaces the AngelPay block currently embedded in `ManualAccountDialog`
 * when `providerCode === 'ANGELPAY'`. Pure presentational — owns no state,
 * fires `setX` callbacks back to the parent so the dialog can keep its
 * single source of truth.
 *
 * Field set (spec §3.2 + §4.4):
 *   - externalMerchantId — numeric string only. AngelPay `MerchantOption.id`
 *     is an Int in the SDK 1.0.5 multi-merchant payload; the backend's
 *     ANGELPAY branch in `createMerchantAccount` rejects non-numeric values
 *     with a 400 (`ValidationError`).
 *   - angelpayAffiliation — opaque text. Sent to the backend as
 *     `providerConfig.angelpayAffiliation` so the TPV can pre-select the
 *     right merchant in the SDK without round-tripping the operator.
 *   - angelpayMerchantName — optional display override. When empty, the
 *     MerchantAccount `displayName` (set by the parent) is used.
 *
 * NOT handled here: credentials (AngelPay stores them on
 * `AngelPayUserAccount`, not on `MerchantAccount`) or compatibility checks
 * (see `<DeviceCompatibilityBanner>`).
 */

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Smartphone } from 'lucide-react'
import React from 'react'

export interface AngelPayFieldsProps {
  externalMerchantId: string
  setExternalMerchantId: (v: string) => void
  angelpayAffiliation: string
  setAngelpayAffiliation: (v: string) => void
  angelpayMerchantName: string
  setAngelpayMerchantName: (v: string) => void
}

/**
 * Filter typed value to digits-only on the client side. The backend ANGELPAY
 * branch (Task 10) re-validates with `/^\d+$/` so this is purely UX — it
 * prevents the operator from typing a leading "MID-" prefix or pasting an
 * email into the wrong field. Empty string is allowed so the field can be
 * cleared during editing.
 */
function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, '')
}

export const AngelPayFields: React.FC<AngelPayFieldsProps> = ({
  externalMerchantId,
  setExternalMerchantId,
  angelpayAffiliation,
  setAngelpayAffiliation,
  angelpayMerchantName,
  setAngelpayMerchantName,
}) => {
  return (
    <div className="border border-orange-500/30 rounded-lg p-4 space-y-4 bg-orange-500/5">
      <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
        <Smartphone className="h-4 w-4" />
        <span className="text-sm font-medium">Datos del comercio AngelPay</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Las credenciales (correo + PIN) viven en la cuenta AngelPay del venue. Aquí solo registramos qué afiliación de ese login usar.
      </p>

      <div className="grid gap-2">
        <Label htmlFor="angelpay-external-merchant-id">
          AngelPay Merchant ID <span className="text-destructive">*</span>
        </Label>
        <Input
          id="angelpay-external-merchant-id"
          inputMode="numeric"
          pattern="\d+"
          value={externalMerchantId}
          // Strip any non-digit at the source so the value stored in state
          // already matches the backend regex. Avoids the "save fails with a
          // cryptic 400 on a value the UI accepted" footgun.
          onChange={e => setExternalMerchantId(digitsOnly(e.target.value))}
          placeholder="Ej: 9814275"
          className="bg-background border-input font-mono text-sm"
          autoComplete="off"
          data-1p-ignore
        />
        <p className="text-xs text-muted-foreground">
          ID numérico del comercio (entero). Búscalo en el portal AngelPay o pídelo al contacto técnico.
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="angelpay-affiliation">
          Número de afiliación <span className="text-destructive">*</span>
        </Label>
        <Input
          id="angelpay-affiliation"
          value={angelpayAffiliation}
          onChange={e => setAngelpayAffiliation(e.target.value)}
          placeholder="Ej: 9814275"
          className="bg-background border-input font-mono text-sm"
          autoComplete="off"
          data-1p-ignore
        />
        <p className="text-xs text-muted-foreground">
          Afiliación tal y como aparece en el portal AngelPay. Se usa para autoseleccionar el comercio correcto en el SDK.
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="angelpay-merchant-name">
          Nombre del comercio <span className="text-muted-foreground text-xs">(opcional)</span>
        </Label>
        <Input
          id="angelpay-merchant-name"
          value={angelpayMerchantName}
          onChange={e => setAngelpayMerchantName(e.target.value)}
          placeholder="Sucursal Centro"
          className="bg-background border-input text-sm"
          autoComplete="off"
          data-1p-ignore
        />
        <p className="text-xs text-muted-foreground">
          Si se omite, se usará el <code className="bg-muted px-1 py-0.5 rounded font-mono text-[10px]">displayName</code> del MerchantAccount.
        </p>
      </div>
    </div>
  )
}

export default AngelPayFields
