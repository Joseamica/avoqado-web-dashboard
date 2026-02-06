# 🔍 Detección de Código No Utilizado - Dashboard

Este proyecto incluye herramientas para detectar código no utilizado de manera **informativa** (no eliminan nada automáticamente).

## 📦 Herramientas Instaladas

### 1. **unimported**
- Detecta componentes React/TypeScript que no son importados
- Identifica dependencias npm no utilizadas
- Rápido y simple

### 2. **knip**
- Análisis profundo de "dead code"
- Detecta exports no utilizados
- Identifica tipos TypeScript no usados
- Encuentra dependencias duplicadas
- Más completo pero más lento

## 🚀 Comandos Disponibles

```bash
# Detectar archivos no importados (rápido)
npm run check:unused

# Análisis completo de dead code (detallado)
npm run check:dead-code

# Ejecutar ambos análisis
npm run check:all

# Auto-actualizar lista de archivos pendientes (nuevo)
npm run update:unused-ignore
```

## 🔖 Sistema de Marcador @pending-implementation

**Propósito**: Marcar componentes/archivos completamente implementados pero que aún no están integrados en la aplicación.

### ¿Cuándo usarlo?

Usa el marcador `@pending-implementation` cuando:
- ✅ El componente/archivo está completamente implementado y probado
- ✅ Se integrará pronto pero no inmediatamente
- ✅ Quieres excluirlo de la detección de código no utilizado
- ✅ Quieres documentar el estado de implementación para futuros desarrolladores

### Formato del marcador

```typescript
/**
 * @pending-implementation
 * [Nombre del componente/característica]
 *
 * STATUS: Implementado pero no integrado en [dónde se usará].
 * Este [tipo de componente] está listo para usar pero no se ha [acción de integración] aún.
 * Se aplicará gradualmente a [ubicaciones objetivo].
 *
 * Usage:
 * [Ejemplo de uso JSX]
 */
```

### Ejemplo real

```typescript
/**
 * @pending-implementation
 * Enhanced Search Component
 *
 * STATUS: Implemented but not yet integrated into the main dashboard.
 * This component is ready to use but hasn't been added to the search bar yet.
 * It will be gradually applied to all data tables with advanced filtering needs.
 *
 * Usage:
 * <EnhancedSearch onSearch={handleSearch} filters={filterConfig} />
 */
export function EnhancedSearch({ onSearch, filters }) {
  // ... implementation
}
```

### Cómo funciona

1. **Agrega el marcador** en los primeros 500 caracteres del archivo (`.ts`, `.tsx`, `.js`, `.jsx`)
2. **Ejecuta el script** de actualización:
   ```bash
   npm run update:unused-ignore
   ```
3. **El script automáticamente**:
   - Escanea `src/` buscando archivos con `@pending-implementation`
   - Actualiza `.unimportedrc.json` agregándolos a `ignoreUnimported`
   - Preserva otros archivos ignorados (`.d.ts`, `vite-env.d.ts`, etc.)

4. **Cuando integres el archivo**:
   - Elimina el marcador `@pending-implementation`
   - Ejecuta `npm run update:unused-ignore` nuevamente
   - El archivo se removerá automáticamente de la lista de ignorados

### Archivos actualmente pendientes

```bash
# Ver archivos marcados como pendientes
npm run update:unused-ignore
# Output mostrará: "📝 Found X files with @pending-implementation:"
```

### ⚠️ Importante

- El marcador es para componentes **LISTOS para usar**, no para código incompleto
- El marcador debe estar en los primeros 500 caracteres del archivo
- Ejecuta `npm run update:unused-ignore` después de agregar o remover marcadores
- El script es seguro: preserva configuraciones existentes de `.unimportedrc.json`
- Compatible con componentes React (`.tsx`, `.jsx`) y utilidades (`.ts`, `.js`)

## ⚙️ Archivos de Configuración

- **`.unimportedrc.json`**: Configuración para unimported
- **`knip.json`**: Configuración para knip

## 📊 Resultados Actuales

### Dashboard - Archivos No Utilizados (15)
```
✗ src/components/calendar.tsx
✗ src/components/EnvironmentIndicator.tsx
✗ src/components/notifications/NotificationPreferences.tsx
✗ src/components/Sidebar/enhanced-add-venue-dialog.tsx
✗ src/components/Sidebar/nav-projects.tsx
✗ src/components/templates/ThemeAwareTemplates.tsx
✗ src/components/ui/pagination.tsx
✗ src/components/ui/search-form.tsx
✗ src/hooks/use-login.tsx
✗ src/hooks/use-theme-classes.ts
✗ src/lib/theme-utils.ts
✗ src/pages/Admin/SystemSettings/DEPRECATEDDatabaseSettings.tsx
✗ src/pages/Config/Configuration.tsx
✗ src/pages/index.ts
✗ src/vite-env.d.ts (archivo de tipos de Vite - IGNORAR)
```

### Dependencias No Utilizadas (7)
```
✗ @hello-pangea/dnd
✗ i18next-browser-languagedetector
✗ localforage
✗ match-sorter
✗ papaparse
✗ tailwindcss-animate
✗ uuidv4
```

**Posible ahorro**: ~2-3 MB en bundle size

## ⚠️ Importante: Solo Informativo

Estas herramientas **NO ELIMINAN CÓDIGO AUTOMÁTICAMENTE**. Solo te muestran un reporte.

Tú decides:
- ✅ Qué componentes eliminar
- ✅ Qué dependencias desinstalar
- ✅ Qué exports limpiar

## 🔄 Cuándo Ejecutar

Se recomienda ejecutar periódicamente:
- 📅 Mensualmente
- 🚀 Antes de releases importantes
- 🧹 Durante sesiones de limpieza de código
- 📦 Al reducir el tamaño del bundle

## ❓ Falsos Positivos Comunes en React

Algunos archivos pueden parecer "no usados" pero sí se usan:

1. **Componentes importados dinámicamente**:
   ```tsx
   const Component = lazy(() => import('./Component'))
   ```

2. **Archivos de tipos TypeScript**: `.d.ts`

3. **Páginas con routing dinámico**: Pueden ser cargadas por el router

4. **Hooks personalizados**: Usados solo en un componente

**⚠️ Siempre revisa antes de eliminar**

## 🎯 Uso Recomendado

### Paso 1: Ejecutar análisis
```bash
npm run check:all
```

### Paso 2: Revisar resultados
Analiza la lista de componentes/dependencias marcados como no usados.

### Paso 3: Verificar manualmente
```bash
# Buscar referencias en todo el proyecto
grep -r "ComponentName" src/

# Buscar en archivos de routing
grep -r "ComponentName" src/routes/
```

### Paso 4: Eliminar con confianza
```bash
# Eliminar componente
git rm src/components/UnusedComponent.tsx

# Desinstalar dependencia
npm uninstall package-name
```

## 🧹 Limpieza Rápida Recomendada

### 1. Archivos DEPRECATED
```bash
# Seguro de eliminar (marcados como DEPRECATED)
git rm src/pages/Admin/SystemSettings/DEPRECATEDDatabaseSettings.tsx
```

### 2. Dependencias claramente no usadas
```bash
# Si no usas drag & drop
npm uninstall @hello-pangea/dnd

# Si no usas detección de idioma del navegador
npm uninstall i18next-browser-languagedetector

# Si no usas parsing de CSV
npm uninstall papaparse
```

## 📝 Ejemplo de Flujo de Trabajo

```bash
# 1. Ejecutar análisis
npm run check:unused

# 2. Revisar componente marcado
# Ejemplo: src/components/calendar.tsx

# 3. Buscar si se usa
grep -r "calendar" src/

# 4. Si no se usa, eliminar
git rm src/components/calendar.tsx

# 5. Verificar que el build funciona
npm run build

# 6. Commit
git add -A
git commit -m "chore: remove unused calendar component"
```

## 🛠️ Personalizar Configuración

### Ignorar componentes específicos

Edita `.unimportedrc.json`:
```json
{
  "ignoreUnused": [
    "src/components/ui/**",
    "src/vite-env.d.ts"
  ]
}
```

### Ignorar dependencias de desarrollo

Edita `knip.json`:
```json
{
  "ignoreDependencies": [
    "@types/*",
    "vite",
    "@vitejs/plugin-react"
  ]
}
```

## 💡 Tips Específicos para React/Vite

1. **Componentes UI genéricos**: Considera mantenerlos aunque no se usen (son reutilizables)
2. **Lazy loading**: Knip puede no detectar componentes cargados con `React.lazy()`
3. **Bundle size**: Prioriza eliminar dependencias npm grandes
4. **Tipos TypeScript**: Los tipos no afectan el bundle final (se eliminan en build)

## 📚 Recursos

- [unimported docs](https://github.com/smeijer/unimported)
- [knip docs](https://knip.dev/)
- [Vite bundle analyzer](https://vitejs.dev/guide/build.html#building-for-production)

## 🎯 Próximos Pasos Sugeridos

1. ✅ Eliminar archivos `DEPRECATED*`
2. ✅ Desinstalar `papaparse` si no parseas CSV
3. ✅ Revisar componentes en `src/components/Sidebar/` no usados
4. ✅ Verificar si `NotificationPreferences.tsx` está deprecado
5. ⏳ Considerar eliminar `tailwindcss-animate` si no usas animaciones
