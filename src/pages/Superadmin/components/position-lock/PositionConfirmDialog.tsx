/**
 * Diálogo del candado de posiciones (tarifa al comercio, paso 1). Pantallas de superadmin: español fijo (exentas de i18n).
 * Muestra, por cada posición cuya cuenta cambia, la tarifa que quedaría y las terminales que heredan, y pide confirmarlo.
 * Si la tarifa no es la correcta, NO se cambia aquí: se cancela y se cambia primero en Tarifas (la pantalla de siempre).
 */
import React, { useCallback, useState } from 'react'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  confirmationsFrom,
  firstConfirmations,
  percent,
  PositionConfirmCancelled,
  positionsToConfirm,
  type PositionConfirmations,
  type PositionDetail,
  type PositionPricing,
  type SeenAccounts,
} from './positionLock'

export interface RatesLink {
  href: string
  label: string
}

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })

function Tarifa({ pricing }: { pricing: PositionPricing }) {
  return (
    <span className="tabular-nums">
      Débito {percent(pricing.debitRate)} · Crédito {percent(pricing.creditRate)} · Amex {percent(pricing.amexRate)} · Internacional{' '}
      {percent(pricing.internationalRate)}
      {pricing.fixedFeePerTransaction ? ` · $${pricing.fixedFeePerTransaction.toFixed(2)} por cobro` : ''}
      {pricing.includesTax === true ? ' · IVA incluido' : pricing.includesTax === false ? ' · más IVA' : ''}
    </span>
  )
}

const marcas = (byBrand: Record<string, number>) =>
  Object.entries(byBrand)
    .map(([marca, n]) => `${n} ${marca === 'NEXGO' ? 'Nexgo' : marca}`)
    .join(', ')

export function PositionConfirmDialog({
  positions,
  ratesLink,
  onAnswer,
}: {
  positions: PositionDetail[]
  ratesLink?: RatesLink
  onAnswer: (confirmed: boolean) => void
}) {
  const needsRate = positions.some(p => p.needs.rate)
  const needsTerminals = positions.some(p => p.needs.inheritingTerminals)
  const [rateOk, setRateOk] = useState(false)
  const [terminalsOk, setTerminalsOk] = useState(false)
  const ready = (!needsRate || rateOk) && (!needsTerminals || terminalsOk)

  return (
    <Dialog open onOpenChange={open => !open && onAnswer(false)}>
      <DialogContent className="max-w-lg" data-testid="position-confirm-dialog">
        <DialogHeader>
          <DialogTitle>Confirma el cambio de cuenta</DialogTitle>
          <DialogDescription>Antes de guardar, revisa la tarifa que tendrá la cuenta y las terminales que la usan.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {positions.map(p => (
            <div key={p.slot} className="rounded-lg border border-border p-3 text-sm space-y-2">
              <div className="flex flex-wrap items-center gap-1.5 font-medium">
                <span>Posición {p.label}:</span>
                <span>{p.currentAccount?.name ?? 'vacía'}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                <span>{p.nextAccount?.name ?? 'vacía'}</span>
              </div>

              {p.nextAccount && (
                <div className="text-muted-foreground">
                  {p.pricing ? (
                    <>
                      <div>
                        Tarifa que quedaría ({p.pricing.source === 'organization' ? 'de la organización' : 'de este negocio'}, desde{' '}
                        {fecha(p.pricing.effectiveFrom)}):
                      </div>
                      <div className="text-foreground">
                        <Tarifa pricing={p.pricing} />
                      </div>
                    </>
                  ) : (
                    <div>Esta posición no tiene tarifa.</div>
                  )}
                  {p.venuesWithOwnRate && p.venuesWithOwnRate.total > 0 && (
                    <div className="mt-1">
                      {p.venuesWithOwnRate.total} negocio(s) que usan estas cuentas tienen su propia tarifa en esta posición y la conservan:{' '}
                      {p.venuesWithOwnRate.sample.map(v => v.venueName).join(', ')}
                      {p.venuesWithOwnRate.total > p.venuesWithOwnRate.sample.length ? '…' : ''}
                    </div>
                  )}
                </div>
              )}

              {p.needs.inheritingTerminals && (
                <div className="flex gap-2 rounded-md bg-muted p-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-orange-600 dark:text-orange-400 mt-0.5" aria-hidden />
                  <span>
                    {p.inheritingTerminals.total} terminal(es) ({marcas(p.inheritingTerminals.byBrand)}) usan las cuentas de este negocio sin
                    asignación propia.
                    {p.inheritingTerminals.losingAccount > 0 &&
                      ` ${p.inheritingTerminals.losingAccount} dejarán de tener la cuenta ${p.currentAccount?.name ?? ''}.`}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {needsRate && (
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <Checkbox checked={rateOk} onCheckedChange={v => setRateOk(v === true)} aria-label="La tarifa es la correcta" />
            <span>
              La tarifa es la correcta.{' '}
              <span className="text-muted-foreground">
                Si no, cancela y cámbiala primero en{' '}
                {ratesLink ? (
                  <a href={ratesLink.href} className="underline">
                    {ratesLink.label}
                  </a>
                ) : (
                  'Tarifas'
                )}
                ; después vuelve a guardar la cuenta.
              </span>
            </span>
          </label>
        )}
        {needsTerminals && (
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <Checkbox checked={terminalsOk} onCheckedChange={v => setTerminalsOk(v === true)} aria-label="Entiendo lo de las terminales" />
            <span>Entiendo qué terminales cambian.</span>
          </label>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onAnswer(false)}>
            Cancelar
          </Button>
          <Button onClick={() => onAnswer(true)} disabled={!ready} data-testid="position-confirm-ok">
            Confirmar y guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * `run(send, seen)`: manda el guardado con la cuenta que vio la pantalla; si el SERVIDOR pide confirmar, abre el diálogo
 * y reintenta la MISMA petición con lo confirmado. Cancelar lanza `PositionConfirmCancelled` (usa `isPositionConfirmCancel`
 * en `onError` para no mostrarlo como error). Pinta `dialog` en el componente.
 */
export function usePositionConfirm() {
  const [pending, setPending] = useState<{ positions: PositionDetail[]; ratesLink?: RatesLink; resolve: (ok: boolean) => void } | null>(
    null,
  )

  const run = useCallback(
    async <T,>(send: (pc?: PositionConfirmations) => Promise<T>, seen?: SeenAccounts, options?: { ratesLink?: RatesLink }): Promise<T> => {
      const first = firstConfirmations(seen)
      try {
        return await send(first)
      } catch (error) {
        const positions = positionsToConfirm(error)
        if (!positions) throw error
        const ok = await new Promise<boolean>(resolve => setPending({ positions, ratesLink: options?.ratesLink, resolve }))
        if (!ok) throw new PositionConfirmCancelled()
        return send(confirmationsFrom(positions, first))
      }
    },
    [],
  )

  const dialog = pending ? (
    <PositionConfirmDialog
      positions={pending.positions}
      ratesLink={pending.ratesLink}
      onAnswer={ok => {
        pending.resolve(ok)
        setPending(null)
      }}
    />
  ) : null

  return { run, dialog }
}
