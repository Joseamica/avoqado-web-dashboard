import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Convención de color contable de Avoqado, definida UNA vez (antes copiada en 3 páginas):
 * deudora/cargo = azul, acreedora/abono = morado, ambos = neutro. Todos con dark: variant.
 */
const TINT = {
  blue: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  purple: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  muted: 'bg-muted text-muted-foreground',
} as const

function Pill({ tint, children }: { tint: keyof typeof TINT; children: ReactNode }) {
  return <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] whitespace-nowrap', TINT[tint])}>{children}</span>
}

/** Naturaleza de la cuenta: DEUDORA (azul) / ACREEDORA (morado). `children` = etiqueta ya traducida. */
export function NatureBadge({ nature, children }: { nature: string; children: ReactNode }) {
  return <Pill tint={nature === 'ACREEDORA' ? 'purple' : 'blue'}>{children}</Pill>
}

/** Lado del movimiento: DEBIT/cargo (azul) / CREDIT/abono (morado) / BOTH/ambos (neutro). */
export function SideBadge({ side, children }: { side: string; children: ReactNode }) {
  return <Pill tint={side === 'DEBIT' ? 'blue' : side === 'CREDIT' ? 'purple' : 'muted'}>{children}</Pill>
}
