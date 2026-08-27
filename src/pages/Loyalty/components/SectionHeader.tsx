import React from 'react'

/**
 * Encabezado de seccion del diseñador de la tarjeta.
 *
 * 🔴 Vive en su PROPIO archivo, no exportado desde `WalletCardDesigner`: aquel importa
 * `CounterPosterCard`, asi que sacarlo de ahi crea un ciclo (diseñador → cartel →
 * diseñador). Un ciclo asi compila y pasa el typecheck; lo que hace es dejar uno de
 * los dos como `undefined` al montar, segun el orden en que el bundler los resuelva.
 */
export function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <div className="rounded-xl bg-muted p-2">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

export default SectionHeader
