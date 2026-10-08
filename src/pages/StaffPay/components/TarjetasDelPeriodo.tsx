import { Card, CardContent } from '@/components/ui/card'

/** Clases literales (Tailwind sólo genera las que ve escritas): 4 tarjetas en una fila; 5 o 6, en 3 columnas y una fila en xl. */
const COLUMNAS: Record<number, string> = { 5: 'md:grid-cols-3 xl:grid-cols-5', 6: 'md:grid-cols-3 xl:grid-cols-6' }

/** Las tarjetas de arriba de un periodo (abierto o cerrado): etiqueta y valor ya formateados. */
export function TarjetasDelPeriodo({ tarjetas }: { tarjetas: ReadonlyArray<readonly [string, string | number]> }) {
  return (
    <div className={`grid grid-cols-2 gap-3 ${COLUMNAS[tarjetas.length] ?? 'md:grid-cols-4'}`}>
      {tarjetas.map(([label, value]) => (
        <Card key={label} className="border-input">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold">{value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
