import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { CardBrandBreakdown, PaymentMethodBreakdown } from '@/types'
import { Currency } from '@/utils/currency'
import { Banknote, CreditCard, Wallet } from 'lucide-react'

// Card brand icons/colors
const getCardBrandColor = (brand: string): string => {
  switch (brand?.toUpperCase()) {
    case 'VISA':
      return 'bg-blue-500'
    case 'MASTERCARD':
      return 'bg-orange-500'
    case 'AMEX':
      return 'bg-blue-700'
    case 'DISCOVER':
      return 'bg-amber-500'
    case 'CARNET':
      return 'bg-green-600'
    default:
      return 'bg-muted-foreground'
  }
}

// Unified Payment Breakdown Component (Square/Toast style - integrated hierarchy)
export const UnifiedPaymentSection = ({
  paymentMethods,
  cardBrands,
  t,
}: {
  paymentMethods: PaymentMethodBreakdown[]
  cardBrands: CardBrandBreakdown[]
  t: any
}) => {
  if (!paymentMethods || paymentMethods.length === 0) {
    return <p className="text-xs text-muted-foreground py-3">{t('detail.paymentBreakdown.noPayments')}</p>
  }

  const hasCardBrands = cardBrands && cardBrands.length > 0

  return (
    <div className="space-y-4">
      {paymentMethods.map(method => {
        // 🔴 Antes era `method.method !== 'CASH'`, o sea "todo lo que no es efectivo es
        // tarjeta" — con el desglose real eso pintaría una transferencia como tarjeta y le
        // colgaría debajo las marcas VISA/MASTERCARD. El backend ahora manda `kind`.
        const kind = method.kind ?? (method.method === 'CASH' ? 'CASH' : 'CARD')
        const isCardMethod = kind === 'CARD'

        return (
          <div key={method.method} className="space-y-2">
            {/* Main payment method row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-lg ${
                    kind === 'CASH' ? 'bg-green-500/10' : kind === 'CARD' ? 'bg-blue-500/10' : 'bg-muted'
                  }`}
                >
                  {kind === 'CASH' ? (
                    <Banknote className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : kind === 'CARD' ? (
                    <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  ) : (
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div>
                  {/* Las llaves de `methods.*` ya existen en es/en/fr para los métodos reales
                      (CREDIT_CARD, DEBIT_CARD, BANK_TRANSFER…). `label` del backend queda de
                      respaldo por si aparece un método que la UI todavía no traduce. */}
                  <p className="text-sm font-medium">{t(`methods.${method.method}`, { defaultValue: method.label ?? method.method })}</p>
                  <p className="text-xs text-muted-foreground">
                    {method.count} {t('detail.paymentBreakdown.payments')}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-sm">{Currency(method.total)}</p>
                <p className="text-xs text-muted-foreground">{method.percentage}%</p>
              </div>
            </div>
            <Progress value={method.percentage} className="h-1.5" />
            {method.tips > 0 && (
              <p className="text-[10px] text-muted-foreground pl-10">
                {t('detail.stats.tips')}: {Currency(method.tips)}
              </p>
            )}

            {/* Nested card brands (only for card payments) */}
            {isCardMethod && hasCardBrands && (
              <div className="ml-5 mt-1 pl-3 border-l-2 border-blue-200 dark:border-blue-800 space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide pb-0.5">
                  {t('detail.paymentBreakdown.byCardBrand')}
                </p>
                {cardBrands.map(brand => (
                  <div
                    key={brand.brand}
                    className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-5 rounded-full ${getCardBrandColor(brand.brand)}`} />
                      <span className="text-xs font-medium">{brand.brand}</span>
                      <span className="text-[10px] text-muted-foreground">({brand.count})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">{Currency(brand.total)}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {brand.percentage}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Hijos de cualquier otro método (p. ej. bajo Efectivo: «Gaveta» y «Efectivo · máquina»),
                con el mismo estilo que las marcas. La tarjeta con marcas se queda como siempre. */}
            {!(isCardMethod && hasCardBrands) && method.children && method.children.length > 0 && (
              <div className="ml-5 mt-1 pl-3 border-l-2 border-border space-y-1">
                {method.children.map(child => (
                  <div
                    key={child.label}
                    data-testid="payment-method-child"
                    className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-5 rounded-full bg-muted-foreground" />
                      <span className="text-xs font-medium">{child.label}</span>
                      <span className="text-[10px] text-muted-foreground">({child.count})</span>
                    </div>
                    <span className="text-xs font-semibold">{Currency(child.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
