import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Database, RefreshCcw } from 'lucide-react'
import { themeClasses } from '@/lib/theme-utils'

export default function DatabaseSettings() {
  return (
    <div className="p-4 md:p-6">
      <h3 className={`text-lg font-medium ${themeClasses.text}`}>Configuración de Base de Datos</h3>

      <Card className={themeClasses.cardBg}>
        <CardHeader className={`border-b ${themeClasses.border}`}>
          <CardTitle className={themeClasses.text}>Mantenimiento</CardTitle>
          <CardDescription className={themeClasses.textMuted}>Opciones de mantenimiento de la base de datos</CardDescription>
        </CardHeader>

        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h4 className={`text-base font-medium ${themeClasses.text} mb-2`}>Cache</h4>
              <p className={`text-sm ${themeClasses.textMuted} mb-4`}>Limpiar la cache de la base de datos para mejorar el rendimiento.</p>
              <Button variant="outline" size="sm">
                <RefreshCcw className="h-4 w-4 mr-2" />
                Limpiar Cache
              </Button>
            </div>

            <div>
              <h4 className={`text-base font-medium ${themeClasses.text} mb-2`}>Respaldo</h4>
              <p className={`text-sm ${themeClasses.textMuted} mb-4`}>Crear un respaldo manual de la base de datos actual.</p>
              <Button variant="outline" size="sm">
                <Database className="h-4 w-4 mr-2" />
                Crear Respaldo
              </Button>
            </div>
          </div>
        </CardContent>

        <div className={`border-t ${themeClasses.border} p-4 flex justify-between items-center`}>
          <p className={`text-xs ${themeClasses.textMuted}`}>Último mantenimiento: Hace 5 días</p>
          <Button variant="default" size="sm">
            Ejecutar Mantenimiento Completo
          </Button>
        </div>
      </Card>
    </div>
  )
}
