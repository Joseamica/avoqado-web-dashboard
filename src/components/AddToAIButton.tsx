import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useChatReferences } from '@/hooks/use-chat-references'
import type { Payment, Order, Product } from '@/types'
import type { RawMaterial } from '@/services/inventory.service'
import type { ShiftReference } from '@/types/chat-references'
import { cn } from '@/lib/utils'

// Union type for all supported entities
type SupportedEntity =
  | { type: 'payment'; data: Payment }
  | { type: 'order'; data: Order }
  | { type: 'shift'; data: ShiftReference }
  | { type: 'product'; data: Product }
  | { type: 'rawMaterial'; data: RawMaterial }

interface AddToAIButtonProps extends SupportedEntity {
  /** Button variant: 'icon' for tables, 'button' for detail views */
  variant?: 'icon' | 'button'
  /** Additional class names */
  className?: string
}

/**
 * Button component to add/remove items from AI chat references
 * Displays sparkles icon with visual feedback on state
 */
export function AddToAIButton({ type, data, variant = 'icon', className }: AddToAIButtonProps) {
  const { t } = useTranslation()
  const {
    hasReference,
    togglePayment,
    toggleOrder,
    toggleShift,
    toggleProduct,
    toggleRawMaterial,
    referenceCount,
  } = useChatReferences()

  const isAdded = useMemo(() => hasReference(data.id), [hasReference, data.id])

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation() // Prevent row click when clicking the button
      switch (type) {
        case 'payment':
          togglePayment(data as Payment)
          break
        case 'order':
          toggleOrder(data as Order)
          break
        case 'shift':
          toggleShift(data as ShiftReference)
          break
        case 'product':
          toggleProduct(data as Product)
          break
        case 'rawMaterial':
          toggleRawMaterial(data as RawMaterial)
          break
      }
    },
    [type, data, togglePayment, toggleOrder, toggleShift, toggleProduct, toggleRawMaterial],
  )

  const tooltipText = isAdded
    ? t('chat.references.removeFromAI', { defaultValue: 'Quitar del asistente AI' })
    : t('chat.references.addToAI', { defaultValue: 'Agregar al asistente AI' })

  if (variant === 'button') {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isAdded ? 'default' : 'outline'}
              size="sm"
              onClick={handleClick}
              className={cn('gap-2', className)}
            >
              {isAdded ? (
                <>
                  <Check className="h-4 w-4" />
                  {t('chat.references.added', { defaultValue: 'Agregado' })}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {t('chat.references.addToAIButton', { defaultValue: 'Agregar a AI' })}
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>
              {tooltipText}
              {referenceCount > 0 && ` (${referenceCount}/10)`}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Icon variant (default) - for table rows
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClick}
            className={cn(
              'h-8 w-8 transition-all duration-200',
              isAdded
                ? 'text-primary bg-primary/10 hover:bg-primary/20'
                : 'text-muted-foreground hover:text-primary hover:bg-primary/10',
              className,
            )}
            aria-label={tooltipText}
          >
            {isAdded ? <Check className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default AddToAIButton
